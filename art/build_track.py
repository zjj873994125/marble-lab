"""后台新建轨道外观资源；不读取或修改用户正在编辑的 Blender 场景。"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def material(name, color, roughness=.4, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = tuple(linear(int(color[i:i+2],16)/255) for i in (0,2,4)) + (1,)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = m.diffuse_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metal
    return m

ivory = material('Ivory polymer','dedbd0',.34)
slate = material('Graphite chassis','344b50',.4,.18)
orange = material('Safety terracotta','d96836',.32)
aluminum = material('Brushed alloy','9baaaa',.3,.62)
rubber = material('Rubber pads','293334',.75)
ink = material('Printed markings','617477',.65)
blue = material('Platform enamel','729eaa',.34)
static = []
platform_parts = []

# glTF 的 Y-up 与 Blender Z-up 对应；导出后坐标与游戏碰撞体完全一致。
def position(p): return (p[0], -p[2], p[1])
def bevel(obj, width=.05, segments=3):
    mod=obj.modifiers.new('Machined edge radius','BEVEL'); mod.width=width; mod.segments=segments
    mod=obj.modifiers.new('Weighted face normals','WEIGHTED_NORMAL'); mod.keep_sharp=True; mod.weight=50
    for poly in obj.data.polygons: poly.use_smooth=True

def box(name, p, size, mat, radius=.03, group=static):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position(p))
    o=bpy.context.object; o.name=name
    o.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if radius: bevel(o,min(radius,min(size)*.4))
    group.append(o); return o

def cylinder(name,p,radius,height,mat,group=static):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=radius,depth=height,location=position(p))
    o=bpy.context.object; o.name=name; o.data.materials.append(mat); bevel(o,min(.016,height*.2),2)
    group.append(o); return o

def beam(name,a,b,width,mat,group=static):
    va,vb=Vector(position(a)),Vector(position(b))
    o=box(name,[0,0,0],[width,(vb-va).length,width],mat,width*.2,group)
    o.location=(va+vb)/2; o.rotation_euler=(vb-va).to_track_quat('Z','Y').to_euler(); return o

def text(name,value,p,size=.22,mat=ink,rotate=0,group=static):
    curve=bpy.data.curves.new(name,'FONT'); curve.body=value; curve.size=size; curve.align_x='CENTER'; curve.align_y='CENTER'
    curve.extrude=0; curve.resolution_u=2
    o=bpy.data.objects.new(name,curve); scene.collection.objects.link(o); o.location=position(p); o.rotation_euler.z=math.radians(rotate)
    o.data.materials.append(mat); group.append(o); return o

decks=[(-10,1.5,3,14),(-5.5,-4,9,3),(-1,.5,2.1,9),(3.5,5,9,3),(8,3.2,3,3.6),(8,-3.5,3,3),(11.5,-5,7,3),(15,-5,4,4),(-10,7,4,4)]
def joined_deck(name,y,h,extra,mat,radius):
    parts=[box(f'{name} part {i}',[x,y,z],[w+extra,h,d+extra],mat,0,[]) for i,(x,z,w,d) in enumerate(decks)]
    obj=parts[0]; obj.name=name
    for part in parts[1:]:
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new('Continuous junction','BOOLEAN'); mod.operation='UNION'; mod.solver='EXACT'; mod.object=part
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(part,do_unlink=True)
    bevel(obj,radius); static.append(obj)
    return obj

joined_deck('Continuous rounded riding surface',3.22,.36,0,ivory,.065)
joined_deck('Dark structural underside',2.94,.22,.08,slate,.06)
joined_deck('Recessed orange gasket',3.075,.045,.015,orange,.015)

# 支撑有脚垫、法兰与横向加强件，全部在原有行驶面下方。
supports=[(-10,7.7),(-10,2),(-10,-4),(-5,-4),(-1,-3),(-1,3.5),(3.5,5),(8,4.5),(8,-3.6),(11.3,-5),(15.7,-5)]
for i,(x,z) in enumerate(supports):
    box(f'Foot rubber {i}',[x,-.34,z],[.95,.12,.95],rubber,.05)
    box(f'Foot alloy {i}',[x,-.23,z],[.8,.12,.8],aluminum,.035)
    box(f'Support leg {i}',[x,1.2,z],[.36,2.8,.36],slate,.06)
    box(f'Top mounting plate {i}',[x,2.72,z],[1.0,.15,.7],aluminum,.035)
    box(f'Orange collar {i}',[x,.02,z],[.4,.13,.4],orange,.03)
    for dx in [-.27,.27]:
        cylinder(f'Foot anchor {i}',[x+dx,-.155,z],.055,.04,slate)
    beam(f'Brace {i}',[x,2.05,z],[x+.62,2.64,z],.1,aluminum)

def rail(name,x,z,w,d,mat):
    box(name,[x,3.53,z],[w,.26,d],mat,.048)
    length=max(w,d)
    for t in [-.4,0,.4]:
        px=x+(length*t if w>d else 0); pz=z+(length*t if d>w else 0)
        box(f'{name} mount',[px,3.415,pz],[.22,.055,.22],aluminum,.015)
        cylinder(f'{name} rivet',[px,3.672,pz],.035,.024,slate)

for x in [-11.55,-8.45]: rail('Start guide',x,2,.12,10,orange)
for z in [-5.55,-2.45]: rail('Corner guide',-5.8,z,5.8,.12,orange)
for z in [3.45,6.55]: rail('Bridge guide',3.5,z,5.8,.12,blue)

# 拼接缝采用薄层印刷，不抬高行驶面或增加新的碰撞障碍。
for z in [-2,1,4]:
    box('Deck joint',[-10,3.402,z],[2.78,.004,.025],ink,.0)
    for x in [-11.1,-8.9]: cylinder('Flush fastener',[x,3.405,z+.15],.065,.01,aluminum)
for x in [-7,-4]: box('Corner panel joint',[x,3.402,-4],[.025,.004,2.6],ink,0)
for z in [-2,1,3]: box('Narrow panel joint',[-1,3.402,z],[1.95,.004,.025],ink,0)
for x in [1,4,6]: box('Bridge panel joint',[x,3.402,5],[.025,.004,2.65],ink,0)
for z in [-1.8,0,1.8,3.6]:
    for x in [-1.89,-.11]: box('Narrow caution dash',[x,3.405,z],[.085,.008,.7],orange,0)
text('Start identifier','START  /  01',[-10,3.405,8.45],.27)
text('Narrow identifier','02',[-1,3.407,-3.0],.32)
text('Platform identifier','03',[8,3.407,6],.32)
text('Finish identifier','FINISH',[16.25,3.407,-5],.25,rotate=90)

# 在车道边缘使用小方向箭头，保留检查点的可见范围。
for z in [4,1,-1.5]:
    for dx,ang in [(-.13,-40),(.13,40)]:
        o=box('Forward arrow',[-10+dx,3.405,z],[.08,.008,.38],ink,0); o.rotation_euler.z=math.radians(ang)

for x in [-6.3,-4.7]:
    box('Pendulum tower',[x,5.7,-5.6],[.16,4.6,.16],slate,.035)
    box('Pendulum tower shoe',[x,3.39,-5.6],[.45,.25,.45],aluminum,.06)
box('Pendulum bearing beam',[-5.5,7.9,-5.6],[2,.2,.3],slate,.06)
cylinder('Bearing head',[-5.5,8.06,-5.6],.23,.16,orange)

for z in [-6.65,-3.35]:
    box('Finish column',[15,4.9,z],[.12,3,.12],orange,.035)
    box('Finish column shoe',[15,3.425,z],[.38,.05,.38],slate,.05)
box('Finish arch',[15,6.4,-5],[.18,.25,3.6],orange,.06)

# 动平台单独导出，以原始刚体中心为原点，运行时仅替换显示模型。
box('Platform rounded deck',[0,0,0],[3,.36,2.9],blue,.065,platform_parts)
box('Platform belly',[0,-.3,0],[2.82,.24,2.75],slate,.055,platform_parts)
for x in [-1.33,1.33]: box('Platform safety edge',[x,.185,0],[.14,.01,2.56],orange,0,platform_parts)
for z in [-.95,.95]: box('Platform seam',[0,.184,z],[2.5,.006,.025],ink,0,platform_parts)
for x in [-1.1,1.1]:
    for z in [-1.1,1.1]: cylinder('Platform bolt',[x,.184,z],.06,.014,aluminum,platform_parts)
text('Platform label','TRANSFER',[0,.185,.65],.17,ivory,group=platform_parts)

for obj in bpy.data.objects: obj.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/track-refined.blend'))

# 保留 .blend 中的可编辑零件，导出副本按整体合并，减少运行时提交批次。
def export_group(objects,name,path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    combined=bpy.context.object; combined.name=name
    scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    combined.data.calc_loop_triangles()
    triangles=len(combined.data.loop_triangles)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_texcoords=False)
    return {'triangles':triangles,'bytes':path.stat().st_size,'materials':len(combined.data.materials)}

output=ROOT/'public/models'; output.mkdir(parents=True,exist_ok=True)
report={
    'static': export_group(static,'TrackStatic',output/'track-refined.glb'),
    'platform': export_group(platform_parts,'PlatformVisual',output/'platform-refined.glb'),
    'units':'meters', 'coordinateSystem':'glTF Y-up', 'topSurface':3.4,
    'collision':'Provided by existing PlayCanvas runtime; unchanged',
}
(ROOT/'art/track-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('TRACK_REPORT',json.dumps(report))
