// Fixed tables used by the BodyParts3D import (see spec "Module d'import").

/** Kind rules, tested in order against a name; first match wins. */
/**
 * Kind rules, tested in order against a name; first match wins.
 * Vessels and nerves come before bones and muscles: many are named after one
 * ("anterior tibial artery", "dorsal metacarpal arteries", "radial nerve").
 */
export const KIND_RULES: [string, RegExp][] = [
  ['skin', /^skin$|integument/],
  ['cartilage', /cartilage|intervertebral dis[ck]|symphysis|meniscus/],
  ['fascia', /fascia|aponeurosis|retinaculum/],
  ['ligament', /ligament/],
  ['tendon', /tendon/],
  ['joint', /\bjoint\b|articulation/],
  ['artery', /arter|aorta|arterial/],
  ['vein', /vein|venous|\bsinus\b|vena/],
  ['lymphatic', /lymph/],
  ['cns', /brain|cerebr|cerebell|spinal cord|gyrus|sulcus|thalam|colliculus|pons|medulla|ventricle of brain|lateral ventricle/],
  ['nerve', /nerve|ganglion|plexus/],
  ['bone', /\bbone\b|vertebra|phalanx|femur|tibia|fibula|humerus|radius|ulna|\brib\b|sternum|skull|cranium|mandible|maxilla|patella|scapula|clavicle|pelvis|sacrum|coccyx|tooth|carpal|tarsal|calcaneus|talus/],
  ['muscle', /muscle|\bhead of\b.*(biceps|triceps)|inteross|lumbrical|levator|rectus|oblique|sphincter|platysma|biceps|triceps/],
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

/**
 * Head noun → grammatical gender and number, with explicit singular and plural forms
 * (null when the plural is the same word). "os" is singular in French.
 * Extended from the spec's initial table with the most frequent head nouns of the real labels.
 */
export const GENDER: Record<'fr' | 'la', Map<string, GN>> = {
  fr: table([
    // masculine
    ['muscle', 'muscles', 'm'], ['nerf', 'nerfs', 'm'], ['os', null, 'm'], ['ligament', 'ligaments', 'm'],
    ['tendon', 'tendons', 'm'], ['cartilage', 'cartilages', 'm'], ['ganglion', 'ganglions', 'm'],
    ['rameau', 'rameaux', 'm'], ['lobe', 'lobes', 'm'], ['chef', 'chefs', 'm'], ['gyrus', null, 'm'],
    ['appareil', 'appareils', 'm'], ['corps', null, 'm'], ['tronc', 'troncs', 'm'], ['système', 'systèmes', 'm'],
    ['rachis', null, 'm'], ['côlon', 'côlons', 'm'], ['canal', 'canaux', 'm'], ['conduit', 'conduits', 'm'],
    ['segment', 'segments', 'm'], ['squelette', 'squelettes', 'm'], ['membre', 'membres', 'm'],
    ['lobule', 'lobules', 'm'], ['tractus', null, 'm'], ['colliculus', null, 'm'], ['cortex', null, 'm'],
    ['processus', null, 'm'], ['atrium', 'atriums', 'm'], ['ventricule', 'ventricules', 'm'], ['péritoine', null, 'm'],
    ['cœur', null, 'm'], ['foie', null, 'm'], ['rein', 'reins', 'm'], ['poumon', 'poumons', 'm'],
    ['cerveau', null, 'm'], ['cervelet', null, 'm'], ['encéphale', null, 'm'], ['estomac', null, 'm'],
    ['œsophage', null, 'm'], ['duodénum', null, 'm'], ['iléon', null, 'm'], ['jéjunum', null, 'm'],
    ['cæcum', null, 'm'], ['rectum', null, 'm'], ['pancréas', null, 'm'], ['diaphragme', null, 'm'],
    ['larynx', null, 'm'], ['pharynx', null, 'm'], ['disque', 'disques', 'm'], ['ménisque', 'ménisques', 'm'],
    ['sinus', null, 'm'], ['sillon', 'sillons', 'm'], ['noyau', 'noyaux', 'm'], ['plexus', null, 'm'],
    ['fascia', 'fascias', 'm'], ['sternum', null, 'm'], ['sacrum', null, 'm'], ['coccyx', null, 'm'],
    ['crâne', null, 'm'], ['fémur', 'fémurs', 'm'], ['tibia', 'tibias', 'm'], ['humérus', null, 'm'],
    ['radius', null, 'm'], ['thorax', null, 'm'], ['abdomen', null, 'm'], ['bassin', null, 'm'],
    ['pied', 'pieds', 'm'], ['doigt', 'doigts', 'm'], ['orteil', 'orteils', 'm'], ['tubercule', 'tubercules', 'm'],
    ['condyle', 'condyles', 'm'], ['premier', 'premiers', 'm'], ['grand', 'grands', 'm'], ['petit', 'petits', 'm'],
    // feminine
    ['artère', 'artères', 'f'], ['veine', 'veines', 'f'], ['glande', 'glandes', 'f'], ['vertèbre', 'vertèbres', 'f'],
    ['côte', 'côtes', 'f'], ['articulation', 'articulations', 'f'], ['phalange', 'phalanges', 'f'],
    ['partie', 'parties', 'f'], ['arcade', 'arcades', 'f'], ['cuspide', 'cuspides', 'f'], ['aorte', null, 'f'],
    ['valve', 'valves', 'f'], ['branche', 'branches', 'f'], ['membrane', 'membranes', 'f'],
    ['commissure', 'commissures', 'f'], ['valvule', 'valvules', 'f'], ['vésicule', 'vésicules', 'f'],
    ['voie', 'voies', 'f'], ['ceinture', 'ceintures', 'f'], ['rate', null, 'f'], ['vessie', null, 'f'],
    ['trachée', null, 'f'], ['bronche', 'bronches', 'f'], ['plèvre', 'plèvres', 'f'], ['moelle', null, 'f'],
    ['cavité', 'cavités', 'f'], ['paroi', 'parois', 'f'], ['face', 'faces', 'f'], ['tête', 'têtes', 'f'],
    ['main', 'mains', 'f'], ['jambe', 'jambes', 'f'], ['cuisse', 'cuisses', 'f'], ['clavicule', 'clavicules', 'f'],
    ['scapula', 'scapulas', 'f'], ['mandibule', null, 'f'], ['patella', null, 'f'], ['fibula', null, 'f'],
    ['ulna', null, 'f'], ['capsule', 'capsules', 'f'], ['couche', 'couches', 'f'], ['dent', 'dents', 'f'],
    ['langue', null, 'f'], ['peau', null, 'f'], ['lèvre', 'lèvres', 'f'], ['cornée', null, 'f'], ['rétine', null, 'f'],
    ['épiglotte', null, 'f'], ['prostate', null, 'f'], ['première', 'premières', 'f'], ['grande', 'grandes', 'f'],
    ['petite', 'petites', 'f'],
  ]),
  la: table([
    // masculine
    ['musculus', 'musculi', 'm'], ['nervus', 'nervi', 'm'], ['ramus', 'rami', 'm'], ['lobus', 'lobi', 'm'],
    ['arcus', null, 'm'], ['truncus', 'trunci', 'm'], ['ductus', null, 'm'], ['digitus', 'digiti', 'm'],
    ['nucleus', 'nuclei', 'm'], ['circulus', 'circuli', 'm'], ['sinus', null, 'm'], ['calcaneus', null, 'm'],
    ['oesophagus', null, 'm'], ['ventriculus', 'ventriculi', 'm'], ['lobulus', 'lobuli', 'm'], ['plexus', null, 'm'],
    ['canalis', 'canales', 'm'], ['sulcus', 'sulci', 'm'], ['gyrus', 'gyri', 'm'], ['colliculus', 'colliculi', 'm'],
    ['processus', null, 'm'], ['tractus', null, 'm'], ['cortex', null, 'm'], ['pulmo', 'pulmones', 'm'],
    ['ren', 'renes', 'm'], ['atlas', null, 'm'], ['axis', null, 'm'], ['epithalamus', null, 'm'], ['lumbus', 'lumbi', 'm'],
    // feminine
    ['arteria', 'arteriae', 'f'], ['vena', 'venae', 'f'], ['vertebra', 'vertebrae', 'f'], ['costa', 'costae', 'f'],
    ['glandula', 'glandulae', 'f'], ['cartilago', 'cartilagines', 'f'], ['phalanx', 'phalanges', 'f'],
    ['aorta', null, 'f'], ['valva', 'valvae', 'f'], ['vesica', 'vesicae', 'f'], ['membrana', 'membranae', 'f'],
    ['clavicula', 'claviculae', 'f'], ['cornea', null, 'f'], ['choroidea', null, 'f'], ['mala', null, 'f'],
    ['scapula', 'scapulae', 'f'], ['mandibula', null, 'f'], ['maxilla', 'maxillae', 'f'], ['patella', null, 'f'],
    ['tibia', null, 'f'], ['fibula', null, 'f'], ['ulna', null, 'f'], ['pleura', 'pleurae', 'f'],
    ['trachea', null, 'f'], ['lingua', null, 'f'], ['basis', null, 'f'], ['appendix', null, 'f'],
    ['epiglottis', null, 'f'], ['epididymis', null, 'f'], ['facies', null, 'f'], ['fossa', 'fossae', 'f'],
    ['capsula', 'capsulae', 'f'], ['pars', 'partes', 'f'],
    // neuter
    ['os', 'ossa', 'n'], ['ligamentum', 'ligamenta', 'n'], ['systema', 'systemata', 'n'], ['caput', 'capita', 'n'],
    ['corpus', 'corpora', 'n'], ['colon', null, 'n'], ['cuneiforme', 'cuneiformia', 'n'],
    ['intestinum', 'intestina', 'n'], ['cingulum', 'cingula', 'n'], ['abdomen', null, 'n'], ['encephalon', null, 'n'],
    ['cerebellum', null, 'n'], ['caecum', null, 'n'], ['rete', null, 'n'], ['duodenum', null, 'n'],
    ['diencephalon', null, 'n'], ['diaphragma', null, 'n'], ['vas', 'vasa', 'n'], ['ganglion', 'ganglia', 'n'],
    ['cerebrum', null, 'n'], ['sternum', null, 'n'], ['sacrum', null, 'n'], ['cor', null, 'n'], ['hepar', null, 'n'],
    ['pericardium', null, 'n'], ['peritoneum', null, 'n'], ['femur', null, 'n'], ['septum', 'septa', 'n'],
    ['foramen', 'foramina', 'n'], ['ileum', null, 'n'], ['jejunum', null, 'n'], ['rectum', null, 'n'],
  ]),
};

/** French ordinals in -ième agree with nothing: the gender comes from the next word. */
const EPICENE_FR = /^\p{L}+ième$/u;

export function genderOf(text: string, lang: 'fr' | 'la'): GN | undefined {
  const words = text.trim().toLowerCase().split(/[\s,]+/);
  let i = 0;
  while (lang === 'fr' && i < words.length - 1 && EPICENE_FR.test(words[i])) i++;
  return GENDER[lang].get(words[i] ?? '');
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
