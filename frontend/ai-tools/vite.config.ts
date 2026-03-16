import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:3001';
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Keep frontend fixed on :3000 to avoid proxying /api back to itself.
      strictPort: true,
      proxy: {
        // 开发时将所有 /api 请求转发至 Express 后端（:3001）
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
