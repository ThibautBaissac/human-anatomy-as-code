// Renderer: one BatchedMesh per kind inside a ClippingGroup, state applied through appearance().
import * as THREE from 'three/webgpu';
import { frontFacing, materialColor, vec3 } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { acceleratedRaycast, computeBatchedBoundsTree } from 'three-mesh-bvh';
import { appearance, type AppearanceState } from './appearance.ts';
import { buildCatalog, type Catalog } from './catalog.ts';
import { colorOf, HIGHLIGHT } from './colors.ts';
import { crossingInstances, jointKey, poseMatrices, type Pose, type Rigs } from './pose.ts';
import { AXES, DEFAULT_VIEW, type Atlas, type AtlasJoint, type Axis, type Camera, type Model, type Selection, type Side, type ViewState } from './types.ts';

THREE.BatchedMesh.prototype.raycast = acceleratedRaycast;
(THREE.BatchedMesh.prototype as unknown as { computeBoundsTree: typeof computeBatchedBoundsTree }).computeBoundsTree = computeBatchedBoundsTree;

export interface Manifest {
  kinds: Record<string, { file: string; bytes: number; sha256: string; instances: number }>;
  /** files (kind keys) each model needs */
  models?: Record<string, { kinds: string[]; totalBytes: number; joints?: Rigs }>;
}

/** A joint being played: which sides, and the sweep. */
export interface Playback {
  joint: string;
  keys: string[];
  /** +1 towards flexion or pronation, −1 back */
  direction: 1 | -1;
}

export interface ViewerEvents {
  select: Selection | null;
  /** a selection made by clicking or tapping the 3D view */
  pick: Selection | null;
  hover: Selection | null;
  change: ViewerSnapshot;
}

/** Everything the UI renders from. */
export interface ViewerSnapshot {
  view: ViewState;
  loading: { loaded: number; total: number } | null;
  failedKinds: string[];
  backend: 'WebGPU' | 'WebGL2' | null;
  ready: boolean;
  /** joint being played, if any */
  playing: Playback | null;
}

interface Batch {
  kind: string;
  mesh: THREE.BatchedMesh;
  material: THREE.MeshStandardNodeMaterial;
  /** batch instance id → global instance index */
  globalOf: number[];
  /** current alpha per batch instance (0 = hidden) */
  alpha: Float32Array;
  /** picking index built (deferred after the first frame) */
  bvh: boolean;
  /** per batch instance: node name (slug or slug@side) and mesh references */
  names: string[];
  meshes: string[][];
  /** per batch instance: its matrix as loaded (rest pose), the pose matrix is applied on top */
  base: THREE.Matrix4[];
}

/** Section planes; each keeps the side n·p + c ≥ 0 (axial keeps below, coronal keeps behind, sagittal keeps the left half). */
const PLANE_NORMALS: Record<Axis, [number, number, number]> = { axial: [0, 0, -1], coronal: [0, 1, 0], sagittal: [-1, 0, 0] };
const PLANE_AXIS: Record<Axis, 'x' | 'y' | 'z'> = { axial: 'z', coronal: 'y', sagittal: 'x' };

