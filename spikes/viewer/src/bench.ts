// Spike 2: BatchedMesh performance with ~2 200 pickable structures.
// URL params: ?mode=batched|meshes  &backend=webgl  &auto=1 (run benchmark on load)
import { CLASS_ORDER, FrameStats, THREE, createViewer, frameObject, loadLayers, params, type ClassLayer } from './scene';

const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
const panel = document.getElementById('panel')!;
const mode = (params.get('mode') === 'meshes' ? 'meshes' : 'batched') as 'batched' | 'meshes';

const { renderer, scene, camera, controls, backend } = await createViewer(app);
const root = new THREE.Group();
scene.add(root);
const tLoad = performance.now();
const layers = await loadLayers(root, mode, (m) => (hud.textContent = m));
const loadMs = performance.now() - tLoad;
const { center, size } = frameObject(camera, controls, root);
const structureCount = layers.reduce((a, l) => a + l.structures.length, 0);
const triCount = layers.reduce((a, l) => a + l.triangles, 0);

// --- UI: class toggles ---------------------------------------------------------
for (const l of layers) {
  const label = document.createElement('label');
  label.innerHTML = `<input type="checkbox" checked> ${l.cls} (${l.structures.length})`;
  label.querySelector('input')!.addEventListener('change', (e) => (l.object.visible = (e.target as HTMLInputElement).checked));
  panel.appendChild(label);
}

// --- Per-structure helpers -----------------------------------------------------
function setVisible(l: ClassLayer, i: number, v: boolean) {
  if (l.object instanceof THREE.BatchedMesh) l.object.setVisibleAt(i, v);
  else l.object.children[i].visible = v;
}
function setAlpha(l: ClassLayer, a: number) {
  l.material.transparent = a < 1;
  l.material.depthWrite = a >= 1;
  l.material.needsUpdate = true;
  if (l.object instanceof THREE.BatchedMesh) {
    const c = new THREE.Vector4(1, 1, 1, a);
    for (let i = 0; i < l.structures.length; i++) l.object.setColorAt(i, c);
  } else {
    l.material.opacity = a;
  }
}

// --- Picking -----------------------------------------------------------------
const raycaster = new THREE.Raycaster();
(raycaster as any).firstHitOnly = true;
const pointer = new THREE.Vector2();
let highlighted: { l: ClassLayer; i: number } | null = null;
const pickTimes: number[] = [];
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointer.set((e.offsetX / renderer.domElement.clientWidth) * 2 - 1, -(e.offsetY / renderer.domElement.clientHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const t0 = performance.now();
  const hits = raycaster.intersectObjects(layers.filter((l) => l.object.visible).map((l) => l.object), true);
  pickTimes.push(performance.now() - t0);
  if (highlighted && highlighted.l.object instanceof THREE.BatchedMesh) highlighted.l.object.setColorAt(highlighted.i, new THREE.Color(1, 1, 1));
  highlighted = null;
  const hit = hits[0];
  if (!hit) return;
  const l = layers.find((x) => x.object === hit.object || x.object === hit.object.parent)!;
  const i = l.object instanceof THREE.BatchedMesh ? (hit as any).batchId : l.object.children.indexOf(hit.object);
  const s = l.structures[i];
  if (l.object instanceof THREE.BatchedMesh) l.object.setColorAt(i, new THREE.Color(0.4, 1.6, 0.4));
  highlighted = { l, i };
  document.getElementById('pick')!.textContent = `${s.name} — ${s.fma ?? '?'} (${s.fj}, ${l.cls}) · raycast ${pickTimes.at(-1)!.toFixed(2)} ms`;
});

