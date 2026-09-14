import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const manifest = readFileSync(new URL('../public/models/obstacle-library.json', import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const levelSource = readFileSync(new URL('../src/levels/mechanism-trial.ts', import.meta.url), 'utf8')
const { default: trial } = await import(`data:text/javascript;base64,${Buffer.from(compile(levelSource)).toString('base64')}`)
const source = readFileSync(new URL('../src/game/library-data.ts', import.meta.url), 'utf8')
  .replace("import manifestData from '../../public/models/obstacle-library.json'", `const manifestData = ${manifest}`)
  .replace("import mechanismTrial from '../levels/mechanism-trial'", `const mechanismTrial = ${JSON.stringify(trial)}`)
const { libraryPose, bodyPart, previewLibraryConfig, pistonRodPose } = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`)
const config = kind => ({ id: kind, kind, position: [0, 0, 0] })
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`)

test('图鉴使用正式第三关的机关参数，只归零展示位置和朝向', () => {
  for (const mechanism of trial.mechanisms) {
    const preview = previewLibraryConfig(mechanism.kind)
    assert.deepEqual(preview, { ...mechanism, id: `preview-${mechanism.kind}`, position: [0,0,0], yaw: 0 })
    for (const time of [0, .45, 1.5, 2.25, 5]) assert.deepEqual(libraryPose(preview, time), libraryPose(mechanism, time))
  }
})

test('推杆整个周期始终从固定缸口接到推头后缘，回收不残留全长', () => {
  const piston=trial.mechanisms.find(item=>item.kind==='piston-wall')
  const stages=piston.stages,cycle=stages.reduce((sum,duration)=>sum+duration,0)
  const closed=pistonRodPose(piston,0)
  near(closed.length,.3);near(closed.radius,.08)
  for(let sample=0;sample<=100;sample++) {
    const time=cycle*sample/100,rod=pistonRodPose(piston,time),head=libraryPose(piston,time)
    near(rod.center[0]-rod.length/2,-2.5)
    near(rod.center[0]+rod.length/2,head.center[0]-bodyPart('piston-wall').bodySize[0]/2)
    assert.ok(rod.length>=.3-1e-6&&rod.length<=4+1e-6)
    near(rod.radius,closed.radius)
  }
  const hold=stages[0]+stages[1]+stages[2]+stages[3]/2
  near(pistonRodPose(piston,hold).length,4)
  near(pistonRodPose(piston,cycle).length,closed.length)
})

// 只验证时序与几何契约，不把姿态单测当作Ammo接触或可通性验收。
test('推墙五阶段与翻板预告不增加安全时长，打开后板心绕侧轴下移', () => {
  const piston = config('piston-wall')
  assert.equal(libraryPose(piston, 2.99).warning, false)
  assert.equal(libraryPose(piston, 3).warning, true)
  assert.equal(libraryPose(piston, 4).warning, false)
  near(libraryPose(piston, 4.8).extension, .5)
  near(libraryPose(piston, 5.6).extension, 1)
  near(libraryPose(piston, 7.2).extension, .5)
  near(libraryPose(piston, 8).extension, 0)
  near(libraryPose(piston, 5.6).center[0] - libraryPose(piston, 0).center[0], 3.7)

  const trapdoor = config('timed-trapdoor')
  assert.equal(libraryPose(trapdoor, 3.59).warning, false)
  assert.equal(libraryPose(trapdoor, 3.6).warning, true)
  assert.equal(libraryPose(trapdoor, 4.5).warning, false)
  const open = libraryPose(trapdoor, 5.5), part = bodyPart(trapdoor.kind)
  near(open.angle, -90)
  near(open.center[0], part.position[0] + part.bodyCenterOffset[1])
  near(open.center[1], part.position[1] - part.bodyCenterOffset[0])
  near(libraryPose(trapdoor, 8.5).angle, 0)
})

test('预告边界两侧不串阶段，整周期和负相位仍正确回绕', () => {
  const trapdoor=config('timed-trapdoor')
  for(const lap of [0,1,2]) {
    const boundary=lap*8.5+3.6
    assert.equal(libraryPose(trapdoor,boundary-1e-10).warning,false)
    assert.equal(libraryPose(trapdoor,boundary+1e-10).warning,true)
  }
  assert.deepEqual(libraryPose(trapdoor,8.5),libraryPose(trapdoor,0))
  assert.deepEqual(libraryPose({...trapdoor,phaseSeconds:-1},0),libraryPose(trapdoor,7.5))
  assert.deepEqual(libraryPose({...trapdoor,phaseSeconds:-8.5},0),libraryPose(trapdoor,0))
})

test('滚筒轴角、吊桥悬挂半径及跷跷板外部角度保持各自运动约定', () => {
  const roller = libraryPose(config('axial-roller'), 2)
  near(roller.rotation[2], -.9 * 180 / Math.PI)
  near(roller.rotation[0], 0)
  const cradle = libraryPose(config('sway-cradle-bridge'), 2.5)
  near(cradle.angle, 9)
  near(Math.hypot(cradle.center[0] - cradle.pivot[0], cradle.center[1] - cradle.pivot[1]), 2.8)
  assert.ok(cradle.center[0] > cradle.pivot[0])
  assert.deepEqual(libraryPose(config('weight-seesaw'), 100, -6), libraryPose(config('weight-seesaw'), 0, -6))
  near(libraryPose(config('weight-seesaw'), 100, -6).rotation[0], -6)
})
