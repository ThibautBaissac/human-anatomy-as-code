# Animations articulaires v1 : coude, avant-bras, genou

## Problem statement

L'atlas montre un corps figé, dans la pose de BodyParts3D. Pour comprendre une articulation, l'étudiant doit voir quels os bougent, autour de quel axe, jusqu'où, et quels muscles produisent ce mouvement. Aujourd'hui, rien de tout cela n'est visible ni décrit dans les données. Les axes articulaires sont absents du modèle de données, et le rôle des muscles n'y figure pas non plus.

## Solution

Quand la structure sélectionnée participe à une articulation animable (humérus, ulna, radius, muscle biceps brachial, fémur, tibia, quadriceps…), le panneau Info propose cette articulation. L'étudiant peut alors :

- régler un curseur d'angle, borné aux amplitudes normales ;
- lancer la lecture du mouvement en boucle, puis la mettre en pause.

Pendant le mouvement :

- les os mobiles et tous les tissus situés au-delà de l'articulation tournent en bloc autour de l'axe mesuré sur nos os ;
- les tissus mous qui franchissent l'articulation passent en transparence (mode fantôme), pour que le mouvement des os reste exact sans déformation fausse ;
- pour chaque muscle qui agit sur l'articulation, le panneau affiche son rôle (fléchisseur, extenseur, pronateur, supinateur) et indique s'il se raccourcit ou s'allonge, d'après sa longueur entre ses deux insertions.

La v1 couvre trois mouvements, d'un côté ou des deux :

- **coude** : flexion-extension ;
- **avant-bras** : pronation-supination ;
- **genou** : flexion-extension, la patella suivant le tibia selon un couplage simple.

Les données de chaque articulation sont versionnées : un fichier par articulation, validé par schéma et compilé dans l'atlas, comme les structures.

## User stories

1. As an étudiant, I want the Info panel to offer the elbow when I select the humerus, the ulna, the radius or a muscle acting on the elbow, so that I find the animation from the structure I am studying.
2. As an étudiant, I want the forearm rotation offered when I select the radius, the ulna or a muscle with a pronation or supination role, so that I can study pronation and supination apart from elbow flexion.
3. As an étudiant, I want the knee offered when I select the femur, the tibia, the fibula, the patella or a muscle acting on the knee, so that I can study the knee the same way.
4. As an étudiant, I want a choice between the offered joints when my selection has several (the radius proposes the elbow and the forearm rotation), so that I pick the one I want.
5. As an étudiant, I want a slider that sets the joint angle in degrees, within the normal range of motion, so that I can hold any position and look at it from every side.
6. As an étudiant, I want the slider to start at the angle of the rest pose (elbow about 13°, knee about 2°, forearm in full supination), so that touching the panel never makes the model jump.
7. As an étudiant, I want the angle stated in words and degrees ("90° de flexion", "40° de pronation"), so that I know which way and how far the joint is moved.
8. As an étudiant, I want a mark on the elbow slider for the functional arc (30–130°), so that I see the range used in daily life.
9. As an étudiant, I want a play button that sweeps the joint from one end of its range to the other and back in a loop, and the same button to pause it, so that I see the movement without dragging the slider.
10. As an étudiant who has asked for reduced motion in my system settings, I want the play button to sweep once and stop, and nothing ever to start on its own, so that the animation never runs without my control.
11. As an étudiant, I want a reset button that puts the joint back at rest, so that I find the original pose again.
12. As an étudiant, I want the ulna, the radius and the whole hand to turn together around the elbow axis, so that the bones keep their real relations.
13. As an étudiant, I want the radius and the hand to turn around the forearm axis while the ulna stays still, so that I see that pronation is a movement of the radius around the ulna.
14. As an étudiant, I want forearm rotation to compose with elbow flexion (a flexed elbow can still pronate), so that the two movements behave like the real joint.
15. As an étudiant, I want the tibia, the fibula and the whole foot to turn around the knee axis, and the patella to slide along the femur, so that the knee does not look broken in flexion.
16. As an étudiant, I want the soft tissues that cross the moving joint (muscles, vessels, nerves, skin) to turn transparent while the joint is away from rest, so that I am not shown a wrong deformation.
17. As an étudiant, I want the muscles whose `actions` name the joint to be treated as crossing even when the geometric test misses them (muscles of the epicondyles), so that no muscle stays rigid and solid across a moving joint.
18. As an étudiant, I want the transparent tissues back to normal when the joint returns to rest, so that the default view is unchanged.
19. As an étudiant, I want the list of muscles acting on the joint, each with its role and an arrow that says whether it is shortening or lengthening at the current angle, so that I link muscles to movements.
20. As an étudiant, I want to click a muscle in that list to select it, so that I can read its card without searching for it.
21. As an étudiant, I want to animate the left side, the right side or both: the side of my selection, or both when my selection has no side, so that I can compare or look at one limb.
22. As an étudiant, I want picking to keep working on a moved forearm or leg, so that I can click a bone in its new position.
23. As an étudiant, I want sections, layers, kind visibility and ghost mode to keep working while a joint is moved, so that animation combines with the other tools.
24. As an étudiant, I want the joint angles to be part of the shared view URL, so that a link shows the same pose.
25. As an étudiant using a keyboard or a screen reader, I want to reach and drive every control with the keyboard (arrows ±1°, Page Up/Page Down ±10°, Home/End to the limits), with the value announced, so that the feature is usable without a mouse.
26. As an étudiant on a phone, I want the joint controls in the Info tab, usable by touch, so that the feature works on mobile.
27. As an étudiant on the female model, I want the same joints, so that the animations do not depend on the model.
28. As a curator, I want each joint described in `data/joints/<slug>.yaml` with its labels, bones, range, rest angle, source and review status, so that joint knowledge is versioned like structures.
29. As a curator, I want the centre and axis of each side computed from our meshes by a command, with its parameters kept in the file, so that the values can be reproduced and reviewed.
30. As a curator, I want the build to reject a joint file with an unknown bone, a non-unit axis, a range that does not contain the rest angle, an unknown parent joint or a cycle, so that broken joint data never reaches the viewer.
31. As a curator, I want each muscle action stored on the muscle (`actions`), with its joint, role, source and status, so that roles are curated with the rest of the structure.
32. As a curator, I want the asset build to warn when a muscle's computed length change contradicts its declared role, so that I find suspect data.
33. As a reader of the credits, I want the sources of the ranges and of the couplings credited, with their licence notices, so that the reuse terms are honoured.

