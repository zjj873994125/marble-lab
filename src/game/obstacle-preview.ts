import * as pc from 'playcanvas'
import { createObstacleScene, sceneBounds } from './obstacle-scene'
import { createHammerCylinderGeometry } from './hammer-visuals'
import { createModelAssets } from './model-assets'
import { createObstacleLibrary, type LibraryInstance } from './obstacle-library'
import { createAdvancedLibrary, type AdvancedLibraryInstance } from './advanced-library'
import { previewAdvancedConfig, updateAdvancedPreview } from './advanced-preview'
import { previewLibraryConfig } from './library-data'
import { libraryBounds, libraryPreviewAngle, updateLibraryVisual } from './library-visuals'
import type { ObstacleId } from './obstacles'
import { createThemeMaterials } from './theme-materials'
import { primitiveThemeRoles, type TrackThemeId } from './track-themes'
import { createWaterMaterial } from './water-material'
import { createSteelMaterial } from './steel-material'
import type { Settings } from '../state'

export interface ObstaclePreview { setObstacle:(id:ObstacleId)=>void; setVisible:(value:boolean)=>void; setPlaying:(value:boolean)=>void; applyTheme:()=>void; replay:()=>void; zoom:(factor:number)=>void; resetView:()=>void; destroy:()=>void }

