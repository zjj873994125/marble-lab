"""核对锤头包围盒、支架净宽及原轨迹下的最低点，不代替游戏碰撞测试。"""
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'public/models/hammer-head-round-03.glb'
raw = path.read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
data = json.loads(raw[20:20+length])
ps = [data['accessors'][p['attributes']['POSITION']] for m in data['meshes'] for p in m['primitives']]
lo = [min(p['min'][i] for p in ps) for i in range(3)]
hi = [max(p['max'][i] for p in ps) for i in range(3)]
half = [(hi[i]-lo[i])/2 for i in range(3)]
assert max(abs(hi[i]+lo[i]) for i in range(3)) < 1e-5
# 原轨迹始终在YZ平面，+Y连接旋转不改变锤头的X包络。
post_inner_half = .8-.16/2
clearance = post_inner_half-half[0]
lowest = math.inf
highest = -math.inf
lengths = []
for i in range(7200):
    phase = i/7200*2*math.pi
    offset = 1.65*math.sin(phase)
    y, z = 4.3+abs(offset)*.16, -4+offset
    dy, dz = 7.9-y, -5.6-z
    distance = math.hypot(dy, dz)
    lengths.append(distance)
    vertical_half = half[1]*dy/distance+half[2]*abs(dz)/distance
    lowest = min(lowest, y-vertical_half)
    highest = max(highest, y+vertical_half)
print(json.dumps({'head_sha256': hashlib.sha256(raw).hexdigest(), 'dimensions_xyz_m': [h*2 for h in half],
                  'post_inner_width_m': post_inner_half*2, 'minimum_side_clearance_m': clearance,
                  'post_clearance_pass': clearance > 0, 'sampled_poses': 7200,
                  'head_lowest_y': lowest, 'head_highest_y': highest,
                  'track_surface_clearance_m': lowest-3.4,
                  'crossbeam_bottom_clearance_m': 7.8-highest,
                  'handle_length_range_m': [min(lengths), max(lengths)],
                  'limit': 'Analytic oriented head box and fixed supports; no runtime collision/contact proof'},
                 indent=2))
