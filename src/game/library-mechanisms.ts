import * as pc from 'playcanvas'
import { bodyPart, libraryEntry, libraryPose, pistonRodPose } from './library-data'
import { createPistonRodMotion } from './piston-rod'
import { createObstacleLibrary, type LibraryInstance } from './obstacle-library'
import { libraryFallback, updateLibraryVisual } from './library-visuals'
import type { LibraryMechanismConfig } from './library-types'
import type { Position, PrimitiveConfig } from './level-types'

type CreateBody = (config:PrimitiveConfig,body?:'static'|'dynamic'|'kinematic')=>pc.Entity
type NativeBody = {
  getWorldTransform:()=>{ getRotation:()=>{x:()=>number;y:()=>number;z:()=>number;w:()=>number} }
  setInterpolationWorldTransform?:(transform:unknown)=>void
  clearForces?:()=>void
}

export function createLibraryMechanisms(app:pc.Application,configs:LibraryMechanismConfig[],createBody:CreateBody,load:(file:string)=>Promise<pc.Asset>) {
  const library=createObstacleLibrary(load)
  let disposed=false
  const indicators:pc.StandardMaterial[]=[]
  const entities:pc.Entity[]=[],joints:pc.Entity[]=[]
  const nativeDisposers:(()=>void)[]=[]
  function makeBody(config:PrimitiveConfig,body?:'static'|'dynamic'|'kinematic') {
    const entity=createBody(config,body);entities.push(entity);return entity
  }
  function destroy() {
    if(disposed)return
    disposed=true
    joints.forEach(joint=>joint.destroy());library.destroy();entities.forEach(entity=>entity.destroy());nativeDisposers.forEach(dispose=>dispose());indicators.forEach(material=>material.destroy())
  }
  function createActor(config:LibraryMechanismConfig) {
    const primary=bodyPart(config.kind),entry=libraryEntry(config.kind),size=primary.bodySize!
    const yaw=new pc.Quat().setFromEulerAngles(0,config.yaw??0,0),origin=new pc.Vec3(...config.position)
    const point=(value:Position)=>yaw.transformVector(new pc.Vec3(...value)).add(origin)
    const orientation=(rotation:Position)=>new pc.Quat().mul2(yaw,new pc.Quat().setFromEulerAngles(...rotation))
    const worldPrimitive=(part:PrimitiveConfig):PrimitiveConfig=>({...part,name:`${config.id}/${part.name}`,position:point(part.position).toArray() as Position,rotation:orientation(part.rotation??[0,0,0]).getEulerAngles().toArray() as Position,refinedVisual:false})
    const neutral=libraryPose(config,0,0)
    const body=makeBody(worldPrimitive({name:'body',type:config.kind==='axial-roller'?'cylinder':'box',collisionAxis:config.kind==='axial-roller'?2:undefined,position:neutral.center,rotation:neutral.rotation,size,material:config.kind==='piston-wall'?'orange':'cream'}),config.kind==='weight-seesaw'?'dynamic':'kinematic')
    const rigid=body.rigidbody!
    let rodBody:pc.Entity|undefined,rodMotion:ReturnType<typeof createPistonRodMotion>|undefined
    if(config.kind==='piston-wall') {
      const rod=pistonRodPose(config,0)
      rodBody=makeBody(worldPrimitive({name:'rod-body',type:'cylinder',collisionAxis:2,position:rod.center,size:[rod.radius*2,rod.radius*2,rod.referenceLength],rotation:[0,90,0],material:'edge'}),'kinematic')
      rodMotion=createPistonRodMotion(app,rodBody,rod.referenceLength)
      nativeDisposers.push(()=>rodMotion!.destroy())
    }
    const staticBodies=(config.staticColliders??[]).map(part=>makeBody(worldPrimitive(part),'static'))
    const frameBodies=config.kind==='sway-cradle-bridge'?(config.frameColliders??[]).map(part=>({config:part,entity:makeBody(worldPrimitive(part),'kinematic')})):[]
    const visualRoot=new pc.Entity(`${config.id}/visuals`);entities.push(visualRoot);visualRoot.setPosition(origin);visualRoot.setRotation(yaw);app.root.addChild(visualRoot)
    const fallback=libraryFallback(config,0,config.kind==='weight-seesaw'?(config.restAngle??8):0).filter(part=>part.name!=='Library body'&&part.name!=='Piston rod').map(part=>({name:part.name,entity:makeBody(worldPrimitive(part),undefined)}))
    // 外观fallback不参与物理；可接触支架只取明确配置的小代理。
    staticBodies.forEach(entity=>{entity.render!.enabled=false})
    frameBodies.forEach(({entity})=>{entity.render!.enabled=false})
    let instance:LibraryInstance|undefined,joint:pc.Entity|undefined
    const localQuaternion=new pc.Quat(),rawQuaternion=new pc.Quat(),inverseYaw=yaw.clone().invert()
    const axis=yaw.transformVector(pc.Vec3.RIGHT)
    let warning:pc.Entity|undefined
    if(config.kind==='piston-wall'||config.kind==='timed-trapdoor') {
      const material=new pc.StandardMaterial();material.diffuse=new pc.Color(1,.47,.12);material.emissive=new pc.Color(.4,.1,.01);material.update();indicators.push(material)
      warning=new pc.Entity(`${config.id}/warning`);warning.addComponent('render',{type:'box',material,castShadows:false})
      warning.setLocalScale(config.kind==='piston-wall'?.3:.12,.1,config.kind==='piston-wall'?.18:.65)
      warning.setLocalPosition(config.kind==='piston-wall'?-2.5:-1.45,config.kind==='piston-wall'?4.35:3.68,config.kind==='piston-wall'?0:1.8)
      visualRoot.addChild(warning);warning.enabled=false
    }
    function readAngle() {
      const q=(rigid.body as NativeBody).getWorldTransform().getRotation()
      rawQuaternion.set(q.x(),q.y(),q.z(),q.w());localQuaternion.mul2(inverseYaw,rawQuaternion)
      let angle=2*Math.atan2(localQuaternion.x,localQuaternion.w)
      if(angle>Math.PI)angle-=2*Math.PI;if(angle<-Math.PI)angle+=2*Math.PI
      return angle
    }
    function sync(time:number,reset=false) {
      if(disposed)return
      const angle=config.kind==='weight-seesaw'?readAngle()*180/Math.PI:0
      const pose=libraryPose(config,time,angle)
      if(config.kind!=='weight-seesaw') {
        const position=point(pose.center),rotation=orientation(pose.rotation)
        if(reset){rigid.teleport(position,rotation);const native=rigid.body as NativeBody;native.setInterpolationWorldTransform?.(native.getWorldTransform())}
        else {body.setPosition(position);body.setRotation(rotation)}
      }
      if(config.kind==='piston-wall'&&rodMotion) {
        const rod=pistonRodPose(config,time)
        rodMotion.sync(rod.length,point(rod.center),orientation([0,90,0]),reset)
      }
      if(instance)updateLibraryVisual(instance,config,time,angle)
      const fallbackParts=libraryFallback(config,time,angle)
      for(const item of fallback){const part=fallbackParts.find(part=>part.name===item.name)!;item.entity.setPosition(point(part.position));item.entity.setRotation(orientation(part.rotation??[0,0,0]));if(part.type!=='capsule'&&!(part.type==='cylinder'&&part.collisionAxis===2))item.entity.setLocalScale(...part.size)}
      if(config.kind==='sway-cradle-bridge') {
        const rotation=new pc.Quat().setFromEulerAngles(...pose.rotation)
        for(const frame of frameBodies){const local=rotation.transformVector(new pc.Vec3(...frame.config.position)).add(new pc.Vec3(...pose.pivot));const world=point(local.toArray() as Position),q=new pc.Quat().mul2(orientation(pose.rotation),new pc.Quat().setFromEulerAngles(...(frame.config.rotation??[0,0,0])));if(reset){frame.entity.rigidbody!.teleport(world,q);const native=frame.entity.rigidbody!.body as NativeBody;native.setInterpolationWorldTransform?.(native.getWorldTransform())}else{frame.entity.setPosition(world);frame.entity.setRotation(q)}}
      }
      if(warning)warning.enabled=pose.warning
    }
    if(config.kind==='weight-seesaw') {
      const mass=config.mass??4,limit=config.limitAngle??8,rest=config.restAngle??8
      if(![mass,limit,rest,config.spring??25,config.damping??55].every(Number.isFinite)||mass<=0||limit<=0||Math.abs(rest)>limit||(config.spring??25)<0||(config.damping??55)<0)throw new Error(`跷跷板质量/限角/弹簧参数无效：${config.id}`)
      rigid.mass=mass;rigid.linearDamping=0;rigid.angularDamping=0
      // 以水平板建立零角参考，然后只在开局复位到无负载平衡角。
      joint=new pc.Entity(`${config.id}/hinge`);joints.push(joint);joint.setPosition(point(primary.position));joint.setRotation(yaw);app.root.addChild(joint)
      joint.addComponent('joint',{type:pc.JOINTTYPE_HINGE,entityA:body,entityB:null,enableLimits:true,limits:new pc.Vec2(-limit,limit),maxMotorForce:0,enableCollision:false})
    }
    function reset() {
      if(config.kind==='weight-seesaw') {
        const pose=libraryPose(config,0,config.restAngle??8)
        rigid.teleport(point(pose.center),orientation(pose.rotation));rigid.linearVelocity=pc.Vec3.ZERO;rigid.angularVelocity=pc.Vec3.ZERO;(rigid.body as NativeBody).clearForces?.()
      }
      sync(0,true)
    }
    reset()
    const ready=config.visual===false?Promise.resolve():library.instantiate(config.kind).then(loaded=>{
      if(disposed){loaded.destroy();return}
      instance=loaded;visualRoot.addChild(loaded.root);sync(0);loaded.root.enabled=true
      body.render!.enabled=false;if(rodBody)rodBody.render!.enabled=false;fallback.forEach(item=>{item.entity.render!.enabled=false})
    }).catch(error=>{instance?.destroy();instance=undefined;if(!disposed&&!(error instanceof DOMException&&error.name==='AbortError'))console.warn(`机关模型未加载：${entry.rootNode}，保留基础外观。`,error)})
    return {
      ready,reset,sync,
      applySpring(){
        if(config.kind!=='weight-seesaw')return
        const angle=readAngle(),omega=rigid.angularVelocity.dot(axis)
        const torque=-(config.spring??25)*(angle-(config.restAngle??8)*Math.PI/180)-(config.damping??55)*omega
        rigid.applyTorque(axis.x*torque,axis.y*torque,axis.z*torque)
      },
    }
  }
  let actors:ReturnType<typeof createActor>[]
  try { actors=configs.map(createActor) } catch(error) { destroy();throw error }
  return {
    ready:Promise.all(actors.map(actor=>actor.ready)),
    update(time:number){actors.forEach(actor=>actor.sync(time))},
    applyForces(){if(!disposed)actors.forEach(actor=>actor.applySpring())},
    reset(){if(!disposed)actors.forEach(actor=>actor.reset())},
    destroy,
  }
}
