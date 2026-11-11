import { readFileSync, statSync } from 'node:fs';
import { byKey, listYaml } from './fs-util.ts';
import { join, relative, sep } from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { composeSideLabel } from './compose-side-label.ts';
import { MODELS, ROLES_OF, SYSTEMS, type Joint, type Lang, type Model, type Side, type SideBlock, type Source, type Structure } from './types.ts';

export interface Diagnostic {
  file: string;
  pointer: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface CompiledSide extends Omit<SideBlock, 'labels'> {
  labels: Partial<Record<Lang, string>>;
}

export interface CompiledStructure extends Omit<Structure, 'layer' | 'sides' | 'variants'> {
  layer: number | null;
  children: string[];
  sides?: Record<Side, CompiledSide>;
}

/** A joint as the viewer needs it: measurement parameters dropped. */
export type CompiledJoint = Omit<Joint, 'fit'>;

export interface Atlas {
  sources: Record<string, Source>;
  structures: CompiledStructure[];
  joints: CompiledJoint[];
  meshIndex: Record<string, { slug: string; side: Side | null }>;
  attributions: { source: string; name: string; licence: string; attribution: string; url: string; dois?: { organ: string; doi: string }[]; notice?: string }[];
}

export interface CompileResult {
  /** the male atlas (shorthand for atlases.male) */
  atlas: Atlas | null;
  /** one atlas per model, structures and meshes resolved for that model */
  atlases: Record<Model, Atlas> | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

export const KIND_LAYER: Record<string, number | null> = {
  skin: 0, fascia: 1, muscle: 2, tendon: 2, ligament: 3, artery: 3, vein: 3, lymphatic: 3, nerve: 3,
  organ: 4, cns: 4, cartilage: 5, joint: 5, bone: 5, group: null,
};

const SIDES: Side[] = ['left', 'right'];
const LANGS: Lang[] = ['en', 'fr', 'la'];

/** Every mesh reference of a structure, with its side (null at the root). */
export function meshRefs(s: Structure): { ref: string; side: Side | null; pointer: string }[] {
  const out: { ref: string; side: Side | null; pointer: string }[] = [];
  (s.meshes ?? []).forEach((ref, i) => out.push({ ref, side: null, pointer: `/meshes/${i}` }));
  for (const side of SIDES) {
    (s.sides?.[side]?.meshes ?? []).forEach((ref, i) => out.push({ ref, side, pointer: `/sides/${side}/meshes/${i}` }));
  }
  return out;
}

/** Mesh references of the female variant, with their pointers. */
export function variantRefs(s: Structure): { ref: string; side: Side | null; pointer: string }[] {
  const v = s.variants?.female;
  const out: { ref: string; side: Side | null; pointer: string }[] = [];
  (v?.meshes ?? []).forEach((ref, i) => out.push({ ref, side: null, pointer: `/variants/female/meshes/${i}` }));
  for (const side of SIDES) (v?.sides?.[side]?.meshes ?? []).forEach((ref, i) => out.push({ ref, side, pointer: `/variants/female/sides/${side}/meshes/${i}` }));
  return out;
}

/** Whether a structure exists in a model. */
export function inModel(s: Structure, model: Model): boolean {
  if (s.sex && s.sex !== model) return false;
  return !(model === 'female' && s.variants?.female?.hidden);
}

/** Mesh references a structure shows in a model (variants applied), with the pointer they come from. */
export function modelRefs(s: Structure, model: Model): { ref: string; side: Side | null; pointer: string }[] {
  const base = meshRefs(s);
  const v = model === 'female' ? s.variants?.female : undefined;
  if (!v) return base;
  const variant = variantRefs(s);
  if (v.meshes) return [...variant.filter((r) => r.side === null), ...base.filter((r) => r.side !== null)];
  const overridden = new Set(SIDES.filter((side) => v.sides?.[side]?.meshes));
  return [...base.filter((r) => r.side === null || !overridden.has(r.side)), ...variant.filter((r) => r.side !== null)];
}

/** The structure as a model shows it: variant meshes applied, variants removed. */
function resolveFor(s: Structure, model: Model): Structure {
  const { variants, ...rest } = s;
  const v = model === 'female' ? variants?.female : undefined;
  if (!v) return rest;
  const out: Structure = { ...rest };
  if (v.meshes) out.meshes = [...v.meshes];
  if (v.sides && out.sides) {
    out.sides = { ...out.sides };
    for (const side of SIDES) if (v.sides[side]?.meshes) out.sides[side] = { ...out.sides[side], meshes: [...v.sides[side]!.meshes!] };
  }
  return out;
}

/** Recursively sorts object keys so the output does not depend on how files are laid out. */
function sortKeys<T>(v: T): T {
  if (Array.isArray(v)) return v.map(sortKeys) as T;
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort(byKey).map((k) => [k, sortKeys((v as Record<string, unknown>)[k])])) as T;
  }
  return v;
}

