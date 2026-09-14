"""高级八机关共享库：一个源文件、一个GLB、八个独立根。"""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'art'))
import obstacle_library_assets as pieces
import water_rush_assets as assets
from course_track_assets import fast_box

SOURCE = ROOT / 'art/advanced-obstacle-library.blend'
GLB = ROOT / 'public/models/advanced-obstacle-library.glb'
MANIFEST = ROOT / 'public/models/advanced-obstacle-library.json'
CONSTRUCTION = ROOT / 'docs/levels/advanced-trial-construction.json'
CONTRACT = ROOT / 'docs/integration/advanced-obstacles-contract.md'
PREVIEWS = ROOT / 'docs/art/advanced-obstacle-library'
MATERIAL_NAMES = [
    'Ivory polymer', 'Graphite chassis', 'Safety terracotta',
    'Brushed alloy', 'Rubber pads', 'Printed markings', 'Platform enamel',
]
ROOTS = [
    ('spring-trampoline', 'SpringTrampoline'),
    ('gravity-coaster', 'GravityCoaster'),
    ('pulse-jet', 'PulseJet'),
    ('orbital-catcher', 'OrbitalCatcher'),
    ('reversing-conveyor', 'ReversingConveyor'),
    ('vortex-funnel', 'VortexFunnel'),
    ('gimbal-platform', 'GimbalPlatform'),
    ('cascade-bridge', 'CascadeBridge'),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def empty(name, parent=None, position=(0, 0, 0), collection=None):
    obj = bpy.data.objects.new(name, None)
    (collection or active_collection).objects.link(obj)
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = .3
    obj.parent = parent
    obj.location = assets.game_position(position)
    return obj


def group(name, root, position=(0, 0, 0)):
    obj = empty(name, root, position)
    semantic_groups.append(obj)
    return obj


def tube(name, position, outer, inner, length, material, parent, axis='Y'):
    return pieces.tube(name, position, outer, inner, length, material, parent, axis, 32)


def mesh_object(name, vertices_game, faces, material, parent, material_indices=None, materials=None):
    mesh = bpy.data.meshes.new(name + ' mesh')
    mesh.from_pydata([assets.game_position(v) for v in vertices_game], [], faces)
    mesh.update()
    for item in materials or [material]:
        mesh.materials.append(item)
    if material_indices:
        for face, index in zip(mesh.polygons, material_indices):
            face.material_index = index
    for face in mesh.polygons:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    active_collection.objects.link(obj)
    obj.parent = parent
    return obj


def ring_mesh(name, radius, tube_radius, y, material, parent, segments=64):
    vertices = []
    faces = []
    sides = 8
    for i in range(segments):
        angle = i * math.tau / segments
        for j in range(sides):
            section = j * math.tau / sides
            rr = radius + tube_radius * math.cos(section)
            vertices.append([rr * math.cos(angle), y + tube_radius * math.sin(section), rr * math.sin(angle)])
    for i in range(segments):
        for j in range(sides):
            a = i * sides + j
            b = ((i + 1) % segments) * sides + j
            c = ((i + 1) % segments) * sides + (j + 1) % sides
            d = i * sides + (j + 1) % sides
            faces.append((a, b, c, d))
    return mesh_object(name, vertices, faces, material, parent)


def coil(name, center, radius, height, turns, material, parent):
    points = []
    segments = turns * 20
    for i in range(segments + 1):
        angle = i * math.tau * turns / segments
        points.append([center[0] + radius * math.cos(angle), center[1] - height / 2 + height * i / segments, center[2] + radius * math.sin(angle)])
    for i, (a, b) in enumerate(zip(points, points[1:])):
        pieces.beam(name + ' segment ' + str(i + 1), a, b, .045, material, parent)


def coaster_path():
    result = []
    radius = 4
    # 水平进入，30度下弯。
    for index in range(13):
        angle = math.radians(30 * index / 12)
        result.append(([0, 5.2 - radius * (1 - math.cos(angle)), -radius * math.sin(angle)], [0, -math.sin(angle), -math.cos(angle)], 0))
    start = result[-1][0]
    for index in range(1, 9):
        length = 1.456 * index / 8
        result.append(([0, start[1] - length * .5, start[2] - length * math.cos(math.radians(30))], [0, -.5, -math.cos(math.radians(30))], 0))
    start = result[-1][0]
    for index in range(1, 13):
        phi = math.radians(30 * index / 12)
        angle = math.radians(30) - phi
        result.append(([0, start[1] - radius * (math.cos(angle) - math.cos(math.radians(30))), start[2] - radius * (math.sin(math.radians(30)) - math.sin(angle))], [0, -math.sin(angle), -math.cos(angle)], 0))
    # R4、90度平面弯，横坡32度。
    for index in range(1, 25):
        angle = math.pi + math.pi / 2 * index / 24
        point = [4 + 4 * math.cos(angle), 3.4, -5.261 + 4 * math.sin(angle)]
        tangent = [-math.sin(angle), 0, math.cos(angle)]
        result.append((point, tangent, math.radians(32)))
    start = result[-1][0]
    for index in range(1, 9):
        angle = math.radians(20 * index / 8)
        result.append(([start[0] + radius * math.sin(angle), 3.4 + radius * (1 - math.cos(angle)), start[2]], [math.cos(angle), math.sin(angle), 0], math.radians(32 * (1 - index / 8))))
    start = result[-1][0]
    for index in range(1, 7):
        length = .928 * index / 6
        result.append(([start[0] + length * math.cos(math.radians(20)), start[1] + length * math.sin(math.radians(20)), start[2]], [math.cos(math.radians(20)), math.sin(math.radians(20)), 0], 0))
    start = result[-1][0]
    for index in range(1, 9):
        phi = math.radians(20 * index / 8)
        angle = math.radians(20) - phi
        result.append(([start[0] + radius * (math.sin(math.radians(20)) - math.sin(angle)), start[1] + radius * (math.cos(angle) - math.cos(math.radians(20))), start[2]], [math.cos(angle), math.sin(angle), 0], 0))
    return result


def strip_mesh(name, path, width, thickness, material, parent):
    vertices = []
    frames = []
    for point, tangent, bank in path:
        tangent = Vector(tangent).normalized()
        lateral = Vector((-tangent.z, 0, tangent.x)).normalized()
        up = tangent.cross(lateral).normalized()
        rotation = Quaternion(tangent, bank)
        lateral = rotation @ lateral
        up = rotation @ up
        frames.append((Vector(point), lateral, up))
        for vertical in (0, -thickness):
            for side in (-1, 1):
                vertices.append(Vector(point) + lateral * width / 2 * side + up * vertical)
    faces = []
    for i in range(len(path) - 1):
        a = i * 4
        b = (i + 1) * 4
        faces.extend([(a, b, b + 1, a + 1), (a + 2, a + 3, b + 3, b + 2), (a, a + 2, b + 2, b), (a + 1, b + 1, b + 3, a + 3)])
    faces.extend([(0, 1, 3, 2), (len(vertices) - 4, len(vertices) - 2, len(vertices) - 1, len(vertices) - 3)])
    return mesh_object(name, vertices, faces, material, parent), frames


def coaster_rails(frames, material, parent):
    vertices = []
    faces = []
    rail_width = .08
    for point, lateral, up in frames:
        for side in (-1, 1):
            edge = point + lateral * (.7 - rail_width / 2)
            for height in (0, .25):
                for offset in (-1, 1):
                    vertices.append(edge + lateral * rail_width / 2 * offset + up * height)
    for i in range(len(frames) - 1):
        for side_index in range(2):
            a = i * 8 + side_index * 4
            b = (i + 1) * 8 + side_index * 4
            faces.extend([(a, b, b + 1, a + 1), (a + 2, a + 3, b + 3, b + 2), (a, a + 2, b + 2, b), (a + 1, b + 1, b + 3, a + 3)])
    return mesh_object('Coaster low safety rails', vertices, faces, material, parent)


def bowl_mesh(name, radius, floor_y, lip_y, thickness, material, parent, segments=64, rings=10):
    vertices = [[0, floor_y, 0], [0, floor_y - thickness, 0]]
    for ring in range(1, rings + 1):
        r = radius * ring / rings
        y = floor_y + (lip_y - floor_y) * (r / radius) ** 2
        for i in range(segments):
            angle = i * math.tau / segments
            vertices.append([r * math.cos(angle), y, r * math.sin(angle)])
            vertices.append([r * math.cos(angle), y - thickness, r * math.sin(angle)])
    faces = []
    for i in range(segments):
        j = (i + 1) % segments
        faces.extend([(0, 2 + 2 * j, 2 + 2 * i), (1, 3 + 2 * i, 3 + 2 * j)])
    for ring in range(1, rings):
        prev = 2 + (ring - 1) * segments * 2
        curr = prev + segments * 2
        for i in range(segments):
            j = (i + 1) % segments
            faces.extend([(prev + 2 * i, prev + 2 * j, curr + 2 * j, curr + 2 * i), (prev + 2 * i + 1, curr + 2 * i + 1, curr + 2 * j + 1, prev + 2 * j + 1)])
    outer = 2 + (rings - 1) * segments * 2
    for i in range(segments):
        j = (i + 1) % segments
        faces.append((outer + 2 * i, outer + 2 * i + 1, outer + 2 * j + 1, outer + 2 * j))
    return mesh_object(name, vertices, faces, material, parent)


def funnel_mesh(name, outer, inner, inner_y, slope, thickness, material, parent, segments=64, rings=12):
    vertices = []
    for ring in range(rings + 1):
        radius = inner + (outer - inner) * ring / rings
        y = inner_y + math.tan(math.radians(slope)) * (radius - inner)
        for i in range(segments):
            angle = i * math.tau / segments
            vertices.append([radius * math.cos(angle), y, radius * math.sin(angle)])
            vertices.append([radius * math.cos(angle), y - thickness, radius * math.sin(angle)])
    faces = []
    for ring in range(rings):
        a = ring * segments * 2
        b = a + segments * 2
        for i in range(segments):
            j = (i + 1) % segments
            faces.extend([(a + 2 * i, a + 2 * j, b + 2 * j, b + 2 * i), (a + 2 * i + 1, b + 2 * i + 1, b + 2 * j + 1, a + 2 * j + 1)])
    for ring in (0, rings):
        a = ring * segments * 2
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((a + 2 * i, a + 2 * i + 1, a + 2 * j + 1, a + 2 * j))
    return mesh_object(name, vertices, faces, material, parent)


def create_material(name, color, metallic, roughness, alpha=1):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, alpha)
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, alpha)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Alpha'].default_value = alpha
    if alpha < 1:
        material.surface_render_method = 'DITHERED'
    return material


