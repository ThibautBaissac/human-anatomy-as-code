import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { stringify } from 'yaml';
import { buildAssets } from '../src/build-assets.ts';

const tetra = (dx = 0) => [`v ${dx} 0 0`, `v ${dx + 1} 0 0`, `v ${dx} 1 0`, `v ${dx} 0 1`, 'f 1 3 2', 'f 1 2 4', 'f 1 4 3', 'f 2 3 4'].join('\n') + '\n';
const lbl = (t: string) => ({ en: { text: t, source: 'fma', status: 'draft' } });

/** Like grid(), but every triangle has its own three vertices (unwelded, as in the HRA files). */
function unweldedGrid(n: number) {
  const g = grid(n);
  const pos: number[] = [];
  for (const i of g.idx) pos.push(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]);
  return { pos: new Float32Array(pos) as Float32Array<ArrayBuffer>, idx: new Uint32Array(pos.length / 3).map((_, i) => i) as Uint32Array<ArrayBuffer> };
}

/** A grid of n×n quads (2n² triangles), in metres, in the glTF frame (Y up). */
function grid(n: number) {
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pos.push(i / n * 0.01, Math.sin(i / 3) * 0.001, j / n * 0.01);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
  return { pos: new Float32Array(pos) as Float32Array<ArrayBuffer>, idx: new Uint32Array(idx) as Uint32Array<ArrayBuffer> };
}

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'assets-f-'));
  const objDir = join(root, 'obj'), hraDir = join(root, 'hra'), dataDir = join(root, 'data');
  mkdirSync(objDir, { recursive: true });
  for (const fj of ['FJ1', 'FJ1M', 'FJ2', 'FJ3']) writeFileSync(join(objDir, `${fj}.obj`), tetra());
  // HRA uterus: one small triangle node, one big grid node (to be simplified)
  const doc = new Document(); const buffer = doc.createBuffer();
  const prim = (pos: Float32Array<ArrayBuffer>, idx: Uint32Array<ArrayBuffer>) => doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer));
  const g = unweldedGrid(40); // 3 200 triangles, 9 600 vertices
  const parent = doc.createNode('VH_F_uterus').setTranslation([0.001, 0, 0]);
  parent.addChild(doc.createNode('VH_F_cervix').setMesh(doc.createMesh('c').addPrimitive(prim(new Float32Array([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0]), new Uint32Array([0, 1, 2])))));
  parent.addChild(doc.createNode('VH_F_body_of_uterus').setMesh(doc.createMesh('b').addPrimitive(prim(g.pos, g.idx))));
  doc.createScene().addChild(parent);
  mkdirSync(join(hraDir, 'uterus-female'), { recursive: true });
  writeFileSync(join(hraDir, 'uterus-female/3d-vh-f-uterus.glb'), await new NodeIO().writeBinary(doc));
  const b2 = new Document(); const bb = b2.createBuffer();
  b2.createScene().addChild(b2.createNode('VH_F_dome').setMesh(b2.createMesh('d').addPrimitive(b2.createPrimitive()
    .setAttribute('POSITION', b2.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0.02, 0, 0, 0, 0.02, 0])).setBuffer(bb))
    .setIndices(b2.createAccessor().setType('SCALAR').setArray(new Uint32Array([0, 1, 2])).setBuffer(bb)))));
  mkdirSync(join(hraDir, 'urinary-bladder-female'), { recursive: true });
  writeFileSync(join(hraDir, 'urinary-bladder-female/3d-vh-f-urinary-bladder.glb'), await new NodeIO().writeBinary(b2));
  mkdirSync(join(dataDir, 'import'), { recursive: true });
  const filesList = join(dataDir, 'import/hra-files.yaml');
  writeFileSync(filesList, stringify({ baseUrl: 'x', release: 't', organs: [
    { id: 'uterus-female', version: 'v1', file: '3d-vh-f-uterus.glb', doi: '10.1/u' },
    { id: 'urinary-bladder-female', version: 'v1', file: '3d-vh-f-urinary-bladder.glb', doi: '10.1/b' },
  ] }));
  // registration: pelvic region = scale 2 + translation (0, 0, 800) mm
  const registration = join(dataDir, 'import/hra-registration.yaml');
  writeFileSync(registration, stringify({ maxRmsMm: 25, regions: { pelvic: { fit: 'similarity', organs: ['uterus-female', 'urinary-bladder-female'], landmarks: [],
    result: { matrix: [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 800, 0, 0, 0, 1] } } } }));
  const shared = [
    { slug: 'femur', kind: 'bone', sides: { left: { meshes: ['bp3d:FJ1M'] }, right: { meshes: ['bp3d:FJ1'] } } },
  ];
  const male = { structures: [...shared,
    { slug: 'urinary-bladder', kind: 'organ', meshes: ['bp3d:FJ2'] },
    { slug: 'prostate', kind: 'organ', meshes: ['bp3d:FJ3'] },
  ] };
  const female = { structures: [...shared,
    { slug: 'urinary-bladder', kind: 'organ', meshes: ['hra:urinary-bladder-female/VH_F_dome'] },
    { slug: 'uterine-cervix', kind: 'organ', meshes: ['hra:uterus-female/VH_F_cervix'] },
    { slug: 'body-of-uterus', kind: 'organ', meshes: ['hra:uterus-female/VH_F_body_of_uterus'] },
  ] };
  return { objDir, hra: { dir: hraDir, filesList, registration }, outDir: join(root, 'out'), atlases: { male, female } };
}

