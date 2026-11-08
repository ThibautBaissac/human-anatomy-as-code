import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAtlas, type Diagnostic } from '../src/compile-atlas.ts';
import { sources, validDataset, validStructures } from './helpers.ts';

const S = validStructures();
const HEART = 'structures/organ/heart.yaml';
const SPLEEN = 'structures/organ/spleen.yaml';
const FEMUR = 'structures/bone/femur.yaml';
const heart = (patch: object) => ({ [HEART]: { ...S[HEART], ...patch } });
const spleen = (patch: object) => ({ [SPLEEN]: { ...S[SPLEEN], ...patch } });

const pick = (d: Diagnostic) => ({ file: d.file, pointer: d.pointer, rule: d.rule });

function expectError(overrides: Record<string, unknown>, expected: { file: string; pointer: string; rule: string }) {
  const { atlas, errors } = compileAtlas(validDataset(overrides));
  assert.equal(atlas, null, 'atlas must not be produced when there are errors');
  assert.deepEqual(errors.map(pick), [expected]);
}

test('yaml-parse: an unreadable file is reported and skipped', () => {
  expectError({ 'structures/organ/broken.yaml': 'slug: [unclosed\n' }, { file: 'structures/organ/broken.yaml', pointer: '', rule: 'yaml-parse' });
});

test('schema: an unknown kind is reported at its pointer', () => {
  expectError(heart({ kind: 'organe' }), { file: HEART, pointer: '/kind', rule: 'schema' });
});

test('schema: source files are validated too', () => {
  const { licence: _, ...noLicence } = sources['sources/wikidata.yaml'];
  expectError({ 'sources/wikidata.yaml': noLicence }, { file: 'sources/wikidata.yaml', pointer: '', rule: 'schema' });
});

test('kind-folder: the folder must match the kind', () => {
  expectError({ [HEART]: null, 'structures/bone/heart.yaml': S[HEART] }, { file: 'structures/bone/heart.yaml', pointer: '/kind', rule: 'kind-folder' });
});

test('slug-filename: the file name must match the slug', () => {
  expectError({ [HEART]: null, 'structures/organ/cor.yaml': S[HEART] }, { file: 'structures/organ/cor.yaml', pointer: '/slug', rule: 'slug-filename' });
});

test('slug-unique: an alias may not shadow a slug', () => {
  expectError(spleen({ aliases: ['heart'] }), { file: SPLEEN, pointer: '/aliases/0', rule: 'slug-unique' });
});

test('slug-unique: two aliases may not collide', () => {
  expectError(spleen({ aliases: ['biceps'] }), { file: SPLEEN, pointer: '/aliases/0', rule: 'slug-unique' });
});

test('parent-exists: parent must be an existing slug', () => {
  expectError(heart({ parent: 'nowhere' }), { file: HEART, pointer: '/parent', rule: 'parent-exists' });
});

test('parent-exists: a parent given as an alias names the canonical slug', () => {
  const { errors } = compileAtlas(validDataset(heart({ parent: 'biceps' })));
  assert.deepEqual(errors.map(pick), [{ file: HEART, pointer: '/parent', rule: 'parent-exists' }]);
  assert.match(errors[0].message, /biceps-brachii/);
});

test('parent-cycle: a cycle is reported once', () => {
  const { errors } = compileAtlas(validDataset({
    ...heart({ parent: 'spleen' }),
    ...spleen({ parent: 'heart' }),
  }));
  assert.deepEqual(errors.map((e) => e.rule), ['parent-cycle']);
});

test('laterality-shape: sides on a non-bilateral structure get one readable error', () => {
  expectError({ [FEMUR]: { ...S[FEMUR], laterality: 'midline' } }, { file: FEMUR, pointer: '/sides', rule: 'laterality-shape' });
});

test('laterality-shape: a bilateral structure needs both sides', () => {
  const { right: _, ...leftOnly } = S[FEMUR].sides;
  expectError({ [FEMUR]: { ...S[FEMUR], sides: leftOnly } }, { file: FEMUR, pointer: '/sides', rule: 'laterality-shape' });
});

test('mesh-ref: the prefix must be declared by a source', () => {
  expectError(heart({ meshes: ['xyz:FJ2417'] }), { file: HEART, pointer: '/meshes/0', rule: 'mesh-ref' });
});

test('mesh-ref: the id must match the source pattern', () => {
  expectError(heart({ meshes: ['bp3d:ABC'] }), { file: HEART, pointer: '/meshes/0', rule: 'mesh-ref' });
});

test('mesh-unique: a mesh belongs to one structure only', () => {
  expectError(spleen({ meshes: ['bp3d:FJ2417'] }), { file: SPLEEN, pointer: '/meshes/0', rule: 'mesh-unique' });
});

test('fma-unique: an FMA id is used once across roots and sides', () => {
  expectError(spleen({ ids: { fma: 24474 } }), { file: SPLEEN, pointer: '/ids/fma', rule: 'fma-unique' });
});

test('label-source: a label source must be a registered source or curated', () => {
  expectError(heart({ labels: { ...S[HEART].labels, fr: { text: 'cœur', source: 'wikipedia', status: 'draft', gender: 'm' } } }),
    { file: HEART, pointer: '/labels/fr/source', rule: 'label-source' });
});

test('label-gender: a reviewed fr or la label needs a gender', () => {
  expectError(heart({ labels: { ...S[HEART].labels, la: { text: 'cor', source: 'wikidata', status: 'reviewed' } } }),
    { file: HEART, pointer: '/labels/la', rule: 'label-gender' });
});

test('label-gender: a draft label without gender is only a warning', () => {
  const { errors, warnings } = compileAtlas(validDataset(heart({ labels: { ...S[HEART].labels, fr: { text: 'cœur', source: 'wikidata', status: 'draft' } } })));
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.rule === 'label-gender' && w.file === HEART && w.pointer === '/labels/fr'));
});

test('warnings: orphan, missing-fr, missing-la', () => {
  const { errors, warnings } = compileAtlas(validDataset(heart({ parent: undefined, labels: { en: S[HEART].labels.en } })));
  assert.deepEqual(errors, []);
  const heartWarnings = warnings.filter((w) => w.file === HEART).map((w) => w.rule).sort();
  assert.deepEqual(heartWarnings, ['missing-fr', 'missing-la', 'orphan']);
  assert.ok(!warnings.some((w) => w.rule === 'orphan' && w.file.endsWith('human-body.yaml')), 'the root is not an orphan');
  assert.ok(warnings.every((w) => w.severity === 'warning'));
});

test('determinism: two compilations give identical bytes, without absolute paths', () => {
  const dir = validDataset();
  const a = JSON.stringify(compileAtlas(dir).atlas);
  const b = JSON.stringify(compileAtlas(validDataset()).atlas);
  assert.equal(a, b);
  assert.ok(!a.includes(dir));
});
