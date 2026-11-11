// Renderer: one BatchedMesh per kind inside a ClippingGroup, state applied through appearance().
import * as THREE from 'three/webgpu';
import { frontFacing, materialColor, vec3 } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import './bvh.ts';
import { appearance, type AppearanceState } from './appearance.ts';
import { buildCatalog, selectionKey, type Catalog } from './catalog.ts';
import { hideSelection, keepKnown, setHidden, undoHide } from './view-ops.ts';
import { centreShift, defaultCamera, fitDistance, freeShare, GLIDE_MS, interpolateCamera, NO_INSETS, presetCamera, revealNeed, type Insets, type Preset } from './camera.ts';
import { colorOf, HIGHLIGHT } from './colors.ts';
import { crossingInstances, jointKey, normaliseAngle, parseJointKey, poseMatrices, type Pose, type Rigs } from './pose.ts';
import { AXES, DEFAULT_VIEW, type Atlas, type AtlasJoint, type Axis, type Camera, type Model, type Selection, type Side, type Vec3, type ViewState } from './types.ts';

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
  /** the GPU device or WebGL context was lost: nothing draws any more until a reload */
  lost: string;
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
/** Hovered structures: their kind colour mixed this much towards white (spec). */
const HOVER_MIX = 0.35;
export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  private listeners: { [K in keyof ViewerEvents]: Set<(v: ViewerEvents[K]) => void> } = { select: new Set(), pick: new Set(), hover: new Set(), change: new Set(), lost: new Set() };
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
  /** structure-side under the pointer (tinted) */
  private hovered: Selection | null = null;
  /** hover only on a device whose pointer is fine and hovers (spec) */
  private finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  /** room the interface takes over the canvas: wanted, and as drawn (it eases towards the wanted one) */
  private insets: Insets = { ...NO_INSETS };
  private shownInsets: Insets = { ...NO_INSETS };
  /** camera glide in progress */
  private glide: { from: Camera; to: Camera; start: number | null } | null = null;
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
    // arrow keys pan the view once the canvas has the focus
    this.controls.listenToKeyEvents(canvas);
    canvas.addEventListener('keyup', () => this.emitChange());
    this.controls.addEventListener('end', () => this.emitChange());
    // the user takes the camera: a glide stops where it stands
    this.controls.addEventListener('start', () => { this.untouchedFirstView = false; if (this.glide) { this.glide = null; this.emitChange(); } });
    this.controls.addEventListener('change', () => this.markDirty());
    this.resize = new ResizeObserver(() => this.fit());
    // device pixels: also fires when the page zoom or the screen density changes (not in Safari, hence the fallback)
    try { this.resize.observe(canvas, { box: 'device-pixel-content-box' }); } catch { this.resize.observe(canvas); }
    // A click selects, a drag (orbit) does not.
    canvas.addEventListener('pointerdown', (e) => { this.downAt = [e.clientX, e.clientY]; this.downTouch = e.pointerType === 'touch'; });
    canvas.addEventListener('click', (e) => this.onClick(e));
    canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    // No hover while a button is down: the drag orbits the camera.
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons) { this.hoverPending = null; this.setHover(null); } else if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && this.finePointer.matches) this.hoverPending = e;
    });
    canvas.addEventListener('pointerleave', () => { this.hoverPending = null; this.setHover(null); });
  }

  static async create(canvas: HTMLCanvasElement, opts: { backend: 'auto' | 'webgl' }): Promise<Viewer> {
    const v = new Viewer(canvas, opts.backend === 'webgl');
    // three only logs a lost device (mobile tab in the background, GPU reset): tell the UI
    v.renderer.onDeviceLost = (info: { message?: string }) => { console.error('[viewer] device lost', info); v.emit('lost', info?.message ?? ''); };
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
  /** Call before fetching the atlas so that loadMs covers the whole load (atlas, GLB, BVH). */
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
    // batches kept for the next model still carry this pose: back to rest while the global indices are still this model's
    const reset = new Set<Batch>();
    for (const g of this.moved) { const [b, id] = this.location[g]; b.mesh.setMatrixAt(id, b.base[id]); reset.add(b); }
    this.moved = new Set();
    // their cached bounds still hold the posed limbs: the model box (sections, recentring) is taken at rest
    for (const b of reset) { b.mesh.computeBoundingBox(); b.mesh.computeBoundingSphere(); }
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
    this.view = { ...this.view, model, ...keepKnown(this.view, this.catalog) };
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
    // a pose set from outside (slider, URL, Back button) wins over a playback
    if (patch.pose && this.player) this.stop(false);
    const before = this.view.selection;
    this.view = { ...this.view, ...patch };
    if (patch.camera) { this.glide = null; this.untouchedFirstView = false; this.applyCamera(patch.camera); }
    if (patch.sections) this.applySections();
    if (patch.pose) this.applyPose();
    // only an actual change: re-applying the same selection (URL read back) is not a new selection
    const key = (s: Selection | null) => (s ? selectionKey(s) : null);
    if (patch.selection !== undefined && key(before) !== key(this.view.selection)) this.emit('select', this.view.selection);
    this.applyAppearance();
    this.emitChange();
  }

  select(target: Selection | null): void { this.setState({ selection: target }); }

  /** Moves the camera towards (factor < 1) or away from the target, within the controls' limits: zoom without wheel or pinch. */
  zoom(factor: number): void {
    const t = this.controls.target, offset = this.camera.position.clone().sub(t);
    const d = Math.min(Math.max(offset.length() * factor, this.controls.minDistance), this.controls.maxDistance);
    this.glide = null;
    this.untouchedFirstView = false;
    this.camera.position.copy(t).add(offset.setLength(d));
    this.controls.update();
    this.markDirty();
    this.emitChange();
  }
  /**
   * Room the interface takes over the canvas (CSS px from each edge). The picture moves so that the scene is centred in the
   * free area, and framings fit in it; the change eases in over a few frames unless the user asked for reduced motion.
   */
  setInsets(i: Insets): void {
    const r = (n: number) => Math.max(0, Math.round(n));
    const next = { top: r(i.top), right: r(i.right), bottom: r(i.bottom), left: r(i.left) };
    if (JSON.stringify(next) === JSON.stringify(this.insets)) return;
    this.insets = next;
    if (prefersReducedMotion() || !this.everLoaded) { this.shownInsets = { ...next }; this.applyViewOffset(); }
    // the bars appear once the model is loaded: an untouched first view is framed again for them
    if (this.untouchedFirstView) this.applyCamera(this.wholeBody());
    this.dirty = true;
  }

  /** Client coordinates of the area the interface leaves free over the canvas (e2e tests). */
  freeArea(): { left: number; top: number; right: number; bottom: number } {
    const r = this.canvas.getBoundingClientRect(), i = this.insets;
    return { left: r.left + i.left, top: r.top + i.top, right: r.right - i.right, bottom: r.bottom - i.bottom };
  }

  /** After a click selection: brings it into the free area if a panel covers it, frames it if it is too small to see. */
  reveal(sel: Selection): void {
    const box = this.boxOf(sel.slug, sel.side);
    if (!box) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const centre = box.getCenter(new THREE.Vector3());
    const p = centre.clone().project(this.camera);
    const edge = centre.clone().addScaledVector(new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), box.getSize(new THREE.Vector3()).length() / 2).project(this.camera);
    const radiusPx = Math.hypot((edge.x - p.x) * w / 2, (edge.y - p.y) * h / 2);
    const i = this.insets;
    const need = revealNeed({ x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h }, radiusPx, { left: i.left, top: i.top, right: w - i.right, bottom: h - i.bottom });
    if (need === 'frame') this.glideTo(this.framing(box));
    else if (need === 'pan') {
      const offset = this.camera.position.clone().sub(this.controls.target);
      const pos = centre.clone().add(offset);
      this.glideTo({ position: [pos.x, pos.y, pos.z], target: [centre.x, centre.y, centre.z] });
    }
  }

  /** Tints a structure as if the pointer were on it (a name hovered in the interface); null ends it. */
  preview(sel: Selection | null): void { this.setHover(sel); }

  setKindVisible(kind: string, on: boolean): void {
    const hidden = new Set(this.view.hiddenKinds);
    if (on) hidden.delete(kind); else hidden.add(kind);
    this.setState({ hiddenKinds: [...hidden].sort() });
  }
  setSystemVisible(system: string, on: boolean): void {
    const hidden = new Set(this.view.hiddenSystems);
    if (on) hidden.delete(system); else hidden.add(system);
    this.setState({ hiddenSystems: [...hidden].sort() });
  }
  /** Shows only this system: every other system of the model is hidden. */
  soloSystem(system: string): void {
    this.setState({ hiddenSystems: (this.catalog?.systems ?? []).filter((x) => x !== system).sort() });
  }
  showAllSystems(): void { this.setState({ hiddenSystems: [] }); }
  /** Shows one structure-side alone (every other instance ghosted), or ends the isolation. */
  setIsolated(target: Selection | null): void { this.setState({ isolated: target }); }
  /** Hides the selected structure and clears the selection; hiding the isolated structure ends the isolation. */
  hideSelection(): void {
    const patch = hideSelection(this.view);
    if (!Object.keys(patch).length) return;
    this.setHover(null);
    this.setState(patch);
  }
  /** Shows the last hidden structure again. */
  undoHide(): void { const patch = undoHide(this.view); if (patch.hidden) this.setState(patch); }
  showHidden(): void { this.setState({ hidden: [] }); }
  /** Colour behind the body (a CSS colour: the interface theme's stage). */
  setBackground(css: string): void { if (!css) return; (this.scene.background as THREE.Color).setStyle(css); this.dirty = true; }
  /** Hides or shows one structure by key (slug or slug@side), from the tree. */
  setHidden(key: string, on: boolean): void { const patch = setHidden(this.view, key, on); if (Object.keys(patch).length) { if (on) this.setHover(null); this.setState(patch); } }
  setLayerCut(n: number): void { this.setState({ layerCut: n }); }
  setGhost(on: boolean): void { this.setState({ ghost: on }); }
  setSection(axis: Axis, position: number | null): void {
    const sections = { ...this.view.sections };
    if (position === null) delete sections[axis]; else sections[axis] = position;
    this.setState({ sections });
  }

  /** Frames the camera on a structure (or one side), keeping the viewing direction. */
  focus(slug: string, side?: Side | null): void {
    const box = this.boxOf(slug, side);
    if (box) this.glideTo(this.framing(box));
  }

  /** Bounds of a structure (or one side) where it stands now, or null when it has no instance. */
  private boxOf(slug: string, side?: Side | null): THREE.Box3 | null {
    const ids = this.catalog?.instancesOf(slug, side) ?? [];
    if (!ids.length) return null;
    const box = new THREE.Box3(), b = new THREE.Box3(), m = new THREE.Matrix4();
    for (const g of ids) {
      const [batch, id] = this.location[g];
      batch.mesh.getBoundingBoxAt(batch.mesh.getGeometryIdAt(id), b);
      box.union(b.applyMatrix4(batch.mesh.getMatrixAt(id, m)));
    }
    return box;
  }

  /** Looks at the same target from the named side of the body. */
  viewFrom(preset: Preset): void { this.glideTo(presetCamera(preset, this.currentCamera())); }
  /** Back to the first view: the whole body from the front. */
  recentre(): void { this.glideTo(this.wholeBody()); }

  /** The first view, stepped back so the body fits between the panels. */
  private wholeBody(): Camera {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    return defaultCamera({ min: this.box.min.toArray() as Vec3, max: this.box.max.toArray() as Vec3 }, freeShare(w, h, this.insets).y * 0.86);
  }

  private currentCamera(): Camera {
    const p = this.camera.position, t = this.controls.target;
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
  }

  /** Moves the camera to `to` in a 400 ms glide, or at once when the user asked for reduced motion. */
  private glideTo(to: Camera) {
    this.untouchedFirstView = false;
    if (prefersReducedMotion()) { this.glide = null; this.applyCamera(to); this.emitChange(); return; }
    this.setHover(null); // the body moves under a still cursor
    this.glide = { from: this.currentCamera(), to, start: null };
    this.dirty = true;
  }

  /** Sets one joint angle (whole degrees) on the given sides; the rest angle removes it from the pose. */
  setJointAngle(joint: string, sides: Side[], deg: number): void {
    const j = this.joints.find((x) => x.slug === joint);
    if (!j) return;
    const pose: Pose = { ...this.view.pose };
    const angle = normaliseAngle(j, deg);
    for (const side of sides) {
      if (angle === null) delete pose[jointKey(joint, side)];
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
      const j = this.joints.find((x) => x.slug === parseJointKey(k).slug);
      if (j && pose[k] !== undefined && normaliseAngle(j, pose[k]) === null) delete pose[k];
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
    const sel = this.view.selection, iso = this.view.isolated, hov = this.hovered;
    const state: AppearanceState = {
      hidden: this.catalog.instancesOfKeys(this.view.hidden),
      isolated: new Set(iso ? this.catalog.instancesOf(iso.slug, iso.side) : []),
      hovered: new Set(hov ? this.catalog.instancesOf(hov.slug, hov.side) : []),
      hiddenKinds: new Set(this.view.hiddenKinds),
      hiddenSystems: new Set(this.view.hiddenSystems),
      layerCut: this.view.layerCut,
      ghost: this.view.ghost,
      selected: new Set(sel ? this.catalog.instancesOf(sel.slug, sel.side) : []),
      crossing: new Set([...crossingInstances(this.rigs, this.joints, this.view.pose, new Set(this.snapshot.playing?.keys ?? []))]
        .map((n) => this.indexOf.get(n)).filter((g): g is number => g !== undefined)),
    };
    const c = new THREE.Color(), v4 = new THREE.Vector4(), hl = new THREE.Color(HIGHLIGHT), white = new THREE.Color(0xffffff);
    for (const batch of this.batches) {
      const base = new THREE.Color(colorOf(batch.kind));
      const hover = base.clone().lerp(white, HOVER_MIX);
      let transparent = false;
      for (let id = 0; id < batch.globalOf.length; id++) {
        const a = appearance(state, this.catalog.instance(batch.globalOf[id]));
        batch.mesh.setVisibleAt(id, a.visible);
        batch.alpha[id] = a.visible ? a.alpha : 0;
        c.copy(a.highlighted ? hl : a.hovered ? hover : base);
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

  private frameAll() { this.applyCamera(this.wholeBody()); this.untouchedFirstView = true; }
  /** the first view is on screen and nobody has moved the camera since */
  private untouchedFirstView = false;

  /** The camera framing a box, keeping the viewing direction. */
  private framing(box: THREE.Box3): Camera {
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 20);
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    const dist = fitDistance(radius, this.camera.fov, w / h, freeShare(w, h, this.insets));
    const dirv = this.camera.position.clone().sub(this.controls.target).normalize();
    const p = center.clone().addScaledVector(dirv, dist);
    return { position: [p.x, p.y, p.z], target: [center.x, center.y, center.z] };
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

  /** Double-click: selects the structure and frames it. */
  private onDoubleClick(e: MouseEvent) {
    const sel = this.pick(e.clientX, e.clientY);
    if (!sel) return;
    this.select(sel);
    this.emit('pick', sel);
    this.focus(sel.slug, sel.side);
  }

  private setHover(s: Selection | null) {
    const key = s ? `${s.slug}@${s.side}` : null;
    if (key === this.lastHover) return;
    this.lastHover = key;
    this.hovered = s;
    this.applyAppearance();
    this.emit('hover', s);
  }

  // --- loop ---------------------------------------------------------------------------
  private fit() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.applyViewOffset();
    // the window may have moved to a screen with another density, or the page been zoomed
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.dirty = true;
  }

  /** Shifts the projection so the scene centre is the centre of the free area (the camera itself does not move). */
  private applyViewOffset() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const { x, y } = centreShift(this.shownInsets);
    if (x || y) this.camera.setViewOffset(w, h, -x, -y, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** Eases the drawn insets towards the wanted ones; true while they still move. */
  private easeInsets(): boolean {
    const a = this.shownInsets, b = this.insets;
    let moving = false;
    for (const k of ['top', 'right', 'bottom', 'left'] as const) {
      const d = b[k] - a[k];
      if (Math.abs(d) < 0.5) a[k] = b[k]; else { a[k] += d * 0.25; moving = true; }
    }
    return moving;
  }

  private frame(t: number) {
    const s = this.shownInsets, i = this.insets;
    if (s.top !== i.top || s.right !== i.right || s.bottom !== i.bottom || s.left !== i.left) { this.easeInsets(); this.applyViewOffset(); this.dirty = true; }
    // Hover waits for the picking indexes rather than building them on a mouse move.
    if (this.hoverPending && this.pickReadyMs) { const e = this.hoverPending; this.hoverPending = null; this.setHover(this.pick(e.clientX, e.clientY)); }
    this.orbit?.(t);
    if (this.glide) {
      const g = this.glide;
      g.start ??= t;
      const k = Math.min((t - g.start) / GLIDE_MS, 1);
      this.applyCamera(interpolateCamera(g.from, g.to, k));
      if (k >= 1) { this.glide = null; this.emitChange(); }
    }
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

  /** Client coordinates of the centre of an instance's bounds, where it is now (e2e tests). */
  screenPointOf(name: string): { x: number; y: number } | null {
    const g = this.indexOf.get(name);
    if (g === undefined) return null;
    const [b, id] = this.location[g];
    const box = new THREE.Box3();
    b.mesh.getBoundingBoxAt(b.mesh.getGeometryIdAt(id), box);
    box.applyMatrix4(b.mesh.getMatrixAt(id, new THREE.Matrix4()));
    const p = box.getCenter(new THREE.Vector3()).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
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
