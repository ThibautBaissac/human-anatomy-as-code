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
