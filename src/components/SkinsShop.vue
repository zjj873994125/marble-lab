<script setup lang="ts">
import { ref } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { state } from '../state'
import { trackThemes } from '../game/track-themes'
import { ballSkins } from '../game/ball-skins'
import ThemeThumbnail from './ThemeThumbnail.vue'
import BallSkinThumbnail from './BallSkinThumbnail.vue'
const category=ref<'track'|'ball'>('track')
</script>
<template>
  <section class="skins-page">
    <h1>皮肤商城</h1>
    <el-radio-group v-model="category" class="skin-categories" aria-label="皮肤分类"><el-radio-button value="track">赛道皮肤</el-radio-button><el-radio-button value="ball">小球皮肤</el-radio-button></el-radio-group>
    <div v-if="category==='track'" class="skin-grid" aria-label="赛道皮肤">
      <button v-for="theme in trackThemes" :key="theme.id" type="button" class="skin-card" :aria-label="`装备${theme.name}`" :aria-pressed="state.settings.trackTheme===theme.id" @click="state.settings.trackTheme=theme.id"><ThemeThumbnail :id="theme.id"/><span class="skin-name">{{ theme.name }}<span v-if="state.settings.trackTheme===theme.id" class="equipped"><el-icon><Check/></el-icon>已装备</span></span></button>
    </div>
    <div v-else class="skin-grid" aria-label="小球皮肤">
      <button v-for="skin in ballSkins" :key="skin.id" type="button" class="skin-card ball-card" :aria-label="`装备${skin.name}`" :aria-pressed="state.settings.ballSkin===skin.id" @click="state.settings.ballSkin=skin.id"><BallSkinThumbnail :id="skin.id"/><span class="skin-name">{{ skin.name }}<span v-if="state.settings.ballSkin===skin.id" class="equipped"><el-icon><Check/></el-icon>已装备</span></span></button>
    </div>
  </section>
</template>
<style scoped lang="less">
.skins-page { position:relative; z-index:2; max-width:1260px; min-height:calc(100svh - var(--ui-header-height) - var(--ui-footer-height)); margin:0 auto; padding:28px var(--ui-gutter) 36px; h1 { margin:0 0 24px; font-size:36px; letter-spacing:-1px; } }
.skin-categories { margin-bottom:24px; }
.skin-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
.skin-card { min-width:0; padding:10px; border:2px solid #dce4d7; border-radius:16px; background:#fafbf4; color:#405546; cursor:pointer; text-align:left; transition:border-color .15s,box-shadow .15s; &:hover { border-color:#bdcbb6; box-shadow:0 6px 20px #213c3210; } &[aria-pressed='true'] { border-color:#df8750; background:#fcf6eb; } &:focus-visible { outline:3px solid #52705b; outline-offset:3px; } }
.skin-name { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:48px; padding:10px 5px 2px; font-size:16px; line-height:1.5; }
.equipped { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#bf713e; white-space:nowrap; }
.ball-card { background:radial-gradient(ellipse at 50% 38%,#eef1e4,#fafbf4 70%); }
@media(max-width:900px) { .skin-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; } }
@media(max-width:480px) { .skins-page { padding-top:24px; h1 { font-size:29px; } } .skin-grid { grid-template-columns:minmax(0,1fr); } }
</style>
