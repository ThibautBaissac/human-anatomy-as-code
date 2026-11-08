// atlas.json + BodyParts3D OBJ files → one meshopt-compressed GLB per kind, one node per structure-side.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { findObjFiles, mergeMeshes, parseObj, smoothNormals } from './obj.ts';

type Side = 'left' | 'right';
interface AtlasStructure {
  slug: string;
  kind: string;
  meshes?: string[];
  sides?: Partial<Record<Side, { meshes?: string[] }>>;
}
export interface AtlasInput {
  structures: AtlasStructure[];
}

export interface Instance {
  name: string;
  slug: string;
  side: Side | null;
  kind: string;
  meshes: string[];
}

export interface Manifest {
  kinds: Record<string, { bytes: number; file: string; instances: number; sha256: string }>;
  source: 'bodyparts3d';
  totalBytes: number;
}

const PREFIX = 'bp3d:';
const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** One instance per non-bilateral structure with meshes, one per side with meshes. */
export function listInstances(atlas: AtlasInput): Instance[] {
  const out: Instance[] = [];
  for (const s of atlas.structures) {
    if (s.meshes?.length) out.push({ name: s.slug, slug: s.slug, side: null, kind: s.kind, meshes: [...s.meshes].sort(byKey) });
    for (const side of ['left', 'right'] as const) {
      const m = s.sides?.[side]?.meshes;
      if (m?.length) out.push({ name: `${s.slug}@${side}`, slug: s.slug, side, kind: s.kind, meshes: [...m].sort(byKey) });
    }
  }
  return out.sort((a, b) => byKey(a.name, b.name));
}

export async function buildAssets({ atlas, objDir, outDir }: { atlas: AtlasInput; objDir: string; outDir: string }): Promise<Manifest> {
  const instances = listInstances(atlas);
  const files = findObjFiles(objDir);

  // Read and check every mesh before writing anything.
  const missing: string[] = [];
  const empty: string[] = [];
  const geometry = new Map<string, ReturnType<typeof parseObj>>();
  for (const ref of new Set(instances.flatMap((i) => i.meshes))) {
    const id = ref.startsWith(PREFIX) ? ref.slice(PREFIX.length) : ref;
    const path = files.get(id);
    if (!path) { missing.push(id); continue; }
    const g = parseObj(path);
    if (!g.indices.length) { empty.push(id); continue; }
    geometry.set(ref, g);
  }
  if (missing.length || empty.length) {
    const parts = [];
    if (missing.length) parts.push(`OBJ introuvables (${missing.length}) : ${missing.sort(byKey).join(', ')}`);
    if (empty.length) parts.push(`OBJ sans triangle (${empty.length}) : ${empty.sort(byKey).join(', ')}`);
    throw new Error(parts.join(' ; '));
  }

  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const byKind = new Map<string, Instance[]>();
  for (const i of instances) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);

  const outputs: [string, Uint8Array, number][] = [];
  for (const kind of [...byKind.keys()].sort(byKey)) {
    const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
    const buffer = doc.createBuffer();
    const scene = doc.createScene(kind);
    for (const inst of byKind.get(kind)!) {
      const { positions, indices } = mergeMeshes(inst.meshes.map((m) => geometry.get(m)!));
      const prim = doc.createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(smoothNormals(positions, indices)).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
      const node = doc.createNode(inst.name).setMesh(doc.createMesh(inst.name).addPrimitive(prim))
        .setExtras({ slug: inst.slug, side: inst.side, meshes: inst.meshes });
      scene.addChild(node);
    }
    await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    outputs.push([kind, await io.writeBinary(doc), byKind.get(kind)!.length]);
  }

  // Content-addressed names: a file changes name exactly when its content changes.
  const manifest: Manifest = { kinds: {}, source: 'bodyparts3d', totalBytes: 0 };
  for (const [kind, bytes, count] of outputs) {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    manifest.kinds[kind] = { bytes: bytes.length, file: `${kind}.${sha256.slice(0, 8)}.glb`, instances: count, sha256 };
    manifest.totalBytes += bytes.length;
  }
  mkdirSync(outDir, { recursive: true });
  const keep = new Set(Object.values(manifest.kinds).map((k) => k.file));
  for (const f of readdirSync(outDir)) if (f.endsWith('.glb') && !keep.has(f)) rmSync(join(outDir, f));
  for (const [kind, bytes] of outputs) writeFileSync(join(outDir, manifest.kinds[kind].file), bytes);
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
