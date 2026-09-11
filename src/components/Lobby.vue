<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, Aim, Trophy, Timer } from '@element-plus/icons-vue'
import { state, startRun, formatTime } from '../state'
const route = useRoute()
const levels = computed(() => route.path === '/levels')
</script>
<template>
  <section class="lobby">
    <div class="lobby-copy">
      <h1 v-if="!levels">小小弹珠，<br/>大有<span>挑战。</span></h1><h1 v-else>下一次，<br/>再快<span>一点。</span></h1>
      <p class="intro">滚过弯道，越过机关。<br/>在失衡与掌控之间，找到你的最佳路线。</p>
      <div class="course-facts"><span><el-icon><Timer/></el-icon>短局挑战</span><span><el-icon><Aim/></el-icon>物理滚动</span><span><el-icon><Trophy/></el-icon>刷新纪录</span></div>
      <el-button class="start-button" type="primary" :disabled="!state.ready || !!state.error" @click="startRun">{{ state.ready ? '开始挑战' : '准备场景中' }}<el-icon><ArrowRight/></el-icon></el-button>
      <div class="best-line">个人最佳 <strong>{{ state.runs.length ? formatTime(state.runs[0]!.time) : '等待你的第一次完赛' }}</strong></div>
    </div>
    <div class="scene-caption"><span class="caption-line"/><span>小心，前方是摆锤。<small>保持节奏，比一味加速更重要。</small></span></div>
    <div class="course-strip"><div class="selected-course"><div class="mini-track"><i/><b/><em/></div><div><span class="section-label">当前关卡 · 01</span><h2>教学关卡</h2><p>弯道 · 摆锤 · 移动平台</p></div><span class="course-state">可挑战</span></div><div class="medal-targets"><span class="section-label">目标用时</span><div><span><i class="gold"/>金牌 <b>35″</b></span><span><i class="silver"/>银牌 <b>55″</b></span><span><i class="bronze"/>铜牌 <b>90″</b></span></div><small>跑熟路线，再向更快的自己挑战。</small></div></div>
  </section>
</template>
