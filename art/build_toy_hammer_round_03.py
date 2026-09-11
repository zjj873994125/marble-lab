"""在当前玩具锤源文件内改平端面并覆写同名GLB；按用户要求不备份。"""
import hashlib
import json
import math
import struct
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/hammer-toy-round-03.blend'
REPORT = ROOT / 'art/hammer-toy-round-03-report.json'
OUT = ROOT / 'public/models'
PREVIEW = ROOT / 'docs/art/round-03-evidence'
CONTRACT = ROOT / 'docs/integration/round-03-contract.md'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
previous = json.loads(REPORT.read_text())
assert sha(SOURCE) == previous['source_sha256'], '当前锤子源文件有新编辑，先检查冲突'
assert sha(OUT / previous['head']['file']) == previous['head']['sha256']
assert sha(OUT / previous['handle']['file']) == previous['handle']['sha256']
contract_hash = sha(CONTRACT)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene

def position(v):
    return (v[0], -v[2], v[1])

obj = bpy.data.objects.get('Toy capsule head') or bpy.data.objects['Toy flat-faced head']
material = obj.data.materials[0]
# 圆柱长轴沿游戏Z；击打面为平面，只保留3.5厘米边缘倒角。
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=.45, depth=1.36, rotation=(math.pi/2, 0, 0))
temp = bpy.context.object
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
obj.data = temp.data
obj.data.name = 'Flat-ended toy hammer cylinder'
bpy.data.objects.remove(temp, do_unlink=True)
obj.name = 'Toy flat-faced head'
obj.data.materials.clear()
obj.data.materials.append(material)
obj.modifiers.clear()
for face in obj.data.polygons:
    face.use_smooth = abs(face.normal.y) < .9
bevel = obj.modifiers.new('Small rim bevel', 'BEVEL')
bevel.width = .035
bevel.segments = 3
normal = obj.modifiers.new('Flat face normals', 'WEIGHTED_NORMAL')
normal.keep_sharp = True
normal.weight = 50
head = [obj, bpy.data.objects['Inset toy handle socket']]
handle = [bpy.data.objects['Normalized toy handle']]
scene['contract_sha256'] = contract_hash
scene['head_bounds_game_xyz'] = [.9, .9, 1.36]
scene['head_shape'] = 'Z-axis flat-ended cylinder; radius .45; total length 1.36; .035 rim bevel'
assert sha(SOURCE) == previous['source_sha256'], '保存前源文件发生并发修改'
backup_count = bpy.context.preferences.filepaths.save_version
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.context.preferences.filepaths.save_version = backup_count

