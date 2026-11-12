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

/** ATLAS plus vessels, relations, an external target and an outside structure. */
export const RELATIONS_ATLAS: Atlas = {
  ...ATLAS,
  structures: [
    ...ATLAS.structures.map((x) => (x.slug === 'thigh-muscle' ? { ...x, relations: [{ type: 'innervation' as const, target: 'wikidata:Q500', source: 'wikidata', status: 'draft' as const }] } : x)),
    { slug: 'aorta', kind: 'artery', laterality: 'midline', status: 'draft', parent: 'human-body', layer: 3, children: ['abdominal-aorta'], systems: ['cardiovascular'], labels: { en: L('aorta') } },
    { slug: 'abdominal-aorta', kind: 'artery', laterality: 'midline', status: 'draft', parent: 'aorta', layer: 3, children: [], systems: ['cardiovascular'], labels: { en: L('abdominal aorta') }, meshes: ['bp3d:FJ30'],
      inverse: [{ type: 'branch-of', subject: 'renal-artery', source: 'fma', status: 'draft' }] },
    { slug: 'renal-artery', kind: 'artery', laterality: 'bilateral', status: 'draft', parent: 'human-body', layer: 3, children: [], systems: ['cardiovascular'], labels: { en: L('renal artery') },
      sides: { left: { meshes: ['bp3d:FJ31M'], labels: {} }, right: { meshes: ['bp3d:FJ31'], labels: {} } },
      relations: [{ type: 'branch-of', target: 'abdominal-aorta', source: 'fma', status: 'draft' }],
      inverse: [{ type: 'arterial-supply', subject: 'kidney', source: 'fma', status: 'draft' }] },
    { slug: 'kidney', kind: 'organ', laterality: 'bilateral', status: 'draft', parent: 'human-body', layer: 4, children: [], systems: ['urinary'], labels: { en: L('kidney') },
      sides: { left: { meshes: ['bp3d:FJ32M'], labels: {} }, right: { meshes: ['bp3d:FJ32'], labels: {} } },
      relations: [{ type: 'arterial-supply', target: 'renal-artery', source: 'fma', status: 'draft' }] },
    { slug: 'femoral-artery', kind: 'artery', laterality: 'bilateral', status: 'draft', parent: 'human-body', layer: 3, children: [], systems: ['cardiovascular'], labels: { en: L('femoral artery') },
      sides: { left: { meshes: ['bp3d:FJ33M'], labels: {} }, right: { meshes: ['bp3d:FJ33'], labels: {} } },
      inverse: [{ type: 'branch-of', subject: 'popliteal-artery', source: 'fma', status: 'draft' }, { type: 'arterial-supply', subject: 'ovary', source: 'fma', status: 'reviewed' }] },
    { slug: 'popliteal-artery', kind: 'artery', laterality: 'bilateral', status: 'draft', parent: 'human-body', layer: 3, children: [], systems: ['cardiovascular'], labels: { en: L('popliteal artery') },
      sides: { left: { meshes: ['bp3d:FJ34M'], labels: {} }, right: { meshes: ['bp3d:FJ34'], labels: {} } },
      relations: [{ type: 'branch-of', target: 'femoral-artery', source: 'fma', status: 'draft' }] },
    { slug: 'renal-vein', kind: 'vein', laterality: 'bilateral', status: 'draft', parent: 'human-body', layer: 3, children: [], systems: ['cardiovascular'], labels: { en: L('renal vein') },
      sides: { left: { meshes: ['bp3d:FJ35M'], labels: {} }, right: { meshes: ['bp3d:FJ35'], labels: {} } },
      relations: [{ type: 'tributary-of', target: 'inferior-vena-cava', source: 'fma', status: 'draft' }],
      inverse: [{ type: 'tributary-of', subject: 'gonadal-vein', side: 'left', source: 'fma', status: 'draft' }] },
    { slug: 'inferior-vena-cava', kind: 'vein', laterality: 'midline', status: 'draft', parent: 'human-body', layer: 3, children: [], systems: ['cardiovascular'], labels: { en: L('inferior vena cava') }, meshes: ['bp3d:FJ36'],
      inverse: [{ type: 'tributary-of', subject: 'renal-vein', source: 'fma', status: 'draft' }, { type: 'tributary-of', subject: 'gonadal-vein', side: 'right', source: 'fma', status: 'draft' }] },
    { slug: 'gonadal-vein', kind: 'vein', laterality: 'bilateral', status: 'draft', parent: 'human-body', layer: 3, children: [], systems: ['cardiovascular'], labels: { en: L('gonadal vein') },
      sides: { left: { meshes: ['bp3d:FJ37M'], labels: {} }, right: { meshes: ['bp3d:FJ37'], labels: {} } },
      relations: [{ type: 'tributary-of', target: 'renal-vein', side: 'left', source: 'fma', status: 'draft' }, { type: 'tributary-of', target: 'inferior-vena-cava', side: 'right', source: 'fma', status: 'draft' }] },
  ],
  externals: { 'wikidata:Q500': { labels: { fr: L('nerf tibial') } } },
  outside: { ovary: { kind: 'organ', labels: { fr: L('ovaire') } } },
};

export const RELATIONS_INSTANCES = [...INSTANCES,
  'abdominal-aorta', 'renal-artery@left', 'renal-artery@right', 'kidney@left', 'kidney@right', 'femoral-artery@left', 'femoral-artery@right',
  'popliteal-artery@left', 'popliteal-artery@right', 'renal-vein@left', 'renal-vein@right', 'inferior-vena-cava', 'gonadal-vein@left', 'gonadal-vein@right'];
