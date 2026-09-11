"""只读校验平端玩具锤、当前资源和原轨迹净隙。"""
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
baseline = json.loads((ROOT / 'art/round-03-source-baseline.json').read_text())
for name, digest in baseline.items():
    if name != 'liveBlender':
        assert sha(ROOT / name) == digest, name
report = json.loads((ROOT / 'art/hammer-toy-round-03-report.json').read_text())
assert sha(ROOT / 'art/hammer-toy-round-03.blend') == report['source_sha256']
results = {}
for kind, expected in [('head', [.9, .9, 1.36]), ('handle', [.12, 1, .12])]:
    entry = report[kind]
    path = ROOT / 'public/models' / entry['file']
    raw = path.read_bytes()
    assert sha(path) == entry['sha256']
    assert struct.unpack_from('<III', raw) == (0x46546C67, 2, len(raw))
    length = struct.unpack_from('<I', raw, 12)[0]
    data = json.loads(raw[20:20+length])
    binary = raw[28+length:]
    assert data['nodes'] == [{'mesh': 0, 'name': entry['node']}]
    assert not any(data.get(k) for k in ('images', 'textures', 'animations', 'cameras', 'extensionsRequired'))
    assert all('uri' not in b for b in data['buffers'])
    all_points, shell_errors = [], []
    flat_areas = {-1: 0.0, 1: 0.0}
    for mesh in data['meshes']:
        for primitive in mesh['primitives']:
            a = data['accessors'][primitive['attributes']['POSITION']]
            view = data['bufferViews'][a['bufferView']]
            assert a['componentType'] == 5126 and a['type'] == 'VEC3'
            offset = view.get('byteOffset', 0)+a.get('byteOffset', 0)
            points = [struct.unpack_from('<fff', binary, offset+i*view.get('byteStride', 12)) for i in range(a['count'])]
            all_points.extend(points)
            if kind == 'head' and data['materials'][primitive['material']]['name'] == 'Toy amber shell':
                shell_errors.extend(max(0, math.hypot(x, y)-.45, abs(z)-.68) for x, y, z in points)
                indices = data['accessors'][primitive['indices']]
                iv = data['bufferViews'][indices['bufferView']]
                fmt = {5123: '<H', 5125: '<I'}[indices['componentType']]
                start = iv.get('byteOffset', 0)+indices.get('byteOffset', 0)
                ids = [struct.unpack_from(fmt, binary, start+i*struct.calcsize(fmt))[0] for i in range(indices['count'])]
                for i in range(0, len(ids), 3):
                    a, b, c = [points[j] for j in ids[i:i+3]]
                    for side in (-1, 1):
                        if all(abs(p[2]-side*.68) < 1e-5 for p in (a, b, c)):
                            flat_areas[side] += abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2
    lo = [min(p[i] for p in all_points) for i in range(3)]
    hi = [max(p[i] for p in all_points) for i in range(3)]
    assert max(abs(hi[i]-lo[i]-expected[i]) for i in range(3)) < 1e-5
    if kind == 'head':
        assert shell_errors and max(shell_errors) < 1e-5
        head_shell_error = max(shell_errors)
        assert min(flat_areas.values()) > .5, '锤头缺少足够大的平面击打端'
        head_flat_areas = dict(flat_areas)
        sleeve_excess = max(math.hypot(x, y)-.45 for x, y, z in all_points)
        assert sleeve_excess < .012
    results[kind] = {'sha256': sha(path), 'bounds_min': lo, 'bounds_max': hi,
                     'dimensions_xyz_m': [hi[i]-lo[i] for i in range(3)],
                     'materials': entry['materials'], 'triangles': entry['triangles'], 'bytes': len(raw)}

minimum_y = math.inf
maximum_y = -math.inf
for i in range(7200):
    offset = 1.65*math.sin(i/7200*2*math.pi)
    y, z = 4.3+abs(offset)*.16, -4+offset
    dy, dz = 7.9-y, -5.6-z
    distance = math.hypot(dy, dz)
    # 外盒比倒角圆柱更保守，连上侧小连接套一起覆盖。
    vertical_half = .45*dy/distance+.68*abs(dz)/distance
    minimum_y = min(minimum_y, y-vertical_half)
    maximum_y = max(maximum_y, y+vertical_half)
assert minimum_y > 3.4 and maximum_y < 7.8
results.update({'status': 'passed', 'source_sha256': report['source_sha256'], 'samples': 7200,
                'cylinder_shell_max_outside_m': head_shell_error,
                'flat_striking_face_area_m2': head_flat_areas,
                'sleeve_radial_excess_m': sleeve_excess, 'minimum_post_side_clearance_m': .72-.45,
                'conservative_head_lowest_y': minimum_y, 'conservative_head_highest_y': maximum_y,
                'old_assets_unchanged': True,
                'limit': 'Mesh/analytic pose checks only; cylinder contact and full motion checked by CODE'})
print(json.dumps(results, ensure_ascii=False, indent=2))
