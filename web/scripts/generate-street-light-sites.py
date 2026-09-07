#!/usr/bin/env python3
"""Deterministic, interpreted lamp placement using the shipped OSM/terrain snapshot.
Run from the repository root: pipeline/.venv/bin/python web/scripts/generate-street-light-sites.py
--check validates the existing generated module against all original inputs without writing.
"""
from pathlib import Path
import collections, hashlib, json, math, re, struct, sys
import osmium
from shapely.geometry import Point, LineString, Polygon, box
from shapely.strtree import STRtree
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'pipeline'))
from roads import road_width
MP = 111320 * math.cos(math.radians(43.035))
def project(lon, lat): return ((lon + 87.905) * MP, -(lat - 43.035) * 110574)
CORE = (-1800, -2500, 1700, 1800)
STADIUM = (-6400, -500, -4400, 2100)
WISCONSIN = (-6400, -650, -1800, -250)
REGIONS = [CORE, STADIUM, WISCONSIN]

def inside(b, x, z): return b[0] <= x <= b[2] and b[1] <= z <= b[3]
def study(x, z): return any(inside(b, x, z) for b in REGIONS)
def near_study(b): return any(not(b[2]<r[0]or b[0]>r[2]or b[3]<r[1]or b[1]>r[3])for r in REGIONS)
# Custom public-realm systems already furnish these interiors. Public curbs outside remain eligible.
RESERVED = [(-605,-908,-472,-785), (-945,-1230,-785,-978),
            (575,-660,770,-405), (-1105,-1495,-920,-1334)]
SUMMERFEST = Polygon(json.loads(re.search(r'SUMMERFEST_BOUNDARY = (\[.*?\]) as const;', (ROOT/'web/src/summerfestSiteData.ts').read_text(), re.S)[1]))
EXISTING = [(-1097,-1460),(-1097,-1415),(-1097,-1370),(-1085,-1352),(-1055,-1352),(-1025,-1352)]
RAW = ROOT/'data/raw/osm/pbf_extract.json'
elements = json.loads(RAW.read_text())['elements']
print('Loaded original feature snapshot.', flush=True)
roads=[];buildings=[];waters=[];excluded=[];junction_incidence=collections.defaultdict(list)
STREETS={'primary','secondary','tertiary','residential','unclassified','living_street','pedestrian'}
for e in elements:
    tags=e.get('tags',{})
    if 'rings' in e:
        for ring in e['rings']:
            outer=[project(*p)for p in ring['outer']]
            if not near_study((min(x for x,z in outer),min(z for x,z in outer),max(x for x,z in outer),max(z for x,z in outer))):continue
            p=Polygon(outer,[[project(*p)for p in r]for r in ring['inner']])
            if not p.is_valid:p=p.buffer(0)
            if 'building' in tags and tags['building']!='no':buildings.append(p.buffer(.75))
            elif tags.get('natural')=='water' or tags.get('waterway')=='riverbank':waters.append(p)
    if not e.get('geometry') or 'highway' not in tags:continue
    coords=[project(p['lon'],p['lat'])for p in e['geometry']];line=LineString(coords)
    if not near_study(line.bounds) or line.length<1:continue
    hw=tags['highway'];width=road_width(tags)
    if not width:continue
    bridge=tags.get('bridge','no')!='no' or tags.get('tunnel','no')!='no' or tags.get('covered')=='yes'
    if bridge or hw in ('motorway','motorway_link','trunk','trunk_link'):
        excluded.append(line.buffer(width/2+3));continue
    # Only named public streets and public footways; avoid private/service operations.
    if hw not in STREETS|{'footway','path','cycleway'} or tags.get('access')in('private','no') or tags.get('foot')=='no':continue
    road={'id':e['id'],'tags':tags,'line':line,'width':width,'coords':coords,'street':hw in STREETS}
    roads.append(road)
    if road['street']:
        for k,p in enumerate(coords):
            for q in ([coords[k-1]]if k else [])+([coords[k+1]]if k+1<len(coords) else []):
                length=math.dist(p,q)
                if length>0:junction_incidence[tuple(round(v,2)for v in p)].append(((q[0]-p[0])/length,(q[1]-p[1])/length))
