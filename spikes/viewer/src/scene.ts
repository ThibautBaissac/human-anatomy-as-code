// Shared viewer setup for the spikes: renderer (WebGPU with WebGL2 fallback), camera,
// controls, and loading of per-class GLBs into one BatchedMesh per material class.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { acceleratedRaycast, computeBatchedBoundsTree } from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BatchedMesh.prototype.raycast = acceleratedRaycast;
(THREE.BatchedMesh.prototype as any).computeBoundsTree = computeBatchedBoundsTree;

export const CLASS_COLORS: Record<string, number> = {
  bone: 0xe8dcc0,
  cartilage: 0x9ec9d6,
  ligament: 0xd8d0a0,
  muscle: 0xb5443b,
  artery: 0xd0302a,
  vein: 0x3456b0,
  nerve: 0xf0d040,
  organ: 0xc58a7a,
};
export const CLASS_ORDER = ['bone', 'cartilage', 'ligament', 'muscle', 'artery', 'vein', 'nerve', 'organ'];

export interface StructureInfo { fj: string; fma: string | null; name: string; cls: string }

export interface ClassLayer {
  cls: string;
  object: THREE.BatchedMesh | THREE.Group;
  material: THREE.MeshStandardNodeMaterial;
  structures: StructureInfo[]; // index = instanceId (batched) or child index (meshes)
  triangles: number;
}

export const params = new URLSearchParams(location.search);

export async function createViewer(container: HTMLElement, opts: { stencil?: boolean } = {}) {
  const forceWebGL = params.get('backend') === 'webgl';
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL, stencil: opts.stencil ?? false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  await renderer.init();
  const backend = (renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL2';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d2026);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.6));
  const dir = new THREE.DirectionalLight(0xffffff, 2.0);
  dir.position.set(1, 2, 3);
  scene.add(dir);

  const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 1, 20000);
  camera.add(new THREE.DirectionalLight(0xffffff, 0.8));
  scene.add(camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  return { renderer, scene, camera, controls, backend };
}

export async function loadLayers(root: THREE.Object3D, mode: 'batched' | 'meshes', onProgress?: (msg: string) => void): Promise<ClassLayer[]> {
  const manifest = await (await fetch('/assets/manifest.json')).json();
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const layers: ClassLayer[] = [];

  for (const cls of CLASS_ORDER) {
    const entry = manifest.classes[cls];
    if (!entry) continue;
    onProgress?.(`Loading ${cls}…`);
    const t0 = performance.now();
    const gltf = await loader.loadAsync(`/assets/${entry.file}`);
    gltf.scene.updateMatrixWorld(true);
    const material = new THREE.MeshStandardNodeMaterial({ color: CLASS_COLORS[cls], roughness: 0.6, metalness: 0 });
    const sources: { mesh: THREE.Mesh; info: StructureInfo }[] = [];
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const extras = (o.userData ?? {}) as StructureInfo;
        sources.push({ mesh: o as THREE.Mesh, info: { fj: extras.fj ?? o.name, fma: extras.fma ?? null, name: extras.name ?? o.name, cls } });
      }
    });

    let triangles = 0;
    let object: THREE.BatchedMesh | THREE.Group;
    if (mode === 'batched') {
      let vCount = 0, iCount = 0;
      for (const { mesh } of sources) {
        vCount += mesh.geometry.attributes.position.count;
        iCount += mesh.geometry.index!.count;
      }
      const batched = new THREE.BatchedMesh(sources.length, vCount, iCount, material);
      batched.name = cls;
      for (const { mesh } of sources) {
        const gid = batched.addGeometry(mesh.geometry);
        const iid = batched.addInstance(gid);
        batched.setMatrixAt(iid, mesh.matrixWorld);
        batched.setColorAt(iid, new THREE.Color(1, 1, 1));
        triangles += mesh.geometry.index!.count / 3;
        mesh.geometry.dispose();
      }
      (batched as any).computeBoundsTree();
      object = batched;
    } else {
      const group = new THREE.Group();
      group.name = cls;
      for (const { mesh } of sources) {
        const m = new THREE.Mesh(mesh.geometry, material);
        m.applyMatrix4(mesh.matrixWorld);
        (m.geometry as any).computeBoundsTree?.();
        group.add(m);
        triangles += mesh.geometry.index!.count / 3;
      }
      object = group;
    }
    root.add(object);
    layers.push({ cls, object, material, structures: sources.map((s) => s.info), triangles });
    console.log(`[load] ${cls}: ${sources.length} structures, ${triangles} tris, ${(performance.now() - t0).toFixed(0)} ms`);
  }
  return layers;
}

export function frameObject(camera: THREE.PerspectiveCamera, controls: OrbitControls, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  const dist = Math.max(size.x, size.y, size.z) * 1.6;
  camera.position.copy(center).add(new THREE.Vector3(0, -dist, size.z * 0.1));
  camera.up.set(0, 0, 1);
  camera.lookAt(center);
  controls.update();
  return { box, size, center };
}

// Simple frame-time collector.
export class FrameStats {
  private times: number[] = [];
  private last = performance.now();
  tick() {
    const now = performance.now();
    this.times.push(now - this.last);
    this.last = now;
    if (this.times.length > 600) this.times.shift();
  }
  reset() { this.times = []; this.last = performance.now(); }
  summary(lastN = 60) {
    const t = this.times.slice(-lastN).sort((a, b) => a - b);
    if (!t.length) return { fps: 0, avg: 0, p95: 0 };
    const avg = t.reduce((a, b) => a + b, 0) / t.length;
    return { fps: 1000 / avg, avg, p95: t[Math.floor(t.length * 0.95)] ?? t[t.length - 1] };
  }
}

export { THREE };
