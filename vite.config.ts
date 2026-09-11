import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ plugins: [vue()], base: './', server: { port: 5177 }, build: { rollupOptions: { output: { manualChunks: { engine: ['playcanvas'], ui: ['element-plus'] } } } } })
