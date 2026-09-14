<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Setting, QuestionFilled, VideoPause, RefreshRight, ArrowRight, Close } from '@element-plus/icons-vue'
import GameCanvas from './components/GameCanvas.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import TouchControls from './components/TouchControls.vue'
import { emptyInput, type GameInput } from './game/input'
import { state, startRun, formatTime, medal, activeLevel, retrySceneLoad } from './state'
import type { PerformanceSample } from './game/performance'
const level = computed(() => activeLevel.value.config)
const hasWater = computed(() => level.value.staticObjects.some(object => object.material === 'water'))
const checkpointLabel = computed(() => level.value.checkpoints.length === 2 ? '两个' : `${level.value.checkpoints.length}个`)
const inGame = computed(() => state.phase !== 'menu')
const route = useRoute()
const inAtlas = computed(() => route.path === '/obstacles' && !inGame.value)
const inShop = computed(() => route.path === '/skins' && !inGame.value)
const inHome = computed(() => route.path === '/' && !inGame.value)
const performanceVisible=computed(()=>state.settings.showPerformance&&(inHome.value||inGame.value)&&!state.error)
const performanceSample=ref<PerformanceSample|null>(null)
watch(performanceVisible,()=>{performanceSample.value=null},{flush:'sync'})
function receivePerformance(sample:PerformanceSample|null){if(performanceVisible.value)performanceSample.value=sample}
function performanceCount(value:number|null|undefined){return value==null?'—':value>=1e8?`${(value/1e8).toFixed(1)}亿`:value>=1e4?`${(value/1e4).toFixed(1)}万`:Math.round(value).toString()}
const performanceText=computed(()=>({fps:performanceSample.value?.fps.toFixed(0)??'—',frameMs:performanceSample.value?.frameMs.toFixed(1)??'—',drawCalls:performanceCount(performanceSample.value?.drawCalls),triangles:performanceCount(performanceSample.value?.triangles)}))
const performanceDetails=computed(()=>`${performanceText.value.fps} FPS · ${performanceText.value.frameMs} ms（平均帧间隔） · 绘制 ${performanceText.value.drawCalls} · 三角面 ${performanceText.value.triangles}`)
const coarsePointer = matchMedia('(pointer: coarse)')
function readViewport() {
  const visual=window.visualViewport
  return { width:innerWidth,height:innerHeight,touch:coarsePointer.matches,availableWidth:Math.min(innerWidth,visual?.width||innerWidth),availableHeight:Math.min(innerHeight,visual?.height||innerHeight),offsetLeft:visual?.offsetLeft??0,offsetTop:visual?.offsetTop??0 }
}
const viewport = reactive(readViewport())
const performancePlacement=computed(()=>({'--performance-view-top':`${viewport.offsetTop}px`,'--performance-view-left':`${viewport.offsetLeft}px`,'--performance-view-right':`${Math.max(0,viewport.width-viewport.offsetLeft-viewport.availableWidth)}px`}))
const cleanHud = computed(() => state.settings.cleanMode === 'on' || (state.settings.cleanMode === 'auto' && (viewport.availableWidth <= 1200 || viewport.availableHeight <= 600)))
const touchInput = reactive(emptyInput())
const touchMode = computed(() => viewport.touch && viewport.width <= 1100)
const portraitBlocked = computed(() => touchMode.value && inGame.value && state.phase !== 'finished' && viewport.height > viewport.width)
const inputResetKey = computed(() => `${state.levelId}/${state.runId}/${state.phase}/${portraitBlocked.value}`)
function setTouchInput(input: GameInput) { Object.assign(touchInput, input) }
function resizeViewport() { Object.assign(viewport,readViewport()) }
watch(inputResetKey, () => setTouchInput(emptyInput()), { flush: 'sync' })
watch(() => [portraitBlocked.value, state.phase], () => { if (portraitBlocked.value && state.phase === 'playing') state.phase = 'paused' }, { flush: 'sync' })
onMounted(() => { resizeViewport(); window.addEventListener('resize', resizeViewport); window.addEventListener('orientationchange', resizeViewport); window.visualViewport?.addEventListener('resize', resizeViewport); window.visualViewport?.addEventListener('scroll', resizeViewport); coarsePointer.addEventListener('change', resizeViewport) })
onBeforeUnmount(() => { setTouchInput(emptyInput()); window.removeEventListener('resize', resizeViewport); window.removeEventListener('orientationchange', resizeViewport); window.visualViewport?.removeEventListener('resize', resizeViewport); window.visualViewport?.removeEventListener('scroll', resizeViewport); coarsePointer.removeEventListener('change', resizeViewport) })
watch(inGame, async () => { await nextTick(); window.scrollTo(0, 0) })
function settings() { if (state.phase === 'playing') state.phase = 'paused'; state.settingsOpen = true }
watch(() => state.settings.reducedMotion, value => document.documentElement.classList.toggle('reduce-motion', value), { immediate: true })
</script>

