// Curation dashboard: how complete the names are, kind by kind.
import type { Atlas, CompiledStructure } from './compile-atlas.ts';
import { byKey } from './fs-util.ts';

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

/** One row per kind, most populated first, then a total row. */
export function coverage(atlas: Atlas): CoverageRow[] {
  const byKind = new Map<string, CompiledStructure[]>();
  for (const s of atlas.structures) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s]);
  const rows = [...byKind].map(([kind, list]) => row(kind, list)).sort((a, b) => b.structures - a.structures || byKey(a.kind, b.kind));
  return [...rows, row('total', atlas.structures)];
}

const pct = (n: number, d: number) => `${n} (${d ? Math.round((100 * n) / d) : 0} %)`;

export function coverageMarkdown(rows: CoverageRow[]): string {
  const out = [
    '| kind | structures | avec meshes | label fr | label la | fr sans genre | la sans genre | sans système |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const r of rows) {
    const kind = r.kind === 'total' ? '**total**' : r.kind;
    out.push(`| ${kind} | ${r.structures} | ${r.withMeshes} | ${pct(r.fr, r.structures)} | ${pct(r.la, r.structures)} | ${r.frNoGender} | ${r.laNoGender} | ${r.noSystem} |`);
  }
  return out.join('\n') + '\n';
}
