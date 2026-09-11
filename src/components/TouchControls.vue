<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { createTouchInput, emptyInput, type GameInput } from '../game/input'
const props = defineProps<{ resetKey: string }>()
const emit = defineEmits<{ change: [input: GameInput] }>()
const stick = ref<HTMLButtonElement>(), brake = ref<HTMLButtonElement>()
const value = reactive(emptyInput()), active = ref(false)
const travel = 40
const controls = createTouchInput(input => { Object.assign(value, input); active.value = controls.joystickPointer !== null; emit('change', input) })
function offset(event: PointerEvent) {
  const rect = stick.value!.getBoundingClientRect()
  return [event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2] as const
}
function stickDown(event: PointerEvent) {
  const [x,z] = offset(event)
  if (controls.startJoystick(event.pointerId, x, z, travel)) stick.value!.setPointerCapture(event.pointerId)
}
function stickMove(event: PointerEvent) { const [x,z] = offset(event); controls.moveJoystick(event.pointerId, x, z, travel) }
function brakeDown(event: PointerEvent) { if (controls.startBrake(event.pointerId)) brake.value!.setPointerCapture(event.pointerId) }
function release(event: PointerEvent) {
  controls.release(event.pointerId)
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
}
function reset() {
  const pointers = [controls.joystickPointer, controls.brakePointer]
  controls.reset()
  for (const target of [stick.value, brake.value]) for (const id of pointers) if (id !== null && target?.hasPointerCapture(id)) target.releasePointerCapture(id)
}
function hidden() { if (document.hidden) reset() }
watch(() => props.resetKey, reset, { flush: 'sync' })
onMounted(() => { window.addEventListener('blur', reset); window.addEventListener('orientationchange', reset); document.addEventListener('visibilitychange', hidden) })
onBeforeUnmount(() => { reset(); window.removeEventListener('blur', reset); window.removeEventListener('orientationchange', reset); document.removeEventListener('visibilitychange', hidden) })
</script>

<template>
  <div class="touch-controls">
    <button ref="stick" type="button" class="touch-stick" :class="{ active }" aria-label="移动摇杆"
      @pointerdown.prevent="stickDown" @pointermove.prevent="stickMove" @pointerup="release" @pointercancel="release" @lostpointercapture="release" @contextmenu.prevent>
      <span class="stick-axis" aria-hidden="true"/><span class="stick-knob" aria-hidden="true" :style="{ transform: `translate(${value.x * travel}px, ${value.z * travel}px)` }"/>
    </button>
    <button ref="brake" type="button" class="touch-brake" :aria-pressed="value.brake" aria-label="按住刹车"
      @pointerdown.prevent="brakeDown" @pointerup="release" @pointercancel="release" @lostpointercapture="release" @contextmenu.prevent>
      <svg class="brake-pedal" viewBox="0 0 64 68" aria-hidden="true"><path class="pedal-stem" d="M31 49 35 62h13"/><g class="pedal-face"><path d="M15 11 47 7Q52 7 53 13L57 42Q58 48 52 49L20 54Q14 55 13 49L9 20Q8 13 15 11Z"/><g class="pedal-grip"><circle cx="20" cy="22" r="3"/><circle cx="33" cy="20" r="3"/><circle cx="46" cy="18" r="3"/><circle cx="22" cy="35" r="3"/><circle cx="35" cy="33" r="3"/><circle cx="48" cy="31" r="3"/><path d="m26 46 20-3"/></g></g></svg><span class="brake-label">刹车</span>
    </button>
  </div>
</template>

<style scoped lang="less">
.touch-controls { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
.touch-stick, .touch-brake { position: absolute; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; padding: 0; color: #40534a; border: 1px solid #dbe3d4b3; box-shadow: 0 4px 18px #123e3d26; &:focus-visible { outline: 3px solid #e77442; outline-offset: 4px; } }
.touch-stick { left: max(20px, calc(env(safe-area-inset-left) + 12px)); bottom: max(16px, calc(env(safe-area-inset-bottom) + 8px)); width: 128px; height: 128px; border-radius: 50%; background: #faf9f24d; }
.stick-axis { position: absolute; inset: 18px; border: 1px solid #edf0e878; border-radius: 50%; &:before, &:after { content: ''; position: absolute; background: #e5eadc85; } &:before { top: 50%; left: 0; width: 100%; height: 1px; } &:after { left: 50%; top: 0; height: 100%; width: 1px; } }
.stick-knob { position: absolute; left: 39px; top: 39px; width: 48px; height: 48px; border-radius: 50%; background: #fbfaf1eb; border: 1px solid #ffffffb3; box-shadow: 0 3px 10px #123e3d33; }
.active .stick-knob { background: #f7b38c; }
.touch-brake { right: max(24px, calc(env(safe-area-inset-right) + 12px)); bottom: max(24px, calc(env(safe-area-inset-bottom) + 12px)); width: 96px; height: 96px; border-radius: 24px; background: #163e443d; border-color: #f4f6e887; color: #f6f6e8; box-shadow: inset 0 0 0 3px #fcfcef0d, 0 4px 18px #123e3d26; font: inherit; &[aria-pressed='true'] { background: #5f493d66; border-color: #ffb276; box-shadow: inset 0 0 0 2px #f28b5759, 0 0 16px #ee914c33; .pedal-face { transform: translateY(3px); >path { fill: #f1a679bd; stroke: #ffe0b9; } } .brake-label { color: #ffd4a9; } } }
.brake-pedal { position: absolute; width: 60px; height: 64px; left: 17px; top: 8px; overflow: visible; }
.pedal-stem { fill: none; stroke: #f4f4eac9; stroke-width: 3; stroke-linecap: round; }
.pedal-face { >path { fill: #f4f3e547; stroke: #fafbeaeb; stroke-width: 2; } }
.pedal-grip { fill: #173d43d6; stroke: #173d43d6; stroke-width: 2; stroke-linecap: round; }
.brake-label { position: absolute; bottom: 7px; left: 0; right: 0; font-size: 10px; letter-spacing: 2px; color: #f4f5e8d9; }
</style>
