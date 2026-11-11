import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { buildAssets } from '../src/build-assets.ts';

// A tetrahedron shifted by `dx`: 4 vertices, 4 triangles.
const tetra = (dx = 0) => [
  `v ${dx} 0 0`, `v ${dx + 1} 0 0`, `v ${dx} 1 0`, `v ${dx} 0 1`,
  'f 1 3 2', 'f 1 2 4', 'f 1 4 3', 'f 2 3 4',
].join('\n') + '\n';

const lbl = (text: string) => ({ en: { text, source: 'fma', status: 'draft' } });
const ATLAS = {
  structures: [
    { slug: 'common-carotid-artery', kind: 'artery', laterality: 'bilateral', labels: lbl('common carotid artery'),
      sides: { left: { meshes: ['bp3d:FJ2M', 'bp3d:FJ3M'] }, right: { meshes: ['bp3d:FJ2'] } } },
    { slug: 'biceps-brachii', kind: 'muscle', laterality: 'bilateral', labels: lbl('biceps brachii'),
      sides: { left: { meshes: ['bp3d:FJ5M'] }, right: {} } },
    { slug: 'femur', kind: 'bone', laterality: 'bilateral', labels: lbl('femur'),
      sides: { left: { meshes: ['bp3d:FJ1M'] }, right: { meshes: ['bp3d:FJ1'] } } },
    { slug: 'heart', kind: 'organ', laterality: 'midline', labels: lbl('heart'), meshes: ['bp3d:FJ4'] },
    { slug: 'human-body', kind: 'group', laterality: 'midline', labels: lbl('human body') },
  ],
};

function fixture(skip: string[] = [], empty: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'assets-'));
  const objDir = join(root, 'obj');
  mkdirSync(join(objDir, 'nested'), { recursive: true });
  const files: Record<string, number> = { FJ1: 0, FJ1M: 5, FJ2: 0, FJ2M: 0, FJ3M: 3, FJ4: 0, FJ5M: 0 };
  for (const [fj, dx] of Object.entries(files)) {
    if (skip.includes(fj)) continue;
    writeFileSync(join(objDir, fj === 'FJ4' ? 'nested' : '', `${fj}.obj`), empty.includes(fj) ? 'v 0 0 0\n' : tetra(dx));
  }
  return { objDir, outDir: join(root, 'out') };
}

async function readGlb(path: string) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(path);
  return doc.getRoot().listNodes().map((n) => {
    const prim = n.getMesh()!.listPrimitives()[0];
    return { name: n.getName(), extras: n.getExtras(), vertices: prim.getAttribute('POSITION')!.getCount(), triangles: prim.getIndices()!.getCount() / 3 };
  });
}

test('one GLB per kind with instances, none for group', async () => {
  const { objDir, outDir } = fixture();
  await buildAssets({ atlas: ATLAS, objDir, outDir });
  const files = readdirSync(outDir).sort();
  assert.equal(files.length, 5);
  assert.ok(files.includes('manifest.json'));
  for (const k of ['artery', 'bone', 'muscle', 'organ']) assert.ok(files.some((f) => new RegExp(`^${k}\\.[0-9a-f]{8}\\.glb$`).test(f)), k);
});

test('nodes are named slug or slug@side, sorted, with extras; meshes of one side are merged', async () => {
  const { objDir, outDir } = fixture();
  await buildAssets({ atlas: ATLAS, objDir, outDir });
  const m = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
  const artery = await readGlb(join(outDir, m.kinds.artery.file));
  assert.deepEqual(artery.map((n) => n.name), ['common-carotid-artery@left', 'common-carotid-artery@right']);
  assert.deepEqual(artery[0].extras, { slug: 'common-carotid-artery', side: 'left', meshes: ['bp3d:FJ2M', 'bp3d:FJ3M'] });
  assert.equal(artery[0].vertices, 8);
  assert.equal(artery[0].triangles, 8);
  assert.equal(artery[1].triangles, 4);
  const organ = await readGlb(join(outDir, m.kinds.organ.file));
  assert.deepEqual(organ.map((n) => [n.name, n.extras]), [['heart', { slug: 'heart', side: null, meshes: ['bp3d:FJ4'] }]]);
  const muscle = await readGlb(join(outDir, m.kinds.muscle.file));
  assert.deepEqual(muscle.map((n) => n.name), ['biceps-brachii@left']);
});

