// Registration of HRA organs into the BodyParts3D frame. Pure math, no I/O.
// Matrices are 4×4, row-major, as plain arrays of 16 numbers (readable in YAML).
export type Vec3 = [number, number, number];
export type Mat4 = number[];

/** glTF (metres, Y up, +Z anterior, +X subject's left) → BodyParts3D (mm, Z up, +Y posterior, +X subject's left). */
export const HRA_TO_BP3D: Mat4 = [
  1000, 0, 0, 0,
  0, 0, -1000, 0,
  0, 1000, 0, 0,
  0, 0, 0, 1,
];

export function apply(m: Mat4, p: Vec3): Vec3 {
  return [0, 1, 2].map((r) => m[r * 4] * p[0] + m[r * 4 + 1] * p[1] + m[r * 4 + 2] * p[2] + m[r * 4 + 3]) as Vec3;
}

/** a ∘ b: apply b, then a. */
export function compose(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) out[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c];
  return out;
}

const translation = (t: Vec3): Mat4 => [1, 0, 0, t[0], 0, 1, 0, t[1], 0, 0, 1, t[2], 0, 0, 0, 1];
const mean = (ps: Vec3[]): Vec3 => [0, 1, 2].map((i) => ps.reduce((s, p) => s + p[i], 0) / ps.length) as Vec3;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Eigen-decomposition of a symmetric matrix (cyclic Jacobi); returns the eigenvector of the largest eigenvalue. */
function largestEigenvector(a: number[][]): number[] {
  const n = a.length;
  const A = a.map((r) => [...r]);
  const V: number[][] = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  let best = 0;
  for (let i = 1; i < n; i++) if (A[i][i] > A[best][best]) best = i;
  return V.map((row) => row[best]);
}

export interface Fit {
  matrix: Mat4;
  scale: number;
  rotationDeg: number;
  residualsMm: number[];
  rmsMm: number;
  maxMm: number;
}

function residuals(m: Mat4, src: Vec3[], dst: Vec3[]) {
  const r = src.map((p, i) => dist(apply(m, p), dst[i]));
  return { residualsMm: r, rmsMm: Math.sqrt(r.reduce((s, x) => s + x * x, 0) / r.length), maxMm: Math.max(...r) };
}

/** Landmarks that cannot fix a rotation: fewer than 3 pairs, all coincident or all on one line. */
export class DegenerateLandmarksError extends Error {
  override name = 'DegenerateLandmarksError';
}

/** Throws when the points do not span a plane (coincident or collinear), relative to their spread. */
function assertSpread(ps: Vec3[], which: string): void {
  const c = mean(ps);
  const far = ps.reduce((a, p) => (dist(p, c) > dist(a, c) ? p : a));
  const r = dist(far, c);
  if (!(r > 1e-9)) throw new DegenerateLandmarksError(`fitSimilarity : repères ${which} confondus`);
  const u = sub(far, c).map((x) => x / r) as Vec3;
  const offLine = Math.max(...ps.map((p) => { const w = sub(p, c), t = w[0] * u[0] + w[1] * u[1] + w[2] * u[2]; return Math.hypot(w[0] - t * u[0], w[1] - t * u[1], w[2] - t * u[2]); }));
  if (offLine <= 1e-6 * r) throw new DegenerateLandmarksError(`fitSimilarity : repères ${which} alignés`);
}

