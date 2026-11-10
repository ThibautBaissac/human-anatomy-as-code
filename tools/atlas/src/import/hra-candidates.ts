// HRA organ files → candidate structures: the nodes of each file, their names, sides and identifiers.
// Reads the GLB and its crosswalk; knows nothing of the data directory.
import { readFileSync } from 'node:fs';
import type { NodeIO, Node } from '@gltf-transform/core';
import { parseCsv } from './wikidata.ts';
import type { Ids, Side } from '../types.ts';
import type { HraImportReport, HraOverrides } from '../import-hra.ts';

/** A node of an organ file that may become a structure (or one side of one). */
export interface Candidate {
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

const SIDE_EN = /\b(left|right)\b\s*/gi;

function sideOf(node: string, label: string): Side | null {
  if (/_L$|_left_|^VH_F_left_/i.test(node) || /\bleft\b/i.test(label)) return 'left';
  if (/_R$|_right_|^VH_F_right_/i.test(node) || /\bright\b/i.test(label)) return 'right';
  return null;
}
const humanize = (node: string) => node.replace(/^VH_F_/, '').replace(/_(L|R)$/, '').replace(/_/g, ' ');
export const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function parseId(id: unknown): Ids {
  const m = /^(FMA|UBERON):(\d+)$/.exec(String(id ?? ''));
  if (!m) return {};
  return m[1] === 'FMA' ? { fma: Number(m[2]) } : { uberon: m[2] };
}

export function readCrosswalk(path: string): Map<string, { id: string; label: string }> {
  const out = new Map<string, { id: string; label: string }>();
  let text: string;
  try { text = readFileSync(path, 'utf8'); } catch { return out; }
  const [header, ...rows] = parseCsv(text);
  const i = { node: header.indexOf('node_name'), id: header.indexOf('OntologyID'), label: header.indexOf('label') };
  for (const r of rows) if (r[i.node]) out.set(r[i.node], { id: r[i.id], label: r[i.label] });
  return out;
}

/** Candidates of one organ file: its root (deepest mesh-less ancestor common to all meshes) and the nodes below. */
export async function organCandidates(io: NodeIO, path: string, organ: string, crosswalk: Map<string, { id: string; label: string }>, o: HraOverrides, divergences: HraImportReport['idDivergences']): Promise<Candidate[]> {
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

export function meshNodeNames(doc: Awaited<ReturnType<NodeIO['read']>>): string[] {
  return doc.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => n.getName());
}
