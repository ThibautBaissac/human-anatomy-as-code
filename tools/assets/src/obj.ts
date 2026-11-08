import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Mesh file id (FJxxxx, FJxxxxM) → path, searched recursively. */
export function findObjFiles(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^FJ\d+M?\.obj$/i.test(e.name)) out.set(e.name.replace(/\.obj$/i, ''), p);
    }
  };
  walk(dir);
  return out;
}

/** Positions and triangle indices of an OBJ file (polygons fanned into triangles). */
export function parseObj(path: string): { positions: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer> } {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const p = line.trim().split(/\s+/);
      pos.push(+p[1], +p[2], +p[3]);
    } else if (line.startsWith('f ')) {
      const f = line.trim().split(/\s+/).slice(1).map((t) => {
        const i = parseInt(t.split('/')[0], 10);
        return i < 0 ? pos.length / 3 + i : i - 1;
      });
      for (let k = 1; k + 1 < f.length; k++) idx.push(f[0], f[k], f[k + 1]);
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/** Concatenates several meshes into one. */
export function mergeMeshes(parts: { positions: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer> }[]) {
  const vcount = parts.reduce((n, p) => n + p.positions.length, 0);
  const icount = parts.reduce((n, p) => n + p.indices.length, 0);
  const positions = new Float32Array(vcount);
  const indices = new Uint32Array(icount);
  let vo = 0, io = 0;
  for (const p of parts) {
    positions.set(p.positions, vo);
    for (let i = 0; i < p.indices.length; i++) indices[io + i] = p.indices[i] + vo / 3;
    vo += p.positions.length;
    io += p.indices.length;
  }
  return { positions, indices };
}

/** Area-weighted smooth vertex normals (gltf-transform normals() would make them flat). */
export function smoothNormals(pos: Float32Array, idx: Uint32Array): Float32Array<ArrayBuffer> {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}
