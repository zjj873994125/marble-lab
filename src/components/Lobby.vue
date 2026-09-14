<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ArrowRight, Aim, Trophy, Timer, Check } from '@element-plus/icons-vue'
import { state, startRun, formatTime, activeLevel, selectLevel, homeActionLabel, retrySceneLoad } from '../state'
import { levelCatalog } from '../game/levels'
import LevelThumbnail from './LevelThumbnail.vue'
const route = useRoute()
const router = useRouter()
const pickerOpen = ref(false)
const pickerButton = ref<{ $el: HTMLButtonElement }>()
const draftLevelId = ref(state.levelId)
const pendingTarget = ref<string|null>(null)
const pickerError = ref('')
let originalLevelId = state.levelId
let selectionApplied = false
let disposed = false
function openPicker() {
  if (disposed || pickerOpen.value || state.phase !== 'menu') return
  originalLevelId = state.levelId; draftLevelId.value = state.levelId
  selectionApplied = false; pickerError.value = ''; pickerOpen.value = true
}
function cancelPicker() {
  const restoreSelection = selectionApplied
  selectionApplied = false
  pendingTarget.value = null; pickerOpen.value = false; pickerError.value = ''
  if (restoreSelection && state.phase === 'menu') selectLevel(originalLevelId)
}
function enterWhenReady() {
  const target = pendingTarget.value
  if (!target) return
  if (disposed || !pickerOpen.value || route.path !== '/' || state.phase !== 'menu') { cancelPicker(); return }
  if (state.levelId !== target) return
  if (state.error) { pickerError.value = state.error; pendingTarget.value = null; return }
  if (!state.ready) return
  // 先消费起局请求，避免状态变化或组件卸载再次启动/回滚选择。
  pendingTarget.value = null; selectionApplied = false; pickerOpen.value = false
  startRun()
}
function confirmLevel() {
  if (pendingTarget.value || state.phase !== 'menu' || !levelCatalog.some(entry => entry.config.id === draftLevelId.value)) return
  const retry = state.levelId === draftLevelId.value && !!state.error
  pickerError.value = ''; pendingTarget.value = draftLevelId.value; selectionApplied = true
  selectLevel(draftLevelId.value)
  if (retry) retrySceneLoad()
  enterWhenReady()
}
watch(() => [state.ready, state.error, state.levelId, state.phase], enterWhenReady, { flush: 'post' })
watch(draftLevelId, () => { pickerError.value = '' })
watch(pickerOpen, value => { if (!value && (pendingTarget.value || selectionApplied)) cancelPicker() }, { flush: 'sync' })
onBeforeRouteLeave(() => { cancelPicker() })
onBeforeUnmount(() => { disposed = true; cancelPicker() })
watch(() => route.query.choose, value => {
  if (value !== '1') return
  void nextTick(() => { if (!disposed && route.path === '/') openPicker() })
  const { choose, ...query } = route.query
  void router.replace({ path: '/', query })
}, { immediate: true })
function restorePickerFocus() { if (!disposed && state.phase === 'menu') pickerButton.value?.$el.focus() }
function begin() { if (!pendingTarget.value) startRun() }
</script>
<template>
  <section class="lobby lobby-home">
    <div class="lobby-copy">
      <h1>小小弹珠，<br/>大有<span>挑战。</span></h1>
      <p class="intro">滚过弯道，越过机关。<br/>在失衡与掌控之间，找到你的最佳路线。</p>
      <div class="course-facts"><span><el-icon><Timer/></el-icon>短局挑战</span><span><el-icon><Aim/></el-icon>物理滚动</span><span><el-icon><Trophy/></el-icon>刷新纪录</span></div>
    </div>
    <div class="home-action-group">
      <div class="home-play-actions">
        <el-button class="start-button" type="primary" :disabled="!state.ready || !!state.error" :aria-label="`${homeActionLabel}：${activeLevel.title}`" @click="begin">{{ state.ready ? homeActionLabel : '准备场景中' }}<el-icon><ArrowRight/></el-icon></el-button>
        <el-button ref="pickerButton" class="choose-level-button" aria-haspopup="dialog" :aria-expanded="pickerOpen" @click="openPicker">选择关卡<el-icon><ArrowRight/></el-icon></el-button>
      </div>
      <div class="best-line">个人最佳 <strong>{{ state.runs.length ? formatTime(state.runs[0]!.time) : '等待你的第一次完赛' }}</strong></div>
    </div>
    <el-dialog v-model="pickerOpen" title="选择关卡" width="660px" align-center class="home-level-dialog" :close-on-click-modal="false" @closed="restorePickerFocus">
      <div class="home-level-options" aria-label="选择关卡" :aria-busy="pendingTarget !== null"><button v-for="entry in levelCatalog" :key="entry.config.id" type="button" :disabled="pendingTarget !== null" :aria-label="`选择${entry.title}`" :aria-pressed="entry.config.id === draftLevelId" @click="draftLevelId=entry.config.id"><LevelThumbnail :level="entry.config"/><span class="home-level-card-name">{{ entry.title }}<el-icon v-if="entry.config.id === draftLevelId"><Check/></el-icon></span></button></div>
      <p v-if="pickerError" class="home-level-error" role="alert">{{ pickerError }}</p>
      <template #footer><el-button @click="cancelPicker">取消</el-button><el-button type="primary" :loading="pendingTarget !== null" :disabled="pendingTarget !== null" @click="confirmLevel">{{ pendingTarget ? '正在进入' : pickerError ? '重试并进入' : '确认' }}</el-button></template>
    </el-dialog>
    <div class="current-level-caption"><span>当前关卡</span><h2>{{ activeLevel.title }}</h2></div>
  </section>
