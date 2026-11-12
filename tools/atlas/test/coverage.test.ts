import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAtlas } from '../src/compile-atlas.ts';
import { coverage, coverageMarkdown } from '../src/coverage.ts';
import { validDataset, validStructures, relationsFixture, writeDataset } from './helpers.ts';

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
  const lines = md.split('\n## Relations')[0].trim().split('\n'); // the kind table, before the Relations section
  assert.match(lines[0], /^\| kind \| structures \|.*\| sans système \|$/);
  assert.match(lines.at(-1)!, /^\| \*\*total\*\* \| 5 \|/);
  assert.equal(lines.length, 2 + 4 + 1);
});

test('a structure with a system no longer counts as "no system"', async () => {
  const heart = validStructures()['structures/organ/heart.yaml'];
  const rows = coverage(compileAtlas(validDataset({ 'structures/organ/heart.yaml': { ...heart, systems: ['cardiovascular'] } })).atlas!);
  assert.equal(rows.find((r) => r.kind === 'organ')!.noSystem, 1);
});

const relationsAtlas = () => compileAtlas(writeDataset(relationsFixture())).atlas!;
const registry = { Q1: { labels: { en: { text: 'tibial nerve', source: 'fma', status: 'draft' as const } }, source: 'wikidata', status: 'draft' as const } };

test('relations are counted by type, source and status', () => {
  const { relations } = coverage(relationsAtlas(), registry);
  assert.equal(relations.byType['branch-of'].total, 1);
  assert.equal(relations.byType['branch-of'].bySource.fma, 1);
  assert.equal(relations.byType['branch-of'].byStatus.draft, 1);
  assert.equal(relations.byType['tributary-of'].total, 3);
  assert.equal(relations.byType['innervation'].bySource.wikidata, 1);
});

test('structures lacking the relation of their kind are counted once each', () => {
  const { missing } = coverage(relationsAtlas(), registry).relations;
  assert.deepEqual(missing, { arteriesWithoutBranchOf: 1, veinsWithoutTributaryOf: 1, musclesWithoutInnervation: 0 });
});

test('registry entries no relation points to are listed; used externals are counted', () => {
  const r = coverage(relationsAtlas(), { ...registry, Q2: registry.Q1 }).relations;
  assert.deepEqual(r.registryUnused, ['Q2']);
  assert.equal(r.externalsUsed, 1);
});

test('the markdown has a Relations section with one row per type', () => {
  const md = coverageMarkdown(coverage(relationsAtlas(), registry));
  assert.ok(md.includes('## Relations'));
  assert.ok(md.split('\n').some((l) => l.startsWith('| branch-of | 1 |')));
});
