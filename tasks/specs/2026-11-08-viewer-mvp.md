# Viewer MVP : pipeline d'assets et atlas 3D en ligne (spec 1)

Vocabulaire : voir `CONTEXT.md` (Structure, Slug, Côté, Kind, Couche, Label, Statut de revue, Mesh…). Données d'entrée : `atlas.json` produit par `tools/atlas` (spec `2026-11-08-modele-de-donnees.md`). Choix techniques : `reports/Choix techniques atlas anatomie 3D.md` et `spikes/RESULTS.md`. Cette spec est la première de deux ; la spec 2 couvrira l'offline (PWA) et la validation sur mobile.

## Problem statement

Le jeu de données anatomique existe (1 438 structures, 2 233 meshes, noms FR/EN/LA), mais personne ne peut le voir. Le seul rendu 3D est un spike jetable : il regroupe les meshes par une classe devinée à partir de mots-clés, nomme les nœuds par fichier BodyParts3D et n'a pas d'interface. Un étudiant ne peut ni explorer le corps, ni retrouver une structure par son nom, ni disséquer couche par couche, ni regarder une coupe. Un contributeur ne voit pas à quoi correspondent les structures qu'il relit.

## Solution

Un pipeline transforme les meshes BodyParts3D en un fichier GLB par kind, avec une instance par structure et par côté, nommée par le slug. Une application web locale charge `atlas.json` et ces GLB, et affiche le corps entier en 3D. On y sélectionne une structure au clic, dans l'arbre ou par la recherche ; ses noms en français, anglais et latin s'affichent, avec l'état de relecture. On masque des kinds, on dissèque avec un curseur de couches, on coupe le corps selon les trois plans radiologiques, et l'URL encode la vue pour la partager. L'interface est en français et accessible au clavier.

## User stories

### Étudiant

1. En tant qu'étudiant, je veux voir le corps entier en 3D et le faire tourner, zoomer et déplacer, afin d'explorer l'anatomie librement.
2. En tant qu'étudiant, je veux cliquer sur une structure pour la sélectionner et la voir mise en évidence, afin de savoir ce que je regarde.
3. En tant qu'étudiant, je veux lire le nom de la structure sélectionnée en français, en anglais et en latin, ainsi que son côté, afin d'apprendre la nomenclature.
4. En tant qu'étudiant, je veux voir si un nom n'a pas encore été relu, afin de ne pas apprendre une traduction non vérifiée comme si elle était sûre.
5. En tant qu'étudiant, je veux choisir la langue d'affichage des noms (FR, EN, LA), avec un repli sur le français puis l'anglais quand un nom manque, afin de réviser dans la langue de mon cours.
6. En tant qu'étudiant, je veux chercher une structure par son nom dans n'importe quelle langue, synonymes compris, sans me soucier des accents ni de la casse, afin de la trouver vite.
7. En tant qu'étudiant, je veux parcourir l'arbre des structures (parent, enfants) et sélectionner un nœud, afin de comprendre comment les parties s'emboîtent.
8. En tant qu'étudiant, quand je sélectionne une structure, je veux que la caméra la cadre, afin de la voir sans chercher.
9. En tant qu'étudiant, quand je sélectionne une structure sans mesh propre (un groupe, « membre inférieur »), je veux que toutes ses parties visibles soient mises en évidence, afin de voir ce qu'elle recouvre.
10. En tant qu'étudiant, je veux masquer ou afficher chaque kind (peau, muscles, os…), afin d'isoler un système.
11. En tant qu'étudiant, je veux un curseur de dissection qui retire les couches de la plus superficielle à la plus profonde, afin de disséquer virtuellement.
12. En tant qu'étudiant, je veux un mode fantôme où les couches retirées restent visibles en transparence, afin de garder les repères.
13. En tant qu'étudiant, je veux que la structure sélectionnée reste visible même si sa couche ou son kind est masqué, afin de ne pas perdre ce que j'étudie.
14. En tant qu'étudiant, je veux couper le corps selon un plan axial, coronal ou sagittal et déplacer la coupe, avec des faces coupées pleines et colorées, afin de faire le lien avec l'imagerie.
15. En tant qu'étudiant, je veux voir le nom de la structure survolée, afin d'explorer sans cliquer partout.
16. En tant qu'étudiant, je veux copier l'URL et retrouver exactement la même vue (sélection, couches, kinds, coupes, langue, caméra), afin de partager une vue avec un camarade ou un enseignant.

