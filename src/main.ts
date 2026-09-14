import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import App from './App.vue'
import Lobby from './components/Lobby.vue'
import Records from './components/Records.vue'
import './style.less'

const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/', component: Lobby },
  { path: '/levels', redirect: { path: '/', query: { choose: '1' } } },
  { path: '/records', component: Records },
  { path: '/obstacles', component: () => import('./components/Obstacles.vue') },
  { path: '/skins', component: () => import('./components/SkinsShop.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
] })
createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app')
