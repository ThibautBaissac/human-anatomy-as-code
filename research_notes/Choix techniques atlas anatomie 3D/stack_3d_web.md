# Web 3D Rendering Stack for an Interactive Human Anatomy Atlas (state: November 2026)

Research date: 2026-11-08. About 22 tool calls. Primary sources (threejs.org docs, caniuse, gltf-transform.dev, Khronos PR, xeokit docs) were used where they could be fetched. Several key pages (gpuweb Implementation-Status wiki, three.js `webgl_clipping_stencil.html` source, Babylon OIT doc) timed out or returned 404, so some points rest on secondary sources. Those points are flagged. Items marked "(prior knowledge, not re-verified)" come from the researcher's background knowledge and should be checked before they go into a decision document.

---

## Q1. Engine choice: Three.js vs Babylon.js vs React Three Fiber (+drei) vs PlayCanvas vs others

### Takeaway
**Three.js (r187, Oct 30 2026)** is the best fit. It ships `BatchedMesh` with per-instance visibility, color and alpha (one draw call per material batch, which suits 6000+ pickable structures), `ClippingGroup`, TSL node materials that compile to both WebGPU and WebGL2, and the largest ecosystem (three-mesh-bvh, gltf-transform interop). Babylon.js 9.x is the strong runner-up: more batteries-included (built-in depth-peeling OIT, clip planes, inspector), but its ecosystem for this exact use case is smaller. React Three Fiber v10 (WebGPU-default) is still alpha, and drei's shader-patching helpers break under WebGPURenderer, so R3F should not be the core of the 3D engine. PlayCanvas is game- and editor-oriented, and its WebGPU path is still labelled Beta in its own docs.