# Actual non-collinear street intersections, not every artificial way split.
junctions=[]
for p,dirs in junction_incidence.items():
    unique=[]
    for d in dirs:
        if not any(d[0]*q[0]+d[1]*q[1]>.95 for q in unique):unique.append(d)
    if len(unique)>=3:junctions.append(Point(p))
print(f'Indexed {len(roads)} public ways, {len(buildings)} building masks and {len(waters)} water polygons.', flush=True)
building_tree=STRtree(buildings);water_tree=STRtree(waters);excluded_tree=STRtree(excluded)
road_tree=STRtree([r['line']for r in roads]);junction_tree=STRtree(junctions)
street_surfaces=[r['line'].buffer(r['width']/2-.15)for r in roads if r['street']]
street_tree=STRtree(street_surfaces)
def intersects(tree,p):return len(tree.query(p,predicate='intersects'))>0

def terrain_data():
    b=(ROOT/'web/public/data/terrain.bin').read_bytes();nx,ny=struct.unpack_from('<II',b,4);x0,y0,step=struct.unpack_from('<fff',b,12)
    return nx,ny,x0,y0,step,struct.unpack_from('<'+'f'*(nx*ny),b,24)
NX,NY,X0,Y0,STEP,H=terrain_data()
def terrain(x,z):
    fx=(x-X0)/STEP;fy=(-z-Y0)/STEP;i=max(0,min(NX-2,math.floor(fx)));j=max(0,min(NY-2,math.floor(fy)));u=max(0,min(1,fx-i));v=max(0,min(1,fy-j));a,b,c,d=[H[k]for k in(j*NX+i,j*NX+i+1,(j+1)*NX+i,(j+1)*NX+i+1)]
    return a*(1-v)+c*(v-u)+d*u if v>=u else a*(1-u)+b*(u-v)+d*v
# Packed surfaces indexed once per tile. Keep actual ROAD, not guessed offset heights.
tiles={}
def tile_surfaces(i,j):
    if (i,j)in tiles:return tiles[i,j]
    path=ROOT/f'web/public/data/tiles/t_{i}_{j}.bin';triangles=[];polys=[]
    if path.exists():
        data=path.read_bytes();o=12
        for section in range(struct.unpack_from('<I',data,8)[0]):
            name=data[o:o+4].decode().strip();n=struct.unpack_from('<I',data,o+4)[0];ox,oy,oz,scale=struct.unpack_from('<ffff',data,o+8);o+=24
            if name=='ROAD':
                qs=struct.unpack_from('<'+'h'*(n*3),data,o)
                p=[(qs[k]*scale+ox,qs[k+1]*scale+oy,qs[k+2]*scale+oz)for k in range(0,len(qs),3)]
                for k in range(0,len(p),3):
                    tri=p[k:k+3];poly=Polygon([(x,z)for x,y,z in tri])
                    if poly.area>1e-5:polys.append(poly);triangles.append(tri)
            o=(o+n*6+3)//4*4;o=(o+n*3+3)//4*4
    tiles[i,j]=(STRtree(polys),triangles);return tiles[i,j]
def surface(x,z):
    t=terrain(x,z);tree,triangles=tile_surfaces(math.floor(x/2000),math.floor(-z/2000));hits=[]
    for k in tree.query(Point(x,z),predicate='intersects'):
        (ax,ay,az),(bx,by,bz),(cx,cy,cz)=triangles[k];den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz)
        if abs(den)<1e-9:continue
        u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den;v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;y=u*ay+v*by+(1-u-v)*cy
        if abs(y-t)<1.8:hits.append(y)
    return (max([t]+hits),'road' if hits and max(hits)>=t else 'terrain')

def district(x,z,road):
    name=road['tags'].get('name','').lower()
    if 'riverwalk'in name.lower() or 'river walk'in name.lower():return 'riverwalk','thirdWardRiverwalk'
    if inside(STADIUM,x,z):return 'stadium','stadiumCampus'
    if x<-1800:return 'wisconsinAvenue','downtownMast'
    if -650<x<950 and -180<z<1300:return 'thirdWard','thirdWardHeritage'
    if not road['street']:return 'landmarkCorridors','plazaEvent'
    return 'downtown','downtownMast'
