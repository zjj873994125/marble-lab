import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import ts from 'typescript'

const source=readFileSync(new URL('../src/game/advanced-motion.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;?$/gm,'')
const motion=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('蹦床径向衰减与能量上限只追加向外冲量',()=>{
  assert.equal(motion.radialWeight(.5,.75,1.1),1);assert.equal(motion.radialWeight(1.1,.75,1.1),0)
  assert.equal(motion.springImpulse(0,1,32,8.5,1),8);assert.equal(motion.springImpulse(9,1,32,8.5,1),0)
  assert.ok(motion.springImpulse(0,1,32,8.5,.5)<8)
})

test('喷流预告不施力，pulse全力，decay连续降为零',()=>{
  const nozzle={stages:[1.6,.7,.45,.25]}
  assert.deepEqual(motion.jetIntensity(1.8,nozzle),{intensity:0,warning:true})
  assert.equal(motion.jetIntensity(2.4,nozzle).intensity,1)
  const fading=motion.jetIntensity(2.85,nozzle).intensity;assert.ok(fading>0&&fading<1);assert.equal(motion.jetIntensity(3,nozzle).intensity,0)
})

test('输送带正反保持、减速、零速和反向加速组成7.4秒周期',()=>{
  const config={kind:'reversing-conveyor',targetTreadSpeed:2.5,holdEachDirectionSeconds:2.2,reverseDecelSeconds:.6,zeroHoldSeconds:.3,reverseAccelSeconds:.6}
  assert.equal(motion.conveyorSpeed(0,config),2.5);assert.equal(motion.conveyorSpeed(2.8,config),0);assert.equal(motion.conveyorSpeed(3.7,config),-2.5)
  assert.equal(motion.conveyorSpeed(7.4,config),2.5)
})

test('接球斗减速到dock并停留，坍塌板按一次触发时间顺序释放',()=>{
  const catcher={kind:'orbital-catcher',period:6,brakingSeconds:.35,settleHoldSeconds:.65,dockHoldSeconds:1,dockAngleDegrees:90,orbitAmplitude:[1,0,.4]}
  const docked=motion.orbitalPose(2,catcher);assert.equal(docked.progress,1);assert.equal(docked.docked,true)
  const bridge={kind:'cascade-bridge',firstReleaseDelay:.85,releaseInterval:.42,visibleWarningBeforeEachRelease:.35}
  assert.deepEqual(motion.cascadeState(1,undefined,0,bridge),{warning:false,released:false})
  assert.equal(motion.cascadeState(1.6,1,0,bridge).warning,true);assert.equal(motion.cascadeState(1.86,1,0,bridge).released,true)
  assert.equal(motion.cascadeState(1.86,1,1,bridge).released,false)
})