## Implementation decisions

### Data: joint files

- Un fichier par articulation dans `data/joints/<slug>.yaml`, validé par un nouveau schéma JSON (`joint.schema.json`, 2020-12, ajv) et par des règles inter-fichiers dans `compileAtlas`. Les articulations ne sont pas des structures : elles n'ont pas de mesh et ne figurent pas dans l'arbre.
- Trois fichiers en v1 :
  - `elbow-joint` : flexion-extension ;
  - `radio-ulnar-joints` : pronation-supination, avec `parent: elbow-joint` ;
  - `knee-joint` : flexion-extension.
- Champs :
  - `slug` ;
  - `labels` fr / en / la, au format des labels de structure ;
  - `motion` : `flexion-extension` | `pronation-supination` ;
  - `proximal` : slug de l'os fixe (`humerus`, `ulna`, `femur`) ;
  - `moving` : slugs des os qui tournent (`[ulna, radius]`, `[radius]`, `[tibia, fibula]`) ;
  - `coupled` : os qui suivent une fraction de l'angle autour du même axe (genou : `{ bone: patella, ratio: 0.85 }`, d'après la trajectoire patellaire de Rajagopal : −102° à 120°) ;
  - `parent` (optionnel) : articulation dont la transformation s'applique avant ;
  - `rangeDeg` : `[min, max]` ;
  - `restDeg` : angle de la pose BodyParts3D ;
  - `functionalArcDeg` (optionnel) ;
  - `sources` : slugs de `data/sources`, un par fait cité ;
  - `status` : `draft` | `reviewed` ;
  - `fit` : paramètres de mesure ;
  - `sides.left` / `sides.right` : `centre` (mm), `axis` (vecteur unitaire), `rmsMm`. Ces valeurs sont écrites par la commande de mesure, jamais à la main.
