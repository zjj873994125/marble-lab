import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { nextTick } from 'vue'

// 在 Node 中检查游戏状态与持久化边界，不依赖 WebGL 或浏览器插件。
const source = readFileSync(new URL('../src/state.ts', import.meta.url), 'utf8')
let counter = 0
async function load(saved, { version, v2, v3 } = {}) {
  const compiled = ts.transpileModule(source.replace("from 'vue'", `from '${import.meta.resolve('vue')}'`).replace("import { levelCatalog } from './game/levels'", `const levelCatalog = ${JSON.stringify([{config:{id:'initial-gravity',rulesVersion:version ?? 'classic'},medals:[35,55,90]},{config:{id:'water-rush',rulesVersion:'standard'}}])}`), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const storage = new Map([['marble-lab-v1', saved], ['marble-lab-v2', v2], ['marble-lab-v3', v3]])
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) }
  globalThis.HTMLElement = class {}
  globalThis.document = { activeElement: null }
  const module = await import(`data:text/javascript;base64,${Buffer.from(compiled + `\n// instance ${counter++}`).toString('base64')}`)
  return { ...module, storage }
}

test('损坏存储可恢复，非法设置和成绩被过滤', async () => {
  const broken = await load('{invalid')
  assert.equal(broken.state.settings.volume,45)
  const { state } = await load(JSON.stringify({ settings: { volume: 900, sensitivity: -2, quality: 'ultra' }, runs: [{ time:-5,falls:0,date:'x' },{ time:31,falls:0,date:'2026-09-10' }] }))
  assert.equal(state.settings.volume,100)
  assert.equal(state.settings.sensitivity,.5)
  assert.equal(state.settings.quality,'high')
  assert.equal(state.runs.length,1)
})

test('重新挑战清零，结算仅记录一次并按成绩排序持久化', async () => {
  const { state, startRun, finishRun, storage, formatTime } = await load('{}')
  startRun(); assert.equal(state.phase,'menu')
  state.ready=true; state.elapsed=40; state.falls=2; state.checkpoint=2
  startRun(); assert.equal(state.phase,'playing'); assert.equal(state.elapsed,0); assert.equal(state.falls,0); assert.equal(state.checkpoint,0)
  state.elapsed=42.12; finishRun(); finishRun(); assert.equal(state.runs.length,1)
  startRun(); state.elapsed=30; finishRun(); await nextTick()
  assert.deepEqual(state.runs.map(r=>r.time),[30,42.12])
  assert.equal(JSON.parse(storage.get('marble-lab-v3')).runsByLevel['initial-gravity'].classic.length,2)
  assert.equal(formatTime(62.34),'01:02.34')
})

test('浏览器拒绝存储时保留可用状态并提示', async () => {
  const { state } = await load('{}')
  localStorage.setItem=()=>{ throw new Error('quota') }
  state.settings.volume=10; await nextTick()
  assert.equal(state.settings.volume,10)
  assert.equal(state.storageWarning,true)
})


test('新玩法只迁入旧版桶，保存保留 v1 原文，重复加载不重复迁移', async () => {
  const legacy = JSON.stringify({ settings: { quality: 'low', volume: 27, sensitivity: .8, reducedMotion: true }, runs: [{ time: 12, falls: 1, date: 'old' }] })
  const first = await load(legacy, { version: 'open-hammer' })
  assert.equal(first.state.runs.length, 0)
  assert.equal(first.state.archivedByVersion.classic.length, 1)
  assert.equal(first.state.settings.volume, 27)
  first.state.ready = true; first.startRun(); first.state.elapsed = 49; first.finishRun(); await nextTick()
  assert.equal(first.storage.get('marble-lab-v1'), legacy)
  const written = first.storage.get('marble-lab-v3')
  assert.deepEqual(JSON.parse(written).runsByLevel['initial-gravity'].classic, [{ time: 12, falls: 1, date: 'old' }])
  assert.deepEqual(JSON.parse(written).runsByLevel['initial-gravity']['open-hammer'].map(r => r.time), [49])
  const second = await load(legacy, { version: 'open-hammer', v3: written })
  assert.deepEqual(second.state.runs.map(r => r.time), [49])
  assert.equal(second.state.archivedByVersion.classic.length, 1)
  assert.equal(second.state.settings.sensitivity, .8)
  second.state.settings.volume = 28; await nextTick()
  const third = await load(legacy, { version: 'open-hammer', v3: second.storage.get('marble-lab-v3') })
  assert.equal(third.state.archivedByVersion.classic.length, 1)
  assert.equal(third.state.runs.length, 1)
  assert.equal(third.state.settings.volume, 28)
})

