import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileAtlas, type CompiledStructure } from '../src/compile-atlas.ts';
import { importBp3d } from '../src/import-bp3d.ts';
import { sources, writeDataset } from './helpers.ts';

const FIX = new URL('./fixtures/', import.meta.url).pathname;
const OVERRIDES = {
  noFold: ['atrium', 'ventricle', 'auricle', 'coronary artery'],
  ties: {},
  slugs: {},
};

function runImport(dataDir = writeDataset({ ...sources }), overrides: object = OVERRIDES) {
  const report = importBp3d({ bp3dDir: join(FIX, 'bp3d'), wikidataCsv: join(FIX, 'wikidata.csv'), dataDir, overrides });
  return { dataDir, report };
}

function compiled(dataDir: string): Record<string, CompiledStructure> {
  const { atlas, errors } = compileAtlas(dataDir);
  assert.deepEqual(errors, [], 'import output must compile without errors');
  return Object.fromEntries(atlas!.structures.map((s) => [s.slug, s]));
}

const snapshot = (dir: string) => {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[p] = readFileSync(p, 'utf8');
    }
  };
  walk(join(dir, 'structures'));
  return out;
};

test('left/right pairs fold into one bilateral structure with side ids and meshes', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s.femur.laterality, 'bilateral');
  assert.deepEqual(s.femur.ids, { fma: 9611, ta2: 1360, ta98: 'A02.5.04.001', wikidata: 'Q176503' });
  assert.deepEqual(s.femur.sides!.left.ids, { fma: 24475, wikidata: 'Q66557385' });
  assert.deepEqual(s.femur.sides!.right.ids, { fma: 24474 });
  assert.deepEqual(s.femur.sides!.left.meshes, ['bp3d:FJ3259M']);
  assert.deepEqual(s.femur.sides!.right.meshes, ['bp3d:FJ3259']);
  assert.equal(s['left-femur'], undefined);
});

test('a canonical concept that is itself a candidate merges into the folded structure', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s['lower-limb'].laterality, 'bilateral');
  assert.equal(s['lower-limb'].ids!.fma, 7184);
  assert.deepEqual(s['lower-limb'].sides!.right.ids, { fma: 24980 });
  assert.equal(s['lower-limb'].parent, 'human-body');
});

test('without a BodyParts3D canonical concept, ids and labels come from the Wikidata english label', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s['biceps-brachii'].ids!.fma, 37670);
  assert.equal(s['biceps-brachii'].labels.fr!.text, 'muscle biceps brachial');
  assert.equal(s['upper-limb'].ids!.fma, 7183);
});

test('pairs on the no-fold list stay two structures, each unpaired on the side its name gives', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s['left-atrium'].laterality, 'unpaired-left');
  assert.equal(s['right-atrium'].laterality, 'unpaired-right');
  assert.equal(s.atrium, undefined);
});

test('a single prefixed side is unpaired and keeps its full name', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s['right-lymphatic-duct'].laterality, 'unpaired-right');
  assert.deepEqual(s['right-lymphatic-duct'].meshes, ['bp3d:FJ4001']);
});

test('a side word inside the name folds when both sides exist', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s['long-head-of-biceps-brachii'].laterality, 'bilateral');
  assert.deepEqual(s['long-head-of-biceps-brachii'].sides!.left.meshes, ['bp3d:FJ1300M']);
  assert.equal(s['long-head-of-biceps-brachii'].labels.en!.text, 'long head of biceps brachii');
  assert.equal(s['long-head-of-biceps-brachii'].parent, 'arm');
  assert.equal(s['long-head-of-left-biceps-brachii'], undefined);
});

test('when the side word sits inside the name, the FMA side name becomes the english side label', () => {
  const { dataDir } = runImport();
  const s = compiled(dataDir);
  assert.equal(s['long-head-of-biceps-brachii'].sides!.right.labels.en, 'long head of right biceps brachii');
  assert.equal(s.femur.sides!.right.labels.en, 'right femur');
  assert.doesNotMatch(readFileSync(join(dataDir, 'structures/bone/femur.yaml'), 'utf8'), /^    labels:/m);
});

