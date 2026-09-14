"""按现有控制网格重建白层；保留其他对象，不运行玩法验证。"""
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import delaunay_2d_cdt

ROOT=Path(__file__).resolve().parents[1]


def replace_white_surface(surface, controls):
    """投影约束先分割、按原面覆盖筛选，再挤出；不填回头空区。"""
    flat=defaultdict(list)
    vertices=[]
    faces=[]
    for obj in controls:
        ps=[obj.matrix_world@v.co for v in obj.data.vertices]
        levels=sorted(set(round(p.z,5) for p in ps))
        if len(levels)==2:
            bottom,top=levels
            polygon=[Vector((p.x,p.y)) for p in ps if abs(p.z-top)<2e-5]
            center=sum(polygon,Vector((0,0)))/len(polygon)
            import math
            polygon.sort(key=lambda p:math.atan2(p.y-center.y,p.x-center.x))
            flat[(bottom,top)].append(polygon)
        else:
            # 斜坡沿用当前控制体矩阵与端点，不将坡误投影成水平面。
            offset=len(vertices);vertices.extend(ps)
            faces.extend(tuple(offset+i for i in f.vertices) for f in obj.data.polygons)
    counts=[]
    for (bottom,top),polygons in flat.items():
        inputs=[];constraints=[]
        for polygon in polygons:
            offset=len(inputs);inputs.extend(polygon)
            constraints.append(list(range(offset,offset+len(polygon))))
        points,_,triangles,*_=delaunay_2d_cdt(inputs,[],constraints,0,1e-6,False)
        def inside(p,poly):
            return all((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-1e-7 for a,b in zip(poly,poly[1:]+poly[:1]))
        selected=[]
        for f in triangles:
            center=sum((points[i] for i in f),Vector((0,0)))/len(f)
            if any(inside(center,p) for p in polygons):selected.append(f)
        used=sorted({i for f in selected for i in f});mapping={i:n for n,i in enumerate(used)}
        offset=len(vertices);count=len(used)
        vertices.extend(Vector((points[i].x,points[i].y,bottom)) for i in used)
        vertices.extend(Vector((points[i].x,points[i].y,top)) for i in used)
        edges=Counter();directed={}
        for f in selected:
            local=[mapping[i] for i in f]
            a,b,c=[points[i] for i in f[:3]]
            if (b-a).cross(c-a)<0:local.reverse()
            faces.append(tuple(offset+count+i for i in local))
            faces.append(tuple(offset+i for i in reversed(local)))
            for a,b in zip(local,local[1:]+local[:1]):
                key=tuple(sorted((a,b)));edges[key]+=1;directed[key]=(a,b)
        for key,num in edges.items():
            if num==1:
                a,b=directed[key];faces.append((offset+a,offset+b,offset+count+b,offset+count+a))
        counts.append({'topY':top,'controlPolygons':len(polygons),'surfaceTriangles':len(selected)})
    mesh=bpy.data.meshes.new('Continuous ivory planar union')
    mesh.from_pydata(vertices,[],faces);mesh.update()
    for material in surface.data.materials:mesh.materials.append(material)
    for f in mesh.polygons:f.use_smooth=True
    surface.data=mesh;surface.matrix_world=Matrix.Identity(4)
    for modifier in list(surface.modifiers):
        if modifier.type=='BOOLEAN':surface.modifiers.remove(modifier)
    surface['surface_method']='Planar constrained triangulation, clipped to input polygon union, then extruded; original sloped boxes preserved.'
    surface['planar_sections']=json.dumps(counts)
    return counts


if __name__=='__main__':
    import sys
    sys.dont_write_bytecode=True
    sys.path.insert(0,str(ROOT/'art'))
    import water_rush_assets as assets
    report_path=ROOT/'art/water-rush-report.json'
    previous=json.loads(report_path.read_text())
    source=ROOT/'art/water-rush.blend'
    original_hash=assets.sha(source)
    if original_hash!=previous['blend_sha256']:
        raise RuntimeError('Current saved source differs from delivered hash; preserve concurrent edits.')
    bpy.ops.wm.open_mainfile(filepath=str(source))
    layout=json.loads((ROOT/'docs/levels/water-rush-layout.json').read_text())
    specs=layout['staticDecks']+layout['ramps']+layout['sBend']['collisionSegments']
    controls=[bpy.data.objects[s['id']] for s in specs]
    summary=replace_white_surface(bpy.data.objects['Continuous walkable surface'],controls)
    bpy.context.view_layer.update()
    bpy.context.preferences.filepaths.save_version=0
    if assets.sha(source)!=original_hash:raise RuntimeError('Concurrent source change before save')
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    static=[o for o in bpy.data.collections['Static structure'].objects if o.type in ('MESH','FONT')]
    result=assets.export_meshes(static,'TrackStatic','water-rush-track.glb')
    previous['blend_sha256']=assets.sha(source)
    previous['exports'][0]=result
    previous['white_surface_repair']={'inputSourceSha256':original_hash,'method':'planar_cdt_polygon_union','sections':summary,'slopedControlsPreserved':[s['id'] for s in layout['ramps']],'otherLayersUnchanged':True,'status':'Model repair exported; no tests or playtest run'}
    previous.pop('source_geometry_validation',None)
    report_path.write_text(json.dumps(previous,ensure_ascii=False,indent=2)+'\n')
    # 单张制作预览，不改存盘姿态/陈列，不重导其他模型。
    collection=bpy.context.scene.collection
    material=bpy.data.materials.new('Repair preview background');material.diffuse_color=(.0176,.1144,.1413,1)
    assets.box('Repair preview only',[0,-.42,0],[170,.02,180],material,0)
    assets.render_preview([-3,3.4,-17],43,ROOT/'docs/art/water-rush-surface-repair.png',(0,-20,32))
    print('WHITE_SURFACE_REPAIRED',json.dumps({'sourceSha256':previous['blend_sha256'],'export':result,'sections':summary}))
