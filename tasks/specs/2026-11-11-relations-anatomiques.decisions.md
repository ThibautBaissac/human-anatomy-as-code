# Relations anatomiques — décisions prises hors de la spec

Points où la spec se tait ou admet deux lectures, tranchés en écrivant le plan (2026-11-11).

1. **Réseau et apparence.** Le viewer passe les instances du réseau dans le champ `isolated` de l'état d'apparence : la spec demande « exactly the rules of the isolation », et cela les donne sans dupliquer la logique. `appearance.ts` n'est pas modifié.
2. **Bandeau.** Un réseau actif a son bandeau, comme l'isolement : « Réseau : <nom> » avec un bouton « Quitter le réseau ».
3. **Masquer l'origine du réseau** termine le réseau, comme masquer la structure isolée termine l'isolement.
4. **`iso=` et `net=` dans la même URL** : `iso=` l'emporte, `net=` est ignoré.
5. **Marques de côté** dans la fiche : « Côté gauche » / « Côté droit » (chaînes existantes `sideButton`), ce qui évite l'accord en genre.
6. **Une cible présente** est une structure de l'atlas du modèle affiché, qu'elle ait des meshes propres ou non.
7. **Instantanés** : trois fichiers CSV dans `data/import/` (format dans le plan, tâche 4). La relation FMA y est gardée telle que la FMA l'énonce ; la traduction en `continuation-of` (côté distal) se fait à l'import, son orientation étant vérifiée sur la paire axillaire → brachiale.
8. **Remontée vers le tout d'un muscle** : au plus trois niveaux de `regional_part_of` / `constitutional_part_of`, l'ancêtre le plus proche qui a des relations du type l'emporte.
9. **Relations inverses** : leur `side` est toujours le côté du sujet pour lequel la relation vaut.
10. **Import réel (2026-11-12)** : FMA 5.1.0 par OLS4 (3030 ids demandés, 11 absents d'OLS4 : 13363, 23876, 50532, 50533, 53074, 53082, 53083, 72951, 72952, 72953, 72979), Wikidata exporté le 2026-11-12 (3016 QID).
    - **Orientation de `continuous_distally_with`** : l'instantané n'a aucune ligne entre les artères axillaire et brachiale. Toutes les lignes entre deux de nos structures placent le proximal en sujet (veine iliaque commune → veine iliaque externe, œsophage → estomac, uretère → vessie) : `CONTINUATION_DISTAL_IS_SUBJECT = false` est gardé, le test reproduit la ligne 14333 → 18883.
    - **Relations écrites** : 913 (`branch-of` 265, `tributary-of` 113, `continuation-of` 12, `arterial-supply` 219, `innervation` 304), dont 132 au niveau d'un côté sur 32 structures (`branch-of` 14, `tributary-of` 11, `innervation` 107). 128 cibles externes dans le registre.
    - **Couverture** (atlas masculin) : artères avec `branch-of` 248/310, veines avec `tributary-of` 108/183, muscles avec `innervation` 158/222.
    - **Rapport** : 0 conflit, 0 relation vers le côté opposé, 468 cibles hors de nos structures abandonnées ; lignes ignorées : 53 `second-tree`, 48 `wrong-kind`, 38 `vein-p2286`, 2 `no-label`, 1 `self`.
    - **Une seule relation d'arbre par niveau avant la comparaison des côtés** : sans cela, des côtés identiques après mise à l'écart de la deuxième relation (veine testiculaire : veine cave inférieure des deux côtés) restaient écrits au niveau des côtés.
    - **Paire e2e** : `popliteal-artery` → `inferior-lateral-genicular-artery`. La FMA 5.1.0 rattache `anterior-tibial-artery` (comme `femoral-artery`, `popliteal-artery`, `posterior-tibial-artery`) par `branch_of` à `external-iliac-artery` ; les branches de la poplitée viennent de Wikidata (artères géniculaires inférolatérale, inféromédiale, moyenne). Réseau de `popliteal-artery@left` : 4 structures.
