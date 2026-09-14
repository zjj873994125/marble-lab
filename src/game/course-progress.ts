import type { CourseProgressConfig, Position } from './level-types'

const distance=(a:Position,b:Position)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])
function routeLength(points:Position[]) { let total=0;for(let index=1;index<points.length;index++)total+=distance(points[index-1]!,points[index]!);return total }
function routeProgress(points:Position[],position:Position,minimum=0,maximum=1) {
  const total=routeLength(points)
  let walked=0,bestDistance=Infinity,bestAlong=minimum*total
  for(let index=1;index<points.length;index++) {
    const a=points[index-1]!,b=points[index]!,dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],lengthSquared=dx*dx+dy*dy+dz*dz
    const length=Math.sqrt(lengthSquared),start=walked/total,end=(walked+length)/total
    if(end<minimum||start>maximum){walked+=length;continue}
    const lower=length?Math.max(0,(minimum*total-walked)/length):0,upper=length?Math.min(1,(maximum*total-walked)/length):0
    const t=lengthSquared?Math.max(lower,Math.min(upper,((position[0]-a[0])*dx+(position[1]-a[1])*dy+(position[2]-a[2])*dz)/lengthSquared)):0
    const projected:Position=[a[0]+dx*t,a[1]+dy*t,a[2]+dz*t],candidate=distance(projected,position)
    if(candidate<bestDistance){bestDistance=candidate;bestAlong=walked+length*t}
    walked+=length
  }
  return total?bestAlong/total:0
}

export function createCourseProgress(config:CourseProgressConfig) {
  if(!config.routes.length)throw new Error('关卡至少需要一条合法路线')
  const checkpoints=new Map(config.checkpoints.map(point=>[point.id,point]))
  const gates=new Map((config.gates??[]).map(gate=>[gate.id,gate]))
  if(checkpoints.size!==config.checkpoints.length)throw new Error('关卡检查点id必须唯一')
  if(gates.size!==(config.gates??[]).length||[...gates.keys()].some(id=>checkpoints.has(id)))throw new Error('关卡gate id必须全局唯一')
  const steps=new Map<string,{kind:'checkpoint'|'gate';id:string}[]>()
  const stepProgress=new Map<string,number[]>()
  for(const route of config.routes) {
    if(!route.id||steps.has(route.id)||route.points.length<2||new Set(route.checkpointIds).size!==route.checkpointIds.length)throw new Error(`路线配置无效：${route.id||'missing'}`)
    for(const id of route.checkpointIds)if(!checkpoints.has(id))throw new Error(`路线 ${route.id} 引用未知检查点 ${id}`)
    const routeSteps=route.steps??route.checkpointIds.map(id=>({kind:'checkpoint' as const,id}))
    if(!routeSteps.length||routeSteps.some((step,index)=>routeSteps.findIndex(item=>item.kind===step.kind&&item.id===step.id)!==index))throw new Error(`路线步骤无效：${route.id}`)
    for(const step of routeSteps)if(step.kind==='checkpoint'?!checkpoints.has(step.id):!gates.has(step.id))throw new Error(`路线 ${route.id} 引用未知${step.kind} ${step.id}`)
    if(route.checkpointIds.join('|')!==routeSteps.filter(step=>step.kind==='checkpoint').map(step=>step.id).join('|'))throw new Error(`路线 ${route.id} 的checkpointIds与steps顺序不一致`)
    steps.set(route.id,routeSteps)
    stepProgress.set(route.id,routeSteps.reduce<number[]>((anchors,step)=>{
      const position=step.kind==='checkpoint'?checkpoints.get(step.id)!.respawn:gates.get(step.id)!.position
      anchors.push(routeProgress(route.points,position,anchors.at(-1)??0))
      return anchors
    },[]))
  }
  let candidates=config.routes.map(route=>route.id),history:{kind:'checkpoint'|'gate';id:string}[]=[],passedCheckpoints:string[]=[]
  const routes=new Map(config.routes.map(route=>[route.id,route]))
  function selectedRoute(){return candidates.length===1?candidates[0]:undefined}
  return {
    reset(){candidates=config.routes.map(route=>route.id);history=[];passedCheckpoints=[]},
    advance(previous:Position,position:Position) {
      const next=new Map<string,{kind:'checkpoint'|'gate';id:string}>()
      candidates.map(id=>steps.get(id)![history.length]).filter(Boolean).forEach(step=>next.set(`${step!.kind}:${step!.id}`,step!))
      const reached=[...next.values()].filter(step=>{
        if(step.kind==='checkpoint') {
          const point=checkpoints.get(step.id)!
          return Math.hypot(position[0]-point.respawn[0],position[2]-point.respawn[2])<(point.triggerRadius??1.2)&&Math.abs(position[1]-point.respawn[1])<(point.heightTolerance??1.2)
        }
        const gate=gates.get(step.id)!,forward=gate.forward
        if(Math.abs(position[1]-gate.position[1])>(gate.heightTolerance??1.2))return false
        if(!forward)return distance(position,gate.position)<gate.radius
        const length=Math.hypot(...forward);if(!length)throw new Error(`gate ${gate.id} 的forward不能为零向量`)
        const normal=forward.map(value=>value/length) as Position
        const signed=(point:Position)=>(point[0]-gate.position[0])*normal[0]+(point[1]-gate.position[1])*normal[1]+(point[2]-gate.position[2])*normal[2]
        const projection=signed(position),lateral:Position=[position[0]-gate.position[0]-normal[0]*projection,position[1]-gate.position[1]-normal[1]*projection,position[2]-gate.position[2]-normal[2]*projection]
        return signed(previous)<0&&projection>=0&&Math.hypot(...lateral)<gate.radius
      })
      if(!reached.length)return undefined
      const step=reached[0]!
      candidates=candidates.filter(id=>{const expected=steps.get(id)![history.length];return expected?.kind===step.kind&&expected.id===step.id})
      history.push(step)
      const checkpoint=step.kind==='checkpoint'?checkpoints.get(step.id):undefined
      if(checkpoint)passedCheckpoints.push(step.id)
      return {kind:step.kind,id:step.id,checkpoint}
    },
    tryCheckpoint(position:Position) {return this.advance(position,position)?.checkpoint},
    respawn():Position|undefined {return passedCheckpoints.length?checkpoints.get(passedCheckpoints.at(-1)!)!.respawn:undefined},
    complete(){const route=selectedRoute();return !!route&&history.length===steps.get(route)!.length},
    route:selectedRoute,
    checkpointCount(){return passedCheckpoints.length},
    checkpointTotal(){const route=selectedRoute();return route?routes.get(route)!.checkpointIds.length:Math.max(...config.routes.map(item=>item.checkpointIds.length))},
    progress(position:Position) {
      const active=(selectedRoute()? [routes.get(selectedRoute()!)!] : candidates.map(id=>routes.get(id)!))
      return Math.max(0,Math.min(1,Math.max(...active.map(route=>{
        const anchors=stepProgress.get(route.id)!,minimum=history.length?anchors[history.length-1]!:0,maximum=anchors[history.length]??1
        return routeProgress(route.points,position,minimum,maximum)
      }))))
    },
  }
}
