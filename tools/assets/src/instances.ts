// Instances: one per structure-side with meshes, in each model's atlas. Pure.
import type { RigJoint, Role } from './joints/rig.ts';

export const HRA_PREFIX = 'hra:';
export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export type Side = 'left' | 'right';
export interface AtlasStructure {
  slug: string;
  kind: string;
  parent?: string;
  regions?: string[];
  meshes?: string[];
  sides?: Partial<Record<Side, { meshes?: string[] }>>;
  actions?: { joint: string; role: Role }[];
}
export interface AtlasInput {
  structures: AtlasStructure[];
  joints?: RigJoint[];
}

export interface Instance {
  name: string;
  slug: string;
  side: Side | null;
  kind: string;
  meshes: string[];
}

/** One instance per non-bilateral structure with meshes, one per side with meshes. */
export function listInstances(atlas: AtlasInput): Instance[] {
  const out: Instance[] = [];
  for (const s of atlas.structures) {
    if (s.meshes?.length) out.push({ name: s.slug, slug: s.slug, side: null, kind: s.kind, meshes: [...s.meshes].sort(cmp) });
    for (const side of ['left', 'right'] as const) {
      const m = s.sides?.[side]?.meshes;
      if (m?.length) out.push({ name: `${s.slug}@${side}`, slug: s.slug, side, kind: s.kind, meshes: [...m].sort(cmp) });
    }
  }
  return out.sort((a, b) => cmp(a.name, b.name));
}


/** The GLB file an instance goes to: BodyParts3D instances by kind (shared), HRA instances in female-<kind>. */
export const fileOf = (i: Instance) => (i.meshes.some((m) => m.startsWith(HRA_PREFIX)) ? `female-${i.kind}` : i.kind);