const sorted = (xs: string[] | undefined) => (xs ? [...xs].sort(byKey) : xs);

function compileStructure(s: Structure, children: string[]): CompiledStructure {
  const { sides, layer, ...rest } = s;
  const out: CompiledStructure = { ...rest, layer: layer ?? KIND_LAYER[s.kind] ?? null, children };
  if (out.meshes) out.meshes = sorted(out.meshes);
  if (out.regions) out.regions = sorted(out.regions);
  if (out.systems) out.systems = SYSTEMS.filter((x) => out.systems!.includes(x));
  if (out.aliases) out.aliases = sorted(out.aliases);
  if (sides) {
    out.sides = {} as Record<Side, CompiledSide>;
    for (const side of SIDES) {
      const block = sides[side];
      const labels: Partial<Record<Lang, string>> = {};
      for (const lang of LANGS) {
        const canonical = s.labels[lang];
        const override = block.labels?.[lang];
        if (override) labels[lang] = override.text;
        else if (canonical) labels[lang] = composeSideLabel(canonical, lang, side);
      }
      out.sides[side] = { ...block, meshes: sorted(block.meshes), labels };
      if (!out.sides[side].meshes) delete out.sides[side].meshes;
    }
  }
  return sortKeys(out);
}

const require = createRequire(import.meta.url);
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
const validateStructure = ajv.compile(require('../schemas/structure.schema.json'));
const validateSource = ajv.compile(require('../schemas/source.schema.json'));
const validateJoint = ajv.compile(require('../schemas/joint.schema.json'));

const ROOT_SLUG = 'human-body';

interface Loaded<T> {
  file: string;
  data: T;
}

