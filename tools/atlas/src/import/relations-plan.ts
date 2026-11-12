// Planning: FMA and Wikidata relation snapshots + existing structures → relations and external targets (pure, no disk, no network).
// Rules: spec 2026-11-11-relations-anatomiques, section Import.
import { parseCsv } from './wikidata.ts';
import { kindProblem } from '../relations.ts';
import { byKey } from '../fs-util.ts';
import { RELATION_TYPES, TREE_TYPES, type ExternalTarget, type ExternalTargets, type Labels, type Relation, type RelationType, type Side, type Structure } from '../types.ts';

/**
 * How the FMA's `A continuous_distally_with B` is read. `false`: B is distal to A, so `continuation-of` is written on B
 * and points to A (the brachial artery continues the axillary artery). `true`: the subject A is the distal one.
 * Verified on the FMA 5.1.0 snapshot (Task 7): it has no axillary → brachial row, but every row between two of our
 * structures puts the proximal one first (common iliac vein → external iliac vein, esophagus → stomach, ureter → bladder).
 */
export const CONTINUATION_DISTAL_IS_SUBJECT = false;

export interface FmaRelRow { subject: number; relation: string; target: number }
export interface WikidataRelRow { subject: string; property: 'P3261' | 'P2286' | 'P3189'; target: string }
export interface TargetRow { qid: string; fma?: number; en?: string; fr?: string; la?: string }

export interface RelationsReport {
  /** rows not imported, with a short code: vein-p2286, wrong-kind, self, second-tree, continuation-parent, side-mixed, no-label */
  ignored: { subject: string; reason: string; detail: string }[];
  /** rows whose target (not an innervation) maps to none of our structures */
  dropped: number;
  /** planned tree relations not written because a protected one of the same type differs */
  conflicts: { slug: string; type: RelationType; kept: string; planned: string }[];
  /** slugs with a relation from one side to the opposite side (ignored) */
  oppositeSide: string[];
  /** QIDs of lateralised nerve items ("left X") with no unlateralised item "X": kept as they are */
  lateralUnresolved: string[];
}

export interface PlannedRelations { structure?: Relation[]; left?: Relation[]; right?: Relation[] }

export interface RelationsPlan {
  /** per structure, its complete final lists (protected relations kept, draft ones recomputed); absent: no relation */
  relations: Map<string, PlannedRelations>;
  registry: ExternalTargets;
  report: RelationsReport;
}

export interface RelationsInput {
  structures: Structure[];
  fma: FmaRelRow[];
  wikidata: WikidataRelRow[];
  targets: TargetRow[];
  registry: ExternalTargets;
  /** FMA id → Wikidata QID (wikidata-fma.csv): how a muscle whole found through FMA part-of rows gets its Wikidata relations */
  qidByFma: Map<number, string>;
}

// ---------- snapshots ----------

const FMA_HEADER = ['subject_fma', 'relation', 'target_fma'];
const WIKIDATA_HEADER = ['subject_qid', 'property', 'target_qid'];
const TARGETS_HEADER = ['qid', 'fma', 'en', 'fr', 'la'];
const PROPERTIES = new Set<string>(['P3261', 'P2286', 'P3189']);

/** A snapshot row that could not be read: its file, its line (header = 1) and why. */
export interface MalformedRow { file: string; line: number; detail: string }

/** The rows of a snapshot with their line; a row without the header's column count is malformed. */
function table(text: string, header: string[], name: string, malformed: MalformedRow[]): { cells: string[]; line: number }[] {
  const [head, ...rows] = parseCsv(text);
  if (head?.join(',') !== header.join(',')) throw new Error(`${name} : en-tête attendu « ${header.join(',')} », trouvé « ${head?.join(',') ?? ''} »`);
  return rows.flatMap((cells, i) => {
    const line = i + 2;
    if (cells.length === header.length) return [{ cells, line }];
    malformed.push({ file: name, line, detail: `${cells.length} colonne(s) au lieu de ${header.length}` });
    return [];
  });
}