export class Viewer {
  readonly renderer: THREE.WebGPURenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private clip = new THREE.ClippingGroup();
  private planes = Object.fromEntries(AXES.map((a) => [a, new THREE.Plane(new THREE.Vector3(...PLANE_NORMALS[a]), 0)])) as Record<Axis, THREE.Plane>;
  private batches: Batch[] = [];
  /** global instance index → [batch, batch instance id] */
  private location: [Batch, number][] = [];
  private box = new THREE.Box3();
  private listeners: { [K in keyof ViewerEvents]: Set<(v: ViewerEvents[K]) => void> } = { select: new Set(), pick: new Set(), hover: new Set(), change: new Set() };
  private view: ViewState = { ...DEFAULT_VIEW };
  private snapshot: ViewerSnapshot = { view: this.view, loading: null, failedKinds: [], backend: null, ready: false, playing: null };
  /** joints of the model, rigs of their sides (manifest), instance name → global index */
  joints: AtlasJoint[] = [];
  rigs: Rigs = {};
  private indexOf = new Map<string, number>();
  /** instances currently away from their rest place */
  private moved = new Set<number>();
  private player: ((t: number) => void) | null = null;
  private raycaster = new THREE.Raycaster();
  private resize: ResizeObserver;
  private frameTimes: number[] = [];
  private lastFrame = 0;
  private hoverPending: PointerEvent | null = null;
  private lastHover: string | null = null;
  catalog: Catalog | null = null;
  /** where the models came from on this load (bench page) */
  loadSource: 'network' | 'partial-cache' | 'cache' = 'network';
  atlas: Atlas | null = null;
  /** from markLoadStart (or load) to the end of loading: first frame drawn and picking ready */
  loadMs = 0;
  /** from the load start to the first frame drawn with every model */
  firstFrameMs = 0;
  /** from the load start to every picking index built */
  pickReadyMs = 0;
  private loadT0 = 0;
  private awaitingFirstFrame = false;
  private orbit: ((t: number) => void) | null = null;
  /** Render on demand: only when something changed (saves battery, leaves the CPU to loading). */
  private dirty = true;
  markDirty(): void { this.dirty = true; }

  readonly canvas: HTMLCanvasElement;

