import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const root = new URL('../../../', import.meta.url)
const before = JSON.parse(readFileSync(new URL('before-config.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('src/levels/initial-gravity.ts', root), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { default: level } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const poolNames = new Set(['Pool basin', 'Pool water', 'Pool rim left', 'Pool rim right', 'Pool rim near', 'Pool rim far'])
const guideNames = new Set(['Platform guide left', 'Platform guide right'])

// 用户追加只允许内侧起点栏的负 Z 端收短，其他栏杆字段仍参与比较。
function normalizeInnerRail(object) {
  return object.name === 'Safety rail' && object.position[0] === -8.45
    ? { ...object, position: [object.position[0], object.position[1], 2], size: [object.size[0], object.size[1], 10] }
    : object
}

// 只剔除本轮明确授权的变化，保留其余完整数据作深比较。
function protectedData(config) {
  return {
    ...config, rulesVersion: undefined, visuals: undefined,
    staticObjects: config.staticObjects.filter(object => object.name !== 'Ground' && object.name !== 'Corner rail' && !poolNames.has(object.name) && !guideNames.has(object.name)).map(normalizeInnerRail),
    pendulum: { ...config.pendulum, visuals: undefined, ball: { ...config.pendulum.ball, type: undefined, size: undefined, collisionAxis: undefined } },
    platform: {
      ...config.platform, axis: undefined, centerX: undefined, amplitude: undefined,
      body: { ...config.platform.body, position: config.platform.body.position.slice(0, 2) },
      stripe: { ...config.platform.stripe, position: undefined, size: undefined },
    },
  }
}
assert.deepEqual(protectedData(level), protectedData(before))
assert.equal(level.rulesVersion, 'flat-hammer')
assert.equal(level.staticObjects.filter(object => object.name === 'Corner rail').length, 0)
assert.deepEqual(level.staticObjects.filter(object => object.body).map(normalizeInnerRail), before.staticObjects.filter(object => object.body && object.name !== 'Corner rail'))
assert.equal(level.staticObjects.filter(object => object.body).length, 13)
const innerRail = level.staticObjects.filter(object => object.name === 'Safety rail' && object.position[0] === -8.45)
assert.equal(innerRail.length, 1)
assert.deepEqual(innerRail[0].position, [-8.45, 3.53, 2.25])
assert.deepEqual(innerRail[0].size, [0.12, 0.26, 9.5])
assert.equal(level.pendulum.ball.type, 'cylinder')
assert.equal(level.pendulum.ball.collisionAxis, 2)
assert.deepEqual(level.pendulum.ball.size, [0.9, 0.9, 1.36])
assert.equal(level.platform.axis, 'x')
assert.equal(level.platform.centerX, 8)
assert.equal(level.platform.centerZ, -0.35)
assert.equal(level.platform.amplitude, 3.4)
assert.equal(level.platform.body.position[2], -0.35)
assert.deepEqual(level.platform.stripe.size, [0.17, 0.035, 2.6])
assert.deepEqual(level.platform.stripe.position, [8, 3.413, -0.35])

const guides = level.staticObjects.filter(object => guideNames.has(object.name))
assert.equal(guides.length, 2)
for (const [i, guide] of guides.entries()) {
  assert.equal(guide.body, undefined)
  assert.deepEqual(guide.position, [8, 2.95, [-1.9, 1.2][i]])
  assert.deepEqual(guide.size, [10.2, 0.08, 0.08])
}
const pool = level.staticObjects.filter(object => poolNames.has(object.name))
assert.equal(pool.length, 6)
assert.equal(level.staticObjects.filter(object => object.name === 'Ground').length, 0)
for (const object of pool) {
  assert.equal(object.body, undefined)
  assert.equal(object.refinedVisual, undefined)
}
const water = pool.find(object => object.name === 'Pool water')
assert.equal(water.material, 'water')
assert.deepEqual(water.position, [2.5, -0.11, 0])
assert.deepEqual(water.size, [72, 0.02, 56])
assert.equal(level.fallY, -0.5)
if (level.visuals) {
  assert.equal(level.visuals.track, 'track-round-03.glb')
  assert.equal(level.visuals.platform, before.visuals.platform)
}
if (level.pendulum.visuals) assert.deepEqual(level.pendulum.visuals, { head: 'hammer-head-toy-round-03.glb', handle: 'hammer-handle-toy-round-03.glb' })

const period = 2 * Math.PI / level.platform.angularSpeed
const window = (Math.PI - 2 * Math.asin(3 / level.platform.amplitude)) / level.platform.angularSpeed
console.log(JSON.stringify({
  configSha256: createHash('sha256').update(source).digest('hex'),
  rulesVersion: level.rulesVersion,
  head: { type: level.pendulum.ball.type, collisionAxis: level.pendulum.ball.collisionAxis, size: level.pendulum.ball.size },
  protectedFieldsEqual: true, collisionCount: 13, poolObjectsWithoutCollision: pool.length,
  xCenterExtremes: [8 - level.platform.amplitude, 8 + level.platform.amplitude],
  clearWindowPerEndSeconds: window, periodSeconds: period,
  maxPlatformSpeed: level.platform.amplitude * level.platform.angularSpeed,
  visuals: level.visuals, hammerVisuals: level.pendulum.visuals,
}, null, 2))
