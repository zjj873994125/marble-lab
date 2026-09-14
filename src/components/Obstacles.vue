<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { obstacleCatalog, type ObstacleEntry, type ObstacleCategory } from '../game/obstacles'
import ObstacleThumbnail from './ObstacleThumbnail.vue'
import ObstaclePreview from './ObstaclePreview.vue'
const query=ref(''),category=ref<'全部'|ObstacleCategory>('全部'),selected=ref<ObstacleEntry|null>(null)
const categories=['全部','动态机关','路线挑战'] as const
const visible=computed(()=>obstacleCatalog.filter(entry=>(category.value==='全部'||entry.category===category.value)&&`${entry.name} ${entry.skill} ${entry.summary} ${entry.placement}`.includes(query.value.trim())))
const open=ref(false)
function show(entry:ObstacleEntry){selected.value=entry;open.value=true}
function reset(){query.value='';category.value='全部'}
</script>
<template>
  <section class="obstacle-page">
    <div class="atlas-heading"><h1>障碍物<span>图鉴</span></h1></div>
    <div class="atlas-controls"><div class="atlas-filters" aria-label="障碍物分类"><button v-for="item in categories" :key="item" type="button" :aria-pressed="category===item" @click="category=item">{{ item }}<span>{{ item==='全部'?obstacleCatalog.length:obstacleCatalog.filter(entry=>entry.category===item).length }}</span></button></div><el-input v-model="query" :prefix-icon="Search" clearable placeholder="搜索名称、技巧或用途" aria-label="搜索障碍物" /></div>
    <div class="atlas-grid">
      <button v-for="entry in visible" :key="entry.id" type="button" class="obstacle-card" :aria-label="`查看${entry.name}动态预览`" @click="show(entry)">
        <div class="card-heading"><h2>{{ entry.name }}</h2></div>
        <div class="card-picture"><img v-if="entry.thumbnail" :src="entry.thumbnail" alt="" loading="lazy"/><ObstacleThumbnail v-else :id="entry.id"/></div>
      </button>
    </div>
    <div v-if="!visible.length" class="atlas-empty"><h2>还没有找到这个障碍。</h2><p>试试名称或“控球”“时机”等关键词。</p><el-button @click="reset">查看全部</el-button></div>
    <el-dialog v-model="open" :title="selected?.name" width="1080px" align-center class="obstacle-dialog">
      <ObstaclePreview v-if="selected" :id="selected.id" :active="open" />
    </el-dialog>
  </section>
</template>
<style scoped lang="less">
.obstacle-page { position:relative; z-index:2; max-width:1380px; margin:0 auto; padding:34px var(--ui-gutter) 36px; }
.atlas-heading { margin-bottom:24px; h1 { font-size:clamp(29px,3vw,44px); letter-spacing:-1.4px; line-height:1.35; margin:0; span { color:#d77343; } } }
.atlas-controls { display:flex; justify-content:space-between; gap:20px; align-items:center; margin-bottom:22px; .el-input { width:250px; :deep(.el-input__wrapper) { min-height:42px; border-radius:12px; background:#fafbf6; box-shadow:0 0 0 1px #dce3d7 inset; } } }
.atlas-filters { display:flex; gap:6px; button { border:0; border-radius:10px; background:none; color:#738174; font-size:12px; padding:11px 14px; cursor:pointer; min-height:44px; span { margin-left:9px; opacity:.6; font-variant-numeric:tabular-nums; } &[aria-pressed='true'] { color:#3d594d; background:#e0e8d9; } } }
.atlas-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:22px; }
.obstacle-card { position:relative; display:flex; flex-direction:column; min-width:0; padding:0; border:1px solid #dce3d6; border-radius:18px; overflow:hidden; background:#fafbf5; text-align:left; color:#344b41; cursor:pointer; transition:transform .18s,border-color .18s,box-shadow .18s; &:hover { transform:translateY(-3px); border-color:#c4ceba; box-shadow:0 12px 24px #3450390c; } }
.card-heading { padding:20px 20px 0; h2 { margin:0; font-size:20px; font-weight:600; letter-spacing:.3px; } }
.card-picture { position:relative; height:240px; margin:4px 10px 12px; background:radial-gradient(ellipse at center,#edf1e5,transparent 72%); }
.card-picture img { width:100%;height:100%;object-fit:contain;display:block; }
.atlas-empty { padding:60px 0; text-align:center; h2 { font-size:21px; } p { font-size:13px; color:#7b8b77; } }
@media(max-width:1000px) { .atlas-grid { gap:14px; } .card-heading { padding:16px 14px 0; h2 { font-size:18px; } } .card-picture { height:195px; margin-inline:0; } }
@media(max-width:760px) { .atlas-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .atlas-controls { align-items:stretch; flex-direction:column; gap:12px; .el-input { width:100%; } } }
@media(max-width:480px) { .obstacle-page { padding-top:24px; } .atlas-grid { grid-template-columns:1fr; } .card-picture { height:230px; } .card-heading { padding:20px 20px 0; } }
</style>
<style lang="less">
.obstacle-dialog.el-dialog { background:#fafbf4; border-radius:22px; max-width:calc(100vw - 28px); padding:26px; max-height:calc(100dvh - 32px); overflow-y:auto; .el-dialog__title { color:#3d5142; font-size:23px; font-weight:600; } .el-dialog__header { margin-bottom:16px; } }
@media(max-width:600px) { .obstacle-dialog.el-dialog { padding:18px; margin-block:16px; } }
</style>
