// Shared helpers: BodyParts3D metadata + minimal OBJ parser.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function readTsv(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split('\n');
  const keys = header.split('\t');
  return lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [keys[i], v.trim()])));
}

// Material classes, checked in this order against the structure name then its is-a ancestors.
const CLASSES = [
  ['cartilage', /cartilage|intervertebral dis[ck]|symphysis|meniscus/],
  ['ligament', /ligament|fascia|aponeurosis|retinaculum/],
  ['bone', /\bbone\b|vertebra|phalanx|femur|tibia|fibula|humerus|radius|ulna|rib\b|sternum|skull|cranium|mandible|maxilla|patella|scapula|clavicle|pelvis|sacrum|coccyx|tooth|carpal|tarsal|calcaneus|talus/],
  ['muscle', /muscle|tendon|\bhead of\b.*(biceps|triceps)|inteross|lumbrical|levator|rectus|oblique|sphincter|platysma/],
  ['artery', /arter|aorta|arterial/],
  ['vein', /vein|venous|\bsinus\b|vena/],
  ['nerve', /nerve|nervous|brain|cerebr|cerebell|spinal cord|ganglion|gyrus|sulcus|thalam|nucleus|plexus|colliculus|pons|medulla|ventricle of brain|lateral ventricle/],
];

export function loadBp3d(dir) {
  const names = new Map();
  for (const tree of ['isa', 'partof']) {
    for (const r of readTsv(join(dir, `${tree}_parts_list_e.txt`))) names.set(r['concept id'], r.en);
  }
  const elements = new Map(); // concept -> Set(FJ)
  for (const tree of ['isa', 'partof']) {
    for (const r of readTsv(join(dir, `${tree}_element_parts.txt`))) {
      const c = r['concept id'];
      if (!elements.has(c)) elements.set(c, new Set());
      elements.get(c).add(r['element file id']);
    }
  }
  const isaParents = new Map();
  for (const r of readTsv(join(dir, 'isa_inclusion_relation_list.txt'))) {
    if (!isaParents.has(r['child id'])) isaParents.set(r['child id'], []);
    isaParents.get(r['child id']).push(r['parent id']);
  }
  // FJ -> most specific concept containing that mesh file (fewest elements; exact match when 1).
  const fjConcept = new Map();
  const best = new Map();
  for (const [c, fjs] of elements) {
    for (const fj of fjs) {
      const prev = best.get(fj);
      if (prev === undefined || fjs.size < prev) { best.set(fj, fjs.size); fjConcept.set(fj, c); }
    }
  }

  function ancestorsBfs(c) {
    const out = [];
    const seen = new Set([c]);
    let frontier = [c];
    while (frontier.length) {
      const next = [];
      for (const x of frontier) for (const p of isaParents.get(x) ?? []) if (!seen.has(p)) { seen.add(p); out.push(p); next.push(p); }
      frontier = next;
    }
    return out;
  }

  function classify(concept) {
    for (const c of [concept, ...ancestorsBfs(concept)]) {
      const n = (names.get(c) ?? '').toLowerCase();
      for (const [cls, re] of CLASSES) if (re.test(n)) return cls;
    }
    return 'organ';
  }

  return { names, elements, fjConcept, classify };
}

export function listObjFiles(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (/^FJ\d+M?\.obj$/i.test(e.name)) out.set(e.name.replace(/\.obj$/i, ''), join(d, e.name));
    }
  };
  walk(dir);
  return out;
}

// Returns { positions: Float32Array, indices: Uint32Array } (positions de-duplicated by OBJ index).
export function parseObj(path) {
  const pos = [];
  const idx = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const p = line.trim().split(/\s+/);
      pos.push(+p[1], +p[2], +p[3]);
    } else if (line.startsWith('f ')) {
      const f = line.trim().split(/\s+/).slice(1).map((t) => {
        const i = parseInt(t.split('/')[0], 10);
        return i < 0 ? pos.length / 3 + i : i - 1;
      });
      for (let k = 1; k + 1 < f.length; k++) idx.push(f[0], f[k], f[k + 1]);
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}
