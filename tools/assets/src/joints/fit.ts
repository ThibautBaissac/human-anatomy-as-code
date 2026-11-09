// Least-squares fits on mesh vertices (pure): sphere, circle, cylinder, principal axes, rotation about an axis.
// Coordinates in mm, BodyParts3D frame. Methods from research_notes/Animations articulaires/animations.md §3.1.
import type { Vec3 } from '@haac/hra/register';
export type { Vec3 };

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / length(a));
export const mean = (pts: Vec3[]): Vec3 => scale(pts.reduce(add, [0, 0, 0] as Vec3), 1 / pts.length);
/** xyz positions → points. */
export const toPoints = (p: ArrayLike<number>): Vec3[] => {
  const out: Vec3[] = [];
  for (let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2]]);
  return out;
};
/** The point farthest from `from`. */
export const farthest = (pts: Vec3[], from: Vec3): Vec3 => pts.reduce((a, b) => (length(sub(b, from)) > length(sub(a, from)) ? b : a));

/** Solves the square system A x = b (Gaussian elimination, partial pivoting). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) throw new Error('ajustement dégénéré (points alignés ou trop peu nombreux)');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Linear least squares: rows of A (one per point) against b. */
function leastSquares(rows: number[][], b: number[]): number[] {
  const n = rows[0].length;
  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb = new Array(n).fill(0);
  rows.forEach((r, k) => {
    for (let i = 0; i < n; i++) {
      Atb[i] += r[i] * b[k];
      for (let j = 0; j < n; j++) AtA[i][j] += r[i] * r[j];
    }
  });
  return solve(AtA, Atb);
}

const rmsOf = (xs: number[], target: number) => Math.sqrt(xs.reduce((s, x) => s + (x - target) ** 2, 0) / xs.length);

/** Algebraic sphere fit (Kåsa). */
export function fitSphere(pts: Vec3[]): { centre: Vec3; radius: number; rms: number } {
  const m = mean(pts);
  const q = pts.map((p) => sub(p, m));
  const [a, b, c, d] = leastSquares(q.map((p) => [2 * p[0], 2 * p[1], 2 * p[2], 1]), q.map((p) => dot(p, p)));
  const radius = Math.sqrt(d + a * a + b * b + c * c);
  const centre = add(m, [a, b, c]);
  return { centre, radius, rms: rmsOf(pts.map((p) => length(sub(p, centre))), radius) };
}

/** Two unit vectors completing `axis` into an orthonormal basis. */
export function basisOf(axis: Vec3): [Vec3, Vec3] {
  const u = normalize(cross(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  return [u, cross(axis, u)];
}

/** Circle fit (Kåsa) of the points projected onto the plane normal to `axis`; the centre keeps the points' mean height. */
export function fitCircle(pts: Vec3[], axis: Vec3): { centre: Vec3; radius: number; rms: number } {
  const [u, v] = basisOf(normalize(axis));
  const m = mean(pts);
  const q = pts.map((p) => { const w = sub(p, m); return [dot(w, u), dot(w, v)]; });
  const [a, b, c] = leastSquares(q.map(([x, y]) => [2 * x, 2 * y, 1]), q.map(([x, y]) => x * x + y * y));
  const radius = Math.sqrt(c + a * a + b * b);
  return { centre: add(m, add(scale(u, a), scale(v, b))), radius, rms: rmsOf(q.map(([x, y]) => Math.hypot(x - a, y - b)), radius) };
}

/** Principal axes of a point cloud, largest variance first (Jacobi on the covariance matrix). */
export function principalAxes(pts: Vec3[]): Vec3[] {
  const m = mean(pts);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) {
    const w = sub(p, m);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += w[i] * w[j];
  }
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(C[p][q]) < 1e-12) continue;
      const theta = (C[q][q] - C[p][p]) / (2 * C[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const ckp = C[k][p], ckq = C[k][q];
        C[k][p] = c * ckp - s * ckq; C[k][q] = s * ckp + c * ckq;
      }
      for (let k = 0; k < 3; k++) {
        const cpk = C[p][k], cqk = C[q][k];
        C[p][k] = c * cpk - s * cqk; C[q][k] = s * cpk + c * cqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return [0, 1, 2].sort((a, b) => C[b][b] - C[a][a]).map((i) => normalize([V[0][i], V[1][i], V[2][i]]));
}

/**
 * Iterative cylinder fit: split the cloud in two halves along the current axis, fit a circle per half,
 * and take the line through both centres as the next axis (30 iterations, from the principal axis).
 */
export function fitCylinder(pts: Vec3[], initial?: Vec3): { point: Vec3; axis: Vec3; radius: number; rms: number } {
  let axis = normalize(initial ?? principalAxes(pts)[0]);
  let point = mean(pts);
  for (let it = 0; it < 30; it++) {
    const s = pts.map((p) => dot(sub(p, point), axis));
    const median = [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)];
    const lo = pts.filter((_, i) => s[i] < median), hi = pts.filter((_, i) => s[i] >= median);
    if (lo.length < 3 || hi.length < 3) break;
    const c1 = fitCircle(lo, axis).centre, c2 = fitCircle(hi, axis).centre;
    let next = normalize(sub(c2, c1));
    if (dot(next, axis) < 0) next = scale(next, -1);
    point = scale(add(c1, c2), 0.5);
    const delta = 1 - dot(next, axis);
    axis = next;
    if (delta < 1e-12) break;
  }
  const distances = pts.map((p) => length(cross(sub(p, point), axis)));
  const radius = distances.reduce((a, b) => a + b, 0) / distances.length;
  return { point, axis, radius, rms: rmsOf(distances, radius) };
}

/** Rotation of `p` by `deg` degrees about the axis (unit) through `centre`, right-handed (Rodrigues). */
export function rotateAbout(p: Vec3, centre: Vec3, axis: Vec3, deg: number): Vec3 {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const v = sub(p, centre);
  const r = add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)));
  return add(centre, r);
}

/** Signed angle (degrees) from `a` to `b` around `axis`, both projected on the plane normal to it. */
export function signedAngle(a: Vec3, b: Vec3, axis: Vec3): number {
  const pa = sub(a, scale(axis, dot(a, axis))), pb = sub(b, scale(axis, dot(b, axis)));
  return (Math.atan2(dot(cross(pa, pb), axis), dot(pa, pb)) * 180) / Math.PI;
}
