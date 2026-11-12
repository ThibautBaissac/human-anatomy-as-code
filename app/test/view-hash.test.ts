import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeView, encodeView } from '../src/viewer/view-hash.ts';
import { DEFAULT_VIEW, SYSTEMS, type ViewState } from '../src/viewer/types.ts';

const ctx = { hasSlug: (s: string) => ['femur', 'heart'].includes(s), kinds: ['bone', 'muscle', 'skin'], maxLayer: 5 };

test('the default view encodes to an empty string', () => {
  assert.equal(encodeView(DEFAULT_VIEW), '');
});

test('every parameter round-trips', () => {
  const v: ViewState = {
    selection: { slug: 'femur', side: 'left' }, layerCut: 2, ghost: true, hiddenKinds: ['muscle', 'skin'],
    sections: { axial: 0.625, sagittal: 0.5 }, lang: 'la',
    camera: { position: [100, -900, 1200], target: [0, 0, 1000] }, model: 'female', pose: {}, hiddenSystems: DEFAULT_VIEW.hiddenSystems, isolated: null, network: null, hidden: [],
  };
  const hash = encodeView(v);
  assert.equal(hash, 'sex=f&sel=femur@left&layer=2&ghost=1&hide=muscle,skin&cut=axial:0.625,sagittal:0.500&lang=la&cam=100,-900,1200,0,0,1000');
  // the empty pose and the default hidden systems are defaults: not written, not read back
  const { pose: _, hiddenSystems: __, isolated: ___, hidden: ____, network: _____, ...encoded } = v;
  assert.deepEqual(decodeView(hash, ctx), encoded);
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

test('viewFromHash: absent parameters fall back to defaults, the camera is kept when absent', async () => {
  const { viewFromHash } = await import('../src/viewer/view-hash.ts');
  const current: ViewState = { ...DEFAULT_VIEW, selection: { slug: 'heart', side: null }, layerCut: 3, sections: { axial: 0.4 }, lang: 'la',
    camera: { position: [1, 2, 3], target: [4, 5, 6] } };
  assert.deepEqual(viewFromHash({ ghost: true }, current), { ...DEFAULT_VIEW, ghost: true, camera: current.camera });
  const cam = { position: [9, 9, 9] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
  assert.deepEqual(viewFromHash({ camera: cam }, current).camera, cam);
});

test('a side on a structure that has no sides is ignored', () => {
  const withSides = { ...ctx, hasSides: (s: string) => s === 'femur' };
  assert.equal(decodeView('sel=heart@left', withSides).selection, undefined);
  assert.deepEqual(decodeView('sel=femur@right', withSides).selection, { slug: 'femur', side: 'right' });
});

test('hidden systems round-trip as sys=; unknown ones are dropped', () => {
  const withSystems = { ...ctx, systems: ['skeletal', 'muscular', 'digestive'] };
  const hash = encodeView({ ...DEFAULT_VIEW, hiddenSystems: ['muscular', 'digestive'] });
  assert.equal(hash, 'sys=digestive,muscular');
  assert.deepEqual(decodeView(hash, withSystems).hiddenSystems, ['digestive', 'muscular']);
  assert.deepEqual(decodeView('sys=digestive,wat', withSystems).hiddenSystems, ['digestive']);
  assert.equal(decodeView('sys=wat', withSystems).hiddenSystems, undefined);
});

test('by default only the skeleton shows; every system shown is written sys=none', () => {
  assert.deepEqual(DEFAULT_VIEW.hiddenSystems, SYSTEMS.filter((x) => x !== 'skeletal'));
  assert.equal(encodeView({ ...DEFAULT_VIEW, hiddenSystems: [...DEFAULT_VIEW.hiddenSystems].reverse() }), '');
  assert.equal(encodeView({ ...DEFAULT_VIEW, hiddenSystems: [] }), 'sys=none');
  assert.deepEqual(decodeView('sys=none', { ...ctx, systems: [...SYSTEMS] }).hiddenSystems, []);
  assert.equal(decodeView('', { ...ctx, systems: [...SYSTEMS] }).hiddenSystems, undefined);
});

test('isolation and hidden structures round-trip; hid= keeps the hiding order', () => {
  const v: ViewState = { ...DEFAULT_VIEW, isolated: { slug: 'femur', side: 'left' }, hidden: ['heart', 'femur@right'] };
  const hash = encodeView(v);
  assert.equal(hash, 'iso=femur@left&hid=heart,femur@right');
  const sided = { ...ctx, hasSides: (s: string) => s === 'femur' };
  assert.deepEqual(decodeView(hash, sided), { isolated: { slug: 'femur', side: 'left' }, hidden: ['heart', 'femur@right'] });
  assert.deepEqual(decodeView('iso=heart', sided), { isolated: { slug: 'heart', side: null } });
});

test('unknown or invalid isolation and hidden keys are dropped one by one', () => {
  const sided = { ...ctx, hasSides: (s: string) => s === 'femur' };
  assert.deepEqual(decodeView('iso=nope&hid=nope,heart@left,femur@left,heart,heart', sided), { hidden: ['femur@left', 'heart'] });
  assert.deepEqual(decodeView('iso=femur@middle', sided), {});
});

test('the network round-trips as net=, written right after iso=', () => {
  const sided = { ...ctx, hasSlug: (s: string) => ['femur', 'heart', 'renal-artery'].includes(s), hasSides: (s: string) => s !== 'heart' };
  const v: ViewState = { ...DEFAULT_VIEW, network: { slug: 'renal-artery', side: 'left' }, hidden: ['heart'] };
  const hash = encodeView(v);
  assert.equal(hash, 'net=renal-artery@left&hid=heart');
  assert.deepEqual(decodeView(hash, sided), { network: { slug: 'renal-artery', side: 'left' }, hidden: ['heart'] });
  assert.equal(encodeView({ ...DEFAULT_VIEW, isolated: { slug: 'heart', side: null }, network: { slug: 'renal-artery', side: null } }), 'iso=heart&net=renal-artery');
});

test('iso= wins over net=', () => {
  assert.deepEqual(decodeView('iso=heart&net=femur', ctx), { isolated: { slug: 'heart', side: null } });
});

test('an unknown network origin, or a side on a structure without sides, is dropped', () => {
  const sided = { ...ctx, hasSides: (s: string) => s === 'femur' };
  assert.deepEqual(decodeView('net=no-such', sided), {});
  assert.deepEqual(decodeView('net=heart@left', sided), {});
  assert.deepEqual(decodeView('net=femur@left', sided), { network: { slug: 'femur', side: 'left' } });
});
