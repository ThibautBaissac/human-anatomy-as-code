import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCatalog } from '../src/viewer/catalog.ts';
import { NETWORK_KINDS, networkOf, type RelationGraph } from '../src/viewer/relations.ts';
import type { Atlas, AtlasStructure } from '../src/viewer/types.ts';
import { RELATIONS_ATLAS, RELATIONS_INSTANCES } from './fixture.ts';

const catalog = buildCatalog(RELATIONS_ATLAS, RELATIONS_INSTANCES);
const item = (o: object) => ({ type: 'branch-of', direction: 'forward', side: null, mark: null, presence: 'present', status: 'draft', ...o });

test('relationsOf keeps the side of a bilateral to bilateral relation', () => {
  assert.deepEqual(catalog.relationsOf({ slug: 'popliteal-artery', side: 'left' }), [item({ ref: 'femoral-artery', side: 'left' })]);
});

test('relationsOf of a whole structure gives forward then inverse, sides null', () => {
  assert.deepEqual(catalog.relationsOf({ slug: 'renal-artery', side: null }), [
    item({ ref: 'abdominal-aorta' }),
    item({ type: 'arterial-supply', direction: 'inverse', ref: 'kidney' }),
  ]);
});

test('a side-level relation holds only on its side', () => {
  assert.deepEqual(catalog.relationsOf({ slug: 'gonadal-vein', side: 'left' }), [item({ type: 'tributary-of', ref: 'renal-vein', side: 'left' })]);
});

test('side-level relations are marked while the selection has no side', () => {
  assert.deepEqual(catalog.relationsOf({ slug: 'gonadal-vein', side: null }), [
    item({ type: 'tributary-of', ref: 'renal-vein', side: 'left', mark: 'left' }),
    item({ type: 'tributary-of', ref: 'inferior-vena-cava', side: null, mark: 'right' }),
  ]);
});

test('inverse side-level relation of a midline structure', () => {
  assert.deepEqual(catalog.relationsOf({ slug: 'inferior-vena-cava', side: null }), [
    item({ type: 'tributary-of', direction: 'inverse', ref: 'renal-vein' }),
    item({ type: 'tributary-of', direction: 'inverse', ref: 'gonadal-vein', side: 'right', mark: 'right' }),
  ]);
});

test('an external target is listed with its labels', () => {
  assert.deepEqual(catalog.relationsOf({ slug: 'thigh-muscle', side: 'left' }), [item({ type: 'innervation', ref: 'wikidata:Q500', presence: 'external' })]);
  assert.equal(catalog.labelsOf('wikidata:Q500')?.fr?.text, 'nerf tibial');
});

test('an outside structure is listed with its labels', () => {
  const items = catalog.relationsOf({ slug: 'femoral-artery', side: null });
  assert.deepEqual(items.find((i) => i.ref === 'ovary'), item({ type: 'arterial-supply', direction: 'inverse', ref: 'ovary', presence: 'outside', status: 'reviewed' }));
  assert.equal(catalog.labelsOf('ovary')?.fr?.text, 'ovaire');
  assert.equal(catalog.labelsOf('femoral-artery')?.en?.text, 'femoral artery');
  assert.equal(catalog.labelsOf('nope'), undefined);
});

test('network of a branch chain keeps the side', () => {
  assert.deepEqual(catalog.network({ slug: 'femoral-artery', side: 'left' }), ['femoral-artery@left', 'popliteal-artery@left']);
});

test('network of the aorta walks its parts, both sides of branches and the supplied organ', () => {
  assert.deepEqual(catalog.network({ slug: 'aorta', side: null }), ['abdominal-aorta', 'aorta', 'kidney', 'renal-artery']);
});

test('network of one side of a branch reaches the supplied organ on that side', () => {
  assert.deepEqual(catalog.network({ slug: 'renal-artery', side: 'right' }), ['kidney@right', 'renal-artery@right']);
});

test('network of the vena cava: right gonadal directly, left through the left renal vein', () => {
  assert.deepEqual(catalog.network({ slug: 'inferior-vena-cava', side: null }), ['gonadal-vein@left', 'gonadal-vein@right', 'inferior-vena-cava', 'renal-vein']);
});

test('a side-level relation of the other side does not hold', () => {
  assert.deepEqual(catalog.network({ slug: 'renal-vein', side: 'right' }), ['renal-vein@right']);
});

test('an organ has no network', () => {
  assert.deepEqual(catalog.network({ slug: 'kidney', side: null }), ['kidney']);
});

test('network of the aorta of the compiled atlas takes under 50 ms', (t) => {
  const file = new URL('../../build/atlas-male.json', import.meta.url);
  if (!existsSync(file)) return t.skip('build/atlas-male.json absent');
  const atlas = JSON.parse(readFileSync(file, 'utf8')) as Atlas;
  const names = atlas.structures.flatMap((s) => (s.sides ? [`${s.slug}@left`, `${s.slug}@right`] : [s.slug]));
  const c = buildCatalog(atlas, names);
  const times: number[] = [];
  for (let i = 0; i < 5; i++) { const t0 = performance.now(); c.network({ slug: 'aorta', side: null }); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  assert.ok(times[2] < 50, `median ${times[2]} ms`);
});

test('networks are for arteries, veins and nerves only: lymphatics are out of scope', () => {
  assert.deepEqual([...NETWORK_KINDS], ['artery', 'vein', 'nerve']);
  const st = (slug: string, kind: string, inverse: AtlasStructure['inverse'] = []): AtlasStructure =>
    ({ slug, kind, laterality: 'midline', status: 'draft', layer: null, children: [], labels: {}, inverse });
  const all = new Map([
    ['thoracic-duct', st('thoracic-duct', 'lymphatic', [{ type: 'branch-of', subject: 'lymph-trunk', source: 'curated', status: 'draft' }])],
    ['lymph-trunk', st('lymph-trunk', 'lymphatic')],
  ]);
  const graph: RelationGraph = { structure: (s) => all.get(s), childrenOf: () => [], isOutside: () => false, isExternal: () => false };
  assert.deepEqual(networkOf(graph, { slug: 'thoracic-duct', side: null }), ['thoracic-duct']);
});
