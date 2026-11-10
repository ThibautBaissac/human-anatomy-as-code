import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { serwist } from '@serwist/vite';

const STATIC = new URL('./static/', import.meta.url).pathname;
const CERTS = new URL('./.certs/', import.meta.url).pathname;
// HAAC_HTTPS=1 (npm run preview:https): HTTPS on the local network with a mkcert certificate, for WebGPU on phones.
const https = process.env.HAAC_HTTPS === '1' ? { key: readFileSync(join(CERTS, 'key.pem')), cert: readFileSync(join(CERTS, 'cert.pem')) } : undefined;
const TYPES: Record<string, string> = { '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

/** Serves and emits app/static/ (web manifest, icons): publicDir is already taken by build/ (atlas + models). */
function staticFiles(): Plugin {
  return {
    name: 'haac-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = join(STATIC, decodeURIComponent((req.url ?? '').split('?')[0]));
        if (!file.startsWith(STATIC) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const file of walk(STATIC)) this.emitFile({ type: 'asset', fileName: relative(STATIC, file), source: readFileSync(file) });
    },
  };
}

// build/ (atlas-male.json, atlas-female.json, assets/) is served at the root of the app; Vite's own files go to /app/.
export default defineConfig({
  publicDir: '../build',
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true, https },
  build: {
    target: 'es2022',
    assetsDir: 'app',
    // three.js in its own chunk: no precached file over 1 MB (spec 2), and app updates do not invalidate it.
    rollupOptions: { output: { manualChunks: (id) => (/node_modules\/three-mesh-bvh\//.test(id) ? "bvh" : /node_modules\/three\//.test(id) ? "three" : /node_modules\//.test(id) ? "vendor" : undefined) } },
  },
  plugins: [
    staticFiles(),
    serwist({
      swSrc: 'src/sw.ts',
      swDest: 'sw.js',
      globDirectory: 'dist',
      injectionPoint: 'self.__SW_MANIFEST',
      rollupFormat: 'iife',
      // App shell only: never the models nor the data.
      globPatterns: ['index.html', 'app/**/*.{js,css}', 'icons/*.{png,svg}', 'manifest.webmanifest'],
      globIgnores: ['assets/**', 'atlas-*.json'],
    }),
  ],
});
