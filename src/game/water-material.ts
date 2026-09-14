import * as pc from 'playcanvas'
import type { TrackThemeId } from './track-themes'

// 周期噪声的梯度生成法线，不把波峰画成平行白线。
function createWaveNormal(app: pc.Application) {
  const size = 512
  const heights = new Float32Array(size * size)
  let seed = 7219
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const bands: [number, number, number][] = [[7, 11, 1], [15, 19, .4], [29, 37, .14], [53, 61, .045]]
  for (const [columns, rows, amplitude] of bands) {
    const lattice = Float32Array.from({ length: columns * rows }, random)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size * columns, v = y / size * rows
      const ix = Math.floor(u), iy = Math.floor(v), tx = smooth(u - ix), ty = smooth(v - iy)
      const a = lattice[iy * columns + ix]!, b = lattice[iy * columns + (ix + 1) % columns]!
      const c = lattice[((iy + 1) % rows) * columns + ix]!, d = lattice[((iy + 1) % rows) * columns + (ix + 1) % columns]!
      heights[y * size + x]! += ((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty) * amplitude
    }
  }
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size
  const context = canvas.getContext('2d')!, pixels = context.createImageData(size, size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (heights[y * size + (x + 1) % size]! - heights[y * size + (x + size - 1) % size]!) * size * .035
    const dy = (heights[((y + 1) % size) * size + x]! - heights[((y + size - 1) % size) * size + x]!) * size * .035
    const length = Math.hypot(dx, dy, 1), index = (y * size + x) * 4
    pixels.data[index] = Math.round((.5 - dx / length * .5) * 255)
    pixels.data[index + 1] = Math.round((.5 - dy / length * .5) * 255)
    pixels.data[index + 2] = Math.round((.5 + 1 / length * .5) * 255)
    pixels.data[index + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  const texture = new pc.Texture(app.graphicsDevice, { name: 'water-wave-normal', width: size, height: size, format: pc.PIXELFORMAT_RGBA8, mipmaps: true, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT })
  try { texture.setSource(canvas) } catch(error) { texture.destroy();throw error }
  return texture
}

// 一次生成柔和环境色，只供水材质反射；不是场景实时倒影。
function createWaterReflection(app: pc.Application, neutral = false) {
  const size = 64
  const directions = [
    (u: number, v: number) => [1, -v, -u], (u: number, v: number) => [-1, -v, u],
    (u: number, v: number) => [u, 1, v], (u: number, v: number) => [u, -1, -v],
    (u: number, v: number) => [u, -v, 1], (u: number, v: number) => [-u, -v, -1],
  ]
  const faces = directions.map(direction => {
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size
    const context = canvas.getContext('2d')!, pixels = context.createImageData(size, size)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const vector = direction(2 * (x + .5) / size - 1, 2 * (y + .5) / size - 1)
      const length = Math.hypot(...vector), nx = vector[0]! / length, ny = vector[1]! / length, nz = vector[2]! / length
      const sky = Math.max(0, ny), horizon = Math.exp(-ny * ny * 14)
      const softLight = Math.exp(-((nx + .25) ** 2 * 3 + (ny - .72) ** 2 * 7 + (nz - .45) ** 2 * 3))
      const index = (y * size + x) * 4
      pixels.data[index] = 42 + sky * 80 + horizon * 20 + softLight * 65
      pixels.data[index + 1] = 66 + sky * 79 + horizon * 20 + softLight * 61
      pixels.data[index + 2] = 72 + sky * 82 + horizon * 18 + softLight * 54
      if(neutral) {
        const luminance=pixels.data[index]!*.2126+pixels.data[index+1]!*.7152+pixels.data[index+2]!*.0722
        pixels.data[index]=pixels.data[index+1]=pixels.data[index+2]=luminance
      }
      pixels.data[index + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    return canvas
  })
  const texture = new pc.Texture(app.graphicsDevice, { name: neutral?'water-neutral-environment':'water-soft-environment', width: size, height: size, cubemap: true, format: pc.PIXELFORMAT_SRGBA8, mipmaps: true })
  try { texture.setSource(faces) } catch(error) { texture.destroy();throw error }
  return texture
}

const waterNormal = `
uniform vec4 water_offsets;
uniform float water_detail;
void getNormal() {
    // 世界米制采样，两个池体的波纹密度一致。
    vec2 uv = vPositionW.xz;
    vec3 first = texture2D({STD_NORMAL_TEXTURE_NAME}, uv / 10.0 + water_offsets.xy).xyz * 2.0 - 1.0;
    vec2 slope = first.xy / max(first.z, 0.25);
    if (water_detail > 0.5) {
        vec2 rotated = vec2(0.6 * uv.x - 0.8 * uv.y, 0.8 * uv.x + 0.6 * uv.y);
        vec3 second = texture2D({STD_NORMAL_TEXTURE_NAME}, rotated / 6.0 + water_offsets.zw).xyz * 2.0 - 1.0;
        vec2 detailSlope = second.xy / max(second.z, 0.25);
        slope += vec2(0.6 * detailSlope.x + 0.8 * detailSlope.y, -0.8 * detailSlope.x + 0.6 * detailSlope.y) * 0.55;
    }
    float strength = mix(0.28, 0.46, water_detail);
    float topFace = max(dVertexNormalW.y, 0.0);
    dNormalW = normalize(dVertexNormalW + vec3(slope.x, 0.0, slope.y) * strength * topFace);
}
`

export function createWaterMaterial(app: pc.Application) {
  const normal = createWaveNormal(app)
  let reflection:pc.Texture
  try { reflection=createWaterReflection(app) } catch(error) { normal.destroy();throw error }
  const material = new pc.StandardMaterial()
  material.name = 'Pool fine ripples'
  material.diffuse = new pc.Color().fromString('#123c45')
  material.normalMap = normal
  material.useMetalness = false; material.specular = new pc.Color(.025, .025, .025)
  material.gloss = .68; material.cubeMap = reflection; material.reflectivity = .45
  material.shaderChunksVersion = '2.22'
  material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('normalMapPS', waterNormal)
  const offsets = new Float32Array([0, 0, .31, .67])
  const phases = [0, 0, .31, .67], speeds = [.024, .014, -.018, .022]
  material.setParameter('water_offsets', offsets)
  material.setParameter('water_detail', 1)
  material.update()
  let lastFrame = performance.now(), wasAnimating = false, highQuality = true
  let neutralReflection:pc.Texture|undefined,classicReflection=true,disposed=false
  return {
    material,
    setTheme(theme:TrackThemeId) {
      if(disposed||classicReflection===(theme==='classic'))return
      // 经典恢复原贴图对象；其他主题复用一张中性反射，不让蓝青环境固定染水。
      if(theme!=='classic')neutralReflection??=createWaterReflection(app,true)
      material.cubeMap=theme==='classic'?reflection:neutralReflection!
      classicReflection=theme==='classic';material.update()
    },
    resetClock() { lastFrame = performance.now(); wasAnimating = false },
    configure(high: boolean) {
      if (highQuality === high) return
      highQuality = high; material.setParameter('water_detail', high ? 1 : 0)
    },
    update(animate: boolean, speed = 1) {
      const now = performance.now(), delta = (now - lastFrame) / 1000
      lastFrame = now
      // 冻结相位，不积累后台或长帧时间；恢复首帧仅重新接上时钟。
      if (animate && wasAnimating && speed > 0 && delta > 0 && delta < .25) {
        for (let i = 0; i < 4; i++) { phases[i] = (phases[i]! + speeds[i]! * delta * speed + 1) % 1; offsets[i] = phases[i]! }
        material.setParameter('water_offsets', offsets)
      }
      wasAnimating = animate
    },
    destroy() { if(disposed)return;disposed=true;material.destroy(); normal.destroy(); reflection.destroy();neutralReflection?.destroy() },
  }
}
