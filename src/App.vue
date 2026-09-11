<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { Setting, QuestionFilled, VideoPause, RefreshRight, ArrowRight, Close } from '@element-plus/icons-vue'
import GameCanvas from './components/GameCanvas.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { state, startRun, formatTime, medal, activeLevel } from './state'
const level = computed(() => activeLevel.value.config)
const hasWater = computed(() => level.value.staticObjects.some(object => object.material === 'water'))
const checkpointLabel = computed(() => level.value.checkpoints.length === 2 ? '两个' : `${level.value.checkpoints.length}个`)
const inGame = computed(() => state.phase !== 'menu')
watch(inGame, async () => { await nextTick(); window.scrollTo(0, 0) })
function settings() { if (state.phase === 'playing') state.phase = 'paused'; state.settingsOpen = true }
watch(() => state.settings.reducedMotion, value => document.documentElement.classList.toggle('reduce-motion', value), { immediate: true })
</script>

<template>
  <main class="app-shell" :class="{ 'in-game': inGame, 'water-scene': hasWater }">
    <GameCanvas :key="state.levelId" />
    <header v-if="!inGame" class="topbar">
      <RouterLink to="/" class="brand" aria-label="杰哥让你滚首页"><span class="brand-orbit"><i/></span><span>杰哥让你滚<small>MARBLE LAB</small></span></RouterLink>
      <nav aria-label="主导航"><RouterLink to="/" exact-active-class="active">开始</RouterLink><RouterLink to="/levels" exact-active-class="active">挑战关卡</RouterLink><RouterLink to="/records" exact-active-class="active">我的纪录</RouterLink></nav>
      <div class="top-actions"><el-button circle :icon="QuestionFilled" aria-label="操作说明" @click="state.helpOpen = true"/><el-button circle :icon="Setting" aria-label="设置" @click="settings"/></div>
    </header>
    <RouterView v-if="!inGame" />
    <template v-else>
      <div class="game-top">
        <div class="game-summary">
          <div class="course-heading"><span class="course-number">{{ activeLevel.number }}</span><div>{{ activeLevel.title }}<small>到达橙色终点 · 经过{{ checkpointLabel }}检查点</small></div></div>
          <div class="timer-panel"><span>本次用时</span><strong>{{ formatTime(state.elapsed) }}</strong><div>检查点 {{ state.checkpoint }} / {{ level.checkpoints.length }} <i/> 掉落 {{ state.falls }} 次</div></div>
        </div>
        <el-button class="pause-button" :icon="VideoPause" @click="state.phase = 'paused'">暂停 <kbd>Esc</kbd></el-button>
      </div>
      <div class="progress-rail" aria-label="关卡进度"><span :style="{ width: `${state.progress * 100}%` }"/></div>
      <div class="game-bottom"><div class="control-hint"><span><kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd> 移动</span><span><kbd>Space</kbd> 刹车</span></div><el-button class="restart-button" :icon="RefreshRight" @click="startRun">重新挑战 <kbd>R</kbd></el-button></div>
    </template>
    <footer v-if="!inGame" class="bottom-bar"><span><i class="status-dot"/>{{ state.error ? '场景加载失败' : state.ready ? '准备就绪' : '正在准备 3D 场景…' }}</span><span>键盘操作 · 推荐电脑浏览器</span><span>LOCAL EDITION <b>01</b></span></footer>
    <div v-if="state.error" class="error-banner" role="alert">{{ state.error }} <el-button size="small" @click="state.runId++; state.error = ''">重试加载</el-button></div>
    <div v-if="state.storageWarning" class="storage-warning" role="status">浏览器无法保存，本次设置与成绩仅在当前页面保留。</div>
    <el-dialog :model-value="state.phase === 'paused' && !state.settingsOpen" title="稍作停留" width="420px" align-center :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false" class="game-dialog">
      <p class="dialog-subtitle">计时已暂停，下一段路等你出发。</p><div class="dialog-stack"><el-button type="primary" size="large" :icon="ArrowRight" @click="state.phase = 'playing'">继续挑战</el-button><el-button size="large" :icon="RefreshRight" @click="startRun">重新开始</el-button><el-button size="large" :icon="Setting" @click="settings">游戏设置</el-button><el-button text @click="state.phase = 'menu'">返回主界面</el-button></div>
    </el-dialog>
    <el-dialog :model-value="state.phase === 'finished'" title="漂亮，顺利抵达！" width="450px" align-center :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false" class="game-dialog">
      <div class="result-medal">{{ medal(state.elapsed) }}</div><div class="result-time">{{ formatTime(state.elapsed) }}</div><p class="dialog-subtitle">掉落 {{ state.falls }} 次 · 成绩已加入本地纪录</p><div class="dialog-stack"><el-button type="primary" size="large" :icon="RefreshRight" @click="startRun">再来一局</el-button><el-button size="large" @click="state.phase = 'menu'">返回主界面</el-button></div>
    </el-dialog>
    <el-dialog v-model="state.helpOpen" title="把握重力，也把握节奏。" width="460px" align-center class="game-dialog"><div class="help-rows"><p><kbd>W A S D</kbd><span>或方向键，按屏幕方向控制弹珠</span></p><p><kbd>Space</kbd><span>刹车，慢一点更容易过弯</span></p><p><kbd>R</kbd><span>重新挑战，计时与检查点归零</span></p><p><kbd>Esc</kbd><span>暂停 / 继续</span></p></div><p class="dialog-subtitle">依次经过{{ checkpointLabel }}蓝色检查点，再到达橙色终点。掉落后从最近的检查点返回，计时不会清零。</p><el-button type="primary" @click="state.helpOpen = false">明白了</el-button></el-dialog>
    <SettingsPanel />
  </main>
</template>
