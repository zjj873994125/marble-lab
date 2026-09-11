import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync(new URL('../src/game/model-assets.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('import.meta.env.BASE_URL',"'./'")
const {createModelAssets,attachMovingVisual}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('同名模型只请求一次，多实例卸载资源只释放一次',async()=>{
  const requests=[],scales=[],disposed=[]
  const asset={unload:()=>disposed.push('asset'),resource:{instantiateRenderEntity:()=>({setLocalScale:(...s)=>scales.push(s),destroy:()=>disposed.push('instance')})}}
  const app={assets:{loadFromUrl:(url,type,cb)=>{requests.push(url);cb(null,asset)},remove:()=>disposed.push('remove')}}
  const pool=createModelAssets(app),renders=Array.from({length:4},()=>({enabled:true}))
  const parent={getLocalScale:()=>({x:3.2,y:.32,z:2.8}),addChild:()=>{}}
  const cleanup=await Promise.all(renders.map(render=>attachMovingVisual(pool.load,'lift.glb',parent,[render])))
  assert.deepEqual(requests,['./models/lift.glb']);assert.equal(scales.length,4)
  assert.ok(renders.every(r=>!r.enabled))
  cleanup.forEach(dispose=>dispose());pool.destroy();pool.destroy()
  assert.ok(renders.every(r=>r.enabled));assert.equal(disposed.filter(x=>x==='instance').length,4)
  assert.equal(disposed.filter(x=>x==='asset').length,1);assert.equal(disposed.filter(x=>x==='remove').length,1)
})

test('切换关卡取消等待，迟到资源直接释放，不再实例化旧场景',async()=>{
  let callback,unloaded=0,removed=0
  const controller=new AbortController()
  const pool=createModelAssets({assets:{loadFromUrl:(url,type,cb)=>{callback=cb},remove:()=>removed++}},controller.signal)
  const result=pool.load('late.glb').catch(error=>error.name)
  controller.abort();assert.equal(await result,'AbortError')
  callback(null,{unload:()=>unloaded++})
  assert.equal(unloaded,1);assert.equal(removed,1)
  await assert.rejects(pool.load('other.glb'),{name:'AbortError'})
})

test('新机关模型失败仍显示真实盒体，禁用外观不发请求',async()=>{
  const render={enabled:true},parent={}
  const warn=console.warn;console.warn=()=>{}
  try {
    const dispose=await attachMovingVisual(async()=>{throw Error('missing')},'missing.glb',parent,[render])
    assert.equal(render.enabled,true);dispose()
    await attachMovingVisual(()=>{throw Error('should not load')},undefined,parent,[render])
  } finally {console.warn=warn}
})
