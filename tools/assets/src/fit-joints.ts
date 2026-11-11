// fit-joints: measures the centre and axis of each side of each joint on the BodyParts3D bones,
// and writes them (with the rest angle) into data/joints/<slug>.yaml, keeping comments and layout.
// Reads structure YAML files directly: the atlas cannot be compiled before the joints are measured.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, parseDocument, type Document, type YAMLMap } from 'yaml';
import { findObjFiles, parseObj } from './obj.ts';
import { measureJoint, type JointInput, type Measured } from './joints/measure.ts';
import { toPoints, type Vec3 } from './joints/fit.ts';

type Side = 'left' | 'right';
const SIDES: Side[] = ['left', 'right'];

export interface FitReport {
  /** joint@side measured and written */
  measured: string[];
  /** joint@side whose fit error is too high: the whole joint file is left unchanged */
  refused: string[];
  /** joint@side skipped: a bone has no mesh on that side */
  skipped: string[];
  /** joints left untouched because they are reviewed (tools never modify reviewed data) */
  reviewed: string[];
}

/** A measure is written only when every number is finite and the fit error is within the threshold (NaN > x is false). */
export function accepted(m: Measured, maxRmsMm: number): boolean {
  const finite = [...m.centre, ...m.axis, m.rmsMm, m.restDeg ?? 0].every(Number.isFinite);
  return finite && m.rmsMm <= maxRmsMm;
}

function yamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...yamlFiles(p));
    else if (e.name.endsWith('.yaml')) out.push(p);
  }
  return out.sort();
}

export function fitJoints({ dataDir, objDir }: { dataDir: string; objDir: string }): FitReport {
  const meshes = new Map<string, Partial<Record<Side, string[]>>>();
  for (const f of yamlFiles(join(dataDir, 'structures'))) {
    const s = parse(readFileSync(f, 'utf8')) as { slug: string; sides?: Partial<Record<Side, { meshes?: string[] }>> };
    if (s?.sides) meshes.set(s.slug, { left: s.sides.left?.meshes, right: s.sides.right?.meshes });
  }
  const objFiles = findObjFiles(objDir);
  const cache = new Map<string, Vec3[]>();
  const vertices = (ref: string): Vec3[] => {
    if (!cache.has(ref)) {
      const path = objFiles.get(ref.replace(/^bp3d:/, ''));
      if (!path) throw new Error(`mesh introuvable : ${ref}`);
      cache.set(ref, toPoints(parseObj(path).positions));
    }
    return cache.get(ref)!;
  };

  const report: FitReport = { measured: [], refused: [], skipped: [], reviewed: [] };
  for (const file of yamlFiles(join(dataDir, 'joints'))) {
    const doc: Document = parseDocument(readFileSync(file, 'utf8'));
    const joint = doc.toJS() as JointInput & { status?: string };
    if (joint.status === 'reviewed') { report.reviewed.push(joint.slug); continue; }
    const results: [Side, Measured][] = [];
    let refused = false;
    for (const side of SIDES) {
      const slugs = [joint.proximal, ...joint.moving];
      const refs = slugs.map((slug) => meshes.get(slug)?.[side]);
      if (refs.some((r) => !r?.length)) { report.skipped.push(`${joint.slug}@${side}`); continue; }
      const bones = Object.fromEntries(slugs.map((slug, i) => [slug, refs[i]!.flatMap(vertices)]));
      const m = measureJoint(joint, bones);
      if (!accepted(m, joint.fit.maxRmsMm)) {
        report.refused.push(`${joint.slug}@${side} : erreur d'ajustement ${m.rmsMm} mm > maxRmsMm ${joint.fit.maxRmsMm}`);
        refused = true;
      } else results.push([side, m]);
    }
    if (refused || !results.length) continue;
    for (const [side, m] of results) {
      const node = doc.createNode({ centre: m.centre, axis: m.axis, rmsMm: m.rmsMm }) as YAMLMap;
      for (const key of ['centre', 'axis']) (node.get(key, true) as unknown as { flow: boolean }).flow = true;
      doc.setIn(['sides', side], node);
      report.measured.push(`${joint.slug}@${side}`);
    }
    const rests = results.map(([, m]) => m.restDeg).filter((r): r is number => r !== undefined);
    if (rests.length) doc.set('restDeg', Math.round((rests.reduce((a, b) => a + b, 0) / rests.length) * 10) / 10);
    writeFileSync(file, doc.toString({ lineWidth: 0 }));
  }
  return report;
}
