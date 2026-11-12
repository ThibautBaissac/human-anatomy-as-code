# Relations anatomiques Implementation Plan

**Goal:** structures carry typed anatomical relations (branch of, tributary of, continuation of, arterial supply, innervation), imported from FMA and Wikidata snapshots, compiled into the atlas, shown in the structure card, with a "Montrer le réseau" view of a vessel's territory.

**Architecture:** data first: a `relations` list on structures (and on sides for real asymmetries) plus a registry of external targets, validated and resolved by `compileAtlas`, which also emits inverses and the labels the viewer cannot find otherwise. Snapshots are fetched once by a separate command; the import plan is pure and writes YAML through the existing merge helpers. In the app, the catalog answers "what is related to this selection" and "what is this network"; the view state gains `network` (`net=`), rendered through the isolation path.

**Tech stack:** TypeScript run by Node ≥ 24 (`node --test`), `yaml`, `ajv` 2020; React + three.js app (Vite); Playwright e2e.

**Spec:** `tasks/specs/2026-11-11-relations-anatomiques.md` (rulings beside it in `tasks/specs/2026-11-11-relations-anatomiques.decisions.md`)

## Global constraints

- The build and the import never call the network; only the fetch script does.
- Node ≥ 24, no new runtime dependency in the app.
- Every user-facing string lives in `strings.ts`, in French; type slugs stay English in the data.
- Relations are written at structure level unless the two sides differ (ADR 0001); a side is otherwise derived only in the viewer.
- A relation's `source` is `curated` or an id of the source registry; every source providing relations declares `relations` in `provides`.
- Interactive elements: native buttons, explicit accessible names, 44 px minimum targets on touch.
- The network of the largest origin (the aorta) is computed in under 50 ms, measured by a test on the compiled atlas.
- Existing behaviour of `parent`, the tree, the isolation and the actions of muscles is unchanged.

## Testing decisions

Copied from the spec. Seams confirmed with the user, all existing except `catalog.network`, which sits on the existing catalog seam:

1. **Import plan** (snapshot rows + existing structures → planned relations and registry entries). Assert: FMA priority for tree types and Wikidata fallback; union and dedup for supply; P2286/P2289 on a vein ignored; lateralised target mapped through its side ids; external target created with its labels; non-innervation unmapped target dropped; identical sides written at structure level and differing sides at side level; opposite-side relation ignored; a muscle part without relations taking those of its FMA whole; a protected tree relation blocking the import of its type; reviewed and curated relations untouched; idempotence. Prior art: the Wikidata and merge-safety import tests.
2. **`compileAtlas(dataDir)`** on fixture data directories. Assert each validation error listed in the spec with its JSON pointer; resolution of an external target to a slug with a warning; inverses, including side-level ones with their side; external targets emitted only when used; labels of targets absent from a model emitted in that model's atlas. Prior art: the compile tests (systems, joints, models).
3. **Viewer, pure modules**: `catalog.network` (artery with branches and continuation; vein with tributaries; supplied structures included; side kept; midline origin gives both sides; structure without mesh contributes descendants; `aorta` reaches the territory of `abdominal-aorta` through its parts); view hash round trip of `net=` and its exclusion with `iso=`; `appearance` of a network instance hidden by a system filter (opaque), of a network instance hidden by the user (hidden), of a selected non-member (highlighted) and of a non-member (transparent). Prior art: the catalog-appearance and view-hash tests.
4. **One end-to-end scenario**: select an artery, see its branches in the card, follow a link, press "Montrer le réseau", check `net=` in the URL and the pressed button, press it again to end it. Prior art: the systems and motion e2e specs.

A good test asserts on the emitted atlas, the planned YAML, the instance keys or the URL, never on internal maps.

## File structure

Tools (`tools/atlas`):
- `src/types.ts` (modify): `RelationType`, `RELATION_TYPES`, `TREE_TYPES`, `Relation`, `ExternalTarget`; `relations` on `Structure` and `SideBlock`; `'relations'` in `Source.provides`.
- `schemas/structure.schema.json`, `schemas/source.schema.json` (modify); `schemas/external-targets.schema.json` (create).
- `src/relations.ts` (create): relation validation, resolution and inversion used by the compiler. Owns the kind rules of each type.
- `src/compile-atlas.ts` (modify): loads the registry, calls `src/relations.ts`, emits relations, inverses, externals, absent labels.
- `src/coverage.ts` (modify): relation counts.
- `src/fetch-relations.ts` (create): the only network code. Writes the snapshots.
- `src/import/relations-plan.ts` (create): pure planning of relations from snapshots.
- `src/import-relations.ts` (create): reads snapshots and YAML, calls the plan, writes YAML and the registry.
- `src/import/yaml-merge.ts` (modify): `relations` in key orders.
- `src/cli.ts`, `package.json` (modify): `fetch-relations`, `import-relations` commands.
- Tests: `test/compile-relations.test.ts`, `test/import-relations.test.ts`, `test/coverage.test.ts` (create or modify).

Data:
- `data/external-targets.yaml` (create by import), `data/import/relations-fma.csv`, `data/import/relations-wikidata.csv`, `data/import/wikidata-targets.csv`, `data/import/relations-wikidata.rq` (create by fetch), `data/sources/fma.yaml`, `data/sources/wikidata.yaml` (modify).

App (`app`):
- `src/viewer/types.ts` (modify): atlas relation shapes, `ViewState.network`.
- `src/viewer/relations.ts` (create): side derivation, relation items, network walk. Pure.
- `src/viewer/catalog.ts` (modify): `relationsOf`, `labelsOf`, `network`.
- `src/viewer/view-hash.ts`, `src/viewer/view-ops.ts`, `src/viewer/viewer.ts` (modify): `net=`, exclusivity, rendering.
- `src/ui/InfoCard.tsx`, `src/ui/Overlays.tsx`, `src/ui/App.tsx`, `src/ui/strings.ts` (modify).
- Tests: `test/relations.test.ts` (create), `test/view-hash.test.ts`, `test/view-ops.test.ts`, `test/catalog-appearance.test.ts` (modify), `e2e/relations.spec.ts` (create).

### Task 1: Relations in the data format and their validation

