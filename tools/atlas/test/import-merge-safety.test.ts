import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileAtlas } from '../src/compile-atlas.ts';
import { importBp3d } from '../src/import-bp3d.ts';
import { sources, writeDataset } from './helpers.ts';

const FIX = new URL('./fixtures/', import.meta.url).pathname;
const OVERRIDES = { noFold: ['atrium', 'ventricle', 'auricle', 'coronary artery'], ties: {}, slugs: {} };
const run = (dataDir: string, overrides: object = OVERRIDES) =>
  importBp3d({ bp3dDir: join(FIX, 'bp3d'), wikidataCsv: join(FIX, 'wikidata.csv'), dataDir, overrides });
const fresh = () => { const d = writeDataset({ ...sources }); run(d); return d; };
const read = (d: string, rel: string) => readFileSync(join(d, rel), 'utf8');
const write = (d: string, rel: string, text: string) => { mkdirSync(join(d, rel, '..'), { recursive: true }); writeFileSync(join(d, rel), text); };

test('an unreadable YAML file aborts the import before any write', () => {
  const d = fresh();
  const broken = read(d, 'structures/bone/femur.yaml') + '<<<<<<< HEAD\nslug: [\n';
  write(d, 'structures/bone/femur.yaml', broken);
  const heartBefore = read(d, 'structures/organ/heart.yaml');
  write(d, 'structures/organ/heart.yaml', heartBefore.replace('parent: thorax', 'parent: human-body'));
  const report = run(d);
  assert.equal(report.aborted, true);
  assert.deepEqual(report.unreadableFiles, ['structures/bone/femur.yaml']);
  assert.equal(read(d, 'structures/bone/femur.yaml'), broken);
  assert.match(read(d, 'structures/organ/heart.yaml'), /parent: human-body/, 'no other file is touched either');
});

test('duplicate slugs or aliases on disk abort the import', () => {
  const d = fresh();
  const femur = read(d, 'structures/bone/femur.yaml');
  write(d, 'structures/organ/femur.yaml', femur);
  const report = run(d);
  assert.equal(report.aborted, true);
  assert.deepEqual(report.duplicateSlugs, ['femur']);
  assert.equal(read(d, 'structures/organ/femur.yaml'), femur);
});

test('a file whose slug was edited is never overwritten by a new structure', () => {
  const d = fresh();
  const edited = read(d, 'structures/bone/femur.yaml').replace('slug: femur', 'slug: femur-x');
  write(d, 'structures/bone/femur.yaml', edited);
  const report = run(d);
  assert.equal(read(d, 'structures/bone/femur.yaml'), edited);
  assert.deepEqual(report.writeConflicts, [{ slug: 'femur', file: 'structures/bone/femur.yaml' }]);
});

test('a slug renamed with an alias keeps its file; parents follow the canonical slug', () => {
  const d = fresh();
  const text = read(d, 'structures/group/lower-limb.yaml').replace('slug: lower-limb', 'slug: membrum-inferius\naliases:\n  - lower-limb');
  rmSync(join(d, 'structures/group/lower-limb.yaml'));
  write(d, 'structures/group/membrum-inferius.yaml', text.replace(/^aliases:\n  - lower-limb\n/m, '').replace('status: draft', 'status: draft\naliases:\n  - lower-limb'));
  const report = run(d);
  assert.equal(report.created, 0);
  assert.equal(existsSync(join(d, 'structures/group/lower-limb.yaml')), false);
  const { atlas, errors } = compileAtlas(d);
  assert.deepEqual(errors, []);
  assert.equal(atlas!.structures.find((s) => s.slug === 'femur')!.parent, 'membrum-inferius');
});

test('two planned structures resolving to one file through an alias: the second is reported, not merged', () => {
  const d = fresh();
  rmSync(join(d, 'structures/artery/femoral-artery.yaml'));
  write(d, 'structures/bone/femur.yaml', read(d, 'structures/bone/femur.yaml').replace('status: draft', 'status: draft\naliases:\n  - femoral-artery'));
  const report = run(d);
  assert.deepEqual(report.aliasCollisions, [{ slug: 'femoral-artery', file: 'structures/bone/femur.yaml' }]);
  assert.match(read(d, 'structures/bone/femur.yaml'), /bp3d:FJ3259M/);
  assert.doesNotMatch(read(d, 'structures/bone/femur.yaml'), /FJ3001/);
});

