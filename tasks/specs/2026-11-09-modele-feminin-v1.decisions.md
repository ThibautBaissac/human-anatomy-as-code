# Décisions d'implémentation : modèle féminin v1

Décisions prises là où la spec `2026-11-09-modele-feminin-v1.md` est muette, ou que les fichiers HRA ont imposées.

## Écarts par rapport à la spec

1. **Corps complet lu par requêtes HTTP Range, pas téléchargé.** `united-female` n'est pas compressé et tient dans un seul buffer. `hra fetch` lit son en-tête JSON, puis les seuls octets des 14 nœuds voulus (vagin et ligaments) : environ 1 MB au lieu de 357 MB. Les transformations des nœuds sont appliquées à l'extraction. Le fichier extrait est épinglé par son sha256.
2. **Région thoracique : translation après la région pelvienne, pas une similitude.** On ne dispose que de deux repères fiables, le haut et le bas du sternum (manubrium et corps). La région applique la transformation pelvienne, puis la translation moyenne qui recale le sternum (`fit: translation`, `from: pelvic`). Écart résiduel : 14,1 mm.
3. **Repères pelviens.** Ce sont les 8 points relevés par la recherche, calculés comme points extrêmes des os coxaux et du sacrum des deux modèles, puis inscrits dans `data/import/hra-registration.yaml`. Résultat : échelle 0,932, rotation de 0,95°, écart RMS de 14,9 mm (maximum 28,7 mm au promontoire).
4. **Simplification.** La cible de 50 000 triangles passe avant l'erreur de 1 %. Le simplificateur essaie d'abord une erreur relative de 1 %, puis relâche ce seuil (2 %, 5 %…) seulement si la cible n'est pas atteinte. La spec impose les deux, ce qui peut être incompatible ; la limite de triangles est une contrainte globale, elle l'emporte.

## Points où la spec était muette

5. **Structures à partir d'un fichier d'organe.**
   - Le nœud racine est le plus profond ancêtre sans mesh commun à tous les meshes ; il devient la structure de niveau organe (utérus, trompe, glande mammaire). Les nœuds intermédiaires sans mesh (« VH_F », « VH_F_integumentary_system ») sont ignorés.
   - Le slug vient du label anglais sans le mot de côté.
   - Le côté est lu dans le nom du nœud (`_L`, `_R`, `left`, `right`), puis dans le label.
   - Une paire gauche/droite de même nom canonique devient une structure bilatérale. Un côté seul garde son nom complet.
6. **Identifiant partagé par les deux côtés** (ligament cardinal, FMA 77064 des deux côtés dans le HRA) : il est placé à la racine de la structure, pour respecter `fma-unique`. Un FMA déjà porté par une structure masculine ou partagée est retiré et signalé (`fmaConflicts`).
7. **Noms français et latins.** Ils viennent d'abord d'un item Wikidata qui désigne la structure entière (identifiants racine, puis terme générique anglais : « ovary »), sinon de l'item du côté gauche, dont les mots de côté sont retirés (« ovaire gauche » devient « ovaire »).
8. **Couche des glandes mammaires** : 1, celle des fascias. Elles sont sous la peau et au-dessus du grand pectoral, et doivent disparaître tôt au curseur de dissection.
9. **Arbitrages ajoutés** (`hra-overrides.yaml`) :
   - `kinds` : « lactiferous sinus » n'est pas une veine ;
   - `labels` : nom du nœud `VH_F_cornua`, devenu « horn of uterus ».
10. **Une instance appartient au modèle affiché si ses meshes sont dans le `meshIndex` de l'atlas de ce modèle.** Les fichiers par kind restent partagés par les deux modèles. Dans le modèle féminin, la vessie masculine (fichier `organ`) est donc masquée, et la vessie féminine (fichier `female-organ`) affichée.
11. **Changement de modèle.**
    - Le viewer garde les batches des fichiers communs, charge les fichiers manquants et retire ceux qui ne servent plus.
    - Caméra, langue, couches et coupes sont conservées.
    - Une sélection absente du nouveau modèle est effacée et annoncée (« … : absent du modèle masculin, sélection effacée. »).