test('the manifest lists file, bytes, sha256 and instance count per kind, keys sorted', async () => {
  const { objDir, outDir } = fixture();
  const manifest = await buildAssets({ atlas: ATLAS, objDir, outDir });
  const onDisk = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
  assert.deepEqual(onDisk, manifest);
  assert.deepEqual(Object.keys(manifest.kinds), ['artery', 'bone', 'muscle', 'organ']);
  assert.equal('source' in manifest, false); // provenance lives in the atlas attributions
  const bone = manifest.kinds.bone;
  const bytes = readFileSync(join(outDir, bone.file));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.deepEqual(bone, { file: `bone.${sha256.slice(0, 8)}.glb`, bytes: bytes.length, sha256, instances: 2 });
  assert.equal(manifest.totalBytes, Object.values(manifest.kinds).reduce((n, k) => n + k.bytes, 0));
});

test('two builds of the same inputs give identical bytes', async () => {
  const a = fixture(), b = fixture();
  const ma = await buildAssets({ atlas: ATLAS, ...a });
  const mb = await buildAssets({ atlas: ATLAS, ...b });
  assert.deepEqual(ma, mb);
});

test('missing OBJ files fail the build with the full list, and nothing is written', async () => {
  const { objDir, outDir } = fixture(['FJ4', 'FJ3M']);
  await assert.rejects(buildAssets({ atlas: ATLAS, objDir, outDir }), (e: Error) => /FJ3M/.test(e.message) && /FJ4/.test(e.message));
  assert.equal(existsSync(outDir), false);
});

test('an OBJ without triangles is an error too', async () => {
  const { objDir, outDir } = fixture([], ['FJ1']);
  await assert.rejects(buildAssets({ atlas: ATLAS, objDir, outDir }), /FJ1\b/);
  assert.equal(existsSync(outDir), false);
});

test('a rebuild after one OBJ changed renames only that kind and removes the old file', async () => {
  const { objDir, outDir } = fixture();
  const before = await buildAssets({ atlas: ATLAS, objDir, outDir });
  writeFileSync(join(objDir, 'nested', 'FJ4.obj'), tetra(7)); // heart → organ
  const after = await buildAssets({ atlas: ATLAS, objDir, outDir });
  assert.notEqual(after.kinds.organ.file, before.kinds.organ.file);
  for (const k of ['artery', 'bone', 'muscle']) assert.equal(after.kinds[k].file, before.kinds[k].file);
  assert.deepEqual(readdirSync(outDir).filter((f) => f.endsWith('.glb')).sort(), Object.values(after.kinds).map((k) => k.file).sort());
});

test('faceted meshes of the refined kinds are drawn refined (×4 triangles), others as they are; refine: false keeps them all', async () => {
  const { objDir, outDir } = fixture();
  let report: { meshes: number; trianglesBefore: number; trianglesAfter: number } | undefined;
  await buildAssets({ atlas: ATLAS, objDir, outDir, onRefined: (r) => { report = r; } });
  const m = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
  // tetrahedra are as faceted as can be: bone, muscle and organ refined, artery not
  assert.deepEqual((await readGlb(join(outDir, m.kinds.bone.file))).map((n) => n.triangles), [16, 16]);
  assert.deepEqual((await readGlb(join(outDir, m.kinds.organ.file))).map((n) => n.triangles), [16]);
  assert.deepEqual((await readGlb(join(outDir, m.kinds.artery.file))).map((n) => n.triangles), [8, 4]);
  assert.deepEqual(report, { meshes: 4, trianglesBefore: 16, trianglesAfter: 64 });

  const plain = fixture();
  await buildAssets({ atlas: ATLAS, objDir: plain.objDir, outDir: plain.outDir, refine: false });
  const p = JSON.parse(readFileSync(join(plain.outDir, 'manifest.json'), 'utf8'));
  assert.deepEqual((await readGlb(join(plain.outDir, p.kinds.bone.file))).map((n) => n.triangles), [4, 4]);
});
