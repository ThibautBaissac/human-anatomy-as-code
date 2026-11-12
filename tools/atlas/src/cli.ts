#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { importBp3d, type ImportReport, type Overrides } from './import-bp3d.ts';
import { importHra, type HraOverrides } from './import-hra.ts';
import { compileAtlas, type CompileResult, type Diagnostic } from './compile-atlas.ts';
import { coverage, coverageMarkdown } from './coverage.ts';
import type { ExternalTargets } from './types.ts';

const USAGE = `usage (--verbose : chaque avertissement, et non leur compte par règle) :
  atlas validate <dataDir>
  atlas build <dataDir> <outDir>      (écrit atlas-male.json et atlas-female.json)
  atlas coverage <dataDir>
  atlas import-bp3d <bp3dDir> <wikidata.csv> <dataDir>   (overrides : <dataDir>/import/bp3d-overrides.yaml)
  atlas import-hra <hraDir> <wikidata.csv> <dataDir>     (liste : <dataDir>/import/hra-files.yaml, overrides : <dataDir>/import/hra-overrides.yaml)`;

const line = (d: Diagnostic) => `${d.file}:${d.pointer} ${d.rule} ${d.message}`;

/** Errors one by one; warnings one by one with --verbose, otherwise counted by rule (thousands would bury the report). */
function report({ errors, warnings }: CompileResult): void {
  if (verbose) for (const w of warnings) console.warn(`warning ${line(w)}`);
  else {
    const byRule = new Map<string, number>();
    for (const w of warnings) byRule.set(w.rule, (byRule.get(w.rule) ?? 0) + 1);
    for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) console.warn(`warning ${rule} : ${n}`);
    if (warnings.length) console.warn('(détail des avertissements : --verbose)');
  }
  for (const e of errors) console.error(`error ${line(e)}`);
  console.error(`${errors.length} erreur(s), ${warnings.length} avertissement(s)`);
}

function printReport(r: ImportReport): void {
  const list = <T>(title: string, items: T[], fmt: (x: T) => string) => {
    console.log(`${title} : ${items.length}`);
    for (const x of items.slice(0, 50)) console.log(`  - ${fmt(x)}`);
    if (items.length > 50) console.log(`  … ${items.length - 50} de plus`);
  };
  console.log(`créées : ${r.created} · mises à jour : ${r.updated} · inchangées : ${r.unchanged} · concepts ignorés : ${r.skippedConcepts}`);
  list('égalités de propriété arbitrées', r.ties, (t) => `${t.mesh} → ${t.winner} (contre ${t.losers.join(', ')})`);
  list('conflits de parent au repli', r.parentConflicts, (c) => `${c.slug} : gardé ${c.kept}, écarté ${c.other}`);
  list('collisions de slug', r.slugCollisions, (c) => `${c.slug} → ${c.renamed}`);
  list('meshes propres d\'un concept canonique bilatéral', r.canonicalMeshConflicts, (c) => `${c.slug} : ${c.meshes.join(' ')}`);
  list('meshes sans propriétaire', r.unownedMeshes, (m) => m);
  list('overrides sans effet', r.unusedOverrides, (x) => x);
  list('fichiers absents de la source (conservés)', r.orphanedFiles, (f) => f);
  list('fichiers illisibles', r.unreadableFiles, (f) => f);
  list('slugs ou alias en double', r.duplicateSlugs, (f) => f);
  list('écritures refusées (fichier déjà présent)', r.writeConflicts, (c) => `${c.slug} → ${c.file}`);
  list('collisions d\'alias', r.aliasCollisions, (c) => `${c.slug} → ${c.file}`);
  list('latéralité conservée (label de côté relu)', r.lateralityConflicts, (s) => s);
  if (r.aborted) console.log('IMPORT ANNULÉ : aucun fichier écrit. Corriger les fichiers illisibles ou en double, puis relancer.');
}

let verbose = false;

