"""水上冲关的固定文件制作工具；布局来自关卡交接，不修改运行时。"""
import hashlib
import json
import math
import re
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
_names = {}
_touched = set()


def current_name(name):
    count = _names.get(name, 0)
    _names[name] = count+1
    return name if count == 0 else f'{name}.{count:03d}'


def resize_existing(obj, position, dimensions):
    """只调整既有网格尺寸和摆放，保留材质、修饰器及局部几何细节。"""
    points = [v.co.copy() for v in obj.data.vertices]
    low = [min(v[i] for v in points) for i in range(3)]
    high = [max(v[i] for v in points) for i in range(3)]
    if any(abs(high[i]-low[i]-dimensions[i]) > 1e-5 or abs(high[i]+low[i])>1e-5 for i in range(3)):
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        for vertex in obj.data.vertices:
            for i in range(3):
                vertex.co[i] = (vertex.co[i]-(low[i]+high[i])/2)*dimensions[i]/(high[i]-low[i])
    obj.location = game_position(position)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = (1,0,0,0)
    obj.scale = (1,1,1)
    _touched.add(obj.name)
    return obj


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
    name = current_name(name)
    existing = bpy.data.objects.get(name)
    if existing:
        return resize_existing(existing, position, (size[0],size[2],size[1]))
    bpy.ops.mesh.primitive_cube_add(size=1, location=game_position(position))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return rounded(obj, name, material, min(radius, min(size)*.25))


def cylinder(name, position, radius, height, material, edge=.025, vertices=64):
    name = current_name(name)
    existing = bpy.data.objects.get(name)
    if existing:
        return resize_existing(existing, position, (radius*2,radius*2,height))
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height,
                                       location=game_position(position))
    return rounded(bpy.context.object, name, material, edge)


def cross_prism(name, position, length, width, height, material, edge):
    """完整十字外轮廓；四角没有圆盘或方板残留。"""
    a,b = width/2,length/2
    outline = [(-a,-b),(a,-b),(a,-a),(b,-a),(b,a),(a,a),
               (a,b),(-a,b),(-a,a),(-b,a),(-b,-a),(-a,-a)]
    n=len(outline)
    vertices=[game_position((x,y,z)) for y in (-height/2,height/2) for x,z in outline]
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces.extend((i,n+i,n+(i+1)%n,(i+1)%n) for i in range(n))
    mesh=bpy.data.meshes.new(name+' cross profile')
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj=bpy.data.objects.get(name)
    if obj:
        old=obj.data
        materials=list(old.materials)
        obj.data=mesh
        for mat in materials:
            mesh.materials.append(mat)
        if old.users==0:
            bpy.data.meshes.remove(old)
    else:
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.scene.collection.objects.link(obj)
        rounded(obj,name,material,edge)
    mesh.name=name+' cross profile'
    obj.location=game_position(position)
    obj.rotation_mode='QUATERNION'
    obj.rotation_quaternion=(1,0,0,0)
    obj.scale=(1,1,1)
    for face in mesh.polygons:
        face.use_smooth=len(face.vertices)==4
    return obj