test('兼容代码先部署但未启用新规则时，成绩仍归旧版桶', async () => {
  const legacy = JSON.stringify({ runs: [{ time: 10, falls: 0, date: 'old' }] })
  const old = await load(legacy)
  assert.equal(old.rulesVersion.value, 'classic')
  old.state.ready = true; old.startRun(); old.state.elapsed = 20; old.finishRun(); await nextTick()
  const saved = JSON.parse(old.storage.get('marble-lab-v3'))
  assert.deepEqual(saved.runsByLevel['initial-gravity'].classic.map(r => r.time), [10, 20])
  assert.deepEqual(saved.runsByLevel['initial-gravity']['open-hammer'] ?? [], [])
  assert.equal(old.storage.get('marble-lab-v1'), legacy)
})

test('新旧桶独立裁剪，拒绝保存时旧原文和内存成绩仍保留', async () => {
  const legacy = JSON.stringify({ runs: [{ time: 5, falls: 0, date: 'old' }] })
  const current = await load(legacy, { version: 'open-hammer' })
  current.state.ready = true
  for (let i = 30; i > 0; i--) { current.startRun(); current.state.elapsed = i; current.finishRun() }
  await nextTick()
  assert.equal(current.state.runs.length, 20)
  assert.equal(current.state.runs[0].time, 1)
  assert.equal(current.state.archivedByVersion.classic.length, 1)
  const stored = current.storage.get('marble-lab-v3')
  localStorage.setItem = () => { throw new Error('quota') }
  current.startRun(); current.state.elapsed = .5; current.finishRun(); await nextTick()
  assert.equal(current.state.storageWarning, true)
  assert.equal(current.state.runs[0].time, .5)
  assert.equal(current.storage.get('marble-lab-v3'), stored)
  assert.equal(current.storage.get('marble-lab-v1'), legacy)
})

test('平端规则独立计分，重复保存和切回旧规则都保留已有成绩桶', async () => {
  const legacy = JSON.stringify({ runs: [{ time: 8, falls: 0, date: 'v1' }] })
  const settings = { quality: 'low', volume: 18, sensitivity: 1.2, reducedMotion: true }
  const oldBuckets = { classic: [{ time: 10, falls: 1, date: 'classic' }], 'open-hammer': [{ time: 20, falls: 2, date: 'round' }] }
  const first = await load(legacy, { version: 'flat-hammer', v2: JSON.stringify({ schemaVersion: 2, settings, runsByVersion: oldBuckets }) })
  assert.equal(first.state.runs.length, 0)
  assert.equal(first.archivedGroups.value.length, 2)
  first.state.ready = true; first.startRun(); first.state.elapsed = 31; first.finishRun(); await nextTick()
  const written = first.storage.get('marble-lab-v3')
  const data = JSON.parse(written)
  assert.deepEqual(data.settings, settings)
  for (const version of Object.keys(oldBuckets)) assert.deepEqual(data.runsByLevel['initial-gravity'][version], oldBuckets[version])
  assert.deepEqual(data.runsByLevel['initial-gravity']['flat-hammer'].map(run => run.time), [31])
  assert.equal(first.storage.get('marble-lab-v1'), legacy)
  const second = await load(legacy, { version: 'flat-hammer', v3: written })
  assert.equal(second.state.runs.length, 1)
  assert.equal(second.archivedGroups.value.length, 2)
  second.state.settings.volume = 19; await nextTick()
  const classic = await load(legacy, { v3: second.storage.get('marble-lab-v3') })
  classic.state.ready = true; classic.startRun(); classic.state.elapsed = 5; classic.finishRun(); await nextTick()
  const saved = JSON.parse(classic.storage.get('marble-lab-v3')).runsByLevel['initial-gravity']
  assert.deepEqual(saved.classic.map(run => run.time), [5, 10])
  assert.deepEqual(saved['open-hammer'], oldBuckets['open-hammer'])
  assert.deepEqual(saved['flat-hammer'], data.runsByLevel['initial-gravity']['flat-hammer'])
  assert.equal(classic.storage.get('marble-lab-v1'), legacy)
})

