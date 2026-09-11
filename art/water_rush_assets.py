"""水上冲关的固定文件制作工具；布局来自关卡交接，不修改运行时。"""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
BLEND = ROOT / 'art/water-rush.blend'
REPORT = ROOT / 'art/water-rush-report.json'
LAYOUT = ROOT / 'docs/levels/water-rush-layout.json'
PREVIEW = ROOT / 'docs/art/water-rush-preview.png'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()


def game_position(value):
    return (value[0], -value[2], value[1])


def game_rotation(degrees):
    basis = Matrix(((1,0,0),(0,0,-1),(0,1,0)))
    rotation = Euler(tuple(math.radians(v) for v in degrees), 'XYZ').to_matrix()
    return (basis@rotation@basis.transposed()).to_quaternion()


def rounded(obj, name, material, radius=.035):
    obj.name = name
    obj.data.materials.append(material)
    if radius:
        bevel = obj.modifiers.new('Edge radius', 'BEVEL')
        bevel.width = radius
        bevel.segments = 3
        normals = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        normals.keep_sharp = True
        normals.weight = 50
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def box(name, position, size, material, radius=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=game_position(position))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return rounded(obj, name, material, min(radius, min(size)*.25))


def cylinder(name, position, radius, height, material, edge=.025, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height,
                                       location=game_position(position))
    return rounded(bpy.context.object, name, material, edge)


