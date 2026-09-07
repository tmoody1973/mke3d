"""Normalize bundled Hop GTFS and map-match it to cached OSM tram topology.

Run from repository root: pipeline/.venv/bin/python pipeline/build_hop.py
No network requests. The bundled operator snapshot and terrain/ROAD tiles are inputs.
"""
from pathlib import Path
from collections import defaultdict, Counter
from functools import lru_cache
import argparse, csv, datetime, hashlib, heapq, json, math, struct
import numpy as np
import osmium
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree
from config import ROOT, RAW, OUT
from rebuild_roads import sections, terrain_sampler

DEFAULT_PACK = Path('/Users/tarikmoody/Downloads/the_hop_threejs_reference_and_animation_pack')

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def rows(folder, name):
    with (folder/name).open(encoding='utf-8-sig') as source:return list(csv.DictReader(source))
def date(s): return f'{s[:4]}-{s[4:6]}-{s[6:8]}'
def seconds(s):
    if not s: return None
    h,m,s = map(int,s.split(':')); return h*3600+m*60+s

def distances(points):
    d=[0.0]
    for a,b in zip(points,points[1:]):d.append(d[-1]+math.hypot(b[0]-a[0],b[-1]-a[-1]))
    return d

class TrackReader(osmium.SimpleHandler):
    def __init__(self): super().__init__(); self.ways=[]
    def way(self,w):
        if w.tags.get('railway')=='tram':
            self.ways.append({'id':str(w.id),'tags':dict(w.tags),'coordinates':[(n.lon,n.lat) for n in w.nodes]})

class Graph:
    def __init__(self,ways,project):
        self.points=[]; self.index={};self.adj=defaultdict(list);self.edges={};self.ways=ways
        for way in ways:
            if way['tags'].get('fixme'):continue # Maintenance depot geometry is explicitly uncertain.
            ids=[]
            for x,z in densify([project(lon,lat)for lon,lat in way['coordinates']], 6):
                key=(round(x,5),round(z,5))
                if key not in self.index:self.index[key]=len(self.points);self.points.append((x,z))
                ids.append(self.index[key])
            for a,b in zip(ids,ids[1:]):
                if a==b:continue
                dist=math.dist(self.points[a],self.points[b]);self.adj[a].append((b,dist));self.edges[a,b]=way['id']
                if way['tags'].get('railway:preferred_direction')!='forward':
                    self.adj[b].append((a,dist));self.edges[b,a]=way['id']
        self.array=np.array(self.points)
    @lru_cache(maxsize=100000)
    def route(self,a,b):
        queue=[(0,a)]; cost={a:0};prev={}
        while queue:
            d,n=heapq.heappop(queue)
            if n==b:
                nodes=[b]
                while nodes[-1]!=a:nodes.append(prev[nodes[-1]])
                return d,list(reversed(nodes))
            if d!=cost[n]:continue
            for nxt,length in self.adj[n]:
                nd=d+length
                if nd<cost.get(nxt,float('inf')):cost[nxt]=nd;prev[nxt]=n;heapq.heappush(queue,(nd,nxt))
        return float('inf'),[]
    def match(self,shape):
        # Anchor spacing retains every supplied turn while avoiding duplicate coordinates.
        anchors=[shape[0]]
        for p in shape[1:-1]:
            if math.dist(p,anchors[-1])>8:anchors.append(p)
        anchors.append(shape[0])
        candidates=[]
        for p in anchors:
            dd=np.linalg.norm(self.array-p,axis=1)
            candidates.append([(int(i),float(dd[i])) for i in np.argsort(dd)[:32]])
        start=candidates[0][0][0]; candidates[0]=[(start,math.dist(self.points[start],anchors[0]))]; candidates[-1]=candidates[0]
        states={start:(0,[])}
        for index,cands in enumerate(candidates[1:],1):
            expected=math.dist(anchors[index-1],anchors[index]);new={}
            for node,error in cands:
                options=[]
                for prior,(score,history) in states.items():
                    length,_=self.route(prior,node)
                    if length>expected+350:continue
                    # Distances penalize skipped turns and wrong-direction parallel track.
                    options.append((score+error*.4+abs(length-expected),history+[prior]))
                if options:new[node]=min(options,key=lambda v:v[0])
            if not new:raise ValueError(f'No directed map match at index {index}: {anchors[index]}; prior {[(i,self.points[i],v[0])for i,v in states.items()]}; candidates {[(i,self.points[i],d)for i,d in cands]}')
            states=new
        score,history=states[start];history.append(start);result=[]
        for a,b in zip(history,history[1:]):result.extend(self.route(a,b)[1][:-1])
        result.append(start)
        return result,score

