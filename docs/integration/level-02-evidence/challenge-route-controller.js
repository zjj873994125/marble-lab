// 验收专用键盘控制器；只读场景状态并派发原按键，不写位置/速度/检查点。
(() => {
  const d=window.__challenge
  d.held=[];d.frames=[];d.contacts=[]
  d.hold=keys=>{for(const code of d.held)if(!keys.includes(code))window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));for(const code of keys)if(!d.held.includes(code))window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));d.held=keys}
  d.pause=()=>{d.hold([]);window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'Escape',bubbles:true}))}
  d.route={index:0,lastFalls:0,events:[],carry:null,bridgePaused:false,points:[[-27,18],[-21,18],[-15,18],[-6,18],[-6,14.85],[-6,5],[-6,2.5],[8,2.5],[8,4.3],[8,6.4],[8,9.35],[8,12.3],[8,15.25],[8,19],[20,19],[20,8.5],[20,-.8],[20,-10],[d.level.finish.position[0],d.level.finish.position[2]]]}
  const lengths=[0];for(let i=1;i<d.sPath.length;i++)lengths.push(lengths[i-1]+Math.hypot(d.sPath[i][0]-d.sPath[i-1][0],d.sPath[i][2]-d.sPath[i-1][2]))
  function followS(p){let nearest={distance:Infinity,progress:0};for(let i=0;i<d.sPath.length-1;i++){const a=d.sPath[i],b=d.sPath[i+1],dx=b[0]-a[0],dz=b[2]-a[2],length=lengths[i+1]-lengths[i];const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[2])*dz)/(length*length)));const distance=Math.hypot(p.x-a[0]-t*dx,p.z-a[2]-t*dz);if(distance<nearest.distance)nearest={distance,progress:lengths[i]+t*length}}const progress=nearest.progress+2;for(let i=0;i<d.sPath.length-1;i++)if(lengths[i+1]>=progress){const t=(progress-lengths[i])/(lengths[i+1]-lengths[i]);return [d.sPath[i][0]+t*(d.sPath[i+1][0]-d.sPath[i][0]),d.sPath[i][2]+t*(d.sPath[i+1][2]-d.sPath[i][2])]}return d.route.points[18]}
  d.snap=label=>{const p=d.ball.getPosition(),v=d.ball.rigidbody.linearVelocity;const input=document.querySelector('main').__vueParentComponent.setupState.touchInput;return {label,t:d.state.elapsed,phase:d.state.phase,cp:d.state.checkpoint,falls:d.state.falls,index:d.route.index,p:[p.x,p.y,p.z],v:[v.x,v.y,v.z],keys:[...d.held],touch:{x:input.x,z:input.z,brake:input.brake}}}
  d.contact=e=>d.contacts.push({...d.snap('contact'),other:e.other.name})
  d.ball.collision.on('collisionstart',d.contact)
  let sampled=-1
  d.sample=()=>{if(d.state.phase!=='playing'||d.state.elapsed-sampled<.075)return;sampled=d.state.elapsed;const f=d.snap('frame');f.mechanisms=['hammer-1-head','hammer-2-head','hammer-3-head','cross-arm-positive-z','lift-1','lift-2','lift-3','lift-4','Crossing platform'].map(name=>{const e=d.app.root.findByName(name),p=e.getPosition(),r=e.getEulerAngles();return {name,p:[p.x,p.y,p.z],r:[r.x,r.y,r.z]}});d.frames.push(f)}
  d.drive=()=>{
    const s=d.state,r=d.route,p=d.ball.getPosition(),v=d.ball.rigidbody.linearVelocity
    if(s.phase!=='playing'){d.hold([]);return}
    if(s.elapsed>360||s.falls>30){d.app.off('update',d.drive);d.pause();return}
    if(s.falls!==r.lastFalls){r.lastFalls=s.falls;r.index=[0,8,15,17][s.checkpoint];r.carry=null;r.events.push(d.snap('respawn'))}
    if(d.manual){d.hold([]);return}
    let target=r.points[r.index],feedX=0,feedZ=0
    if(!target){d.hold([]);return}
    if(r.index===18){target=followS(p);const dx=target[0]-p.x,dz=target[1]-p.z,length=Math.hypot(dx,dz),keys=[];const vx=7*dx/length,vz=7*dz/length;if(vx-v.x>.18)keys.push('KeyD');else if(vx-v.x<-.18)keys.push('KeyA');if(vz-v.z>.18)keys.push('KeyS');else if(vz-v.z<-.18)keys.push('KeyW');d.hold(keys);return}
    if(r.carry){const speed=d.level.turntable.angularSpeed,angle=s.elapsed*speed-r.carry.alignment,radius=2.7;if(angle>=Math.PI-.28){r.events.push(d.snap('leave-cross'));r.carry=null}else{target=[-6+radius*Math.sin(angle),10+radius*Math.cos(angle)];if(p.z>14)target[0]=-6;else{feedX=radius*speed*Math.cos(angle);feedZ=-radius*speed*Math.sin(angle)}}}
    let dx=target[0]-p.x,dz=target[1]-p.z,dist=Math.hypot(dx,dz)
    if(!r.carry&&dist<.25&&Math.hypot(v.x,v.z)<1.2){
      if(r.index<3){const h=d.level.hammers[r.index];if(Math.abs(Math.sin((s.elapsed+.8)*h.angularSpeed+h.phase))<.94){d.hold(['Space']);return}}
      if(r.index===4){const a=s.elapsed*d.level.turntable.angularSpeed,alignment=Math.ceil(a/(Math.PI/2))*(Math.PI/2),until=alignment-a;if(until<.32||until>.42){d.hold(['Space']);return}r.carry={alignment};r.events.push(d.snap('board-cross'))}
      if(r.index>=8&&r.index<=12){const first=r.index===8,last=r.index===12,i=first?0:r.index-9,config=d.level.lifts[i],lookahead=first?.42:.6,y=config.amplitude*Math.sin(config.angularSpeed*(s.elapsed+lookahead)+config.phase),difference=first?y:last?-y:-2*y;if(difference<-.16||difference>.03){d.hold(['Space']);return}}
      if(r.index===15){const c=d.level.platform,offset=c.amplitude*Math.sin(s.elapsed*c.angularSpeed),speed=c.amplitude*c.angularSpeed*Math.cos(s.elapsed*c.angularSpeed);if(Math.abs(offset)<c.amplitude-.2||Math.abs(speed)>1.4){d.hold(['Space']);return}}
      r.events.push(d.snap('waypoint'));r.index++
      if(r.index===15&&!r.bridgePaused&&d.pauseAtBridge){r.bridgePaused=true;d.manual=true;d.pause();return}
      target=r.points[r.index];if(!target){d.hold([]);return}dx=target[0]-p.x;dz=target[1]-p.z;dist=Math.hypot(dx,dz)
    }
    const cap=r.index<=3?6.3:r.index===16?7:4.2,tx=Math.max(-cap,Math.min(cap,dx*2.5+feedX)),tz=Math.max(-cap,Math.min(cap,dz*2.5+feedZ)),keys=[]
    if(tx-v.x>.2)keys.push('KeyD');else if(tx-v.x<-.2)keys.push('KeyA')
    if(tz-v.z>.2)keys.push('KeyS');else if(tz-v.z<-.2)keys.push('KeyW')
    if(!r.carry&&dist<.7&&Math.hypot(v.x,v.z)>1.1)keys.push('Space')
    d.hold(keys)
  }
  d.app.on('update',d.sample);d.app.on('update',d.drive)
  return 'challenge route started'
})()
