// Planning: BodyParts3D concepts + Wikidata rows → structures (pure, no disk writes).
import { fmaNumber, type Bp3d } from './bp3d.ts';
import type { Wikidata, WikidataRow } from './wikidata.ts';
import { genderOf, isNoFold, kindOfName, REGION_OF_ANCESTOR, SIDE_PREFIX, slugify, splitSide, systemsOf, TA98_PATTERN } from './rules.ts';
import { canonicalStructure } from './yaml-merge.ts';
import { byKey } from '../fs-util.ts';
import type { Ids, Label, Labels, Side, SideBlock, Structure } from '../types.ts';

export interface Overrides {
  /** canonical names (without side word) whose left/right concepts are distinct structures */
  noFold?: string[];
  /** mesh file id → concept id that owns it */
  ties?: Record<string, string>;
  /** canonical English name → forced slug */
  slugs?: Record<string, string>;
  /** slug → systems, replacing the derived ones */
  systems?: Record<string, string[]>;
}

export interface Plan {
  structures: Structure[];
  skippedConcepts: number;
  ties: { mesh: string; winner: string; losers: string[] }[];
  parentConflicts: { slug: string; kept: string; other: string }[];
  slugCollisions: { slug: string; renamed: string }[];
  canonicalMeshConflicts: { slug: string; meshes: string[] }[];
  unownedMeshes: string[];
}

const SIDES: Side[] = ['left', 'right'];

/** Sets the systems of each structure (spec 2026-11-09-systemes): an override, or derived from kind, name and ancestors. */
export function withSystems(structures: Structure[], overrides: Record<string, string[]> = {}, outsideParents = new Map<string, string | undefined>()): void {
  // parents of the structures planned here, then of the existing ones (HRA structures hang under BodyParts3D groups)
  const parentOf = new Map([...outsideParents, ...structures.map((s) => [s.slug, s.parent] as const)]);
  for (const s of structures) {
    const ancestors: string[] = [];
    for (let p = s.parent; p && !ancestors.includes(p); p = parentOf.get(p)) ancestors.push(p);
    const systems = overrides[s.slug] ?? systemsOf({ kind: s.kind, name: s.labels.en?.text ?? s.slug, ancestors });
    if (systems.length) s.systems = [...systems];
    else delete s.systems;
  }
}
const meshRef = (fj: string) => `bp3d:${fj}`;

/** External references of a concept: its FMA id plus TA2, TA98 (when well-formed) and QID of its Wikidata item. */
function idsFrom(fma: number | undefined, r: WikidataRow | undefined): Ids {
  const ids: Ids = {};
  if (fma !== undefined) ids.fma = fma;
  if (r?.ta2) ids.ta2 = r.ta2;
  if (r?.ta98 && TA98_PATTERN.test(r.ta98)) ids.ta98 = r.ta98;
  if (r?.qid) ids.wikidata = r.qid;
  return ids;
}

interface Unit {
  name: string;
  laterality: Structure['laterality'];
  self?: string;
  left?: string;
  right?: string;
}

/** Source concepts a structure stands for: the canonical concept and/or its two sides. */
const reps = (u: Unit) => [u.self, u.left, u.right].filter((c): c is string => c !== undefined);

