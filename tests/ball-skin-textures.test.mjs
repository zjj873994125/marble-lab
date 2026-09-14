import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source=readFileSync(new URL('../src/game/ball-skin-textures.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;?$/gm,'').replace('export function','function')
function harness() {
  const assets=new Map(),callbacks=new Map()
  class Asset {constructor(name,type,file,data){Object.assign(this,{name,type,file,data})}unload(){this.resource?.destroy();this.resource=null}}
  const app={assets:{add(asset){assets.set(asset.file.url,asset)},remove(asset){if(assets.get(asset.file.url)===asset)assets.delete(asset.file.url)},loadFromUrl(url,type,cb){callbacks.set(url,cb)}}}
  const create=new Function('pc','ballSkinAsset',`${js};return createBallSkinTextures`)({Asset},file=>`/${file}`)
  return {pool:create(app),assets,callbacks}
}
test('球纹理按需缓存颜色空间，取消后迟到纹理仍释放',async()=>{
  const h=harness(),first=h.pool.load('ball-basecolor.png',true),same=h.pool.load('ball-basecolor.png',true)
  assert.equal(first,same);assert.equal(h.callbacks.size,1)
  const asset=h.assets.get('/ball-basecolor.png');assert.equal(asset.data.srgb,true);assert.equal(asset.data.flipY,true)
  let destroyed=0;asset.resource={destroy(){destroyed++}};h.callbacks.get('/ball-basecolor.png')(null,asset);await first
  const late=h.pool.load('ball-normal.png',false).catch(error=>error.name),lateAsset=h.assets.get('/ball-normal.png');assert.equal(lateAsset.data.srgb,false)
  h.pool.destroy();h.pool.destroy();assert.equal(await late,'AbortError');assert.equal(destroyed,1)
  lateAsset.resource={destroy(){destroyed++}};h.callbacks.get('/ball-normal.png')(null,lateAsset)
  assert.equal(destroyed,2);assert.equal(h.assets.size,0)
})