export function compileAtlas(dataDir: string): CompileResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const rel = (p: string) => relative(dataDir, p).split(sep).join('/');
  const err = (file: string, pointer: string, rule: string, message: string) => errors.push({ file, pointer, rule, message, severity: 'error' });
  const warn = (file: string, pointer: string, rule: string, message: string) => warnings.push({ file, pointer, rule, message, severity: 'warning' });

  // 0. a missing data directory is not an empty atlas
  const isDir = (p: string) => statSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false;
  if (!isDir(join(dataDir, 'structures'))) {
    err('structures/', '', 'data-dir', isDir(dataDir) ? `pas de dossier structures/ dans « ${dataDir} »` : `dossier de données « ${dataDir} » introuvable`);
    return { atlas: null, atlases: null, errors, warnings };
  }

  // 1. YAML parsing
  function load<T>(subdir: string): Loaded<T>[] {
    const out: Loaded<T>[] = [];
    for (const path of listYaml(join(dataDir, subdir))) {
      const file = rel(path);
      try {
        out.push({ file, data: parse(readFileSync(path, 'utf8')) as T });
      } catch (e) {
        err(file, '', 'yaml-parse', (e as Error).message.split('\n')[0]);
      }
    }
    return out;
  }

  // 2. JSON Schema (+ 7. laterality shape, reported as one readable error)
  const knownSourceIds = new Set<string>(); // ids of every source file, valid or not, to avoid cascading label-source errors
  const sourceFiles = load<Source>('sources').filter(({ file, data }) => {
    if (data && typeof data.id === 'string') knownSourceIds.add(data.id);
    if (validateSource(data)) return true;
    for (const e of validateSource.errors ?? []) err(file, e.instancePath, 'schema', e.message ?? 'invalid');
    return false;
  });
  const structureFiles = load<Structure>('structures').filter(({ file, data }) => {
    const ok = validateStructure(data);
    let schemaErrors = validateStructure.errors ?? [];
    const lateralityBroken = data && typeof data === 'object' && (
      (data.laterality === 'bilateral' && (!data.sides?.left || !data.sides?.right || data.meshes !== undefined)) ||
      (data.laterality !== 'bilateral' && data.sides !== undefined));
    if (lateralityBroken) {
      err(file, '/sides', 'laterality-shape', data.laterality === 'bilateral'
        ? 'une structure bilateral a deux côtés (sides.left, sides.right) et pas de meshes à la racine'
        : `une structure ${data.laterality} n'a pas de sides`);
      schemaErrors = schemaErrors.filter((e) => !e.schemaPath.startsWith('#/allOf/0') && !e.schemaPath.startsWith('#/properties/sides/required'));
    }
    const seen = new Set<string>();
    for (const e of schemaErrors) {
      const key = `${e.instancePath} ${e.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      err(file, e.instancePath, 'schema', `${e.message ?? 'invalid'}${e.params && 'allowedValues' in e.params ? ` (${(e.params.allowedValues as string[]).join(', ')})` : ''}`);
    }
    return ok && !lateralityBroken;
  });

  const jointFiles = load<Joint>('joints').filter(({ file, data }) => {
    if (validateJoint(data)) return true;
    for (const e of validateJoint.errors ?? []) err(file, e.instancePath, 'schema', e.message ?? 'invalid');
    return false;
  });
  jointFiles.sort((a, b) => byKey(a.data.slug, b.data.slug) || byKey(a.file, b.file));

  const sources: Record<string, Source> = {};
  for (const { data } of sourceFiles) sources[data.id] = data;

  structureFiles.sort((a, b) => byKey(a.data.slug, b.data.slug) || byKey(a.file, b.file));

  // 3. folder = kind, file name = slug
  for (const { file, data } of structureFiles) {
    const parts = file.split('/');
    if (parts[1] !== data.kind) err(file, '/kind', 'kind-folder', `le dossier « ${parts[1]} » ne correspond pas au kind « ${data.kind} »`);
    const base = parts[parts.length - 1].replace(/\.yaml$/, '');
    if (base !== data.slug) err(file, '/slug', 'slug-filename', `le fichier « ${base}.yaml » ne correspond pas au slug « ${data.slug} »`);
  }

  // 4. unique slugs and aliases
  const owner = new Map<string, string>(); // slug or alias -> canonical slug
  const aliasOf = new Map<string, string>();
  for (const { file, data } of structureFiles) {
    if (owner.has(data.slug)) err(file, '/slug', 'slug-unique', `slug « ${data.slug} » déjà utilisé par « ${owner.get(data.slug)} »`);
    else owner.set(data.slug, data.slug);
  }
  for (const { file, data } of structureFiles) {
    (data.aliases ?? []).forEach((a, i) => {
      if (owner.has(a)) err(file, `/aliases/${i}`, 'slug-unique', `alias « ${a} » déjà utilisé par « ${owner.get(a)} »`);
      else { owner.set(a, data.slug); aliasOf.set(a, data.slug); }
    });
  }

  // 5. parent exists
  const slugs = new Set(structureFiles.map((x) => x.data.slug));
  for (const { file, data } of structureFiles) {
    if (data.parent === undefined || slugs.has(data.parent)) continue;
    const canonical = aliasOf.get(data.parent);
    err(file, '/parent', 'parent-exists', canonical
      ? `« ${data.parent} » est un alias : utiliser le slug canonique « ${canonical} »`
      : `parent « ${data.parent} » introuvable`);
  }

  // 6. no parent cycle
  const parentOf = new Map(structureFiles.filter((x) => x.data.parent && slugs.has(x.data.parent)).map((x) => [x.data.slug, x.data.parent!]));
  const fileOf = new Map(structureFiles.map((x) => [x.data.slug, x.file]));
  const reported = new Set<string>();
  for (const start of [...slugs].sort(byKey)) {
    const path: string[] = [];
    let cur: string | undefined = start;
    while (cur !== undefined && !path.includes(cur)) { path.push(cur); cur = parentOf.get(cur); }
    if (cur === undefined) continue;
    const cycle = path.slice(path.indexOf(cur));
    const key = [...cycle].sort(byKey).join(' ');
    if (reported.has(key)) continue;
    reported.add(key);
    const first = [...cycle].sort(byKey)[0];
    err(fileOf.get(first)!, '/parent', 'parent-cycle', `cycle de parents : ${cycle.join(' → ')} → ${cur}`);
  }

  // 7b. variants: only on structures in both models, shaped like the structure
  for (const { file, data } of structureFiles) {
    const v = data.variants?.female;
    if (!data.variants) continue;
    if (data.sex) { err(file, '/variants', 'variant-shape', `une structure propre au modèle ${data.sex} n'a pas de variantes`); continue; }
    if (!v) continue;
    const bilateral = data.laterality === 'bilateral';
    if (v.hidden && (v.meshes || v.sides)) err(file, '/variants/female', 'variant-shape', 'une variante masquée ne porte pas de meshes');
    else if (bilateral && v.meshes) err(file, '/variants/female', 'variant-shape', 'une structure bilateral varie par côté (sides), pas à la racine');
    else if (!bilateral && v.sides) err(file, '/variants/female', 'variant-shape', `une structure ${data.laterality} n'a pas de sides`);
  }

  // 8-9. mesh references (variants included); each mesh belongs to one structure per model
  const meshPatterns = new Map(Object.values(sources).filter((x) => x.meshPrefix).map((x) => [x.meshPrefix!, new RegExp(x.meshPattern!)]));
  for (const { file, data } of structureFiles) {
    for (const { ref, pointer } of [...meshRefs(data), ...variantRefs(data)]) {
      const [prefix, ...rest] = ref.split(':');
      const id = rest.join(':');
      const pattern = meshPatterns.get(prefix);
      if (!pattern) err(file, pointer, 'mesh-ref', `préfixe de mesh « ${prefix} » inconnu du registre des sources`);
      else if (!pattern.test(id)) err(file, pointer, 'mesh-ref', `« ${id} » ne respecte pas le motif ${pattern.source}`);
      else {
        // a source credited per organ (HRA): every organ shown needs its DOI, or it would go uncredited
        const src = Object.values(sources).find((x) => x.meshPrefix === prefix);
        const organ = id.split('/')[0];
        if (src?.dois && !src.dois[organ]) err(file, pointer, 'mesh-doi', `organe « ${organ} » sans DOI dans la source ${src.id}`);
      }
    }
  }
  const reportedDup = new Set<string>();
  for (const model of MODELS) {
    const meshOwner = new Map<string, string>();
    for (const { file, data } of structureFiles) {
      if (!inModel(data, model)) continue;
      for (const { ref, pointer } of modelRefs(data, model)) {
        if (!meshOwner.has(ref)) { meshOwner.set(ref, data.slug); continue; }
        if (reportedDup.has(`${file}${pointer}`)) continue;
        reportedDup.add(`${file}${pointer}`);
        err(file, pointer, 'mesh-unique', meshOwner.get(ref) === data.slug
          ? `mesh « ${ref} » référencé deux fois par « ${data.slug} » (modèle ${model})`
          : `mesh « ${ref} » déjà référencé par « ${meshOwner.get(ref)} » (modèle ${model})`);
      }
    }
  }

  // 10. unique FMA ids
  const fmaOwner = new Map<number, string>();
  for (const { file, data } of structureFiles) {
    const entries: [number | undefined, string][] = [[data.ids?.fma, '/ids/fma'], ...SIDES.map((side) => [data.sides?.[side]?.ids?.fma, `/sides/${side}/ids/fma`] as [number | undefined, string])];
    for (const [fma, pointer] of entries) {
      if (fma === undefined) continue;
      if (fmaOwner.has(fma)) err(file, pointer, 'fma-unique', `FMA ${fma} déjà utilisé par « ${fmaOwner.get(fma)} »`);
      else fmaOwner.set(fma, data.slug);
    }
  }

  // 11-12. labels
  for (const { file, data } of structureFiles) {
    const sets: [Structure['labels'], string][] = [[data.labels, '/labels'], ...SIDES.map((side) => [data.sides?.[side]?.labels ?? {}, `/sides/${side}/labels`] as [Structure['labels'], string])];
    for (const [set, base] of sets) {
      for (const lang of LANGS) {
        const l = set[lang];
        if (l && l.source !== 'curated' && !knownSourceIds.has(l.source)) err(file, `${base}/${lang}/source`, 'label-source', `source « ${l.source} » absente du registre`);
      }
    }
    for (const lang of ['fr', 'la'] as const) {
      const l = data.labels[lang];
      if (!l || l.gender) continue;
      if (l.status === 'reviewed') err(file, `/labels/${lang}`, 'label-gender', `label ${lang} relu sans genre grammatical`);
      else warn(file, `/labels/${lang}`, 'label-gender', `label ${lang} sans genre grammatical`);
    }
    if (!data.parent && data.slug !== ROOT_SLUG) warn(file, '/parent', 'orphan', 'structure sans parent');
    if (!data.labels.fr) warn(file, '/labels', 'missing-fr', 'pas de label français');
    if (!data.labels.la) warn(file, '/labels', 'missing-la', 'pas de label latin');
  }

  // 13. joints: bones, sides, axes, ranges, parents, sources, models
  const structureOf = new Map(structureFiles.map((x) => [x.data.slug, x.data]));
  const jointOf = new Map(jointFiles.map((x) => [x.data.slug, x.data]));
  for (const { file, data: j } of jointFiles) {
    const bones: [string, string][] = [[j.proximal, '/proximal'], ...j.moving.map((b, i) => [b, `/moving/${i}`] as [string, string]),
      ...(j.coupled ?? []).map((c, i) => [c.bone, `/coupled/${i}/bone`] as [string, string])];
    for (const [bone, pointer] of bones) {
      const s = structureOf.get(bone);
      if (!s || s.kind !== 'bone') { err(file, pointer, 'joint-bone', s ? `« ${bone} » est de kind ${s.kind}, pas bone` : `os « ${bone} » introuvable`); continue; }
      if (j.sides && s.laterality !== 'bilateral') err(file, pointer, 'joint-side', `« ${bone} » n'est pas bilateral : pas de côtés à animer`);
      for (const model of MODELS) if (!inModel(s, model)) err(file, pointer, 'joint-model', `« ${bone} » est absent du modèle ${model}`);
    }
    if (!j.sides || !Object.keys(j.sides).length) err(file, '/sides', 'joint-sides', 'articulation jamais mesurée : lancer fit-joints');
    for (const side of SIDES) {
      const a = j.sides?.[side]?.axis;
      if (a && Math.abs(Math.hypot(...a) - 1) > 1e-3) err(file, `/sides/${side}/axis`, 'joint-axis', `axe de norme ${Math.hypot(...a).toFixed(4)}, attendu 1`);
    }
    const [lo, hi] = j.rangeDeg;
    if (!(lo < hi)) err(file, '/rangeDeg', 'joint-range', `amplitude [${lo}, ${hi}] non croissante`);
    else if (j.restDeg < lo || j.restDeg > hi) err(file, '/restDeg', 'joint-range', `repos ${j.restDeg}° hors de l'amplitude [${lo}, ${hi}]`);
    if (j.parent !== undefined && !jointOf.has(j.parent)) err(file, '/parent', 'joint-parent', `articulation parente « ${j.parent} » introuvable`);
    j.sources.forEach((src, i) => { if (!knownSourceIds.has(src)) err(file, `/sources/${i}`, 'joint-source', `source « ${src} » absente du registre`); });
    for (const lang of LANGS) {
      const l = j.labels[lang];
      if (l && l.source !== 'curated' && !knownSourceIds.has(l.source)) err(file, `/labels/${lang}/source`, 'label-source', `source « ${l.source} » absente du registre`);
    }
  }
  const jointFileOf = new Map(jointFiles.map((x) => [x.data.slug, x.file]));
  const reportedJointCycles = new Set<string>();
  for (const start of [...jointOf.keys()].sort(byKey)) {
    const path: string[] = [];
    let cur: string | undefined = start;
    while (cur !== undefined && jointOf.has(cur) && !path.includes(cur)) { path.push(cur); cur = jointOf.get(cur)!.parent; }
    if (cur === undefined || !path.includes(cur)) continue;
    const cycle = [...path.slice(path.indexOf(cur))].sort(byKey);
    if (reportedJointCycles.has(cycle.join(' '))) continue;
    reportedJointCycles.add(cycle.join(' '));
    err(jointFileOf.get(cycle[0])!, '/parent', 'joint-cycle', `cycle d'articulations : ${cycle.join(' → ')}`);
  }

  // 14. muscle actions
  for (const { file, data } of structureFiles) {
    if (!data.actions) continue;
    if (data.kind !== 'muscle') { err(file, '/actions', 'action-kind', `seul un muscle a des actions (kind ${data.kind})`); continue; }
    data.actions.forEach((a, i) => {
      const j = jointOf.get(a.joint);
      if (!j) err(file, `/actions/${i}/joint`, 'action-joint', `articulation « ${a.joint} » introuvable`);
      else if (!ROLES_OF[j.motion].includes(a.role)) err(file, `/actions/${i}/role`, 'action-role', `rôle « ${a.role} » hors du mouvement ${j.motion} (${ROLES_OF[j.motion].join(', ')})`);
      if (a.source !== 'curated' && !knownSourceIds.has(a.source)) err(file, `/actions/${i}/source`, 'action-source', `source « ${a.source} » absente du registre`);
    });
  }

  const order = (a: Diagnostic, b: Diagnostic) => byKey(a.file, b.file) || byKey(a.pointer, b.pointer) || byKey(a.rule, b.rule);
  errors.sort(order);
  warnings.sort(order);
  if (errors.length) return { atlas: null, atlases: null, errors, warnings };

  const all = structureFiles.map((x) => x.data);
  const joints = jointFiles.map((x) => x.data);
  const atlases = Object.fromEntries(MODELS.map((m) => [m, buildAtlas(all, joints, m, sources)])) as Record<Model, Atlas>;
  return { atlas: atlases.male, atlases, errors, warnings };
}

/** The atlas of one model: its structures, parents reattached past absent ones, its meshes and its credits. */
function buildAtlas(all: Structure[], joints: Joint[], model: Model, sources: Record<string, Source>): Atlas {
  const original = new Map(all.map((s) => [s.slug, s]));
  const present = new Set(all.filter((s) => inModel(s, model)).map((s) => s.slug));
  const structures = all.filter((s) => present.has(s.slug)).map((s) => {
    const r = resolveFor(s, model);
    let p = r.parent;
    while (p !== undefined && !present.has(p)) p = original.get(p)?.parent;
    if (p === undefined) delete r.parent; else r.parent = p;
    return r;
  });
  const children = new Map<string, string[]>();
  for (const s of structures) if (s.parent) children.set(s.parent, [...(children.get(s.parent) ?? []), s.slug]);

  const meshIndex: Atlas['meshIndex'] = {};
  const used = new Set<string>();
  const organs = new Map<string, Set<string>>(); // source → organs whose meshes are shown
  const prefixToSource = new Map(Object.values(sources).filter((x) => x.meshPrefix).map((x) => [x.meshPrefix!, x.id]));
  for (const s of structures) {
    for (const { ref, side } of meshRefs(s)) {
      meshIndex[ref] = { slug: s.slug, side };
      const [prefix, id] = ref.split(':');
      const src = prefixToSource.get(prefix)!;
      used.add(src);
      if (sources[src].dois) organs.set(src, (organs.get(src) ?? new Set()).add(id.split('/')[0]));
    }
    const labelSets = [s.labels, ...SIDES.map((side) => s.sides?.[side]?.labels ?? {})];
    for (const set of labelSets) for (const l of Object.values(set)) if (l && l.source !== 'curated') used.add(l.source);
    for (const a of s.actions ?? []) if (a.source !== 'curated') used.add(a.source);
  }
  for (const j of joints) {
    for (const src of j.sources) used.add(src);
    for (const l of Object.values(j.labels)) if (l && l.source !== 'curated') used.add(l.source);
  }

  return {
    sources: Object.fromEntries(Object.keys(sources).sort(byKey).map((k) => [k, sortKeys(sources[k])])),
    structures: structures.map((s) => compileStructure(s, (children.get(s.slug) ?? []).sort(byKey))),
    joints: joints.map(({ fit: _, ...j }) => sortKeys(j)),
    meshIndex: Object.fromEntries(Object.keys(meshIndex).sort(byKey).map((k) => [k, sortKeys(meshIndex[k])])),
    attributions: [...used].sort(byKey).map((id) => {
      const { name, licence, attribution, url, dois, notice } = sources[id];
      const credited = dois ? [...(organs.get(id) ?? [])].filter((o) => dois[o]).sort(byKey).map((organ) => ({ doi: dois[organ], organ })) : [];
      return { attribution, licence, name, source: id, url, ...(credited.length ? { dois: credited } : {}), ...(notice ? { notice } : {}) };
    }),
  };
}
