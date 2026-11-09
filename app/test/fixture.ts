import type { Atlas, AtlasLabel } from '../src/viewer/types.ts';

const L = (text: string, status: 'draft' | 'reviewed' = 'draft', synonyms?: string[]): AtlasLabel =>
  ({ text, source: 'wikidata', status, ...(synonyms ? { synonyms } : {}) });

/** A small compiled atlas: root group, a bilateral group with a bilateral bone, an organ, an orphan skin. */
export const ATLAS: Atlas = {
  attributions: [],
  meshIndex: {},
  structures: [
    { slug: 'femur', kind: 'bone', laterality: 'bilateral', status: 'draft', parent: 'lower-limb', layer: 5, children: [], systems: ['skeletal'],
      labels: { en: L('femur'), fr: L('fémur', 'reviewed'), la: L('Os femoris') },
      sides: { left: { meshes: ['bp3d:FJ1M'], labels: { en: 'left femur', fr: 'fémur gauche' } }, right: { meshes: ['bp3d:FJ1'], labels: { en: 'right femur', fr: 'fémur droit' } } } },
    { slug: 'heart', kind: 'organ', laterality: 'midline', status: 'draft', parent: 'human-body', layer: 4, children: [], systems: ['cardiovascular', 'endocrine'],
      labels: { en: L('heart'), fr: L('cœur', 'draft', ['myocarde entier']) }, meshes: ['bp3d:FJ2'] },
    { slug: 'human-body', kind: 'group', laterality: 'midline', status: 'draft', layer: null, children: ['heart', 'lower-limb'],
      labels: { en: L('human body'), fr: L('corps humain') } },
    { slug: 'lower-limb', kind: 'group', laterality: 'bilateral', status: 'draft', parent: 'human-body', layer: null, children: ['femur', 'thigh-muscle'],
      labels: { en: L('lower limb'), fr: L('membre inférieur') },
      sides: { left: { labels: { en: 'left lower limb' } }, right: { labels: { en: 'right lower limb' } } } },
    { slug: 'skin', kind: 'skin', laterality: 'midline', status: 'draft', layer: 0, children: [],
      labels: { en: L('skin'), la: L('Cutis') }, meshes: ['bp3d:FJ3'] },
    { slug: 'thigh-muscle', kind: 'muscle', laterality: 'bilateral', status: 'draft', parent: 'lower-limb', layer: 2, children: [], systems: ['muscular'],
      labels: { en: L('thigh muscle') },
      sides: { left: { meshes: ['bp3d:FJ4M'], labels: { en: 'left thigh muscle' } }, right: { meshes: ['bp3d:FJ4'], labels: { en: 'right thigh muscle' } } } },
  ],
};

/** Instance names in the order the renderer would load them. */
export const INSTANCES = ['femur@left', 'femur@right', 'heart', 'skin', 'thigh-muscle@left', 'thigh-muscle@right'];
