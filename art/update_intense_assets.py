"""按已冻结的intense装配数据定向修改现有库/第三关；不重建其他机关。"""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector, Quaternion

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'art'))
import obstacle_library_assets as lib
import water_rush_assets as assets
from repair_water_rush_surface import replace_white_surface


def resize_world(obj, center, size):
    """现有轴对齐零件在局部坐标改尺寸，保留材质和修饰器。"""
    points=[v.co.copy() for v in obj.data.vertices]
    low=[min(v[i] for v in points) for i in range(3)]
    high=[max(v[i] for v in points) for i in range(3)]
    dimensions=(size[0],size[2],size[1])
    for v in obj.data.vertices:
        for i in range(3):v.co[i]=(v.co[i]-(low[i]+high[i])/2)*dimensions[i]/(high[i]-low[i])
    obj.matrix_world=Matrix.Translation(lib.gp(center))


def move_world(obj,center):
    matrix=obj.matrix_world.copy();matrix.translation=lib.gp(center);obj.matrix_world=matrix


def replace_beam(obj,a,b,width):
    start,end=lib.gp(a),lib.gp(b)
    inv=obj.matrix_world.inverted()
    q=(end-start).to_track_quat('Z','Y').to_matrix()
    verts=[q@Vector((x*width/2,y*width/2,z*(end-start).length/2)) for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    mesh=bpy.data.meshes.new(obj.name+' updated')
    mesh.from_pydata(verts,[],[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)])
    for mat in obj.data.materials:mesh.materials.append(mat)
    obj.data=mesh;obj.matrix_world=Matrix.Translation((start+end)/2)


def setup_library(previous):
    lib.scene=bpy.data.scenes['Library assets'];bpy.context.window.scene=lib.scene
    lib.entries=previous['entries'];lib.roots=[bpy.data.objects[e['rootNode']] for e in lib.entries]
    lib.collections=[bpy.data.collections[e['rootNode']] for e in lib.entries]
    lib.context_collection=bpy.data.collections['Assembly references - not exported']
    lib.context_objects=[bpy.data.objects[e['rootNode']+'_Context'] for e in lib.entries]
    lib.parents.clear();lib.leaves.clear()
    for root in lib.roots:
        for o in [root]+list(root.children_recursive):
            if o.type=='EMPTY':
                lib.parents[o.name]=o
                if any(c.type=='MESH' for c in o.children):lib.leaves.append(o)
    for e in lib.entries:
        p=next(p for p in e['parts'] if p['role'] in ('pivot','moving') and not p['nodePath'].endswith('_Rod'))
        e.update(pivotNode=p['nodePath'],pivotPosition=p['position'],axis=p['axis'],bodySize=p['bodySize'],bodyCenterOffset=p['bodyCenterOffset'])


def save_no_backup(path):
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(path))

