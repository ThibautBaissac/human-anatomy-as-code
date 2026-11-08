#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { importBp3d, type ImportReport, type Overrides } from './import-bp3d.ts';
import { compileAtlas, type CompileResult, type Diagnostic } from './compile-atlas.ts';
import { coverage, coverageMarkdown } from './coverage.ts';

const USAGE = `usage:
  atlas validate <dataDir>
  atlas build <dataDir> <out.json>
  atlas coverage <dataDir>
  atlas import-bp3d <bp3dDir> <wikidata.csv> <dataDir>   (overrides : <dataDir>/import/bp3d-overrides.yaml)`;

const line = (d: Diagnostic) => `${d.file}:${d.pointer} ${d.rule} ${d.message}`;

function report({ errors, warnings }: CompileResult): void {
  for (const w of warnings) console.warn(`warning ${line(w)}`);
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
  list('fichiers absents de la source (conservés)', r.orphanedFiles, (f) => f);
  list('fichiers illisibles', r.unreadableFiles, (f) => f);
  list('slugs ou alias en double', r.duplicateSlugs, (f) => f);
  list('écritures refusées (fichier déjà présent)', r.writeConflicts, (c) => `${c.slug} → ${c.file}`);
  list('collisions d\'alias', r.aliasCollisions, (c) => `${c.slug} → ${c.file}`);
  list('latéralité conservée (label de côté relu)', r.lateralityConflicts, (s) => s);
  if (r.aborted) console.log('IMPORT ANNULÉ : aucun fichier écrit. Corriger les fichiers illisibles ou en double, puis relancer.');
}

function main(argv: string[]): number {
  const [cmd, ...args] = argv;
  if (cmd === 'validate' && args.length === 1) {
    const result = compileAtlas(args[0]);
    report(result);
    return result.errors.length ? 1 : 0;
  }
  if (cmd === 'build' && args.length === 2) {
    const result = compileAtlas(args[0]);
    report(result);
    if (!result.atlas) return 1;
    mkdirSync(dirname(args[1]), { recursive: true });
    writeFileSync(args[1], JSON.stringify(result.atlas, null, 2) + '\n');
    console.error(`écrit : ${args[1]} (${result.atlas.structures.length} structures)`);
    return 0;
  }
  if (cmd === 'coverage' && args.length === 1) {
    const result = compileAtlas(args[0]);
    if (!result.atlas) { report(result); return 1; }
    process.stdout.write(coverageMarkdown(coverage(result.atlas)));
    return 0;
  }
  if (cmd === 'import-bp3d' && args.length === 3) {
    const [bp3dDir, wikidataCsv, dataDir] = args;
    const overridesPath = join(dataDir, 'import', 'bp3d-overrides.yaml');
    const overrides = existsSync(overridesPath) ? (parse(readFileSync(overridesPath, 'utf8')) as Overrides) : {};
    const r = importBp3d({ bp3dDir, wikidataCsv, dataDir, overrides });
    printReport(r);
    if (r.aborted) return 1;
    const result = compileAtlas(dataDir);
    report(result);
    return result.errors.length ? 1 : 0;
  }
  console.error(USAGE);
  return 2;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(`erreur : ${(e as Error).message}`);
  process.exitCode = 1;
}
