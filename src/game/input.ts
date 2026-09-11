export interface GameInput { x: number; z: number; brake: boolean }
export const emptyInput = (): GameInput => ({ x: 0, z: 0, brake: false })

export function joystickVector(dx: number, dz: number, radius: number, deadZone = .12) {
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(radius) || radius <= 0) return { x: 0, z: 0 }
  const length = Math.hypot(dx, dz), normalized = Math.min(1, length / radius)
  if (normalized <= deadZone) return { x: 0, z: 0 }
  const magnitude = (normalized - deadZone) / (1 - deadZone)
  return { x: dx / length * magnitude, z: dz / length * magnitude }
}

export function resolveInput(keys: ReadonlySet<string>, touch?: GameInput): GameInput {
  let x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
  let z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'))
  const keyboardLength = Math.hypot(x, z)
  if (keyboardLength) { x /= keyboardLength; z /= keyboardLength }
  else {
    x = Number.isFinite(touch?.x) ? touch!.x : 0; z = Number.isFinite(touch?.z) ? touch!.z : 0
    const length = Math.max(1, Math.hypot(x, z)); x /= length; z /= length
  }
  return { x, z, brake: keys.has('Space') || touch?.brake === true }
}

export function createTouchInput(change: (input: GameInput) => void) {
  let joystickPointer: number | null = null, brakePointer: number | null = null
  let input = emptyInput()
  const publish = () => change({ ...input })
  return {
    get joystickPointer() { return joystickPointer },
    get brakePointer() { return brakePointer },
    startJoystick(id: number, dx: number, dz: number, radius: number) {
      if (joystickPointer !== null || brakePointer === id) return false
      joystickPointer = id; Object.assign(input, joystickVector(dx, dz, radius)); publish(); return true
    },
    moveJoystick(id: number, dx: number, dz: number, radius: number) {
      if (joystickPointer !== id) return
      Object.assign(input, joystickVector(dx, dz, radius)); publish()
    },
    startBrake(id: number) {
      if (brakePointer !== null || joystickPointer === id) return false
      brakePointer = id; input.brake = true; publish(); return true
    },
    release(id: number) {
      let changed = false
      if (joystickPointer === id) { joystickPointer = null; input.x = 0; input.z = 0; changed = true }
      if (brakePointer === id) { brakePointer = null; input.brake = false; changed = true }
      if (changed) publish()
    },
    reset() { joystickPointer = null; brakePointer = null; input = emptyInput(); publish() },
  }
}
