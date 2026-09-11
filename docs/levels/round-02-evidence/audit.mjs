import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const root = new URL('../../../', import.meta.url)
const before = JSON.parse(readFileSync(new URL('before-config.json', import.meta.url), 'utf8'))
const source = readFileSync(new URL('src/levels/initial-gravity.ts', root), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const { default: level } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

// 只排除本轮获准改变的显示字段，其余完整对象都必须等同原值。
function protectedData(config) {
  return {
    ...config,
    visuals: { ...config.visuals, track: undefined },
    checkpoints: config.checkpoints.map(({ ring, ...point }) => point),
    staticObjects: config.staticObjects
      .filter(object => !['Bridge edge stripe', 'Bridge edge dash'].includes(object.name))
      .map(object => object.name === 'Bridge rail' ? { ...object, material: undefined } : object),
  }
}
assert.deepEqual(protectedData(level), protectedData(before))
assert.ok(['track-refined.glb', 'track-round-02.glb'].includes(level.visuals.track))
assert.equal(level.staticObjects.filter(object => object.body).length, 15)
assert.ok(level.staticObjects.filter(object => object.name.endsWith('rail')).every(object => object.material === 'orange'))
assert.equal(level.staticObjects.filter(object => object.name === 'Bridge edge stripe').length, 0)

const decks = level.staticObjects.filter(object => object.name === 'Track surface')
const supported = (x, z) => decks.some(object =>
  Math.abs(x - object.position[0]) <= object.size[0] / 2 + 1e-9 &&
  Math.abs(z - object.position[2]) <= object.size[2] / 2 + 1e-9)
for (const point of level.checkpoints) {
  const outerRadius = point.ring.radius + 0.045
  const offset = Math.hypot(point.position[0] - point.ring.position[0], point.position[2] - point.ring.position[2])
  assert.ok(offset + outerRadius < level.checkpointTrigger.radius)
  assert.ok(point.ring.position[1] - 0.045 > 3.4)
  for (let i = 0; i < 7200; i++) {
    const angle = i * Math.PI / 3600
    assert.ok(supported(point.ring.position[0] + outerRadius * Math.cos(angle), point.ring.position[2] + outerRadius * Math.sin(angle)))
  }
}
const dashes = level.staticObjects.filter(object => object.name === 'Bridge edge dash')
assert.equal(dashes.length, 8)
for (const object of dashes) {
  assert.equal(object.body, undefined)
  assert.equal(object.refinedVisual, undefined)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    assert.ok(supported(object.position[0] + sx * object.size[0] / 2, object.position[2] + sz * object.size[2] / 2))
  }
}
console.log(JSON.stringify({
  configSha256: createHash('sha256').update(source).digest('hex'),
  protectedFieldsEqual: true,
  collisionCount: 15,
  ringCoveragePassed: true,
  dashCount: dashes.length,
  visuals: level.visuals,
}, null, 2))