def move_to_collection(obj, collection):
    if collection in obj.users_collection:
        return
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
    # 布尔接缝可能留下退化环，仅清理导出副本，保留源控制体。
    merged.data.validate(verbose=False, clean_customdata=False)
    merged.data.update()
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
    _names.clear()
    _touched.clear()
    input_hash = sha(BLEND) if BLEND.exists() else None
    layout_hash = sha(LAYOUT)
    layout = json.loads(LAYOUT.read_text())
    s_bend=layout.get('sBend',{})
    s_segments=s_bend.get('collisionSegments',[]) if s_bend.get('enabled') else []
    walkable_specs=layout['staticDecks']+layout['ramps']+s_segments
    geometry_keys=('staticDecks','ramps','staticRails','sBend','hammers','turntable','lifts','crossing','start','checkpoints','finish','runtimeMarkings')
    geometry_snapshot=json.dumps({k:layout.get(k) for k in geometry_keys},sort_keys=True)
    # 用户要求接驳口与中心共线；关卡JSON同步过程中也不保留已被否定的偏移。
    cross_spec = {key:layout['turntable'][key] for key in ('span','armWidth','thickness')}
    assert layout['turntable']['noCornerSupport'] and layout['turntable']['noCoMovingBarrier']
    port_override=False
    for deck in layout['staticDecks']:
        if deck['id'] in ('turntable-entry-tongue','turntable-exit-tongue'):
            port_override |= deck['bodyCenter'][0] != layout['turntable']['bodyCenter'][0]
            deck['bodyCenter'][0]=layout['turntable']['bodyCenter'][0]
    contract = ROOT / 'docs/integration/level-02-contract.md'
    contract_hash = sha(contract)
    protected = {name: sha(ROOT / name) for name in (
        'art/track-round-03.blend', 'art/hammer-toy-round-03.blend',
        'public/models/track-round-03.glb', 'public/models/platform-refined.glb',
        'public/models/hammer-head-toy-round-03.glb', 'public/models/hammer-handle-toy-round-03.glb')}
    if BLEND.exists():
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    material_names = ['Ivory polymer','Graphite chassis','Safety terracotta','Brushed alloy','Platform enamel','Rubber pads','Printed markings']
    missing = [name for name in material_names if name not in bpy.data.materials]
    if missing:
        with bpy.data.libraries.load(str(ROOT/'art/track-round-03.blend'), link=False) as (_, loaded):
            loaded.materials = missing
    ivory, graphite, orange, alloy, blue, rubber, ink = [bpy.data.materials[name] for name in material_names]
    original_objects = set(bpy.data.objects.keys())
    original_layout_ids={o['layout_id'] for o in bpy.data.objects if 'layout_id' in o}
    original_materials = {m.name: list(m.diffuse_color) for m in bpy.data.materials}
    groups = {}
    for name in ('Layout controls', 'Static structure', 'Turntable', 'Lift plates', 'Runtime references'):
        collection = bpy.data.collections.get(name)
        if not collection:
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
        bearing=name=='Turntable spindle'
        narrow_width=next((s['bodySize'][0] for s in layout['staticDecks'] if s['id']=='narrow-bridge'),1.6)
        narrow=name.startswith('narrow-bridge support') and narrow_width<1.6
        limits=layout.get('narrowBridgeVisualLimits',{})
        if narrow:
            width=min(width,limits.get('upperPostWidth',narrow_width-.26))
        foot=.76 if bearing else .95
        plate=.70 if bearing else .8
        foot_width=min(foot,limits.get('footWidthX',foot)) if narrow else foot
        plate_width=min(plate,limits.get('footWidthX',plate)) if narrow else plate
        add(box(name+' rubber foot', [x, -.34, z], [foot_width, .12, foot], rubber, .05), 'Static structure', static)
        add(box(name+' alloy foot', [x, -.23, z], [plate_width, .12, plate], alloy, .035), 'Static structure', static)
        height = top+.125
        add(box(name+' leg', [x, -.2+height/2, z], [width, height, width], graphite, .06), 'Static structure', static)
        flange=[.76,.15,.76] if bearing else [1,.15,.7]
        if narrow:
            flange[0]=min(flange[0],limits.get('flangeWidthMax',narrow_width-.16))
        add(box(name+' mounting flange', [x, top-.075, z], flange, alloy, .035), 'Static structure', static)
        collar_width=limits.get('collarWidth',width+.04) if narrow else width+.04
        add(box(name+' orange collar', [x, .02, z], [collar_width, .13, width+.04], orange, .03), 'Static structure', static)
        anchor_offset=limits.get('anchorOffsetX',.27) if narrow else .27
        for dx in (-anchor_offset, anchor_offset):
            add(cylinder(name+' anchor', [x+dx, -.155, z], .055, .04, graphite, .008, 16), 'Static structure', static)
        brace_offset=.32 if bearing else .62
        if narrow:
            brace_offset=min(brace_offset,limits.get('braceReachMax',narrow_width/2-.15))
        start, end = Vector(game_position([x, top-.75, z])), Vector(game_position([x+brace_offset, top-.075, z]))
        brace = box(name+' diagonal brace', [0,0,0], [.1, (end-start).length, .1], alloy, .02)
        brace.location = (start+end)/2
        brace.rotation_mode = 'XYZ'
        brace.rotation_euler = (end-start).to_track_quat('Z', 'Y').to_euler()
        add(brace, 'Static structure', static)

    def union(name, controls, radius):
        obj = bpy.data.objects.get(name)
        if not obj:
            obj = controls[0].copy()
            obj.data = controls[0].data.copy()
            obj.name = name
            groups['Static structure'].objects.link(obj)
        obj.matrix_world = controls[0].matrix_world.copy()
        if name == 'Continuous walkable surface':
            from repair_water_rush_surface import replace_white_surface
            replace_white_surface(obj, controls)
            static.append(obj)
            return obj
        desired = {c.name for c in controls[1:]}
        for modifier in list(obj.modifiers):
            if modifier.type == 'BOOLEAN' and modifier.name.startswith(('Union ', 'Layer union ')):
                if not modifier.object or modifier.object.name not in desired:
                    obj.modifiers.remove(modifier)
        ordered=[]
        for control in controls[1:]:
            modifier = next((m for m in obj.modifiers if m.type=='BOOLEAN' and m.object==control), None)
            if not modifier:
                modifier = obj.modifiers.new('Union '+control.name, 'BOOLEAN')
                modifier.operation, modifier.solver, modifier.object = 'UNION','EXACT',control
            ordered.append(modifier.name)
        ordered.extend(m.name for m in obj.modifiers if m.name not in ordered)
        # 先把末端倒角/法线移到末尾，避免每新增一段S弯都重新求值整个布尔链。
        bpy.context.view_layer.objects.active=obj
        for index in range(len(ordered)-1,-1,-1):
            name=ordered[index]
            if obj.modifiers.find(name)!=index:
                bpy.ops.object.modifier_move_to_index(modifier=name,index=index)
        if not any(m.type=='BEVEL' for m in obj.modifiers):
            modifier = obj.modifiers.new('Same-family bevel','BEVEL')
            modifier.width, modifier.segments = radius,3
        if not any(m.type=='WEIGHTED_NORMAL' for m in obj.modifiers):
            modifier = obj.modifiers.new('Same-family normals','WEIGHTED_NORMAL')
            modifier.keep_sharp = True
        static.append(obj)
        return obj

    # 原始碰撞模块保持独立可编辑；可见台面通过非破坏布尔并集去掉交叠内部面。
    for spec in walkable_specs:
        obj = flat_box(spec['id'], spec['bodyCenter'], spec['bodySize'], ivory, 'Layout controls', deck_controls)
        obj['layout_id'] = spec['id']
        rotation = spec.get('rotationEulerDegrees', [0, 0, 0])
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = game_rotation(rotation)
    bpy.context.view_layer.update()
    surface = union('Continuous walkable surface', deck_controls, .065)
    # 底座和橙色夹层也做连续并集，避免首段交叠处产生重复外壁。
    layer_controls = []
    for name, depth, height, extra, material, radius in (
            ('Graphite chassis', .10, .22, .08, graphite, .06),
            ('Recessed orange gasket', -.035, .045, .015, orange, .015)):
        controls = []
        for spec in walkable_specs:
            x, y, z = spec['bodyCenter']
            w, h, d = spec['bodySize']
            degrees = spec.get('rotationEulerDegrees', [0,0,0])
            normal_game = Euler(tuple(math.radians(v) for v in degrees),'XYZ').to_matrix()@Vector((0,1,0))
            offset = h/2+depth
            center = [value-offset*normal_game[i] for i,value in enumerate((x,y,z))]
            width_extra=extra
            if spec['id']=='narrow-bridge' and w<1.6:
                key='baseWidth' if name=='Graphite chassis' else 'gasketWidth'
                width_extra=layout.get('narrowBridgeVisualLimits',{}).get(key,w+(-.04 if name=='Graphite chassis' else -.01))-w
            control = flat_box(spec['id']+' '+name+' control', center, [w+width_extra, height, d+extra], material, 'Layout controls')
            control.rotation_mode = 'QUATERNION'
            control.rotation_quaternion = game_rotation(degrees)
            controls.append(control)
        bpy.context.view_layer.update()
        combined = union(name, controls, radius)
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
    for i,spec in enumerate(s_bend.get('supportPoints',[])):
        x,_,z=spec['pathPosition']
        support(f'S-bend support {i+1}',x,z,spec['topLimitY'])

    for spec in layout['staticRails']:
        obj = add(box(spec['id'], spec['bodyCenter'], spec['bodySize'], orange, .048), 'Static structure', static)
        obj['layout_id'] = spec['id']
        x, y, z = spec['bodyCenter']
        w, h, d = spec['bodySize']
        for t in (-.4, 0, .4):
            pos = [x+w*t if w>d else x, y-.115, z+d*t if d>w else z]
            add(box(spec['id']+' mount', pos, [.22, .055, .22], alloy, .015), 'Static structure', static)
            add(cylinder(spec['id']+' rivet', [pos[0], y+.142, pos[2]], .035, .024, graphite, .0048, 16), 'Static structure', static)

    hammers = layout.get('hammers')
    assert hammers and len(hammers) == 3, '等待关卡三锤统一数据，不回退单锤草案'
    first_id = hammers[0]['id']
    for old, new in [('Hammer post 1',first_id+' post 1'),('Hammer post 2',first_id+' post 2'),
                     ('Hammer crossbar',first_id+' crossbar'),('Hammer post shoe 1',first_id+' foot 2'),
                     ('Hammer post shoe 2',first_id+' foot 4')]:
        if old in bpy.data.objects and new not in bpy.data.objects:
            bpy.data.objects[old].name = new
    for hammer in hammers:
        hid = hammer['id']
        for i, pos in enumerate(hammer['standPosts']):
            add(box(f'{hid} post {i+1}',pos,hammer['standPostSize'],graphite), 'Static structure',static)
        crossbar = hammer['standCrossbar']
        add(box(hid+' crossbar',crossbar['position'],crossbar['size'],graphite), 'Static structure',static)
        for i, pad in enumerate(hammer['standFootPads']):
            material = rubber if 'rubber' in pad['id'] else alloy
            add(box(f'{hid} foot {i+1}',pad['position'],pad['size'],material,.035), 'Static structure',static)

    turn = layout['turntable']
    tc = turn['bodyCenter']
    span,width,thickness = cross_spec['span'],cross_spec['armWidth'],cross_spec['thickness']
    disk_center = [tc[0],tc[1]+.08,tc[2]]
    disk=add(cross_prism('Turntable deck',disk_center,span,width,thickness-.16,ivory,.045),'Turntable',rotating)
    add(cross_prism('Turntable dark base',[tc[0],tc[1]-.17,tc[2]],span,width,.16,graphite,.015),'Turntable',rotating)
    add(cross_prism('Turntable orange gasket',[tc[0],tc[1]-.09,tc[2]],span-.01,width-.01,.045,orange,.008),'Turntable',rotating)
    disk['mount_origin_game']=tc
    disk['shape']='cross; four open quadrants'
    top=tc[1]+thickness/2
    for angle in (0,math.pi/2,math.pi,math.pi*1.5):
        position=[tc[0]+math.sin(angle)*2,top+.002,tc[2]+math.cos(angle)*2]
        strip=flat_box('Turntable radial paint',position,[.12,.004,2.6],ink,'Turntable',rotating)
        strip.rotation_mode='XYZ'
        strip.rotation_euler.z=-angle
    barrier=bpy.data.objects.get('Turntable collision-matched barrier')
    if barrier:
        bpy.data.objects.remove(barrier,do_unlink=True)
    support('Turntable spindle', tc[0], tc[2], turn['supportTopMaxY'], .7)

    lift = layout['lifts']
    structure=lift.get('visualStructure',{})
    if lift['amplitude']>.45:
        assert structure, '扩大行程前需要关卡确认新的杆套结构'
    stem_top=structure.get('stemTopLocalY',-.38)
    stem_bottom=structure.get('stemBottomLocalY',-1.58)
    stem_radius=structure.get('stemRadius',.075)
    sleeve_inner=structure.get('sleeveInnerRadius',.095)
    sleeve_outer=structure.get('sleeveOuterRadius',.16)
    sleeve_bottom=structure.get('sleeveBottomY',-.24)
    sleeve_top=structure.get('sleeveTopY',2.30)
    assert lift['centerY']-lift['amplitude']+stem_top-sleeve_top >= .10-1e-5
    assert lift['centerY']+lift['amplitude']+stem_bottom < sleeve_top
    assert lift['centerY']-lift['amplitude']+stem_bottom > -.17
    for instance in lift['instances']:
        parts = []
        center = instance['center']
        x, y, z = center
        w, h, d = lift['bodySize']
        old_body = bpy.data.objects.get(instance['id']+' deck')
        old_center = list(old_body.get('base_center_game', center)) if old_body else center
        body = add(box(instance['id']+' deck', center, lift['bodySize'], blue, .065), 'Lift plates', parts)
        add(box(instance['id']+' graphite belly', [x,y-.28,z], [w-.18,.2,d-.16], graphite, .055), 'Lift plates', parts)
        add(box(instance['id']+' orange gasket', [x,y-.165,z], [w-.1,.045,d-.1], orange, .015), 'Lift plates', parts)
        body['phase_radians'] = instance['phase']
        body['base_center_game'] = center
        for side in (-1, 1):
            flat_box(instance['id']+' seam paint', [x, y+h/2+.002, z+side*(d/2-.18)], [w-.4, .004, .10], orange, 'Lift plates', parts)
        # 细杆进入真正中空的固定套筒，避免活动板像浮空，也不进入可行驶面。
        add(cylinder(instance['id']+' sliding stem', [x,y+(stem_top+stem_bottom)/2,z],stem_radius,stem_top-stem_bottom,alloy,.006,24), 'Lift plates', parts)
        outer, inner, low, high, count = sleeve_outer,sleeve_inner,sleeve_bottom,sleeve_top,32
        vertices = []
        for yy, rr in ((low, outer), (high, outer), (low, inner), (high, inner)):
            vertices.extend(game_position([rr*math.cos(i*2*math.pi/count),yy-(low+high)/2,rr*math.sin(i*2*math.pi/count)]) for i in range(count))
        faces = []
        for i in range(count):
            j = (i+1)%count
            faces.extend([(i,j,count+j,count+i), (2*count+j,2*count+i,3*count+i,3*count+j),
                          (count+i,count+j,3*count+j,3*count+i), (j,i,2*count+i,2*count+j)])
        faces = [tuple(reversed(face)) for face in faces]
        sleeve = bpy.data.objects.get(instance['id']+' hollow sleeve')
        if sleeve:
            resize_existing(sleeve,[x,(low+high)/2,z],[outer*2,outer*2,high-low])
        else:
            mesh = bpy.data.meshes.new(instance['id']+' hollow sleeve')
            mesh.from_pydata(vertices, [], faces)
            mesh.update()
            sleeve = bpy.data.objects.new(instance['id']+' hollow sleeve',mesh)
            scene.collection.objects.link(sleeve)
            rounded(sleeve,sleeve.name,graphite,0)
            sleeve.location=game_position([x,(low+high)/2,z])
        add(sleeve, 'Static structure',static)
        add(box(instance['id']+' rubber foot', [x, -.34, z], [.95,.12,.95], rubber, .05), 'Static structure', static)
        add(box(instance['id']+' alloy foot', [x, -.23, z], [.8,.12,.8], alloy, .035), 'Static structure', static)
        add(box(instance['id']+' orange collar', [x,.02,z], [.36,.13,.36], orange, .03), 'Static structure', static)
        for dx in (-.27,.27):
            add(cylinder(instance['id']+' anchor', [x+dx,-.155,z], .055,.04,graphite,.008,16), 'Static structure', static)
        lift_groups.append(parts)

    # 保留已有参考件的网格与材质，只改变实例位置；不输出重复的动态GLB。
    platform_parts = [o for o in groups['Runtime references'].objects if o.name.startswith('Platform')]
    platform_body = bpy.data.objects['Platform rounded deck']
    delta = Vector(game_position(layout['crossing']['bodyCenter']))-platform_body.location
    for obj in platform_parts:
        obj.location += delta
    for i,guide in enumerate(layout['crossing']['guides']):
        obj=box(f'Reference crossing guide {i+1}',guide['position'],guide['size'],graphite,.012)
        add(obj,'Runtime references')
        obj['reference_only']=True
    dashes=layout['runtimeMarkings']['narrowDashes']
    for i,(x,z) in enumerate((x,z) for x in dashes['x'] for z in dashes['z']):
        obj=flat_box(f'Reference narrow dash {i+1}',[x,dashes['y'],z],dashes['size'],orange,'Runtime references')
        obj['reference_only']=True
    rings=[('start',layout['start']['ringCenter'],layout['start']['ringRadius'],orange)]
    rings.extend((cp['id'],cp['ringCenter'],cp['ringRadius'],blue) for cp in layout['checkpoints'])
    rings.append(('finish',layout['finish']['ringCenter'],layout['finish']['ringRadius'],orange))
    for label,position,radius,material in rings:
        name='Reference ring '+label
        obj=bpy.data.objects.get(name)
        if not obj:
            bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=10,major_radius=radius,minor_radius=.045)
            obj=bpy.context.object
            obj.name=name
            obj.data.materials.append(material)
            for face in obj.data.polygons:
                face.use_smooth=True
            add(obj,'Runtime references')
        obj.location=game_position(position)
        obj['reference_only']=True
    templates = {}
    for role, legacy in [('head','Toy flat-faced head'),('socket','Inset toy handle socket'),('handle','Normalized toy handle')]:
        name = hammers[0]['id']+' '+role+' reference'
        obj = bpy.data.objects.get(name) or bpy.data.objects.get(legacy)
        assert obj, f'当前场景缺少参考件：{role}'
        obj.name = name
        templates[role] = obj
    old_head = templates['head']
    if 'mount_local_offset' not in templates['socket']:
        offset = old_head.rotation_quaternion.inverted()@(templates['socket'].location-old_head.location)
        templates['socket']['mount_local_offset'] = list(offset)
    hammer_parts = []
    for hammer in hammers:
        parts = {}
        for role, template in templates.items():
            name = hammer['id']+' '+role+' reference'
            obj = bpy.data.objects.get(name)
            if not obj:
                obj = template.copy()
                obj.data = template.data
                obj.name = name
                groups['Runtime references'].objects.link(obj)
            parts[role] = obj
        hammer_parts.append(parts)

    def pose_hammer(index, theta):
        hammer, parts = hammers[index],hammer_parts[index]
        anchor = Vector(hammer['anchor'])
        length = hammer['motion']['rodLength']
        head = Vector((anchor.x,anchor.y-length*math.cos(theta),anchor.z+length*math.sin(theta)))
        a,b = Vector(game_position(anchor)),Vector(game_position(head))
        rotation = Vector((0,0,1)).rotation_difference((a-b).normalized())
        for role,obj in parts.items():
            obj.rotation_mode = 'QUATERNION'
            obj.rotation_quaternion = rotation
            obj.scale = (1,1,length if role=='handle' else 1)
            if role=='handle':
                obj.location=(a+b)/2
            elif role=='socket':
                obj.location=b+rotation@Vector(obj['mount_local_offset'])
            else:
                obj.location=b
            obj['hammer_id']=hammer['id']
        bpy.context.view_layer.update()
        handle = parts['handle']
        assert (handle.matrix_world@Vector((0,0,.5))-a).length<1e-5
        assert (handle.matrix_world@Vector((0,0,-.5))-b).length<1e-5
        return list(head)

    for i in range(len(hammers)):
        pose_hammer(i,0)
    # 只撤掉已被替换路线的生成件，用户额外物件保持。
    current_ids={s['id'] for s in walkable_specs+layout['staticRails']}
    retired_ids=original_layout_ids-current_ids
    retired_objects=[]
    support_pattern=re.compile(r'^(.*?) support \d+ (?:rubber foot|alloy foot|leg|mounting flange|orange collar|anchor(?:\.\d+)?|diagonal brace)$')
    rail_pattern=re.compile(r'^(finish-rail-(?:left|right|north|south|end|back))(?: (?:mount|rivet)(?:\.\d+)?)?$')
    for obj in list(bpy.data.objects):
        support_match=support_pattern.match(obj.name)
        obsolete_support=support_match and (support_match.group(1) in original_layout_ids or support_match.group(1)=='S-bend') and obj not in static
        obsolete_control=any(obj.name==oid or obj.name.startswith(oid+' Graphite chassis control') or obj.name.startswith(oid+' Recessed orange gasket control') for oid in retired_ids)
        rail_match=rail_pattern.match(obj.name)
        obsolete_rail=rail_match and rail_match.group(1) not in current_ids
        if obsolete_support or obsolete_control or obsolete_rail:
            retired_objects.append(obj.name)
            bpy.data.objects.remove(obj,do_unlink=True)
    # 非本轮新增的用户对象保留在其原集合；可见静态额外件也随资源导出。
    for obj in groups['Static structure'].objects:
        if obj.type in ('MESH','FONT') and obj not in static:
            static.append(obj)
    bpy.context.view_layer.update()
    scene['level_id'] = 'water-rush'
    scene['layout_sha256'] = layout_hash
    scene['contract_sha256'] = contract_hash
    scene['stage'] = layout.get('rulesVersion','challenge')+' geometry exported; current gameplay not tested'
    scene['editing'] = 'Current saved scene updated in place; meshes/materials preserved; no backup/version files'
    scene['hammer_reference_pose'] = 'Neutral centered pose for editing; animation previews use independent frequencies/phases'
    latest_layout=json.loads(LAYOUT.read_text())
    assert json.dumps({k:latest_layout.get(k) for k in geometry_keys},sort_keys=True)==geometry_snapshot, '保存前几何已变化'
    assert all(list(bpy.data.materials[name].diffuse_color)==value for name,value in original_materials.items()), '原有材质颜色意外变化'
    if input_hash:
        assert sha(BLEND) == input_hash, '保存前场景有并发修改'
    backup_count = bpy.context.preferences.filepaths.save_version
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.context.preferences.filepaths.save_version = backup_count
    exports = [export_meshes(static, 'TrackStatic', 'water-rush-track.glb')]
    if '--static-only' in sys.argv:
        assert previous and previous['cross_geometry']==cross_spec and previous['lift_centers']==[i['center'] for i in lift['instances']]
        for entry in previous['exports'][1:]:
            assert sha(ROOT/'public/models'/entry['file'])==entry['sha256']
            exports.append(entry)
    else:
        exports.extend([export_meshes(rotating, 'TurntableVisual', 'water-rush-turntable.glb', tc),
                        export_meshes(lift_groups[0], 'LiftVisual', 'water-rush-lift.glb', lift['instances'][0]['center'])])
    for i, parts in enumerate(lift_groups):
        offset = lift['amplitude']*(1 if i%2 == 0 else -1)
        for obj in parts:
            obj.location.z += offset
    # 水仅为本次预览背景，源文件已保存，导出列表也不含水。
    water = bpy.data.materials.new('Preview water')
    water.diffuse_color = (.0176,.1144,.1413,1)
    water.use_nodes = True
    water_shader = next(n for n in water.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    water_shader.inputs['Base Color'].default_value = water.diffuse_color
    water_shader.inputs['Roughness'].default_value = .8
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
    if '--static-only' not in sys.argv:
        turn_matrices={obj:obj.matrix_world.copy() for obj in rotating}
        pivot=Vector(game_position(tc))
        entry_angle=0
        for label,angle in [('entry',entry_angle),('diagonal',math.pi/4),('exit',entry_angle+math.pi)]:
            transform=Matrix.Translation(pivot)@game_rotation([0,math.degrees(angle),0]).to_matrix().to_4x4()@Matrix.Translation(-pivot)
            for obj,matrix in turn_matrices.items():
                obj.matrix_world=transform@matrix
            bpy.context.view_layer.update()
            render_preview([tc[0],3.2,tc[2]],13,ROOT/f'docs/art/water-rush-cross-{label}.png',(10,-14,16))
        for obj,matrix in turn_matrices.items():
            obj.matrix_world=matrix
        bpy.context.view_layer.update()
        center = hammers[1]['anchor']
        front_target = [center[0],3.81,center[2]]
        max_angle = hammers[1]['motion']['maxAngleRadians']
        keep = {o for o in bpy.data.objects if o.name.startswith(hammers[1]['id'])}
        water_obj = bpy.data.objects['Preview water only']
        keep.add(water_obj)
        hidden = {o: o.hide_render for o in bpy.data.objects if o not in keep}
        for obj in hidden:
            obj.hide_render = True
        lane_preview = box('Portal preview lane only',[center[0],3.22,center[2]],[4,.36,3.2],ivory,.065)
        for label,theta in [('middle',0),('left',-max_angle),('right',max_angle)]:
            pose_hammer(1,theta)
            render_preview(front_target,15,ROOT/f'docs/art/water-rush-hammer-{label}.png',(-14,0,0))
        bpy.data.objects.remove(lane_preview,do_unlink=True)
        for obj,value in hidden.items():
            obj.hide_render = value
        pose_hammer(1,0)
        samples=[]
        for sample in range(241):
            t=sample/10
            entry={'time':t,'heads':[]}
            for i,hammer in enumerate(hammers):
                motion=hammer['motion']
                theta=motion['maxAngleRadians']*math.sin(motion['phaseFrequency']*t+motion['phase'])
                entry['heads'].append({'id':hammer['id'],'theta':theta,'center':pose_hammer(i,theta)})
            samples.append(entry)
        preview_t=.8
        for i,hammer in enumerate(hammers):
            motion=hammer['motion']
            pose_hammer(i,motion['maxAngleRadians']*math.sin(motion['phaseFrequency']*preview_t+motion['phase']))
        center_x=sum(h['anchor'][0] for h in hammers)/len(hammers)
        render_preview([center_x,3.81,hammers[0]['anchor'][2]],24,ROOT/'docs/art/water-rush-three-hammers.png',(6,-20,12))
        for i in range(3):
            pose_hammer(i,0)
        (ROOT/'docs/art/water-rush-motion-preview.json').write_text(json.dumps({'design_only':True,'duration':24,'sample_step':.1,'samples':samples},ensure_ascii=False,indent=2)+'\n')
    report = {'blend_sha256': sha(BLEND), 'layout_sha256': layout_hash, 'contract_sha256': contract_hash,
              'stage': scene['stage'], 'units': 'meters', 'coordinates': 'glTF Y-up; Blender (x,-z,y)',
              'static_controls': len(deck_controls), 'static_parts': len(static), 'exports': exports,
              'turntable_origin': tc, 'cross_geometry':cross_spec, 'ports_forced_to_centerline':port_override, 'lift_centers': [i['center'] for i in lift['instances']],
              'lift_stem_min_world_y': lift['centerY']-lift['amplitude']+stem_bottom,
              'lift_sleeve_top_y': sleeve_top, 'lift_sleeve_bottom_y':sleeve_bottom,
              'lift_stem_radius': stem_radius, 'lift_sleeve_inner_radius': sleeve_inner,
              'protected_first_level': protected,
              'preview_note': 'Lifts manually posed at alternating extremes for display only; no gameplay animation exported',
              'input_blend_sha256':input_hash,'preexisting_object_count':len(original_objects),
              'retired_route_objects':retired_objects,'s_bend_segments':len(s_segments),'s_bend_supports':len(s_bend.get('supportPoints',[])),
              'material_values_preserved':True,'hammers':hammers,
              'validation_status': 'Not run this revision per user instruction; export statistics only',
              'pending': ['Restore static refined model reference', 'Current route difficulty not playtested']}
    latest_layout=json.loads(LAYOUT.read_text())
    assert json.dumps({k:latest_layout.get(k) for k in geometry_keys},sort_keys=True)==geometry_snapshot, '制作期间几何变化，需复核当前资源'
    report['build_layout_sha256']=layout_hash
    report['layout_sha256']=sha(LAYOUT)
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
        lift = json.loads(LAYOUT.read_text())['lifts']
        for i, instance in enumerate(lift['instances']):
            for obj in bpy.data.collections['Lift plates'].objects:
                if obj.name.startswith(instance['id']+' '):
                    obj.location.z += lift['amplitude']*(1 if i%2==0 else -1)
        bpy.context.view_layer.update()
        render_preview(center, 16, ROOT / 'docs/art/water-rush-lifts-preview.png', (14,-9,6))
    else:
        prepare_scene()
