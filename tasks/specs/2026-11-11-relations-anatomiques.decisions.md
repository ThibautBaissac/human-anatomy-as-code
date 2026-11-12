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
