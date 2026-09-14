<script setup lang="ts">
import { computed, useId } from 'vue'
import { ballSkin, type BallSkinId } from '../game/ball-skins'
import { ballSkinAsset } from '../game/ball-skin-assets'
const props=defineProps<{id:BallSkinId}>()
const image=computed(()=>ballSkinAsset(`${props.id}.png`)),skin=computed(()=>ballSkin(props.id)),gradient=useId()
</script>
<template>
  <img v-if="image" :src="image" alt="" class="ball-skin-thumbnail" loading="lazy"/>
  <svg v-else viewBox="0 0 240 180" class="ball-skin-thumbnail" aria-hidden="true"><defs><radialGradient :id="gradient" cx="32%" cy="27%"><stop stop-color="#fffef6"/><stop offset=".3" :stop-color="skin.color"/><stop offset=".55" stop-color="#34434a"/><stop offset=".75" :stop-color="skin.color"/><stop offset="1" stop-color="#202b31"/></radialGradient></defs><ellipse cx="120" cy="153" rx="57" ry="10" fill="#19383c" opacity=".13"/><circle cx="120" cy="87" r="65" :fill="`url(#${gradient})`"/></svg>
</template>
<style scoped lang="less">
.ball-skin-thumbnail { display:block; width:100%; height:auto; aspect-ratio:4/3; object-fit:contain; }
</style>
