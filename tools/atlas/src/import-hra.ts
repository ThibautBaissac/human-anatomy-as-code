// HRA (Human Reference Atlas) female organs → female structures in data/structures, plus the female
// variants of shared structures and the sex of male-only ones. Same merge rules as the BodyParts3D import.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO, type Node } from '@gltf-transform/core';
import { parse, parseDocument, type Document, type YAMLMap } from 'yaml';
import { parseCsv, readWikidata, type Wikidata, type WikidataRow } from './import/wikidata.ts';
import { genderOf, kindOfName, slugify, TA98_PATTERN } from './import/rules.ts';
import { applyPlan, type ApplyReport, type Patch } from './import/apply-plan.ts';
import { canonicalStructure, setOrdered, KEY_ORDER } from './import/yaml-merge.ts';
import { listYaml } from './fs-util.ts';
import { withSystems } from './import/plan.ts';
import type { Ids, Labels, Side, SideBlock, Structure, System } from './types.ts';

export interface HraOverrides {
  /** organ files used only as registration landmarks */
  skipOrgans?: string[];
  skipNodes?: string[];
  /** node pairs whose left/right are swapped in the source */
  swapSides?: [string, string][];
  /** existing structure → female geometry taken from an organ file (all its meshes, or the listed nodes) */
  variants?: Record<string, { organ: string; nodes?: string[] }>;
  /** existing structures absent from the female model */
  hidden?: string[];
  /** existing structures of the male model only */
  male?: string[];
  /** group structures created for the female model */
  groups?: Record<string, { label: string; parent: string; fr?: string }>;
  /** per organ file: parent of its top structures, optional dissection layer */
  organs?: Record<string, { parent?: string; layer?: number }>;
  /** node name → forced slug */
  slugs?: Record<string, string>;
  /** slug → kind, when the keyword rules get it wrong (e.g. "lactiferous sinus" is not a vein) */
  kinds?: Record<string, string>;
  /** node name → English label, for nodes without a usable one */
  labels?: Record<string, string>;
  /** node name → identifiers, when the GLB and its crosswalk disagree */
  ids?: Record<string, Ids>;
  /** slug → Wikidata item (QID) giving the names, when no identifier or English term finds it */
  wikidata?: Record<string, string>;
  /** slug → systems, replacing the derived ones */
  systems?: Record<string, System[]>;
}

export interface HraImportReport extends ApplyReport {
  slugCollisions: { slug: string; renamed: string }[];
  fmaConflicts: { slug: string; fma: number }[];
  /** GLB and crosswalk give different ids in the same vocabulary (the GLB is kept unless an `ids` override settles it) */
  idDivergences: { node: string; glb: string; crosswalk: string }[];
  /** organ files used but without a DOI in data/sources/hra.yaml (they would go uncredited) */
  missingDois: string[];
}

interface FilesList { organs: { id: string; file: string }[]; united?: { id: string } }

interface Candidate {
  key: string; // organ/node
  organ: string;
  node: string;
  label: string;
  side: Side | null;
  canonical: string;
  ids: Ids;
  hasMesh: boolean;
  parentKey: string | null;
}

const SIDE_FR = /\s+\b(gauche|gauches|droit|droite|droits|droites)\b/gi;
const SIDE_LA = /\s+\b(sinister|sinistra|sinistrum|sinistri|sinistrae|dexter|dextra|dextrum|dextri|dextrae)\b/gi;
const SIDE_EN = /\b(left|right)\b\s*/gi;

function sideOf(node: string, label: string): Side | null {
  if (/_L$|_left_|^VH_F_left_/i.test(node) || /\bleft\b/i.test(label)) return 'left';
  if (/_R$|_right_|^VH_F_right_/i.test(node) || /\bright\b/i.test(label)) return 'right';
  return null;
}
const humanize = (node: string) => node.replace(/^VH_F_/, '').replace(/_(L|R)$/, '').replace(/_/g, ' ');
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function parseId(id: unknown): Ids {
  const m = /^(FMA|UBERON):(\d+)$/.exec(String(id ?? ''));
  if (!m) return {};
  return m[1] === 'FMA' ? { fma: Number(m[2]) } : { uberon: m[2] };
}

function readCrosswalk(path: string): Map<string, { id: string; label: string }> {
  const out = new Map<string, { id: string; label: string }>();
  let text: string;
  try { text = readFileSync(path, 'utf8'); } catch { return out; }
  const [header, ...rows] = parseCsv(text);
  const i = { node: header.indexOf('node_name'), id: header.indexOf('OntologyID'), label: header.indexOf('label') };
  for (const r of rows) if (r[i.node]) out.set(r[i.node], { id: r[i.id], label: r[i.label] });
  return out;
}