GAP_LIMITS={'stadium':175,'riverwalk':110,'wisconsinAvenue':200,'downtown':550,'thirdWard':180,'landmarkCorridors':60}
rejections=collections.Counter();derived_counts=collections.Counter();sites=[];spacing_grid=collections.defaultdict(list)
def nearby_sites(x,z,distance):
    for i in range(math.floor((x-distance)/20),math.floor((x+distance)/20)+1):
        for j in range(math.floor((z-distance)/20),math.floor((z+distance)/20)+1):
            for s in spacing_grid[i,j]:
                if math.hypot(s['x']-x,s['z']-z)<distance:return True
    return False

def add(x,z,road,source,source_id,minimum):
    reason=None;p=Point(x,z)
    if not study(x,z):return
    d,kind=district(x,z,road)
    if source=='derived-road' and derived_counts[d]>=GAP_LIMITS[d]:return
    if any(inside(b,x,z)for b in RESERVED) or SUMMERFEST.contains(p):reason='custom-campus'
    elif any(math.hypot(x-a,z-b)<8 for a,b in EXISTING):reason='existing-lamp'
    elif intersects(building_tree,p):reason='building'
    elif intersects(water_tree,p):reason='water'
    elif intersects(excluded_tree,p):reason='bridge-tunnel-motorway'
    elif intersects(street_tree,p):reason='carriageway'
    elif intersects(junction_tree,p.buffer(8 if source=='osm-node'else 12)):reason='junction'
    elif nearby_sites(x,z,minimum):reason='spacing'
    if reason:rejections[reason]+=1;return
    y,basis=surface(x,z)
    if y<-.1:rejections['below-water-datum']+=1;return
    nearest=road['line'].interpolate(road['line'].project(p));heading=math.atan2(nearest.x-x,nearest.y-z)
    d,kind=district(x,z,road);water_near=intersects(water_tree,p.buffer(8));pool=not water_near and kind!='thirdWardRiverwalk'
    reach=2.2 if kind=='downtownMast'else 0
    pool_x=x+math.sin(heading)*reach;pool_z=z+math.cos(heading)*reach;pool_y,_=surface(pool_x,pool_z)
    site={'id':f"{'node'if source=='osm-node'else 'road'}-{source_id}-{len(sites)}",'x':round(x,3),'y':round(y,3),'z':round(z,3),'heading':round(heading,5),'kind':kind,'district':d,'pool':pool,'poolX':round(pool_x,3),'poolZ':round(pool_z,3),'poolY':round(pool_y+.025,3),'source':source,'sourceId':source_id,'surface':basis}
    sites.append(site)
    if source=='derived-road':derived_counts[d]+=1
    spacing_grid[math.floor(x/20),math.floor(z/20)].append(site)
# Prefer real OSM positions; profile choice remains interpretive unless separately tagged.
nodes=[]
class LampReader(osmium.SimpleHandler):
    def node(self,n):
        if n.tags.get('highway')=='street_lamp':nodes.append((n.id,*project(n.location.lon,n.location.lat)))
LampReader().apply_file(str(ROOT/'data/raw/milwaukee.osm.pbf'))
node_study=sum(study(x,z)for _,x,z in nodes)
for id,x,z in sorted(nodes):
    if not study(x,z):continue
    index=road_tree.nearest(Point(x,z));road=roads[index]
    if road['line'].distance(Point(x,z))>45:rejections['no-public-road']+=1;continue
    add(x,z,road,'osm-node',id,8)
print(f'Retained {len(sites)} mapped OSM lamps after safety/duplicate filters.', flush=True)
# Gap fill on mapped streets only, plus named RiverWalk and stadium public paths.
# Never use the illustrative strips in the reference pack.
def road_priority(r):
    p=r['line'].interpolate(.5,normalized=True);name=r['tags'].get('name','').lower()
    return (0 if inside(STADIUM,p.x,p.y)else 1 if 'riverwalk'in name or 'river walk'in name else 2 if 'wisconsin'in name else 3,r['id'])
