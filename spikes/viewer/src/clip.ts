// Spike 3b: axial / coronal / sagittal sections with ClippingGroup (WebGPURenderer)
// and two capping strategies: back-face colouring (TSL) and stencil caps.
// URL params: ?cap=backface|stencil|none  &backend=webgl
import { frontFacing, uniform, vec3 } from 'three/tsl';
import { CLASS_COLORS, FrameStats, THREE, createViewer, frameObject, loadLayers, params } from './scene';

const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
let capMode = (params.get('cap') ?? 'backface') as 'backface' | 'stencil' | 'none';

const { renderer, scene, camera, controls, backend } = await createViewer(app, { stencil: true });
const clipGroup = new THREE.ClippingGroup();
scene.add(clipGroup);
const layers = await loadLayers(clipGroup, 'batched', (m) => (hud.textContent = m));
const { box } = frameObject(camera, controls, clipGroup);

// --- Planes (BodyParts3D: x = left/right, y = antero-posterior, z = cranio-caudal) ---
type Axis = 'axial' | 'coronal' | 'sagittal';
const planeDefs: Record<Axis, { normal: THREE.Vector3; axis: 'x' | 'y' | 'z' }> = {
  axial: { normal: new THREE.Vector3(0, 0, -1), axis: 'z' },
  coronal: { normal: new THREE.Vector3(0, 1, 0), axis: 'y' },
  sagittal: { normal: new THREE.Vector3(-1, 0, 0), axis: 'x' },
};
const planes = {} as Record<Axis, THREE.Plane>;
const enabled: Record<Axis, boolean> = { axial: true, coronal: false, sagittal: false };
for (const k of Object.keys(planeDefs) as Axis[]) planes[k] = new THREE.Plane(planeDefs[k].normal.clone(), 0);

function setPlanePos(k: Axis, t: number) {
  const { axis, normal } = planeDefs[k];
  const v = THREE.MathUtils.lerp(box.min[axis], box.max[axis], t);
  // keep side: n·p + c >= 0  →  c = -n·(point on plane)
  const p = new THREE.Vector3(); p[axis] = v;
  planes[k].constant = -normal.dot(p);
}
function applyPlanes() {
  clipGroup.clippingPlanes = (Object.keys(planes) as Axis[]).filter((k) => enabled[k]).map((k) => planes[k]);
}
setPlanePos('axial', 0.75); setPlanePos('coronal', 0.5); setPlanePos('sagittal', 0.5);
applyPlanes();

// --- Cap strategy A: back faces drawn flat with a cap colour --------------------
const capColor = uniform(new THREE.Vector3(1, 0.88, 0.82));
function setBackfaceCaps(on: boolean) {
  for (const l of layers) {
    const m = l.material;
    const c = new THREE.Color(CLASS_COLORS[l.cls]);
    const base = vec3(c.r, c.g, c.b);
    m.side = on ? THREE.DoubleSide : THREE.FrontSide;
    m.colorNode = on ? frontFacing.select(base, vec3(0)) : null;
    m.emissiveNode = on ? frontFacing.select(vec3(0), base.mul(capColor).mul(0.9)) : null;
    m.needsUpdate = true;
  }
}

// --- Cap strategy B: stencil (one plane at a time) -------------------------------
const stencilBack = new THREE.MeshBasicNodeMaterial({
  side: THREE.BackSide, colorWrite: false, depthWrite: false, depthTest: false,
  stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
  stencilFail: THREE.IncrementWrapStencilOp, stencilZFail: THREE.IncrementWrapStencilOp, stencilZPass: THREE.IncrementWrapStencilOp,
});
const stencilFront = new THREE.MeshBasicNodeMaterial({
  side: THREE.FrontSide, colorWrite: false, depthWrite: false, depthTest: false,
  stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
  stencilFail: THREE.DecrementWrapStencilOp, stencilZFail: THREE.DecrementWrapStencilOp, stencilZPass: THREE.DecrementWrapStencilOp,
});
const capScene = new THREE.Scene();
const capMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  new THREE.MeshBasicNodeMaterial({
    color: 0xd9a090, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  }),
);
capScene.add(capMesh);
function placeCap(p: THREE.Plane) {
  p.coplanarPoint(capMesh.position);
  capMesh.lookAt(capMesh.position.clone().sub(p.normal));
}

// --- UI --------------------------------------------------------------------------
const panel = document.getElementById('panel')!;
for (const k of Object.keys(planeDefs) as Axis[]) {
  const row = document.createElement('div');
  row.innerHTML = `<label><input type="checkbox" ${enabled[k] ? 'checked' : ''}> ${k}</label> <input type="range" min="0" max="1" step="0.001" value="${k === 'axial' ? 0.75 : 0.5}">`;
  const [cb, slider] = row.querySelectorAll('input');
  cb.addEventListener('change', () => { enabled[k] = cb.checked; applyPlanes(); });
  slider.addEventListener('input', () => setPlanePos(k, +slider.value));
  panel.appendChild(row);
}
const capSel = document.getElementById('cap') as HTMLSelectElement;
capSel.value = capMode;
capSel.addEventListener('change', () => { capMode = capSel.value as typeof capMode; setBackfaceCaps(capMode === 'backface'); });
setBackfaceCaps(capMode === 'backface');
for (const l of layers) {
  const label = document.createElement('label');
  label.innerHTML = `<input type="checkbox" ${l.cls === 'bone' || l.cls === 'organ' || l.cls === 'muscle' ? 'checked' : ''}> ${l.cls}`;
  const cb = label.querySelector('input')!;
  l.object.visible = cb.checked;
  cb.addEventListener('change', () => (l.object.visible = cb.checked));
  panel.appendChild(label);
}

// --- Render loop -----------------------------------------------------------------
const stats = new FrameStats();
const bg = scene.background;
renderer.autoClear = false;
let lastError = '';
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.clear();
  scene.background = bg;
  renderer.render(scene, camera);
  const active = (Object.keys(planes) as Axis[]).filter((k) => enabled[k]);
  if (capMode === 'stencil' && active.length) {
    // stencil caps need a single active plane per pass
    const k = active[0];
    clipGroup.clippingPlanes = [planes[k]];
    scene.background = null;
    scene.overrideMaterial = stencilBack;
    renderer.render(scene, camera);
    scene.overrideMaterial = stencilFront;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    placeCap(planes[k]);
    renderer.render(capScene, camera);
    applyPlanes();
  }
  stats.tick();
  const s = stats.summary();
  hud.textContent = `${backend} · cap=${capMode} · planes=${active.join('+') || 'none'} · ${s.fps.toFixed(0)} fps (p95 ${s.p95.toFixed(1)} ms)${lastError ? ' · ERR ' + lastError : ''}`;
});
addEventListener('error', (e) => (lastError = e.message));
(window as any).__clip = { renderer, camera, controls, box, THREE, planes, enabled, setPlanePos, applyPlanes, layers, setCap: (m: typeof capMode) => { capSel.value = m; capSel.dispatchEvent(new Event('change')); } };
console.log('[ready]', backend);
