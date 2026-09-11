import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const source = readFileSync(new URL('../src/levels/initial-gravity.ts', import.meta.url), 'utf8')
const { default: level } = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`)

test('关卡坐标、尺寸、碰撞代理与检查点进度满足运行时约定', () => {
  const vector = values => { assert.equal(values.length, 3); assert.ok(values.every(Number.isFinite)) }
  const positive = value => assert.ok(Number.isFinite(value) && value > 0)
  const ring = value => { vector(value.position); positive(value.radius) }
  for (const object of [...level.staticObjects, level.pendulum.ball, level.pendulum.rod, level.platform.body, level.platform.stripe]) {
    vector(object.position); vector(object.size); object.size.forEach(positive)
    assert.ok(['box', 'sphere', 'cylinder', 'capsule'].includes(object.type))
    assert.ok(['cream', 'edge', 'orange', 'dark', 'blue', 'floorMat', 'water', 'poolEdge'].includes(object.material))
    assert.ok(object.body === undefined || object.body === 'static')
    // 圆柱只有显式轴向才改变长轴，默认装饰支撑仍沿 Y。
    if (object.body) assert.ok(['box', 'sphere', 'capsule', 'cylinder'].includes(object.type))
    assert.ok(object.collisionAxis === undefined || [1, 2].includes(object.collisionAxis))
    if (object.type === 'cylinder' && (object.body || object.collisionAxis === 2)) assert.equal(object.size[0], object.size[object.collisionAxis === 2 ? 1 : 2])
    if (object.type === 'capsule') { assert.equal(object.size[0], object.size[1]); assert.ok(object.size[2] >= object.size[0]) }
    if (object.type === 'sphere') assert.ok(object.size.every(value => value === object.size[0]))
  }
  assert.ok((level.rulesVersion === 'flat-hammer' ? ['cylinder'] : level.rulesVersion === 'open-hammer' ? ['box', 'capsule'] : ['sphere']).includes(level.pendulum.ball.type))
  if (level.rulesVersion === 'flat-hammer') assert.equal(level.pendulum.ball.collisionAxis, 2)
  assert.equal(level.platform.body.type, 'box')
  vector(level.start.position); vector(level.start.previewPosition); ring(level.start.ring)
  for (const point of level.checkpoints) { vector(point.position); ring(point.ring) }
  vector(level.finish.position); ring(level.finish.ring)
  positive(level.checkpointTrigger.radius); positive(level.checkpointTrigger.heightTolerance)
  positive(level.finish.radius); positive(level.finish.heightTolerance)
  assert.ok(Number.isFinite(level.fallY))
  assert.equal(level.progress.length, level.checkpoints.length + 1)
  for (const segment of level.progress) {
    assert.ok(Number.isFinite(segment.originZ))
    assert.ok([-1, 1].includes(segment.direction)); positive(segment.divisor)
    assert.ok(segment.base >= 0 && segment.max >= 0 && segment.base + segment.max <= 1)
  }
  vector(level.pendulum.anchor); positive(level.pendulum.rodWidth)
  for (const mechanism of [level.pendulum, level.platform]) {
    assert.ok(Number.isFinite(mechanism.amplitude) && mechanism.amplitude >= 0)
    assert.ok(Number.isFinite(mechanism.angularSpeed) && mechanism.angularSpeed >= 0)
  }
  assert.ok(Number.isFinite(level.pendulum.lift) && level.pendulum.lift >= 0)
  assert.ok(Number.isFinite(level.platform.centerZ) && Number.isFinite(level.platform.stripeY))
})

test('配置引用的本地 GLB 符合模型命名与自包含资源约定', () => {
  const files = { ...level.visuals, ...level.pendulum.visuals }
  const nodes = { track: 'TrackStatic', platform: 'PlatformVisual', head: 'HammerHead', handle: 'HammerHandle' }
  for (const [key, name] of Object.entries(files)) {
    assert.match(name, /^[a-z0-9-]+\.glb$/)
    const bytes = readFileSync(new URL(`../public/models/${name}`, import.meta.url))
    assert.equal(bytes.readUInt32LE(0), 0x46546c67)
    assert.equal(bytes.readUInt32LE(4), 2)
    assert.equal(bytes.readUInt32LE(8), bytes.length)
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a)
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
    assert.ok(gltf.nodes.some(node => node.name === nodes[key]))
    assert.ok((gltf.buffers ?? []).every(buffer => !buffer.uri))
    assert.ok((gltf.images ?? []).every(image => !image.uri))
  }
})

test('模型加载使用显式资源配置，成功只隐藏外观，失败与禁用均保留代理', async () => {
  const loaderSource = readFileSync(new URL('../src/game/track-visuals.ts', import.meta.url), 'utf8')
  const js = compile(loaderSource).replace(/^import .*;?$/gm, '').replaceAll('import.meta.env.BASE_URL', "'./'").replace('export async function', 'async function')
  const attach = new Function(`${js}; return attachTrackVisuals`)()
  for (const mode of ['success', 'failure', 'disabled']) {
    const urls = [], disposed = [], children = [], renders = [{ enabled: true }]
    const visual = { setLocalScale: (...args) => { visual.scale = args }, destroy: () => disposed.push('entity') }
    const app = {
      root: { addChild: entity => children.push(entity) },
      assets: {
        loadFromUrl: (url, type, callback) => {
          urls.push(url); assert.equal(type, 'container')
          if (mode === 'failure' && urls.length === 2) return callback('missing')
          callback(null, { resource: { instantiateRenderEntity: () => ({ ...visual }) }, unload: () => disposed.push('asset'), })
        },
        remove: () => {},
      },
    }
    const platform = { getLocalScale: () => ({ x: 3, y: .36, z: 2.9 }), addChild: entity => children.push(entity) }
    const originalWarn = console.warn
    let cleanup
    try {
      console.warn = () => {}
      cleanup = await attach(app, platform, mode === 'disabled' ? null : { track: 'other-track.glb', platform: 'other-platform.glb' }, renders)
    } finally { console.warn = originalWarn }
    assert.deepEqual(urls, mode === 'disabled' ? [] : ['./models/other-track.glb', './models/other-platform.glb'])
    assert.equal(renders[0].enabled, mode !== 'success')
    assert.equal(children.length, mode === 'success' ? 2 : 0)
    if (mode === 'success') assert.deepEqual(visual.scale, [1 / 3, 1 / .36, 1 / 2.9])
    cleanup()
    assert.equal(renders[0].enabled, true)
    assert.equal(disposed.filter(item => item === 'asset').length, mode === 'success' ? 2 : mode === 'failure' ? 1 : 0)
  }
})

test('轨道第二个模型实例化失败时也释放先创建的实例', async () => {
  const source=readFileSync(new URL('../src/game/track-visuals.ts',import.meta.url),'utf8')
  const js=compile(source).replace(/^import .*;?$/gm,'').replaceAll('import.meta.env.BASE_URL',"'./'").replace('export async function','async function')
  const attach=new Function(`${js}; return attachTrackVisuals`)()
  let created=0,destroyed=0,unloaded=0
  const app={assets:{loadFromUrl:(url,type,cb)=>cb(null,{unload:()=>unloaded++,resource:{instantiateRenderEntity:()=>{if(++created===2)throw Error('bad platform');return {destroy:()=>destroyed++}}}}),remove:()=>{}},root:{addChild:()=>{}}}
  const render={enabled:true},warn=console.warn;console.warn=()=>{}
  try {await attach(app,{}, {track:'track.glb',platform:'platform.glb'},[render])}finally{console.warn=warn}
  assert.equal(destroyed,1);assert.equal(unloaded,2);assert.equal(render.enabled,true)
})
