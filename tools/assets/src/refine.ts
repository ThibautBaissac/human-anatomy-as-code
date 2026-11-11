// Offline refinement of faceted meshes: one level of Phong tessellation (each triangle into four). Pure.
// BodyParts3D is only distributed at a 99 % polygon reduction: curved bones and organs show their facets.
// The scheme interpolates: original vertices stay where they are (joint fits, rigs and lengths still hold),
// only the new edge midpoints move onto the curved surface the smooth normals describe.
import { smoothNormals } from './obj.ts';
import type { Geometry } from './geometry.ts';

/** Kinds whose faceted meshes are refined: what is looked at closely and curved (vessels and nerves are thin tubes). */
export const REFINED_KINDS = ['bone', 'cartilage', 'muscle', 'organ', 'cns'];
/** Median angle (degrees) between neighbouring faces above which a mesh looks faceted. */
export const FACET_THRESHOLD = 10;
/**
 * Only meshes this light are refined: a coarse mesh has few triangles. A dense one past the threshold (a 90 000-triangle
 * abdominal muscle, an HRA mammary gland) owes its angles to fine relief, and refining it would only add weight.
 */
export const MAX_REFINED_TRIANGLES = 5000;
/** Phong tessellation shape factor: 0 keeps flat triangles, 1 follows the tangent planes fully; 0.75 is the usual value. */
const ALPHA = 0.75;

const edgeKey = (a: number, b: number) => (a < b ? a * 0x100000000 + b : b * 0x100000000 + a);

/** Number of triangles on each edge of the index topology (a sharp edge is made of duplicated vertices: one triangle). */
function edgeFaces(indices: Uint32Array): Map<number, number> {
  const count = new Map<number, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (const [a, b] of [[indices[t], indices[t + 1]], [indices[t + 1], indices[t + 2]], [indices[t + 2], indices[t]]]) {
      const k = edgeKey(a, b);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  return count;
}

/** Median angle in degrees between the faces of the edges two triangles share (sharp and open edges left out). */
export function medianDihedral({ positions: p, indices }: Geometry): number {
  const normals = new Float64Array(indices.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    normals[t] = nx / l; normals[t + 1] = ny / l; normals[t + 2] = nz / l;
  }
  const faces = new Map<number, number[]>();
  for (let t = 0; t < indices.length; t += 3) {
    for (const [a, b] of [[indices[t], indices[t + 1]], [indices[t + 1], indices[t + 2]], [indices[t + 2], indices[t]]]) {
      const k = edgeKey(a, b);
      const list = faces.get(k);
      if (list) list.push(t); else faces.set(k, [t]);
    }
  }
  const angles: number[] = [];
  for (const list of faces.values()) {
    if (list.length !== 2) continue;
    const [s, t] = list;
    const dot = normals[s] * normals[t] + normals[s + 1] * normals[t + 1] + normals[s + 2] * normals[t + 2];
    angles.push((Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI);
  }
  if (!angles.length) return 0;
  angles.sort((x, y) => x - y);
  return angles[angles.length >> 1];
}

/** Whether a mesh of this kind is refined: a listed kind (female-<kind> files included), light and faceted. */
export function needsRefine(kind: string, g: Geometry): boolean {
  return REFINED_KINDS.includes(kind.replace(/^female-/, '')) && g.indices.length / 3 <= MAX_REFINED_TRIANGLES && medianDihedral(g) > FACET_THRESHOLD;
}

/**
 * One level of Phong tessellation: every triangle into four. The midpoint of an edge two triangles share is pulled
 * towards the tangent planes at its ends; the midpoint of a sharp or open edge (one triangle) stays on the straight
 * edge, so both sides of a sharp edge meet at the same point and no crack opens.
 */
export function refine({ positions: p, indices }: Geometry): Geometry {
  const n = smoothNormals(p, indices);
  const faces = edgeFaces(indices);
  const out: number[] = Array.from(p);
  const midpoint = new Map<number, number>();
  const mid = (a: number, b: number): number => {
    const k = edgeKey(a, b);
    const known = midpoint.get(k);
    if (known !== undefined) return known;
    const ia = a * 3, ib = b * 3;
    const m = [(p[ia] + p[ib]) / 2, (p[ia + 1] + p[ib + 1]) / 2, (p[ia + 2] + p[ib + 2]) / 2];
    let q = m;
    if (faces.get(k) === 2) {
      // projection of m on the tangent plane at a vertex: m − ((m − v)·n) n
      const project = (iv: number) => {
        const d = (m[0] - p[iv]) * n[iv] + (m[1] - p[iv + 1]) * n[iv + 1] + (m[2] - p[iv + 2]) * n[iv + 2];
        return [m[0] - d * n[iv], m[1] - d * n[iv + 1], m[2] - d * n[iv + 2]];
      };
      const pa = project(ia), pb = project(ib);
      q = m.map((x, c) => (1 - ALPHA) * x + (ALPHA * (pa[c] + pb[c])) / 2);
    }
    const index = out.length / 3;
    out.push(q[0], q[1], q[2]);
    midpoint.set(k, index);
    return index;
  };
  const tris = new Uint32Array(indices.length * 4);
  for (let t = 0, o = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    tris.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], o);
    o += 12;
  }
  return { positions: new Float32Array(out), indices: tris };
}
