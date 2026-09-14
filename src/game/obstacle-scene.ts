import initial from '../levels/initial-gravity'
import water from '../levels/water-rush'
import { arcHammerPose, liftPosition, turntablePose } from './mechanism-motion'
import type { ObstacleId } from './obstacles'
import type { Position, PrimitiveConfig } from './level-types'
import { isLibraryKind, previewLibraryConfig } from './library-data'
import { libraryFallback, libraryPreviewAngle } from './library-visuals'
import type { LibraryKind } from './library-types'

export interface PreviewPart extends PrimitiveConfig { hidden?: boolean; marker?: boolean }
export interface PreviewModel { file: string; anchor: string; replaces: string[]; handle?: boolean }
export interface ObstacleScene { frame: (time: number) => PreviewPart[]; models: PreviewModel[]; moving: boolean; library?:LibraryKind }
const clone = (part: PrimitiveConfig): PreviewPart => ({ ...part, position: [...part.position], size: [...part.size], rotation: part.rotation ? [...part.rotation] : undefined })
const box = (name: string, position: Position, size: Position, material: PrimitiveConfig['material'] = 'cream'): PreviewPart => ({ name, position, size, material, type: 'box' })
const marker = (position: Position): PreviewPart => ({ name: 'Path illustration', position, size: [.85,.85,.85], type: 'sphere', material: 'edge', marker: true })

export function rotatePoint(point: Position, angles: Position = [0,0,0]): Position {
  let [x,y,z] = point
  const [rx,ry,rz] = angles.map(angle => angle * Math.PI / 180)
  let c = Math.cos(rx!), s = Math.sin(rx!); [y,z] = [y*c-z*s, y*s+z*c]
  c = Math.cos(ry!); s = Math.sin(ry!); [x,z] = [x*c+z*s, -x*s+z*c]
  c = Math.cos(rz!); s = Math.sin(rz!); [x,y] = [x*c-y*s, x*s+y*c]
  return [x,y,z]
}

