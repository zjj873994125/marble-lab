import * as pc from 'playcanvas'
import type { ArcHammerConfig, LiftConfig, MechanismGroupConfig, PendulumConfig, PlatformConfig, Position, PrimitiveConfig, TurntableConfig } from './level-types'

export interface Placed<T> { id:string; config:T; origin:Position; yaw:number; phaseSeconds:number }
export interface ExpandedMechanisms {
  pendulums:Placed<PendulumConfig>[]
  platforms:Placed<PlatformConfig>[]
  turntables:Placed<TurntableConfig>[]
  hammers:Placed<ArcHammerConfig>[]
  lifts:Placed<LiftConfig>[]
}
const placed=<T>(id:string,config:T,position:Position=[0,0,0],yaw=0,phaseSeconds=0):Placed<T>=>({id,config,origin:position,yaw,phaseSeconds})

export function expandMechanisms(level:{pendulum?:PendulumConfig;platform?:PlatformConfig;turntable?:TurntableConfig;hammers?:ArcHammerConfig[];lifts?:LiftConfig[];mechanismGroups?:MechanismGroupConfig[]}):ExpandedMechanisms {
  const result:ExpandedMechanisms={pendulums:[],platforms:[],turntables:[],hammers:[],lifts:[]}
  if(level.pendulum)result.pendulums.push(placed('legacy-pendulum',level.pendulum))
  if(level.platform)result.platforms.push(placed('legacy-platform',level.platform))
  if(level.turntable)result.turntables.push(placed('legacy-turntable',level.turntable))
  ;(level.hammers??[]).forEach((config,index)=>result.hammers.push(placed(`legacy-hammer-${index+1}`,config)))
  ;(level.lifts??[]).forEach((config,index)=>result.lifts.push(placed(`legacy-lift-${index+1}`,config)))
  for(const group of level.mechanismGroups??[]) {
    const add=<T>(target:Placed<T>[],id:string,config:T)=>target.push(placed(id,config,group.position,group.yaw??0,group.phaseSeconds??0))
    if(group.kind==='pendulum')add(result.pendulums,group.id,group.config)
    else if(group.kind==='platform')add(result.platforms,group.id,group.config)
    else if(group.kind==='turntable')add(result.turntables,group.id,group.config)
    else if(group.kind==='hammers')group.configs.forEach((config,index)=>add(result.hammers,`${group.id}/${index+1}`,config))
    else group.configs.forEach((config,index)=>add(result.lifts,`${group.id}/${index+1}`,config))
  }
  return result
}

export function placement(origin:Position,yawDegrees:number) {
  const yaw=new pc.Quat().setFromEulerAngles(0,yawDegrees,0),offset=new pc.Vec3(...origin)
  return {
    point(value:Position){return yaw.transformVector(new pc.Vec3(...value)).add(offset).toArray() as Position},
    rotation(value:Position=[0,0,0]){return new pc.Quat().mul2(yaw,new pc.Quat().setFromEulerAngles(...value)).getEulerAngles().toArray() as Position},
  }
}

export function placedPrimitive(item:Placed<unknown>,part:PrimitiveConfig,name:string):PrimitiveConfig {
  const transform=placement(item.origin,item.yaw)
  return {...part,name:`${item.id}/${name}`,position:transform.point(part.position),rotation:transform.rotation(part.rotation)}
}
