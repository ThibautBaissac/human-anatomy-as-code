// Downloads the HRA files listed in data/import/hra-files.yaml, pinned by sha256.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { parseDocument } from 'yaml';
import { extractNodes } from './glb-range.ts';

interface OrganEntry { id: string; version: string; file: string; sha256?: string; crosswalkSha256?: string }
interface UnitedEntry { id: string; version: string; file: string; nodes: string[]; extractedContentSha256?: string }
interface HraFiles { baseUrl: string; release: string; organs: OrganEntry[]; united?: UnitedEntry }

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

type Content = { name: string; positions: ArrayLike<number>; indices: ArrayLike<number>; extras: Record<string, unknown> };
const sortKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])])) : v;

/**
 * Hash of the extracted nodes' content: names, extras, float32 positions, uint32 indices, nodes sorted by name.
 * Independent of how the GLB is serialised (gltf-transform version, buffer layout, generator).
 */
export function contentSha256(nodes: Content[]): string {
  const h = createHash('sha256');
  for (const n of [...nodes].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    h.update(`${n.name}\0${JSON.stringify(sortKeys(n.extras ?? {}))}\0`);
    h.update(new Uint8Array(Float32Array.from(n.positions).buffer));
    h.update(new Uint8Array(Uint32Array.from(n.indices).buffer));
  }
  return h.digest('hex');
}

/** Content of a GLB written by hraFetch: one primitive per node. */
async function readContent(path: string): Promise<Content[]> {
  const doc = await new NodeIO().read(path);
  return doc.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => {
    const prim = n.getMesh()!.listPrimitives()[0];
    return { name: n.getName(), positions: prim.getAttribute('POSITION')!.getArray()!, indices: prim.getIndices()!.getArray()!, extras: n.getExtras() };
  });
}

/** Downloads `url` to `path` unless a file matching the pinned hash is already there; returns the hash. */
async function download(url: string, path: string, pinned: string | undefined): Promise<string> {
  if (pinned && existsSync(path) && sha256(readFileSync(path)) === pinned) return pinned;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const hash = sha256(bytes);
  if (pinned && hash !== pinned) throw new Error(`sha256 inattendu pour ${url.split('/').pop()} : ${hash} au lieu de ${pinned}`);
  writeFileSync(path, bytes);
  return hash;
}

export async function hraFetch({ listPath, outDir }: { listPath: string; outDir: string }): Promise<void> {
  const doc = parseDocument(readFileSync(listPath, 'utf8'));
  const conf = doc.toJS() as HraFiles;
  const assetsUrl = (id: string, version: string, file: string) => `${conf.baseUrl}/${id}/${version}/assets/${file}`;
  for (const [i, o] of conf.organs.entries()) {
    mkdirSync(join(outDir, o.id), { recursive: true });
    const h = await download(assetsUrl(o.id, o.version, o.file), join(outDir, o.id, o.file), o.sha256);
    const x = await download(assetsUrl(o.id, o.version, 'crosswalk.csv'), join(outDir, o.id, 'crosswalk.csv'), o.crosswalkSha256);
    if (!o.sha256) doc.setIn(['organs', i, 'sha256'], h);
    if (!o.crosswalkSha256) doc.setIn(['organs', i, 'crosswalkSha256'], x);
  }
  if (conf.united) {
    const u = conf.united;
    const path = join(outDir, u.id, 'extracted-united.glb');
    if (!(u.extractedContentSha256 && existsSync(path) && contentSha256(await readContent(path)) === u.extractedContentSha256)) {
      const nodes = await extractNodes(assetsUrl(u.id, u.version, u.file), u.nodes);
      const out = new Document();
      const buffer = out.createBuffer();
      const scene = out.createScene(u.id);
      for (const n of nodes) {
        const prim = out.createPrimitive()
          .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(n.positions).setBuffer(buffer))
          .setIndices(out.createAccessor().setType('SCALAR').setArray(n.indices).setBuffer(buffer));
        scene.addChild(out.createNode(n.name).setMesh(out.createMesh(n.name).addPrimitive(prim)).setExtras(n.extras));
      }
      mkdirSync(join(outDir, u.id), { recursive: true });
      const hash = contentSha256(nodes);
      if (u.extractedContentSha256 && hash !== u.extractedContentSha256) throw new Error(`contenu inattendu pour extracted-united.glb : ${hash} au lieu de ${u.extractedContentSha256}`);
      writeFileSync(path, await new NodeIO().writeBinary(out));
      if (!u.extractedContentSha256) doc.setIn(['united', 'extractedContentSha256'], hash);
    }
  }
  writeFileSync(listPath, doc.toString({ lineWidth: 0 }));
}