if __name__=='__main__' and '--library' in sys.argv and '--refinements' not in sys.argv:
    previous=json.loads(lib.MANIFEST.read_text())
    if previous.get('revision','').startswith('intense') and '--finalize' not in sys.argv:
        raise RuntimeError('Intense edit already delivered; do not apply relative moves twice.')
    if lib.sha(lib.SOURCE)!=previous['sourceSha256']:raise RuntimeError('Library source modified concurrently')
    bpy.ops.wm.open_mainfile(filepath=str(lib.SOURCE));setup_library(previous)
    objs=bpy.data.objects;h=3.4+2.5*math.sin(math.radians(25))-.15*math.cos(math.radians(25))
    if '--finalize' not in sys.argv:
        old_h=objs['WeightSeesaw_Pivot'].location.z;delta=h-old_h
        objs['WeightSeesaw_Pivot'].location.z=h;bpy.context.view_layer.update()
        # 三层板/标记收窄，紧固件保留原尺寸移到新板边。
        for obj in list(objs['WeightSeesaw_DeckVisual'].children):
            if obj.name.startswith('Seesaw board'):
                if 'fastener' in obj.name:
                    p=obj.matrix_world.translation;move_world(obj,(math.copysign(.35,p.x),p.z,-p.y))
                else:
                    width=.975 if 'seal' in obj.name else .68 if 'stripe' in obj.name else 1.0
                    lo=min(v.co.x for v in obj.data.vertices);hi=max(v.co.x for v in obj.data.vertices)
                    for v in obj.data.vertices:v.co.x*=width/(hi-lo)
            elif obj.name=='Seesaw moving spindle':
                resize_world(obj,(0,h,0),(2.28,.24,.24))
            elif obj.name.startswith('Seesaw rotating pointer'):
                p=obj.matrix_world.translation;move_world(obj,(math.copysign(.68,p.x),h-.20,0))
        for sign in (-1,1):
            old=sign*1.48;x=sign*.9
            for suffix,size,y in [('rubber',(.64,.12,1),.06),('alloy',(.56,.10,.92),.17)]:
                resize_world(objs['Seesaw shoe '+str(old)+' '+suffix],(x,y,0),size)
            for side in (-1,1):move_world(objs['Seesaw shoe '+str(old)+' bolt '+str(side)],(x+side*.18,.238,0))
            resize_world(objs['Seesaw column '+str(old)],(x,(h-.2+.22)/2,0),(.2,h-.42,.40))
            for prefix,newx,r,length,oldr in [('Seesaw bearing ',x,.20,.18,.245),('Seesaw spring case ',sign*1.08,.24,.14,.29)]:
                obj=objs[prefix+str(old)]
                # 管件保持孔径/外径比例，轴孔仍大于内轴半径。
                lo=[min(v.co[i] for v in obj.data.vertices) for i in range(3)];hi=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
                resize_world(obj,(newx,h,0),(length,r*2,r*2))
                for v in obj.data.vertices:
                    radial=math.hypot(v.co.y,v.co.z)
                    if radial<r*.8:
                        v.co.y*=.13/radial;v.co.z*=.13/radial
            for zsign in (-1,1):replace_beam(objs['Seesaw brace '+str(old)+str(zsign)],(x,.25,zsign*.35),(x,h-.65,zsign*.15),.10)
            for oldangle,newangle in [(-8,-25),(0,0),(8,25)]:
                a=math.radians(newangle);move_world(objs['Seesaw limit mark '+str(old)+str(oldangle)],(sign*1.16,h-.19*math.cos(a),.19*math.sin(a)))
        resize_world(objs['Seesaw lower tie'],(0,.35,0),(1.8,.18,.34))
        resize_world(objs['WeightSeesaw stop carrier'],(0,h-.78,0),(1.55,.16,.25))
        for xsign in (-1,1):
            for zsign in (-1,1):
                oldx=xsign*.84;oldz=zsign*.68;x=xsign*.32;z=zsign*.5045764092256826;y=h-.4559634275387846
                obj=objs['WeightSeesaw limit bumper '+str(oldx)+str(oldz)]
                resize_world(obj,(x,y,z),(.10,.10,.16));obj.rotation_mode='QUATERNION';obj.rotation_quaternion=assets.game_rotation([zsign*25,0,0])
                replace_beam(objs['WeightSeesaw stop bracket '+str(oldx)+str(oldz)],(x,h-.78,0),(x,y-.085,z),.07)
        entry=lib.entries[0];entry['bodySize']=[1,.30,5];entry['pivotPosition']=[0,h,0]
        entry['design'].update(limitAngleDegrees=25,restAngleDegrees=25,candidateMass=1.2,springNmPerRad=4,dampingNmsPerRad=3)
        # 门架仅外移静态立柱和固定角撑，刚性动架及上铰轴不改。
        for label,z in [('Near',2.86),('Far',-2.86)]:
            for sign in (-1,1):
                oldx=sign*2.45;newx=sign*3.8
                for obj in objs['SwayCradleBridge_Gantry'+label].children:
                    if obj.name.startswith('Cradle tower '+label+str(oldx)):
                        matrix=obj.matrix_world.copy();matrix.translation.x+=newx-oldx;obj.matrix_world=matrix
                replace_beam(objs['Cradle corner brace '+label+str(oldx)],(newx,5.4,z),(newx-sign*.65,6.18,z),.11)
            resize_world(objs['Cradle portal '+label],(0,6.28,z),(7.84,.24,.26))
        lib.entries[4]['design'].update(amplitudeDegrees=25,periodSeconds=3,towerX=3.8,movingFrameReservedHalfWidth=3.35)
        # 源文件的岸参考只作装配视图，随新的跷跷板接岸边线调整。
        for sign in (-1,1):
            for obj in lib.context_objects[0].children_recursive:
                if ('bank '+str(sign)) in obj.name or ('bank leg '+str(sign)) in obj.name:
                    matrix=obj.matrix_world.copy();matrix.translation.y+=sign*.17;obj.matrix_world=matrix
    else:
        for name in ('Seesaw rotating pointer -1.35','Seesaw rotating pointer 1.35'):
            obj=objs[name];move_world(obj,(math.copysign(.68,obj.matrix_world.translation.x),h-.20,0))
        resize_world(objs['WeightSeesaw stop carrier'],(0,h-.78,0),(1.55,.16,.25))
    bpy.context.view_layer.update();bpy.context.window.scene=bpy.data.scenes['Library display'];save_no_backup(lib.SOURCE)
    manifest=lib.export_current_library()
    for i in (0,4):
        lib.show_only(i);lib.render(lib.IMAGES/(lib.entries[i]['id']+'.png'),(0,3,0),12,(9,9,13))
        for angle in (25,-25):
            pivot=objs[lib.entries[i]['rootNode']+'_Pivot'];pivot.rotation_mode='QUATERNION';pivot.rotation_quaternion=Quaternion(lib.gp((1,0,0) if i==0 else (0,0,1)),math.radians(angle))
            bpy.context.view_layer.update();lib.show_only(i,True)
            lib.render(lib.IMAGES/(lib.entries[i]['id']+('-positive' if angle>0 else '-negative')+'.png'),(0,3,0),14,(10,9,15))
            pivot.rotation_quaternion=(1,0,0,0)
    print('INTENSE_LIBRARY',manifest['sourceSha256'],manifest['glbSha256'])

