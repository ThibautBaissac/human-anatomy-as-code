# Décisions d'implémentation : modèle de données

Décisions prises là où la spec `2026-11-08-modele-de-donnees.md` est muette, ambiguë ou contredite par les données réelles.

## Écarts par rapport à la spec

1. **Arbitrage des égalités de propriété : le descendant *part of* d'abord.** Quand un groupe ne contient qu'un seul enfant (« right upper limb » ⊃ « right biceps brachii »), les deux concepts ont exactement les mêmes éléments. La règle de la spec se rabattait alors sur le plus petit numéro FMA, qui donnait le mesh au groupe. Désormais, un concept descendant *part of* d'un autre concept à égalité l'emporte, avant les critères de la spec. Seules les égalités que cette règle ne tranche pas sont rapportées (213 sur les données réelles).
2. **Meshes propres d'un concept canonique bilatéral.** « internal carotid artery » (*is a*, 2 éléments : un tronc par côté) est plus spécifique que « left/right internal carotid artery » (tout l'arbre). Ses meshes vont au côté dont le concept latéral les contient. Un mesh contenu dans aucun des deux côtés, ou dans les deux, reste sans propriétaire et figure dans le rapport (`canonicalMeshConflicts`). Données réelles : 1 cas (FJ3658, « ascending lumbar vein », centré sur la ligne médiane). **2 233 meshes sur 2 234 ont donc un propriétaire, et non 2 234 comme la spec l'attendait.**

3. **Un concept avec un seul côté garde son nom complet.** Exemple : « right lymphatic duct » sans « left lymphatic duct ». Il n'y a pas de regroupement ; slug et label restent `right-lymphatic-duct` / « right lymphatic duct », et seule la latéralité `unpaired-right` est déduite. Retirer le mot de côté ferait perdre une partie du vrai nom. La spec, à l'étape 3, en fait au contraire « un côté de la structure canonique ».
4. **Repli et ordre des parents.** Le parent est pris dans l'ordre : concept canonique, côté gauche, côté droit. La spec ne mentionne que le côté gauche ; le concept canonique, quand il existe, passe donc en premier. Ce point mineur reste ouvert.
5. **Mots-clés `bone` : `\brib\b` au lieu de `rib\b`.** Le motif du spike reconnaissait « cribriform » et d'autres mots qui contiennent « rib ».

## Points où la spec était muette
6. **Ce que l'import ne touche jamais dans un fichier existant :** `slug`, `layer`, `aliases`, et les surcharges `sides.<côté>.labels`. Ces champs ne sont jamais calculés par l'import ; ils appartiennent aux curateurs.
7. **Un parent calculé qui désigne un alias** est réécrit avec le slug canonique du fichier qui porte cet alias. Sinon, un renommage par un curateur casserait la règle `parent-exists`.
8. **Changement de kind sur une structure `draft` :** le fichier est déplacé vers `structures/<nouveau kind>/`. C'est un déplacement, pas une suppression.
9. **Wikidata :**
   - Quand plusieurs items portent le même FMA, l'item préféré est celui qui a un TA2, puis un label français, puis le plus petit QID. La même préférence s'applique à la recherche par label anglais.
   - La recherche par label anglais est ignorée si le FMA trouvé appartient déjà à un concept candidat, pour éviter les doublons FMA.
   - Un TA98 Wikidata qui ne respecte pas le motif du schéma est écarté.
   - La casse des labels est conservée : le latin Wikidata est capitalisé, ce qui donne « Os femoris » puis « Os femoris sinistrum ».
10. **Validation sans cascade d'erreurs :**
   - L'id d'une source invalide au schéma reste connu, pour ne pas déclencher d'erreurs `label-source` sur toutes les structures.
   - Une structure invalide au schéma est écartée des règles inter-fichiers.
   - Le cas de latéralité incohérente produit une seule erreur `laterality-shape` à la place des erreurs `schema` équivalentes.
11. **`importBp3d` reçoit les overrides sous forme d'objet.** La commande `import-bp3d` lit `<dataDir>/import/bp3d-overrides.yaml`.
12. **`human-body` est la racine** : c'est la seule structure sans parent qui n'est pas signalée comme orpheline.
13. **Kind** : `biceps` et `triceps` sont ajoutés aux mots-clés `muscle`, car les têtes musculaires « long head of … biceps brachii » ne contiennent pas « muscle ».
14. **`build/atlas.json` est un artefact** : il n'est pas versionné.

## Résultat sur les données réelles (BodyParts3D 4.0, Wikidata 2026-11-08)

- **Structures :** 1 621 au total.
  - Par latéralité : 564 bilateral, 1 045 midline, 8 unpaired-right, 4 unpaired-left.
  - Concepts sans structure : 1 217, principalement des classes abstraites *is a*.
- **Validation :** 0 erreur, 3 019 avertissements.
  - 848 `missing-fr` et 1 108 `missing-la` ;
  - 491 `label-gender` ;
  - 572 `orphan`.
- **Couverture des labels :** parmi les 1 162 structures qui ont des meshes, 606 ont un label français et 418 un label latin.
- **Rapport d'import à curer :**
  - 75 conflits de parent au repli ;
  - 213 égalités arbitrées ;
  - 1 mesh sans propriétaire.