const positiveInt = (cell: string): number | undefined => { const n = Number(cell); return cell && Number.isInteger(n) && n > 0 ? n : undefined; };
const QID = /^Q\d+$/;

/** Reads the three snapshots written by fetch-relations (exact headers, RFC 4180). Empty cells are absent fields; unreadable rows are listed in `malformed`. */
export function parseRelationSnapshots(fmaCsv: string, wikidataCsv: string, targetsCsv: string): { fma: FmaRelRow[]; wikidata: WikidataRelRow[]; targets: TargetRow[]; malformed: MalformedRow[] } {
  const malformed: MalformedRow[] = [];
  const bad = (file: string, line: number, detail: string): [] => { malformed.push({ file, line, detail }); return []; };
  const FMA = 'relations-fma.csv', WD = 'relations-wikidata.csv', TARGETS = 'wikidata-targets.csv';
  const fma = table(fmaCsv, FMA_HEADER, FMA, malformed).flatMap(({ cells: [s, relation, t], line }) => {
    const subject = positiveInt(s), target = positiveInt(t);
    return subject && target ? [{ subject, relation, target }] : bad(FMA, line, `identifiant FMA invalide (« ${s} », « ${t} »)`);
  });
  const wikidata = table(wikidataCsv, WIKIDATA_HEADER, WD, malformed).flatMap(({ cells: [subject, property, target], line }) => {
    if (!QID.test(subject) || !QID.test(target)) return bad(WD, line, `QID invalide (« ${subject} », « ${target} »)`);
    if (!PROPERTIES.has(property)) return bad(WD, line, `propriété « ${property} » hors de ${[...PROPERTIES].join(', ')}`);
    return [{ subject, property: property as WikidataRelRow['property'], target }];
  });
  const targets = table(targetsCsv, TARGETS_HEADER, TARGETS, malformed).flatMap(({ cells: [qid, f, en, fr, la], line }) => {
    if (!QID.test(qid)) return bad(TARGETS, line, `QID invalide (« ${qid} »)`);
    const fmaId = positiveInt(f);
    if (f && !fmaId) return bad(TARGETS, line, `identifiant FMA invalide (« ${f} »)`);
    const row: TargetRow = { qid };
    if (fmaId) row.fma = fmaId;
    if (en) row.en = en;
    if (fr) row.fr = fr;
    if (la) row.la = la;
    return [row];
  });
  malformed.sort((a, b) => byKey(a.file, b.file) || a.line - b.line);
  return { fma, wikidata, targets, malformed };
}

// ---------- planning ----------

const SIDES: Side[] = ['left', 'right'];
type Level = Side | null;
type PlanSource = 'fma' | 'wikidata';
const SOURCE_RANK: Record<PlanSource, number> = { fma: 0, wikidata: 1 };
const FMA_TYPE: Record<string, RelationType> = {
  branch_of: 'branch-of',
  tributary_of: 'tributary-of',
  continuous_distally_with: 'continuation-of',
  arterial_supply: 'arterial-supply',
};
const PART_OF = new Set(['regional_part_of', 'constitutional_part_of']);
/** levels of FMA part-of followed from a muscle part to its whole (decision 8) */
const WHOLE_LEVELS = 3;
const MUSCLE_INHERITED: RelationType[] = ['arterial-supply', 'innervation'];
/** tree types that give a vessel its parent; continuation-of is only planned where none is */
const PARENT_TYPES: RelationType[] = ['branch-of', 'tributary-of'];

interface Place { slug: string; side: Level }

/** A planned relation before merge: its level on the subject, its source and the snapshot row it comes from (order = row index). */
interface Candidate { type: RelationType; target: string; source: PlanSource; side: Level; order: number }

/** A FMA row read from the subject the relation is written on (`continuous_distally_with` turned towards the distal one). */
interface FmaEdge { relation: string; other: number; order: number; detail: string }

interface Context {
  bySlug: Map<string, Structure>;
  byFma: Map<number, Place>;
  byQid: Map<string, Place>;
  fmaOn: Map<number, FmaEdge[]>;
  wdOn: Map<string, (WikidataRelRow & { order: number })[]>;
  targets: Map<string, TargetRow>;
  registry: ExternalTargets;
  qidByFma: Map<number, string>;
  /** lower-cased English label → QID, from the targets snapshot then the registry: how "left X" finds "X" */
  qidByEn: Map<string, string>;
}

