// 仅供隔离浏览器验收：读取物理状态，以原键盘事件操作，不写球体位置/速度/检查点。
(() => {
  const d = window.__water
  d.held = []
  d.hold = keys => {
    for (const code of d.held) if (!keys.includes(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
    for (const code of keys) if (!d.held.includes(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
    d.held = keys
  }
  d.pause = () => { d.hold([]); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', bubbles: true })) }
  d.route = { index: 0, lastFalls: 0, events: [], carry: null, lowStart: null, points: [
    [-27,18],[-21,18],[-15,18],[-6,18],[-6,14.85],[-6,5],[-6,2.5],[8,2.5],
    [8,4.3],[8,6.4],[8,9.35],[8,12.3],[8,15.25],[8,19],[20,19],
    [20,8.5],[20,-.8],[20,-10],[5.6,-10],[2,-10],[17.6,-10],[-4.377658676710961,-10],
  ] }
  d.snap = label => {
    const p=d.ball.getPosition(),v=d.ball.rigidbody.linearVelocity,s=d.state
    return {label,t:s.elapsed,phase:s.phase,level:s.levelId,cp:s.checkpoint,falls:s.falls,p:[p.x,p.y,p.z],v:[v.x,v.y,v.z],index:d.route.index}
  }
  d.contact = e => d.contacts.push({ ...d.snap('contact'), other:e.other.name })
  d.ball.collision.on('collisionstart',d.contact)
  let sampled=-1
  d.sample = () => {
    if (d.state.elapsed<sampled) sampled=-1
    if (d.state.phase!=='playing'||d.state.elapsed-sampled<.08) return
    sampled=d.state.elapsed
    const frame=d.snap('frame')
    frame.keys=[...d.held]
    frame.mechanisms=['hammer-1-head','hammer-2-head','hammer-3-head','cross-hub','cross-arm-positive-z','cross-arm-positive-x','lift-1','lift-2','lift-3','lift-4','Crossing platform'].map(name=>{
      const e=d.app.root.findByName(name),p=e.getPosition(),r=e.getEulerAngles()
      return {name,p:[p.x,p.y,p.z],r:[r.x,r.y,r.z]}
    })
    d.frames.push(frame)
  }
  d.drive = () => {
    const s=d.state,r=d.route,p=d.ball.getPosition(),v=d.ball.rigidbody.linearVelocity
    if(s.phase!=='playing'){d.hold([]);return}
    if(s.elapsed>300||s.falls>25){d.app.off('update',d.drive);d.pause();return}
    if(s.falls!==r.lastFalls){r.lastFalls=s.falls;r.index=[0,8,15,18][s.checkpoint];r.carry=null;r.lowStart=null;r.events.push(d.snap('respawn'))}
    let target=r.points[r.index]
    if(!target){d.hold([]);return}
    let dx=target[0]-p.x,dz=target[1]-p.z,dist=Math.hypot(dx,dz),feedX=0,feedZ=0
    if(r.carry){
      const angle=s.elapsed*.55-r.carry.alignment
      if(angle>=Math.PI-.25){r.events.push(d.snap('leave-cross-arm'));r.carry=null}
      else {
        target=[-6+3*Math.sin(angle),10+3*Math.cos(angle)]
        if(d.testVoid&&!d.voidTestDone&&p.z<13.5){
          r.carry.void=true;d.voidTestDone=true;r.events.push(d.snap('steer-into-open-corner'))
        }
        if(r.carry.void){target=[-6+2*Math.cos(angle)+2*Math.sin(angle),10-2*Math.sin(angle)+2*Math.cos(angle)]}
        if(p.z>14){target[0]=-6}else{feedX=1.65*Math.cos(angle);feedZ=-1.65*Math.sin(angle)}
        dx=target[0]-p.x;dz=target[1]-p.z;dist=Math.hypot(dx,dz)
      }
    }
    if(r.index===19&&r.lowStart!==null&&s.elapsed-r.lowStart>5){r.events.push(d.snap('low-speed-slope-end'));r.index=20;target=r.points[20];dx=target[0]-p.x;dz=target[1]-p.z;dist=Math.hypot(dx,dz)}
    if(!r.carry&&dist<.25&&Math.hypot(v.x,v.z)<1.2){
      if(r.index<3){const h=d.level.hammers[r.index];if(Math.abs(Math.sin((s.elapsed+.8)*h.angularSpeed+h.phase))<.94){d.hold(['Space']);return}}
      if(r.index===4){
        const a=s.elapsed*.55,alignment=Math.ceil(a/(Math.PI/2))*(Math.PI/2)
        const until=alignment-a
        if(until<.22||until>.34){d.hold(['Space']);return}
        r.carry={alignment};r.events.push(d.snap('board-cross-arm'))
      }
      if(r.index>=8&&r.index<=12&&Math.abs(Math.sin(.7*(s.elapsed+.5)))>.15){d.hold(['Space']);return}
      if(r.index===15){const offset=3.6*Math.sin(s.elapsed*1.25),speed=4.5*Math.cos(s.elapsed*1.25);if(Math.abs(offset)<3.4||Math.abs(speed)>1.4){d.hold(['Space']);return}}
      if(r.index===18){if(Math.hypot(v.x,v.z)>.05){d.hold(['Space']);return}r.lowStart=s.elapsed;r.events.push(d.snap('low-speed-slope-start'))}
      r.events.push(d.snap('waypoint'));r.index++;target=r.points[r.index]
      if(!target){d.hold([]);return}
      dx=target[0]-p.x;dz=target[1]-p.z;dist=Math.hypot(dx,dz)
    }
    const cap=[16,19,21].includes(r.index)?7:4.2
    // 低速对照连续按A五秒，不能因接近测试目标而提前减速，制造“冲不上”的结果。
    if(r.index===19){d.hold(['KeyA']);return}
    const tx=Math.max(-cap,Math.min(cap,dx*2.5+feedX)),tz=Math.max(-cap,Math.min(cap,dz*2.5+feedZ)),keys=[]
    if(tx-v.x>.25)keys.push('KeyD');else if(tx-v.x<-.25)keys.push('KeyA')
    if(tz-v.z>.25)keys.push('KeyS');else if(tz-v.z<-.25)keys.push('KeyW')
    if(!r.carry&&dist<.7&&Math.hypot(v.x,v.z)>1.1)keys.push('Space')
    d.hold(keys)
  }
  d.app.on('update',d.sample);d.app.on('update',d.drive)
  return 'Second-level keyboard playtest started'
})()
