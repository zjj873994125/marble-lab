import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const root = new URL('../../../', import.meta.url)
const before = readFileSync(new URL('runtime-before.ts', import.meta.url), 'utf8')
const current = readFileSync(new URL('src/game/runtime.ts', root), 'utf8')
const sections = [
  ['physics', '  const physicsSystem', '  const materials'],
  ['controls', "      let x=Number(keys.has('KeyD')", '      pos.copy(ball.getPosition())'],
  ['camera', "    if(phase==='menu')", '  app.start()'],
  ['keyboard', '  function down(', '  function resize()'],
  ['respawn', '  function respawn()', '  function start()'],
]
const result = {}
for (const [name, start, end] of sections) {
  const part = source => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
  assert.equal(part(current), part(before), name); result[name] = true
}
const body = source => source.split('\n').find(line => line.includes("e.addComponent('rigidbody'"))?.trim()
assert.equal(body(current), body(before)); result.bodyMaterialAndDamping = true
const oldState = readFileSync(new URL('state-before.ts', import.meta.url), 'utf8')
const newState = readFileSync(new URL('src/state.ts', root), 'utf8')
for (const name of ['formatTime', 'medal']) {
  const line = source => source.split('\n').find(value => value.includes(`export function ${name}(`))
  assert.equal(line(newState), line(oldState)); result[name] = true
}
console.log(JSON.stringify(result, null, 2))
