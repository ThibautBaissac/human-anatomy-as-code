// Downloads the HRA files listed in data/import/hra-files.yaml, pinned by sha256.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { parseDocument } from 'yaml';
import { extractNodes } from './glb-range.ts';

interface OrganEntry { id: string; version: string; file: string; sha256?: string; crosswalkSha256?: string }
interface UnitedEntry { id: string; version: string; file: string; nodes: string[]; extractedSha256?: string }
interface HraFiles { baseUrl: string; release: string; organs: OrganEntry[]; united?: UnitedEntry }

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

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
    if (!(u.extractedSha256 && existsSync(path) && sha256(readFileSync(path)) === u.extractedSha256)) {
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
      const bytes = await new NodeIO().writeBinary(out);
      const hash = sha256(bytes);
      if (u.extractedSha256 && hash !== u.extractedSha256) throw new Error(`sha256 inattendu pour extracted-united.glb : ${hash} au lieu de ${u.extractedSha256}`);
      writeFileSync(path, bytes);
      if (!u.extractedSha256) doc.setIn(['united', 'extractedSha256'], hash);
    }
  }
  writeFileSync(listPath, doc.toString({ lineWidth: 0 }));
}