  private constructor(canvas: HTMLCanvasElement, forceWebGL: boolean) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color(0x1d2026);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 2);
    dir.position.set(1, 2, 3);
    this.scene.add(dir);
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
    this.camera.up.set(0, 0, 1);
    this.camera.add(new THREE.DirectionalLight(0xffffff, 0.8));
    this.scene.add(this.camera, this.clip);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.addEventListener('end', () => this.emitChange());
    this.controls.addEventListener('change', () => this.markDirty());
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas);
    // A click selects, a drag (orbit) does not.
    canvas.addEventListener('pointerdown', (e) => { this.downAt = [e.clientX, e.clientY]; this.downTouch = e.pointerType === 'touch'; });
    canvas.addEventListener('click', (e) => this.onClick(e));
    canvas.addEventListener('pointermove', (e) => { this.hoverPending = e; });
    canvas.addEventListener('pointerleave', () => { this.hoverPending = null; this.setHover(null); });
  }

  static async create(canvas: HTMLCanvasElement, opts: { backend: 'auto' | 'webgl' }): Promise<Viewer> {
    const v = new Viewer(canvas, opts.backend === 'webgl');
    await v.renderer.init();
    v.snapshot = { ...v.snapshot, backend: (v.renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2' };
    v.fit();
    v.renderer.setAnimationLoop((t) => v.frame(t));
    return v;
  }

  // --- events -----------------------------------------------------------------------
  on<K extends keyof ViewerEvents>(event: K, cb: (v: ViewerEvents[K]) => void): () => void {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }
  private emit<K extends keyof ViewerEvents>(event: K, value: ViewerEvents[K]) {
    for (const cb of this.listeners[event]) cb(value);
  }
  private emitChange(patch: Partial<ViewerSnapshot> = {}) {
    this.snapshot = { ...this.snapshot, ...patch, view: this.getState() };
    this.emit('change', this.snapshot);
  }
  getSnapshot = (): ViewerSnapshot => this.snapshot;

  // --- loading ------------------------------------------------------------------------
  /** Call before fetching atlas.json so that loadMs covers the whole load (atlas, GLB, BVH). */
  markLoadStart(): void { this.loadStart = performance.now(); }
  private loadStart: number | null = null;

  /**
   * Loads (or switches to) a model: keeps the batches of files it shares with the current one,
   * loads the missing files, drops the others, then rebuilds the catalog against the model's atlas.
   */
  async load(atlas: Atlas, manifest: Manifest, baseUrl: string, model: Model = 'male'): Promise<void> {
    const t0 = this.loadStart ?? performance.now();
    this.loadStart = null;
    this.stop();
    const needed = (manifest.models?.[model]?.kinds ?? Object.keys(manifest.kinds)).slice().sort();
    for (const b of this.batches.filter((x) => !needed.includes(x.kind))) {
      this.clip.remove(b.mesh);
      b.mesh.dispose();
      b.material.dispose();
    }
    this.batches = this.batches.filter((x) => needed.includes(x.kind));
    const missing = needed.filter((k) => !this.batches.some((b) => b.kind === k));
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    let loaded = 0;
    this.emitChange({ loading: { loaded, total: missing.length }, ready: false });
    const results = await Promise.allSettled(missing.map(async (kind) => {
      const gltf = await loader.loadAsync(`${baseUrl}${manifest.kinds[kind].file}`);
      this.emitChange({ loading: { loaded: ++loaded, total: missing.length } });
      return { kind, gltf };
    }));
    const failedKinds: string[] = [];
    for (const [i, r] of results.entries()) {
      if (r.status === 'rejected') { failedKinds.push(missing[i]); console.error(`[viewer] ${missing[i]}:`, r.reason); continue; }
      const { kind, gltf } = r.value;
      gltf.scene.updateMatrixWorld(true);
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      let vCount = 0, iCount = 0;
      for (const m of meshes) { vCount += m.geometry.attributes.position.count; iCount += m.geometry.index!.count; }
      const material = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
      const mesh = new THREE.BatchedMesh(meshes.length, vCount, iCount, material);
      mesh.name = kind;
      const batch: Batch = { kind, mesh, material, globalOf: [], alpha: new Float32Array(meshes.length).fill(1), bvh: false, names: [], meshes: [], base: [] };
      for (const m of meshes) {
        const id = mesh.addInstance(mesh.addGeometry(m.geometry));
        mesh.setMatrixAt(id, m.matrixWorld);
        batch.base[id] = m.matrixWorld.clone();
        const node = m.parent && m.parent !== gltf.scene && m.name === '' ? m.parent : m;
        // the name comes from the node extras: GLTFLoader renames a node that shares its name with the scene ("skin" → "skin_1")
        const extras = node.userData as { slug?: string; side?: string | null };
        batch.names[id] = extras?.slug ? (extras.side ? `${extras.slug}@${extras.side}` : extras.slug) : node.name;
        batch.meshes[id] = (node.userData?.meshes as string[] | undefined) ?? [];
        m.geometry.dispose();
      }
      this.clip.add(mesh);
      this.batches.push(batch);
    }
    this.batches.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
    // global instance indices, in file then node order
    this.location = [];
    const loadedInstances: { name: string; meshes: string[] }[] = [];
    for (const b of this.batches) {
      b.globalOf = [];
      b.names.forEach((name, id) => { b.globalOf[id] = loadedInstances.length; this.location.push([b, id]); loadedInstances.push({ name, meshes: b.meshes[id] }); });
    }
    this.atlas = atlas;
    this.catalog = buildCatalog(atlas, loadedInstances);
    this.indexOf = new Map(loadedInstances.map((x, i) => [x.name, i]));
    this.joints = atlas.joints ?? [];
    this.rigs = manifest.models?.[model]?.joints ?? {};
    // batches kept from the previous model still carry its pose: start again from the rest place
    for (const g of this.moved) { const [b, id] = this.location[g]; b.mesh.setMatrixAt(id, b.base[id]); }
    this.moved = new Set();
    this.view = { ...this.view, model };
    // a selection that does not exist in this model is cleared
    if (this.view.selection && !atlas.structures.some((x) => x.slug === this.view.selection!.slug)) {
      this.view = { ...this.view, selection: null };
      this.emit('select', null);
    }
    this.box.setFromObject(this.clip);
    this.loadT0 = t0;
    this.awaitingFirstFrame = true;
    this.pickReadyMs = 0;
    if (!this.view.camera && !this.snapshot.ready && !this.everLoaded) this.frameAll();
    this.everLoaded = true;
    this.sectionsApplied = null;
    this.applySections();
    this.applyPose();
    this.applyAppearance();
    this.emitChange({ loading: null, failedKinds, ready: true });
  }
  private everLoaded = false;
  /** whether cut-face materials are set up (null: to be (re)applied to every batch) */
  private sectionsApplied: boolean | null = null;

  // --- state --------------------------------------------------------------------------
  getState(): ViewState {
    const p = this.camera.position, t = this.controls.target;
    return { ...this.view, camera: this.snapshot.ready || this.view.camera ? { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] } : null };
  }

  setState(patch: Partial<ViewState>): void {
    this.view = { ...this.view, ...patch };
    if (patch.camera) this.applyCamera(patch.camera);
    if (patch.sections) this.applySections();
    if (patch.pose) this.applyPose();
    if (patch.selection !== undefined) this.emit('select', this.view.selection);
    this.applyAppearance();
    this.emitChange();
  }

  select(target: Selection | null): void { this.setState({ selection: target }); }
  setKindVisible(kind: string, on: boolean): void {
    const hidden = new Set(this.view.hiddenKinds);
    if (on) hidden.delete(kind); else hidden.add(kind);
    this.setState({ hiddenKinds: [...hidden].sort() });
  }
  setLayerCut(n: number): void { this.setState({ layerCut: n }); }
  setGhost(on: boolean): void { this.setState({ ghost: on }); }
  setSection(axis: Axis, position: number | null): void {
    const sections = { ...this.view.sections };
    if (position === null) delete sections[axis]; else sections[axis] = position;
    this.setState({ sections });
  }

  /** Frames the camera on a structure (or one side), keeping the viewing direction. */
  focus(slug: string, side?: Side | null): void {
    if (!this.catalog) return;
    const ids = this.catalog.instancesOf(slug, side);
    if (!ids.length) return;
    const box = new THREE.Box3(), b = new THREE.Box3(), m = new THREE.Matrix4();
    for (const g of ids) {
      const [batch, id] = this.location[g];
      batch.mesh.getBoundingBoxAt(batch.mesh.getGeometryIdAt(id), b);
      box.union(b.applyMatrix4(batch.mesh.getMatrixAt(id, m)));
    }
    this.frameBox(box);
    this.emitChange();
  }

  /** Sets one joint angle (whole degrees) on the given sides; the rest angle removes it from the pose. */
  setJointAngle(joint: string, sides: Side[], deg: number): void {
    const j = this.joints.find((x) => x.slug === joint);
    if (!j) return;
    const pose: Pose = { ...this.view.pose };
    const angle = Math.min(Math.max(Math.round(deg), j.rangeDeg[0]), j.rangeDeg[1]);
    for (const side of sides) {
      if (Math.abs(angle - j.restDeg) < 0.5) delete pose[jointKey(joint, side)];
      else pose[jointKey(joint, side)] = angle;
    }
    this.setState({ pose });
  }

  /**
   * Plays a joint: sweeps its range back and forth in 4 s, from the current angle. With `once`
   * (prefers-reduced-motion), one sweep there and back, then it stops. Tissues stay ghosted while it plays.
   */
  play(joint: string, sides: Side[], { once = false } = {}): void {
    const j = this.joints.find((x) => x.slug === joint);
    if (!j || !sides.length) return;
    this.stop(false);
    const [lo, hi] = j.rangeDeg;
    const keys = sides.map((s) => jointKey(joint, s));
    const current = this.view.pose[keys[0]] ?? j.restDeg;
    const PERIOD = 4000;
    // phase 0 → 0.5 goes lo → hi, 0.5 → 1 comes back; start where the current angle is, going up
    const phase0 = Math.min(Math.max((current - lo) / (hi - lo), 0), 1) / 2;
    let start: number | null = null;
    this.snapshot = { ...this.snapshot, playing: { joint, keys, direction: 1 } };
    this.applyAppearance();
    this.player = (t) => {
      start ??= t;
      const elapsed = t - start;
      const phase = phase0 + elapsed / PERIOD;
      const f = phase % 1;
      const angle = lo + (hi - lo) * (f < 0.5 ? f * 2 : 2 - f * 2);
      const direction: 1 | -1 = f < 0.5 ? 1 : -1;
      const pose: Pose = { ...this.view.pose };
      for (const k of keys) pose[k] = Math.round(angle);
      this.view = { ...this.view, pose };
      this.applyPose();
      const done = once && elapsed >= PERIOD;
      this.emitChange({ playing: done ? null : { joint, keys, direction } });
      if (done) this.stop();
    };
  }

  /** Stops playing; the joint keeps its current angle. */
  stop(emit = true): void {
    if (!this.player && !this.snapshot.playing) return;
    this.player = null;
    // a joint stopped at rest leaves the pose
    const pose: Pose = { ...this.view.pose };
    for (const k of this.snapshot.playing?.keys ?? []) {
      const j = this.joints.find((x) => x.slug === k.split('@')[0]);
      if (j && pose[k] !== undefined && Math.abs(pose[k] - j.restDeg) < 0.5) delete pose[k];
    }
    this.view = { ...this.view, pose };
    this.snapshot = { ...this.snapshot, playing: null };
    this.applyAppearance();
    if (emit) this.emitChange({ playing: null });
  }

  // --- applying state -------------------------------------------------------------------
  /** Moves the instances of the pose (pose matrix on top of the loaded one) and puts the others back. */
  private applyPose() {
    if (!this.catalog) return;
    this.dirty = true;
    const matrices = poseMatrices(this.joints, this.rigs, this.view.pose);
    const next = new Set<number>();
    const m = new THREE.Matrix4(), touched = new Set<Batch>();
    for (const [name, elements] of matrices) {
      const g = this.indexOf.get(name);
      if (g === undefined) continue;
      const [b, id] = this.location[g];
      b.mesh.setMatrixAt(id, m.fromArray(elements).multiply(b.base[id]));
      next.add(g);
      touched.add(b);
    }
    for (const g of this.moved) {
      if (next.has(g)) continue;
      const [b, id] = this.location[g];
      b.mesh.setMatrixAt(id, b.base[id]);
      touched.add(b);
    }
    this.moved = next;
    // whole-batch bounds (frustum culling) follow the moved instances
    for (const b of touched) { b.mesh.computeBoundingBox(); b.mesh.computeBoundingSphere(); }
  }

  private applyAppearance() {
    if (!this.catalog) return;
    this.dirty = true;
    const sel = this.view.selection;
    const state: AppearanceState = {
      hiddenKinds: new Set(this.view.hiddenKinds),
      layerCut: this.view.layerCut,
      ghost: this.view.ghost,
      selected: new Set(sel ? this.catalog.instancesOf(sel.slug, sel.side) : []),
      crossing: new Set([...crossingInstances(this.rigs, this.joints, this.view.pose, new Set(this.snapshot.playing?.keys ?? []))]
        .map((n) => this.indexOf.get(n)).filter((g): g is number => g !== undefined)),
    };
    const c = new THREE.Color(), v4 = new THREE.Vector4(), hl = new THREE.Color(HIGHLIGHT);
    for (const batch of this.batches) {
      const base = new THREE.Color(colorOf(batch.kind));
      let transparent = false;
      for (let id = 0; id < batch.globalOf.length; id++) {
        const a = appearance(state, this.catalog.instance(batch.globalOf[id]));
        batch.mesh.setVisibleAt(id, a.visible);
        batch.alpha[id] = a.visible ? a.alpha : 0;
        c.copy(a.highlighted ? hl : base);
        batch.mesh.setColorAt(id, v4.set(c.r, c.g, c.b, a.alpha));
        if (a.visible && a.alpha < 1) transparent = true;
      }
      if (batch.material.transparent !== transparent) { batch.material.transparent = transparent; batch.material.needsUpdate = true; }
    }
  }

  private applySections() {
    this.dirty = true;
    const active = AXES.filter((a) => this.view.sections[a] !== undefined);
    for (const a of active) {
      const axis = PLANE_AXIS[a];
      const p = new THREE.Vector3();
      p[axis] = THREE.MathUtils.lerp(this.box.min[axis], this.box.max[axis], this.view.sections[a]!);
      this.planes[a].constant = -this.planes[a].normal.dot(p);
    }
    this.clip.clippingPlanes = active.map((a) => this.planes[a]);
    const capped = active.length > 0;
    // after a (re)load every batch gets its cut-face material state, not only those whose state changes
    const force = this.sectionsApplied === null;
    this.sectionsApplied = capped;
    for (const b of this.batches) {
      if ((b.material.side === THREE.DoubleSide) === capped && !force) continue;
      const k = new THREE.Color(colorOf(b.kind));
      b.material.side = capped ? THREE.DoubleSide : THREE.FrontSide;
      // Cut faces: back faces drawn flat in a darker tint of the kind colour.
      b.material.colorNode = capped ? frontFacing.select(materialColor, vec3(0)) : null;
      b.material.emissiveNode = capped ? frontFacing.select(vec3(0), vec3(k.r, k.g, k.b).mul(0.55)) : null;
      b.material.needsUpdate = true;
    }
  }

  private applyCamera(cam: Camera) {
    this.dirty = true;
    this.camera.position.set(...cam.position);
    this.controls.target.set(...cam.target);
    this.controls.update();
  }

  private frameAll() {
    const size = this.box.getSize(new THREE.Vector3()), center = this.box.getCenter(new THREE.Vector3());
    const dist = Math.max(size.x, size.y, size.z) * 1.6;
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(0, -dist, size.z * 0.1));
    this.controls.update();
  }

  private frameBox(box: THREE.Box3) {
    this.dirty = true;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 20);
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.1;
    const dirv = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dirv, dist);
    this.controls.update();
  }

  // --- picking ------------------------------------------------------------------------
  /** Structure-side under a canvas point, ignoring what the section planes cut away. */
  pick(clientX: number, clientY: number): Selection | null {
    if (!this.catalog) return null;
    const r = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const planes = this.clip.clippingPlanes;
    // A pick before the deferred indexes are done builds only those of kinds with pickable (opaque, visible) instances.
    const pickable = this.batches.filter((b) => b.alpha.some((a) => a === 1));
    for (const b of pickable) this.ensureBvh(b);
    const hits = this.raycaster.intersectObjects(pickable.map((b) => b.mesh), false);
    for (const h of hits) {
      if (planes.some((p) => p.distanceToPoint(h.point) < 0)) continue;
      const batch = this.batches.find((b) => b.mesh === h.object);
      // Ghosted layers are only context: clicks go through them.
      if (!batch || h.batchId === undefined || batch.alpha[h.batchId] < 1) continue;
      const info = this.catalog.instance(batch.globalOf[h.batchId]);
      return { slug: info.slug, side: info.side };
    }
    return null;
  }

  private downAt: [number, number] | null = null;
  private downTouch = false;
  /** A click or tap selects; a drag beyond 4 px (mouse) or 8 px (touch) orbits instead. */
  private onClick(e: MouseEvent) {
    const d = this.downAt;
    if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) > (this.downTouch ? 8 : 4)) return;
    const sel = this.pick(e.clientX, e.clientY);
    this.select(sel);
    this.emit('pick', sel);
  }

  private setHover(s: Selection | null) {
    const key = s ? `${s.slug}@${s.side}` : null;
    if (key === this.lastHover) return;
    this.lastHover = key;
    this.emit('hover', s);
  }

  // --- loop ---------------------------------------------------------------------------
  private fit() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.dirty = true;
  }

  private frame(t: number) {
    // Hover waits for the picking indexes rather than building them on a mouse move.
    if (this.hoverPending && this.pickReadyMs) { const e = this.hoverPending; this.hoverPending = null; this.setHover(this.pick(e.clientX, e.clientY)); }
    this.orbit?.(t);
    this.player?.(t);
    if (this.controls.update()) this.dirty = true; // damping still moving
    if (!this.dirty) { this.lastFrame = 0; return; }
    this.dirty = false;
    if (this.lastFrame) { this.frameTimes.push(t - this.lastFrame); if (this.frameTimes.length > 300) this.frameTimes.shift(); }
    this.lastFrame = t;
    this.renderer.render(this.scene, this.camera);
    if (this.awaitingFirstFrame) {
      this.awaitingFirstFrame = false;
      this.firstFrameMs = performance.now() - this.loadT0;
      this.scheduleBvh();
    }
  }

  private ensureBvh(b: Batch) {
    if (b.bvh) return;
    // Larger leaves and indirect mode: cheaper to build, picking stays well under a millisecond.
    (b.mesh as unknown as { computeBoundsTree(i: number, o: object): void }).computeBoundsTree(-1, { targetLeafSize: 24, indirect: true });
    b.bvh = true;
  }

  /**
   * Builds the picking indexes after the first frame, in 50 ms slices so frames can interleave.
   * (requestIdleCallback rarely fires while the render loop runs: it made picking ready later.)
   */
  private scheduleBvh() {
    const yieldThen = (cb: () => void) => { if (!this.disposed) setTimeout(cb, 0); };
    const next = () => {
      // Several kinds per task (50 ms slice): fewer yields, fewer frames competing with the build.
      const sliceEnd = performance.now() + 50;
      for (let b = this.batches.find((x) => !x.bvh); b; b = this.batches.find((x) => !x.bvh)) {
        this.ensureBvh(b);
        if (performance.now() > sliceEnd) return yieldThen(next);
      }
      this.pickReadyMs = performance.now() - this.loadT0;
      this.loadMs = this.pickReadyMs;
      this.emitChange();
    };
    yieldThen(next);
  }

  /** Orbits the camera around its target for `ms` and returns the frame times (bench page). */
  orbitFor(ms: number): Promise<number[]> {
    return new Promise((resolve) => {
      const times: number[] = [];
      const start = performance.now();
      const target = this.controls.target.clone();
      const offset = this.camera.position.clone().sub(target);
      const radius = Math.hypot(offset.x, offset.y), z = offset.z, a0 = Math.atan2(offset.y, offset.x);
      let last = 0;
      this.orbit = (t) => {
        if (last) times.push(t - last);
        last = t;
        const a = a0 + ((performance.now() - start) / ms) * Math.PI * 2;
        this.camera.position.set(target.x + Math.cos(a) * radius, target.y + Math.sin(a) * radius, target.z + z);
        this.dirty = true;
        if (performance.now() - start >= ms) { this.orbit = null; resolve(times); }
      };
    });
  }

  /** World matrix and alpha of an instance by node name (e2e tests). */
  instanceState(name: string): { matrix: number[]; alpha: number } | null {
    const g = this.indexOf.get(name);
    if (g === undefined) return null;
    const [b, id] = this.location[g];
    return { matrix: b.mesh.getMatrixAt(id, new THREE.Matrix4()).toArray(), alpha: b.alpha[id] };
  }

  /** Mean frame time over the last frames, in ms (for the smoke test budget). */
  /** The file (kind key) an instance was loaded from. */
  fileOf(index: number): string | undefined {
    return this.location[index]?.[0].kind;
  }

  meanFrameMs(): number {
    const t = this.frameTimes.slice(-120);
    return t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0;
  }

  private disposed = false;

  dispose(): void {
    this.disposed = true;
    this.orbit = null;
    this.player = null;
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
