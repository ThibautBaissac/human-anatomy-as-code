import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { fitJoints } from '../src/fit-joints.ts';

type V = [number, number, number];
const rod = (from: V, to: V, n = 60): V[] => Array.from({ length: n }, (_, i) => from.map((f, k) => f + ((to[k] - f) * i) / (n - 1)) as V);
/** Points on a sphere; `noise` (mm) makes the surface bumpy, so the fit error is about noise / √2. */
const cap = (c: V, r: number, noise = 0): V[] => Array.from({ length: 300 }, (_, i) => {
  const t = Math.acos(1 - (2 * (i + 0.5)) / 300), p = i * 2.399963, rr = r + noise * Math.sin(i * 7.3);
  return [c[0] + rr * Math.sin(t) * Math.cos(p), c[1] + rr * Math.sin(t) * Math.sin(p), c[2] + rr * Math.cos(t)] as V;
});
const obj = (pts: V[]) => pts.map((p) => `v ${p.join(' ')}`).join('\n') + '\n';
/** A femur (two condyles, a shaft) and a tibia, mirrored for the right side (x → −x). */
const femur = (sx: number, noise = 0) => [...cap([sx * 50, 0, 20], 15, noise), ...cap([sx * 90, 0, 20], 15, noise), ...rod([sx * 70, 0, 45], [sx * 70, 0, 420])];
const tibia = (sx: number) => rod([sx * 70, 0, -10], [sx * 70, 0, -350]);

const KNEE_YAML = `# Genou : charnière (spec 2026-11-09-animations-v1)
slug: knee-joint
labels:
  en: { text: knee joint, source: fma, status: draft }
motion: flexion-extension
proximal: femur
moving: [tibia]
rangeDeg: [0, 138]
restDeg: 0
sources: [cdc-joint-rom]
status: draft
fit:
  method: condyle-spheres
  maxRmsMm: 3
  positiveDirection: [0, 1, 0]
  distalMm: 40
  posteriorMm: -10
  gapMm: 6
`;

function fixture(maxRmsMm = 3, noise = 0) {
  const root = mkdtempSync(join(tmpdir(), 'fit-joints-'));
  const dataDir = join(root, 'data'), objDir = join(root, 'obj');
  for (const d of ['joints', 'structures/bone']) mkdirSync(join(dataDir, d), { recursive: true });
  mkdirSync(objDir);
  const bone = (slug: string, l: string, r: string) => `slug: ${slug}\nkind: bone\nlaterality: bilateral\nstatus: draft\nlabels:\n  en: { text: ${slug}, source: fma, status: draft }\nsides:\n  left:\n    meshes: [bp3d:${l}]\n  right:\n    meshes: [bp3d:${r}]\n`;
  writeFileSync(join(dataDir, 'structures/bone/femur.yaml'), bone('femur', 'FJ1M', 'FJ1'));
  writeFileSync(join(dataDir, 'structures/bone/tibia.yaml'), bone('tibia', 'FJ2M', 'FJ2'));
  writeFileSync(join(objDir, 'FJ1M.obj'), obj(femur(1, noise)));
  writeFileSync(join(objDir, 'FJ1.obj'), obj(femur(-1, noise)));
  writeFileSync(join(objDir, 'FJ2M.obj'), obj(tibia(1)));
  writeFileSync(join(objDir, 'FJ2.obj'), obj(tibia(-1)));
  writeFileSync(join(dataDir, 'joints/knee-joint.yaml'), KNEE_YAML.replace('maxRmsMm: 3', `maxRmsMm: ${maxRmsMm}`));
  return { dataDir, objDir, file: join(dataDir, 'joints/knee-joint.yaml') };
}

test('fit-joints writes the centre, axis and fit error of each side, and the rest angle, keeping comments', () => {
  const { dataDir, objDir, file } = fixture();
  const report = fitJoints({ dataDir, objDir });
  assert.deepEqual(report.refused, []);
  const text = readFileSync(file, 'utf8');
  assert.match(text, /^# Genou : charnière/);
  const j = parse(text);
  assert.deepEqual(j.sides.left.centre, [70, 0, 20]);
  assert.deepEqual(j.sides.right.centre, [-70, 0, 20]);
  assert.deepEqual(j.sides.left.axis, [1, 0, 0]);
  // mirrored side: flexion still moves the leg backward, so the axis keeps its direction
  assert.deepEqual(j.sides.right.axis, [1, 0, 0]);
  assert.equal(j.restDeg, 0);
  assert.ok(j.sides.left.rmsMm < 0.5);
});

test('fit-joints refuses to write a side whose fit error exceeds maxRmsMm', () => {
  const { dataDir, objDir, file } = fixture(0.5, 2);
  const before = readFileSync(file, 'utf8');
  const report = fitJoints({ dataDir, objDir });
  assert.equal(report.refused.length, 2);
  assert.match(report.refused[0], /knee-joint@left.*maxRmsMm/);
  assert.equal(readFileSync(file, 'utf8'), before);
});
