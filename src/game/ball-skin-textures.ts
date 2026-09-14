import * as pc from 'playcanvas'
import { ballSkinAsset } from './ball-skin-assets'

export function createBallSkinTextures(app:pc.Application) {
  const requests=new Map<string,Promise<pc.Texture>>(),assets=new Set<pc.Asset>(),cancel=new Set<()=>void>()
  let disposed=false
  function load(file:string,srgb:boolean):Promise<pc.Texture> {
    if(disposed)return Promise.reject(new DOMException('球皮肤已卸载','AbortError'))
    const cached=requests.get(file);if(cached)return cached
    const url=ballSkinAsset(file)
    if(!url)return Promise.reject(new Error(`缺少本地球皮肤贴图：${file}`))
    const request=new Promise<pc.Texture>((resolve,reject)=>{
      const asset=new pc.Asset(`Ball skin ${file}`,'texture',{url},{srgb,flipY:true,addressu:'repeat',addressv:'clamp',mipmaps:true})
      assets.add(asset)
      let settled=false
      const release=()=>{asset.unload();app.assets.remove(asset);assets.delete(asset)}
      const abort=()=>finish(new DOMException('球皮肤已卸载','AbortError'))
      const timer=setTimeout(()=>finish(new Error(`球皮肤贴图加载超时：${file}`)),15000)
      function finish(error?:Error) {
        if(settled)return
        settled=true;clearTimeout(timer);cancel.delete(abort)
        if(error){release();reject(error)}else resolve(asset.resource as pc.Texture)
      }
      cancel.add(abort)
      try { app.assets.add(asset);app.assets.loadFromUrl(url,'texture',(error,loaded)=>{
        if(settled||disposed){release();return}
        if(error||!loaded?.resource){finish(new Error(String(error||`无效贴图：${file}`)));return}
        finish()
      }) } catch(error) {finish(error instanceof Error?error:new Error(String(error)))}
    })
    requests.set(file,request)
    void request.catch(()=>{if(!disposed)requests.delete(file)})
    return request
  }
  return {load,destroy(){if(disposed)return;disposed=true;cancel.forEach(abort=>abort());cancel.clear();assets.forEach(asset=>{asset.unload();app.assets.remove(asset)});assets.clear();requests.clear()}}
}
