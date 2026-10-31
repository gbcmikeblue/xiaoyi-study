import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相对路径，便于 Capacitor 以 file:// 或自定义 scheme 加载
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
    watch: {
      /*
       * 这些目录体积大或变动频繁，纳入监听会不断触发 HMR 重载，
       * 每次重载都可能重建模块图，是 dev server 内存暴涨的主要原因。
       */
      ignored: [
        '**/android/**',
        '**/dist/**',
        '**/.shots/**',
        '**/comfy-out/**',
        '**/clone-test/**',
        '**/voice-test/**',
        '**/.audio-backup-sapi/**',
        '**/node_modules/**',
        '**/public/content/*/audio/**',
      ],
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
});
