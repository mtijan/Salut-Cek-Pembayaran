import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readApplicationVersion } from './version.config.js';

const appVersion = readApplicationVersion();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  base: '/admin/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../Frontend/admin-dist',
    emptyOutDir: true,
  },
});
