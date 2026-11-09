import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileAtlas, type Diagnostic } from '../src/compile-atlas.ts';
import { validDataset } from './helpers.ts';

const lbl = (text: string) => ({ en: { text, source: 'fma', status: 'draft' } });
const HRA = {
  'sources/hra.yaml': {
    id: 'hra', name: 'Human Reference Atlas', version: '2.5', url: 'https://humanatlas.io/', licence: 'CC-BY-4.0',
    attribution: 'HuBMAP Human Reference Atlas, CC BY 4.0', provides: ['meshes', 'labels', 'ids'],
    meshPrefix: 'hra', meshPattern: '^[a-z0-9-]+/[A-Za-z0-9_]+$',
    dois: { 'uterus-female': '10.48539/HBM627.VTKD.892', 'urinary-bladder-female': '10.48539/HBM595.LMKX.573', 'ovary-female-left': '10.48539/HBM695.KCXS.294' },
  },
};
const FEMALE = {
  'structures/organ/uterus.yaml': { slug: 'uterus', kind: 'organ', laterality: 'midline', status: 'draft', sex: 'female', parent: 'human-body', labels: lbl('uterus'), meshes: ['hra:uterus-female/VH_F_uterus'] },
  'structures/organ/prostate.yaml': { slug: 'prostate', kind: 'organ', laterality: 'midline', status: 'draft', sex: 'male', parent: 'human-body', labels: lbl('prostate'), meshes: ['bp3d:FJ5000'] },
  'structures/organ/urinary-bladder.yaml': { slug: 'urinary-bladder', kind: 'organ', laterality: 'midline', status: 'draft', parent: 'human-body', labels: lbl('urinary bladder'),
    meshes: ['bp3d:FJ6000'], variants: { female: { meshes: ['hra:urinary-bladder-female/VH_F_urinary_bladder'] } } },
  'structures/skin/skin.yaml': { slug: 'skin', kind: 'skin', laterality: 'midline', status: 'draft', parent: 'human-body', labels: lbl('skin'), meshes: ['bp3d:FJ2810'], variants: { female: { hidden: true } } },
  'structures/skin/skin-of-thumb.yaml': { slug: 'skin-of-thumb', kind: 'skin', laterality: 'midline', status: 'draft', parent: 'skin', labels: lbl('skin of thumb'), meshes: ['bp3d:FJ2811'] },
};
const ok = (extra: Record<string, unknown> = {}) => {
  const r = compileAtlas(validDataset({ ...HRA, ...FEMALE, ...extra }));
  assert.deepEqual(r.errors, []);
  return r;
};
const slugs = (a: { structures: { slug: string }[] }) => a.structures.map((s) => s.slug);
const by = (a: { structures: { slug: string }[] }, slug: string) => a.structures.find((s) => s.slug === slug) as any;
const pick = (d: Diagnostic) => ({ file: d.file, pointer: d.pointer, rule: d.rule });

test('the male atlas has shared and male structures, with their own meshes; atlas is the male atlas', () => {
  const { atlas, atlases } = ok();
  assert.ok(slugs(atlases!.male).includes('prostate'));
  assert.ok(!slugs(atlases!.male).includes('uterus'));
  assert.deepEqual(by(atlases!.male, 'urinary-bladder').meshes, ['bp3d:FJ6000']);
  assert.equal(JSON.stringify(atlas), JSON.stringify(atlases!.male));
});

test('the female atlas drops male and hidden structures, applies mesh variants, and reattaches orphans', () => {
  const { atlases } = ok();
  const f = atlases!.female;
  assert.ok(slugs(f).includes('uterus'));
  assert.ok(!slugs(f).includes('prostate'));
  assert.ok(!slugs(f).includes('skin'));
  assert.deepEqual(by(f, 'urinary-bladder').meshes, ['hra:urinary-bladder-female/VH_F_urinary_bladder']);
  assert.equal(by(f, 'urinary-bladder').variants, undefined);
  assert.equal(by(f, 'skin-of-thumb').parent, 'human-body');
  assert.ok(by(f, 'human-body').children.includes('skin-of-thumb'));
  assert.ok(!by(f, 'human-body').children.includes('skin'));
  assert.equal(by(f, 'uterus').sex, 'female');
});

