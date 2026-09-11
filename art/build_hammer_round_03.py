"""按 CODE-03 协议另存独立锤头与归一长度锤柄。"""
import hashlib
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/hammer-round-03.blend'
REPORT = ROOT / 'art/hammer-round-03-report.json'
OUT = ROOT / 'public/models'
PREVIEW = ROOT / 'docs/art/round-03-evidence'
CONTRACT = ROOT / 'docs/integration/round-03-contract.md'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for path in (SOURCE, REPORT, OUT / 'hammer-head-round-03.glb', OUT / 'hammer-handle-round-03.glb'):
    assert not path.exists(), f'不覆盖现有资源：{path}'
contract_hash = sha(CONTRACT)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
with bpy.data.libraries.load(str(ROOT / 'art/track-round-02.blend'), link=False) as (available, loaded):
    loaded.materials = ['Safety terracotta', 'Graphite chassis', 'Brushed alloy', 'Rubber pads']
orange, dark, alloy, rubber = loaded.materials
head, handle = [], []


def position(v):
    return (v[0], -v[2], v[1])


def finish(obj, name, mat, radius, group):
    obj.name = name
    obj.data.materials.append(mat)
    if radius:
        mod = obj.modifiers.new('Machined edge radius', 'BEVEL')
        mod.width = radius
        mod.segments = 3
        normal = obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
        normal.weight = 50
    for face in obj.data.polygons:
        face.use_smooth = True
    group.append(obj)
    return obj


def box(name, center, size, mat, radius=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position(center))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, radius, head)


box('Hammer orange housing', [0, -.05, 0], [1.6, .8, .9], orange, .06)
for side in (-1, 1):
    box(f'Strike alloy backing {side}', [0, -.055, side*.49], [1.46, .66, .10], alloy, .025)
    box(f'Flat striking face {side}', [0, -.055, side*.54], [1.30, .50, .02], dark, .008)
box('Handle socket flange', [0, .32, 0], [.46, .10, .46], dark, .025)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.18, depth=.18, location=position([0, .36, 0]))
finish(bpy.context.object, 'Handle connection sleeve', alloy, .012, head)
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=.06, depth=1, location=(0, 0, 0))
shaft = finish(bpy.context.object, 'Normalized mechanical shaft', alloy, .004, handle)
shaft.data.materials.append(dark)
for face in shaft.data.polygons:
    if abs(face.normal.x) > .85:
        face.material_index = 1
scene['contract_sha256'] = contract_hash
scene['head_bounds_game_xyz'] = [1.6, .9, 1.1]
scene['handle_bounds_game_xyz'] = [.12, 1, .12]
scene['origin_contract'] = 'Both at local center; glTF +Y points to anchor; handle scales only along Y'
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))


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
          'head': export_group(head, 'HammerHead', 'hammer-head-round-03.glb', [1.6, .9, 1.1]),
          'handle': export_group(handle, 'HammerHandle', 'hammer-handle-round-03.glb', [.12, 1, .12])}

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
    assert not path.exists()
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
render('hammer-assembled.png', [0, 1.6, 0], 5.3)
render('hammer-head-detail.png', [0, 0, 0], 2.4, (4, -8, 4))
with bpy.data.libraries.load(str(ROOT / 'art/track-round-03.blend'), link=False) as (available, loaded):
    loaded.objects = [n for n in available.objects if not n.startswith('Platform') or n == 'Platform identifier']
for obj in loaded.objects:
    scene.collection.objects.link(obj)
poses = []
for name, phase in [('center', 0), ('positive', math.pi/2), ('negative', 3*math.pi/2)]:
    offset = math.sin(phase)*1.65
    center = [-5.5, 4.3+abs(offset)*.16, -4+offset]
    length = pose(center, [-5.5, 7.9, -5.6])
    render(f'hammer-connection-{name}.png', [-5.5, 5.9, -4.8], 6, (6, -9, 5))
    poses.append({'phase_radians': phase, 'head_center': center, 'handle_length': length})
report['connection_previews'] = poses
report['limit'] = 'Blender previews and endpoint geometry; runtime loading, box collision and full-cycle verification by CODE-03'
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print('HAMMER_ROUND_03', json.dumps(report))
