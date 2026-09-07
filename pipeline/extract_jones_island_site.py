#!/usr/bin/env python3
"""Extract public exterior geometry for north Jones Island from cached OSM."""

from __future__ import annotations

import argparse, json, math, struct
from collections import Counter
from pathlib import Path
import osmium
from shapely.geometry import Point, Polygon
from config import LAT0, LON0, M_PER_DEG_LAT, M_PER_DEG_LON, TYPE_HEIGHTS

WEST,EAST,SOUTH,NORTH=-87.903,-87.891,43.012,43.029
WETLAND_BOUNDS=(-87.905,-87.89,42.995,43.012)

def project(lon,lat): return [round((lon-LON0)*M_PER_DEG_LON,3),round(-(lat-LAT0)*M_PER_DEG_LAT,3)]
def in_box(lon,lat,b=(WEST,EAST,SOUTH,NORTH)): return b[0]<=lon<=b[1] and b[2]<=lat<=b[3]
def height(tags):
    try: return round(float(tags.get('height','').replace('m','').strip()),2)
    except ValueError: pass
    try: return round(float(tags.get('building:levels',''))*3.3,2)
    except ValueError: return TYPE_HEIGHTS.get(tags.get('building','industrial'),9.0)

class Handler(osmium.SimpleHandler):
    def __init__(self): super().__init__();self.basins=[];self.buildings=[];self.green=[];self.anchors=[]
    def node(self,n):
        if not n.location.valid(): return
        t=dict(n.tags);name=t.get('name','')
        if in_box(n.lon,n.lat) and ('kaszub' in name.lower() or t.get('historic')=='memorial' or t.get('man_made') in {'chimney','tower'}):
            kind=t.get('man_made') or 'marker';row={'id':f'node/{n.id}','name':name or kind.title(),'kind':kind,'position':project(n.lon,n.lat)}
            try:row['height']=float(t['height'].replace('m','').strip())
            except (KeyError,ValueError):pass
            self.anchors.append(row)
    def way(self,w):
        t=dict(w.tags);raw=[(n.lon,n.lat) for n in w.nodes if n.location.valid()]
        if len(raw)<4 or raw[0]!=raw[-1]: return
        wet=t.get('natural')=='wetland' or t.get('wetland')
        if not any(in_box(*p,WETLAND_BOUNDS if wet else (WEST,EAST,SOUTH,NORTH)) for p in raw): return
        poly=Polygon([project(*p) for p in raw])
        if not poly.is_valid or poly.area<20:return
        footprint=[[round(x,3),round(z,3)] for x,z in poly.exterior.coords[:-1]]
        center=[round(poly.centroid.x,3),round(poly.centroid.y,3)]
        radius=round(math.sqrt(poly.area/math.pi),2)
        name=t.get('name')
        water=t.get('natural')=='water' or t.get('landuse') in {'basin','reservoir'} or t.get('water') in {'basin','wastewater'}
        if water:
            if center[0]<250:return
            row={'id':w.id,'footprint':footprint,'center':center,'radius':radius,'kind':t.get('water') or t.get('landuse') or 'water'}
            if name:row['name']=name
            self.basins.append(row);return
        if t.get('building') and poly.area>=180:
            if center[0]<250:return
            row={'id':w.id,'footprint':footprint,'height':height(t),'kind':t.get('building'),'center':center,
                 'bounds':{'width':round(poly.bounds[2]-poly.bounds[0],2),'depth':round(poly.bounds[3]-poly.bounds[1],2)}}
            if name:row['name']=name
            self.buildings.append(row);return
        if t.get('leisure')=='park' or t.get('landuse') in {'grass','recreation_ground'} or wet:
            kind='wetland' if wet else 'park' if t.get('leisure')=='park' else 'green'
            row={'id':w.id,'footprint':footprint,'center':center,'area':round(poly.area,1),'kind':kind}
            if name:row['name']=name
            self.green.append(row)
            if kind=='park' and ('kaszub' in (name or '').lower()):
                self.anchors.append({'id':f'way/{w.id}','name':name,'kind':'park','position':center})

def emit(h):
    pack=lambda v:json.dumps(v,separators=(',',':'),ensure_ascii=False)
    site={'focus':{'x':650,'z':1300},'bounds':{'west':WEST,'east':EAST,'south':SOUTH,'north':NORTH},
          'waterHeight':0,'source':'OpenStreetMap contributors; cached data/raw/milwaukee.osm.pbf'}
    return f'''/** Generated from cached OSM; X east, Z south, metres. */
export type JonesPoint=readonly [number,number];
export const JONES_ISLAND_SITE={pack(site)} as const;
export const JONES_BASINS={pack(sorted(h.basins,key=lambda x:x['id']))} as const;
export const JONES_BUILDINGS={pack(sorted(h.buildings,key=lambda x:x['id']))} as const;
export const JONES_GREEN_AREAS={pack(sorted(h.green,key=lambda x:x['id']))} as const;
export const JONES_ANCHORS={pack(sorted(h.anchors,key=lambda x:x['id']))} as const;
'''

def rendered_water_vertices(path):
    data=path.read_bytes();version,sections=struct.unpack_from('<II',data,4);assert version==2
    offset=12;points=[]
    for _ in range(sections):
        name=data[offset:offset+4].decode().strip();offset+=4
        count=struct.unpack_from('<I',data,offset)[0];offset+=4
        ox,oy,oz,scale=struct.unpack_from('<ffff',data,offset);offset+=16
        if name=='WATR':
            for i in range(count):
                qx,qy,qz=struct.unpack_from('<hhh',data,offset+i*6)
                points.append((qx*scale+ox,qy*scale+oy,qz*scale+oz))
        offset=(offset+count*6+3)//4*4;offset=(offset+count*3+3)//4*4
    return points

def add_water_heights(basins,path):
    vertices=rendered_water_vertices(path)
    for basin in basins:
        polygon=Polygon(basin['footprint'])
        levels=Counter(round(y,4) for x,y,z in vertices if polygon.covers(Point(x,z)))
        if levels:basin['waterY']=levels.most_common(1)[0][0]

def main():
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,default=Path('data/raw/milwaukee.osm.pbf'));p.add_argument('--water',type=Path,default=Path('web/public/data/water.bin'));p.add_argument('--output',type=Path,default=Path('web/src/jonesIslandSite.ts'));a=p.parse_args()
    h=Handler();h.apply_file(a.input,locations=True);add_water_heights(h.basins,a.water);a.output.write_text(emit(h),encoding='utf-8')
    print(len(h.basins),'basins',len(h.buildings),'buildings',len(h.green),'green areas',len(h.anchors),'anchors')
if __name__=='__main__':main()
