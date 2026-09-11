import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/game/mechanism-motion.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { arcHammerPose, liftPosition, turntablePose } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`)

test('三锤独立错相、杆长恒定，中位/极值与暂停重开时间语义一致', () => {
  const configs = [0,Math.PI,Math.PI/2].map((phase,i) => ({anchor:[-24+i*6,7.9,18],rodLength:3.6,maxAngle:Math.asin(1.65/3.6),angularSpeed:[1.1,1.5,1.9][i],phase}))
  close(arcHammerPose(configs[0],0).head[2],18)
  close(arcHammerPose(configs[2],0).head[2],19.65)
  assert.ok(arcHammerPose(configs[0],.01).head[2]>18)
  assert.ok(arcHammerPose(configs[1],.01).head[2]<18)
  for (const config of configs) for(let i=0;i<500;i++) {
    const time=i*.03, pose=arcHammerPose(config,time)
    close(Math.hypot(...pose.head.map((value,axis)=>value-config.anchor[axis])),3.6)
    pose.rod.forEach((value,axis)=>close(value,(pose.head[axis]+config.anchor[axis])/2))
    assert.deepEqual(pose,arcHammerPose(config,time))
    close(pose.head[0],config.anchor[0])
  }
})

test('十字五盒随中心绕Y旋转，四角真实空缺，中心拼缝无重叠', () => {
  const config={position:[-6,3.15,10],phase:0,angularSpeed:1,parts:[
    {position:[0,0,0],size:[1.8,.5,1.8]},
    {position:[0,0,2.45],size:[1.8,.5,3.1]}, {position:[0,0,-2.45],size:[1.8,.5,3.1]},
    {position:[2.45,0,0],size:[3.1,.5,1.8]}, {position:[-2.45,0,0],size:[3.1,.5,1.8]},
  ]}
  const pose=turntablePose(config,Math.PI/2)
  close(pose.parts[1][0],-3.55);close(pose.parts[1][2],10)
  close(pose.parts[3][0],-6);close(pose.parts[3][2],7.55)
  const contains=(x,z)=>config.parts.some(p=>Math.abs(x-p.position[0])<=p.size[0]/2&&Math.abs(z-p.position[2])<=p.size[2]/2)
  for(const x of [-2,2])for(const z of [-2,2])assert.equal(contains(x,z),false)
  for(let z=-4;z<=4;z+=.025)assert.equal(contains(0,z),true)
  close(config.parts[1].position[2]-config.parts[1].size[2]/2,config.parts[0].size[2]/2)
  for(let i=0;i<100;i++)for(const center of turntablePose(config,i*.05).parts)close(center[1],3.15)
})

test('四升降板奇偶反相，基准高度与周期回归正确', () => {
  const config={body:{position:[8,3.24,6.4]},amplitude:.45,angularSpeed:.7,phase:0}
  close(liftPosition(config,Math.PI/(2*.7))[1],3.69)
  close(liftPosition({...config,phase:Math.PI},Math.PI/(2*.7))[1],2.79)
  assert.deepEqual(liftPosition(config,0),[8,3.24,6.4])
  close(liftPosition(config,2*Math.PI/.7)[1],3.24)
})
