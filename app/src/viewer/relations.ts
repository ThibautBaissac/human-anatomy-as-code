// Relations of a selection and the network of a vessel. Pure: no three.js, no DOM.
import { RELATION_TYPES, type AtlasStructure, type RelationType, type Selection, type Side } from './types.ts';

export interface RelationItem {
  type: RelationType;
  direction: 'forward' | 'inverse';
  /** slug or wikidata:Q… */
  ref: string;
  /** side to select on the other end */
  side: Side | null;
  /** side of a side-level relation, only while the selection has no side */
  mark: Side | null;
  presence: 'present' | 'outside' | 'external';
  status: 'draft' | 'reviewed';
}

export interface RelationGraph {
  structure(slug: string): AtlasStructure | undefined;
  childrenOf(id: string): string[];
  isOutside(ref: string): boolean;
  isExternal(ref: string): boolean;
}

const isBilateral = (s: AtlasStructure | undefined) => s?.laterality === 'bilateral';

/**
 * Side on the other end of a link from `from` (shown at side `s`), or undefined when the link does not hold
 * for that side. `r` is the side of a side-level relation (the subject's side).
 */
export function deriveSide(from: AtlasStructure | undefined, to: AtlasStructure | undefined, s: Side | null, r?: Side): { side: Side | null } | undefined {
  if (r) {
    if (s && s !== r) return undefined;
    return { side: isBilateral(to) ? r : null };
  }
  return { side: s && isBilateral(from) && isBilateral(to) ? s : null };
}

/** Relations of a selection: by type order, forward before inverse, the compiled order kept inside. */
export function relationItems(graph: RelationGraph, sel: Selection): RelationItem[] {
  const st = graph.structure(sel.slug);
  if (!st) return [];
  const out: RelationItem[] = [];
  const add = (type: RelationType, direction: RelationItem['direction'], ref: string, r: Side | undefined, status: RelationItem['status']) => {
    const other = graph.structure(ref);
    const presence = other ? 'present' : graph.isExternal(ref) ? 'external' : graph.isOutside(ref) ? 'outside' : null;
    if (!presence) return;
    const d = deriveSide(st, other, sel.side, r);
    if (!d) return;
    out.push({ type, direction, ref, side: d.side, mark: r && !sel.side ? r : null, presence, status });
  };
  for (const r of st.relations ?? []) add(r.type, 'forward', r.target, r.side, r.status);
  for (const r of st.inverse ?? []) add(r.type, 'inverse', r.subject, r.side, r.status);
  const rank = (i: RelationItem) => RELATION_TYPES.indexOf(i.type) * 2 + (i.direction === 'inverse' ? 1 : 0);
  return out.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map((e) => e.x);
}

const TREE: readonly RelationType[] = ['branch-of', 'tributary-of', 'continuation-of'];
const SUPPLY: readonly RelationType[] = ['arterial-supply', 'innervation'];
const NETWORK_KINDS = ['artery', 'vein', 'nerve', 'lymphatic'];
const key = (slug: string, side: Side | null) => (side ? `${slug}@${side}` : slug);

/** Keys (slug or slug@side) of a vessel's network: branches, tributaries, continuations, parts, then what they supply. */
export function networkOf(graph: RelationGraph, sel: Selection): string[] {
  const origin = graph.structure(sel.slug);
  const members = new Map<string, Selection>([[key(sel.slug, sel.side), sel]]);
  if (!origin || !NETWORK_KINDS.includes(origin.kind)) return [...members.keys()].sort();
  const queue = [sel];
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q], st = graph.structure(cur.slug)!;
    const visit = (slug: string, r: Side | undefined) => {
      const other = graph.structure(slug);
      const d = other && deriveSide(st, other, cur.side, r);
      if (!d) return;
      const k = key(slug, d.side);
      if (members.has(k)) return;
      const next = { slug, side: d.side };
      members.set(k, next);
      queue.push(next);
    };
    for (const i of st.inverse ?? []) if (TREE.includes(i.type)) visit(i.subject, i.side);
    for (const c of graph.childrenOf(cur.slug)) if (graph.structure(c)?.kind === st.kind) visit(c, undefined);
  }
  for (const m of [...members.values()]) {
    const st = graph.structure(m.slug)!;
    for (const i of st.inverse ?? []) {
      if (!SUPPLY.includes(i.type)) continue;
      const other = graph.structure(i.subject);
      const d = other && deriveSide(st, other, m.side, i.side);
      if (d) members.set(key(i.subject, d.side), { slug: i.subject, side: d.side });
    }
  }
  return [...members.keys()].sort();
}
