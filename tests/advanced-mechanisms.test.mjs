import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import ts from 'typescript'
import * as pc from 'playcanvas'

const compile=(file,replacements=[])=>{
  let source=readFileSync(new URL(file,import.meta.url),'utf8')
  for(const [from,to] of replacements)source=source.replace(from,to)
  return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
}
const data=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const motionUrl=data(compile('../src/game/advanced-motion.ts'))
const groupsUrl=data(compile('../src/game/mechanism-groups.ts',[["'playcanvas'",`'${import.meta.resolve('playcanvas')}'`]]))
const libraryUrl=data(compile('../src/game/advanced-library.ts',[["'playcanvas'",`'${import.meta.resolve('playcanvas')}'`]]))
const source=compile('../src/game/advanced-mechanisms.ts',[["'playcanvas'",`'${import.meta.resolve('playcanvas')}'`],["'./advanced-motion'",`'${motionUrl}'`],["'./mechanism-groups'",`'${groupsUrl}'`],["'./advanced-library'",`'${libraryUrl}'`]])
const {createAdvancedMechanisms}=await import(data(source))

function harness(position=[0,4,0],velocity=new pc.Vec3()){
  const forces=[],impulses=[],bodies=[]
  const ball={getPosition:()=>new pc.Vec3(...position),rigidbody:{mass:1,linearVelocity:velocity,applyForce:(...value)=>forces.push(value),applyImpulse:(...value)=>impulses.push(value)}}
  const createBody=(config,type)=>{
    const handlers={},rigidbody={type,mass:1,linearVelocity:new pc.Vec3(),angularVelocity:new pc.Vec3(),teleport:()=>{},body:{activate:()=>{}},applyTorque:()=>{}},entity={name:config.name,render:{enabled:true},rigidbody,collision:{on:(name,callback)=>handlers[name]=callback},getPosition:()=>new pc.Vec3(...config.position),getRotation:()=>new pc.Quat(),setPosition:()=>{},setRotation:()=>{},setEulerAngles:()=>{},destroy:()=>{}}
    bodies.push({config,type,handlers,entity});return entity
  }
  return {ball,forces,impulses,bodies,createBody}
}
const base={id:'test',position:[0,0,0],yaw:0,phaseSeconds:0,visual:false}

test('蹦床只在上表面下落新接触追加一次冲量，重生后重装',()=>{
  const h=harness([0,3.9,0],new pc.Vec3(0,-2,0)),config={...base,kind:'spring-trampoline',deck:{name:'deck',type:'box',position:[0,3.25,0],size:[2.4,.3,2.4],material:'cream'},coreRadius:.75,outerRadius:1.1,storedEnergyJ:32,poweredNormalSpeedCeiling:8.5,rearmSeparationAboveSurface:.545,minimumRearmSeconds:.25}
  const runtime=createAdvancedMechanisms({},[config],h.createBody,h.ball,()=>{throw Error('no visual')})
  runtime.update(0);h.bodies[0].handlers.collisionstart({other:h.ball});h.bodies[0].handlers.collisionstart({other:h.ball});runtime.applyForces()
  assert.equal(h.impulses.length,1);assert.ok(h.impulses[0][1]>0)
  runtime.onRespawn();runtime.update(.1);h.bodies[0].handlers.collisionstart({other:h.ball});runtime.applyForces();assert.equal(h.impulses.length,2);runtime.destroy()
})

test('喷流只在有限体积和pulse施力，输送带只在真实deck接触时牵引',()=>{
  const jet=harness([1,3.8,0]),jetConfig={...base,kind:'pulse-jet',nozzles:[{position:[0,3.8,0],axis:[1,0,0],force:8,axialRange:[0,3],coreRadius:.55,outerRadius:.9,stages:[1.6,.7,.45,.25]}]}
  const jetRuntime=createAdvancedMechanisms({},[jetConfig],jet.createBody,jet.ball,()=>{throw Error('no visual')});jetRuntime.update(2.4);jetRuntime.applyForces();assert.equal(jet.forces.length,1);assert.ok(jet.forces[0][0]>0);jetRuntime.update(0);jetRuntime.applyForces();assert.equal(jet.forces.length,1)
  const belt=harness([0,4,0]),beltConfig={...base,kind:'reversing-conveyor',deck:{name:'deck',type:'box',position:[0,3.25,0],size:[1.4,.3,6],material:'cream'},axis:[0,0,-1],targetTreadSpeed:2.5,tractionForce:10,holdEachDirectionSeconds:2.2,reverseDecelSeconds:.6,zeroHoldSeconds:.3,reverseAccelSeconds:.6}
  const beltRuntime=createAdvancedMechanisms({},[beltConfig],belt.createBody,belt.ball,()=>{throw Error('no visual')});beltRuntime.update(0);beltRuntime.applyForces();assert.equal(belt.forces.length,0);belt.bodies[0].handlers.collisionstart({other:belt.ball});beltRuntime.applyForces();assert.equal(belt.forces.length,1);belt.bodies[0].handlers.collisionend({other:belt.ball});beltRuntime.applyForces();assert.equal(belt.forces.length,1)
  jetRuntime.destroy();beltRuntime.destroy()
})

test('坍塌桥接触满dwell后依次切为dynamic，安全重生恢复kinematic',()=>{
  const h=harness(),tile=index=>({name:`tile-${index}`,type:'box',position:[0,3.29,-index*1.52],size:[1.2,.22,1.4],material:'cream'})
  const config={...base,kind:'cascade-bridge',tiles:[tile(0),tile(1)],tileMass:.8,firstReleaseDelay:.85,releaseInterval:.42,visibleWarningBeforeEachRelease:.35,minimumContactDwell:.04}
  const runtime=createAdvancedMechanisms({},[config],h.createBody,h.ball,()=>{throw Error('no visual')})
  h.bodies[0].handlers.collisionstart({other:h.ball});runtime.update(0);runtime.update(.05);runtime.update(.91);assert.equal(h.bodies[0].entity.rigidbody.type,'dynamic');assert.equal(h.bodies[1].entity.rigidbody.type,'kinematic')
  runtime.update(1.34);assert.equal(h.bodies[1].entity.rigidbody.type,'dynamic');runtime.onRespawn();assert.ok(h.bodies.every(body=>body.entity.rigidbody.type==='kinematic'));runtime.destroy()
})