if __name__=='__main__' and '--track' in sys.argv:
    path=ROOT/'art/mechanism-trial.blend';report_path=ROOT/'art/mechanism-trial-report.json'
    previous=json.loads(report_path.read_text())
    if assets.sha(path)!=previous['sourceSha256']:raise RuntimeError('Third-level source modified concurrently')
    layout_path=ROOT/'docs/levels/mechanism-trial-layout.json';layout=json.loads(layout_path.read_text())
    bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
    lib.scene=scene;lib.ivory,lib.graphite,lib.orange,lib.alloy,lib.rubber,lib.ink=[bpy.data.materials[n] for n in ['Ivory polymer','Graphite chassis','Safety terracotta','Brushed alloy','Rubber pads','Printed markings']]
    controls=bpy.data.collections['Layout controls'];static=bpy.data.collections['Static structure'];control_root=bpy.data.objects['LayoutControlRoot'];lib.collection=controls
    def control(name,center,size,material):
        obj=bpy.data.objects.get(name)
        if obj:resize_world(obj,center,size)
        else:obj=lib.box(name,center,size,material,control_root,0)
        obj.hide_render=True;obj.hide_set(True);return obj
    for spec in layout['staticDecks']:
        obj=control(spec['id'],spec['bodyCenter'],spec['bodySize'],lib.ivory);obj['layout_id']=spec['id']
    layer_notes=[]
    for name,y,height,material in [('Ivory continuous deck',3.25,.30,lib.ivory),('Orange seam',3.085,.045,lib.orange),('Graphite underframe',2.95,.24,lib.graphite)]:
        items=[]
        for spec in layout['staticDecks']:
            x,_,z=spec['bodyCenter'];w,_,d=spec['bodySize'];items.append(control(spec['id']+' '+name+' control',(x,y,z),(w,height,d),material))
        bpy.context.view_layer.update();layer_notes.append({'name':name,'sections':replace_white_surface(bpy.data.objects[name],items)})
    lib.collection=static;support_root=bpy.data.objects['Track supports']
    for spec in layout['supportPoints']:
        name=spec['id']
        if bpy.data.objects.get(name+' leg'):
            leg=bpy.data.objects[name+' leg'];target=spec['positionXZ'];delta=Vector((target[0]-leg.matrix_world.translation.x,-target[1]-leg.matrix_world.translation.y,0))
            if delta.length>1e-6:
                for part in list(static.objects):
                    if part.name.startswith(name+' '):
                        matrix=part.matrix_world.copy();matrix.translation+=delta;part.matrix_world=matrix
            continue
        x,z=spec['positionXZ'];top=spec['topLimitY']
        lib.box(name+' rubber',(x,-.34,z),(.76,.12,.76),lib.rubber,support_root,.04)
        lib.box(name+' alloy shoe',(x,-.23,z),(.68,.10,.68),lib.alloy,support_root,.025)
        lib.box(name+' leg',(x,(top-.14-.18)/2,z),(.26,top-.14+.18,.26),lib.graphite,support_root,.035)
        lib.box(name+' flange',(x,top-.07,z),(.68,.14,.50),lib.alloy,support_root,.02)
        lib.box(name+' collar',(x,.01,z),(.32,.14,.32),lib.orange,support_root,.025)
        lib.beam(name+' diagonal',(x,top-.72,z),(x+.26,top-.10,z),.075,lib.alloy,support_root)
        for sign in (-1,1):lib.bolt(name+' anchor '+str(sign),(x+sign*.22,-.16,z),support_root,radius=.042)
    bpy.context.view_layer.update();plinths=[]
    for spec in layout['instances']:
        ref=bpy.data.objects[spec['id']+' library reference']
        for foot in ref.instance_collection.objects:
            if foot.type!='MESH' or not foot.name.endswith(' rubber'):continue
            points=[ref.matrix_world@foot.matrix_world@Vector(v) for v in foot.bound_box]
            lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)]
            if abs(lo[2])>.001:continue
            center=[(lo[0]+hi[0])/2,-.2,-(lo[1]+hi[1])/2];size=[hi[0]-lo[0],.4,hi[1]-lo[1]]
            obj=bpy.data.objects[spec['id']+' foot plinth '+foot.name]
            if spec['mechanismId'] in ('weight-seesaw','sway-cradle-bridge'):resize_world(obj,center,size)
            plinths.append({'instance':spec['id'],'foot':foot.name,'center':center,'size':size})
    scene['layout_sha256']=assets.sha(layout_path);save_no_backup(path)
    result=assets.export_meshes([o for o in static.objects if o.type=='MESH'],'TrackStatic','mechanism-trial-track.glb')
    previous.update(sourceSha256=assets.sha(path),layoutSha256=assets.sha(layout_path),currentLayoutMetadataSha256=assets.sha(layout_path),export=result,
        staticDeckCount=len(layout['staticDecks']),supportPointCount=len(layout['supportPoints']),layerConstruction=layer_notes,libraryFootPlinths=plinths,librarySha256=assets.sha(lib.ASSET))
    previous['revision']='intense: narrow25deg seesaw, widened25deg cradle gantries and shores; no tests/playtest'
    report_path.write_text(json.dumps(previous,ensure_ascii=False,indent=2)+'\n')
    water=bpy.data.materials.new('Intense preview water');water.diffuse_color=(.018,.114,.141,1);water.use_nodes=True
    shader=next(n for n in water.node_tree.nodes if n.type=='BSDF_PRINCIPLED');shader.inputs['Base Color'].default_value=water.diffuse_color
    assets.box('Intense preview water only',[-2,-.11,1],[76,.02,72],water,0)
    assets.render_preview([-2,2.3,2],58,ROOT/'docs/art/mechanism-trial-preview.png',(22,-29,33))
    assets.render_preview([-2,2.3,2],53,ROOT/'docs/art/mechanism-trial-top.png',(0,0,80))
    print('INTENSE_TRACK',previous['sourceSha256'],json.dumps(result))