test('a missing side label is added to an existing draft file, an existing one is kept', () => {
  const { dataDir } = runImport();
  const file = join(dataDir, 'structures/muscle/long-head-of-biceps-brachii.yaml');
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replace(/\n    labels:\n      en:\n        text: long head of left biceps brachii\n        source: fma\n        status: draft/, ''));
  assert.notEqual(readFileSync(file, 'utf8'), text, 'fixture edit applied');
  runImport(dataDir);
  assert.equal(readFileSync(file, 'utf8'), text);
});

test('a side word inside the name with only one side keeps the full name and is unpaired on that side', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s['superior-lobe-of-left-lung'].laterality, 'unpaired-left');
});

test('a name that gives the same side twice folds; its side keeps the FMA name', () => {
  const s = compiled(runImport().dataDir);
  const b = s['branch-of-middle-cerebral-artery-to-angular-gyrus'];
  assert.equal(b.laterality, 'bilateral');
  assert.deepEqual(b.sides!.left.meshes, ['bp3d:FJ1660M']);
  assert.equal(b.sides!.right.labels.en, 'branch of right middle cerebral artery to right angular gyrus');
});

test('without a side word, laterality comes from the geometry: wholly on one side is unpaired, across the median plane is midline', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s.spleen.laterality, 'unpaired-left');
  assert.equal(s.stomach.laterality, 'midline');
  assert.equal(s['external-oblique'].laterality, 'midline'); // no geometry: midline
  assert.equal(compiled(runImport(undefined, { ...OVERRIDES, laterality: { spleen: 'midline' } }).dataDir).spleen.laterality, 'midline');
});

test('the no-fold list also applies as a suffix after "of"', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s['anterior-wall-of-left-ventricle'].laterality, 'unpaired-left');
  assert.equal(s['anterior-wall-of-right-ventricle'].laterality, 'unpaired-right');
  assert.equal(s['anterior-wall-of-ventricle'], undefined);
});

test('every mesh has exactly one owner; groups own the fragments no specific concept claims', () => {
  const { dataDir, report } = runImport();
  const { atlas } = compileAtlas(dataDir);
  assert.equal(Object.keys(atlas!.meshIndex).length, 30);
  assert.deepEqual(report.unownedMeshes, []);
  const s = compiled(dataDir);
  assert.deepEqual(s['body-wall'].meshes, ['bp3d:FJ9001', 'bp3d:FJ9002']);
  assert.deepEqual(s['external-oblique'].meshes, ['bp3d:FJ9003']);
});

test('meshes owned by a canonical bilateral concept go to the side whose concept contains them', () => {
  const { dataDir, report } = runImport();
  const s = compiled(dataDir);
  assert.deepEqual(s['common-carotid-artery'].sides!.left.meshes, ['bp3d:FJ7001M', 'bp3d:FJ7101M', 'bp3d:FJ7102M']);
  assert.deepEqual(s['common-carotid-artery'].sides!.right.meshes, ['bp3d:FJ7001', 'bp3d:FJ7101', 'bp3d:FJ7102']);
  assert.deepEqual(report.canonicalMeshConflicts, []);
});

test('a tie for a mesh goes to the concept with a TA2 id; the loser is not a structure', () => {
  const { dataDir, report } = runImport();
  const s = compiled(dataDir);
  assert.deepEqual(s.skin.meshes, ['bp3d:FJ2810']);
  assert.equal(s.integument, undefined);
  assert.deepEqual(report.ties, [{ mesh: 'FJ2810', winner: 'FMA7163', losers: ['FMA7161'] }]);
});

test('an explicit tie override wins over the rules', () => {
  const { dataDir } = runImport(undefined, { ...OVERRIDES, ties: { FJ2810: 'FMA7161' } });
  const s = compiled(dataDir);
  assert.deepEqual(s.integument.meshes, ['bp3d:FJ2810']);
  assert.equal(s.skin, undefined);
});

