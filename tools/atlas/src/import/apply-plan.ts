// Writes planned structures into data/structures without ever losing curator work (shared by the imports).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { Document, parseDocument, type YAMLMap } from 'yaml';
import { hasReviewedSideLabels, mergeDraft, mergeLabels } from './yaml-merge.ts';
import { KIND_LAYER } from '../compile-atlas.ts';
import { byKey, listYaml } from '../fs-util.ts';
import type { Structure } from '../types.ts';

export interface ApplyReport {
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
  /** files this import owns that no planned structure matched (kept) */
  orphanedFiles: string[];
  /** patch targets that do not exist */
  missingPatchTargets: string[];
}

/** An edit to an existing structure this import does not own (e.g. a female variant on a shared structure); draft files only. */
export interface Patch {
  slug: string;
  apply(doc: Document, root: YAMLMap): void;
}

export interface ApplyOptions {
  dataDir: string;
  structures: Structure[];
  /** files this import is responsible for (orphans are reported among them only) */
  owns(structure: Record<string, unknown>): boolean;
  patches?: Patch[];
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

export function applyPlan({ dataDir, structures, owns, patches = [] }: ApplyOptions): ApplyReport {
  const rel = (p: string) => relative(dataDir, p).split(sep).join('/');
  const report: ApplyReport = {
    aborted: false, created: 0, updated: 0, unchanged: 0,
    unreadableFiles: [], duplicateSlugs: [], writeConflicts: [], aliasCollisions: [], lateralityConflicts: [], orphanedFiles: [], missingPatchTargets: [],
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
  // Patches on structures owned by another import (draft only; reviewed files are left alone).
  for (const p of patches) {
    const e = bySlug.get(p.slug);
    if (!e) { report.missingPatchTargets.push(p.slug); continue; }
    if (e.doc.get('status') === 'reviewed') continue;
    p.apply(e.doc, e.doc.contents as YAMLMap);
    const text = e.doc.toString(YAML_OPTS);
    if (text === e.text) { if (!e.matched) report.unchanged++; continue; }
    writeFileSync(e.path, text);
    e.text = text;
    report.updated++;
  }
  report.orphanedFiles = existing.filter((e) => !e.matched && owns(e.doc.toJS())).map((e) => rel(e.path)).sort(byKey);
  return report;
}
