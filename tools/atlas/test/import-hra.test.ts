import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO, type Node } from '@gltf-transform/core';
import { stringify } from 'yaml';
import { compileAtlas } from '../src/compile-atlas.ts';
import { importHra } from '../src/import-hra.ts';
import { sources, writeDataset } from './helpers.ts';

type Spec = { name: string; mesh?: boolean; extras?: Record<string, unknown>; children?: Spec[] };
async function glb(path: string, roots: Spec[]) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const make = (s: Spec): Node => {
    const n = doc.createNode(s.name).setExtras(s.extras ?? {});
    if (s.mesh !== false) n.setMesh(doc.createMesh(s.name).addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0])).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2])).setBuffer(buffer))));
    for (const c of s.children ?? []) n.addChild(make(c));
    return n;
  };
  const scene = doc.createScene();
  for (const r of roots) scene.addChild(make(r));
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, await new NodeIO().writeBinary(doc));
}
const x = (ontologyid: string, label: string) => ({ ontologyid, label });

const lbl = (text: string) => ({ en: { text, source: 'fma', status: 'draft' } });
const HRA_SOURCE = {
  'sources/hra.yaml': { id: 'hra', name: 'HRA', version: '2.5', url: 'https://humanatlas.io/', licence: 'CC-BY-4.0', attribution: 'HRA, CC BY 4.0',
    provides: ['meshes', 'labels', 'ids'], meshPrefix: 'hra', meshPattern: '^[a-z0-9-]+/[A-Za-z0-9_]+$' },
};
const EXISTING = {
  'structures/group/human-body.yaml': { slug: 'human-body', kind: 'group', laterality: 'midline', status: 'draft', labels: lbl('human body') },
  'structures/group/genital-system.yaml': { slug: 'genital-system', kind: 'group', laterality: 'midline', status: 'draft', parent: 'human-body', labels: lbl('genital system') },
  'structures/group/thorax.yaml': { slug: 'thorax', kind: 'group', laterality: 'midline', status: 'draft', parent: 'human-body', labels: lbl('thorax') },
  'structures/organ/urinary-bladder.yaml': { slug: 'urinary-bladder', kind: 'organ', laterality: 'midline', status: 'draft', parent: 'human-body', labels: lbl('urinary bladder'), meshes: ['bp3d:FJ1'] },
  'structures/organ/rectum.yaml': { slug: 'rectum', kind: 'organ', laterality: 'midline', status: 'draft', parent: 'human-body', labels: lbl('rectum'), meshes: ['bp3d:FJ2'] },
  'structures/skin/skin.yaml': { slug: 'skin', kind: 'skin', laterality: 'midline', status: 'draft', parent: 'human-body', labels: lbl('skin'), meshes: ['bp3d:FJ3'] },
  'structures/organ/prostate.yaml': { slug: 'prostate', kind: 'organ', laterality: 'midline', status: 'draft', parent: 'genital-system', labels: lbl('prostate'), meshes: ['bp3d:FJ4'], ids: { fma: 9600 } },
};
const OVERRIDES = {
  skipNodes: ['VH_F_cervicovaginal_junction'],
  swapSides: [['VH_F_left_round_ligament_of_uterus', 'VH_F_right_round_ligament_of_uterus']] as [string, string][],
  variants: { 'urinary-bladder': { organ: 'urinary-bladder-female' }, rectum: { organ: 'large-intestine-female', nodes: ['VH_F_rectum'] } },
  hidden: ['skin'],
  male: ['prostate'],
  groups: { 'female-genital-system': { label: 'female genital system', parent: 'genital-system' } },
  kinds: { 'lactiferous-sinus': 'organ' },
  labels: { VH_F_cornua: 'horn of uterus' },
  wikidata: { 'mammary-gland': 'Q5' },
  ids: { VH_F_right_ovary: { fma: 7213, uberon: '0002118' } },
  organs: {
    'uterus-female': { parent: 'female-genital-system' }, 'ovary-female-left': { parent: 'female-genital-system' }, 'ovary-female-right': { parent: 'female-genital-system' },
    'mammary-gland-female-left': { parent: 'thorax', layer: 1 }, 'mammary-gland-female-right': { parent: 'thorax', layer: 1 },
    'united-female': { parent: 'female-genital-system' },
  },
};

