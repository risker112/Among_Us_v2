// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 👈 Required to expose to local network
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://192.168.0.105:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