- Convention d'angle : 0 = position neutre clinique (coude et genou en extension, avant-bras pouce en haut). Positif = flexion ou pronation, négatif = supination. L'axe d'un côté est orienté pour qu'une rotation positive (règle de la main droite) produise le mouvement positif. La commande de mesure le vérifie : en flexion, l'extrémité distale de l'avant-bras va vers l'avant (−Y) ; au genou, l'extrémité distale de la jambe va vers l'arrière (+Y) ; en pronation, la styloïde radiale va vers l'avant.
- Amplitudes (CDC / Soucie 2011, hommes de 20 à 44 ans, arrondies) :
  - coude 0 → 145°, arc fonctionnel 30–130° (Morrey 1981) ;
  - avant-bras −85° (supination) → +77° (pronation) ;
  - genou 0 → 138°.
- Angles de repos :
  - coude et genou : mesurés par la commande, comme l'angle entre l'axe long du segment proximal et celui du segment distal, projeté dans le plan perpendiculaire à l'axe de flexion. La recherche donne environ 13,5° au coude et 1,5° au genou.
  - avant-bras : −85°, car la pose anatomique est en supination complète. C'est une hypothèse, à contrôler visuellement à l'implémentation et à consigner dans les décisions.
- Le compilateur produit `atlas.joints` dans `atlas-male.json` et `atlas-female.json`. Les os du modèle féminin v1 sont ceux de BodyParts3D, donc les mêmes articulations. Une articulation dont un os n'est pas dans le modèle (`inModel`) est une erreur.
- Règles de validation :
  - `proximal`, `moving` et `coupled` désignent des structures de kind `bone` ;
  - les côtés présents correspondent à des os bilatéraux ;
  - la norme de `axis` vaut 1 ± 1e-3 ;
  - `rangeDeg[0] < rangeDeg[1]` et `restDeg` est dans l'amplitude ;
  - `parent` existe, sans cycle ;
  - `sources` existent ;
  - un fichier sans `sides` (jamais mesuré) est une erreur de build.

### Data: muscle actions

- Nouveau champ optionnel de structure : `actions: [{ joint, role, source, status }]`. `role` vaut `flexion` | `extension` | `pronation` | `supination` et doit appartenir au `motion` de l'articulation (flexion-extension → flexion | extension).
- Règles :
  - `joint` existe ;
  - la structure est de kind `muscle` ;
  - `source` existe dans `data/sources`.
- `actions` est compilé dans l'atlas comme les autres champs. L'import BodyParts3D ne le touche pas, puisqu'il n'est pas importé.
- Contenu initial, en `draft` :
  - **Coude, d'après la liste des 22 muscles qui croisent le coude dans Holzbaur 2005 (BSD-3) :**
    - flexion : chefs du biceps brachial, brachial, brachioradial, chef huméral du rond pronateur ;
    - extension : chefs du triceps brachial, anconé ;
    - les autres muscles épicondyliens de la liste avec le rôle accessoire reconnu (fléchisseurs du carpe : flexion, extenseurs radiaux : flexion).
  - **Avant-bras :**
    - pronation : rond pronateur, carré pronateur ;
    - supination : supinateur, chefs du biceps brachial.
  - **Genou, d'après les 13 muscles de Rajagopal 2016 (MIT) + poplité :**
    - extension : quadriceps ;
    - flexion : ischio-jambiers, gastrocnémien, sartorius, gracile, poplité, plantaire.
  - Seuls les muscles qui existent dans les données sont annotés. Un manque est noté dans les décisions.

### Data: sources

- Nouvelles fiches dans `data/sources` :
  - `cdc-joint-rom` : domaine public, US government ;
  - `rajagopal-2016` : MIT, avec la notice de copyright et de permission ;
  - `holzbaur-2005` : BSD-3-Clause, avec la notice et la citation demandée.
- Elles entrent dans `atlas.attributions` et donc dans les crédits de l'app. MoBL-ARMS (non commercial) et Gait2392 (licence ambiguë) ne sont pas utilisés.

### Measurement command (tools/assets)