async function main(argv: string[]): Promise<number> {
  verbose = argv.includes('--verbose');
  const [cmd, ...args] = argv.filter((a) => a !== '--verbose');
  if (cmd === 'validate' && args.length === 1) {
    const result = compileAtlas(args[0]);
    report(result);
    return result.errors.length ? 1 : 0;
  }
  if (cmd === 'build' && args.length === 2) {
    const result = compileAtlas(args[0]);
    report(result);
    if (!result.atlases) return 1;
    mkdirSync(args[1], { recursive: true });
    for (const [model, atlas] of Object.entries(result.atlases)) {
      const path = join(args[1], `atlas-${model}.json`);
      writeFileSync(path, JSON.stringify(atlas, null, 2) + '\n');
      console.error(`écrit : ${path} (${atlas.structures.length} structures)`);
    }
    return 0;
  }
  if (cmd === 'coverage' && args.length === 1) {
    const result = compileAtlas(args[0]);
    if (!result.atlas) { report(result); return 1; }
    const registryPath = join(args[0], 'external-targets.yaml');
    const registry = existsSync(registryPath) ? ((parse(readFileSync(registryPath, 'utf8')) ?? {}) as ExternalTargets) : {};
    process.stdout.write(coverageMarkdown(coverage(result.atlas, registry)));
    return 0;
  }
  if (cmd === 'import-bp3d' && args.length === 3) {
    const [bp3dDir, wikidataCsv, dataDir] = args;
    const overridesPath = join(dataDir, 'import', 'bp3d-overrides.yaml');
    const overrides = existsSync(overridesPath) ? ((parse(readFileSync(overridesPath, 'utf8')) ?? {}) as Overrides) : {}; // an empty file parses to null
    const r = importBp3d({ bp3dDir, wikidataCsv, dataDir, overrides });
    printReport(r);
    if (r.aborted) return 1;
    const result = compileAtlas(dataDir);
    report(result);
    return result.errors.length ? 1 : 0;
  }
  if (cmd === 'import-hra' && args.length === 3) {
    const [hraDir, wikidataCsv, dataDir] = args;
    const overrides = (parse(readFileSync(join(dataDir, 'import', 'hra-overrides.yaml'), 'utf8')) ?? {}) as HraOverrides;
    const r = await importHra({ hraDir, filesList: join(dataDir, 'import', 'hra-files.yaml'), wikidataCsv, dataDir, overrides });
    console.log(`créées : ${r.created} · mises à jour : ${r.updated} · inchangées : ${r.unchanged}`);
    for (const [title, items] of [['collisions de slug', r.slugCollisions.map((c) => `${c.slug} → ${c.renamed}`)], ['FMA déjà utilisés (retirés)', r.fmaConflicts.map((c) => `${c.slug} : FMA ${c.fma}`)],
      ['cibles absentes', r.missingPatchTargets], ['fichiers relus non modifiés', r.skippedReviewedPatches],
      ['organes sans DOI dans data/sources/hra.yaml', r.missingDois], ['identifiants divergents (GLB retenu)', r.idDivergences.map((d) => `${d.node} : GLB ${d.glb} / crosswalk ${d.crosswalk}`)], ['écritures refusées', r.writeConflicts.map((c) => `${c.slug} → ${c.file}`)], ['fichiers absents de la source (conservés)', r.orphanedFiles]] as [string, string[]][]) {
      if (items.length) console.log(`${title} : ${items.length}\n${items.map((i) => `  - ${i}`).join('\n')}`);
    }
    if (r.aborted) { console.log('IMPORT ANNULÉ : fichiers illisibles ou slugs en double.'); return 1; }
    const result = compileAtlas(dataDir);
    report(result);
    return result.errors.length ? 1 : 0;
  }
  console.error(USAGE);
  return 2;
}

main(process.argv.slice(2)).then((code) => (process.exitCode = code), (e) => {
  console.error(`erreur : ${(e as Error).message}`);
  process.exitCode = 1;
});
