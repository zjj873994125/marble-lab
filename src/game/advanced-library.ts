import * as pc from 'playcanvas'
import type { AdvancedKind, AdvancedLibraryEntry, AdvancedLibraryManifest } from './advanced-types'

export const advancedKinds:AdvancedKind[]=['spring-trampoline','gravity-coaster','pulse-jet','orbital-catcher','reversing-conveyor','vortex-funnel','gimbal-platform','cascade-bridge']
export const isAdvancedKind=(value:string):value is AdvancedKind=>advancedKinds.includes(value as AdvancedKind)
export interface AdvancedLibraryInstance {root:pc.Entity;entry:AdvancedLibraryEntry;part:(path:string)=>pc.Entity;destroy:()=>void}

function nodeAt(root:pc.Entity,path:string) {
  let node=root
  for(const segment of path.split('/')){
    const matches=node.children.filter(child=>child.name===segment)
    if(matches.length!==1||!(matches[0] instanceof pc.Entity))throw new Error(`高级机关库节点缺失或重名：${path}`)
    node=matches[0]
  }
  return node
}

export function createAdvancedLibrary(load:(file:string)=>Promise<pc.Asset>,decorate?:(entity:pc.Entity)=>void,readManifest:()=>Promise<AdvancedLibraryManifest>=async()=>{
  const response=await fetch(`${import.meta.env.BASE_URL}models/advanced-obstacle-library.json`)
  if(!response.ok)throw new Error(`高级机关manifest加载失败：${response.status}`)
  return response.json() as Promise<AdvancedLibraryManifest>
}) {
  let disposed=false,template:pc.Entity|undefined,pending:Promise<{manifest:AdvancedLibraryManifest;template:pc.Entity}>|undefined
  const instances=new Set<AdvancedLibraryInstance>()
  async function prepare(){
    pending??=readManifest().then(async manifest=>{
      if(manifest.schemaVersion!==1||manifest.asset!=='advanced-obstacle-library.glb'||manifest.units!=='m'||manifest.upAxis!=='+Y')throw new Error('高级机关manifest版本或坐标无效')
      if(manifest.entries.length!==advancedKinds.length||advancedKinds.some(kind=>manifest.entries.filter(entry=>entry.id===kind).length!==1))throw new Error('高级机关manifest必须恰好包含8类')
      const asset=await load(manifest.asset)
      if(disposed)throw new DOMException('高级机关库已卸载','AbortError')
      template=(asset.resource as pc.ContainerResource).instantiateRenderEntity();template.enabled=false;decorate?.(template)
      return {manifest,template}
    })
    return pending
  }
  return {
    async instantiate(kind:AdvancedKind){
      if(disposed)throw new DOMException('高级机关库已卸载','AbortError')
      const {manifest,template}=await prepare(),entry=manifest.entries.find(item=>item.id===kind)!,matches:pc.Entity[]=[]
      const visit=(node:pc.GraphNode)=>{if(node.name===entry.rootNode&&node instanceof pc.Entity)matches.push(node);node.children.forEach(visit)}
      visit(template)
      if(matches.length!==1)throw new Error(`高级机关库根缺失或重名：${entry.rootNode}`)
      entry.parts.forEach(part=>nodeAt(matches[0]!,part.nodePath))
      const root=matches[0]!.clone();root.enabled=false
      let released=false
      const instance:AdvancedLibraryInstance={root,entry,part:path=>nodeAt(root,path),destroy(){if(released)return;released=true;instances.delete(instance);root.destroy()}}
      instances.add(instance);return instance
    },
    destroy(){if(disposed)return;disposed=true;for(const instance of [...instances])instance.destroy();template?.destroy();template=undefined},
  }
}