- Nouvelle commande `fit-joints` dans `tools/assets`, sur le modèle de `register` dans `tools/hra`. Elle lit les GLB construits, ou les OBJ, et l'atlas masculin. Elle mesure chaque côté de chaque articulation et réécrit `sides` et `restDeg` dans le YAML, avec le Document API de `yaml` pour garder les commentaires. Elle refuse d'écrire si le `rmsMm` d'un ajustement dépasse `fit.maxRmsMm`.
- Méthodes, reprises de la note de recherche :
  - **coude** (`cylinder-contact`) : cylindre itératif sur les sommets de l'humérus situés à moins de `fit.contactMm` de l'ulna et du radius. Le centre est la projection sur l'axe du milieu capitulum / trochlée.
  - **avant-bras** (`head-to-head`) : axe de la tête ulnaire (cercle sur une bande distale de l'ulna) à la tête radiale (cercle sur une bande proximale du radius).
  - **genou** (`condyle-spheres`) : deux sphères sur les condyles fémoraux postérieurs, sélectionnés par les seuils stockés dans `fit`. L'axe passe par les deux centres, et le centre est leur milieu.
- Les fonctions d'ajustement (sphère de Kåsa, cercle 2D, cylindre itératif, plan d'articulation) forment un module pur, sans E/S.

### Rig: what moves and what crosses (tools/assets)

