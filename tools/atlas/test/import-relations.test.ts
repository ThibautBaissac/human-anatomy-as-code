import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTINUATION_DISTAL_IS_SUBJECT, parseRelationSnapshots, planRelations,
  type FmaRelRow, type RelationsPlan, type TargetRow, type WikidataRelRow,
} from '../src/import/relations-plan.ts';
import type { ExternalTargets, Ids, Relation, RelationType, Side, Status, Structure } from '../src/types.ts';

// ---------- fixtures ----------

const structure = (slug: string, kind: string, laterality: Structure['laterality'], ids: Ids, sides?: Partial<Record<Side, Ids>>): Structure => ({
  slug, kind, laterality, status: 'draft',
  labels: { en: { text: slug, source: 'fma', status: 'draft' } },
  ids,
  ...(sides ? { sides: { left: { ids: sides.left ?? {} }, right: { ids: sides.right ?? {} } } } : {}),
});

const structures = (): Structure[] => [
  structure('femoral-artery', 'artery', 'bilateral', { fma: 1, wikidata: 'Q1' }, { left: { fma: 11, wikidata: 'Q11' }, right: { fma: 12, wikidata: 'Q12' } }),
  structure('popliteal-artery', 'artery', 'bilateral', { fma: 2, wikidata: 'Q2' }, { left: { fma: 21 }, right: { fma: 22 } }),
  structure('axillary-artery', 'artery', 'bilateral', { fma: 3, wikidata: 'Q3' }),
  structure('brachial-artery', 'artery', 'bilateral', { fma: 4, wikidata: 'Q4' }),
  structure('renal-vein', 'vein', 'bilateral', { fma: 5 }, { left: { fma: 51, wikidata: 'Q51' }, right: { fma: 52, wikidata: 'Q52' } }),
  structure('inferior-vena-cava', 'vein', 'midline', { fma: 6, wikidata: 'Q6' }),
  structure('gonadal-vein', 'vein', 'bilateral', { fma: 7 }, { left: { fma: 71 }, right: { fma: 72 } }),
  structure('kidney', 'organ', 'bilateral', { fma: 8, wikidata: 'Q8' }),
  structure('gastrocnemius-head', 'muscle', 'bilateral', { fma: 9, wikidata: 'Q9' }),
  structure('thigh-muscle', 'muscle', 'bilateral', { fma: 10, wikidata: 'Q10' }),
];

const fma = (...rows: string[]): FmaRelRow[] => rows.map((r) => { const [s, relation, t] = r.split(','); return { subject: Number(s), relation, target: Number(t) }; });
const wd = (...rows: string[]): WikidataRelRow[] => rows.map((r) => { const [subject, property, target] = r.split(','); return { subject, property: property as WikidataRelRow['property'], target }; });
const TARGETS: TargetRow[] = [
  { qid: 'Q500', en: 'tibial nerve', fr: 'nerf tibial', la: 'nervus tibialis' },
  { qid: 'Q501', en: 'nerve to the medial head', fr: 'nerf du chef médial' },
];

const rel = (type: RelationType, target: string, source = 'fma', status: Status = 'draft'): Relation => ({ type, target, source, status });

type Input = Parameters<typeof planRelations>[0];
const plan = (over: Partial<Input> = {}): RelationsPlan =>
  planRelations({ structures: structures(), fma: [], wikidata: [], targets: TARGETS, registry: {}, qidByFma: new Map(), ...over });

/** The fixture structures with one of them replaced by a copy carrying extra fields. */
const withStructure = (slug: string, extra: Partial<Structure>): Structure[] => withStructures({ [slug]: extra });
const withStructures = (extras: Record<string, Partial<Structure>>): Structure[] => structures().map((s) => (extras[s.slug] ? { ...s, ...extras[s.slug] } : s));
/** The kidney with side ids 81/82 and, optionally, side-level relations. */
const kidneySides = (left: Relation[] = [], right: Relation[] = []): Partial<Structure> => ({
  sides: { left: { ids: { fma: 81 }, ...(left.length ? { relations: left } : {}) }, right: { ids: { fma: 82 }, ...(right.length ? { relations: right } : {}) } },
});

// ---------- snapshots ----------