test('两关切换及刷新隔离成绩，v1/v2原文和所有历史规则继续保留', async () => {
  const v1=JSON.stringify({runs:[{time:7,falls:0,date:'v1'}]})
  const versions={classic:[{time:11,falls:0,date:'classic'}],'open-hammer':[{time:22,falls:1,date:'round'}],'flat-hammer':[{time:33,falls:2,date:'flat'}]}
  const v2=JSON.stringify({schemaVersion:2,settings:{volume:21,sensitivity:.9},runsByVersion:versions})
  const current=await load(v1,{version:'flat-hammer',v2})
  current.selectLevel('water-rush')
  assert.equal(current.state.ready,false);assert.equal(current.state.runs.length,0)
  assert.equal(current.archivedGroups.value.length,0)
  current.state.ready=true;current.startRun();current.state.elapsed=85
  current.selectLevel('initial-gravity');assert.equal(current.state.levelId,'water-rush')
  current.finishRun();await nextTick()
  assert.equal(current.storage.get('marble-lab-v1'),v1);assert.equal(current.storage.get('marble-lab-v2'),v2)
  const written=current.storage.get('marble-lab-v3')
  const saved=JSON.parse(written)
  assert.deepEqual(saved.runsByLevel['initial-gravity'],versions)
  assert.deepEqual(saved.runsByLevel['water-rush'].standard.map(r=>r.time),[85])
  const refreshed=await load(v1,{version:'flat-hammer',v2,v3:written})
  assert.equal(refreshed.state.levelId,'water-rush');assert.equal(refreshed.state.runs[0].time,85)
  refreshed.selectLevel('initial-gravity');assert.equal(refreshed.state.runs[0].time,33)
  assert.equal(refreshed.archivedGroups.value.length,2)
  refreshed.state.settings.volume=22;await nextTick()
  assert.equal(refreshed.storage.get('marble-lab-v2'),v2)
  assert.equal(JSON.parse(refreshed.storage.get('marble-lab-v3')).runsByLevel['water-rush'].standard[0].time,85)
})

test('快速连续选关不串桶，未知关卡历史保留且非法选择不启动', async () => {
  const buckets={'initial-gravity':{classic:[{time:12,falls:0,date:'a'}]},'water-rush':{standard:[{time:45,falls:0,date:'b'}]},future:{next:[{time:99,falls:0,date:'c'}]}}
  const current=await load('{}',{v3:JSON.stringify({schemaVersion:3,runsByLevel:buckets,selectedLevelId:'missing'})})
  assert.equal(current.state.levelId,'initial-gravity')
  current.selectLevel('water-rush');current.selectLevel('initial-gravity');current.selectLevel('missing')
  await nextTick()
  assert.equal(current.state.runs[0].time,12)
  assert.deepEqual(JSON.parse(current.storage.get('marble-lab-v3')).runsByLevel,buckets)
})