test('a tie may give a mesh to a concept BodyParts3D does not list for it: a mesh filed under the wrong side', () => {
  const s = compiled(runImport(undefined, { ...OVERRIDES, ties: { FJ3259: 'FMA24475', FJ3259M: 'FMA24474' } }).dataDir);
  assert.deepEqual(s.femur.sides!.left.meshes, ['bp3d:FJ3259']);
  assert.deepEqual(s.femur.sides!.right.meshes, ['bp3d:FJ3259M']);
});

test('an excluded mesh belongs to no structure and is not reported as unowned', () => {
  const { dataDir, report } = runImport(undefined, { ...OVERRIDES, excludeMeshes: ['FJ9003'] });
  const s = compiled(dataDir);
  assert.equal(s['external-oblique'].meshes, undefined);
  assert.deepEqual(report.unownedMeshes, []);
});

test('parent, kind and id overrides replace the computed values; null removes an id', () => {
  const s = compiled(runImport(undefined, {
    ...OVERRIDES,
    parents: { femur: 'human-body' },
    kinds: { 'external-oblique': 'fascia' },
    ids: { femur: { ta98: 'A02.5.04.999', wikidata: null } },
  }).dataDir);
  assert.equal(s.femur.parent, 'human-body');
  assert.equal(s['external-oblique'].kind, 'fascia');
  assert.deepEqual(s.femur.ids, { fma: 9611, ta2: 1360, ta98: 'A02.5.04.999' });
});

test('override entries that match nothing, and unknown override keys, are reported', () => {
  const { report } = runImport(undefined, {
    ...OVERRIDES,
    nofold: ['atrium'],
    ties: { FJ2810: 'FMA0000', FJ0000: 'FMA7163' },
    excludeMeshes: ['FJ0001'],
    slugs: { 'no such name': 'x' },
    laterality: { femur: 'midline', gone: 'midline' },
    kinds: { gone: 'bone', femur: 'bone' },
    parents: { gone: 'human-body' },
    systems: { gone: ['skeletal'] },
    ids: { gone: { fma: null } },
  });
  assert.deepEqual(report.unusedOverrides, [
    'excludeMeshes : mesh FJ0001 inconnu',
    'ids.gone : slug absent de l\'import',
    'kinds.gone : slug absent de l\'import',
    'laterality.femur : structure repliée (bilateral)',
    'laterality.gone : slug absent de l\'import',
    'noFold : « auricle » ne correspond à aucune paire',
    'noFold : « coronary artery » ne correspond à aucune paire',
    'nofold : clé inconnue',
    'parents.gone : slug absent de l\'import',
    'slugs.no such name : nom absent de l\'import',
    'systems.gone : slug absent de l\'import',
    'ties.FJ0000 : mesh inconnu',
    'ties.FJ2810 : concept FMA0000 inconnu',
  ]);
});

test('abstract is-a classes without a mesh of their own are not structures', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s['bone-organ'], undefined);
});

test('kind: keywords, and group for a mesh-less structure whose descendants have several kinds', () => {
  const s = compiled(runImport().dataDir);
  assert.equal(s.femur.kind, 'bone');
  assert.equal(s['femoral-artery'].kind, 'artery');
  assert.equal(s['external-oblique'].kind, 'muscle');
  assert.equal(s.skin.kind, 'skin');
  assert.equal(s['lower-limb'].kind, 'group');
  assert.equal(s['human-body'].kind, 'group');
  assert.equal(s.heart.kind, 'organ');
});

test('parent: folded onto canonical structures; a side conflict keeps the left parent and is reported', () => {
  const { dataDir, report } = runImport();
  const s = compiled(dataDir);
  assert.equal(s.femur.parent, 'lower-limb');
  assert.equal(s['left-atrium'].parent, 'heart');
  assert.equal(s['biceps-brachii'].parent, 'arm');
  assert.deepEqual(report.parentConflicts, [{ slug: 'biceps-brachii', kept: 'arm', other: 'upper-limb' }]);
  assert.equal(s.skin.parent, undefined);
});

