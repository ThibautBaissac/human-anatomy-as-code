// Rigs of the joints of one model (manifest models.<model>.joints), from its atlas and the instances' geometry.
import { mergeMeshes } from './obj.ts';
import { rigJoint, type Limb, type Rig, type RigInstance } from './joints/rig.ts';
import type { AtlasInput, Instance } from './instances.ts';
import type { Geometry } from './geometry.ts';

/** The limb a structure belongs to, through its own regions or an ancestor's. */
function limbsOf(atlas: AtlasInput): Map<string, Limb | null> {
  const bySlug = new Map(atlas.structures.map((s) => [s.slug, s]));
  const out = new Map<string, Limb | null>();
  const find = (slug: string | undefined, seen = new Set<string>()): Limb | null => {
    if (!slug || seen.has(slug)) return null;
    if (out.has(slug)) return out.get(slug)!;
    seen.add(slug);
    const s = bySlug.get(slug);
    const own = s?.regions?.find((r): r is Limb => r === 'upper-limb' || r === 'lower-limb') ?? null;
    const limb = own ?? find(s?.parent, seen);
    out.set(slug, limb);
    return limb;
  };
  for (const s of atlas.structures) find(s.slug);
  return out;
}

/** Rigs of every side of every joint of one model, keyed joint@side. */
export function rigsOf(atlas: AtlasInput, instances: Instance[], geometry: Map<string, Geometry>, warn: (m: string) => void): Record<string, Rig> | undefined {
  if (!atlas.joints?.length) return undefined;
  const limb = limbsOf(atlas);
  const actions = new Map(atlas.structures.filter((s) => s.actions).map((s) => [s.slug, s.actions!]));
  const rigInstances: RigInstance[] = instances.map((i) => ({
    name: i.name, slug: i.slug, side: i.side, kind: i.kind, limb: limb.get(i.slug) ?? null,
    positions: mergeMeshes(i.meshes.map((m) => geometry.get(m)!)).positions,
  }));
  const out: Record<string, Rig> = {};
  for (const j of atlas.joints) {
    for (const side of ['left', 'right'] as const) {
      if (!j.sides?.[side]) continue;
      const { rig, warnings } = rigJoint(j, side, rigInstances, actions);
      out[`${j.slug}@${side}`] = rig;
      warnings.forEach(warn);
    }
  }
  return out;
}