/** Where rejected rows go: the report for a structure's own rows, nowhere for the rows of a muscle whole. */
interface Sink { ignore(reason: string, detail: string): void; drop(): void; opposite(): void; lateral(qid: string): void }

const typeRank = (t: RelationType) => RELATION_TYPES.indexOf(t);
const byOutput = (a: Relation, b: Relation) => typeRank(a.type) - typeRank(b.type) || byKey(a.target, b.target);
const isProtected = (r: Relation) => r.status === 'reviewed' || r.source === 'curated';
const better = (a: Candidate, b: Candidate) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || a.order - b.order;

function places(structures: Structure[]): { byFma: Map<number, Place>; byQid: Map<string, Place> } {
  const byFma = new Map<number, Place>();
  const byQid = new Map<string, Place>();
  for (const s of structures) {
    if (s.ids?.fma) byFma.set(s.ids.fma, { slug: s.slug, side: null });
    if (s.ids?.wikidata) byQid.set(s.ids.wikidata, { slug: s.slug, side: null });
    for (const side of SIDES) {
      const ids = s.sides?.[side]?.ids;
      const at: Place = { slug: s.slug, side: s.laterality === 'bilateral' ? side : null };
      if (ids?.fma) byFma.set(ids.fma, at);
      if (ids?.wikidata) byQid.set(ids.wikidata, at);
    }
  }
  return { byFma, byQid };
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); }

/** Our structure (or side) a Wikidata item maps to, by its QID then its FMA id. */
function placeOf(ctx: Context, qid: string): Place | undefined {
  const fma = ctx.targets.get(qid)?.fma;
  return ctx.byQid.get(qid) ?? (fma ? ctx.byFma.get(fma) : undefined);
}

const enOf = (ctx: Context, qid: string): string | undefined => ctx.targets.get(qid)?.en ?? ctx.registry[qid]?.labels.en?.text;

/** The relations a subject level gets from the rows on the given FMA ids and QIDs, mapped and checked. */
function candidatesFrom(ctx: Context, subject: Structure, side: Level, fmaIds: number[], qids: string[], sink: Sink): Candidate[] {
  const out: Candidate[] = [];
  const accept = (type: RelationType, target: Place | string, source: PlanSource, order: number, detail: string, level: Level = side) => {
    const external = typeof target === 'string';
    const slug = external ? target : target.slug;
    if (!external && slug === subject.slug) return sink.ignore('self', detail);
    const problem = kindProblem(type, subject, external ? undefined : ctx.bySlug.get(slug)!.kind);
    if (problem) return sink.ignore('wrong-kind', `${detail} : ${problem.message}`);
    if (!external && side && target.side && target.side !== side) return sink.opposite();
    out.push({ type, target: slug, source, side: level, order });
  };
  for (const id of fmaIds) {
    for (const e of ctx.fmaOn.get(id) ?? []) {
      const type = FMA_TYPE[e.relation];
      if (!type) continue;
      const target = ctx.byFma.get(e.other);
      if (!target) { sink.drop(); continue; }
      accept(type, target, 'fma', e.order, e.detail);
    }
  }
  for (const q of qids) {
    for (const row of ctx.wdOn.get(q) ?? []) {
      const detail = `wikidata ${row.subject} ${row.property} ${row.target}`;
      let type: RelationType;
      if (row.property === 'P3261') {
        if (subject.kind === 'artery' || subject.kind === 'nerve') type = 'branch-of';
        else if (subject.kind === 'vein') type = 'tributary-of';
        else { sink.ignore('wrong-kind', `${detail} : P3261 porte sur une artère, une veine ou un nerf, pas ${subject.kind}`); continue; }
      } else if (row.property === 'P2286') {
        if (subject.kind === 'vein') { sink.ignore('vein-p2286', detail); continue; }
        type = 'arterial-supply';
      } else type = 'innervation';
      const mapped = placeOf(ctx, row.target);
      if (mapped) { accept(type, mapped, 'wikidata', row.order, detail); continue; }
      if (type !== 'innervation') { sink.drop(); continue; }
      // a lateralised nerve item follows the muscle's side: the relation is that of its unlateralised item, on the structure
      const lateral = /^(?:left|right) (.+)$/i.exec(enOf(ctx, row.target) ?? '');
      const whole = lateral ? ctx.qidByEn.get(lateral[1].toLowerCase()) : undefined;
      if (whole) { accept(type, placeOf(ctx, whole) ?? `wikidata:${whole}`, 'wikidata', row.order, `${detail} (→ ${whole})`, null); continue; }
      if (lateral) sink.lateral(row.target);
      if (!enOf(ctx, row.target)) { sink.ignore('no-label', `${detail} : cible externe sans label anglais`); continue; }
      accept(type, `wikidata:${row.target}`, 'wikidata', row.order, detail);
    }
  }
  return out;
}

