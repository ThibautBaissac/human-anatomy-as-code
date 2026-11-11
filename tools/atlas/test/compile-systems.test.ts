import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAtlas, type Diagnostic } from '../src/compile-atlas.ts';
import { validDataset, validStructures } from './helpers.ts';

const HEART = 'structures/organ/heart.yaml';
const heart = (systems: unknown) => ({ [HEART]: { ...validStructures()[HEART], systems } });
const pick = (d: Diagnostic) => ({ file: d.file, pointer: d.pointer, rule: d.rule });

test('systems are compiled in vocabulary order, in both models', () => {
  const { atlases, errors } = compileAtlas(validDataset(heart(['endocrine', 'cardiovascular'])));
  assert.deepEqual(errors, []);
  for (const m of ['male', 'female'] as const) {
    assert.deepEqual((atlases![m].structures.find((s) => s.slug === 'heart') as { systems?: string[] }).systems, ['cardiovascular', 'endocrine']);
  }
});

test('an unknown system is a schema error at its pointer', () => {
  const { atlas, errors } = compileAtlas(validDataset(heart(['cardiovascular', 'circulatory'])));
  assert.equal(atlas, null);
  assert.deepEqual(errors.map(pick), [{ file: HEART, pointer: '/systems/1', rule: 'schema' }]);
});

test('the real data: every structure that owns a mesh has a system (the system filter could never hide it)', () => {
  const { atlases, errors } = compileAtlas(new URL('../../../data', import.meta.url).pathname);
  assert.deepEqual(errors, []);
  for (const atlas of Object.values(atlases!)) {
    const owners = new Set(Object.values(atlas.meshIndex).map((m) => m.slug));
    const without = atlas.structures.filter((s) => owners.has(s.slug) && !(s as { systems?: string[] }).systems?.length).map((s) => s.slug);
    assert.deepEqual(without, []);
  }
});