if __name__=='__main__' and '--library' in sys.argv and '--refinements' in sys.argv:
    previous=json.loads(lib.MANIFEST.read_text())
    if previous.get('revision')=='intense-v2':raise RuntimeError('This revision already applied; preserve current library.')
    if lib.sha(lib.SOURCE)!=previous['sourceSha256']:raise RuntimeError('Concurrent library edit')
    layout_path=ROOT/'docs/levels/mechanism-trial-layout.json';layout=json.loads(layout_path.read_text())
    reqs={s['mechanismId']:s.get('refinementAssetRequirements',s.get('intenseAssetRequirements')) for s in layout['instances']}
    req=reqs['weight-seesaw']
    if req['bodySize']!=[.7,.30,7]:raise RuntimeError('Waiting for the frozen long-board layout')
    bpy.ops.wm.open_mainfile(filepath=str(lib.SOURCE));setup_library(previous)
    objs=bpy.data.objects;h=3.4+3.5*math.sin(math.radians(25))-.15*math.cos(math.radians(25));old_h=objs['WeightSeesaw_Pivot'].location.z
    objs['WeightSeesaw_Pivot'].location.z=h;bpy.context.view_layer.update()
    for obj in list(objs['WeightSeesaw_DeckVisual'].children):
        p=obj.matrix_world.translation
        if obj.name.startswith('Seesaw board'):
            if 'fastener' in obj.name:move_world(obj,(math.copysign(.20,p.x),p.z,math.copysign(3.37,-p.y)))
            elif 'stripe' in obj.name:resize_world(obj,(0,p.z,math.copysign(3.26,-p.y)),(.38,.003,.10))
            else:
                width=.675 if 'seal' in obj.name else .7
                length=6.975 if 'seal' in obj.name else 7
                height=max(v.co.z for v in obj.data.vertices)-min(v.co.z for v in obj.data.vertices)
                resize_world(obj,(0,p.z,0),(width,height,length))
        elif obj.name=='Seesaw moving spindle':resize_world(obj,(0,h,0),(1.98,.24,.24))
        elif obj.name.startswith('Seesaw rotating pointer'):move_world(obj,(math.copysign(.53,p.x),h-.20,0))
    for sign in (-1,1):
        key=sign*1.48;x=sign*.75
        for suffix,size,y in [('rubber',(.54,.12,1),.06),('alloy',(.46,.10,.92),.17)]:resize_world(objs['Seesaw shoe '+str(key)+' '+suffix],(x,y,0),size)
        for side in (-1,1):move_world(objs['Seesaw shoe '+str(key)+' bolt '+str(side)],(x+side*.13,.238,0))
        resize_world(objs['Seesaw column '+str(key)],(x,(h-.2+.22)/2,0),(.2,h-.42,.40))
        move_world(objs['Seesaw bearing '+str(key)],(x,h,0));move_world(objs['Seesaw spring case '+str(key)],(sign*.93,h,0))
        for zsign in (-1,1):replace_beam(objs['Seesaw brace '+str(key)+str(zsign)],(x,.25,zsign*.35),(x,h-.65,zsign*.15),.10)
        for oldangle,newangle in [(-8,-25),(0,0),(8,25)]:
            a=math.radians(newangle);move_world(objs['Seesaw limit mark '+str(key)+str(oldangle)],(sign*1.01,h-.19*math.cos(a),.19*math.sin(a)))
    resize_world(objs['Seesaw lower tie'],(0,.35,0),(1.5,.18,.34));resize_world(objs['WeightSeesaw stop carrier'],(0,h-.78,0),(1.25,.16,.25))
    for xsign in (-1,1):
        for zsign in (-1,1):
            oldx=xsign*.84;oldz=zsign*.68;x=xsign*.22;z=zsign*.5045764092256826;y=h-.4559634275387846
            obj=objs['WeightSeesaw limit bumper '+str(oldx)+str(oldz)];resize_world(obj,(x,y,z),(.10,.10,.16));obj.rotation_mode='QUATERNION';obj.rotation_quaternion=assets.game_rotation([zsign*25,0,0])
            replace_beam(objs['WeightSeesaw stop bracket '+str(oldx)+str(oldz)],(x,h-.78,0),(x,y-.085,z),.07)
    lib.entries[0]['bodySize']=[.7,.3,7];lib.entries[0]['pivotPosition']=[0,h,0]
    lib.entries[0]['design']['assemblyRequirements']=req
    lib.entries[0]['design'].update(candidateMass=.65,springNmPerRad=4,dampingNmsPerRad=3)
    # 保留其余三个机制和所有活动U架网格，只外移固定门架。
    for label,z in [('Near',2.86),('Far',-2.86)]:
        for sign in (-1,1):
            for obj in objs['SwayCradleBridge_Gantry'+label].children:
                if obj.name.startswith('Cradle tower '+label+str(sign*2.45)):
                    matrix=obj.matrix_world.copy();matrix.translation.x+=sign*.55;obj.matrix_world=matrix
            replace_beam(objs['Cradle corner brace '+label+str(sign*2.45)],(sign*4.35,5.4,z),(sign*3.70,6.18,z),.11)
        resize_world(objs['Cradle portal '+label],(0,6.28,z),(8.94,.24,.26))
    lib.entries[4]['design'].update(amplitudeDegrees=45,periodSeconds=3,towerX=4.35,movingFrameReservedHalfWidth=3.9,assemblyRequirements=reqs['sway-cradle-bridge'])
    # 未导出的独立装配参考按新岸宽/边线放置。
    for sign in (-1,1):
        for obj in lib.context_objects[0].children_recursive:
            if ('bank '+str(sign)) in obj.name or ('bank leg '+str(sign)) in obj.name:
                matrix=obj.matrix_world.copy();matrix.translation.y-=sign*.91;obj.matrix_world=matrix
        for obj in lib.context_objects[4].children:
            if 'bank '+str(sign) in obj.name and 'fastener' not in obj.name:
                # 只扩展参考台面各层/标线；支撑位置留在岸内。
                p=obj.matrix_world.translation
                if obj.type=='MESH':
                    oldwidth=max(v.co.x for v in obj.data.vertices)-min(v.co.x for v in obj.data.vertices)
                    width=6.48 if 'stripe' in obj.name else 6.775 if 'seal' in obj.name else 6.8
                    for v in obj.data.vertices:v.co.x*=width/oldwidth
    bpy.context.view_layer.update();bpy.context.window.scene=bpy.data.scenes['Library display'];save_no_backup(lib.SOURCE)
    manifest=lib.export_current_library();manifest.update(revision='intense-v2',geometrySource='docs/levels/mechanism-trial-layout.json',geometrySourceSha256=assets.sha(layout_path))
    lib.MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    for i,maxangle in [(0,25),(4,45)]:
        lib.show_only(i);lib.render(lib.IMAGES/(lib.entries[i]['id']+'.png'),(0,3,0),14,(9,9,13))
        for angle in (maxangle,-maxangle):
            pivot=objs[lib.entries[i]['rootNode']+'_Pivot'];pivot.rotation_mode='QUATERNION';pivot.rotation_quaternion=Quaternion(lib.gp((1,0,0) if i==0 else (0,0,1)),math.radians(angle))
            bpy.context.view_layer.update();lib.show_only(i,True);lib.render(lib.IMAGES/(lib.entries[i]['id']+('-positive' if angle>0 else '-negative')+'.png'),(0,3,0),16,(10,9,15));pivot.rotation_quaternion=(1,0,0,0)
    print('REFINEMENTS_LIBRARY',manifest['sourceSha256'],manifest['glbSha256'])
