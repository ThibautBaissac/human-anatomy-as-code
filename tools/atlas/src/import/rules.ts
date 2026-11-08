// Fixed tables used by the BodyParts3D import (see spec "Module d'import").

/** Kind rules, tested in order against a name; first match wins. */
export const KIND_RULES: [string, RegExp][] = [
  ['skin', /^skin$|integument/],
  ['cartilage', /cartilage|intervertebral dis[ck]|symphysis|meniscus/],
  ['fascia', /fascia|aponeurosis|retinaculum/],
  ['ligament', /ligament/],
  ['tendon', /tendon/],
  ['joint', /\bjoint\b|articulation/],
  ['bone', /\bbone\b|vertebra|phalanx|femur|tibia|fibula|humerus|radius|ulna|\brib\b|sternum|skull|cranium|mandible|maxilla|patella|scapula|clavicle|pelvis|sacrum|coccyx|tooth|carpal|tarsal|calcaneus|talus/],
  ['muscle', /muscle|\bhead of\b.*(biceps|triceps)|inteross|lumbrical|levator|rectus|oblique|sphincter|platysma|biceps|triceps/],
  ['artery', /arter|aorta|arterial/],
  ['vein', /vein|venous|\bsinus\b|vena/],
  ['lymphatic', /lymph/],
  ['cns', /brain|cerebr|cerebell|spinal cord|gyrus|sulcus|thalam|colliculus|pons|medulla|ventricle of brain|lateral ventricle/],
  ['nerve', /nerve|ganglion|plexus/],
];

export function kindOfName(name: string): string | undefined {
  const n = name.toLowerCase();
  for (const [kind, re] of KIND_RULES) if (re.test(n)) return kind;
  return undefined;
}

type GN = { gender: 'm' | 'f' | 'n'; number: 'sg' | 'pl' };
const table = (entries: [string, string | null, 'm' | 'f' | 'n'][]): Map<string, GN> => {
  const m = new Map<string, GN>();
  for (const [sg, pl, gender] of entries) {
    m.set(sg, { gender, number: 'sg' });
    if (pl && pl !== sg) m.set(pl, { gender, number: 'pl' });
  }
  return m;
};

/** First word → grammatical gender and number. "os" is singular in French. */
export const GENDER: Record<'fr' | 'la', Map<string, GN>> = {
  fr: table([
    ['muscle', 'muscles', 'm'], ['nerf', 'nerfs', 'm'], ['os', null, 'm'], ['ligament', 'ligaments', 'm'],
    ['tendon', 'tendons', 'm'], ['cartilage', 'cartilages', 'm'], ['ganglion', 'ganglions', 'm'],
    ['rameau', 'rameaux', 'm'], ['lobe', 'lobes', 'm'],
    ['artère', 'artères', 'f'], ['veine', 'veines', 'f'], ['glande', 'glandes', 'f'], ['vertèbre', 'vertèbres', 'f'],
    ['côte', 'côtes', 'f'], ['articulation', 'articulations', 'f'], ['phalange', 'phalanges', 'f'],
  ]),
  la: table([
    ['musculus', 'musculi', 'm'], ['nervus', 'nervi', 'm'], ['ramus', 'rami', 'm'], ['lobus', 'lobi', 'm'],
    ['arteria', 'arteriae', 'f'], ['vena', 'venae', 'f'], ['vertebra', 'vertebrae', 'f'], ['costa', 'costae', 'f'],
    ['glandula', 'glandulae', 'f'], ['cartilago', 'cartilagines', 'f'], ['phalanx', 'phalanges', 'f'],
    ['os', 'ossa', 'n'], ['ligamentum', 'ligamenta', 'n'],
  ]),
};

export function genderOf(text: string, lang: 'fr' | 'la'): GN | undefined {
  const first = text.trim().split(/[\s,]+/)[0]?.toLowerCase() ?? '';
  return GENDER[lang].get(first);
}

/** Part-of ancestor name (side word removed) → regions. */
export const REGION_OF_ANCESTOR: Record<string, string[]> = {
  head: ['head'],
  neck: ['neck'],
  thorax: ['thorax'],
  abdomen: ['abdomen'],
  pelvis: ['pelvis'],
  'bony pelvis': ['pelvis'],
  'back of neck': ['back'],
  'back of thorax': ['back'],
  'back of abdomen': ['back'],
  'upper limb': ['upper-limb'],
  'free upper limb': ['upper-limb'],
  'lower limb': ['lower-limb'],
  'free lower limb': ['lower-limb'],
  arm: ['arm', 'upper-limb'],
  forearm: ['forearm', 'upper-limb'],
  hand: ['hand', 'upper-limb'],
  thigh: ['thigh', 'lower-limb'],
  leg: ['leg', 'lower-limb'],
  foot: ['foot', 'lower-limb'],
};

export const SIDE_PREFIX = /^(left|right) (.+)$/;

/**
 * The side word of a lateralised name and the canonical name without it.
 * Only a name with exactly one "left" or "right" as a whole word qualifies.
 */
export function splitSide(name: string): { side: 'left' | 'right'; canonical: string; prefix: boolean } | undefined {
  const words = name.split(' ');
  const at = words.flatMap((w, i) => (w === 'left' || w === 'right' ? [i] : []));
  if (at.length !== 1) return undefined;
  const i = at[0];
  return { side: words[i] as 'left' | 'right', canonical: words.filter((_, k) => k !== i).join(' '), prefix: i === 0 };
}

/** A canonical name on the no-fold list, as itself or as the tail after "of" ("wall of ventricle"). */
export function isNoFold(canonical: string, noFold: Iterable<string>): boolean {
  for (const e of noFold) if (canonical === e || canonical.endsWith(` of ${e}`) || canonical.includes(` of ${e} `)) return true;
  return false;
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const TA98_PATTERN = /^A\d{2}\.\d\.\d{2}\.\d{3}[A-Z]?$/;