test('parseRelationSnapshots reads the three snapshot files, empty cells absent', () => {
  const parsed = parseRelationSnapshots(
    'subject_fma,relation,target_fma\n2,branch_of,1\n3,continuous_distally_with,4\n',
    'subject_qid,property,target_qid\nQ2,P3261,Q1\nQ10,P3189,Q500\n',
    'qid,fma,en,fr,la\nQ500,,tibial nerve,nerf tibial,nervus tibialis\nQ501,45,"nerve, medial",,\n',
  );
  assert.deepEqual(parsed.fma, [{ subject: 2, relation: 'branch_of', target: 1 }, { subject: 3, relation: 'continuous_distally_with', target: 4 }]);
  assert.deepEqual(parsed.wikidata, [{ subject: 'Q2', property: 'P3261', target: 'Q1' }, { subject: 'Q10', property: 'P3189', target: 'Q500' }]);
  assert.deepEqual(parsed.targets, [
    { qid: 'Q500', en: 'tibial nerve', fr: 'nerf tibial', la: 'nervus tibialis' },
    { qid: 'Q501', fma: 45, en: 'nerve, medial' },
  ]);
});

test('parseRelationSnapshots rejects a snapshot whose header is not the expected one', () => {
  assert.throws(() => parseRelationSnapshots('subject,relation,target\n', 'subject_qid,property,target_qid\n', 'qid,fma,en,fr,la\n'), /subject_fma,relation,target_fma/);
});

// ---------- sources per type ----------

test('the FMA has priority for branch-of: a Wikidata P3261 is not used when the FMA gives one', () => {
  const p = plan({ fma: fma('2,branch_of,1'), wikidata: wd('Q2,P3261,Q99999') });
  assert.deepEqual(p.relations.get('popliteal-artery'), { structure: [rel('branch-of', 'femoral-artery')] });
  const mapped = plan({ fma: fma('2,branch_of,1'), wikidata: wd('Q2,P3261,Q3') });
  assert.deepEqual(mapped.relations.get('popliteal-artery'), { structure: [rel('branch-of', 'femoral-artery')] }, 'even when the Wikidata target is one of ours');
});

test('Wikidata P3261 fills branch-of when the FMA gives none', () => {
  const p = plan({ wikidata: wd('Q2,P3261,Q1') });
  assert.deepEqual(p.relations.get('popliteal-artery'), { structure: [rel('branch-of', 'femoral-artery', 'wikidata')] });
});

test('continuous_distally_with gives continuation-of on the distal one: brachial-artery continues axillary-artery', () => {
  assert.equal(CONTINUATION_DISTAL_IS_SUBJECT, false, 'this test pins the provisional reading; Task 7 flips both together if needed');
  const p = plan({ fma: fma('3,continuous_distally_with,4') });
  assert.deepEqual(p.relations.get('brachial-artery'), { structure: [rel('continuation-of', 'axillary-artery')] });
  assert.equal(p.relations.has('axillary-artery'), false);
});

test('Wikidata P3261 never yields continuation-of', () => {
  const p = plan({ wikidata: wd('Q4,P3261,Q3') });
  assert.deepEqual(p.relations.get('brachial-artery'), { structure: [rel('branch-of', 'axillary-artery', 'wikidata')] });
});

test('arterial-supply given by both the FMA and Wikidata to the same artery is one relation, sourced fma', () => {
  const p = plan({ fma: fma('8,arterial_supply,2'), wikidata: wd('Q8,P2286,Q2') });
  assert.deepEqual(p.relations.get('kidney'), { structure: [rel('arterial-supply', 'popliteal-artery')] });
});

test('arterial-supply is the union of the FMA and Wikidata: two different arteries give two relations', () => {
  const p = plan({ fma: fma('8,arterial_supply,2'), wikidata: wd('Q8,P2286,Q1') });
  assert.deepEqual(p.relations.get('kidney'), { structure: [rel('arterial-supply', 'femoral-artery', 'wikidata'), rel('arterial-supply', 'popliteal-artery')] });
});

test('P2286 on a vein is ignored and reported', () => {
  const p = plan({ wikidata: wd('Q6,P2286,Q1') });
  assert.equal(p.relations.has('inferior-vena-cava'), false);
  assert.deepEqual(p.report.ignored.map(({ subject, reason }) => ({ subject, reason })), [{ subject: 'inferior-vena-cava', reason: 'vein-p2286' }]);
});

// ---------- mapping and sides ----------

