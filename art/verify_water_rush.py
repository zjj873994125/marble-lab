"""只读核对第二关资产及设计扫掠；不把静态计算当作玩法验收。"""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
report = json.loads((ROOT/'art/water-rush-report.json').read_text())
layout_path = ROOT/'docs/levels/water-rush-layout.json'
layout = json.loads(layout_path.read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(ROOT/'art/water-rush.blend') == report['blend_sha256']
assert all(sha(ROOT/name) == digest for name, digest in report['protected_first_level'].items())


if '--source' in sys.argv:
    import bpy
    from mathutils import Euler, Matrix, Vector

    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/water-rush.blend'))
    basis = Matrix(((1,0,0),(0,0,-1),(0,1,0)))
    game = lambda p: Vector((p[0],p[2],-p[1]))
    dg = bpy.context.evaluated_depsgraph_get()

    def points(name):
        obj = bpy.data.objects[name].evaluated_get(dg)
        mesh = obj.to_mesh()
        result = [game(obj.matrix_world@v.co) for v in mesh.vertices]
        obj.to_mesh_clear()
        return result

    specs = layout['staticDecks']+layout['ramps']+layout['sBend']['collisionSegments']+layout['staticRails']
    errors = []
    endpoint_errors = []
    for spec in specs:
        obj = bpy.data.objects[spec['id']]
        rotation = Euler(tuple(math.radians(v) for v in spec.get('rotationEulerDegrees',[0,0,0])), 'XYZ').to_matrix()
        errors.append((game(obj.location)-Vector(spec['bodyCenter'])).length)
        actual = basis.transposed()@obj.matrix_world.to_3x3()@basis
        errors.append(max(abs(actual[i][j]-rotation[i][j]) for i in range(3) for j in range(3)))
        local = [game(v.co) for v in obj.data.vertices]
        errors.extend(abs(max(v[i] for v in local)-min(v[i] for v in local)-spec['bodySize'][i]) for i in range(3))
        for sign,key in [(1,'topStart'),(-1,'topEnd'),(1,'bodyStartFaceCenter'),(-1,'bodyEndFaceCenter')]:
            if key in spec:
                v = Vector((sign*spec['bodySize'][0]/2,spec['bodySize'][1]/2,0))
                endpoint_errors.append((game(obj.matrix_world@(basis@v))-Vector(spec[key])).length)
    assert max(errors+endpoint_errors)<1e-5, (max(errors),max(endpoint_errors))
    support = [p for o in bpy.data.objects if o.name.startswith('Turntable spindle') for p in points(o.name)]
    cx,_,cz = layout['turntable']['bodyCenter']
    radius = max(math.hypot(p.x-cx,p.z-cz) for p in support)
    top = max(p.y for p in support)
    assert radius <= .55+1e-5 and top <= 2.84+1e-5
    bridge_widths = {}
    for name,limit in [('narrow-bridge Graphite chassis control',.86),('narrow-bridge Recessed orange gasket control',.89),('narrow-bridge support 1 mounting flange',.74),('narrow-bridge support 2 mounting flange',.74)]:
        ps = points(name)
        width = max(p.x for p in ps)-min(p.x for p in ps)
        assert abs(width-limit)<1e-5, (name,width)
        bridge_widths[name]=width
    lift_checks = []
    for instance in layout['lifts']['instances']:
        name = instance['id']
        stem, sleeve, belly, foot = [points(name+' '+suffix) for suffix in ('sliding stem','hollow sleeve','graphite belly','alloy foot')]
        a = layout['lifts']['amplitude']
        radial = lambda p: math.hypot(p.x-instance['center'][0],p.z-instance['center'][2])
        check = {'id':name,'stem_low_y':min(p.y for p in stem)-a,
                 'belly_sleeve_gap':min(p.y for p in belly)-a-max(p.y for p in sleeve),
                 'stem_foot_gap':min(p.y for p in stem)-a-max(p.y for p in foot),
                 'high_insertion':max(p.y for p in sleeve)-(min(p.y for p in stem)+a),
                 'radial_clearance':min(map(radial,sleeve))*math.cos(math.pi/32)-max(map(radial,stem)),
                 'sleeve_bottom_y':min(p.y for p in sleeve),'sleeve_top_y':max(p.y for p in sleeve)}
        assert check['belly_sleeve_gap']>=.11-1e-5 and check['stem_foot_gap']>=.06-1e-5
        assert check['high_insertion']>=.16-1e-5 and check['radial_clearance']>.019
        assert abs(check['sleeve_bottom_y']+.18)<1e-5 and abs(check['sleeve_top_y']-1.85)<1e-5
        lift_checks.append(check)
    paired = layout.get('runtimeIntegration',{}).get('assetsPaired',False)
    report.update(central_support_radius=radius,central_support_top_y=top,
                  stage='Challenge model geometry verified; runtime integration and full route playtest pending',
                  pending=([] if paired else ['Restore refined models in LevelConfig'])+['CODE refined model integration, full challenge route and mobile playtest'])
    report['source_geometry_validation'] = {'source_sha256':report['blend_sha256'],'layout_sha256':sha(layout_path),
        'controls_checked':len(specs),'max_control_error_m':max(errors),'max_endpoint_error_m':max(endpoint_errors),
        'bridge_widths_m':bridge_widths,'lifts':lift_checks}
    (ROOT/'art/water-rush-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['source_geometry_validation'],ensure_ascii=False,indent=2))
    raise SystemExit(0)


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
synced = sha(layout_path) == report['source_geometry_validation']['layout_sha256']
assert synced, '交付布局已变化，需重新核对'
source_check = report['source_geometry_validation']
assert source_check['source_sha256'] == report['blend_sha256'] and source_check['layout_sha256'] == sha(layout_path)
sweeps = []
turn_points=[p for triangle in assets['TurntableVisual'] for p in triangle]
cross_radius=max(math.hypot(p[0],p[2]) for p in turn_points)
assert cross_radius <= layout['turntable']['visualOuterRadiusLimit']+1e-5
assert min(p[1] for p in turn_points)+report['turntable_origin'][1] >= 2.9-1e-5
assert max(p[1] for p in turn_points)+report['turntable_origin'][1] <= 3.42+1e-5
half_width=layout['turntable']['armWidth']/2
assert all(abs(p[0])<=half_width+.07 or abs(p[2])<=half_width+.07 for p in turn_points), '中心或底座仍超出新十字轮廓'
section_z=(layout['turntable']['span']/2+half_width)/2
section_x=[]
for triangle in assets['TurntableVisual']:
    for a,b in zip(triangle,triangle[1:]+triangle[:1]):
        if abs(a[2]-b[2])>1e-8 and min(a[2],b[2])<=section_z<=max(a[2],b[2]):
            t=(section_z-a[2])/(b[2]-a[2])
            section_x.append(a[0]+t*(b[0]-a[0]))
assert section_x and abs(max(section_x)-min(section_x)-2*half_width)<1e-5, '各层臂宽未同步新配置'

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
s_top = [t for t in assets['TrackStatic'] if all(abs(p[1]-3.4)<1e-5 for p in t)]
s_samples = []
for segment in layout['sBend']['collisionSegments']:
    start,end = segment['pathStart'],segment['pathEnd']
    dx,dz = end[0]-start[0],end[2]-start[2]
    length = math.hypot(dx,dz)
    for fraction in (0,.25,.5,.75,1):
        for lateral in (-.85,0,.85):
            p = [start[0]+dx*fraction-dz/length*lateral,3.4,start[2]+dz*fraction+dx/length*lateral]
            assert any(covers_xz(p,t) for t in s_top), ('S弯台面缺口',segment['id'],p)
            s_samples.append(p)
old_route_voids = [[6,3.4,-10],[0,3.4,-10],[12.6,3.4,-18],[-3.4,3.4,-18]]
upper_triangles = [t for t in assets['TrackStatic'] if min(p[1] for p in t)>3.3]
old_route_hits = [sum(covers_xz(p,t) for t in upper_triangles) for p in old_route_voids]
assert not any(old_route_hits), '旧直道或S弯内部仍有悬空台面'
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
result = {'status':'passed' if synced else 'assets-pass-layout-metadata-review-needed',
          'layout_sha256':sha(layout_path), 'layout_synced':synced,
          'asset_geometry_source_sha256':report['layout_sha256'],
          'source_sha256':report['blend_sha256'], 'assets':report['exports'], 'sweeps':sweeps,
          'first_level_unchanged':True, 'physics_playtest_verified_by_art':False,
          'cross_radius':cross_radius,'cross_void_probe_hits':void_hits,
          'central_support_radius':report['central_support_radius'],
          'source_geometry_validation':source_check,
          's_bend_surface_samples':len(s_samples),'old_route_void_probe_hits':old_route_hits,
          'limit':'Triangle/box and stem/sleeve geometry only; transfer, ramp and rotating contact need CODE playtest'}
print(json.dumps(result,ensure_ascii=False,indent=2))
