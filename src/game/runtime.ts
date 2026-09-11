import * as pc from 'playcanvas'
import type { Phase, Settings } from '../state'
import { attachTrackVisuals } from './track-visuals'
import { attachHammerVisuals, createHammerCapsuleGeometry, createHammerCylinderGeometry } from './hammer-visuals'
import { createWaterMaterial } from './water-material'
import { createSteelMaterial } from './steel-material'
import { createModelAssets, attachMovingVisual } from './model-assets'
import { arcHammerPose, liftPosition, turntablePose } from './mechanism-motion'
import type { LevelConfig, Position, PrimitiveConfig, RingConfig } from './level-types'

interface Hooks {
  settings: () => Settings; phase: () => Phase
  tick: (time: number, falls: number, checkpoint: number, progress: number) => void
  finish: () => void; pause: () => void; restart: () => void
}
export interface MarbleGame { start: () => void; setPhase: (phase: Phase) => void; applySettings: () => void; destroy: () => void }
let physics: Promise<unknown> | undefined

export async function createGame(canvas: HTMLCanvasElement, hooks: Hooks, level: LevelConfig, signal?: AbortSignal): Promise<MarbleGame> {
  // Ammo 只初始化一次，Vue 页面切换不会重复加载物理模块。
  physics ??= new Promise((resolve, reject) => {
    pc.WasmModule.setConfig('Ammo', { glueUrl: `${import.meta.env.BASE_URL}vendor/ammo.wasm.js`, wasmUrl: `${import.meta.env.BASE_URL}vendor/ammo.wasm.wasm`, errorHandler: reject })
    pc.WasmModule.getInstance('Ammo', resolve)
  }).catch(error => { physics = undefined; throw error })
  await physics
  if (signal?.aborted) throw new DOMException('关卡已卸载', 'AbortError')
  const app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true, alpha: true, powerPreference: 'high-performance' } })
  app.setCanvasFillMode(pc.FILLMODE_NONE)
  app.setCanvasResolution(pc.RESOLUTION_AUTO)
  app.scene.ambientLight = new pc.Color(.73, .76, .74)
  app.scene.exposure = 1.35
  const physicsSystem = app.systems.rigidbody!
  physicsSystem.setPhysicsWorld(new pc.AmmoPhysicsWorld())
  physicsSystem.gravity.set(0, -16, 0)
  physicsSystem.fixedTimeStep = 1 / 120
  physicsSystem.maxSubSteps = 10
  app.timeScale = 0

  const materials: pc.StandardMaterial[] = []
  const meshes: pc.Mesh[] = []
  function mat(hex: string, metal = 0, gloss = .35) {
    const m = new pc.StandardMaterial()
    m.diffuse = new pc.Color().fromString(hex)
    m.useMetalness = true; m.metalness = metal; m.gloss = gloss
    m.update(); materials.push(m); return m
  }
  const cream = mat('#fff9e7'), edge = mat('#c9d3ce'), orange = mat('#e77442'), dark = mat('#465d64'), blue = mat('#91b7c3'), floorMat = mat('#dce2d8')
  const steel = createSteelMaterial(app)
  function primitive(name: string, type: PrimitiveConfig['type'], pos: number[], scale: number[], material: pc.StandardMaterial, body?: 'static' | 'dynamic' | 'kinematic', collisionAxis: 1 | 2 = 1, rotation: Position = [0,0,0]) {
    const e = new pc.Entity(name)
    if (type === 'capsule' || (type === 'cylinder' && collisionAxis === 2)) {
      const geometry = type === 'capsule' ? createHammerCapsuleGeometry : createHammerCylinderGeometry
      const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry([scale[0]!, scale[1]!, scale[2]!]))
      meshes.push(mesh)
      e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: true, receiveShadows: true })
    } else {
      e.addComponent('render', { type, material, castShadows: true, receiveShadows: true })
      e.setLocalScale(scale[0]!,scale[1]!,scale[2]!)
    }
    e.setPosition(pos[0]!,pos[1]!,pos[2]!); e.setEulerAngles(...rotation); app.root.addChild(e)
    if (body) {
      // 碰撞形状使用基本几何体，避免把视觉细节带入物理计算。
      if (type === 'sphere') e.addComponent('collision', { type, radius: scale[0]! / 2 })
      else if (type === 'capsule') e.addComponent('collision', { type, axis: 2, radius: scale[0]! / 2, height: scale[2]! })
      else if (type === 'cylinder') e.addComponent('collision', { type, axis: collisionAxis, radius: scale[0]! / 2, height: scale[collisionAxis]! })
      else e.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(scale[0]! / 2,scale[1]! / 2,scale[2]! / 2) })
      e.addComponent('rigidbody', { type: body, mass: body === 'dynamic' ? 1 : 0, friction: .55, restitution: .06, linearDamping: .13, angularDamping: .12 })
    }
    return e
  }
  function ring(name: string, x: number, y: number, z: number, radius: number, material: pc.StandardMaterial) {
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.TorusGeometry({ tubeRadius: .045, ringRadius: radius, segments: 48, sides: 10 }))
    meshes.push(mesh)
    const e = new pc.Entity(name); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)] }); e.setPosition(x,y,z); app.root.addChild(e); return e
  }
  const camera = new pc.Entity('Camera')
  camera.addComponent('camera', { clearColor: new pc.Color(.937,.933,.91,0), projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 18, nearClip: .1, farClip: 160, toneMapping: pc.TONEMAP_ACES })
  app.root.addChild(camera)
  const sun = new pc.Entity('Key light'); sun.addComponent('light', { type: 'directional', color: new pc.Color(1,.96,.86), intensity: 2.2, castShadows: true, shadowDistance: 90, shadowResolution: 2048, shadowBias: .15, normalOffsetBias: .05, shadowType: pc.SHADOW_PCF3 }); sun.setEulerAngles(48,-35,-15); app.root.addChild(sun)
  const fill = new pc.Entity('Soft fill'); fill.addComponent('light', { type: 'directional', color: new pc.Color(.65,.8,1), intensity: .65 }); fill.setEulerAngles(65,145,0); app.root.addChild(fill)

  const water = level.staticObjects.some(object => object.material === 'water') ? createWaterMaterial(app) : undefined
  const poolEdge = mat('#617b80')
  const palette = { cream, edge, orange, dark, blue, floorMat, water: water?.material ?? floorMat, poolEdge }
  const replaced: pc.RenderComponent[] = []
  function addObject(config: PrimitiveConfig, body: 'static' | 'kinematic' | undefined = config.body) {
    const entity = primitive(config.name, config.type, config.position, config.size, palette[config.material], body, config.collisionAxis, config.rotation)
    if (config.refinedVisual) replaced.push(entity.render!)
    return entity
  }
  function addRing(name: string, config: RingConfig, material: pc.StandardMaterial) {
    return ring(name, ...config.position, config.radius, material)
  }
  // 关卡配置只提供数据；实体、碰撞体和生命周期由运行时统一管理。
  level.staticObjects.forEach(config => addObject(config))
  const checkpoints = level.checkpoints.map(point => new pc.Vec3(...point.position))
  const checkpointRings = level.checkpoints.map((point, i) => addRing(`Checkpoint ${i+1}`, point.ring, blue))
  addRing('Start ring', level.start.ring, orange)
  addRing('Finish ring', level.finish.ring, orange)
  const pendulumConfig = level.pendulum, platformConfig = level.platform
  const pendulum = pendulumConfig ? addObject(pendulumConfig.ball, 'kinematic') : undefined
  const rod = pendulumConfig ? addObject(pendulumConfig.rod) : undefined
  const hammers = (level.hammers ?? []).map(config => ({ config, head: addObject(config.ball, 'kinematic'), rod: addObject(config.rod) }))
  const lifts = (level.lifts ?? []).map(config => ({ config, entity: addObject(config.body, 'kinematic') }))
  const turntable = level.turntable ? { config: level.turntable, root: new pc.Entity('Turntable visuals'), parts: level.turntable.parts.map(part => addObject(part, 'kinematic')) } : undefined
  if (turntable) app.root.addChild(turntable.root)
  const platform = addObject(platformConfig.body, 'kinematic')
  const platformStripe = addObject(platformConfig.stripe)
  replaced.push(platform.render!)
  const ball = primitive('Player marble','sphere',level.start.previewPosition,[.85,.85,.85],steel.material,'dynamic')
  const ballMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry({ radius: .5, latitudeBands: 32, longitudeBands: 48, calculateTangents: true }))
  meshes.push(ballMesh)
  ball.render!.meshInstances = [new pc.MeshInstance(ballMesh, steel.material)]
  const rigid = ball.rigidbody!
  const ammoBody = rigid.body as { setCcdMotionThreshold?: (v:number)=>void; setCcdSweptSphereRadius?: (v:number)=>void }
  ammoBody.setCcdMotionThreshold?.(.15); ammoBody.setCcdSweptSphereRadius?.(.3)
  const modelAssets = createModelAssets(app, signal)
  const visualDisposers = await Promise.all([
    attachTrackVisuals(app, platform, level.visuals, replaced, modelAssets.load),
    ...(pendulum && rod ? [attachHammerVisuals(app, pendulum, rod, pendulumConfig!.visuals, modelAssets.load)] : []),
    ...hammers.map(hammer => attachHammerVisuals(app, hammer.head, hammer.rod, hammer.config.visuals, modelAssets.load)),
    ...lifts.map(lift => attachMovingVisual(modelAssets.load, lift.config.visual, lift.entity, [lift.entity.render!])),
    ...(turntable ? [attachMovingVisual(modelAssets.load, turntable.config.visual, turntable.root, turntable.parts.map(part => part.render!))] : []),
  ])
  function disposeScene() { visualDisposers.forEach(dispose => dispose()); modelAssets.destroy(); water?.destroy(); steel.destroy(); app.destroy(); materials.forEach(m=>m.destroy()); meshes.forEach(m=>m.destroy()) }
  if (signal?.aborted) { disposeScene(); throw new DOMException('关卡已卸载', 'AbortError') }

  let audio: AudioContext | undefined
  function tone(frequency: number, duration = .09) {
    if (!audio || hooks.settings().volume <= 0) return
    const gain = audio.createGain(), osc = audio.createOscillator()
    osc.frequency.value = frequency; osc.type = 'sine'; gain.gain.setValueAtTime(hooks.settings().volume / 100 * .1, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration)
    osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime+duration)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
  }
  let soundAt = 0
  ball.collision!.on('collisionstart', () => { if (hooks.phase()==='playing' && performance.now()-soundAt>140 && rigid.linearVelocity.length()>1.5) { tone(170,.05); soundAt=performance.now() } })
  let elapsed = 0, falls = 0, checkpoint = 0, time = 0
  const keys = new Set<string>()
  const pos = new pc.Vec3(), cameraTarget = new pc.Vec3(), cameraPosition = new pc.Vec3()
  const initial = new pc.Vec3(...level.start.position)
  function updateMechanisms() {
    if (pendulumConfig && pendulum && rod) {
      const px=Math.sin(time*pendulumConfig.angularSpeed)*pendulumConfig.amplitude
      pendulum.setPosition(pendulumConfig.ball.position[0],pendulumConfig.ball.position[1]+Math.abs(px)*pendulumConfig.lift,pendulumConfig.ball.position[2]+px)
      const a = new pc.Vec3(...pendulumConfig.anchor), b=pendulum.getPosition()
      rod.setPosition(new pc.Vec3().lerp(a,b,.5)); rod.setLocalScale(pendulumConfig.rodWidth,a.distance(b),pendulumConfig.rodWidth)
      const direction = (level.rulesVersion ?? 'classic') !== 'classic' ? new pc.Vec3().sub2(a,b).normalize() : new pc.Vec3().sub2(b,a).normalize(); const rotation = new pc.Quat().setFromDirections(pc.Vec3.UP,direction); rod.setRotation(rotation)
      if ((level.rulesVersion ?? 'classic') !== 'classic') pendulum.setRotation(rotation)
    }
      hammers.forEach(({ config, head, rod }) => {
        const pose = arcHammerPose(config, time)
        head.setPosition(...pose.head); head.setEulerAngles(...pose.rotation)
        rod.setPosition(...pose.rod); rod.setEulerAngles(...pose.rotation); rod.setLocalScale(config.rodWidth, config.rodLength, config.rodWidth)
      })
      lifts.forEach(({ config, entity }) => entity.setPosition(...liftPosition(config, time)))
      if (turntable) {
        const pose = turntablePose(turntable.config, time)
        turntable.root.setPosition(...turntable.config.position); turntable.root.setEulerAngles(...pose.rotation)
        turntable.parts.forEach((part, index) => { part.setPosition(...pose.parts[index]!); part.setEulerAngles(...pose.rotation) })
      }
      const offset = Math.sin(time*platformConfig.angularSpeed)*platformConfig.amplitude
      const xPlatform = platformConfig.axis === 'x' ? (platformConfig.centerX ?? platformConfig.body.position[0]) + offset : platformConfig.body.position[0]
      const zPlatform = platformConfig.axis === 'x' ? platformConfig.centerZ : platformConfig.centerZ + offset
      platform.setPosition(xPlatform,platformConfig.body.position[1],zPlatform)
      platformStripe.setPosition(platformConfig.axis === 'x' ? xPlatform : platformConfig.stripe.position[0],platformConfig.stripeY,zPlatform)
  }
  if ((level.rulesVersion ?? 'classic') !== 'classic') updateMechanisms()
  function respawn() { rigid.teleport(checkpoint ? checkpoints[checkpoint-1]! : initial, pc.Vec3.ZERO); rigid.linearVelocity=pc.Vec3.ZERO; rigid.angularVelocity=pc.Vec3.ZERO }
  function setPhase(phase: Phase) { keys.clear(); app.timeScale = phase==='playing' ? 1 : 0; if (phase==='menu') respawn() }
  function start() {
    elapsed=0; falls=0; checkpoint=0; time=0; keys.clear()
    if ((level.rulesVersion ?? 'classic') !== 'classic') updateMechanisms()
    checkpointRings.forEach(e=>e.render!.meshInstances.forEach(m=>m.material=blue))
    respawn(); cameraTarget.copy(initial); cameraPosition.set(initial.x,initial.y+17,initial.z+13)
    if (!audio) { try { audio = new AudioContext() } catch { /* 没有音频设备时保留可玩性。 */ } }
    void audio?.resume().catch(()=>{})
    hooks.tick(0,0,0,0); app.timeScale=1; tone(520,.12)
  }
  function down(e: KeyboardEvent) {
    if (e.target instanceof HTMLElement && (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.target.isContentEditable)) return
    if (hooks.phase()==='menu') return
    if (hooks.phase()!=='playing') { if (!e.repeat && e.code==='Escape') hooks.pause(); return }
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Escape','KeyR'].includes(e.code)) e.preventDefault()
    if (!e.repeat && e.code==='Escape') hooks.pause()
    if (!e.repeat && e.code==='KeyR') hooks.restart()
    if (hooks.phase()==='playing') keys.add(e.code)
  }
  function up(e: KeyboardEvent) { keys.delete(e.code) }
  function blur() { keys.clear(); if (hooks.phase()==='playing') hooks.pause() }
  function hidden() { if (document.hidden) blur() }
  window.addEventListener('keydown',down); window.addEventListener('keyup',up); window.addEventListener('blur',blur); document.addEventListener('visibilitychange',hidden)
  function resize() { const r=canvas.parentElement!.getBoundingClientRect(); app.resizeCanvas(Math.max(1,r.width),Math.max(1,r.height)) }
  const observer = new ResizeObserver(resize); observer.observe(canvas.parentElement!)
  function applySettings() { app.graphicsDevice.maxPixelRatio=hooks.settings().quality==='high' ? Math.min(devicePixelRatio,1.7) : 1; sun.light!.castShadows=hooks.settings().quality==='high'; if (water && (hooks.settings().quality==='low' || hooks.settings().reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches)) water.update(0); resize() }
  applySettings()
  app.on('update',(delta: number)=>{
    const phase = hooks.phase()
    if (phase==='playing') {
      const dt=Math.min(delta,.075)
      elapsed+=dt; time+=dt
      updateMechanisms()
      if (water) water.update(hooks.settings().quality === 'high' && !hooks.settings().reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches ? time : 0)
      let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))
      let zforce=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))
      const length=Math.hypot(x,zforce)
      if(length) { x/=length; zforce/=length; rigid.applyForce(x*12*hooks.settings().sensitivity,0,zforce*12*hooks.settings().sensitivity) }
      const v=rigid.linearVelocity
      const speed=Math.hypot(v.x,v.z)
      if (speed>7) rigid.linearVelocity=new pc.Vec3(v.x*7/speed,v.y,v.z*7/speed)
      if(keys.has('Space')) { const brake=Math.exp(-7*dt); rigid.linearVelocity=new pc.Vec3(v.x*brake,v.y,v.z*brake) }
      pos.copy(ball.getPosition())
      if(pos.y<level.fallY) { falls++; tone(140,.18); respawn(); pos.copy(ball.getPosition()) }
      const next=checkpoints[checkpoint]
      if(next && Math.hypot(pos.x-next.x,pos.z-next.z)<level.checkpointTrigger.radius && Math.abs(pos.y-next.y)<level.checkpointTrigger.heightTolerance) {
        checkpointRings[checkpoint]!.render!.meshInstances.forEach(m=>m.material=orange); checkpoint++; tone(650+checkpoint*140,.18)
      }
      const segment=level.progress[checkpoint]!
      const progress=segment.base+Math.max(0,Math.min(segment.max,((segment.axis === 'x' ? pos.x : pos.z)-(segment.origin ?? segment.originZ))*segment.direction/segment.divisor))
      hooks.tick(elapsed,falls,checkpoint,progress)
      if(checkpoint===checkpoints.length && Math.hypot(pos.x-level.finish.position[0],pos.z-level.finish.position[2])<level.finish.radius && Math.abs(pos.y-level.finish.position[1])<level.finish.heightTolerance) { hooks.tick(elapsed,falls,checkpoint,1); tone(1100,.35); hooks.finish(); app.timeScale=0; keys.clear() }
    }
    steel.update(Math.hypot(rigid.linearVelocity.x, rigid.linearVelocity.z))
    if(phase==='menu') {
      const drift = hooks.settings().reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.sin(performance.now()*.00012)*1.3
      camera.setPosition(27+drift,32,32); camera.lookAt(1,1,0); camera.camera!.orthoHeight=19
    } else {
      pos.copy(ball.getPosition()); cameraTarget.lerp(cameraTarget,pos,1-Math.exp(-8*Math.max(delta,.016)))
      cameraPosition.set(cameraTarget.x,cameraTarget.y+17,cameraTarget.z+13)
      camera.setPosition(cameraPosition); camera.lookAt(cameraTarget.x,cameraTarget.y,cameraTarget.z-2)
      camera.camera!.orthoHeight=9
    }
  })
  app.start()
  return { start,setPhase,applySettings,destroy() { observer.disconnect(); window.removeEventListener('keydown',down); window.removeEventListener('keyup',up); window.removeEventListener('blur',blur); document.removeEventListener('visibilitychange',hidden); void audio?.close(); disposeScene() } }
}
