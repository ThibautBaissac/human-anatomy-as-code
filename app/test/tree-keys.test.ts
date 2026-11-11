import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterTree, flattenTree, sortedTree, treeKeyReducer, type TreeState } from '../src/ui/tree-model.ts';
import { normalize } from '../src/viewer/search.ts';
import { buildCatalog, UNATTACHED } from '../src/viewer/catalog.ts';
import { ATLAS, INSTANCES } from './fixture.ts';

const cat = buildCatalog(ATLAS, INSTANCES);
const st = (focused: string, expanded: string[] = []): TreeState => ({ focused, expanded: new Set(expanded) });
const key = (s: TreeState, k: string) => treeKeyReducer(cat, s, k);

test('flattenTree lists visible rows with level, position and set size', () => {
  const rows = flattenTree(cat, new Set(['human-body']));
  assert.deepEqual(rows.map((r) => [r.id, r.level, r.posinset, r.setsize, r.expandable, r.expanded]), [
    ['human-body', 1, 1, 2, true, true],
    ['heart', 2, 1, 2, false, false],
    ['lower-limb', 2, 2, 2, true, false],
    [UNATTACHED, 1, 2, 2, true, false],
  ]);
});

test('ArrowDown / ArrowUp move through visible rows and stop at the ends', () => {
  assert.equal(key(st('human-body', ['human-body']), 'ArrowDown').focused, 'heart');
  assert.equal(key(st('heart', ['human-body']), 'ArrowUp').focused, 'human-body');
  assert.equal(key(st('human-body'), 'ArrowUp').focused, 'human-body');
  assert.equal(key(st(UNATTACHED), 'ArrowDown').focused, UNATTACHED);
});

test('ArrowRight expands a closed node, then enters its first child; does nothing on a leaf', () => {
  const opened = key(st('lower-limb', ['human-body']), 'ArrowRight');
  assert.deepEqual([...opened.expanded].sort(), ['human-body', 'lower-limb']);
  assert.equal(opened.focused, 'lower-limb');
  assert.equal(key(opened, 'ArrowRight').focused, 'femur');
  assert.deepEqual(key(st('heart', ['human-body']), 'ArrowRight'), st('heart', ['human-body']));
});

test('ArrowLeft collapses an open node, else moves to the parent', () => {
  const closed = key(st('lower-limb', ['human-body', 'lower-limb']), 'ArrowLeft');
  assert.deepEqual([...closed.expanded], ['human-body']);
  assert.equal(key(st('femur', ['human-body', 'lower-limb']), 'ArrowLeft').focused, 'lower-limb');
  assert.equal(key(st('human-body'), 'ArrowLeft').focused, 'human-body');
});

test('Home / End jump to the first and last visible rows; Enter selects the focused row', () => {
  assert.equal(key(st('heart', ['human-body']), 'Home').focused, 'human-body');
  assert.equal(key(st('heart', ['human-body']), 'End').focused, UNATTACHED);
  assert.equal(key(st('heart', ['human-body']), 'Enter').selected, 'heart');
  assert.equal(key(st('heart', ['human-body']), ' ').selected, 'heart');
});

test('unknown keys leave the state unchanged', () => {
  const s = st('heart', ['human-body']);
  assert.deepEqual(key(s, 'x'), s);
});

test('sortedTree orders children by the name shown, in the language collation', () => {
  const names: Record<string, string> = { heart: 'Zeta', 'lower-limb': 'alpha' };
  const t = sortedTree(cat, (id) => names[id] ?? id, 'fr');
  assert.deepEqual(t.childrenOf('human-body'), ['lower-limb', 'heart']);
  assert.deepEqual(t.roots, cat.roots);
});

test('filterTree keeps the matches and their ancestors, opened; ignores accents and case; none under two characters', () => {
  const names: Record<string, string> = { femur: 'Fémur', heart: 'cœur', 'lower-limb': 'membre inférieur', 'human-body': 'corps humain' };
  const name = (id: string) => names[id] ?? id;
  const f = filterTree(cat, name, 'FEMU', normalize)!;
  assert.equal(f.matches, 1);
  assert.deepEqual(f.tree.roots, ['human-body']);
  assert.deepEqual(f.tree.childrenOf('human-body'), ['lower-limb']);
  assert.ok(f.tree.childrenOf('lower-limb').includes('femur'));
  assert.ok(f.expanded.has('human-body') && f.expanded.has('lower-limb'));
  assert.equal(filterTree(cat, name, 'f', normalize), null);
  assert.equal(filterTree(cat, name, 'zzz', normalize)!.tree.roots.length, 0);
});
