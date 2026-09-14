import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import ts from 'typescript'

const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const source=readFileSync(new URL('../src/levels/advanced-trial.ts',import.meta.url),'utf8')
const {default:level}=await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`)
const progressSource=readFileSync(new URL('../src/game/course-progress.ts',import.meta.url),'utf8')
const progressJs=compile(progressSource).replace(/^import .*;?$/gm,'').replace('export function','function')
const createCourseProgress=new Function(`${progressJs};return createCourseProgress`)()
const expectedKinds=['spring-trampoline','gravity-coaster','pulse-jet','orbital-catcher','reversing-conveyor','vortex-funnel','gimbal-platform','cascade-bridge']
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)

test('高阶试验场13实例覆盖8机关，代理数值和安全CP完整',()=>{
  assert.equal(level.id,'advanced-trial');assert.equal(level.rulesVersion,'standard');assert.equal(level.advancedMechanisms.length,13)
  assert.deepEqual([...new Set(level.advancedMechanisms.map(item=>item.kind))].sort(),[...expectedKinds].sort())
  assert.equal(new Set(level.advancedMechanisms.map(item=>item.id)).size,13);assert.equal(level.course.checkpoints.length,10);assert.equal(level.course.gates.length,13)
  const primitives=[...level.staticObjects]
  for(const config of level.advancedMechanisms){
    assert.ok(vector(config.position));assert.equal(config.visual,true)
    if(config.kind==='spring-trampoline'||config.kind==='reversing-conveyor')primitives.push(config.deck)
    else if(config.kind==='gravity-coaster'||config.kind==='vortex-funnel')primitives.push(...config.colliders)
    else if(config.kind==='pulse-jet')primitives.push(...(config.staticColliders??[]))
    else if(config.kind==='orbital-catcher')primitives.push(...config.parts)
    else if(config.kind==='gimbal-platform')primitives.push(config.outerFrame,config.innerDeck)
    else primitives.push(...config.tiles)
  }
  for(const item of primitives){assert.ok(vector(item.position));assert.ok(vector(item.size)&&item.size.every(value=>value>0));if(item.rotation)assert.ok(vector(item.rotation))}
  const coaster=level.advancedMechanisms.find(item=>item.kind==='gravity-coaster');assert.equal(coaster.colliders.length,129);assert.equal(coaster.colliders.filter(item=>item.name.startsWith('coaster-deck')).length,43)
  const funnel=level.advancedMechanisms.find(item=>item.kind==='vortex-funnel');assert.equal(funnel.colliders.filter(item=>item.name.startsWith('funnel-')).length,96)
  const inner=funnel.colliders.filter(item=>item.name.startsWith('funnel-1-'))
  assert.ok(inner.every(item=>Math.hypot(item.position[0],item.position[2])-Math.max(item.size[0],item.size[2])/2>.64))
})

test('高阶试验场23步完整有向路线可完成，跳过gate无效',()=>{
  const route=level.course.routes[0],progress=createCourseProgress(level.course),gates=new Map(level.course.gates.map(item=>[item.id,item])),checkpoints=new Map(level.course.checkpoints.map(item=>[item.id,item]))
  assert.equal(route.id,'main');assert.equal(route.steps.length,23);assert.equal(route.checkpointIds.length,10)
  const pass=step=>{
    if(step.kind==='checkpoint'){const point=checkpoints.get(step.id);return progress.advance(point.respawn,point.respawn)}
    const gate=gates.get(step.id),before=gate.position.map((value,index)=>value-gate.forward[index]*.2),after=gate.position.map((value,index)=>value+gate.forward[index]*.2)
    return progress.advance(before,after)
  }
  assert.equal(pass(route.steps[1]),undefined)
  route.steps.forEach(step=>assert.equal(pass(step)?.id,step.id))
  assert.equal(progress.complete(),true);assert.equal(progress.checkpointCount(),10);assert.equal(progress.route(),'main')
})

test('高级共享GLB恰好8根、自包含，manifest分件路径均真实存在',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/models/advanced-obstacle-library.json',import.meta.url),'utf8')),bytes=readFileSync(new URL('../public/models/advanced-obstacle-library.glb',import.meta.url))
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.asset,'advanced-obstacle-library.glb');assert.deepEqual(manifest.entries.map(item=>item.id).sort(),[...expectedKinds].sort())
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length)
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),children=new Set(gltf.nodes.flatMap(node=>node.children??[])),roots=gltf.nodes.map((node,index)=>({node,index})).filter(item=>!children.has(item.index)).map(item=>item.node.name)
  assert.deepEqual(roots,manifest.entries.map(item=>item.rootNode));assert.ok((gltf.buffers??[]).every(item=>!item.uri));assert.ok((gltf.images??[]).every(item=>!item.uri))
  const names=new Set(gltf.nodes.map(node=>node.name));for(const entry of manifest.entries)for(const part of entry.parts)assert.ok(names.has(part.nodePath.split('/').at(-1)),`${entry.id}/${part.nodePath}`)
})

test('高阶试验场正式引用自包含TrackStatic静态轨道',()=>{
  assert.deepEqual(level.visuals,{track:'advanced-trial-track.glb'})
  const bytes=readFileSync(new URL('../public/models/advanced-trial-track.glb',import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length)
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),children=new Set(gltf.nodes.flatMap(node=>node.children??[])),roots=gltf.nodes.map((node,index)=>({node,index})).filter(item=>!children.has(item.index)).map(item=>item.node.name)
  assert.deepEqual(roots,['TrackStatic']);assert.ok((gltf.buffers??[]).every(item=>!item.uri));assert.ok((gltf.images??[]).every(item=>!item.uri))
})

test('图鉴源码登记8个新id，总数由13扩为21',()=>{
  const catalog=readFileSync(new URL('../src/game/obstacles.ts',import.meta.url),'utf8')
  expectedKinds.forEach(id=>assert.match(catalog,new RegExp(`id:'${id}'`)))
  assert.equal((catalog.match(/\{id:'/g)??[]).length,13)
  assert.match(catalog,/obstacleCatalog\.push\(\.\.\.advancedCards/)
})
