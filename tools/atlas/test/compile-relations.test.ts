import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAtlas, type Diagnostic } from '../src/compile-atlas.ts';
import { sources, validStructures, writeDataset } from './helpers.ts';

const lbl = (text: string) => ({ text, source: 'fma', status: 'draft' });
const rel = (type: string, target: string, extra: object = {}) => ({ type, target, source: 'fma', status: 'draft', ...extra });
const FEM = 'structures/artery/femoral-artery.yaml';
const POP = 'structures/artery/popliteal-artery.yaml';
const IVC = 'structures/vein/inferior-vena-cava.yaml';
const GON = 'structures/vein/gonadal-vein.yaml';
const MUSCLE = 'structures/muscle/biceps-brachii.yaml';
const REGISTRY = 'external-targets.yaml';

/** The shared fixture: valid structures plus arteries, veins and an external target. */
function fixture(): Record<string, any> {
  const base = validStructures();
  const bilateral = (slug: string, kind: string, l: string, r: string, extra: object = {}) => ({
    slug, kind, laterality: 'bilateral', status: 'draft', parent: 'human-body', labels: { en: lbl(slug.replace(/-/g, ' ')) },
    sides: { left: { meshes: [`bp3d:${l}`] }, right: { meshes: [`bp3d:${r}`] } }, ...extra,
  });
  return {
    ...sources,
    'sources/fma.yaml': { ...sources['sources/fma.yaml'], provides: ['labels', 'ids', 'relations'] },
    'sources/wikidata.yaml': { ...sources['sources/wikidata.yaml'], provides: ['labels', 'ids', 'relations'] },
    ...base,
    [MUSCLE]: { ...base[MUSCLE], relations: [rel('innervation', 'wikidata:Q1', { source: 'wikidata' })] },
    [FEM]: bilateral('femoral-artery', 'artery', 'FJ10M', 'FJ10', { ids: { wikidata: 'Q10' } }),
    [POP]: bilateral('popliteal-artery', 'artery', 'FJ11M', 'FJ11', { relations: [rel('branch-of', 'femoral-artery')] }),
    [IVC]: { slug: 'inferior-vena-cava', kind: 'vein', laterality: 'midline', status: 'draft', parent: 'human-body', labels: { en: lbl('inferior vena cava') }, meshes: ['bp3d:FJ20'] },
    'structures/vein/renal-vein.yaml': bilateral('renal-vein', 'vein', 'FJ21M', 'FJ21', { relations: [rel('tributary-of', 'inferior-vena-cava')] }),
    [GON]: bilateral('gonadal-vein', 'vein', 'FJ22M', 'FJ22', { sides: {
      left: { meshes: ['bp3d:FJ22M'], relations: [rel('tributary-of', 'renal-vein')] },
      right: { meshes: ['bp3d:FJ22'], relations: [rel('tributary-of', 'inferior-vena-cava')] },
    } }),
    [REGISTRY]: { Q1: { labels: { en: lbl('tibial nerve') }, source: 'wikidata', status: 'draft' } },
  };
}

function compile(overrides: Record<string, unknown> = {}) {
  const files: Record<string, unknown> = { ...fixture(), ...overrides };
  for (const [k, v] of Object.entries(files)) if (v === null) delete files[k];
  return compileAtlas(writeDataset(files));
}
const pick = (d: Diagnostic) => ({ file: d.file, pointer: d.pointer, rule: d.rule });
const withPop = (relations: unknown[]) => ({ [POP]: { ...fixture()[POP], relations } });

test('the fixture compiles without error', () => {
  const { errors } = compile();
  assert.deepEqual(errors, []);
});

test('a type outside the vocabulary is a schema error at its pointer', () => {
  const { errors } = compile(withPop([rel('sibling-of', 'femoral-artery')]));
  assert.deepEqual(errors.map(pick), [{ file: POP, pointer: '/relations/0/type', rule: 'schema' }]);
});

test('a target that is neither a slug nor a wikidata id is a schema error', () => {
  const { errors } = compile(withPop([rel('branch-of', 'Femoral Artery')]));
  assert.deepEqual(errors.map(pick), [{ file: POP, pointer: '/relations/0/target', rule: 'schema' }]);
});

