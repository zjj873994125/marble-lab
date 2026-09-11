"""按用户授权就地维护当前轨道，只裁短越过内转角的栏杆；不生成备份。"""
import hashlib
import json
import struct
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BLEND = ROOT / 'art/track-round-03.blend'
GLB = ROOT / 'public/models/track-round-03.glb'
REPORT = ROOT / 'art/track-round-03-report.json'
PREVIEW = ROOT / 'docs/art/round-03-evidence/track-without-corner-rails.png'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
previous = json.loads(REPORT.read_text())
assert sha(BLEND) == previous['blend_sha256'], '当前源文件有新编辑，先检查冲突'
assert sha(GLB) == previous['glb_sha256'], '当前GLB有新编辑，先检查冲突'
bpy.ops.wm.open_mainfile(filepath=str(BLEND))
scene = bpy.context.scene
rail = bpy.data.objects['Start guide.001']


def signature(obj):
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    data = [[list(row) for row in obj.matrix_world], [list(v.co) for v in mesh.vertices],
            [(list(p.vertices), p.material_index) for p in mesh.polygons], [m.name for m in mesh.materials]]
    bpy.data.meshes.remove(mesh)
    return hashlib.sha256(json.dumps(data).encode()).hexdigest()


preserved = {o.name: signature(o) for o in bpy.data.objects if o != rail}
# 保留起点端Z=7，只将转角端收至Z=-2.5；固定件均已在新范围内。
rail.location = (-8.45, -2.25, 3.53)
rail.dimensions = (.12, 9.5, .26)
bpy.context.view_layer.objects.active = rail
bpy.ops.object.select_all(action='DESELECT')
rail.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.update()
assert abs(rail.location.y+rail.dimensions.y/2-2.5) < 1e-5
assert all(signature(bpy.data.objects[name]) == h for name, h in preserved.items())
platform = {o.name for o in bpy.data.objects if o.name.startswith('Platform') and o.name != 'Platform identifier'}
assert len(platform) == 11
scene['current_rail_end_game_z'] = -2.5
assert sha(BLEND) == previous['blend_sha256'], '写入前源文件发生并发变化'
# 用户明确不需要备份；仅本次保存临时关闭Blender版本副本。
backup_count = bpy.context.preferences.filepaths.save_version
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.context.preferences.filepaths.save_version = backup_count

camera_data = bpy.data.cameras.new('Review camera')
camera = bpy.data.objects.new('Review camera', camera_data)
scene.collection.objects.link(camera)
target = Vector((-8.45, 2.5, 3.4))
camera.location = target+Vector((3, -9, 13))
camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 4.5
scene.camera = camera
lamp_data = bpy.data.lights.new('Review sun', 'SUN')
lamp_data.energy = 3
lamp = bpy.data.objects.new('Review sun', lamp_data)
scene.collection.objects.link(lamp)
lamp.rotation_euler = (.4, -.5, -.3)
for name in platform:
    bpy.data.objects[name].hide_render = True
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1200, 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.render.filepath = str(PREVIEW)
bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action='DESELECT')
copies = []
for obj in list(bpy.data.objects):
    if obj.type in ('MESH', 'FONT') and obj.name not in platform:
        clone = obj.copy()
        clone.data = obj.data.copy()
        scene.collection.objects.link(clone)
        clone.select_set(True)
        copies.append(clone)
bpy.context.view_layer.objects.active = copies[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
combined = bpy.context.object
combined.name = 'TrackStatic'
scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
assert sha(GLB) == previous['glb_sha256'], '导出前GLB发生并发变化'
bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB', use_selection=True,
                          export_apply=True, export_animations=False, export_cameras=False,
                          export_lights=False, export_texcoords=False)
blob = GLB.read_bytes()
size = struct.unpack_from('<I', blob, 12)[0]
data = json.loads(blob[20:20+size])
primitives = [p for m in data['meshes'] for p in m['primitives']]
positions = [data['accessors'][p['attributes']['POSITION']] for p in primitives]
lo = [min(p['min'][i] for p in positions) for i in range(3)]
hi = [max(p['max'][i] for p in positions) for i in range(3)]
report = {'blend_sha256': sha(BLEND), 'glb_sha256': sha(GLB),
          'triangles': sum(data['accessors'][p['indices']]['count']//3 for p in primitives),
          'materials': len(data['materials']), 'bytes': len(blob), 'bounds_min': lo, 'bounds_max': hi,
          'dimensions_xyz_m': [hi[i]-lo[i] for i in range(3)], 'origin': [0, 0, 0],
          'units': 'meters', 'coordinates': 'glTF Y-up', 'preserved_objects': preserved,
          'rail': {'position': [-8.45, 3.53, 2.25], 'size': [.12, .26, 9.5], 'z_endpoints': [-2.5, 7]},
          'status': 'Current file updated in place; no backup; configuration matching pending'}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print('TRACK_UPDATE', json.dumps({k:v for k,v in report.items() if k!='preserved_objects'}))
