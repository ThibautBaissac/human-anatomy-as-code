#!/usr/bin/env node
// assets <buildDir> <objDir> <outDir> [<hraDir> <importDir>]
// Reads atlas-male.json and atlas-female.json from buildDir.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAssets, type AtlasInput } from './build-assets.ts';

if (process.argv[2] === 'fit-joints') {
  // assets fit-joints <dataDir> <objDir>
  const [, dataDir, objDir] = process.argv.slice(2);
  if (!dataDir || !objDir) {
    console.error('usage: assets fit-joints <dataDir> <objDir>');
    process.exit(2);
  }
  try {
    const { fitJoints } = await import('./fit-joints.ts');
    const r = fitJoints({ dataDir, objDir });
    for (const m of r.measured) console.log(`mesuré : ${m}`);
    for (const m of r.skipped) console.log(`ignoré (os sans mesh de ce côté) : ${m}`);
    for (const m of r.reviewed) console.log(`ignoré (articulation relue) : ${m}`);
    for (const m of r.refused) console.error(`refusé : ${m}`);
    process.exit(r.refused.length ? 1 : 0);
  } catch (e) {
    console.error(`erreur : ${(e as Error).message}`);
    process.exit(1);
  }
}
const [buildDir, objDir, outDir, hraDir, importDir] = process.argv.slice(2);
if (!buildDir || !objDir || !outDir) {
  console.error('usage: assets <buildDir> <objDir> <outDir> [<hraDir> <importDir>]');
  process.exit(2);
}
const read = (f: string) => JSON.parse(readFileSync(join(buildDir, f), 'utf8'));
try {
  const t0 = performance.now();
  const atlases: Record<string, AtlasInput> = { male: read('atlas-male.json'), female: read('atlas-female.json') };
  const hra = hraDir && importDir ? { dir: hraDir, filesList: join(importDir, 'hra-files.yaml'), registration: join(importDir, 'hra-registration.yaml') } : undefined;
  // the same rig warning comes once per model: print it once
  const warned = new Set<string>();
  const manifest = await buildAssets({
    atlases, objDir, hra, outDir,
    onWarning: (w) => { if (!warned.has(w)) { warned.add(w); console.warn(`avertissement : ${w}`); } },
    onRefined: (r) => console.log(`subdivision : ${r.meshes} meshes facettés, ${r.trianglesBefore} → ${r.trianglesAfter} triangles (+${r.trianglesAfter - r.trianglesBefore})`),
  });
  for (const [kind, k] of Object.entries(manifest.kinds)) {
    console.log(`${kind.padEnd(16)} ${String(k.instances).padStart(5)} instances ${(k.bytes / 1e6).toFixed(1).padStart(6)} MB`);
  }
  for (const [model, m] of Object.entries(manifest.models)) console.log(`modèle ${model.padEnd(7)} ${m.kinds.length} fichiers ${(m.totalBytes / 1e6).toFixed(1).padStart(6)} MB`);
  console.log(`total ${(manifest.totalBytes / 1e6).toFixed(1)} MB · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
} catch (e) {
  console.error(`erreur : ${(e as Error).message}`);
  process.exitCode = 1;
}