test('a lateralised target maps to its structure through its side ids', () => {
  const p = plan({ wikidata: wd('Q8,P2286,Q11') });
  assert.deepEqual(p.relations.get('kidney'), { structure: [rel('arterial-supply', 'femoral-artery', 'wikidata')] });
});

test('sides that differ are written at side level for that type', () => {
  const p = plan({ fma: fma('71,tributary_of,51', '72,tributary_of,6') });
  assert.deepEqual(p.relations.get('gonadal-vein'), {
    left: [rel('tributary-of', 'renal-vein')],
    right: [rel('tributary-of', 'inferior-vena-cava')],
  });
});

test('sides that agree are written once at structure level', () => {
  const p = plan({ fma: fma('51,tributary_of,6', '52,tributary_of,6') });
  assert.deepEqual(p.relations.get('renal-vein'), { structure: [rel('tributary-of', 'inferior-vena-cava')] });
});

test('a relation from a side to the opposite side is ignored and reported', () => {
  const p = plan({ fma: fma('71,tributary_of,52') });
  assert.equal(p.relations.has('gonadal-vein'), false);
  assert.deepEqual(p.report.oppositeSide, ['gonadal-vein']);
});

// ---------- external targets, dropped targets ----------

test('an unmapped innervation target becomes an external target with its labels in the registry', () => {
  const p = plan({ wikidata: wd('Q10,P3189,Q500'), targets: [{ qid: 'Q500', en: 'tibial nerve', fr: 'nerf tibial', la: 'nervus tibialis' }] });
  assert.deepEqual(p.relations.get('thigh-muscle'), { structure: [rel('innervation', 'wikidata:Q500', 'wikidata')] });
  assert.deepEqual(p.registry, {
    Q500: {
      labels: {
        en: { text: 'tibial nerve', source: 'wikidata', status: 'draft' },
        fr: { text: 'nerf tibial', source: 'wikidata', status: 'draft' },
        la: { text: 'nervus tibialis', source: 'wikidata', status: 'draft' },
      },
      source: 'wikidata',
      status: 'draft',
    },
  });
});

test('an unmapped target of another type than innervation is dropped and counted', () => {
  const p = plan({ fma: fma('8,arterial_supply,99999') });
  assert.equal(p.relations.has('kidney'), false);
  assert.equal(p.report.dropped, 1);
});

// ---------- parts of muscles ----------

test('a muscle part without innervation takes that of its FMA whole', () => {
  const p = plan({ fma: fma('9,regional_part_of,900'), qidByFma: new Map([[900, 'Q900']]), wikidata: wd('Q900,P3189,Q500') });
  assert.deepEqual(p.relations.get('gastrocnemius-head'), { structure: [rel('innervation', 'wikidata:Q500', 'wikidata')] });
});

test("a muscle part's own innervation wins over its whole's", () => {
  const p = plan({ fma: fma('9,regional_part_of,900'), qidByFma: new Map([[900, 'Q900']]), wikidata: wd('Q900,P3189,Q500', 'Q9,P3189,Q501') });
  assert.deepEqual(p.relations.get('gastrocnemius-head'), { structure: [rel('innervation', 'wikidata:Q501', 'wikidata')] });
});

test('a muscle part takes the relations of a whole two part-of levels up', () => {
  const p = plan({ fma: fma('9,regional_part_of,900', '900,constitutional_part_of,901'), qidByFma: new Map([[900, 'Q900'], [901, 'Q901']]), wikidata: wd('Q901,P3189,Q500') });
  assert.deepEqual(p.relations.get('gastrocnemius-head'), { structure: [rel('innervation', 'wikidata:Q500', 'wikidata')] });
});

test('the nearest whole with relations of the type wins over a farther one', () => {
  const p = plan({
    fma: fma('9,regional_part_of,900', '900,constitutional_part_of,901', '900,arterial_supply,2', '901,arterial_supply,1'),
    qidByFma: new Map([[900, 'Q900'], [901, 'Q901']]),
    wikidata: wd('Q900,P3189,Q501', 'Q901,P3189,Q500'),
  });
  assert.deepEqual(p.relations.get('gastrocnemius-head'), {
    structure: [rel('arterial-supply', 'popliteal-artery'), rel('innervation', 'wikidata:Q501', 'wikidata')],
  });
});

