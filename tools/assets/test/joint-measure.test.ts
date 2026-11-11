import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureJoint, type JointInput } from '../src/joints/measure.ts';
import { FitError, rotateAbout, type Vec3 } from '../src/joints/fit.ts';

const close = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} ≠ ${b} ± ${tol}`);
const closeVec = (a: Vec3, b: Vec3, tol: number, what = '') => a.forEach((v, i) => close(v, b[i], tol, `${what}[${i}]`));
const rod = (from: Vec3, to: Vec3, n = 60): Vec3[] =>
  Array.from({ length: n }, (_, i) => from.map((f, k) => f + ((to[k] - f) * i) / (n - 1)) as Vec3);
/** Points on a cylinder of radius r around the X axis, x in [x0, x1], over the angles [a0, a1] (degrees, 0 = +Z). */
const cylX = (r: number, x0: number, x1: number, a0: number, a1: number): Vec3[] => {
  const out: Vec3[] = [];
  for (let i = 0; i <= 16; i++) for (let j = 0; j <= 24; j++) {
    const x = x0 + ((x1 - x0) * i) / 16, a = ((a0 + ((a1 - a0) * j) / 24) * Math.PI) / 180;
    out.push([x, -r * Math.sin(a), r * Math.cos(a)]);
  }
  return out;
};
/** Points on a cylinder of radius r around the segment from → to. */
const tube = (from: Vec3, to: Vec3, r: number): Vec3[] => {
  const d = to.map((t, k) => t - from[k]) as Vec3, l = Math.hypot(...d);
  const a = d.map((x) => x / l) as Vec3;
  const u = (Math.abs(a[2]) < 0.9 ? [a[1], -a[0], 0] : [0, a[2], -a[1]]) as Vec3, ul = Math.hypot(...u);
  const uu = u.map((x) => x / ul) as Vec3, v: Vec3 = [a[1] * uu[2] - a[2] * uu[1], a[2] * uu[0] - a[0] * uu[2], a[0] * uu[1] - a[1] * uu[0]];
  const out: Vec3[] = [];
  for (let i = 0; i <= 40; i++) for (let j = 0; j < 16; j++) {
    const s = (l * i) / 40, t = (j / 16) * 2 * Math.PI;
    out.push([0, 1, 2].map((k) => from[k] + a[k] * s + r * (Math.cos(t) * uu[k] + Math.sin(t) * v[k])) as Vec3);
  }
  return out;
};

test('cylinder-contact: axis through the contact surface, oriented so flexion moves the forearm forward, rest angle measured', () => {
  // humerus: a trochlea (radius 10 around X) and a shaft going up; ulna: a notch 3 mm outside it and a shaft flexed 20° forward
  const restDir = rotateAbout([0, 0, -1], [0, 0, 0], [-1, 0, 0], 20);
  const humerus = [...cylX(10, -20, 20, -120, 120), ...rod([0, 0, 25], [0, 0, 300])];
  const ulna = [...cylX(13, -15, 15, 60, 240), ...rod(restDir.map((x) => x * 25) as Vec3, restDir.map((x) => x * 260) as Vec3)];
  const joint: JointInput = { slug: 'elbow-joint', motion: 'flexion-extension', proximal: 'humerus', moving: ['ulna'],
    fit: { method: 'cylinder-contact', maxRmsMm: 3, positiveDirection: [0, -1, 0], contactMm: [6] } };
  const m = measureJoint(joint, { humerus, ulna });
  closeVec(m.axis, [-1, 0, 0], 0.01, 'axis');
  closeVec(m.centre, [0, 0, 0], 0.5, 'centre');
  close(m.restDeg!, 20, 1, 'rest');
  assert.ok(m.rmsMm < 0.5);
});

test('head-to-head: axis from the ulnar head to the radial head, oriented so pronation moves the radial styloid forward', () => {
  const ulna = tube([0, 0, 0], [0, 0, 220], 6);
  const radius = tube([25, 0, 0], [8, 0, 220], 9);
  const joint: JointInput = { slug: 'radio-ulnar-joints', motion: 'pronation-supination', proximal: 'ulna', moving: ['radius'],
    fit: { method: 'head-to-head', maxRmsMm: 3, positiveDirection: [0, -1, 0], distalBandMm: [4, 18], proximalBandMm: [0, 10] } };
  const m = measureJoint(joint, { ulna, radius });
  closeVec(m.centre, [0, 0, 11], 0.5, 'centre');
  // radial head: 5 mm below the top of the radius rod; ulnar head: 11 mm above its distal end
  const expected: Vec3 = [8 + 17 * (5 / 220.65), 0, 215 - 11];
  const l = Math.hypot(...expected);
  closeVec(m.axis, expected.map((x) => -x / l) as Vec3, 0.02, 'axis');
  assert.equal(m.restDeg, undefined);
});

test('condyle-spheres: axis through the two posterior condyles, centre between them, knee flexion moves the leg backward', () => {
  const cap = (c: Vec3, r: number): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i < 300; i++) {
      const t = Math.acos(1 - (2 * (i + 0.5)) / 300), p = i * 2.399963;
      out.push([c[0] + r * Math.sin(t) * Math.cos(p), c[1] + r * Math.sin(t) * Math.sin(p), c[2] + r * Math.cos(t)]);
    }
    return out;
  };
  const femur = [...cap([-20, 0, 20], 15), ...cap([20, 0, 20], 15), ...rod([0, 0, 45], [0, 0, 420])];
  const tibia = rod([0, 0, -10], [0, 0, -350]);
  const joint: JointInput = { slug: 'knee-joint', motion: 'flexion-extension', proximal: 'femur', moving: ['tibia'],
    fit: { method: 'condyle-spheres', maxRmsMm: 3, positiveDirection: [0, 1, 0], distalMm: 40, posteriorMm: -10, gapMm: 6 } };
  const m = measureJoint(joint, { femur, tibia });
  closeVec(m.centre, [0, 0, 20], 0.5, 'centre');
  closeVec(m.axis, [1, 0, 0], 0.01, 'axis');
  close(m.restDeg!, 0, 1, 'rest');
});

test('a bone without vertices is reported by name', () => {
  const joint: JointInput = { slug: 'knee-joint', motion: 'flexion-extension', proximal: 'femur', moving: ['tibia'],
    fit: { method: 'condyle-spheres', maxRmsMm: 3, positiveDirection: [0, 1, 0] } };
  assert.throws(() => measureJoint(joint, { femur: [[0, 0, 0]] }), /tibia/);
});

test('an empty condyle or band filter is a named fit error, not a TypeError', () => {
  const femur = rod([0, 0, 0], [0, 0, 420]), tibia = rod([0, 0, -10], [0, 0, -350]);
  const condyles: JointInput = { slug: 'knee-joint', motion: 'flexion-extension', proximal: 'femur', moving: ['tibia'],
    fit: { method: 'condyle-spheres', maxRmsMm: 3, positiveDirection: [0, 1, 0], gapMm: 1000 } };
  assert.throws(() => measureJoint(condyles, { femur, tibia }), (e: Error) => e instanceof FitError && /knee-joint/.test(e.message));
  const heads: JointInput = { slug: 'radio-ulnar-joints', motion: 'pronation-supination', proximal: 'ulna', moving: ['radius'],
    fit: { method: 'head-to-head', maxRmsMm: 3, positiveDirection: [0, 1, 0], distalBandMm: [1000, 2000] } };
  assert.throws(() => measureJoint(heads, { ulna: femur, radius: tibia }), (e: Error) => e instanceof FitError && /radio-ulnar-joints/.test(e.message));
});
