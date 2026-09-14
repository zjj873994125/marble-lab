import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync(new URL('../src/game/course-progress.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;?$/gm,'').replace('export function','function')
const create=new Function(`${js};return createCourseProgress`)()
const cp=(id,x,z)=>({id,ring:{position:[x,3.46,z],radius:.8},respawn:[x,3.95,z],triggerRadius:1.2})
const config={checkpoints:[cp('select',0,0),cp('A1',-5,-5),cp('A2',-5,-10),cp('B1',5,-5),cp('B2',5,-10),cp('merge',0,-15)],routes:[
  {id:'A',checkpointIds:['select','A1','A2','merge'],points:[[0,3.95,5],[0,3.95,0],[-5,3.95,-5],[-5,3.95,-10],[0,3.95,-15],[0,3.95,-20]]},
  {id:'B',checkpointIds:['select','B1','B2','merge'],points:[[0,3.95,5],[0,3.95,0],[5,3.95,-5],[5,3.95,-10],[0,3.95,-15],[0,3.95,-20]]},
]}

test('分支只接受合法下一CP，锁路后误入另一支路不覆盖，掉落保留重生点',()=>{
  const progress=create(config)
  assert.equal(progress.tryCheckpoint([5,3.95,-5]),undefined)
  assert.equal(progress.tryCheckpoint([0,3.95,0]).id,'select');assert.equal(progress.route(),undefined)
  assert.equal(progress.tryCheckpoint([5,3.95,-5]).id,'B1');assert.equal(progress.route(),'B')
  assert.deepEqual(progress.respawn(),[5,3.95,-5]);assert.equal(progress.tryCheckpoint([-5,3.95,-10]),undefined)
  assert.equal(progress.tryCheckpoint([5,3.95,-10]).id,'B2');assert.equal(progress.complete(),false)
  assert.equal(progress.tryCheckpoint([0,3.95,-15]).id,'merge');assert.equal(progress.complete(),true);assert.equal(progress.checkpointCount(),4)
})

test('重开清空路线，单路线四CP完成，进度使用本路线中心线',()=>{
  const progress=create(config);progress.tryCheckpoint([0,3.95,0]);progress.tryCheckpoint([-5,3.95,-5])
  const early=progress.progress([-5,3.95,-6]),late=progress.progress([-5,3.95,-9])
  assert.ok(late>early);progress.reset();assert.equal(progress.route(),undefined);assert.equal(progress.checkpointCount(),0);assert.equal(progress.respawn(),undefined)
  const single=create({checkpoints:[cp('c1',0,0),cp('c2',0,-5),cp('c3',0,-10),cp('c4',0,-15)],routes:[{id:'main',checkpointIds:['c1','c2','c3','c4'],points:[[0,3.95,5],[0,3.95,-20]]}]})
  assert.equal(single.route(),'main');for(const z of [0,-5])single.tryCheckpoint([0,3.95,z]);assert.equal(single.progress([0,3.95,-7.5]),.5)
  for(const z of [-10,-15])single.tryCheckpoint([0,3.95,z]);assert.equal(single.complete(),true)
})

test('回头路段靠近时进度只投影到当前合法步骤区间',()=>{
  const loop=create({checkpoints:[cp('turn',0,-10),cp('finish',1,0)],routes:[{id:'main',checkpointIds:['turn','finish'],points:[[0,3.95,0],[0,3.95,-10],[1,3.95,-10],[1,3.95,0]]}]})
  assert.ok(loop.progress([1,3.95,0])<.5)
  loop.tryCheckpoint([0,3.95,-10])
  assert.ok(loop.progress([0,3.95,0])>=10/21)
})

test('无圆环gate必须按方向与顺序穿越，不增加CP或改变最后重生点',()=>{
  const graph={checkpoints:[cp('start',0,0),cp('merge',0,-15)],gates:[{id:'A-end',position:[-5,3.95,-10],forward:[0,0,-1],radius:2},{id:'B-end',position:[5,3.95,-10],forward:[0,0,-1],radius:2}],routes:[
    {id:'A',checkpointIds:['start','merge'],steps:[{kind:'checkpoint',id:'start'},{kind:'gate',id:'A-end'},{kind:'checkpoint',id:'merge'}],points:[[0,3.95,5],[0,3.95,0],[-5,3.95,-10],[0,3.95,-15]]},
    {id:'B',checkpointIds:['start','merge'],steps:[{kind:'checkpoint',id:'start'},{kind:'gate',id:'B-end'},{kind:'checkpoint',id:'merge'}],points:[[0,3.95,5],[0,3.95,0],[5,3.95,-10],[0,3.95,-15]]},
  ]}
  const progress=create(graph);progress.tryCheckpoint([0,3.95,0])
  assert.equal(progress.advance([0,3.95,-15],[0,3.95,-15]),undefined)
  assert.equal(progress.advance([-5,3.95,-11],[-5,3.95,-9]),undefined)
  const gate=progress.advance([-5,3.95,-9],[-5,3.95,-11]);assert.equal(gate.kind,'gate');assert.equal(progress.route(),'A')
  assert.equal(progress.checkpointCount(),1);assert.deepEqual(progress.respawn(),[0,3.95,0])
  assert.equal(progress.tryCheckpoint([0,3.95,-15]).id,'merge');assert.equal(progress.checkpointCount(),2);assert.equal(progress.complete(),true)
})

test('重复id、未知CP及退化路线在实体创建前拒绝',()=>{
  assert.throws(()=>create({checkpoints:[cp('x',0,0),cp('x',1,0)],routes:[{id:'r',checkpointIds:['x'],points:[[0,0,0],[1,0,0]]}]}),/唯一/)
  assert.throws(()=>create({checkpoints:[],routes:[{id:'r',checkpointIds:['missing'],points:[[0,0,0],[1,0,0]]}]}),/未知/)
  assert.throws(()=>create({checkpoints:[cp('x',0,0)],routes:[{id:'r',checkpointIds:['x'],points:[[0,0,0]]}]}),/无效/)
  assert.throws(()=>create({checkpoints:[cp('x',0,0)],routes:[{id:'r',checkpointIds:['x'],points:[[0,0,0],[1,0,0]]},{id:'r',checkpointIds:['x'],points:[[0,0,0],[1,0,0]]}]}),/无效/)
})