async function fixture() {
  const dataDir = writeDataset({ ...sources, ...HRA_SOURCE, ...EXISTING, 'import/hra-overrides.yaml': OVERRIDES });
  const hraDir = join(dataDir, 'raw-hra');
  await glb(join(hraDir, 'uterus-female/3d-vh-f-uterus.glb'), [
    { name: 'VH_F_cervicovaginal_junction' },
    { name: 'VH_F_uterus', mesh: false, children: [
      { name: 'VH_F_body_of_uterus', extras: x('UBERON:0009853', 'body of uterus') },
      { name: 'VH_F_cornua' },
      { name: 'VH_F_cervix', extras: x('UBERON:0000002', 'uterine cervix'), children: [{ name: 'VH_F_external_cervical_os', extras: x('UBERON:0013760', 'external cervical os') }] },
    ] },
  ]);
  writeFileSync(join(hraDir, 'uterus-female/crosswalk.csv'), 'node_name,OntologyID,label\nVH_F_uterus,UBERON:0000995,uterus\n');
  await glb(join(hraDir, 'ovary-female-left/3d-vh-f-ovary-l.glb'), [{ name: 'VH_F_left_ovary', extras: x('FMA:7214', 'Left ovary') }]);
  writeFileSync(join(hraDir, 'ovary-female-left/crosswalk.csv'), 'node_name,OntologyID,label\nVH_F_left_ovary,UBERON:0002119,Left ovary\n');
  await glb(join(hraDir, 'ovary-female-right/3d-vh-f-ovary-r.glb'), [{ name: 'VH_F_right_ovary', extras: x('FMA:7213', 'Right ovary') }]);
  writeFileSync(join(hraDir, 'ovary-female-right/crosswalk.csv'), 'node_name,OntologyID,label\nVH_F_right_ovary,UBERON:0002118,Right ovary\nVH_F_right_ovary_dup,FMA:9999,x\n');
  for (const [side, S, fma, nip, fat] of [['left', 'L', 57991, '0013772', 73166], ['right', 'R', 57987, '0013773', 73167]] as const) {
    await glb(join(hraDir, `mammary-gland-female-${side}/3d-vh-f-mammary-gland-${S.toLowerCase()}.glb`), [
      { name: 'VH_F', mesh: false, children: [{ name: 'VH_F_mammary_gland', mesh: false, children: [
        { name: `VH_F_mammary_gland_${S}`, mesh: false, extras: x(`FMA:${fma}`, `${side === 'left' ? 'Left' : 'Right'} mammary gland`), children: [
          { name: `VH_F_nipple_${S}`, extras: x(`UBERON:${nip}`, `${side} nipple`) },
          { name: `VH_F_fat_${S}`, extras: x(`FMA:${fat}`, `Interlobar adipose tissue of ${side} mammary gland`) },
          { name: `VH_F_main_lactiferous_sinuses_${S}`, extras: x('FMA:58088', 'Lactiferous sinus') },
        ] }] }] },
    ]);
    writeFileSync(join(hraDir, `mammary-gland-female-${side}/crosswalk.csv`), 'node_name,OntologyID,label\n');
  }
  await glb(join(hraDir, 'urinary-bladder-female/3d-vh-f-urinary-bladder.glb'), [{ name: 'VH_F_urinary_bladder', mesh: false, children: [{ name: 'VH_F_trigone' }, { name: 'VH_F_dome' }] }]);
  await glb(join(hraDir, 'large-intestine-female/3d-sbu-f-large-intestine.glb'), [{ name: 'VH_F_colon' }, { name: 'VH_F_rectum' }]);
  await glb(join(hraDir, 'united-female/extracted-united.glb'), [
    { name: 'VH_F_vagina', extras: x('UBERON:0000996', 'vagina') },
    { name: 'VH_F_left_round_ligament_of_uterus', extras: x('FMA:57790', 'Left round ligament of uterus') },
    { name: 'VH_F_right_round_ligament_of_uterus', extras: x('FMA:57789', 'Right round ligament of uterus') },
    { name: 'VH_F_left_cardinal_ligament_of_uterus', extras: x('FMA:77064', 'Cardinal ligament') },
    { name: 'VH_F_right_cardinal_ligament_of_uterus', extras: x('FMA:77064', 'Cardinal ligament') },
    { name: 'VH_F_accessory_a', extras: x('FMA:900001', 'Accessory band') },
    { name: 'VH_F_accessory_b', extras: x('FMA:900002', 'Accessory band') },
    { name: 'VH_F_accessory_c', extras: x('FMA:900003', 'Accessory band') },
  ]);
  // a GLB id that disagrees with the crosswalk in the same vocabulary
  await glb(join(hraDir, 'ovary-female-left/3d-vh-f-ovary-l.glb'), [{ name: 'VH_F_left_ovary', extras: x('FMA:7214', 'Left ovary') }]);
  writeFileSync(join(hraDir, 'ovary-female-left/crosswalk.csv'), 'node_name,OntologyID,label\nVH_F_left_ovary,FMA:7299,Left ovary\n');
  const files = join(dataDir, 'import/hra-files.yaml');
  writeFileSync(files, stringify({ baseUrl: 'x', release: 'test', organs: [
    { id: 'uterus-female', version: 'v1', file: '3d-vh-f-uterus.glb', doi: '10.1/u' },
    { id: 'ovary-female-left', version: 'v1', file: '3d-vh-f-ovary-l.glb', doi: '10.1/ol' },
    { id: 'ovary-female-right', version: 'v1', file: '3d-vh-f-ovary-r.glb', doi: '10.1/or' },
    { id: 'mammary-gland-female-left', version: 'v1', file: '3d-vh-f-mammary-gland-l.glb', doi: '10.1/ml' },
    { id: 'mammary-gland-female-right', version: 'v1', file: '3d-vh-f-mammary-gland-r.glb', doi: '10.1/mr' },
    { id: 'urinary-bladder-female', version: 'v1', file: '3d-vh-f-urinary-bladder.glb', doi: '10.1/b' },
    { id: 'large-intestine-female', version: 'v1', file: '3d-sbu-f-large-intestine.glb', doi: '10.1/li' },
  ], united: { id: 'united-female', version: 'v1', file: 'u.glb', doi: '10.1/un', nodes: [] } }));
  const csv = join(dataDir, 'wd.csv');
  writeFileSync(csv, [
    'item,fma,uberon,ta2,ta98,fr,la,en',
    'http://www.wikidata.org/entity/Q1,7214,0002119,,,ovaire gauche,Ovarium sinistrum,left ovary',
    'http://www.wikidata.org/entity/Q2,,0000996,3523,,vagin,Vagina,vagina',
    'http://www.wikidata.org/entity/Q3,,0000995,3517,,utérus,Uterus,uterus',
    'http://www.wikidata.org/entity/Q4,67771,,,,mamelon,Papilla mammaria,nipple',
    'http://www.wikidata.org/entity/Q5,,0001911,,,glande mammaire,Glandula mammaria,mammary gland of a female',
  ].join('\n') + '\n');
  return { dataDir, run: () => importHra({ hraDir, filesList: files, wikidataCsv: csv, dataDir, overrides: OVERRIDES }) };
}

