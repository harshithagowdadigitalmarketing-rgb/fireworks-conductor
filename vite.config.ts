import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the app works at any address (site root or a GitHub Pages sub-path)
  base: './',
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'esnext'
  }
});
