// One atlas per model + BodyParts3D OBJ and HRA files → one meshopt-compressed GLB per kind, one node per structure-side,
// and the manifest (files, sizes, hashes, files per model, joint rigs).
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rig } from './joints/rig.ts';
import { cmp, fileOf, listInstances, type AtlasInput, type Instance } from './instances.ts';
import { loadGeometry, type HraInput } from './geometry.ts';
import { encodeGlbs } from './glb.ts';
import { rigsOf } from './rigs.ts';

export { listInstances, type AtlasInput, type Instance } from './instances.ts';
export type { HraInput } from './geometry.ts';

export interface Manifest {
  kinds: Record<string, { bytes: number; file: string; instances: number; sha256: string }>;
  /** files (kind keys) each model needs, and their total size */
  models: Record<string, { kinds: string[]; totalBytes: number; joints?: Record<string, Rig> }>;
  totalBytes: number;
}

export interface BuildOptions {
  /** one atlas per model; `atlas` alone is the male model */
  atlases?: Record<string, AtlasInput>;
  atlas?: AtlasInput;
  objDir: string;
  hra?: HraInput;
  outDir: string;
  /** meshes above `above` triangles are simplified to `target` at most (spec: 60 000 → 50 000) */
  simplify?: { above: number; target: number };
  /** build warnings (a muscle role its length change contradicts) */
  onWarning?: (message: string) => void;
}

export async function buildAssets({ atlases, atlas, objDir, hra, outDir, simplify = { above: 60_000, target: 50_000 }, onWarning = () => {} }: BuildOptions): Promise<Manifest> {
  const models: Record<string, AtlasInput> = atlases ?? { male: atlas! };
  // Instances of every model; identical ones (same name and meshes) are shared.
  const byKey = new Map<string, Instance>();
  const modelKeys: Record<string, Set<string>> = {};
  const keyOf = (i: Instance) => `${i.name}|${i.meshes.join(',')}`;
  for (const [model, a] of Object.entries(models)) {
    modelKeys[model] = new Set();
    for (const i of listInstances(a)) { byKey.set(keyOf(i), i); modelKeys[model].add(keyOf(i)); }
  }
  const instances = [...byKey.values()].sort((a, b) => cmp(fileOf(a), fileOf(b)) || cmp(a.name, b.name));

  const geometry = await loadGeometry(instances.flatMap((i) => i.meshes), { objDir, hra, simplify });
  const outputs = await encodeGlbs(instances, geometry);

  // Content-addressed names: a file changes name exactly when its content changes.
  const manifest: Manifest = { kinds: {}, models: {}, totalBytes: 0 };
  for (const [kind, bytes, count] of outputs) {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    manifest.kinds[kind] = { bytes: bytes.length, file: `${kind}.${sha256.slice(0, 8)}.glb`, instances: count, sha256 };
    manifest.totalBytes += bytes.length;
  }
  for (const [model, keys] of Object.entries(modelKeys).sort(([a], [b]) => cmp(a, b))) {
    const kinds = [...new Set([...keys].map((k) => fileOf(byKey.get(k)!)))].sort(cmp);
    manifest.models[model] = { kinds, totalBytes: kinds.reduce((n, k) => n + manifest.kinds[k].bytes, 0) };
    const joints = rigsOf(models[model], [...keys].map((k) => byKey.get(k)!).sort((a, b) => cmp(a.name, b.name)), geometry, onWarning);
    if (joints) manifest.models[model].joints = joints;
  }
  mkdirSync(outDir, { recursive: true });
  const keep = new Set(Object.values(manifest.kinds).map((k) => k.file));
  for (const f of readdirSync(outDir)) if (f.endsWith('.glb') && !keep.has(f)) rmSync(join(outDir, f));
  for (const [kind, bytes] of outputs) writeFileSync(join(outDir, manifest.kinds[kind].file), bytes);
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
