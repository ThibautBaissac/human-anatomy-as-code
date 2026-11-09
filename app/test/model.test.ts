import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../src/viewer/catalog.ts';
import { appearance } from '../src/viewer/appearance.ts';
import { decodeView, encodeView } from '../src/viewer/view-hash.ts';
import { DEFAULT_VIEW } from '../src/viewer/types.ts';
import { offlineStatus } from '../src/offline/offline-state.ts';
import { ATLAS } from './fixture.ts';

// The female atlas of the fixture: femur and heart shared, a female organ; the male bladder instance is in a shared file.
const FEMALE = {
  ...ATLAS,
  meshIndex: { 'bp3d:FJ1': { slug: 'femur', side: 'right' }, 'bp3d:FJ1M': { slug: 'femur', side: 'left' }, 'hra:uterus-female/VH_F_uterus': { slug: 'heart', side: null } },
} as typeof ATLAS;
const INSTANCES = [
  { name: 'femur@left', meshes: ['bp3d:FJ1M'] },
  { name: 'femur@right', meshes: ['bp3d:FJ1'] },
  { name: 'heart', meshes: ['bp3d:FJ2'] }, // male geometry, not in the female mesh index
  { name: 'heart', meshes: ['hra:uterus-female/VH_F_uterus'] },
];

test('catalog: an instance whose meshes are not in the model mesh index is not in the model', () => {
  const cat = buildCatalog(FEMALE, INSTANCES);
  assert.equal(cat.instance(2).inModel, false);
  assert.equal(cat.instance(3).inModel, true);
  assert.deepEqual(cat.instancesOf('heart'), [3]);
  assert.deepEqual(cat.kinds, ['bone', 'organ']);
});

test('catalog: plain instance names (no meshes known) are in the model', () => {
  assert.equal(buildCatalog(ATLAS, ['femur@left']).instance(0).inModel, true);
});

test('appearance: an instance outside the model is never shown, even selected', () => {
  const s = { hiddenKinds: new Set<string>(), layerCut: 0, ghost: false, selected: new Set([2]) };
  assert.equal(appearance(s, { index: 2, kind: 'organ', layer: 4, inModel: false }).visible, false);
});

test('hash: sex=f selects the female model; absent or invalid means male', () => {
  assert.equal(encodeView({ ...DEFAULT_VIEW, model: 'female' }), 'sex=f');
  assert.equal(encodeView(DEFAULT_VIEW), '');
  const ctx = { hasSlug: () => true, kinds: [], maxLayer: 5 };
  assert.equal(decodeView('sex=f', ctx).model, 'female');
  assert.equal(decodeView('sex=x', ctx).model, undefined);
});

test('offlineStatus for one model counts only that model files and its atlas', () => {
  const manifest = {
    kinds: { bone: { file: 'bone.a.glb', bytes: 100 }, skin: { file: 'skin.b.glb', bytes: 50 }, 'female-organ': { file: 'female-organ.c.glb', bytes: 30 } },
    models: { male: { kinds: ['bone', 'skin'], totalBytes: 150 }, female: { kinds: ['bone', 'female-organ'], totalBytes: 130 } },
    totalBytes: 180,
  };
  const s = offlineStatus(manifest, ['/assets/bone.a.glb', '/assets/female-organ.c.glb', '/atlas-female.json', '/assets/manifest.json'], false, ['female']);
  assert.equal(s.state, 'complete');
  assert.equal(s.totalBytes, 130);
  const both = offlineStatus(manifest, ['/assets/bone.a.glb', '/assets/female-organ.c.glb', '/atlas-female.json', '/assets/manifest.json'], false, ['male', 'female']);
  assert.equal(both.state, 'partial');
  assert.deepEqual(both.missing, ['/assets/skin.b.glb', '/atlas-male.json']);
  assert.equal(both.totalBytes, 180);
});
