import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, UNATTACHED } from '../src/viewer/catalog.ts';
import { appearance } from '../src/viewer/appearance.ts';
import { ATLAS, INSTANCES } from './fixture.ts';

const cat = buildCatalog(ATLAS, INSTANCES);

test('catalog: each instance knows its structure, side, kind and layer', () => {
  assert.deepEqual(cat.instance(1), { index: 1, name: 'femur@right', slug: 'femur', side: 'right', kind: 'bone', layer: 5, systems: ['skeletal'], inModel: true });
  assert.deepEqual(cat.instance(2), { index: 2, name: 'heart', slug: 'heart', side: null, kind: 'organ', layer: 4, systems: ['cardiovascular', 'endocrine'], inModel: true });
});

test('catalog: instances of a structure, of one side, and of a group through its descendants', () => {
  assert.deepEqual(cat.instancesOf('femur'), [0, 1]);
  assert.deepEqual(cat.instancesOf('femur', 'left'), [0]);
  assert.deepEqual(cat.instancesOf('lower-limb'), [0, 1, 4, 5]);
  assert.deepEqual(cat.instancesOf('lower-limb', 'right'), [1, 5]);
  assert.deepEqual(cat.instancesOf('unknown'), []);
});

test('catalog: tree roots are the root structure then the unattached bucket', () => {
  assert.deepEqual(cat.roots, ['human-body', UNATTACHED]);
  assert.deepEqual(cat.childrenOf(UNATTACHED), ['skin']);
  assert.deepEqual(cat.childrenOf('human-body'), ['heart', 'lower-limb']);
  assert.equal(cat.parentOf('skin'), UNATTACHED);
  assert.equal(cat.parentOf('femur'), 'lower-limb');
  assert.deepEqual(cat.ancestorsOf('femur'), ['human-body', 'lower-limb']);
});

test('catalog: kinds with instances, sorted, and the deepest layer', () => {
  assert.deepEqual(cat.kinds, ['bone', 'muscle', 'organ', 'skin']);
  assert.equal(cat.maxLayer, 5);
});

const base = { hiddenKinds: new Set<string>(), layerCut: 0, ghost: false, selected: new Set<number>() };
const femurL = cat.instance(0), skin = cat.instance(3), muscleL = cat.instance(4);

test('appearance: visible and opaque by default', () => {
  assert.deepEqual(appearance(base, skin), { visible: true, alpha: 1, highlighted: false });
});

test('appearance: a hidden kind hides its instances, even in ghost mode', () => {
  assert.equal(appearance({ ...base, hiddenKinds: new Set(['skin']), ghost: true }, skin).visible, false);
});

test('appearance: the dissection cut removes layers shallower than the cut', () => {
  const s = { ...base, layerCut: 3 };
  assert.equal(appearance(s, skin).visible, false);
  assert.equal(appearance(s, muscleL).visible, false);
  assert.deepEqual(appearance(s, femurL), { visible: true, alpha: 1, highlighted: false });
});

test('appearance: ghost mode keeps removed layers at alpha 0.15', () => {
  assert.deepEqual(appearance({ ...base, layerCut: 3, ghost: true }, skin), { visible: true, alpha: 0.15, highlighted: false });
});

test('appearance: a selected instance is always visible, opaque and highlighted', () => {
  const s = { ...base, layerCut: 5, hiddenKinds: new Set(['muscle']), selected: new Set([4]) };
  assert.deepEqual(appearance(s, muscleL), { visible: true, alpha: 1, highlighted: true });
});

test('appearance: a tissue crossing a moving joint is ghosted; selected, it is a highlighted ghost; hidden, it stays hidden', () => {
  const s = { ...base, crossing: new Set([4]) };
  assert.deepEqual(appearance(s, muscleL), { visible: true, alpha: 0.15, highlighted: false });
  assert.deepEqual(appearance({ ...s, selected: new Set([4]) }, muscleL), { visible: true, alpha: 0.15, highlighted: true });
  assert.equal(appearance({ ...s, hiddenKinds: new Set(['muscle']) }, muscleL).visible, false);
  assert.deepEqual(appearance(s, femurL), { visible: true, alpha: 1, highlighted: false });
});

test('catalog: each instance knows its systems; the systems present come in vocabulary order', () => {
  assert.deepEqual(cat.instance(2).systems, ['cardiovascular', 'endocrine']);
  assert.deepEqual(cat.instance(3).systems, []); // the skin of the fixture has none
  assert.deepEqual(cat.systems, ['skeletal', 'muscular', 'cardiovascular', 'endocrine']);
});

test('appearance: an instance is hidden when all its systems are hidden; one shown keeps it; none: only its kind matters', () => {
  const heart = cat.instance(2);
  assert.equal(appearance({ ...base, hiddenSystems: new Set(['cardiovascular']) }, heart).visible, true);
  assert.equal(appearance({ ...base, hiddenSystems: new Set(['cardiovascular', 'endocrine']) }, heart).visible, false);
  assert.equal(appearance({ ...base, hiddenSystems: new Set(['cardiovascular', 'endocrine', 'skeletal', 'muscular']) }, skin).visible, true);
  // the selection stays visible
  assert.equal(appearance({ ...base, hiddenSystems: new Set(['skeletal']), selected: new Set([0]) }, femurL).visible, true);
});

test('appearance: a system-hidden instance is hidden even below the dissection cut in ghost mode', () => {
  assert.equal(appearance({ ...base, hiddenSystems: new Set(['muscular']), layerCut: 3, ghost: true }, muscleL).visible, false);
});

test('the app vocabulary of systems is the data schema vocabulary, in the same order', async () => {
  const { readFileSync } = await import('node:fs');
  const { SYSTEMS } = await import('../src/viewer/types.ts');
  const schema = JSON.parse(readFileSync(new URL('../../tools/atlas/schemas/structure.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual([...SYSTEMS], schema.properties.systems.items.enum);
});
