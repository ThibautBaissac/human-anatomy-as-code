// Rig of one side of a joint (pure): which instances turn with it, which cross it, and where the muscles acting
// on it are attached. Computed once at build time, in world coordinates of the rest pose (spec 2026-11-09-animations-v1).
import { dot, length, mean, normalize, rotateAbout, scale, sub, type Vec3 } from './fit.ts';
import { within } from './measure.ts';

type Side = 'left' | 'right';
export type Limb = 'upper-limb' | 'lower-limb';
export type Role = 'flexion' | 'extension' | 'pronation' | 'supination';

export interface RigInstance {
  /** node name: slug@side, or slug for a midline instance */
  name: string;
  slug: string;
  side: Side | null;
  kind: string;
  /** limb the structure (or an ancestor) belongs to */
  limb: Limb | null;
  /** world positions, xyz */
  positions: Float32Array;
}

export interface RigJoint {
  slug: string;
  motion: 'flexion-extension' | 'pronation-supination';
  proximal: string;
  moving: string[];
  coupled?: { bone: string; ratio: number }[];
  rangeDeg: [number, number];
  restDeg: number;
  sides?: Partial<Record<Side, { centre: Vec3; axis: Vec3 }>>;
}

export interface RigMuscle {
  name: string;
  slug: string;
  role: Role;
  /**
   * Moment arm at rest (mm per radian): derivative of the length of the chord origin → insertion with the angle.
   * Negative: the muscle shortens in the positive direction (flexion, pronation). Taken at rest because the chord
   * goes round the axis at large angles, where real muscles wrap over bones (the quadriceps over the patella).
   */
  momentArmMm: number;
}

export interface Rig {
  moving: string[];
  coupled: { name: string; ratio: number }[];
  crossing: string[];
  muscles: RigMuscle[];
}

/** Margin (mm) a vertex must clear the joint plane by to count on one side. */
export const MARGIN_MM = 3;
/** Only vertices this close (mm) to the centre count when deciding that an instance crosses (research note §4.1). */
export const CROSSING_RADIUS_MM = 80;
/** Capsule around the distal segment, for structures whose limb is unknown: radius and reach beyond the far end, as fractions of the segment length. */
const CAPSULE_RADIUS = 0.5;
const CAPSULE_REACH = 1;
/** Attachment: centroid of the vertices within this distance (mm) of the extreme vertex. */
const ATTACHMENT_MM = 10;
/** Via point of a flexion muscle: its vertices up to this height (mm) above the joint plane. */
const VIA_BAND_MM = 50;
/** A muscle vertex this close (mm) to a bone touches it. */
const CONTACT_MM = 5;
/** Below this moment arm (mm/rad), a muscle is "stable" and its role cannot be checked against the geometry. */
export const STABLE_MOMENT_ARM_MM = 5;
const POSITIVE: Role[] = ['flexion', 'pronation'];
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const points = (p: Float32Array): Vec3[] => {
  const out: Vec3[] = [];
  for (let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2]]);
  return out;
};

