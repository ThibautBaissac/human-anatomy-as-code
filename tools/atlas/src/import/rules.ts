// Fixed tables used by the BodyParts3D import (see spec "Module d'import").
import { SYSTEMS, type System } from '../types.ts';
export { SYSTEMS, type System };

/** Kind rules, tested in order against a name; first match wins. */
/**
 * Kind rules, tested in order against a name; first match wins.
 * Vessels and nerves come before bones and muscles: many are named after one
 * ("anterior tibial artery", "dorsal metacarpal arteries", "radial nerve").
 */
export const KIND_RULES: [string, RegExp][] = [
  // a muscle named after the fascia it tenses
  ['muscle', /tensor fasciae latae/],
  ['skin', /^skin$|integument/],
  ['cartilage', /cartilage|intervertebral dis[ck]|symphysis|meniscus/],
  ['fascia', /fascia|aponeurosis|retinaculum|iliotibial tract/],
  // interosseous membranes are fibrous joints between two bones, not interosseous muscles
  ['ligament', /ligament|interosseous membrane/],
  ['tendon', /tendon/],
  ['joint', /\bjoint\b|articulation/],
  ['artery', /arter|aorta|arterial/],
  ['vein', /vein|venous|\bsinus\b|vena/],
  ['lymphatic', /lymph/],
  // whole names: their is-a ancestors ("organ with cortex and medulla") would make them CNS
  ['organ', /^((left|right) )?(kidney|spleen|(adrenal|suprarenal) gland)$/],
  ['cns', /brain|amygdal|cerebr|cerebell|spinal cord|gyrus|sulcus|thalam|colliculus|pons|medulla|ventricle of brain|lateral ventricle/],
  ['nerve', /nerve|ganglion|plexus/],
  // bone names as whole words: "tibialis", "ulnaris", "fibularis", "scapulae" are muscles
  ['bone', /\bbone\b|vertebra|phalanx|cranium|\b(femur|tibia|fibula|humerus|radius|ulna|sternum|skull|mandible|maxilla|patella|scapula|clavicle|pelvis|sacrum|coccyx|tooth|calcaneus|talus)\b|\brib\b|carpal|tarsal/],
  ['muscle', /muscle|pectoralis|\bhead of\b.*(biceps|triceps)|inteross|lumbrical|levator|rectus|oblique|sphincter|platysma|biceps|triceps|extensor|flexor|abductor|adductor|pronator|supinator|tibialis|fibularis|peroneus|subscapularis|longissimus|iliocostalis|spinalis|splenius|serratus|psoas|coccygeus|longus capitis|longus colli|trapezius|interspinales|intertransversarii/],
];

/** First letter in lower case ("Left ovary" → "left ovary"). */
export const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

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
 * A name qualifies when all its "left" or "right" whole words name the same side
 * ("branch of left middle cerebral artery to left angular gyrus"); a name with both does not.
 */
export function splitSide(name: string): { side: 'left' | 'right'; canonical: string } | undefined {
  const words = name.split(' ');
  const at = words.flatMap((w, i) => (w === 'left' || w === 'right' ? [i] : []));
  if (!at.length || at.some((i) => words[i] !== words[at[0]])) return undefined;
  return { side: words[at[0]] as 'left' | 'right', canonical: words.filter((_, k) => !at.includes(k)).join(' ') };
}

/**
 * Laterality of a structure that is not folded: the side its name gives, otherwise its geometry
 * (x extent of its meshes and of its descendants' meshes, subject's left = +x). A structure that
 * stays more than `MIDLINE_MARGIN_MM` on one side of the median plane is unpaired on that side.
 */
export const MIDLINE_MARGIN_MM = 2;
export function lateralityOf(name: string, extent: [number, number] | undefined): 'midline' | 'unpaired-left' | 'unpaired-right' {
  const split = splitSide(name);
  if (split) return split.side === 'left' ? 'unpaired-left' : 'unpaired-right';
  if (extent && extent[0] > MIDLINE_MARGIN_MM) return 'unpaired-left';
  if (extent && extent[1] < -MIDLINE_MARGIN_MM) return 'unpaired-right';
  return 'midline';
}

/**
 * Own meshes of a midline concept, by side, when every one lies more than `MIDLINE_MARGIN_MM` clear of the median
 * plane and both sides have some (veins of both feet): such a concept is bilateral. Undefined otherwise.
 */
export function lateralSplit(meshes: string[], extents: Map<string, [number, number]>): Record<'left' | 'right', string[]> | undefined {
  const out = { left: [] as string[], right: [] as string[] };
  for (const fj of meshes) {
    const e = extents.get(fj);
    if (e && e[0] > MIDLINE_MARGIN_MM) out.left.push(fj);
    else if (e && e[1] < -MIDLINE_MARGIN_MM) out.right.push(fj);
    else return undefined;
  }
  return out.left.length && out.right.length ? out : undefined;
}

/**
 * A Wikidata label made fit for the atlas: no disambiguation suffix ("Vomer (anatomia)"),
 * French as a common noun (lower-case first letter), Latin as in Terminologia Anatomica (capital first letter).
 */
