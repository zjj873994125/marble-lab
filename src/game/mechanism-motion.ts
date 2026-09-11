import type { ArcHammerConfig, LiftConfig, Position, TurntableConfig } from './level-types'

export function arcHammerPose(config: ArcHammerConfig, time: number) {
  const angle = config.maxAngle * Math.sin(time * config.angularSpeed + config.phase)
  const [x, y, z] = config.anchor
  const head: Position = [x, y - config.rodLength * Math.cos(angle), z + config.rodLength * Math.sin(angle)]
  const rod: Position = [x, (y + head[1]) / 2, (z + head[2]) / 2]
  return { head, rod, rotation: [-angle * 180 / Math.PI, 0, 0] as Position }
}

export function liftPosition(config: LiftConfig, time: number): Position {
  return [config.body.position[0], config.body.position[1] + config.amplitude * Math.sin(time * config.angularSpeed + config.phase), config.body.position[2]]
}

export function turntablePose(config: TurntableConfig, time: number) {
  const angle = config.phase + config.angularSpeed * time
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return {
    rotation: [0, angle * 180 / Math.PI, 0] as Position,
    parts: config.parts.map(part => {
      const [x, y, z] = part.position
      return [config.position[0] + x * cos + z * sin, config.position[1] + y, config.position[2] - x * sin + z * cos] as Position
    }),
  }
}
