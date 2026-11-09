// Joint poses: instance matrices, crossing tissues, muscle length trends. Pure (4×4 algebra only, column-major like three.js).
import { labelText } from './search.ts';
import { ROLES_OF, type AtlasJoint, type AtlasStructure, type Lang, type Motion, type Role, type Side, type Vec3 } from './types.ts';

export type Mat4 = number[];

/** Rig of one side of a joint, computed at build time (manifest models.<model>.joints). */
export interface Rig {
  /** instances that turn with the joint */
  moving: string[];
  /** instances that turn by a fraction of the angle */
  coupled: { name: string; ratio: number }[];
  /** soft tissues that cross the joint: ghosted while it moves */
  crossing: string[];
  /** muscles acting on the joint; momentArmMm < 0: shortens in the positive direction */
  muscles: { name: string; slug: string; role: Role; momentArmMm: number }[];
}
export type Rigs = Record<string, Rig>;
/** joint@side → angle in degrees */
export type Pose = Record<string, number>;

/**
 * Below this moment arm (mm/rad) a muscle's length barely changes: "stable". Lower for forearm rotation, whose chords
 * run almost along the axis. Same values as the build warning (tools/assets rig.ts).
 */
export const STABLE_MOMENT_ARM_MM: Record<Motion, number> = { 'flexion-extension': 5, 'pronation-supination': 1 };
const POSITIVE: Role[] = Object.values(ROLES_OF).map(([positive]) => positive);

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const jointKey = (slug: string, side: Side) => `${slug}@${side}`;
export const parseJointKey = (key: string) => { const [slug, side] = key.split('@'); return { slug, side: side as Side }; };

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = s;
  }
  return out;
}

export function applyMatrix(m: Mat4, [x, y, z]: Vec3): Vec3 {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

/** Rotation of `deg` degrees about the unit axis through `centre`, right-handed. */
export function rotationAbout(centre: Vec3, axis: Vec3, deg: number): Mat4 {
  if (deg === 0) return IDENTITY;
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  const [x, y, z] = axis;
  // 3×3 rotation (Rodrigues), rows
  const R = [
    [c + x * x * k, x * y * k - z * s, x * z * k + y * s],
    [y * x * k + z * s, c + y * y * k, y * z * k - x * s],
    [z * x * k - y * s, z * y * k + x * s, c + z * z * k],
  ];
  // p' = R (p − centre) + centre
  const tr = [0, 1, 2].map((i) => centre[i] - (R[i][0] * centre[0] + R[i][1] * centre[1] + R[i][2] * centre[2]));
  return [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, tr[0], tr[1], tr[2], 1];
}

/** Whole-degree angles: one within half a degree of a fractional rest angle (13.1°) is the rest pose. */
export const atRest = (j: AtlasJoint, angle: number) => Math.abs(angle - j.restDeg) < 0.5;

/** The angle a pose stores: whole degrees, within the range; null at rest (absent from the pose). */
export function normaliseAngle(j: AtlasJoint, deg: number): number | null {
  const angle = Math.min(Math.max(Math.round(deg), j.rangeDeg[0]), j.rangeDeg[1]);
  return atRest(j, angle) ? null : angle;
}
const angleOf = (j: AtlasJoint, side: Side, pose: Pose) => {
  const a = pose[jointKey(j.slug, side)];
  return a === undefined || atRest(j, a) ? j.restDeg : a;
};

/** World matrix of the segment a joint moves: its parent's matrix, then its own rotation from rest (in rest-pose coordinates). */
export function jointMatrix(joints: AtlasJoint[], slug: string, side: Side, pose: Pose, ratio = 1): Mat4 {
  const j = joints.find((x) => x.slug === slug);
  const s = j?.sides?.[side];
  if (!j || !s) return IDENTITY;
  const parent = j.parent ? jointMatrix(joints, j.parent, side, pose) : IDENTITY;
  return multiply(parent, rotationAbout(s.centre, s.axis, ratio * (angleOf(j, side, pose) - j.restDeg)));
}

const depth = (joints: AtlasJoint[], slug: string): number => {
  const j = joints.find((x) => x.slug === slug);
  return j?.parent ? 1 + depth(joints, j.parent) : 0;
};
const isIdentity = (m: Mat4) => m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-9);

