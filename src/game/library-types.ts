import type { Position, PrimitiveConfig } from './level-types'

export type LibraryKind = 'weight-seesaw' | 'axial-roller' | 'piston-wall' | 'timed-trapdoor' | 'sway-cradle-bridge'
interface Placement {
  id: string
  kind: LibraryKind
  position: Position
  yaw?: number
  phaseSeconds?: number
  visual?: boolean
  // 库根坐标下可接触的固定结构；只由关卡明确提供，不把GLB包围盒自动做碰撞。
  staticColliders?: PrimitiveConfig[]
}
export type LibraryMechanismConfig = Placement & (
  { kind: 'weight-seesaw'; mass?: number; restAngle?: number; limitAngle?: number; spring?: number; damping?: number } |
  { kind: 'axial-roller'; angularSpeed?: number } |
  { kind: 'piston-wall'; travel?: number; stages?: [number,number,number,number,number] } |
  { kind: 'timed-trapdoor'; openAngle?: number; stages?: [number,number,number,number]; warningSeconds?: number } |
  { kind: 'sway-cradle-bridge'; amplitude?: number; period?: number; frameColliders?: PrimitiveConfig[] }
)

export interface LibraryPart {
  nodePath: string
  role: string
  position: Position
  rotationDegrees: Position
  scale: Position
  axis?: Position
  bodySize?: Position
  bodyCenterOffset?: Position
  referenceLength?: number
  extensionAxis?: Position
  collisionRadius?: number
}
export interface LibraryEntry {
  id: LibraryKind
  rootNode: string
  rootBounds: { min: Position; max: Position }
  parts: LibraryPart[]
}
export interface LibraryManifest { schemaVersion:number; asset:string; units:string; entries:LibraryEntry[] }
