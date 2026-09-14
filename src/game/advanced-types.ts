import type { Position, PrimitiveConfig } from './level-types'

export type AdvancedKind = 'spring-trampoline' | 'gravity-coaster' | 'pulse-jet' | 'orbital-catcher' | 'reversing-conveyor' | 'vortex-funnel' | 'gimbal-platform' | 'cascade-bridge'

interface AdvancedPlacement {
  id:string
  kind:AdvancedKind
  position:Position
  yaw?:number
  phaseSeconds?:number
  visual?:boolean
}

export interface JetNozzleConfig {
  position:Position
  axis:Position
  force:number
  axialRange:[number,number]
  coreRadius:number
  outerRadius:number
  stages?:[number,number,number,number]
}

export type AdvancedMechanismConfig = AdvancedPlacement & (
  {kind:'spring-trampoline';deck:PrimitiveConfig;coreRadius:number;outerRadius:number;storedEnergyJ:number;poweredNormalSpeedCeiling:number;rearmSeparationAboveSurface:number;minimumRearmSeconds:number} |
  {kind:'gravity-coaster';colliders:PrimitiveConfig[]} |
  {kind:'pulse-jet';nozzles:JetNozzleConfig[];staticColliders?:PrimitiveConfig[]} |
  {kind:'orbital-catcher';parts:PrimitiveConfig[];orbitAmplitude:Position;period:number;brakingSeconds:number;settleHoldSeconds:number;dockAngleDegrees:number;dockHoldSeconds:number} |
  {kind:'reversing-conveyor';deck:PrimitiveConfig;axis:Position;targetTreadSpeed:number;tractionForce:number;holdEachDirectionSeconds:number;reverseDecelSeconds:number;zeroHoldSeconds:number;reverseAccelSeconds:number} |
  {kind:'vortex-funnel';colliders:PrimitiveConfig[]} |
  {kind:'gimbal-platform';outerFrame:PrimitiveConfig;innerDeck:PrimitiveConfig;outerPivot:Position;innerPivot:Position;limitsDegrees:[number,number];restAnglesDegrees:[number,number];innerMass:number;outerFrameMass:number;springEach:number;dampingEach:number} |
  {kind:'cascade-bridge';tiles:PrimitiveConfig[];tileMass:number;firstReleaseDelay:number;releaseInterval:number;visibleWarningBeforeEachRelease:number;minimumContactDwell:number}
)

export interface AdvancedLibraryPart {
  nodePath:string
  role:string
  motion:'fixed'|'kinematic'|'dynamic'|'indicator'
  pivot?:Position
  axis?:Position
  referenceSize?:Position
}
export interface AdvancedLibraryEntry {
  id:AdvancedKind
  rootNode:string
  rootBounds:{min:Position;max:Position}
  parts:AdvancedLibraryPart[]
}
export interface AdvancedLibraryManifest {
  schemaVersion:number
  asset:string
  units:'m'
  upAxis:'+Y'
  entries:AdvancedLibraryEntry[]
}
