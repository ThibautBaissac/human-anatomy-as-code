import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importRelations } from '../src/import-relations.ts';
import { importBp3d } from '../src/import-bp3d.ts';
import { sources, writeDataset } from './helpers.ts';
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

test('parseRelationSnapshots counts malformed rows with their file and line instead of dropping them silently', () => {
  const parsed = parseRelationSnapshots(
    'subject_fma,relation,target_fma\n2,branch_of,1\n3,branch_of\nx,branch_of,4\n5,branch_of,1.5\n6,branch_of,0\n',
    'subject_qid,property,target_qid\nQ2,P3261,Q1\nQ2,P3261\nQ2,P999,Q1\nfoo,P3189,Q1\n',
    'qid,fma,en,fr,la\nQ500,,tibial nerve,,\nQ501,x,nerve,,\nQ502,,a,b\n',
  );
  assert.deepEqual(parsed.fma, [{ subject: 2, relation: 'branch_of', target: 1 }]);
  assert.deepEqual(parsed.wikidata, [{ subject: 'Q2', property: 'P3261', target: 'Q1' }]);
  assert.deepEqual(parsed.targets, [{ qid: 'Q500', en: 'tibial nerve' }]);
  assert.deepEqual(parsed.malformed.map((m) => `${m.file}:${m.line}`), [
    'relations-fma.csv:3', 'relations-fma.csv:4', 'relations-fma.csv:5', 'relations-fma.csv:6',
    'relations-wikidata.csv:3', 'relations-wikidata.csv:4', 'relations-wikidata.csv:5',
    'wikidata-targets.csv:3', 'wikidata-targets.csv:4',
  ]);
  assert.ok(parsed.malformed.every((m) => m.detail.length > 0));
});

