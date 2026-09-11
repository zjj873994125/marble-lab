import { reactive, watch } from 'vue'
export type Quality = 'low' | 'high'
export type Phase = 'menu' | 'playing' | 'paused' | 'finished'
export interface Settings { quality: Quality; volume: number; sensitivity: number; reducedMotion: boolean }
export interface Run { time: number; falls: number; date: string }
export const defaults: Settings = { quality: 'high', volume: 45, sensitivity: 1, reducedMotion: false }
const key = 'marble-lab-v1'
let saved: { settings?: Partial<Settings>; runs?: Run[] } = {}
try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {} } catch { /* 损坏的本地记录不阻塞启动。 */ }
const s = saved.settings || {}
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
export const state = reactive({
  settings: { quality: s.quality === 'low' ? 'low' : 'high', volume: number(s.volume, 45, 0, 100), sensitivity: number(s.sensitivity, 1, .5, 1.5), reducedMotion: s.reducedMotion === true } as Settings,
  runs: (Array.isArray(saved.runs) ? saved.runs.filter(r => r && typeof r.time === 'number' && r.time > 0 && Number.isFinite(r.time) && Number.isInteger(r.falls) && r.falls >= 0 && typeof r.date === 'string').slice(0, 20) : []) as Run[],
  phase: 'menu' as Phase, ready: false, error: '', settingsOpen: false, helpOpen: false,
  elapsed: 0, falls: 0, checkpoint: 0, progress: 0, storageWarning: false, runId: 0,
})
watch(() => [state.settings, state.runs], () => {
  try { localStorage.setItem(key, JSON.stringify({ settings: state.settings, runs: state.runs })); state.storageWarning = false }
  catch { state.storageWarning = true }
}, { deep: true })
export function startRun() { if (!state.ready) return; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); state.elapsed = 0; state.falls = 0; state.checkpoint = 0; state.progress = 0; state.runId++; state.phase = 'playing' }
export function finishRun() {
  if (state.phase !== 'playing') return
  state.phase = 'finished'
  state.runs = [...state.runs, { time: state.elapsed, falls: state.falls, date: new Date().toISOString() }].sort((a,b) => a.time - b.time).slice(0, 20)
}
export function formatTime(seconds: number) { const centis = Math.floor(seconds * 100); return `${String(Math.floor(centis / 6000)).padStart(2, '0')}:${String(Math.floor(centis / 100) % 60).padStart(2, '0')}.${String(centis % 100).padStart(2, '0')}` }
export function medal(time: number) { return time <= 35 ? '金牌' : time <= 55 ? '银牌' : time <= 90 ? '铜牌' : '完赛' }
