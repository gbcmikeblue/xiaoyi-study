import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相对路径，便于 Capacitor 以 file:// 或自定义 scheme 加载
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
});
