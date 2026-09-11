"""独立核对新静态 GLB 与横向平台完整外观扫掠体，无需运行游戏。"""
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    raw = path.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    data = json.loads(raw[20:20+length])
    binary = raw[28+length:]
    assert all(not any(k in n for k in ('matrix', 'translation', 'rotation', 'scale')) for n in data['nodes'])

    def accessor(index):
        a = data['accessors'][index]
        view = data['bufferViews'][a['bufferView']]
        count = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        fmt = '<' + {5126: 'f', 5123: 'H', 5125: 'I'}[a['componentType']] * count
        stride = view.get('byteStride', struct.calcsize(fmt))
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from(fmt, binary, offset+i*stride) for i in range(a['count'])]

    triangles = []
    for mesh in data['meshes']:
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4
            points = accessor(primitive['attributes']['POSITION'])
            indices = [i[0] for i in accessor(primitive['indices'])]
            triangles.extend([points[j] for j in indices[i:i+3]] for i in range(0, len(indices), 3))
    return triangles


def subtract(a, b):
    return [a[i]-b[i] for i in range(3)]


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def intersects(triangle, center, half):
    points = [subtract(p, center) for p in triangle]
    edges = [subtract(points[(i+1)%3], points[i]) for i in range(3)]
    basis = [(1, 0, 0), (0, 1, 0), (0, 0, 1)]
    axes = basis + [cross(edges[0], edges[1])] + [cross(e, axis) for e in edges for axis in basis]
    for axis in axes:
        values = [sum(p[i]*axis[i] for i in range(3)) for p in points]
        radius = sum(half[i]*abs(axis[i]) for i in range(3))
        if min(values) > radius+1e-8 or max(values) < -radius-1e-8:
            return False
    return True


assert intersects([(0, 0, 0), (.5, 0, 0), (0, .5, 0)], [0, 0, 0], [1, 1, 1])
assert not intersects([(2, 2, 2), (3, 2, 2), (2, 3, 2)], [0, 0, 0], [1, 1, 1])
platform = load(ROOT / 'public/models/platform-refined.glb')
points = [p for t in platform for p in t]
lo = [min(p[i] for p in points) for i in range(3)]
hi = [max(p[i] for p in points) for i in range(3)]
base, amplitude, speed = [8, 3.22, -.35], 3.4, 1.25
sweep_lo = [base[i]+lo[i]-(amplitude if i == 0 else 0) for i in range(3)]
sweep_hi = [base[i]+hi[i]+(amplitude if i == 0 else 0) for i in range(3)]
center = [(a+b)/2 for a, b in zip(sweep_lo, sweep_hi)]
half = [(b-a)/2 for a, b in zip(sweep_lo, sweep_hi)]
track = ROOT / 'public/models/track-round-03.glb'
triangles = load(track)
hits = [i for i, triangle in enumerate(triangles) if intersects(triangle, center, half)]
assert not hits, f'平台扫掠与静态模型相交：{hits[:10]}'
print(json.dumps({'status': 'passed', 'track_sha256': hashlib.sha256(track.read_bytes()).hexdigest(),
                  'track_triangles': len(triangles), 'static_triangle_intersections': len(hits),
                  'sweep_bounds_min': sweep_lo, 'sweep_bounds_max': sweep_hi,
                  'x_center_extremes': [4.6, 11.4], 'clearance_at_extremes_m': .4,
                  'each_complete_clear_window_seconds': (math.pi-2*math.asin(3/amplitude))/speed,
                  'period_seconds': 2*math.pi/speed, 'max_speed_mps': amplitude*speed,
                  'z_gaps_m': [.2, .3],
                  'limit': 'Static GLB surfaces only; runtime guides and physical crossing require CODE-03 verification'},
                 ensure_ascii=False, indent=2))