test('regions come from part-of ancestors, sub-regions add their region', () => {
  const s = compiled(runImport().dataDir);
  assert.deepEqual(s.femur.regions, ['lower-limb']);
  assert.deepEqual(s['biceps-brachii'].regions, ['arm', 'upper-limb']);
  assert.deepEqual(s['left-atrium'].regions, ['thorax']);
  assert.equal(s.skin.regions, undefined);
});

test('labels: en from FMA, fr/la from the preferred Wikidata item, gender and number from the first word', () => {
  const s = compiled(runImport().dataDir);
  assert.deepEqual(s.femur.labels.en, { text: 'femur', source: 'fma', status: 'draft' });
  assert.deepEqual(s.femur.labels.fr, { text: 'fémur', gender: 'm', number: 'sg', source: 'wikidata', status: 'draft' });
  assert.deepEqual(s.femur.labels.la, { text: 'Os femoris', gender: 'n', number: 'sg', source: 'wikidata', status: 'draft' });
  assert.deepEqual(s['biceps-brachii'].labels.fr, { text: 'muscle biceps brachial', gender: 'm', number: 'sg', source: 'wikidata', status: 'draft' });
  assert.deepEqual(s['femoral-artery'].labels.fr, { text: 'artère fémorale', gender: 'f', number: 'sg', source: 'wikidata', status: 'draft' });
  assert.equal(s['human-body'].labels.fr!.text, 'corps humain, entier');
});

test('slug collisions get an FMA suffix and are reported; a slug override wins', () => {
  const { dataDir, report } = runImport();
  const s = compiled(dataDir);
  assert.ok(s['first-cervical-vertebra']);
  assert.ok(s['first-cervical-vertebra-fma99999']);
  assert.deepEqual(report.slugCollisions, [{ slug: 'first-cervical-vertebra', renamed: 'first-cervical-vertebra-fma99999' }]);
  const forced = compiled(runImport(undefined, { ...OVERRIDES, slugs: { 'first cervical vertebra': 'atlas-bone' } }).dataDir);
  assert.ok(forced['atlas-bone']);
});

test('every created structure is draft; report counts creations', () => {
  const { dataDir, report } = runImport();
  const s = compiled(dataDir);
  assert.ok(Object.values(s).every((x) => x.status === 'draft'));
  assert.equal(report.created, Object.keys(s).length);
  assert.equal(report.updated, 0);
});

// --- Merging with existing files -------------------------------------------------

test('a second import on unchanged inputs changes no byte', () => {
  const { dataDir } = runImport();
  const before = snapshot(dataDir);
  const { report } = runImport(dataDir);
  assert.deepEqual(snapshot(dataDir), before);
  assert.equal(report.created, 0);
  assert.equal(report.updated, 0);
});

test('a reviewed label is never touched, a draft label is refreshed, a missing label is added', () => {
  const { dataDir } = runImport();
  const file = join(dataDir, 'structures/bone/femur.yaml');
  let text = readFileSync(file, 'utf8');
  text = text.replace('text: fémur\n', 'text: fémur (relu)\n');
  text = text.replace(/(text: fémur \(relu\)\n(?:.*\n)*?\s+status: )draft/, '$1reviewed');
  text = text.replace('text: Os femoris', 'text: Os femoris (ancien)');
  writeFileSync(file, text);
  runImport(dataDir);
  const s = compiled(dataDir);
  assert.equal(s.femur.labels.fr!.text, 'fémur (relu)');
  assert.equal(s.femur.labels.fr!.status, 'reviewed');
  assert.equal(s.femur.labels.la!.text, 'Os femoris');
});

test('a label a curator rewrote (source curated) is never overwritten, even in draft', () => {
  const { dataDir } = runImport();
  const file = join(dataDir, 'structures/bone/femur.yaml');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/text: Os femoris\n(\s+)gender: n\n\s+number: sg\n\s+source: wikidata/, 'text: Os femoris (corrigé)\n$1gender: n\n$1number: sg\n$1source: curated'));
  runImport(dataDir);
  const la = compiled(dataDir).femur.labels.la!;
  assert.equal(la.text, 'Os femoris (corrigé)');
  assert.equal(la.source, 'curated');
});

