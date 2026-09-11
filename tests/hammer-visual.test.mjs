import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import * as pc from 'playcanvas'

const source = readFileSync(new URL('../src/game/hammer-visuals.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('import.meta.env.BASE_URL', "'./'").replaceAll('export ', '').replace(/^import .*;?$/gm, '')
const { attach, geometry, flatGeometry } = new Function('pc', `${js}; return { attach: attachHammerVisuals, geometry: createHammerCapsuleGeometry, flatGeometry: createHammerCylinderGeometry }`)(pc)

test('锤头和柄成组替换并保持米制/轴向伸缩；加载或实例化失败保留基础锤', async () => {
  for (const mode of ['success', 'load-failure', 'instantiate-failure', 'disabled']) {
    const requests = [], scales = [], disposed = []
    let instanceCount = 0
    const app = { assets: {
      loadFromUrl(url, type, callback) {
        requests.push(url); assert.equal(type, 'container')
        if (mode === 'load-failure' && requests.length === 2) return callback('missing handle')
        callback(null, {
          unload: () => disposed.push('asset'),
          resource: { instantiateRenderEntity() {
            instanceCount++
            if (mode === 'instantiate-failure' && instanceCount === 2) throw new Error('bad handle')
            return { setLocalScale: (...scale) => scales.push(scale), destroy: () => disposed.push('entity') }
          } },
        })
      },
      remove() {},
    } }
    const entity = scale => ({ render: { enabled: true }, getLocalScale: () => scale, children: [], addChild(child) { this.children.push(child) } })
    const head = entity({ x: 1.36, y: .9, z: 1.1 }), rod = entity({ x: .12, y: 3, z: .12 })
    const warn = console.warn
    let cleanup
    try { console.warn = () => {}; cleanup = await attach(app, head, rod, mode === 'disabled' ? null : { head: 'head.glb', handle: 'handle.glb' }) }
    finally { console.warn = warn }
    assert.equal(head.render.enabled, mode !== 'success'); assert.equal(rod.render.enabled, mode !== 'success')
    assert.equal(head.children.length, mode === 'success' ? 1 : 0)
    assert.equal(rod.children.length, mode === 'success' ? 1 : 0)
    if (mode === 'success') assert.deepEqual(scales, [[1 / 1.36, 1 / .9, 1 / 1.1], [1 / .12, 1, 1 / .12]])
    cleanup()
    assert.equal(head.render.enabled, true); assert.equal(rod.render.enabled, true)
    assert.equal(disposed.filter(item => item === 'asset').length, mode === 'disabled' ? 0 : mode === 'load-failure' ? 1 : 2)
    assert.equal(disposed.filter(item => item === 'entity').length, mode === 'success' ? 2 : mode === 'instantiate-failure' ? 1 : 0)
  }
})


test('基础玩具锤为 Z 向胶囊，总长包含两端帽且法线随几何旋转', () => {
  const mesh = geometry([.9, .9, 1.36])
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], mesh.positions[i + axis]); max[axis] = Math.max(max[axis], mesh.positions[i + axis]) }
    assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-5)
  }
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(max[axis] - min[axis] - [.9, .9, 1.36][axis]) < 1e-5)
})

test('平端锤回退的两端是半径 .45 的平面圆盘，不能退回半球端帽', () => {
  const flat = flatGeometry([.9, .9, 1.36])
  const round = geometry([.9, .9, 1.36])
  const endRadius = (mesh, sign) => {
    let radius = 0
    for (let i = 0; i < mesh.positions.length; i += 3) {
      if (Math.abs(mesh.positions[i + 2] - sign * .68) < 1e-6 && Math.abs(mesh.normals[i + 2] - sign) < 1e-6) radius = Math.max(radius, Math.hypot(mesh.positions[i], mesh.positions[i + 1]))
    }
    return radius
  }
  for (const sign of [-1, 1]) {
    assert.ok(Math.abs(endRadius(flat, sign) - .45) < 1e-6)
    assert.ok(endRadius(round, sign) < .01)
  }
  const dimensions = [0, 1, 2].map(axis => {
    const values = flat.positions.filter((_, index) => index % 3 === axis)
    return Math.max(...values) - Math.min(...values)
  })
  dimensions.forEach((value, axis) => assert.ok(Math.abs(value - [.9, .9, 1.36][axis]) < 1e-6))
})
