import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import * as pc from 'playcanvas'

const compile=file=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const asModule=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const themesUrl=asModule(compile('../src/game/track-themes.ts'))
const {modelThemeRole,trackTheme}=await import(themesUrl)
const {createThemeMaterials}=await import(asModule(compile('../src/game/theme-materials.ts').replace("'playcanvas'",`'${import.meta.resolve('playcanvas')}'`).replace("'./track-themes'",`'${themesUrl}'`)))
const color=material=>[material.diffuse.r,material.diffuse.g,material.diffuse.b,material.diffuse.a]

test('classic逐对象恢复，同名材质不共用基线，切换复用克隆且不释放共享纹理',()=>{
  let selected='classic',textureDestroyed=0,cloneCount=0
  const source=new pc.StandardMaterial();source.name='Ivory polymer.001';source.diffuse.set(.21,.34,.45);source.gloss=.27;source.glossInvert=true;source.metalness=.13
  const texture={destroy(){textureDestroyed++}}
  source.normalMap=texture
  const clone=source.clone.bind(source);source.clone=()=>{cloneCount++;return clone()}
  const other=new pc.StandardMaterial();other.name=source.name;other.diffuse.set(.61,.52,.43);other.gloss=.74
  const original=color(source),otherColor=color(other)
  const scope=createThemeMaterials(()=>selected),first=scope.material(source,modelThemeRole(source.name)),second=scope.material(other,'deck')
  assert.notEqual(first,source);assert.notEqual(first,second)
  for(const theme of ['industrial','glacier','black-gold','violet','pink','yellow']) {
    selected=theme;scope.refresh()
    assert.equal(scope.material(source,'deck'),first);assert.equal(first.gloss,trackTheme(theme).roles.deck.roughness)
    assert.deepEqual(color(source),original);assert.equal(first.normalMap,texture)
  }
  selected='classic';scope.refresh()
  assert.deepEqual(color(first),original);assert.deepEqual(color(second),otherColor)
  assert.equal(first.gloss,.27);assert.equal(first.glossInvert,true);assert.equal(first.metalness,.13);assert.equal(second.gloss,.74)
  assert.equal(cloneCount,1)
  scope.destroy();scope.destroy();assert.equal(textureDestroyed,0)
  source.destroy();other.destroy()
})

test('保护语义和未知名不染色，迟到材质取最新主题，独立作用域不互相污染',()=>{
  let selected='industrial'
  const scope=createThemeMaterials(()=>selected)
  for(const name of ['Safety terracotta.001','Printed markings','Rubber pads','Toy charcoal handle','Polished bearing steel','Unknown steel','__proto__']) {
    const material=new pc.StandardMaterial();material.name=name
    assert.equal(scope.material(material,modelThemeRole(name)),material);material.destroy()
  }
  assert.equal(modelThemeRole(' Ivory polymer.001.002 '),'deck')
  const source=new pc.StandardMaterial();source.name='Platform enamel'
  selected='black-gold'
  const late=scope.material(source,modelThemeRole(source.name))
  assert.deepEqual(color(late),color({diffuse:new pc.Color().fromString(trackTheme(selected).roles.platform.color)}))
  const other=createThemeMaterials(()=> 'classic'),classic=other.material(source,'platform')
  assert.notEqual(classic,late);assert.deepEqual(color(classic),color(source))
  scope.destroy();other.destroy();source.destroy()
})

test('水主题保留uniform相位与专用反射流程，classic恢复原PBR',()=>{
  let selected='classic'
  const scope=createThemeMaterials(()=>selected),water=new pc.StandardMaterial()
  water.diffuse.fromString('#123c45');water.useMetalness=false;water.specular.set(.025,.025,.025);water.gloss=.68;water.reflectivity=.45
  const offsets=new Float32Array([.12,.23,.34,.45]);water.setParameter('water_offsets',offsets)
  assert.equal(scope.material(water,'water',true),water)
  selected='black-gold';scope.refresh()
  assert.equal(water.useMetalness,false);assert.equal(water.specular.r,.025);assert.equal(water.gloss,.62);assert.equal(water.reflectivity,.32)
  assert.equal(water.getParameter('water_offsets').data,offsets)
  selected='classic';scope.refresh();assert.equal(water.gloss,.68);assert.equal(water.reflectivity,.45)
  for(const theme of ['violet','pink','yellow']) {
    selected=theme;scope.refresh()
    assert.equal(water.gloss,.65);assert.equal(water.reflectivity,trackTheme(theme).roles.water.reflectivity)
    assert.equal(water.useMetalness,false);assert.equal(water.getParameter('water_offsets').data,offsets)
  }
  selected='classic';scope.refresh();assert.equal(water.gloss,.68);assert.equal(water.reflectivity,.45)
  scope.destroy();water.destroy()
})
