import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import '../src/viewer/bvh.ts';

// A dense sphere in a batch: a ray must be answered from the BVH, reading only a few of its triangles.
test('picking: a ray against a batch reads its BVH, not every triangle', () => {
  const sphere = new THREE.SphereGeometry(1, 256, 256);
  const tris = sphere.index!.count / 3;
  const batch = new THREE.BatchedMesh(1, sphere.attributes.position.count, sphere.index!.count, new THREE.MeshBasicMaterial());
  batch.addInstance(batch.addGeometry(sphere));
  (batch as unknown as { computeBoundsTree(i: number, o: object): void }).computeBoundsTree(-1, { targetLeafSize: 24, indirect: true });
  batch.updateMatrixWorld();

  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
  const getX = THREE.BufferAttribute.prototype.getX;
  let reads = 0;
  THREE.BufferAttribute.prototype.getX = function (i) { reads++; return getX.call(this, i); };
  try {
    const hits = raycaster.intersectObject(batch, false);
    assert.equal(hits.length > 0, true);
    assert.ok(Math.abs(hits[0].point.z - 1) < 1e-3, `hit at ${hits[0].point.z}`);
    assert.equal(hits[0].batchId, 0);
  } finally {
    THREE.BufferAttribute.prototype.getX = getX;
  }
  assert.ok(reads < tris / 100, `${reads} vertex reads for ${tris} triangles`);
});