const atlases = (dataDir: string) => {
  const r = compileAtlas(dataDir);
  assert.deepEqual(r.errors, [], 'import output must compile');
  return r.atlases!;
};
const by = (a: { structures: { slug: string }[] }, slug: string) => a.structures.find((s) => s.slug === slug) as any;

test('organ files become female structures: organ root, parts, nested parts; skipped nodes left out', async () => {
  const { dataDir, run } = await fixture();
  await run();
  const f = atlases(dataDir).female;
  const uterus = by(f, 'uterus');
  assert.equal(uterus.sex, 'female');
  assert.equal(uterus.parent, 'female-genital-system');
  assert.equal(uterus.meshes, undefined);
  assert.deepEqual(uterus.ids, { uberon: '0000995', ta2: 3517, wikidata: 'Q3' });
  assert.deepEqual(uterus.children, ['body-of-uterus', 'horn-of-uterus', 'uterine-cervix']);
  assert.deepEqual(by(f, 'uterine-cervix').meshes, ['hra:uterus-female/VH_F_cervix']);
  assert.equal(by(f, 'uterine-cervix').ids.uberon, '0000002');
  assert.equal(by(f, 'external-cervical-os').parent, 'uterine-cervix');
  assert.equal(f.structures.some((s) => s.slug.includes('cervicovaginal')), false);
  const group = by(f, 'female-genital-system');
  assert.deepEqual([group.kind, group.sex, group.parent], ['group', 'female', 'genital-system']);
});

test('left and right files pair into bilateral structures; side words leave the names', async () => {
  const { dataDir, run } = await fixture();
  await run();
  const f = atlases(dataDir).female;
  const ovary = by(f, 'ovary');
  assert.equal(ovary.laterality, 'bilateral');
  assert.deepEqual(ovary.sides.left.meshes, ['hra:ovary-female-left/VH_F_left_ovary']);
  assert.deepEqual(ovary.sides.left.ids, { fma: 7214 });
  assert.deepEqual(ovary.sides.right.ids, { fma: 7213, uberon: '0002118' });
  assert.equal(ovary.labels.en.text, 'ovary');
  assert.deepEqual([ovary.labels.fr.text, ovary.labels.la.text], ['ovaire', 'Ovarium']);
  const gland = by(f, 'mammary-gland');
  assert.deepEqual([gland.laterality, gland.parent, gland.layer], ['bilateral', 'thorax', 1]);
  assert.deepEqual(gland.children, ['interlobar-adipose-tissue-of-mammary-gland', 'lactiferous-sinus', 'nipple']);
  assert.equal(by(f, 'nipple').layer, 1);
  assert.deepEqual(by(f, 'nipple').sides.right.meshes, ['hra:mammary-gland-female-right/VH_F_nipple_R']);
});

