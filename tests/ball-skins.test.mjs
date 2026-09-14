import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import * as pc from 'playcanvas'

const compile=file=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {ballSkin}=await import(`data:text/javascript;base64,${Buffer.from(compile('../src/game/ball-skins.ts')).toString('base64')}`)
const js=compile('../src/game/steel-material.ts').replace(/^import .*;?$/gm,'').replace('export function','function')
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function harness() {
  const textures=[],pending=new Map(),loaded=new Map()
  class Texture {constructor(device,options){Object.assign(this,options);this.destroyed=0;textures.push(this)}setSource(source){this.source=source}destroy(){this.destroyed++}}
  const document={createElement(){const canvas={};canvas.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{canvas.image=image}});return canvas}}
  const pool={load(file,srgb){if(!pending.has(file))pending.set(file,{});const entry=pending.get(file);entry.srgb=srgb;return new Promise(resolve=>{entry.resolve=resolve})},destroy(){loaded.forEach(texture=>texture.destroy())}}
  const create=new Function('pc','document','ballSkin','createBallSkinTextures',`${js};return createSteelMaterial`)({...pc,Texture},document,ballSkin,()=>pool)
  const steel=create({graphicsDevice:{}})
  return {steel,textures,pending,release(){for(const [file,entry] of pending){const texture=new Texture({}, {name:file});loaded.set(file,texture);entry.resolve(texture)}pending.clear()}}
}

test('金属与运动球切换恢复原钢球全部受改字段，环纹缓存且不替换normal',async()=>{
  const h=harness(),material=h.steel.material,environment=material.cubeMap,polish=material.normalMap,channel=material.glossMapChannel
  h.steel.setSkin('ringed-steel');const ring=material.diffuseMap,gloss=material.glossMap
  assert.ok(ring&&gloss);assert.equal(material.normalMap,polish);assert.equal(material.gloss,.93)
  const pixels=ring.source.image.data,w=ring.width
  for(const row of [0,163,255,511])assert.deepEqual([...pixels.slice(row*w*4,row*w*4+4)],[...pixels.slice((row*w+w-1)*4,(row*w+w)*4)])
  for(const id of ['basketball','soccer','tennis','eight-ball']) {
    h.steel.setSkin(id);h.release();await flush();h.steel.update(3)
    assert.equal(material.metalness,0);assert.equal(material.gloss,1);assert.equal(material.glossInvert,true)
    assert.equal(material.reflectivity,ballSkin(id).reflectivity);assert.equal(material.bumpiness,ballSkin(id).normalStrength)
    assert.notEqual(material.normalMap,polish);assert.equal(material.cubeMap,environment)
    h.steel.setSkin('steel');assert.equal(material.diffuseMap,null);assert.equal(material.glossMap,null);assert.equal(material.glossMapChannel,channel);assert.equal(material.glossInvert,false)
    assert.deepEqual([material.diffuse.r,material.diffuse.g,material.diffuse.b],[.82,.83,.84]);assert.equal(material.metalness,1);assert.equal(material.gloss,.93);assert.equal(material.reflectivity,1);assert.equal(material.normalMap,polish)
  }
  h.steel.setSkin('ringed-steel');assert.equal(material.diffuseMap,ring);assert.equal(material.glossMap,gloss)
  h.steel.destroy();h.steel.destroy();assert.ok(h.textures.every(texture=>texture.destroyed===1))
})

test('迟到运动贴图不覆盖新选择，逐帧微纹更新不重置金属PBR',async()=>{
  const h=harness(),m=h.steel.material
  h.steel.setSkin('basketball');h.steel.setSkin('rose-gold');h.release();await flush();h.steel.update(0)
  assert.equal(m.metalness,1);assert.equal(m.diffuseMap,null);assert.equal(m.gloss,.88)
  const color=new pc.Color().fromString('#C88F7B');assert.deepEqual([m.diffuse.r,m.diffuse.g,m.diffuse.b],[color.r,color.g,color.b])
  h.steel.setSkin('ice-blue');h.steel.update(2);assert.equal(m.metalness,.95);assert.equal(m.gloss,.9)
  h.steel.destroy()
})
