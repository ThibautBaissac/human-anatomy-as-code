// Writing planned structures into existing YAML documents without losing curator work.
import { Document, isMap, isScalar, YAMLMap, type Pair } from 'yaml';
import type { Labels, Side, Structure } from '../types.ts';

export const KEY_ORDER = ['slug', 'kind', 'laterality', 'status', 'sex', 'parent', 'regions', 'systems', 'layer', 'aliases', 'labels', 'ids', 'sides', 'meshes', 'variants', 'actions', 'relations'];
const LABEL_KEY_ORDER = ['text', 'gender', 'number', 'source', 'status', 'synonyms', 'description'];
const IDS_ORDER = ['fma', 'ta2', 'ta98', 'uberon', 'wikidata'];
/** ids keys the import computes; any other key (uberon) belongs to curators. */
const COMPUTED_IDS = ['fma', 'ta2', 'ta98', 'wikidata'] as const;
/** label keys the import always sets; gender and number are set only when the import knows them. */
const COMPUTED_LABEL_KEYS = ['text', 'source', 'status'] as const;
const SIDE_ORDER = ['ids', 'meshes', 'labels', 'relations'];
const LANG_ORDER = ['en', 'fr', 'la'];
const SIDES: Side[] = ['left', 'right'];

/** A structure with its keys in the canonical file order. */
export function canonicalStructure(s: Structure): Structure {
  return orderKeys(s as unknown as Record<string, unknown>, KEY_ORDER) as unknown as Structure;
}

function orderKeys(obj: Record<string, unknown>, order: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of order) if (obj[k] !== undefined) out[k] = orderNested(obj[k], k);
  for (const k of Object.keys(obj)) if (!(k in out) && obj[k] !== undefined) out[k] = orderNested(obj[k], k);
  return out;
}

function orderNested(v: unknown, key: string): unknown {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  const o = v as Record<string, unknown>;
  if (key === 'labels') return orderKeys(Object.fromEntries(Object.entries(o).map(([k, l]) => [k, orderKeys(l as Record<string, unknown>, LABEL_KEY_ORDER)])), LANG_ORDER);
  if (key === 'ids') return orderKeys(o, IDS_ORDER);
  if (key === 'sides') return Object.fromEntries(SIDES.filter((s) => o[s]).map((s) => [s, orderKeys(o[s] as Record<string, unknown>, SIDE_ORDER)]));
  return o;
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return equal(ka, kb) && ka.every((k) => equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

const keyOf = (p: Pair) => (isScalar(p.key) ? String(p.key.value) : String(p.key));

/** Sets a key, replacing the value only when it differs, inserting new keys at their canonical position. */
export function setOrdered(doc: Document, map: YAMLMap, key: string, value: unknown, order: string[]): void {
  const i = map.items.findIndex((p) => keyOf(p as Pair) === key);
  if (value === undefined) {
    if (i >= 0) map.items.splice(i, 1);
    return;
  }
  if (i >= 0) {
    const cur = (map.items[i] as Pair).value;
    const js = cur && typeof cur === 'object' && 'toJSON' in cur ? (cur as { toJSON(): unknown }).toJSON() : cur;
    if (!equal(js, value)) (map.items[i] as Pair).value = doc.createNode(value);
    return;
  }
  const rank = (k: string) => (order.indexOf(k) < 0 ? Infinity : order.indexOf(k));
  let pos = map.items.findIndex((p) => rank(keyOf(p as Pair)) > rank(key));
  if (pos < 0) pos = map.items.length;
  map.items.splice(pos, 0, doc.createPair(key, value) as Pair);
}

function childMap(doc: Document, map: YAMLMap, key: string, order: string[]): YAMLMap {
  const existing = map.get(key, true);
  if (isMap(existing)) return existing as YAMLMap;
  setOrdered(doc, map, key, {}, order);
  return map.get(key, true) as unknown as YAMLMap;
}

export function mergeLabels(doc: Document, root: YAMLMap, planned: Labels, onlyMissing: boolean): void {
  const labels = childMap(doc, root, 'labels', KEY_ORDER);
  for (const lang of LANG_ORDER as (keyof Labels)[]) {
    const p = planned[lang];
    if (!p) continue;
    const cur = labels.get(lang, true);
    if (!isMap(cur)) { setOrdered(doc, labels, lang, p, LANG_ORDER); continue; }
    // A reviewed label, or one written by someone else than the import (a curator's correction), is never changed.
    if (onlyMissing || cur.get('status') === 'reviewed' || cur.get('source') !== p.source) continue;
    const label = cur as YAMLMap;
    for (const key of COMPUTED_LABEL_KEYS) setOrdered(doc, label, key, p[key], LABEL_KEY_ORDER);
    if (p.gender) setOrdered(doc, label, 'gender', p.gender, LABEL_KEY_ORDER);
    if (p.number) setOrdered(doc, label, 'number', p.number, LABEL_KEY_ORDER);
  }
}

/** Sets the ids keys the import computes, keeping any other key a curator added. */
function mergeIds(doc: Document, parent: YAMLMap, planned: Structure['ids'], order: string[]): void {
  const cur = parent.get('ids', true);
  if (!isMap(cur)) { setOrdered(doc, parent, 'ids', planned, order); return; }
  for (const key of COMPUTED_IDS) setOrdered(doc, cur as YAMLMap, key, planned?.[key], IDS_ORDER);
  if (!(cur as YAMLMap).items.length) setOrdered(doc, parent, 'ids', undefined, order);
}

/** True when the file holds a reviewed side label override, which a laterality change would delete. */
export function hasReviewedSideLabels(root: YAMLMap): boolean {
  const sides = root.toJSON().sides as Record<string, { labels?: Labels }> | undefined;
  return Object.values(sides ?? {}).some((b) => Object.values(b?.labels ?? {}).some((l) => l?.status === 'reviewed'));
}

/** Recomputes the non-label fields of a draft structure; `keepShape` leaves laterality, sides and meshes alone. */
export function mergeDraft(doc: Document, root: YAMLMap, s: Structure, keepShape = false): void {
  for (const key of ['kind', 'parent', 'regions', 'systems'] as const) setOrdered(doc, root, key, s[key], KEY_ORDER);
  mergeIds(doc, root, s.ids, KEY_ORDER);
  mergeLabels(doc, root, s.labels, false);
  if (keepShape) return;
  setOrdered(doc, root, 'laterality', s.laterality, KEY_ORDER);
  if (s.sides) {
    const sides = childMap(doc, root, 'sides', KEY_ORDER);
    for (const side of SIDES) {
      const block = childMap(doc, sides, side, SIDES);
      mergeIds(doc, block, s.sides[side].ids, SIDE_ORDER);
      setOrdered(doc, block, 'meshes', s.sides[side].meshes, SIDE_ORDER);
      // Side labels belong to curators: only a missing one is added, an existing one is never changed.
      for (const [lang, label] of Object.entries(s.sides[side].labels ?? {})) {
        const labels = block.get('labels', true);
        if (isMap(labels) && labels.has(lang)) continue;
        setOrdered(doc, childMap(doc, block, 'labels', SIDE_ORDER), lang, label, LANG_ORDER);
      }
    }
  } else setOrdered(doc, root, 'sides', undefined, KEY_ORDER);
  setOrdered(doc, root, 'meshes', s.meshes, KEY_ORDER);
}
