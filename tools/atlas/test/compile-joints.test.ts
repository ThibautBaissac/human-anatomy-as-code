import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAtlas, type Diagnostic } from '../src/compile-atlas.ts';
import { validDataset, validStructures } from './helpers.ts';

const S = validStructures();
const KNEE = 'joints/knee-joint.yaml';
const BICEPS = 'structures/muscle/biceps-brachii.yaml';
const lbl = (text: string, source = 'fma') => ({ text, source, status: 'draft' });

const JOINT_SOURCES = {
  'sources/cdc-joint-rom.yaml': {
    id: 'cdc-joint-rom', name: 'CDC Normal Joint Range of Motion Study', version: '2011', url: 'https://archive.cdc.gov/',
    licence: 'public-domain', attribution: 'CDC, Normal Joint Range of Motion Study (Soucie et al. 2011), public domain', provides: ['joints'],
  },
  'sources/rajagopal-2016.yaml': {
    id: 'rajagopal-2016', name: 'Rajagopal 2016 full-body model', version: '2016', url: 'https://simtk.org/projects/full_body',
    licence: 'MIT', attribution: 'Rajagopal et al. 2016, MIT', provides: ['joints', 'actions'],
    notice: 'Copyright (c) 2015, Stanford University. Permission is hereby granted…',
  },
};

const TIBIA = {
  'structures/bone/tibia.yaml': {
    slug: 'tibia', kind: 'bone', laterality: 'bilateral', status: 'draft', parent: 'human-body', regions: ['lower-limb'],
    labels: { en: lbl('tibia') }, sides: { left: { meshes: ['bp3d:FJ3300M'] }, right: { meshes: ['bp3d:FJ3300'] } },
  },
};

const side = (x: number) => ({ centre: [x, -71.8, 390.6], axis: [0.998, -0.034, 0.056], rmsMm: 1.7 });
export const knee = (patch: object = {}) => ({
  slug: 'knee-joint',
  labels: { en: lbl('knee joint'), fr: { ...lbl('articulation du genou', 'curated'), gender: 'f' }, la: { ...lbl('articulatio genus', 'curated'), gender: 'f' } },
  motion: 'flexion-extension',
  proximal: 'femur',
  moving: ['tibia'],
  rangeDeg: [0, 138],
  restDeg: 1.5,
  sources: ['cdc-joint-rom'],
  status: 'draft',
  fit: { method: 'condyle-spheres', maxRmsMm: 3, positiveDirection: [0, 1, 0] },
  sides: { left: side(72.2), right: side(-72.2) },
  ...patch,
});
const bicepsActions = (actions: object[]) => ({ [BICEPS]: { ...S[BICEPS], actions } });
const action = (patch: object = {}) => ({ joint: 'knee-joint', role: 'flexion', source: 'rajagopal-2016', status: 'draft', ...patch });

const dataset = (extra: Record<string, unknown> = {}) => validDataset({ ...JOINT_SOURCES, ...TIBIA, [KNEE]: knee(), ...extra });
const pick = (d: Diagnostic) => ({ file: d.file, pointer: d.pointer, rule: d.rule });
function expectError(extra: Record<string, unknown>, expected: { file: string; pointer: string; rule: string }) {
  const { atlas, errors } = compileAtlas(dataset(extra));
  assert.equal(atlas, null);
  assert.deepEqual(errors.map(pick), [expected]);
}

test('each model atlas carries the joints, without their fit parameters', () => {
  const { atlases, errors } = compileAtlas(dataset());
  assert.deepEqual(errors, []);
  for (const model of ['male', 'female'] as const) {
    const [j] = (atlases![model] as any).joints;
    assert.equal(j.slug, 'knee-joint');
    assert.deepEqual(j.moving, ['tibia']);
    assert.deepEqual(j.sides.left.centre, [72.2, -71.8, 390.6]);
    assert.equal(j.restDeg, 1.5);
    assert.equal(j.labels.fr.text, 'articulation du genou');
    assert.equal(j.fit, undefined);
  }
});

test('muscle actions are compiled with the structure', () => {
  const { atlas, errors } = compileAtlas(dataset(bicepsActions([action()])));
  assert.deepEqual(errors, []);
  const biceps = atlas!.structures.find((s) => s.slug === 'biceps-brachii') as any;
  assert.deepEqual(biceps.actions, [action()]);
});

test('sources of joints and actions are credited, with their licence notice', () => {
  const { atlas } = compileAtlas(dataset(bicepsActions([action()])));
  const credit = (id: string) => atlas!.attributions.find((a) => a.source === id) as any;
  assert.ok(credit('cdc-joint-rom'));
  assert.match(credit('rajagopal-2016').notice, /Stanford University/);
});

