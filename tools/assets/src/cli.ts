#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { buildAssets } from './build-assets.ts';

const [atlasPath, objDir, outDir] = process.argv.slice(2);
if (!atlasPath || !objDir || !outDir) {
  console.error('usage: assets <atlas.json> <objDir> <outDir>');
  process.exit(2);
}
try {
  const t0 = performance.now();
  const manifest = await buildAssets({ atlas: JSON.parse(readFileSync(atlasPath, 'utf8')), objDir, outDir });
  let total = 0, instances = 0;
  for (const [kind, k] of Object.entries(manifest.kinds)) {
    total += k.bytes; instances += k.instances;
    console.log(`${kind.padEnd(10)} ${String(k.instances).padStart(5)} instances ${(k.bytes / 1e6).toFixed(1).padStart(6)} MB`);
  }
  console.log(`total      ${String(instances).padStart(5)} instances ${(total / 1e6).toFixed(1).padStart(6)} MB · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
} catch (e) {
  console.error(`erreur : ${(e as Error).message}`);
  process.exitCode = 1;
}
