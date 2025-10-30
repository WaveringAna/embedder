import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/progress-updates': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
    },
  },
});
