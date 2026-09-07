"""Check regenerated road tiles against a pre-rebuild copy without altering assets."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import numpy as np
from config import OUT, ROOT, TILE_M
from rebuild_roads import sections


def audit(before):
    report = {'tiles': 0, 'buildingSectionsPreserved': 0, 'roadTriangles': 0,
              'structureTriangles': 0, 'downwardRoadTriangles': 0, 'violations': []}
    for path in sorted((OUT / 'tiles').glob('t_*.bin')):
        report['tiles'] += 1
        i,j=map(int,path.stem.replace('.lod','').split('_')[1:])
        current = dict(sections(path.read_bytes()))
        old_path = before / 'tiles' / path.name
        if old_path.exists():
            old = dict(sections(old_path.read_bytes()))
            if current.get(b'BLDG') != old.get(b'BLDG'):
                report['violations'].append(f'{path.name}: building bytes changed')
            else:
                report['buildingSectionsPreserved'] += 1
        for tag, raw in current.items():
            if tag not in (b'ROAD', b'HWAY'):
                continue
            n=struct.unpack_from('<I',raw,4)[0]
            center=np.array(struct.unpack_from('<fff',raw,8)); scale=struct.unpack_from('<f',raw,20)[0]
            packed=np.frombuffer(raw,dtype='<i2',count=n*3,offset=24).reshape(-1,3).astype(np.int64)
            p=packed*scale+center
            if not np.isfinite(p).all(): report['violations'].append(f'{path.name}: nonfinite {tag!r}')
            if n and (p[:,0].min()<i*TILE_M-.15 or p[:,0].max()>(i+1)*TILE_M+.15
                      or (-p[:,2]).min()<j*TILE_M-.15 or (-p[:,2]).max()>(j+1)*TILE_M+.15):
                report['violations'].append(f'{path.name}: {tag!r} outside tile')
            report['roadTriangles' if tag==b'ROAD' else 'structureTriangles']+=n//3
            if tag==b'ROAD' and n:
                triangles=packed.reshape(-1,3,3)
                normals=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
                bad=int(np.count_nonzero(normals[:,1]<0))
                report['downwardRoadTriangles']+=bad
                if bad: report['violations'].append(f'{path.name}: {bad} reversed ROAD triangles')
    report['manifestSha256']=hashlib.sha256((OUT/'manifest.json').read_bytes()).hexdigest()
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before',type=Path)
    parser.add_argument('--output',type=Path,default=ROOT/'data'/'highway-rebuild-validation.json')
    args=parser.parse_args(); result=audit(args.before)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2)); raise SystemExit(bool(result['violations']))
