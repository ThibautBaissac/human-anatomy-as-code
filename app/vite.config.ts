import { defineConfig } from 'vite';

// build/ (atlas.json + assets/) is served at the root of the app.
export default defineConfig({
  publicDir: '../build',
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  build: { target: 'es2022' },
});
