import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Bp3d {
  /** concept id → English name */
  names: Map<string, string>;
  /** concept id → mesh file ids (FJ…) listed for it, own and descendants */
  elements: Map<string, Set<string>>;
  /** concepts of the part-of tree */
  partof: Set<string>;
  /** child → part-of parent (single parent in BodyParts3D 4.0) */
  partofParent: Map<string, string>;
  /** child → is-a parents */
  isaParents: Map<string, string[]>;
  /** concepts that have is-a children */
  isaHasChildren: Set<string>;
}

function readTsv(path: string): Record<string, string>[] {
  const [header, ...lines] = readFileSync(path, 'utf8').replace(/\r/g, '').trim().split('\n');
  const keys = header.split('\t');
  return lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [keys[i], v.trim()])));
}

export function readBp3d(dir: string): Bp3d {
  const names = new Map<string, string>();
  const partof = new Set<string>();
  for (const tree of ['isa', 'partof']) {
    for (const r of readTsv(join(dir, `${tree}_parts_list_e.txt`))) {
      names.set(r['concept id'], r.en);
      if (tree === 'partof') partof.add(r['concept id']);
    }
  }
  const elements = new Map<string, Set<string>>();
  for (const tree of ['isa', 'partof']) {
    for (const r of readTsv(join(dir, `${tree}_element_parts.txt`))) {
      const c = r['concept id'];
      if (!elements.has(c)) elements.set(c, new Set());
      elements.get(c)!.add(r['element file id']);
    }
  }
  const partofParent = new Map<string, string>();
  for (const r of readTsv(join(dir, 'partof_inclusion_relation_list.txt'))) partofParent.set(r['child id'], r['parent id']);
  const isaParents = new Map<string, string[]>();
  const isaHasChildren = new Set<string>();
  for (const r of readTsv(join(dir, 'isa_inclusion_relation_list.txt'))) {
    isaParents.set(r['child id'], [...(isaParents.get(r['child id']) ?? []), r['parent id']]);
    isaHasChildren.add(r['parent id']);
  }
  return { names, elements, partof, partofParent, isaParents, isaHasChildren };
}

export const fmaNumber = (concept: string): number => Number(concept.replace(/^FMA/, ''));
