import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelPlacement, nextSheet, sheetHeights, snapSheet } from '../src/ui/layout.ts';

const viewport = { width: 1440, height: 900 };
const size = { width: 200, height: 30 };

test('the hover label sits 14 px right of and below the cursor', () => {
  assert.deepEqual(labelPlacement({ x: 500, y: 400 }, size, viewport), { left: 514, top: 414 });
});

test('the hover label flips left at the right edge and above at the bottom edge', () => {
  assert.deepEqual(labelPlacement({ x: 1300, y: 400 }, size, viewport), { left: 1086, top: 414 });
  assert.deepEqual(labelPlacement({ x: 500, y: 880 }, size, viewport), { left: 514, top: 836 });
  assert.deepEqual(labelPlacement({ x: 1430, y: 890 }, size, viewport), { left: 1216, top: 846 });
});

test('the hover label never leaves the window, even when larger than the room on either side', () => {
  const p = labelPlacement({ x: 100, y: 10 }, { width: 400, height: 30 }, { width: 300, height: 900 });
  assert.equal(p.left, 0);
});

test('sheet heights: folded 96 px, half the window, full minus the 56 px header', () => {
  assert.deepEqual(sheetHeights(844), { folded: 96, half: 422, full: 788 });
});

test('a dragged sheet snaps to the nearest height, and clamps beyond the ends', () => {
  const h = sheetHeights(844);
  assert.equal(snapSheet(100, h), 'folded');
  assert.equal(snapSheet(300, h), 'half');
  assert.equal(snapSheet(600, h), 'half');
  assert.equal(snapSheet(610, h), 'full');
  assert.equal(snapSheet(-50, h), 'folded');
  assert.equal(snapSheet(2000, h), 'full');
  assert.equal(snapSheet(259, h), 'folded');
  assert.equal(snapSheet(260, h), 'half');
});

test('the handle cycles folded → half → full → folded', () => {
  assert.equal(nextSheet('folded'), 'half');
  assert.equal(nextSheet('half'), 'full');
  assert.equal(nextSheet('full'), 'folded');
});
