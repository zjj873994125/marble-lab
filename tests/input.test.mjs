import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync(new URL('../src/game/input.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {joystickVector,resolveInput,createTouchInput}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('摇杆死区、部分幅度与拖出后的钳制保持向量不超过1',()=>{
  assert.deepEqual(joystickVector(3,2,40),{x:0,z:0})
  assert.ok(Math.abs(joystickVector(22.4,0,40).x-.5)<1e-9)
  assert.deepEqual(joystickVector(100,0,40),{x:1,z:0})
  const diagonal=joystickVector(80,-80,40)
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-9);assert.ok(diagonal.z<0)
  assert.deepEqual(joystickVector(NaN,0,40),{x:0,z:0})
})

test('双指摇杆与刹车独立，松开或取消一指不清除另一指',()=>{
  let value
  const control=createTouchInput(input=>{value=input})
  assert.equal(control.startJoystick(11,40,0,40),true)
  assert.equal(control.startBrake(11),false)
  assert.equal(control.startBrake(22),true)
  assert.deepEqual(value,{x:1,z:0,brake:true})
  control.release(22);assert.deepEqual(value,{x:1,z:0,brake:false})
  control.startBrake(23);control.release(11)
  assert.deepEqual(value,{x:0,z:0,brake:true})
  control.release(99);assert.equal(value.brake,true)
  control.moveJoystick(11,-40,0,40);assert.equal(value.x,0)
  control.release(23);assert.deepEqual(value,{x:0,z:0,brake:false})
})

test('中断重置指针与输入，旧指针移动不能恢复已结束的手势',()=>{
  let value
  const control=createTouchInput(input=>{value=input})
  control.startJoystick(1,0,-40,40);control.startBrake(2);control.reset()
  assert.equal(control.joystickPointer,null);assert.equal(control.brakePointer,null)
  control.moveJoystick(1,40,0,40);control.release(2)
  assert.deepEqual(value,{x:0,z:0,brake:false})
  assert.equal(control.startJoystick(3,20,0,40),true)
  assert.ok(value.x>0&&value.x<1)
})

test('键盘方向优先且不与触控叠加，刹车按两个输入来源合并',()=>{
  const diagonal=resolveInput(new Set(['KeyW','KeyD']),{x:1,z:1,brake:true})
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-9);assert.ok(diagonal.z<0);assert.equal(diagonal.brake,true)
  assert.deepEqual(resolveInput(new Set(['ArrowLeft']),{x:1,z:0,brake:false}),{x:-1,z:0,brake:false})
  assert.deepEqual(resolveInput(new Set(),{x:.25,z:0,brake:false}),{x:.25,z:0,brake:false})
  assert.equal(resolveInput(new Set(['Space'])).brake,true)
  assert.deepEqual(resolveInput(new Set(),{x:NaN,z:Infinity,brake:false}),{x:0,z:0,brake:false})
})
