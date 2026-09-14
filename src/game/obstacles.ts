import initial from '../levels/initial-gravity'
import water from '../levels/water-rush'
import type { LibraryKind } from './library-types'
import type { AdvancedKind } from './advanced-types'
import seesawThumbnail from '../assets/obstacles/weight-seesaw.png'
import rollerThumbnail from '../assets/obstacles/axial-roller.png'
import pistonThumbnail from '../assets/obstacles/piston-wall.png'
import trapdoorThumbnail from '../assets/obstacles/timed-trapdoor.png'
import cradleThumbnail from '../assets/obstacles/sway-cradle-bridge.png'

export type ObstacleId = 'pendulum' | 'hammers' | 'cross' | 'lifts' | 'platform' | 'beam' | 'serpentine' | 'ramp' | LibraryKind | AdvancedKind
export type ObstacleCategory = '动态机关' | '路线挑战'
export interface ObstacleEntry {
  id: ObstacleId
  name: string
  category: ObstacleCategory
  skill: string
  summary: string
  motion: string
  strategy: string
  placement: string
  caution: string
  appearsIn: string[]
  pairs: ObstacleId[]
  facts: { label: string; value: string }[]
  thumbnail?: string
  previewSupported?: boolean
  gameplayImplemented?: boolean
}
const period = (speed: number) => `${(2 * Math.PI / speed).toFixed(2)} 秒`
const hammer = initial.pendulum!
const cross = water.turntable!
const lifts = water.lifts!
const beam = water.staticObjects.find(object => object.name === 'narrow-bridge')!
const ramp = water.staticObjects.find(object => object.name === 'ramp-climb')!

// 图鉴元数据可供后续关卡推荐使用；数值读取正式配置，不另建玩法参数源。
export const obstacleCatalog: ObstacleEntry[] = [
  { id: 'pendulum', name: '单摆锤', category: '动态机关', skill: '观察时机', summary: '一道来回扫过轨道的平端锤。', motion: '锤头左右往复，抬升随横向偏移变化；锤柄始终连接上方吊点。', strategy: '先在扫掠范围外观察，锤头离开通道时果断通过。', placement: '适合放在前段，教玩家第一次观察、刹车和择时。', caution: '两侧开放，实际锤击可能让球离开轨道；等待区应避开摆动范围。', appearsIn: ['教学关卡'], pairs: ['beam', 'platform'], facts: [{ label: '往复周期', value: period(hammer.angularSpeed) }, { label: '横向振幅', value: `${hammer.amplitude} 米` }] },
  { id: 'hammers', name: '三锤阵', category: '动态机关', skill: '连续择时', summary: '三把不同节奏的大锤，逐段读准空当。', motion: '三把锤沿固定杆长的圆弧独立摆动，速度和起始相位错开，不能按同一节奏一路冲过。', strategy: '一次只判断下一把锤，利用锤间空间重新对准路线。', placement: '适合中高难度开场，接在安全起点之后。', caution: '锤速提升要保留可观察间隔，不要把检查点放在锤头扫掠区。', appearsIn: ['水上冲关'], pairs: ['cross', 'lifts'], facts: [{ label: '各锤角频率', value: water.hammers!.map(h => h.angularSpeed).join(' / ') + ' rad/s' }, { label: '固定杆长', value: `${water.hammers![0]!.rodLength} 米` }] },
  { id: 'cross', name: '十字旋转台', category: '动态机关', skill: '转乘控球', summary: '等臂端对齐，上台、稳住，再到对岸。', motion: '中心和四臂绕竖直轴持续旋转，四角没有台面。球通过真实接触受到转台影响，需要主动纠偏。', strategy: '在岸上等臂端，登台后保持位置，接近出口时准备离台。', placement: '适合衔接两个分段，让直线冲刺转为观察和精细控球。', caution: '入口与出口必须对齐臂端；不要把四角空区当作承托面。', appearsIn: ['水上冲关'], pairs: ['hammers', 'lifts'], facts: [{ label: '一圈时间', value: period(cross.angularSpeed) }, { label: '臂宽', value: `${cross.parts[0]!.size[0]} 米` }] },
  { id: 'lifts', name: '交替升降板', category: '动态机关', skill: '高度判断', summary: '相邻板块一上一下，踩准接近同高的瞬间。', motion: '四块板上下往复，奇偶两组反相；站在板上会随承托接触升降，板间高差持续变化。', strategy: '在当前板上稳住，下一块接近同高时再向前。', placement: '适合增加纵向节奏；前后接固定岛，给玩家观察和恢复空间。', caution: '没有跳跃键，设计需保留可以靠滚动跨越的接缝与高度窗口。', appearsIn: ['水上冲关'], pairs: ['cross', 'beam'], facts: [{ label: '完整升降行程', value: `${lifts[0]!.amplitude * 2} 米` }, { label: '往复周期', value: period(lifts[0]!.angularSpeed) }] },
  { id: 'platform', name: '横移平台', category: '动态机关', skill: '判断缺口', summary: '平台横向让开通道，抓住接驳窗口。', motion: '平台沿横向往复移动，两端极值时通道会完整露空；台面、条纹和碰撞一起移动。', strategy: '先看平台回程，在岸上留出准备距离，连续越过两端接缝。', placement: '适合放在窄路之后，组合控线与择时；岸上要有等待区。', caution: '平台错位时不能通行，不要把导轨误当桥面。', appearsIn: ['教学关卡', '水上冲关'], pairs: ['beam', 'lifts'], facts: [{ label: '预览版本', value: '水上冲关' }, { label: '横向总行程', value: `${water.platform!.amplitude * 2} 米` }, { label: '往复周期', value: period(water.platform!.angularSpeed) }] },
  { id: 'beam', name: '独木桥', category: '路线挑战', skill: '细微修正', summary: '比球直径更窄的细梁，考验中心线控制。', motion: '桥体本身不动，两侧没有护栏；球可以部分悬在边缘外，但偏离支撑就会掉落。', strategy: '先在入口固定岛对准，少量修正方向，需要时轻刹。', placement: '适合连接固定岛和横移机关，形成“控线→观察”的节奏。', caution: '球直径保持 0.85 米，不能靠隐形宽托板把细桥变容易。', appearsIn: ['水上冲关'], pairs: ['platform', 'lifts'], facts: [{ label: '有效桥宽', value: `${beam.size[0]} 米` }, { label: '桥长', value: `${beam.size[2]} 米` }] },
  { id: 'serpentine', name: '蛇形回头弯', category: '路线挑战', skill: '走线保速', summary: '连续反向回头，既要转得准，也要留住速度。', motion: '静态轨道由连续回头弯组成，出弯后很快接坡。弯间空区没有承托，不能沿直线抄近。', strategy: '提前转向，在每次反向之间调整路线，避免最后一弯过度刹车。', placement: '适合压轴前的技术段，与惯性坡组成保速挑战。', caution: '新线形难度尚待实际体验校准；路径动画只说明走向，不证明速度足够。', appearsIn: ['水上冲关'], pairs: ['ramp', 'beam'], facts: [{ label: '路线结构', value: '入口弯 + 4 次回头' }, { label: '通路宽度', value: '1.6 米' }] },
  { id: 'ramp', name: '惯性坡', category: '路线挑战', skill: '保留动量', summary: '带着出弯余速上坡，坡顶再稳稳停下。', motion: '坡面本身静止，前后有较缓的接入段。重力与原始操控共同决定能否上坡，没有隐藏速度门槛。', strategy: '通过前段保留余速；如果回滑，回到弯前重新组织路线。', placement: '适合接在蛇形末端，坡顶留制动区再放终点。', caution: '当前蛇形与坡的组合未做最终可通性验收，不能将示意小球视为真实冲坡结果。', appearsIn: ['水上冲关'], pairs: ['serpentine'], facts: [{ label: '主坡角', value: `${Math.max(...ramp.rotation!.map(Math.abs))}°` }, { label: '主坡斜长', value: `${Math.max(ramp.size[0], ramp.size[2])} 米` }] },
]

