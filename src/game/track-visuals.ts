import * as pc from 'playcanvas'
import type { TrackVisualsConfig } from './level-types'

// 显示网格与物理代理分离：美术更换不改变用户已经认可的手感。
export async function attachTrackVisuals(app: pc.Application, platform: pc.Entity, config: TrackVisualsConfig | null, replaced: pc.RenderComponent[], sharedLoad?: (file: string) => Promise<pc.Asset>): Promise<() => void> {
  if (!config) return () => {}
  const assets: pc.Asset[] = []
  const instances: pc.Entity[] = []
  const load = sharedLoad ?? ((file: string) => new Promise<pc.Asset>((resolve, reject) => {
    app.assets.loadFromUrl(`${import.meta.env.BASE_URL}models/${file}`, 'container', (error, asset) => {
      if (error || !asset) { reject(new Error(String(error || `缺少模型 ${file}`))); return }
      assets.push(asset); resolve(asset)
    })
  }))
  const dispose = () => {
    instances.forEach(entity => entity.destroy())
    replaced.forEach(render => { render.enabled = true })
    assets.forEach(asset => { asset.unload(); app.assets.remove(asset) })
  }
  try {
    const staticAsset = await load(config.track)
    const platformAsset = await load(config.platform)
    const track = (staticAsset.resource as pc.ContainerResource).instantiateRenderEntity()
    const moving = (platformAsset.resource as pc.ContainerResource).instantiateRenderEntity()
    instances.push(track, moving)
    track.name = 'Detailed track visuals'; app.root.addChild(track)
    // 父实体的比例用于旧几何体显示，导出模型已是米制尺寸，需要抵消该比例。
    const scale = platform.getLocalScale()
    moving.setLocalScale(1 / scale.x, 1 / scale.y, 1 / scale.z)
    platform.addChild(moving)
    replaced.forEach(render => { render.enabled = false })
    return dispose
  } catch (error) {
    dispose()
    // 本地模型加载失败时保留原测试轨道，游戏仍可进入。
    console.warn('轨道细节模型未加载，使用基础外观。', error)
    return () => {}
  }
}
