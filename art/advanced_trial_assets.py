"""高阶机关试验场静态轨道；高级机关以链接实例预览，不烘入TrackStatic。"""
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
import obstacle_library_assets as pieces
import water_rush_assets as assets
from course_track_assets import fast_box, game_normal

SOURCE = ROOT / 'art/advanced-trial.blend'
GLB = ROOT / 'public/models/advanced-trial-track.glb'
REPORT = ROOT / 'art/advanced-trial-report.json'
LAYOUT = ROOT / 'docs/levels/advanced-trial-construction.json'
LIBRARY = ROOT / 'art/advanced-obstacle-library.blend'
LIBRARY_MANIFEST = ROOT / 'public/models/advanced-obstacle-library.json'
PREVIEW = ROOT / 'docs/art/advanced-trial-preview.png'
TOP = ROOT / 'docs/art/advanced-trial-top.png'
MATERIAL_NAMES = [
    'Ivory polymer', 'Graphite chassis', 'Safety terracotta',
    'Brushed alloy', 'Rubber pads', 'Printed markings', 'Platform enamel',
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rotate(obj, degrees):
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = assets.game_rotation(degrees)


def segment_spec(name, start, end, width, thickness, extension=0):
    direction = Vector(end) - Vector(start)
    length = direction.length
    pitch = math.degrees(math.asin(direction.y / length))
    yaw = math.degrees(math.atan2(-direction.x, -direction.z))
    return {
        'id': name,
        'center': [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 - thickness / 2, (start[2] + end[2]) / 2],
        'size': [width, thickness, length + extension],
        'rotation': [pitch, yaw, 0],
    }


def expanded_specs(layout):
    specs = []
    for deck in layout['staticDecks']:
        # 漏斗下接台由共享根VortexFunnel_CatchDeck显示，TrackStatic不重复烘。
        if deck['id'] == 'D06-lower-catch':
            continue
        if deck['type'] == 'box':
            specs.append({'id': deck['id'], 'center': deck['center'], 'size': deck['size'],
                          'rotation': [0, deck.get('rotationY', 0), 0]})
        elif deck['type'] == 'ramp':
            specs.append(segment_spec(deck['id'], deck['from'], deck['to'], deck['width'], deck['thickness']))
        elif deck['type'] == 'polyline-deck':
            for index, (start, end) in enumerate(zip(deck['points'], deck['points'][1:]), 1):
                specs.append(segment_spec(deck['id'] + '-' + str(index), start, end, deck['width'], deck['thickness'], .04))
        else:
            raise ValueError('Unsupported static deck type: ' + deck['type'])
    return specs


def build_layer(specs, name, offset, height, extra, material, root):
    result = []
    for spec in specs:
        degrees = spec['rotation']
        normal = game_normal(degrees)
        center = Vector(spec['center']) + normal * offset
        size = [spec['size'][0] + extra, height, spec['size'][2] + extra]
        obj = pieces.box(spec['id'] + ' ' + name, center, size, material, root, 0)
        rotate(obj, degrees)
        obj['route_module'] = spec['id']
        obj['theme_role'] = name
        result.append(obj)
    return result


def build_support(spec, root, graphite, alloy, rubber, orange):
    x, _, z = spec['position']
    top = spec['topY']
    width, depth = spec['footprint']
    positions = [(x - width * .32, z - depth * .32), (x + width * .32, z - depth * .32),
                 (x - width * .32, z + depth * .32), (x + width * .32, z + depth * .32)]
    for index, (px, pz) in enumerate(positions, 1):
        name = spec['id'] + ' leg ' + str(index)
        pieces.box(name + ' rubber', [px, -.30, pz], [.68, .20, .68], rubber, root, .045)
        pieces.box(name + ' alloy foot', [px, -.15, pz], [.58, .10, .58], alloy, root, .03)
        height = max(.25, top - .10)
        pieces.box(name + ' column', [px, height / 2, pz], [.24, height, .24], graphite, root, .04)
        pieces.box(name + ' flange', [px, top - .07, pz], [.58, .14, .48], alloy, root, .025)
        pieces.box(name + ' collar', [px, .08, pz], [.30, .16, .30], orange, root, .025)
        pieces.beam(name + ' brace', [px, max(.35, top - .72), pz], [px + math.copysign(.25, x - px or 1), top - .10, pz], .075, alloy, root)


def instance_matrix(instance):
    return Matrix.Translation(assets.game_position(instance['position'])) @ assets.game_rotation([0, instance.get('yaw', 0), 0]).to_matrix().to_4x4()


def add_module_foundations(layout, linked, root, graphite):
    foundations = []
    for instance in layout['instances']:
        collection = linked[instance['kind']]
        transform = instance_matrix(instance)
        root_y = instance['position'][1]
        top = root_y
        bottom = layout['environment']['poolBounds']['min'][1]
        height = top - bottom
        if height <= .05:
            continue
        for obj in collection.objects:
            if obj.type != 'MESH' or ('foot' not in obj.name.lower() and obj.name != 'Jet pedestal'):
                continue
            points = [transform @ obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
            game = [Vector((point.x, point.z, -point.y)) for point in points]
            if abs(min(point.y for point in game)) > .02:
                continue
            x0, x1 = min(point.x for point in game), max(point.x for point in game)
            z0, z1 = min(point.z for point in game), max(point.z for point in game)
            center = [(x0 + x1) / 2, bottom + height / 2, (z0 + z1) / 2]
            size = [max(.12, x1 - x0), height, max(.12, z1 - z0)]
            pieces.box(instance['id'] + ' foundation ' + obj.name, center, size, graphite, root, min(.04, min(size[0], size[2]) * .12))
            foundations.append({'instance': instance['id'], 'sourceFoot': obj.name, 'center': center, 'size': size})
    return foundations


def add_checkpoint_marks(layout, root, ink):
    marks = []
    for checkpoint in layout['course']['checkpoints']:
        x, y, z = checkpoint['ring']['position']
        for side in (-1, 1):
            center = [x + side * .18, y - .055, z]
            pieces.box(checkpoint['id'] + ' paint ' + str(side), center, [.08, .008, .72], ink, root, .001)
        marks.append(checkpoint['id'])
    return marks


if __name__ == '__main__':
    if '--refresh-foundations' in sys.argv:
        previous = json.loads(REPORT.read_text())
        if sha(SOURCE) != previous['sourceSha256'] or sha(GLB) != previous['export']['sha256']:
            raise RuntimeError('Current advanced trial differs from its report.')
        layout = json.loads(LAYOUT.read_text())
        library_manifest = json.loads(LIBRARY_MANIFEST.read_text())
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
        scene = bpy.data.scenes['Advanced trial']
        bpy.context.window.scene = scene
        ivory, graphite, orange, alloy, rubber, ink, blue = [bpy.data.materials[name] for name in MATERIAL_NAMES]
        pieces.ivory, pieces.graphite, pieces.orange = ivory, graphite, orange
        pieces.alloy, pieces.rubber, pieces.ink = alloy, rubber, ink
        pieces.scene = scene
        pieces.box = fast_box
        refs = bpy.data.collections['Advanced mechanism references - not exported']
        linked = {obj['kind']: obj.instance_collection for obj in refs.objects if obj.instance_collection}
        supports = bpy.data.collections['Level supports']
        pieces.collection = supports
        foundation_root = bpy.data.objects['Module foot foundations']
        foundations = add_module_foundations(layout, linked, foundation_root, graphite)
        if not foundations:
            raise RuntimeError('No module foot foundations found in current linked library.')
        scene['construction_sha256'] = sha(LAYOUT)
        scene['advanced_library_sha256'] = library_manifest['glbSha256']
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), relative_remap=True)
        static = bpy.data.collections['Static track']
        export_objects = [obj for collection in (static, supports) for obj in collection.objects if obj.type == 'MESH']
        export = assets.export_meshes(export_objects, 'TrackStatic', GLB.name)
        previous.update(sourceSha256=sha(SOURCE), constructionSha256=sha(LAYOUT),
                        formalConfigSha256=layout.get('configSha256'), librarySha256=library_manifest['glbSha256'],
                        export=export, moduleFootFoundations=foundations)
        previous['counts']['moduleFootFoundations'] = len(foundations)
        previous['status'] = 'Model/export complete with current module foot foundations; CODE full validation pending.'
        REPORT.write_text(json.dumps(previous, ensure_ascii=False, indent=2) + '\n')
        water = bpy.data.materials.new('Foundation refresh preview water')
        water.diffuse_color = (.018, .114, .141, 1)
        water.use_nodes = True
        shader = next(node for node in water.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
        shader.inputs['Base Color'].default_value = water.diffuse_color
        shader.inputs['Roughness'].default_value = .72
        pool = layout['environment']['poolBounds']
        assets.box('Foundation refresh preview water only', [(pool['min'][0] + pool['max'][0]) / 2, layout['environment']['waterTopY'], (pool['min'][2] + pool['max'][2]) / 2],
                   [pool['max'][0] - pool['min'][0], .02, pool['max'][2] - pool['min'][2]], water, 0)
        pieces.collection = refs
        ring_root = pieces.empty('Foundation refresh rings preview only')
        for checkpoint in layout['course']['checkpoints']:
            position = checkpoint['ring']['position']
            pieces.tube(checkpoint['id'] + ' refreshed ring', position, checkpoint['ring']['radius'] + .035,
                        checkpoint['ring']['radius'] - .035, .018, alloy, ring_root, 'Y', 48)
        pieces.tube('Refreshed finish ring', layout['finish']['ring']['position'], layout['finish']['ring']['radius'] + .04,
                    layout['finish']['ring']['radius'] - .04, .018, orange, ring_root, 'Y', 48)
        assets.render_preview([6, 2.8, -55], 144, PREVIEW, (42, -52, 66))
        assets.render_preview([6, 2.8, -55], 140, TOP, (0, 0, 190))
        print('ADVANCED_TRIAL_FOUNDATIONS_REFRESHED', json.dumps({'sourceSha256': previous['sourceSha256'], 'export': export, 'foundationCount': len(foundations)}))
        raise SystemExit(0)
    if SOURCE.exists() or GLB.exists() or REPORT.exists():
        raise RuntimeError('Advanced trial asset already exists; edit current files in place.')
    layout = json.loads(LAYOUT.read_text())
    library_manifest = json.loads(LIBRARY_MANIFEST.read_text())
    if library_manifest['constructionSha256'] != sha(LAYOUT):
        raise RuntimeError('Advanced library and test-course construction metadata are not paired.')
    protected = {str(path.relative_to(ROOT)): sha(path) for path in (
        ROOT / 'art/obstacle-library.blend', ROOT / 'public/models/obstacle-library.glb',
        ROOT / 'art/water-rush.blend', ROOT / 'public/models/water-rush-track.glb',
        ROOT / 'art/mechanism-trial.blend', ROOT / 'public/models/mechanism-trial-track.glb',
        ROOT / 'art/top-difficulty.blend', ROOT / 'public/models/top-difficulty-track.glb',
        ROOT / 'art/three-route.blend', ROOT / 'public/models/three-route-track.glb',
    )}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = 'Advanced trial'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new('Advanced trial studio')
    scene.world.color = (.18, .18, .18)
    with bpy.data.libraries.load(str(ROOT / 'art/track-round-03.blend'), link=False) as (_, output):
        output.materials = list(MATERIAL_NAMES)
    ivory, graphite, orange, alloy, rubber, ink, blue = [bpy.data.materials[name] for name in MATERIAL_NAMES]
    pieces.ivory, pieces.graphite, pieces.orange = ivory, graphite, orange
    pieces.alloy, pieces.rubber, pieces.ink = alloy, rubber, ink
    pieces.scene = scene
    pieces.box = fast_box
    controls = bpy.data.collections.new('Layout controls')
    static = bpy.data.collections.new('Static track')
    supports = bpy.data.collections.new('Level supports')
    refs = bpy.data.collections.new('Advanced mechanism references - not exported')
    for collection in (controls, static, supports, refs):
        scene.collection.children.link(collection)
    global active_collection
    active_collection = controls
    pieces.collection = controls
    control_root = pieces.empty('Editable construction modules')
    specs = expanded_specs(layout)
    for spec in specs:
        obj = pieces.box(spec['id'], spec['center'], spec['size'], ivory, control_root, 0)
        rotate(obj, spec['rotation'])
        obj.hide_render = True
        obj.hide_set(True)

    pieces.collection = static
    layer_root = pieces.empty('Visible track modules')
    white = build_layer(specs, 'deck', .03, .24, 0, ivory, layer_root)
    seam = build_layer(specs, 'accent', -.10, .05, .015, orange, layer_root)
    chassis = build_layer(specs, 'structure', -.20, .18, .08, graphite, layer_root)
    checkpoint_root = pieces.empty('Protected checkpoint paint')
    checkpoint_marks = add_checkpoint_marks(layout, checkpoint_root, ink)

    pieces.collection = supports
    support_root = pieces.empty('Support modules')
    for spec in layout['supportPoints']:
        build_support(spec, support_root, graphite, alloy, rubber, orange)

    root_names = {entry['id']: entry['rootNode'] for entry in library_manifest['entries']}
    with bpy.data.libraries.load(str(LIBRARY), link=True) as (_, output):
        output.collections = sorted(set(root_names.values()))
    linked_by_name = {collection.name: collection for collection in output.collections}
    linked = {kind: linked_by_name[root_name] for kind, root_name in root_names.items()}
    pieces.collection = refs
    reference_root = pieces.empty('Linked advanced mechanisms')
    for instance in layout['instances']:
        obj = bpy.data.objects.new(instance['id'] + ' linked ' + root_names[instance['kind']], None)
        refs.objects.link(obj)
        obj.instance_type = 'COLLECTION'
        obj.instance_collection = linked[instance['kind']]
        obj.matrix_world = instance_matrix(instance)
        obj.parent = reference_root
        obj['kind'] = instance['kind']
        obj['role'] = instance['role']

    pieces.collection = supports
    foundation_root = pieces.empty('Module foot foundations')
    foundations = add_module_foundations(layout, linked, foundation_root, graphite)
    scene['course_id'] = 'advanced-trial'
    scene['construction_sha256'] = sha(LAYOUT)
    scene['advanced_library_sha256'] = library_manifest['glbSha256']
    scene['status'] = 'Static course assembled; advanced mechanisms are linked references only; CODE validation pending.'
    scene['excluded_duplicate'] = 'D06-lower-catch is displayed by VortexFunnel_CatchDeck and is not baked twice.'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_distance = 90
                area.spaces.active.shading.color_type = 'MATERIAL'
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), relative_remap=True)
    export_objects = [obj for collection in (static, supports) for obj in collection.objects if obj.type == 'MESH']
    export = assets.export_meshes(export_objects, 'TrackStatic', GLB.name)
    report = {
        'courseId': 'advanced-trial', 'source': 'art/advanced-trial.blend',
        'sourceSha256': sha(SOURCE), 'constructionSha256': sha(LAYOUT),
        'formalConfigSha256': layout.get('configSha256'),
        'library': library_manifest['asset'], 'librarySha256': library_manifest['glbSha256'],
        'units': 'm', 'upAxis': '+Y', 'origin': [0, 0, 0], 'export': export,
        'counts': {
            'constructionDeckEntries': len(layout['staticDecks']),
            'bakedRouteModules': len(specs),
            'supportPoints': len(layout['supportPoints']),
            'supportLegs': len(layout['supportPoints']) * 4,
            'moduleInstances': len(layout['instances']),
            'moduleFootFoundations': len(foundations),
            'checkpointPaintPairs': len(checkpoint_marks),
        },
        'layers': {'deckModules': len(white), 'accentModules': len(seam), 'structureModules': len(chassis)},
        'excluded': ['advanced mechanism roots', 'force volumes', 'water/pool', 'checkpoint and finish rings', 'D06-lower-catch duplicate'],
        'moduleFootFoundations': foundations,
        'supportExclusionCount': len(layout['supportExclusions']),
        'protectedPreviousAssets': protected,
        'status': 'Model/export complete; CODE tests, build, per-mechanism physics and full-route playtest pending.',
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

    # 水和圆环只在保存/导出后用于制作预览。
    water = bpy.data.materials.new('Preview water only')
    water.diffuse_color = (.018, .114, .141, 1)
    water.use_nodes = True
    shader = next(node for node in water.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = water.diffuse_color
    shader.inputs['Roughness'].default_value = .72
    pool = layout['environment']['poolBounds']
    assets.box('Preview water plane only', [(pool['min'][0] + pool['max'][0]) / 2, layout['environment']['waterTopY'], (pool['min'][2] + pool['max'][2]) / 2],
               [pool['max'][0] - pool['min'][0], .02, pool['max'][2] - pool['min'][2]], water, 0)
    pieces.collection = refs
    ring_root = pieces.empty('Runtime rings preview only')
    for checkpoint in layout['course']['checkpoints']:
        position = checkpoint['ring']['position']
        pieces.tube(checkpoint['id'] + ' ring preview', position, checkpoint['ring']['radius'] + .035,
                    checkpoint['ring']['radius'] - .035, .018, alloy, ring_root, 'Y', 48)
    pieces.tube('Finish ring preview', layout['finish']['ring']['position'], layout['finish']['ring']['radius'] + .04,
                layout['finish']['ring']['radius'] - .04, .018, orange, ring_root, 'Y', 48)
    assets.render_preview([6, 2.8, -55], 144, PREVIEW, (42, -52, 66))
    assets.render_preview([6, 2.8, -55], 140, TOP, (0, 0, 190))
    print('ADVANCED_TRIAL_EXPORTED', json.dumps({'sourceSha256': report['sourceSha256'], 'constructionSha256': report['constructionSha256'], 'export': export, 'counts': report['counts']}))
