// 短段诊断：复用createGame和完整碰撞配置，仅把测试出生点设在CP3/坡脚。
// 只发键盘事件，不写球体位置/速度、不触发存档或冒充从正式起点通关。
window.runSCurveFixture = async mode => {
  const d=window.__sFixture,config=structuredClone(d.level)
  config.visuals=null;config.hammers=[];config.lifts=[];config.turntable=undefined
  const spawn=mode==='foot'?[d.foot[0]+.3,d.foot[1]+.55,d.foot[2]]:config.checkpoints[2].position
  config.start.position=[...spawn];config.start.previewPosition=[...spawn]
  const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:99999;background:#f3f2eb';document.body.append(host)
  const canvas=document.createElement('canvas');host.append(canvas)
  const label=document.createElement('div');label.textContent=`短段物理对照 · ${mode} · 无额外推力/速度写入`;label.style.cssText='position:absolute;left:20px;top:20px;background:#fff9e7;padding:10px;border-radius:8px';host.append(label)
  let phase='playing',elapsed=0,falls=0,held=[],brakeUntil=0,braked=false,lastSample=-1
  const frames=[],events=[]
  const hold=keys=>{for(const code of held)if(!keys.includes(code))window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));for(const code of keys)if(!held.includes(code))window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));held=keys}
  const game=await d.createGame(canvas,{settings:()=>({quality:'high',volume:0,sensitivity:1,reducedMotion:true}),phase:()=>phase,tick:(t,f)=>{elapsed=t;falls=f},finish:()=>{},pause:()=>{},restart:()=>{}},config)
  const app=d.pc.Application.getApplication(),ball=app.root.findByName('Player marble')
  const path=d.path.map(p=>[p[0],p.length===3?p[2]:p[1]])
  const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]))
  const nearest=p=>{let best={distance:Infinity,progress:0};for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=lengths[i+1]-lengths[i];const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/(length*length)));const distance=Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz);if(distance<best.distance)best={distance,progress:lengths[i]+t*length}}return best}
  const ahead=progress=>{for(let i=0;i<path.length-1;i++)if(lengths[i+1]>=progress){const t=(progress-lengths[i])/(lengths[i+1]-lengths[i]);return [path[i][0]+t*(path[i+1][0]-path[i][0]),path[i][1]+t*(path[i+1][1]-path[i][1])]}return path.at(-1)}
  const checkpoints=(mode==='foot'?[]:d.markers).map(m=>({...m,seen:false}))
  const snap=label=>{const p=ball.getPosition(),v=ball.rigidbody.linearVelocity;return {label,t:elapsed,falls,p:[p.x,p.y,p.z],v:[v.x,v.y,v.z],speed:Math.hypot(v.x,v.z),keys:[...held]}}
  let outcome='timeout',started=false,enteredMain=false
  game.start()
  await new Promise(resolve=>{
    const stop=reason=>{outcome=reason;hold([]);app.off('update',drive);phase='paused';game.setPhase('paused');resolve()}
    const drive=()=>{
      const p=ball.getPosition(),v=ball.rigidbody.linearVelocity,projection=nearest(p)
      if(elapsed-lastSample>.04){lastSample=elapsed;frames.push(snap('frame'))}
      if(!started){if(elapsed<.5||Math.hypot(v.x,v.z)>.05){hold(['Space']);return}started=true;events.push(snap('start'))}
      for(const marker of checkpoints)if(!marker.seen&&projection.progress>=marker.progress){marker.seen=true;events.push(snap(marker.name))}
      if(falls){stop('fell');return}
      if(p.x<d.mainStartX+.15)enteredMain=true
      if(p.x<=config.finish.position[0]+1&&Math.abs(p.z-config.finish.position[2])<1.2&&p.y>=config.finish.position[1]-.3){stop('reached-summit');return}
      if(enteredMain&&v.x>.25){stop('slid-back');return}
      if(elapsed>18){stop('timeout');return}
      if(mode==='braked'&&!braked&&projection.progress>=d.brakeProgress){braked=true;brakeUntil=elapsed+1.1;events.push(snap('brake-in-last-turn'))}
      if(elapsed<brakeUntil){hold(['Space']);return}
      if(mode==='foot'){hold(['KeyA']);return}
      const target=ahead(projection.progress+2),dx=target[0]-p.x,dz=target[1]-p.z,length=Math.hypot(dx,dz),keys=[]
      const vx=7*dx/length,vz=7*dz/length
      if(vx-v.x>.18)keys.push('KeyD');else if(vx-v.x<-.18)keys.push('KeyA')
      if(vz-v.z>.18)keys.push('KeyS');else if(vz-v.z<-.18)keys.push('KeyW')
      hold(keys)
    }
    app.on('update',drive)
  })
  const result={mode,outcome,kind:'isolated-CP3-or-foot-spawn-diagnostic',spawn,finish:config.finish.position,frames,events,last:snap('end')}
  d.results.push(result)
  d.cleanup=()=>{hold([]);game.destroy();host.remove()}
  return {mode,outcome,events,last:result.last}
}