12. **Masquage de l'encart du modèle féminin** : il est mémorisé dans `localStorage`. La boîte de dialogue « En savoir plus » liste les DOI des organes HRA affichés.
13. **Offline.** L'état et le téléchargement portent sur les fichiers et l'atlas d'un modèle, ou des deux. `atlas-male.json` et `atlas-female.json` passent par la même route *NetworkFirst* que `atlas.json`.
14. **Requête Wikidata.** Elle est séparée en deux (FMA avec UBERON optionnel, puis UBERON sans FMA) : la requête unique, avec `UNION`, était tronquée par le délai du serveur. La recherche par label anglais ne porte que sur les items FMA, pour ne rien changer à l'import BodyParts3D (vérifié : 0 changement sur les données réelles).
15. **Écriture partagée.** `applyPlan` est extrait de `importBp3d` et utilisé par les deux imports. Chaque import ne signale comme orphelins que les fichiers qu'il possède : `sex: female` pour l'import HRA, et tout le reste pour l'import BodyParts3D.

## Résultats

- **Structures** : 35 structures féminines (utérus et 9 parties, ovaires, trompe et 4 parties, vagin, 7 ligaments, glande mammaire et 7 parties), plus le groupe « female genital system ».
  - Variantes : vessie et rectum.
  - Peau masquée, 14 structures marquées `sex: male`.
- **Atlas** : 1 438 structures pour le modèle masculin, 1 458 pour le modèle féminin. 0 erreur de compilation.
- **Assets** : fichiers propres au modèle féminin, 6,3 MB (`female-organ` 5,0 MB, `female-ligament` 1,3 MB). Le modèle féminin charge 13 fichiers (42,0 MB) ; le fichier de la peau n'en fait pas partie.
- **Recalage contrôlé visuellement et numériquement** (`spikes/05-female/*.png`).
  - Utérus, col, vagin et ovaires sont dans le petit bassin, et les ligaments ronds partent vers les régions inguinales. Les glandes mammaires sont posées sur le gril costal.
  - **Écart connu** : la vessie féminine dépasse d'environ 6 mm en avant de la symphyse pubienne (Y minimal −145 mm, contre −139 mm pour l'os coxal). C'est cohérent avec l'écart résiduel du bassin. On peut le corriger par `adjust` dans la région pelvienne, au prix d'un déplacement de tous les organes pelviens.

## Corrections issues de la revue de code (2026-11-09)

- **Simplification réellement appliquée.** Les meshes HRA ne sont pas soudés : chaque arête y est une bordure, et `LockBorder` bloquait toute réduction (les lobes mammaires restaient à 75 778 triangles).
  - Les sommets sont maintenant soudés par position (`generatePositionRemap`) avant la simplification.
  - Un mesh qui reste au-dessus de la cible fait échouer le build.
  - Le test utilise une grille non soudée.
  - Effet : `female-organ` passe de 5,0 à 3,5 MB, et le modèle féminin de 42,0 à 40,5 MB.
- **Test de fumée « les deux modèles ».** Le cache des modèles est vidé, puis les deux modèles sont téléchargés. Hors ligne, le modèle féminin se recharge, la recherche fonctionne et aucune alerte n'apparaît.
- **Test de fumée du modèle féminin, renforcé.** Il vérifie la géométrie réellement affichée : instances de l'utérus présentes, vessie issue du fichier `female-organ`, aucune instance de prostate, de testicule, d'urètre ou de peau dans le modèle. La recherche se fait sur « utérus ». Le test passe au rouge si la règle `inModel` est cassée.
- **Panneau hors ligne.** Il liste les DOI des organes HRA du modèle féminin : le crédit CC BY reste accessible même quand l'encart est masqué.
- **Arbitrage des identifiants.**
  - Une divergence entre le GLB et sa table de correspondance, **dans un même vocabulaire**, est rapportée (`idDivergences`). Le GLB l'emporte, sauf arbitrage `ids`.
  - Deux vocabulaires différents, comme pour les ovaires (FMA dans le GLB, UBERON dans la table), ne constituent pas une divergence : les deux identifiants sont gardés.
  - Il n'y a aucune divergence sur les données réelles.