- `buildAssets` calcule, par modèle et pour chaque côté de chaque articulation, un rig écrit dans le manifest : `models.<model>.joints[<slug>@<side>] = { moving, coupled, crossing, muscles }`. Les instances sont désignées par leur nom de nœud `slug@side` (ou `slug` pour une instance midline).
- Le plan de l'articulation passe par le centre. Sa normale est l'axe long du segment proximal (du centre de l'articulation vers le centre proximal), et la marge `M` vaut 3 mm.
  - Pour l'avant-bras, le plan passe par la tête ulnaire, de normale l'axe de prono-supination. Le segment distal est donc la main.
  - Les candidats sont les instances du même côté (côté de `meshIndex`) dont la structure ou un ancêtre appartient à la région du membre (`upper-limb` ou `lower-limb`).
  - S'y ajoute la peau, qui est une instance midline.
- **moving** : les os de `moving`, plus toute instance candidate dont tous les sommets sont du côté distal, au-delà de `M`. Exception pour l'avant-bras : seul le radius et ce qui est distal à la tête ulnaire tournent ; l'ulna et les tissus de l'avant-bras restent fixes.
- **coupled** : les os de `coupled`, avec leur ratio.
- **crossing** : les instances candidates qui ont au moins 3 sommets à plus de `M` de chaque côté du plan, la peau, et toute instance dont la structure a une `action` sur cette articulation. C'est la liste fonctionnelle, qui rattrape les muscles des épicondyles. Une instance ne peut pas être à la fois `moving` et `crossing` : `crossing` l'emporte, puisqu'une instance qui franchit n'est pas rigide.
- **muscles** : pour chaque instance `crossing` dont la structure a une `action` sur l'articulation, deux points d'insertion en mm. `origin` est le centroïde des sommets situés à 10 mm ou moins du sommet le plus éloigné du plan côté proximal. `insertion` est le même calcul côté distal.
- Avertissement de build (pas d'erreur) quand le signe de la variation de longueur sur toute l'amplitude contredit le rôle déclaré, alors que la variation dépasse 3 % de la longueur au repos. Exemple : un fléchisseur dont la corde s'allonge en flexion.
- Le rig est calculé en coordonnées monde de la pose de repos. Les tests utilisent le même module pur que la mesure.

### Viewer

- Nouveau module pur `pose` (sans DOM ni React, avec seulement l'algèbre 4×4) :
  - `jointMatrix(joint, side, angleDeg)` : rotation de `angleDeg − restDeg` autour de l'axe du côté, passant par le centre. Une articulation enfant compose avec la matrice de son parent : T_parent · T_enfant, où T_enfant est exprimée dans la pose de repos.
  - `poseMatrices(atlasJoints, rigs, angles)` : instance → matrice monde, pour toutes les instances déplacées. Pour un os couplé, c'est la rotation de `ratio × (angle − rest)` autour du même axe, composée avec le parent.
  - `crossingInstances(rigs, angles)` : les instances `crossing` de chaque articulation qui n'est pas au repos.
  - `muscleLength(muscle, matrices)` : distance entre `origin` et `insertion` transformée. L'indicateur compare la longueur à l'angle courant avec la longueur à l'angle courant − 1° dans le sens du mouvement : il affiche raccourcissement, allongement, ou « stable » sous 0,5 mm.
- `Viewer` :
  - `setPose(angles)` applique les matrices par `BatchedMesh.setMatrixAt`. Une instance non déplacée garde la matrice identité de sa pose de repos.
  - Les instances `crossing` passent en apparence fantôme et ne sont plus pickables. C'est le même mécanisme que le ghost existant, avec une nouvelle source d'appartenance dans `appearance`.
  - Le BVH reste valide : three-mesh-bvh lance ses rayons dans le repère local de chaque instance. Il n'y a ni refit, ni `setGeometryAt`.
  - `focus`, `orbitFor` et les sections utilisent les boîtes englobantes transformées.
- `ViewState.pose: Record<string, number>`, avec des clés `<joint>@<side>` et des angles en degrés entiers. Un angle égal à `restDeg` n'est pas stocké.
- `view-hash` encode la pose sous la forme `p=elbow-joint@left:90,knee-joint@right:45`. Une articulation ou un côté inconnu est ignoré, et un angle hors amplitude est ramené dans l'amplitude. La valeur par défaut est la pose vide, ce qui garde les URL existantes valides.
- Un changement de modèle conserve la pose, puisque les articulations et les rigs existent pour les deux modèles.
- Lecture :
  - balayage `rangeDeg[0] → rangeDeg[1] → rangeDeg[0]` en 4 s, rendu continu pendant la lecture, rendu à la demande sinon ;
  - le ghosting reste stable pendant la lecture : les tissus restent fantômes tant que la lecture dure, même au passage par le repos ;
  - avec `prefers-reduced-motion: reduce`, un seul balayage aller-retour, puis arrêt ;
  - la pause garde l'angle courant ;
  - la lecture s'arrête quand la sélection change d'articulation ou quand le modèle change.

### UI

- Panneau Info : une section « Mouvement » apparaît quand la sélection propose au moins une articulation. La sélection propose une articulation dans trois cas : son slug est `proximal`, `moving` ou `coupled`, ou bien elle a une `action` sur cette articulation. La section contient :
  - un groupe de boutons radio si plusieurs articulations sont proposées ;
  - le côté animé : celui de la sélection, ou les deux pour une sélection sans côté, et dans ce cas le même angle des deux côtés ;
  - un `<input type="range">` natif avec label visible, pas de 1°, `aria-valuetext` (« 90° de flexion », « 40° de supination ») et un repère d'arc fonctionnel quand il existe ;
  - un bouton lecture / pause, avec `aria-pressed` ;
  - un bouton « Repos » ;
  - la liste des muscles de l'articulation (ceux qui ont une `action`), chacun avec son rôle et une flèche de raccourcissement ou d'allongement. Chaque nom est un bouton qui sélectionne le muscle.
- Les libellés d'interface sont en français dans `strings.ts`, comme le reste de l'interface du MVP : rôles, mouvements, « se raccourcit », « s'allonge », « stable ». Les noms des articulations viennent des labels de l'atlas, dans la langue des noms choisie.
- Sur téléphone, la section est dans l'onglet Info, avec des cibles tactiles d'au moins 44 px.

## Testing decisions

- **Seam 1, `compileAtlas(dataDir)`**, sur les jeux de données de test existants (`helpers.ts`) :
  - `atlas.joints` compilé pour chaque modèle ;
  - `actions` compilé ;
  - chaque règle de validation produit son erreur `fichier:pointeur règle` (os inconnu, os non `bone`, axe non unitaire, repos hors amplitude, parent inconnu, cycle, rôle incompatible, `actions` sur un non-muscle, `sides` absent).
  - Antériorité : `compile-models.test.ts`, `cli.test.ts`.
- **Seam 2, module pur de mesure et de rig (`tools/assets`)**, sur des géométries synthétiques construites dans le test :
  - un cylindre connu et des sphères connues retrouvent leur axe et leur centre ;
  - un « bras » fait de boîtes (os proximal, os distal, un muscle qui franchit, une main distale, une instance de l'autre côté) donne les bons `moving`, `crossing` et `muscles` ;
  - un muscle listé dans `actions` mais hors du critère géométrique est `crossing` ;
  - un fléchisseur déclaré dont la corde s'allonge produit l'avertissement ;
  - `buildAssets` écrit les rigs dans le manifest. Antériorité : `build-assets.test.ts`.
- **Seam 3, module pur `pose` (`app`)** :
  - une rotation de 90° autour d'un axe connu déplace un point connu là où on l'attend ;
  - l'angle de repos donne l'identité ;
  - la composition parent-enfant (pronation sur un coude fléchi) donne le bon résultat ;
  - le ratio d'un os couplé est appliqué ;
  - le signe et le seuil « stable » de l'indicateur de longueur sont respectés ;
  - `view-hash` fait l'aller-retour de la pose, ramène dans l'amplitude et ignore l'inconnu.
  - Antériorité : tests de `view-hash`, `appearance` et `catalog`.
- **Seam 4, e2e Playwright** (WebGPU, `?backend=webgl`, mobile Pixel 7) :
  - sélectionner l'humérus gauche affiche la section Mouvement ;
  - régler 90° au clavier change la matrice de `ulna@left` (exposée par le snapshot de test existant) et rend fantômes `brachialis@left` et la peau ;
  - un clic sur l'ulna déplacée la sélectionne ;
  - « Repos » rétablit l'apparence ;
  - l'URL partagée restaure la pose ;
  - avec `reducedMotion: 'reduce'`, la lecture s'arrête seule ;
  - le budget de performance existant tient pendant la lecture (frame moyenne < 16,7 ms en WebGPU) ;
  - sur mobile, le curseur est utilisable dans l'onglet Info.
  - Antériorité : `smoke.spec.ts`, `mobile.spec.ts`.
- Ce qui vaut d'être vérifié : les positions des instances, l'appartenance aux ensembles `moving` et `crossing`, les erreurs de validation, l'URL. Ce qui ne vaut pas d'être vérifié : des pixels.

## Global constraints

- three.js r187 et three-mesh-bvh, les versions actuelles. Aucune nouvelle dépendance d'exécution dans `app`.
- Animation par `BatchedMesh.setMatrixAt` uniquement : ni `setGeometryAt`, ni `SkinnedMesh`, ni morph target en v1.
- Repère : mm, Z vers le haut, +Y postérieur, +X à gauche du sujet. Le côté est toujours celui du sujet.
- Angles en degrés dans les données, l'URL et l'UI ; radians seulement dans le calcul interne.
- Performance : frame moyenne < 16,7 ms pendant la lecture en WebGPU, sur le banc e2e existant. Chargement initial inchangé (< 3 s), et aucun calcul de rig dans l'app.
- Accessibilité RGAA 4.1.2 : commandes natives ou ARIA équivalentes, valeur annoncée, focus visible, aucun mouvement automatique, `prefers-reduced-motion` respecté.
- Noms d'articulations trilingues fr / en / la ; interface en français seulement, comme les chaînes existantes.
- Données : YAML déterministe (clés triées comme les structures), statut `draft` pour toute donnée produite par un outil.
- Licences : MoBL-ARMS et Gait2392 exclus. Notices MIT et BSD-3 conservées dans les fiches sources.

## Out of scope

- Épaule (gléno-humérale et rythme scapulo-huméral), poignet, doigts, hanche, cheville, colonne : v2 et au-delà.
- Déformation des tissus mous (skinning GPU, poids par diffusion, morph targets correctifs, gonflement à la contraction) : v2.
- Rotation tibiale automatique (*screw-home*) et translations du genou : le genou v1 est une charnière, avec la patella couplée.
- Lignes d'action musculaires OpenSim.
- Collisions et butées osseuses calculées : les amplitudes cliniques suffisent.
- Découpe de la peau par membre.
- Édition des axes dans l'interface.
- Animation pilotée par un fichier de mouvement (marche, squat).

## Further notes

- La note de recherche `research_notes/Animations articulaires/animations.md` contient les mesures de départ du côté gauche, les comparaisons OpenSim et les coûts des quatre approches de déformation. Les valeurs écrites par `fit-joints` doivent être proches de celles de la note : à quelques mm et quelques degrés près pour le côté gauche.
- Les 12 kinds erronés, qui auraient fait pivoter des muscles comme des os, ont été corrigés avant cette spec (commit « Reclassify muscles named after bones »).
- Il n'y a dans les données ni ligament, ni cartilage articulaire, ni nerf de membre. Le rig n'en dépend pas.
- Le signe de la pronation et la pose de repos de l'avant-bras sont les hypothèses les plus fragiles : il faut les vérifier en premier, par une capture à −85°, 0° et +77°.