export function createObstaclePreview(canvas:HTMLCanvasElement,id:ObstacleId,onStatus:(message:string)=>void,selection:()=>TrackThemeId=()=> 'classic',waterSettings:()=>Pick<Settings,'quality'|'reducedMotion'|'waterSpeed'|'ballSkin'>=()=>({quality:'high',reducedMotion:false,waterSpeed:1,ballSkin:'steel'})):ObstaclePreview {
  const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false}})
  app.setCanvasFillMode(pc.FILLMODE_NONE);app.setCanvasResolution(pc.RESOLUTION_AUTO);app.autoRender=false
  app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio,1.5);app.scene.ambientLight=new pc.Color(.7,.73,.7)
  const themes=createThemeMaterials(selection)
  const controller=new AbortController(),assets=createModelAssets(app,controller.signal),library=createObstacleLibrary(assets.load,themes.applyEntity),advancedLibrary=createAdvancedLibrary(assets.load,themes.applyEntity)
  const materials:pc.StandardMaterial[]=[],meshes:pc.Mesh[]=[],instances:pc.Entity[]=[]
  const palette:Record<string,pc.StandardMaterial>={}
  for(const [name,color] of Object.entries({cream:'#fff7df',edge:'#b7cac4',orange:'#e77d43',dark:'#48656a',blue:'#9bc5cc'})){
    const m=new pc.StandardMaterial();m.diffuse=new pc.Color().fromString(color);m.gloss=.35;m.update();materials.push(m);palette[name]=m
  }
  const entities=new Map<string,pc.Entity>()
  const floor=new pc.Entity('Display plinth');floor.addComponent('render',{type:'box',material:themes.material(palette.dark!,'structure'),receiveShadows:true});app.root.addChild(floor)
  let preparedWater:ReturnType<typeof createWaterMaterial>|undefined
  try { preparedWater=createWaterMaterial(app);themes.material(preparedWater.material,'water',true);preparedWater.setTheme(selection());preparedWater.configure(waterSettings().quality==='high') }
  catch(error){advancedLibrary.destroy();library.destroy();themes.destroy();controller.abort();assets.destroy();preparedWater?.destroy();app.destroy();materials.forEach(material=>material.destroy());throw error}
  const water=preparedWater
  const waterSurface=new pc.Entity('Preview water');waterSurface.addComponent('render',{type:'box',material:water.material,castShadows:false,receiveShadows:true});app.root.addChild(waterSurface)
  const light=new pc.Entity('Preview light');light.addComponent('light',{type:'directional',color:new pc.Color(1,.96,.87),intensity:1.8,castShadows:true,shadowResolution:1024,normalOffsetBias:.04});light.setEulerAngles(45,-30,0);app.root.addChild(light)
  const camera=new pc.Entity('Preview camera');camera.addComponent('camera',{projection:pc.PROJECTION_ORTHOGRAPHIC,clearColor:new pc.Color(.89,.92,.87),nearClip:.1,farClip:500,toneMapping:pc.TONEMAP_ACES});app.root.addChild(camera)
  let scene=createObstacleScene(id),center=new pc.Vec3(),span=10,radius=7,yaw=.72,pitch=.58,zoom=1,time=0,playing=true,disposed=false,generation=0,lastFrame=performance.now(),pointer:number|null=null,lastX=0,lastY=0
  let libraryInstance:LibraryInstance|undefined,advancedInstance:AdvancedLibraryInstance|undefined,visible=true,currentId=id
  let markerSteel:ReturnType<typeof createSteelMaterial>|undefined
  function redraw(){app.renderNextFrame=true}
  function markerMaterial(){markerSteel??=createSteelMaterial(app,()=>{if(!disposed&&visible)redraw()});markerSteel.setSkin(waterSettings().ballSkin);return markerSteel.material}
  function clearScene(){libraryInstance?.destroy();libraryInstance=undefined;advancedInstance?.destroy();advancedInstance=undefined;instances.splice(0).forEach(instance=>instance.destroy());entities.forEach(entity=>entity.destroy());entities.clear();meshes.splice(0).forEach(mesh=>mesh.destroy())}
  function pose(){
    for(const part of scene.frame(time)){const e=entities.get(part.name)!;e.setPosition(...part.position);e.setEulerAngles(...(part.rotation??[0,0,0]));e.setLocalScale(...part.size)}
    if(libraryInstance&&scene.library){const config=previewLibraryConfig(scene.library);updateLibraryVisual(libraryInstance,config,time,libraryPreviewAngle(config,time))}
    if(advancedInstance&&scene.advanced)updateAdvancedPreview(advancedInstance,previewAdvancedConfig(scene.advanced),time)
    redraw()
  }
  function view(){const distance=span*2+15;camera.setPosition(center.x+Math.sin(yaw)*Math.cos(pitch)*distance,center.y+Math.sin(pitch)*distance,center.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(center);const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);camera.camera!.orthoHeight=radius*zoom/Math.min(1,aspect);redraw()}
  function show(next:ObstacleId){
    currentId=next
    if(!visible)return
    const token=++generation;clearScene();scene=createObstacleScene(next);time=0;yaw=.72;pitch=.58;zoom=1;lastFrame=performance.now()
    const bounds=sceneBounds(scene)
    if(scene.library){const full=libraryBounds(scene.library);for(let i=0;i<3;i++){bounds.min[i]=Math.min(bounds.min[i]!,full.min[i]!);bounds.max[i]=Math.max(bounds.max[i]!,full.max[i]!)}bounds.center=bounds.min.map((value,i)=>(value+bounds.max[i]!)/2) as [number,number,number]}
    center.set(...bounds.center);span=Math.max(...bounds.max.map((value,i)=>value-bounds.min[i]!));radius=Math.max(scene.advanced?2.6:4.5,span*.72)
    for(const part of scene.frame(0)){
      const entity=new pc.Entity(part.name)
      if(!part.hidden){
        const model=scene.models.find(model=>model.replaces.includes(part.name))
        const role=part.marker||part.protectedTheme||model?.handle?undefined:model?.file.startsWith('hammer-head-toy')?'hammer':primitiveThemeRoles[part.material]
        const material=part.marker?markerMaterial():themes.material(palette[part.material]??palette.cream!,role)
        if(part.type==='cylinder'&&part.collisionAxis===2){const mesh=pc.Mesh.fromGeometry(app.graphicsDevice,createHammerCylinderGeometry([1,1,1]));meshes.push(mesh);entity.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,material)]})}
        else entity.addComponent('render',{type:part.type,material,castShadows:true,receiveShadows:true})
      }
      app.root.addChild(entity);entities.set(part.name,entity)
    }
    floor.setLocalScale(Math.max(8,bounds.max[0]-bounds.min[0]+3),.18,Math.max(8,bounds.max[2]-bounds.min[2]+3));floor.setPosition(center.x,bounds.min[1]-.3,center.z)
    waterSurface.setLocalScale(floor.getLocalScale().x,.02,floor.getLocalScale().z);waterSurface.setPosition(center.x,bounds.min[1]-.2,center.z)
    light.light!.shadowDistance=span*3+20;pose();view()
    if(scene.library){
      const kind=scene.library;onStatus('正在加载模型…')
      void library.instantiate(kind).then(instance=>{
        if(disposed||token!==generation){instance.destroy();return}
        libraryInstance=instance;const config=previewLibraryConfig(kind);updateLibraryVisual(instance,config,time,libraryPreviewAngle(config,time));app.root.addChild(instance.root);instance.root.enabled=true
        entities.forEach(entity=>{if(entity.render)entity.render.enabled=false});onStatus('');redraw()
      }).catch(error=>{if(!disposed&&token===generation){onStatus('模型未加载，显示基础外观');console.warn('机关库预览加载失败',error)}})
    }else if(scene.advanced){
      const kind=scene.advanced;onStatus('正在加载模型…')
      void advancedLibrary.instantiate(kind).then(instance=>{
        if(disposed||token!==generation){instance.destroy();return}
        advancedInstance=instance;updateAdvancedPreview(instance,previewAdvancedConfig(kind),time);app.root.addChild(instance.root);instance.root.enabled=true
        entities.forEach(entity=>{if(entity.render)entity.render.enabled=false});onStatus('');redraw()
      }).catch(error=>{if(!disposed&&token===generation){onStatus('模型未加载，显示基础外观');console.warn('高级机关库预览加载失败',error)}})
    }else if(scene.models.length){
      onStatus('正在加载模型…')
      void Promise.allSettled(scene.models.map(async model=>{
        const asset=await assets.load(model.file)
        if(disposed||token!==generation)return
        const instance=(asset.resource as pc.ContainerResource).instantiateRenderEntity();instances.push(instance)
        themes.applyEntity(instance)
        const parent=entities.get(model.anchor)!,scale=parent.getLocalScale()
        instance.setLocalScale(1/scale.x,model.handle?1:1/scale.y,1/scale.z);parent.addChild(instance)
        model.replaces.forEach(name=>{entities.get(name)!.render!.enabled=false})
      })).then(results=>{if(!disposed&&token===generation){onStatus(results.some(result=>result.status==='rejected')?'部分模型未加载，显示基础外观':'');redraw()}})
    }else onStatus('')
  }
  function resize(){const rect=canvas.parentElement!.getBoundingClientRect();app.resizeCanvas(Math.max(1,rect.width),Math.max(1,rect.height));view()}
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement!);resize();show(id)
  function down(e:PointerEvent){if(pointer!==null)return;pointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(pointer)}
  function move(e:PointerEvent){if(e.pointerId!==pointer)return;yaw-=(e.clientX-lastX)*.007;pitch=Math.max(.16,Math.min(1.4,pitch+(e.clientY-lastY)*.007));lastX=e.clientX;lastY=e.clientY;view()}
  function release(e:PointerEvent){if(e.pointerId!==pointer)return;pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}
  function wheel(e:WheelEvent){e.preventDefault();zoom=Math.max(.45,Math.min(2,zoom*Math.exp(e.deltaY*.001)));view()}
  function resetClock(){lastFrame=performance.now()}
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('wheel',wheel,{passive:false})
  document.addEventListener('visibilitychange',resetClock);window.addEventListener('blur',resetClock)
  app.on('update',()=>{const now=performance.now(),delta=(now-lastFrame)/1000;lastFrame=now;const settings=waterSettings(),active=visible&&playing&&!document.hidden&&document.hasFocus();water.update(active&&settings.quality==='high'&&!settings.reducedMotion&&!matchMedia('(prefers-reduced-motion: reduce)').matches,settings.waterSpeed);if(active&&delta>0&&delta<.25){time+=delta;pose()}})
  app.start()
  return {
    setObstacle:show,
    setVisible(value){if(visible===value)return;visible=value;generation++;if(value)show(currentId);else{if(pointer!==null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);pointer=null;clearScene()}resetClock()},
    setPlaying(value){playing=value;resetClock()},
    applyTheme(){themes.refresh();water.setTheme(selection());water.configure(waterSettings().quality==='high');markerSteel?.setSkin(waterSettings().ballSkin);if(visible)redraw()},
    replay(){time=0;pose();resetClock()},
    zoom(factor){zoom=Math.max(.45,Math.min(2,zoom*factor));view()},
    resetView(){yaw=.72;pitch=.58;zoom=1;view()},
    destroy(){if(disposed)return;disposed=true;generation++;observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',release);canvas.removeEventListener('pointercancel',release);canvas.removeEventListener('lostpointercapture',release);canvas.removeEventListener('wheel',wheel);document.removeEventListener('visibilitychange',resetClock);window.removeEventListener('blur',resetClock);if(pointer!==null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);clearScene();advancedLibrary.destroy();library.destroy();themes.destroy();markerSteel?.destroy();controller.abort();assets.destroy();waterSurface.destroy();water.destroy();app.destroy();materials.forEach(m=>m.destroy())},
  }
}
