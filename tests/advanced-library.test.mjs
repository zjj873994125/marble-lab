import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import ts from 'typescript'
import * as pc from 'playcanvas'

const source=readFileSync(new URL('../src/game/advanced-library.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("'playcanvas'",`'${import.meta.resolve('playcanvas')}'`)
const {createAdvancedLibrary,advancedKinds}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const rootNames=['SpringTrampoline','GravityCoaster','PulseJet','OrbitalCatcher','ReversingConveyor','VortexFunnel','GimbalPlatform','CascadeBridge']
const manifest={schemaVersion:1,asset:'advanced-obstacle-library.glb',units:'m',upAxis:'+Y',entries:advancedKinds.map((id,index)=>({id,rootNode:rootNames[index],rootBounds:{min:[-1,0,-1],max:[1,2,1]},parts:[{nodePath:'Body',role:'body',motion:'fixed'}]}))}
function template(){const app={_entityIndex:{},systems:{}},scene=new pc.Entity('Scene',app);for(const name of rootNames){const root=new pc.Entity(name,app);root.addChild(new pc.Entity('Body',app));scene.addChild(root)}return scene}

test('高级机关库manifest和GLB各读一次，多根实例独立销毁',async()=>{
  let manifests=0,loads=0,templateDestroyed=0
  const scene=template(),originalDestroy=scene.destroy.bind(scene);scene.destroy=()=>{templateDestroyed++;originalDestroy()}
  const library=createAdvancedLibrary(async file=>{loads++;assert.equal(file,manifest.asset);return {resource:{instantiateRenderEntity:()=>scene}}},undefined,async()=>{manifests++;return manifest})
  const spring=await library.instantiate('spring-trampoline'),jet=await library.instantiate('pulse-jet')
  assert.equal(manifests,1);assert.equal(loads,1);assert.equal(spring.root.name,'SpringTrampoline');assert.equal(jet.part('Body').name,'Body')
  spring.destroy();library.destroy();library.destroy();assert.equal(templateDestroyed,1)
})

test('高级机关库缺分件或八根不全时拒绝',async()=>{
  const broken=structuredClone(manifest);broken.entries[0].parts[0].nodePath='Missing'
  const library=createAdvancedLibrary(async()=>({resource:{instantiateRenderEntity:template}}),undefined,async()=>broken)
  await assert.rejects(library.instantiate('spring-trampoline'),/节点缺失/);library.destroy()
  const short={...manifest,entries:manifest.entries.slice(0,7)},invalid=createAdvancedLibrary(async()=>({resource:{instantiateRenderEntity:template}}),undefined,async()=>short)
  await assert.rejects(invalid.instantiate('spring-trampoline'),/8类/);invalid.destroy()
})