async function nodes(path: string) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(path);
  return Object.fromEntries(doc.getRoot().listNodes().map((n) => {
    const p = n.getMesh()!.listPrimitives()[0];
    const pos = p.getAttribute('POSITION')!;
    const m = n.getWorldMatrix();
    const v = pos.getElement(0, []);
    const w = [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
    return [n.getName(), { triangles: p.getIndices()!.getCount() / 3, first: w, extras: n.getExtras() }];
  }));
}

test('shared instances stay in the kind files; HRA instances go to female-<kind> files', async () => {
  const f = await fixture();
  const manifest = await buildAssets({ atlases: f.atlases, objDir: f.objDir, hra: f.hra, outDir: f.outDir });
  assert.deepEqual(Object.keys(manifest.kinds), ['bone', 'female-organ', 'organ']);
  const organ = await nodes(join(f.outDir, manifest.kinds.organ.file));
  assert.deepEqual(Object.keys(organ).sort(), ['prostate', 'urinary-bladder']);
  const fem = await nodes(join(f.outDir, manifest.kinds['female-organ'].file));
  assert.deepEqual(Object.keys(fem).sort(), ['body-of-uterus', 'urinary-bladder', 'uterine-cervix']);
  assert.deepEqual(fem['uterine-cervix'].extras, { slug: 'uterine-cervix', side: null, meshes: ['hra:uterus-female/VH_F_cervix'] });
});

test('the manifest lists the files of each model and their total size', async () => {
  const f = await fixture();
  const m = await buildAssets({ atlases: f.atlases, objDir: f.objDir, hra: f.hra, outDir: f.outDir });
  assert.deepEqual(m.models.male.kinds, ['bone', 'organ']);
  // every organ of the female fixture comes from the HRA: the shared organ file is not needed
  assert.deepEqual(m.models.female.kinds, ['bone', 'female-organ']);
  assert.equal(m.models.female.totalBytes, m.kinds.bone.bytes + m.kinds['female-organ'].bytes);
  assert.equal(m.totalBytes, m.kinds.bone.bytes + m.kinds['female-organ'].bytes + m.kinds.organ.bytes);
});

test('HRA geometry: glTF node transform, then metres → mm with Z up, then the region matrix', async () => {
  const f = await fixture();
  const m = await buildAssets({ atlases: f.atlases, objDir: f.objDir, hra: f.hra, outDir: f.outDir });
  const fem = await nodes(join(f.outDir, m.kinds['female-organ'].file));
  // cervix vertex 0 = (0,0,0) + node translation (0.001,0,0) m → (1, 0, 0) mm → ×2 + (0,0,800) = (2, 0, 800)
  fem['uterine-cervix'].first.forEach((v: number, i: number) => assert.ok(Math.abs(v - [2, 0, 800][i]) < 0.05, `${fem['uterine-cervix'].first}`));
});

test('meshes over the threshold are simplified to the target triangle count', async () => {
  const f = await fixture();
  const m = await buildAssets({ atlases: f.atlases, objDir: f.objDir, hra: f.hra, outDir: f.outDir, simplify: { above: 2000, target: 1000 } });
  const fem = await nodes(join(f.outDir, m.kinds['female-organ'].file));
  assert.ok(fem['body-of-uterus'].triangles <= 1000, `${fem['body-of-uterus'].triangles}`);
  assert.ok(fem['body-of-uterus'].triangles >= 100);
  assert.equal(fem['uterine-cervix'].triangles, 1);
});
