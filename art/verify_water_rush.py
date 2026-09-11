"""只读核对第二关资产及设计扫掠；不把静态计算当作玩法验收。"""
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
report = json.loads((ROOT/'art/water-rush-report.json').read_text())
layout_path = ROOT/'docs/levels/water-rush-layout.json'
layout = json.loads(layout_path.read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(ROOT/'art/water-rush.blend') == report['blend_sha256']
assert all(sha(ROOT/name) == digest for name, digest in report['protected_first_level'].items())


def load(entry):
    path = ROOT/'public/models'/entry['file']
    assert sha(path) == entry['sha256'], entry['file']
    raw = path.read_bytes()
    assert struct.unpack_from('<III', raw) == (0x46546c67, 2, len(raw))
    size = struct.unpack_from('<I', raw, 12)[0]
    data = json.loads(raw[20:20+size])
    binary = raw[28+size:]
    assert data['nodes'] == [{'mesh': 0, 'name': entry['node']}]
    assert not any(data.get(k) for k in ('textures','images','cameras','animations','extensionsRequired'))
    assert all('uri' not in b for b in data['buffers'])

    def accessor(index):
        a = data['accessors'][index]
        v = data['bufferViews'][a['bufferView']]
        count = {'SCALAR':1, 'VEC3':3}[a['type']]
        fmt = '<'+{5126:'f',5123:'H',5125:'I'}[a['componentType']]*count
        stride = v.get('byteStride', struct.calcsize(fmt))
        offset = v.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from(fmt,binary,offset+i*stride) for i in range(a['count'])]

    triangles = []
    for m in data['meshes']:
        for p in m['primitives']:
            assert p.get('mode',4) == 4
            points = accessor(p['attributes']['POSITION'])
            assert all(math.isfinite(v) for point in points for v in point)
            ids = [i[0] for i in accessor(p['indices'])]
            assert len(ids)%3 == 0 and max(ids)<len(points)
            triangles.extend([points[j] for j in ids[i:i+3]] for i in range(0,len(ids),3))
    assert len(triangles) == entry['triangles'] and len(data['materials']) == entry['materials']
    return triangles


def sub(a,b):
    return [a[i]-b[i] for i in range(3)]


def cross(a,b):
    return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]


def intersects(triangle, low, high):
    if any(max(p[i] for p in triangle)<low[i]-1e-7 or min(p[i] for p in triangle)>high[i]+1e-7 for i in range(3)):
        return False
    center = [(low[i]+high[i])/2 for i in range(3)]
    half = [(high[i]-low[i])/2 for i in range(3)]
    p = [sub(v,center) for v in triangle]
    edges = [sub(p[(i+1)%3],p[i]) for i in range(3)]
    basis = [(1,0,0),(0,1,0),(0,0,1)]
    for axis in [cross(edges[0],edges[1])]+[cross(e,a) for e in edges for a in basis]:
        values = [sum(v[i]*axis[i] for i in range(3)) for v in p]
        radius = sum(abs(axis[i])*half[i] for i in range(3))
        if min(values)>radius+1e-7 or max(values)<-radius-1e-7:
            return False
    return True


assets = {entry['node']: load(entry) for entry in report['exports']}
synced = sha(layout_path) == report['layout_sha256']
sweeps = []
turn_points=[p for triangle in assets['TurntableVisual'] for p in triangle]
cross_radius=max(math.hypot(p[0],p[2]) for p in turn_points)
assert cross_radius <= layout['turntable']['visualOuterRadiusLimit']+1e-5
assert min(p[1] for p in turn_points)+report['turntable_origin'][1] >= 2.9-1e-5
assert max(p[1] for p in turn_points)+report['turntable_origin'][1] <= 3.42+1e-5

def covers_xz(point,triangle):
    a,b,c=[(p[0],p[2]) for p in triangle]
    x,z=point[0],point[2]
    det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(det)<1e-10:
        return False
    u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/det
    v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/det
    return u>=-1e-8 and v>=-1e-8 and u+v<=1+1e-8

void_hits=[sum(covers_xz(p,t) for t in assets['TurntableVisual']) for p in layout['turntable']['voidProbesLocal']]
assert not any(void_hits), '十字空角仍有显示面或底板'
assert report['central_support_radius'] <= .55+1e-5
assert report['central_support_top_y'] <= 2.84+1e-5
if synced:
    specs = [('turntable', layout['turntable']['reservedSweepBounds']),
             ('crossing', layout['crossing']['sweepBounds'])]
    specs.extend((h['id'],h['reservedHeadSweepBounds']) for h in layout['hammers'])
    for instance in layout['lifts']['instances']:
        x,y,z = instance['center']
        w,h,d = layout['lifts']['bodySize']
        a = layout['lifts']['amplitude']
        specs.append((instance['id']+' deck/belly', {'min':[x-w/2,y-a-.38,z-d/2], 'max':[x+w/2,y+a+h/2+.004,z+d/2]}))
    for name, box in specs:
        hits = sum(intersects(t,box['min'],box['max']) for t in assets['TrackStatic'])
        sweeps.append({'name':name,'static_triangle_intersections':hits})
    assert all(s['static_triangle_intersections']==0 for s in sweeps), sweeps
    assert report['lift_stem_min_world_y'] >= layout['lifts']['visualUndersideEnvelopeMinY']-1e-6
    assert report['lift_sleeve_inner_radius']*math.cos(math.pi/32) > report['lift_stem_radius']
result = {'status':'passed' if synced else 'assets-pass-layout-awaiting-rebuild',
          'layout_sha256':report['layout_sha256'], 'layout_synced':synced,
          'source_sha256':report['blend_sha256'], 'assets':report['exports'], 'sweeps':sweeps,
          'first_level_unchanged':True, 'physics_playtest_verified_by_art':False,
          'cross_radius':cross_radius,'cross_void_probe_hits':void_hits,
          'central_support_radius':report['central_support_radius'],
          'limit':'Triangle/box and stem/sleeve geometry only; transfer, ramp and rotating contact need CODE playtest'}
print(json.dumps(result,ensure_ascii=False,indent=2))