### Cited Findings
**Three.js versions and WebGPU maturity**
- Release cadence and contents (author updated Nov 6 2026): r182 (Dec 10 2025), r183 (Feb 18 2026), r184 (Apr 16 2026), r185 (Jun 25 2026), r186 (Sep 8 2026), r187 (Oct 30 2026). — [Utsubo, "Three.js 2026: what changed"](https://www.utsubo.com/blog/threejs-2026-what-changed)
- r183: `PostProcessing` renamed `RenderPipeline`; **per-instance opacity in `BatchedMesh`**; reversed depth buffer on WebGPURenderer; read-write storage textures in TSL. — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- r184: `compileAsync()` no longer blocks rendering on WebGPURenderer; **TSL and node materials run on WebGLRenderer through a compatibility layer**; the deprecated multi-draw path of `BatchedMesh` was removed. — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- r185: WebXR on WebGPURenderer; clustered (Forward+) lighting. **Breaking:** in a skinned `positionNode`, read `positionGeometry` instead of `positionLocal`; premultiplied alpha changed. — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- r186: minified builds removed, CommonJS deprecated; Gaussian splatting addon; `SunLight` with cascaded shadow maps. — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- r187: depth-only render targets in WebGPURenderer; TSL type promotion; `setViewport`/`setScissor` no longer scale by pixel ratio when a render target is bound. About 80% of changed core lines were on the WebGPU/TSL renderer side. — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed); [sirocco18.jp, "Measuring three.js r187"](https://sirocco18.jp/journal/en/threejs-r187.html). The r187 GitHub release notes were not yet published when that analysis ran.
- WebGPURenderer **falls back to WebGL2 automatically** during `init()`, and you can force the fallback with `forceWebGL: true`. Check `renderer.backend.isWebGPUBackend` to see which backend runs (`isWebGPURenderer` is true on both). Both backends **reject `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile`**, so custom shaders must be ported to TSL. — [Utsubo migration guide (Sep 24 2026, checked against r186)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- The same guide still calls WebGLRenderer "the recommended choice for pure WebGL 2 applications" and describes WebGPURenderer as "still experimental". WebGPU gains show up mainly in draw-call-bound or compute-heavy scenes, and some forum reports show WebGPURenderer running slower on certain scenes. — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)

**React Three Fiber / drei**
- R3F v10 is in alpha (alpha.6 seen). It makes WebGPU the default renderer, moves WebGL to a `/legacy` entry, moves TSL hooks into a separate `@react-three/tsl` package, and renames `state.gl` to `state.renderer`. Drei v11 is also alpha. — [newreleases.io R3F 10.0.0-alpha.6](https://newreleases.io/project/npm/@react-three/fiber/release/10.0.0-alpha.6); [10.0.0-alpha.1](https://newreleases.io/project/npm/@react-three/fiber/release/10.0.0-alpha.1)
- drei `<Text>` uses troika-three-text, which patches shaders. Under WebGPURenderer it **crashed the WebGPU render pass and drew nothing on the WebGL2 backend**. `@react-three/postprocessing` and pmndrs `postprocessing` target WebGLRenderer only. drei `<Environment>` with children relies on `WebGLCubeRenderTarget`, which no longer works with WebGPURenderer since r183. — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)

**Babylon.js**
- Babylon.js 9.0 shipped around March 26 2026 with clustered lighting, volumetric lighting, Frame Graph and animation retargeting, on both WebGPU and WebGL2. 9.1 followed on Apr 2 2026, and npm showed 9.20.0 on Aug 6 2026. — [radiancefields.com Babylon page](https://radiancefields.com/platforms/babylon-js); [cinevva roundup, Mar 27 2026](https://app.cinevva.com/signals/2026-03-27-browser-rendering-best-month). Both are secondary sources. The official Microsoft/Babylon announcement was not fetched.

**PlayCanvas**
- The official manual lists WebGPU as **Beta** and includes static and dynamic batching. — [PlayCanvas Graphics manual](https://developer.playcanvas.com/user-manual/graphics.md)
- Engine v2.20.x (Jun–Jul 2026) added compute-based WebGPU Gaussian splat paths. Sources conflict on how mature its WebGPU path is: one calls it the "most production-ready", another calls it WebGL2-first. Both come from a company that sells a competing engine. — [cinevva engine comparison, Jun 2026](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)

### Inferences
- **Recommendation:** Three.js r187+ with `WebGPURenderer` (automatic WebGL2 fallback) and TSL for every custom material: x-ray/fresnel, highlight, cap material, per-structure fade. Because r184 lets TSL run on WebGLRenderer too, the shader investment is not lost if you have to fall back to `WebGLRenderer` for a feature such as a stencil corner case. Pin the minor version: breaking changes land almost every release (r185 skinning `positionLocal`, r186 removed minified builds, r187 viewport scaling).
- **Fallback strategy:** if WebGPURenderer shows a blocker on iOS Safari or older Android during prototyping, `WebGLRenderer` with TSL via the r184 compatibility layer is the escape hatch. Keep scene code renderer-agnostic: no `ShaderMaterial`, no `onBeforeCompile`.
- **R3F:** not recommended as the 3D core. v10 is alpha, v9 is tied to WebGLRenderer, and drei's text and postprocessing helpers are incompatible with WebGPU. With 6000 structures held in a handful of `BatchedMesh` objects, R3F's declarative per-object component model gives little benefit, and mapping 6000 structures to React components would be an anti-pattern. A vanilla TypeScript "viewer" module with an imperative API (`setVisible(ids)`, `setOpacity(ids, a)`, `highlight(id)`, `setSection(plane)`) behind a UI framework is cleaner.
- **Babylon** is the best alternative if the team prefers an all-in-one engine with built-in OIT and an inspector. It is TypeScript-native (prior knowledge, not re-verified). The trade-off is a smaller community for custom large-scene work and fewer third-party helpers comparable to three-mesh-bvh.
- **TypeScript:** three.js types come from `@types/three` (DefinitelyTyped). Babylon and PlayCanvas are authored in TypeScript (prior knowledge, not re-verified).

### Gaps
- No reliable, current (2026) bundle-size figures were found for three.js r187, Babylon 9.x or PlayCanvas 2.x. Measure with a bundler (tree-shaken `three/webgpu` + `three/tsl` vs `@babylonjs/core` ES modules).
- The official r187 GitHub release notes and the Babylon 9.x announcement were not fetched directly.
- No 2026 benchmark comparing these engines on a 6000-object CAD or anatomy scene on mobile was found.

---

## Q2. WebGPU browser support (late 2026) and whether WebGL2 fallback is still needed

### Takeaway
WebGPU reaches about 87–89% of global users. Chrome/Edge desktop, Chrome Android (Android 12+ on ARM/Qualcomm/Intel GPUs), Safari and **all iOS browsers on iOS/iPadOS 26+**, and Samsung Internet support it. **Firefox Android, Firefox Linux/Intel-Mac, iOS < 26 and older or low-end Android devices do not.** A WebGL2 fallback is still mandatory. Three.js WebGPURenderer provides it automatically.

### Cited Findings
- caniuse (fetched Nov 2026): Chrome 113–160 ✅; Chrome Android 157 ✅; Edge 113–156 ✅; **Safari desktop 26.0–27.3 "partial"**; **Safari iOS 26.0–27.2 ✅**; Firefox 63–162 "disabled by default"; Firefox Android 159 "disabled by default"; Samsung Internet 24–31 ✅. Global: **86.83% full + 1.8% partial = 88.63%**. — [caniuse.com/webgpu](https://caniuse.com/webgpu)
- Chrome Android: since Chrome 121, on Android 12+ with ARM, Qualcomm or Intel GPUs. Chrome Linux: 144 (Intel Gen12+), 147 (NVIDIA on Wayland). Firefox: 141 Windows; 145 Apple Silicon on macOS 26; 147 all macOS versions; Intel Macs, Linux and Android not in stable. Safari 26 on macOS, iOS, iPadOS and visionOS. — [Utsubo migration guide (data Aug 2026)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- iOS 26+ gives WebGPU to all browsers, because they all use WebKit. Older iOS versions don't get it. Firefox Android is "behind a flag", with Mozilla expecting Android work in 2026, and as of August 2026 it shipped only in pre-release builds. — [Wikipedia: WebGPU](https://en.wikipedia.org/wiki/WebGPU); [gpuweb Implementation Status wiki](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) (the wiki timed out on direct fetch, so this comes from the search summary)

### Inferences
- An anatomy atlas used by students will meet older iPhones (iOS 18/17 still in use), budget Android phones, and Firefox Android. A WebGL2 path is required, and it must be tested as a first-class target, not only as a fallback. Use `forceWebGL: true` in CI and visual tests.
- Safari desktop is marked "partial" on caniuse. Test features such as timestamp queries or particular texture formats specifically. The caniuse page does not list which features are missing.

### Gaps
- The exact list of what Safari's "partial" support lacks was not retrieved.
- No data was found on the share of Android devices in the wild that meet the Chrome WebGPU requirements (Android 12+ and a supported GPU).

---

## Q3. Handling 6000+ meshes: draw calls, BatchedMesh, instancing, LOD, culling, picking

### Takeaway
Do not render 6000 separate `Mesh` objects: that means 6000 draw calls, which mobile cannot sustain. Pack structures into **~10–30 `BatchedMesh` objects, grouped by material/shading class** (bone, muscle, tendon, ligament, nerve, artery, vein, organ, skin and so on). Each structure is one instance with its own visibility (`setVisibleAt`), color plus alpha (`setColorAt` with a `Vector4`), per-object frustum culling and depth sorting. Raycast with three-mesh-bvh's `computeBatchedBoundsTree` and `acceleratedRaycast`. Optionally add a GPU ID-buffer pick pass for exact pixel picking on touch.

### Cited Findings
- `BatchedMesh` "renders many objects that share one material in a single multi-draw call". The constructor is `(maxInstanceCount, maxVertexCount, maxIndexCount, material)`. Methods include `addGeometry`, `addInstance`, `setMatrixAt`, **`setVisibleAt`/`getVisibleAt`**, **`setColorAt` (pass a `Vector4` for alpha)**, `setGeometryAt`, `deleteInstance`, `optimize()`, `setGeometrySize`, `setInstanceCount`, `getBoundingBoxAt`. Properties include **`perObjectFrustumCulled` (default true)**, **`sortObjects` (default true; transparent materials sort back-to-front, opaque front-to-back)** and `customSort`. — [threejs.org BatchedMesh docs](https://threejs.org/docs/pages/BatchedMesh.html)
- BatchedMesh limitations: **one material (or material array) shared by all instances**; the first geometry fixes the attribute layout, and later geometries must match `itemSize`/`normalized` (extra attributes are ignored); **negatively scaled matrices are not supported**. — [threejs.org BatchedMesh docs](https://threejs.org/docs/pages/BatchedMesh.html)
- Per-instance opacity was added to BatchedMesh in r183 (Feb 2026), and the old deprecated multi-draw path was removed in r184. — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- three-mesh-bvh supports BatchedMesh. Assign `THREE.BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree` and `THREE.BatchedMesh.prototype.raycast = acceleratedRaycast`, then call `batchedMesh.computeBoundsTree(geomId)` per geometry (or `-1` for all). `disposeBatchedBoundsTree(index)` frees them. npm versions are around 0.9.x. — [three-mesh-bvh functions docs](https://gkjohnson.github.io/tools/docs/three-mesh-bvh/functions.md); [npm three-mesh-bvh](https://npmjs.com/package/three-mesh-bvh)
- WebGPU's main win is in draw-call-heavy scenes: "greatly reduced JavaScript workload for the same graphics" (Chrome team, quoted in the guide). — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- gltf-transform `inspect` reports whether a scene is geometry-heavy, texture-heavy or draw-call-heavy. `join` merges meshes to reduce draw calls, and `instance` creates GPU instances from shared mesh references. — [gltf-transform CLI](https://gltf-transform.dev/cli)

### Inferences
- **Batching plan:** at load time, read each glTF node (one node per anatomical structure, named with a stable ID such as an FMA or TA2 ID) and `addGeometry` + `addInstance` it into the batch for its material class. Keep a `Map<structureId, {batch, instanceId}>` and typed arrays (`Uint8Array visible`, `Float32Array opacity`) as the source of truth. Do **not** use gltf-transform `join` for pickable structures, because `join` destroys per-structure identity. Batching happens at runtime, not in the file.
- **Left/right symmetry:** BatchedMesh rejects negative-scale matrices, so mirrored left/right structures cannot share one geometry through a mirror transform. Bake mirrored geometry, which doubles memory for paired structures. Alternatively, keep only truly identical repeats (vertebra-like elements are not identical, so instancing gains are limited in anatomy).
- **Picking:** three-mesh-bvh raycast on BatchedMesh gives `batchId`/instance → structure ID. On mobile, raycast once per tap, not per frame. A GPU ID buffer (render instance IDs to an integer target at 1×1 or a small region under the pointer) is exact even with transparency and clipping, but needs an extra pass. With clipping planes active, the raycast must ignore hits on the clipped side. Filter intersections by plane distance.
- **Hidden and transparent structures:** hidden instances are skipped by the multi-draw. Transparent instances need their own BatchedMesh with a transparent material (`depthWrite:false`), because transparency is a material-level flag. Moving a structure between the "opaque" and "transparent" batches means deleting and re-adding the instance, or keeping duplicate slots. Simpler: keep two parallel batches per material class (opaque and transparent) holding the same geometries, and toggle visibility between them.
- **LOD:** BatchedMesh supports swapping geometry per instance (`setGeometryIdAt`), so you can register LOD0/LOD1 geometries (made with gltf-transform `simplify` / meshoptimizer) and switch by screen size. This is a manual implementation (inference; no built-in BatchedMesh LOD was found in the docs).
- **Budget guidance (inference):** aim for under 100 draw calls and under ~1–3M visible triangles on mid-range phones. These are commonly cited rules of thumb, but no 2026 source was found to cite. See Gaps.

### Gaps
- No authoritative 2026 numbers were found on mobile draw-call or triangle budgets (iPhone vs mid-range Android) for WebGL2 vs WebGPU.
- It is unclear whether `BatchedMesh` on WebGPURenderer uses true multi-draw-indirect or per-object draws internally. The docs say only "single multi-draw call".
- No source confirmed whether three-mesh-bvh's BatchedMesh raycast honors `setVisibleAt(false)`, or whether hidden instances must be filtered manually. Test it.

---

## Q4. glTF asset pipeline (gltf-transform, compression, extensions, lazy loading, Blender export)

### Takeaway
Use **gltf-transform** (CLI in CI, Node API for custom steps) with **EXT_meshopt_compression + KHR_mesh_quantization** rather than Draco. Meshopt decodes 10–100× faster, also compresses animations and morph targets, and pairs with Brotli/gzip on the CDN. Draco gives slightly smaller raw files but has a heavy decoder and slow mobile decode. Use **KHR_texture_basisu (KTX2: ETC1S for color, UASTC for normals)** for any textures. Split assets **per body system and region** (skeleton, muscles, vessels, nerves, organs × head/trunk/limbs) so loading is progressive.

### Cited Findings
- gltf-transform CLI commands: `inspect`, `optimize`, `meshopt`, `draco`, `quantize`, `simplify`, `weld`, `dedup`, `instance`, `join`, `flatten`, `prune`, `resample` (lossless keyframe dedup), `sparse`, `etc1s`/`uastc` (KTX2 + Basis), `webp`. The docs warn that `optimize` defaults "may not be ideal for all scenes" (`optimize -h` lists the options). — [gltf-transform CLI](https://gltf-transform.dev/cli)
- The gltf-transform `meshopt()` function wraps `reorder` + `quantize` + EXTMeshoptCompression and covers **points, lines, triangles, morph targets and animation data**. For control over quantization bits, call the lower-level functions. Compression is applied at write time (`MeshoptEncoder`, level `'medium'`). — [gltf-transform meshopt function](https://gltf-transform.dev/modules/functions/functions/meshopt)
- "Meshopt decoding is considerably faster than Draco decoding", and neither compression method improves runtime performance directly. — [gltf-transform EXTMeshoptCompression](https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression) (via search summary)
- Khronos PR for EXT_meshopt_compression: decoders "designed for extremely fast decoding", ~2+ GB/s on modern desktop CPUs. For mesh data it is "usually slightly less efficient than Draco in terms of the transmission size". Apply gzip or Brotli on top for full benefit. — [KhronosGroup/glTF PR #1830](https://github.com/KhronosGroup/glTF/pull/1830)
- Benchmark by meshoptimizer's author (older i7-8650U): Draco decode 401 ms vs ~8 ms meshopt (Buddha model); 782 ms vs ~7 ms (Bistro). — [zeux gist](https://gist.github.com/zeux/b48678a44944187c16f55ad6cca45e78)
- A Babylon forum thread frames the choice as download size vs decompression speed, plus the size of the Draco decoder itself. — [Babylon forum](https://forum.babylonjs.com/t/how-to-fast-loading/25386)

### Inferences
- **Recommended pipeline:**
  1. Blender (or ZBrush/Maya) master scene. One object per structure, named with a stable ID. Custom properties (`extras`) carry the structure ID, system, layer depth and parent region. The glTF exporter writes custom properties to `extras` when "Custom Properties" is enabled (prior knowledge, not re-verified).
  2. Export `.glb` per system and region chunk.
  3. Run `gltf-transform` in CI: `dedup` → `prune` → `weld` → `simplify` (LOD1 variants only, ratio tuned per system) → `resample` (animations) → `quantize` (positions 14-bit, normals 10-bit as a starting point) → `meshopt` → for textures `etc1s` (albedo) / `uastc` (normals, ideally with `--zstd`) → serve with Brotli.
  4. Do **not** `join` or `flatten` pickable structures. `instance` helps only for truly repeated geometry.
- **Progressive loading:** load a low-poly skeleton and skin silhouette first (<2–3 MB), then systems on demand when toggled in the UI. Use HTTP range requests or separate files per region. A manifest JSON maps structure ID → file chunk → node name, so search and the UI work before the geometry arrives.
- **Textures:** anatomy atlases often rely on flat or vertex-colored PBR materials with few textures. If textures are used (bone surface detail, organ normal maps), KTX2 keeps them compressed in GPU memory, which matters most on iOS, where memory limits kill tabs (inference).
- Three.js needs `MeshoptDecoder` set on `GLTFLoader` (`loader.setMeshoptDecoder(MeshoptDecoder)`) and `KTX2Loader` with the Basis transcoder (prior knowledge, not re-verified).

### Gaps
- No 2026 measurements of meshopt vs Draco decode time on mobile devices (iPhone, mid-range Android) were found. The cited benchmarks are desktop CPUs and older.
- No published asset sizes for comparable anatomy datasets (6000 structures) after compression were found.

---

## Q5. Clipping planes with capped sections, outlines and selection, OIT for X-ray / dissection

### Takeaway
Three.js now offers two clipping models. Legacy `material.clippingPlanes` works on both renderers. **`ClippingGroup` is WebGPURenderer-only** and applies planes to all descendants, which fits whole-body axial, coronal and sagittal sections. For **capped cut faces**, either use the classic **stencil technique** (three.js `webgl_clipping_stencil` example: back faces increment, front faces decrement, then draw a cap plane where stencil ≠ 0, per structure or per material class), or compute cap geometry on the CPU, as xeokit does (plane/triangle intersection → contour → earcut triangulation, progressive). The CPU approach gives per-structure colored, pickable caps. Three.js core has no built-in OIT. Babylon has built-in depth-peeling OIT.

### Cited Findings
- "ClippingGroup can only be used with WebGPURenderer". Its clipping planes affect all descendant 3D objects. — [threejs.org ClippingGroup docs](https://threejs.org/docs/pages/ClippingGroup.html)
- Official stencil capping example. — [three.js examples/webgl_clipping_stencil.html](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_clipping_stencil.html) (the source timed out on fetch, so the technique summary is prior knowledge plus forum threads)
- Forum guidance: stencil capping is very sensitive to render order. Use `renderOrder=1` for the stencil passes and `renderOrder=2` for the cap plane, and some ordering also relies on `onAfterRender` (clearing the stencil). The WebGL `stencil` context attribute became `false` by default, so enable it explicitly (`new WebGLRenderer({ stencil: true })`). — [three.js forum: capping clipped planes using stencil](https://discourse.threejs.org/t/capping-clipped-planes-using-stencil-on-a-buffergeometry/18407); [three.js forum: clipping plane stencil capping](https://discourse.threejs.org/t/clipping-plane-stencil-capping/74018)
- xeokit CPU section caps: `buildSectionCaps` computes cut segments per straddling triangle and triangulates them (legacy 2.x uses earcut). It trims caps across multiple planes (Sutherland–Hodgman), offers a **`progressive` option** for very large models, filters objects (`includeObjectIds`, `excludeObjectIds`) and skips models by bounding box. **Non-watertight meshes produce no caps** (open polylines are discarded). — [xeokit sectionCaps module](https://xeokit.github.io/sdk/docs/api/modules/presentations.sectionCaps.html); [buildSectionCaps](https://xeokit.github.io/sdk/docs/api/functions/presentations.sectionCaps.buildSectionCaps.html); [legacy SectionCaps.js](https://xeokit.github.io/xeokit-sdk/docs/file/src/viewer/scene/sectionCaps/SectionCaps.js.html)
- OIT is a class of techniques that resolve transparency per pixel after rasterization instead of relying on draw order. — [Wikipedia: Order-independent transparency](https://en.wikipedia.org/wiki/Order-independent_transparency)

### Inferences
- **Watertight meshes are a hard asset requirement.** Both stencil capping and CPU capping (as xeokit's docs state) fail on open meshes. Validate closed manifolds in the Blender pipeline.
- **Recommended capping approach for anatomy:** with 6000 structures, a single stencil pass over the whole body gives one cap color for everything, which is useless for teaching. Options:
  - (a) Stencil per material class (bone, muscle and so on), with a cap plane per class. This needs a few extra passes and gives class-colored caps. Overlapping structures of the same class merge their caps.
  - (b) **CPU or worker-computed cap geometry per visible straddling structure**, xeokit-style. This gives exact per-structure color, picking and labels on the cut face, and it is recomputed only when the plane moves (debounced, in a Web Worker, with three-mesh-bvh `shapecast` to collect triangles intersecting the plane fast). This is the best fit for an atlas where students click on a section face.
  - (c) Shader-only "fake cap": render back faces with a flat cap color when clipped (`side: DoubleSide` + `gl_FrontFacing` / TSL `frontFacing` → output the structure's cap color). This is cheap, per-structure colored, works with BatchedMesh, and needs no stencil. It looks correct only for watertight meshes viewed at the cut, and the cap is unlit. This is a very good mobile default, with (b) as an optional "high-quality section" mode.
- **Babylon:** supports `scene.clipPlane`…`clipPlane6` (up to 6 planes) and `scene.useOrderIndependentTransparency` (depth peeling) (prior knowledge, not re-verified; the OIT doc URL returned 404).
- **OIT in three.js:** none in core (prior knowledge). For dissection X-ray views:
  - Default: BatchedMesh per-object `sortObjects` (back-to-front) + `depthWrite:false` + a TSL fresnel/x-ray material. This is usually good enough for convex-ish organs.
  - High quality: implement **weighted blended OIT** (McGuire–Bavoil 2013) in TSL with `RenderPipeline` and MRT (accumulation + revealage targets). This is a single geometry pass, which matters on mobile.
  - Depth peeling costs N passes. Avoid it on mobile.
- **Outlines and selection:** recolor the selected instance with `setColorAt` (cheap). An outline pass is available through `RenderPipeline` outline nodes on WebGPURenderer. The pmndrs postprocessing Outline effect does not work there, per the Utsubo guide. An alternative is an inverted-hull duplicate of only the selected structure.

### Gaps
- No source confirmed whether material stencil properties (`stencilWrite`, `stencilFunc`, `stencilZPass`) are fully supported on the three.js WebGPURenderer and WebGL2 backends in r187, or whether they combine correctly with `ClippingGroup`. Verify with a prototype early, because it is a key risk.
- No three.js-official OIT example or addon for WebGPURenderer was found.
- No benchmark was found for CPU section-cap computation time on a 6000-structure, multi-million-triangle model on mobile.

---

## Q6. Labels and annotations at scale

### Takeaway
Show only a handful of labels at a time: the selected structure, hovered structures, and labels for the current layer up to a cap (for example 20–50). Render them as **HTML/CSS overlays** (CSS2DRenderer or a custom projected-DOM layer) with **SVG leader lines**. Do not use troika-three-text / drei `<Text>`: it is incompatible with WebGPURenderer and its maintenance has slowed.

### Cited Findings
- troika-three-text renders SDF text by patching three.js materials. It is listed at 0.52.4, its most recent visible changelog entries are from late 2023, and one third-party health check rates its maintenance low (5/25). — [npm troika-three-text](https://npmjs.com/package/troika-three-text); [yarn listing](https://classic.yarnpkg.com/en/package/troika-three-text); [depscope](https://mcp.depscope.dev/pkg/npm/troika-three-text)
- drei `<Text>` (troika) crashed the WebGPU render pass and drew nothing on the WebGL2 backend of WebGPURenderer. — [Utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)

### Inferences
- HTML labels get native text rendering, the full i18n font stack, accessibility (screen readers, focus) and CSS styling for free. They are the right choice for the dozens of labels an atlas shows at once. Avoid thousands of DOM nodes: pool label elements, and update positions with `transform: translate3d` in the render loop only when the camera moves.
- **Anchor points:** precompute a label anchor per structure (centroid projected onto the surface, or an author-defined anchor in glTF `extras`). Check occlusion with a single three-mesh-bvh raycast per visible label, or by sampling the ID buffer, at a throttled rate.
- **Leader lines:** one SVG overlay with `<line>`/`<path>` elements from the anchor's screen position to the label box. Place labels in columns on the left and right edges (the classic atlas look), using simple 1D sorting by screen y to avoid crossings.
- If in-scene 3D text is needed (labels pinned on surfaces in AR or VR), port an MSDF text shader to TSL, or test the newer WebGPU-compatible community text packages. None were verified.
- CSS2DRenderer is a thin addon (prior knowledge) and is fine for this purpose. A custom overlay gives more control over leader layout.

### Gaps
- No verified WebGPU-compatible SDF/MSDF text library for three.js (late 2026) was found.

---

## Q7. Animation: skeletal joints and muscle contraction

### Takeaway
Export joint motion as **glTF skins (armature) with animation clips**. Export muscle contraction as **morph targets (Blender shape keys)** driven by animation or by joint angle. Both are standard glTF 2.0, and meshopt compresses morph targets and animation data. BatchedMesh does not support skinning or morphs, so animated structures should be **separate `SkinnedMesh` objects swapped in on demand**: hide their batch instances while the animation demo plays.

### Cited Findings
- The gltf-transform `meshopt` function compresses morph targets and animation data. `resample` deduplicates keyframes losslessly, and `sparse` reduces storage for zero-filled arrays. — [gltf-transform meshopt](https://gltf-transform.dev/modules/functions/functions/meshopt); [gltf-transform CLI](https://gltf-transform.dev/cli)
- r185 breaking change: in a skinned `positionNode` (TSL), use `positionGeometry` instead of `positionLocal`. This matters for custom x-ray or highlight materials on skinned meshes. — [Utsubo](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Babylon 9.0 added animation retargeting (secondary source). — [radiancefields.com](https://radiancefields.com/platforms/babylon-js)

### Inferences
- **File size:** morph targets store one position delta (and optionally a normal delta) per vertex per target. On a 50k-vertex muscle group with 3 targets, that is about 50k × 3 × 12 bytes = 1.8 MB uncompressed for positions alone. Use sparse accessors (`sparse`) when only part of the mesh moves, quantize the deltas, and apply meshopt. Load animation packs lazily, per joint demo.
- **Muscle contraction:** a "contracted" shape key (shortened, thickened belly) blended by a weight tied to the joint angle (for example elbow flexion → biceps weight) gives a believable demo cheaply. Drive the weight in JavaScript from the bone rotation instead of baking curves, so it stays in sync with interactive joint scrubbing.
- **Rig design:** one shared skeleton for bones and muscles in the animated region. Bones are rigid-bound (weight 1 to one joint), muscles are skinned with smooth weights plus shape keys. Export from Blender with "Include › Custom Properties", "Shape Keys", "Skinning", and the "Always Sample Animations" option as needed (prior knowledge, not re-verified).
- **Clipping and caps on animated meshes:** CPU caps (approach b) would need recomputing every frame for animated meshes. Use the shader-only back-face cap (approach c) while animating.

### Gaps
- No measured data on morph-target file sizes or performance for anatomical muscles on mobile was found.
- No documentation was checked on the current Blender (4.x/5.x) glTF exporter option names.

---

## Q8. UI framework and state management for 6000-structure visibility

### Takeaway
Keep the **3D state outside the UI framework**, in typed arrays inside the viewer module, and use the UI framework only for panels (structure tree, search, layer sliders, quiz). **React** (largest ecosystem, accessible tree and virtual-list components) or **Svelte 5 / Solid** (fine-grained reactivity, smaller runtime) both work. The deciding factor is team familiarity, not rendering performance. The 6000-row structure tree must use a virtualized list.

### Cited Findings
- No 2026 primary source specifically benchmarking UI frameworks for 3D-viewer side panels was found (see Gaps).
- R3F v10 is alpha. Its WebGPU default and `/legacy` WebGL entry show the React 3D bindings are mid-migration. — [newreleases.io R3F alpha.6](https://newreleases.io/project/npm/@react-three/fiber/release/10.0.0-alpha.6)

### Inferences
- **State model:** `Uint8Array visibility[N]`, `Float32Array opacity[N]`, `Uint8Array layerDepth[N]`, plus a static hierarchy (system → region → group → structure) as flat arrays with parent indices. "Hide the whole muscular system" becomes a range or bitset operation, followed by one pass of `setVisibleAt` calls. Batch updates per frame and avoid per-structure UI re-renders.
- **UI binding:** expose coarse-grained signals or stores to the UI: selection, the hovered ID, per-group tri-state checkbox (all, some, none) counts, and section plane values. With React, use Zustand (or a similar external store) with selectors, and use `useSyncExternalStore` for the small slices the UI needs. Never put the 6000-element arrays in React state.
- **Dissection layers:** define `layerDepth` per structure (skin = 0, superficial fascia/muscles = 1, deep muscles = 2, …, bones = N). A "peel" slider sets `opacity = f(layerDepth, slider)` per instance (`setColorAt` alpha), and moves structures between the opaque and transparent batches past a threshold.
- **URL-shareable state:** encode visibility as a compressed bitset (6000 bits ≈ 750 bytes before compression) for deep links to dissection views. Only structural view state goes in the URL, never personal data.
- **Vanilla viewer + any UI:** the viewer is a framework-agnostic TypeScript class with an event emitter. That keeps the option of swapping the UI framework, or embedding the viewer in a Rails/Hotwire page, open.

### Gaps
- No current benchmark data comparing React, Svelte and Solid for this kind of panel UI was found. The recommendation rests on general architectural reasoning.

---

## Q9. Case studies: large anatomy, medical and CAD scenes on the web (BioDigital, Sketchfab, xeokit)

### Takeaway
BioDigital Human, the reference web anatomy platform, was built on a private fork of **SceneJS**, the WebGL engine by Lindsay Kay, who later created xeogl and xeokit. xeokit is the closest technical precedent: a WebGL engine specialized for huge BIM/CAD models with thousands of pickable objects, X-ray, highlighting, section planes and section caps. It is relevant as a source of **techniques** (data-texture batching, progressive section caps, X-ray modes), but is not recommended as the engine. It is AGPL or commercially licensed (prior knowledge, not re-verified), BIM-oriented, and has no skeletal or morph animation focus.

### Cited Findings
- BioDigital Human was built on SceneJS (open-source WebGL library) in an adapted private version, per its creator. An early test rendering the 206-bone model ran at roughly 20 FPS. — [xeolabs portfolio: BioDigital Human](https://xeolabs.github.io/portfolio/biodigital-human)
- BioDigital offers over 1000 interactive 3D anatomy models on desktop and mobile browsers. — [Wikipedia: BioDigital](https://en.wikipedia.org/wiki/BioDigital) (secondary)
- xeokit section caps: progressive, filterable, multi-plane trimmed, earcut triangulation, discards non-watertight meshes. — [xeokit sectionCaps](https://xeokit.github.io/sdk/docs/api/modules/presentations.sectionCaps.html)

### Inferences
- **What to borrow from xeokit:** (1) object-ID-centric API (`setVisible(ids)`, `setXRayed(ids)`, `setHighlighted(ids)`, `setSelected(ids)`), which maps exactly to atlas needs; (2) progressive, worker-style section caps; (3) X-ray mode as a material state (fill alpha + edge lines) rather than true OIT.
- **Why not xeokit as the engine:** no skinned or morph animation story for joints and muscles, a smaller community than three.js, and licensing (AGPL-3.0 or commercial; not re-verified this session).
- **Sketchfab:** proprietary viewer (OSG.js heritage, prior knowledge). Not usable as a library, and it caps interactivity on per-object picking and visibility at scale.

### Gaps
- No public 2024–2026 engineering write-ups from BioDigital, Complete Anatomy (Elsevier/3D4Medical) or Visible Body on their current web rendering stacks were found. It is unknown whether BioDigital still runs on SceneJS-derived code.
- No direct mobile benchmark of xeokit on a 6000-object scene was found.

---

## Consolidated recommendation (for the report writer)

| Layer | Choice | Key APIs/techniques |
|---|---|---|
| Engine | **three.js r187+** (pinned) | `WebGPURenderer` (auto WebGL2 fallback, `forceWebGL` for tests), TSL node materials only |
| Scene structure | ~10–30 `BatchedMesh` (material class × opaque/transparent) | `setVisibleAt`, `setColorAt(Vector4)`, `perObjectFrustumCulled`, `sortObjects`, `setGeometryIdAt` for LOD |
| Picking | three-mesh-bvh | `computeBatchedBoundsTree`, `acceleratedRaycast`. Optional GPU ID pass |
| Sections | `ClippingGroup` (WebGPU) / `clippingPlanes` | Caps: TSL back-face cap shader (mobile default) + worker-computed per-structure cap geometry (quality mode). Stencil caps per class as an alternative |
| Transparency | per-object sorting + fresnel x-ray TSL; WBOIT via `RenderPipeline` MRT if needed | avoid depth peeling on mobile |
| Labels | HTML overlay (CSS2DRenderer or custom) + SVG leader lines | no troika under WebGPU |
| Animation | separate `SkinnedMesh` + morph targets loaded on demand | Blender shape keys + armature → glTF. Weights driven by joint angle |
| Assets | Blender → glb per system/region → gltf-transform CI | `dedup prune weld simplify(LOD) resample quantize meshopt etc1s/uastc`. Brotli. Watertight meshes enforced |
| UI | React (or Svelte 5) for panels only. Vanilla TS viewer core | typed-array state, virtualized tree, Zustand/external store |
| Fallback engine | Babylon.js 9.x | built-in clip planes and depth-peeling OIT |

**Top risks to prototype first:** (1) stencil and `ClippingGroup` behavior on WebGPURenderer and its WebGL2 backend on iOS Safari; (2) BatchedMesh memory and frame time with 6000 structures on a mid-range Android under WebGL2; (3) mirrored (negative-scale) geometry being unsupported in BatchedMesh, which forces baked mirrored geometry.