test('each atlas has its own mesh index', () => {
  const { atlases } = ok();
  assert.ok(atlases!.female.meshIndex['hra:uterus-female/VH_F_uterus']);
  assert.equal(atlases!.female.meshIndex['bp3d:FJ5000'], undefined);
  assert.equal(atlases!.female.meshIndex['bp3d:FJ2810'], undefined);
  assert.equal(atlases!.male.meshIndex['hra:uterus-female/VH_F_uterus'], undefined);
});

test('attributions are per model, HRA credited with the DOIs of the organs it shows', () => {
  const { atlases } = ok();
  assert.ok(!atlases!.male.attributions.some((a) => a.source === 'hra'));
  const hra = atlases!.female.attributions.find((a) => a.source === 'hra')!;
  assert.deepEqual(hra.dois, [
    { organ: 'urinary-bladder-female', doi: '10.48539/HBM595.LMKX.573' },
    { organ: 'uterus-female', doi: '10.48539/HBM627.VTKD.892' },
  ]);
});

test('mesh-unique is per model: a male-only and a female-only structure may share a mesh', () => {
  ok({ 'structures/organ/uterus.yaml': { ...FEMALE['structures/organ/uterus.yaml'], meshes: ['bp3d:FJ5000'] } });
});

test('mesh-unique still applies within one model', () => {
  const { errors } = compileAtlas(validDataset({ ...HRA, ...FEMALE,
    'structures/organ/uterus.yaml': { ...FEMALE['structures/organ/uterus.yaml'], meshes: ['hra:urinary-bladder-female/VH_F_urinary_bladder'] } }));
  // reported on the second structure in slug order
  assert.deepEqual(errors.map(pick), [{ file: 'structures/organ/uterus.yaml', pointer: '/meshes/0', rule: 'mesh-unique' }]);
});

test('variant-shape: a sex-specific structure cannot have variants', () => {
  const { errors } = compileAtlas(validDataset({ ...HRA, ...FEMALE,
    'structures/organ/prostate.yaml': { ...FEMALE['structures/organ/prostate.yaml'], variants: { female: { hidden: true } } } }));
  assert.deepEqual(errors.map(pick), [{ file: 'structures/organ/prostate.yaml', pointer: '/variants', rule: 'variant-shape' }]);
});

test('variant-shape: a bilateral structure varies its sides, not root meshes', () => {
  const { errors } = compileAtlas(validDataset({ ...HRA, ...FEMALE,
    'structures/bone/femur.yaml': {
      slug: 'femur', kind: 'bone', laterality: 'bilateral', status: 'draft', parent: 'human-body', labels: lbl('femur'),
      sides: { left: { meshes: ['bp3d:FJ3259M'] }, right: { meshes: ['bp3d:FJ3259'] } },
      variants: { female: { meshes: ['bp3d:FJ9999'] } },
    } }));
  assert.deepEqual(errors.map(pick), [{ file: 'structures/bone/femur.yaml', pointer: '/variants/female', rule: 'variant-shape' }]);
});

test('variant mesh references are checked like any other', () => {
  const { errors } = compileAtlas(validDataset({ ...HRA, ...FEMALE,
    'structures/organ/urinary-bladder.yaml': { ...FEMALE['structures/organ/urinary-bladder.yaml'], variants: { female: { meshes: ['xyz:nope'] } } } }));
  assert.deepEqual(errors.map(pick), [{ file: 'structures/organ/urinary-bladder.yaml', pointer: '/variants/female/meshes/0', rule: 'mesh-ref' }]);
});
