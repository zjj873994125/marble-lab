import manifestData from '../../public/models/obstacle-library.json'
import mechanismTrial from '../levels/mechanism-trial'
import type { LibraryEntry, LibraryKind, LibraryManifest, LibraryMechanismConfig, LibraryPart } from './library-types'
import type { Position } from './level-types'

export const libraryManifest = manifestData as unknown as LibraryManifest
export const libraryKinds: LibraryKind[] = ['weight-seesaw','axial-roller','piston-wall','timed-trapdoor','sway-cradle-bridge']
export function isLibraryKind(value: string): value is LibraryKind { return libraryKinds.includes(value as LibraryKind) }
export function libraryEntry(kind: LibraryKind): LibraryEntry {
  const entry = libraryManifest.entries.find(item => item.id === kind)
  if (!entry) throw new Error(`机关库缺少 ${kind}`)
  return entry
}
export function bodyPart(kind: LibraryKind): LibraryPart {
  const part = libraryEntry(kind).parts.find(item => item.bodySize && item.bodyCenterOffset)
  if (!part) throw new Error(`机关库缺少 ${kind} 的主体尺寸或枢轴`)
  return part
}
export function partByPath(kind: LibraryKind, path: string): LibraryPart {
  const part = libraryEntry(kind).parts.find(item => item.nodePath === path)
  if (!part) throw new Error(`机关库缺少节点 ${path}`)
  return part
}
const smooth = (t: number) => t*t*(3-2*t)
const cycleTime = (time: number, stages: readonly number[]) => {
  if (stages.some(stage => !Number.isFinite(stage) || stage <= 0)) throw new Error('机关各阶段时长必须为正数')
  const cycle = stages.reduce((sum,value) => sum+value,0)
  return ((time % cycle)+cycle)%cycle
}

// 跷跷板角度必须由调用者明确提供：图鉴给示意角，游戏给真实刚体角。
export function libraryPose(config: LibraryMechanismConfig, time: number, seesawAngle = 0) {
  const part = bodyPart(config.kind), pivot: Position = [...part.position]
  const centerOffset = part.bodyCenterOffset!, rotation: Position = [0,0,0]
  const t = time + (config.phaseSeconds ?? 0)
  let angle = 0, extension = 0, warning = false
  if(config.kind === 'weight-seesaw') angle = seesawAngle
  if(config.kind === 'axial-roller') angle = (config.angularSpeed ?? -.45)*t*180/Math.PI
  if(config.kind === 'sway-cradle-bridge') {
    const period=config.period??10
    if(!Number.isFinite(period)||period<=0)throw new Error('吊桥周期必须为正数')
    angle=(config.amplitude??9)*Math.sin(t*2*Math.PI/period)
  }
  if(config.kind === 'piston-wall') {
    const stages=config.stages??[3,1,1.6,.8,1.6]
    let phase=cycleTime(t,stages)
    if(phase<stages[0]) extension=0
    else if((phase-=stages[0])<stages[1]) warning=true
    else if((phase-=stages[1])<stages[2]) extension=smooth(phase/stages[2])
    else if((phase-=stages[2])<stages[3]) extension=1
    else { phase-=stages[3]; extension=1-smooth(phase/stages[4]) }
    pivot[0]+=(config.travel??3.7)*extension
  }
  if(config.kind === 'timed-trapdoor') {
    const stages=config.stages??[4.5,1,1.5,1.5], openAngle=config.openAngle??-90
    let phase=cycleTime(t,stages)
    if(phase<stages[0]) warning=phase>=Math.max(0,stages[0]-(config.warningSeconds??.9))
    else if((phase-=stages[0])<stages[1]) angle=openAngle*smooth(phase/stages[1])
    else if((phase-=stages[1])<stages[2]) angle=openAngle
    else { phase-=stages[2]; angle=openAngle*(1-smooth(phase/stages[3])) }
  }
  const rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad)
  const [x,y,z]=centerOffset
  let offset:Position
  if(config.kind==='weight-seesaw'){rotation[0]=angle;offset=[x,y*c-z*s,y*s+z*c]}
  else {rotation[2]=angle;offset=[x*c-y*s,x*s+y*c,z]}
  const center=pivot.map((value,i)=>value+offset[i]!) as Position
  return { pivot, center, rotation, angle, extension, warning }
}

export function previewLibraryConfig(kind: LibraryKind): LibraryMechanismConfig {
  const config=mechanismTrial.mechanisms?.find(item=>item.kind===kind)
  if(!config)throw new Error(`正式关卡缺少图鉴机关：${kind}`)
  // 只归零展示位置和朝向，时序/速度等参数始终来自正式关卡。
  return {...config,id:`preview-${kind}`,position:[0,0,0],yaw:0}
}

// 杆的显示与碰撞共用缸口、半径和端点；不从设计备注或旧常量猜尺寸。
export function pistonRodPose(config: Extract<LibraryMechanismConfig,{kind:'piston-wall'}>,time:number) {
  const rod=partByPath(config.kind,'PistonWall_Rod'),head=bodyPart(config.kind)
  const radius=rod.collisionRadius,referenceLength=rod.referenceLength
  if(typeof radius!=='number'||!Number.isFinite(radius)||radius<=0||typeof referenceLength!=='number'||!Number.isFinite(referenceLength)||referenceLength<=0)throw new Error('推杆缺少有效碰撞半径/参考长度')
  if(!rod.extensionAxis||rod.extensionAxis.some((value,i)=>value!==(i===0?1:0)))throw new Error('推杆目前仅支持库局部+X伸缩轴')
  const back=libraryPose(config,time).center[0]-head.bodySize![0]/2
  const length=back-rod.position[0]
  if(!Number.isFinite(length)||length<=0)throw new Error('推杆后缘必须位于缸口前方')
  const center:Position=[rod.position[0]+length/2,rod.position[1],rod.position[2]]
  return {center,length,radius,referenceLength,scale:length/referenceLength}
}