for road in sorted(roads,key=road_priority):
    if len(sites)>=2200:break
    line=road['line'];name=road['tags'].get('name','').lower();mid=line.interpolate(.5,normalized=True)
    river='riverwalk'in name or 'river walk'in name
    stadium=inside(STADIUM,mid.x,mid.y)
    if not road['street'] and not river and not stadium:continue
    if road['street'] and not name and not stadium:continue
    if road['tags'].get('lit')=='no':continue
    if line.length<26:continue
    spacing=42 if stadium else 14 if river else 32
    d=14.0 if road['street']else 8.0
    while d<line.length-(14 if road['street']else 8) and len(sites)<2200:
        p=line.interpolate(d);a=line.interpolate(max(0,d-.5));b=line.interpolate(min(line.length,d+.5));dx=b.x-a.x;dz=b.y-a.y;length=math.hypot(dx,dz)
        if not length:d+=spacing;continue
        offset=road['width']/2+.8 if road['street']else road['width']/2+.18
        # Riverwalk uses one landward edge. Other streets alternate curb sides.
        sides=[1,-1]if river else ([1]if int(d/spacing)%2==0 else [-1])
        for side in sides:
            x=p.x-dz/length*offset*side;z=p.y+dx/length*offset*side
            prior=len(sites);_,kind=district(x,z,road)
            minimum=42 if kind=='stadiumCampus'else 8 if kind=='thirdWardRiverwalk'else 20 if kind in('thirdWardHeritage','plazaEvent')else 30
            add(x,z,road,'derived-road',road['id'],minimum)
            if river and len(sites)>prior:break
        d+=spacing
# Compact metadata: evidence and exclusions are auditable without implying survey completeness.
stats={'version':1,'snapshot':'2026-09-06','mappedNodesInExtract':len(nodes),'mappedNodesInStudyArea':node_study,'total':len(sites),
       'bySource':dict(collections.Counter(s['source']for s in sites)),'byKind':dict(collections.Counter(s['kind']for s in sites)),
       'byDistrict':dict(collections.Counter(s['district']for s in sites)),'bySurface':dict(collections.Counter(s['surface']for s in sites)),
       'rejected':dict(rejections),'gapFillLimits':GAP_LIMITS,'derivedSpacingM':{'downtownMast':30,'thirdWardHeritage':20,'thirdWardRiverwalk':8,'stadiumCampus':42,'plazaEvent':20},'minimumSpacingM':8,'buildingClearanceM':.75,'maxTotal':2200,
       'attribution':'© OpenStreetMap contributors, ODbL 1.0; positions derive from the local Geofabrik extract. Fixture profiles and gap fill are interpretive.',
       'rawSha256':hashlib.sha256(RAW.read_bytes()).hexdigest(),'pbfSha256':hashlib.sha256((ROOT/'data/raw/milwaukee.osm.pbf').read_bytes()).hexdigest()}
assert len(sites)<=2200
header='''/** Generated by web/scripts/generate-street-light-sites.py from the shipped OSM/terrain snapshot.
 * Mapped node coordinates take priority. Derived lamps fill selected public street/path gaps.
 * Fixture families are district interpretations, not a surveyed municipal asset inventory.
 * heading rotates local +Z toward the mapped public path/road centerline.
 * y is the actual pole-foot surface; poolX/Z locate the illuminated patch and
 * poolY is its sampled surface plus a 0.025 m display lift.
 */
export type StreetLightKind = 'downtownMast' | 'thirdWardHeritage' | 'thirdWardRiverwalk' | 'stadiumCampus' | 'plazaEvent';
export type StreetLightDistrict = 'downtown' | 'thirdWard' | 'riverwalk' | 'wisconsinAvenue' | 'stadium' | 'landmarkCorridors';
export interface StreetLightSite {
  readonly id: string; readonly x: number; readonly y: number; readonly z: number; readonly heading: number;
  readonly kind: StreetLightKind; readonly district: StreetLightDistrict; readonly pool: boolean; readonly poolX: number; readonly poolZ: number; readonly poolY: number;
  readonly source: 'osm-node' | 'derived-road'; readonly sourceId: number; readonly surface: 'road' | 'terrain';
}
'''
text=header+'export const STREET_LIGHT_STATS = '+json.dumps(stats,separators=(',',':'))+' as const;\n'
text+='export const STREET_LIGHT_SITES = JSON.parse('+json.dumps(json.dumps(sites,separators=(',',':')))+') as readonly StreetLightSite[];\n'
path=ROOT/'web/src/streetLightSites.ts'
if '--check'in sys.argv:
    assert path.read_text()==text,'Generated sites no longer match source geometry/ground surfaces; regenerate.'
    print('Verified generated artifact against original node/road/building/water/terrain inputs.')
else:path.write_text(text)
print(json.dumps(stats,indent=2))
