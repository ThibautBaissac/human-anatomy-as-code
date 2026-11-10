import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, compose, computeRegions, fitSimilarity, fitTranslation, HRA_TO_BP3D, type Vec3 } from '../src/register.ts';

const close = (a: number[], b: number[], eps = 1e-6) => a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < eps, `${a} ≈ ${b}`));
const pts: Vec3[] = [[0, 0, 0], [100, 0, 0], [0, 80, 0], [0, 0, 60], [50, 40, 30], [-20, 10, 90]];

// Known similarity: scale 0.9, 30° about an oblique axis, translation (10, -20, 800).
function knownTransform(p: Vec3): Vec3 {
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const [ux, uy, uz] = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
  const R = [
    [c + ux * ux * (1 - c), ux * uy * (1 - c) - uz * s, ux * uz * (1 - c) + uy * s],
    [uy * ux * (1 - c) + uz * s, c + uy * uy * (1 - c), uy * uz * (1 - c) - ux * s],
    [uz * ux * (1 - c) - uy * s, uz * uy * (1 - c) + ux * s, c + uz * uz * (1 - c)],
  ];
  return [0, 1, 2].map((i) => 0.9 * (R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2]) + [10, -20, 800][i]) as Vec3;
}

test('base transform: glTF metres, Y up → BodyParts3D millimetres, Z up, Y posterior', () => {
  close(apply(HRA_TO_BP3D, [0.1, 0.2, 0.3]), [100, -300, 200]);
});

test('fitSimilarity recovers a known similarity with zero residual', () => {
  const fit = fitSimilarity(pts, pts.map(knownTransform));
  assert.ok(Math.abs(fit.scale - 0.9) < 1e-9);
  assert.ok(Math.abs(fit.rotationDeg - 30) < 1e-6);
  assert.ok(fit.rmsMm < 1e-6);
  close(apply(fit.matrix, [5, 6, 7]), knownTransform([5, 6, 7]));
});

test('fitSimilarity reports residuals when shapes differ', () => {
  const dst = pts.map(knownTransform);
  dst[4] = [dst[4][0] + 12, dst[4][1], dst[4][2]];
  const fit = fitSimilarity(pts, dst);
  assert.ok(fit.rmsMm > 1 && fit.maxMm > fit.rmsMm);
});

test('fitTranslation: a base transform followed by the mean offset of the landmark pairs', () => {
  const base = fitSimilarity(pts, pts.map(knownTransform)).matrix;
  const src: Vec3[] = [[0, 0, 100], [0, 0, 0]];
  const dst = src.map((p) => { const q = knownTransform(p); return [q[0] + 5, q[1] - 30, q[2] + 2] as Vec3; });
  const fit = fitTranslation(src, dst, base);
  close(apply(fit.matrix, [1, 2, 3]), (() => { const q = knownTransform([1, 2, 3]); return [q[0] + 5, q[1] - 30, q[2] + 2]; })());
  assert.ok(fit.rmsMm < 1e-6);
});

test('compose applies the right matrix first', () => {
  const m = compose(fitSimilarity(pts, pts.map(knownTransform)).matrix, HRA_TO_BP3D);
  close(apply(m, [0.005, 0.006, 0.007]), knownTransform([5, -7, 6]));
});

test('computeRegions: similarity and derived translation regions, manual adjust, threshold', () => {
  const lm = (name: string, hra: Vec3) => ({ name, hra, bp3d: knownTransform(hra) });
  const regions = computeRegions({
    pelvic: { fit: 'similarity', organs: ['uterus-female'], landmarks: pts.map((p, i) => lm(`p${i}`, p)), adjust: [0, 0, 1] },
    thoracic: { fit: 'translation', from: 'pelvic', organs: ['mammary-gland-female-left'], landmarks: [lm('a', [0, 0, 500]), lm('b', [0, 10, 400])] },
  }, 25);
  close(apply(regions.pelvic.matrix, [1, 1, 1]), (() => { const q = knownTransform([1, 1, 1]); return [q[0], q[1], q[2] + 1]; })());
  assert.equal(regions.pelvic.ok, true);
  assert.ok(regions.thoracic.rmsMm < 1e-6);
  const bad = computeRegions({ pelvic: { fit: 'similarity', organs: [], landmarks: pts.map((p, i) => ({ name: `p${i}`, hra: p, bp3d: [p[0] * (i % 2 ? 3 : 1), p[1], p[2]] as Vec3 })) } }, 25);
  assert.equal(bad.pelvic.ok, false);
});

test('registerFile writes each region result back into the YAML, keeping comments, and reports failures', async () => {
  const { registerFile } = await import('../src/register-file.ts');
  const { mkdtempSync, readFileSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { parse } = await import('yaml');
  const dir = mkdtempSync(join(tmpdir(), 'reg-'));
  const path = join(dir, 'hra-registration.yaml');
  const lm = pts.map((p, i) => `      - { name: p${i}, hra: [${p.join(', ')}], bp3d: [${knownTransform(p).join(', ')}] }`).join('\n');
  writeFileSync(path, `# registration\nmaxRmsMm: 25\nregions:\n  pelvic:\n    fit: similarity # pelvis\n    organs: [uterus-female]\n    landmarks:\n${lm}\n`);
  const r = registerFile(path);
  assert.equal(r.ok, true);
  const text = readFileSync(path, 'utf8');
  assert.match(text, /^# registration/);
  assert.match(text, /fit: similarity # pelvis/);
  const res = parse(text).regions.pelvic.result;
  assert.equal(res.matrix.length, 16);
  assert.ok(Math.abs(res.scale - 0.9) < 1e-3);
  assert.ok(res.rmsMm < 0.01);
});

test('computeRegions: an offset region is another region followed by a fixed shift, without landmarks', () => {
  const lm = (name: string, hra: Vec3) => ({ name, hra, bp3d: knownTransform(hra) });
  const regions = computeRegions({
    pelvic: { fit: 'similarity', organs: ['uterus-female'], landmarks: pts.map((p, i) => lm(`p${i}`, p)) },
    bladder: { fit: 'offset', from: 'pelvic', organs: ['urinary-bladder-female'], landmarks: [], adjust: [0, 0, 8] },
  }, 25);
  close(apply(regions.bladder.matrix, [1, 2, 3]), (() => { const q = knownTransform([1, 2, 3]); return [q[0], q[1], q[2] + 8]; })());
  assert.equal(regions.bladder.ok, true);
  assert.equal(regions.bladder.rmsMm, 0);
});

test('a translation region reports the rotation it inherits from its base (not 0)', () => {
  const base = fitSimilarity(pts, pts.map(knownTransform)).matrix;
  const src: Vec3[] = [[0, 0, 100], [0, 0, 0]];
  const fit = fitTranslation(src, src.map(knownTransform), base);
  assert.ok(Math.abs(fit.rotationDeg - 30) < 1e-6, `${fit.rotationDeg}`);
  assert.ok(Math.abs(fit.scale - 0.9) < 1e-9);
});
