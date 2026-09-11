import * as pc from 'playcanvas'
import type { HammerVisualsConfig, Position } from './level-types'

function alignHammerGeometry(geometry: pc.Geometry) {
  // 默认图元沿 Y，锤头长轴沿 Z；顶点和法线一起旋转，尺寸保持米制。
  const rotate = (source: ArrayLike<number>) => {
    const values = Array.from(source)
    for (let i = 0; i < values.length; i += 3) { const y = values[i + 1]!; values[i + 1] = -values[i + 2]!; values[i + 2] = y }
    return values
  }
  geometry.positions = rotate(geometry.positions!)
  geometry.normals = rotate(geometry.normals!)
  return geometry
}

export function createHammerCapsuleGeometry(size: Position) {
  return alignHammerGeometry(new pc.CapsuleGeometry({ radius: size[0] / 2, height: size[2], sides: 24 }))
}

export function createHammerCylinderGeometry(size: Position) {
  return alignHammerGeometry(new pc.CylinderGeometry({ radius: size[0] / 2, height: size[2], heightSegments: 1, capSegments: 32 }))
}

// 锤头和柄必须一起就绪，避免半个模型与基础几何叠在一起。
export async function attachHammerVisuals(app: pc.Application, head: pc.Entity, rod: pc.Entity, config?: HammerVisualsConfig | null, sharedLoad?: (file: string) => Promise<pc.Asset>): Promise<() => void> {
  if (!config) return () => {}
  const assets: pc.Asset[] = []
  const instances: pc.Entity[] = []
  const dispose = () => {
    instances.forEach(entity => entity.destroy())
    head.render!.enabled = true; rod.render!.enabled = true
    assets.forEach(asset => { asset.unload(); app.assets.remove(asset) })
  }
  const load = sharedLoad ?? ((file: string) => new Promise<pc.Asset>((resolve, reject) => {
    app.assets.loadFromUrl(`${import.meta.env.BASE_URL}models/${file}`, 'container', (error, asset) => {
      if (error || !asset) { reject(new Error(String(error || `缺少模型 ${file}`))); return }
      assets.push(asset); resolve(asset)
    })
  }))
  try {
    const headAsset = await load(config.head), rodAsset = await load(config.handle)
    const headVisual = (headAsset.resource as pc.ContainerResource).instantiateRenderEntity()
    instances.push(headVisual)
    const rodVisual = (rodAsset.resource as pc.ContainerResource).instantiateRenderEntity()
    instances.push(rodVisual)
    const headScale = head.getLocalScale(), rodScale = rod.getLocalScale()
    headVisual.setLocalScale(1 / headScale.x, 1 / headScale.y, 1 / headScale.z)
    // 柄模型长一米，保留父实体的长度伸缩，只抵消径向的基础图元比例。
    rodVisual.setLocalScale(1 / rodScale.x, 1, 1 / rodScale.z)
    head.addChild(headVisual); rod.addChild(rodVisual)
    head.render!.enabled = false; rod.render!.enabled = false
    return dispose
  } catch (error) {
    dispose()
    console.warn('机械锤模型未加载，使用基础锤形。', error)
    return () => {}
  }
}
