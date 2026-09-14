"""五机关同包建模；仅制作外观、刚性层级与预览，不接入玩法。"""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'art/obstacle-library.blend'
ASSET = ROOT/'public/models/obstacle-library.glb'
MANIFEST = ROOT/'public/models/obstacle-library.json'
IMAGES = ROOT/'docs/art/obstacle-library'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
BASIS = Matrix(((1,0,0),(0,0,-1),(0,1,0)))
gp = lambda p: BASIS@Vector(p)
parents = {}
leaves = []
roots = []
collections = []
entries = []
context_objects = []


def empty(name, parent=None, position=(0,0,0), leaf=False):
    obj=bpy.data.objects.new(name,None)
    collection.objects.link(obj)
    obj.empty_display_type='PLAIN_AXES'
    obj.empty_display_size=.3
    obj.parent=parent
    obj.location=gp(position)
    parents[name]=obj
    if leaf: leaves.append(obj)
    return obj


def move_mesh(obj,name,group,material,bevel=0):
    obj.name=name
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection.objects.link(obj)
    matrix=obj.matrix_world.copy()
    obj.parent=group
    obj.matrix_world=matrix
    obj.data.materials.append(material)
    if bevel:
        m=obj.modifiers.new('Machined edge','BEVEL');m.width=bevel;m.segments=2
        m=obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL');m.keep_sharp=True
    for face in obj.data.polygons: face.use_smooth=True
    return obj


def box(name,pos,size,mat,group,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=gp(pos))
    obj=bpy.context.object
    obj.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return move_mesh(obj,name,group,mat,min(bevel,min(size)/4))


def cylinder(name,pos,radius,length,mat,group,axis='Y',bevel=.01,segments=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=radius,depth=length,location=gp(pos))
    obj=bpy.context.object
    direction={'X':(1,0,0),'Y':(0,1,0),'Z':(0,0,1)}[axis]
    obj.rotation_mode='QUATERNION';obj.rotation_quaternion=gp(direction).to_track_quat('Z','Y')
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return move_mesh(obj,name,group,mat,bevel)


def tube(name,pos,outer,inner,length,mat,group,axis='Y',segments=32):
    # 中空轴承与缸口保留真实孔洞；轴与座在各自分组内独立。
    vertices=[]
    direction={'X':Vector((1,0,0)),'Y':Vector((0,1,0)),'Z':Vector((0,0,1))}[axis]
    u=Vector((0,1,0)) if axis=='X' else Vector((1,0,0))
    v=direction.cross(u)
    for d,r in ((-length/2,outer),(length/2,outer),(-length/2,inner),(length/2,inner)):
        for i in range(segments):
            a=i*math.tau/segments
            vertices.append(gp(Vector(pos)+direction*d+r*(u*math.cos(a)+v*math.sin(a))))
    faces=[]
    n=segments
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,n+j,n+i),(2*n+j,2*n+i,3*n+i,3*n+j),(n+i,n+j,3*n+j,3*n+i),(j,i,2*n+i,2*n+j)])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    return move_mesh(obj,name,group,mat,0)


def beam(name,a,b,width,mat,group):
    start,end=gp(a),gp(b)
    bpy.ops.mesh.primitive_cube_add(size=1,location=(start+end)/2)
    obj=bpy.context.object
    obj.dimensions=(width,width,(end-start).length)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.rotation_mode='QUATERNION';obj.rotation_quaternion=(end-start).to_track_quat('Z','Y')
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return move_mesh(obj,name,group,alloy if mat is None else mat,.012)


def bolt(name,pos,group,axis='Y',radius=.05):
    cylinder(name,pos,radius,.035,graphite,group,axis,.004,12)


def foot(name,x,z,group,width=.8,depth=.8):
    box(name+' rubber',(x,.06,z),(width,.12,depth),rubber,group,.035)
    box(name+' alloy',(x,.17,z),(width-.08,.10,depth-.08),alloy,group,.025)
    for side in (-1,1): bolt(name+' bolt '+str(side),(x+side*(width/2-.14),.238,z),group)


def column(name,x,z,height,group,width=.28):
    foot(name,x,z,group)
    box(name+' column',(x,(height+.22)/2,z),(width,height-.22,width),graphite,group)
    box(name+' orange shoe',(x,.36,z),(width+.08,.18,width+.08),orange,group)


