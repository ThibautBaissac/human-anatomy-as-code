# Décisions d'implémentation : offline et mobile

Décisions prises là où la spec `2026-11-08-offline-mobile.md` est muette, ou que les mesures ont imposées.

1. **`@serwist/vite` fonctionne avec Vite 8 (Rolldown).** Le repli `@serwist/build` n'a pas été nécessaire.
2. **Les fichiers de Vite sont servis sous `/app/`** (`build.assetsDir`) pour ne pas se mêler aux modèles servis sous `/assets/`. Les routes du service worker restent ainsi sans ambiguïté.
3. **Découpage du bundle.** Pour qu'aucun fichier précaché ne dépasse 1 MB, three.js, three-mesh-bvh et les autres dépendances sont chacun dans leur propre fichier (704 kB, 300 kB et 253 kB). Précache total : 12 entrées, 1,28 MB.
4. **Web manifest et icônes.** Ils sont servis et émis par un petit plugin Vite (`app/static/`), parce que `publicDir` est déjà occupé par `build/` (atlas et modèles). Les icônes sont rendues une fois depuis `icon.svg` (`scripts/make-icons.mjs`) et versionnées.
5. **Mise en cache automatique.** Le service worker prend le contrôle dès sa première installation (`clientsClaim`). Les modèles chargés ensuite sont mis en cache au passage, si bien que le panneau peut déjà indiquer « Disponible hors ligne » sans clic. Le test de fumée tolère les deux cas.
6. **Rechargement après mise à jour.** Il est déclenché sur `controllerchange`, et seulement si l'utilisateur a accepté la mise à jour. L'événement `controlling` de `@serwist/window` ne signalait pas la mise à jour (`isUpdate`) dans ce scénario.
7. **Rendu à la demande.** Le viewer ne redessine que lorsqu'un changement le demande : caméra, amortissement en cours, état, taille du canevas, rotation de la page `/bench`. Il économise ainsi la batterie, et la construction des index n'est plus ralentie par des rendus inutiles. La spec ne le demandait pas : cela s'est imposé pour tenir le budget de 3 s sur ordinateur une fois le BVH différé.
8. **BVH différé.**
   - Les index sont construits après la première image, avec plusieurs kinds par tâche dans une tranche de 50 ms, via `setTimeout`. `requestIdleCallback`, prévu par la spec, ne se déclenchait presque jamais pendant le rendu et retardait le moment où la sélection devient possible.
   - Options `targetLeafSize: 24` et `indirect: true` : construction environ 12 % plus rapide, la sélection restant immédiate.
   - Résultats : première image à environ 700 ms (contre 2,7 s avant), sélection possible à environ 2,65 s (budget de 3 s).
9. **Survol.** Il attend que tous les index soient prêts : un mouvement de souris ne déclenche jamais de construction synchrone. Un clic, lui, construit les index des kinds visibles s'ils manquent.
10. **Source du chargement (`/bench`).** Elle est déterminée en lisant le cache `haac-assets` avant le chargement. `transferSize` ne convient pas : les réponses du service worker valent 0.
11. **Mise à jour : vérification hors suite automatique.** Elle a été faite par un script ponctuel : deux builds successifs, le bandeau apparaît, « Recharger » charge la nouvelle version. Faire servir deux builds par le serveur du test de fumée l'aurait rendu fragile.
12. **Le test de fumée offline ne tourne qu'en WebGPU**, puisque le service worker ne dépend pas du backend. Le test mobile émule un Pixel 7, avec le tactile et le repli WebGL2.
13. **Le hook `window.__viewer`** sert aussi à la page `/bench` et aux scripts de mesure.

## Mesures sur appareils réels

Protocole et tableau dans `spikes/04-mobile/RESULTS.md`. La mesure de référence sur Mac est faite. **Les mesures sur iPhone et Android restent à faire par l'utilisateur** : elles demandent mkcert (mot de passe) et les appareils.