test('a draft structure whose kind changes moves to its new folder', () => {
  const d = fresh();
  const text = read(d, 'structures/organ/heart.yaml').replace('kind: organ', 'kind: muscle');
  rmSync(join(d, 'structures/organ/heart.yaml'));
  write(d, 'structures/muscle/heart.yaml', text);
  const report = run(d);
  assert.equal(existsSync(join(d, 'structures/muscle/heart.yaml')), false);
  assert.match(read(d, 'structures/organ/heart.yaml'), /kind: organ/);
  assert.equal(report.updated, 1);
});

test('a move onto an existing file is refused and reported, nothing is written', () => {
  const d = fresh();
  const heart = read(d, 'structures/organ/heart.yaml').replace('kind: organ', 'kind: muscle');
  rmSync(join(d, 'structures/organ/heart.yaml'));
  write(d, 'structures/muscle/heart.yaml', heart);
  const squatter = 'slug: heart-notes\nkind: organ\nlaterality: midline\nstatus: reviewed\nlabels:\n  en:\n    text: heart notes\n    source: curated\n    status: reviewed\n';
  write(d, 'structures/organ/heart.yaml', squatter);
  const report = run(d);
  assert.equal(read(d, 'structures/muscle/heart.yaml'), heart);
  assert.equal(read(d, 'structures/organ/heart.yaml'), squatter);
  assert.ok(report.writeConflicts.some((c) => c.slug === 'heart'));
});

test('curator additions to draft labels and ids survive a re-import', () => {
  const d = fresh();
  let text = read(d, 'structures/artery/femoral-artery.yaml');
  text = text.replace(/(  fr:\n    text: artère fémorale\n)/, '$1    synonyms:\n      - artère fémorale commune\n');
  text = text.replace('ids:\n', 'ids:\n  uberon: "0002060"\n');
  write(d, 'structures/artery/femoral-artery.yaml', text);
  const skin = read(d, 'structures/skin/skin.yaml');
  assert.doesNotMatch(skin, /text: Cutis\n    gender/, 'the import knows no gender for Cutis');
  write(d, 'structures/skin/skin.yaml', skin.replace('text: Cutis\n', 'text: Cutis\n    gender: f\n'));
  run(d);
  const { atlas, errors } = compileAtlas(d);
  assert.deepEqual(errors, []);
  const s = Object.fromEntries(atlas!.structures.map((x) => [x.slug, x]));
  assert.deepEqual(s['femoral-artery'].labels.fr!.synonyms, ['artère fémorale commune']);
  assert.equal(s['femoral-artery'].ids!.uberon, '0002060');
  assert.equal(s.skin.labels.la!.gender, 'f');
});

test('reviewed side labels block a laterality change instead of being deleted', () => {
  const d = fresh();
  const file = 'structures/group/lower-limb.yaml';
  const text = read(d, file).replace(/(  left:\n    ids:\n      fma: 24981\n)/, '$1    labels:\n      fr:\n        text: membre inférieur gauche\n        source: curated\n        status: reviewed\n');
  assert.notEqual(text, read(d, file), 'fixture edit applied');
  write(d, file, text);
  const report = run(d, { ...OVERRIDES, noFold: [...OVERRIDES.noFold, 'lower limb'] });
  assert.match(read(d, file), /membre inférieur gauche/);
  assert.deepEqual(report.lateralityConflicts, ['lower-limb']);
});

test('a CSV without the expected columns is rejected with a clear error', () => {
  const d = writeDataset({ ...sources });
  const csv = join(d, 'bad.csv');
  writeFileSync(csv, 'item,fmaid,fr\nhttp://www.wikidata.org/entity/Q1,1,x\n');
  assert.throws(() => importBp3d({ bp3dDir: join(FIX, 'bp3d'), wikidataCsv: csv, dataDir: d, overrides: OVERRIDES }), /colonne.*fma/);
});

test('female-model structures (from the HRA import) are not reported as orphans by the BodyParts3D import', () => {
  const d = writeDataset({
    ...sources,
    'structures/organ/uterus.yaml': {
      slug: 'uterus', kind: 'organ', laterality: 'midline', status: 'draft', sex: 'female',
      labels: { en: { text: 'uterus', source: 'curated', status: 'draft' } },
    },
  });
  const report = run(d);
  assert.deepEqual(report.orphanedFiles, []);
});