class Surface:
    """Sample packed ROAD top triangles; choose the lower street, never I-794 above it."""
    def __init__(self,bounds):
        self.ground=terrain_sampler();self.tri=[];self.sources=[];self.fallback=0;self.nearby=0
        for path in sorted((OUT/'tiles').glob('t_*.bin')):
            if '.lod.' in path.name:continue
            i,j=map(int,path.stem.split('_')[1:]);x0=i*2000;z0=-(j+1)*2000
            if x0+2000<bounds[0] or x0>bounds[2] or z0+2000<bounds[1] or z0>bounds[3]:continue
            self.sources.append({'path':str(path.relative_to(ROOT)),'sha256':digest(path)})
            for tag,raw in sections(path.read_bytes()):
                if tag!=b'ROAD':continue
                n=struct.unpack_from('<I',raw,4)[0];center=np.array(struct.unpack_from('<fff',raw,8));scale=struct.unpack_from('<f',raw,20)[0]
                tri=(np.frombuffer(raw,dtype='<i2',count=n*3,offset=24).reshape(-1,3)*scale+center).reshape(-1,3,3)
                for t in tri:
                    xz=t[:,[0,2]]
                    u=xz[1]-xz[0];v=xz[2]-xz[0]
                    if abs(u[0]*v[1]-u[1]*v[0])>.002:self.tri.append(t)
        self.polys=[Polygon(t[:,[0,2]])for t in self.tri];self.tree=STRtree(self.polys)
    @lru_cache(maxsize=30000)
    def at(self,x,z):
        p=Point(x,z);indices=self.tree.query(p);hits=[];ground=self.ground(x,-z)
        def allowed(y):return y<ground+4 or (-475<x<-350 and -10<z<45 and y<10)
        for i in indices:
            if self.polys[i].covers(p):
                y=self.height(i,x,z)
                if allowed(y):hits.append(y)
        bridge=(-465<x<-360 and -2<z<40)
        if bridge:
            for i in self.tree.query(p.buffer(6)):
                if allowed(float(self.tri[i][:,1].mean())):
                    closest=self.polys[i].exterior.interpolate(self.polys[i].exterior.project(p))
                    hits.append(self.height(i,closest.x,closest.y))
        if not hits:
            # Packed edges have 0.1m quantization; nearby road within 4m only.
            near=self.tree.query(p.buffer(4));near=sorted((i for i in near if allowed(float(self.tri[i][:,1].mean()))),key=lambda i:self.polys[i].distance(p))
            if len(near):
                distance=self.polys[near[0]].distance(p)
                for i in near:
                    if self.polys[i].distance(p)>distance+.1:break
                    closest=self.polys[i].exterior.interpolate(self.polys[i].exterior.project(p));hits.append(self.height(i,closest.x,closest.y))
                self.nearby+=1
        if hits:
            deck=max(hits) if (-465<x<-360 and -2<z<40) else min(hits,key=lambda y:abs(y-(ground+.4)))
            return round(deck+.055,4)
        self.fallback+=1;return round(self.ground(x,-z)+.455,4)
    def height(self,i,x,z):
        t=self.tri[i];a=t[0,[0,2]];b=t[1,[0,2]]-a;c=t[2,[0,2]]-a
        u,v=np.linalg.solve(np.column_stack((b,c)),np.array([x,z])-a)
        return float(t[0,1]+u*(t[1,1]-t[0,1])+v*(t[2,1]-t[0,1]))

def densify(points,step=3):
    result=[points[0]]
    for a,b in zip(points,points[1:]):
        count=max(1,math.ceil(math.dist(a,b)/step))
        result.extend([(a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count)for i in range(1,count+1)])
    return result

def stop_candidates(stop,points,ds):
    candidates=[]
    for a,b,d0,d1 in zip(points,points[1:],ds,ds[1:]):
        v=np.array([b[0]-a[0],b[2]-a[2]]);p=np.array([stop[0]-a[0],stop[2]-a[2]])
        f=float(np.clip(p@v/(v@v),0,1));error=float(np.linalg.norm(p-f*v));distance=d0+f*(d1-d0)
        candidates.append((error,distance))
    best=min(c[0]for c in candidates)
    # GTFS platforms sometimes lie nearer opposite-direction rail. Retain each
    # local visit within 25m, then choose its closest projection monotonically.
    nearby=sorted(((e,d)for e,d in candidates if e<best+25),key=lambda c:c[1]);clusters=[]
    for candidate in nearby:
        if not clusters or candidate[1]-clusters[-1][-1][1]>20:clusters.append([])
        clusters[-1].append(candidate)
    return [min(cluster)for cluster in clusters]