// --- Render loop -------------------------------------------------------------
const stats = new FrameStats();
const cpuTimes: number[] = [];
const cpuSummary = () => { const t = [...cpuTimes].sort((a, b) => a - b); return { cpuMedian: +(t[t.length >> 1] ?? 0).toFixed(2), cpuP95: +(t[Math.floor(t.length * 0.95)] ?? 0).toFixed(2) }; };
let orbit: ((t: number) => void) | null = null;
renderer.setAnimationLoop((t) => {
  orbit?.(t);
  controls.update();
  const c0 = performance.now();
  renderer.render(scene, camera);
  cpuTimes.push(performance.now() - c0);
  if (cpuTimes.length > 2000) cpuTimes.shift();
  stats.tick();
  const s = stats.summary();
  const info = renderer.info.render as any;
  hud.textContent = `${backend} · ${mode} · ${structureCount} structures · ${(triCount / 1e6).toFixed(2)} M tris · ${s.fps.toFixed(0)} fps (p95 ${s.p95.toFixed(1)} ms) · draw calls ${info.drawCalls ?? info.calls ?? '?'}`;
});

// --- Benchmark: orbit the camera for N seconds per scenario ---------------------
function orbitFor(ms: number): Promise<{ fps: number; avg: number; p95: number }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const radius = Math.max(size.x, size.y, size.z) * 1.6;
    stats.reset();
    orbit = (t) => {
      const k = (t - start) / ms;
      const a = k * Math.PI * 2;
      camera.position.set(center.x + Math.sin(a) * radius, center.y - Math.cos(a) * radius, center.z + size.z * 0.1);
      camera.lookAt(center);
      if (performance.now() - start > ms) {
        orbit = null;
        resolve(stats.summary(100000));
      }
    };
  });
}

async function runBench() {
  const results: Record<string, unknown>[] = [];
  const all = () => layers.forEach((l) => { l.object.visible = true; l.structures.forEach((_, i) => setVisible(l, i, true)); setAlpha(l, 1); });
  const scenarios: [string, () => void][] = [
    ['all opaque', all],
    ['50 % structures hidden', () => { all(); layers.forEach((l) => l.structures.forEach((_, i) => setVisible(l, i, Math.random() > 0.5))); }],
    ['x-ray (muscle+organ alpha 0.25)', () => { all(); layers.filter((l) => ['muscle', 'organ'].includes(l.cls)).forEach((l) => setAlpha(l, 0.25)); }],
    ['skeleton only', () => { all(); layers.forEach((l) => (l.object.visible = l.cls === 'bone' || l.cls === 'cartilage')); }],
  ];
  for (const [name, setup] of scenarios) {
    setup();
    await orbitFor(500); // warm-up
    cpuTimes.length = 0;
    const r = await orbitFor(5000);
    const info = renderer.info.render as any;
    results.push({ scenario: name, fps: +r.fps.toFixed(1), avgMs: +r.avg.toFixed(2), p95Ms: +r.p95.toFixed(2), ...cpuSummary(), drawCalls: info.drawCalls ?? info.calls });
  }
  all();
  // Picking benchmark: 200 random rays through the screen.
  const rt: number[] = [];
  for (let k = 0; k < 200; k++) {
    raycaster.setFromCamera(new THREE.Vector2(Math.random() - 0.5, Math.random() * 1.6 - 0.8), camera);
    const t0 = performance.now();
    raycaster.intersectObjects(layers.map((l) => l.object), true);
    rt.push(performance.now() - t0);
  }
  rt.sort((a, b) => a - b);
  const out = {
    backend, mode, userAgent: navigator.userAgent, dpr: renderer.getPixelRatio(),
    canvas: `${renderer.domElement.width}x${renderer.domElement.height}`,
    structures: structureCount, triangles: triCount, loadMs: Math.round(loadMs),
    pickMedianMs: +rt[100].toFixed(2), pickP95Ms: +rt[190].toFixed(2),
    results,
  };
  console.log('[bench]', JSON.stringify(out));
  console.table(results);
  (window as any).__bench = out;
  document.getElementById('result')!.textContent = JSON.stringify(out, null, 2);
  return out;
}

document.getElementById('run')!.addEventListener('click', runBench);
if (params.get('auto') === '1') runBench();
(window as any).__layers = layers;
console.log('[ready]', backend, mode, structureCount, CLASS_ORDER);
