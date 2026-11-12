// Writes the planned relations into data/structures and the external target registry (I/O shell around the pure plan).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Document, isMap, parse, parseDocument, type YAMLMap } from 'yaml';
import { parseRelationSnapshots, planRelations, type RelationsReport } from './import/relations-plan.ts';
import { KEY_ORDER, SIDE_ORDER, setOrdered } from './import/yaml-merge.ts';
import { readWikidata } from './import/wikidata.ts';
import { byKey, listYaml } from './fs-util.ts';
import type { ExternalTargets, Side, Structure } from './types.ts';

export interface ImportRelationsReport extends RelationsReport {
  /** true when nothing was written because the files on disk must be fixed first */
  aborted: boolean;
  updated: number;
  unchanged: number;
  /** YAML files that could not be parsed or have no string slug (import aborted) */
  unreadableFiles: string[];
  /** slugs or aliases claimed by more than one file (import aborted) */
  duplicateSlugs: string[];
  /** required snapshot files that do not exist, relative to the data directory (import aborted) */
  missingFiles: string[];
  /** a registry written to external-targets.yaml */
  registryWritten: boolean;
}

const YAML_OPTS = { lineWidth: 0 } as const;
const SIDES: Side[] = ['left', 'right'];
const SNAPSHOTS = ['import/relations-fma.csv', 'import/relations-wikidata.csv', 'import/wikidata-targets.csv', 'import/wikidata-fma.csv'];

interface ExistingFile { path: string; text: string; doc: Document; slug: string }

export function importRelations(dataDir: string): ImportRelationsReport {
  const report: ImportRelationsReport = {
    ignored: [], dropped: 0, conflicts: [], oppositeSide: [], lateralUnresolved: [],
    aborted: false, updated: 0, unchanged: 0, unreadableFiles: [], duplicateSlugs: [], missingFiles: [], registryWritten: false,
  };
  const abort = () => { report.aborted = true; return report; };
  const rel = (p: string) => relative(dataDir, p).split(sep).join('/');

  report.missingFiles = SNAPSHOTS.filter((f) => !existsSync(join(dataDir, f)));
  if (report.missingFiles.length) return abort();

  // Existing files, indexed by slug and aliases. Anything ambiguous aborts before the first write.
  const existing: ExistingFile[] = [];
  const claimed = new Set<string>();
  const duplicates = new Set<string>();
  const claim = (key: string) => { if (claimed.has(key)) duplicates.add(key); else claimed.add(key); };
  for (const path of listYaml(join(dataDir, 'structures'))) {
    const text = readFileSync(path, 'utf8');
    const doc = parseDocument(text);
    const slug = doc.errors.length ? undefined : doc.get('slug');
    if (typeof slug !== 'string') { report.unreadableFiles.push(rel(path)); continue; }
    existing.push({ path, text, doc, slug });
    claim(slug);
    const aliases = doc.toJS().aliases;
    if (Array.isArray(aliases)) for (const a of aliases) if (typeof a === 'string') claim(a);
  }
  report.duplicateSlugs = [...duplicates].sort(byKey);
  if (report.unreadableFiles.length || report.duplicateSlugs.length) return abort();

  const read = (f: string) => readFileSync(join(dataDir, f), 'utf8');
  const snapshots = parseRelationSnapshots(read(SNAPSHOTS[0]), read(SNAPSHOTS[1]), read(SNAPSHOTS[2]));
  const qidByFma = new Map<number, string>();
  for (const [fma, row] of readWikidata(join(dataDir, SNAPSHOTS[3])).byFma) qidByFma.set(fma, row.qid);
  const registryPath = join(dataDir, 'external-targets.yaml');
  const registryText = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : '';
  const registry = (parse(registryText) ?? {}) as ExternalTargets;

  const plan = planRelations({ structures: existing.map((e) => e.doc.toJS() as Structure), ...snapshots, registry, qidByFma });
  Object.assign(report, plan.report);

  for (const e of existing) {
    const planned = plan.relations.get(e.slug);
    const root = e.doc.contents as YAMLMap;
    setOrdered(e.doc, root, 'relations', planned?.structure, KEY_ORDER);
    if (SIDES.some((side) => planned?.[side]) && !isMap(root.get('sides', true))) setOrdered(e.doc, root, 'sides', {}, KEY_ORDER);
    const sides = root.get('sides', true);
    if (isMap(sides)) {
      for (const side of SIDES) {
        if (planned?.[side] && !sides.has(side)) setOrdered(e.doc, sides as YAMLMap, side, {}, SIDES);
        const block = (sides as YAMLMap).get(side, true);
        if (isMap(block)) setOrdered(e.doc, block as YAMLMap, 'relations', planned?.[side], SIDE_ORDER);
      }
    }
    const text = e.doc.toString(YAML_OPTS);
    if (text === e.text) { report.unchanged++; continue; }
    writeFileSync(e.path, text);
    report.updated++;
  }

  const sorted = Object.fromEntries(Object.keys(plan.registry).sort(byKey).map((k) => [k, plan.registry[k]]));
  const out = Object.keys(sorted).length ? new Document(sorted).toString(YAML_OPTS) : '';
  if (out !== registryText && (out || registryText)) { writeFileSync(registryPath, out); report.registryWritten = true; }
  return report;
}
