import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAtlas } from '../src/compile-atlas.ts';
import { coverage, coverageMarkdown } from '../src/coverage.ts';
import { validDataset, validStructures } from './helpers.ts';

test('coverage counts, per kind, structures, labels present and labels lacking gender', () => {
  const rows = coverage(compileAtlas(validDataset()).atlas!);
  const byKind = Object.fromEntries(rows.map((r) => [r.kind, r]));
  // organ: heart (fr m, la n) + spleen (fr f, la m)
  // no system set in the fixture: both organs with meshes count as "no system"
  assert.deepEqual(byKind.organ, { kind: 'organ', structures: 2, withMeshes: 2, fr: 2, la: 2, frNoGender: 0, laNoGender: 0, noSystem: 2 });
  // muscle: biceps-brachii has fr, no la
  assert.deepEqual(byKind.muscle, { kind: 'muscle', structures: 1, withMeshes: 1, fr: 1, la: 0, frNoGender: 0, laNoGender: 0, noSystem: 1 });
  assert.equal(byKind.group.withMeshes, 0);
  assert.equal(rows.at(-1)!.kind, 'total');
  assert.equal(rows.at(-1)!.structures, 5);
});

test('the markdown table has one row per kind plus the total, sorted by structure count', () => {
  const md = coverageMarkdown(coverage(compileAtlas(validDataset()).atlas!));
  const lines = md.trim().split('\n');
  assert.match(lines[0], /^\| kind \| structures \|.*\| sans système \|$/);
  assert.match(lines.at(-1)!, /^\| \*\*total\*\* \| 5 \|/);
  assert.equal(lines.length, 2 + 4 + 1);
});

test('a structure with a system no longer counts as "no system"', async () => {
  const heart = validStructures()['structures/organ/heart.yaml'];
  const rows = coverage(compileAtlas(validDataset({ 'structures/organ/heart.yaml': { ...heart, systems: ['cardiovascular'] } })).atlas!);
  assert.equal(rows.find((r) => r.kind === 'organ')!.noSystem, 1);
});