def deck(name,pos,size,group):
    # 三层总厚仍在给定盒内，装饰不把碰撞主体撑大。
    x,y,z=pos;w,h,d=size
    box(name+' graphite',(x,y-h*.34,z),(w,h*.32,d),graphite,group,.035)
    box(name+' seal',(x,y-h*.12,z),(w-.025,h*.12,d-.025),orange,group,.012)
    box(name+' ivory',(x,y+h*.20,z),(w,h*.60,d),ivory,group,.045)
    for sign in (-1,1):
        box(name+' end stripe '+str(sign),(x,y+h/2+.0015,z+sign*(d/2-.24)),(w-.32,.003,.10),orange,group,.001)
    for xsign in (-1,1):
        for zsign in (-1,1):
            bolt(name+' fastener '+str(xsign)+str(zsign),(x+xsign*(w/2-.15),y+h/2+.008,z+zsign*(d/2-.13)),group,radius=.033)


def module(id,name,pivot_name,pivot,axis,body_size,body_offset=(0,0,0)):
    global collection
    collection=bpy.data.collections.new(name)
    scene.collection.children.link(collection);collections.append(collection)
    root=empty(name);roots.append(root)
    fixed=empty(name+'_Static',root)
    motion=empty(name+'_'+pivot_name,root,pivot)
    motion['axis_game']=axis
    entries.append({'id':id,'rootNode':name,'restPose':'neutral-horizontal','bodySize':body_size,'pivotNode':motion.name,
                    'pivotPosition':pivot,'axis':axis,'bodyCenterOffset':body_offset})
    bpy.context.view_layer.update()
    return root,fixed,motion


def group(name,parent,pos=(0,0,0)):
    obj=empty(name,parent,pos,True)
    bpy.context.view_layer.update()
    return obj


def island_context(name,edge,width=3.6):
    global collection
    old=collection;collection=context_collection
    holder=empty(name+'_Context')
    for side in (-1,1):
        z=side*(edge+1.8)
        deck(name+' bank '+str(side),(0,3.22,z),(width,.36,3.6),holder)
        for x in (-width*.32,width*.32):
            column(name+' bank leg '+str(side)+str(x),x,z,3.0,holder,.22)
    context_objects.append(holder)
    collection=old