test('well-formed snapshots have no malformed row', () => {
  const parsed = parseRelationSnapshots('subject_fma,relation,target_fma\n2,branch_of,1\n', 'subject_qid,property,target_qid\n', 'qid,fma,en,fr,la\n');
  assert.deepEqual(parsed.malformed, []);
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

test('the real FMA 5.1.0 row 14333 continuous_distally_with 18883 gives external-iliac-vein continuation-of common-iliac-vein', () => {
  // The snapshot has no axillary/brachial continuation row; this one, like 7131→7148 (esophagus→stomach) and
  // 9704→15900 (ureter→urinary bladder), shows the FMA subject is the proximal one.
  const p = planRelations({
    structures: [
      structure('common-iliac-vein', 'vein', 'bilateral', { fma: 14333 }),
      structure('external-iliac-vein', 'vein', 'bilateral', { fma: 18883 }),
    ],
    fma: fma('14333,continuous_distally_with,18883'), wikidata: [], targets: [], registry: {}, qidByFma: new Map(),
  });
  assert.deepEqual(p.relations.get('external-iliac-vein'), { structure: [rel('continuation-of', 'common-iliac-vein')] });
  assert.equal(p.relations.has('common-iliac-vein'), false);
});

test('continuation-of is not planned on a structure that has a tributary-of: the real lateral sacral vein', () => {
  const p = planRelations({
    structures: [
      structure('internal-iliac-vein', 'vein', 'bilateral', { fma: 18884 }),
      structure('lateral-sacral-vein', 'vein', 'bilateral', { fma: 18905 }),
    ],
    fma: fma('18884,continuous_distally_with,18905', '18905,tributary_of,18884'), wikidata: [], targets: [], registry: {}, qidByFma: new Map(),
  });
  assert.deepEqual(p.relations.get('lateral-sacral-vein'), { structure: [rel('tributary-of', 'internal-iliac-vein')] });
  assert.deepEqual(p.report.ignored.map(({ subject, reason }) => ({ subject, reason })), [{ subject: 'lateral-sacral-vein', reason: 'continuation-parent' }]);
});

test('a structure-level continuation-of is kept on the side that has no branch-of', () => {
  const p = plan({ fma: fma('3,continuous_distally_with,2', '21,branch_of,1') });
  assert.deepEqual(p.relations.get('popliteal-artery'), { left: [rel('branch-of', 'femoral-artery')], right: [rel('continuation-of', 'axillary-artery')] });
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

// lateralised Wikidata nerve items (Q66526508 "right axillary nerve"…) and their unlateralised counterparts
const NERVES: TargetRow[] = [
  { qid: 'Q600', en: 'axillary nerve', fr: 'nerf axillaire' },
  { qid: 'Q601', en: 'Left axillary nerve' },
  { qid: 'Q602', en: 'right axillary nerve' },
  { qid: 'Q603', en: 'right radial nerve' },
  { qid: 'Q604', en: 'radial nerve', fr: 'nerf radial' },
  { qid: 'Q605', en: 'left nerve without whole' },
];
const sidedMuscle = () => [...structures(), structure('deltoid', 'muscle', 'bilateral', { fma: 100, wikidata: 'Q100' }, { left: { fma: 101, wikidata: 'Q101' }, right: { fma: 102, wikidata: 'Q102' } })];

test('a lateralised nerve item on each side collapses into one structure-level innervation of the unlateralised item', () => {
  const p = plan({ structures: sidedMuscle(), targets: NERVES, wikidata: wd('Q101,P3189,Q601', 'Q102,P3189,Q602') });
  assert.deepEqual(p.relations.get('deltoid'), { structure: [rel('innervation', 'wikidata:Q600', 'wikidata')] });
  assert.deepEqual(Object.keys(p.registry), ['Q600']);
  assert.deepEqual(p.report.lateralUnresolved, []);
});

test('a lateralised nerve item on one side only gives a structure-level innervation: no false asymmetry', () => {
  const p = plan({ structures: sidedMuscle(), targets: NERVES, wikidata: wd('Q102,P3189,Q603') });
  assert.deepEqual(p.relations.get('deltoid'), { structure: [rel('innervation', 'wikidata:Q604', 'wikidata')] });
});

test('a lateralised nerve item without an unlateralised counterpart is kept as it is and counted', () => {
  const p = plan({ structures: sidedMuscle(), targets: NERVES, wikidata: wd('Q101,P3189,Q605') });
  assert.deepEqual(p.relations.get('deltoid'), { left: [rel('innervation', 'wikidata:Q605', 'wikidata')] });
  assert.deepEqual(p.report.lateralUnresolved, ['Q605']);
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

test("a curated label of a draft registry entry is kept, the entry's other labels refreshed", () => {
  // the real Q623365 "inferior subscapular nerve", whose French label on Wikidata is that of the superior one
  const fr = { text: 'nerf subscapulaire inférieur', source: 'curated', status: 'draft' as const };
  const registry: ExternalTargets = {
    Q500: { labels: { en: { text: 'old', source: 'wikidata', status: 'draft' }, fr }, source: 'wikidata', status: 'draft' },
  };
  const p = plan({ wikidata: wd('Q10,P3189,Q500'), registry });
  assert.deepEqual(p.registry.Q500.labels, {
    en: { text: 'tibial nerve', source: 'wikidata', status: 'draft' },
    fr,
    la: { text: 'nervus tibialis', source: 'wikidata', status: 'draft' },
  });
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

test('a curated continuation-of blocks a draft branch-of: one tree parent per vessel', () => {
  // the real popliteal artery: curated continuation of the femoral artery, FMA branch_of the external iliac artery
  const curated = rel('continuation-of', 'femoral-artery', 'curated', 'draft');
  const p = plan({ structures: withStructure('popliteal-artery', { relations: [curated] }), fma: fma('2,branch_of,3') });
  assert.deepEqual(p.relations.get('popliteal-artery'), { structure: [curated] });
  assert.deepEqual(p.report.conflicts, [{ slug: 'popliteal-artery', type: 'branch-of', kept: 'continuation-of femoral-artery', planned: 'axillary-artery' }]);
});

test('a curated side-level tree relation blocks the draft tree relations of the other side too', () => {
  const curated = rel('branch-of', 'femoral-artery', 'curated', 'draft');
  const p = plan({
    structures: withStructure('popliteal-artery', { sides: { left: { ids: { fma: 21 }, relations: [curated] }, right: { ids: { fma: 22 } } } }),
    fma: fma('22,branch_of,3'),
  });
  assert.deepEqual(p.relations.get('popliteal-artery'), { left: [curated] });
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

test('sides left equal once the second tree relation is set aside are written once at structure level', () => {
  // the real testicular vein: the whole and the right side give the inferior vena cava, the right side also a second tree
  const p = plan({ fma: fma('7,tributary_of,6', '72,tributary_of,6', '72,tributary_of,5') });
  assert.deepEqual(p.relations.get('gonadal-vein'), { structure: [rel('tributary-of', 'inferior-vena-cava')] });
  assert.deepEqual(p.report.ignored.map(({ subject, reason }) => ({ subject, reason })), [{ subject: 'gonadal-vein', reason: 'second-tree' }]);
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

// ---------- the import command (files on disk) ----------

const FMA_HEAD = 'subject_fma,relation,target_fma\n';
const WD_HEAD = 'subject_qid,property,target_qid\n';
const TARGETS_HEAD = 'qid,fma,en,fr,la\n';
const SNAP = {
  'import/relations-fma.csv': FMA_HEAD + '5,branch_of,2\n3,continuous_distally_with,4\n21,branch_of,11\n22,branch_of,3\n',
  'import/relations-wikidata.csv': WD_HEAD,
  'import/wikidata-targets.csv': TARGETS_HEAD,
  'import/wikidata-fma.csv': 'item,fma,ta2,ta98,fr,la,en\n',
};
const ARTERY = (slug: string, extra: string) => `slug: ${slug}\nkind: artery\nlaterality: bilateral\nstatus: draft\nlabels:\n  en:\n    text: ${slug}\n    source: fma\n    status: draft\n${extra}`;
const diskData = (files: Record<string, unknown> = {}) => writeDataset({
  ...sources, ...SNAP,
  'structures/artery/femoral-artery.yaml': ARTERY('femoral-artery', 'ids:\n  fma: 1\nsides:\n  left:\n    ids:\n      fma: 11\n  right:\n    ids:\n      fma: 12\n'),
  'structures/artery/popliteal-artery.yaml': ARTERY('popliteal-artery', 'ids:\n  fma: 2\nsides:\n  left:\n    ids:\n      fma: 21\n    labels:\n      fr:\n        text: poplitée gauche\n        source: curated\n        status: reviewed\n  right:\n    ids:\n      fma: 22\n'),
  'structures/artery/axillary-artery.yaml': ARTERY('axillary-artery', 'ids:\n  fma: 3\n'),
  'structures/artery/brachial-artery.yaml': ARTERY('brachial-artery', 'ids:\n  fma: 4\n').replace('status: draft', 'status: reviewed'),
  'structures/artery/anterior-tibial-artery.yaml': '# header comment\n' + ARTERY('anterior-tibial-artery', 'ids:\n  fma: 5\nmeshes:\n  - bp3d:FJ1 # mesh comment\n'),
  ...files,
});
const text = (d: string, rel: string) => readFileSync(join(d, rel), 'utf8');

test('a draft structure gets its relations key after meshes, comments elsewhere kept', () => {
  const d = diskData();
  const r = importRelations(d);
  assert.equal(r.aborted, false);
  const t = text(d, 'structures/artery/anterior-tibial-artery.yaml');
  assert.match(t, /^# header comment\n/);
  assert.match(t, /- bp3d:FJ1 # mesh comment\nrelations:\n {2}- type: branch-of\n {4}target: popliteal-artery\n {4}source: fma\n {4}status: draft\n$/);
});

test('a structure with status reviewed still gets its draft relations', () => {
  const d = diskData();
  importRelations(d);
  const t = text(d, 'structures/artery/brachial-artery.yaml');
  assert.match(t, /status: reviewed/);
  assert.match(t, /relations:\n {2}- type: continuation-of\n {4}target: axillary-artery\n {4}source: fma\n {4}status: draft\n$/);
});

test('differing sides write sides.<side>.relations after labels in the side block', () => {
  const d = diskData();
  importRelations(d);
  const t = text(d, 'structures/artery/popliteal-artery.yaml');
  assert.doesNotMatch(t, /^relations:/m, 'nothing at structure level');
  assert.match(t, /text: poplitée gauche\n {8}source: curated\n {8}status: reviewed\n {4}relations:\n {6}- type: branch-of\n {8}target: femoral-artery\n/);
  assert.match(t, /fma: 22\n {4}relations:\n {6}- type: branch-of\n {8}target: axillary-artery\n/);
});

test('a structure with no planned relation loses its relations keys', () => {
  const stale = 'relations:\n  - type: branch-of\n    target: popliteal-artery\n    source: fma\n    status: draft\n';
  const d = diskData({ 'structures/artery/axillary-artery.yaml': ARTERY('axillary-artery', 'ids:\n  fma: 3\n' + stale) });
  importRelations(d);
  assert.doesNotMatch(text(d, 'structures/artery/axillary-artery.yaml'), /relations/);
});

test('a second run writes nothing', () => {
  const d = diskData();
  const first = importRelations(d);
  assert.equal(first.updated, 3);
  const before = ['anterior-tibial', 'brachial', 'popliteal'].map((n) => text(d, `structures/artery/${n}-artery.yaml`));
  const second = importRelations(d);
  assert.equal(second.updated, 0);
  assert.equal(second.unchanged, 5);
  assert.deepEqual(['anterior-tibial', 'brachial', 'popliteal'].map((n) => text(d, `structures/artery/${n}-artery.yaml`)), before);
});

test('external targets are written to external-targets.yaml sorted by key, only when they change', () => {
  const muscle = ARTERY('long-muscle', 'ids:\n  fma: 30\n  wikidata: Q30\n').replace('kind: artery', 'kind: muscle');
  const d = diskData({
    'structures/muscle/long-muscle.yaml': muscle,
    'import/relations-wikidata.csv': WD_HEAD + 'Q30,P3189,Q9\nQ30,P3189,Q10\n',
    'import/wikidata-targets.csv': TARGETS_HEAD + 'Q9,,nine,,\nQ10,,ten,,\n',
  });
  importRelations(d);
  const registry = text(d, 'external-targets.yaml');
  assert.ok(registry.indexOf('Q10:') < registry.indexOf('Q9:'), 'byKey order');
  assert.match(registry, /Q9:\n {2}labels:\n {4}en:\n {6}text: nine/);
  importRelations(d);
  assert.equal(text(d, 'external-targets.yaml'), registry);
});

test('malformed snapshot rows are counted in the import report with file and line', () => {
  const d = diskData({ 'import/relations-fma.csv': SNAP['import/relations-fma.csv'] + '6,branch_of\n' });
  const r = importRelations(d);
  assert.equal(r.aborted, false);
  assert.deepEqual(r.malformed.map((m) => `${m.file}:${m.line}`), ['relations-fma.csv:6']);
});

test('a missing snapshot aborts and names the file, nothing written', () => {
  const d = diskData();
  rmSync(join(d, 'import/relations-fma.csv'));
  const before = text(d, 'structures/artery/anterior-tibial-artery.yaml');
  const r = importRelations(d);
  assert.equal(r.aborted, true);
  assert.deepEqual(r.missingFiles, ['import/relations-fma.csv']);
  assert.equal(text(d, 'structures/artery/anterior-tibial-artery.yaml'), before);
  assert.equal(existsSync(join(d, 'external-targets.yaml')), false);
});

test('an unreadable structure file aborts before any write', () => {
  const d = diskData({ 'structures/artery/broken.yaml': 'slug: [\n' });
  const before = text(d, 'structures/artery/anterior-tibial-artery.yaml');
  const r = importRelations(d);
  assert.equal(r.aborted, true);
  assert.deepEqual(r.unreadableFiles, ['structures/artery/broken.yaml']);
  assert.equal(text(d, 'structures/artery/anterior-tibial-artery.yaml'), before);
});

test('duplicate slugs abort before any write', () => {
  const d = diskData({ 'structures/vein/femoral-artery.yaml': ARTERY('femoral-artery', '') });
  const r = importRelations(d);
  assert.equal(r.aborted, true);
  assert.deepEqual(r.duplicateSlugs, ['femoral-artery']);
  assert.doesNotMatch(text(d, 'structures/artery/anterior-tibial-artery.yaml'), /relations/);
});

test('a bp3d re-import keeps the relations and the side relations written by this import', () => {
  const FIX = new URL('./fixtures/', import.meta.url).pathname;
  const d = writeDataset({
    ...sources,
    'import/relations-fma.csv': FMA_HEAD + '3939,branch_of,70246\n',
    'import/relations-wikidata.csv': WD_HEAD,
    'import/wikidata-targets.csv': TARGETS_HEAD,
    'import/wikidata-fma.csv': 'item,fma,ta2,ta98,fr,la,en\n',
  });
  const overrides = { noFold: ['atrium', 'ventricle', 'auricle', 'coronary artery'], ties: {}, slugs: {} };
  const bp3d = () => importBp3d({ bp3dDir: join(FIX, 'bp3d'), wikidataCsv: join(FIX, 'wikidata.csv'), dataDir: d, overrides });
  bp3d();
  assert.equal(importRelations(d).updated, 1);
  const carotid = text(d, 'structures/artery/common-carotid-artery.yaml');
  assert.match(carotid, /relations:\n {2}- type: branch-of\n {4}target: femoral-artery/);
  bp3d();
  assert.equal(text(d, 'structures/artery/common-carotid-artery.yaml'), carotid);
});
