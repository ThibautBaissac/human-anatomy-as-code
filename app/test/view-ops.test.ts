import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../src/viewer/catalog.ts';
import { hideSelection, keepKnown, undoHide } from '../src/viewer/view-ops.ts';
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
