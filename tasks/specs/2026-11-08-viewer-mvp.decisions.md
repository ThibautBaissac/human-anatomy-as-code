# Décisions d'implémentation : viewer MVP

Décisions prises là où la spec `2026-11-08-viewer-mvp.md` est muette ou admet deux lectures.

1. **Cadrage de la caméra.** La sélection depuis l'arbre, la recherche ou les liens du panneau (parent, enfants) cadre la structure (US 8). Un clic dans la vue 3D sélectionne sans déplacer la caméra : recadrer à chaque clic ferait perdre le point de vue qu'on est en train d'explorer.
2. **Clic ou glisser.** Un déplacement de plus de 4 px entre l'appui et le relâchement est une rotation de la caméra, pas une sélection.
3. **Sélection depuis l'arbre ou la recherche.** Elle porte sur la structure entière (`side: null`), donc les deux côtés sont surlignés. Un côté précis se sélectionne par un clic dans la vue 3D ; l'URL (`sel=slug@left`) le restitue.
4. **Ordre d'application au chargement.** La caméra et la langue venues de l'URL sont appliquées avant le chargement des modèles, pour éviter un cadrage par défaut puis un saut. Le reste de l'état de l'URL (sélection, couches, kinds, coupes) est appliqué après le chargement, parce que sa validation demande le catalogue.
5. **Transparence par batch.** En mode fantôme, un `BatchedMesh` passe en `transparent` dès qu'une de ses instances visibles a un alpha inférieur à 1. Les instances opaques du même batch sont alors triées avec les autres. Ce compromis est accepté pour le MVP.
6. **Couleur des faces coupées.** Teinte du kind × 0,55, en émissif sur les faces arrière (`frontFacing`), dont la couleur diffuse est mise à zéro. La surbrillance de sélection ne s'applique pas aux faces coupées.
7. **Survol.** Le picking du survol est fait au plus une fois par frame, avec le dernier `pointermove`. L'événement `hover` n'est émis que si la structure survolée change.
8. **Arbre.**
   - Le focus reste sur le conteneur `role="tree"`, et l'élément actif est désigné par `aria-activedescendant`. Avec une liste virtualisée, la ligne active peut ne pas exister dans le DOM au moment du focus ; le défilement automatique la fait apparaître.
   - Le nœud « Non rattachées » n'est pas sélectionnable : il ouvre et ferme seulement sa branche.
9. **Recherche.** Le motif combobox APG avec liste déroulante : le focus reste dans le champ et l'option active est désignée par `aria-activedescendant`. Le nombre de résultats est annoncé dans une région `role="status"`. Échap ferme la liste, puis vide le champ.
10. **Crédits.** La barre d'état affiche les sources d'attribution d'`atlas.json` (BodyParts3D, FMA, Wikidata), ce qu'exigent les licences CC BY, ainsi que le backend de rendu.
11. **Favicon.** Un favicon vide en data URI : sinon la requête `/favicon.ico` produit un 404 en console, que le test de fumée considère, à juste titre, comme une erreur.
12. **Mesure du budget.** Elle est faite sur le build de production (`vite build` puis `vite preview`), dans Chrome headless, sans vsync et sans limite de fréquence (`--disable-gpu-vsync --disable-frame-rate-limit`), comme dans les spikes. En mode dev, ou avec la vsync, la frame est plafonnée à 16,7 ms et le chargement est plus lent, car les modules ne sont pas bundlés.

## Résultats mesurés (Mac Apple Silicon, Chrome headless, WebGPU)

- Instances : 1 657 ; assets : 36,5 MB (meshopt), répartis en 12 fichiers GLB.
- Chargement complet (GLB et BVH) : 2 728 ms, sous le budget de 3 s, mais avec peu de marge.
- Frame moyenne : 3,42 ms, scène complète opaque.
- Test de fumée vert en WebGPU et en WebGL2 (`?backend=webgl`).