def render(path,target,scale,offset=(9,11,14)):
    camera_data=bpy.data.cameras.new('PreviewCamera');cam=bpy.data.objects.new('PreviewCamera',camera_data)
    scene.collection.objects.link(cam)
    cam.location=gp(Vector(target)+Vector(offset));cam.rotation_euler=(gp(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type='ORTHO';scene.camera=cam
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    points=[o.evaluated_get(graph).matrix_world@Vector(v) for o in scene.objects if o.type=='MESH' and not o.hide_render for v in o.evaluated_get(graph).bound_box]
    if points:
        center=Vector([(min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)])
        cam.location=center+gp(offset)
        inverse=cam.rotation_euler.to_matrix().transposed()
        projected=[inverse@(p-center) for p in points]
        xspan=max(p.x for p in projected)-min(p.x for p in projected)
        yspan=max(p.y for p in projected)-min(p.y for p in projected)
        scale=max(xspan,yspan*1400/1100)*1.16
    camera_data.ortho_scale=scale
    lights=[]
    for label,pos,power,size in [('Key',(-8,13,8),2400,9),('Fill',(7,9,-5),1600,8),('Rim',(-5,7,-9),1900,6)]:
        data=bpy.data.lights.new(label,'AREA');data.energy=power;data.shape='DISK';data.size=size
        light=bpy.data.objects.new(label,data);scene.collection.objects.link(light);light.location=gp(Vector(target)+Vector(pos))
        light.rotation_euler=(gp(target)-light.location).to_track_quat('-Z','Y').to_euler();lights.append(light)
    scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True;scene.render.filepath=str(path)
    if not scene.world:scene.world=bpy.data.worlds.new('Library studio')
    scene.world.color=(.22,.22,.22)
    scene.view_settings.view_transform='AgX'
    bpy.ops.render.render(write_still=True)
    scene.camera=None
    for o in lights+[cam]:
        data=o.data;bpy.data.objects.remove(o,do_unlink=True)
        if isinstance(data,bpy.types.Camera):bpy.data.cameras.remove(data)
        else:bpy.data.lights.remove(data)


def show_only(index,with_context=False):
    for i,c in enumerate(collections):
        for obj in c.objects: obj.hide_render=i!=index
    for obj in context_collection.objects: obj.hide_render=True
    if with_context:
        holder=context_objects[index]
        holder.hide_render=False
        for obj in holder.children_recursive: obj.hide_render=False


def parse_export():
    raw=ASSET.read_bytes();size=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+size])
    def node_matrix(n):
        t=Matrix.Translation(n.get('translation',(0,0,0)))
        from mathutils import Quaternion
        q=n.get('rotation',(0,0,0,1));r=Quaternion((q[3],q[0],q[1],q[2])).to_matrix().to_4x4()
        return t@r@Matrix.Diagonal((*n.get('scale',(1,1,1)),1))
    def stats(idx,relative=True):
        points=[];materials=set();triangles=0;views=set()
        def visit(i,matrix):
            nonlocal triangles
            n=data['nodes'][i]
            if 'mesh' in n:
                for p in data['meshes'][n['mesh']]['primitives']:
                    for accessor_index in list(p['attributes'].values())+[p['indices']]:
                        views.add(data['accessors'][accessor_index]['bufferView'])
                    a=data['accessors'][p['attributes']['POSITION']]
                    lo,hi=a['min'],a['max']
                    for x in (lo[0],hi[0]):
                        for y in (lo[1],hi[1]):
                            for z in (lo[2],hi[2]):points.append(matrix@Vector((x,y,z)))
                    triangles+=data['accessors'][p['indices']]['count']//3
                    materials.add(p['material'])
            for child in n.get('children',[]):visit(child,matrix@node_matrix(data['nodes'][child]))
        visit(idx,Matrix.Identity(4))
        lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
        return {'bounds':{'min':lo,'max':hi},'dimensions':[hi[i]-lo[i] for i in range(3)],'triangles':triangles,'materials':len(materials),'geometryBufferBytes':sum(data['bufferViews'][i]['byteLength'] for i in views)}
    def paths(idx,prefix=''):
        result=[]
        for child in data['nodes'][idx].get('children',[]):
            node=data['nodes'][child];path=prefix+node['name']
            result.append((path,child));result.extend(paths(child,path+'/'))
        return result
    for entry in entries:
        idx=next(i for i,n in enumerate(data['nodes']) if n['name']==entry['rootNode'])
        s=stats(idx);entry['rootBounds']=s.pop('bounds');entry['statistics']=s
        entry['parts']=[]
        for path,i in paths(idx):
            n=data['nodes'][i];motion=n['name']==entry['pivotNode'];is_static=n['name'].endswith('_Static')
            part={'nodePath':path,'role':('moving' if entry['id']=='piston-wall' else 'pivot') if motion else 'static' if is_static else 'visual',
                  'position':n.get('translation',[0,0,0]),'rotationDegrees':[0,0,0],'scale':n.get('scale',[1,1,1])}
            if motion:part.update(axis=entry['axis'],bodySize=entry['bodySize'],bodyCenterOffset=entry['bodyCenterOffset'])
            if n['name']=='PistonWall_Rod':part.update(role='moving',extensionAxis=[1,0,0],referenceLength=.3,collisionRadius=.08)
            if n['name']=='PistonWall_RodShaft':part.update(extensionAxis=[1,0,0],referenceLength=.3)
            part['statistics']=stats(i)
            entry['parts'].append(part)
        for k in ('bodySize','pivotNode','pivotPosition','axis','bodyCenterOffset'):entry.pop(k)
    manifest={'schemaVersion':1,'asset':ASSET.name,'units':'m','upAxis':'+Y','forwardAxis':'-Z','referenceDeckY':3.4,
              'glbSha256':sha(ASSET),'source':'art/obstacle-library.blend','sourceSha256':sha(SOURCE),
              'contractSha256':sha(ROOT/'docs/integration/obstacle-library-contract.md'),'designSourceSha256':sha(ROOT/'docs/levels/new-obstacles.md'),
              'runtimeSupported':False,'statistics':{'bytes':len(raw),'triangles':sum(e['statistics']['triangles'] for e in entries),
              'materials':len(data['materials']),'meshCount':len(data['meshes']),'materialNames':[m['name'] for m in data['materials']]},
              'entries':entries,'validation':'Model/export statistics only; no automatic tests, runtime loading or physics playtest.'}
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    return manifest