/** The subject levels of a structure with their source ids: the structure itself, then each side of a bilateral one. */
function anchors(s: Structure): { side: Level; fma?: number; qid?: string }[] {
  const out: { side: Level; fma?: number; qid?: string }[] = [{ side: null, fma: s.ids?.fma, qid: s.ids?.wikidata }];
  for (const side of SIDES) {
    const ids = s.sides?.[side]?.ids;
    if (ids) out.push({ side: s.laterality === 'bilateral' ? side : null, fma: ids.fma, qid: ids.wikidata });
  }
  return out;
}

const MUTED: Sink = { ignore() {}, drop() {}, opposite() {}, lateral() {} };

/** Relations of `type` inherited from the nearest FMA whole (part-of, up to three levels) that has some. */
function fromWhole(ctx: Context, subject: Structure, side: Level, fma: number, type: RelationType): Candidate[] {
  const seen = new Set([fma]);
  let level = [fma];
  for (let depth = 1; depth <= WHOLE_LEVELS && level.length; depth++) {
    const wholes = [...new Set(level.flatMap((id) => (ctx.fmaOn.get(id) ?? []).filter((e) => PART_OF.has(e.relation)).map((e) => e.other)))].filter((w) => !seen.has(w));
    wholes.forEach((w) => seen.add(w));
    const found = wholes.flatMap((w) => {
      const q = ctx.qidByFma.get(w);
      return candidatesFrom(ctx, subject, side, [w], q ? [q] : [], MUTED);
    }).filter((c) => c.type === type);
    if (found.length) return found;
    level = wholes;
  }
  return [];
}

/** One candidate per target, the best by source priority then row order. */
function dedup(cands: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const c of cands) { const b = best.get(c.target); if (!b || better(c, b) < 0) best.set(c.target, c); }
  return [...best.values()];
}

const sameTargets = (a: Candidate[], b: Candidate[]) => a.length === b.length && a.every((x) => b.some((y) => y.target === x.target));

/**
 * Side comparison of one type: identical sides at structure level, differing sides at side level; structure-level rows hold
 * for both sides. For a tree type (`tree` given), each level keeps its first candidate by source priority then row order
 * before the sides are compared, the others reported as `second-tree`.
 */
function collapseSides(cands: Candidate[], tree?: Sink): Candidate[] {
  const at = (side: Level) => cands.filter((c) => c.side === side);
  const [s, l, r] = [at(null), at('left'), at('right')];
  const rejected = new Set<string>();
  const keep = (list: Candidate[]) => {
    if (!tree || list.length < 2) return list;
    const [first, ...rest] = [...list].sort(better);
    for (const c of rest) rejected.add(`${c.type} ${c.target} (${c.source}) : ${first.target} est gardée`);
    return [first];
  };
  let out: Candidate[];
  if (!l.length && !r.length) out = keep(dedup(s));
  else {
    const left = keep(dedup([...l, ...s])), right = keep(dedup([...r, ...s]));
    out = sameTargets(left, right)
      ? dedup([...left, ...right]).map((c) => ({ ...c, side: null }))
      : [...left.map((c) => ({ ...c, side: 'left' as const })), ...right.map((c) => ({ ...c, side: 'right' as const }))];
  }
  rejected.forEach((detail) => tree!.ignore('second-tree', detail));
  return out;
}

