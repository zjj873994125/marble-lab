import type * as pc from 'playcanvas'

export interface PerformanceSample { fps:number; frameMs:number; drawCalls:number|null; triangles:number|null }

// stats在下一次frameupdate前发布上一绘制帧；postrender时间戳与它配对。
export function createPerformanceMonitor(app:pc.Application,publish:(sample:PerformanceSample|null)=>void,detailedStats:boolean) {
  let enabled=false,disposed=false,hasSample=false
  let pending:number|null=null,lastRender:number|null=null,start:number|null=null,lastSample:number|null=null
  let frames=0,calls=0,callSamples=0,triangles=0,triangleSamples=0
  let watchdog:ReturnType<typeof setTimeout>|undefined
  function reset() {
    pending=lastRender=start=lastSample=null;frames=calls=callSamples=triangles=triangleSamples=0
    clearTimeout(watchdog);watchdog=undefined
    if(hasSample){hasSample=false;publish(null)}
  }
  function idle() {
    watchdog=undefined
    if(!enabled||disposed)return
    const remaining=lastRender===null?0:1000-(performance.now()-lastRender)
    if(remaining>0)watchdog=setTimeout(idle,remaining)
    else reset()
  }
  function rendered() {
    if(!enabled||document.hidden)return
    pending=lastRender=performance.now()
    if(watchdog===undefined)watchdog=setTimeout(idle,1000)
  }
  function frameUpdate() {
    if(!enabled||document.hidden||pending===null)return
    const timestamp=pending;pending=null
    if(lastSample!==null&&(timestamp-lastSample>1000||timestamp<lastSample))reset()
    lastSample=timestamp
    if(start===null){start=timestamp;return}
    frames++
    const drawCalls=app.stats.drawCalls.total,triangleCount=detailedStats?app.stats.frame.triangles:undefined
    if(typeof drawCalls==='number'&&Number.isFinite(drawCalls)&&drawCalls>=0){calls+=drawCalls;callSamples++}
    if(typeof triangleCount==='number'&&Number.isFinite(triangleCount)&&triangleCount>=0){triangles+=triangleCount;triangleSamples++}
    const span=timestamp-start
    if(span<750)return
    hasSample=true
    publish({fps:frames*1000/span,frameMs:span/frames,drawCalls:callSamples?calls/callSamples:null,triangles:triangleSamples?triangles/triangleSamples:null})
    start=timestamp;frames=calls=callSamples=triangles=triangleSamples=0
  }
  function setEnabled(value:boolean) {
    if(disposed||value===enabled)return
    enabled=value;reset()
    if(value){app.on('postrender',rendered);app.on('frameupdate',frameUpdate);document.addEventListener('visibilitychange',reset)}
    else {app.off('postrender',rendered);app.off('frameupdate',frameUpdate);document.removeEventListener('visibilitychange',reset)}
  }
  return {setEnabled,reset,destroy(){if(disposed)return;setEnabled(false);disposed=true}}
}