/** Least-squares similarity (uniform scale, rotation, translation) mapping src onto dst (Horn's quaternion method). */
export function fitSimilarity(src: Vec3[], dst: Vec3[]): Fit {
  if (src.length < 3 || src.length !== dst.length) throw new DegenerateLandmarksError('fitSimilarity : au moins 3 paires de repères');
  assertSpread(src, 'HRA');
  assertSpread(dst, 'BodyParts3D');
  const ms = mean(src), md = mean(dst);
  const xs = src.map((p) => sub(p, ms)), ys = dst.map((p) => sub(p, md));
  const S = [0, 1, 2].map((i) => [0, 1, 2].map((j) => xs.reduce((s, x, k) => s + x[i] * ys[k][j], 0)));
  const [Sxx, Sxy, Sxz] = S[0], [Syx, Syy, Syz] = S[1], [Szx, Szy, Szz] = S[2];
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const [w, x, y, z] = largestEigenvector(N);
  const R = [
    [w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z],
  ];
  const rx = (v: Vec3): Vec3 => [0, 1, 2].map((i) => R[i][0] * v[0] + R[i][1] * v[1] + R[i][2] * v[2]) as Vec3;
  const scale = ys.reduce((s, yk, k) => { const r = rx(xs[k]); return s + yk[0] * r[0] + yk[1] * r[1] + yk[2] * r[2]; }, 0)
    / xs.reduce((s, v) => s + v[0] ** 2 + v[1] ** 2 + v[2] ** 2, 0);
  const rm = rx(ms);
  const t: Vec3 = [md[0] - scale * rm[0], md[1] - scale * rm[1], md[2] - scale * rm[2]];
  const matrix: Mat4 = [
    scale * R[0][0], scale * R[0][1], scale * R[0][2], t[0],
    scale * R[1][0], scale * R[1][1], scale * R[1][2], t[1],
    scale * R[2][0], scale * R[2][1], scale * R[2][2], t[2],
    0, 0, 0, 1,
  ];
  const rotationDeg = (Math.acos(Math.min(1, Math.max(-1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2))) * 180) / Math.PI;
  return { matrix, scale, rotationDeg, ...residuals(matrix, src, dst) };
}

/** A base transform followed by the translation that best maps src onto dst (mean offset). */
export function fitTranslation(src: Vec3[], dst: Vec3[], base: Mat4): Fit {
  const mapped = src.map((p) => apply(base, p));
  const matrix = compose(translation(mean(dst.map((d, i) => sub(d, mapped[i])))), base);
  const scale = Math.cbrt(Math.abs(base[0] * (base[5] * base[10] - base[6] * base[9]) - base[1] * (base[4] * base[10] - base[6] * base[8]) + base[2] * (base[4] * base[9] - base[5] * base[8])));
  // the rotation is the base's: angle of its linear part once the scale is divided out
  const trace = (base[0] + base[5] + base[10]) / scale;
  const rotationDeg = (Math.acos(Math.min(1, Math.max(-1, (trace - 1) / 2))) * 180) / Math.PI;
  return { matrix, scale, rotationDeg, ...residuals(matrix, src, dst) };
}

export interface Landmark { name: string; hra: Vec3; bp3d: Vec3 }
export interface RegionConfig {
  /** similarity: fitted on landmarks; translation: another region then the mean landmark offset; offset: another region then `adjust` only */
  fit: 'similarity' | 'translation' | 'offset';
  /** for fit: translation | offset, the region whose transform comes first */
  from?: string;
  organs: string[];
  /** landmark coordinates: hra already in the BodyParts3D axes and millimetres (after HRA_TO_BP3D) */
  landmarks: Landmark[];
  /** manual correction in mm, applied after the fit */
  adjust?: Vec3;
}
export interface RegionResult extends Fit { ok: boolean }

/** Fits every region (dependencies first); `ok` is false when the RMS residual exceeds the threshold. */
export function computeRegions(config: Record<string, RegionConfig>, maxRmsMm: number): Record<string, RegionResult> {
  const out: Record<string, RegionResult> = {};
  const solve = (name: string, seen: string[] = []): RegionResult => {
    if (out[name]) return out[name];
    if (seen.includes(name)) throw new Error(`recalage : dépendance circulaire ${[...seen, name].join(' → ')}`);
    const r = config[name];
    if (!r) throw new Error(`recalage : région « ${name} » inconnue`);
    const src = r.landmarks.map((l) => l.hra), dst = r.landmarks.map((l) => l.bp3d);
    let fit: Fit;
    if (r.fit === 'similarity') fit = fitSimilarity(src, dst);
    else if (r.fit === 'translation') fit = fitTranslation(src, dst, solve(r.from!, [...seen, name]).matrix);
    else {
      // offset: no landmarks of its own; residuals are those of the region it derives from
      const base = solve(r.from!, [...seen, name]);
      fit = { ...base, matrix: base.matrix, residualsMm: [], rmsMm: 0, maxMm: 0 };
    }
    if (r.adjust && r.adjust.some((v) => v !== 0)) {
      const matrix = compose(translation(r.adjust), fit.matrix);
      fit = { ...fit, matrix, ...(src.length ? residuals(matrix, src, dst) : {}) };
    }
    return (out[name] = { ...fit, ok: fit.rmsMm <= maxRmsMm });
  };
  for (const name of Object.keys(config)) solve(name);
  return out;
}
