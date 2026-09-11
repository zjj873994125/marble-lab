import * as pc from 'playcanvas'

export function createWaterMaterial(app: pc.Application) {
  const canvas = document.createElement('canvas')
  canvas.width = 128; canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = '#dbe8e9'; context.fillRect(0, 0, 128, 128)
  context.strokeStyle = '#f0f5f5'; context.lineWidth = 1.2
  // 周期纹理首尾连续；静态模式仍能识别为水面，不依赖动画或阴影。
  for (let row = -1; row < 5; row++) {
    context.beginPath()
    for (let x = 0; x <= 128; x++) {
      const y = row * 32 + 16 + Math.sin(x * Math.PI / 64 + row * .8) * 5
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y)
    }
    context.stroke()
  }
  const texture = new pc.Texture(app.graphicsDevice, { width: 128, height: 128, mipmaps: true, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT })
  texture.setSource(canvas)
  const material = new pc.StandardMaterial()
  material.diffuse = new pc.Color().fromString('#123c45')
  material.diffuseMap = texture
  material.diffuseMapTiling.set(8, 6)
  material.useMetalness = true; material.metalness = 0; material.gloss = .15
  material.update()
  return {
    material,
    update(time: number) { material.diffuseMapOffset.set(time * .008, time * .004); material.update() },
    destroy() { material.destroy(); texture.destroy() },
  }
}
