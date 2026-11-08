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

## Corrections issues de la revue de code (2026-11-08)

- **Noms des côtés.** Un nom de côté (« fémur gauche ») absent dans la langue choisie se replie sur fr, puis sur en. Le calcul est fait par une seule fonction pure, `structureName`, couverte par des tests et utilisée par le panneau, le survol et l'annonce ARIA.
- **`hashchange`.** Un paramètre absent du hash reprend sa valeur par défaut (`viewFromHash`, testée). Seule la caméra est conservée quand le hash ne la donne pas.
- **`sel=<slug>@<côté>`.** Le paramètre est ignoré si la structure n'est pas bilatérale.
- **Budget de chargement.** Il couvre désormais aussi le téléchargement d'`atlas.json` (`markLoadStart()` avant les requêtes) : 2 640 ms mesurées.
- **Mode fantôme.** Les couches en transparence ne captent plus le clic ni le survol. L'alpha courant de chaque instance est conservé dans un `Float32Array` par batch. Un test de fumée le vérifie : il passe une couche en fantôme et constate que le même clic sélectionne une structure plus profonde.
- **Panneau.** Il affiche le statut de relecture de la structure (US 19).
- **Glossaire.** L'interface dit « Nature » pour *kind* (CONTEXT.md : « nature tissulaire », à éviter : « type ») et « Slug » pour le slug.
- **Erreurs de chargement.** Les réponses HTTP non 2xx sont vérifiées. L'erreur est affichée en français, avec les commandes à lancer, dans une zone `role="alert"`.
- **Accessibilité.** Le canevas a `role="img"`, ce qui expose son nom accessible. La recherche est en `type="text"` : Échap ferme d'abord la liste, sans être court-circuité par le comportement natif des champs de recherche.
- **Résultats de recherche.** Chaque résultat indique la langue de la correspondance (spec : « Chaque résultat indique… »).
- **Chaînes.** Toutes les chaînes de l'interface sont dans `strings.ts`.
- **Nettoyage.** Les écouteurs `hashchange` et `change` et le minuteur du hash sont retirés au démontage. Le chargement s'interrompt si le composant est démonté.
- **Manifeste.** Les clés internes sont triées (`bytes`, `file`, `instances`, `sha256`).
- **Kind `joint`.** Il reçoit la couleur `#a8b8d8` : la spec n'en prévoyait pas. La table de la spec est complétée.

## Écarts d'API déclarés

- **Création.** `Viewer.create(canvas, opts)`, une fabrique asynchrone (l'initialisation du renderer WebGPU est asynchrone), au lieu de `createViewer`.
- **Progression.** `load(atlas, manifest, baseUrl)` ne prend pas de callback : la progression passe par l'événement `change` (`snapshot.loading`).
- **Paramètres explicites.** `decodeView(hash, ctx)` reçoit un contexte de validation (slugs, kinds, couche maximale, structures bilatérales), et `search(index, query, lang, limit)` reçoit la langue d'affichage.
- **Typed arrays.** L'état est porté par l'état de vue sérialisable, et le rendu applique `appearance()` instance par instance. Seul l'alpha courant est en typed array, pour le picking. Un tableau par propriété n'apporterait rien à 1 657 instances.
- **Point de clic du test de fumée.** Il est à 40 % de la hauteur du canevas, au niveau du thorax, et non au centre, où se trouve le bassin.
- **Hook de test.** `window.__viewer` reste dans le build de production, parce que le test de fumée tourne sur ce build. Il n'expose que l'API publique du viewer.

## Défaut de données trouvé par la revue

- La classification des kinds de l'import testait les mots-clés des os avant ceux des vaisseaux et des nerfs. « anterior tibial artery » et « set of dorsal metacarpal arteries » étaient donc classés `bone`, et le clic au thorax sélectionnait une « artère » rangée parmi les os. L'ordre a été corrigé dans `tools/atlas`, voir `2026-11-08-modele-de-donnees.decisions.md`. 35 structures en `draft` ont été reclassées (os : 210 → 180).
