// Index over a model's atlas and the loaded instances: who is what, who contains whom. Pure.
import { SYSTEMS, type Atlas, type AtlasStructure, type Selection, type Side } from './types.ts';

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
  /** systems of its structure (empty for a region) */
  systems: string[];
  /** false when none of its meshes belongs to the displayed model (e.g. male geometry in a shared file) */
  inModel: boolean;
}

export interface Catalog {
  structure(slug: string): AtlasStructure | undefined;
  instance(index: number): InstanceInfo;
  instanceCount: number;
  /** Own instances of a structure (one side if given); for a structure without any, those of its descendants. */
  instancesOf(slug: string, side?: Side | null): number[];
  /** Instances of structure keys (slug or slug@side); unknown structures give none. */
  instancesOfKeys(keys: readonly string[]): Set<number>;
  roots: string[];
  childrenOf(id: string): string[];
  parentOf(id: string): string | null;
  /** From the root down to the direct parent. */
  ancestorsOf(id: string): string[];
  kinds: string[];
  /** systems of the shown instances, in vocabulary order */
  systems: string[];
  maxLayer: number;
  /** kinds of the shown instances at each layer (index = layer), skin first, bone last */
  layerKinds: string[][];
}

/** Order of the kinds inside a layer: the one that names the layer best comes first. */
const KIND_ORDER = ['skin', 'fascia', 'muscle', 'tendon', 'organ', 'cns', 'artery', 'vein', 'nerve', 'lymphatic', 'ligament', 'bone', 'cartilage', 'joint'];
const kindRank = (k: string) => { const i = KIND_ORDER.indexOf(k); return i < 0 ? KIND_ORDER.length : i; };

/**
 * Layers of the instances a view shows (by kind and system, before any layer cut). Removing layers changes
 * something only when there are at least two.
 */
export function shownLayers(catalog: Pick<Catalog, 'instance' | 'instanceCount'>, hiddenKinds: readonly string[], hiddenSystems: readonly string[]): number[] {
  const kinds = new Set(hiddenKinds), systems = new Set(hiddenSystems), out = new Set<number>();
  for (let i = 0; i < catalog.instanceCount; i++) {
    const x = catalog.instance(i);
    if (!x.inModel || kinds.has(x.kind) || (x.systems.length && x.systems.every((s) => systems.has(s)))) continue;
    out.add(x.layer);
  }
  return [...out].sort((a, b) => a - b);
}

/** Key of a structure-side: slug@side, or slug for a whole structure. */
export const selectionKey = (s: Selection): string => (s.side ? `${s.slug}@${s.side}` : s.slug);
/** The structure-side a key names, or null when it is malformed. */
export function parseSelectionKey(key: string): Selection | null {
  const [slug, side, extra] = key.split('@');
  if (!slug || extra !== undefined || (side !== undefined && side !== 'left' && side !== 'right')) return null;
  return { slug, side: (side as Side | undefined) ?? null };
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
    return { index, name, slug, side: side ?? null, kind: s?.kind ?? 'organ', layer: s?.layer ?? 0, systems: s?.systems ?? [], inModel };
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
  const layerKinds: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const k of kinds) for (const l of new Set(shown.filter((i) => i.kind === k).map((i) => i.layer))) layerKinds[l].push(k);
  for (const list of layerKinds) list.sort((a, b) => kindRank(a) - kindRank(b) || byKey(a, b));
  const present = new Set(shown.flatMap((i) => i.systems));
  const systems = SYSTEMS.filter((x) => present.has(x));

  return {
    structure: (slug) => structures.get(slug),
    instance: (index) => instances[index],
    instanceCount: instances.length,
    instancesOf(slug, side) {
      const mine = (own.get(slug) ?? []).filter((i) => !side || instances[i].side === side);
      return mine.length ? mine : descendantsInstances(slug, side);
    },
    instancesOfKeys(keys) {
      const out = new Set<number>();
      for (const k of keys) {
        const sel = parseSelectionKey(k);
        if (sel && structures.has(sel.slug)) for (const i of this.instancesOf(sel.slug, sel.side)) out.add(i);
      }
      return out;
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
    systems,
    maxLayer,
    layerKinds,
  };
}
