# Relations anatomiques

## Problem statement

Quand un étudiant sélectionne une structure, l'atlas lui donne son nom en trois langues, sa nature, ses systèmes et ses parties, mais rien de ce qui la relie au reste du corps. Il ne sait pas d'où naît une artère, quelles branches elle donne, ce qu'elle irrigue, ni quel nerf commande un muscle. Les atlas commerciaux (Complete Anatomy, Visible Body, BioDigital) tirent l'essentiel de leur valeur pédagogique de ces liens : suivre un vaisseau, voir son territoire.

La donnée ne contient aucune de ces relations. Le champ `parent` ne peut pas en tenir lieu : il exprime une relation *part of* héritée des regroupements régionaux de BodyParts3D, fausse comme arbre de branchement (l'artère tibiale antérieure y est rattachée à l'iliaque externe, alors qu'elle est une branche de la poplitée).

Les sources ouvertes couvrent bien une partie du besoin (mesures du 2026-11-11) : 243 de nos 298 artères ont une relation « branche de » et 99 de nos 180 veines une relation « tributaire de », dont les cibles sont présentes dans l'atlas à 76–84 % ; 82 organes ont une vascularisation artérielle. L'innervation est connue pour 170 de nos 222 muscles, mais les nerfs visés sont presque tous absents de l'atlas : BodyParts3D n'en fournit que 19, tous dans l'orbite.

## Solution

- **Dans la donnée.** Une structure porte une liste `relations` : des liens typés vers une autre structure ou vers une **cible externe**, dans un vocabulaire fermé de cinq types (branche de, tributaire de, prolongement de, vascularisation artérielle, innervation). Chaque relation a sa source et son statut de revue. Une seule direction est écrite ; l'inverse est calculé. Les cibles externes (surtout des nerfs) sont décrites une fois, dans un registre, avec leurs labels fr/en/la.
- **À l'import.** Les relations viennent de snapshots versionnés de la FMA et de Wikidata, écrits en `draft`. Une partie de muscle sans relation reprend celles de son tout dans la FMA. Quand les deux côtés diffèrent (veines gonadiques), les relations s'écrivent par côté. Un import ne modifie jamais une relation `reviewed`.
- **À la compilation.** Les relations sont validées (cibles, types, cycles), résolues, inversées, et transmises à l'atlas.
- **Dans la fiche.** De nouvelles sections listent les relations et leurs inverses (« Branche de », « Branches », « Vascularisation », « Irrigue », « Innervation », « Innerve »…), avec des liens cliquables et la prévisualisation au survol.
- **Dans la vue.** Un bouton « Montrer le réseau » sur une artère, une veine ou un nerf montre le **réseau** : le vaisseau, tout ce qui en dépend en aval, et les structures irriguées ou innervées. Le reste devient transparent, comme pour un isolement. L'état est dans l'URL (`net=`).

## User stories

1. As an étudiant, I want the card of an artery to tell me which artery it is a branch of, so that I know where it comes from.
2. As an étudiant, I want the card of an artery to list its branches, so that I know what it gives off.
3. As an étudiant, I want the card of a vein to tell me which vein it drains into and to list its tributaries, so that I can follow venous return.
4. As an étudiant, I want the card of a vessel to tell me which vessel it continues and which one prolongs it (the axillary artery becomes the brachial artery), so that I can follow a trunk that changes name.
5. As an étudiant, I want the card of an organ or a muscle to list the arteries that supply it, so that I know its blood supply.
6. As an étudiant, I want the card of an artery to list the structures it supplies, so that I know its territory.
7. As an étudiant, I want the card of a muscle to list its nerves, so that I learn its innervation.
8. As an étudiant, I want a nerve that the atlas does not model to be named anyway, marked "sans modèle 3D", so that the innervation is not silently missing.
9. As an étudiant, I want the card of a nerve that the atlas does model to list the structures it innervates, so that I know what it commands.
10. As an étudiant, I want every related structure that exists in the atlas to be a link that selects it, so that I can walk from vessel to vessel.
11. As an étudiant, I want hovering or focusing a related structure in the card to tint it in the 3D view, so that I see where it is before going there.
12. As an étudiant, I want a head or part of a muscle (a head of gastrocnemius) to show the innervation and blood supply of its whole muscle when the sources give none for the part, so that I am not shown an empty card for a part.
13. As an étudiant, I want relations shown in my chosen language (fr, en, la), with the same fallbacks as structure names, so that the card stays consistent.
14. As an étudiant, I want long relation lists folded after a few items with a button for the rest, like the other lists of the card, so that the card stays readable.
15. As an étudiant, I want relations with the side of my selection: the left femoral artery's branches are the left ones, so that the links lead to the structure I am looking at.
16. As an étudiant, I want a midline vessel (the aorta) to lead to both sides of its bilateral branches, so that nothing is missing.
16b. As an étudiant, I want a relation that differs between sides (the left gonadal vein drains into the left renal vein, the right one into the inferior vena cava) shown for the side I selected, and both marked "gauche" and "droite" when no side is selected, so that I learn the asymmetry instead of a false symmetric answer.
17. As an étudiant, I want a "Montrer le réseau" button on an artery, a vein or a nerve that has dependants, so that I can see its whole territory at once.
18. As an étudiant, I want the network of an artery to show the artery, all its branches and their branches, its distal continuations, and every structure they supply, so that I see what depends on it.
19. As an étudiant, I want the network of a vein to show the vein, its tributaries and their tributaries and its distal continuations, so that I see what it drains.
20. As an étudiant, I want the network shown opaque and everything else transparent, even when the cardiovascular system is hidden (as at startup), so that it is visible without first changing filters.
21. As an étudiant, I want the network limited to the side I selected, and both sides for a midline vessel or when no side is selected, so that I study one limb at a time.
22. As an étudiant, I want turning on a network to end an isolation and turning on an isolation to end a network, so that only one of them is ever active.
23. As an étudiant, I want the network kept in the shared URL, so that a link shows the same view.
24. As an étudiant, I want the "Montrer le réseau" button to be pressed while the network is shown and to turn it off when pressed again, so that the state is visible and reversible.
25. As an étudiant in the female model, I want a related structure that this model lacks to appear as plain text, not as a broken link, so that I am never sent nowhere.
26. As an étudiant using a keyboard or a screen reader, I want every relation link and the network button to be a native button with an explicit name, reachable by Tab, so that I can use them without a mouse.
27. As an étudiant on a phone, I want the relation sections and the network button in the card sheet, usable by touch with 44 px targets, so that it works on mobile.
28. As an étudiant, I want a relation still in draft to be flagged like draft names are, so that I know it is not checked yet.
29. As a curator, I want each structure's relations written in its YAML file with their source and status, so that I can review and correct them like any other field.
30. As a curator, I want to add a relation by hand with source `curated`, so that I can fill a gap the sources leave.
31. As a curator, I want an import to refresh draft relations from their source and never touch a reviewed or curated relation, so that my corrections survive.
32. As a curator, I want external targets described once in a registry, with their labels in three languages, so that "nerf tibial" is written once for twenty muscles.
33. As a curator, I want a relation to an external target to resolve automatically to a structure as soon as the atlas contains one with the same Wikidata QID, so that adding a nerve later needs no rewrite.
34. As a curator, I want the build to reject an unknown target, a type outside the vocabulary, an unknown source, a target of the wrong kind, two relations of a tree type on one structure, and a cycle, so that the network can always be computed.
35. As a curator, I want the coverage report to count relations per type, per source and per status, and the structures of each kind that lack the expected relation, so that I know what to curate.
36. As a maintainer, I want the build never to call the network, the relations coming from versioned snapshot files, so that builds stay reproducible and offline.

## Implementation decisions

### Vocabulary

Five types. The relation is written on the **subject**, and points to the **target**. The three tree types are always oriented from distal to proximal, whatever the direction of flow: the subject is the distal element, the target the proximal one.

| Type | Subject → target | Card, on the subject | Card, on the target (inverse) |
|---|---|---|---|
| `branch-of` | artery → artery, nerve → nerve | Branche de | Branches |
| `tributary-of` | vein → vein | Tributaire de | Tributaires |
| `continuation-of` | artery → artery, vein → vein, nerve → nerve | Prolongement de | Se prolonge par |
| `arterial-supply` | any structure except a group → artery | Vascularisation | Irrigue |
| `innervation` | any structure except a group → nerve, or external target | Innervation | Innerve |

`continuation-of` is the FMA `continuous_distally_with` read from the distal side: the brachial artery is the continuation of the axillary artery; the brachial veins are the continuation of the axillary vein. Its meaning is anatomical (proximal to distal), not haemodynamic, so that the network of a vein can follow it the same way as the network of an artery.

The French card titles live in `strings.ts`. The type slugs are part of the data format and are not translated.

### Data format

A structure gains an optional `relations` list. Each item:

- `type`: one of the five types;
- `target`: a structure slug, or `wikidata:<QID>` for an external target (a slug never contains `:`, so the prefix discriminates);
- `source`: a source id from the registry, or `curated`;
- `status`: `draft` or `reviewed`.

Relations are at structure level by default. Following ADR 0001, a real asymmetry is written at side level: a bilateral structure may carry `sides.left.relations` and `sides.right.relations`, same item format. For a given type, a structure carries its relations either at structure level or at side level, never both. A side-level target that is a bilateral structure designates the same side; a side never points to the opposite side. The schema forbids duplicates (same type and target) within one list.

A **registry of external targets** is a new data file, validated by its own JSON schema. Each entry is keyed by QID and holds: `fma` (optional), `labels` (en required, fr and la optional; each with `text`, `source`, `status`), `source`, `status`. No grammatical gender: an external target is never qualified by a side.

`Source.provides` gains `relations`. The `fma` and `wikidata` source entries declare it, and their `version` records the snapshot (FMA 5.1.0 through OLS4; Wikidata, date of the query).

### Import

Two stages, kept apart:

1. **Fetch** (manual, rare, not part of `npm run rebuild`): a script queries Wikidata (batched POST queries, throttling respected) and the FMA through the OLS4 API for our FMA ids, structure and side, and writes two versioned snapshot files in the import directory, next to `wikidata-fma.csv`, with the queries kept as `.rq` files. It also fetches the labels fr/en/la of every target QID that is not one of ours.
2. **Import** (part of `npm run import`): reads the snapshots and plans the relations of every structure. It never touches the network.

Rules of the import plan:

- **Mapping.** A subject or a target is mapped to our structure through its FMA id or its Wikidata QID, at structure level or at side level. A lateralised target ("left renal vein") thus maps to the generic structure.
- **Sources per type.**
  - `branch-of`, `tributary-of`, `continuation-of`: FMA only (`branch_of`, `tributary_of`, `continuous_distally_with`, the latter read from the distal side).
  - Wikidata P3261 fills a gap for two types only: on an artery or a nerve that the FMA leaves without `branch-of`, it gives `branch-of`; on a vein that the FMA leaves without `tributary-of`, it gives `tributary-of`. It never gives `continuation-of`.
  - `arterial-supply`: union of FMA `arterial_supply` and Wikidata P2286, without duplicates; when both give the same target, the FMA is kept as the source.
  - `innervation`: Wikidata P3189 only. The FMA nerves are too fine (dorsal-ramus branches) and have no French names.
- **Exclusions.**
  - P2286 and P2289 on a vein: ignored (used for the satellite artery and for tributaries).
  - A target of the wrong kind for the type: ignored and reported.
  - A self-relation: ignored.
  - A second tree relation of the same type on one structure (after FMA priority): the first by source priority is kept, the others reported.
- **Sides.** The relations of a bilateral structure are planned from its left and right side ids, then compared type by type. When both sides give the same targets (after mapping), they are written once at structure level; when they differ, they are written at side level for that type. Relations found only on the structure id (not lateralised in the source) go to structure level. A relation from a side to the opposite side is ignored and reported.
- **Parts of muscles.** For a muscle whose plan has no `innervation` (resp. `arterial-supply`) relation, the fetch follows the FMA `regional_part_of` and `constitutional_part_of` of its FMA id up to the nearest muscle whole that has such relations, and the import writes these as ordinary draft relations of the part, with that source. Nothing marks them as coming from the whole. This does not depend on our `parent` field: the gastrocnemius is not in the atlas, its heads are.
- **External targets.** An innervation target that maps to none of our structures becomes `wikidata:<QID>` and gets an entry in the registry, with labels from the snapshot (Wikidata, `draft`). A target of another type that maps to none of our structures is dropped and counted: only innervation has external targets in v1.
- **Merge.** A relation's identity is (type, target). Relations with status `reviewed` or source `curated` are never modified or removed. The draft relations of a structure are replaced by the current plan. Relations follow the precedent of labels, not of the structure's other fields: they are merged even on a structure whose own status is `reviewed`, since each relation carries its own status. A registry entry with status `reviewed` is never modified. The import is idempotent.
- **Protected tree relations win.** When a structure has a `reviewed` or `curated` relation of a tree type, the import plans no draft relation of that type on it, and reports the planned one if its target differs. The build therefore never sees two tree relations of one type because of an import.

### Compilation

The compiler validates, then emits, per structure:

- **Validation errors**: unknown target slug; QID absent from the registry; type outside the vocabulary; source neither `curated` nor in the registry; subject or target of the wrong kind for the type; side-level relations on a structure that is not bilateral; one type present both at structure level and at side level; more than one relation of a given tree type on a structure or on one side; a cycle in the graph made of the three tree types together, sides taken into account.
- **Resolution**: a `wikidata:` target whose QID is carried by one of our structures (structure or side ids) resolves to that structure's slug. The compiler emits a warning, so that the next import rewrites it.
- **Inverses**: for each structure, the inverse relations pointing to it, with the side they hold for when they come from side-level relations, so that the viewer does not rebuild the index.
- **External targets**: the registry entries used by at least one relation go into the atlas, with their labels.
- **Models**: relations are emitted unchanged in both models. A model's atlas drops the structures absent from it, so each model's atlas also carries the labels (fr, en, la, with gender and number) of every relation target absent from that model, so that the viewer can name it.

The coverage report gains, per type: relation counts by source and status; structures of each expected kind without the relation (arteries without `branch-of`, veins without `tributary-of`, muscles without `innervation`); external targets used; registry entries unused.

### Viewer: card

- The card shows, after the names and before "Mouvement", one section per type present on the structure, forward then inverse, in the order of the vocabulary table. A section is absent when empty.
- An item whose target is in the displayed model is a link button. Selecting it selects that structure, with the side derived as below. It carries the same pointer and focus preview as the parts list.
- An item whose target is an external target, or a structure absent from the displayed model, is plain text followed by "sans modèle 3D" (external) or "absent de ce modèle".
- Side-level relations: with a side selected, only that side's relations are shown; with no side selected, both sides' relations are shown, each item marked "gauche" or "droite".
- A draft relation is marked like draft names. A single note covers the card.
- Lists are folded after five items with the existing folded-list behaviour.

**Side derivation** (for links and for the network), from the selection's side `s` (left, right or none):

- bilateral → bilateral: the same side `s`;
- midline or unpaired → bilateral: both sides (`s` none);
- bilateral → midline or unpaired: the single instance;
- `s` none: both sides.

### Viewer: network

- **Network** of a structure X with side `s`: the set N built by walking, transitively from X, two kinds of edges:
  - the inverse of `branch-of`, `tributary-of` and `continuation-of`;
  - *part of* (`parent` inverse) towards the parts of a member that have the member's kind. The aorta has no mesh and its branches point to its parts: the network of `aorta` walks to `descending-aorta`, then `abdominal-aorta`, then the branches of `abdominal-aorta` and their territories.

  N then gains every structure whose `arterial-supply` (artery in N) or `innervation` (nerve in N) points to a member of N. Sides follow the derivation above, edge by edge; a side-level relation is an edge for its side only. A structure without mesh contributes the instances of its descendants, as elsewhere in the catalog.
- **Button**: "Montrer le réseau", in the card actions, shown for a structure of kind artery, vein or nerve whose network has more than one structure. `aria-pressed` reflects the state.
- **View state**: a new field, the network origin (a selection), encoded as `net=<slug>` or `net=<slug>@<side>` with the existing selection key format. Turning a network on clears `iso=`; turning an isolation on clears `net=`. A network origin unknown in the current model is dropped, like an unknown isolation.
- **Appearance**: exactly the rules of the isolation, applied to a set, in the same order of precedence:
  - an instance absent from the model, or hidden by the user, stays hidden, network member or not;
  - the selected structure stays highlighted, network member or not;
  - a network member is opaque whatever the kind, system and dissection filters;
  - every other visible instance is transparent;
  - tissues crossing a moving joint stay transparent during a motion;
  - sections (clipping planes) still apply.

### Module contracts

- `catalog.network(selection)` returns the instance keys of the network. It is pure, computed from the atlas data, and does not depend on the scene.
- The catalog exposes, per structure, the forward and inverse relations already resolved by the compiler (with their side when side-level), the external targets' labels, and the labels of targets absent from the model.
- `encodeView` / `decodeView` carry the network origin. `appearance` takes the network set in its state, as it takes the isolated selection today.

## Testing decisions

Seams confirmed with the user, all existing except `catalog.network`, which sits on the existing catalog seam:

1. **Import plan** (snapshot rows + existing structures → planned relations and registry entries). Assert: FMA priority for tree types and Wikidata fallback; union and dedup for supply; P2286/P2289 on a vein ignored; lateralised target mapped through its side ids; external target created with its labels; non-innervation unmapped target dropped; identical sides written at structure level and differing sides at side level; opposite-side relation ignored; a muscle part without relations taking those of its FMA whole; a protected tree relation blocking the import of its type; reviewed and curated relations untouched; idempotence. Prior art: the Wikidata and merge-safety import tests.
2. **`compileAtlas(dataDir)`** on fixture data directories. Assert each validation error listed above with its JSON pointer; resolution of an external target to a slug with a warning; inverses, including side-level ones with their side; external targets emitted only when used; labels of targets absent from a model emitted in that model's atlas. Prior art: the compile tests (systems, joints, models).
3. **Viewer, pure modules**: `catalog.network` (artery with branches and continuation; vein with tributaries; supplied structures included; side kept; midline origin gives both sides; structure without mesh contributes descendants; `aorta` reaches the territory of `abdominal-aorta` through its parts); view hash round trip of `net=` and its exclusion with `iso=`; `appearance` of a network instance hidden by a system filter (opaque), of a network instance hidden by the user (hidden), of a selected non-member (highlighted) and of a non-member (transparent). Prior art: the catalog-appearance and view-hash tests.
4. **One end-to-end scenario**: select an artery, see its branches in the card, follow a link, press "Montrer le réseau", check `net=` in the URL and the pressed button, press it again to end it. Prior art: the systems and motion e2e specs.

A good test here asserts on the emitted atlas, the planned YAML, the instance keys or the URL, never on internal maps.

## Global constraints

- The build and the import never call the network; only the fetch script does.
- Node ≥ 24, no new runtime dependency in the app.
- Every user-facing string lives in `strings.ts`, in French; type slugs stay English in the data.
- Relations are written at structure level unless the two sides differ (ADR 0001); a side is otherwise derived only in the viewer.
- A relation's `source` is `curated` or an id of the source registry; every source providing relations declares `relations` in `provides`.
- Interactive elements: native buttons, explicit accessible names, 44 px minimum targets on touch.
- The network of the largest origin (the aorta) is computed in under 50 ms, measured by a test on the compiled atlas.
- Existing behaviour of `parent`, the tree, the isolation and the actions of muscles is unchanged.

## Out of scope

- Origin and insertion of muscles: the sources give landmarks (lateral epicondyle, linea aspera), not bones; they belong to a later spec together with attachment zones on bones.
- Venous drainage, lymphatic drainage (no lymph nodes in the atlas), UBERON as a source.
- Meshes for the missing nerves; resolving landmarks through Wikidata P361.
- Animated tracing of a path, flow direction arrows, a network of several origins.
- Changing `parent` or the navigation tree.
- An editing interface for relations.
- Relations from one side to the opposite side (left subject, right target): ignored at import, rejected by the build.
- Inheritance computed from our `parent` field, and any marker showing that a part's relation comes from its whole.

## Further notes

- Coverage measured on 2026-11-11 (union of sources, our structures): artery `branch-of` 243/298; vein `tributary-of` 99/180; nerve `branch-of` 13/19; organ arterial supply 82/366; muscle arterial supply 31/222; muscle innervation 170/222, with about 1 % of distinct nerve targets present in the atlas.
- Wikidata quality issues seen: P3490 on the femur pointing at muscles; P2286 on 37 veins (satellite artery); P2289 on 67 veins (tributary). P974 (tributary) is unused on anatomy items.
- The Wikidata query service was throttled on 2026-11-11 (one request per minute); the fetch script must batch and retry.
- Five of our FMA ids return 404 on OLS4 (13363, 23876, 53074, 72951, 72979); the fetch reports them and goes on.
- The HRA ASCT+B tables (blood vasculature, peripheral nervous system, CC BY 4.0) may complete the vessel trees later.
