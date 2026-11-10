// One GLB per file (kind): a node per instance, smooth normals, quantized, meshopt-compressed.
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { mergeMeshes, smoothNormals } from './obj.ts';
import { cmp, fileOf, type Instance } from './instances.ts';
import type { Geometry } from './geometry.ts';

/** [file key, GLB bytes, instance count] for every file, in key order. */
export async function encodeGlbs(instances: Instance[], geometry: Map<string, Geometry>): Promise<[string, Uint8Array, number][]> {
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const byFile = new Map<string, Instance[]>();
  for (const i of instances) byFile.set(fileOf(i), [...(byFile.get(fileOf(i)) ?? []), i]);

  const outputs: [string, Uint8Array, number][] = [];
  for (const kind of [...byFile.keys()].sort(cmp)) {
    const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
    const buffer = doc.createBuffer();
    const scene = doc.createScene(kind);
    for (const inst of byFile.get(kind)!) {
      const { positions, indices } = mergeMeshes(inst.meshes.map((m) => geometry.get(m)!));
      const prim = doc.createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(smoothNormals(positions, indices)).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
      const node = doc.createNode(inst.name).setMesh(doc.createMesh(inst.name).addPrimitive(prim))
        .setExtras({ slug: inst.slug, side: inst.side, meshes: inst.meshes });
      scene.addChild(node);
    }
    await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    outputs.push([kind, await io.writeBinary(doc), byFile.get(kind)!.length]);
  }

  return outputs;
}