export function rigJoint(joint: RigJoint, side: Side, instances: RigInstance[], actionsOf: Map<string, { joint: string; role: Role }[]>): { rig: Rig; warnings: string[] } {
  const s = joint.sides?.[side];
  if (!s) throw new Error(`${joint.slug} : côté ${side} non mesuré`);
  const byName = new Map(instances.map((i) => [i.name, i]));
  const proximal = byName.get(`${joint.proximal}@${side}`);
  if (!proximal) throw new Error(`${joint.slug} : instance ${joint.proximal}@${side} introuvable`);
  const prox = points(proximal.positions);
  const limb = proximal.limb;

  // Joint plane through the centre; its normal points to the proximal segment.
  const far = prox.reduce((a, b) => (length(sub(b, s.centre)) > length(sub(a, s.centre)) ? b : a));
  const toProximal = normalize(sub(far, s.centre));
  const normal = joint.motion === 'pronation-supination' ? scale(s.axis, Math.sign(dot(s.axis, toProximal)) || 1) : toProximal;
  const height = (p: Vec3) => dot(sub(p, s.centre), normal);

  // Distal segment: from the centre to the far end of the moving bones. A structure of unknown limb moves only if it lies
  // wholly in a capsule around it (the left trunk and leg also lie below the left elbow).
  const distal = joint.moving.flatMap((b) => { const i = byName.get(`${b}@${side}`); return i ? points(i.positions) : []; });
  const distalEnd = distal.length ? distal.reduce((a, b) => (length(sub(b, s.centre)) > length(sub(a, s.centre)) ? b : a)) : s.centre;
  const segment = length(sub(distalEnd, s.centre)) || 1;
  const along = normalize(sub(distalEnd, s.centre));
  const inCapsule = (p: Vec3) => {
    const w = sub(p, s.centre);
    const t = Math.min(Math.max(dot(w, along), 0), segment * (1 + CAPSULE_REACH));
    return length(sub(w, scale(along, t))) <= CAPSULE_RADIUS * segment;
  };

  const listed = new Set([joint.proximal, ...joint.moving, ...(joint.coupled ?? []).map((c) => c.bone)].map((b) => `${b}@${side}`));
  const acting = (slug: string) => (actionsOf.get(slug) ?? []).filter((a) => a.joint === joint.slug);
  const moving = new Set(joint.moving.map((b) => `${b}@${side}`).filter((n) => byName.has(n)));
  const crossing = new Set<string>();
  for (const inst of instances) {
    if (listed.has(inst.name)) continue;
    const candidate = inst.kind === 'skin' || (inst.side === side && (inst.limb === null || inst.limb === limb));
    if (!candidate) continue;
    let above = 0, below = 0, allBelow = true, allInCapsule = true;
    for (let i = 0; i < inst.positions.length; i += 3) {
      const p: Vec3 = [inst.positions[i], inst.positions[i + 1], inst.positions[i + 2]];
      const h = height(p);
      if (h >= -MARGIN_MM) allBelow = false;
      if (allInCapsule && !inCapsule(p)) allInCapsule = false;
      if (length(sub(p, s.centre)) > CROSSING_RADIUS_MM) continue;
      if (h > MARGIN_MM) above++;
      else if (h < -MARGIN_MM) below++;
    }
    const geometric = above >= 3 && below >= 3;
    if (geometric || (inst.kind !== 'skin' && acting(inst.slug).length)) crossing.add(inst.name);
    else if (allBelow && inst.kind !== 'skin' && (inst.limb === limb || allInCapsule)) moving.add(inst.name);
  }

  // Attachments: where the muscle touches the proximal bone (origin) and the moving bones (insertion);
  // failing contact, its extreme vertices on each side of the joint plane.
  const warnings: string[] = [];
  const muscles: RigMuscle[] = [];
  for (const name of [...crossing].sort(cmp)) {
    const inst = byName.get(name)!;
    const roles = acting(inst.slug);
    if (!roles.length) continue;
    const pts = points(inst.positions);
    const top = pts.reduce((a, b) => (height(b) > height(a) ? b : a)), bottom = pts.reduce((a, b) => (height(b) < height(a) ? b : a));
    const spans = height(top) > MARGIN_MM && height(bottom) < -MARGIN_MM;
    const onProximal = within(pts, prox, CONTACT_MM), onMoving = within(pts, distal, CONTACT_MM);
    // flexion: the path where the muscle crosses the joint (a band just above the plane) is the via point that
    // a straight chord from the far origin would miss for muscles curving round the condyles (sartorius, gracilis)
    const band = joint.motion === 'flexion-extension' ? pts.filter((p) => { const h = height(p); return h > MARGIN_MM && h <= VIA_BAND_MM; }) : [];
    const origin = band.length >= 3 ? mean(band) : onProximal.length >= 3 ? mean(onProximal) : mean(pts.filter((p) => length(sub(p, top)) <= ATTACHMENT_MM));
    const insertion = onMoving.length >= 3 ? mean(onMoving) : spans ? mean(pts.filter((p) => length(sub(p, bottom)) <= ATTACHMENT_MM)) : null;
    if (!insertion) continue; // does not reach the moving segment in our meshes
    const lengthAt = (deg: number) => length(sub(origin, rotateAbout(insertion, s.centre, s.axis, deg)));
    const momentArmMm = Math.round(((lengthAt(1) - lengthAt(-1)) / ((2 * Math.PI) / 180)) * 10) / 10 + 0;
    for (const { role } of roles) {
      muscles.push({ name, slug: inst.slug, role, momentArmMm });
      const shortens = momentArmMm < 0;
      if (Math.abs(momentArmMm) >= STABLE_MOMENT_ARM_MM && shortens !== POSITIVE.includes(role)) {
        warnings.push(`${joint.slug} : ${name} déclaré en ${role}, mais au repos sa corde ${shortens ? 'se raccourcit' : "s'allonge"} dans le sens positif (bras de levier ${momentArmMm} mm)`);
      }
    }
  }
  return {
    rig: {
      moving: [...moving].sort(cmp),
      coupled: (joint.coupled ?? []).map((c) => ({ name: `${c.bone}@${side}`, ratio: c.ratio })).filter((c) => byName.has(c.name)),
      crossing: [...crossing].sort(cmp),
      muscles,
    },
    warnings,
  };
}
