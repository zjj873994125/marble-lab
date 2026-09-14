import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import * as pc from 'playcanvas'

const source=readFileSync(new URL('../src/game/water-material.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;?$/gm,'').replace('export function','function')

test('非经典水反射仅懒建一次且中性，恢复原贴图不改变法线/相位，纹理仅释放一次',()=>{
  let now=0
  const textures=[]
  class Texture {constructor(device,options){Object.assign(this,options);this.destroyed=0;textures.push(this)}setSource(source){this.source=source}destroy(){this.destroyed++}}
  const document={createElement(){const canvas={width:0,height:0};canvas.getContext=()=>({createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:image=>{canvas.image=image}});return canvas}}
  const create=new Function('pc','document','performance',`${js};return createWaterMaterial`)({...pc,Texture},document,{now:()=>now})
  const water=create({graphicsDevice:{}}),classic=water.material.cubeMap,normal=water.material.normalMap
  assert.equal(textures.length,2)
  water.update(true);now=100;water.update(true)
  const offsets=water.material.getParameter('water_offsets').data,before=[...offsets]
  water.setTheme('industrial')
  const neutral=water.material.cubeMap,pixel=neutral.source[0].image.data
  assert.equal(textures.length,3);assert.notEqual(neutral,classic);assert.equal(pixel[0],pixel[1]);assert.equal(pixel[1],pixel[2])
  assert.equal(water.material.normalMap,normal);assert.deepEqual([...offsets],before)
  now=200;water.update(true);assert.ok(offsets[0]>before[0])
  water.setTheme('pink');assert.equal(water.material.cubeMap,neutral);assert.equal(textures.length,3)
  water.setTheme('classic');assert.equal(water.material.cubeMap,classic);assert.equal(water.material.normalMap,normal)
  water.configure(false);assert.equal(water.material.getParameter('water_detail').data,0)
  water.destroy();water.destroy();assert.ok(textures.every(texture=>texture.destroyed===1))
})