### Utilisateur au clavier ou avec un lecteur d'écran

17. En tant qu'utilisateur au clavier, je veux atteindre et utiliser la recherche, l'arbre, le panneau, les interrupteurs, le curseur et les coupes sans souris, afin d'utiliser l'atlas pleinement.
18. En tant qu'utilisateur de lecteur d'écran, je veux que l'arbre soit annoncé comme un arbre (niveau, état déplié, position) et que la sélection soit annoncée, afin de m'orienter.

### Contributeur et mainteneur

19. En tant que contributeur, je veux retrouver dans le viewer la structure que je relis, avec son slug et son statut, afin de vérifier qu'elle correspond bien à la géométrie.
20. En tant que mainteneur, je veux construire les assets en une commande à partir de `atlas.json` et des OBJ BodyParts3D, afin de ne rien deviner ni classer à la main.
21. En tant que mainteneur, je veux que le build des assets échoue en listant les OBJ manquants, afin de ne jamais publier un corps incomplet sans le savoir.
22. En tant que mainteneur, je veux un manifeste des assets (fichier, taille, empreinte, nombre d'instances), afin de vérifier le build et de préparer les packs offline de la spec 2.
23. En tant que mainteneur, je veux un test de fumée automatique en WebGPU et en WebGL2, afin de détecter une régression de rendu ou de sélection sans ouvrir de navigateur.
24. En tant que mainteneur, je veux lancer tout le projet (données, assets, application) depuis la racine du dépôt, afin de ne pas mémoriser les commandes de chaque paquet.

## Implementation decisions

### Organisation

- Workspaces npm à la racine : `tools/atlas` (existant), `tools/assets` (nouveau), `app` (nouveau). Scripts racine : `data` (compile `build/atlas.json`), `assets` (construit `build/assets/`), `dev` (lance l'application), `test` (tests de tous les paquets), `e2e` (test de fumée).
- `build/` reste non versionné. L'application sert `build/` comme répertoire statique (`publicDir` de Vite), donc `atlas.json` et `assets/` sont servis à la racine de l'application.
- Les spikes restent en place comme référence jetable ; aucun module de l'application n'importe de code des spikes.

### Pipeline d'assets (`tools/assets`)

Interface : `buildAssets({ atlas, objDir, outDir }) → manifest`. Commande : `assets <atlas.json> <objDir> <outDir>`.

- **Instances.** Le pipeline crée une instance par structure non bilatérale qui a des meshes, et une instance par côté d'une structure bilatérale qui a des meshes sur ce côté. Quand une instance regroupe plusieurs meshes, leurs géométries sont fusionnées en une seule primitive.
- **Nœuds.** Chaque nœud s'appelle `slug` pour une structure non bilatérale, `slug@left` ou `slug@right` pour un côté. Ses `extras` valent `{ slug, side, meshes }` : `side` vaut `left`, `right` ou `null`, et `meshes` liste les références `bp3d:FJ…` triées.
- **Fichiers.** Un fichier `<kind>.glb` est produit par kind qui a au moins une instance. Le kind `group` n'en a jamais.
- **Géométrie.**
  - Positions lues des OBJ (`FJxxxx.obj` et `FJxxxxM.obj`, recherche récursive dans `objDir`) ; l'id après le préfixe `bp3d:` est le nom du fichier.
  - Normales lisses pondérées par l'aire, calculées par le pipeline, et non par `normals()` de gltf-transform, qui crée des normales plates (constat des spikes).
  - Compression `quantize()` puis `meshopt({ level: 'high' })`.
- **Erreurs.** Un OBJ référencé mais introuvable fait échouer le build, avec la liste complète des fichiers manquants ; aucun fichier n'est écrit dans ce cas. Un OBJ sans triangle est une erreur, avec la même règle.
- **Manifeste `manifest.json`.** Il contient `{ kinds: { <kind>: { file, bytes, sha256, instances } }, source: 'bodyparts3d' }`. Les clés sont triées et il n'y a pas d'horodatage.
- **Ordre.** Les instances sont écrites dans l'ordre de leur nom de nœud (tri par point de code).

### Viewer (`app/src/viewer/`)

TypeScript sans framework. L'état est tenu dans des typed arrays, indexés par instance.

**Entrées.** `createViewer(canvas, { backend: 'auto' | 'webgl' })`, puis `load(atlas, manifest, baseUrl, onProgress)`.

**Modules.**
- `catalog` : index pur construit depuis `atlas.json` et la liste des instances chargées. Il fournit :
  - la structure d'une instance ;
  - les instances d'une structure, avec ses descendants pour une structure sans instance propre ;
  - les enfants, les parents et la profondeur dans l'arbre.
- `appearance` : fonction pure `appearance(state, instance) → { visible, alpha, highlighted }`. C'est le point de test principal du viewer ; le rendu ne fait qu'appliquer son résultat.
- `renderer` : WebGPU par défaut (`three/webgpu`), repli automatique ou forcé (`backend: 'webgl'`) en WebGL2.
  - Un `BatchedMesh` par kind, dans un `ClippingGroup`.
  - Matériau standard coloré par kind, couleur de surbrillance en `setColorAt`, alpha porté par la composante w.
  - Picking avec `computeBatchedBoundsTree` et `acceleratedRaycast` de three-mesh-bvh.
  - Caméra Z vers le haut et `OrbitControls`.

**Règles d'apparence (état → instance).**
- **Visibilité par défaut.** Une instance est visible si son kind est affiché et si sa couche est supérieure ou égale au curseur de dissection `layerCut` (entier de 0 à la couche maximale du jeu, 0 = rien n'est retiré).
- **Mode fantôme.** Avec `ghost` actif, une instance retirée seulement par la couche reste visible avec un alpha de 0,15. Une instance dont le kind est masqué reste invisible, même en mode fantôme.
- **Sélection.** Les instances de la structure sélectionnée sont toujours visibles, opaques et `highlighted`, quels que soient le kind et la couche. Si un côté est sélectionné (`slug@left`), seule son instance l'est.
- **Survol.** Il ne change pas l'apparence ; il émet seulement un événement.

**API publique.**
- `select(target | null)`, où `target` vaut `{ slug, side? }`.
- `focus(slug, side?)` : cadre la caméra sur la boîte englobante des instances.
- `setKindVisible(kind, on)`, `setLayerCut(n)`, `setGhost(on)`.
- `setSection(axis, position | null)`, avec `axis` parmi `axial`, `coronal` ou `sagittal`, et `position` dans [0, 1] le long de la boîte englobante du corps. Plusieurs plans peuvent être actifs, un par axe.
- `getState()` et `setState(partial)` : état sérialisable, avec la caméra (position et cible).
- `on('select' | 'hover' | 'change', cb)` : `change` est émis à chaque modification d'état, et sert au pont avec React et à la mise à jour du hash.
- `dispose()`.

**Coupes.**
- `ClippingGroup` porte les plans actifs.
- Les faces coupées sont remplies par le shader de faces arrière (TSL `frontFacing`), qui les teinte de la couleur du kind, assombrie. Les matériaux passent en `DoubleSide` dès qu'une coupe est active.
- Le picking ignore la partie coupée : seules les intersections du côté conservé de chaque plan actif sont retenues.

**Chargement.**
- `atlas.json` et `manifest.json` sont lus d'abord, puis tous les GLB en parallèle, avec un callback de progression.
- L'échec d'un GLB n'arrête pas les autres : le kind manquant est signalé par l'événement `change` (`state.failedKinds`), et l'interface l'affiche.
- La construction du BVH a lieu au chargement, sur le thread principal (mesuré à environ 2,7 s dans les spikes). Elle n'est optimisée que si le budget de chargement est dépassé.

### Interface (`app/src/ui/`, React)

- **Pont.** `useSyncExternalStore` sur l'événement `change` du viewer ; aucune autre bibliothèque d'état.
- **Disposition.**
  - En-tête : titre, champ de recherche avec liste de résultats, sélecteur de langue des noms (FR, EN, LA).
  - Colonne gauche : l'arbre.
  - Colonne droite : le panneau de la structure.
  - Barre du bas : interrupteurs par kind, curseur de couches et case « fantôme », trois coupes (case à cocher et curseur chacune).
  - Ligne d'état : nom survolé, progression du chargement, erreurs.
- **Arbre.**
  - Racine `human-body` ; les structures sans parent sont affichées sous un nœud « Non rattachées ».
  - Liste virtualisée (`@tanstack/react-virtual`), rôle ARIA `tree`, éléments `treeitem` avec `aria-level`, `aria-expanded`, `aria-setsize`, `aria-posinset` et `aria-selected`.
  - Navigation clavier conforme au motif ARIA APG Tree View : flèches haut et bas, droite pour déplier ou entrer, gauche pour replier ou remonter, Début/Fin, Entrée pour sélectionner.
  - Une sélection venue de la 3D ou de la recherche déplie les ancêtres et fait défiler jusqu'au nœud.
- **Recherche.** Fonction pure `search(index, query, limit = 20)`.
  - Elle compare la requête normalisée (minuscules, sans diacritiques, espaces réduits) aux labels fr, en et la, aux synonymes et au slug.
  - Classement : égalité exacte, puis préfixe, puis sous-chaîne ; à égalité, le label le plus court d'abord, puis le slug.
  - Une requête de moins de 2 caractères ne donne aucun résultat.
  - Chaque résultat indique le nom dans la langue courante et la langue où la correspondance a été trouvée.
- **Panneau de la structure.**
  - Nom dans la langue courante, avec le repli fr → en ; les trois noms ; badge « non relu » sur chaque label `draft`.
  - Côté sélectionné, avec son nom latéralisé (labels composés de `atlas.json`).
  - Kind, couche, parent et enfants (cliquables), slug.
  - Sans sélection, le panneau affiche une aide courte.
- **Langue des noms.** Elle s'applique à l'arbre, au panneau, aux résultats et au survol. Repli fr puis en quand le nom manque ; le latin manquant se replie aussi sur fr puis en.
- **Chaînes de l'interface.** En français, regroupées dans un seul module (`strings.ts`), sans bibliothèque d'i18n.
- **Accessibilité (RGAA 4.1.2).**
  - Tous les contrôles sont natifs ou dotés du rôle ARIA adéquat, avec un nom accessible.
  - Ordre de focus logique et focus visible.
  - La sélection est annoncée dans une région `aria-live="polite"`.
  - Le canevas 3D a un nom accessible et un texte qui renvoie vers l'arbre et la recherche, ses équivalents accessibles.
  - Contrastes AA.

### Lien profond

Fonctions pures `encodeView(state) → string` et `decodeView(hash) → Partial<State>`. Le hash est mis à jour (`history.replaceState`) au plus une fois toutes les 250 ms ; il est lu au chargement et à `hashchange`.

Paramètres :
- `sel=<slug>` ou `sel=<slug>@left|right` ;
- `layer=<n>` ;
- `ghost=1` ;
- `hide=<kind>,<kind>` (kinds masqués) ;
- `cut=<axe>:<pos>[,<axe>:<pos>]`, position à 3 décimales ;
- `lang=fr|en|la` ;
- `cam=px,py,pz,tx,ty,tz`, en millimètres arrondis à l'entier.

Un paramètre absent prend sa valeur par défaut. Une valeur invalide (slug inconnu, kind inconnu, nombre hors bornes, axe inconnu) est ignorée sans erreur, et les autres paramètres s'appliquent quand même. L'aller-retour `decodeView(encodeView(s))` restitue `s`, à l'arrondi près.

### Ordre de livraison

1. Workspaces et scripts racine, puis `tools/assets` avec ses tests, puis le build réel des assets.
2. Viewer : `catalog`, `appearance`, `encodeView` / `decodeView`, `search` (tests unitaires), puis le rendu.
3. Interface React.
4. Test de fumée Playwright et mesures de budget.

## Testing decisions

- **Points de test unitaires (valeurs simples, sans GPU ni DOM) :**
  - `appearance` (règles de visibilité, de fantôme, de sélection et de côté) ;
  - `catalog` (instances d'un groupe par ses descendants, repli sur « Non rattachées ») ;
  - `encodeView` / `decodeView` (aller-retour, valeurs invalides ignorées) ;
  - `search` (normalisation, classement, synonymes, seuil de 2 caractères).
- **Pipeline d'assets :** `buildAssets` sur une fixture, c'est-à-dire un petit `atlas.json` et quelques OBJ minuscules écrits à la main. On vérifie :
  - un nœud par instance, avec le bon nom, les bons `extras` et la fusion des meshes d'un même côté ;
  - un fichier par kind et aucun pour `group` ;
  - l'échec avec la liste des OBJ manquants, sans aucun fichier écrit ;
  - le contenu du manifeste.

  Le GLB produit est relu avec `NodeIO` de gltf-transform : c'est le comportement observable, et non l'implémentation.
- **Test de fumée Playwright** (`@playwright/test`, Chrome du système en headless, `--enable-unsafe-webgpu`), lancé sur le build réel des assets, deux fois : une en WebGPU, une avec `?backend=webgl`. Il vérifie :
  1. la fin du chargement sans erreur de console ;
  2. un clic au centre du canevas qui sélectionne une structure (le panneau affiche un nom) ;
  3. une recherche « fémur » puis la sélection du premier résultat, qui met à jour le panneau et le hash ;
  4. l'activation d'une coupe axiale sans erreur de console ;
  5. le rechargement de l'URL, qui restitue la sélection.
- **Pas de tests de composants React isolés** : le comportement de l'interface est couvert par les fonctions pures et le test de fumée. La seule exception est la navigation clavier de l'arbre, testée comme une fonction pure de réduction : `treeKeyReducer(state, key) → state`.
- **Antécédents :** `tools/atlas/test` (node:test, fixtures écrites dans un répertoire temporaire) ; `spikes/viewer/scripts/run-bench.mjs` pour le pilotage de Chrome headless.

## Global constraints

- Node ≥ 24 ; TypeScript exécuté nativement par Node pour `tools/` ; Vite 8 pour `app/`.
- Versions figées :
  - rendu : `three@0.187.0`, `three-mesh-bvh@0.9.18` ;
  - interface : `react@19`, `react-dom@19`, `@tanstack/react-virtual@3` ;
  - pipeline : `@gltf-transform/core|extensions|functions@4.5.1`, `meshoptimizer@1.3.0` ;
  - outillage : `vite@8.3.4`, `typescript@5.9.3`, `@playwright/test@1.65.0`.

  Aucune autre dépendance d'exécution.
- Tests unitaires avec `node:test` dans `tools/` ; avec `node:test` dans `app/` pour les modules purs, qui n'importent ni `three`, ni React, ni le DOM.
- Budget de performance, mesuré par le test de fumée sur Mac Apple Silicon en WebGPU, scène complète opaque : chargement complet (atlas, GLB, BVH) en moins de 3 s ; frame moyenne de moins de 16,7 ms.
- Couleurs par kind :
  - os `#e8dcc0`, cartilage `#9ec9d6`, ligament `#d8d0a0` ;
  - muscle `#b5443b`, tendon `#e0d6c8`, fascia `#c9b8a8`, peau `#e8b89a` ;
  - artère `#d0302a`, veine `#3456b0`, lymphatique `#7fbf7f` ;
  - nerf `#f0d040`, SNC `#e8c8a0`, organe `#c58a7a`.

  Surbrillance de sélection : `#3ad06a`.
- Interface en français ; noms anatomiques en FR, EN ou LA selon le choix de l'utilisateur.
- Conformité RGAA 4.1.2 / WCAG 2.1 AA pour tout ce qui n'est pas le rendu 3D lui-même.
- Aucune donnée personnelle, aucune requête réseau hors de l'origine de l'application, aucun traceur.
- `manifest.json` et l'ordre des nœuds sont déterministes : clés triées, pas d'horodatage.

## Out of scope

- Offline : service worker, Serwist, packs, Cache API, installation (spec 2).
- Validation et adaptation mobile, interface tactile dédiée (spec 2).
- Déploiement public, tant que le DBCLS n'a pas confirmé la licence par écrit.
- Étiquettes flottantes avec lignes de rappel, labels sur plusieurs structures à la fois.
- Coupe haute qualité (caps calculés et cliquables), plusieurs couleurs de cap par passe stencil.
- Animations, modèle féminin, imagerie.
- Édition des données depuis le viewer.
- Interface traduite (seuls les noms anatomiques changent de langue).
- BVH précalculé ou construit dans un worker, LOD, textures KTX2 (seulement si le budget l'exige, dans une spec ultérieure).

## Further notes

- Les spikes ont mesuré 3,8 ms par frame en WebGPU pour 2 234 meshes et 6,68 M triangles, avec un chargement de 2,7 s, dominé par la construction du BVH. Le budget de 3 s est donc tenable, mais juste. Avec une instance par structure-côté, le pipeline produit 1 657 instances à partir des 2 233 meshes (mesuré sur le jeu actuel).
- three r187 ne fait pas de multi-draw en WebGPU : il émet un draw call par instance visible. Masquer des kinds ou des couches réduit donc vraiment le coût.
- La couche maximale du jeu actuel est 5 (os, cartilage, articulation). Le curseur prend ses bornes dans `atlas.json`, et non dans une constante.
- La licence BodyParts3D reste à confirmer auprès du DBCLS avant toute publication. La note figure dans `data/sources/bodyparts3d.yaml`.
