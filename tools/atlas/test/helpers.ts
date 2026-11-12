import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';

/** Writes a data directory: keys are paths relative to it, values are objects (dumped as YAML) or raw strings. */
export function writeDataset(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-'));
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, typeof content === 'string' ? content : stringify(content));
  }
  return dir;
}

export const sources = {
  'sources/bodyparts3d.yaml': {
    id: 'bodyparts3d', name: 'BodyParts3D', version: '4.0', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/',
    licence: 'CC-BY-4.0', attribution: 'BodyParts3D, © The Database Center for Life Science, CC BY 4.0',
    provides: ['meshes', 'labels', 'ids'], meshPrefix: 'bp3d', meshPattern: '^FJ\\d+M?$',
  },
  'sources/wikidata.yaml': {
    id: 'wikidata', name: 'Wikidata', version: '2026-11-08', url: 'https://www.wikidata.org/',
    licence: 'CC0-1.0', attribution: 'Wikidata, CC0', provides: ['labels', 'ids'],
  },
  'sources/fma.yaml': {
    id: 'fma', name: 'Foundational Model of Anatomy', version: '5.1.0', url: 'https://github.com/uw-sig/FMA',
    licence: 'CC-BY-4.0', attribution: 'FMA, University of Washington, CC BY 4.0', provides: ['labels', 'ids'],
  },
};

const lbl = (text: string, source = 'fma', extra: object = {}) => ({ text, source, status: 'draft', ...extra });

/** A small valid dataset: group root, bilateral bone with side override, midline organ, unpaired organ, muscle with alias. */
export function validStructures(): Record<string, any> {
  return {
    'structures/group/human-body.yaml': {
      slug: 'human-body', kind: 'group', laterality: 'midline', status: 'reviewed',
      labels: { en: lbl('human body'), fr: lbl('corps humain', 'wikidata', { gender: 'm' }) },
      ids: { fma: 20394 },
    },
    'structures/bone/femur.yaml': {
      slug: 'femur', kind: 'bone', laterality: 'bilateral', status: 'draft', parent: 'human-body',
      regions: ['lower-limb', 'thigh'],
      labels: {
        en: lbl('femur'),
        fr: lbl('fémur', 'wikidata', { gender: 'm' }),
        la: lbl('femur', 'wikidata', { gender: 'n' }),
      },
      ids: { fma: 9611, wikidata: 'Q178366' },
      sides: {
        left: { ids: { fma: 24475 }, meshes: ['bp3d:FJ3259M'], labels: { fr: { text: 'fémur gauche (surcharge)', source: 'curated', status: 'reviewed' } } },
        right: { ids: { fma: 24474 }, meshes: ['bp3d:FJ3259'] },
      },
    },
    'structures/organ/heart.yaml': {
      slug: 'heart', kind: 'organ', laterality: 'midline', status: 'draft', parent: 'human-body', layer: 6,
      labels: { en: lbl('heart'), fr: lbl('cœur', 'wikidata', { gender: 'm' }), la: lbl('cor', 'wikidata', { gender: 'n' }) },
      ids: { fma: 7088 }, meshes: ['bp3d:FJ2417'],
    },
    'structures/organ/spleen.yaml': {
      slug: 'spleen', kind: 'organ', laterality: 'unpaired-left', status: 'draft', parent: 'human-body',
      labels: { en: lbl('spleen'), fr: lbl('rate', 'wikidata', { gender: 'f' }), la: lbl('splen', 'wikidata', { gender: 'm' }) },
      ids: { fma: 7196 }, meshes: ['bp3d:FJ1001'],
    },
    'structures/muscle/biceps-brachii.yaml': {
      slug: 'biceps-brachii', kind: 'muscle', laterality: 'bilateral', status: 'draft', parent: 'human-body',
      aliases: ['biceps'],
      labels: { en: lbl('biceps brachii'), fr: lbl('muscle biceps brachial', 'wikidata', { gender: 'm' }) },
      sides: { left: { meshes: ['bp3d:FJ1234M'] }, right: { meshes: ['bp3d:FJ1234'] } },
    },
  };
}

export function validDataset(overrides: Record<string, unknown> = {}): string {
  const files: Record<string, unknown> = { ...sources, ...validStructures(), ...overrides };
  for (const [k, v] of Object.entries(files)) if (v === null) delete files[k];
  return writeDataset(files);
}

// Relations fixture, shared by the compile and coverage tests.
const relLbl = (text: string) => ({ text, source: 'fma', status: 'draft' });
export const rel = (type: string, target: string, extra: object = {}) => ({ type, target, source: 'fma', status: 'draft', ...extra });
export const FEM = 'structures/artery/femoral-artery.yaml';
export const POP = 'structures/artery/popliteal-artery.yaml';
export const IVC = 'structures/vein/inferior-vena-cava.yaml';
export const GON = 'structures/vein/gonadal-vein.yaml';
export const MUSCLE = 'structures/muscle/biceps-brachii.yaml';
export const REGISTRY = 'external-targets.yaml';

/** The shared fixture: valid structures plus arteries, veins and an external target. */
export function relationsFixture(): Record<string, any> {
  const base = validStructures();
  const bilateral = (slug: string, kind: string, l: string, r: string, extra: object = {}) => ({
    slug, kind, laterality: 'bilateral', status: 'draft', parent: 'human-body', labels: { en: relLbl(slug.replace(/-/g, ' ')) },
    sides: { left: { meshes: [`bp3d:${l}`] }, right: { meshes: [`bp3d:${r}`] } }, ...extra,
  });
  return {
    ...sources,
    'sources/fma.yaml': { ...sources['sources/fma.yaml'], provides: ['labels', 'ids', 'relations'] },
    'sources/wikidata.yaml': { ...sources['sources/wikidata.yaml'], provides: ['labels', 'ids', 'relations'] },
    ...base,
    [MUSCLE]: { ...base[MUSCLE], relations: [rel('innervation', 'wikidata:Q1', { source: 'wikidata' })] },
    [FEM]: bilateral('femoral-artery', 'artery', 'FJ10M', 'FJ10', { ids: { wikidata: 'Q10' } }),
    [POP]: bilateral('popliteal-artery', 'artery', 'FJ11M', 'FJ11', { relations: [rel('branch-of', 'femoral-artery')] }),
    [IVC]: { slug: 'inferior-vena-cava', kind: 'vein', laterality: 'midline', status: 'draft', parent: 'human-body', labels: { en: relLbl('inferior vena cava') }, meshes: ['bp3d:FJ20'] },
    'structures/vein/renal-vein.yaml': bilateral('renal-vein', 'vein', 'FJ21M', 'FJ21', { relations: [rel('tributary-of', 'inferior-vena-cava')] }),
    [GON]: bilateral('gonadal-vein', 'vein', 'FJ22M', 'FJ22', { sides: {
      left: { meshes: ['bp3d:FJ22M'], relations: [rel('tributary-of', 'renal-vein')] },
      right: { meshes: ['bp3d:FJ22'], relations: [rel('tributary-of', 'inferior-vena-cava')] },
    } }),
    [REGISTRY]: { Q1: { labels: { en: relLbl('tibial nerve') }, source: 'wikidata', status: 'draft' } },
  };
}