test('joint-bone: proximal, moving and coupled bones exist and are bones', () => {
  expectError({ [KNEE]: knee({ proximal: 'humerus' }) }, { file: KNEE, pointer: '/proximal', rule: 'joint-bone' });
  expectError({ [KNEE]: knee({ moving: ['biceps-brachii'] }) }, { file: KNEE, pointer: '/moving/0', rule: 'joint-bone' });
  expectError({ [KNEE]: knee({ coupled: [{ bone: 'patella', ratio: 0.85 }] }) }, { file: KNEE, pointer: '/coupled/0/bone', rule: 'joint-bone' });
});

test('joint-side: a measured side needs bilateral bones', () => {
  const sacrum = { 'structures/bone/sacrum.yaml': { slug: 'sacrum', kind: 'bone', laterality: 'midline', status: 'draft', parent: 'human-body', labels: { en: lbl('sacrum') }, meshes: ['bp3d:FJ3393'] } };
  expectError({ ...sacrum, [KNEE]: knee({ moving: ['sacrum'] }) }, { file: KNEE, pointer: '/moving/0', rule: 'joint-side' });
});

test('joint-sides: a joint that was never measured is an error', () => {
  const { sides: _, ...unmeasured } = knee();
  expectError({ [KNEE]: unmeasured }, { file: KNEE, pointer: '/sides', rule: 'joint-sides' });
});

test('joint-axis: the axis is a unit vector', () => {
  expectError({ [KNEE]: knee({ sides: { left: { ...side(72), axis: [1, 1, 0] }, right: side(-72) } }) }, { file: KNEE, pointer: '/sides/left/axis', rule: 'joint-axis' });
});

test('joint-range: the range is increasing and contains the rest angle', () => {
  expectError({ [KNEE]: knee({ rangeDeg: [138, 0] }) }, { file: KNEE, pointer: '/rangeDeg', rule: 'joint-range' });
  expectError({ [KNEE]: knee({ restDeg: 150 }) }, { file: KNEE, pointer: '/restDeg', rule: 'joint-range' });
});

test('joint-parent: the parent joint exists, without cycle', () => {
  expectError({ [KNEE]: knee({ parent: 'hip-joint' }) }, { file: KNEE, pointer: '/parent', rule: 'joint-parent' });
  const other = { 'joints/ankle-joint.yaml': knee({ slug: 'ankle-joint', parent: 'knee-joint' }) };
  expectError({ ...other, [KNEE]: knee({ parent: 'ankle-joint' }) }, { file: 'joints/ankle-joint.yaml', pointer: '/parent', rule: 'joint-cycle' });
});

test('joint-source: cited sources exist', () => {
  expectError({ [KNEE]: knee({ sources: ['aaos'] }) }, { file: KNEE, pointer: '/sources/0', rule: 'joint-source' });
});

test('label-source: joint label sources are registered sources or curated', () => {
  expectError({ [KNEE]: knee({ labels: { ...knee().labels, en: lbl('knee joint', 'fmaa') } }) }, { file: KNEE, pointer: '/labels/en/source', rule: 'label-source' });
});

test('schema: fit parameters are the ones the measurement reads', () => {
  expectError({ [KNEE]: knee({ fit: { ...knee().fit, contactMM: [6] } }) }, { file: KNEE, pointer: '/fit', rule: 'schema' });
  const { errors } = compileAtlas(dataset({ [KNEE]: knee({ fit: { ...knee().fit, distalMm: 40, posteriorMm: 0, gapMm: 6, contactMm: [6], distalBandMm: [4, 18], proximalBandMm: [0, 10] } }) }));
  assert.deepEqual(errors, []);
});

test('joint-model: the bones of a joint exist in every model', () => {
  const femur = 'structures/bone/femur.yaml';
  expectError({ [femur]: { ...S[femur], variants: { female: { hidden: true } } } }, { file: KNEE, pointer: '/proximal', rule: 'joint-model' });
});

test('action rules: known joint, muscle only, role of the motion, known source', () => {
  expectError(bicepsActions([action({ joint: 'hip-joint' })]), { file: BICEPS, pointer: '/actions/0/joint', rule: 'action-joint' });
  expectError(bicepsActions([action({ role: 'pronation' })]), { file: BICEPS, pointer: '/actions/0/role', rule: 'action-role' });
  expectError(bicepsActions([action({ source: 'aaos' })]), { file: BICEPS, pointer: '/actions/0/source', rule: 'action-source' });
  const femur = 'structures/bone/femur.yaml';
  expectError({ [femur]: { ...S[femur], actions: [action()] } }, { file: femur, pointer: '/actions', rule: 'action-kind' });
});

test('action-source: an action may be curated by the project, like a label', () => {
  const { errors } = compileAtlas(dataset(bicepsActions([action({ source: 'curated' })])));
  assert.deepEqual(errors, []);
});