test('a whole more than three part-of levels up is not followed', () => {
  const p = plan({
    fma: fma('9,regional_part_of,900', '900,regional_part_of,901', '901,regional_part_of,902', '902,regional_part_of,903'),
    qidByFma: new Map([[902, 'Q902'], [903, 'Q903']]),
    wikidata: wd('Q903,P3189,Q500'),
  });
  assert.equal(p.relations.has('gastrocnemius-head'), false);
  const third = plan({
    fma: fma('9,regional_part_of,900', '900,regional_part_of,901', '901,regional_part_of,902'),
    qidByFma: new Map([[902, 'Q902']]),
    wikidata: wd('Q902,P3189,Q500'),
  });
  assert.deepEqual(third.relations.get('gastrocnemius-head'), { structure: [rel('innervation', 'wikidata:Q500', 'wikidata')] }, 'the third level is');
});

// ---------- merge with existing relations ----------

test('a reviewed tree relation blocks the import of its type and the differing plan is reported', () => {
  const reviewed = rel('branch-of', 'femoral-artery', 'fma', 'reviewed');
  const p = plan({ structures: withStructure('popliteal-artery', { relations: [reviewed] }), fma: fma('2,branch_of,3') });
  assert.deepEqual(p.relations.get('popliteal-artery'), { structure: [reviewed] });
  assert.deepEqual(p.report.conflicts, [{ slug: 'popliteal-artery', type: 'branch-of', kept: 'femoral-artery', planned: 'axillary-artery' }]);
});

test('a curated relation stays next to the imported ones', () => {
  const curated = rel('innervation', 'wikidata:Q7', 'curated', 'draft');
  const p = plan({ structures: withStructure('thigh-muscle', { relations: [curated] }), wikidata: wd('Q10,P3189,Q500') });
  assert.deepEqual(p.relations.get('thigh-muscle'), { structure: [rel('innervation', 'wikidata:Q500', 'wikidata'), curated] });
});

test('a draft relation no longer in the snapshots is removed', () => {
  const p = plan({ structures: withStructure('kidney', { relations: [rel('arterial-supply', 'popliteal-artery')] }) });
  assert.equal(p.relations.has('kidney'), false);
});

test('a reviewed registry entry is never modified', () => {
  const entry = {
    labels: { en: { text: 'tibial nerve (reviewed)', source: 'curated', status: 'reviewed' as const }, fr: { text: 'nerf tibial (revu)', source: 'curated', status: 'reviewed' as const } },
    source: 'wikidata', status: 'reviewed' as const,
  };
  const registry: ExternalTargets = { Q500: structuredClone(entry) };
  const p = plan({ wikidata: wd('Q10,P3189,Q500'), registry });
  assert.deepEqual(p.registry.Q500, entry);
  assert.deepEqual(p.relations.get('thigh-muscle'), { structure: [rel('innervation', 'wikidata:Q500', 'wikidata')] });
});

test('a reviewed tree relation equal to the plan is kept and no conflict is reported', () => {
  const reviewed = rel('branch-of', 'femoral-artery', 'fma', 'reviewed');
  const p = plan({ structures: withStructure('popliteal-artery', { relations: [reviewed] }), fma: fma('2,branch_of,1') });
  assert.deepEqual(p.relations.get('popliteal-artery'), { structure: [reviewed] });
  assert.deepEqual(p.report.conflicts, []);
});

test('a curated tree relation, even draft, blocks the import of its type', () => {
  const curated = rel('branch-of', 'femoral-artery', 'curated', 'draft');
  const p = plan({ structures: withStructure('popliteal-artery', { relations: [curated] }), fma: fma('2,branch_of,3') });
  assert.deepEqual(p.relations.get('popliteal-artery'), { structure: [curated] });
  assert.deepEqual(p.report.conflicts, [{ slug: 'popliteal-artery', type: 'branch-of', kept: 'femoral-artery', planned: 'axillary-artery' }]);
});

test('a planned side-level relation is ignored when its type is protected at structure level', () => {
  const reviewed = rel('arterial-supply', 'femoral-artery', 'fma', 'reviewed');
  const p = plan({ structures: withStructure('kidney', { ...kidneySides(), relations: [reviewed] }), fma: fma('81,arterial_supply,2') });
  assert.deepEqual(p.relations.get('kidney'), { structure: [reviewed] });
  assert.deepEqual(p.report.ignored.map(({ subject, reason }) => ({ subject, reason })), [{ subject: 'kidney', reason: 'side-mixed' }]);
});

