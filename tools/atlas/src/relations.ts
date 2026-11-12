// Anatomical relations: validation (spec 2026-11-11-relations-anatomiques). Owns the kind rules of each type.
import { TREE_TYPES, type ExternalTargets, type Relation, type RelationType, type Side, type Structure } from './types.ts';
import type { Diagnostic } from './compile-atlas.ts';
import { byKey } from './fs-util.ts';

export interface LoadedStructure {
  file: string;
  data: Structure;
}

const SIDES: Side[] = ['left', 'right'];
const WIKIDATA = /^wikidata:(Q\d+)$/;

const diag = (file: string, pointer: string, rule: string, message: string, severity: 'error' | 'warning'): Diagnostic => ({ file, pointer, rule, message, severity });

/** Side-level relations only exist on a bilateral structure. */
export function sideShapeErrors(file: string, s: Structure): Diagnostic[] {
  if (s.laterality === 'bilateral' || !s.sides) return [];
  return SIDES.filter((side) => s.sides?.[side]?.relations).map((side) =>
    diag(file, `/sides/${side}/relations`, 'relation-side-shape', `une structure ${s.laterality} n'a pas de relations par côté`, 'error'));
}

/** Kind rule of a relation: the problem as a message, or null. `targetKind` is undefined for an external target. */
function kindProblem(type: RelationType, subject: Structure, targetKind: string | undefined): { on: 'subject' | 'target'; message: string } | null {
  const wrongTarget = (expected: string) => ({ on: 'target' as const, message: `${type} attend une cible ${expected}, pas ${targetKind ?? 'une cible externe'}` });
  switch (type) {
    case 'branch-of':
      if (subject.kind !== 'artery' && subject.kind !== 'nerve') return { on: 'subject', message: `branch-of porte sur une artère ou un nerf, pas ${subject.kind}` };
      return targetKind === subject.kind ? null : wrongTarget(subject.kind);
    case 'tributary-of':
      if (subject.kind !== 'vein') return { on: 'subject', message: `tributary-of porte sur une veine, pas ${subject.kind}` };
      return targetKind === 'vein' ? null : wrongTarget('vein');
    case 'continuation-of':
      if (!['artery', 'vein', 'nerve'].includes(subject.kind)) return { on: 'subject', message: `continuation-of porte sur une artère, une veine ou un nerf, pas ${subject.kind}` };
      return targetKind === subject.kind ? null : wrongTarget(subject.kind);
    case 'arterial-supply':
      if (subject.kind === 'group') return { on: 'subject', message: 'un groupe n\'a pas de vascularisation artérielle' };
      return targetKind === 'artery' ? null : wrongTarget('artery');
    case 'innervation':
      if (subject.kind === 'group') return { on: 'subject', message: 'un groupe n\'a pas d\'innervation' };
      return targetKind === 'nerve' || targetKind === undefined ? null : wrongTarget('nerve');
  }
}

