import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitCircle, fitCylinder, fitSphere, rotateAbout, type Vec3 } from '../src/joints/fit.ts';

const close = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} ≠ ${b} ± ${tol}`);
const closeVec = (a: Vec3, b: Vec3, tol: number, what = '') => a.forEach((v, i) => close(v, b[i], tol, `${what}[${i}]`));
/** a and b point the same way or exactly the opposite way */
const sameLine = (a: Vec3, b: Vec3, tolDeg: number) => {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
  assert.ok(Math.acos(Math.min(1, dot)) * 180 / Math.PI <= tolDeg, `axes ${a} / ${b} differ by more than ${tolDeg}°`);
};

/** Points on a sphere cap (deterministic, slight noise). */
function spherePoints(c: Vec3, r: number, n = 200): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 0.8, p = k * 2.399963;
    const rr = r + 0.1 * Math.sin(k * 7.3);
    out.push([c[0] + rr * Math.sin(t) * Math.cos(p), c[1] + rr * Math.sin(t) * Math.sin(p), c[2] + rr * Math.cos(t)]);
  }
  return out;
}

/** Points on a cylinder of radius r around the line (p, d), d a unit vector, over a 120° arc and a length of 40. */
function cylinderPoints(p: Vec3, d: Vec3, r: number): Vec3[] {
  const u: Vec3 = Math.abs(d[2]) < 0.9 ? norm(cross(d, [0, 0, 1])) : norm(cross(d, [1, 0, 0]));
  const v = cross(d, u);
  const out: Vec3[] = [];
  for (let i = 0; i < 20; i++) for (let j = 0; j < 12; j++) {
    const s = -20 + i * 2, a = (j / 11) * (2 * Math.PI / 3);
    out.push([0, 1, 2].map((k) => p[k] + s * d[k] + r * (Math.cos(a) * u[k] + Math.sin(a) * v[k])) as Vec3);
  }
  return out;
}
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

test('fitSphere recovers the centre and radius of a sphere cap', () => {
  const s = fitSphere(spherePoints([48.9, -71, 389.3], 20.3));
  closeVec(s.centre, [48.9, -71, 389.3], 0.2, 'centre');
  close(s.radius, 20.3, 0.2, 'radius');
  assert.ok(s.rms < 0.2);
});

test('fitCircle recovers a circle lying in the plane normal to an axis', () => {
  const axis = norm([0.1, 0.2, 1]);
  const pts = cylinderPoints([239.5, -116.2, 813.2], axis, 6.3).filter((_, i) => i % 12 < 12 && Math.floor(i / 12) === 10);
  const c = fitCircle(pts, axis);
  closeVec(c.centre, [239.5, -116.2, 813.2], 0.3, 'centre');
  close(c.radius, 6.3, 0.1, 'radius');
});

test('fitCylinder finds the axis of a partial cylinder from a rough initial direction', () => {
  const d = norm([0.951, 0.167, 0.26]);
  const p: Vec3 = [213.3, -68.1, 1044.8];
  const c = fitCylinder(cylinderPoints(p, d, 11));
  sameLine(c.axis, d, 0.5);
  close(c.radius, 11, 0.2, 'radius');
  // the fitted line passes through p
  const w: Vec3 = [p[0] - c.point[0], p[1] - c.point[1], p[2] - c.point[2]];
  assert.ok(Math.hypot(...cross(w, c.axis)) < 0.3);
});

test('rotateAbout turns a point around an axis through a centre, right-handed', () => {
  closeVec(rotateAbout([1, 0, 0], [0, 0, 0], [0, 0, 1], 90), [0, 1, 0], 1e-9);
  closeVec(rotateAbout([11, 5, 3], [10, 5, 3], [0, 0, 1], 180), [9, 5, 3], 1e-9);
});
