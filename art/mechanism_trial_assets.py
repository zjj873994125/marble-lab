"""第三关固定场景；共享机关仅链接作排布参考，不烘入静态GLB。"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/'art'))
import obstacle_library_assets as pieces
import water_rush_assets as assets
from repair_water_rush_surface import replace_white_surface

SOURCE=ROOT/'art/mechanism-trial.blend'
LAYOUT=ROOT/'docs/levels/mechanism-trial-layout.json'
REPORT=ROOT/'art/mechanism-trial-report.json'
GLB=ROOT/'public/models/mechanism-trial-track.glb'

if SOURCE.exists() or GLB.exists():
    raise RuntimeError('Current third-level asset already exists; edit it in place instead of recreating.')
layout=json.loads(LAYOUT.read_text());layout_hash=assets.sha(LAYOUT)
protected={str(p.relative_to(ROOT)):assets.sha(p) for p in [ROOT/'art/obstacle-library.blend',ROOT/'public/models/obstacle-library.glb',ROOT/'public/models/obstacle-library.json',ROOT/'art/water-rush.blend',ROOT/'public/models/water-rush-track.glb',ROOT/'art/track-round-03.blend',ROOT/'public/models/track-round-03.glb']}
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.name='Mechanism trial'
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.world=bpy.data.worlds.new('Trial studio');scene.world.color=(.18,.18,.18)
names=['Ivory polymer','Graphite chassis','Safety terracotta','Brushed alloy','Rubber pads','Printed markings']
with bpy.data.libraries.load(str(ROOT/'art/track-round-03.blend'),link=False) as (_,dst):dst.materials=list(names)
ivory,graphite,orange,alloy,rubber,ink=[bpy.data.materials[n] for n in names]
pieces.ivory,pieces.graphite,pieces.orange,pieces.alloy,pieces.rubber,pieces.ink=ivory,graphite,orange,alloy,rubber,ink
pieces.scene=scene
controls=bpy.data.collections.new('Layout controls');scene.collection.children.link(controls)
static=bpy.data.collections.new('Static structure');scene.collection.children.link(static)
refs=bpy.data.collections.new('Runtime references - not exported');scene.collection.children.link(refs)
pieces.collection=controls
control_root=pieces.empty('LayoutControlRoot')
walkable=[]
for spec in layout['staticDecks']:
    obj=pieces.box(spec['id'],spec['bodyCenter'],spec['bodySize'],ivory,control_root,0)
    obj['layout_id']=spec['id'];walkable.append(obj)
for obj in controls.objects:obj.hide_render=True;obj.hide_set(True)
# 台面、底座、夹层由平面轮廓分别挤出，不使用连续共面布尔链。
layer_specs=[('Ivory continuous deck',3.25,.30,ivory,.045),('Orange seam',3.085,.045,orange,.01),('Graphite underframe',2.95,.24,graphite,.035)]
layer_notes=[]
for name,center_y,height,material,bevel in layer_specs:
    pieces.collection=controls
    layer_controls=[]
    for spec in layout['staticDecks']:
        x,_,z=spec['bodyCenter'];w,_,d=spec['bodySize']
        obj=pieces.box(spec['id']+' '+name+' control',(x,center_y,z),(w,height,d),material,control_root,0)
        obj.hide_render=True;obj.hide_set(True);layer_controls.append(obj)
    pieces.collection=static
    obj=pieces.box(name,layout['staticDecks'][0]['bodyCenter'],layout['staticDecks'][0]['bodySize'],material,None,bevel)
    bpy.context.view_layer.update()
    note=replace_white_surface(obj,layer_controls)
    layer_notes.append({'name':name,'sections':note})

pieces.collection=static
support_root=pieces.empty('Track supports')
for spec in layout['supportPoints']:
    name=spec['id'];x,z=spec['positionXZ'];top=spec['topLimitY']
    pieces.box(name+' rubber',(x,-.34,z),(.76,.12,.76),rubber,support_root,.04)
    pieces.box(name+' alloy shoe',(x,-.23,z),(.68,.10,.68),alloy,support_root,.025)
    pieces.box(name+' leg',(x,(top-.14-.18)/2,z),(.26,top-.14+.18,.26),graphite,support_root,.035)
    pieces.box(name+' flange',(x,top-.07,z),(.68,.14,.50),alloy,support_root,.02)
    pieces.box(name+' collar',(x,.01,z),(.32,.14,.32),orange,support_root,.025)
    pieces.beam(name+' diagonal',(x,top-.72,z),(x+.26,top-.10,z),.075,alloy,support_root)
    for sign in (-1,1):pieces.bolt(name+' anchor '+str(sign),(x+sign*.22,-.16,z),support_root,radius=.042)
rail_root=pieces.empty('Track rails')
for spec in layout['staticRails']:
    x,y,z=spec['bodyCenter'];w,h,d=spec['bodySize'];name=spec['id']
    pieces.box(name,spec['bodyCenter'],spec['bodySize'],orange,rail_root,.035)
    for t in (-.35,0,.35):
        point=(x+t*w if w>d else x,y-.105,z+t*d if d>w else z)
        pieces.box(name+' bracket '+str(t),point,(.16,.05,.16),alloy,rail_root,.008)
        pieces.bolt(name+' fastener '+str(t),(point[0],y+.134,point[2]),rail_root,radius=.028)

# 链接共享库的集合实例，源文件内只保留一套外部机关定义。
with bpy.data.libraries.load(str(ROOT/'art/obstacle-library.blend'),link=True) as (_,dst):
    dst.collections=[s['rootNode'] for s in layout['instances']]
loaded={c.name:c for c in dst.collections}
plinths=[]
for spec in layout['instances']:
    collection=loaded[spec['rootNode']]
    obj=bpy.data.objects.new(spec['id']+' library reference',None);refs.objects.link(obj)
    obj.instance_type='COLLECTION';obj.instance_collection=collection
    obj.location=pieces.gp(spec['position']);obj.rotation_mode='QUATERNION';obj.rotation_quaternion=assets.game_rotation(spec['rotationEulerDegrees'])
    bpy.context.view_layer.update()
    # 各静态脚独立垫到池底；不在活动板下补连续托板。
    for foot in collection.objects:
        if foot.type!='MESH' or not foot.name.endswith(' rubber'):continue
        ps=[obj.matrix_world@foot.matrix_world@Vector(v) for v in foot.bound_box]
        lo=[min(v[i] for v in ps) for i in range(3)];hi=[max(v[i] for v in ps) for i in range(3)]
        if abs(lo[2])>.001:continue
        x,z=(lo[0]+hi[0])/2,-(lo[1]+hi[1])/2
        pieces.box(spec['id']+' foot plinth '+foot.name,(x,-.2,z),(hi[0]-lo[0],.4,hi[1]-lo[1]),graphite,support_root,.025)
        plinths.append({'instance':spec['id'],'foot':foot.name,'center':[x,-.2,z],'size':[hi[0]-lo[0],.4,hi[1]-lo[1]]})

pieces.collection=refs
marking_root=pieces.empty('Runtime marking references')
for label,spec in [('start',layout['start'])]+[(p['id'],p) for p in layout['checkpoints']]+[('finish',layout['finish'])]:
    pieces.tube(label+' ring reference',spec['ringCenter'],spec['ringRadius']+.02,spec['ringRadius']-.02,.012,orange if label in ('start','finish') else alloy,marking_root,'Y',64)
scene['layout_sha256']=layout_hash
scene['status']='Static art layout assembled; mechanisms linked for preview; runtime/physics not tested.'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=58
            area.spaces.active.region_3d.view_location=pieces.gp((-2,3,2))
            area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),relative_remap=True)
export=assets.export_meshes([o for o in static.objects if o.type=='MESH'],'TrackStatic',GLB.name)
report={'source':'art/mechanism-trial.blend','sourceSha256':assets.sha(SOURCE),'layoutSha256':layout_hash,
        'libraryAsset':'obstacle-library.glb','librarySha256':protected['public/models/obstacle-library.glb'],
        'units':'m','upAxis':'+Y','origin':[0,0,0],'rootNode':'TrackStatic','export':export,
        'staticDeckCount':len(layout['staticDecks']),'railCount':len(layout['staticRails']),'supportPointCount':len(layout['supportPoints']),
        'libraryFootPlinths':plinths,'layerConstruction':layer_notes,'instances':[{k:s[k] for k in ('id','rootNode','position','rotationEulerDegrees','scale')} for s in layout['instances']],
        'protectedInputs':protected,'status':'Modeling and export complete; not tested or playtested per user instruction.'}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# 水只在保存和导出完成后加入预览，不写入源文件或GLB。
water=bpy.data.materials.new('Preview water');water.diffuse_color=(.018,.114,.141,1)
water.use_nodes=True
node=next(n for n in water.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs['Base Color'].default_value=water.diffuse_color;node.inputs['Roughness'].default_value=.7
assets.box('Preview water only',[-2,-.11,1],[76,.02,72],water,0)
assets.render_preview([-2,2.3,2],58,ROOT/'docs/art/mechanism-trial-preview.png',(22,-29,33))
assets.render_preview([-2,2.3,2],53,ROOT/'docs/art/mechanism-trial-top.png',(0,0,80))
print('MECHANISM_TRIAL_EXPORTED',json.dumps({'sourceSha256':report['sourceSha256'],'layoutSha256':layout_hash,'export':export,'libraryFootPlinthCount':len(plinths)}))
