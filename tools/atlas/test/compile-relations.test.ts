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
