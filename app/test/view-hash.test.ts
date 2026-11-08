import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeView, encodeView } from '../src/viewer/view-hash.ts';
import { DEFAULT_VIEW, type ViewState } from '../src/viewer/types.ts';

const ctx = { hasSlug: (s: string) => ['femur', 'heart'].includes(s), kinds: ['bone', 'muscle', 'skin'], maxLayer: 5 };

test('the default view encodes to an empty string', () => {
  assert.equal(encodeView(DEFAULT_VIEW), '');
});

test('every parameter round-trips', () => {
  const v: ViewState = {
    selection: { slug: 'femur', side: 'left' }, layerCut: 2, ghost: true, hiddenKinds: ['muscle', 'skin'],
    sections: { axial: 0.625, sagittal: 0.5 }, lang: 'la',
    camera: { position: [100, -900, 1200], target: [0, 0, 1000] },
  };
  const hash = encodeView(v);
  assert.equal(hash, 'sel=femur@left&layer=2&ghost=1&hide=muscle,skin&cut=axial:0.625,sagittal:0.500&lang=la&cam=100,-900,1200,0,0,1000');
  assert.deepEqual(decodeView(hash, ctx), v);
});

test('decoding accepts a leading #, rounds the camera, and selection without side', () => {
  const v = decodeView('#sel=heart&cam=1.4,2.6,3,4,5,6', ctx);
  assert.deepEqual(v.selection, { slug: 'heart', side: null });
  assert.deepEqual(v.camera, { position: [1, 3, 3], target: [4, 5, 6] });
});

test('invalid values are ignored one by one, the rest still applies', () => {
  const v = decodeView('sel=nope&layer=9&ghost=yes&hide=bone,wat&cut=axial:2,coronal:0.3,oblique:0.5&lang=de&cam=1,2', ctx);
  assert.deepEqual(v, { hiddenKinds: ['bone'], sections: { coronal: 0.3 } });
});

test('a side other than left/right invalidates the selection', () => {
  assert.equal(decodeView('sel=femur@middle', ctx).selection, undefined);
});
