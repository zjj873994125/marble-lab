"""按 LEVEL 施工 JSON 制作长关固定轨道；动态机关仅作源场景参考。"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'art'))
import obstacle_library_assets as parts
import water_rush_assets as assets

COURSES = {
    'top-difficulty': {
        'construction': ROOT / 'docs/levels/top-difficulty-construction.json',
        'source': ROOT / 'art/top-difficulty.blend',
        'glb': ROOT / 'public/models/top-difficulty-track.glb',
        'report': ROOT / 'art/top-difficulty-report.json',
        'preview': ROOT / 'docs/art/top-difficulty-preview.png',
        'top': ROOT / 'docs/art/top-difficulty-top.png',
    },
    'three-route': {
        'construction': ROOT / 'docs/levels/three-route-construction.json',
        'source': ROOT / 'art/three-route.blend',
        'glb': ROOT / 'public/models/three-route-track.glb',
        'report': ROOT / 'art/three-route-report.json',
        'preview': ROOT / 'docs/art/three-route-preview.png',
        'top': ROOT / 'docs/art/three-route-top.png',
    },
}
MATERIAL_NAMES = [
    'Ivory polymer', 'Graphite chassis', 'Safety terracotta',
    'Brushed alloy', 'Rubber pads', 'Printed markings', 'Platform enamel',
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rotate_object(obj, degrees):
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = assets.game_rotation(degrees)


def game_normal(degrees):
    rotation = Euler(tuple(math.radians(v) for v in degrees), 'XYZ').to_matrix()
    return rotation @ Vector((0, 1, 0))


def fast_box(name, position, size, material, parent, bevel=0):
    """直接建局部盒网格，避免大型场景里逐对象 transform_apply 的平方级开销。"""
    x, y, z = size[0] / 2, size[1] / 2, size[2] / 2
    vertices = [
        (-x, -z, -y), (-x, -z, y), (-x, z, -y), (-x, z, y),
        (x, -z, -y), (x, -z, y), (x, z, -y), (x, z, y),
    ]
    faces = [(0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3), (0, 2, 3, 1), (4, 5, 7, 6)]
    mesh = bpy.data.meshes.new(name + ' mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    parts.collection.objects.link(obj)
    world_matrix = Matrix.Translation(assets.game_position(position))
    if parent:
        bpy.context.view_layer.update()
        obj.parent = parent
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = parent.matrix_world.inverted() @ world_matrix
    else:
        obj.matrix_world = world_matrix
    if bevel:
        modifier = obj.modifiers.new('Machined edge', 'BEVEL')
        modifier.width = min(bevel, min(size) / 4)
        modifier.segments = 2
        modifier = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        modifier.keep_sharp = True
    for face in mesh.polygons:
        face.use_smooth = True
    return obj


def local_to_world(instance, local):
    yaw = math.radians(instance.get('yaw', 0))
    x, y, z = local
    position = instance['position']
    return [
        position[0] + x * math.cos(yaw) + z * math.sin(yaw),
        position[1] + y,
        position[2] - x * math.sin(yaw) + z * math.cos(yaw),
    ]


def make_layer_controls(layout, name, center_offset, height, extra, material, collection, root, hidden):
    controls = []
    parts.collection = collection
    for spec in layout['staticDecks']:
        x, y, z = spec['bodyCenter']
        w, h, d = spec['bodySize']
        degrees = spec.get('rotationEulerDegrees', [0, 0, 0])
        normal = game_normal(degrees)
        center = [x + normal[0] * center_offset, y + normal[1] * center_offset, z + normal[2] * center_offset]
        suffix = ' control' if hidden else ''
        obj = parts.box(spec['id'] + ' ' + name + suffix, center, [w + extra, height, d + extra], material, root, 0)
        rotate_object(obj, degrees)
        obj['owner'] = spec.get('owner', '')
        obj.hide_render = hidden
        obj.hide_set(hidden)
        controls.append(obj)
    return controls


def build_support(spec, support_root, mats):
    graphite, alloy, rubber, orange = mats
    name = spec['id']
    x, z = spec['positionXZ']
    top = spec['topLimitY']
    bottom = spec.get('footBottomY', -0.4)
    width = spec.get('columnWidth', 0.28)
    foot = spec.get('footWidth', 0.65)
    parts.box(name + ' rubber foot', [x, bottom + .06, z], [foot, .12, foot], rubber, support_root, min(.04, foot * .12))
    parts.box(name + ' alloy shoe', [x, bottom + .17, z], [max(.16, foot - .08), .10, max(.16, foot - .08)], alloy, support_root, min(.025, foot * .08))
    column_bottom = bottom + .22
    column_height = max(.16, top - .14 - column_bottom)
    parts.box(name + ' column', [x, column_bottom + column_height / 2, z], [width, column_height, width], graphite, support_root, min(.035, width * .16))
    flange = max(.18, min(.68, foot))
    parts.box(name + ' top flange', [x, top - .07, z], [flange, .14, max(.18, flange * .74)], alloy, support_root, min(.02, flange * .08))
    parts.box(name + ' orange collar', [x, bottom + .41, z], [width + .06, .14, width + .06], orange, support_root, min(.025, width * .14))
    reach = min(.28, max(.08, foot / 2 - .06))
    parts.beam(name + ' diagonal brace', [x, max(bottom + .45, top - .72), z], [x + reach, top - .10, z], max(.05, min(.075, width * .45)), alloy, support_root)
    anchor_offset = max(.055, min(.22, foot / 2 - .07))
    for sign in (-1, 1):
        parts.bolt(name + ' anchor ' + str(sign), [x + sign * anchor_offset, bottom + .24, z], support_root, radius=max(.025, min(.042, foot * .07)))


def add_static_structure(spec, root, material):
    if spec['type'] == 'box':
        obj = parts.box(spec['id'], spec['bodyCenter'], spec['bodySize'], material, root, min(.035, min(spec['bodySize']) * .15))
        rotate_object(obj, spec.get('rotationEulerDegrees', [0, 0, 0]))
        return obj
    if spec['type'] == 'tube-y':
        size = spec['bodySize']
        obj = parts.tube(spec['id'], spec['bodyCenter'], size[0] / 2, spec['innerRadius'], size[1], material, root, 'Y', 32)
        rotate_object(obj, spec.get('rotationEulerDegrees', [0, 0, 0]))
        return obj
    raise ValueError('Unsupported static structure type: ' + spec['type'])


def add_runtime_references(layout, refs, materials):
    ivory, graphite, orange, alloy, blue = materials
    linked_names = sorted({i.get('rootNode') for i in layout['instances'] if i.get('asset') == 'obstacle-library.glb' and i.get('rootNode')})
    linked = {}
    if linked_names:
        with bpy.data.libraries.load(str(ROOT / 'art/obstacle-library.blend'), link=True) as (_, output):
            output.collections = linked_names
        linked = {collection.name: collection for collection in output.collections}
    parts.collection = refs
    root = parts.empty('Dynamic mechanism references')
    for instance in layout['instances']:
        group = parts.empty(instance['id'] + ' reference', root)
        group['kind'] = instance['kind']
        group['position_game'] = instance['position']
        group['yaw_degrees'] = instance.get('yaw', 0)
        if instance.get('rootNode') in linked:
            obj = bpy.data.objects.new(instance['id'] + ' linked library visual', None)
            refs.objects.link(obj)
            obj.instance_type = 'COLLECTION'
            obj.instance_collection = linked[instance['rootNode']]
            obj.location = assets.game_position(instance['position'])
            rotate_object(obj, [0, instance.get('yaw', 0), 0])
            obj.parent = group
            continue
        kind = instance['kind']
        params = instance.get('parameters', {})
        if kind in ('pendulum', 'hammers'):
            for index, center in enumerate(instance.get('headCentersLocal', [])):
                world = local_to_world(instance, center)
                size = params.get('headSize', params.get('bodySize', [.9, .9, 1.36]))
                head = parts.cylinder(instance['id'] + ' head ' + str(index + 1), world, size[0] / 2, size[2], orange, group, 'X', .018, 32)
                rotate_object(head, [0, instance.get('yaw', 0), 0])
                anchor = local_to_world(instance, instance.get('anchorCentersLocal', [center])[index])
                parts.beam(instance['id'] + ' handle ' + str(index + 1), anchor, world, .12, graphite, group)
        elif kind == 'cross':
            position = local_to_world(instance, instance.get('bodyCenterLocal', [0, 3.15, 0]))
            obj = assets.cross_prism(instance['id'] + ' cross reference', position, params.get('span', 8), params.get('armWidth', 1.4), params.get('thickness', .5), ivory, .035)
            for owner in list(obj.users_collection): owner.objects.unlink(obj)
            refs.objects.link(obj)
            rotate_object(obj, [0, instance.get('yaw', 0), 0])
            obj.parent = group
        elif kind == 'lifts':
            for index, center in enumerate(instance.get('plateCentersLocal', [])):
                world = local_to_world(instance, center)
                obj = parts.box(instance['id'] + ' lift ' + str(index + 1), world, params.get('bodySize', [3.2, .32, 2.8]), blue, group, .045)
                rotate_object(obj, [0, instance.get('yaw', 0), 0])
        elif kind == 'platform':
            center = local_to_world(instance, instance.get('bodyCenterLocal', [0, 3.22, 0]))
            obj = parts.box(instance['id'] + ' platform reference', center, params.get('bodySize', [3, .36, 2.9]), blue, group, .045)
            rotate_object(obj, [0, instance.get('yaw', 0), 0])
    return len(layout['instances'])


def build(course_id):
    paths = COURSES[course_id]
    if paths['source'].exists() or paths['glb'].exists():
        raise RuntimeError('Course asset already exists; maintain the current source in place.')
    layout = json.loads(paths['construction'].read_text())
    layout_hash = sha(paths['construction'])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = course_id
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new(course_id + ' studio')
    scene.world.color = (.18, .18, .18)
    with bpy.data.libraries.load(str(ROOT / 'art/track-round-03.blend'), link=False) as (_, output):
        output.materials = list(MATERIAL_NAMES)
    ivory, graphite, orange, alloy, rubber, ink, blue = [bpy.data.materials[name] for name in MATERIAL_NAMES]
    material_by_key = {'cream': ivory, 'dark': graphite, 'orange': orange, 'edge': alloy, 'blue': blue}
    parts.ivory, parts.graphite, parts.orange = ivory, graphite, orange
    parts.alloy, parts.rubber, parts.ink = alloy, rubber, ink
    parts.scene = scene
    parts.box = fast_box

    controls = bpy.data.collections.new('Layout controls')
    static = bpy.data.collections.new('Static track')
    structures = bpy.data.collections.new('Fixed mechanism structures')
    supports = bpy.data.collections.new('Track supports')
    refs = bpy.data.collections.new('Runtime references - not exported')
    for collection in (controls, static, structures, supports, refs):
        scene.collection.children.link(collection)

    parts.collection = controls
    control_root = parts.empty('Editable route modules')
    for spec in layout['staticDecks']:
        obj = parts.box(spec['id'], spec['bodyCenter'], spec['bodySize'], ivory, control_root, 0)
        rotate_object(obj, spec.get('rotationEulerDegrees', [0, 0, 0]))
        obj['owner'] = spec.get('owner', '')
        obj['top_start'] = spec.get('topStart', [])
        obj['top_end'] = spec.get('topEnd', [])
        obj.hide_render = True
        obj.hide_set(True)

    layer_data = []
    parts.collection = static
    layer_root = parts.empty('Visible modular surface layers')
    for name, offset, height, extra, material in (
        ('Ivory continuous surface', .03, .30, 0, ivory),
        ('Safety orange seam', -.135, .045, .015, orange),
        ('Graphite underframe', -.27, .24, .08, graphite),
    ):
        modules = make_layer_controls(layout, name, offset, height, extra, material, static, layer_root, False)
        role = 'deck' if material == ivory else 'accent' if material == orange else 'structure'
        for module in modules:
            module['theme_role'] = role
            module['surface_method'] = 'Independent overlapping route module; no Boolean chain.'
        layer_data.append({'name': name, 'moduleCount': len(modules), 'method': 'overlapping rigid modules, no long Boolean chain'})

    parts.collection = structures
    structure_root = parts.empty('Fixed structure modules')
    for spec in layout['staticStructures']:
        obj = add_static_structure(spec, structure_root, material_by_key[spec['material']])
        obj['construction_id'] = spec['id']
        obj['theme_role'] = {'dark': 'structure', 'edge': 'alloy', 'orange': 'accent'}.get(spec['material'], 'structure')

    parts.collection = supports
    support_root = parts.empty('Support modules')
    for spec in layout['supportPoints']:
        build_support(spec, support_root, (graphite, alloy, rubber, orange))

    parts.collection = structures
    rail_root = parts.empty('Rail modules')
    for spec in layout['staticRails']:
        obj = parts.box(spec['id'], spec['bodyCenter'], spec['bodySize'], material_by_key[spec['material']], rail_root, .035)
        rotate_object(obj, spec.get('rotationEulerDegrees', [0, 0, 0]))

    reference_count = add_runtime_references(layout, refs, (ivory, graphite, orange, alloy, blue))
    pieces = [obj for collection in (static, structures, supports) for obj in collection.objects if obj.type == 'MESH']
    scene['course_id'] = course_id
    scene['construction_sha256'] = layout_hash
    scene['status'] = 'Static art assembled; dynamic instances are references only; CODE validation pending.'
    scene['theme_roles'] = 'Ivory polymer=deck; Safety terracotta=protected accent; Graphite chassis=structure; Brushed alloy=alloy; Rubber/Printed protected.'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_distance = 120 if course_id == 'top-difficulty' else 180
                area.spaces.active.shading.color_type = 'MATERIAL'
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(paths['source']))
    export = assets.export_meshes(pieces, 'TrackStatic', paths['glb'].name)
    report = {
        'courseId': course_id,
        'source': str(paths['source'].relative_to(ROOT)),
        'sourceSha256': sha(paths['source']),
        'construction': str(paths['construction'].relative_to(ROOT)),
        'constructionSha256': layout_hash,
        'units': 'm', 'upAxis': '+Y', 'origin': [0, 0, 0],
        'export': export,
        'counts': {
            'staticDeckControls': len(layout['staticDecks']),
            'staticRails': len(layout['staticRails']),
            'staticStructures': len(layout['staticStructures']),
            'supportPoints': len(layout['supportPoints']),
            'dynamicReferences': reference_count,
        },
        'layerConstruction': layer_data,
        'supportExclusionCount': len(layout['supportExclusions']),
        'overpasses': layout.get('overpasses', []),
        'dynamicAssetsExcludedFromTrackGlb': sorted({instance.get('asset') for instance in layout['instances'] if instance.get('asset')}),
        'status': 'Model/export complete; CODE tests, build and isolated playtest pending.',
    }
    paths['report'].write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

    # 保存和导出之后仅给制作图加入水底，源与GLB都不含水。
    water = bpy.data.materials.new('Preview water only')
    water.diffuse_color = (.018, .114, .141, 1)
    water.use_nodes = True
    shader = next(node for node in water.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = water.diffuse_color
    shader.inputs['Roughness'].default_value = .72
    bounds = [obj.matrix_world @ Vector(corner) for obj in pieces for corner in obj.bound_box]
    low = [min(point[i] for point in bounds) for i in range(3)]
    high = [max(point[i] for point in bounds) for i in range(3)]
    center = [(low[0] + high[0]) / 2, (low[2] + high[2]) / 2, -(low[1] + high[1]) / 2]
    width, depth = high[0] - low[0], high[1] - low[1]
    assets.box('Preview water plane only', [center[0], -.11, center[2]], [width + 24, .02, depth + 24], water, 0)
    scale = math.hypot(width, depth)
    assets.render_preview(center, scale * 1.04, paths['preview'], (scale * .18, -scale * .22, scale * .28))
    assets.render_preview(center, max(width, depth * 1.6) * 1.07, paths['top'], (0, 0, max(width, depth) * 1.4))
    print('COURSE_TRACK_EXPORTED', json.dumps({'course': course_id, 'sourceSha256': report['sourceSha256'], 'constructionSha256': layout_hash, 'export': export, 'counts': report['counts']}))


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(args) != 1 or args[0] not in COURSES:
        raise SystemExit('Usage: blender --background --python art/course_track_assets.py -- top-difficulty|three-route')
    build(args[0])
