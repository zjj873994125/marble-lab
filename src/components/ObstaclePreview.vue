<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { VideoPause, VideoPlay, RefreshRight, ZoomIn, ZoomOut, Aim, Loading, Warning } from '@element-plus/icons-vue'
import { state } from '../state'
import type { ObstacleId } from '../game/obstacles'
import type { ObstaclePreview } from '../game/obstacle-preview'
const props=defineProps<{ id:ObstacleId; active:boolean }>()
const host=ref<HTMLDivElement>(),loading=ref(true),error=ref(''),status=ref('')
const reduce=matchMedia('(prefers-reduced-motion: reduce)')
const playing=ref(!state.settings.reducedMotion&&!reduce.matches)
let preview:ObstaclePreview|undefined,disposed=false
function reduction(){if(state.settings.reducedMotion||reduce.matches)playing.value=false}
watch(()=>state.settings.reducedMotion,reduction)
watch(()=>[state.settings.trackTheme,state.settings.quality,state.settings.reducedMotion,state.settings.waterSpeed,state.settings.ballSkin],()=>preview?.applyTheme())
watch(() => [playing.value, props.active],()=>{preview?.setVisible(props.active);preview?.setPlaying(playing.value&&props.active)})
watch(() => props.id,id=>{playing.value=!state.settings.reducedMotion&&!reduce.matches;preview?.setObstacle(id);preview?.setPlaying(playing.value&&props.active)})
function replay(){preview?.replay();playing.value=true}
onMounted(async()=>{
  reduce.addEventListener('change',reduction)
  try{
    const {createObstaclePreview}=await import('../game/obstacle-preview')
    if(disposed||!host.value)return
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','障碍物三维预览，可拖动旋转');host.value.append(canvas)
    preview=createObstaclePreview(canvas,props.id,message=>{if(!disposed)status.value=message},()=>state.settings.trackTheme,()=>state.settings)
    preview.setVisible(props.active)
    preview.setPlaying(playing.value&&props.active)
  }catch(e){if(!disposed)error.value=e instanceof Error?e.message:'三维预览暂不可用'}finally{if(!disposed)loading.value=false}
})
onBeforeUnmount(()=>{disposed=true;reduce.removeEventListener('change',reduction);preview?.destroy()})
</script>
<template>
  <div class="obstacle-preview">
    <div ref="host" class="preview-stage"/>
    <div v-if="loading || error" class="preview-message" :role="error ? 'alert' : 'status'" :aria-label="error || '正在准备三维预览'">
      <el-icon :class="{ 'is-loading': !error }"><Warning v-if="error"/><Loading v-else/></el-icon>
    </div>
    <div v-if="status && !error" class="preview-load-status" role="status" :aria-label="status"><el-icon :class="{ 'is-loading': status.includes('正在') }"><Loading v-if="status.includes('正在')"/><Warning v-else/></el-icon></div>
    <div class="preview-toolbar">
      <el-button circle :icon="playing ? VideoPause : VideoPlay" :aria-label="playing ? '暂停预览' : '播放预览'" :disabled="loading || !!error" @click="playing=!playing"/>
      <el-button circle :icon="RefreshRight" aria-label="重播预览" :disabled="loading || !!error" @click="replay"/>
      <div class="view-tools"><el-button circle :icon="ZoomOut" aria-label="缩小预览" :disabled="loading || !!error" @click="preview?.zoom(1.15)"/><el-button circle :icon="ZoomIn" aria-label="放大预览" :disabled="loading || !!error" @click="preview?.zoom(.85)"/><el-button circle :icon="Aim" aria-label="恢复预览视角" :disabled="loading || !!error" @click="preview?.resetView()"/></div>
    </div>
  </div>
</template>
<style scoped lang="less">
.obstacle-preview { position:relative; background:#e3ebdf; border-radius:18px; overflow:hidden; min-width:0; }
.preview-stage { height:clamp(240px,65dvh,680px); :deep(canvas) { width:100%; height:100%; display:block; touch-action:none; cursor:grab; &:active { cursor:grabbing; } } }
.preview-message { position:absolute; inset:30px 20px 80px; display:grid; place-items:center; color:#48635b; font-size:28px; pointer-events:none; }
.preview-load-status { position:absolute; top:18px; left:18px; color:#576e61; pointer-events:none; }
.preview-toolbar { position:absolute; bottom:16px; left:50%; transform:translateX(-50%); display:flex; gap:8px; align-items:center; .el-button { width:44px; height:44px; background:#fbfbf4e6; border-color:#d1dbcd; } }
.view-tools { display:flex; gap:8px; }
@media(max-width:600px) { .preview-toolbar { gap:6px; bottom:12px; } .view-tools { gap:6px; } }
</style>
