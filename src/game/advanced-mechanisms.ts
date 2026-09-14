import * as pc from 'playcanvas'
import { cascadeState, conveyorSpeed, jetIntensity, orbitalPose, radialWeight, springImpulse } from './advanced-motion'
import { placement } from './mechanism-groups'
import { createAdvancedLibrary, type AdvancedLibraryInstance } from './advanced-library'
import type { AdvancedMechanismConfig } from './advanced-types'
import type { Position, PrimitiveConfig } from './level-types'

type CreateBody=(config:PrimitiveConfig,body?:'static'|'dynamic'|'kinematic')=>pc.Entity
type NativeBody={getWorldTransform:()=>{getRotation:()=>{x:()=>number;y:()=>number;z:()=>number;w:()=>number}};clearForces?:()=>void;activate?:()=>void}
type Actor={ready:Promise<void>;update:(time:number)=>void;apply:()=>void;reset:()=>void;respawn:()=>void}
type ActorCore=Omit<Actor,'ready'>
const idle:ActorCore={update:()=>{},apply:()=>{},reset:()=>{},respawn:()=>{}}

export function createAdvancedMechanisms(app:pc.Application,configs:AdvancedMechanismConfig[],createBody:CreateBody,ball:pc.Entity,load:(file:string)=>Promise<pc.Asset>,decorate?:(entity:pc.Entity)=>void) {
  if(new Set(configs.map(config=>config.id)).size!==configs.length)throw new Error('高级机关id必须唯一')
  const entities:pc.Entity[]=[],joints:pc.Entity[]=[],actors:Actor[]=[]
  const ballRigid=ball.rigidbody!
  const library=createAdvancedLibrary(load,decorate)
  let disposed=false
  const make=(part:PrimitiveConfig,body:'static'|'dynamic'|'kinematic',config:AdvancedMechanismConfig)=>{
    const transform=placement(config.position,config.yaw??0)
    const entity=createBody({...part,name:`${config.id}/${part.name}`,position:transform.point(part.position),rotation:transform.rotation(part.rotation),refinedVisual:false},body)
    entities.push(entity);return entity
  }
  function createActor(config:AdvancedMechanismConfig):Actor {
    const transform=placement(config.position,config.yaw??0),yaw=new pc.Quat().setFromEulerAngles(0,config.yaw??0,0),phase=config.phaseSeconds??0
    const firstEntity=entities.length
    let visual:AdvancedLibraryInstance|undefined
    const complete=(actor:ActorCore,onReady?:(instance:AdvancedLibraryInstance)=>void):Actor=>{
      const ready=config.visual===false?Promise.resolve():library.instantiate(config.kind).then(instance=>{
        if(disposed){instance.destroy();return}
        visual=instance;instance.root.setPosition(...config.position);instance.root.setEulerAngles(0,config.yaw??0,0);app.root.addChild(instance.root);onReady?.(instance);instance.root.enabled=true
        entities.slice(firstEntity).forEach(entity=>{if(entity.render)entity.render.enabled=false})
      }).catch(error=>{visual?.destroy();visual=undefined;if(!disposed&&!(error instanceof DOMException&&error.name==='AbortError'))console.warn(`高级机关模型未加载：${config.kind}，保留基础外观。`,error)})
      return {...actor,ready}
    }
    if(config.kind==='gravity-coaster'||config.kind==='vortex-funnel'){
      config.colliders.forEach(part=>make(part,'static',config));return complete(idle)
    }
    if(config.kind==='spring-trampoline'){
      const deck=make(config.deck,'kinematic',config),top=config.deck.position[1]+config.deck.size[1]/2,inverseYaw=yaw.clone().invert(),origin=new pc.Vec3(...config.position)
      let spent=false,firedAt=-Infinity,lastVelocityY=0,approachVelocityY=0,time=0,pendingVelocityY:number|undefined
      const hit=(event:{other:pc.Entity})=>{
        if(disposed||spent||event.other!==ball)return
        const incoming=Math.min(lastVelocityY,ballRigid.linearVelocity.y)
        if(incoming<-.5)pendingVelocityY=Math.min(pendingVelocityY??0,incoming)
      }
      deck.collision!.on('collisionstart',hit)
      ball.collision?.on('collisionstart',(event:{other:pc.Entity})=>{if(event.other===deck)hit({other:ball})})
      const reset=()=>{spent=false;firedAt=-Infinity;lastVelocityY=0;approachVelocityY=0;pendingVelocityY=undefined}
      return complete({update(value){time=value+phase;const local=inverseYaw.transformVector(ball.getPosition().clone().sub(origin)),currentVelocityY=ballRigid.linearVelocity.y,radial=Math.hypot(local.x-config.deck.position[0],local.z-config.deck.position[2]),atSurface=Math.abs(local.y-(top+.425))<.08;if(radial<config.outerRadius&&local.y>top+.46&&local.y<top+1.6)approachVelocityY=Math.min(approachVelocityY,currentVelocityY,lastVelocityY);else if(radial>=config.outerRadius)approachVelocityY=0;if(!spent&&pendingVelocityY===undefined&&atSurface&&radial<config.outerRadius&&currentVelocityY>-.3&&approachVelocityY<-.5){pendingVelocityY=approachVelocityY;approachVelocityY=0}if(spent&&time-firedAt>=config.minimumRearmSeconds&&local.y>top+config.rearmSeparationAboveSurface)spent=false;lastVelocityY=currentVelocityY},apply(){
        if(pendingVelocityY===undefined||spent)return
        const incoming=pendingVelocityY;pendingVelocityY=undefined
        const local=inverseYaw.transformVector(ball.getPosition().clone().sub(origin))
        if(incoming>=-.5||local.y<top||local.y>top+1.1)return
        const weight=radialWeight(Math.hypot(local.x-config.deck.position[0],local.z-config.deck.position[2]),config.coreRadius,config.outerRadius)
        const impulse=springImpulse(Math.max(0,ballRigid.linearVelocity.y),ballRigid.mass,config.storedEnergyJ,config.poweredNormalSpeedCeiling,weight)
        if(impulse>0){spent=true;firedAt=time;ballRigid.applyImpulse(0,impulse,0)}
      },reset,respawn:reset})
    }
    if(config.kind==='pulse-jet'){
      config.staticColliders?.forEach(part=>make(part,'static',config))
      let time=0
      return complete({update(value){time=value+phase;if(visual){const active=config.nozzles.some(nozzle=>jetIntensity(time,nozzle).intensity>0),warning=config.nozzles.some(nozzle=>jetIntensity(time,nozzle).warning);visual.part('PulseJet_Flow').enabled=active;visual.part('PulseJet_Valve').setLocalEulerAngles(0,0,warning?18:active?32:0)}},apply(){
        const ballPosition=ball.getPosition()
        for(const nozzle of config.nozzles){
          const origin=transform.point(nozzle.position),axis=yaw.transformVector(new pc.Vec3(...nozzle.axis)).normalize(),delta=ballPosition.clone().sub(new pc.Vec3(...origin)),axial=delta.dot(axis)
          if(axial<nozzle.axialRange[0]||axial>nozzle.axialRange[1])continue
          const radial=delta.clone().sub(axis.clone().mulScalar(axial)).length(),pulse=jetIntensity(time,nozzle).intensity
          if(!pulse)continue
          const radialForce=radialWeight(radial,nozzle.coreRadius,nozzle.outerRadius),range=nozzle.axialRange[1]-nozzle.axialRange[0],farStart=nozzle.axialRange[0]+range*.75
          const axialForce=axial<=farStart?1:1-Math.min(1,(axial-farStart)/Math.max(.001,range*.25)),force=nozzle.force*radialForce*axialForce*pulse
          if(force>0)ballRigid.applyForce(axis.x*force,axis.y*force,axis.z*force)
        }
      },reset:()=>{time=0},respawn:()=>{}})
    }
    if(config.kind==='orbital-catcher'){
      const parts=config.parts.map(part=>({part,entity:make(part,'kinematic',config)}))
      const sync=(value:number,reset=false)=>{const offset=orbitalPose(value+phase,config).offset;for(const item of parts){const local=item.part.position.map((coordinate,index)=>coordinate+offset[index]!) as Position,position=transform.point(local),rotation=transform.rotation(item.part.rotation),quaternion=new pc.Quat().setFromEulerAngles(...rotation);if(reset)item.entity.rigidbody!.teleport(new pc.Vec3(...position),quaternion);else{item.entity.setPosition(...position);item.entity.setRotation(quaternion)}}if(visual)visual.part('OrbitalCatcher_Carriage').setLocalPosition(...offset)}
      return complete({update:value=>sync(value),apply:()=>{},reset:()=>sync(0,true),respawn:()=>{}},()=>sync(0))
    }
    if(config.kind==='reversing-conveyor'){
      const deck=make(config.deck,'static',config),contacts=new Set<pc.Entity>(),axis=yaw.transformVector(new pc.Vec3(...config.axis)).normalize()
      let time=0
      deck.collision!.on('collisionstart',(event:{other:pc.Entity})=>{if(event.other===ball)contacts.add(event.other)})
      deck.collision!.on('collisionend',(event:{other:pc.Entity})=>contacts.delete(event.other))
      ball.collision?.on('collisionstart',(event:{other:pc.Entity})=>{if(event.other===deck)contacts.add(ball)})
      ball.collision?.on('collisionend',(event:{other:pc.Entity})=>{if(event.other===deck)contacts.delete(ball)})
      return complete({update:value=>{time=value+phase},apply(){if(!contacts.has(ball))return;const target=conveyorSpeed(time,config),current=ballRigid.linearVelocity.dot(axis),force=Math.max(-config.tractionForce,Math.min(config.tractionForce,(target-current)*8));ballRigid.applyForce(axis.x*force,axis.y*force,axis.z*force)},reset(){time=0;contacts.clear()},respawn(){contacts.clear()}})
    }
    if(config.kind==='gimbal-platform'){
      const outer=make(config.outerFrame,'dynamic',config),inner=make(config.innerDeck,'dynamic',config),outerRigid=outer.rigidbody!,innerRigid=inner.rigidbody!
      outerRigid.mass=config.outerFrameMass;innerRigid.mass=config.innerMass;outerRigid.linearDamping=0;outerRigid.angularDamping=0;innerRigid.linearDamping=0;innerRigid.angularDamping=0
      const outerJoint=new pc.Entity(`${config.id}/outer-hinge`),innerJoint=new pc.Entity(`${config.id}/inner-hinge`);joints.push(outerJoint,innerJoint)
      outerJoint.setPosition(...transform.point(config.outerPivot));outerJoint.setRotation(yaw);app.root.addChild(outerJoint)
      outerJoint.addComponent('joint',{type:pc.JOINTTYPE_HINGE,entityA:outer,entityB:null,enableLimits:true,limits:new pc.Vec2(-config.limitsDegrees[0],config.limitsDegrees[0]),maxMotorForce:0,enableCollision:false})
      innerJoint.setPosition(...transform.point(config.innerPivot));innerJoint.setRotation(new pc.Quat().mul2(yaw,new pc.Quat().setFromEulerAngles(0,-90,0)));app.root.addChild(innerJoint)
      innerJoint.addComponent('joint',{type:pc.JOINTTYPE_HINGE,entityA:inner,entityB:outer,enableLimits:true,limits:new pc.Vec2(-config.limitsDegrees[1],config.limitsDegrees[1]),maxMotorForce:0,enableCollision:false})
      const rawQuaternion=(rigid:pc.RigidBodyComponent)=>{const q=(rigid.body as NativeBody).getWorldTransform().getRotation();return new pc.Quat(q.x(),q.y(),q.z(),q.w())}
      const angle=(q:pc.Quat,component:'x'|'z')=>{let value=2*Math.atan2(q[component],q.w);if(value>Math.PI)value-=2*Math.PI;if(value<-Math.PI)value+=2*Math.PI;return value}
      const reset=()=>{
        const outerRotation=new pc.Quat().mul2(yaw,new pc.Quat().setFromEulerAngles(config.restAnglesDegrees[0],0,0)),innerRotation=new pc.Quat().mul2(outerRotation,new pc.Quat().setFromEulerAngles(0,0,config.restAnglesDegrees[1]))
        outerRigid.teleport(new pc.Vec3(...transform.point(config.outerFrame.position)),outerRotation);innerRigid.teleport(new pc.Vec3(...transform.point(config.innerDeck.position)),innerRotation)
        for(const rigid of [outerRigid,innerRigid]){rigid.linearVelocity=pc.Vec3.ZERO;rigid.angularVelocity=pc.Vec3.ZERO;(rigid.body as NativeBody).clearForces?.()}
      }
      reset()
      const syncVisual=()=>{if(!visual)return;for(const [path,entity] of [['GimbalPlatform_OuterFrame',outer],['GimbalPlatform_OuterFrame/GimbalPlatform_InnerDeck',inner]] as const){visual.part(path).setPosition(entity.getPosition());visual.part(path).setRotation(entity.getRotation())}}
      return complete({update:syncVisual,apply(){
        const outerRotation=rawQuaternion(outerRigid),outerLocal=new pc.Quat().mul2(yaw.clone().invert(),outerRotation),outerAngle=angle(outerLocal,'x'),outerAxis=yaw.transformVector(pc.Vec3.RIGHT),outerOmega=outerRigid.angularVelocity.dot(outerAxis),outerTorque=-config.springEach*(outerAngle-config.restAnglesDegrees[0]*Math.PI/180)-config.dampingEach*outerOmega
        outerRigid.applyTorque(outerAxis.x*outerTorque,outerAxis.y*outerTorque,outerAxis.z*outerTorque)
        const innerRotation=rawQuaternion(innerRigid),innerLocal=new pc.Quat().mul2(outerRotation.clone().invert(),innerRotation),innerAngle=angle(innerLocal,'z'),innerAxis=outerRotation.transformVector(new pc.Vec3(0,0,1)),innerOmega=innerRigid.angularVelocity.dot(innerAxis),innerTorque=-config.springEach*(innerAngle-config.restAnglesDegrees[1]*Math.PI/180)-config.dampingEach*innerOmega
        innerRigid.applyTorque(innerAxis.x*innerTorque,innerAxis.y*innerTorque,innerAxis.z*innerTorque)
      },reset,respawn:()=>{}},syncVisual)
    }
    const tiles=config.tiles.map((part,index)=>{const entity=make(part,'kinematic',config);return {index,entity,position:entity.getPosition().clone(),rotation:entity.getRotation().clone(),released:false}}),contacts=new Set<number>()
    let time=0,triggerTime:number|undefined,triggerIndex=0,touchIndex:number|undefined,touchSince=0
    tiles.forEach(tile=>{tile.entity.collision!.on('collisionstart',(event:{other:pc.Entity})=>{if(event.other===ball)contacts.add(tile.index)});tile.entity.collision!.on('collisionend',(event:{other:pc.Entity})=>{if(event.other===ball)contacts.delete(tile.index)});ball.collision?.on('collisionstart',(event:{other:pc.Entity})=>{if(event.other===tile.entity)contacts.add(tile.index)});ball.collision?.on('collisionend',(event:{other:pc.Entity})=>{if(event.other===tile.entity)contacts.delete(tile.index)})})
    const reset=()=>{triggerTime=undefined;triggerIndex=0;touchIndex=undefined;contacts.clear();for(const tile of tiles){tile.released=false;tile.entity.rigidbody!.type='kinematic';tile.entity.rigidbody!.teleport(tile.position,tile.rotation);tile.entity.rigidbody!.linearVelocity=pc.Vec3.ZERO;tile.entity.rigidbody!.angularVelocity=pc.Vec3.ZERO}}
    reset()
    const syncTiles=()=>{if(!visual)return;for(const tile of tiles){const node=visual.part(`CascadeBridge_Tile${String(tile.index+1).padStart(2,'0')}`);node.setPosition(tile.entity.getPosition());node.setRotation(tile.entity.getRotation())}}
    return complete({update(value){time=value+phase;if(triggerTime===undefined){const touched=[...contacts].sort((a,b)=>a-b)[0];if(touched===undefined)touchIndex=undefined;else if(touchIndex!==touched){touchIndex=touched;touchSince=time}else if(time-touchSince>=config.minimumContactDwell){triggerTime=time;triggerIndex=touched}}if(triggerTime!==undefined)for(const tile of tiles){if(tile.index<triggerIndex||tile.released||!cascadeState(time,triggerTime,tile.index-triggerIndex,config).released)continue;tile.released=true;const rigid=tile.entity.rigidbody!;rigid.type='dynamic';rigid.mass=config.tileMass;(rigid.body as NativeBody).activate?.()}syncTiles()},apply:()=>{},reset,respawn:reset},syncTiles)
  }
  try{configs.forEach(config=>actors.push(createActor(config)))}catch(error){library.destroy();joints.forEach(joint=>joint.destroy());entities.forEach(entity=>entity.destroy());throw error}
  return {ready:Promise.all(actors.map(actor=>actor.ready)),update(time:number){if(!disposed)actors.forEach(actor=>actor.update(time))},applyForces(){if(!disposed)actors.forEach(actor=>actor.apply())},reset(){if(!disposed)actors.forEach(actor=>actor.reset())},onRespawn(){if(!disposed)actors.forEach(actor=>actor.respawn())},destroy(){if(disposed)return;disposed=true;joints.forEach(joint=>joint.destroy());entities.forEach(entity=>entity.destroy());library.destroy()}}
}