def export_group(objects, node, filename, expected):
    bpy.ops.object.select_all(action='DESELECT')
    copies = []
    for obj in objects:
        clone = obj.copy()
        clone.data = obj.data.copy()
        scene.collection.objects.link(clone)
        clone.select_set(True)
        copies.append(clone)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = node
    scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    path = OUT / filename
    assert sha(path) == previous['head']['sha256'], '导出前锤头GLB有并发修改'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_apply=True, export_animations=False, export_cameras=False,
                              export_lights=False, export_texcoords=False)
    blob = path.read_bytes()
    length = struct.unpack_from('<I', blob, 12)[0]
    data = json.loads(blob[20:20+length])
    assert data['nodes'] == [{'mesh': 0, 'name': node}]
    parts = [p for m in data['meshes'] for p in m['primitives']]
    positions = [data['accessors'][p['attributes']['POSITION']] for p in parts]
    lo = [min(p['min'][i] for p in positions) for i in range(3)]
    hi = [max(p['max'][i] for p in positions) for i in range(3)]
    assert max(abs(hi[i]-lo[i]-expected[i]) for i in range(3)) < 1e-5
    assert max(abs(hi[i]+lo[i]) for i in range(3)) < 1e-5
    result = {'file': filename, 'node': node, 'sha256': sha(path), 'bounds_min': lo, 'bounds_max': hi,
              'dimensions_xyz_m': [hi[i]-lo[i] for i in range(3)], 'materials': len(data['materials']),
              'triangles': sum(data['accessors'][p['indices']]['count']//3 for p in parts), 'bytes': len(blob)}
    bpy.data.objects.remove(obj, do_unlink=True)
    return result


report = {'source_sha256': sha(SOURCE), 'contract_sha256': contract_hash,
          'units': 'meters', 'coordinates': 'glTF Y-up; Blender (x,-z,y)', 'origins': [0, 0, 0],
          'head': export_group(head, 'HammerHead', 'hammer-head-toy-round-03.glb', [.9, .9, 1.36]),
          'handle': previous['handle']}

head_root = bpy.data.objects.new('Preview head mount', None)
handle_root = bpy.data.objects.new('Preview handle mount', None)
scene.collection.objects.link(head_root)
scene.collection.objects.link(handle_root)
for obj in head:
    obj.parent = head_root
for obj in handle:
    obj.parent = handle_root


def pose(center, anchor):
    a, b = Vector(position(anchor)), Vector(position(center))
    rotation = Vector((0, 0, 1)).rotation_difference((a-b).normalized())
    for root in (head_root, handle_root):
        root.rotation_mode = 'QUATERNION'
        root.rotation_quaternion = rotation
    head_root.location = b
    handle_root.location = (a+b)/2
    handle_root.scale = (1, 1, (a-b).length)
    bpy.context.view_layer.update()
    # 归一柄的两个端点应在任意姿态精确连接锚点和头中心。
    assert (handle_root.matrix_world @ Vector((0, 0, .5))-a).length < 1e-5
    assert (handle_root.matrix_world @ Vector((0, 0, -.5))-b).length < 1e-5
    return (a-b).length


def render(name, target, scale, offset=(5, -8, 5)):
    path = PREVIEW / name
    camera_data = bpy.data.cameras.new('Review camera')
    camera = bpy.data.objects.new('Review camera', camera_data)
    scene.collection.objects.link(camera)
    target = Vector(position(target))
    camera.location = target+Vector(offset)
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = scale
    scene.camera = camera
    lamp_data = bpy.data.lights.new('Review key', 'AREA')
    lamp_data.energy = 1500
    lamp_data.shape = 'DISK'
    lamp_data.size = 8
    lamp = bpy.data.objects.new('Review key', lamp_data)
    scene.collection.objects.link(lamp)
    lamp.location = target+Vector((2, -5, 8))
    lamp.rotation_euler = (target-lamp.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = True
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(lamp, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    bpy.data.lights.remove(lamp_data)


pose([0, 0, 0], [0, 3.8, 0])
render('toy-hammer-assembled.png', [0, 1.6, 0], 5.3)
render('toy-hammer-head-detail.png', [0, 0, 0], 2.4, (4, -8, 4))
with bpy.data.libraries.load(str(ROOT / 'art/track-round-03.blend'), link=False) as (available, loaded):
    loaded.objects = [n for n in available.objects if not n.startswith('Platform') or n == 'Platform identifier']
for obj in loaded.objects:
    scene.collection.objects.link(obj)
poses = []
for name, phase in [('center', 0), ('positive', math.pi/2), ('negative', 3*math.pi/2)]:
    offset = math.sin(phase)*1.65
    center = [-5.5, 4.3+abs(offset)*.16, -4+offset]
    length = pose(center, [-5.5, 7.9, -5.6])
    render(f'toy-hammer-connection-{name}.png', [-5.5, 5.9, -4.8], 6, (6, -9, 5))
    poses.append({'phase_radians': phase, 'head_center': center, 'handle_length': length})
report['connection_previews'] = poses
report['limit'] = 'Flat-ended Z cylinder; runtime cylinder contact and final game validation by CODE'
report['head_shape'] = 'Z cylinder; radius .45; total length 1.36; planar ends with .035 rim bevel'
report['updates_in_place'] = True
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print('TOY_HAMMER_ROUND_03', json.dumps(report))
