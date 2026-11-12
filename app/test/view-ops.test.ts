import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../src/viewer/catalog.ts';
import { hideSelection, isSkeletonOnly, keepKnown, setHidden, skeletonOnly, undoHide } from '../src/viewer/view-ops.ts';
import { DEFAULT_VIEW } from '../src/viewer/types.ts';
import { ATLAS, INSTANCES } from './fixture.ts';

const femurL = { slug: 'femur', side: 'left' as const };

test('hiding the selection appends its key, clears the selection, keeps an isolation of something else', () => {
  const v = { ...DEFAULT_VIEW, selection: femurL, hidden: ['heart'], isolated: { slug: 'heart', side: null } };
  assert.deepEqual(hideSelection(v), { hidden: ['heart', 'femur@left'], selection: null, isolated: { slug: 'heart', side: null } });
});

test('hiding the isolated structure ends the isolation; hiding twice does not duplicate the key', () => {
  const v = { ...DEFAULT_VIEW, selection: femurL, hidden: ['femur@left', 'heart'], isolated: femurL };
  assert.deepEqual(hideSelection(v), { hidden: ['heart', 'femur@left'], selection: null, isolated: null });
  assert.deepEqual(hideSelection({ ...DEFAULT_VIEW }), {});
});

test('undo shows the last hidden structure again', () => {
  assert.deepEqual(undoHide({ ...DEFAULT_VIEW, hidden: ['heart', 'femur@left'] }), { hidden: ['heart'] });
  assert.deepEqual(undoHide({ ...DEFAULT_VIEW }), {});
});

test('after a model switch, isolation and hidden keys without instances in the model are dropped', () => {
  // the catalog of a model without the heart instance
  const cat = buildCatalog(ATLAS, INSTANCES.filter((n) => n !== 'heart'));
  const v = { ...DEFAULT_VIEW, isolated: { slug: 'heart', side: null }, hidden: ['heart', 'femur@left', 'nope'] };
  assert.deepEqual(keepKnown(v, cat), { isolated: null, hidden: ['femur@left'] });
  assert.deepEqual(keepKnown({ ...DEFAULT_VIEW, isolated: femurL, hidden: ['femur@left'] }, cat), {});
});

test('setHidden from the tree: hides last, clears a matching selection or isolation; showing removes the key anywhere', () => {
  const v = { ...DEFAULT_VIEW, hidden: ['heart', 'skin'], selection: { slug: 'femur', side: null }, isolated: { slug: 'femur', side: null } };
  assert.deepEqual(setHidden(v, 'femur', true), { hidden: ['heart', 'skin', 'femur'], selection: null, isolated: null });
  assert.deepEqual(setHidden(v, 'heart', true), { hidden: ['skin', 'heart'] });
  assert.deepEqual(setHidden(v, 'heart', false), { hidden: ['skin'] });
  assert.deepEqual(setHidden(v, 'femur', false), {});
});

test('Tout masquer: every system of the model but the skeleton hidden, bones shown again', () => {
  const systems = ['skeletal', 'muscular', 'nervous'];
  const v = { ...DEFAULT_VIEW, hiddenSystems: ['skeletal'], hiddenKinds: ['bone', 'skin'] };
  assert.deepEqual(skeletonOnly(v, systems), { hiddenSystems: ['muscular', 'nervous'], hiddenKinds: ['skin'] });
  assert.equal(isSkeletonOnly(v, systems), false);
  assert.equal(isSkeletonOnly({ ...v, ...skeletonOnly(v, systems) }, systems), true);
  assert.equal(isSkeletonOnly({ ...DEFAULT_VIEW, hiddenSystems: [] }, systems), false);
});

test('hiding the network origin ends the network; hiding another structure keeps it', () => {
  const origin = { slug: 'femur', side: 'left' as const };
  const v = { ...DEFAULT_VIEW, selection: origin, network: origin, hidden: [] };
  assert.deepEqual(hideSelection(v), { hidden: ['femur@left'], selection: null, isolated: null, network: null });
  assert.deepEqual(hideSelection({ ...v, selection: { slug: 'heart', side: null } }), { hidden: ['heart'], selection: null, isolated: null });
  assert.deepEqual(setHidden(v, 'femur@left', true), { hidden: ['femur@left'], selection: null, network: null });
  assert.deepEqual(setHidden(v, 'heart', true), { hidden: ['heart'] });
});

test('after a model switch, a network whose origin has no instance in the model is dropped', () => {
  const cat = buildCatalog(ATLAS, ['femur@left', 'heart']);
  assert.deepEqual(keepKnown({ ...DEFAULT_VIEW, network: { slug: 'femur', side: 'right' } }, cat), { network: null });
  assert.deepEqual(keepKnown({ ...DEFAULT_VIEW, network: { slug: 'femur', side: 'left' } }, cat), {});
});