/** Matrix of every instance a pose moves (instances left at their rest place are absent). */
export function poseMatrices(joints: AtlasJoint[], rigs: Rigs, pose: Pose): Map<string, Mat4> {
  const out = new Map<string, Mat4>();
  // parents first: an instance moved by a child joint (radius, hand) ends with the child's matrix, which includes the parent's
  const keys = Object.keys(rigs).sort((a, b) => depth(joints, parseJointKey(a).slug) - depth(joints, parseJointKey(b).slug) || (a < b ? -1 : 1));
  for (const key of keys) {
    const { slug, side } = parseJointKey(key);
    const m = jointMatrix(joints, slug, side, pose);
    for (const name of rigs[key].moving) out.set(name, m);
    for (const c of rigs[key].coupled) out.set(c.name, jointMatrix(joints, slug, side, pose, c.ratio));
  }
  for (const [name, m] of out) if (isIdentity(m)) out.delete(name);
  return out;
}

/** Instances to ghost: those crossing a joint away from rest, or a joint being played (stable while sweeping through rest). */
export function crossingInstances(rigs: Rigs, joints: AtlasJoint[], pose: Pose, active: ReadonlySet<string> = new Set()): Set<string> {
  const out = new Set<string>();
  for (const [key, rig] of Object.entries(rigs)) {
    const { slug, side } = parseJointKey(key);
    const j = joints.find((x) => x.slug === slug);
    if (!j) continue;
    if (active.has(key) || angleOf(j, side, pose) !== j.restDeg) for (const name of rig.crossing) out.add(name);
  }
  return out;
}

export type Trend = 'shortens' | 'lengthens' | 'stable';

/**
 * Whether a muscle shortens or lengthens when the joint moves in `direction` (+1: flexion or pronation).
 * null when its geometry contradicts its declared role: unknown rather than wrong.
 */
export function lengthTrend(m: { role: Role; momentArmMm: number }, direction: 1 | -1, motion: Motion = 'flexion-extension'): Trend | null {
  if (Math.abs(m.momentArmMm) < STABLE_MOMENT_ARM_MM[motion]) return 'stable';
  const shortensInPositive = m.momentArmMm < 0;
  if (shortensInPositive !== POSITIVE.includes(m.role)) return null;
  return (shortensInPositive ? direction > 0 : direction < 0) ? 'shortens' : 'lengthens';
}

/** Direction of motion for the length trend: the way the angle last moved; before any move, away from rest (+1 at rest). */
export function motionDirection(previous: { angle: number; direction: 1 | -1 } | null, angle: number, restDeg: number): 1 | -1 {
  if (!previous) return angle >= restDeg ? 1 : -1;
  if (angle === previous.angle) return previous.direction;
  return angle > previous.angle ? 1 : -1;
}

/** Movers of the positive direction first. */
const ROLE_ORDER: Role[] = Object.values(ROLES_OF).flat();

/** Muscles acting on a joint, with their role and (when measurable) their rig entry, sorted by role then name. */
export function musclesOf(joint: AtlasJoint, structures: AtlasStructure[], rig: Rig | undefined, lang: Lang) {
  return structures
    .flatMap((s) => (s.actions ?? []).filter((a) => a.joint === joint.slug).map((a) => ({ structure: s, role: a.role, rig: rig?.muscles.find((m) => m.slug === s.slug && m.role === a.role) })))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || labelText(a.structure, lang).localeCompare(labelText(b.structure, lang)));
}

/** Joints a structure takes part in: as a fixed, moving or coupled bone, or through its actions. */
export function jointsFor(joints: AtlasJoint[], s: AtlasStructure): AtlasJoint[] {
  const acted = new Set((s.actions ?? []).map((a) => a.joint));
  return joints.filter((j) => j.proximal === s.slug || j.moving.includes(s.slug) || (j.coupled ?? []).some((c) => c.bone === s.slug) || acted.has(j.slug));
}