const levelKey = (side: Level) => side ?? 'structure';

export function planRelations(input: RelationsInput): RelationsPlan {
  const { byFma, byQid } = places(input.structures);
  const fmaOn = new Map<number, FmaEdge[]>();
  input.fma.forEach((row, order) => {
    const detail = `fma ${row.subject} ${row.relation} ${row.target}`;
    const flip = row.relation === 'continuous_distally_with' && !CONTINUATION_DISTAL_IS_SUBJECT;
    push(fmaOn, flip ? row.target : row.subject, { relation: row.relation, other: flip ? row.subject : row.target, order, detail });
  });
  const wdOn = new Map<string, (WikidataRelRow & { order: number })[]>();
  input.wikidata.forEach((row, order) => push(wdOn, row.subject, { ...row, order: input.fma.length + order }));
  const ctx: Context = {
    bySlug: new Map(input.structures.map((s) => [s.slug, s])),
    byFma, byQid, fmaOn, wdOn,
    targets: new Map(input.targets.map((t) => [t.qid, t])),
    registry: input.registry,
    qidByFma: input.qidByFma,
    qidByEn: new Map(),
  };
  for (const t of input.targets) if (t.en && !ctx.qidByEn.has(t.en.toLowerCase())) ctx.qidByEn.set(t.en.toLowerCase(), t.qid);
  for (const [q, e] of Object.entries(input.registry)) { const en = e.labels.en?.text.toLowerCase(); if (en && !ctx.qidByEn.has(en)) ctx.qidByEn.set(en, q); }

  const report: RelationsReport = { ignored: [], dropped: 0, conflicts: [], oppositeSide: [], lateralUnresolved: [] };
  const opposite = new Set<string>();
  const lateral = new Set<string>();
  const relations = new Map<string, PlannedRelations>();

  for (const s of input.structures) {
    const sink: Sink = {
      ignore: (reason, detail) => report.ignored.push({ subject: s.slug, reason, detail }),
      drop: () => { report.dropped++; },
      opposite: () => opposite.add(s.slug),
      lateral: (qid) => lateral.add(qid),
    };
    let cands = anchors(s).flatMap((a) => candidatesFrom(ctx, s, a.side, a.fma ? [a.fma] : [], a.qid ? [a.qid] : [], sink));

    // FMA priority for tree types: Wikidata fills a type the FMA leaves empty
    const fmaTree = new Set(cands.filter((c) => c.source === 'fma' && TREE_TYPES.includes(c.type)).map((c) => c.type));
    cands = cands.filter((c) => c.source === 'fma' || !fmaTree.has(c.type));

    // parts of muscles: the relations of the nearest whole, for a type the part has none of
    if (s.kind === 'muscle') {
      for (const type of MUSCLE_INHERITED) {
        if (cands.some((c) => c.type === type)) continue;
        cands.push(...anchors(s).flatMap((a) => (a.fma ? fromWhole(ctx, s, a.side, a.fma, type) : [])));
      }
    }

    // one tree relation per type and level, then sides compared type by type
    const collapsed = RELATION_TYPES.flatMap((type) => collapseSides(cands.filter((c) => c.type === type), TREE_TYPES.includes(type) ? sink : undefined));

    // one tree parent per vessel: continuation-of only on a level without branch-of or tributary-of
    const parentAt = (side: Side) => collapsed.some((o) => PARENT_TYPES.includes(o.type) && (o.side === side || o.side === null));
    const planned = collapsed.flatMap((c) => {
      if (c.type !== 'continuation-of') return [c];
      const free = c.side ? (parentAt(c.side) ? [] : [c.side]) : SIDES.filter((side) => !parentAt(side));
      if (free.length < (c.side ? 1 : 2)) sink.ignore('continuation-parent', `continuation-of ${c.target} (${c.source}) : branch-of ou tributary-of déjà planifiée`);
      if (!c.side && free.length === 2) return [c];
      return free.map((side) => ({ ...c, side }));
    });

    // merge with the protected relations (reviewed or curated)
    const protectedAt = new Map<string, Relation[]>([
      ['structure', (s.relations ?? []).filter(isProtected)],
      ...SIDES.map((side) => [side, (s.sides?.[side]?.relations ?? []).filter(isProtected)] as [string, Relation[]]),
    ]);
    const allProtected = [...protectedAt.values()].flat();
    const lists = new Map<string, Relation[]>([...protectedAt].map(([k, v]) => [k, [...v]]));
    const add = (key: string, c: Candidate) => {
      const list = lists.get(key)!;
      if (!list.some((r) => r.type === c.type && r.target === c.target)) list.push({ type: c.type, target: c.target, source: c.source, status: 'draft' });
    };
    // a protected tree relation, of any tree type, blocks every draft tree relation of the structure
    const keptTree = allProtected.filter((r) => TREE_TYPES.includes(r.type));
    for (const c of planned) {
      if (TREE_TYPES.includes(c.type) && keptTree.length) {
        if (!keptTree.some((r) => r.type === c.type && r.target === c.target)) {
          const sameType = keptTree.find((r) => r.type === c.type);
          report.conflicts.push({ slug: s.slug, type: c.type, kept: sameType ? sameType.target : `${keptTree[0].type} ${keptTree[0].target}`, planned: c.target });
        }
        continue;
      }
      const keptAtStructure = protectedAt.get('structure')!.some((r) => r.type === c.type);
      const keptAtSide = SIDES.some((side) => protectedAt.get(side)!.some((r) => r.type === c.type));
      if (c.side && keptAtStructure) { sink.ignore('side-mixed', `${c.type} ${c.target} (côté ${c.side}) : ${c.type} est relu au niveau de la structure`); continue; }
      if (!c.side && keptAtSide && s.laterality === 'bilateral') { SIDES.forEach((side) => add(side, c)); continue; }
      add(levelKey(c.side), c);
    }

    const out: PlannedRelations = {};
    for (const [key, list] of lists) if (list.length) out[key as keyof PlannedRelations] = list.sort(byOutput);
    if (Object.keys(out).length) relations.set(s.slug, out);
  }
  report.oppositeSide = [...opposite].sort(byKey);
  report.lateralUnresolved = [...lateral].sort((a, b) => qidNumber(a) - qidNumber(b));

  return { relations, registry: plannedRegistry(input, relations), report };
}