<template>
  <main class="app-shell" :class="{ 'in-game': inGame, 'water-scene': hasWater, 'touch-layout': touchMode, 'atlas-open': inAtlas, 'skin-shop-open': inShop, 'home-menu': inHome, 'performance-shown': performanceVisible, 'performance-compact': performanceVisible && viewport.availableWidth <= 1200 }">
    <GameCanvas v-if="!inAtlas && !inShop" :key="`${state.levelId}/${state.sceneLoadId}`" :input="touchInput" :performance-enabled="performanceVisible" @performance="receivePerformance" />
    <header v-if="!inGame" class="topbar">
      <RouterLink to="/" class="brand" aria-label="杰哥让你滚首页"><span class="brand-orbit"><i/></span><span>杰哥让你滚<small v-if="!inHome && !inShop">MARBLE LAB</small></span></RouterLink>
      <nav aria-label="主导航"><RouterLink to="/" exact-active-class="active">开始</RouterLink><RouterLink to="/obstacles" exact-active-class="active">障碍图鉴</RouterLink><RouterLink to="/records" exact-active-class="active">我的纪录</RouterLink><RouterLink to="/skins" exact-active-class="active">皮肤商城</RouterLink></nav>
      <div class="top-actions" :title="performanceVisible ? performanceDetails : undefined"><span v-if="performanceVisible" class="performance-readout" aria-label="实时渲染性能">{{ performanceText.fps }} FPS · {{ performanceText.frameMs }} ms<small> · 绘制 {{ performanceText.drawCalls }} · 三角面 {{ performanceText.triangles }}</small></span><span v-if="inHome" class="home-ready-status" :class="{ failed: !!state.error, ready: state.ready && !state.error }" role="status"><i/>{{ state.error ? '加载失败' : state.ready ? '准备就绪' : '准备中' }}</span><el-button circle :icon="QuestionFilled" aria-label="操作说明" @click="state.helpOpen = true"/><el-button circle :icon="Setting" aria-label="设置" @click="settings"/></div>
    </header>
    <RouterView v-if="!inGame" />
    <template v-else>
      <button v-if="cleanHud && state.phase === 'playing'" type="button" class="clean-timer" :style="{ '--clean-viewport-x': `${viewport.offsetLeft}px`, '--clean-viewport-y': `${viewport.offsetTop}px` }" :title="performanceVisible ? performanceDetails : undefined" :aria-label="`用时 ${formatTime(state.elapsed)}，暂停游戏`" aria-haspopup="dialog" @keydown.space.stop @keydown.enter.stop @click="state.phase = 'paused'">{{ formatTime(state.elapsed) }}</button>
      <span v-if="cleanHud && performanceVisible" class="performance-readout performance-clean" :style="performancePlacement" :title="performanceDetails" aria-label="实时渲染性能">{{ performanceText.fps }} FPS · {{ performanceText.frameMs }} ms<small> · 绘制 {{ performanceText.drawCalls }} · 三角面 {{ performanceText.triangles }}</small></span>
      <div v-if="!cleanHud" class="game-top" :style="performanceVisible ? performancePlacement : undefined">
        <div v-if="!touchMode" class="game-summary">
          <div class="course-heading"><span class="course-number">{{ activeLevel.number }}</span><div>{{ activeLevel.title }}<small>到达橙色终点 · 经过{{ checkpointLabel }}检查点</small></div></div>
          <div class="timer-panel"><span>本次用时</span><strong>{{ formatTime(state.elapsed) }}</strong><div>检查点 {{ state.checkpoint }} / {{ level.checkpoints.length }} <i/> 掉落 {{ state.falls }} 次</div></div>
        </div>
        <div v-else class="mobile-status"><strong>{{ formatTime(state.elapsed) }}</strong><span>{{ state.checkpoint }} / {{ level.checkpoints.length }} 检查点</span></div>
        <div class="game-actions"><span v-if="performanceVisible" class="performance-readout" aria-label="实时渲染性能">{{ performanceText.fps }} FPS · {{ performanceText.frameMs }} ms<small> · 绘制 {{ performanceText.drawCalls }} · 三角面 {{ performanceText.triangles }}</small></span><el-button class="pause-button" :icon="VideoPause" :title="performanceVisible ? performanceDetails : undefined" @click="state.phase = 'paused'">暂停 <kbd v-if="!touchMode">Esc</kbd></el-button></div>
      </div>
      <div v-if="!cleanHud" class="progress-rail" aria-label="关卡进度"><span :style="{ width: `${state.progress * 100}%` }"/></div>
      <div v-if="!cleanHud && !touchMode" class="game-bottom"><div class="control-hint"><span><kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd> 移动</span><span><kbd>Space</kbd> 刹车</span></div><el-button class="restart-button" :icon="RefreshRight" @click="startRun">重新挑战 <kbd>R</kbd></el-button></div>
      <TouchControls v-if="touchMode && state.phase === 'playing' && !portraitBlocked" :reset-key="inputResetKey" @change="setTouchInput" />
    </template>
    <footer v-if="!inGame && !inHome" class="bottom-bar"><span><i class="status-dot"/>{{ inAtlas ? '障碍物资料库' : inShop ? '皮肤商城' : state.error ? '场景加载失败' : state.ready ? '准备就绪' : '正在准备 3D 场景…' }}</span><span>{{ inAtlas ? '点选卡片 · 查看运转方式' : inShop ? '点选卡片 · 即时装备' : touchMode ? '横屏触控 · 支持键盘' : '键盘操作 · 推荐电脑浏览器' }}</span><span v-if="!inShop">LOCAL EDITION <b>01</b></span></footer>
    <div v-if="state.error && !inAtlas && !inShop" class="error-banner" role="alert">{{ state.error }} <el-button size="small" @click="retrySceneLoad">重试加载</el-button></div>
    <div v-if="state.storageWarning" class="storage-warning" role="status">浏览器无法保存，本次设置与成绩仅在当前页面保留。</div>
    <div v-if="portraitBlocked" class="portrait-prompt" role="dialog" aria-modal="true" aria-label="请横放手机"><div><span class="rotate-phone" aria-hidden="true">↻</span><h2>横放手机，准备出发。</h2><p>计时已暂停，横屏后可继续。</p><el-button @click="state.phase = 'menu'">返回主界面</el-button></div></div>
    <el-dialog :model-value="state.phase === 'paused' && !state.settingsOpen && !state.helpOpen && !portraitBlocked" title="稍作停留" width="420px" align-center :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false" class="game-dialog">
      <p class="dialog-subtitle">计时已暂停，下一段路等你出发。<span v-if="touchMode" class="mobile-pause-detail">{{ activeLevel.title }} · 掉落 {{ state.falls }} 次</span></p><div class="dialog-stack"><el-button type="primary" size="large" :icon="ArrowRight" @click="state.phase = 'playing'">继续挑战</el-button><el-button size="large" :icon="RefreshRight" @click="startRun">重新开始</el-button><el-button size="large" :icon="Setting" @click="settings">游戏设置</el-button><el-button v-if="touchMode" size="large" :icon="QuestionFilled" @click="state.helpOpen = true">操作说明</el-button><el-button text @click="state.phase = 'menu'">返回主界面</el-button></div>
    </el-dialog>
    <el-dialog :model-value="state.phase === 'finished'" title="漂亮，顺利抵达！" width="450px" align-center :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false" class="game-dialog">
      <div class="result-medal">{{ medal(state.elapsed) }}</div><div class="result-time">{{ formatTime(state.elapsed) }}</div><p class="dialog-subtitle">掉落 {{ state.falls }} 次 · 成绩已加入本地纪录</p><div class="dialog-stack"><el-button type="primary" size="large" :icon="RefreshRight" @click="startRun">再来一局</el-button><el-button size="large" @click="state.phase = 'menu'">返回主界面</el-button></div>
    </el-dialog>
    <el-dialog v-model="state.helpOpen" title="把握重力，也把握节奏。" width="460px" align-center class="game-dialog"><div v-if="touchMode" class="help-rows"><p><strong>左侧摇杆</strong><span>按方向推动，轻推可细调</span></p><p><strong>右侧刹车</strong><span>按住减速，可与摇杆同时操作</span></p></div><div v-else class="help-rows"><p><kbd>W A S D</kbd><span>或方向键，按屏幕方向控制弹珠</span></p><p><kbd>Space</kbd><span>刹车，慢一点更容易过弯</span></p><p><kbd>R</kbd><span>重新挑战，计时与检查点归零</span></p><p><kbd>Esc</kbd><span>暂停 / 继续</span></p></div><p class="dialog-subtitle">依次经过{{ checkpointLabel }}蓝色检查点，再到达橙色终点。掉落后从最近的检查点返回，计时不会清零。</p><el-button type="primary" @click="state.helpOpen = false">明白了</el-button></el-dialog>
    <SettingsPanel />
  </main>
</template>
