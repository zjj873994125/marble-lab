<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { state, startRun, finishRun, activeLevel } from '../state'
import type { MarbleGame } from '../game/runtime'
import type { GameInput } from '../game/input'
import type { PerformanceSample } from '../game/performance'
const props = defineProps<{ input?: GameInput; performanceEnabled?:boolean }>()
const emit=defineEmits<{performance:[sample:PerformanceSample|null]}>()
const host = ref<HTMLDivElement>()
let game: MarbleGame | undefined
let disposed = false
let loading = false
const controller = new AbortController()
async function load() {
  if (loading || game || !host.value) return
  loading = true
  emit('performance',null)
  const level = activeLevel.value.config
  try {
    const { createGame } = await import('../game/runtime')
    // 配置热更新可能在动态导入期间卸载组件，避免创建脱离页面的引擎。
    if (disposed || !host.value) return
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-label', '重力弹珠 3D 场景')
    host.value.append(canvas)
    const instance = await createGame(canvas, {
      settings: () => state.settings,
      phase: () => state.phase,
      input: () => props.input,
      performanceEnabled: () => props.performanceEnabled===true,
      performance: sample => { if(!disposed&&props.performanceEnabled)emit('performance',sample) },
      tick: (time, falls, checkpoint, progress) => { if (disposed) return; state.elapsed = time; state.falls = falls; state.checkpoint = checkpoint; state.progress = progress },
      finish: () => { if (!disposed) finishRun() },
      pause: () => { if (state.settingsOpen || state.helpOpen) return; if (state.phase === 'playing') state.phase = 'paused'; else if (state.phase === 'paused') state.phase = 'playing' },
      restart: () => { if (!state.settingsOpen && state.phase !== 'menu') startRun() },
    }, level, controller.signal)
    if (disposed) { instance.destroy(); return }
    game = instance; state.ready = true
  } catch (error) {
    if (disposed) return
    emit('performance',null)
    host.value?.replaceChildren()
    state.error = `3D 场景未能启动：${error instanceof Error ? error.message : '请检查浏览器 WebGL 支持'}`
  } finally { loading = false }
}
onMounted(load)
watch(() => state.runId, () => { if (game) { game.start(); game.setPhase(state.phase) } else void load() })
watch(() => state.phase, phase => game?.setPhase(phase))
watch(() => state.settings, () => game?.applySettings(), { deep: true })
watch(() => props.performanceEnabled, () => game?.applySettings())
onBeforeUnmount(() => { disposed = true; emit('performance',null); game?.destroy(); controller.abort(); state.ready = false })
</script>
<template><div ref="host" class="game-canvas"/></template>
