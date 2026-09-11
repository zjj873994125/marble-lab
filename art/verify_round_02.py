"""只读核对本轮 GLB、冻结配置快照及旧资源保护。"""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
report = json.loads((ROOT / 'art/round-02-report.json').read_text())
snapshot = json.loads((ROOT / 'art/round-02-level-snapshot.json').read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
for path, digest in report['source_baseline'].items():
    if path != 'liveBlender':
        assert sha(ROOT / path) == digest, f'旧资源已变化：{path}'
assert sha(ROOT / 'art/track-round-02.blend') == report['blend_sha256']
path = ROOT / 'public/models/track-round-02.glb'
assert sha(path) == report['glb_sha256']
blob = path.read_bytes()
magic, version, length = struct.unpack_from('<III', blob)
chunk_length, chunk_type = struct.unpack_from('<II', blob, 12)
assert (magic, version, length) == (0x46546C67, 2, len(blob))
assert chunk_type == 0x4E4F534A
data = json.loads(blob[20:20+chunk_length])
assert data['nodes'] == [{'mesh': 0, 'name': 'TrackStatic'}]
assert not any(data.get(key) for key in ('textures', 'images', 'animations', 'cameras', 'extensionsRequired'))
assert all('uri' not in buffer for buffer in data['buffers'])
primitives = [p for mesh in data['meshes'] for p in mesh['primitives']]
assert all(p.get('mode', 4) == 4 for p in primitives)
counts = [data['accessors'][p['indices']]['count'] for p in primitives]
assert all(c % 3 == 0 for c in counts)
triangles = sum(counts) // 3
assert triangles == report['triangles'] == 33363
assert len(data['materials']) == 6
assert {m['name'] for m in data['materials']} == {
    'Ivory polymer', 'Graphite chassis', 'Safety terracotta',
    'Rubber pads', 'Brushed alloy', 'Printed markings'}
positions = [data['accessors'][p['attributes']['POSITION']] for p in primitives]
lo = [min(p['min'][i] for p in positions) for i in range(3)]
hi = [max(p['max'][i] for p in positions) for i in range(3)]
assert report['removed_baked_dashes'] == 8 and len(report['preserved_objects']) == 176
assert report['junction_manifold'] and report['junction_duplicate_triangles'] == 0
assert report['rail_vertices_within_collision_union'] and not report['platform_reexported']
assert snapshot['sha256'] == report['level_sha256']
dashes = [o for o in snapshot['level']['staticObjects'] if o['name'] == 'Bridge edge dash']
assert len(dashes) == 8 and all('body' not in o and 'refinedVisual' not in o for o in dashes)
result = {'status': 'passed', 'triangles': triangles, 'materials': len(data['materials']),
          'primitives': len(primitives), 'bytes': len(blob), 'bounds_min': lo,
          'bounds_max': hi, 'dimensions_xyz_m': [hi[i]-lo[i] for i in range(3)],
          'origin': [0, 0, 0], 'coordinates': 'glTF Y-up', 'units': 'meters',
          'level_sha256': report['level_sha256'], 'blend_sha256': report['blend_sha256'],
          'glb_sha256': report['glb_sha256'], 'preserved_source_objects': 176,
          'old_assets_unchanged': True,
          'generator_sha256': sha(ROOT / 'art/refine_track_round_02.py')}
print(json.dumps(result, ensure_ascii=False, indent=2))
