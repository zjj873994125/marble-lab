import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { Quat, Vec3 } from 'playcanvas'

const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {default:level}=await import(`data:text/javascript;base64,${Buffer.from(compile(readFileSync(new URL('../src/levels/water-rush.ts',import.meta.url),'utf8'))).toString('base64')}`)
const layout=JSON.parse(readFileSync(new URL('../docs/levels/water-rush-layout.json',import.meta.url),'utf8'))

test('第二关使用三圆弧锤、五盒十字和四升降，动态件没有静态替身',()=>{
  assert.equal(level.id,'water-rush');assert.ok(['standard','challenge','serpentine'].includes(level.rulesVersion));assert.equal(level.pendulum,undefined)
  assert.equal(level.hammers.length,3);assert.equal(level.turntable.parts.length,5);assert.equal(level.lifts.length,4)
  assert.equal(level.checkpoints.length,3);assert.equal(level.progress.length,4)
  const objects=[...level.staticObjects,...level.turntable.parts,...level.lifts.map(l=>l.body),...level.hammers.flatMap(h=>[h.ball,h.rod]),level.platform.body,level.platform.stripe]
  assert.equal(new Set(objects.map(x=>x.name)).size,objects.length)
  for(const object of objects){assert.ok(object.position.every(Number.isFinite));assert.ok(object.size.every(x=>Number.isFinite(x)&&x>0))}
  level.hammers.forEach((hammer,i)=>{assert.equal(hammer.ball.type,'cylinder');assert.equal(hammer.ball.collisionAxis,2);assert.equal(hammer.rod.body,undefined);assert.equal(hammer.rodLength,layout.hammers[i].motion.rodLength);assert.equal(hammer.phase,layout.hammers[i].motion.phase)})
  for(const part of level.turntable.parts){assert.equal(part.type,'box');assert.equal(part.body,undefined);assert.equal(part.rotation,undefined)}
  for(const x of [-2,2])for(const z of [-2,2])assert.equal(level.turntable.parts.some(p=>Math.abs(x-p.position[0])<=p.size[0]/2&&Math.abs(z-p.position[2])<=p.size[2]/2),false)
  for(const suffix of ['entry','exit']){const port=level.staticObjects.find(o=>o.name===`turntable-${suffix}-tongue`);assert.equal(port.position[0],level.turntable.position[0])}
})

test('真实旋转盒坡面与设计端点一致，检查点始终落在固定安全台面',()=>{
  for(const ramp of layout.ramps){
    const body=level.staticObjects.find(o=>o.name===ramp.id)
    const rotation=new Quat().setFromEulerAngles(...body.rotation)
    const riseX=rotation.transformVector(new Vec3(1,0,0)).y,riseZ=rotation.transformVector(new Vec3(0,0,1)).y
    const axis=Math.abs(riseX)>Math.abs(riseZ)?0:2,lowerSign=(axis===0?riseX:riseZ)<0?1:-1
    for(const [sign,expected] of [[lowerSign,ramp.topStart],[-lowerSign,ramp.topEnd]]){
      const p=rotation.transformVector(new Vec3(axis===0?sign*body.size[0]/2:0,body.size[1]/2,axis===2?sign*body.size[2]/2:0)).add(new Vec3(...body.position))
      p.toArray().forEach((value,axis)=>assert.ok(Math.abs(value-expected[axis])<1e-6))
    }
  }
  for(const checkpoint of level.checkpoints){
    assert.ok(level.staticObjects.some(o=>o.body==='static'&&!o.rotation&&Math.abs(checkpoint.position[0]-o.position[0])+.425<o.size[0]/2&&Math.abs(checkpoint.position[2]-o.position[2])+.425<o.size[2]/2&&Math.abs(checkpoint.position[1]-(o.position[1]+o.size[1]/2+.55))<.01))
  }
})

test('正式第二关资源自包含且使用约定根节点，动件资源按实例共享',()=>{
  const expected=new Map([[level.visuals?.track,'TrackStatic'],[level.visuals?.platform,'PlatformVisual'],[level.turntable.visual,'TurntableVisual'],[level.lifts[0].visual,'LiftVisual'],[level.hammers[0].visuals?.head,'HammerHead'],[level.hammers[0].visuals?.handle,'HammerHandle']].filter(([file])=>file))
  assert.ok(level.lifts.every(l=>l.visual===level.lifts[0].visual))
  assert.ok(level.hammers.every(h=>h.visuals.head===level.hammers[0].visuals.head&&h.visuals.handle===level.hammers[0].visuals.handle))
  for(const [file,node] of expected){const bytes=readFileSync(new URL(`../public/models/${file}`,import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67);const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.ok(gltf.nodes.some(n=>n.name===node));assert.ok((gltf.buffers??[]).every(b=>!b.uri));assert.ok((gltf.images??[]).every(i=>!i.uri))}
})
