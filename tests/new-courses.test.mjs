import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
async function loadLevel(name) {
  const source=readFileSync(new URL(`../src/levels/${name}.ts`,import.meta.url),'utf8')
  return (await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`)).default
}
const top=await loadLevel('top-difficulty'),three=await loadLevel('three-route')
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)
const progressSource=readFileSync(new URL('../src/game/course-progress.ts',import.meta.url),'utf8')
const progressJs=compile(progressSource).replace(/^import .*;?$/gm,'').replace('export function','function')
const createCourseProgress=new Function(`${progressJs};return createCourseProgress`)()

test('五项目录保留旧三关，新挑战与04标题按产品约定注册',async()=>{
  const source=readFileSync(new URL('../src/game/levels.ts',import.meta.url),'utf8')
    .replace(/^import initialGravity .*$/m,"const initialGravity={id:'initial-gravity'}")
    .replace(/^import waterRush .*$/m,"const waterRush={id:'water-rush'}")
    .replace(/^import mechanismTrial .*$/m,"const mechanismTrial={id:'mechanism-trial'}")
    .replace(/^import topDifficulty .*$/m,"const topDifficulty={id:'top-difficulty'}")
    .replace(/^import threeRoute .*$/m,"const threeRoute={id:'three-route'}")
  const {levelCatalog}=await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`)
  assert.deepEqual(levelCatalog.map(entry=>[entry.config.id,entry.number,entry.title]),[
    ['initial-gravity','01','教学关卡'],['water-rush','02','水上冲关'],['mechanism-trial','03','机关试炼'],
    ['top-difficulty','挑战','顶级难度关卡'],['three-route','04','三路分流'],
  ])
})

for(const [name,level,minimum] of [['top-difficulty',top,800],['three-route',three,1000]])test(`${name}的白盒代理、机关实例与有向路线数据完整`,()=>{
  assert.equal(level.id,name);assert.equal(level.rulesVersion,'standard');assert.ok(level.staticObjects.length>=minimum)
  assert.equal(new Set(level.staticObjects.map(item=>item.name)).size,level.staticObjects.length)
  for(const item of level.staticObjects){assert.ok(vector(item.position));assert.ok(vector(item.size)&&item.size.every(value=>value>0));if(item.rotation)assert.ok(vector(item.rotation));assert.ok(item.body===undefined||item.body==='static')}
  const instances=[...(level.mechanismGroups??[]),...(level.mechanisms??[])]
  assert.equal(new Set(instances.map(item=>item.id)).size,instances.length)
  for(const item of instances){assert.ok(item.id);assert.ok(vector(item.position));assert.ok(item.yaw===undefined||Number.isFinite(item.yaw));assert.ok(item.phaseSeconds===undefined||Number.isFinite(item.phaseSeconds))}
  const checkpointIds=new Set(level.course.checkpoints.map(item=>item.id)),gateIds=new Set(level.course.gates.map(item=>item.id)),usedGates=new Set()
  assert.equal(checkpointIds.size,level.course.checkpoints.length);assert.equal(gateIds.size,level.course.gates.length)
  for(const gate of level.course.gates){assert.ok(vector(gate.position));assert.ok(vector(gate.forward)&&Math.hypot(...gate.forward)>.99);assert.ok(gate.radius>0)}
  for(const route of level.course.routes){
    assert.ok(route.points.length>1&&route.points.every(vector));assert.deepEqual(route.steps.filter(step=>step.kind==='checkpoint').map(step=>step.id),route.checkpointIds)
    for(const step of route.steps){assert.ok(step.kind==='checkpoint'?checkpointIds.has(step.id):gateIds.has(step.id));if(step.kind==='gate')usedGates.add(step.id)}
  }
  assert.deepEqual([...usedGates].sort(),[...gateIds].sort())
})

test('顶级难度关单路线四CP且13类机关每类至少出现两次',()=>{
  assert.equal(top.staticObjects.length,867);assert.equal(top.course.gates.length,36)
  assert.deepEqual(top.course.routes.map(route=>route.id),['main']);assert.deepEqual(top.course.routes[0].checkpointIds,['CP1','CP2','CP3','CP4'])
  assert.equal(top.course.routes[0].steps.length,40)
  const counts={beam:6,serpentine:2,ramp:2}
  for(const group of top.mechanismGroups)counts[group.kind]=(counts[group.kind]??0)+1
  for(const mechanism of top.mechanisms)counts[mechanism.kind]=(counts[mechanism.kind]??0)+1
  assert.equal(Object.keys(counts).length,13);assert.ok(Object.values(counts).every(count=>count>=2))
})