test('two identical relations in one list are a schema error', () => {
  const { errors } = compile(withPop([rel('branch-of', 'femoral-artery'), rel('branch-of', 'femoral-artery')]));
  assert.ok(errors.some((e) => e.file === POP && e.rule === 'schema' && e.pointer === '/relations'));
});

test('an unknown target slug is a relation-target error', () => {
  const { errors } = compile(withPop([rel('branch-of', 'no-such-artery')]));
  assert.deepEqual(errors.map(pick), [{ file: POP, pointer: '/relations/0/target', rule: 'relation-target' }]);
});

test('a wikidata target absent from the registry is a relation-external error', () => {
  const { errors } = compile({ [MUSCLE]: { ...fixture()[MUSCLE], relations: [rel('innervation', 'wikidata:Q999', { source: 'wikidata' })] } });
  assert.deepEqual(errors.map(pick), [{ file: MUSCLE, pointer: '/relations/0/target', rule: 'relation-external' }]);
});

test('a source outside the registry is a relation-source error; curated is accepted', () => {
  const bad = compile(withPop([rel('branch-of', 'femoral-artery', { source: 'pubmed' })]));
  assert.deepEqual(bad.errors.map(pick), [{ file: POP, pointer: '/relations/0/source', rule: 'relation-source' }]);
  const curated = compile(withPop([rel('branch-of', 'femoral-artery', { source: 'curated' })]));
  assert.deepEqual(curated.errors, []);
});

test('a source that does not provide relations is a relation-source error', () => {
  const { errors } = compile({ 'sources/fma.yaml': { ...sources['sources/fma.yaml'], provides: ['labels', 'ids'] } });
  assert.deepEqual(errors.map(pick), [{ file: POP, pointer: '/relations/0/source', rule: 'relation-source' }, { file: GON, pointer: '/sides/left/relations/0/source', rule: 'relation-source' }, { file: GON, pointer: '/sides/right/relations/0/source', rule: 'relation-source' }, { file: 'structures/vein/renal-vein.yaml', pointer: '/relations/0/source', rule: 'relation-source' }]);
});

test('a branch-of towards an organ is a relation-kind error naming the kind', () => {
  const { errors } = compile(withPop([rel('branch-of', 'heart')]));
  assert.deepEqual(errors.map(pick), [{ file: POP, pointer: '/relations/0/target', rule: 'relation-kind' }]);
  assert.match(errors[0].message, /organ/);
});

test('arterial-supply on a group is a relation-kind error', () => {
  const root = validStructures()['structures/group/human-body.yaml'];
  const { errors } = compile({ 'structures/group/human-body.yaml': { ...root, relations: [rel('arterial-supply', 'femoral-artery')] } });
  assert.deepEqual(errors.map(pick), [{ file: 'structures/group/human-body.yaml', pointer: '/relations/0', rule: 'relation-kind' }]);
});

test('two branch-of on one structure are a relation-tree error', () => {
  const other = { ...fixture()[FEM], slug: 'other-artery', sides: { left: { meshes: ['bp3d:FJ30M'] }, right: { meshes: ['bp3d:FJ30'] } }, ids: undefined };
  const { errors } = compile({
    'structures/artery/other-artery.yaml': other,
    ...withPop([rel('branch-of', 'femoral-artery'), rel('branch-of', 'other-artery')]),
  });
  assert.deepEqual(errors.map(pick), [{ file: POP, pointer: '/relations/1', rule: 'relation-tree' }]);
});

test('a cycle of tree relations is a relation-cycle error naming the slugs', () => {
  const { errors } = compile({ [FEM]: { ...fixture()[FEM], relations: [rel('branch-of', 'popliteal-artery')] } });
  assert.deepEqual(errors.map((e) => e.rule), ['relation-cycle']);
  assert.match(errors[0].message, /femoral-artery/);
  assert.match(errors[0].message, /popliteal-artery/);
});

