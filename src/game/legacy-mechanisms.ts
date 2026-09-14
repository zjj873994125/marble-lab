import * as pc from 'playcanvas'
import { attachHammerVisuals } from './hammer-visuals'
import { attachMovingVisual } from './model-assets'
import { expandMechanisms, placement, placedPrimitive, type Placed } from './mechanism-groups'
import { arcHammerPose, liftPosition, turntablePose } from './mechanism-motion'
import type { LevelConfig, Position, PrimitiveConfig } from './level-types'

type AddObject=(config:PrimitiveConfig,body?:'static'|'dynamic'|'kinematic',role?:'hammer'|'platform'|null)=>pc.Entity

export function createLegacyMechanisms(app:pc.Application,level:LevelConfig,addObject:AddObject,load:(file:string)=>Promise<pc.Asset>,decorate:(entity:pc.Entity)=>void) {
  const expanded=expandMechanisms(level),visuals:Promise<()=>void>[]=[]
  const pendulums=expanded.pendulums.map(item=>{
    const grouped=!item.id.startsWith('legacy-')
    const head=addObject(placedPrimitive(item,item.config.ball,'head'),'kinematic','hammer')
    const rod=addObject(placedPrimitive(item,item.config.rod,'rod'),undefined,null)
    visuals.push(attachHammerVisuals(app,head,rod,item.config.visuals,load,decorate))
    return {item,head,rod,grouped}
  })
  const hammers=expanded.hammers.map(item=>{
    const head=addObject(placedPrimitive(item,item.config.ball,'head'),'kinematic','hammer')
    const rod=addObject(placedPrimitive(item,item.config.rod,'rod'),undefined,null)
    visuals.push(attachHammerVisuals(app,head,rod,item.config.visuals,load,decorate))
    return {item,head,rod,grouped:!item.id.startsWith('legacy-')}
  })
  const lifts=expanded.lifts.map(item=>{
    const entity=addObject(placedPrimitive(item,item.config.body,'body'),'kinematic','platform')
    visuals.push(attachMovingVisual(load,item.config.visual,entity,[entity.render!],decorate))
    return {item,entity}
  })
  const turntables=expanded.turntables.map(item=>{
    const parts=item.config.parts.map((part,index)=>addObject(placedPrimitive(item,part,`part-${index+1}`),'kinematic'))
    const root=new pc.Entity(`${item.id}/visual-root`);app.root.addChild(root)
    visuals.push(attachMovingVisual(load,item.config.visual,root,parts.map(part=>part.render!),decorate))
    return {item,parts,root}
  })
  const platforms=expanded.platforms.map(item=>{
    const body=addObject(placedPrimitive(item,item.config.body,'body'),'kinematic','platform')
    const stripe=addObject(placedPrimitive(item,item.config.stripe,'stripe'),undefined,null)
    if(item.config.visual)visuals.push(attachMovingVisual(load,item.config.visual,body,[body.render!],decorate))
    return {item,body,stripe}
  })

  const worldPose=(item:Placed<unknown>,position:Position,rotation:Position=[0,0,0])=>{
    const transform=placement(item.origin,item.yaw)
    return {position:transform.point(position),rotation:transform.rotation(rotation)}
  }
  function update(time:number) {
    pendulums.forEach(({item,head,rod,grouped})=>{
      const config=item.config,t=time+item.phaseSeconds
      if(grouped) {
        const offset=config.amplitude*Math.sin(t*config.angularSpeed),anchor=config.anchor
        const localHead:Position=[config.ball.position[0]+offset,config.ball.position[1]+Math.abs(offset)*config.lift,config.ball.position[2]]
        const headPose=worldPose(item,localHead,[0,90,0]),worldAnchor=new pc.Vec3(...placement(item.origin,item.yaw).point(anchor))
        head.setPosition(...headPose.position);head.setEulerAngles(...headPose.rotation)
        const center=head.getPosition(),direction=new pc.Vec3().sub2(worldAnchor,center),length=direction.length()
        rod.setPosition(new pc.Vec3().lerp(worldAnchor,center,.5));rod.setLocalScale(config.rodWidth,length,config.rodWidth);rod.setRotation(new pc.Quat().setFromDirections(pc.Vec3.UP,direction.normalize()))
      } else {
        const offset=Math.sin(t*config.angularSpeed)*config.amplitude
        const localHead:Position=[config.ball.position[0],config.ball.position[1]+Math.abs(offset)*config.lift,config.ball.position[2]+offset]
        const world=worldPose(item,localHead),worldAnchor=new pc.Vec3(...placement(item.origin,item.yaw).point(config.anchor))
        head.setPosition(...world.position)
        const center=head.getPosition(),direction=new pc.Vec3().sub2(worldAnchor,center),length=direction.length()
        rod.setPosition(new pc.Vec3().lerp(worldAnchor,center,.5));rod.setLocalScale(config.rodWidth,length,config.rodWidth)
        const rotation=new pc.Quat().setFromDirections(pc.Vec3.UP,direction.normalize());rod.setRotation(rotation)
        if((level.rulesVersion??'classic')!=='classic')head.setRotation(rotation)
      }
    })
    hammers.forEach(({item,head,rod,grouped})=>{
      const config=item.config,t=time+item.phaseSeconds
      if(!grouped) {
        const pose=arcHammerPose(config,t)
        head.setPosition(...pose.head);head.setEulerAngles(...pose.rotation)
        rod.setPosition(...pose.rod);rod.setEulerAngles(...pose.rotation);rod.setLocalScale(config.rodWidth,config.rodLength,config.rodWidth)
        return
      }
      const angle=config.maxAngle*Math.sin(t*config.angularSpeed+config.phase)
      const [x,y,z]=config.anchor
      const localHead:Position=[x+config.rodLength*Math.sin(angle),y-config.rodLength*Math.cos(angle),z]
      const transform=placement(item.origin,item.yaw),headPosition=transform.point(localHead)
      const rootYaw=new pc.Quat().setFromEulerAngles(0,item.yaw,0),swing=new pc.Quat().setFromEulerAngles(0,0,angle*180/Math.PI),basis=new pc.Quat().setFromEulerAngles(0,90,0),headRotation=new pc.Quat().mul2(rootYaw,new pc.Quat().mul2(swing,basis))
      const localRod:Position=[(x+localHead[0])/2,(y+localHead[1])/2,z]
      head.setPosition(...headPosition);head.setRotation(headRotation)
      rod.setPosition(...transform.point(localRod));rod.setEulerAngles(...transform.rotation([0,0,angle*180/Math.PI]));rod.setLocalScale(config.rodWidth,config.rodLength,config.rodWidth)
    })
    lifts.forEach(({item,entity})=>entity.setPosition(...placement(item.origin,item.yaw).point(liftPosition(item.config,time+item.phaseSeconds))))
    turntables.forEach(({item,parts,root})=>{
      const pose=turntablePose(item.config,time+item.phaseSeconds),transform=placement(item.origin,item.yaw)
      root.setPosition(...transform.point(item.config.position));root.setEulerAngles(...transform.rotation(pose.rotation))
      parts.forEach((part,index)=>{part.setPosition(...transform.point(pose.parts[index]!));part.setEulerAngles(...transform.rotation(pose.rotation))})
    })
    platforms.forEach(({item,body,stripe})=>{
      const config=item.config,t=time+item.phaseSeconds,offset=Math.sin(t*config.angularSpeed)*config.amplitude
      const localX=config.axis==='x'?(config.centerX??config.body.position[0])+offset:config.body.position[0]
      const localZ=config.axis==='x'?config.centerZ:config.centerZ+offset,transform=placement(item.origin,item.yaw)
      body.setPosition(...transform.point([localX,config.body.position[1],localZ]));body.setEulerAngles(...transform.rotation(config.body.rotation))
      const stripeX=config.axis==='x'?localX:config.stripe.position[0]
      stripe.setPosition(...transform.point([stripeX,config.stripeY,localZ]));stripe.setEulerAngles(...transform.rotation(config.stripe.rotation))
    })
  }
  return {legacyPlatform:platforms.find(item=>item.item.id==='legacy-platform')?.body,ready:Promise.all(visuals),update}
}
