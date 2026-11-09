import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAssets, type AtlasInput } from '../src/build-assets.ts';

/** OBJ of a box sampled every 5 mm (one face, so the mesh is not empty). */
function boxObj(x: [number, number], y: [number, number], z: [number, number]): string {
  const lines: string[] = [];
  const steps = (r: [number, number]) => { const s: number[] = []; for (let v = r[0]; v <= r[1]; v += 5) s.push(v); return s; };
  for (const a of steps(x)) for (const b of steps(y)) for (const c of steps(z)) lines.push(`v ${a} ${b} ${c}`);
  return lines.join('\n') + '\nf 1 2 3\n';
}

const lbl = (text: string) => ({ en: { text, source: 'fma', status: 'draft' } });
const bilateral = (slug: string, kind: string, fj: string, extra: object = {}) =>
  ({ slug, kind, laterality: 'bilateral', labels: lbl(slug), sides: { left: { meshes: [`bp3d:${fj}M`] }, right: { meshes: [`bp3d:${fj}`] } }, ...extra });
// the compiled atlas has more fields than buildAssets reads
const ATLAS = {
  structures: [
    { slug: 'upper-limb', kind: 'group', laterality: 'midline', labels: lbl('upper limb'), regions: ['upper-limb'] },
    bilateral('humerus', 'bone', 'FJ1', { parent: 'upper-limb' }),
    bilateral('ulna', 'bone', 'FJ2', { parent: 'upper-limb' }),
    // no region of its own: the limb comes from its parent
    bilateral('biceps', 'muscle', 'FJ3', { parent: 'upper-limb', actions: [{ joint: 'elbow-joint', role: 'extension', source: 'curated', status: 'draft' }] }),
    bilateral('hand', 'bone', 'FJ4', { parent: 'upper-limb' }),
  ],
  joints: [{
    slug: 'elbow-joint', motion: 'flexion-extension', proximal: 'humerus', moving: ['ulna'], rangeDeg: [0, 145], restDeg: 0,
    sides: { left: { centre: [0, 0, 0], axis: [-1, 0, 0], rmsMm: 1 }, right: { centre: [400, 0, 0], axis: [-1, 0, 0], rmsMm: 1 } },
  }],
} as unknown as AtlasInput;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'assets-joints-'));
  const objDir = join(root, 'obj');
  mkdirSync(objDir);
  const boxes: Record<string, [[number, number], [number, number], [number, number]]> = {
    FJ1: [[-5, 5], [-5, 5], [5, 300]], FJ2: [[-5, 5], [-5, 5], [-250, -5]], FJ3: [[-5, 5], [-30, -20], [-40, 250]], FJ4: [[-10, 10], [-10, 10], [-400, -260]],
  };
  for (const [fj, [x, y, z]] of Object.entries(boxes)) {
    writeFileSync(join(objDir, `${fj}M.obj`), boxObj(x, y, z));
    writeFileSync(join(objDir, `${fj}.obj`), boxObj([x[0] + 400, x[1] + 400], y, z));
  }
  return { objDir, outDir: join(root, 'out') };
}

test('the manifest carries, per model, the rig of each side of each joint', async () => {
  const warnings: string[] = [];
  const manifest = await buildAssets({ atlases: { male: ATLAS, female: ATLAS }, ...fixture(), onWarning: (w) => warnings.push(w) });
  for (const model of ['male', 'female']) {
    const left = manifest.models[model].joints!['elbow-joint@left'];
    assert.deepEqual(left.moving, ['hand@left', 'ulna@left']);
    assert.deepEqual(left.crossing, ['biceps@left']);
    assert.deepEqual(left.muscles.map((m) => [m.name, m.role]), [['biceps@left', 'extension']]);
    assert.deepEqual(manifest.models[model].joints!['elbow-joint@right'].moving, ['hand@right', 'ulna@right']);
  }
  // the biceps fixture shortens in flexion, so its declared extension role is reported (once per model and side)
  assert.equal(warnings.length, 4);
  assert.match(warnings[0], /biceps@left.*extension/);
});

test('an atlas without joints gives no rigs', async () => {
  const manifest = await buildAssets({ atlas: { structures: ATLAS.structures }, ...fixture() });
  assert.equal(manifest.models.male.joints, undefined);
});
