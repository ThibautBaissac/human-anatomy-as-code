// BodyParts3D 4.0 + Wikidata → data/structures/<kind>/<slug>.yaml
// Bootstrap once, then re-run safely: YAML is authoritative, reviewed data is never touched,
// no file is ever deleted or overwritten by another structure.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { Document, parseDocument, type YAMLMap } from 'yaml';
import { readBp3d } from './import/bp3d.ts';
import { readWikidata } from './import/wikidata.ts';
import { planStructures, type Overrides, type Plan } from './import/plan.ts';
import { hasReviewedSideLabels, mergeDraft, mergeLabels } from './import/yaml-merge.ts';
import { KIND_LAYER } from './compile-atlas.ts';
import { byKey, listYaml } from './fs-util.ts';
import type { Structure } from './types.ts';

export type { Overrides } from './import/plan.ts';

export interface ImportReport extends Omit<Plan, 'structures'> {
  /** true when nothing was written because the files on disk must be fixed first */
  aborted: boolean;
  created: number;
  updated: number;
  unchanged: number;
  /** YAML files that could not be parsed or have no string slug (import aborted) */
  unreadableFiles: string[];
  /** slugs or aliases claimed by more than one file (import aborted) */
  duplicateSlugs: string[];
  /** planned writes refused because another file already sits at the target path */
  writeConflicts: { slug: string; file: string }[];
  /** planned structures that resolve, through an alias, to a file already matched by another one */
  aliasCollisions: { slug: string; file: string }[];
  /** draft structures whose laterality was kept because a reviewed side label would be lost */
  lateralityConflicts: string[];
  /** files no planned structure matched (kept) */
  orphanedFiles: string[];
}

export interface ImportOptions {
  bp3dDir: string;
  wikidataCsv: string;
  dataDir: string;
  overrides?: Overrides;
}

const YAML_OPTS = { lineWidth: 0 } as const;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface ExistingFile {
  path: string;
  text: string;
  doc: Document;
  slug: string;
  matched: boolean;
}

export function importBp3d({ bp3dDir, wikidataCsv, dataDir, overrides = {} }: ImportOptions): ImportReport {
  const { structures, ...planReport } = planStructures(readBp3d(bp3dDir), readWikidata(wikidataCsv), overrides);
  const rel = (p: string) => relative(dataDir, p).split(sep).join('/');
  const report: ImportReport = {
    ...planReport, aborted: false, created: 0, updated: 0, unchanged: 0,
    unreadableFiles: [], duplicateSlugs: [], writeConflicts: [], aliasCollisions: [], lateralityConflicts: [], orphanedFiles: [],
  };

  // Existing files, indexed by slug and aliases. Anything ambiguous aborts before the first write.
  const bySlug = new Map<string, ExistingFile>();
  const aliasToSlug = new Map<string, string>();
  const existing: ExistingFile[] = [];
  const duplicates = new Set<string>();
  const claim = (key: string, e: ExistingFile) => {
    if (bySlug.has(key) && bySlug.get(key) !== e) duplicates.add(key);
    else bySlug.set(key, e);
  };
  for (const path of listYaml(join(dataDir, 'structures'))) {
    const text = readFileSync(path, 'utf8');
    const doc = parseDocument(text);
    const slug = doc.errors.length ? undefined : doc.get('slug');
    if (typeof slug !== 'string') { report.unreadableFiles.push(rel(path)); continue; }
    const e: ExistingFile = { path, text, doc, slug, matched: false };
    existing.push(e);
    claim(slug, e);
    const aliases = doc.toJS().aliases;
    if (Array.isArray(aliases)) for (const a of aliases) if (typeof a === 'string') { claim(a, e); aliasToSlug.set(a, slug); }
  }
  report.duplicateSlugs = [...duplicates].sort(byKey);
  if (report.unreadableFiles.length || report.duplicateSlugs.length) {
    report.aborted = true;
    return report;
  }

  // Path of a file once merged; a kind or slug that is not a valid value never builds a path.
  const targetOf = (e: ExistingFile): string => {
    const kind = e.doc.get('kind');
    if (typeof kind !== 'string' || !(kind in KIND_LAYER) || !SLUG.test(e.slug)) return e.path;
    return join(dataDir, 'structures', kind, `${e.slug}.yaml`);
  };

  // A file's own slug wins over an alias: process exact matches first.
  const ownMatch = (p: Structure) => bySlug.get(p.slug)?.slug === p.slug;
  const ordered = [...structures.filter(ownMatch), ...structures.filter((p) => !ownMatch(p))];
  for (const planned of ordered) {
    const s: Structure = planned.parent && aliasToSlug.has(planned.parent) ? { ...planned, parent: aliasToSlug.get(planned.parent) } : planned;
    const e = bySlug.get(s.slug);

    if (!e) {
      const path = join(dataDir, 'structures', s.kind, `${s.slug}.yaml`);
      if (existsSync(path)) { report.writeConflicts.push({ slug: s.slug, file: rel(path) }); continue; }
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, new Document(s).toString(YAML_OPTS));
      report.created++;
      continue;
    }
    if (e.matched) { report.aliasCollisions.push({ slug: s.slug, file: rel(e.path) }); continue; }
    e.matched = true;

    const root = e.doc.contents as YAMLMap;
    if (e.doc.get('status') === 'reviewed') mergeLabels(e.doc, root, s.labels, true);
    else {
      const keepShape = s.laterality !== 'bilateral' && hasReviewedSideLabels(root);
      if (keepShape) report.lateralityConflicts.push(e.slug);
      mergeDraft(e.doc, root, { ...s, slug: e.slug }, keepShape);
    }
    const text = e.doc.toString(YAML_OPTS);
    const target = targetOf(e);
    if (text === e.text && target === e.path) { report.unchanged++; continue; }
    if (target !== e.path) {
      if (existsSync(target)) { report.writeConflicts.push({ slug: e.slug, file: rel(target) }); continue; }
      mkdirSync(dirname(target), { recursive: true });
      renameSync(e.path, target);
    }
    writeFileSync(target, text);
    report.updated++;
  }
  report.orphanedFiles = existing.filter((e) => !e.matched).map((e) => rel(e.path)).sort(byKey);
  return report;
}