export function planStructures(bp: Bp3d, wd: Wikidata, overrides: Overrides = {}): Plan {
  const noFold = new Set(overrides.noFold ?? []);
  const row = (concept: string): WikidataRow | undefined => wd.byFma.get(fmaNumber(concept));

  // 1. Mesh ownership: the most specific concept (fewest elements), ties broken by rule.
  const containing = new Map<string, string[]>();
  for (const [c, fjs] of bp.elements) for (const fj of fjs) containing.set(fj, [...(containing.get(fj) ?? []), c]);
  const tieRank = (c: string): (number)[] => {
    const r = row(c);
    return [r?.ta2 || r?.ta98 ? 0 : 1, r?.fr ? 0 : 1, bp.isaHasChildren.has(c) ? 1 : 0, fmaNumber(c)];
  };
  const cmpRank = (a: string, b: string) => {
    const ra = tieRank(a), rb = tieRank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  };
  const ownMeshes = new Map<string, string[]>();
  const ties: Plan['ties'] = [];
  for (const fj of [...containing.keys()].sort(byKey)) {
    const cs = containing.get(fj)!;
    const min = Math.min(...cs.map((c) => bp.elements.get(c)!.size));
    const tied = cs.filter((c) => bp.elements.get(c)!.size === min);
    // A part-of descendant of another tied concept is more specific: drop its tied ancestors.
    const ancestorsOf = (c: string) => { const out = new Set<string>(); for (let p = bp.partofParent.get(c); p; p = bp.partofParent.get(p)) out.add(p); return out; };
    const shadowed = new Set(tied.flatMap((c) => [...ancestorsOf(c)]));
    const best = tied.filter((c) => !shadowed.has(c)).sort(cmpRank);
    const forced = overrides.ties?.[fj];
    const winner = forced && cs.includes(forced) ? forced : best[0];
    if (best.length > 1 || winner !== best[0]) ties.push({ mesh: fj, winner, losers: best.filter((c) => c !== winner).sort(byKey) });
    ownMeshes.set(winner, [...(ownMeshes.get(winner) ?? []), fj]);
  }

  // 2. Candidates: the part-of tree plus every concept owning a mesh.
  const candidates = [...new Set([...bp.partof, ...ownMeshes.keys()])].sort((a, b) => fmaNumber(a) - fmaNumber(b));
  const candidateSet = new Set(candidates);

  // 3. Laterality folding: "left X" + "right X" (side word anywhere) → X with two sides.
  const sideGroups = new Map<string, Partial<Record<Side, { concept: string; prefix: boolean }>>>();
  const selfByName = new Map<string, string[]>();
  const addSelf = (name: string, c: string) => selfByName.set(name, [...(selfByName.get(name) ?? []), c]);
  for (const c of candidates) {
    const name = bp.names.get(c) ?? c;
    const split = splitSide(name);
    if (!split || isNoFold(split.canonical, noFold)) { addSelf(name, c); continue; }
    const g = sideGroups.get(split.canonical) ?? {};
    if (g[split.side] === undefined) g[split.side] = { concept: c, prefix: split.prefix };
    else addSelf(name, c);
    sideGroups.set(split.canonical, g);
  }
  const units: Unit[] = [];
  for (const [canonical, g] of sideGroups) {
    if (g.left && g.right) {
      const selves = selfByName.get(canonical);
      const self = selves?.shift();
      if (selves && !selves.length) selfByName.delete(canonical);
      units.push({ name: canonical, laterality: 'bilateral', self, left: g.left.concept, right: g.right.concept });
      continue;
    }
    // A lone side keeps its full name; it is unpaired only when the side word leads the name.
    const side = (g.left ? 'left' : 'right') as Side;
    const { concept, prefix } = g[side]!;
    const laterality = !prefix ? 'midline' : side === 'left' ? 'unpaired-left' : 'unpaired-right';
    units.push({ name: bp.names.get(concept)!, laterality, self: concept });
  }
  for (const [name, cs] of selfByName) for (const c of cs) units.push({ name, laterality: 'midline', self: c });

  // 4. Root identifiers.
  const candidateFmas = new Set(candidates.map(fmaNumber));
  const conceptByName = new Map<string, string>();
  for (const [c, n] of [...bp.names].sort((a, b) => fmaNumber(a[0]) - fmaNumber(b[0]))) if (!conceptByName.has(n)) conceptByName.set(n, c);
  const rootFma = (u: Unit): number | undefined => {
    if (u.self) return fmaNumber(u.self);
    const named = conceptByName.get(u.name);
    if (named) return fmaNumber(named);
    const r = wd.byEn.get(u.name.toLowerCase());
    return r?.fma && !candidateFmas.has(r.fma) ? r.fma : undefined;
  };
  const sortKey = (u: Unit) => rootFma(u) ?? (u.left ? fmaNumber(u.left) : u.right ? fmaNumber(u.right) : Infinity);
  units.sort((a, b) => sortKey(a) - sortKey(b) || byKey(a.name, b.name));

  // 5. Slugs.
  const slugCollisions: Plan['slugCollisions'] = [];
  const slugOf = new Map<Unit, string>();
  const taken = new Set<string>();
  for (const u of units) {
    let slug = overrides.slugs?.[u.name] ?? slugify(u.name);
    if (taken.has(slug)) {
      const renamed = `${slug}-fma${sortKey(u)}`;
      slugCollisions.push({ slug, renamed });
      slug = renamed;
    }
    taken.add(slug);
    slugOf.set(u, slug);
  }
  const unitOf = new Map<string, Unit>();
  for (const u of units) for (const c of reps(u)) unitOf.set(c, u);

  // 6. Parents (part-of, folded onto canonical units).
  const parentConflicts: Plan['parentConflicts'] = [];
  const parentOf = new Map<Unit, string>();
  for (const u of units) {
    const found: string[] = [];
    for (const c of reps(u)) {
      let p = bp.partofParent.get(c);
      while (p !== undefined && (!unitOf.has(p) || unitOf.get(p) === u)) p = bp.partofParent.get(p);
      if (p !== undefined) found.push(slugOf.get(unitOf.get(p)!)!);
    }
    if (!found.length) continue;
    parentOf.set(u, found[0]);
    for (const other of new Set(found.slice(1))) {
      if (other !== found[0]) parentConflicts.push({ slug: slugOf.get(u)!, kept: found[0], other });
    }
  }

  // 7. Regions from part-of ancestors.
  const regionsOf = (u: Unit): string[] | undefined => {
    const out = new Set<string>();
    for (const c of reps(u)) {
      for (let p = bp.partofParent.get(c); p !== undefined; p = bp.partofParent.get(p)) {
        const name = bp.names.get(p) ?? '';
        const bare = SIDE_PREFIX.exec(name)?.[2] ?? name;
        for (const r of REGION_OF_ANCESTOR[bare] ?? []) out.add(r);
      }
    }
    return out.size ? [...out].sort(byKey) : undefined;
  };

  // 8. Kinds: keywords on the name then is-a ancestors; group for mixed mesh-less containers.
  const keywordKind = (u: Unit): string => {
    const primary = u.self ?? u.left ?? u.right!;
    const k = kindOfName(u.name);
    if (k) return k;
    const seen = new Set([primary]);
    let frontier = [primary];
    while (frontier.length) {
      const next: string[] = [];
      for (const c of frontier) {
        const k2 = kindOfName(bp.names.get(c) ?? '');
        if (k2) return k2;
        for (const p of bp.isaParents.get(c) ?? []) if (!seen.has(p)) { seen.add(p); next.push(p); }
      }
      frontier = next;
    }
    return 'organ';
  };
  const hasOwnMeshes = (u: Unit) => reps(u).some((c) => ownMeshes.has(c));
  const childrenOf = new Map<string, Unit[]>();
  for (const [u, p] of parentOf) childrenOf.set(p, [...(childrenOf.get(p) ?? []), u]);
  const kindOf = new Map<Unit, string>();
  for (const u of units) if (hasOwnMeshes(u)) kindOf.set(u, keywordKind(u));
  for (const u of units) {
    if (kindOf.has(u)) continue;
    const kinds = new Set<string>();
    const stack = [...(childrenOf.get(slugOf.get(u)!) ?? [])];
    while (stack.length) {
      const d = stack.pop()!;
      if (kindOf.has(d) && hasOwnMeshes(d)) kinds.add(kindOf.get(d)!);
      stack.push(...(childrenOf.get(slugOf.get(d)!) ?? []));
    }
    kindOf.set(u, kinds.size >= 2 ? 'group' : keywordKind(u));
  }

  // 9. Assemble.
  const canonicalMeshConflicts: Plan['canonicalMeshConflicts'] = [];
  const placed = new Set<string>();
  const meshesOf = (c: string | undefined) => {
    const fjs = (c && ownMeshes.get(c)) || [];
    fjs.forEach((fj) => placed.add(fj));
    return fjs.length ? [...fjs].sort(byKey).map(meshRef) : undefined;
  };
  const labelFrom = (text: string, lang: 'fr' | 'la'): Label => {
    const gn = genderOf(text, lang);
    return { text, ...(gn ?? {}), source: 'wikidata', status: 'draft' };
  };
  const structures: Structure[] = units.map((u) => {
    const fma = rootFma(u);
    const r = fma !== undefined ? wd.byFma.get(fma) : undefined;
    const ids = idsFrom(fma, r);
    const labels: Labels = { en: { text: u.name, source: 'fma', status: 'draft' } };
    if (r?.fr) labels.fr = labelFrom(r.fr, 'fr');
    if (r?.la) labels.la = labelFrom(r.la, 'la');
    const s: Structure = { slug: slugOf.get(u)!, kind: kindOf.get(u)!, laterality: u.laterality, status: 'draft', labels };
    const parent = parentOf.get(u);
    if (parent) s.parent = parent;
    const regions = regionsOf(u);
    if (regions) s.regions = regions;
    if (Object.keys(ids).length) s.ids = ids;
    if (u.laterality === 'bilateral') {
      // Meshes owned by the canonical concept go to the side whose concept contains them.
      const extra: Record<Side, string[]> = { left: [], right: [] };
      const ambiguous: string[] = [];
      for (const fj of (u.self && ownMeshes.get(u.self)) || []) {
        const inLeft = bp.elements.get(u.left!)!.has(fj), inRight = bp.elements.get(u.right!)!.has(fj);
        if (inLeft !== inRight) extra[inLeft ? 'left' : 'right'].push(fj);
        else ambiguous.push(fj);
      }
      if (ambiguous.length) canonicalMeshConflicts.push({ slug: s.slug, meshes: ambiguous.sort(byKey) });
      s.sides = {} as Record<Side, SideBlock>;
      for (const side of SIDES) {
        const c = u[side]!;
        const block: SideBlock = { ids: idsFrom(fmaNumber(c), wd.byFma.get(fmaNumber(c))) };
        const fjs = [...((ownMeshes.get(c)) ?? []), ...extra[side]];
        fjs.forEach((fj) => placed.add(fj));
        if (fjs.length) block.meshes = fjs.sort(byKey).map(meshRef);
        // Side word inside the name ("long head of left biceps brachii"): composing would put it first.
        const sideName = bp.names.get(c)!;
        if (sideName !== `${side} ${u.name}`) block.labels = { en: { text: sideName, source: 'fma', status: 'draft' } };
        s.sides[side] = block;
      }
    } else {
      const m = meshesOf(u.self);
      if (m) s.meshes = m;
    }
    return s;
  });
  withSystems(structures, overrides.systems);
  structures.splice(0, structures.length, ...structures.map(canonicalStructure));
  structures.sort((a, b) => byKey(a.slug, b.slug));

  const unownedMeshes = [...containing.keys()].filter((fj) => !placed.has(fj)).sort(byKey);
  return {
    structures,
    skippedConcepts: bp.names.size - candidateSet.size,
    ties,
    parentConflicts,
    slugCollisions,
    canonicalMeshConflicts,
    unownedMeshes,
  };
}