test('united nodes: swapped sides corrected, a shared side id moves to the root', async () => {
  const { dataDir, run } = await fixture();
  await run();
  const f = atlases(dataDir).female;
  assert.deepEqual(by(f, 'round-ligament-of-uterus').sides.left.meshes, ['hra:united-female/VH_F_right_round_ligament_of_uterus']);
  const cardinal = by(f, 'cardinal-ligament');
  assert.equal(cardinal.ids.fma, 77064);
  assert.equal(cardinal.sides.left.ids, undefined);
  assert.equal(cardinal.kind, 'ligament');
  const vagina = by(f, 'vagina');
  assert.deepEqual([vagina.laterality, vagina.ids.uberon, vagina.labels.fr.text], ['midline', '0000996', 'vagin']);
});

test('shared structures get female variants or hiding, male structures get sex: male', async () => {
  const { dataDir, run } = await fixture();
  await run();
  const { male, female } = atlases(dataDir);
  assert.deepEqual(by(female, 'urinary-bladder').meshes, ['hra:urinary-bladder-female/VH_F_dome', 'hra:urinary-bladder-female/VH_F_trigone']);
  assert.deepEqual(by(male, 'urinary-bladder').meshes, ['bp3d:FJ1']);
  assert.deepEqual(by(female, 'rectum').meshes, ['hra:large-intestine-female/VH_F_rectum']);
  assert.equal(by(female, 'skin'), undefined);
  assert.equal(by(female, 'prostate'), undefined);
  assert.ok(by(male, 'prostate'));
  assert.equal(by(male, 'uterus'), undefined);
});

test('a second import changes nothing; a reviewed label is kept', async () => {
  const { dataDir, run } = await fixture();
  await run();
  const file = join(dataDir, 'structures/organ/vagina.yaml');
  writeFileSync(file, readFileSync(file, 'utf8').replace('text: vagin\n', 'text: vagin (relu)\n').replace(/(text: vagin \(relu\)\n(?:.*\n)*?\s+status: )draft/, '$1reviewed'));
  const before = readFileSync(file, 'utf8');
  const r = await run();
  assert.equal(r.created, 0);
  assert.equal(r.updated, 0);
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('names fall back to the generic English term; kind and label overrides apply', async () => {
  const { dataDir, run } = await fixture();
  await run();
  const f = atlases(dataDir).female;
  const nipple = by(f, 'nipple');
  assert.deepEqual([nipple.labels.fr.text, nipple.labels.la.text, nipple.ids.wikidata], ['mamelon', 'Papilla mammaria', 'Q4']);
  assert.equal(by(f, 'lactiferous-sinus').kind, 'organ');
  assert.equal(by(f, 'horn-of-uterus').labels.en.text, 'horn of uterus');
});

test('slugs clashing inside the import get a numeric suffix', async () => {
  const { dataDir, run } = await fixture();
  const r = await run();
  const f = atlases(dataDir).female;
  assert.deepEqual(['accessory-band', 'accessory-band-2', 'accessory-band-3'].map((x) => !!by(f, x)), [true, true, true]);
  assert.ok(r.slugCollisions.some((c) => c.renamed === 'accessory-band-3'));
});

test('ids: a GLB/crosswalk disagreement in one vocabulary is reported (GLB kept) unless an override settles it', async () => {
  const { run } = await fixture();
  const r = await run();
  assert.deepEqual(r.idDivergences, [{ node: 'VH_F_left_ovary', glb: 'FMA:7214', crosswalk: 'FMA:7299' }]);
});

test('a forced Wikidata item provides names and the item id', async () => {
  const { dataDir, run } = await fixture();
  await run();
  const gland = by(atlases(dataDir).female, 'mammary-gland');
  assert.deepEqual([gland.labels.fr.text, gland.ids.wikidata], ['glande mammaire', 'Q5']);
});

test('patches on reviewed files are not applied and are reported', async () => {
  const { dataDir, run } = await fixture();
  const file = join(dataDir, 'structures/organ/prostate.yaml');
  writeFileSync(file, readFileSync(file, 'utf8').replace('status: draft', 'status: reviewed'));
  const r = await run();
  assert.deepEqual(r.skippedReviewedPatches, ['prostate']);
  assert.doesNotMatch(readFileSync(file, 'utf8'), /sex: male/);
});