test('a planned structure-level relation goes to both sides when its type is protected at side level', () => {
  const curated = rel('arterial-supply', 'femoral-artery', 'curated', 'draft');
  const p = plan({ structures: withStructure('kidney', kidneySides([curated])), fma: fma('8,arterial_supply,2') });
  assert.deepEqual(p.relations.get('kidney'), {
    left: [curated, rel('arterial-supply', 'popliteal-artery')],
    right: [rel('arterial-supply', 'popliteal-artery')],
  });
});

// ---------- rejections ----------

test('a self-relation is ignored and reported', () => {
  const p = plan({ fma: fma('21,branch_of,2') });
  assert.equal(p.relations.has('popliteal-artery'), false);
  assert.deepEqual(p.report.ignored.map((x) => x.reason), ['self']);
});

test('a target of the wrong kind for the type is ignored and reported', () => {
  const p = plan({ fma: fma('2,branch_of,6') });
  assert.equal(p.relations.has('popliteal-artery'), false);
  assert.deepEqual(p.report.ignored.map(({ subject, reason }) => ({ subject, reason })), [{ subject: 'popliteal-artery', reason: 'wrong-kind' }]);
});

test('a second tree relation of one type is reported, the first by source priority kept', () => {
  const p = plan({ wikidata: wd('Q4,P3261,Q3', 'Q4,P3261,Q1') });
  assert.deepEqual(p.relations.get('brachial-artery'), { structure: [rel('branch-of', 'axillary-artery', 'wikidata')] }, 'the first row of one source');
  const twoFma = plan({ fma: fma('2,branch_of,1', '2,branch_of,3') });
  assert.deepEqual(twoFma.relations.get('popliteal-artery'), { structure: [rel('branch-of', 'femoral-artery')] });
  assert.deepEqual(twoFma.report.ignored.map(({ subject, reason }) => ({ subject, reason })), [{ subject: 'popliteal-artery', reason: 'second-tree' }]);
});

// ---------- idempotence ----------

test('planning again from its own output gives the same plan', () => {
  const input: Input = {
    structures: withStructures({
      'popliteal-artery': { relations: [rel('branch-of', 'femoral-artery', 'fma', 'reviewed')] },
      // curated side-level relation: the planned structure-level arterial supply fans out to both sides
      kidney: kidneySides([rel('arterial-supply', 'femoral-artery', 'curated', 'draft')]),
      // a stale draft, removed by the first run
      'thigh-muscle': { relations: [rel('arterial-supply', 'popliteal-artery')] },
    }),
    fma: fma('2,branch_of,3', '3,continuous_distally_with,4', '8,arterial_supply,2', '71,tributary_of,51', '72,tributary_of,6', '51,tributary_of,6', '52,tributary_of,6', '9,regional_part_of,900'),
    wikidata: wd('Q8,P2286,Q11', 'Q10,P3189,Q500', 'Q900,P3189,Q501', 'Q6,P2286,Q1'),
    targets: TARGETS,
    registry: {},
    qidByFma: new Map([[900, 'Q900']]),
  };
  const first = planRelations(input);
  const updated = input.structures.map((s): Structure => {
    const planned = first.relations.get(s.slug) ?? {};
    const { relations: _r, sides, ...rest } = s;
    const out: Structure = { ...rest, ...(planned.structure ? { relations: planned.structure } : {}) };
    if (sides) out.sides = { left: { ...sides.left, relations: planned.left }, right: { ...sides.right, relations: planned.right } };
    for (const side of ['left', 'right'] as const) if (!out.sides?.[side].relations) delete out.sides?.[side].relations;
    return out;
  });
  const second = planRelations({ ...input, structures: updated, registry: first.registry });
  assert.deepEqual(second, first);
  assert.ok(first.relations.size >= 6, 'the fixture plans relations on several structures');
  assert.deepEqual(first.relations.get('kidney'), {
    left: [rel('arterial-supply', 'femoral-artery', 'curated', 'draft'), rel('arterial-supply', 'popliteal-artery')],
    right: [rel('arterial-supply', 'femoral-artery', 'wikidata'), rel('arterial-supply', 'popliteal-artery')],
  }, 'the fixture goes through the fan-out to both sides');
  assert.deepEqual(first.relations.get('thigh-muscle'), { structure: [rel('innervation', 'wikidata:Q500', 'wikidata')] }, 'the stale draft is gone');
});
