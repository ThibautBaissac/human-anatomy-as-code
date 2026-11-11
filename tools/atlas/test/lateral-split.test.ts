import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planStructures, type Overrides } from '../src/import/plan.ts';
import { applyPlan } from '../src/import/apply-plan.ts';
import { compileAtlas } from '../src/compile-atlas.ts';
import type { Bp3d } from '../src/import/bp3d.ts';
import { sources, writeDataset } from './helpers.ts';

// One concept per case, under the human body; x extents per mesh (subject's left = +x).
const CONCEPTS: [string, string, Record<string, [number, number]>][] = [
  ['FMA2', 'set of plantar digital veins', { FJ1: [-100, -90], FJ1M: [90, 100] }], // both feet, nothing near the plane
  ['FMA3', 'external anal sphincter', { FJ2: [-20, -3], FJ2M: [3, 20] }], // two halves of a ring
  ['FMA4', 'ileum', { FJ3: [-100, -90], FJ4: [-1, 30] }], // one mesh near the plane
  ['FMA5', 'spleen', { FJ5: [40, 120] }], // wholly left
];
function bp3d(): Bp3d {
  const all = CONCEPTS.flatMap(([, , m]) => Object.keys(m));
  return {
    names: new Map([['FMA1', 'human body'], ...CONCEPTS.map(([c, n]) => [c, n] as [string, string])]),
    elements: new Map([['FMA1', new Set(all)], ...CONCEPTS.map(([c, , m]) => [c, new Set(Object.keys(m))] as [string, Set<string>])]),
    partof: new Set(['FMA1', ...CONCEPTS.map(([c]) => c)]),
    partofParent: new Map(CONCEPTS.map(([c]) => [c, 'FMA1'])),
    isaParents: new Map(), isaHasChildren: new Set(),
    extents: new Map(CONCEPTS.flatMap(([, , m]) => Object.entries(m))),
  };
}
const WD = { byFma: new Map(), byUberon: new Map(), byEn: new Map(), byQid: new Map() };
const plan = (o: Overrides = {}) => Object.fromEntries(planStructures(bp3d(), WD, o).structures.map((s) => [s.slug, s]));

test('a concept whose meshes lie clear of the median plane, some on each side, becomes bilateral with its meshes per side', () => {
  const s = plan()['set-of-plantar-digital-veins'];
  assert.equal(s.laterality, 'bilateral');
  assert.equal(s.meshes, undefined);
  assert.deepEqual(s.sides, { left: { meshes: ['bp3d:FJ1M'] }, right: { meshes: ['bp3d:FJ1'] } });
});

test('a mesh near the plane, a single side, or a laterality override keeps the concept whole', () => {
  const p = plan({ laterality: { 'external-anal-sphincter': 'midline' } });
  assert.deepEqual([p.ileum.laterality, p.ileum.meshes], ['midline', ['bp3d:FJ3', 'bp3d:FJ4']]);
  assert.deepEqual([p.spleen.laterality, p.spleen.meshes], ['unpaired-left', ['bp3d:FJ5']]);
  const sphincter = p['external-anal-sphincter'];
  assert.deepEqual([sphincter.laterality, sphincter.meshes, sphincter.sides], ['midline', ['bp3d:FJ2', 'bp3d:FJ2M'], undefined]);
  assert.equal(plan()['external-anal-sphincter'].laterality, 'bilateral');
});

test('re-import: an existing midline draft is reshaped into two sides and still compiles', () => {
  const dataDir = writeDataset({
    ...sources,
    'structures/vein/set-of-plantar-digital-veins.yaml': { slug: 'set-of-plantar-digital-veins', kind: 'vein', laterality: 'midline', status: 'draft', parent: 'human-body',
      labels: { en: { text: 'set of plantar digital veins', source: 'fma', status: 'draft' } }, meshes: ['bp3d:FJ1', 'bp3d:FJ1M'] },
  });
  const r = applyPlan({ dataDir, structures: planStructures(bp3d(), WD, {}).structures, owns: () => true });
  assert.equal(r.updated, 1);
  const { atlas, errors } = compileAtlas(dataDir);
  assert.deepEqual(errors, []);
  const veins = atlas!.structures.find((s) => s.slug === 'set-of-plantar-digital-veins')!;
  assert.deepEqual([veins.sides!.left.meshes, veins.sides!.right.meshes, veins.meshes], [['bp3d:FJ1M'], ['bp3d:FJ1'], undefined]);
  assert.deepEqual(atlas!.meshIndex['bp3d:FJ1'], { slug: 'set-of-plantar-digital-veins', side: 'right' });
  assert.doesNotMatch(readFileSync(join(dataDir, 'structures/vein/set-of-plantar-digital-veins.yaml'), 'utf8'), /^meshes:/m);
});