export function cleanLabel(text: string, lang: 'fr' | 'la'): string {
  const t = text.replace(/\s*\([^()]*\)\s*$/, '').replace(/\s+/g, ' ').trim();
  return lang === 'fr' ? lowerFirst(t) : t ? t[0].toUpperCase() + t.slice(1) : t;
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



/** System groups of the BodyParts3D partonomy (musculoskeletal and fascial groups: the kind settles it). */
const SYSTEM_OF_GROUP: Record<string, System> = {
  'alimentary-system': 'digestive', 'cardiovascular-system': 'cardiovascular', 'vasculature-of-body': 'cardiovascular',
  'respiratory-system': 'respiratory', 'nervous-system': 'nervous', 'urinary-system': 'urinary', 'genital-system': 'genital',
  'endocrine-system': 'endocrine', 'integumentary-system': 'integumentary', integument: 'integumentary',
};

/** Name keywords per system (lower-case English names). Several may match: the pancreas is digestive and endocrine. */
const SYSTEM_RULES: [System, RegExp][] = [
  ['cardiovascular', /\bheart\b|\b(left|right) (atrium|ventricle)|ventricle of heart|interventricular septum|interatrial|cardiac|(mitral|tricuspid|aortic|pulmonary) valve|pericard|myocard|endocard|chordae tendineae|papillary muscle|coronary sinus/],
  ['lymphatic', /lymph|\bspleen\b|thymus|tonsil/],
  ['nervous', /brain|cerebr|cerebell|spinal cord|corpus callosum|commissure(?! of (lips|eyelids))|fornix|stria terminalis|telencephal|interventricular foramen/],
  ['sensory', /eyeball|\beye\b|ocular|\bretina\b|\blens\b|cornea|\biris\b|sclera|choroid(?! plexus)|ciliar|common tendinous ring|vitreous|conjunctiv|lacrimal|eyelid|auricle of ear|external ear|\bear\b|cochlea|tympan|ossicle|\bincus\b|\bmalleus\b|\bstapes\b|semicircular|labyrinth|olfactory|taste bud/],
  ['respiratory', /lung|bronch|trache|laryn|pleura|\bnose\b|nasal (cavity|septum|concha|cartilage)|alar cartilage|epiglott|glottis|vocal|pharyn|^((thoracic )?diaphragm)$|conus elasticus|thyroid cartilage|cricoid|cricothyroid|thyrohyoid|arytenoid/],
  ['digestive', /esophag|oesophag|stomach|(?<!di)gastr(?!ocnemius)|duoden|jejun|\bileum\b|\bileal\b|cecum|caecum|colon\b|mesocolon|rectum|anal canal|\banus\b|liver|hepat|gallbladder|\bbile\b|biliary|pancrea|appendix|intestin|tongue|tooth|teeth|salivary|parotid|submandibular gland|sublingual gland|pharyn|\bmouth\b|oral cavity|\blip\b|palat|peritone|mesenter|omentum|gingiv/],
  ['urinary', /kidney|\brenal\b|ureter|urinary|\bbladder\b|urethr/],
  ['genital', /testis|testic|epididym|deferen|seminal|prostat|penis|penile|scrot|\buter|ovar|fallopian|vagin|vulv|clitor|mammary|breast|spermatic|bulbourethral|labi(um|a) m(aj|in)|nipple|areol|lactiferous/],
  ['endocrine', /\bthyroid\b(?! cartilage)|parathyroid|adrenal|suprarenal|pituitar|hypophys|pineal|\bpancreas\b|islet/],
  ['integumentary', /\bskin\b|\bhair\b|\bnail\b|eyebrow|eyelash|integument/],
];

/** The only keywords that put a bone in another system: teeth chew, ossicles hear. */
const BONE_SYSTEM_RULES: [System, RegExp][] = [
  ['digestive', /tooth|teeth|molar|incisor|canine/],
  ['sensory', /ossicle|\bincus\b|\bmalleus\b|\bstapes\b/],
];

/** Kinds that always belong to their tissue system, whatever else the structure belongs to (the diaphragm is a muscle). */
const SYSTEM_OF_KIND: Record<string, System> = { bone: 'skeletal', joint: 'skeletal', muscle: 'muscular', tendon: 'muscular', fascia: 'muscular' };
/** Kinds whose system applies only when nothing else gave one (laryngeal cartilages are respiratory, uterine ligaments genital). */
const FALLBACK_OF_KIND: Record<string, System> = { cns: 'nervous', skin: 'integumentary', cartilage: 'skeletal', ligament: 'skeletal' };
/** Vessels and nerves stay in their own system: isolating the digestive system does not show the gastric arteries. */
const ONLY_OF_KIND: Record<string, System> = { artery: 'cardiovascular', vein: 'cardiovascular', lymphatic: 'lymphatic', nerve: 'nervous' };

/** Systems of a structure: system groups among its ancestors, name keywords, and its kind (spec 2026-11-09-systemes). */
export function systemsOf({ kind, name, ancestors }: { kind: string; name: string; ancestors: string[] }): System[] {
  if (ONLY_OF_KIND[kind]) return [ONLY_OF_KIND[kind]];
  const out = new Set<System>();
  for (const a of ancestors) if (SYSTEM_OF_GROUP[a]) out.add(SYSTEM_OF_GROUP[a]);
  const n = name.toLowerCase();
  // bones take only their own keywords: a lacrimal or palatine bone borders an organ but belongs to the skeleton
  for (const [system, re] of kind === 'bone' ? BONE_SYSTEM_RULES : SYSTEM_RULES) if (re.test(n)) out.add(system);
  if (SYSTEM_OF_KIND[kind]) out.add(SYSTEM_OF_KIND[kind]);
  if (!out.size && FALLBACK_OF_KIND[kind]) out.add(FALLBACK_OF_KIND[kind]);
  return SYSTEMS.filter((s) => out.has(s));
}