- **Item Wikidata imposé** (`wikidata` : slug → QID), par exemple pour `uterine-tube` : « uterine tube » ne correspond pas au libellé Wikidata « fallopian tube ». Le groupe `female-genital-system` reçoit un nom français, « appareil génital féminin ».
- **Slugs uniques.** Un slug pris par l'autre modèle reçoit le suffixe `-female`. Un conflit à l'intérieur de l'import reçoit `-2`, `-3`…
- **Fichiers relus non modifiés.** Une variante ou un `sex` qui ne peut pas être posé sur une structure `reviewed` est désormais rapporté (`skippedReviewedPatches`), au lieu d'être ignoré en silence.
- **Changements de modèle sérialisés.** Une seconde demande attend la fin de la première : plus de batches en double. Le sélecteur est désactivé pendant le changement.
- **Couleur des fichiers `female-<kind>`.** Celle du kind (les ligaments HRA ont la couleur des ligaments). L'annonce « absent du modèle » s'efface à la sélection suivante.
- **Paquet `@haac/hra`.** Il expose `./register`, dont `tools/assets` dépend par le workspace, au lieu d'un import relatif entre paquets.
- **Glossaire (`CONTEXT.md`).** Ajout de Modèle, Sexe, Variante et Recalage. « Modèle » n'est plus dans les termes à éviter de Mesh, remplacé par « modèle 3D ».

## Écarts déclarés après la revue

- **Méthode de recalage.** C'est la méthode de Horn (quaternion), pas celle d'Umeyama : elle donne la même similitude au sens des moindres carrés, sans décomposition SVD à coder.
- **`mesovarium`.** Il est extrait du corps complet et importé, bien qu'absent de la liste de nœuds de la spec : c'est un repli du ligament large qui attache l'ovaire, utile pour comprendre les rapports de l'ovaire.
- **Chemins et commandes.**
  - L'extrait du corps complet est dans `data/raw/hra/united-female/extracted-united.glb` : un dossier par organe, comme les autres fichiers HRA.
  - Les commandes sont `npm run -w tools/hra fetch|register`, plutôt que `hra-fetch` / `hra-register`.
- **Règles `sex` + `variants`.** Elles sont vérifiées par la règle de compilation `variant-shape` seulement, pas par le schéma : une seule erreur, lisible, au lieu d'une erreur de schéma en plus.
- **Budget de chargement du modèle féminin.** Il n'a pas de test dédié. Le modèle féminin charge 13 fichiers au lieu de 12, pour 4 MB de plus.

## Points mineurs laissés pour plus tard

- Fichier `atlas.json` encore produit, mais plus lu par l'application.
- Champ `source: 'bodyparts3d'` du manifeste.
- DOI en double entre `hra-files.yaml` et `sources/hra.yaml`.
- Empreinte de l'extrait dépendante de la version de glTF-Transform.
- `rotationDeg: 0` pour une région `fit: translation`.
- Découpage de `buildAssets` et d'`importHra` en fonctions plus petites.

## Recalage de la vessie (2026-11-09)

- **Le défaut était plus important que l'écart de 6 mm mesuré sur les boîtes englobantes.** Après le recalage pelvien, la vessie HRA traversait la symphyse pubienne : 550 sommets devant le pubis ou dedans, contact avec l'os.
- **On ne peut pas la reculer.** L'utérus n'est qu'à 4,5 mm en arrière ; un recul de 4 mm le fait entrer dans la vessie.
- **Nouvelle région `bladder` (`fit: offset`).** C'est la région pelvienne suivie d'un décalage fixe de 8 mm vers le haut, sans repères propres. Ce décalage a été choisi par une recherche sur grille (décalages de −2 à +12 mm en Y et en Z), en comptant les sommets devant ou dans le pubis et les contacts à moins de 2 mm avec l'os et l'utérus.
- **Résultat :**
  - plus aucun contact avec l'os ;
  - 3 sommets devant le pubis, contre 550 ;
  - aucun sommet dans la paroi abdominale (ligne blanche, oblique externe) ;
  - contact avec l'utérus conservé : anatomiquement, l'utérus repose sur la vessie.
- **Le point le plus antérieur de la vessie (y = −145 mm) est au-dessus de la symphyse** (sommet à z = 806 mm), derrière la paroi abdominale : c'est la position du dôme vésical. La vue latérale rapprochée de `spikes/05-female/` le fait paraître devant le pubis, parce que les muscles de la paroi sont masqués dans la capture.
- **Contrat de `register`.** Le mode `offset` est ajouté à `computeRegions` (test : une région décalée égale la région source suivie du décalage). Le résumé de `register` indique le décalage plutôt qu'un écart RMS nul trompeur.
