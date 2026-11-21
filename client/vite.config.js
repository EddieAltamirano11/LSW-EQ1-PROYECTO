import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: {
      'Permissions-Policy': 'unload=*',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3050',
        changeOrigin: true,
      },
    },
  },
  // Pruebas del cliente: archivos *.spec.js(x) para no mezclarse con `node --test` del backend.
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{js,jsx}'],
  },
});
