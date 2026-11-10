import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { stringify, parse } from 'yaml';
import { extractNodes } from '../src/glb-range.ts';
import { hraFetch } from '../src/fetch.ts';
import { serve } from './server.ts';

/** An uncompressed GLB like the HRA ones: a parent node with a translation and two child meshes. */
async function makeGlb(path: string) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const tri = (dx: number) => doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array([dx, 0, 0, dx + 1, 0, 0, dx, 1, 0])).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2])).setBuffer(buffer));
  const parent = doc.createNode('group').setTranslation([10, 0, 0]);
  parent.addChild(doc.createNode('VH_F_vagina').setMesh(doc.createMesh('a').addPrimitive(tri(0))).setExtras({ ontologyid: 'UBERON:0000996', label: 'vagina' }));
  parent.addChild(doc.createNode('VH_F_other').setMesh(doc.createMesh('b').addPrimitive(tri(5))));
  doc.createScene().addChild(parent);
  writeFileSync(path, await new NodeIO().writeBinary(doc));
}

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hra-'));
  mkdirSync(join(root, 'cdn/uterus-female/v1.2/assets'), { recursive: true });
  mkdirSync(join(root, 'cdn/united-female/v1.10/assets'), { recursive: true });
  await makeGlb(join(root, 'cdn/uterus-female/v1.2/assets/3d-vh-f-uterus.glb'));
  writeFileSync(join(root, 'cdn/uterus-female/v1.2/assets/crosswalk.csv'), 'node,ontologyid\nVH_F_uterus,UBERON:0000995\n');
  await makeGlb(join(root, 'cdn/united-female/v1.10/assets/3d-vh-f-united.glb'));
  const server = await serve(join(root, 'cdn'));
  const list = join(root, 'hra-files.yaml');
  writeFileSync(list, '# HRA files\n' + stringify({
    baseUrl: server.url, release: 'test',
    organs: [{ id: 'uterus-female', version: 'v1.2', file: '3d-vh-f-uterus.glb' }],
    united: { id: 'united-female', version: 'v1.10', file: '3d-vh-f-united.glb', nodes: ['VH_F_vagina'] },
  }));
  return { root, server, list, out: join(root, 'raw') };
}

test('extractNodes reads only the requested nodes through HTTP ranges, in world coordinates', async () => {
  const { server } = await fixture();
  try {
    const [n] = await extractNodes(`${server.url}/united-female/v1.10/assets/3d-vh-f-united.glb`, ['VH_F_vagina']);
    assert.equal(n.name, 'VH_F_vagina');
    assert.deepEqual(n.extras, { ontologyid: 'UBERON:0000996', label: 'vagina' });
    assert.deepEqual([...n.positions], [10, 0, 0, 11, 0, 0, 10, 1, 0]);
    assert.deepEqual([...n.indices], [0, 1, 2]);
    await assert.rejects(extractNodes(`${server.url}/united-female/v1.10/assets/3d-vh-f-united.glb`, ['VH_F_nope']), /VH_F_nope/);
  } finally { await server.close(); }
});

test('hraFetch downloads organs and crosswalks, extracts the united nodes, and pins sha256 on first fetch', async () => {
  const { server, list, out } = await fixture();
  try {
    await hraFetch({ listPath: list, outDir: out });
    assert.ok(readFileSync(join(out, 'uterus-female/3d-vh-f-uterus.glb')).length > 0);
    assert.match(readFileSync(join(out, 'uterus-female/crosswalk.csv'), 'utf8'), /UBERON:0000995/);
    const extracted = await new NodeIO().read(join(out, 'united-female/extracted-united.glb'));
    assert.deepEqual(extracted.getRoot().listNodes().map((n) => n.getName()), ['VH_F_vagina']);
    const pinned = parse(readFileSync(list, 'utf8'));
    assert.match(pinned.organs[0].sha256, /^[0-9a-f]{64}$/);
    assert.match(pinned.organs[0].crosswalkSha256, /^[0-9a-f]{64}$/);
    assert.match(readFileSync(list, 'utf8'), /^# HRA files/, 'comments preserved');
    // second run: files already there and matching → no new organ download
    const before = server.hits.get('/uterus-female/v1.2/assets/3d-vh-f-uterus.glb');
    await hraFetch({ listPath: list, outDir: out });
    assert.equal(server.hits.get('/uterus-female/v1.2/assets/3d-vh-f-uterus.glb'), before);
  } finally { await server.close(); }
});

test('hraFetch rejects a file whose sha256 differs from the pinned one', async () => {
  const { server, list, out } = await fixture();
  try {
    const conf = parse(readFileSync(list, 'utf8'));
    conf.organs[0].sha256 = '0'.repeat(64);
    writeFileSync(list, stringify(conf));
    await assert.rejects(hraFetch({ listPath: list, outDir: out }), /sha256.*3d-vh-f-uterus\.glb/);
  } finally { await server.close(); }
});

test('the extracted file is pinned by its content (names, vertices, triangles, extras), not by its bytes', async () => {
  const { server, list, out } = await fixture();
  try {
    await hraFetch({ listPath: list, outDir: out });
    assert.match(parse(readFileSync(list, 'utf8')).united.extractedContentSha256, /^[0-9a-f]{64}$/);
    // the same content written differently (another gltf-transform version would do the same): no new extraction
    const path = join(out, 'united-female/extracted-united.glb');
    const io = new NodeIO();
    const doc = await io.read(path);
    doc.getRoot().getAsset().generator = 'another writer';
    writeFileSync(path, await io.writeBinary(doc));
    const before = server.hits.get('/united-female/v1.10/assets/3d-vh-f-united.glb');
    await hraFetch({ listPath: list, outDir: out });
    assert.equal(server.hits.get('/united-female/v1.10/assets/3d-vh-f-united.glb'), before);
    // a content that differs from the pin is an error
    const conf = parse(readFileSync(list, 'utf8'));
    conf.united.extractedContentSha256 = '0'.repeat(64);
    writeFileSync(list, stringify(conf));
    await assert.rejects(hraFetch({ listPath: list, outDir: out }), /contenu inattendu.*extracted-united\.glb/);
  } finally { await server.close(); }
});

test('a corrupt extracted file is extracted again, not a crash', async () => {
  const { server, list, out } = await fixture();
  try {
    await hraFetch({ listPath: list, outDir: out });
    const path = join(out, 'united-female/extracted-united.glb');
    writeFileSync(path, readFileSync(path).subarray(0, 100));
    await hraFetch({ listPath: list, outDir: out });
    const extracted = await new NodeIO().read(path);
    assert.deepEqual(extracted.getRoot().listNodes().map((n) => n.getName()), ['VH_F_vagina']);
  } finally { await server.close(); }
});
