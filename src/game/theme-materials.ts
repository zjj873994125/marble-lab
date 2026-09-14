import * as pc from 'playcanvas'
import { modelThemeRole, trackTheme, type ThemeRole, type TrackThemeId } from './track-themes'

interface Entry { material:pc.StandardMaterial;role:ThemeRole;baseline:{diffuse:pc.Color;metalness:number;gloss:number;useMetalness:boolean;reflectivity:number} }

// 每个Application独立持有克隆；切换只改已有材质，不改原资源或重建场景。
export function createThemeMaterials(selection:()=>TrackThemeId) {
  const entries=new Map<pc.StandardMaterial,Map<ThemeRole,Entry>>()
  const clones=new Set<pc.Material>()
  let current=selection(),disposed=false
  function apply(entry:Entry) {
    const {material,baseline,role}=entry
    if(current==='classic') {
      material.diffuse.copy(baseline.diffuse);material.metalness=baseline.metalness;material.gloss=baseline.gloss;material.useMetalness=baseline.useMetalness;material.reflectivity=baseline.reflectivity
    } else {
      const finish=trackTheme(current).roles[role]
      material.diffuse.fromString(finish.color)
      if(role!=='water'){material.metalness=finish.metalness;material.useMetalness=true}
      // glTF使用glossInvert表达粗糙度，primitive/water使用普通gloss，保留各自纹理解释。
      material.gloss=material.glossInvert?finish.roughness:1-finish.roughness
      material.reflectivity=finish.reflectivity??baseline.reflectivity
    }
    material.update()
  }
  function refresh() {
    if(disposed)return
    const next=selection();if(next===current)return
    current=next;entries.forEach(roles=>roles.forEach(apply))
  }
  function material(source:pc.Material,role?:ThemeRole,owned=false):pc.Material {
    if(disposed)throw new DOMException('主题作用域已卸载','AbortError')
    refresh()
    if(!role||!(source instanceof pc.StandardMaterial)||clones.has(source))return source
    const roles=entries.get(source)??new Map<ThemeRole,Entry>()
    const existing=roles.get(role);if(existing)return existing.material
    const target=owned?source:source.clone()
    if(!owned)clones.add(target)
    const entry={material:target,role,baseline:{diffuse:source.diffuse.clone(),metalness:source.metalness,gloss:source.gloss,useMetalness:source.useMetalness,reflectivity:source.reflectivity}}
    roles.set(role,entry);entries.set(source,roles);apply(entry);return target
  }
  function applyEntity(root:pc.Entity) {
    if(disposed)throw new DOMException('主题作用域已卸载','AbortError')
    refresh()
    const visit=(node:pc.GraphNode)=>{
      if(node instanceof pc.Entity&&node.render)for(const mesh of node.render.meshInstances)mesh.material=material(mesh.material,modelThemeRole(mesh.material.name))
      node.children.forEach(visit)
    }
    visit(root)
  }
  return {material,applyEntity,refresh,destroy(){if(disposed)return;disposed=true;clones.forEach(material=>material.destroy());clones.clear();entries.clear()}}
}