const qidNumber = (q: string) => Number(q.slice(1));

/** The registry with an entry, refreshed from the snapshot, for every external target in use; reviewed entries and protected labels untouched. */
function plannedRegistry(input: RelationsInput, relations: Map<string, PlannedRelations>): ExternalTargets {
  const registry: ExternalTargets = { ...input.registry };
  const targets = new Map(input.targets.map((t) => [t.qid, t]));
  const used = new Set([...relations.values()].flatMap((p) => [...(p.structure ?? []), ...(p.left ?? []), ...(p.right ?? [])])
    .map((r) => /^wikidata:(Q\d+)$/.exec(r.target)?.[1]).filter((q): q is string => !!q));
  for (const q of used) {
    const row = targets.get(q);
    if (registry[q]?.status === 'reviewed' || !row?.en) continue;
    const labels: Labels = {};
    for (const lang of ['en', 'fr', 'la'] as const) {
      // as for structures, a reviewed label or one a curator wrote is never changed
      const kept = registry[q]?.labels[lang];
      if (kept && (kept.status === 'reviewed' || kept.source !== 'wikidata')) { labels[lang] = kept; continue; }
      const text = row[lang];
      if (text) labels[lang] = { text, source: 'wikidata', status: 'draft' };
    }
    const entry: ExternalTarget = { ...(row.fma ? { fma: row.fma } : {}), labels, source: 'wikidata', status: 'draft' };
    registry[q] = entry;
  }
  return Object.fromEntries(Object.entries(registry).sort(([a], [b]) => qidNumber(a) - qidNumber(b)));
}
