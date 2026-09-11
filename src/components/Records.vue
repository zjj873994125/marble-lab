<script setup lang="ts">
import { ArrowRight, Trophy } from '@element-plus/icons-vue'
import { state, startRun, formatTime, medal, archivedGroups } from '../state'
</script>
<template><section class="records-page"><div class="records-title"><div><h1>每一次，都算数。</h1><p>教学关卡 · 当前玩法最快的 20 次完赛纪录</p></div><el-button type="primary" :disabled="!state.ready" :icon="ArrowRight" @click="startRun">再挑战一次</el-button></div><div class="records-surface"><template v-if="state.runs.length"><div v-for="(run,index) in state.runs" :key="run.date + index" class="record-row"><span class="rank">{{ String(index + 1).padStart(2,'0') }}</span><strong>{{ formatTime(run.time) }}</strong><span>{{ medal(run.time) }}</span><span>掉落 {{ run.falls }} 次</span><time>{{ new Date(run.date).toLocaleString('zh-CN') }}</time></div></template><div v-else class="empty-records"><el-icon><Trophy/></el-icon><h2>你的纪录，从第一局开始。</h2><p>完成关卡后，用时和奖牌会保存在这里。</p><el-button text :icon="ArrowRight" :disabled="!state.ready" @click="startRun">去跑一局</el-button></div></div><details v-for="group in archivedGroups" :key="group.version" class="records-surface archived-records"><summary>旧版纪录 · {{ group.label }}（不计入当前最佳）</summary><div v-for="(run,index) in group.runs" :key="run.date + index" class="record-row"><span class="rank">{{ String(index + 1).padStart(2,'0') }}</span><strong>{{ formatTime(run.time) }}</strong><span>{{ medal(run.time) }}</span><span>掉落 {{ run.falls }} 次</span><time>{{ new Date(run.date).toLocaleString('zh-CN') }}</time></div></details><p class="local-note">纪录仅保存在当前浏览器。清除网站数据后将无法恢复。</p></section></template>

<style scoped lang="less">
.archived-records { margin-top: 20px; summary { padding: 20px 24px; cursor: pointer; } }
</style>