const libraryCards:{id:LibraryKind;name:string;thumbnail:string;skill:string}[]=[
  {id:'weight-seesaw',name:'压重跷跷板',thumbnail:seesawThumbnail,skill:'负载平衡'},
  {id:'axial-roller',name:'轴向滚筒桥',thumbnail:rollerThumbnail,skill:'曲面平衡'},
  {id:'piston-wall',name:'伸缩推墙',thumbnail:pistonThumbnail,skill:'避让择时'},
  {id:'timed-trapdoor',name:'定时翻板',thumbnail:trapdoorThumbnail,skill:'开口时机'},
  {id:'sway-cradle-bridge',name:'摆动吊桥',thumbnail:cradleThumbnail,skill:'倾摆控球'},
]
obstacleCatalog.push(...libraryCards.map(card=>({...card,category:'动态机关' as const,summary:'',motion:'',strategy:'',placement:'',caution:'图鉴为分件姿态示意，第三关动力已实现但未经试玩验证。',appearsIn:['机关试炼'],pairs:[],facts:[],previewSupported:true,gameplayImplemented:true})))

const advancedCards:{id:AdvancedKind;name:string;category:ObstacleCategory;skill:string;pairs:ObstacleId[]}[]=[
  {id:'spring-trampoline',name:'蓄能蹦床',category:'动态机关',skill:'弹道控制',pairs:['orbital-catcher','cascade-bridge']},
  {id:'gravity-coaster',name:'重力过山车弯轨',category:'路线挑战',skill:'惯性过弯',pairs:['pulse-jet','reversing-conveyor']},
  {id:'pulse-jet',name:'脉冲喷气阵',category:'动态机关',skill:'侧向补偿',pairs:['gimbal-platform','spring-trampoline']},
  {id:'orbital-catcher',name:'巡航接球斗',category:'动态机关',skill:'动态落点',pairs:['spring-trampoline','beam']},
  {id:'reversing-conveyor',name:'反转输送带桥',category:'动态机关',skill:'反向牵引',pairs:['gravity-coaster','beam']},
  {id:'vortex-funnel',name:'回旋漏斗',category:'路线挑战',skill:'缩圈落孔',pairs:['orbital-catcher','spring-trampoline']},
  {id:'gimbal-platform',name:'双轴天平台',category:'动态机关',skill:'双轴负载',pairs:['pulse-jet','cascade-bridge']},
  {id:'cascade-bridge',name:'连锁坍塌桥',category:'动态机关',skill:'持续冲刺',pairs:['gimbal-platform','spring-trampoline']},
]
obstacleCatalog.push(...advancedCards.map(card=>({...card,summary:'',motion:'',strategy:'',placement:'',caution:'动态预览展示机构姿态，真实接触与负载以高阶机关试验场为准。',appearsIn:['高阶机关试验场'],facts:[],previewSupported:true,gameplayImplemented:true})))
