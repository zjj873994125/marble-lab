import * as pc from 'playcanvas'

export function createSteelMaterial(app: pc.Application) {
  const size = 128
  const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const directions = [
    (u: number, v: number) => [1, -v, -u], (u: number, v: number) => [-1, -v, u],
    (u: number, v: number) => [u, 1, v], (u: number, v: number) => [u, -1, -v],
    (u: number, v: number) => [u, -v, 1], (u: number, v: number) => [-u, -v, -1],
  ]
  // 按同一个方向函数生成六面，接缝连续；反射只作用于球，不重渲染场景。
  const faces = directions.map(direction => {
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size
    const context = canvas.getContext('2d')!
    const pixels = context.createImageData(size, size)
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
      const d = direction(2 * (column + .5) / size - 1, 2 * (row + .5) / size - 1)
      const length = Math.hypot(...d), x = d[0]! / length, y = d[1]! / length, z = d[2]! / length
      const floor = 1 - smooth(-.2, .05, y)
      const horizon = 1 - smooth(.06, .17, Math.abs(y))
      const softbox = (1 - smooth(.34, .43, Math.abs(x + .12))) * smooth(.22, .34, y) * smooth(.03, .15, z)
      const sidebox = smooth(.7, .82, x) * smooth(-.15, .02, y) * (1 - smooth(.55, .7, y))
      const base = (92 + 44 * floor + 20 * Math.max(y, 0)) * (1 - .91 * horizon)
      const light = Math.max(softbox, .78 * sidebox)
      const value = Math.round(base * (1 - light) + 242 * light)
      const index = (row * size + column) * 4
      pixels.data[index] = value; pixels.data[index + 1] = value; pixels.data[index + 2] = value; pixels.data[index + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    return canvas
  })
  const environment = new pc.Texture(app.graphicsDevice, { name: 'player-steel-studio', width: size, height: size, cubemap: true, mipmaps: true, format: pc.PIXELFORMAT_SRGBA8 })
  environment.setSource(faces)
  const polishCanvas = document.createElement('canvas'); polishCanvas.width = 256; polishCanvas.height = 128
  const polishContext = polishCanvas.getContext('2d')!
  const polishPixels = polishContext.createImageData(256, 128)
  for (let row = 0; row < 128; row++) for (let column = 0; column < 256; column++) {
    const theta = Math.PI * row / 127, phi = 2 * Math.PI * column / 255
    const x = Math.cos(phi) * Math.sin(theta), y = Math.cos(theta), z = Math.sin(phi) * Math.sin(theta)
    const fade = Math.sin(theta) ** 2
    const nx = fade * (.24 * Math.sin(11 * x + 7 * y - 5 * z) * (.55 + .45 * Math.sin(5 * x - 3 * z)) + .06 * Math.sin(47 * x + 29 * z + 17 * y))
    const ny = fade * (.22 * Math.cos(8 * x - 13 * y + 6 * z) * (.6 + .4 * Math.cos(3 * y + 4 * z)) + .05 * Math.cos(37 * z - 31 * x))
    const length = Math.hypot(nx, ny, 1), index = (row * 256 + column) * 4
    polishPixels.data[index] = Math.round((nx / length * .5 + .5) * 255)
    polishPixels.data[index + 1] = Math.round((ny / length * .5 + .5) * 255)
    polishPixels.data[index + 2] = Math.round((1 / length * .5 + .5) * 255)
    polishPixels.data[index + 3] = 255
  }
  polishContext.putImageData(polishPixels, 0, 0)
  const polish = new pc.Texture(app.graphicsDevice, { name: 'player-steel-polish', width: 256, height: 128, mipmaps: true, addressU: pc.ADDRESS_REPEAT })
  polish.setSource(polishCanvas)
  const material = new pc.StandardMaterial()
  material.name = 'Polished bearing steel'
  material.useMetalness = true; material.metalness = 1; material.gloss = .93
  material.diffuse = new pc.Color(.82, .83, .84)
  material.cubeMap = environment; material.reflectivity = 1
  material.normalMap = polish; material.bumpiness = 0
  material.update()
  return {
    material,
    // 微纹绑定原球体 UV；渐隐只避免停住后残余竖轴自旋显形，不改物理旋转。
    update(speed: number) { material.bumpiness = .18 * smooth(.02, .35, speed); material.update() },
    destroy() { material.destroy(); environment.destroy(); polish.destroy() },
  }
}