**Files:**
- Modify: `tools/atlas/src/types.ts` (after `Action`, ~line 70; `Source.provides`, ~line 120), `tools/atlas/schemas/structure.schema.json`, `tools/atlas/schemas/source.schema.json`, `tools/atlas/src/import/yaml-merge.ts:5,12`
- Create: `tools/atlas/schemas/external-targets.schema.json`, `tools/atlas/src/relations.ts`
- Modify: `tools/atlas/src/compile-atlas.ts` (load the registry next to the sources; new check after "14. muscle actions", ~line 400)
- Test: `tools/atlas/test/compile-relations.test.ts`

**Interfaces:**
- Consumes: `compileAtlas(dataDir)`, `Diagnostic`, `writeDataset`, `sources`, `validStructures` from `tools/atlas/test/helpers.ts`.
- Produces (in `tools/atlas/src/types.ts`):
  - `type RelationType = 'branch-of' | 'tributary-of' | 'continuation-of' | 'arterial-supply' | 'innervation'`
  - `const RELATION_TYPES: RelationType[]` in that order; `const TREE_TYPES: RelationType[] = ['branch-of', 'tributary-of', 'continuation-of']`
  - `interface Relation { type: RelationType; target: string; source: string; status: Status }` (`target` is a slug or `wikidata:Q<digits>`)
  - `Structure.relations?: Relation[]`, `SideBlock.relations?: Relation[]`
  - `interface ExternalTarget { fma?: number; labels: Labels; source: string; status: Status }` and `type ExternalTargets = Record<string, ExternalTarget>` keyed by bare QID (`Q1060392`)
  - `Source.provides` accepts `'relations'`
- Produces (in `tools/atlas/src/relations.ts`): `validateRelations(structures: Loaded<Structure>[], registry: ExternalTargets, knownSources: Set<string>): Diagnostic[]` returning errors (rules below) and the warning `relation-external-resolved`.
- Registry file: `data/external-targets.yaml`, a YAML map QID → entry; absent file = empty registry.

**Risk:** high (changes the data format every later task and every curator depends on)

- [x] **Step 1: Write the failing tests**

  Fixture: `validStructures()` plus these files (all `status: draft`, labels `en` only unless stated):
  - `structures/artery/femoral-artery.yaml`: bilateral, sides with meshes `bp3d:FJ10M` / `bp3d:FJ10`, ids `{ wikidata: 'Q10' }`
  - `structures/artery/popliteal-artery.yaml`: bilateral, sides `FJ11M`/`FJ11`, `relations: [{ type: branch-of, target: femoral-artery, source: fma, status: draft }]`
  - `structures/vein/inferior-vena-cava.yaml`: midline, mesh `bp3d:FJ20`
  - `structures/vein/renal-vein.yaml`: bilateral, sides `FJ21M`/`FJ21`, relation `tributary-of inferior-vena-cava`
  - `structures/vein/gonadal-vein.yaml`: bilateral, `sides.left.relations: [tributary-of renal-vein]`, `sides.right.relations: [tributary-of inferior-vena-cava]`
  - `external-targets.yaml`: `{ Q1: { labels: { en: { text: tibial nerve, source: wikidata, status: draft } }, source: wikidata, status: draft } }`
  - the muscle of `validStructures()` gets `relations: [{ type: innervation, target: 'wikidata:Q1', source: wikidata, status: draft }]`
  - `sources/fma.yaml` and `sources/wikidata.yaml` of the helper get `relations` added to `provides`.

  Cases, one test each, on `compileAtlas(dir)`:
  - the fixture as is → 0 errors
  - `type: sibling-of` → schema error at `/relations/0/type`
  - `target: Femoral Artery` → schema error at `/relations/0/target` (pattern `^([a-z0-9]+(-[a-z0-9]+)*|wikidata:Q[0-9]+)$`)
  - two identical relations in one list → schema error (`uniqueItems`)
  - target `no-such-artery` → error rule `relation-target` at `/relations/0/target`
  - target `wikidata:Q999` absent from registry → error `relation-external`
  - source `pubmed` → error `relation-source`; source `curated` → no error
  - popliteal `branch-of heart` (an organ) → error `relation-kind` (message names `organ`)
  - `arterial-supply` on `human-body` (a group) → error `relation-kind`
  - popliteal with two `branch-of` (femoral-artery and another artery) → error `relation-tree`
  - `femoral-artery` `branch-of popliteal-artery` added (cycle) → error `relation-cycle` naming both slugs
  - `sides.left.relations` on `inferior-vena-cava` (midline) → error `relation-side-shape`
  - gonadal vein also carrying a structure-level `tributary-of` → error `relation-side-mixed`
  - registry entry whose QID equals `femoral-artery`'s `ids.wikidata` (`Q10`) and a relation to `wikidata:Q10` → no error, warning `relation-external-resolved`
  - registry entry without `labels.en` → schema error in `external-targets.yaml`
  - a source whose `provides` lacks `relations` used by a relation → error `relation-source`

  Kind rules (exact): `branch-of`: subject and target both `artery` or both `nerve`. `tributary-of`: `vein` → `vein`. `continuation-of`: same kind, one of `artery`, `vein`, `nerve`. `arterial-supply`: subject not `group`, target `artery`. `innervation`: subject not `group`, target `nerve` or `wikidata:`. Side relations hold for that side: the cycle check runs on the graph whose nodes are `slug` (non-bilateral) and `slug@side` (bilateral), edges by the side derivation of the spec.

- [x] **Step 2: Run the tests and watch them fail**

  Run: `npm test -w tools/atlas`
  Expected: FAIL on every new case (unknown property `relations`, missing rules)

- [x] **Step 3: Implement**

  Data: add `relations` to `provides` in `data/sources/fma.yaml` and `data/sources/wikidata.yaml`.

  Schemas: `relation` def `{ type: enum RELATION_TYPES, target: pattern above, source: string, status: $ref status }`, all required, no additional properties; `relations: { type: array, minItems: 1, uniqueItems: true, items: relation }` on structure and side. `external-targets.schema.json`: object, property names `^Q[0-9]+$`, values `{ fma?: integer, labels (en required, same label def as structures), source, status }`. `KEY_ORDER` gains `'relations'` after `'actions'`; `SIDE_ORDER` gains `'relations'` last. `validateRelations` in `src/relations.ts`, called from `compileAtlas` after the actions check; `err`/`warn` pointers are JSON pointers into the structure file (`/sides/left/relations/0/target`).