def export_current_library():
    # 导出时每个语义叶组临时合并；不同机关和活动节点始终保持独立。
    bpy.context.window.scene=scene
    export_scene=bpy.data.scenes.new('Export temporary')
    clones={}
    leaf_set=set(leaves)
    dg=bpy.context.evaluated_depsgraph_get()
    for original in list(parents.values()):
        if original in context_objects:continue
        if original.name.endswith('_Context'):continue
        ancestor=original
        while ancestor.parent:ancestor=ancestor.parent
        if ancestor not in roots:continue
        if original in leaf_set:
            vertices=[];faces=[];mats=[];mi=[];smooth=[]
            inv=original.matrix_world.inverted()
            for child in original.children_recursive:
                if child.type!='MESH':continue
                obj=child.evaluated_get(dg);mesh=obj.to_mesh();mesh.calc_loop_triangles();offset=len(vertices)
                vertices.extend(inv@obj.matrix_world@v.co for v in mesh.vertices)
                for t in mesh.loop_triangles:
                    faces.append(tuple(offset+i for i in t.vertices))
                    material=mesh.materials[t.material_index]
                    if material not in mats:mats.append(material)
                    mi.append(mats.index(material));smooth.append(mesh.polygons[t.polygon_index].use_smooth)
                obj.to_mesh_clear()
            mesh=bpy.data.meshes.new(original.name+' export');mesh.from_pydata(vertices,[],faces);mesh.update()
            for mat in mats:mesh.materials.append(mat)
            for face,idx,sm in zip(mesh.polygons,mi,smooth):face.material_index=idx;face.use_smooth=sm
            mesh.validate(verbose=False)
            clone=bpy.data.objects.new(original.name,mesh)
        else:clone=bpy.data.objects.new(original.name,None)
        export_scene.collection.objects.link(clone);clones[original]=clone
        # 名字与源对象冲突时，导出前暂时移开源名，导出结束后恢复。
        original.name=original.name+' source'
        clone.name=original.name[:-7]
        clone.matrix_local=original.matrix_local.copy()
        if original.parent in clones:clone.parent=clones[original.parent]
    bpy.context.window.scene=export_scene
    bpy.ops.export_scene.gltf(filepath=str(ASSET),export_format='GLB',export_apply=True,export_animations=False,
        export_cameras=False,export_lights=False,export_texcoords=False,export_extras=False,use_active_scene=True)
    manifest=parse_export()
    print('LIBRARY_EXPORTED',json.dumps({'sourceSha256':manifest['sourceSha256'],'glbSha256':manifest['glbSha256'],'statistics':manifest['statistics'],'entries':[{k:e[k] for k in ('id','rootNode','statistics')} for e in entries]}))
    bpy.context.window.scene=scene
    for original,clone in clones.items():
        name=clone.name;bpy.data.objects.remove(clone,do_unlink=True);original.name=name
    bpy.data.scenes.remove(export_scene)
    return manifest


