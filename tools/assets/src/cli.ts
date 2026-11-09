#!/usr/bin/env node
// assets <buildDir> <objDir> <outDir> [<hraDir> <importDir>]
// Reads atlas-male.json / atlas-female.json from buildDir (falls back to atlas.json alone).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAssets, type AtlasInput } from './build-assets.ts';

const [buildDir, objDir, outDir, hraDir, importDir] = process.argv.slice(2);
if (!buildDir || !objDir || !outDir) {
  console.error('usage: assets <buildDir> <objDir> <outDir> [<hraDir> <importDir>]');
  process.exit(2);
}
const read = (f: string) => JSON.parse(readFileSync(join(buildDir, f), 'utf8'));
try {
  const t0 = performance.now();
  const atlases: Record<string, AtlasInput> = existsSync(join(buildDir, 'atlas-female.json'))
    ? { male: read('atlas-male.json'), female: read('atlas-female.json') }
    : { male: read('atlas.json') };
  const hra = hraDir && importDir ? { dir: hraDir, filesList: join(importDir, 'hra-files.yaml'), registration: join(importDir, 'hra-registration.yaml') } : undefined;
  const manifest = await buildAssets({ atlases, objDir, hra, outDir });
  for (const [kind, k] of Object.entries(manifest.kinds)) {
    console.log(`${kind.padEnd(16)} ${String(k.instances).padStart(5)} instances ${(k.bytes / 1e6).toFixed(1).padStart(6)} MB`);
  }
  for (const [model, m] of Object.entries(manifest.models)) console.log(`modèle ${model.padEnd(7)} ${m.kinds.length} fichiers ${(m.totalBytes / 1e6).toFixed(1).padStart(6)} MB`);
  console.log(`total ${(manifest.totalBytes / 1e6).toFixed(1)} MB · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
} catch (e) {
  console.error(`erreur : ${(e as Error).message}`);
  process.exitCode = 1;
}