def move_to_collection(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def export_meshes(objects, node, filename, origin=None):
    """仅合并导出副本，源文件中的模块保持独立。"""
    bpy.ops.object.select_all(action='DESELECT')
    copies = []
    for original in objects:
        clone = original.copy()
        clone.data = original.data.copy()
        clone.parent = None
        clone.matrix_world = original.matrix_world.copy()
        if origin is not None:
            clone.matrix_world.translation -= Vector(game_position(origin))
        bpy.context.scene.collection.objects.link(clone)
        clone.select_set(True)
        copies.append(clone)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    merged = bpy.context.object
    merged.name = node
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    path = ROOT / 'public/models' / filename
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_apply=True, export_animations=False, export_cameras=False,
                              export_lights=False, export_texcoords=False)
    blob = path.read_bytes()
    length = struct.unpack_from('<I', blob, 12)[0]
    data = json.loads(blob[20:20+length])
    primitives = [p for mesh in data['meshes'] for p in mesh['primitives']]
    positions = [data['accessors'][p['attributes']['POSITION']] for p in primitives]
    lo = [min(p['min'][i] for p in positions) for i in range(3)]
    hi = [max(p['max'][i] for p in positions) for i in range(3)]
    result = {'file': filename, 'node': node, 'sha256': sha(path), 'bytes': len(blob),
              'triangles': sum(data['accessors'][p['indices']]['count']//3 for p in primitives),
              'materials': len(data['materials']), 'bounds_min': lo, 'bounds_max': hi,
              'dimensions_xyz_m': [hi[i]-lo[i] for i in range(3)]}
    bpy.data.objects.remove(merged, do_unlink=True)
    return result


def render_preview(target, scale, path=PREVIEW, offset=(14, -20, 28)):
    scene = bpy.context.scene
    camera_data = bpy.data.cameras.new('Review camera')
    camera = bpy.data.objects.new('Review camera', camera_data)
    scene.collection.objects.link(camera)
    target = Vector(game_position(target))
    camera.location = target+Vector(offset)
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = scale
    scene.camera = camera
    light_data = bpy.data.lights.new('Review light', 'SUN')
    light_data.energy = 3
    light = bpy.data.objects.new('Review light', light_data)
    scene.collection.objects.link(light)
    light.rotation_euler = (.4, -.5, -.3)
    fill_data = bpy.data.lights.new('Review fill', 'AREA')
    fill_data.energy, fill_data.size = 1800, 20
    fill = bpy.data.objects.new('Review fill', fill_data)
    scene.collection.objects.link(fill)
    fill.location = target+Vector((-10,8,14))
    fill.rotation_euler = (target-fill.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = True
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    scene.camera = None
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(light, do_unlink=True)
    bpy.data.objects.remove(fill, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    bpy.data.lights.remove(light_data)
    bpy.data.lights.remove(fill_data)


def prepare_scene():
    """按当前唯一设计布局制作；代码尚未实现时资源也不自动启用。"""
    previous = json.loads(REPORT.read_text()) if REPORT.exists() else None
    if BLEND.exists():
        assert previous and sha(BLEND) == previous['blend_sha256'], '场景有后续手改，停止重建'
    layout_hash = sha(LAYOUT)
    layout = json.loads(LAYOUT.read_text())
    contract = ROOT / 'docs/integration/level-02-contract.md'
    contract_hash = sha(contract)
    protected = {name: sha(ROOT / name) for name in (
        'art/track-round-03.blend', 'art/hammer-toy-round-03.blend',
        'public/models/track-round-03.glb', 'public/models/platform-refined.glb',
        'public/models/hammer-head-toy-round-03.glb', 'public/models/hammer-handle-toy-round-03.glb')}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    with bpy.data.libraries.load(str(ROOT / 'art/track-round-03.blend'), link=False) as (available, loaded):
        loaded.materials = ['Ivory polymer', 'Graphite chassis', 'Safety terracotta',
                            'Brushed alloy', 'Platform enamel', 'Rubber pads', 'Printed markings']
    ivory, graphite, orange, alloy, blue, rubber, ink = loaded.materials
    assert all(loaded.materials)
    groups = {}
    for name in ('Layout controls', 'Static structure', 'Turntable', 'Lift plates', 'Runtime references'):
        collection = bpy.data.collections.new(name)
        scene.collection.children.link(collection)
        groups[name] = collection
    static, deck_controls, rotating, lift_groups = [], [], [], []

    def add(obj, group, target=None):
        move_to_collection(obj, groups[group])
        if target is not None:
            target.append(obj)
        return obj

    def flat_box(name, center, size, mat, group, target=None):
        obj = box(name, center, size, mat, 0)
        for face in obj.data.polygons:
            face.use_smooth = False
        return add(obj, group, target)

    def support(name, x, z, top, width=.36):
        add(box(name+' rubber foot', [x, -.34, z], [.95, .12, .95], rubber, .05), 'Static structure', static)
        add(box(name+' alloy foot', [x, -.23, z], [.8, .12, .8], alloy, .035), 'Static structure', static)
        height = top+.125
        add(box(name+' leg', [x, -.2+height/2, z], [width, height, width], graphite, .06), 'Static structure', static)
        add(box(name+' mounting flange', [x, top-.075, z], [1, .15, .7], alloy, .035), 'Static structure', static)
        add(box(name+' orange collar', [x, .02, z], [width+.04, .13, width+.04], orange, .03), 'Static structure', static)
        for dx in (-.27, .27):
            add(cylinder(name+' anchor', [x+dx, -.155, z], .055, .04, graphite, .008, 16), 'Static structure', static)
        start, end = Vector(game_position([x, top-.75, z])), Vector(game_position([x+.62, top-.075, z]))
        brace = box(name+' diagonal brace', [0,0,0], [.1, (end-start).length, .1], alloy, .02)
        brace.location = (start+end)/2
        brace.rotation_euler = (end-start).to_track_quat('Z', 'Y').to_euler()
        add(brace, 'Static structure', static)

    # 原始碰撞模块保持独立可编辑；可见台面通过非破坏布尔并集去掉交叠内部面。
    for spec in layout['staticDecks']+layout['ramps']:
        obj = flat_box(spec['id'], spec['bodyCenter'], spec['bodySize'], ivory, 'Layout controls', deck_controls)
        obj['layout_id'] = spec['id']
        rotation = spec.get('rotationEulerDegrees', [0, 0, 0])
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = game_rotation(rotation)
    bpy.context.view_layer.update()
    surface = deck_controls[0].copy()
    surface.data = deck_controls[0].data.copy()
    surface.name = 'Continuous walkable surface'
    groups['Static structure'].objects.link(surface)
    static.append(surface)
    for control in deck_controls[1:]:
        modifier = surface.modifiers.new('Union '+control.name, 'BOOLEAN')
        modifier.operation = 'UNION'
        modifier.solver = 'EXACT'
        modifier.object = control
    bevel = surface.modifiers.new('Same-family deck roundover', 'BEVEL')
    bevel.width, bevel.segments = .065, 3
    normal = surface.modifiers.new('Same-family deck normals', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    normal.weight = 50
    # 底座和橙色夹层也做连续并集，避免首段交叠处产生重复外壁。
    layer_controls = []
    for name, depth, height, extra, material, radius in (
            ('Graphite chassis', .10, .22, .08, graphite, .06),
            ('Recessed orange gasket', -.035, .045, .015, orange, .015)):
        controls = []
        for spec in layout['staticDecks']+layout['ramps']:
            x, y, z = spec['bodyCenter']
            w, h, d = spec['bodySize']
            degrees = spec.get('rotationEulerDegrees', [0,0,0])
            normal_game = Euler(tuple(math.radians(v) for v in degrees),'XYZ').to_matrix()@Vector((0,1,0))
            offset = h/2+depth
            center = [value-offset*normal_game[i] for i,value in enumerate((x,y,z))]
            control = flat_box(spec['id']+' '+name+' control', center, [w+extra, height, d+extra], material, 'Layout controls')
            control.rotation_mode = 'QUATERNION'
            control.rotation_quaternion = game_rotation(degrees)
            controls.append(control)
        bpy.context.view_layer.update()
        combined = controls[0].copy()
        combined.data = controls[0].data.copy()
        combined.name = name
        groups['Static structure'].objects.link(combined)
        static.append(combined)
        for control in controls[1:]:
            modifier = combined.modifiers.new('Layer union '+control.name, 'BOOLEAN')
            modifier.operation, modifier.solver, modifier.object = 'UNION', 'EXACT', control
        bevel = combined.modifiers.new('Same-family layer bevel', 'BEVEL')
        bevel.width, bevel.segments = radius, 3
        normal = combined.modifiers.new('Layer normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
        for control in controls:
            control.hide_render = True
            control.hide_set(True)
        layer_controls.extend(controls)
    for control in deck_controls:
        control.hide_render = True
        control.hide_set(True)
    for spec in layout['staticDecks']:
        x, y, z = spec['bodyCenter']
        w, h, d = spec['bodySize']
        # 长直道多点承托；立柱只在本段固定面下，不进入动态缺口。
        if w > 6:
            points = [(x-w/3, z), (x+w/3, z)]
        elif d > 6:
            points = [(x, z-d/3), (x, z+d/3)]
        else:
            points = [(x, z)]
        for i, (sx, sz) in enumerate(points):
            support(spec['id']+f' support {i+1}', sx, sz, y-h/2-.21)

    for spec in layout['staticRails']:
        obj = add(box(spec['id'], spec['bodyCenter'], spec['bodySize'], orange, .048), 'Static structure', static)
        obj['layout_id'] = spec['id']
        x, y, z = spec['bodyCenter']
        w, h, d = spec['bodySize']
        for t in (-.4, 0, .4):
            pos = [x+w*t if w>d else x, y-.115, z+d*t if d>w else z]
            add(box(spec['id']+' mount', pos, [.22, .055, .22], alloy, .015), 'Static structure', static)
            add(cylinder(spec['id']+' rivet', [pos[0], y+.142, pos[2]], .035, .024, graphite, .0048, 16), 'Static structure', static)

    hammer = layout['hammer']
    for i, pos in enumerate(hammer['standPosts']):
        add(box(f'Hammer post {i+1}', pos, hammer['standPostSize'], graphite), 'Static structure', static)
        add(box(f'Hammer post shoe {i+1}', [pos[0],3.39,pos[2]], [.45,.25,.45], alloy, .06), 'Static structure', static)
    crossbar = hammer['standCrossbar']
    add(box('Hammer crossbar', crossbar['position'], crossbar['size'], graphite), 'Static structure', static)

    turn = layout['turntable']
    tc, radius, thickness = turn['bodyCenter'], turn['radius'], turn['thickness']
    disk_center = [tc[0], tc[1]+.08, tc[2]]
    disk = add(cylinder('Turntable deck', disk_center, radius, thickness-.16, ivory, .045), 'Turntable', rotating)
    add(cylinder('Turntable dark base', [tc[0],tc[1]-.17,tc[2]], radius, .16, graphite, .015), 'Turntable', rotating)
    add(cylinder('Turntable orange gasket', [tc[0],tc[1]-.09,tc[2]], radius-.005, .045, orange, .008), 'Turntable', rotating)
    disk['mount_origin_game'] = tc
    top = tc[1]+thickness/2
    for angle in (0, math.pi/2, math.pi, math.pi*1.5):
        position = [tc[0]+math.sin(angle)*radius*.5, top+.002, tc[2]+math.cos(angle)*radius*.5]
        strip = flat_box('Turntable radial paint', position, [.12, .004, radius*.65], ink, 'Turntable', rotating)
        strip.rotation_euler.z = -angle
    bar = turn['coMovingBar']
    bar_pos = [tc[i]+bar['localCenter'][i] for i in range(3)]
    add(box('Turntable collision-matched barrier', bar_pos, bar['bodySize'], orange, .025), 'Turntable', rotating)
    support('Turntable spindle', tc[0], tc[2], turn['supportTopMaxY'], .7)

    lift = layout['lifts']
    for instance in lift['instances']:
        parts = []
        center = instance['center']
        x, y, z = center
        w, h, d = lift['bodySize']
        body = add(box(instance['id']+' deck', center, lift['bodySize'], blue, .065), 'Lift plates', parts)
        add(box(instance['id']+' graphite belly', [x,y-.28,z], [w-.18,.2,d-.16], graphite, .055), 'Lift plates', parts)
        add(box(instance['id']+' orange gasket', [x,y-.165,z], [w-.1,.045,d-.1], orange, .015), 'Lift plates', parts)
        body['phase_radians'] = instance['phase']
        body['base_center_game'] = center
        for side in (-1, 1):
            flat_box(instance['id']+' seam paint', [x, y+h/2+.002, z+side*(d/2-.18)], [w-.4, .004, .10], orange, 'Lift plates', parts)
        # 细杆进入真正中空的固定套筒，避免活动板像浮空，也不进入可行驶面。
        add(cylinder(instance['id']+' sliding stem', [x, y-.98, z], .075, 1.20, alloy, .006, 24), 'Lift plates', parts)
        outer, inner, low, high, count = .16, .095, -.24, 2.30, 32
        vertices = []
        for yy, rr in ((low, outer), (high, outer), (low, inner), (high, inner)):
            vertices.extend(game_position([x+rr*math.cos(i*2*math.pi/count), yy, z+rr*math.sin(i*2*math.pi/count)]) for i in range(count))
        faces = []
        for i in range(count):
            j = (i+1)%count
            faces.extend([(i,j,count+j,count+i), (2*count+j,2*count+i,3*count+i,3*count+j),
                          (count+i,count+j,3*count+j,3*count+i), (j,i,2*count+i,2*count+j)])
        faces = [tuple(reversed(face)) for face in faces]
        mesh = bpy.data.meshes.new(instance['id']+' hollow sleeve')
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        sleeve = bpy.data.objects.new(instance['id']+' hollow sleeve', mesh)
        scene.collection.objects.link(sleeve)
        rounded(sleeve, sleeve.name, graphite, 0)
        add(sleeve, 'Static structure', static)
        add(box(instance['id']+' rubber foot', [x, -.34, z], [.95,.12,.95], rubber, .05), 'Static structure', static)
        add(box(instance['id']+' alloy foot', [x, -.23, z], [.8,.12,.8], alloy, .035), 'Static structure', static)
        add(box(instance['id']+' orange collar', [x,.02,z], [.36,.13,.36], orange, .03), 'Static structure', static)
        for dx in (-.27,.27):
            add(cylinder(instance['id']+' anchor', [x+dx,-.155,z], .055,.04,graphite,.008,16), 'Static structure', static)
        lift_groups.append(parts)

    # 参考件只帮助Blender排布，导出列表不包含它们。
    with bpy.data.libraries.load(str(ROOT / 'art/track-round-03.blend'), link=False) as (available, loaded):
        loaded.objects = [n for n in available.objects if n.startswith('Platform') and n != 'Platform identifier']
    for obj in loaded.objects:
        groups['Runtime references'].objects.link(obj)
        obj.location += Vector(game_position(layout['crossing']['bodyCenter']))
        obj['resource_reference'] = 'platform-refined.glb'
    with bpy.data.libraries.load(str(ROOT / 'art/hammer-toy-round-03.blend'), link=False) as (available, loaded):
        loaded.objects = available.objects
    a, b = Vector(game_position(hammer['anchor'])), Vector(game_position(hammer['bodyCenter']))
    rotation = Vector((0,0,1)).rotation_difference((a-b).normalized())
    for obj in loaded.objects:
        groups['Runtime references'].objects.link(obj)
        if obj.name.startswith('Normalized toy handle'):
            obj.location = (a+b)/2
            obj.scale.z = (a-b).length
        else:
            obj.location = b+rotation@obj.location
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = rotation
        obj['resource_reference'] = 'Existing flat hammer'
    bpy.context.view_layer.update()
    scene['level_id'] = 'water-rush'
    scene['layout_sha256'] = layout_hash
    scene['contract_sha256'] = contract_hash
    scene['stage'] = 'Assets from design handoff; runtime implementation and physics playtest pending'
    scene['editing'] = 'Unhide Layout controls to adjust individual boolean operands; no backups or versions'
    if previous:
        assert sha(BLEND) == previous['blend_sha256'], '保存前场景有并发修改'
    backup_count = bpy.context.preferences.filepaths.save_version
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.context.preferences.filepaths.save_version = backup_count
    exports = [export_meshes(static, 'TrackStatic', 'water-rush-track.glb'),
               export_meshes(rotating, 'TurntableVisual', 'water-rush-turntable.glb', tc),
               export_meshes(lift_groups[0], 'LiftVisual', 'water-rush-lift.glb', lift['instances'][0]['center'])]
    for i, parts in enumerate(lift_groups):
        offset = lift['amplitude']*(1 if i%2 == 0 else -1)
        for obj in parts:
            obj.location.z += offset
    # 水仅为本次预览背景，源文件已保存，导出列表也不含水。
    water = bpy.data.materials.new('Preview water')
    water.diffuse_color = (.0176,.1144,.1413,1)
    water.use_nodes = True
    water.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = water.diffuse_color
    water.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .8
    # 只用第一关同色水作预览底；不设计或导出第二套池体。
    box('Preview water only', [0,-.11,-30], [160,.02,240], water, 0)
    bounds = []
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in static+rotating+[o for parts in lift_groups for o in parts]:
        evaluated = obj.evaluated_get(graph)
        bounds.extend(evaluated.matrix_world@Vector(corner) for corner in evaluated.bound_box)
    lo = [min(v[i] for v in bounds) for i in range(3)]
    hi = [max(v[i] for v in bounds) for i in range(3)]
    target = [(lo[0]+hi[0])/2, (lo[2]+hi[2])/2, -(lo[1]+hi[1])/2]
    width, depth = hi[0]-lo[0], hi[1]-lo[1]
    render_preview(target, math.hypot(width,depth)*1.25)
    render_preview(target, max(width,depth*1.6)*1.12, ROOT/'docs/art/water-rush-top.png', (0,0,100))
    report = {'blend_sha256': sha(BLEND), 'layout_sha256': layout_hash, 'contract_sha256': contract_hash,
              'stage': scene['stage'], 'units': 'meters', 'coordinates': 'glTF Y-up; Blender (x,-z,y)',
              'static_controls': len(deck_controls), 'static_parts': len(static), 'exports': exports,
              'turntable_origin': tc, 'lift_centers': [i['center'] for i in lift['instances']],
              'lift_stem_min_world_y': lift['centerY']-lift['amplitude']-1.58,
              'lift_sleeve_top_y': 2.30, 'lift_stem_radius': .075, 'lift_sleeve_inner_radius': .095,
              'protected_first_level': protected,
              'preview_note': 'Lifts manually posed at alternating extremes for display only; no gameplay animation exported',
              'pending': ['Runtime and level selection implementation', 'Final LevelConfig mapping/freeze', 'Real contact and full route playtest']}
    assert sha(LAYOUT) == layout_hash, '制作期间布局变化，需复核当前资源'
    assert all(sha(ROOT / name) == digest for name, digest in protected.items())
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print('WATER_RUSH_ASSETS', json.dumps({k:v for k,v in report.items() if k!='protected_first_level'}, ensure_ascii=False))


if __name__ == '__main__':
    if '--parts' in sys.argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        center = list(bpy.data.objects['Turntable deck']['mount_origin_game'])
        center[1] -= .35
        render_preview(center, 12, ROOT / 'docs/art/water-rush-turntable-preview.png', (9,-12,10))
        centers = [list(o['base_center_game']) for o in bpy.data.objects if 'base_center_game' in o]
        center = [sum(c[i] for c in centers)/len(centers) for i in range(3)]
        center[1] -= 1.2
        render_preview(center, 15, ROOT / 'docs/art/water-rush-lifts-preview.png', (10,-13,8))
    else:
        prepare_scene()
