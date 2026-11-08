// Converts BodyParts3D OBJ files into one meshopt-compressed GLB per material class.
// Each node keeps the structure identity in `extras` ({ fj, fma, name, cls }).
// Usage: node scripts/build-assets.mjs <bodyparts3d_dir> <obj_dir> <out_dir>
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { loadBp3d, listObjFiles, parseObj } from './lib/bp3d.mjs';

const [bpDir, objDir, outDir] = process.argv.slice(2);

// Area-weighted smooth vertex normals.
function smoothNormals(pos, idx) {
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
mkdirSync(outDir, { recursive: true });
await MeshoptEncoder.ready;

const bp = loadBp3d(bpDir);
const files = listObjFiles(objDir);
const groups = new Map();
for (const [fj, path] of files) {
  const fma = bp.fjConcept.get(fj) ?? null;
  const cls = fma ? bp.classify(fma) : 'organ';
  if (!groups.has(cls)) groups.set(cls, []);
  groups.get(cls).push({ fj, fma, path, name: fma ? bp.names.get(fma) : fj });
}

const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const manifest = { generated: new Date().toISOString(), source: 'BodyParts3D 4.0 (DBCLS), CC BY 4.0', classes: {} };
let totalRaw = 0, totalOut = 0, totalTris = 0;

for (const [cls, items] of [...groups].sort()) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(cls);
  let tris = 0;
  for (const it of items) {
    const { positions, indices } = parseObj(it.path);
    if (!indices.length) continue;
    tris += indices.length / 3;
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(smoothNormals(positions, indices)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
    const mesh = doc.createMesh(it.fj).addPrimitive(prim);
    const node = doc.createNode(it.fj).setMesh(mesh).setExtras({ fj: it.fj, fma: it.fma, name: it.name, cls });
    scene.addChild(node);
  }
  // Note: gltf-transform normals() would generate *flat* normals (unwelds, drops indices).
  const rawPath = join(outDir, `${cls}.raw.glb`);
  await io.write(rawPath, doc);
  await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const outPath = join(outDir, `${cls}.glb`);
  await io.write(outPath, doc);
  const raw = statSync(rawPath).size, out = statSync(outPath).size;
  totalRaw += raw; totalOut += out; totalTris += tris;
  manifest.classes[cls] = { file: `${cls}.glb`, meshes: items.length, triangles: tris, bytes: out };
  console.log(`${cls.padEnd(10)} meshes=${String(items.length).padStart(5)} tris=${String(tris).padStart(9)} raw=${(raw / 1e6).toFixed(1)}MB meshopt=${(out / 1e6).toFixed(1)}MB`);
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`TOTAL tris=${totalTris} raw=${(totalRaw / 1e6).toFixed(1)}MB meshopt=${(totalOut / 1e6).toFixed(1)}MB`);