if __name__=='__main__':
    if '--finish-current' in sys.argv:
        previous=json.loads(MANIFEST.read_text())
        if previous.get('revision','').startswith('intense'):
            raise RuntimeError('Use the current intense source and targeted exporter; old assembly corrections are retired.')
        if sha(SOURCE)!=previous['sourceSha256'] or sha(ASSET)!=previous['glbSha256']:
            raise RuntimeError('Current library files changed outside this export; preserve them.')
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
        scene=bpy.data.scenes['Library assets']
        bpy.context.window.scene=scene
        entries=previous['entries']
        roots=[bpy.data.objects[e['rootNode']] for e in entries]
        collections=[bpy.data.collections[e['rootNode']] for e in entries]
        context_collection=bpy.data.collections['Assembly references - not exported']
        context_objects=[bpy.data.objects[e['rootNode']+'_Context'] for e in entries]
        for root in roots:
            for obj in [root]+list(root.children_recursive):
                if obj.type=='EMPTY':
                    parents[obj.name]=obj
                    if any(c.type=='MESH' for c in obj.children):leaves.append(obj)
        for e in entries:
            part=next(p for p in e['parts'] if p['role'] in ('pivot','moving') and not p['nodePath'].endswith('_Rod'))
            e.update(pivotNode=part['nodePath'],pivotPosition=part['position'],axis=part['axis'],bodySize=part['bodySize'],bodyCenterOffset=part['bodyCenterOffset'])
        # 当前文件的局部装配修正，保留所有其余网格和材质。
        h=3.4+2.5*math.sin(math.radians(8))-.15*math.cos(math.radians(8))
        for x in (-1.48,1.48):
            obj=bpy.data.objects['Seesaw column '+str(x)]
            target_height=h-.41
            local_low=min(v.co.z for v in obj.data.vertices);local_high=max(v.co.z for v in obj.data.vertices)
            for v in obj.data.vertices:v.co.z*=target_height/(local_high-local_low)
            obj.location.z=(h+.03)/2
        collection=collections[0]
        ivory,graphite,orange,alloy,rubber,ink=[bpy.data.materials[name] for name in ['Ivory polymer','Graphite chassis','Safety terracotta','Brushed alloy','Rubber pads','Printed markings']]
        frame=parents['WeightSeesaw_AxleFrame']
        if 'WeightSeesaw stop carrier' not in bpy.data.objects:
            box('WeightSeesaw stop carrier',(0,h-.52,0),(2.45,.16,.25),graphite,frame)
            for x in (-.84,.84):
                for z in (-.68,.68):
                    beam('WeightSeesaw stop bracket '+str(x)+str(z),(x,h-.50,0),(x,h-.35,z),.09,alloy,frame)
                    box('WeightSeesaw limit bumper '+str(x)+str(z),(x,h-.30,z),(.15,.12,.14),rubber,frame,.015)
        if not scene.world:scene.world=bpy.data.worlds.new('Library studio')
        scene.world.color=(.22,.22,.22)
        bpy.data.scenes['Library display'].world=scene.world
        bpy.context.window.scene=bpy.data.scenes['Library display']
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type=='VIEW_3D':
                    area.spaces.active.region_3d.view_distance=47
                    area.spaces.active.region_3d.view_location=gp((0,2.5,-7))
                    area.spaces.active.shading.color_type='MATERIAL'
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    else:
        # 本脚本首次创建；已有库需先按用户当前文件定向编辑，不能直接重跑清空。
        if SOURCE.exists() or ASSET.exists() or MANIFEST.exists():
            raise RuntimeError('Library already exists; edit the current source in place, do not recreate it.')
        IMAGES.mkdir(parents=True,exist_ok=True)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene=bpy.context.scene;scene.name='Library assets'
        scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
        names=['Ivory polymer','Graphite chassis','Safety terracotta','Brushed alloy','Rubber pads','Printed markings']
        with bpy.data.libraries.load(str(ROOT/'art/track-round-03.blend'),link=False) as (_,dst):dst.materials=list(names)
        ivory,graphite,orange,alloy,rubber,ink=[bpy.data.materials[name] for name in names]
        context_collection=bpy.data.collections.new('Assembly references - not exported');scene.collection.children.link(context_collection)

        # 01 中心铰轴与可见同轴扭簧壳，板的三层都归动组。
        h=3.4+2.5*math.sin(math.radians(8))-.15*math.cos(math.radians(8))
        root,fixed,pivot=module('weight-seesaw','WeightSeesaw','Pivot',[0,h,0],[1,0,0],[2.2,.30,5])
        base=group('WeightSeesaw_Base',fixed);frame=group('WeightSeesaw_AxleFrame',fixed)
        for x in (-1.48,1.48):
            foot('Seesaw shoe '+str(x),x,0,base,.75,1.2)
            box('Seesaw column '+str(x),(x,(h+.03)/2,0),(.26,h-.41,.50),graphite,frame,.035)
            tube('Seesaw bearing '+str(x),(x,h,0),.245,.13,.22,alloy,frame,'X')
            tube('Seesaw spring case '+str(x),(x+math.copysign(.20,x),h,0),.29,.13,.16,orange,frame,'X')
            for angle in (-8,0,8):
                a=math.radians(angle)
                box('Seesaw limit mark '+str(x)+str(angle),(x+math.copysign(.30,x),h-.22*math.cos(a),.22*math.sin(a)),(.015,.025,.025),ink,frame,.002)
            for sign in (-1,1):beam('Seesaw brace '+str(x)+str(sign),(x,.25,sign*.42),(x,h-.65,sign*.15),.10,alloy,frame)
        box('Seesaw lower tie',(0,.35,0),(2.85,.18,.34),graphite,base)
        box('WeightSeesaw stop carrier',(0,h-.52,0),(2.45,.16,.25),graphite,frame)
        for x in (-.84,.84):
            for z in (-.68,.68):
                beam('WeightSeesaw stop bracket '+str(x)+str(z),(x,h-.50,0),(x,h-.35,z),.09,alloy,frame)
                box('WeightSeesaw limit bumper '+str(x)+str(z),(x,h-.30,z),(.15,.12,.14),rubber,frame,.015)

        visual=group('WeightSeesaw_DeckVisual',pivot)
        deck('Seesaw board',(0,h,0),(2.2,.30,5),visual)
        cylinder('Seesaw moving spindle',(0,h,0),.12,3.48,alloy,visual,'X')
        for x in (-1.35,1.35):box('Seesaw rotating pointer '+str(x),(x,h-.22,0),(.055,.42,.065),orange,visual,.012)
        entries[-1]['design']={'implemented':False,'limitAngleDegrees':8,'restAngleDegrees':8,'candidateMass':4,'springNmPerRad':25,'dampingNmsPerRad':55}
        island_context('WeightSeesaw',2.65)

        # 02 圆筒同面材质分区给出转动方向，不增加凸齿。
        root,fixed,rotor=module('axial-roller','AxialRoller','Rotor',[0,2.4,0],[0,0,1],[2,2,5])
        for label,z in [('Near',2.8),('Far',-2.8)]:
            bearing=group('AxialRoller_Bearing'+label,fixed)
            foot('Roller '+label,0,z,bearing,1.2,.65)
            box('Roller pedestal '+label,(0,1.22,z),(.65,2.0,.4),graphite,bearing,.06)
            tube('Roller bearing '+label,(0,2.4,z),.31,.15,.25,alloy,bearing,'Z')
            tube('Roller orange race '+label,(0,2.4,z+math.copysign(.16,z)),.31,.18,.06,orange,bearing,'Z')
        drum=group('AxialRoller_DrumVisual',rotor)
        obj=cylinder('Roller drum',(0,2.4,0),1,5,ivory,drum,'Z',.03,64)
        obj.data.materials.append(orange);obj.data.materials.append(graphite)
        for face in obj.data.polygons:
            n=face.normal
            if abs(n.y)<.5:
                c=face.center;a=math.atan2(c.z,c.x)
                band=int((a+math.pi)/math.tau*16)%8
                if band==0:face.material_index=1
                elif band==1:face.material_index=2
        for sign in (-1,1):
            cylinder('Roller end hub '+str(sign),(0,2.4,sign*2.505),.62,.045,graphite,drum,'Z')
            cylinder('Roller axle '+str(sign),(0,2.4,sign*2.72),.14,.46,alloy,drum,'Z')
            for i in range(6):
                a=i*math.tau/6
                bolt('Roller end bolt '+str(sign)+str(i),(.45*math.cos(a),2.4+.45*math.sin(a),sign*2.538),drum,'Z')
        entries[-1]['restPose']='rotation-zero'
        entries[-1]['design']={'implemented':False,'angularSpeedRadiansPerSecond':-.45,'rotationAxis':[0,0,1],'radius':1,'surfaceTopVelocityDirection':'+X'}
        island_context('AxialRoller',2.62)

        # 03 长行程缸筒；可拉伸杆只有光滑轴体，接头留在头/缸上。
        root,fixed,head=module('piston-wall','PistonWall','Head',[-2.025,3.95,0],[1,0,0],[.35,1.1,1.6])
        body=group('PistonWall_CylinderBody',fixed);guide=group('PistonWall_Guide',fixed)
        tube('Pusher cylinder',(-4.6,3.95,0),.16,.10,4.2,graphite,body,'X',40)
        cylinder('Pusher rear cap',(-6.74,3.95,0),.205,.12,alloy,body,'X')
        tube('Pusher front gland',(-2.55,3.95,0),.205,.086,.14,orange,body,'X')
        for x in (-6.4,-2.8):
            column('Pusher mount '+str(x),x,0,3.73,body,.26)
            tube('Pusher clamp '+str(x),(x,3.95,0),.21,.162,.16,alloy,body,'X')
        for z in (-.40,.40):
            beam('Pusher cylinder guard '+str(z),(-6.4,3.64,z),(-2.65,3.64,z),.075,alloy,guide)
            for x in (-6.4,-2.8):beam('Pusher saddle '+str(x)+str(z),(x,3.65,0),(x,3.65,z),.065,graphite,guide)
        box('Pusher scale rail',(-4.55,4.13,0),(3.7,.04,.075),orange,guide,.01)
        for i in range(9):box('Pusher scale tick '+str(i),(-6.2+i*.4,4.16,0),(.025,.016,.09),ink,guide,.002)
        visual=group('PistonWall_HeadVisual',head)
        box('Pusher rear plate',(-2.075,3.95,0),(.25,1.1,1.6),graphite,visual,.05)
        box('Pusher striking face',(-1.90,3.95,0),(.10,1.1,1.6),orange,visual,.04)
        for z in (-.56,.56):box('Pusher face inlay '+str(z),(-1.846,3.95,z),(.008,.82,.085),ivory,visual,.004)
        cylinder('Pusher rod coupler',(-2.215,3.95,0),.12,.03,alloy,visual,'X')
        rod=empty('PistonWall_Rod',root,[-2.5,3.95,0]);bpy.context.view_layer.update()
        shaft=group('PistonWall_RodShaft',rod)
        cylinder('Pusher exposed rod',(-2.35,3.95,0),.08,.30,alloy,shaft,'X',0,32)
        entries[-1]['restPose']='fully-retracted'
        entries[-1]['design']={'implemented':False,'travel':3.7,'headEndCenter':[1.675,3.95,0],'outlet':[-2.5,3.95,0],'referenceLength':.3,'rodLengthAtFullExtension':4.0,'rodRadius':.08,'cylinderInnerRadius':.10,'cylinderOuterRadius':.16,'cycleSeconds':8,'stagesSeconds':[3,1,1.6,.8,1.6]}
        old=collection;collection=context_collection;holder=empty('PistonWall_Context')
        deck('Pusher lane',(0,3.22,0),(3.2,.36,8),holder)
        for sign in (-1,1):
            deck('Pusher pocket '+str(sign),(2.5,3.22,sign*2.9),(1.8,.36,2.2),holder)
            column('Pusher pocket foot '+str(sign),2.5,sign*2.9,3.0,holder,.22)
            for x in (-1.1,1.1):column('Pusher lane foot '+str(sign)+str(x),x,sign*2.7,3.0,holder,.22)
            box('Pusher hazard boundary '+str(sign),(0,3.405,sign*.88),(2.9,.008,.09),orange,holder,.001)
        context_objects.append(holder);collection=old

        # 04 左上轴翻板。静架仅在两端轴外，打开后原台面无固定底托。
        root,fixed,pivot=module('timed-trapdoor','TimedTrapdoor','Pivot',[-1.1,3.4,0],[0,0,1],[2.2,.24,3],[1.1,-.12,0])
        frame=group('TimedTrapdoor_AxleFrame',fixed);drive=group('TimedTrapdoor_Drive',fixed)
        for z in (-1.82,1.82):
            column('Trapdoor post '+str(z),-1.38,z,3.1,frame,.22)
            tube('Trapdoor bearing '+str(z),(-1.1,3.4,z),.18,.075,.20,alloy,frame,'Z')
            beam('Trapdoor bearing bracket '+str(z),(-1.38,3.0,z),(-1.1,3.26,z),.13,graphite,frame)
        cylinder('Trapdoor reduction gear',(-1.1,3.4,-2.10),.30,.26,orange,drive,'Z')
        cylinder('Trapdoor motor',(-1.1,3.4,-2.36),.17,.30,graphite,drive,'Z')
        for i in range(5):
            a=math.radians(i*22.5)
            box('Trapdoor dial tick '+str(i),(-1.1+.24*math.cos(a),3.4-.24*math.sin(a),-2.242),(.03,.03,.013),ivory,drive,.003)
        visual=group('TimedTrapdoor_DeckVisual',pivot,[1.1,-.12,0])
        deck('Trapdoor slab',(0,3.28,0),(2.2,.24,3),visual)
        cylinder('Trapdoor internal axle',(-1.1,3.4,0),.065,3.98,alloy,visual,'Z',.006)
        entries[-1]['restPose']='closed-horizontal'
        entries[-1]['design']={'implemented':False,'openAngleDegrees':-90,'cycleSeconds':8.5,'closedSeconds':4.5,'warningIncludedInClosedSeconds':.9,'openingSeconds':1,'openSeconds':1.5,'closingSeconds':1.5}
        island_context('TimedTrapdoor',1.62)

        # 05 单刚性双U吊架，上轴与板中心距2.8，侧臂和板下横梁共同倾摆。
        root,fixed,pivot=module('sway-cradle-bridge','SwayCradleBridge','Pivot',[0,6.08,0],[0,0,1],[2.4,.24,5],[0,-2.8,0])
        for label,z in [('Near',2.86),('Far',-2.86)]:
            gantry=group('SwayCradleBridge_Gantry'+label,fixed)
            for x in (-2.45,2.45):
                column('Cradle tower '+label+str(x),x,z,6.28,gantry,.24)
                beam('Cradle corner brace '+label+str(x),(x,5.4,z),(x-math.copysign(.65,x),6.18,z),.11,alloy,gantry)
            box('Cradle portal '+label,(0,6.28,z),(5.14,.24,.26),graphite,gantry,.035)
            tube('Cradle bearing '+label,(0,6.08,z),.22,.115,.24,alloy,gantry,'Z')
        axle=group('SwayCradleBridge_UpperAxle',fixed)
        cylinder('Cradle fixed upper axle',(0,6.08,0),.10,6.08,alloy,axle,'Z')
        cylinder('Cradle drive housing',(0,6.08,-3.12),.29,.26,orange,axle,'Z')
        cylinder('Cradle drive motor',(0,6.08,-3.39),.17,.30,graphite,axle,'Z')
        hanger=group('SwayCradleBridge_HangerVisual',pivot)
        for z in (-2.22,2.22):
            tube('Cradle rotating hub '+str(z),(0,6.08,z),.19,.108,.20,orange,hanger,'Z')
            for x in (-1.95,1.95):
                beam('Cradle shoulder '+str(x)+str(z),(0,6.08,z),(x,5.62,z),.115,alloy,hanger)
                beam('Cradle rigid side '+str(x)+str(z),(x,5.62,z),(x,2.88,z),.115,graphite,hanger)
                box('Cradle lower clamp '+str(x)+str(z),(x,2.9,z),(.22,.20,.22),orange,hanger,.025)
            box('Cradle under-deck tie '+str(z),(0,2.88,z),(4.02,.18,.16),alloy,hanger,.02)
            for x in (-.85,.85):box('Cradle deck riser '+str(x)+str(z),(x,3.01,z),(.14,.20,.16),graphite,hanger,.02)
        visual=group('SwayCradleBridge_DeckVisual',pivot,[0,-2.8,0])
        deck('Cradle rigid board',(0,3.28,0),(2.4,.24,5),visual)
        entries[-1]['design']={'implemented':False,'amplitudeDegrees':9,'periodSeconds':10,'centerDistance':2.8,'rigidBodyAssembly':True,'sideArmX':1.95,'underDeckTieTopYRelativePivot':-3.11}
        island_context('SwayCradleBridge',2.65)

        # 源场景陈列用同一集合的实例，网格没有复制五套；规范根全在原点。
        display=bpy.data.scenes.new('Library display')
        display.world=scene.world
        display.unit_settings.system='METRIC'
        offsets=[(-13,0,0),(0,0,0),(13,0,0),(-7,0,-16),(7,0,-16)]
        for c,offset in zip(collections,offsets):
            obj=bpy.data.objects.new(c.name+' display instance',None);display.collection.objects.link(obj)
            obj.instance_type='COLLECTION';obj.instance_collection=c;obj.location=gp(offset)
        bpy.context.window.scene=display
        display['purpose']='Shared collection instances for editing; do not export display offsets.'
        scene['purpose']='Five identity roots; neutral rigid assemblies, no runtime physics or animation.'
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))

    manifest=export_current_library()
    for i,entry in enumerate(entries):
        show_only(i)
        render(IMAGES/(entry['id']+'.png'),(0,2.8,0),8.8 if i!=2 else 10.8, (9,9,13))
    # 姿态仅进入PNG，不保存进源文件或GLB，不建立动画片段。
    for i,angle in [(0,8),(0,-8),(3,-90),(4,9),(4,-9)]:
        show_only(i,True)
        name=entries[i]['rootNode']+'_Pivot';pivot=parents[name]
        axis=(1,0,0) if i==0 else (0,0,1)
        pivot.rotation_mode='QUATERNION'
        from mathutils import Quaternion
        pivot.rotation_quaternion=Quaternion(gp(axis),math.radians(angle))
        bpy.context.view_layer.update()
        render(IMAGES/(entries[i]['id']+('-positive' if angle>0 else '-negative')+'.png'),(0,2.9,0),14,(10,9,15))
        pivot.rotation_quaternion=(1,0,0,0)
    show_only(2,True)
    parents['PistonWall_Head'].location=gp((1.675,3.95,0))
    parents['PistonWall_RodShaft'].scale.x=4/.3
    bpy.context.view_layer.update()
    render(IMAGES/'piston-wall-extended.png',(-1,2.8,0),14,(11,11,13))
    print('LIBRARY_PREVIEWS_COMPLETE')
