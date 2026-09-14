import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync(new URL('../src/game/piston-rod.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;?$/gm,'').replace('export function','function')

test('推杆复用同一原生形状/向量，真实轴向缩放及回收刷新，卸载仅释放一次',()=>{
  let allocated=0,released=0,aabbs=0,teleports=0
  const sizes=[],renders=[]
  class Vector {constructor(){allocated++}setValue(...value){this.value=value}}
  const ammo={btVector3:Vector,destroy:()=>released++}
  const native={getWorldTransform:()=>({}),setInterpolationWorldTransform:()=>{}}
  const shape={setLocalScaling:scale=>sizes.push([...scale.value])}
  const entity={collision:{shape},rigidbody:{body:native,teleport:()=>teleports++},setPosition:()=>{},setRotation:()=>{},setLocalScale:(...size)=>renders.push(size)}
  const app={systems:{rigidbody:{physicsWorld:{nativeWorld:{updateSingleAabb:body=>{assert.equal(body,native);aabbs++}}}}}}
  const create=new Function('pc',`${js}; return createPistonRodMotion`)({WasmModule:{getInstance:(name,callback)=>{assert.equal(name,'Ammo');callback(ammo)}}})
  const rod=create(app,entity,.3)
  rod.sync(4,{},{});rod.sync(4,{},{});rod.sync(.3,{},{},true)
  assert.deepEqual(sizes,[[1,1,4/.3],[1,1,1]])
  assert.deepEqual(renders.at(-1),[1,1,1]);assert.equal(aabbs,3);assert.equal(teleports,1)
  assert.equal(allocated,1);assert.equal(entity.collision.shape,shape)
  rod.destroy();rod.destroy();rod.sync(4,{},{})
  assert.equal(released,1);assert.equal(aabbs,3)
})