/** Validates every relation: targets, registry, sources, kinds, tree uniqueness, side shape and tree cycles. Resolution of `wikidata:` targets is a warning. */
export function validateRelations(structures: LoadedStructure[], registry: ExternalTargets, relationSources: Set<string>): Diagnostic[] {
  const out: Diagnostic[] = [];
  const bySlug = new Map(structures.map((x) => [x.data.slug, x]));
  const qidOwner = new Map<string, string>();
  for (const { data } of structures) {
    if (data.ids?.wikidata) qidOwner.set(data.ids.wikidata, data.slug);
    for (const side of SIDES) { const q = data.sides?.[side]?.ids?.wikidata; if (q) qidOwner.set(q, data.slug); }
  }

  /** A relation list with its pointer prefix and the side it holds for (null: structure level). */
  const lists = (x: LoadedStructure): { rels: Relation[]; prefix: string; side: Side | null }[] => [
    ...(x.data.relations ? [{ rels: x.data.relations, prefix: '/relations', side: null }] : []),
    ...(x.data.laterality === 'bilateral' ? SIDES.flatMap((side) => x.data.sides?.[side]?.relations ? [{ rels: x.data.sides[side].relations!, prefix: `/sides/${side}/relations`, side }] : []) : []),
  ];

  // edges of the tree graph; nodes are `slug` (non-bilateral) and `slug@side` (bilateral)
  const edges = new Map<string, Set<string>>();
  const fileOfNode = new Map<string, string>();
  const nodesOf = (s: Structure, side: Side | null): string[] => s.laterality !== 'bilateral' ? [s.slug] : side ? [`${s.slug}@${side}`] : SIDES.map((sd) => `${s.slug}@${sd}`);
  /** Side derivation: bilateral to bilateral keeps the side, otherwise every instance of the target. */
  const targetNodes = (subject: Structure, target: Structure, node: string): string[] => {
    if (target.laterality !== 'bilateral') return [target.slug];
    if (subject.laterality === 'bilateral') return [`${target.slug}@${node.split('@')[1]}`];
    return SIDES.map((sd) => `${target.slug}@${sd}`);
  };

  for (const x of structures) {
    const { file, data } = x;
    out.push(...sideShapeErrors(file, data));
    const sideTypes = new Set(SIDES.flatMap((side) => (data.laterality === 'bilateral' ? data.sides?.[side]?.relations ?? [] : []).map((r) => r.type)));
    for (const { rels, prefix, side } of lists(x)) {
      const treeSeen = new Set<RelationType>();
      rels.forEach((r, i) => {
        const at = `${prefix}/${i}`;
        if (r.source !== 'curated' && !relationSources.has(r.source)) out.push(diag(file, `${at}/source`, 'relation-source', `source « ${r.source} » absente du registre ou ne fournissant pas de relations`, 'error'));
        if (side === null && sideTypes.has(r.type)) out.push(diag(file, at, 'relation-side-mixed', `${r.type} est présent à la fois au niveau de la structure et au niveau d'un côté`, 'error'));
        if (TREE_TYPES.includes(r.type)) {
          if (treeSeen.has(r.type)) out.push(diag(file, at, 'relation-tree', `plus d'une relation ${r.type} sur ${side ? `le côté ${side}` : 'la structure'}`, 'error'));
          treeSeen.add(r.type);
        }

        // target: slug, or external (resolved to a slug when one of ours carries the QID)
        let target = r.target;
        const qid = WIKIDATA.exec(target)?.[1];
        if (qid) {
          const owner = qidOwner.get(qid);
          if (owner) {
            out.push(diag(file, `${at}/target`, 'relation-external-resolved', `« ${target} » est la structure « ${owner} » : écrire le slug`, 'warning'));
            target = owner;
          } else if (!registry[qid]) { out.push(diag(file, `${at}/target`, 'relation-external', `cible externe « ${target} » absente du registre external-targets.yaml`, 'error')); return; }
        } else if (!bySlug.has(target)) { out.push(diag(file, `${at}/target`, 'relation-target', `cible « ${target} » introuvable`, 'error')); return; }

        const targetStructure = bySlug.get(target);
        const problem = kindProblem(r.type, data, targetStructure?.data.kind);
        if (problem) { out.push(diag(file, problem.on === 'subject' ? at : `${at}/target`, 'relation-kind', problem.message, 'error')); return; }

        if (TREE_TYPES.includes(r.type) && targetStructure) {
          for (const node of nodesOf(data, side)) {
            fileOfNode.set(node, file);
            const set = edges.get(node) ?? new Set<string>();
            for (const t of targetNodes(data, targetStructure.data, node)) set.add(t);
            edges.set(node, set);
          }
        }
      });
    }
  }

  // cycles in the graph of the three tree types, sides taken into account
  const reported = new Set<string>();
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const visit = (n: string) => {
    state.set(n, 'open');
    stack.push(n);
    for (const t of [...(edges.get(n) ?? [])].sort(byKey)) {
      if (state.get(t) === 'open') {
        const cycle = stack.slice(stack.indexOf(t));
        const key = [...new Set(cycle.map((c) => c.split('@')[0]))].sort(byKey).join(' '); // left and right cycles of the same slugs are one report
        if (reported.has(key)) continue;
        reported.add(key);
        const first = [...cycle].sort(byKey)[0];
        out.push(diag(fileOfNode.get(first) ?? fileOfNode.get(n)!, '/relations', 'relation-cycle', `cycle de relations : ${cycle.join(' → ')} → ${t}`, 'error'));
      } else if (!state.has(t)) visit(t);
    }
    stack.pop();
    state.set(n, 'done');
  };
  for (const n of [...edges.keys()].sort(byKey)) if (!state.has(n)) visit(n);
  return out;
}
