import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { nextTick } from 'vue'

// 在 Node 中检查游戏状态与持久化边界，不依赖 WebGL 或浏览器插件。
const themeSource=readFileSync(new URL('../src/game/track-themes.ts',import.meta.url),'utf8')
const themeUrl=`data:text/javascript;base64,${Buffer.from(ts.transpileModule(themeSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`
const ballSource=readFileSync(new URL('../src/game/ball-skins.ts',import.meta.url),'utf8')
const ballUrl=`data:text/javascript;base64,${Buffer.from(ts.transpileModule(ballSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`
const source = readFileSync(new URL('../src/state.ts', import.meta.url), 'utf8')
  .replace("from './game/track-themes'",`from '${themeUrl}'`)
  .replace("from './game/ball-skins'",`from '${ballUrl}'`)
let counter = 0
async function load(saved, { version, v2, v3, waterVersion = 'standard', trialVersion, newCourses = false } = {}) {
  const catalog = [{config:{id:'initial-gravity',rulesVersion:version ?? 'classic'},medals:[35,55,90]},{config:{id:'water-rush',rulesVersion:waterVersion}},...(trialVersion ? [{config:{id:'mechanism-trial',rulesVersion:trialVersion}}] : []),...(newCourses ? [{config:{id:'top-difficulty',rulesVersion:'standard'}},{config:{id:'three-route',rulesVersion:'standard'}}] : [])]
  const compiled = ts.transpileModule(source.replace("from 'vue'", `from '${import.meta.resolve('vue')}'`).replace("import { levelCatalog } from './game/levels'", `const levelCatalog = ${JSON.stringify(catalog)}`), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
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

test('纯净模式兼容旧值、保存手动偏好，恢复默认保留所有成绩与旧存储', async () => {
  const buckets={'initial-gravity':{classic:[{time:30,falls:1,date:'2026-09-14'}]},'mechanism-trial':{standard:[{time:60,falls:2,date:'2026-09-14'}],intense:[{time:70,falls:3,date:'2026-09-14'}]}}
  const v1='{"runs":[]}',v2='{"schemaVersion":2,"runsByVersion":{}}'
  for(const value of [undefined,null,true,'invalid','auto','on','off']) {
    const current=await load(v1,{v2,v3:JSON.stringify({schemaVersion:3,settings:{cleanMode:value,waterSpeed:2.5},runsByLevel:buckets})})
    assert.equal(current.state.settings.cleanMode,value==='on'||value==='off'?value:'auto')
    assert.equal(current.state.settings.waterSpeed,2.5)
  }
  let current=await load(v1,{v2,v3:JSON.stringify({schemaVersion:3,runsByLevel:buckets})})
  for(const mode of ['on','off']) {
    current.state.settings.cleanMode=mode;await nextTick()
    const written=current.storage.get('marble-lab-v3')
    assert.deepEqual(JSON.parse(written).runsByLevel,buckets)
    const refreshed=await load(v1,{v2,v3:written})
    assert.equal(refreshed.state.settings.cleanMode,mode)
    current=refreshed
  }
  Object.assign(current.state.settings,current.defaults);await nextTick()
  const restored=JSON.parse(current.storage.get('marble-lab-v3'))
  assert.equal(restored.settings.cleanMode,'auto');assert.deepEqual(restored.runsByLevel,buckets)
  assert.equal(current.storage.get('marble-lab-v1'),v1);assert.equal(current.storage.get('marble-lab-v2'),v2)
})

test('赛道主题校验和恢复默认不丢纯净设置或历史成绩，切肤不重开',async()=>{
  const buckets={'initial-gravity':{classic:[{time:30,falls:0,date:'2026-09-14'}]},'mechanism-trial':{standard:[{time:50,falls:0,date:'2026-09-14'}],'intense-v2':[{time:80,falls:1,date:'2026-09-14'}]}}
  for(const value of [undefined,null,'invalid','__proto__',true]) {
    const current=await load('{}',{v3:JSON.stringify({schemaVersion:3,settings:{trackTheme:value},runsByLevel:buckets})})
    assert.equal(current.state.settings.trackTheme,'classic')
  }
  let current=await load('{}',{v3:JSON.stringify({schemaVersion:3,settings:{cleanMode:'off',waterSpeed:2.5},runsByLevel:buckets})})
  for(const theme of ['industrial','glacier','black-gold','violet','pink','yellow','classic']) {
    current.state.phase='paused';current.state.elapsed=12;current.state.checkpoint=1;current.state.falls=2
    const runId=current.state.runId,sceneLoadId=current.state.sceneLoadId
    current.state.settings.trackTheme=theme;await nextTick()
    assert.equal(current.state.phase,'paused');assert.equal(current.state.elapsed,12);assert.equal(current.state.checkpoint,1);assert.equal(current.state.falls,2)
    assert.equal(current.state.runId,runId);assert.equal(current.state.sceneLoadId,sceneLoadId)
    const written=current.storage.get('marble-lab-v3')
    assert.deepEqual(JSON.parse(written).runsByLevel,buckets)
    current=await load('{}',{v3:written})
    assert.equal(current.state.settings.trackTheme,theme);assert.equal(current.state.settings.cleanMode,'off');assert.equal(current.state.settings.waterSpeed,2.5)
  }
  current.state.settings.trackTheme='black-gold';Object.assign(current.state.settings,current.defaults);await nextTick()
  assert.equal(current.state.settings.trackTheme,'classic')
  assert.deepEqual(JSON.parse(current.storage.get('marble-lab-v3')).runsByLevel,buckets)
})

test('性能开关严格布尔、刷新保留且恢复默认不删除历史',async()=>{
  const buckets={'initial-gravity':{classic:[{time:30,falls:0,date:'2026-09-14'}]},'mechanism-trial':{'intense-v2':[{time:80,falls:1,date:'2026-09-14'}]}}
  for(const value of [undefined,null,0,1,'true',false,true]) {
    const current=await load('{}',{v3:JSON.stringify({schemaVersion:3,settings:{showPerformance:value},runsByLevel:buckets})})
    assert.equal(current.state.settings.showPerformance,value===true)
  }
  let current=await load('{}',{v3:JSON.stringify({schemaVersion:3,settings:{cleanMode:'on',trackTheme:'pink',waterSpeed:2.5},runsByLevel:buckets})})
  current.state.settings.showPerformance=true;await nextTick()
  current=await load('{}',{v3:current.storage.get('marble-lab-v3')})
  assert.equal(current.state.settings.showPerformance,true);assert.equal(current.state.settings.cleanMode,'on');assert.equal(current.state.settings.trackTheme,'pink');assert.equal(current.state.settings.waterSpeed,2.5)
  Object.assign(current.state.settings,current.defaults);await nextTick()
  assert.equal(current.state.settings.showPerformance,false)
  assert.deepEqual(JSON.parse(current.storage.get('marble-lab-v3')).runsByLevel,buckets)
})

test('九球皮肤独立保存，不改赛道选择或游玩状态，非法回退钢球',async()=>{
  const buckets={'initial-gravity':{classic:[{time:30,falls:0,date:'2026-09-14'}]}}
  for(const value of [undefined,null,1,'invalid','shuttlecock']) {
    const current=await load('{}',{v3:JSON.stringify({schemaVersion:3,settings:{ballSkin:value},runsByLevel:buckets})})
    assert.equal(current.state.settings.ballSkin,'steel')
  }
  let current=await load('{}',{v3:JSON.stringify({schemaVersion:3,settings:{trackTheme:'violet',cleanMode:'off',showPerformance:true},runsByLevel:buckets})})
  for(const skin of ['titanium','rose-gold','ice-blue','ringed-steel','basketball','soccer','tennis','eight-ball','steel']) {
    const runId=current.state.runId,sceneLoadId=current.state.sceneLoadId
    current.state.settings.ballSkin=skin;await nextTick()
    assert.equal(current.state.phase,'menu');assert.equal(current.state.runId,runId);assert.equal(current.state.sceneLoadId,sceneLoadId)
    assert.equal(current.state.settings.trackTheme,'violet');assert.equal(current.state.settings.cleanMode,'off');assert.equal(current.state.settings.showPerformance,true)
    const written=current.storage.get('marble-lab-v3');assert.deepEqual(JSON.parse(written).runsByLevel,buckets)
    current=await load('{}',{v3:written});assert.equal(current.state.settings.ballSkin,skin)
  }
  current.state.settings.ballSkin='eight-ball';Object.assign(current.state.settings,current.defaults);await nextTick()
  assert.equal(current.state.settings.ballSkin,'steel');assert.deepEqual(JSON.parse(current.storage.get('marble-lab-v3')).runsByLevel,buckets)
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
  assert.deepEqual(data.settings, { ...settings, waterSpeed: 1, cleanMode: 'auto', trackTheme:'classic', showPerformance:false, ballSkin:'steel' })
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

test('调难challenge不混入standard，往返第一关及刷新保留所有旧记录',async()=>{
  const buckets={'initial-gravity':{classic:[{time:11,falls:0,date:'classic'}],'open-hammer':[{time:22,falls:0,date:'open'}],'flat-hammer':[{time:33,falls:0,date:'flat'}]},'water-rush':{standard:[{time:88.1256,falls:1,date:'standard'}]}}
  const v3=JSON.stringify({schemaVersion:3,runsByLevel:buckets,selectedLevelId:'water-rush'})
  const current=await load('{}',{version:'flat-hammer',waterVersion:'challenge',v3})
  assert.equal(current.rulesVersion.value,'challenge');assert.equal(current.state.runs.length,0)
  assert.equal(current.archivedGroups.value[0].version,'standard')
  current.state.ready=true;current.startRun();current.state.elapsed=120;current.finishRun();current.state.phase='menu'
  current.selectLevel('initial-gravity');current.selectLevel('water-rush');await nextTick()
  const written=current.storage.get('marble-lab-v3'),saved=JSON.parse(written)
  assert.deepEqual(saved.runsByLevel['initial-gravity'],buckets['initial-gravity'])
  assert.deepEqual(saved.runsByLevel['water-rush'].standard,buckets['water-rush'].standard)
  assert.equal(saved.runsByLevel['water-rush'].challenge[0].time,120)
  const refreshed=await load('{}',{version:'flat-hammer',waterVersion:'challenge',v3:written})
  assert.equal(refreshed.state.runs[0].time,120);assert.equal(refreshed.archivedGroups.value[0].runs[0].time,88.1256)
})

for (const targetVersion of ['intense','intense-v2']) test(`第三关${targetVersion}独立保存，所有历史及设置往返刷新均保留`, async () => {
  const old = { standard: [{time:50,falls:1,date:'2026-09-14'}], challenge: [{time:60,falls:2,date:'2026-09-14'}], ...(targetVersion==='intense-v2'?{intense:[{time:70,falls:3,date:'2026-09-14'}]}:{}) }
  const other = { classic: [{time:30,falls:0,date:'2026-09-13'}] }
  const settings = { quality:'low',volume:23,sensitivity:1.1,reducedMotion:true,waterSpeed:2.5,cleanMode:'off',trackTheme:'industrial',showPerformance:false,ballSkin:'eight-ball' }
  const v1='{"runs":[]}',v2='{"schemaVersion":2,"runsByVersion":{}}'
  const v3=JSON.stringify({schemaVersion:3,settings,lastStartedLevelId:'mechanism-trial',hasPlayedBeyondFirst:true,runsByLevel:{'initial-gravity':other,'mechanism-trial':old}})
  const current=await load(v1,{v2,v3,trialVersion:targetVersion})
  assert.equal(current.rulesVersion.value,targetVersion);assert.equal(current.state.runs.length,0)
  assert.deepEqual(current.state.archivedByVersion,old)
  current.state.ready=true;current.startRun();current.state.elapsed=75;current.finishRun()
  current.state.phase='menu';current.selectLevel('initial-gravity');current.selectLevel('mechanism-trial');await nextTick()
  const written=current.storage.get('marble-lab-v3'),saved=JSON.parse(written)
  assert.deepEqual(saved.runsByLevel['initial-gravity'],other)
  assert.deepEqual(saved.runsByLevel['mechanism-trial'].standard,old.standard)
  assert.deepEqual(saved.runsByLevel['mechanism-trial'].challenge,old.challenge)
  if(old.intense)assert.deepEqual(saved.runsByLevel['mechanism-trial'].intense,old.intense)
  assert.equal(saved.runsByLevel['mechanism-trial'][targetVersion][0].time,75)
  assert.deepEqual(saved.settings,settings)
  assert.equal(current.storage.get('marble-lab-v1'),v1);assert.equal(current.storage.get('marble-lab-v2'),v2)
  const refreshed=await load(v1,{v2,v3:written,trialVersion:targetVersion})
  assert.equal(refreshed.state.runs[0].time,75);assert.deepEqual(refreshed.state.archivedByVersion,old)
  assert.equal(refreshed.state.lastStartedLevelId,'mechanism-trial');assert.equal(refreshed.state.hasPlayedBeyondFirst,true)
  const olderRule=await load(v1,{v2,v3:written,trialVersion:'challenge'})
  assert.equal(olderRule.archivedGroups.value.find(group=>group.version===targetVersion).label,targetVersion==='intense'?'极限挑战':'极限挑战Ⅱ')
})

test('五关切换、新关standard分桶和三路成绩刷新后完整保留',async()=>{
  const old={
    'initial-gravity':{classic:[{time:30,falls:0,date:'old-1'}]},
    'water-rush':{challenge:[{time:60,falls:1,date:'old-2'}]},
    'mechanism-trial':{'intense-v2':[{time:90,falls:2,date:'old-3'}]},
  }
  const current=await load('{}',{v3:JSON.stringify({schemaVersion:3,runsByLevel:old}),trialVersion:'intense-v2',newCourses:true})
  current.selectLevel('top-difficulty');current.state.ready=true;current.startRun();current.state.elapsed=180;current.finishRun();current.state.phase='menu'
  current.selectLevel('three-route');current.state.ready=true;current.startRun();current.state.elapsed=150;current.finishRun('B');await nextTick()
  const written=current.storage.get('marble-lab-v3'),saved=JSON.parse(written)
  assert.deepEqual(saved.runsByLevel['initial-gravity'],old['initial-gravity'])
  assert.deepEqual(saved.runsByLevel['water-rush'],old['water-rush'])
  assert.deepEqual(saved.runsByLevel['mechanism-trial'],old['mechanism-trial'])
  assert.equal(saved.runsByLevel['top-difficulty'].standard[0].time,180)
  assert.equal(saved.runsByLevel['three-route'].standard[0].route,'B')
  const refreshed=await load('{}',{v3:written,trialVersion:'intense-v2',newCourses:true})
  assert.equal(refreshed.state.levelId,'three-route');assert.equal(refreshed.state.runs[0].route,'B')
  for(const id of ['initial-gravity','water-rush','mechanism-trial','top-difficulty','three-route'])refreshed.selectLevel(id)
  assert.equal(refreshed.state.levelId,'three-route')
})
