// Centre, axis and rest angle of one side of a joint, measured on the bones' vertices (pure).
import { add, dot, fitCircle, fitCylinder, fitSphere, length, mean, normalize, principalAxes, rotateAbout, scale, signedAngle, sub, type Vec3 } from './fit.ts';

export type FitMethod = 'cylinder-contact' | 'head-to-head' | 'condyle-spheres';

export interface FitParams {
  method: FitMethod;
  maxRmsMm: number;
  /** direction the distal end takes under a small positive rotation (flexion, pronation) */
  positiveDirection: Vec3;
  /** cylinder-contact: per moving bone, distance (mm) under which a vertex of the proximal bone is in contact */
  contactMm?: number[];
  /** head-to-head: band (mm from the distal end of the proximal bone) where its head is fitted */
  distalBandMm?: [number, number];
  /** head-to-head: band (mm from the proximal end of the moving bone) where its head is fitted */
  proximalBandMm?: [number, number];
  /** condyle-spheres: height (mm above the lowest vertex) of the distal region of the proximal bone */
  distalMm?: number;
  /** condyle-spheres: posterior part kept: vertices behind (mm) the mean of the distal region */
  posteriorMm?: number;
  /** condyle-spheres: half gap (mm) left out between the two condyles */
  gapMm?: number;
}

export interface JointInput {
  slug: string;
  motion: 'flexion-extension' | 'pronation-supination';
  proximal: string;
  moving: string[];
  fit: FitParams;
}

export interface Measured {
  centre: Vec3;
  axis: Vec3;
  rmsMm: number;
  /** measured for flexion-extension only */
  restDeg?: number;
}

/** Vertices of `pts` lying within `d` mm of some vertex of `others` (grid hash). */
export function within(pts: Vec3[], others: Vec3[], d: number): Vec3[] {
  const key = (p: Vec3) => `${Math.floor(p[0] / d)},${Math.floor(p[1] / d)},${Math.floor(p[2] / d)}`;
  const grid = new Map<string, Vec3[]>();
  for (const q of others) { const k = key(q); grid.set(k, [...(grid.get(k) ?? []), q]); }
  return pts.filter((p) => {
    const [i, j, k] = [0, 1, 2].map((a) => Math.floor(p[a] / d));
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      for (const q of grid.get(`${i + a},${j + b},${k + c}`) ?? []) if (length(sub(p, q)) <= d) return true;
    }
    return false;
  });
}

const r1 = (x: number) => Math.round(x * 10) / 10 + 0; // + 0: no -0 in the files
const lowest = (pts: Vec3[]) => pts.reduce((a, b) => (b[2] < a[2] ? b : a));
const farthest = (pts: Vec3[], from: Vec3) => pts.reduce((a, b) => (length(sub(b, from)) > length(sub(a, from)) ? b : a));

/** Orients `axis` so that a small positive rotation moves `tip` along `direction`. */
function orient(axis: Vec3, centre: Vec3, tip: Vec3, direction: Vec3): Vec3 {
  const moved = sub(rotateAbout(tip, centre, axis, 5), tip);
  return dot(moved, direction) >= 0 ? axis : scale(axis, -1);
}

export function measureJoint(joint: JointInput, bones: Record<string, Vec3[]>): Measured {
  const need = (slug: string) => {
    const pts = bones[joint.proximal === slug ? joint.proximal : slug];
    if (!pts?.length) throw new Error(`${joint.slug} : pas de sommets pour l'os « ${slug} »`);
    return pts;
  };
  const proximal = need(joint.proximal);
  const moving = joint.moving.flatMap(need);
  const f = joint.fit;
  let centre: Vec3, axis: Vec3, rmsMm: number;

  if (f.method === 'cylinder-contact') {
    const contacts = joint.moving.map((slug, i) => within(proximal, need(slug), f.contactMm?.[i] ?? f.contactMm?.[0] ?? 6));
    const cloud = contacts.flat();
    if (cloud.length < 20) throw new Error(`${joint.slug} : surface de contact trop petite (${cloud.length} sommets)`);
    const cyl = fitCylinder(cloud);
    const mid = mean(contacts.filter((c) => c.length).map(mean));
    centre = add(cyl.point, scale(cyl.axis, dot(sub(mid, cyl.point), cyl.axis)));
    axis = cyl.axis;
    rmsMm = cyl.rms;
  } else if (f.method === 'head-to-head') {
    const [lo, hi] = f.distalBandMm ?? [4, 18];
    const [plo, phi] = f.proximalBandMm ?? [0, 10];
    let ua = principalAxes(proximal)[0];
    if (ua[2] < 0) ua = scale(ua, -1); // pointing up (proximal)
    const uMin = Math.min(...proximal.map((p) => dot(p, ua)));
    const ulnarHead = fitCircle(proximal.filter((p) => { const s = dot(p, ua) - uMin; return s >= lo && s <= hi; }), ua);
    let ra = principalAxes(moving)[0];
    if (ra[2] < 0) ra = scale(ra, -1);
    const rMax = Math.max(...moving.map((p) => dot(p, ra)));
    const radialHead = fitCircle(moving.filter((p) => { const s = rMax - dot(p, ra); return s >= plo && s <= phi; }), ra);
    centre = ulnarHead.centre;
    axis = normalize(sub(radialHead.centre, ulnarHead.centre));
    rmsMm = Math.max(ulnarHead.rms, radialHead.rms);
  } else {
    const zMin = Math.min(...proximal.map((p) => p[2]));
    const region = proximal.filter((p) => p[2] <= zMin + (f.distalMm ?? 40));
    const m = mean(region);
    const back = region.filter((p) => p[1] >= m[1] + (f.posteriorMm ?? 0));
    const gap = f.gapMm ?? 6;
    const a = fitSphere(back.filter((p) => p[0] < m[0] - gap)), b = fitSphere(back.filter((p) => p[0] > m[0] + gap));
    centre = scale(add(a.centre, b.centre), 0.5);
    axis = normalize(sub(b.centre, a.centre));
    rmsMm = Math.max(a.rms, b.rms);
  }

  const tip = joint.motion === 'pronation-supination' ? lowest(moving) : farthest(moving, centre);
  axis = orient(axis, centre, tip, f.positiveDirection);
  const out: Measured = { centre: centre.map(r1) as Vec3, axis: axis.map((x) => Math.round(x * 1e4) / 1e4) as Vec3, rmsMm: r1(rmsMm) };
  out.axis = normalize(out.axis).map((x) => Math.round(x * 1e4) / 1e4 + 0) as Vec3;
  if (joint.motion === 'flexion-extension') {
    // long axes from the joint centre to the far end of each segment (mechanical axes, not the bowed shafts)
    const farEnd = (pts: Vec3[]) => { const d = Math.max(...pts.map((p) => length(sub(p, centre)))); return mean(pts.filter((p) => length(sub(p, centre)) >= d - 15)); };
    const toProximal = normalize(sub(farEnd(proximal), centre)), toDistal = normalize(sub(farEnd(moving), centre));
    out.restDeg = r1(signedAngle(scale(toProximal, -1), toDistal, axis));
  }
  return out;
}