</template>

<style scoped lang="less">
.current-level-caption { position:absolute; right:0; bottom:36px; max-width:44%; text-align:right; color:#faf3dc; pointer-events:none; text-shadow:0 2px 8px #163d4380, 0 1px 2px #163d43a6; >span { display:block; font-size:11px; letter-spacing:.24em; opacity:.8; } h2 { margin:10px -.12em 0 0; font-family:'Songti SC','STSong','Noto Serif CJK SC','SimSun',serif; font-size:clamp(28px,3vw,42px); font-weight:500; line-height:1.4; letter-spacing:.12em; overflow-wrap:anywhere; } }
.home-action-group { width:320px; max-width:calc(56% - 24px); margin-top:auto; flex-shrink:0; pointer-events:auto; .best-line { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; line-height:1.5; strong { margin-left:0; } } }
.home-play-actions { display:flex; flex-direction:column; gap:16px; width:100%; .el-button { width:100%; height:72px; min-height:72px; margin:0; border-radius:12px; font-size:20px; padding-inline:24px; :deep(> span) { display:flex; width:100%; align-items:center; justify-content:space-between; padding:0 7px; } } }
.choose-level-button.el-button { padding:0 16px; background:#faf9f2bf; border-color:#d9e0d2; color:#62705c; }
.home-level-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; button { display:flex; flex-direction:column; min-width:0; padding:8px; border:2px solid #e1e6da; border-radius:14px; background:#fafbf5; color:#5c7058; font-size:14px; text-align:left; cursor:pointer; &[aria-pressed='true'] { background:#f5f0e5; color:#bd713d; border-color:#e08a52; } &:hover:not(:disabled):not([aria-pressed='true']) { border-color:#bcba9d; } &:focus-visible { outline:2px solid #59784f; outline-offset:3px; } &:disabled { cursor:wait; opacity:.65; } } }
.home-level-card-name { display:flex; align-items:center; justify-content:space-between; width:100%; min-height:48px; padding:8px 6px 0; .el-icon { flex-shrink:0; margin-left:8px; } }
.home-level-error { margin:14px 0 0; color:#ad593c; font-size:12px; line-height:1.7; }
@media(min-width:681px) and (max-height:700px) { .home-play-actions { gap:14px; .el-button { height:60px; min-height:60px; font-size:18px; } } .home-action-group .best-line { margin-top:12px; } }
@media(max-width:680px) { .home-action-group { width:280px; max-width:100%; margin-top:0; } .home-play-actions { gap:12px; .el-button { height:56px; min-height:56px; font-size:17px; padding-inline:16px; } } }
@media(max-width:680px) { .current-level-caption { right:0; bottom:58px; max-width:80%; h2 { font-size:28px; margin-top:6px; } >span { font-size:10px; } } }
@media(max-width:480px) { .home-level-options { grid-template-columns:1fr; gap:12px; } }
</style>
<style lang="less">
.home-level-dialog.el-dialog { max-width:calc(100vw - 28px); max-height:calc(100dvh - 32px); overflow-y:auto; border-radius:18px; background:#fafbf4; pointer-events:auto; .el-dialog__footer { display:flex; justify-content:flex-end; gap:10px; .el-button { min-height:44px; min-width:88px; } } }
</style>