def root_bounds(root):
    graph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in root.children_recursive:
        if obj.type != 'MESH':
            continue
        evaluated = obj.evaluated_get(graph)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
    game = [Vector((point.x, point.z, -point.y)) for point in points]
    return {'min': [min(p[i] for p in game) for i in range(3)], 'max': [max(p[i] for p in game) for i in range(3)]}


def export_and_manifest(entries, roots):
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for obj in root.children_recursive:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB', use_selection=True, export_apply=True,
                              export_animations=False, export_cameras=False, export_lights=False,
                              export_texcoords=False, export_extras=False)
    raw = GLB.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    data = json.loads(raw[20:20 + length])
    top = [data['nodes'][index]['name'] for index in data['scenes'][data.get('scene', 0)]['nodes']]
    if sorted(top) != sorted(name for _, name in ROOTS):
        raise RuntimeError('GLB top-level roots do not match contract: ' + repr(top))
    by_name = {node['name']: index for index, node in enumerate(data['nodes'])}

    def stats(index):
        triangles = 0
        materials = set()
        meshes = 0
        def visit(node_index):
            nonlocal triangles, meshes
            node = data['nodes'][node_index]
            if 'mesh' in node:
                meshes += 1
                for primitive in data['meshes'][node['mesh']]['primitives']:
                    triangles += data['accessors'][primitive['indices']]['count'] // 3
                    materials.add(primitive.get('material', -1))
            for child in node.get('children', []):
                visit(child)
        visit(index)
        return {'triangles': triangles, 'materials': len(materials), 'meshes': meshes}

    for entry in entries:
        entry['rootBounds'] = root_bounds(bpy.data.objects[entry['rootNode']])
        entry['statistics'] = stats(by_name[entry['rootNode']])
        for part in entry['parts']:
            name = part['nodePath'].split('/')[-1]
            if name not in by_name:
                raise RuntimeError('Missing semantic node ' + name)
            part['statistics'] = stats(by_name[name])
    manifest = {
        'schemaVersion': 1,
        'asset': GLB.name,
        'units': 'm', 'upAxis': '+Y', 'forwardAxis': '-Z',
        'referenceDeckY': 3.4,
        'glbSha256': sha(GLB), 'source': 'art/advanced-obstacle-library.blend',
        'sourceSha256': sha(SOURCE), 'constructionSha256': sha(CONSTRUCTION),
        'contractSha256': sha(CONTRACT), 'runtimeSupported': True,
        'runtimeSupportScope': 'asset-loading-and-semantic-parts',
        'statistics': {
            'bytes': len(raw),
            'triangles': sum(entry['statistics']['triangles'] for entry in entries),
            'materials': len(data.get('materials', [])),
            'meshes': len(data.get('meshes', [])),
            'materialNames': [material['name'] for material in data.get('materials', [])],
        },
        'entries': entries,
        'note': 'Model and semantic hierarchy delivered; CODE behavior and physics validation remain separate.',
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


def make_entry(kind, root, rest, parts_data, design):
    return {'id': kind, 'rootNode': root.name, 'restPose': rest, 'rootBounds': {}, 'parts': parts_data, 'design': design, 'statistics': {}}


def part(path, role, motion, pivot, axis, size, collision):
    return {'nodePath': path, 'role': role, 'motion': motion, 'pivot': pivot, 'axis': axis,
            'referenceSize': size, 'collision': collision}


if __name__ == '__main__':
    if '--repair-indicator-parenting' in sys.argv:
        previous = json.loads(MANIFEST.read_text())
        if sha(SOURCE) != previous['sourceSha256'] or sha(GLB) != previous['glbSha256']:
            raise RuntimeError('Current advanced library differs from delivered hashes.')
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
        scene = bpy.data.scenes['Advanced obstacle assets']
        bpy.context.window.scene = scene
        pieces.scene = scene
        # 这两个旧网格在父节点非零时使用了绝对顶点，改为正确的父局部坐标。
        for name in ('Spring core ring', 'Spring outer energy ring'):
            obj = bpy.data.objects[name]
            for vertex in obj.data.vertices:
                vertex.co.z -= 3.25
            obj.matrix_local = Matrix.Identity(4)
        obj = bpy.data.objects['Jet warning halo']
        for vertex in obj.data.vertices:
            vertex.co.z -= 3.825
        obj.location = (0, 0, 0)
        obj.rotation_mode = 'XYZ'
        obj.rotation_euler = (0, math.pi / 2, 0)
        bpy.context.view_layer.update()
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
        roots = [bpy.data.objects[name] for _, name in ROOTS]
        manifest = export_and_manifest(previous['entries'], roots)
        collections = [bpy.data.collections[name] for _, name in ROOTS]
        for entry, collection in zip(manifest['entries'], collections):
            for item in collections:
                for current in item.objects:
                    current.hide_render = item != collection
            pieces.render(PREVIEWS / (entry['id'] + '.png'), [0, 2.6, 0], 12, (9, 9, 13))
        print('ADVANCED_LIBRARY_INDICATORS_REPAIRED', manifest['sourceSha256'], manifest['glbSha256'])
        raise SystemExit(0)
    if any(path.exists() for path in (SOURCE, GLB, MANIFEST)):
        if '--replace-generated' not in sys.argv:
            raise RuntimeError('Advanced library already exists; edit current files in place.')
        previous = json.loads(MANIFEST.read_text())
        if sha(SOURCE) != previous['sourceSha256'] or sha(GLB) != previous['glbSha256']:
            raise RuntimeError('Generated library changed after the current report; preserve it.')
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    layout = json.loads(CONSTRUCTION.read_text())
    modules = {module['kind']: module for module in layout['libraryModules']}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = 'Advanced obstacle assets'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new('Advanced library studio')
    scene.world.color = (.18, .18, .18)
    with bpy.data.libraries.load(str(ROOT / 'art/track-round-03.blend'), link=False) as (_, output):
        output.materials = list(MATERIAL_NAMES)
    ivory, graphite, orange, alloy, rubber, ink, blue = [bpy.data.materials[name] for name in MATERIAL_NAMES]
    airflow = create_material('Airflow indicator', (.08, .48, .72), 0, .35, .24)
    pieces.ivory, pieces.graphite, pieces.orange = ivory, graphite, orange
    pieces.alloy, pieces.rubber, pieces.ink = alloy, rubber, ink
    pieces.scene = scene
    pieces.box = fast_box
    entries = []
    roots = []
    collections = []
    semantic_groups = []

    def start_root(name):
        global active_collection
        active_collection = bpy.data.collections.new(name)
        scene.collection.children.link(active_collection)
        pieces.collection = active_collection
        root = empty(name)
        roots.append(root)
        collections.append(active_collection)
        return root

    # 1. 蓄能蹦床
    root = start_root('SpringTrampoline')
    deck = group('SpringTrampoline_Deck', root, [0, 3.25, 0])
    pieces.box('Spring deck graphite', [0, 3.19, 0], [2.4, .12, 2.4], graphite, deck, .045)
    pieces.box('Spring deck seal', [0, 3.29, 0], [2.34, .08, 2.34], orange, deck, .025)
    pieces.box('Spring deck enamel', [0, 3.365, 0], [2.4, .15, 2.4], blue, deck, .055)
    frame = group('SpringTrampoline_Frame', root)
    for x in (-1.35, 1.35):
        for z in (-1.35, 1.35):
            pieces.box('Spring frame foot ' + str(x) + str(z), [x, .12, z], [.7, .24, .7], rubber, frame, .05)
            pieces.box('Spring frame leg ' + str(x) + str(z), [x, 1.57, z], [.22, 2.8, .22], graphite, frame, .04)
            coil('Spring coil ' + str(x) + str(z), [x, 2.75, z], .18, .72, 4, alloy, frame)
    for z in (-1.35, 1.35):
        pieces.box('Spring guard ' + str(z), [0, 3.0, z], [3.0, .18, .16], graphite, frame, .03)
    pieces.box('Spring pedestal brace X', [0, .52, 0], [2.9, .16, .22], alloy, frame, .025)
    pieces.box('Spring pedestal brace Z', [0, .52, 0], [.22, .16, 2.9], alloy, frame, .025)
    linkage = group('SpringTrampoline_CompressionLinkage', deck)
    for x in (-.7, .7):
        for z in (-.7, .7):
            pieces.beam('Spring moving linkage ' + str(x) + str(z), [x, 3.15, z], [x * .75, 2.65, z * .75], .075, alloy, linkage)
    needle = group('SpringTrampoline_EnergyNeedle', deck)
    pieces.box('Spring energy pointer', [0, 3.49, .92], [.08, .025, .32], ink, needle, .004)
    core = group('SpringTrampoline_Core', deck)
    ring_mesh('Spring core ring', .75, .035, .197, orange, core)
    ring_mesh('Spring outer energy ring', 1.1, .025, .193, ink, core)
    entries.append(make_entry('spring-trampoline', root, 'armed-neutral', [
        part('SpringTrampoline_Deck', 'body', 'kinematic', [0, 3.25, 0], [0, 1, 0], [2.4, .3, 2.4], True),
        part('SpringTrampoline_Frame', 'frame', 'fixed', [0, 0, 0], [0, 1, 0], [3.05, 3.4, 3.05], True),
        part('SpringTrampoline_Deck/SpringTrampoline_CompressionLinkage', 'linkage', 'kinematic', [0, 3.25, 0], [0, 1, 0], [1.5, .65, 1.5], False),
        part('SpringTrampoline_Deck/SpringTrampoline_EnergyNeedle', 'indicator', 'indicator', [0, 3.25, 0], [0, 1, 0], [.08, .025, .32], False),
        part('SpringTrampoline_Deck/SpringTrampoline_Core', 'zone', 'indicator', [0, 3.25, 0], [0, 1, 0], [2.2, .05, 2.2], False),
    ], modules['spring-trampoline']['parameters']))

    # 2. 开放重力弯轨
    root = start_root('GravityCoaster')
    track_group = group('GravityCoaster_Track', root)
    path = coaster_path()
    _, frames = strip_mesh('Coaster ivory deck', path, 1.4, .18, ivory, track_group)
    rail_group = group('GravityCoaster_Rails', root)
    coaster_rails(frames, orange, rail_group)
    support_group = group('GravityCoaster_Supports', root)
    for index in range(0, len(frames), 10):
        point, lateral, up = frames[index]
        for side in (-1, 1):
            base = point + lateral * .92
            height = max(.6, base.y - .28)
            pieces.box('Coaster column ' + str(index) + str(side), [base.x, height / 2, base.z], [.20, height, .20], graphite, support_group, .035)
            pieces.box('Coaster foot ' + str(index) + str(side), [base.x, .08, base.z], [.62, .16, .62], rubber, support_group, .04)
            pieces.beam('Coaster brace ' + str(index) + str(side), [base.x, max(.35, height - .7), base.z], [point.x + lateral.x * .72, point.y - .22, point.z + lateral.z * .72], .075, alloy, support_group)
    entries.append(make_entry('gravity-coaster', root, 'static-open-course', [
        part('GravityCoaster_Track', 'body', 'fixed', [0, 0, 0], [0, 1, 0], [9.3, 2.3, 11.3], True),
        part('GravityCoaster_Rails', 'guard', 'fixed', [0, 0, 0], [0, 1, 0], [9.3, 2.55, 11.3], True),
        part('GravityCoaster_Supports', 'frame', 'fixed', [0, 0, 0], [0, 1, 0], [10, 5.2, 12], True),
    ], modules['gravity-coaster']['parameters']))

    # 3. 脉冲喷气阵
    root = start_root('PulseJet')
    housing = group('PulseJet_Housing', root)
    pieces.box('Jet pedestal', [-2.0, 1.7, 0], [.75, 3.4, 1.2], graphite, housing, .07)
    pieces.cylinder('Jet nozzle shell', [-1.68, 3.825, 0], .42, .65, alloy, housing, 'X', .025, 48)
    tube('Jet orange nozzle lip', [-1.34, 3.825, 0], .48, .31, .12, orange, housing, 'X')
    for z in (-.72, .72):
        pieces.beam('Jet guard ' + str(z), [-1.7, 3.18, z], [-1.25, 4.45, z], .10, graphite, housing)
        pieces.box('Jet guard foot ' + str(z), [-1.7, .12, z], [.65, .24, .65], rubber, housing, .04)
    valve = group('PulseJet_Valve', root, [-1.85, 3.825, 0])
    pieces.cylinder('Jet moving valve', [-1.85, 3.825, 0], .26, .22, orange, valve, 'X', .02, 32)
    pieces.box('Jet valve linkage', [-2.05, 4.28, 0], [.08, .72, .16], alloy, valve, .015)
    flow = group('PulseJet_Flow', root, [-1.6, 3.825, 0])
    # 三层半透明圆锥台只显示作用范围；不作为碰撞。
    for index, (x, radius) in enumerate(((.55, .34), (1.45, .55), (2.55, .82))):
        pieces.cylinder('Jet flow slice ' + str(index + 1), [-1.6 + x, 3.825, 0], radius, .045, airflow, flow, 'X', 0, 40)
    ring_mesh('Jet warning halo', .62, .035, 0, orange, flow, 48).rotation_euler.y = math.pi / 2
    entries.append(make_entry('pulse-jet', root, 'idle', [
        part('PulseJet_Housing', 'frame', 'fixed', [0, 0, 0], [1, 0, 0], [2.45, 4.55, 1.7], True),
        part('PulseJet_Valve', 'valve', 'kinematic', [-1.85, 3.825, 0], [1, 0, 0], [.52, .72, .52], True),
        part('PulseJet_Flow', 'zone', 'indicator', [-1.6, 3.825, 0], [1, 0, 0], [3, 1.8, 1.8], False),
    ], modules['pulse-jet']['parameters']))

    # 4. 巡航接球斗
    root = start_root('OrbitalCatcher')
    carriage = group('OrbitalCatcher_Carriage', root)
    pieces.box('Catcher carriage chassis', [0, 2.72, 0], [1.8, .22, 1.45], graphite, carriage, .06)
    for x in (-.72, .72):
        for z in (-.5, .5):
            pieces.cylinder('Catcher wheel ' + str(x) + str(z), [x, 2.55, z], .16, .12, alloy, carriage, 'X', .015, 24)
    bowl = group('OrbitalCatcher_Bowl', carriage)
    bowl_mesh('Catcher concave bowl', 1.2, 3.1, 3.45, .10, blue, bowl)
    ring_mesh('Catcher bowl lip', 1.2, .055, 3.45, orange, bowl)
    brake = group('OrbitalCatcher_BrakeClamp', carriage)
    for x in (-.92, .92):
        pieces.box('Catcher brake clamp ' + str(x), [x, 2.78, 0], [.12, .5, .45], alloy, brake, .025)
    needle = group('OrbitalCatcher_OccupancyNeedle', bowl)
    pieces.box('Catcher occupancy pointer', [0, 3.5, .88], [.08, .025, .34], orange, needle, .004)
    rail = group('OrbitalCatcher_Rail', root)
    for index in range(48):
        a = index * math.tau / 48
        b = (index + 1) * math.tau / 48
        p1 = [1.65 * math.sin(a), 2.48, .95 * math.cos(a)]
        p2 = [1.65 * math.sin(b), 2.48, .95 * math.cos(b)]
        pieces.beam('Catcher guide ' + str(index + 1), p1, p2, .085, alloy, rail)
    for x in (-1.65, 1.65):
        pieces.box('Catcher rail pedestal ' + str(x), [x, 1.25, 0], [.25, 2.5, .25], graphite, rail, .04)
        pieces.box('Catcher rail foot ' + str(x), [x, .10, 0], [.7, .20, .7], rubber, rail, .04)
    dock = group('OrbitalCatcher_Dock', root)
    pieces.box('Catcher fixed dock', [2.55, 3.27, .4], [.4, .36, 2.0], ivory, dock, .05)
    pieces.box('Catcher dock chassis', [2.55, 3.02, .4], [.48, .14, 2.08], graphite, dock, .04)
    entries.append(make_entry('orbital-catcher', root, 'patrol-center', [
        part('OrbitalCatcher_Carriage', 'carriage', 'kinematic', [0, 0, 0], [0, 1, 0], [1.8, .45, 1.45], True),
        part('OrbitalCatcher_Carriage/OrbitalCatcher_Bowl', 'body', 'kinematic', [0, 0, 0], [0, 1, 0], [2.4, .45, 2.4], True),
        part('OrbitalCatcher_Rail', 'frame', 'fixed', [0, 0, 0], [0, 1, 0], [3.6, 2.6, 2.1], True),
        part('OrbitalCatcher_Dock', 'dock', 'fixed', [0, 0, 0], [0, 1, 0], [.48, .5, 2.08], True),
        part('OrbitalCatcher_Carriage/OrbitalCatcher_BrakeClamp', 'brake', 'kinematic', [0, 0, 0], [0, 1, 0], [2, .5, .45], False),
        part('OrbitalCatcher_Carriage/OrbitalCatcher_Bowl/OrbitalCatcher_OccupancyNeedle', 'indicator', 'indicator', [0, 0, 0], [0, 1, 0], [.08, .025, .34], False),
    ], modules['orbital-catcher']['parameters']))

    # 5. 反转输送带桥
    root = start_root('ReversingConveyor')
    belt = group('ReversingConveyor_Belt', root)
    slat_count = 32
    for index in range(slat_count):
        z = 3 - (index + .5) * 6 / slat_count
        pieces.box('Conveyor slat ' + str(index + 1), [0, 3.36, z], [1.4, .08, 6 / slat_count - .014], blue, belt, .012)
    frame = group('ReversingConveyor_Frame', root)
    for x in (-.82, .82):
        pieces.box('Conveyor side guard ' + str(x), [x, 3.12, 0], [.14, .52, 6.7], graphite, frame, .04)
        for z in (-2.75, 0, 2.75):
            pieces.box('Conveyor frame leg ' + str(x) + str(z), [x, 1.5, z], [.22, 2.8, .22], graphite, frame, .04)
            pieces.box('Conveyor frame foot ' + str(x) + str(z), [x, .10, z], [.62, .20, .62], rubber, frame, .04)
    for z in (-3.0, 3.0):
        pieces.box('Conveyor drum cover ' + str(z), [0, 3.06, z], [1.72, .72, .42], graphite, frame, .08)
    drum_a = group('ReversingConveyor_DrumA', root, [0, 3.05, 3])
    pieces.cylinder('Conveyor drum north', [0, 3.05, 3], .35, 1.42, alloy, drum_a, 'X', .02, 40)
    drum_b = group('ReversingConveyor_DrumB', root, [0, 3.05, -3])
    pieces.cylinder('Conveyor drum south', [0, 3.05, -3], .35, 1.42, alloy, drum_b, 'X', .02, 40)
    direction = group('ReversingConveyor_Direction', root)
    for z in (-1.2, 0, 1.2):
        pieces.box('Conveyor direction marker ' + str(z), [0, 3.415, z], [.32, .012, .08], orange, direction, .002)
    entries.append(make_entry('reversing-conveyor', root, 'stopped-neutral', [
        part('ReversingConveyor_Belt', 'body', 'fixed', [0, 0, 0], [0, 0, 1], [1.4, .08, 6], True),
        part('ReversingConveyor_Frame', 'frame', 'fixed', [0, 0, 0], [0, 0, 1], [1.72, 3.4, 6.7], True),
        part('ReversingConveyor_DrumA', 'drum', 'kinematic', [0, 3.05, 3], [1, 0, 0], [1.42, .7, .7], True),
        part('ReversingConveyor_DrumB', 'drum', 'kinematic', [0, 3.05, -3], [1, 0, 0], [1.42, .7, .7], True),
        part('ReversingConveyor_Direction', 'indicator', 'indicator', [0, 0, 0], [0, 0, 1], [.32, .012, 2.48], False),
    ], modules['reversing-conveyor']['parameters']))

    # 6. 回旋漏斗
    root = start_root('VortexFunnel')
    surface = group('VortexFunnel_Surface', root)
    funnel_mesh('Funnel annular surface', 4, .65, 3.4, 20, .12, ivory, surface)
    for ring in (1.5, 2.5, 3.5):
        ring_mesh('Funnel guide marking ' + str(ring), ring, .018, 3.4 + math.tan(math.radians(20)) * (ring - .65) + .018, ink, surface)
    rails = group('VortexFunnel_Rails', root)
    ring_mesh('Funnel outer safety rail', 4.02, .07, 4.68, orange, rails)
    ring_mesh('Funnel hole rim', .67, .045, 3.42, alloy, rails)
    catch = group('VortexFunnel_CatchDeck', root)
    pieces.box('Funnel lower catch deck', [0, 1.25, 0], [2.4, .30, 2.4], blue, catch, .06)
    pieces.box('Funnel catch chassis', [0, 1.02, 0], [2.5, .14, 2.5], graphite, catch, .05)
    supports = group('VortexFunnel_Supports', root)
    for index in range(8):
        angle = index * math.tau / 8
        x, z = 3.55 * math.cos(angle), 3.55 * math.sin(angle)
        top = 3.4 + math.tan(math.radians(20)) * (3.55 - .65) - .16
        pieces.box('Funnel leg ' + str(index + 1), [x, top / 2, z], [.24, top, .24], graphite, supports, .045)
        pieces.box('Funnel foot ' + str(index + 1), [x, .10, z], [.72, .20, .72], rubber, supports, .045)
        pieces.beam('Funnel radial brace ' + str(index + 1), [x, top - .65, z], [x * .82, top + .02, z * .82], .085, alloy, supports)
    entries.append(make_entry('vortex-funnel', root, 'static-open-hole', [
        part('VortexFunnel_Surface', 'body', 'fixed', [0, 0, 0], [0, 1, 0], [8, 1.22, 8], True),
        part('VortexFunnel_Rails', 'guard', 'fixed', [0, 0, 0], [0, 1, 0], [8.18, 1.35, 8.18], True),
        part('VortexFunnel_CatchDeck', 'catch', 'fixed', [0, 0, 0], [0, 1, 0], [2.5, .44, 2.5], True),
        part('VortexFunnel_Supports', 'frame', 'fixed', [0, 0, 0], [0, 1, 0], [7.82, 4.55, 7.82], True),
    ], modules['vortex-funnel']['parameters']))

    # 7. 双轴天平台
    root = start_root('GimbalPlatform')
    base = group('GimbalPlatform_Base', root)
    for x in (-2.15, 2.15):
        for z in (-2.15, 2.15):
            pieces.box('Gimbal base foot ' + str(x) + str(z), [x, .10, z], [.72, .20, .72], rubber, base, .045)
            pieces.box('Gimbal pedestal ' + str(x) + str(z), [x, 1.75, z], [.24, 3.3, .24], graphite, base, .045)
    pieces.box('Gimbal base tie X', [0, .46, 0], [4.4, .18, .25], alloy, base, .03)
    pieces.box('Gimbal base tie Z', [0, .46, 0], [.25, .18, 4.4], alloy, base, .03)
    for x in (-2.15, 2.15):
        pieces.box('Gimbal stop X ' + str(x), [x, 3.34, 0], [.28, .16, .5], orange, base, .025)
    for z in (-2.15, 2.15):
        pieces.box('Gimbal stop Z ' + str(z), [0, 3.34, z], [.5, .16, .28], orange, base, .025)
    pivot_y = modules['gimbal-platform']['parameters']['pivotY']
    outer = group('GimbalPlatform_OuterFrame', root, [0, pivot_y, 0])
    for z in (-1.78, 1.78):
        pieces.box('Gimbal outer frame Z ' + str(z), [0, pivot_y, z], [3.82, .18, .18], graphite, outer, .035)
    for x in (-1.82, 1.82):
        pieces.box('Gimbal outer frame X ' + str(x), [x, pivot_y, 0], [.18, .18, 3.56], graphite, outer, .035)
    outer_axle = group('GimbalPlatform_OuterAxle', outer)
    pieces.cylinder('Gimbal X axle', [0, pivot_y, 0], .10, 4.7, alloy, outer_axle, 'X', .012, 32)
    inner = group('GimbalPlatform_InnerDeck', outer)
    pieces.box('Gimbal inner deck chassis', [0, pivot_y - .06, 0], [3.2, .12, 3.2], graphite, inner, .05)
    pieces.box('Gimbal inner deck seal', [0, pivot_y + .025, 0], [3.14, .05, 3.14], orange, inner, .018)
    pieces.box('Gimbal inner deck enamel', [0, pivot_y + .09, 0], [3.2, .12, 3.2], blue, inner, .055)
    inner_axle = group('GimbalPlatform_InnerAxle', inner)
    pieces.cylinder('Gimbal Z axle', [0, pivot_y, 0], .075, 3.75, alloy, inner_axle, 'Z', .01, 32)
    entries.append(make_entry('gimbal-platform', root, 'export-zero-both-axes', [
        part('GimbalPlatform_Base', 'frame', 'fixed', [0, 0, 0], [0, 1, 0], [4.76, 3.45, 4.76], True),
        part('GimbalPlatform_OuterFrame', 'outer', 'dynamic', [0, pivot_y, 0], [1, 0, 0], [3.82, .18, 3.74], True),
        part('GimbalPlatform_OuterFrame/GimbalPlatform_OuterAxle', 'outer-axle', 'dynamic', [0, 0, 0], [1, 0, 0], [4.7, .2, .2], True),
        part('GimbalPlatform_OuterFrame/GimbalPlatform_InnerDeck', 'body', 'dynamic', [0, 0, 0], [0, 0, 1], [3.2, .24, 3.2], True),
        part('GimbalPlatform_OuterFrame/GimbalPlatform_InnerDeck/GimbalPlatform_InnerAxle', 'inner-axle', 'dynamic', [0, 0, 0], [0, 0, 1], [.15, .15, 3.75], True),
    ], modules['gimbal-platform']['parameters']))

    # 8. 连锁坍塌桥
    root = start_root('CascadeBridge')
    frame = group('CascadeBridge_Frame', root)
    for x in (-.82, .82):
        pieces.box('Cascade side beam ' + str(x), [x, 2.8, 0], [.16, .18, 9.15], graphite, frame, .035)
        for z in (-4.45, 4.45):
            pieces.box('Cascade end leg ' + str(x) + str(z), [x, 1.45, z], [.22, 2.7, .22], graphite, frame, .04)
            pieces.box('Cascade end foot ' + str(x) + str(z), [x, .10, z], [.65, .20, .65], rubber, frame, .04)
    tile_centers = modules['cascade-bridge']['tileCenters']
    for index, center in enumerate(tile_centers, 1):
        tile_name = 'CascadeBridge_Tile' + str(index).zfill(2)
        tile = group(tile_name, root, center)
        pieces.box(tile_name + ' graphite', [center[0], center[1] - .055, center[2]], [1.2, .11, 1.4], graphite, tile, .035)
        pieces.box(tile_name + ' seal', [center[0], center[1] + .017, center[2]], [1.16, .034, 1.36], orange, tile, .012)
        pieces.box(tile_name + ' ivory', [center[0], center[1] + .075, center[2]], [1.2, .11, 1.4], ivory, tile, .04)
        lock_name = 'CascadeBridge_Lock' + str(index).zfill(2)
        lock = group(lock_name, root)
        pieces.box(lock_name + ' housing', [0, 3.04, center[2]], [.42, .20, .20], alloy, lock, .03)
        pieces.box(lock_name + ' pin', [0, 3.16, center[2]], [.16, .16, .34], orange, lock, .02)
    cascade_parts = [part('CascadeBridge_Frame', 'frame', 'fixed', [0, 0, 0], [0, 1, 0], [1.8, 3.4, 9.4], True)]
    for index, center in enumerate(tile_centers, 1):
        suffix = str(index).zfill(2)
        cascade_parts.append(part('CascadeBridge_Tile' + suffix, 'body', 'dynamic', center, [1, 0, 0], [1.2, .22, 1.4], True))
        cascade_parts.append(part('CascadeBridge_Lock' + suffix, 'lock', 'indicator', [0, 0, 0], [1, 0, 0], [.42, .32, .34], False))
    entries.append(make_entry('cascade-bridge', root, 'all-tiles-locked', cascade_parts, modules['cascade-bridge']['parameters']))

    scene['library'] = 'advanced-obstacle-library'
    scene['construction_sha256'] = sha(CONSTRUCTION)
    scene['contract_sha256'] = sha(CONTRACT)
    scene['status'] = 'Eight semantic roots modeled; runtime behavior and physics validation owned by CODE.'
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    manifest = export_and_manifest(entries, roots)
    print('ADVANCED_LIBRARY_EXPORTED', json.dumps({'sourceSha256': manifest['sourceSha256'], 'glbSha256': manifest['glbSha256'], 'statistics': manifest['statistics']}))

    # 逐项制作图使用同一真实源对象、统一灯光，姿态不保存回源或GLB。
    for index, (entry, collection) in enumerate(zip(entries, collections)):
        for item in collections:
            for obj in item.objects:
                obj.hide_render = item != collection
        pieces.render(PREVIEWS / (entry['id'] + '.png'), [0, 2.6, 0], 12, (9, 9, 13))
    print('ADVANCED_LIBRARY_PREVIEWS_COMPLETE')
