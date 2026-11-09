// Index over atlas.json and the loaded instances: who is what, who contains whom. Pure.
import type { Atlas, AtlasStructure, Side } from './types.ts';

export const ROOT = 'human-body';
/** Tree bucket for structures without a parent, other than the root. */
export const UNATTACHED = '__unattached__';

export interface InstanceInfo {
  index: number;
  name: string;
  slug: string;
  side: Side | null;
  kind: string;
  layer: number;
  /** false when none of its meshes belongs to the displayed model (e.g. male geometry in a shared file) */
  inModel: boolean;
}

export interface Catalog {
  structure(slug: string): AtlasStructure | undefined;
  instance(index: number): InstanceInfo;
  instanceCount: number;
  /** Own instances of a structure (one side if given); for a structure without any, those of its descendants. */
  instancesOf(slug: string, side?: Side | null): number[];
  roots: string[];
  childrenOf(id: string): string[];
  parentOf(id: string): string | null;
  /** From the root down to the direct parent. */
  ancestorsOf(id: string): string[];
  kinds: string[];
  maxLayer: number;
}

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildCatalog(atlas: Atlas, loaded: (string | { name: string; meshes: string[] })[]): Catalog {
  const structures = new Map(atlas.structures.map((s) => [s.slug, s]));
  const instances: InstanceInfo[] = loaded.map((entry, index) => {
    const { name, meshes } = typeof entry === 'string' ? { name: entry, meshes: undefined } : entry;
    const [slug, side] = name.split('@') as [string, Side | undefined];
    const s = structures.get(slug);
    // an atlas without mesh index (hand-written fixtures) shows every instance of its structures
    const inModel = !!s && (!meshes || Object.keys(atlas.meshIndex).length === 0 || meshes.some((m) => m in atlas.meshIndex));
    return { index, name, slug, side: side ?? null, kind: s?.kind ?? 'organ', layer: s?.layer ?? 0, inModel };
  });
  const own = new Map<string, number[]>();
  for (const i of instances) if (i.inModel) own.set(i.slug, [...(own.get(i.slug) ?? []), i.index]);

  const children = new Map<string, string[]>();
  const parent = new Map<string, string>();
  for (const s of atlas.structures) {
    if (s.slug === ROOT) continue;
    const p = s.parent && structures.has(s.parent) ? s.parent : UNATTACHED;
    parent.set(s.slug, p);
    children.set(p, [...(children.get(p) ?? []), s.slug]);
  }
  for (const list of children.values()) list.sort(byKey);

  const descendantsInstances = (slug: string, side: Side | null | undefined): number[] => {
    const out: number[] = [];
    const stack = [...(children.get(slug) ?? [])];
    while (stack.length) {
      const c = stack.pop()!;
      for (const i of own.get(c) ?? []) if (!side || instances[i].side === side) out.push(i);
      stack.push(...(children.get(c) ?? []));
    }
    return out.sort((a, b) => a - b);
  };

  const shown = instances.filter((i) => i.inModel);
  const kinds = [...new Set(shown.map((i) => i.kind))].sort(byKey);
  const maxLayer = Math.max(0, ...shown.map((i) => i.layer));

  return {
    structure: (slug) => structures.get(slug),
    instance: (index) => instances[index],
    instanceCount: instances.length,
    instancesOf(slug, side) {
      const mine = (own.get(slug) ?? []).filter((i) => !side || instances[i].side === side);
      return mine.length ? mine : descendantsInstances(slug, side);
    },
    roots: children.has(UNATTACHED) ? [ROOT, UNATTACHED] : [ROOT],
    childrenOf: (id) => children.get(id) ?? [],
    parentOf: (id) => parent.get(id) ?? null,
    ancestorsOf(id) {
      const out: string[] = [];
      for (let p = parent.get(id); p; p = parent.get(p)) out.unshift(p);
      return out;
    },
    kinds,
    maxLayer,
  };
}