test('a reviewed structure keeps its fields; only missing labels are added', () => {
  const { dataDir } = runImport();
  const file = join(dataDir, 'structures/organ/heart.yaml');
  let text = readFileSync(file, 'utf8');
  text = text.replace('status: draft\n', 'status: reviewed\n');
  text = text.replace(/  la:\n(    .*\n)+/, '');
  text = text.replace('parent: thorax', 'parent: human-body');
  writeFileSync(file, text);
  runImport(dataDir);
  const s = compiled(dataDir);
  assert.equal(s.heart.parent, 'human-body');
  assert.equal(s.heart.labels.la!.text, 'Cor');
});

test('comments and key order of existing files survive a re-import', () => {
  const { dataDir } = runImport();
  const file = join(dataDir, 'structures/bone/femur.yaml');
  writeFileSync(file, '# note de curation\n' + readFileSync(file, 'utf8').replace('kind: bone', 'kind: bone # vérifié sur atlas'));
  const keysBefore = readFileSync(file, 'utf8').match(/^\w+(?=:)/gm);
  runImport(dataDir);
  const after = readFileSync(file, 'utf8');
  assert.match(after, /^# note de curation/);
  assert.match(after, /kind: bone # vérifié sur atlas/);
  assert.deepEqual(after.match(/^\w+(?=:)/gm), keysBefore);
});

test('a draft structure gets its computed fields back', () => {
  const { dataDir } = runImport();
  const file = join(dataDir, 'structures/bone/femur.yaml');
  writeFileSync(file, readFileSync(file, 'utf8').replace('parent: lower-limb', 'parent: human-body'));
  const { report } = runImport(dataDir);
  assert.equal(compiled(dataDir).femur.parent, 'lower-limb');
  assert.equal(report.updated, 1);
});

test('files no longer produced by the source are kept and reported', () => {
  const dataDir = writeDataset({
    ...sources,
    'structures/organ/curated-thing.yaml': {
      slug: 'curated-thing', kind: 'organ', laterality: 'midline', status: 'reviewed',
      labels: { en: { text: 'curated thing', source: 'curated', status: 'reviewed' } },
    },
  });
  const { report } = runImport(dataDir);
  assert.ok(existsSync(join(dataDir, 'structures/organ/curated-thing.yaml')));
  assert.deepEqual(report.orphanedFiles, ['structures/organ/curated-thing.yaml']);
});

test('systems: computed for drafts from ancestors, names and kinds; regions and groups get none', () => {
  const s = compiled(runImport().dataDir) as Record<string, CompiledStructure & { systems?: string[] }>;
  assert.deepEqual(s.femur.systems, ['skeletal']);
  assert.deepEqual(s['femoral-artery'].systems, ['cardiovascular']);
  assert.deepEqual(s.heart.systems, ['cardiovascular']);
  assert.deepEqual(s['external-oblique'].systems, ['muscular']);
  assert.equal(s['lower-limb'].systems, undefined);
  assert.equal(s['human-body'].systems, undefined);
});

test('systems: a reviewed structure keeps its own; an override replaces the derived ones; a re-import changes nothing', () => {
  const { dataDir } = runImport();
  const file = join(dataDir, 'structures/organ/heart.yaml');
  writeFileSync(file, readFileSync(file, 'utf8').replace('status: draft\n', 'status: reviewed\n').replace(/systems:\n(  - .*\n)+/, 'systems:\n  - cardiovascular\n  - endocrine\n'));
  runImport(dataDir, { ...OVERRIDES, systems: { femur: ['skeletal', 'muscular'] } });
  const s = compiled(dataDir) as Record<string, CompiledStructure & { systems?: string[] }>;
  assert.deepEqual(s.heart.systems, ['cardiovascular', 'endocrine']);
  assert.deepEqual(s.femur.systems, ['skeletal', 'muscular']);
  const before = snapshot(dataDir);
  runImport(dataDir, { ...OVERRIDES, systems: { femur: ['skeletal', 'muscular'] } });
  assert.deepEqual(snapshot(dataDir), before);
});