/** Candidates of one organ file: its root (deepest mesh-less ancestor common to all meshes) and the nodes below. */
async function organCandidates(io: NodeIO, path: string, organ: string, crosswalk: Map<string, { id: string; label: string }>, o: HraOverrides, divergences: HraImportReport['idDivergences']): Promise<Candidate[]> {
  const doc = await io.read(path);
  const skip = new Set(o.skipNodes ?? []);
  const swap = new Map<string, Side>();
  for (const [a, b] of o.swapSides ?? []) { swap.set(a, sideOf(b, '') ?? 'right'); swap.set(b, sideOf(a, '') ?? 'left'); }
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const tops = scene.listChildren().filter((n) => !skip.has(n.getName()));
  const meshNodes: Node[] = [];
  const walk = (n: Node) => { if (skip.has(n.getName())) return; if (n.getMesh()) meshNodes.push(n); n.listChildren().forEach(walk); };
  tops.forEach(walk);
  const chain = (n: Node): Node[] => { const out: Node[] = []; for (let p = n.getParentNode(); p; p = p.getParentNode()) out.unshift(p); return out; };
  // deepest common mesh-less ancestor
  let root: Node | null = null;
  if (meshNodes.length) {
    const chains = meshNodes.map(chain);
    for (let i = 0; i < chains[0].length; i++) {
      const c = chains[0][i];
      if (chains.every((ch) => ch[i] === c) && !c.getMesh()) root = c; else break;
    }
  }
  const out: Candidate[] = [];
  const add = (n: Node, parentKey: string | null) => {
    if (skip.has(n.getName())) return;
    const name = n.getName();
    const x = n.getExtras() as { ontologyid?: string; label?: string };
    const cw = crosswalk.get(name);
    const label = o.labels?.[name] ?? (x.label && x.label !== '-' ? x.label : cw?.label || humanize(name));
    const side = swap.get(name) ?? sideOf(name, label);
    const canonical = lowerFirst(label.replace(SIDE_EN, '').replace(/\s+/g, ' ').trim());
    const fromGlb = parseId(x.ontologyid), fromCw = parseId(cw?.id);
    const clash = (['fma', 'uberon'] as const).some((k) => fromGlb[k] !== undefined && fromCw[k] !== undefined && fromGlb[k] !== fromCw[k]);
    if (clash && !o.ids?.[name]) divergences.push({ node: name, glb: String(x.ontologyid), crosswalk: String(cw?.id) });
    const ids: Ids = o.ids?.[name] ? { ...o.ids[name] } : { ...fromCw, ...fromGlb };
    const key = `${organ}/${name}`;
    out.push({ key, organ, node: name, label, side, canonical, ids, hasMesh: !!n.getMesh(), parentKey });
    for (const c of n.listChildren()) add(c, key);
  };
  if (root) add(root, null);
  else for (const t of tops) add(t, null);
  return out;
}

function meshNodeNames(doc: Awaited<ReturnType<NodeIO['read']>>): string[] {
  return doc.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => n.getName());
}

