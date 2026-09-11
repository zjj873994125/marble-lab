<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, Aim, Trophy, Timer } from '@element-plus/icons-vue'
import { state, startRun, formatTime, activeLevel, selectLevel } from '../state'
import { levelCatalog } from '../game/levels'
const route = useRoute()
const levels = computed(() => route.path === '/levels')
</script>
<template>
  <section class="lobby">
    <div class="lobby-copy">
      <h1 v-if="!levels">小小弹珠，<br/>大有<span>挑战。</span></h1><h1 v-else>下一次，<br/>再快<span>一点。</span></h1>
      <p class="intro">滚过弯道，越过机关。<br/>在失衡与掌控之间，找到你的最佳路线。</p>
      <div class="course-facts"><span><el-icon><Timer/></el-icon>短局挑战</span><span><el-icon><Aim/></el-icon>物理滚动</span><span><el-icon><Trophy/></el-icon>刷新纪录</span></div>
      <div v-if="levels" class="level-picker" aria-label="选择关卡"><button v-for="entry in levelCatalog" :key="entry.config.id" type="button" :aria-pressed="entry.config.id === state.levelId" @click="selectLevel(entry.config.id)"><span>{{ entry.number }} · {{ entry.title }}</span><small>{{ entry.config.checkpoints.length }} 个检查点</small></button></div>
      <el-button class="start-button" type="primary" :disabled="!state.ready || !!state.error" @click="startRun">{{ state.ready ? '开始挑战' : '准备场景中' }}<el-icon><ArrowRight/></el-icon></el-button>
      <div class="best-line">个人最佳 <strong>{{ state.runs.length ? formatTime(state.runs[0]!.time) : '等待你的第一次完赛' }}</strong></div>
    </div>
    <div class="scene-caption"><span class="caption-line"/><span>小心，前方是摆锤。<small>保持节奏，比一味加速更重要。</small></span></div>
    <div class="course-strip"><div class="selected-course"><div class="mini-track"><i/><b/><em/></div><div><span class="section-label">当前关卡 · {{ activeLevel.number }}</span><h2>{{ activeLevel.title }}</h2><p>{{ activeLevel.description }}</p></div><span class="course-state">可挑战</span></div><div class="medal-targets"><span class="section-label">目标用时</span><div v-if="activeLevel.medals"><span><i class="gold"/>金牌 <b>{{ activeLevel.medals[0] }}″</b></span><span><i class="silver"/>银牌 <b>{{ activeLevel.medals[1] }}″</b></span><span><i class="bronze"/>铜牌 <b>{{ activeLevel.medals[2] }}″</b></span></div><small v-else>先完成挑战，奖牌目标待试玩校准。</small><small>跑熟路线，再向更快的自己挑战。</small></div></div>
  </section>
</template>

<style scoped lang="less">
.level-picker { display: flex; gap: 10px; margin: -6px 0 18px; flex-wrap: wrap; button { padding: 10px 14px; border: 1px solid #c8d2c8; border-radius: 12px; background: #faf9f2; color: #40534a; cursor: pointer; text-align: left; &[aria-pressed='true'] { border-color: #e77442; box-shadow: inset 0 0 0 1px #e77442; } &:focus-visible { outline: 2px solid #40534a; outline-offset: 3px; } } small { display: block; margin-top: 5px; font-size: 10px; } }
</style>
  
