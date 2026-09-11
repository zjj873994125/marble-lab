// 由代码对话维护格式；关卡对话只填写 src/levels 下的数据。
export type Position = [number, number, number]
export type MaterialName = 'cream' | 'edge' | 'orange' | 'dark' | 'blue' | 'floorMat' | 'water' | 'poolEdge'
export type RulesVersion = 'classic' | 'open-hammer' | 'flat-hammer' | 'standard'

export interface PrimitiveConfig {
  name: string
  type: 'box' | 'sphere' | 'cylinder' | 'capsule'
  position: Position
  size: Position
  material: MaterialName
  body?: 'static'
  collisionAxis?: 1 | 2
  rotation?: Position
  refinedVisual?: boolean
}

export interface RingConfig { position: Position; radius: number }
export interface TrackVisualsConfig { track: string; platform: string }
export interface HammerVisualsConfig { head: string; handle: string }

export interface ArcHammerConfig {
  ball: PrimitiveConfig
  rod: PrimitiveConfig
  visuals?: HammerVisualsConfig | null
  anchor: Position
  rodLength: number
  maxAngle: number
  angularSpeed: number
  phase: number
  rodWidth: number
}
export interface LiftConfig {
  body: PrimitiveConfig
  amplitude: number
  angularSpeed: number
  phase: number
  visual?: string
}
export interface TurntableConfig {
  position: Position
  parts: PrimitiveConfig[]
  angularSpeed: number
  phase: number
  visual?: string
}

export interface LevelConfig {
  id: string
  rulesVersion?: RulesVersion
  // 当前轨道 GLB 是整关模型。布局变更尚未配套模型时，使用 null 显示基础几何体。
  visuals: TrackVisualsConfig | null
  staticObjects: PrimitiveConfig[]
  start: { position: Position; previewPosition: Position; ring: RingConfig }
  checkpoints: { position: Position; ring: RingConfig }[]
  checkpointTrigger: { radius: number; heightTolerance: number }
  finish: { position: Position; radius: number; heightTolerance: number; ring: RingConfig }
  fallY: number
  pendulum?: {
    visuals?: HammerVisualsConfig | null
    ball: PrimitiveConfig
    rod: PrimitiveConfig
    anchor: Position
    angularSpeed: number
    amplitude: number
    lift: number
    rodWidth: number
  }
  hammers?: ArcHammerConfig[]
  lifts?: LiftConfig[]
  turntable?: TurntableConfig
  platform: {
    axis?: 'x' | 'z'
    centerX?: number
    body: PrimitiveConfig
    stripe: PrimitiveConfig
    centerZ: number
    angularSpeed: number
    amplitude: number
    stripeY: number
  }
  // 第 n 段对应已通过 n 个检查点；沿 Z 轴估算进度，保留当前赛道的计算方式。
  progress: { axis?: 'x' | 'z'; origin?: number; originZ: number; direction: number; divisor: number; base: number; max: number }[]
}
