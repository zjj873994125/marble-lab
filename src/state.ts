import { computed, reactive, watch } from 'vue'
import level from './levels/initial-gravity'
import type { RulesVersion } from './game/level-types'
export type Quality = 'low' | 'high'
export type Phase = 'menu' | 'playing' | 'paused' | 'finished'
export interface Settings { quality: Quality; volume: number; sensitivity: number; reducedMotion: boolean }
export interface Run { time: number; falls: number; date: string }
export const defaults: Settings = { quality: 'high', volume: 45, sensitivity: 1, reducedMotion: false }
const key = 'marble-lab-v2'
export const rulesVersion: RulesVersion = level.rulesVersion ?? 'classic'
const versionLabels: Record<string, string> = { classic: '初版', 'open-hammer': '圆头锤版', 'flat-hammer': '平端锤版' }
interface Saved { schemaVersion?: number; settings?: Partial<Settings>; runs?: Run[]; runsByVersion?: Record<string, Run[]> }
function readSaved(storageKey: string): Saved {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
  catch { return {} }
}
const saved = readSaved(key)
const hasV2 = saved.schemaVersion === 2 && saved.runsByVersion && typeof saved.runsByVersion === 'object' && !Array.isArray(saved.runsByVersion)
// v1 永远只读；原始记录与设置仍可恢复，重复加载只选择一份来源。
const source = hasV2 ? saved : readSaved('marble-lab-v1')
const s = source.settings || {}
const buckets: Record<string, unknown> = hasV2 ? source.runsByVersion! : { classic: source.runs, 'open-hammer': [] }
const validRuns = (value: unknown): Run[] => Array.isArray(value) ? value.filter(r => r && typeof r.time === 'number' && r.time > 0 && Number.isFinite(r.time) && Number.isInteger(r.falls) && r.falls >= 0 && typeof r.date === 'string').sort((a,b) => a.time - b.time).slice(0, 20) : []
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
export const state = reactive({
  settings: { quality: s.quality === 'low' ? 'low' : 'high', volume: number(s.volume, 45, 0, 100), sensitivity: number(s.sensitivity, 1, .5, 1.5), reducedMotion: s.reducedMotion === true } as Settings,
  runs: validRuns(buckets[rulesVersion]),
  archivedByVersion: Object.fromEntries(Object.entries(buckets).filter(([version]) => version !== rulesVersion).map(([version, runs]) => [version, validRuns(runs)])) as Record<string, Run[]>,
  phase: 'menu' as Phase, ready: false, error: '', settingsOpen: false, helpOpen: false,
  elapsed: 0, falls: 0, checkpoint: 0, progress: 0, storageWarning: false, runId: 0,
})
export const archivedGroups = computed(() => Object.entries(state.archivedByVersion).filter(([, runs]) => runs.length).map(([version, runs]) => ({ version, label: versionLabels[version] ?? version, runs })))
watch(() => [state.settings, state.runs, state.archivedByVersion], () => {
  try { localStorage.setItem(key, JSON.stringify({ schemaVersion: 2, settings: state.settings, runsByVersion: { ...state.archivedByVersion, [rulesVersion]: state.runs } })); state.storageWarning = false }
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
