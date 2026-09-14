import { computed, reactive, watch } from 'vue'
import { levelCatalog } from './game/levels'
import type { RulesVersion } from './game/level-types'
export type Quality = 'low' | 'high'
export type CleanMode = 'auto' | 'on' | 'off'
export type Phase = 'menu' | 'playing' | 'paused' | 'finished'
export interface Settings { quality: Quality; volume: number; sensitivity: number; reducedMotion: boolean; waterSpeed: number; cleanMode: CleanMode }
export interface Run { time: number; falls: number; date: string }
export const defaults: Settings = { quality: 'high', volume: 45, sensitivity: 1, reducedMotion: false, waterSpeed: 1, cleanMode: 'auto' }
const key = 'marble-lab-v3'
const firstLevel = levelCatalog[0]!
const versionLabels: Record<string, string> = { classic: '初版', 'open-hammer': '圆头锤版', 'flat-hammer': '平端锤版', standard: '初始难度', challenge: '挑战难度', serpentine: '蛇形挑战', intense: '极限挑战', 'intense-v2': '极限挑战Ⅱ' }
interface Saved { schemaVersion?: number; settings?: Partial<Settings>; runs?: Run[]; runsByVersion?: Record<string, Run[]>; runsByLevel?: Record<string, Record<string, Run[]>>; selectedLevelId?: string; lastStartedLevelId?: string | null; hasPlayedBeyondFirst?: boolean }
function readSaved(storageKey: string): Saved {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
  catch { return {} }
}
const saved = readSaved(key)
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const hasV3 = saved.schemaVersion === 3 && isObject(saved.runsByLevel)
const previous = readSaved('marble-lab-v2')
const hasV2 = previous.schemaVersion === 2 && isObject(previous.runsByVersion)
// v1/v2 原文均只读保留；只迁移一份来源，重复加载不重新合并旧成绩。
const source = hasV3 ? saved : hasV2 ? previous : readSaved('marble-lab-v1')
const s = source.settings || {}
const originalBuckets = hasV3 ? source.runsByLevel! : { [firstLevel.config.id]: hasV2 ? source.runsByVersion! : { classic: source.runs } }
const validRuns = (value: unknown): Run[] => Array.isArray(value) ? value.filter(r => r && typeof r.time === 'number' && r.time > 0 && Number.isFinite(r.time) && Number.isInteger(r.falls) && r.falls >= 0 && typeof r.date === 'string').sort((a,b) => a.time - b.time).slice(0, 20) : []
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
const allBuckets: Record<string, Record<string, Run[]>> = Object.fromEntries(Object.entries(originalBuckets).filter(([, value]) => isObject(value)).map(([id, versions]) => [id, Object.fromEntries(Object.entries(versions).map(([version, runs]) => [version, validRuns(runs)]))]))
const completedLevels = levelCatalog.filter(entry => Object.values(allBuckets[entry.config.id] ?? {}).some(runs => runs.length > 0))
// 旧版选中项只在有成绩证据时用于迁移，单纯预览不等于已经玩过。
const latestCompleted = [...completedLevels].sort((a,b) => {
  const latest = (id: string) => Math.max(0,...Object.values(allBuckets[id] ?? {}).flat().map(run => Date.parse(run.date) || 0))
  return latest(b.config.id) - latest(a.config.id)
})[0]
const legacyStarted = completedLevels.find(entry => entry.config.id === source.selectedLevelId) ?? latestCompleted
const savedStarted = typeof source.lastStartedLevelId === 'string' ? levelCatalog.find(entry => entry.config.id === source.lastStartedLevelId) ?? firstLevel : undefined
const lastStarted = savedStarted ?? legacyStarted
const initialLevel = lastStarted ?? firstLevel
const hasPlayedBeyondFirst = source.hasPlayedBeyondFirst === true || completedLevels.some(entry => entry !== firstLevel) || (savedStarted !== undefined && savedStarted !== firstLevel)
function bucketsFor(id: string, version: string) {
  const buckets = allBuckets[id] ?? {}
  return { runs: validRuns(buckets[version]), archivedByVersion: Object.fromEntries(Object.entries(buckets).filter(([key]) => key !== version)) }
}
export const state = reactive({
  settings: { quality: s.quality === 'low' ? 'low' : 'high', volume: number(s.volume, 45, 0, 100), sensitivity: number(s.sensitivity, 1, .5, 1.5), reducedMotion: s.reducedMotion === true, waterSpeed: number(s.waterSpeed, defaults.waterSpeed, 0, 10), cleanMode: s.cleanMode === 'on' || s.cleanMode === 'off' ? s.cleanMode : defaults.cleanMode } as Settings,
  levelId: initialLevel.config.id,
  lastStartedLevelId: lastStarted?.config.id ?? null,
  hasPlayedBeyondFirst,
  ...bucketsFor(initialLevel.config.id, initialLevel.config.rulesVersion ?? 'classic'),
  phase: 'menu' as Phase, ready: false, error: '', settingsOpen: false, helpOpen: false,
  elapsed: 0, falls: 0, checkpoint: 0, progress: 0, storageWarning: false, runId: 0, sceneLoadId: 0,
})
export const activeLevel = computed(() => levelCatalog.find(entry => entry.config.id === state.levelId) ?? firstLevel)
export const homeActionLabel = computed(() => state.hasPlayedBeyondFirst && state.levelId === state.lastStartedLevelId ? '继续挑战' : '开始挑战')
export const rulesVersion = computed<RulesVersion>(() => activeLevel.value.config.rulesVersion ?? 'classic')
export const archivedGroups = computed(() => Object.entries(state.archivedByVersion).filter(([, runs]) => runs.length).map(([version, runs]) => ({ version, label: versionLabels[version] ?? version, runs })))
function retainCurrentRuns() {
  allBuckets[state.levelId] = { ...state.archivedByVersion, [rulesVersion.value]: state.runs }
}
watch(() => [state.settings, state.runs, state.archivedByVersion, state.levelId, state.lastStartedLevelId, state.hasPlayedBeyondFirst], () => {
  retainCurrentRuns()
  try { localStorage.setItem(key, JSON.stringify({ schemaVersion: 3, settings: state.settings, selectedLevelId: state.levelId, lastStartedLevelId: state.lastStartedLevelId, hasPlayedBeyondFirst: state.hasPlayedBeyondFirst, runsByLevel: allBuckets })); state.storageWarning = false }
  catch { state.storageWarning = true }
}, { deep: true })
export function selectLevel(id: string) {
  const entry = levelCatalog.find(candidate => candidate.config.id === id)
  if (!entry || id === state.levelId || state.phase !== 'menu') return
  retainCurrentRuns()
  state.levelId = id
  Object.assign(state, bucketsFor(id, entry.config.rulesVersion ?? 'classic'))
  state.ready = false; state.error = ''; state.elapsed = 0; state.falls = 0; state.checkpoint = 0; state.progress = 0
}
export function retrySceneLoad() {
  if (state.phase !== 'menu') return
  state.ready = false; state.error = ''; state.sceneLoadId++
}
export function startRun() {
  const levelIndex = levelCatalog.findIndex(entry => entry.config.id === state.levelId)
  if (!state.ready || state.error || levelIndex < 0) return
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  state.lastStartedLevelId = state.levelId
  if (levelIndex > 0) state.hasPlayedBeyondFirst = true
  state.elapsed = 0; state.falls = 0; state.checkpoint = 0; state.progress = 0; state.runId++; state.phase = 'playing'
}
export function finishRun() {
  if (state.phase !== 'playing') return
  state.phase = 'finished'
  state.runs = [...state.runs, { time: state.elapsed, falls: state.falls, date: new Date().toISOString() }].sort((a,b) => a.time - b.time).slice(0, 20)
}
export function formatTime(seconds: number) { const centis = Math.floor(seconds * 100); return `${String(Math.floor(centis / 6000)).padStart(2, '0')}:${String(Math.floor(centis / 100) % 60).padStart(2, '0')}.${String(centis % 100).padStart(2, '0')}` }
export function medal(time: number) { const targets = activeLevel.value.medals; return targets ? time <= targets[0] ? '金牌' : time <= targets[1] ? '银牌' : time <= targets[2] ? '铜牌' : '完赛' : '完赛' }