- [x] **Step 4: Run the tests and watch them pass**

  Run: `npm test -w tools/atlas && npm run typecheck -w tools/atlas && npm run validate -w tools/atlas`
  Expected: PASS; `validate` on the real data still reports 0 errors.

- [x] **Step 5: Commit**

  ```bash
  git add tools/atlas data/sources
  git commit -m "Relations in the data format: schema, registry of external targets, validation"
  ```

### Task 2: Relations, inverses and outside labels in the compiled atlas

**Files:**
- Modify: `tools/atlas/src/compile-atlas.ts` (`Atlas` and `CompiledStructure` interfaces, ~lines 19–37; `compileStructure`, ~line 115; `buildAtlas`, ~line 413; sources counted as used, ~line 441)
- Modify: `tools/atlas/src/relations.ts`
- Test: `tools/atlas/test/compile-relations.test.ts`

**Interfaces:**
- Consumes: `Relation`, `ExternalTargets`, `RELATION_TYPES` (Task 1).
- Produces (exported from `compile-atlas.ts`):
  - `interface CompiledRelation { type: RelationType; target: string; source: string; status: Status; side?: Side }` — `target` is a slug once resolved, else `wikidata:Q…`; `side` set for side-level relations (the subject's side).
  - `interface InverseRelation { type: RelationType; subject: string; source: string; status: Status; side?: Side }` — `side` is the subject's side when the relation is side-level.
  - `CompiledStructure.relations?: CompiledRelation[]`, `CompiledStructure.inverse?: InverseRelation[]`; side blocks no longer carry `relations`.
  - `Atlas.externals: Record<string, { fma?: number; labels: Labels }>` keyed `wikidata:Q…`, only entries used by a relation of a structure of this model.
  - `Atlas.outside: Record<string, { kind: string; labels: Labels }>` keyed by slug: every structure absent from this model that is a relation target or an inverse subject of a structure present in it.
  - Ordering: `relations` and `inverse` sorted by `RELATION_TYPES` index, then `side` (none, left, right), then target/subject by `byKey`.

**Risk:** high (the atlas JSON is the contract with the app)

- [x] **Step 1: Write the failing tests**

  Same fixture as Task 1, compiled; assertions on `result.atlases`:
  - male atlas, `popliteal-artery.relations` → `[{ type: 'branch-of', target: 'femoral-artery', source: 'fma', status: 'draft' }]`
  - `femoral-artery.inverse` → `[{ type: 'branch-of', subject: 'popliteal-artery', source: 'fma', status: 'draft' }]`
  - `gonadal-vein.relations` → two entries `tributary-of` with `side: 'left'` target `renal-vein` and `side: 'right'` target `inferior-vena-cava`; `gonadal-vein.sides.left` has no `relations` key
  - `renal-vein.inverse` contains `{ type: 'tributary-of', subject: 'gonadal-vein', side: 'left', … }`; `inferior-vena-cava.inverse` contains `subject: 'renal-vein'` without side and `subject: 'gonadal-vein'` with `side: 'right'`
  - muscle relation `wikidata:Q1` stays `wikidata:Q1`; `atlas.externals['wikidata:Q1'].labels.en.text` = `tibial nerve`
  - a registry entry used by no relation → absent from `externals`
  - relation to `wikidata:Q10` (resolved, Task 1) → compiled `target: 'femoral-artery'`, and it appears in `femoral-artery.inverse`
  - add `structures/organ/ovary.yaml` (`sex: female`, bilateral, `arterial-supply femoral-artery`): male atlas has `outside.ovary.labels.en.text = 'ovary'` and `femoral-artery.inverse` includes `subject: 'ovary'`; female atlas has no `outside.ovary`
  - a structure whose source `fma` is used only by relations → `fma` appears in `attributions`
  - compiling twice gives byte-identical JSON

- [x] **Step 2: Run the tests and watch them fail**

  Run: `npm test -w tools/atlas`
  Expected: FAIL (no `inverse`, `externals`, `outside`)

- [x] **Step 3: Implement**

  In `buildAtlas`, per model: resolve targets (registry QID carried by a structure's or a side's `ids.wikidata` → that slug), flatten side relations with `side`, build inverses from all structures (present or not) and keep those whose target is present, collect `outside` and `externals`. Count relation sources as used for attributions.

- [x] **Step 4: Run the tests and watch them pass**

  Run: `npm test -w tools/atlas && npm run typecheck -w tools/atlas && npm run data`
  Expected: PASS; `build/atlas-male.json` written.

- [x] **Step 5: Commit**

  ```bash
  git add tools/atlas
  git commit -m "Compiled atlas carries relations, their inverses, external targets and outside labels"
  ```

### Task 3: Relations in the coverage report

**Files:**
- Modify: `tools/atlas/src/coverage.ts`
- Test: `tools/atlas/test/coverage.test.ts`

**Interfaces:**
- Consumes: `Atlas` with `relations`, `externals` (Task 2); the registry (`ExternalTargets`).
- Produces: `coverage(atlas, registry?: ExternalTargets)` result gains `relations: { byType: Record<RelationType, { total: number; bySource: Record<string, number>; byStatus: Record<Status, number> }>; missing: { arteriesWithoutBranchOf: number; veinsWithoutTributaryOf: number; musclesWithoutInnervation: number }; externalsUsed: number; registryUnused: string[] }`; `coverageMarkdown` prints a "Relations" section.

**Risk:** normal

- [x] **Step 1: Write the failing tests**
  - Task 1 fixture → `byType['branch-of'].total = 1`, `bySource.fma = 1`, `byStatus.draft = 1`; `byType['tributary-of'].total = 3` (renal, gonadal left, gonadal right)
  - `missing.arteriesWithoutBranchOf = 1` (femoral), `missing.veinsWithoutTributaryOf = 1` (inferior vena cava), `missing.musclesWithoutInnervation = 0`
  - registry with an extra unused `Q2` → `registryUnused = ['Q2']`, `externalsUsed = 1`
  - `coverageMarkdown` output contains the line `| branch-of | 1 |`

- [x] **Step 2: Run the tests and watch them fail** — `npm test -w tools/atlas`, FAIL.
- [x] **Step 3: Implement** — counts from the compiled male atlas; `cli.ts coverage` passes the registry read from `<dataDir>/external-targets.yaml`.
- [x] **Step 4: Run the tests and watch them pass** — `npm test -w tools/atlas && npm run coverage`, PASS and a Relations section printed.
- [x] **Step 5: Commit**

  ```bash
  git add tools/atlas
  git commit -m "Coverage report counts relations by type, source and status"
  ```

### Task 4: Fetch command writing the relation snapshots

**Files:**
- Create: `tools/atlas/src/fetch-relations.ts`, `data/import/relations-wikidata.rq`
- Modify: `tools/atlas/src/cli.ts` (USAGE and dispatch), `tools/atlas/package.json` (script `fetch-relations`: `node src/cli.ts fetch-relations ../../data`)
- Test: `tools/atlas/test/fetch-relations.test.ts` (pure parts only: request building and CSV writing; no network in tests)

**Interfaces:**
- Consumes: the structure YAML files (FMA ids and Wikidata QIDs at structure and side level), `readWikidata` from `src/import/wikidata.ts` (to map FMA ids of muscle wholes to QIDs).
- Produces three snapshot files, exact formats (RFC 4180, header line, LF, rows sorted by every column in order, no duplicate rows):
  - `data/import/relations-fma.csv` — header `subject_fma,relation,target_fma`; `relation` ∈ `branch_of`, `tributary_of`, `continuous_distally_with`, `arterial_supply`, `regional_part_of`, `constitutional_part_of`, recorded exactly as the FMA states it on the subject.
  - `data/import/relations-wikidata.csv` — header `subject_qid,property,target_qid`; `property` ∈ `P3261`, `P2286`, `P3189`.
  - `data/import/wikidata-targets.csv` — header `qid,fma,en,fr,la`; one row per `P3189` target QID; empty cell when absent.
- Produces `fetchRelations(dataDir: string, opts?: { fetch?: typeof fetch; log?: (s: string) => void }): Promise<{ fmaIds: number; qids: number; missingFma: number[] }>`.

**Risk:** high (external services, throttling, data correctness depends on reading the FMA right)

- [x] **Step 1: Write the failing tests** (with an injected `fetch` returning canned JSON)
  - two canned OLS4 class responses for FMA `22441` and `22457` → `relations-fma.csv` rows for their `branch_of`/`regional_part_of` restrictions, sorted, header first
  - a 404 for FMA `13363` → listed in `missingFma`, other ids still written
  - a canned SPARQL JSON result with two bindings → `relations-wikidata.csv` with two rows
  - QID list of 1 441 items → split into POST batches of at most 200 VALUES each
  - an HTTP 429 then 200 → retried once after the `Retry-After` delay (injected clock), result written

- [x] **Step 2: Run the tests and watch them fail** — `npm test -w tools/atlas`, FAIL.

- [x] **Step 3: Implement**
  - FMA through OLS4 `https://www.ebi.ac.uk/ols4/api/v2/ontologies/fma/classes/{iri}` with `iri` = URL-encoded twice `http://purl.org/sig/ont/fma/fma<id>`, reading the related-class restrictions; subjects: every FMA id of our structures and sides, plus, for kind `muscle`, the `regional_part_of` / `constitutional_part_of` ancestors up to 3 levels (their own relations are fetched too).
  - Wikidata: POST to `https://query.wikidata.org/sparql`, header `User-Agent: haac-atlas/0.1 (relations fetch)`, query text kept in `relations-wikidata.rq` with a `VALUES ?item {}` placeholder filled per batch; subjects: our QIDs (structure and side) plus the QIDs of muscle wholes; properties `P3261`, `P2286`, `P3189`. Then labels and FMA id (`P1402`) of every `P3189` target.
  - At most 1 request per second to each service; on 429/503 wait `Retry-After` (default 60 s), retry up to 5 times, then fail with the batch named.
  - Record in `data/sources/wikidata.yaml` `notes` the date of the relations export.

- [x] **Step 4: Run the tests and watch them pass** — `npm test -w tools/atlas && npm run typecheck -w tools/atlas`, PASS.

- [x] **Step 5: Commit**

  ```bash
  git add tools/atlas data/import/relations-wikidata.rq
  git commit -m "fetch-relations: FMA (OLS4) and Wikidata relation snapshots, batched and throttled"
  ```

### Task 5: Pure import plan for relations

**Files:**
- Create: `tools/atlas/src/import/relations-plan.ts`
- Test: `tools/atlas/test/import-relations.test.ts`

**Interfaces:**
- Consumes: `Structure`, `Relation`, `ExternalTargets`, `RELATION_TYPES`, `TREE_TYPES` (Task 1); snapshot row shapes below.
- Produces:
  - `interface FmaRelRow { subject: number; relation: string; target: number }`, `interface WikidataRelRow { subject: string; property: 'P3261' | 'P2286' | 'P3189'; target: string }`, `interface TargetRow { qid: string; fma?: number; en?: string; fr?: string; la?: string }`
  - `parseRelationSnapshots(fmaCsv: string, wikidataCsv: string, targetsCsv: string): { fma: FmaRelRow[]; wikidata: WikidataRelRow[]; targets: TargetRow[] }`
  - `planRelations(input: { structures: Structure[]; fma: FmaRelRow[]; wikidata: WikidataRelRow[]; targets: TargetRow[]; registry: ExternalTargets; qidByFma: Map<number, string> }): RelationsPlan` — `qidByFma` maps an FMA id to its Wikidata QID (built by the caller from `readWikidata(data/import/wikidata-fma.csv).byFma`); it is how a muscle whole found through FMA part-of rows gets its Wikidata relations.
  - `interface RelationsPlan { relations: Map<string, { structure?: Relation[]; left?: Relation[]; right?: Relation[] }>; registry: ExternalTargets; report: RelationsReport }` — the map holds, for every structure, its complete final lists (protected relations kept, draft ones recomputed); an absent key means no relation.
  - `interface RelationsReport { ignored: { subject: string; reason: string; detail: string }[]; dropped: number; conflicts: { slug: string; type: RelationType; kept: string; planned: string }[]; oppositeSide: string[] }`
  - Constant `CONTINUATION_DISTAL_IS_SUBJECT: boolean` documenting how `continuous_distally_with` is read (set and verified in Task 7).

**Risk:** high (decides every imported relation)

- [ ] **Step 1: Write the failing tests**

  Structures built in the test (minimal `Structure` objects): `femoral-artery` (bilateral, ids fma 1, sides fma 11/12, QIDs Q1/Q11/Q12), `popliteal-artery` (bilateral, fma 2, sides 21/22, Q2), `axillary-artery` (fma 3), `brachial-artery` (fma 4), `renal-vein` (bilateral, fma 5, sides 51/52, side QIDs Q51/Q52), `inferior-vena-cava` (midline, fma 6, Q6), `gonadal-vein` (bilateral, fma 7, sides 71/72), `kidney` (bilateral organ, fma 8, Q8), `gastrocnemius-head` (muscle, fma 9, Q9), `thigh-muscle` (muscle, fma 10, Q10). Cases:
  - FMA `2,branch_of,1` and Wikidata `Q2,P3261,Q99999` → popliteal `[branch-of femoral-artery source fma]` only (FMA priority)
  - Wikidata only `Q2,P3261,Q1` → `[branch-of femoral-artery source wikidata]`
  - FMA `3,continuous_distally_with,4` → with the verified reading, `brachial-artery` gets `continuation-of axillary-artery` (FMA); Wikidata `P3261` never yields `continuation-of`
  - FMA `8,arterial_supply,…` and Wikidata `Q8,P2286,…` to the same artery → one relation, source `fma`; to two different arteries → two relations
  - Wikidata `Q6,P2286,Q1` (subject is a vein) → ignored, report reason `vein-p2286`
  - Wikidata `Q8,P2286,Q11` (target is the left femoral artery's side QID) → `kidney arterial-supply femoral-artery`
  - FMA `71,tributary_of,51` and `72,tributary_of,6` → `gonadal-vein` gets `left: [tributary-of renal-vein]`, `right: [tributary-of inferior-vena-cava]`, no structure-level `tributary-of`
  - FMA `51,tributary_of,6` and `52,tributary_of,6` → `renal-vein` structure-level `[tributary-of inferior-vena-cava]`
  - FMA `71,tributary_of,52` (left subject, right target) → ignored, `oppositeSide` contains `gonadal-vein`
  - Wikidata `Q10,P3189,Q500` with target row `Q500,,tibial nerve,nerf tibial,nervus tibialis` → `thigh-muscle innervation wikidata:Q500`; registry gains `Q500` with labels en/fr/la (source `wikidata`, status `draft`)
  - FMA `8,arterial_supply,99999` (unknown FMA) → no relation, `dropped` incremented
  - FMA `9,regional_part_of,900`, `qidByFma` = `{900 → Q900}`, Wikidata `Q900,P3189,Q500`, and no innervation row for `Q9` → `gastrocnemius-head innervation wikidata:Q500` (source `wikidata`)
  - same, plus Wikidata `Q9,P3189,Q501` → `gastrocnemius-head` keeps only `wikidata:Q501` (the part's own relation wins over its whole)
  - existing `popliteal-artery` with `branch-of femoral-artery status reviewed` and FMA `2,branch_of,3` → kept reviewed only; `conflicts` has `{ slug: 'popliteal-artery', type: 'branch-of', kept: 'femoral-artery', planned: 'axillary-artery' }`
  - existing curated relation `innervation wikidata:Q7` on `thigh-muscle` → still there next to the imported one
  - existing draft relation no longer in the snapshots → removed
  - existing registry entry `Q500` with status `reviewed` and other labels → unchanged
  - running `planRelations` on its own output (structures updated with the planned lists, registry = planned registry) → same plan (idempotence)

- [ ] **Step 2: Run the tests and watch them fail** — `npm test -w tools/atlas`, FAIL.

- [ ] **Step 3: Implement** — pure functions only. Mapping FMA/QID → `(slug, side | null)` from structure and side ids. Type per source row: FMA `branch_of` → `branch-of` when both artery or both nerve; `tributary_of` → `tributary-of`; `continuous_distally_with` → `continuation-of` written on the distal one; `arterial_supply` → `arterial-supply`; Wikidata `P3261` → `branch-of` (artery/nerve subject) or `tributary-of` (vein subject), only when the FMA gives none of that type; `P2286` → `arterial-supply` unless the subject is a vein; `P3189` → `innervation`. Then the side comparison, kind checks (same rules as Task 1), protected-relation precedence and merge, as in the spec's Import section.

- [ ] **Step 4: Run the tests and watch them pass** — `npm test -w tools/atlas && npm run typecheck -w tools/atlas`, PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/atlas
  git commit -m "Relations import plan: FMA first, Wikidata gaps, sides compared, protected relations kept"
  ```

### Task 6: Import command writing relations into the YAML

**Files:**
- Create: `tools/atlas/src/import-relations.ts`
- Modify: `tools/atlas/src/cli.ts` (USAGE, dispatch, report printing), `tools/atlas/package.json` (script `import-relations`: `node src/cli.ts import-relations ../../data`), root `package.json` (`import` script gains `&& npm run -w tools/atlas import-relations`)
- Test: `tools/atlas/test/import-relations.test.ts`

**Interfaces:**
- Consumes: `parseRelationSnapshots`, `planRelations`, `RelationsPlan` (Task 5); `readWikidata` from `src/import/wikidata.ts` (for `qidByFma`, read from `<dataDir>/import/wikidata-fma.csv`); `setOrdered`, `KEY_ORDER` from `src/import/yaml-merge.ts`; `listYaml` from `src/fs-util.ts`.
- Produces: `importRelations(dataDir: string): RelationsReport & { updated: number; unchanged: number; aborted: boolean; unreadableFiles: string[] }`. Reads `<dataDir>/import/relations-fma.csv`, `relations-wikidata.csv`, `wikidata-targets.csv` (all three required; a missing one aborts with its name), writes `relations` (structure level) and `sides.<side>.relations`, removes them when the plan has none, writes `<dataDir>/external-targets.yaml` sorted by QID.

**Risk:** normal

- [ ] **Step 1: Write the failing tests** (temp data dir via `writeDataset`, snapshots written as strings)
  - a draft structure gets its `relations` key after `actions`/`variants` in `KEY_ORDER` position; comments elsewhere in the file are preserved
  - a structure with `status: reviewed` still gets its draft relations (labels precedent)
  - a side-level plan writes `sides.left.relations` after `labels` in the side block
  - a second run writes nothing (`updated = 0`)
  - a missing `relations-fma.csv` → `aborted: true`, no file written
  - a bp3d re-import (`importBp3d` on the fixture) after relations were written keeps `relations` and `sides.*.relations` untouched

- [ ] **Step 2: Run the tests and watch them fail** — `npm test -w tools/atlas`, FAIL.
- [ ] **Step 3: Implement** — same file loading and abort rules as `applyPlan` (unreadable files, duplicate slugs abort); CLI prints counts and the report lists like `printReport`, then runs `compileAtlas` and its report.
- [ ] **Step 4: Run the tests and watch them pass** — `npm test -w tools/atlas && npm run typecheck -w tools/atlas`, PASS.
- [ ] **Step 5: Commit**

  ```bash
  git add tools/atlas package.json
  git commit -m "import-relations writes planned relations and the external target registry"
  ```

### Task 7: Fetch, import and check the real data

**Files:**
- Create (generated): `data/import/relations-fma.csv`, `data/import/relations-wikidata.csv`, `data/import/wikidata-targets.csv`, `data/external-targets.yaml`
- Modify (generated): `data/structures/**/*.yaml`, `data/sources/wikidata.yaml`; possibly `tools/atlas/src/import/relations-plan.ts` (`CONTINUATION_DISTAL_IS_SUBJECT`)
- Modify: `tasks/specs/2026-11-11-relations-anatomiques.decisions.md` (append the measured outcome)

**Interfaces:**
- Consumes: `npm run -w tools/atlas fetch-relations` (Task 4), `npm run -w tools/atlas import-relations` (Task 6), `npm run data`, `npm run coverage -w tools/atlas`.
- Produces: committed snapshots and relations; the e2e pair used by Task 11.

**Risk:** high (bulk data change; needs network)

- [ ] **Step 1: Fetch** — run `npm run -w tools/atlas fetch-relations` in the background (minutes; the Wikidata service may throttle). Expected: three CSV files; the `missingFma` list printed.
- [ ] **Step 2: Verify the continuation orientation** — in `relations-fma.csv`, find the rows linking the FMA ids of `axillary-artery` and `brachial-artery` (from their YAML). Set `CONTINUATION_DISTAL_IS_SUBJECT` so that the plan yields `brachial-artery continuation-of axillary-artery`; add a Task 5 test case reproducing the real row.
- [ ] **Step 3: Import** — run `npm run -w tools/atlas import-relations`. Expected: 0 compile errors. Read the report: conflicts, opposite-side, ignored reasons.
- [ ] **Step 4: Check against the spec's measured coverage** — `npm run coverage -w tools/atlas`. Expected order of magnitude: arteries with `branch-of` ≥ 200 of 298; veins with `tributary-of` ≥ 80 of 180; muscles with `innervation` ≥ 130 of 222. A figure far below means a mapping bug: stop and fix Task 5, do not commit.
- [ ] **Step 5: Pick the e2e pair** — confirm `popliteal-artery` has at least one artery in its inverse `branch-of` (expected: `anterior-tibial-artery`) and its network has more than one structure. If not, choose another bilateral artery with branches and write the choice in the decisions file.
- [ ] **Step 6: Record and commit** — append to the decisions file the counts, the number of side-level relations, and the e2e pair.

  ```bash
  git add data tools/atlas tasks/specs/2026-11-11-relations-anatomiques.decisions.md
  git commit -m "Relations imported from FMA 5.1.0 and Wikidata snapshots"
  ```

### Task 8: Relations and networks in the viewer catalog

**Files:**
- Modify: `app/src/viewer/types.ts` (`AtlasStructure`, `Atlas`, ~lines 26–80)
- Create: `app/src/viewer/relations.ts`
- Modify: `app/src/viewer/catalog.ts` (`Catalog` interface ~line 21, `buildCatalog` return ~line 115)
- Modify: `app/test/fixture.ts`
- Test: `app/test/relations.test.ts`

**Interfaces:**
- Consumes: compiled shapes of Task 2 (`relations`, `inverse`, `externals`, `outside`).
- Produces (in `app/src/viewer/types.ts`): `RelationType`, `RELATION_TYPES` (same order as tools), `AtlasRelation { type; target; source; status; side?: Side }`, `AtlasInverse { type; subject; source; status; side?: Side }`, `AtlasStructure.relations?`, `AtlasStructure.inverse?`, `Atlas.externals?: Record<string, { fma?: number; labels: Partial<Record<Lang, AtlasLabel>> }>`, `Atlas.outside?: Record<string, { kind: string; labels: Partial<Record<Lang, AtlasLabel>> }>`.
- Produces (in `Catalog`):
  - `relationsOf(sel: Selection): RelationItem[]` with `interface RelationItem { type: RelationType; direction: 'forward' | 'inverse'; ref: string; side: Side | null; mark: Side | null; presence: 'present' | 'outside' | 'external'; status: 'draft' | 'reviewed' }`, ordered by `RELATION_TYPES`, forward before inverse, then by name key. `ref` is a slug or `wikidata:Q…`; `side` is the side to select on the other end; `mark` is set only for a side-level relation shown while `sel.side` is null.
  - `labelsOf(ref: string): Partial<Record<Lang, AtlasLabel>> | undefined` (structure, outside or external labels)
  - `network(sel: Selection): string[]` — selection keys (`slug` or `slug@side`), sorted, origin included.
- Side derivation (exact, from the spec): bilateral → bilateral keeps `s`; midline/unpaired → bilateral gives both sides (`null`); bilateral → midline/unpaired gives the single instance (`null`); `s` null gives both. A side-level relation with `side: r` applies only when `s` is null or `s === r`, and links to the other end's side `r` when that end is bilateral.

**Risk:** normal

- [ ] **Step 1: Write the failing tests** — extend `ATLAS` in `app/test/fixture.ts` with compiled-shape structures: `aorta` (midline, no mesh, children `abdominal-aorta`), `abdominal-aorta` (midline, parent `aorta`, mesh `bp3d:FJ30`, inverse `branch-of renal-artery`), `renal-artery` (bilateral, sides `FJ31M`/`FJ31`, relation `branch-of abdominal-aorta`, inverse `arterial-supply kidney`), `kidney` (bilateral, `FJ32M`/`FJ32`, relation `arterial-supply renal-artery`), `femoral-artery` (bilateral `FJ33M`/`FJ33`, inverse `branch-of popliteal-artery`), `popliteal-artery` (bilateral `FJ34M`/`FJ34`, relation `branch-of femoral-artery`), `renal-vein` (bilateral `FJ35M`/`FJ35`, relation `tributary-of inferior-vena-cava`, inverse `tributary-of gonadal-vein side left`), `inferior-vena-cava` (midline `FJ36`, inverse `tributary-of renal-vein`, `tributary-of gonadal-vein side right`), `gonadal-vein` (bilateral `FJ37M`/`FJ37`, relations `tributary-of renal-vein side left`, `tributary-of inferior-vena-cava side right`); `thigh-muscle` gets `innervation wikidata:Q500`; `externals['wikidata:Q500']` labels fr `nerf tibial`; `outside.ovary` labels fr `ovaire`, and `femoral-artery` inverse `arterial-supply ovary`. Extend `INSTANCES` accordingly. Cases:
  - `relationsOf({ slug: 'popliteal-artery', side: 'left' })` → `[{ type: 'branch-of', direction: 'forward', ref: 'femoral-artery', side: 'left', mark: null, presence: 'present', status: 'draft' }]`
  - `relationsOf({ slug: 'renal-artery', side: null })` → forward `branch-of abdominal-aorta` side null; inverse `arterial-supply kidney` side null
  - `relationsOf({ slug: 'gonadal-vein', side: 'left' })` → only `tributary-of renal-vein` side `left`
  - `relationsOf({ slug: 'gonadal-vein', side: null })` → two items, `mark: 'left'` (renal-vein, side left) and `mark: 'right'` (inferior-vena-cava, side null)
  - `relationsOf({ slug: 'inferior-vena-cava', side: null })` → inverse items `renal-vein` side null and `gonadal-vein` side `right` mark `right`
  - `relationsOf({ slug: 'thigh-muscle', side: 'left' })` → `{ ref: 'wikidata:Q500', presence: 'external', side: null }`; `labelsOf('wikidata:Q500').fr.text = 'nerf tibial'`
  - `relationsOf({ slug: 'femoral-artery', side: null })` includes `{ ref: 'ovary', presence: 'outside' }`; `labelsOf('ovary').fr.text = 'ovaire'`
  - `network({ slug: 'femoral-artery', side: 'left' })` → `['femoral-artery@left', 'popliteal-artery@left']`
  - `network({ slug: 'aorta', side: null })` → `['abdominal-aorta', 'aorta', 'kidney', 'renal-artery']` (parts walked, both sides of bilateral branches, supplied kidney)
  - `network({ slug: 'renal-artery', side: 'right' })` → `['kidney@right', 'renal-artery@right']`
  - `network({ slug: 'inferior-vena-cava', side: null })` → `['gonadal-vein@left', 'gonadal-vein@right', 'inferior-vena-cava', 'renal-vein']` (right gonadal directly, left gonadal through the left renal vein)
  - `network({ slug: 'renal-vein', side: 'right' })` → `['renal-vein@right']` (the left gonadal relation does not hold on the right)
  - `network({ slug: 'kidney', side: null })` → `['kidney']` (an organ has no network)
  - performance: when `build/atlas-male.json` exists, `buildCatalog` on it and `network({ slug: 'aorta', side: null })` completes in < 50 ms (median of 5 runs); skipped with a message when the file is absent

- [ ] **Step 2: Run the tests and watch them fail** — `npm test -w app`, FAIL.
- [ ] **Step 3: Implement** — `app/src/viewer/relations.ts` holds the side derivation, item building and the network walk (inverse tree edges + same-kind parts via `childrenOf`, then inverse `arterial-supply` / `innervation` subjects of members); `catalog.ts` delegates to it. No three.js, no DOM.
- [ ] **Step 4: Run the tests and watch them pass** — `npm test -w app && npm run typecheck -w app`, PASS.
- [ ] **Step 5: Commit**

  ```bash
  git add app/src/viewer app/test
  git commit -m "Catalog answers relations of a selection and the network of a vessel"
  ```

### Task 9: Network in the view state and the URL

**Files:**
- Modify: `app/src/viewer/types.ts` (`ViewState` ~line 95, `DEFAULT_VIEW` ~line 116), `app/src/viewer/view-hash.ts` (`encodeView` ~line 35, `decodeView` ~line 55), `app/src/viewer/view-ops.ts` (`hideSelection` ~line 6, `setHidden` ~line 17, `keepKnown` ~line 46), `app/src/viewer/viewer.ts` (`setIsolated` ~line 382, `applyAppearance` ~line 546)
- Test: `app/test/view-hash.test.ts`, `app/test/view-ops.test.ts`, `app/test/catalog-appearance.test.ts`

**Interfaces:**
- Consumes: `catalog.network(sel)` (Task 8), `selectionKey`, `parseSelectionKey`.
- Produces: `ViewState.network: Selection | null` (default `null`); `Viewer.setNetwork(origin: Selection | null): void`; `Viewer.setIsolated(target)` sets `network: null` when `target` is not null; `setNetwork(origin)` sets `isolated: null` when `origin` is not null. `applyAppearance` passes `catalog.instancesOfKeys(catalog.network(network))` as the `isolated` set when a network is active (decision 1).

**Risk:** normal

- [ ] **Step 1: Write the failing tests**
  - `encodeView({ ...DEFAULT_VIEW, network: { slug: 'renal-artery', side: 'left' } })` contains `net=renal-artery@left`; decode with a context that knows the slug → `network` equal
  - hash `iso=heart&net=renal-artery` → decoded `isolated` heart, no `network` (decision 4)
  - `net=no-such` → no `network`; `net=heart@left` (heart not bilateral, `hasSides` given) → no `network`
  - `hideSelection` with selection = network origin → patch has `network: null` (decision 3)
  - `keepKnown` with a network origin that has no instance in the model → `network: null`
  - appearance, with `isolated` = network instances {renal-artery@left, kidney@left}: kidney@left with `hiddenSystems` containing all its systems → alpha 1; renal-artery@left also in `hidden` → not visible; `femur@left` selected and not a member → highlighted; `heart` → alpha `GHOST_ALPHA`

- [ ] **Step 2: Run the tests and watch them fail** — `npm test -w app`, FAIL.
- [ ] **Step 3: Implement** — as in Interfaces; `net=` goes right after `iso=` in `encodeView`.
- [ ] **Step 4: Run the tests and watch them pass** — `npm test -w app && npm run typecheck -w app`, PASS.
- [ ] **Step 5: Commit**

  ```bash
  git add app/src/viewer app/test
  git commit -m "Network in the view state: net= in the URL, exclusive with the isolation"
  ```

### Task 10: Relations and the network button in the card

**Files:**
- Modify: `app/src/ui/strings.ts`, `app/src/ui/InfoCard.tsx` (new `Relations` section between the draft note and `MotionInfo`, ~line 105; network button in `.actions`, ~line 97), `app/src/ui/Overlays.tsx` (`Banners`, ~line 58), `app/src/ui/App.tsx` (~lines 164, 220), `app/src/ui/styles.css` (only if a new class is needed)

**Interfaces:**
- Consumes: `catalog.relationsOf`, `catalog.labelsOf`, `catalog.network` (Task 8); `viewer.setNetwork`, `ViewState.network` (Task 9); existing `Folded`, `previewProps`, `labelText`, `structureName`.
- Produces: strings (exact):
  - `relationTitles: { forward: { 'branch-of': 'Branche de', 'tributary-of': 'Tributaire de', 'continuation-of': 'Prolongement de', 'arterial-supply': 'Vascularisation', innervation: 'Innervation' }, inverse: { 'branch-of': 'Branches', 'tributary-of': 'Tributaires', 'continuation-of': 'Se prolonge par', 'arterial-supply': 'Irrigue', innervation: 'Innerve' } }`
  - `noModel: 'sans modèle 3D'`, `outsideModel: 'absent de ce modèle'`, `relationsDraftNote: 'Relations importées, pas encore relues'`
  - `showNetwork: 'Montrer le réseau'`, `network: 'Réseau'`, `leaveNetwork: 'Quitter le réseau'`
  - side marks reuse `sideButton` (`Côté gauche` / `Côté droit`)

**Risk:** normal

- [ ] **Step 1: Implement the card sections** — one `card-section` per (type, direction) present, `<h3>` with the title, `Folded` list; `present` items are `button.link` with `previewProps` and `onSelect({ slug: ref, side })`; `external` items are text + ` (sans modèle 3D)`; `outside` items text + ` (absent de ce modèle)`; `mark` adds ` — Côté gauche|droit`; names through `labelText` on the structure or `labelsOf(ref)` with the card's language fallback. One draft note if any shown item is draft.
- [ ] **Step 2: Implement the button and the banner** — "Montrer le réseau" button (`aria-pressed` = network origin equals the selection) shown when the structure's kind is `artery`, `vein` or `nerve` and `catalog.network(selection).length > 1`; toggles `viewer.setNetwork(selection | null)`. `Banners` gets `networkName` and shows `Réseau : <strong>name</strong>` with a `Quitter le réseau` button calling `viewer.setNetwork(null)`.
- [ ] **Step 3: Check** — `npm run typecheck -w app && npm test -w app`, PASS; `npm run dev`, open `#sel=popliteal-artery@left&sys=none`, check by hand: sections present, a link selects the branch, the button shows the network and the banner, the 44 px targets on the phone layout (Playwright `mobile` project in Task 11 covers it).
- [ ] **Step 4: Commit**

  ```bash
  git add app/src/ui
  git commit -m "Card shows relations and their inverses; Montrer le réseau with its banner"
  ```

### Task 11: End-to-end scenario

**Files:**
- Create: `app/e2e/relations.spec.ts`

**Interfaces:**
- Consumes: the built data (Task 7), the UI (Task 10), the e2e conventions of `app/e2e/systems.spec.ts` (`open`, `alpha`, `info.project.metadata.query`), the e2e pair recorded in the decisions file (default `popliteal-artery` / `anterior-tibial-artery`).

**Risk:** normal

- [ ] **Step 1: Write the scenario**
  1. open with hash `sel=popliteal-artery@left`
  2. the card has a heading `Branches` and, under it, a button whose name matches `/tibiale antérieure/`
  3. click it → `location.hash` contains `sel=anterior-tibial-artery@left`
  4. go back to `sel=popliteal-artery@left`, click `Montrer le réseau` → button `aria-pressed="true"`, hash contains `net=popliteal-artery@left`, `alpha('anterior-tibial-artery@left')` = 1 while the cardiovascular system is hidden by default, `alpha('femur@left')` < 1, a status banner contains `Réseau`
  5. click `Montrer le réseau` again → `aria-pressed="false"`, hash has no `net=`
  6. no console error
- [ ] **Step 2: Run** — `npm run rebuild` if the build is stale, then `npm run e2e -- relations`. Expected: PASS on every project (desktop and mobile).
- [ ] **Step 3: Full check** — `npm test && npm run typecheck && npm run e2e`. Expected: all green, the aorta performance test from Task 8 not skipped.
- [ ] **Step 4: Commit**

  ```bash
  git add app/e2e/relations.spec.ts
  git commit -m "e2e: relations in the card and the network of an artery"
  ```

## End of tasks

Order and dependencies: 1 → 2 → 3; 1 → 4 → 5 → 6 → 7; 2 → 8 → 9 → 10; 7 and 10 → 11. Tasks 3 and 4–6 can run in parallel with 8–10 once 2 is done. Task 7 needs network access and takes minutes.