test('三路分流由ENTRY CP提交路线，A/B/C每局四CP且共享汇合后门',()=>{
  assert.equal(three.staticObjects.length,1076);assert.equal(three.course.checkpoints.length,8);assert.equal(three.course.gates.length,40)
  assert.deepEqual(three.course.routes.map(route=>route.id),['A','B','C'])
  assert.deepEqual(three.course.routes.map(route=>route.steps.length),[21,21,20])
  for(const route of three.course.routes){
    assert.equal(route.checkpointIds.length,4);assert.equal(route.checkpointIds[0],'CP-SELECT');assert.equal(route.checkpointIds.at(-1),'CP-MERGED')
    assert.equal(route.steps[2].id,'CP-SELECT');assert.deepEqual(route.steps[3],{kind:'checkpoint',id:`CP-${route.id}-ENTRY`})
    assert.deepEqual(route.steps.slice(-3).map(step=>step.id),['CP-MERGED','T-01-out','T-02-out'])
  }
})

test('两关静态轨道正式引用自包含TrackStatic GLB',()=>{
  for(const [level,file] of [[top,'top-difficulty-track.glb'],[three,'three-route-track.glb']]){
    assert.deepEqual(level.visuals,{track:file})
    const bytes=readFileSync(new URL(`../public/models/${file}`,import.meta.url))
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length)
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())
    assert.equal(gltf.nodes.length,1);assert.equal(gltf.nodes[0].name,'TrackStatic')
    assert.ok((gltf.buffers??[]).every(item=>!item.uri));assert.ok((gltf.images??[]).every(item=>!item.uri))
  }
})

test('最终配置的top单路线与three A/B/C均能通过全部有向步骤完成',()=>{
  for(const level of [top,three])for(const route of level.course.routes){
    const progress=createCourseProgress(level.course),gates=new Map(level.course.gates.map(item=>[item.id,item])),checkpoints=new Map(level.course.checkpoints.map(item=>[item.id,item]))
    for(const step of route.steps){
      if(step.kind==='checkpoint'){
        const point=checkpoints.get(step.id);assert.equal(progress.advance(point.respawn,point.respawn)?.id,step.id)
      }else{
        const gate=gates.get(step.id),length=Math.hypot(...gate.forward),normal=gate.forward.map(value=>value/length)
        const before=gate.position.map((value,index)=>value-normal[index]*.2),after=gate.position.map((value,index)=>value+normal[index]*.2)
        assert.equal(progress.advance(before,after)?.id,step.id)
      }
    }
    assert.equal(progress.complete(),true);assert.equal(progress.route(),route.id);assert.equal(progress.checkpointCount(),4)
  }
})

test('三路在ENTRY CP锁定，掉落保留已通过gate，跳过当前步骤不能合流',()=>{
  const progress=createCourseProgress(three.course),route=three.course.routes[0],gates=new Map(three.course.gates.map(item=>[item.id,item])),checkpoints=new Map(three.course.checkpoints.map(item=>[item.id,item]))
  const pass=step=>{
    if(step.kind==='checkpoint'){const point=checkpoints.get(step.id);return progress.advance(point.respawn,point.respawn)}
    const gate=gates.get(step.id),before=gate.position.map((value,index)=>value-gate.forward[index]*.2),after=gate.position.map((value,index)=>value+gate.forward[index]*.2)
    return progress.advance(before,after)
  }
  route.steps.slice(0,4).forEach(step=>assert.equal(pass(step)?.id,step.id))
  assert.equal(progress.route(),'A');assert.deepEqual(progress.respawn(),checkpoints.get('CP-A-ENTRY').respawn)
  assert.equal(pass(route.steps[5]),undefined);assert.equal(progress.complete(),false);assert.equal(progress.route(),'A')
  assert.equal(pass(route.steps[4])?.id,route.steps[4].id);assert.equal(progress.route(),'A')
})
