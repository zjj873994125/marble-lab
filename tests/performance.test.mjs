import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync(new URL('../src/game/performance.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('export function','function')
function harness(detailed) {
  let now=0,nextTimer=1,previous
  const events=new Map(),visibility=new Set(),timers=new Map(),samples=[]
  const app={timeScale:0,stats:{drawCalls:{total:0},frame:{triangles:0}},on(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn)},off(name,fn){events.get(name)?.delete(fn)}}
  const document={hidden:false,addEventListener(name,fn){visibility.add(fn)},removeEventListener(name,fn){visibility.delete(fn)}}
  const create=new Function('performance','document','setTimeout','clearTimeout',`${js};return createPerformanceMonitor`)({now:()=>now},document,(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,at:now+delay});return id},id=>timers.delete(id))
  const monitor=create(app,sample=>samples.push(sample),detailed)
  function fire(name){events.get(name)?.forEach(fn=>fn())}
  return {monitor,app,samples,events,visibility,timers,
    frame(time,calls=12,triangles=30){now=time;if(previous){app.stats.drawCalls.total=previous.calls;app.stats.frame.triangles=previous.triangles}fire('frameupdate');fire('postrender');previous={calls,triangles}},
    hide(value){document.hidden=value;visibility.forEach(fn=>fn())},
    idle(time){now=time;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn()}},
  }
}

test('真实绘制时间与下一帧stats配对，750ms汇总且不受timeScale零影响',()=>{
  const h=harness(true)
  assert.equal(h.events.size,0)
  h.monitor.setEnabled(true);h.monitor.setEnabled(true)
  assert.equal(h.events.get('postrender').size,1)
  h.frame(0,10,20);h.frame(250,20,40);h.frame(500,30,60);h.frame(750,40,80)
  assert.equal(h.samples.length,0)
  h.frame(1000,50,100)
  assert.deepEqual(h.samples,[{fps:4,frameMs:250,drawCalls:30,triangles:60}])
  h.monitor.destroy();assert.equal(h.timers.size,0);assert.equal(h.visibility.size,0)
})

test('无详细统计显示未知，隐藏/停绘/关闭清空且移除监听',()=>{
  const h=harness(false);h.monitor.setEnabled(true)
  for(const time of [0,250,500,750,1000])h.frame(time)
  assert.equal(h.samples.at(-1).triangles,null)
  h.hide(true);assert.equal(h.samples.at(-1),null)
  const count=h.samples.length;h.frame(2000);assert.equal(h.samples.length,count)
  h.hide(false)
  for(const time of [2500,2750,3000,3250,3500])h.frame(time)
  assert.equal(h.samples.at(-1).fps,4)
  h.idle(4501);assert.equal(h.samples.at(-1),null)
  h.monitor.setEnabled(false);assert.equal(h.events.get('postrender').size,0);assert.equal(h.events.get('frameupdate').size,0);assert.equal(h.timers.size,0);assert.equal(h.visibility.size,0)
  h.monitor.destroy();h.monitor.destroy()
})