test('side relations on a midline structure are a relation-side-shape error', () => {
  const { errors } = compile({ [IVC]: { ...fixture()[IVC], sides: { left: { relations: [rel('tributary-of', 'renal-vein')] } } } });
  assert.ok(errors.some((e) => e.file === IVC && e.rule === 'relation-side-shape' && e.pointer === '/sides/left/relations'));
});

test('a type at structure level and at side level is a relation-side-mixed error', () => {
  const { errors } = compile({ [GON]: { ...fixture()[GON], relations: [rel('tributary-of', 'inferior-vena-cava')] } });
  assert.deepEqual(errors.map(pick), [{ file: GON, pointer: '/relations/0', rule: 'relation-side-mixed' }]);
});

test('a wikidata target carried by one of our structures resolves with a warning', () => {
  const { errors, warnings } = compile({
    ...withPop([rel('branch-of', 'wikidata:Q10')]),
    [REGISTRY]: { Q1: fixture()[REGISTRY].Q1, Q10: fixture()[REGISTRY].Q1 },
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => w.rule.startsWith('relation-')).map(pick), [{ file: POP, pointer: '/relations/0/target', rule: 'relation-external-resolved' }]);
});

test('a registry entry without an English label is a schema error in the registry file', () => {
  const { errors } = compile({ [REGISTRY]: { Q1: { labels: { fr: { text: 'nerf tibial', source: 'wikidata', status: 'draft' } }, source: 'wikidata', status: 'draft' } } });
  assert.ok(errors.some((e) => e.file === REGISTRY && e.rule === 'schema'));
});

test('a data directory without registry file has an empty registry', () => {
  const { errors } = compile({ [REGISTRY]: null, [MUSCLE]: validStructures()[MUSCLE] });
  assert.deepEqual(errors, []);
});

// ---- compiled atlas: relations, inverses, externals, outside ----

const OVARY = 'structures/organ/ovary.yaml';
const ovary = () => ({
  slug: 'ovary', kind: 'organ', laterality: 'bilateral', status: 'draft', sex: 'female', parent: 'human-body', labels: { en: lbl('ovary') },
  sides: { left: { meshes: ['bp3d:FJ40M'] }, right: { meshes: ['bp3d:FJ40'] } },
  relations: [rel('arterial-supply', 'femoral-artery')],
});
const by = (a: any, slug: string) => a.structures.find((s: any) => s.slug === slug);

test('compiled relations carry type, target slug, source and status', () => {
  const { atlases, errors } = compile();
  assert.deepEqual(errors, []);
  assert.deepEqual(by(atlases!.male, 'popliteal-artery').relations, [{ type: 'branch-of', target: 'femoral-artery', source: 'fma', status: 'draft' }]);
});

test('an inverse names its subject', () => {
  const { atlases } = compile();
  assert.deepEqual(by(atlases!.male, 'femoral-artery').inverse, [{ type: 'branch-of', subject: 'popliteal-artery', source: 'fma', status: 'draft' }]);
});

test('side relations are flattened with their side and leave the side block', () => {
  const g = by(compile().atlases!.male, 'gonadal-vein');
  assert.deepEqual(g.relations.map((r: any) => [r.type, r.side, r.target]), [['tributary-of', 'left', 'renal-vein'], ['tributary-of', 'right', 'inferior-vena-cava']]);
  assert.ok(!('relations' in g.sides.left));
  assert.ok(!('relations' in g.sides.right));
});

test('inverses of side-level relations keep the subject side', () => {
  const { atlases } = compile();
  const inv = (slug: string) => by(atlases!.male, slug).inverse.map((i: any) => [i.subject, i.side]);
  assert.deepEqual(inv('renal-vein'), [['gonadal-vein', 'left']]);
  assert.deepEqual(inv('inferior-vena-cava'), [['renal-vein', undefined], ['gonadal-vein', 'right']]);
});

test('an external target stays wikidata:Q and its labels are emitted', () => {
  const a = compile().atlases!.male;
  assert.equal(by(a, 'biceps-brachii').relations[0].target, 'wikidata:Q1');
  assert.equal(a.externals['wikidata:Q1'].labels.en?.text, 'tibial nerve');
});

