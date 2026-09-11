import type * as pc from 'playcanvas'

// 同一关的同名 GLB 只请求一次，多个机关各自实例化；卸载时统一释放。
export function createModelAssets(app: pc.Application, signal?: AbortSignal) {
  const registry = app.assets
  const pending = new Map<string, Promise<pc.Asset>>()
  const assets = new Set<pc.Asset>()
  const cancellations = new Set<() => void>()
  let disposed = false
  function destroy() {
    if (disposed) return
    disposed = true
    signal?.removeEventListener('abort', destroy)
    cancellations.forEach(cancel => cancel()); cancellations.clear()
    assets.forEach(asset => { asset.unload(); registry.remove(asset) }); assets.clear()
  }
  signal?.addEventListener('abort', destroy, { once: true })
  if (signal?.aborted) destroy()
  const load = (file: string): Promise<pc.Asset> => {
    if (disposed) return Promise.reject(new DOMException('关卡已卸载', 'AbortError'))
    let request = pending.get(file)
    if (!request) {
      request = new Promise<pc.Asset>((resolve, reject) => {
        let settled = false
        const cancel = () => finish(new DOMException('关卡已卸载', 'AbortError'))
        const timer = setTimeout(() => finish(new Error(`模型加载超时：${file}`)), 15000)
        function finish(error?: Error, asset?: pc.Asset) {
          if (settled) return
          settled = true; clearTimeout(timer); cancellations.delete(cancel)
          if (error) reject(error); else resolve(asset!)
        }
        cancellations.add(cancel)
        registry.loadFromUrl(`${import.meta.env.BASE_URL}models/${file}`, 'container', (error, asset) => {
          if (settled || disposed) { if (asset) { asset.unload(); registry.remove(asset) }; return }
          if (error || !asset) { finish(new Error(String(error || `缺少模型 ${file}`))); return }
          assets.add(asset); finish(undefined, asset)
        })
      })
      pending.set(file, request)
    }
    return request
  }
  return { load, destroy }
}

export async function attachMovingVisual(load: (file: string) => Promise<pc.Asset>, file: string | undefined, parent: pc.Entity, replaced: pc.RenderComponent[]) {
  if (!file) return () => {}
  let instance: pc.Entity | undefined
  const dispose = () => { instance?.destroy(); instance = undefined; replaced.forEach(render => { render.enabled = true }) }
  try {
    const asset = await load(file)
    instance = (asset.resource as pc.ContainerResource).instantiateRenderEntity()
    const scale = parent.getLocalScale()
    instance.setLocalScale(1 / scale.x, 1 / scale.y, 1 / scale.z)
    parent.addChild(instance)
    replaced.forEach(render => { render.enabled = false })
    return dispose
  } catch (error) {
    dispose()
    if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn('机关模型未加载，保留基础外观。', error)
    return () => {}
  }
}
