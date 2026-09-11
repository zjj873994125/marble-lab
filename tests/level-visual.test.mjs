import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TorusGeometry } from 'playcanvas'
import ts from 'typescript'

// 可指定任务前快照复现缺角问题，不需要回滚共享关卡文件。
const source = readFileSync(process.env.MARBLE_LEVEL_SOURCE || new URL('../src/levels/initial-gravity.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { default: level } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('检查点圆环真实网格位于有效台面与检测区域内，保留倒角间距', () => {
  const decks = level.staticObjects.filter(object => object.name === 'Track surface' && object.body === 'static')
  assert.ok(decks.length > 0)
  for (const [index, checkpoint] of level.checkpoints.entries()) {
    // 与运行时同一几何体，检查实际管壁顶点，而非只检查圆心。
    const mesh = new TorusGeometry({ tubeRadius: .045, ringRadius: checkpoint.ring.radius, segments: 48, sides: 10 })
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = checkpoint.ring.position[0] + mesh.positions[i]
      const y = checkpoint.ring.position[1] + mesh.positions[i + 1]
      const z = checkpoint.ring.position[2] + mesh.positions[i + 2]
      const supported = decks.some(deck => {
        const [cx, cy, cz] = deck.position, [width, height, depth] = deck.size
        // 现有行驶面倒角 0.065 米，环不能紧贴盒体边缘掩盖越界。
        return Math.abs(x - cx) <= width / 2 - .065 && Math.abs(z - cz) <= depth / 2 - .065 && y > cy + height / 2
      })
      assert.ok(supported, `检查点 ${index + 1} 的圆环顶点 [${x}, ${y}, ${z}] 越出台面或倒角留白`)
      assert.ok(Math.hypot(x - checkpoint.position[0], z - checkpoint.position[2]) < level.checkpointTrigger.radius, `检查点 ${index + 1} 的标记超出检测圆`)
    }
  }
})