def attach_stops(ids,stops,path):
    length=path['length'];previous=-1;result=[]
    for sid in ids:
        candidates=stop_candidates(stops[sid]['position'],path['points'],path['distances'])
        choices=[]
        for error,d in candidates:
            while d<previous+1:d+=length
            choices.append((d,error))
        # Only choose the earliest visit from equally good spatial candidates.
        distance,error=min(choices);result.append(distance);previous=distance
    return result

def interpolate_times(times,ds):
    inferred=[]
    for i,value in enumerate(times):
        if value is not None:continue
        before=next((j for j in range(i-1,-1,-1)if times[j]is not None),None)
        after=next((j for j in range(i+1,len(times))if times[j]is not None),None)
        if before is None or after is None:raise ValueError(f'Ambiguous terminal missing time at index {i}')
        fraction=(ds[i]-ds[before])/(ds[after]-ds[before])
        times[i]=round(times[before]+fraction*(times[after]-times[before]));inferred.append(i)
    return times,inferred

def build(pack=DEFAULT_PACK):
    gtfs=pack/'gtfs/current';manifest=json.loads((OUT/'manifest.json').read_text())
    def project(lon,lat):return ((lon-manifest['origin']['lon'])*manifest['mPerDegLon'],-(lat-manifest['origin']['lat'])*manifest['mPerDegLat'])
    print('Extracting cached tram ways…',flush=True);reader=TrackReader();reader.apply_file(str(RAW/'milwaukee.osm.pbf'),locations=True)
    graph=Graph(reader.ways,project);route_rows=rows(gtfs,'routes.txt');shape_rows=rows(gtfs,'shapes.txt');paths=[];physical=defaultdict(set);matches={}
    for route in route_rows:
        rid=route['route_id'];shape=[project(float(p['shape_pt_lon']),float(p['shape_pt_lat']))for p in sorted((p for p in shape_rows if p['shape_id']==rid),key=lambda p:int(p['shape_pt_sequence']))]
        nodes,score=graph.match(shape);coords=[graph.points[i]for i in nodes];matches[rid]={'sourcePoints':len(shape),'matchedNodes':len(nodes),'score':round(score,2)}
        for a,b in zip(nodes,nodes[1:]):physical[(a,b)].add(rid)
        paths.append({'id':rid,'routeId':rid,'name':route['route_long_name'].replace(' THE HOP',''),'color':'#'+route['route_color'],'points':densify(coords)})
        print('Matched',rid,len(nodes),round(distances(coords)[-1]),flush=True)
    allpoints=np.array([p for path in paths for p in path['points']]);bounds=(*allpoints.min(axis=0),*allpoints.max(axis=0));surface=Surface(bounds)
    for path in paths:
        path['points']=[[round(x,4),surface.at(x,z),round(z,4)]for x,z in path['points']];path['distances']=[round(v,5)for v in distances(path['points'])];path['length']=path['distances'][-1]
    # Repair only isolated quantized ROAD seams, not the overall terrain grade.
    # A symmetric 12m neighborhood bridges abrupt >20% pitch changes; disclosed.
    repaired=defaultdict(list);repair_count=0;repair_max=0
    for path in paths:
        pp=path['points'];ds=path['distances'];original=[p[1]for p in pp];bad=set()
        for i in range(len(pp)-1):
            if abs(original[i+1]-original[i])/(ds[i+1]-ds[i])>.2:bad.update(range(max(0,i-3),min(len(pp),i+5)))
        for i in bad:
            values=[(max(0,12-abs(ds[j]-ds[i])),original[j])for j in range(max(0,i-8),min(len(pp),i+9)) if abs(ds[j]-ds[i])<12]
            y=sum(w*h for w,h in values)/sum(w for w,h in values);repair_max=max(repair_max,abs(y-original[i]));repair_count+=1
            repaired[(pp[i][0],pp[i][2])].append(round(y,4))
    corrections={key:sum(values)/len(values)for key,values in repaired.items()}
    def track_y(x,z):
        # All render assets use the same quantized coordinate key and sampler.
        # Sampling raw coordinates here while paths use rounded ones introduces
        # small mismatches even away from the explicitly repaired road seams.
        key=(round(x,4),round(z,4))
        return round(corrections.get(key,surface.at(*key)),4)
    for path in paths:
        for p in path['points']:p[1]=track_y(p[0],p[2])
    tracks=[]
    for (a,b),members in physical.items():
        coords=densify([graph.points[a],graph.points[b]])
        tracks.append({'id':f"{graph.edges[a,b]}:{a}:{b}",'points':[[round(x,4),track_y(x,z),round(z,4)]for x,z in coords],'routeIds':sorted(members)})
    stops={}
    for row in rows(gtfs,'stops.txt'):
        x,z=project(float(row['stop_lon']),float(row['stop_lat']));stops[row['stop_id']]={'id':row['stop_id'],'name':row['stop_name'],'position':[round(x,4),surface.at(x,z),round(z,4)]}
    stoprows=defaultdict(list)
    for row in rows(gtfs,'stop_times.txt'):stoprows[row['trip_id']].append(row)
    attach_cache={};trips=[];missing=0;pathdict={p['id']:p for p in paths}
    for row in rows(gtfs,'trips.txt'):
        sr=sorted(stoprows[row['trip_id']],key=lambda s:int(s['stop_sequence']));ids=tuple(s['stop_id']for s in sr);key=(row['shape_id'],ids)
        if key not in attach_cache:attach_cache[key]=attach_stops(ids,stops,pathdict[row['shape_id']])
        ds=attach_cache[key];times,inf=interpolate_times([seconds(s['arrival_time'])for s in sr],ds);missing+=len(inf)
        trip={'id':row['trip_id'],'routeId':row['route_id'],'serviceId':row['service_id'],'blockId':row['block_id'],'pathId':row['shape_id'],'stops':[]}
        for i,s in enumerate(sr):
            st={'stopId':s['stop_id'],'arrival':times[i],'departure':seconds(s['departure_time'])or times[i],'distance':round(ds[i],5)}
            if i in inf:st['inferred']=True
            trip['stops'].append(st)
        trips.append(trip)
    calendars=[{'id':r['service_id'],'start':date(r['start_date']),'end':date(r['end_date']),'weekdays':[r[d]=='1'for d in ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']]}for r in rows(gtfs,'calendar.txt')]
    exceptions=[{'serviceId':r['service_id'],'date':date(r['date']),'type':int(r['exception_type'])}for r in rows(gtfs,'calendar_dates.txt')]
    provenance={'retrievedDate':'2026-09-06','attribution':['City of Milwaukee / The Hop: supplied GTFS snapshot','© OpenStreetMap contributors, ODbL 1.0: mapped tram alignment'],'sourceCRS':'EPSG:4326','projection':{k:manifest[k]for k in ['origin','mPerDegLat','mPerDegLon']},'gaugeM':1.435,'gaugeEvidence':{'tag':'gauge=1435','wayCount':sum(w['tags'].get('gauge')=='1435'for w in reader.ways)},'mapMatching':matches,'osmTramWays':len(reader.ways),'interpolatedStopTimes':missing,'ambiguousMissingTimes':0,'surfaceSeamRepairSamples':repair_count,'maxSurfaceSeamRepairM':round(repair_max,4),'surfaceNearbySamples':surface.nearby,'surfaceTerrainFallbackSamples':surface.fallback,'elevation':'Packed ROAD triangle closest to local surface grade + 0.055 m; reject overhead freeway surfaces. St Paul selects bridge deck within 6m; elsewhere nearest triangle within 4m then terrain+0.455m fallback. Isolated >20% grade seams blended in symmetric 12m neighborhood. Not surveyed elevations.','estimated':['Stop-to-track projection','Distance-weighted interpolation of missing bounded times','Terrain fallback at non-road track','Local ROAD seam interpolation','Track geometry is mapped, not survey certified'],'inputs':[{'path':str(p.relative_to(pack)),'sha256':digest(p)}for p in sorted(gtfs.glob('*.txt'))]+[{'path':'data/raw/milwaukee.osm.pbf','sha256':digest(RAW/'milwaukee.osm.pbf')},{'path':'web/public/data/terrain.bin','sha256':digest(OUT/'terrain.bin')},{'path':'web/public/data/manifest.json','sha256':digest(OUT/'manifest.json')}]+surface.sources,'couturePassage':[{'osmWay':w['id'],'points':[[round(x,4),surface.at(x,z),round(z,4)]for x,z in map(lambda p:project(*p),w['coordinates'])]}for w in reader.ways if w['tags'].get('tunnel')=='building_passage']}
    result={'version':1,'defaultDate':'2026-09-08','defaultTime':43200,'paths':paths,'physicalTracks':tracks,'stops':list(stops.values()),'trips':trips,'calendars':calendars,'exceptions':exceptions,'provenance':provenance}
    destination=OUT/'hop';destination.mkdir(exist_ok=True);(destination/'network.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
    print(json.dumps({'paths':len(paths),'stops':len(stops),'trips':len(trips),'missing':missing,'physicalSegments':len(tracks),'fallbacks':surface.fallback,'nearby':surface.nearby}),flush=True)
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--pack',type=Path,default=DEFAULT_PACK);args=parser.parse_args();build(args.pack)
