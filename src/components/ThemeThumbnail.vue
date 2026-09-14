<script setup lang="ts">
import { computed } from 'vue'
import { trackTheme, type TrackThemeId } from '../game/track-themes'
const props=defineProps<{ id:TrackThemeId }>()
const colors=computed(()=>trackTheme(props.id).roles)
</script>
<template>
  <svg viewBox="0 0 240 140" aria-hidden="true" class="theme-thumbnail">
    <rect width="240" height="140" rx="9" :fill="colors.water.color"/>
    <path d="M8 26q26-8 48 0t50 0m27 89q27-8 50 0t48 0M2 108q26-8 50 0" fill="none" stroke="#eff7f1" stroke-opacity=".16"/>
    <path d="m25 106 86-45 106 30-83 42Z" fill="#102e37" opacity=".25"/>
    <path d="M63 74v35m102-31v35" :stroke="colors.structure.color" stroke-width="9"/>
    <path d="m31 67 81-42 99 38v15l-79 43L31 81Z" :fill="colors.structure.color"/>
    <path d="m31 67 81-42 99 38-79 43Z" :fill="colors.accent.color"/>
    <path d="m31 62 81-42 99 38v5l-79 43L31 67Z" :fill="colors.deck.color"/>
    <path d="m31 62 101 39 79-43" fill="none" :stroke="colors.alloy.color" stroke-width="2"/>
    <path d="m49 57 34-18 31 12-34 18Z" :fill="colors.platform.color"/>
    <path d="M166 56V19m-22 12 22-12 25 9" fill="none" :stroke="colors.alloy.color" stroke-width="5" stroke-linejoin="round"/>
    <path d="m166 25-10 32" :stroke="colors.handle.color" stroke-width="5"/>
    <path d="m144 51 23 9v15l-23-9Z" :fill="colors.hammer.color"/>
    <ellipse cx="144" cy="59" rx="5" ry="8" :fill="colors.hammer.color"/>
    <ellipse cx="167" cy="67" rx="5" ry="8" fill="#101a20" opacity=".2"/>
    <ellipse cx="107" cy="72" rx="12" ry="5" fill="#182b32" opacity=".3"/>
    <circle cx="105" cy="63" r="10" fill="#b5c7c9"/><path d="M99 62a7 7 0 0 1 8-5" stroke="#fffcef" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="m111 82 20 7" stroke="#eaf0e6" stroke-width="2" stroke-linecap="round"/>
  </svg>
</template>
<style scoped lang="less">
.theme-thumbnail { display:block; width:100%; height:auto; aspect-ratio:12/7; }
</style>