export async function importHra({ hraDir, filesList, wikidataCsv, dataDir, overrides = {} }: {
  hraDir: string; filesList: string; wikidataCsv: string; dataDir: string; overrides?: HraOverrides;
}): Promise<HraImportReport> {
  const o = overrides;
  const files = parse(readFileSync(filesList, 'utf8')) as FilesList;
  const wd: Wikidata = readWikidata(wikidataCsv);
  const io = new NodeIO();

  // Existing structures of the other model: their slugs and FMA ids must not be reused.
  const taken = new Set<string>();
  const takenFma = new Set<number>();
  /** parents of the existing structures: the systems of a female structure come through its ancestors up into BodyParts3D */
  const existingParents = new Map<string, string | undefined>();
  for (const p of listYaml(join(dataDir, 'structures'))) {
    const s = parse(readFileSync(p, 'utf8')) as Structure | null;
    if (s?.slug) existingParents.set(s.slug, s.parent);
    if (!s || s.sex === 'female') continue;
    taken.add(s.slug);
    for (const f of [s.ids?.fma, s.sides?.left?.ids?.fma, s.sides?.right?.ids?.fma]) if (f) takenFma.add(f);
  }

  // Candidates from every organ file except landmarks and variant sources.
  const variantOrgans = new Set(Object.values(o.variants ?? {}).map((v) => v.organ));
  const skipOrgans = new Set(o.skipOrgans ?? []);
  const organFiles = [
    ...files.organs.filter((f) => !skipOrgans.has(f.id) && !variantOrgans.has(f.id)).map((f) => ({ id: f.id, path: join(hraDir, f.id, f.file) })),
    ...(files.united ? [{ id: files.united.id, path: join(hraDir, files.united.id, 'extracted-united.glb') }] : []),
  ];
  const candidates: Candidate[] = [];
  const idDivergences: HraImportReport['idDivergences'] = [];
  for (const f of organFiles) candidates.push(...await organCandidates(io, f.path, f.id, readCrosswalk(join(hraDir, f.id, 'crosswalk.csv')), o, idDivergences));

  // Group by canonical slug: a left and a right member make a bilateral structure.
  const slugCollisions: HraImportReport['slugCollisions'] = [];
  const fmaConflicts: HraImportReport['fmaConflicts'] = [];
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const slug = o.slugs?.[c.node] ?? slugify(c.canonical);
    groups.set(slug, [...(groups.get(slug) ?? []), c]);
  }
  const slugOfKey = new Map<string, string>();
  const used = new Set<string>();
  const units: { slug: string; members: Candidate[]; bilateral: boolean }[] = [];
  for (const [base, members] of groups) {
    const left = members.find((m) => m.side === 'left'), right = members.find((m) => m.side === 'right');
    const split = !(members.length === 1 || (members.length === 2 && left && right));
    for (const part of split ? members.map((m) => [m]) : [members]) {
      const bilateral = part.length === 2;
      // a lone sided member keeps its full name
      const wanted = bilateral || !part[0].side ? base : (o.slugs?.[part[0].node] ?? slugify(lowerFirst(part[0].label)));
      // a slug of the other model gets -female; a clash inside this import gets -2, -3…
      const stem = taken.has(wanted) ? `${wanted}-female` : wanted;
      let slug = stem;
      for (let n = 2; used.has(slug) || taken.has(slug); n++) slug = `${stem}-${n}`;
      if (slug !== wanted) slugCollisions.push({ slug: wanted, renamed: slug });
      used.add(slug);
      for (const m of part) slugOfKey.set(m.key, slug);
      units.push({ slug, members: part, bilateral });
    }
  }

  const byEn = (name: string): WikidataRow | undefined => wd.byEn.get(name.toLowerCase());
  const forced = (slug: string): WikidataRow | undefined => (o.wikidata?.[slug] ? wd.byQid.get(o.wikidata[slug]) : undefined);
  const rowFor = (ids: Ids): WikidataRow | undefined => (ids.fma ? wd.byFma.get(ids.fma) : undefined) ?? (ids.uberon ? wd.byUberon.get(ids.uberon) : undefined);
  const labelFrom = (text: string | undefined, lang: 'fr' | 'la', strip: boolean) => {
    if (!text) return undefined;
    const t = strip ? text.replace(lang === 'fr' ? SIDE_FR : SIDE_LA, '').trim() : text;
    return { text: t, ...(genderOf(t, lang) ?? {}), source: 'wikidata', status: 'draft' as const };
  };
  /** fr/la names from a Wikidata item; its TA2, TA98 and QID join the root ids when the item is the whole structure. */
  const enrichFromRow = (labels: Labels, ids: Ids, row: WikidataRow | undefined, wholeStructure: boolean) => {
    const fr = labelFrom(row?.fr, 'fr', !wholeStructure), la = labelFrom(row?.la, 'la', !wholeStructure);
    if (fr) labels.fr = fr;
    if (la) labels.la = la;
    if (row && wholeStructure) Object.assign(ids, row.ta2 ? { ta2: row.ta2 } : {}, row.ta98 && TA98_PATTERN.test(row.ta98) ? { ta98: row.ta98 } : {}, { wikidata: row.qid });
  };
  const cleanFma = (slug: string, ids: Ids): Ids => {
    if (ids.fma && takenFma.has(ids.fma)) { fmaConflicts.push({ slug, fma: ids.fma }); const { fma: _, ...rest } = ids; return rest; }
    return ids;
  };

  const structures: Structure[] = [];
  for (const [slug, g] of Object.entries(o.groups ?? {})) {
    const labels: Labels = { en: { text: g.label, source: 'curated', status: 'draft' } };
    if (g.fr) labels.fr = { text: g.fr, ...(genderOf(g.fr, 'fr') ?? {}), source: 'curated', status: 'draft' };
    structures.push(canonicalStructure({ slug, kind: 'group', laterality: 'midline', status: 'draft', sex: 'female', parent: g.parent, labels }));
  }
  for (const u of units) {
    const first = u.members[0];
    const parent = first.parentKey ? slugOfKey.get(first.parentKey) : o.organs?.[first.organ]?.parent;
    const layer = o.organs?.[first.organ]?.layer;
    const labels: Labels = { en: { text: u.bilateral || !first.side ? first.canonical : lowerFirst(first.label), source: 'hra', status: 'draft' } };
    let ids: Ids = {};
    const s: Structure = { slug: u.slug, kind: o.kinds?.[u.slug] ?? kindOfName(first.canonical) ?? 'organ', laterality: 'midline', status: 'draft', sex: 'female', labels };
    if (u.bilateral) {
      s.laterality = 'bilateral';
      const L = u.members.find((m) => m.side === 'left')!, R = u.members.find((m) => m.side === 'right')!;
      const sideIds = { left: { ...L.ids }, right: { ...R.ids } };
      for (const k of ['fma', 'uberon'] as const) if (sideIds.left[k] !== undefined && sideIds.left[k] === sideIds.right[k]) { (ids as Record<string, unknown>)[k] = sideIds.left[k]; delete sideIds.left[k]; delete sideIds.right[k]; }
      s.sides = {} as Record<Side, SideBlock>;
      for (const [side, m] of [['left', L], ['right', R]] as const) {
        const block: SideBlock = {};
        const sid = cleanFma(u.slug, sideIds[side]);
        if (Object.keys(sid).length) block.ids = sid;
        if (m.hasMesh) block.meshes = [`hra:${m.key}`];
        s.sides[side] = block;
      }
      // a whole-structure item first (forced item, root ids, generic English term), else the left side's item
      const generic = forced(u.slug) ?? rowFor(ids) ?? byEn(first.canonical);
      enrichFromRow(labels, ids, generic ?? rowFor(L.ids), !!generic);
    } else {
      if (first.side) s.laterality = first.side === 'left' ? 'unpaired-left' : 'unpaired-right';
      ids = { ...first.ids };
      enrichFromRow(labels, ids, forced(u.slug) ?? rowFor(ids) ?? byEn(s.labels.en!.text), true);
      if (first.hasMesh) s.meshes = [`hra:${first.key}`];
    }
    ids = cleanFma(u.slug, ids);
    if (Object.keys(ids).length) s.ids = Object.fromEntries(['fma', 'ta2', 'ta98', 'uberon', 'wikidata'].filter((k) => (ids as Record<string, unknown>)[k] !== undefined).map((k) => [k, (ids as Record<string, unknown>)[k]])) as Ids;
    if (parent) s.parent = parent;
    if (layer !== undefined) s.layer = layer;
    structures.push(canonicalStructure(s));
  }

  // Systems, through the parents of the existing structures too (female-genital-system → genital-system).
  const planned = withSystems(structures, o.systems, existingParents);

  // Patches on shared and male structures.
  const patches: Patch[] = [];
  const set = (doc: Document, root: YAMLMap, key: string, value: unknown) => setOrdered(doc, root, key, value, KEY_ORDER);
  for (const [slug, v] of Object.entries(o.variants ?? {})) {
    const f = files.organs.find((x) => x.id === v.organ);
    if (!f) throw new Error(`variante ${slug} : organe ${v.organ} absent de la liste des fichiers HRA`);
    const names = v.nodes ?? meshNodeNames(await io.read(join(hraDir, f.id, f.file)));
    const meshes = names.map((n) => `hra:${v.organ}/${n}`).sort();
    patches.push({ slug, apply: (doc, root) => set(doc, root, 'variants', { female: { meshes } }) });
  }
  for (const slug of o.hidden ?? []) patches.push({ slug, apply: (doc, root) => set(doc, root, 'variants', { female: { hidden: true } }) });
  for (const slug of o.male ?? []) patches.push({ slug, apply: (doc, root) => set(doc, root, 'sex', 'male') });

  const applied = applyPlan({ dataDir, structures: planned, owns: (s) => s.sex === 'female', patches });
  // DOIs are kept once, in the HRA source (credits); every organ file used must have one.
  const hraSource = parse(readFileSync(join(dataDir, 'sources/hra.yaml'), 'utf8')) as { dois?: Record<string, string> };
  const shownOrgans = [...files.organs.map((f) => f.id).filter((id) => !(o.skipOrgans ?? []).includes(id)), ...(files.united ? [files.united.id] : [])];
  const missingDois = shownOrgans.filter((id) => !hraSource.dois?.[id]).sort();
  return { ...applied, slugCollisions, fmaConflicts, idDivergences, missingDois };
}
