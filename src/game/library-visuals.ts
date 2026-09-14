import { bodyPart, libraryEntry, libraryPose, pistonRodPose } from './library-data'
import type { LibraryMechanismConfig } from './library-types'
import type { LibraryInstance } from './obstacle-library'
import type { Position, PrimitiveConfig } from './level-types'

export function updateLibraryVisual(instance:LibraryInstance,config:LibraryMechanismConfig,time:number,seesawAngle=0) {
  const primary=bodyPart(config.kind),pose=libraryPose(config,time,seesawAngle)
  const moving=instance.part(primary.nodePath)
  moving.setLocalPosition(...pose.pivot);moving.setLocalEulerAngles(...pose.rotation)
  if(config.kind==='piston-wall') {
    instance.part('PistonWall_Rod/PistonWall_RodShaft').setLocalScale(pistonRodPose(config,time).scale,1,1)
  }
}

// 资源未就绪时仍有分件示意；不将这些外观包围体直接用作游戏碰撞。
export function libraryFallback(config:LibraryMechanismConfig,time:number,seesawAngle=0):PrimitiveConfig[] {
  const main=bodyPart(config.kind),pose=libraryPose(config,time,seesawAngle)
  const box=(name:string,position:Position,size:Position,material:PrimitiveConfig['material']='dark'):PrimitiveConfig=>({name,type:'box',position,size,material})
  const parts:PrimitiveConfig[]=[{name:'Library body',type:config.kind==='axial-roller'?'cylinder':'box',collisionAxis:config.kind==='axial-roller'?2:undefined,position:pose.center,size:main.bodySize!,rotation:pose.rotation,material:config.kind==='piston-wall'?'orange':'cream'}]
  if(config.kind==='piston-wall') {
    const rod=pistonRodPose(config,time)
    parts.push({name:'Piston rod',type:'cylinder',collisionAxis:2,position:rod.center,size:[rod.radius*2,rod.radius*2,rod.length],rotation:[0,90,0],material:'edge'})
  }
  if(config.staticColliders) {
    // 正式布局已有分件代理时，基础外观也沿用它们，避免轴高/净空改动后仍画旧支架。
    parts.push(...config.staticColliders.map(part=>({...part,name:`Static/${part.name}`,body:undefined,refinedVisual:false})))
    if(config.kind==='sway-cradle-bridge') {
      const a=pose.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a)
      for(const part of config.frameColliders??[]) {
        const [x,y,z]=part.position,[rx,ry,rz]=part.rotation??[0,0,0]
        parts.push({...part,name:`Frame/${part.name}`,body:undefined,refinedVisual:false,position:[pose.pivot[0]+x*c-y*s,pose.pivot[1]+x*s+y*c,pose.pivot[2]+z],rotation:[rx,ry,rz+pose.angle]})
      }
    }
    return parts
  }
  if(config.kind==='weight-seesaw')parts.push(box('Base',[0,.12,0],[3.6,.24,1.3]),box('Left frame',[-1.45,1.8,0],[.3,3.6,.4]),box('Right frame',[1.45,1.8,0],[.3,3.6,.4]))
  if(config.kind==='axial-roller')for(const z of [-2.85,2.85])parts.push(box(`Bearing ${z}`,[0,1.25,z],[1.1,2.5,.5]))
  if(config.kind==='piston-wall') {
    parts.push(box('Cylinder',[-4.6,3.95,0],[4.2,.32,.32]))
  }
  if(config.kind==='timed-trapdoor')for(const z of [-1.85,1.85])parts.push(box(`Side axle ${z}`,[-1.3,1.65,z],[.3,3.3,.4]))
  if(config.kind==='sway-cradle-bridge') {
    for(const z of [-3,3])for(const x of [-2.5,2.5])parts.push(box(`Gantry ${x}/${z}`,[x,3,z],[.2,6,.2]))
    for(const z of [-3,3])parts.push(box(`Beam ${z}`,[0,6.1,z],[5.2,.24,.24]))
    const a=pose.angle*Math.PI/180
    for(const x of [-1.95,1.95])for(const z of [-2.25,2.25])parts.push({...box(`Hanger ${x}/${z}`,[x*Math.cos(a)+1.4*Math.sin(a),pose.pivot[1]+x*Math.sin(a)-1.4*Math.cos(a),z],[.1,2.8,.1]),rotation:pose.rotation})
  }
  return parts
}

export function libraryPreviewAngle(config:LibraryMechanismConfig,time:number) { return config.kind==='weight-seesaw'?(config.limitAngle??8)*Math.cos(time*Math.PI/3):0 }
export function libraryBounds(kind:LibraryMechanismConfig['kind']) { return libraryEntry(kind).rootBounds }