- **Idempotence :** un second import donne 0 changement.
- **Après la revue de code :** 563 fichiers ont reçu les identifiants Wikidata de leurs côtés.
- **Performance :** validation complète en 0,4 s.

## Corrections issues de la revue de code (2026-11-08)

- **Sûreté de l'import.** Un fichier YAML illisible (sans slug, ou avec des marqueurs de conflit) ou un slug/alias revendiqué par deux fichiers **annule l'import avant toute écriture** (`aborted`, code de sortie 1). Une création ou un déplacement vers un chemin déjà occupé est refusé et rapporté (`writeConflicts`). La correspondance par slug propre passe avant la correspondance par alias. Une deuxième structure qui tomberait sur le même fichier via un alias est rapportée (`aliasCollisions`), pas fusionnée. Un `kind` ou un `slug` invalide ne sert jamais à construire un chemin.
- **Fusion par clé pour les structures `draft`.** Dans un label, l'import ne pose que `text`, `source` et `status` ; `gender` et `number` seulement s'il les connaît. Les `synonyms`, la `description` et un genre ajouté par un curateur sont conservés. Dans `ids`, seuls `fma`, `ta2`, `ta98` et `wikidata` sont recalculés ; `uberon` reste aux curateurs.
- **Une surcharge de label de côté relue bloque un changement de latéralité** : latéralité, côtés et meshes restent tels quels, et le cas est rapporté (`lateralityConflicts`).
- **Identifiants des côtés.** Chaque côté reçoit TA2, TA98 et QID depuis l'item Wikidata de son FMA (US 26). Le repli des labels sur l'item d'un côté n'est pas fait : ses labels sont déjà latéralisés (« fémur gauche »), et la composition donnerait « fémur gauche gauche ».
- **`atlas.json`** : clés triées récursivement. `meshes`, `regions`, `aliases` et `children` sont triés.
- **Composition** : sans genre, la règle est toujours le masculin singulier, même si un nombre est indiqué.
- **CSV Wikidata** : les colonnes manquantes provoquent une erreur explicite. La CLI affiche toute erreur sur une ligne (`erreur : …`), avec le code de sortie 1.
- **Découpage.**
  - `import-bp3d.ts` ne fait plus que l'orchestration et la sûreté disque.
  - `import/plan.ts` contient la planification pure ; `import/yaml-merge.ts`, la fusion YAML.
  - `fs-util.ts` regroupe `listYaml` et `byKey`.

Points mineurs laissés pour plus tard :
- type union pour `kind` ;
- longueur des slugs plafonnée à 120 caractères (aucun nom réel ne dépasse) ;
- parent pris d'abord sur le côté gauche (point 4).

## Repli étendu aux mots de côté internes (2026-11-08, validé par l'utilisateur)

La spec, étape 3, a été révisée. Le repli s'applique désormais à un mot de côté placé n'importe où dans le nom, dès que les deux côtés existent. La liste de non-repli s'applique aussi en fin de nom, après « of ».

Pour le côté :
- Quand le mot de côté est au milieu du nom, le nom FMA du côté (« long head of right biceps brachii ») est écrit comme surcharge anglaise du côté, en `draft`.
- À la fusion, une surcharge de côté absente est ajoutée ; une surcharge existante n'est jamais modifiée.

Effet sur les données réelles :
- **Nouvelles structures repliées :** 183. Les 366 anciennes moitiés gauche et droite, toutes en `draft`, générées le jour même et jamais curées, ont été retirées.
- **Total :** 1 438 structures.
  - Par latéralité : 747 bilateral, 681 midline, 7 unpaired-right, 3 unpaired-left.
  - Meshes : 2 233 référencés.
- **Validation :** 0 erreur, 2 508 avertissements.
- **Couverture des labels :** parmi les 1 035 structures qui ont des meshes, 705 ont un label français (68 %) et 458 un label latin.
- **À curer :** 62 conflits de parent au repli.

Ces chiffres remplacent ceux de la section « Résultat sur les données réelles ».

## Curation : table des genres et rapport de couverture (2026-11-08)

- **Table des genres étendue au-delà de la liste initiale de la spec.** Elle couvre désormais environ 110 noms français et 90 noms latins, choisis parmi les premiers mots les plus fréquents des labels réels qui n'avaient pas de genre (chef, partie, gyrus, *caput*, *systema*, *arcus*…). C'est le code (`import/rules.ts`) qui fait foi pour son contenu.
- **Ordinaux en français.** Les ordinaux en « -ième » sont épicènes : le genre est pris sur le mot suivant (« deuxième côte » → f). « premier », « première », « grand(e) » et « petit(e) » portent eux-mêmes leur genre.
- **Effet sur les données réelles :**
  - labels sans genre : 491 → 192 ;
  - avertissements : 2 508 → 2 155.
- **Commande `coverage`.** Elle produit un tableau Markdown par kind : nombre de structures, structures avec meshes, labels fr et la présents, labels sans genre. Elle sert à prioriser la curation. Ce n'est pas dans la spec : c'est un outil de curation, sans effet sur le modèle.