// 卡片和大预览使用同一份构图；只有大预览推进动画，不创建游戏刚体或存档。
export function createObstacleScene(id: ObstacleId): ObstacleScene {
  if(isLibraryKind(id)) { const config=previewLibraryConfig(id);return {library:id,models:[],moving:true,frame:time=>libraryFallback(config,time,libraryPreviewAngle(config,time))} }
  const models: PreviewModel[] = []
  let frame: (time: number) => PreviewPart[]
  if (id === 'hammers') {
    const configs = water.hammers!
    const scenery = water.staticObjects.filter(o => o.name === 'hammer-lane' || /^hammer-\d-(post|beam)/.test(o.name)).map(clone)
    configs.forEach(h => { if (h.visuals) { models.push({ file: h.visuals.head, anchor: h.ball.name, replaces: [h.ball.name] }); models.push({ file: h.visuals.handle, anchor: h.rod.name, replaces: [h.rod.name], handle: true }) } })
    frame = time => [...scenery, ...configs.flatMap(h => {
      const pose = arcHammerPose(h,time)
      return [{ ...clone(h.ball), position: pose.head, rotation: pose.rotation }, { ...clone(h.rod), position: pose.rod, rotation: pose.rotation, size: [h.rodWidth,h.rodLength,h.rodWidth] as Position }]
    })]
  } else if (id === 'pendulum') {
    const h = initial.pendulum!
    if (h.visuals) { models.push({ file:h.visuals.head, anchor:h.ball.name, replaces:[h.ball.name] }); models.push({ file:h.visuals.handle, anchor:h.rod.name, replaces:[h.rod.name], handle:true }) }
    frame = time => {
      const offset = Math.sin(time*h.angularSpeed)*h.amplitude
      const head: Position = [h.ball.position[0],h.ball.position[1]+Math.abs(offset)*h.lift,h.ball.position[2]+offset]
      const dy=h.anchor[1]-head[1], dz=h.anchor[2]-head[2], length=Math.hypot(dy,dz)
      const rotation: Position = [Math.atan2(dz,dy)*180/Math.PI,0,0]
      return [box('Track',[-5.5,3.22,-4],[9,.36,3]), box('Post left',[-7,4,-5.6],[.18,7.8,.18],'dark'), box('Post right',[-4,4,-5.6],[.18,7.8,.18],'dark'),box('Crossbar',[-5.5,7.9,-5.6],[3.2,.2,.2],'edge'),{...clone(h.ball),position:head,rotation},{...clone(h.rod),position:[head[0],(h.anchor[1]+head[1])/2,(h.anchor[2]+head[2])/2],rotation,size:[h.rodWidth,length,h.rodWidth]}]
    }
  } else if (id === 'cross') {
    const c=water.turntable!
    if(c.visual)models.push({file:c.visual,anchor:'Cross visual',replaces:c.parts.map(p=>p.name)})
    const scenery=water.staticObjects.filter(o=>o.name==='turntable-entry-tongue'||o.name==='turntable-exit-tongue').map(clone)
    frame=time=>{const pose=turntablePose(c,time);return [...scenery,box('Center support',[c.position[0],1.4,c.position[2]],[.7,2.7,.7],'dark'),...c.parts.map((part,i)=>({...clone(part),position:pose.parts[i]!,rotation:pose.rotation})),{...box('Cross visual',c.position,[1,1,1]),hidden:true,rotation:pose.rotation}]}
  } else if (id === 'lifts') {
    const configs=water.lifts!
    configs.forEach(l=>{if(l.visual)models.push({file:l.visual,anchor:l.body.name,replaces:[l.body.name]})})
    frame=time=>configs.flatMap(l=>[box(`${l.body.name}-support`,[l.body.position[0],.6,l.body.position[2]],[.5,1.8,.5],'dark'),{...clone(l.body),position:liftPosition(l,time)}])
  } else if (id === 'platform') {
    const p=water.platform!
    if(water.visuals?.platform)models.push({file:water.visuals.platform,anchor:p.body.name,replaces:[p.body.name]})
    const scenery=[box('Near bank',[p.body.position[0],p.body.position[1],7.2],[3.6,.36,2.4]),box('Far bank',[p.body.position[0],p.body.position[1],-.6],[3.6,.36,2.4]),...water.staticObjects.filter(o=>o.name.startsWith('Crossing guide')).map(clone)]
    frame=time=>{const x=(p.centerX??p.body.position[0])+p.amplitude*Math.sin(time*p.angularSpeed);return [...scenery,{...clone(p.body),position:[x,p.body.position[1],p.centerZ]},{...clone(p.stripe),position:[x,p.stripeY,p.centerZ]}]}
  } else {
    let parts: PreviewPart[], path: Position[]
    if(id==='beam') {
      const bridge=clone(water.staticObjects.find(o=>o.name==='narrow-bridge')!)
      const [x,y,z]=bridge.position,half=bridge.size[2]/2
      parts=[bridge,box('Near island',[x,y,z+half+1],[3,.36,2]),box('Far island',[x,y,z-half-1],[3,.36,2])]
      path=[[x,y+.605,z+half+1],[x,y+.605,z-half-1]]
    } else if(id==='serpentine') {
      parts=water.staticObjects.filter(o=>/^s-bend-\d/.test(o.name)).map(clone)
      path=parts.map(p=>[p.position[0],p.position[1]+p.size[1]/2+.425,p.position[2]])
    } else {
      parts=water.staticObjects.filter(o=>o.name.startsWith('ramp-')||o.name==='finish-deck').map(clone)
      path=[]
      for(const part of parts.filter(p=>p.name.startsWith('ramp-'))) {
        const xRise=rotatePoint([1,0,0],part.rotation)[1],zRise=rotatePoint([0,0,1],part.rotation)[1]
        const axis=Math.abs(xRise)>Math.abs(zRise)?0:2,sign=(axis===0?xRise:zRise)<0?1:-1
        for(const direction of [sign,-sign]) {
          const local:Position=[0,part.size[1]/2+.425,0];local[axis]=direction*part.size[axis]/2
          const point=rotatePoint(local,part.rotation);path.push(point.map((v,i)=>v+part.position[i]!) as Position)
        }
      }
    }
    const distances=[0]
    for(let i=1;i<path.length;i++)distances.push(distances[i-1]!+Math.hypot(...path[i]!.map((v,axis)=>v-path[i-1]![axis]!)))
    const total=distances.at(-1)??0
    frame=time=>{
      const along=(time/(id==='serpentine'?18:7)%1)*total
      let position=path[0]??[0,0,0]
      for(let i=1;i<path.length;i++)if(along<=distances[i]!) {const t=(along-distances[i-1]!)/Math.max(.001,distances[i]!-distances[i-1]!);position=path[i-1]!.map((v,axis)=>v+(path[i]![axis]!-v)*t) as Position;break}
      return [...parts,marker(position)]
    }
  }
  return { frame, models, moving: !['beam','serpentine','ramp'].includes(id) }
}

export function partCorners(part: PreviewPart): Position[] {
  return [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]].map(signs=>{
    const point=rotatePoint(signs.map((v,i)=>v*part.size[i]!/2) as Position,part.rotation)
    return point.map((v,i)=>v+part.position[i]!) as Position
  })
}

export function sceneBounds(scene: ObstacleScene) {
  const min:Position=[Infinity,Infinity,Infinity],max:Position=[-Infinity,-Infinity,-Infinity]
  // 包含运动包络，旋转/升降时镜头无需跟着缩放。
  for(let sample=0;sample<24;sample++)for(const part of scene.frame(sample*.7))if(!part.hidden)for(const point of partCorners(part))for(let i=0;i<3;i++){min[i]=Math.min(min[i]!,point[i]!);max[i]=Math.max(max[i]!,point[i]!)}
  return {min,max,center:min.map((v,i)=>(v+max[i]!)/2) as Position}
}
