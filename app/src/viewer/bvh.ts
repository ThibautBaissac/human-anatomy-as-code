// Picking indexes: BatchedMesh raycasts through one BVH per geometry (three-mesh-bvh).
import * as THREE from 'three/webgpu';
import { acceleratedRaycast, computeBatchedBoundsTree } from 'three-mesh-bvh';

THREE.BatchedMesh.prototype.raycast = acceleratedRaycast;
// The batched raycast hands each geometry's BVH to an internal Mesh: without this patch that Mesh ignores it
// and tests every triangle (seconds per pointer move on the full atlas).
THREE.Mesh.prototype.raycast = acceleratedRaycast;
(THREE.BatchedMesh.prototype as unknown as { computeBoundsTree: typeof computeBatchedBoundsTree }).computeBoundsTree = computeBatchedBoundsTree;
