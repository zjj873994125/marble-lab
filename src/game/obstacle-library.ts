import * as pc from 'playcanvas'
import { libraryEntry, libraryManifest } from './library-data'
import type { LibraryKind } from './library-types'

export interface LibraryInstance {
  root: pc.Entity
  part: (path:string)=>pc.Entity
  destroy: ()=>void
}
function nodeAt(root:pc.Entity,path:string) {
  let node=root
  for(const segment of path.split('/')) {
    const matches=node.children.filter(child=>child.name===segment)
    if(matches.length!==1||!(matches[0] instanceof pc.Entity))throw new Error(`机关库节点缺失或重名：${path}`)
    node=matches[0]
  }
  return node
}

// 每个Application使用域一份整包模板，实例只克隆目标根；资产由外层资源池持有。
export function createObstacleLibrary(load:(file:string)=>Promise<pc.Asset>) {
  let template:pc.Entity|undefined,pending:Promise<pc.Entity>|undefined,disposed=false
  const instances=new Set<LibraryInstance>()
  async function getTemplate() {
    if(disposed)throw new DOMException('机关库已卸载','AbortError')
    pending??=load(libraryManifest.asset).then(asset=>{
      if(disposed)throw new DOMException('机关库已卸载','AbortError')
      const entity=(asset.resource as pc.ContainerResource).instantiateRenderEntity()
      entity.enabled=false;template=entity
      return entity
    })
    return pending
  }
  return {
    async instantiate(kind:LibraryKind):Promise<LibraryInstance> {
      const scene=await getTemplate()
      if(disposed)throw new DOMException('机关库已卸载','AbortError')
      const entry=libraryEntry(kind),matches:pc.Entity[]=[]
      const visit=(node:pc.GraphNode)=>{if(node.name===entry.rootNode&&node instanceof pc.Entity)matches.push(node);node.children.forEach(visit)}
      visit(scene)
      if(matches.length!==1)throw new Error(`机关库根缺失或重名：${entry.rootNode}`)
      const source=matches[0]!
      for(const part of entry.parts)nodeAt(source,part.nodePath)
      const root=source.clone();root.enabled=false
      let released=false
      const instance:LibraryInstance={root,part:path=>nodeAt(root,path),destroy(){if(released)return;released=true;instances.delete(instance);root.destroy()}}
      instances.add(instance)
      return instance
    },
    destroy(){if(disposed)return;disposed=true;for(const instance of [...instances])instance.destroy();template?.destroy();template=undefined},
  }
}
