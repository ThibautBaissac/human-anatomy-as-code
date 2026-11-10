// Geometry of every mesh reference: BodyParts3D OBJ files, HRA nodes registered into the BodyParts3D frame,
// welded and simplified when too heavy. Every mesh is read and checked before anything is written.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import { parse } from 'yaml';
import { apply, compose, HRA_TO_BP3D, type Mat4 } from '@haac/hra/register';
import { findObjFiles, parseObj } from './obj.ts';
import { cmp, HRA_PREFIX } from './instances.ts';

const PREFIX = 'bp3d:';
export type Geometry = { positions: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer> };

/** Where the HRA geometry lives and how to register it into the BodyParts3D frame. */
export interface HraInput {
  dir: string;
  /** data/import/hra-files.yaml */
  filesList: string;
  /** data/import/hra-registration.yaml (with computed results) */
  registration: string;
}

/** Positions in world space (node transforms applied) of every mesh node of a glTF file, by node name. */
async function readHraFile(path: string): Promise<Map<string, Geometry>> {
  const doc = await new NodeIO().read(path);
  const out = new Map<string, Geometry>();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    const pos: number[] = [], idx: number[] = [];
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION');
      if (!a) continue;
      const base = pos.length / 3;
      const v: number[] = [];
      for (let k = 0; k < a.getCount(); k++) {
        a.getElement(k, v);
        pos.push(m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]);
      }
      const ind = prim.getIndices();
      if (ind) for (let k = 0; k < ind.getCount(); k++) idx.push(ind.getScalar(k) + base);
      else for (let k = 0; k < a.getCount(); k++) idx.push(k + base);
    }
    out.set(node.getName(), { positions: new Float32Array(pos), indices: new Uint32Array(idx) });
  }
  return out;
}

/** Merges vertices that share a position (HRA meshes are unwelded: every edge would look like a border). */
function weld(g: Geometry): Geometry {
  const remap = MeshoptSimplifier.generatePositionRemap(g.positions, 3);
  const index = new Int32Array(remap.length).fill(-1);
  const pos: number[] = [];
  for (let v = 0; v < remap.length; v++) {
    const r = remap[v];
    if (index[r] < 0) { index[r] = pos.length / 3; pos.push(g.positions[r * 3], g.positions[r * 3 + 1], g.positions[r * 3 + 2]); }
    index[v] = index[r];
  }
  return { positions: new Float32Array(pos), indices: g.indices.map((v) => index[v]) as Uint32Array<ArrayBuffer> };
}

/** Simplifies to `target` triangles at most: 1 % relative error first, relaxed only if the target is not reached. */
function simplifyTo(source: Geometry, target: number, ref: string): Geometry {
  const g = weld(source);
  let indices: Uint32Array = g.indices;
  for (const error of [0.01, 0.02, 0.05, 0.1, 0.25, 1]) {
    [indices] = MeshoptSimplifier.simplify(g.indices, g.positions, 3, target * 3, error, ['LockBorder']);
    if (indices.length <= target * 3) break;
  }
  if (indices.length > target * 3) throw new Error(`${ref} : simplification impossible sous ${target} triangles (${indices.length / 3} restants)`);
  // drop the vertices no triangle uses any more
  const remap = new Int32Array(g.positions.length / 3).fill(-1);
  const pos: number[] = [];
  const out = new Uint32Array(indices.length);
  indices.forEach((v, i) => {
    if (remap[v] < 0) { remap[v] = pos.length / 3; pos.push(g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]); }
    out[i] = remap[v];
  });
  return { positions: new Float32Array(pos), indices: out };
}

/** Reads every referenced mesh (bp3d:FJ…, hra:organ/node); throws with the full list of missing or empty ones. */
export async function loadGeometry(refs: Iterable<string>, { objDir, hra, simplify }: { objDir: string; hra?: HraInput; simplify: { above: number; target: number } }): Promise<Map<string, Geometry>> {
  const files = findObjFiles(objDir);
  // HRA: organ → geometry file, organ → registration matrix (region result ∘ base transform).
  const hraFiles = new Map<string, string>();
  const hraMatrix = new Map<string, Mat4>();
  if (hra) {
    const list = parse(readFileSync(hra.filesList, 'utf8')) as { organs: { id: string; file: string }[]; united?: { id: string } };
    for (const o of list.organs) hraFiles.set(o.id, join(hra.dir, o.id, o.file));
    if (list.united) hraFiles.set(list.united.id, join(hra.dir, list.united.id, 'extracted-united.glb'));
    const reg = parse(readFileSync(hra.registration, 'utf8')) as { regions: Record<string, { organs: string[]; result?: { matrix: Mat4 } }> };
    for (const [name, r] of Object.entries(reg.regions)) {
      if (!r.result) throw new Error(`recalage : la région « ${name} » n'a pas de résultat (lancer npm run -w tools/hra register)`);
      for (const organ of r.organs) hraMatrix.set(organ, compose(r.result.matrix, HRA_TO_BP3D));
    }
  }
  const hraCache = new Map<string, Map<string, Geometry>>();

  const missing: string[] = [];
  const empty: string[] = [];
  const geometry = new Map<string, Geometry>();
  await MeshoptSimplifier.ready;
  for (const ref of new Set(refs)) {
    if (ref.startsWith(HRA_PREFIX)) {
      const [organ, node] = ref.slice(HRA_PREFIX.length).split('/');
      const path = hraFiles.get(organ), matrix = hraMatrix.get(organ);
      if (!path || !matrix) { missing.push(ref); continue; }
      if (!hraCache.has(path)) {
        try { hraCache.set(path, await readHraFile(path)); } catch (e) { throw new Error(`${path} : lecture impossible (${(e as Error).message})`); }
      }
      const g = hraCache.get(path)!.get(node);
      if (!g) { missing.push(ref); continue; }
      if (!g.indices.length) { empty.push(ref); continue; }
      const p = new Float32Array(g.positions.length);
      for (let k = 0; k < p.length; k += 3) p.set(apply(matrix, [g.positions[k], g.positions[k + 1], g.positions[k + 2]]), k);
      const placed = { positions: p, indices: g.indices };
      geometry.set(ref, placed.indices.length / 3 > simplify.above ? simplifyTo(placed, simplify.target, ref) : placed);
      continue;
    }
    const id = ref.startsWith(PREFIX) ? ref.slice(PREFIX.length) : ref;
    const path = files.get(id);
    if (!path) { missing.push(id); continue; }
    const g = parseObj(path);
    if (!g.indices.length) { empty.push(id); continue; }
    geometry.set(ref, g);
  }
  if (missing.length || empty.length) {
    const parts = [];
    if (missing.length) parts.push(`meshes introuvables (${missing.length}) : ${missing.sort(cmp).join(', ')}`);
    if (empty.length) parts.push(`meshes sans triangle (${empty.length}) : ${empty.sort(cmp).join(', ')}`);
    throw new Error(parts.join(' ; '));
  }

  return geometry;
}
