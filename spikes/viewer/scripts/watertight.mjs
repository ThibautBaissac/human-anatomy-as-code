// Spike 3a: are BodyParts3D meshes closed (watertight)? Section capping needs closed meshes.
// Usage: node scripts/watertight.mjs <bodyparts3d_dir> <obj_dir> <out_md>
import { writeFileSync } from 'node:fs';
import { loadBp3d, listObjFiles, parseObj } from './lib/bp3d.mjs';

const [bpDir, objDir, outMd] = process.argv.slice(2);
const bp = loadBp3d(bpDir);
const files = listObjFiles(objDir);

// Weld positions by exact coordinates (OBJ exports sometimes duplicate vertices).
function analyze({ positions, indices }) {
  const key = new Map();
  const remap = new Uint32Array(positions.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const k = `${positions[3 * i]},${positions[3 * i + 1]},${positions[3 * i + 2]}`;
    if (!key.has(k)) key.set(k, key.size);
    remap[i] = key.get(k);
  }
  const edges = new Map();
  let degenerate = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const v = [remap[indices[t]], remap[indices[t + 1]], remap[indices[t + 2]]];
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) { degenerate++; continue; }
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3];
      const k = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let boundary = 0, nonManifold = 0;
  for (const n of edges.values()) { if (n === 1) boundary++; else if (n > 2) nonManifold++; }
  return { tris: indices.length / 3, boundary, nonManifold, degenerate, edges: edges.size };
}

const byClass = new Map();
const worst = [];
let total = 0;
for (const [fj, path] of files) {
  const concept = bp.fjConcept.get(fj);
  const cls = concept ? bp.classify(concept) : 'unmapped';
  const r = analyze(parseObj(path));
  const closed = r.boundary === 0 && r.nonManifold === 0;
  const nearly = r.boundary > 0 && r.boundary / r.edges < 0.005 && r.nonManifold === 0;
  const s = byClass.get(cls) ?? { n: 0, closed: 0, nearly: 0, open: 0, tris: 0 };
  s.n++; s.tris += r.tris;
  if (closed) s.closed++; else if (nearly) s.nearly++; else s.open++;
  byClass.set(cls, s);
  total += r.tris;
  if (!closed) worst.push({ fj, name: bp.names.get(concept) ?? '?', cls, ...r });
}

const pct = (a, b) => `${a} (${Math.round((100 * a) / b)} %)`;
const rows = [...byClass].sort((a, b) => b[1].n - a[1].n);
const sum = rows.reduce((acc, [, s]) => ({ n: acc.n + s.n, closed: acc.closed + s.closed, nearly: acc.nearly + s.nearly, open: acc.open + s.open }), { n: 0, closed: 0, nearly: 0, open: 0 });
worst.sort((a, b) => b.boundary - a.boundary);

const md = [
  `Mesh files analysed: ${files.size}, triangles total: ${total.toLocaleString('en')}`,
  '',
  '| Class | Meshes | Closed (watertight) | Nearly closed (<0.5 % boundary edges) | Open | Triangles |',
  '|---|---|---|---|---|---|',
  ...rows.map(([c, s]) => `| ${c} | ${s.n} | ${pct(s.closed, s.n)} | ${pct(s.nearly, s.n)} | ${pct(s.open, s.n)} | ${s.tris.toLocaleString('en')} |`),
  `| **total** | ${sum.n} | ${pct(sum.closed, sum.n)} | ${pct(sum.nearly, sum.n)} | ${pct(sum.open, sum.n)} | |`,
  '',
  'Most open meshes (boundary edges):',
  '',
  '| FJ | Structure | Class | Triangles | Boundary edges | Non-manifold edges |',
  '|---|---|---|---|---|---|',
  ...worst.slice(0, 15).map((w) => `| ${w.fj} | ${w.name} | ${w.cls} | ${w.tris} | ${w.boundary} | ${w.nonManifold} |`),
].join('\n');
console.log(md);
writeFileSync(outMd, md + '\n');
