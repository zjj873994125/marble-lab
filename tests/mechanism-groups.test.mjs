import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import * as pc from 'playcanvas'

const source=readFileSync(new URL('../src/game/mechanism-groups.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("'playcanvas'",`'${import.meta.resolve('playcanvas')}'`).replace(/^import type .*;?$/gm,'')
const {expandMechanisms,placement,placedPrimitive}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const box=(name,position)=>({name,type:'box',position,size:[1,1,1],material:'cream'})

test('旧单字段映射原点组，新组按组id展开且三锤/升降保留子项',()=>{
  const pendulum={ball:box('head',[0,1,0]),rod:box('rod',[0,2,0]),anchor:[0,3,0],angularSpeed:1,amplitude:1,lift:0,rodWidth:.1}
  const platform={body:box('body',[0,0,0]),stripe:box('stripe',[0,1,0]),centerZ:0,angularSpeed:1,amplitude:1,stripeY:1}
  const hammer={ball:box('h',[0,1,0]),rod:box('r',[0,2,0]),anchor:[0,3,0],rodLength:2,maxAngle:.4,angularSpeed:1,phase:0,rodWidth:.1}
  const lift={body:box('l',[0,0,0]),amplitude:1,angularSpeed:1,phase:0}
  const result=expandMechanisms({pendulum,platform,mechanismGroups:[{id:'hs',kind:'hammers',position:[1,2,3],yaw:90,phaseSeconds:.5,configs:[hammer,hammer]},{id:'ls',kind:'lifts',position:[4,5,6],configs:[lift,lift]}]})
  assert.equal(result.pendulums[0].id,'legacy-pendulum');assert.deepEqual(result.pendulums[0].origin,[0,0,0])
  assert.deepEqual(result.hammers.map(item=>item.id),['hs/1','hs/2']);assert.ok(result.hammers.every(item=>item.yaw===90&&item.phaseSeconds===.5))
  assert.deepEqual(result.lifts.map(item=>item.id),['ls/1','ls/2']);assert.equal(result.platforms[0].id,'legacy-platform')
})

test('局部-Z前/+X侧统一叠根yaw，primitive显示与碰撞共用完整TRS',()=>{
  const transform=placement([10,2,20],90)
  const forward=transform.point([0,0,-3]),side=transform.point([2,0,0])
  const expectedForward=new pc.Quat().setFromEulerAngles(0,90,0).transformVector(new pc.Vec3(0,0,-3)).add(new pc.Vec3(10,2,20)).toArray()
  expectedForward.forEach((value,index)=>assert.ok(Math.abs(forward[index]-value)<1e-6))
  assert.notDeepEqual(side,[12,2,20])
  const item={id:'unit',config:{},origin:[10,2,20],yaw:90,phaseSeconds:0},part=placedPrimitive(item,{...box('proxy',[1,3,-2]),rotation:[10,20,30]},'body')
  assert.equal(part.name,'unit/body');assert.deepEqual(part.position,transform.point([1,3,-2]));assert.deepEqual(part.rotation,transform.rotation([10,20,30]))
})
