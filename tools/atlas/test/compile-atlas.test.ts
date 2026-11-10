import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAtlas } from '../src/compile-atlas.ts';
import { validDataset } from './helpers.ts';

test('a valid dataset compiles without errors, structures sorted by slug', () => {
  const { atlas, errors } = compileAtlas(validDataset());
  assert.deepEqual(errors, []);
  assert.deepEqual(atlas!.structures.map((s) => s.slug), ['biceps-brachii', 'femur', 'heart', 'human-body', 'spleen']);
});

const bySlug = (dir: string) => {
  const { atlas, errors } = compileAtlas(dir);
  assert.deepEqual(errors, []);
  return Object.fromEntries(atlas!.structures.map((s) => [s.slug, s]));
};

test('layer is the override when present, else the kind default, null for groups', () => {
  const s = bySlug(validDataset());
  assert.equal(s.heart.layer, 6);
  assert.equal(s.spleen.layer, 4);
  assert.equal(s.femur.layer, 5);
  assert.equal(s['biceps-brachii'].layer, 2);
  assert.equal(s['human-body'].layer, null);
});

test('children lists the slugs whose parent is the structure, sorted', () => {
  const s = bySlug(validDataset());
  assert.deepEqual(s['human-body'].children, ['biceps-brachii', 'femur', 'heart', 'spleen']);
  assert.deepEqual(s.femur.children, []);
});

test('each side carries composed labels, a side override wins', () => {
  const s = bySlug(validDataset());
  assert.deepEqual(s.femur.sides!.right.labels, { en: 'right femur', fr: 'fémur droit', la: 'femur dextrum' });
  assert.deepEqual(s.femur.sides!.left.labels, { en: 'left femur', fr: 'fémur gauche (surcharge)', la: 'femur sinistrum' });
});

test('meshIndex maps every mesh reference to its structure and side', () => {
  const { atlas } = compileAtlas(validDataset());
  assert.deepEqual(atlas!.meshIndex['bp3d:FJ3259M'], { slug: 'femur', side: 'left' });
  assert.deepEqual(atlas!.meshIndex['bp3d:FJ2417'], { slug: 'heart', side: null });
  assert.equal(Object.keys(atlas!.meshIndex).length, 6);
});

test('sources are indexed by id and attributions list only the sources in use', () => {
  const { atlas } = compileAtlas(validDataset());
  assert.deepEqual(Object.keys(atlas!.sources).sort(), ['bodyparts3d', 'fma', 'wikidata']);
  assert.deepEqual(atlas!.attributions.map((a) => a.source), ['bodyparts3d', 'fma', 'wikidata']);
  const noWikidata = compileAtlas(validDataset({
    'structures/organ/heart.yaml': { slug: 'heart', kind: 'organ', laterality: 'midline', status: 'draft', labels: { en: { text: 'heart', source: 'fma', status: 'draft' } } },
    'structures/organ/spleen.yaml': null, 'structures/bone/femur.yaml': null, 'structures/muscle/biceps-brachii.yaml': null,
    'structures/group/human-body.yaml': null,
  }));
  assert.deepEqual(noWikidata.atlas!.attributions.map((a) => a.source), ['fma']);
});

test('atlas keys are sorted and mesh lists ordered, whatever the file layout', async () => {
  const { validStructures, writeDataset, sources } = await import('./helpers.ts');
  const files = validStructures();
  const heart = files['structures/organ/heart.yaml'];
  const shuffled = Object.fromEntries(Object.entries({ ...heart, meshes: ['bp3d:FJ2417', 'bp3d:FJ0001'] }).reverse());
  const a = compileAtlas(writeDataset({ ...sources, ...files, 'structures/organ/heart.yaml': { ...heart, meshes: ['bp3d:FJ0001', 'bp3d:FJ2417'] } })).atlas!;
  const b = compileAtlas(writeDataset({ ...sources, ...files, 'structures/organ/heart.yaml': shuffled })).atlas!;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const entry = a.structures.find((s) => s.slug === 'heart')!;
  assert.deepEqual(Object.keys(entry), [...Object.keys(entry)].sort());
});
