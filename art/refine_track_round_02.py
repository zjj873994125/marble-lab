"""从现有源文件另存本轮显示修复；拒绝覆盖已有交付。"""
import hashlib
import json
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/track-refined.blend'
BLEND = ROOT / 'art/track-round-02.blend'
GLB = ROOT / 'public/models/track-round-02.glb'
REPORT = ROOT / 'art/round-02-report.json'
PREVIEW = ROOT / 'docs/art/round-02-evidence'
BASELINE = json.loads((ROOT / 'art/round-02-source-baseline.json').read_text())
SNAPSHOT = json.loads((ROOT / 'art/round-02-level-snapshot.json').read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


for relative, expected in BASELINE.items():
    if relative != 'liveBlender':
        assert sha(ROOT / relative) == expected, f'输入资源发生变化：{relative}'
for path in (BLEND, GLB, REPORT):
    assert not path.exists(), f'不覆盖现有交付：{path}'
assert sha(ROOT / 'src/levels/initial-gravity.ts') == SNAPSHOT['sha256']
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
assert scene.unit_settings.system == 'METRIC' and scene.unit_settings.scale_length == 1


def evaluated_signature(obj):
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    data = {'matrix': [list(row) for row in obj.matrix_world],
            'vertices': [list(v.co) for v in mesh.vertices],
            'polygons': [(list(p.vertices), p.material_index) for p in mesh.polygons],
            'materials': [m.name for m in mesh.materials]}
    bpy.data.meshes.remove(mesh)
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


names = ['Start guide', 'Start guide.001', 'Corner guide', 'Corner guide.001',
         'Bridge guide', 'Bridge guide.001']
rails = [bpy.data.objects[name] for name in names]
proxies = [o for o in SNAPSHOT['level']['staticObjects']
           if o.get('body') == 'static' and o['name'] in ('Safety rail', 'Corner rail', 'Bridge rail')]
assert len(proxies) == len(rails) == 6
for obj in rails:
    center = [obj.location.x, obj.location.z, -obj.location.y]
    size = [obj.dimensions.x, obj.dimensions.z, obj.dimensions.y]
    assert any(max(abs(a-b) for a, b in zip(center, p['position'])) < 1e-5
               and max(abs(a-b) for a, b in zip(size, p['size'])) < 1e-5 for p in proxies)

dashes = [o for o in bpy.data.objects if o.name.startswith('Narrow caution dash')]
assert len(dashes) == 8
changed_names = set(names + [o.name for o in dashes])
preserved = {o.name: evaluated_signature(o) for o in bpy.data.objects
             if o.type in ('MESH', 'FONT') and o.name not in changed_names}
platform_names = {o.name for o in bpy.data.objects
                  if o.name.startswith('Platform') and o.name != 'Platform identifier'}
assert len(platform_names) == 11
PREVIEW.mkdir(parents=True, exist_ok=True)


def preview(filename, target, ortho):
    """临时灯光和相机仅用于美术预览，不写入源文件或 GLB。"""
    path = PREVIEW / filename
    assert not path.exists(), f'不覆盖预览：{path}'
    camera_data = bpy.data.cameras.new('Review camera')
    camera = bpy.data.objects.new('Review camera', camera_data)
    scene.collection.objects.link(camera)
    target = Vector((target[0], -target[2], target[1]))
    camera.location = target + Vector((3, -9, 13))
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = ortho
    scene.camera = camera
    lamp_data = bpy.data.lights.new('Review sun', 'SUN')
    lamp_data.energy = 3
    lamp_data.angle = 0.1
    lamp = bpy.data.objects.new('Review sun', lamp_data)
    scene.collection.objects.link(lamp)
    lamp.rotation_euler = (0.4, -0.5, -0.3)
    hidden = {name: bpy.data.objects[name].hide_render for name in platform_names}
    for name in platform_names:
        bpy.data.objects[name].hide_render = True
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = True
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    for name, value in hidden.items():
        bpy.data.objects[name].hide_render = value
    scene.camera = None
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(lamp, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    bpy.data.lights.remove(lamp_data)


preview('corner-before.png', (-8.45, 3.53, -2.45), 2.3)
orange = bpy.data.materials['Safety terracotta']
for obj in rails:
    obj.data.materials.clear()
    obj.data.materials.append(orange)

# 对原倒角外形求并集，保留短端和原轮廓，避免裁掉显示后留下隐形碰撞。
a, b = bpy.data.objects['Start guide.001'], bpy.data.objects['Corner guide.001']
for obj in (a, b):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
bpy.context.view_layer.objects.active = a
modifier = a.modifiers.new('Continuous collision-union junction', 'BOOLEAN')
modifier.operation = 'UNION'
modifier.solver = 'EXACT'
modifier.object = b
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.data.objects.remove(b, do_unlink=True)
a.name = 'Start corner continuous guard'
for face in a.data.polygons:
    face.use_smooth = True
normal = a.modifiers.new('Continuous junction normals', 'WEIGHTED_NORMAL')
normal.keep_sharp = True
normal.weight = 50

bm = bmesh.new()
bm.from_mesh(a.data)
assert all(e.is_manifold for e in bm.edges), '护栏并集出现非流形边'
assert bm.calc_volume() > 0
union_volume = bm.calc_volume()
bm.free()
a.data.calc_loop_triangles()
triangles = [tuple(sorted(tuple(round(c, 6) for c in a.data.vertices[i].co)
                         for i in tri.vertices)) for tri in a.data.loop_triangles]
assert len(set(triangles)) == len(triangles), '护栏并集存在重复三角面'
for vertex in a.data.vertices:
    v = a.matrix_world @ vertex.co
    point = [v.x, v.z, -v.y]
    assert any(all(abs(point[i]-p['position'][i]) <= p['size'][i]/2+2e-5 for i in range(3))
               for p in proxies), '显示护栏超出已有碰撞并集'
for obj in dashes:
    bpy.data.objects.remove(obj, do_unlink=True)
assert all(evaluated_signature(bpy.data.objects[name]) == digest for name, digest in preserved.items())

preview('corner-after.png', (-8.45, 3.53, -2.45), 2.3)
preview('track-after.png', (2, 3, 1), 34)
scene['round_02_level_sha256'] = SNAPSHOT['sha256']
scene['round_02_source_sha256'] = BASELINE['art/track-refined.blend']
scene['round_02_scope'] = 'Guard union and orange materials; remove eight baked narrow warning dashes'
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

# 源文件保留可编辑对象；仅把静态部分的副本合并导出，平台不重导。
copies = []
for obj in list(bpy.data.objects):
    if obj.type in ('MESH', 'FONT') and obj.name not in platform_names:
        duplicate = obj.copy()
        duplicate.data = obj.data.copy()
        scene.collection.objects.link(duplicate)
        copies.append(duplicate)
for obj in copies:
    obj.select_set(True)
bpy.context.view_layer.objects.active = copies[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
combined = bpy.context.object
combined.name = 'TrackStatic'
scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
combined.data.calc_loop_triangles()
bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB', use_selection=True,
                          export_apply=True, export_animations=False, export_cameras=False,
                          export_lights=False, export_texcoords=False)
report = {'level_sha256': SNAPSHOT['sha256'], 'source_sha256': sha(SOURCE),
          'blend_sha256': sha(BLEND), 'glb_sha256': sha(GLB),
          'triangles': len(combined.data.loop_triangles), 'bytes': GLB.stat().st_size,
          'units': 'meters', 'coordinates': 'glTF Y-up; Blender (x,-z,y)',
          'origin': [0, 0, 0], 'removed_baked_dashes': 8,
          'preserved_objects': preserved, 'junction_volume_m3': union_volume,
          'junction_manifold': True, 'junction_duplicate_triangles': 0,
          'rail_vertices_within_collision_union': True, 'platform_reexported': False,
          'source_baseline': BASELINE}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
for relative, expected in BASELINE.items():
    if relative != 'liveBlender':
        assert sha(ROOT / relative) == expected
print('ROUND_02_REPORT', json.dumps({k: v for k, v in report.items()
                                   if k not in ('preserved_objects', 'source_baseline')}))
