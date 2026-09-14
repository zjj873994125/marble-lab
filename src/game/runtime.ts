import * as pc from 'playcanvas'
import type { Phase, Settings } from '../state'
import { attachTrackVisuals } from './track-visuals'
import { createHammerCapsuleGeometry, createHammerCylinderGeometry } from './hammer-visuals'
import { createWaterMaterial } from './water-material'
import { createSteelMaterial } from './steel-material'
import { createModelAssets } from './model-assets'
import { resolveInput, type GameInput } from './input'
import { createLibraryMechanisms } from './library-mechanisms'
import { createThemeMaterials } from './theme-materials'
import { primitiveThemeRoles, type ThemeRole } from './track-themes'
import { createPerformanceMonitor, type PerformanceSample } from './performance'
import { createLegacyMechanisms } from './legacy-mechanisms'
import { createCourseProgress } from './course-progress'
import { createAdvancedMechanisms } from './advanced-mechanisms'
import type { LevelConfig, Position, PrimitiveConfig, RingConfig } from './level-types'

interface Hooks {
  settings: () => Settings; phase: () => Phase
  input?: () => GameInput | undefined
  performanceEnabled?: () => boolean
  performance?: (sample:PerformanceSample|null) => void
  tick: (time: number, falls: number, checkpoint: number, progress: number) => void
  finish: (route?:string) => void; pause: () => void; restart: () => void
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
  const themes=createThemeMaterials(()=>hooks.settings().trackTheme)
  if(water)themes.material(water.material,'water',true)
  const replaced: pc.RenderComponent[] = []
  function addObject(config: PrimitiveConfig, body: 'static' | 'dynamic' | 'kinematic' | undefined = config.body, role:ThemeRole|null|undefined = config.name==='Approach marking'?null:primitiveThemeRoles[config.material]) {
    const material=themes.material(palette[config.material],role??undefined) as pc.StandardMaterial
    const entity = primitive(config.name, config.type, config.position, config.size, material, body, config.collisionAxis, config.rotation)
    if (config.refinedVisual) replaced.push(entity.render!)
    return entity
  }
  function addRing(name: string, config: RingConfig, material: pc.StandardMaterial) {
    return ring(name, ...config.position, config.radius, material)
  }
  // 关卡配置只提供数据；实体、碰撞体和生命周期由运行时统一管理。
  level.staticObjects.forEach(config => addObject(config))
  const checkpoints = level.checkpoints.map(point => new pc.Vec3(...point.position))
  const courseCheckpointRings=new Map(level.course?.checkpoints.map(point=>[point.id,addRing(`Checkpoint ${point.id}`,point.ring,blue)])??[])
  const checkpointRings = level.course?[...courseCheckpointRings.values()]:level.checkpoints.map((point, i) => addRing(`Checkpoint ${i+1}`, point.ring, blue))
  addRing('Start ring', level.start.ring, orange)
  addRing('Finish ring', level.finish.ring, orange)
  const ball = primitive('Player marble','sphere',level.start.previewPosition,[.85,.85,.85],steel.material,'dynamic')
  const ballMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry({ radius: .5, latitudeBands: 32, longitudeBands: 48, calculateTangents: true }))
  meshes.push(ballMesh)
  ball.render!.meshInstances = [new pc.MeshInstance(ballMesh, steel.material)]
  const rigid = ball.rigidbody!
  const ammoBody = rigid.body as { setCcdMotionThreshold?: (v:number)=>void; setCcdSweptSphereRadius?: (v:number)=>void }
  ammoBody.setCcdMotionThreshold?.(.15); ammoBody.setCcdSweptSphereRadius?.(.3)
  const modelAssets = createModelAssets(app)
  const performanceMonitor=createPerformanceMonitor(app,sample=>hooks.performance?.(sample),import.meta.env.DEV)
  const legacyMechanisms=createLegacyMechanisms(app,level,addObject,modelAssets.load,themes.applyEntity)
  const platform=legacyMechanisms.legacyPlatform
  if(platform)replaced.push(platform.render!)
  let libraryMechanisms: ReturnType<typeof createLibraryMechanisms>
  try { libraryMechanisms = createLibraryMechanisms(app, level.mechanisms ?? [], addObject, modelAssets.load,themes.applyEntity) }
  catch (error) { performanceMonitor.destroy(); themes.destroy(); modelAssets.destroy(); water?.destroy(); steel.destroy(); app.destroy(); materials.forEach(m=>m.destroy()); meshes.forEach(m=>m.destroy()); throw error }
  let advancedMechanisms:ReturnType<typeof createAdvancedMechanisms>
  try {advancedMechanisms=createAdvancedMechanisms(app,level.advancedMechanisms??[],addObject,ball,modelAssets.load,themes.applyEntity)}
  catch(error){performanceMonitor.destroy();libraryMechanisms.destroy();themes.destroy();modelAssets.destroy();water?.destroy();steel.destroy();app.destroy();materials.forEach(m=>m.destroy());meshes.forEach(m=>m.destroy());throw error}
  // 先释放库实例/模板，再取消资源池，避免迟到模型使用已卸载资源。
  const cancelLoading = () => { performanceMonitor.destroy(); advancedMechanisms.destroy(); libraryMechanisms.destroy(); themes.destroy(); modelAssets.destroy() }
  signal?.addEventListener('abort', cancelLoading, { once: true })
  if (signal?.aborted) cancelLoading()
  const visualDisposers = await Promise.all([
    attachTrackVisuals(app, platform, level.visuals, replaced, modelAssets.load,themes.applyEntity),
    ...await legacyMechanisms.ready,
  ])
  await libraryMechanisms.ready
  await advancedMechanisms.ready
  signal?.removeEventListener('abort', cancelLoading)
  let sceneDisposed = false
  function disposeScene() { if (sceneDisposed) return; sceneDisposed = true; performanceMonitor.destroy(); advancedMechanisms.destroy(); libraryMechanisms.destroy(); visualDisposers.forEach(dispose => dispose()); themes.destroy(); modelAssets.destroy(); water?.destroy(); steel.destroy(); app.destroy(); materials.forEach(m=>m.destroy()); meshes.forEach(m=>m.destroy()) }
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
  const course=level.course?createCourseProgress(level.course):undefined
  let coursePrevious:Position=[...level.start.position]
  let clearPlaytest=()=>{}
  if(import.meta.env.DEV){
    const playtestWindow=window as typeof window&{__marbleLabPlaytest?:()=>unknown}
    const playtestSnapshot=()=>{
      const movers:{name:string;position:number[];rotation:number[]}[]=[]
      const visit=(entity:pc.Entity)=>{if(entity.rigidbody?.type!=='static'&&entity.rigidbody)movers.push({name:entity.name,position:entity.getPosition().toArray(),rotation:entity.getEulerAngles().toArray()});entity.children.forEach(child=>visit(child as pc.Entity))}
      visit(app.root)
      return {position:ball.getPosition().toArray(),velocity:rigid.linearVelocity.toArray(),elapsed,falls,checkpoint,route:course?.route(),complete:course?.complete(),routes:level.course?.routes,phase:hooks.phase(),movers}
    }
    playtestWindow.__marbleLabPlaytest=playtestSnapshot
    clearPlaytest=()=>{if(playtestWindow.__marbleLabPlaytest===playtestSnapshot)delete playtestWindow.__marbleLabPlaytest}
  }
  function updateMechanisms() { legacyMechanisms.update(time) }
  if ((level.rulesVersion ?? 'classic') !== 'classic') updateMechanisms()
  function respawn() { const coursePosition=course?.respawn(),target=coursePosition?new pc.Vec3(...coursePosition):checkpoint ? checkpoints[checkpoint-1]! : initial;advancedMechanisms.onRespawn();rigid.teleport(target, pc.Vec3.ZERO);coursePrevious=target.toArray() as Position; rigid.linearVelocity=pc.Vec3.ZERO; rigid.angularVelocity=pc.Vec3.ZERO }
  function setPhase(phase: Phase) { keys.clear(); water?.resetClock(); app.timeScale = phase==='playing' ? 1 : 0; if (phase==='menu') respawn() }
  function start() {
    elapsed=0; falls=0; checkpoint=0; time=0; keys.clear();course?.reset()
    water?.resetClock()
    libraryMechanisms.reset()
    advancedMechanisms.reset()
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
  function blur() { keys.clear(); water?.resetClock(); if (hooks.phase()==='playing') hooks.pause() }
  function hidden() { if (document.hidden) blur() }
  window.addEventListener('keydown',down); window.addEventListener('keyup',up); window.addEventListener('blur',blur); document.addEventListener('visibilitychange',hidden)
  function resize() { const r=canvas.parentElement!.getBoundingClientRect(); app.resizeCanvas(Math.max(1,r.width),Math.max(1,r.height)) }
  const observer = new ResizeObserver(resize); observer.observe(canvas.parentElement!)
  let appliedQuality:Settings['quality']|undefined
  function applySettings() { performanceMonitor.setEnabled(hooks.performanceEnabled?.()===true); themes.refresh(); water?.setTheme(hooks.settings().trackTheme); steel.setSkin(hooks.settings().ballSkin); app.graphicsDevice.maxPixelRatio=hooks.settings().quality==='high' ? Math.min(devicePixelRatio,1.7) : 1; sun.light!.castShadows=hooks.settings().quality==='high'; water?.configure(hooks.settings().quality==='high'); if(appliedQuality!==hooks.settings().quality){water?.resetClock();appliedQuality=hooks.settings().quality} resize() }
  try { applySettings() } catch(error) { destroy();throw error }
  app.on('update',(delta: number)=>{
    const phase = hooks.phase()
    // update在timeScale=0时仍触发；水用自己的时钟，不推进菜单物理或游戏计时。
    water?.update((phase === 'menu' || phase === 'playing') && hooks.settings().quality === 'high' && !hooks.settings().reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden && document.hasFocus(), hooks.settings().waterSpeed)
    if (phase==='playing') {
      const dt=Math.min(delta,.075)
      elapsed+=dt; time+=dt
      updateMechanisms()
      libraryMechanisms.update(time)
      advancedMechanisms.update(time)
      if (dt > 0) libraryMechanisms.applyForces()
      if (dt > 0) advancedMechanisms.applyForces()
      const input=resolveInput(keys,hooks.input?.())
      if(input.x || input.z) rigid.applyForce(input.x*12*hooks.settings().sensitivity,0,input.z*12*hooks.settings().sensitivity)
      const v=rigid.linearVelocity
      const speed=Math.hypot(v.x,v.z)
      if (speed>7) rigid.linearVelocity=new pc.Vec3(v.x*7/speed,v.y,v.z*7/speed)
      if(input.brake) { const brake=Math.exp(-7*dt); rigid.linearVelocity=new pc.Vec3(v.x*brake,v.y,v.z*brake) }
      pos.copy(ball.getPosition())
      if(pos.y<level.fallY) { falls++; tone(140,.18); respawn(); pos.copy(ball.getPosition()) }
      let progress:number
      if(course) {
        const current:Position=[pos.x,pos.y,pos.z],reached=course.advance(coursePrevious,current);coursePrevious=current
        if(reached?.checkpoint){courseCheckpointRings.get(reached.id)!.render!.meshInstances.forEach(m=>m.material=orange);checkpoint=course.checkpointCount();tone(650+checkpoint*140,.18)}
        progress=course.progress(current)
      } else {
        const next=checkpoints[checkpoint]
        if(next && Math.hypot(pos.x-next.x,pos.z-next.z)<level.checkpointTrigger.radius && Math.abs(pos.y-next.y)<level.checkpointTrigger.heightTolerance) {
          checkpointRings[checkpoint]!.render!.meshInstances.forEach(m=>m.material=orange); checkpoint++; tone(650+checkpoint*140,.18)
        }
        const segment=level.progress[checkpoint]!
        progress=segment.base+Math.max(0,Math.min(segment.max,((segment.axis === 'x' ? pos.x : pos.z)-(segment.origin ?? segment.originZ))*segment.direction/segment.divisor))
      }
      hooks.tick(elapsed,falls,checkpoint,progress)
      const checkpointsComplete=course?course.complete():checkpoint===checkpoints.length
      if(checkpointsComplete && Math.hypot(pos.x-level.finish.position[0],pos.z-level.finish.position[2])<level.finish.radius && Math.abs(pos.y-level.finish.position[1])<level.finish.heightTolerance) { hooks.tick(elapsed,falls,checkpoint,1); tone(1100,.35); hooks.finish(level.course&&level.course.routes.length>1?course?.route():undefined); app.timeScale=0; keys.clear() }
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
  function destroy() { if (sceneDisposed) return; clearPlaytest(); observer.disconnect(); window.removeEventListener('keydown',down); window.removeEventListener('keyup',up); window.removeEventListener('blur',blur); document.removeEventListener('visibilitychange',hidden); void audio?.close(); disposeScene() }
  try { app.start() } catch(error) { destroy();throw error }
  return { start,setPhase,applySettings,destroy }
}
