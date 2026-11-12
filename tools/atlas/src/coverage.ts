// Curation dashboard: how complete the names are, kind by kind.
import type { Atlas, CompiledStructure } from './compile-atlas.ts';
import { byKey } from './fs-util.ts';
import { RELATION_TYPES, type ExternalTargets, type RelationType, type Status } from './types.ts';

export interface CoverageRow {
  kind: string;
  structures: number;
  withMeshes: number;
  fr: number;
  la: number;
  frNoGender: number;
  laNoGender: number;
  /** structures with meshes and no system */
  noSystem: number;
}

const hasMeshes = (s: CompiledStructure) => !!(s.meshes?.length || s.sides?.left.meshes?.length || s.sides?.right.meshes?.length);

function row(kind: string, list: CompiledStructure[]): CoverageRow {
  return {
    kind,
    structures: list.length,
    withMeshes: list.filter(hasMeshes).length,
    fr: list.filter((s) => s.labels.fr).length,
    la: list.filter((s) => s.labels.la).length,
    frNoGender: list.filter((s) => s.labels.fr && !s.labels.fr.gender).length,
    laNoGender: list.filter((s) => s.labels.la && !s.labels.la.gender).length,
    noSystem: list.filter((s) => hasMeshes(s) && !s.systems?.length).length,
  };
}

export interface RelationsCoverage {
  byType: Record<RelationType, { total: number; bySource: Record<string, number>; byStatus: Record<Status, number> }>;
  missing: { arteriesWithoutBranchOf: number; veinsWithoutTributaryOf: number; musclesWithoutInnervation: number };
  externalsUsed: number;
  /** bare QIDs of registry entries no relation points to */
  registryUnused: string[];
}

/** The rows, carrying the relations report. */
export type Coverage = CoverageRow[] & { relations: RelationsCoverage };

const hasRelation = (s: CompiledStructure, type: RelationType) => !!s.relations?.some((r) => r.type === type);

function relationsCoverage(atlas: Atlas, registry: ExternalTargets): RelationsCoverage {
  const byType = Object.fromEntries(
    RELATION_TYPES.map((t) => [t, { total: 0, bySource: {} as Record<string, number>, byStatus: { draft: 0, reviewed: 0 } as Record<Status, number> }]),
  ) as RelationsCoverage['byType'];
  const targets = new Set<string>();
  for (const s of atlas.structures) {
    for (const r of s.relations ?? []) {
      const entry = byType[r.type];
      entry.total++;
      entry.bySource[r.source] = (entry.bySource[r.source] ?? 0) + 1;
      entry.byStatus[r.status]++;
      targets.add(r.target);
    }
  }
  const lacking = (kind: string, type: RelationType) => atlas.structures.filter((s) => s.kind === kind && !hasRelation(s, type)).length;
  return {
    byType,
    missing: {
      arteriesWithoutBranchOf: lacking('artery', 'branch-of'),
      veinsWithoutTributaryOf: lacking('vein', 'tributary-of'),
      musclesWithoutInnervation: lacking('muscle', 'innervation'),
    },
    externalsUsed: Object.keys(atlas.externals ?? {}).length,
    registryUnused: Object.keys(registry).filter((qid) => !targets.has(`wikidata:${qid}`)).sort(byKey),
  };
}

/** One row per kind, most populated first, then a total row; `.relations` holds the relation counts. */
export function coverage(atlas: Atlas, registry: ExternalTargets = {}): Coverage {
  const byKind = new Map<string, CompiledStructure[]>();
  for (const s of atlas.structures) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s]);
  const rows = [...byKind].map(([kind, list]) => row(kind, list)).sort((a, b) => b.structures - a.structures || byKey(a.kind, b.kind));
  return Object.assign([...rows, row('total', atlas.structures)], { relations: relationsCoverage(atlas, registry) });
}

const pct = (n: number, d: number) => `${n} (${d ? Math.round((100 * n) / d) : 0} %)`;

export function coverageMarkdown(rows: CoverageRow[] & { relations?: RelationsCoverage }): string {
  const out = [
    '| kind | structures | avec meshes | label fr | label la | fr sans genre | la sans genre | sans système |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const r of rows) {
    const kind = r.kind === 'total' ? '**total**' : r.kind;
    out.push(`| ${kind} | ${r.structures} | ${r.withMeshes} | ${pct(r.fr, r.structures)} | ${pct(r.la, r.structures)} | ${r.frNoGender} | ${r.laNoGender} | ${r.noSystem} |`);
  }
  if (rows.relations) out.push(...relationsMarkdown(rows.relations));
  return out.join('\n') + '\n';
}

const counts = (c: Record<string, number>) => Object.entries(c).map(([k, n]) => `${k} ${n}`).join(', ') || '-';

function relationsMarkdown(r: RelationsCoverage): string[] {
  const out = ['', '## Relations', '', '| type | total | sources | statuts |', '|---|---:|---|---|'];
  for (const type of RELATION_TYPES) out.push(`| ${type} | ${r.byType[type].total} | ${counts(r.byType[type].bySource)} | ${counts(r.byType[type].byStatus)} |`);
  out.push(
    '',
    `- artères sans branch-of : ${r.missing.arteriesWithoutBranchOf}`,
    `- veines sans tributary-of : ${r.missing.veinsWithoutTributaryOf}`,
    `- muscles sans innervation : ${r.missing.musclesWithoutInnervation}`,
    `- cibles externes utilisées : ${r.externalsUsed}`,
    `- entrées du registre inutilisées : ${r.registryUnused.length ? r.registryUnused.join(', ') : '-'}`,
  );
  return out;
}
