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

## Corrections issues de la revue de code (2026-11-08)

- **État après téléchargement.** Serwist confie la réponse à la page avant d'avoir fini de l'écrire en cache. L'état final est donc calculé avec les fichiers effectivement téléchargés, et pas seulement avec ce que le cache liste déjà. Sans cela, un téléchargement réussi pouvait s'afficher comme interrompu. Le test de fumée vide désormais le cache des modèles avant le clic, pour forcer un vrai téléchargement des 36,5 MB. La course elle-même n'a pas pu être reproduite de façon fiable (3 essais verts sans la correction) : aucun test ne l'isole.
- **Téléchargement bloqué ou lancé deux fois.**
  - Le téléchargement échoue après 10 s si aucun service worker ne contrôle la page (rechargement forcé, enregistrement en échec). Le message en français invite alors à recharger la page normalement.
  - Un verrou posé dès le clic empêche deux téléchargements simultanés.
  - Un échec d'enregistrement du service worker est journalisé.
- **Clic avant que les index soient prêts.** Seuls les index des kinds qui ont au moins une instance sélectionnable (visible et opaque) sont construits, et la recherche du point cliqué ne porte que sur ces kinds. Avant la correction, `mesh.visible`, toujours vrai, déclenchait la construction de tous les index au premier tap.
- **Annonces.** Le bandeau de mise à jour, l'indicateur « Hors ligne » et l'état du panneau hors ligne sont des régions `role="status"` toujours présentes : seul leur texte change, pour que les lecteurs d'écran les annoncent.
- **État partiel.** Quand tous les modèles sont en cache mais qu'il manque `atlas.json`, le panneau le dit en clair, au lieu d'afficher « 36,5 MB sur 36,5 MB ».
- **Divers.**
  - Fermer l'encart iOS renvoie le focus sur « Fermer ».
  - La page `/bench` ne plante plus si aucune image n'a été dessinée (onglet masqué).
  - `dispose()` arrête la construction des index et la rotation de la caméra.
  - Les chaînes de `/bench` sont dans `strings.ts`.
  - Les règles CSS en double sont supprimées.
- **Constantes partagées.** Les noms de cache et la disposition des URL (`offline/urls.ts`) sont partagés par le service worker, le gestionnaire offline et le viewer.
- **Versions figées.** `serwist`, `@serwist/vite` et `@serwist/window` sont épinglés en 9.5.13 exact.

## Écarts déclarés après la revue

- **Navigation : précache d'abord, pas NetworkFirst.** `navigateFallback` sert le `index.html` précaché, qui référence les fichiers JS et CSS de la même version : l'application reste cohérente. Une mise à jour passe par le bandeau. Servir le réseau d'abord pourrait charger un `index.html` qui pointe vers des fichiers absents du précache.
- **Nom du script.** C'est `preview:https`, et non `dev:https` : il sert le build de production, seul cas où le service worker et les budgets ont un sens.
- **Bouton d'installation.** Il s'intitule « Installer l'application » plutôt que « Installer », pour un intitulé explicite hors contexte (RGAA 6.1).
- **Limite connue.** Les modèles périmés ne sont retirés du cache qu'à l'activation d'un nouveau service worker. Un rebuild qui ne touche que les assets laisse les anciens fichiers en cache jusqu'à la prochaine version de l'application. Ce n'est pas bloquant, puisque les noms sont versionnés ; une correction est à prévoir dans une spec ultérieure.
- **US 18.** Elle reste ouverte jusqu'aux mesures sur iPhone et Android (`spikes/04-mobile/RESULTS.md`).