test('a registry entry used by no relation is not emitted', () => {
  const a = compile({ [MUSCLE]: validStructures()[MUSCLE] }).atlases!.male;
  assert.deepEqual(a.externals, {});
});

test('a resolved wikidata target compiles to the slug and has an inverse', () => {
  const { atlases } = compile({
    ...withPop([rel('branch-of', 'wikidata:Q10')]),
    [REGISTRY]: { Q1: fixture()[REGISTRY].Q1, Q10: fixture()[REGISTRY].Q1 },
  });
  const a = atlases!.male;
  assert.equal(by(a, 'popliteal-artery').relations[0].target, 'femoral-artery');
  assert.deepEqual(by(a, 'femoral-artery').inverse.map((i: any) => i.subject), ['popliteal-artery']);
  assert.ok(!('wikidata:Q10' in a.externals));
});

test('a structure absent from a model is outside: its labels and its inverse reach the other model', () => {
  const { atlases, errors } = compile({ [OVARY]: ovary() });
  assert.deepEqual(errors, []);
  const male = atlases!.male;
  assert.deepEqual(male.outside.ovary, { kind: 'organ', labels: { en: lbl('ovary') } });
  assert.ok(by(male, 'femoral-artery').inverse.some((i: any) => i.subject === 'ovary' && i.type === 'arterial-supply'));
  assert.ok(!('outside' in atlases!.female) || !('ovary' in atlases!.female.outside));
  assert.ok(by(atlases!.female, 'ovary'));
});

test('outside also names an absent relation target', () => {
  const { atlases, errors } = compile({ [FEM]: { ...fixture()[FEM], sex: 'female' } });
  assert.deepEqual(errors, []);
  assert.deepEqual(atlases!.male.outside['femoral-artery'], { kind: 'artery', labels: { en: lbl('femoral artery') } });
  assert.equal(atlases!.female.outside['femoral-artery'], undefined);
});

test('a source used only by relations is credited', () => {
  const files: Record<string, any> = fixture();
  for (const k of Object.keys(files)) if (k.startsWith('structures/')) {
    const s = files[k];
    const strip = (l: any) => l && Object.fromEntries(Object.entries(l).map(([lang, v]: any) => [lang, { ...v, source: 'curated' }]));
    files[k] = { ...s, labels: strip(s.labels), sides: s.sides && Object.fromEntries(Object.entries(s.sides).map(([sd, b]: any) => [sd, { ...b, labels: strip(b.labels) }])) };
  }
  const a = compileAtlas(writeDataset(files)).atlases!.male;
  assert.ok(a.attributions.some((x) => x.source === 'fma'));
  const none = compile({ ...Object.fromEntries(Object.entries(files)), [POP]: { ...files[POP], relations: undefined }, [GON]: { ...files[GON], sides: { left: { meshes: ['bp3d:FJ22M'] }, right: { meshes: ['bp3d:FJ22'] } } }, 'structures/vein/renal-vein.yaml': { ...files['structures/vein/renal-vein.yaml'], relations: undefined }, [MUSCLE]: { ...files[MUSCLE], relations: undefined } }).atlases!.male;
  assert.ok(!none.attributions.some((x) => x.source === 'fma'));
});

test('relation order follows the type vocabulary, then side, then target', () => {
  const { atlases } = compile({ [MUSCLE]: { ...fixture()[MUSCLE], relations: [rel('innervation', 'wikidata:Q1', { source: 'wikidata' }), rel('arterial-supply', 'popliteal-artery'), rel('arterial-supply', 'femoral-artery')] } });
  assert.deepEqual(by(atlases!.male, 'biceps-brachii').relations.map((r: any) => r.target), ['femoral-artery', 'popliteal-artery', 'wikidata:Q1']);
});

test('compiling twice gives byte-identical atlases', () => {
  const files = { ...fixture(), [OVARY]: ovary() };
  const a = compileAtlas(writeDataset(files)).atlases!;
  const b = compileAtlas(writeDataset(files)).atlases!;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
