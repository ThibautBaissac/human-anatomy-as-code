# Offline (PWA) et mobile (spec 2)

Suite de `2026-11-08-viewer-mvp.md`. Vocabulaire : `CONTEXT.md`. Choix techniques : section « Offline » de `reports/Choix techniques atlas anatomie 3D.md`.

## Problem statement

L'atlas ne fonctionne qu'en ligne, sur un ordinateur, et seulement si un serveur local tourne. Or un étudiant révise dans le train, dans un amphi sans réseau, ou sur son téléphone. Chaque visite retélécharge 38 MB. Rien ne permet de garder l'atlas sur l'appareil, et Safari efface les données d'un site non installé au bout de 7 jours sans visite. Sur un téléphone, l'interface empile tous les panneaux dans une page interminable. Enfin, personne n'a jamais mesuré si un téléphone tient la charge : c'est le principal risque laissé ouvert par les spikes.

## Solution

L'atlas devient une application web installable qui fonctionne sans réseau.
- **Mise en cache.** L'application elle-même est mise en cache dès la première visite. Les modèles 3D le sont au fil de leur chargement.
- **Téléchargement complet.** Un bouton télécharge tout ce qui manque, demande au navigateur de conserver ces données et affiche ce qui est disponible hors ligne.
- **Mises à jour.** Une nouvelle version est proposée sans être imposée, et seuls les fichiers modifiés sont retéléchargés.
- **Téléphone.** La vue 3D occupe le haut de l'écran et trois onglets la complètent (Arbre, Infos, Commandes).
- **Mesure.** Une page de mesure et un serveur HTTPS sur le réseau local permettent de vérifier les budgets sur un vrai iPhone et un vrai Android. Si le premier affichage est trop lent, la construction de l'index de sélection est différée après le premier rendu.

## User stories

### Étudiant

1. En tant qu'étudiant, je veux qu'après une première visite l'atlas s'ouvre et fonctionne sans réseau, afin de réviser n'importe où.
2. En tant qu'étudiant, je veux un bouton « Rendre disponible hors ligne » qui télécharge tout l'atlas en une fois, afin de ne pas dépendre de ce que j'ai déjà consulté.
3. En tant qu'étudiant, je veux voir la progression du téléchargement puis l'état « Disponible hors ligne » avec la taille occupée, afin de savoir quand je peux couper le réseau.
4. En tant qu'étudiant, je veux que l'atlas demande au navigateur de conserver ses données, et savoir si le navigateur a accepté, afin qu'elles ne soient pas effacées sans prévenir.
5. En tant qu'étudiant sur iPhone, je veux être guidé pour ajouter l'atlas à l'écran d'accueil, afin que Safari ne l'efface pas après 7 jours.
6. En tant qu'étudiant sur Android ou sur ordinateur, je veux un bouton « Installer » quand le navigateur le permet, afin de lancer l'atlas comme une application.
7. En tant qu'étudiant, quand une nouvelle version est disponible, je veux un bandeau qui me propose de recharger, sans rechargement forcé, afin de ne pas perdre ce que je regarde.
8. En tant qu'étudiant, je veux qu'une mise à jour ne retélécharge que les modèles qui ont changé, afin de préserver mon forfait.
9. En tant qu'étudiant hors ligne, si une partie de l'atlas n'a pas été téléchargée, je veux un message qui le dit, plutôt qu'un écran vide.
10. En tant qu'étudiant sur téléphone, je veux voir la vue 3D en haut et passer entre Arbre, Infos et Commandes par des onglets, afin de ne pas faire défiler une page interminable.
11. En tant qu'étudiant sur téléphone, je veux sélectionner une structure d'un tap et tourner ou zoomer avec un ou deux doigts, afin d'explorer au doigt.
12. En tant qu'étudiant sur téléphone, quand je touche une structure, je veux que l'onglet Infos s'ouvre, afin de lire son nom tout de suite.
13. En tant qu'utilisateur au clavier ou avec un lecteur d'écran, je veux que les onglets, le bouton hors ligne, le bandeau de mise à jour et l'encart d'installation soient accessibles et annoncés, afin d'en profiter comme les autres.

### Mainteneur

14. En tant que mainteneur, je veux que les fichiers des modèles portent l'empreinte de leur contenu dans leur nom, afin qu'un nouveau build invalide exactement ce qui a changé.
15. En tant que mainteneur, je veux une commande qui sert l'application en HTTPS sur le réseau local, afin de tester WebGPU sur un vrai téléphone.
16. En tant que mainteneur, je veux une page de mesure qui affiche un JSON copiable (appareil, backend, chargement, frames, mémoire si disponible), afin de comparer les appareils.
17. En tant que mainteneur, je veux un test automatique qui vérifie le fonctionnement hors ligne après téléchargement, afin de ne pas casser l'offline sans le savoir.
18. En tant que mainteneur, je veux consigner les mesures sur iPhone et Android dans le dépôt, afin de décider des optimisations sur des chiffres.

## Implementation decisions

### Assets adressés par leur contenu

- `tools/assets` écrit chaque fichier sous le nom `<kind>.<sha8>.glb`, où `sha8` est formé des 8 premiers caractères hexadécimaux du sha256 du contenu. Le champ `file` du manifeste porte ce nom.
- `manifest.json` et `atlas.json` gardent un nom fixe.
- Avant d'écrire, le build supprime de `outDir` les `.glb` qui ne figurent pas dans le nouveau manifeste. Le répertoire ne contient ainsi que la version courante.
- Le manifeste gagne un champ `totalBytes` (somme des `bytes`).

### Service worker

- Outil : `@serwist/vite` 9.5 avec un service worker personnalisé (`app/src/sw.ts`), écrit avec le runtime `serwist`.
  - **Repli** : si `@serwist/vite` ne fonctionne pas avec Vite 8 (Rolldown), le service worker est construit par un second build Vite, et la liste de précache est injectée par `@serwist/build` (`injectManifest`) après `vite build`. Le choix effectif est consigné dans le fichier de décisions.
- **Précache** : l'application uniquement (HTML, JS, CSS du build Vite, favicon, manifeste web, icônes). Jamais les modèles, ni `atlas.json`, ni `manifest.json`.
- **Routes à l'exécution :**
  - `/assets/*.glb` : *CacheFirst* dans le cache `haac-assets`. Ces fichiers sont immuables, puisque leur nom porte leur empreinte.
  - `/atlas.json` et `/assets/manifest.json` : *NetworkFirst* avec un délai de 3 s, dans le cache `haac-data`. Hors ligne, la dernière version reçue est servie.
  - Navigation : *NetworkFirst* avec repli sur le `index.html` du précache.
- **Mise à jour.** Le nouveau service worker attend (`skipWaiting` n'est pas automatique). L'application l'apprend par `@serwist/window`, affiche le bandeau, et sur « Recharger » envoie `SKIP_WAITING` puis recharge au `controlling`.
- **Nettoyage.** À l'activation, le service worker lit le `manifest.json` réseau, ou celui en cache à défaut. Il supprime du cache `haac-assets` toute entrée absente de ce manifeste.
- Le service worker n'est enregistré qu'en production (`vite build`, `vite preview`, HTTPS local). En `vite dev`, il n'y a pas de service worker.

### Gestionnaire offline (`app/src/offline/`)

- **Module pur `offline-state.ts`.** `offlineStatus(manifest, cachedUrls, persisted) → { state: 'none' | 'partial' | 'complete', cachedBytes, totalBytes, missing: string[], persisted }`.
  - `complete` signifie que tous les fichiers du manifeste sont en cache, ainsi que `atlas.json` et `manifest.json`.
  - `none` signifie qu'aucun GLB n'est en cache.
- **Module `offline.ts`** (navigateur) :
  - `readStatus()` lit le cache et `navigator.storage.persisted()`.
  - `makeAvailableOffline(onProgress)` :
    - demande `navigator.storage.persist()` ;
    - télécharge, avec `fetch`, les fichiers manquants (le service worker les met en cache), deux à la fois ;
    - émet une progression en octets ;
    - renvoie le nouveau statut.
  - Une erreur réseau pendant le téléchargement laisse le statut `partial` et est signalée. Les fichiers déjà en cache le restent.
- **Hors ligne avec un statut `partial`.** Les kinds manquants arrivent dans `failedKinds` du viewer (mécanisme existant). Le message dit alors « Modèles non disponibles hors ligne : … » au lieu de « non chargés ».

### Installation

- **Manifeste web** (`manifest.webmanifest`) :
  - nom « Human Anatomy As Code », nom court « Anatomie » ;
  - `display: standalone`, `start_url: "/"`, `lang: "fr"` ;
  - couleurs de l'interface ;
  - icônes 192 et 512 px, plus une icône maskable 512 px, produites une fois en SVG puis rendues en PNG et versionnées.
- **Android et ordinateur.** Bouton « Installer » affiché seulement après `beforeinstallprompt` ; il appelle `prompt()`.
- **iOS** : détection de Safari iOS hors du mode standalone (`navigator.standalone !== true`, avec un user agent iPhone ou iPad, ou un Mac tactile). Un encart dans le panneau hors ligne explique « Partager → Sur l'écran d'accueil » et la raison (effacement après 7 jours). Il peut être masqué, et ce choix est mémorisé dans `localStorage`.

### Interface

- **Panneau « Hors ligne »**, accessible depuis l'en-tête par un bouton qui ouvre un `<dialog>` modal natif :
  - l'état (aucun, partiel avec X sur Y MB, complet) et la persistance (accordée ou non) ;
  - le bouton « Rendre disponible hors ligne », avec une barre `<progress>` libellée ;
  - le bouton « Installer » quand il est disponible, et l'encart iOS.
- **Bandeau de mise à jour** : en haut de page, `role="status"`, avec les boutons « Recharger » et « Plus tard ».
- **Indicateur hors ligne.** Quand `navigator.onLine` est faux, l'en-tête affiche « Hors ligne » en texte, pas seulement par une couleur.
- **Sous 900 px de large** :
  - en-tête compact : la recherche passe sur sa propre ligne ;
  - vue 3D sur 50 % de la hauteur visible (`50dvh`) ;
  - en dessous, une liste d'onglets selon le motif ARIA APG Tabs (`tablist`, `tab`, `tabpanel`, flèches gauche et droite, activation automatique) : Arbre, Infos, Commandes ;
  - un seul panneau visible ; la barre d'état reste en bas.
  - Une sélection venue de la vue 3D active l'onglet Infos. Une sélection venue de l'arbre ou de la recherche laisse l'onglet courant.
- **Tactile** : `touch-action: none` sur le canevas. Un tap sélectionne, avec un seuil de déplacement de 8 px en tactile (4 px à la souris, comme aujourd'hui).

### Mesure sur appareil réel

- **Script `dev:https`** dans `app`. Vite sert le build de production (`vite preview --host`) en HTTPS, avec un certificat local lu dans `app/.certs/` (non versionné). Si les fichiers manquent, le script affiche les commandes mkcert à lancer :
  - `mkcert -install`, qui demande le mot de passe et que l'utilisateur lance lui-même ;
  - `mkcert -cert-file app/.certs/cert.pem -key-file app/.certs/key.pem <ip-locale> localhost`.
- **Page `/bench`** (même application, paramètre `?bench=1`) :
  - charge tout ;
  - attend 2 s, puis fait tourner la caméra 10 s ;
  - affiche un JSON copiable : user agent, backend, taille du canevas et ratio de pixels, chargement (froid ou depuis le cache), première image affichée, frame moyenne et p95, instances, `performance.memory` si disponible.
  - Elle se lance aussi avec `&backend=webgl`.
- **BVH différé.** Le viewer affiche la scène dès que les GLB sont dans les `BatchedMesh`. Il construit ensuite les BVH par kind, un kind par tâche (`requestIdleCallback`, avec repli sur `setTimeout`).
  - Un clic avant la fin construit immédiatement le BVH des kinds visibles.
  - Le budget distingue « première image » et « prêt à sélectionner ».
- **Résultats.** Ils sont consignés dans `spikes/04-mobile/RESULTS.md` : appareil, système, navigateur, backend, chiffres et observations, pour au moins un iPhone et un Android.

### Ordre de livraison

1. Assets adressés par leur contenu, puis `offlineStatus` (tests unitaires).
2. Service worker, gestionnaire offline, panneau, bandeau, manifeste web et icônes.
3. Onglets mobiles et réglages tactiles.
4. BVH différé, page `/bench` et HTTPS local.
5. Test de fumée offline, puis mesures sur appareils réels par l'utilisateur, consignées.

## Testing decisions

- **Tests unitaires** (`node:test`, valeurs simples) :
  - `offlineStatus` : aucun, partiel, complet, octets, fichiers manquants, persistance ;
  - le réducteur clavier des onglets (`tabsKeyReducer`, sur le modèle de `treeKeyReducer`) ;
  - la détection « iOS hors standalone », comme fonction pure d'un user agent, de `standalone` et de `maxTouchPoints`.
- **Pipeline d'assets** :
  - les tests existants sont adaptés aux noms avec empreinte ;
  - un nouveau test vérifie qu'un second build après modification d'un OBJ change le nom d'un seul fichier et supprime l'ancien.
- **Test de fumée offline** (Playwright, sur le build de production) :
  1. charger l'application et attendre que le service worker contrôle la page ;
  2. ouvrir le panneau hors ligne et cliquer « Rendre disponible hors ligne », puis attendre l'état « complet » ;
  3. `context.setOffline(true)` puis recharger ;
  4. vérifier le chargement complet sans erreur et une sélection par la recherche ;
  5. vérifier que l'URL avec hash restitue la vue hors ligne.
- **Test de fumée mobile** (Playwright, émulation `devices['Pixel 7']` en WebGL2) :
  - les onglets sont présents ;
  - un tap sur la vue 3D active l'onglet Infos avec un nom ;
  - la navigation au clavier entre les onglets fonctionne.
- **Mise à jour.** Elle est vérifiée par un test de fumée qui sert deux builds successifs (changement d'une chaîne) et attend le bandeau. Si cette orchestration est instable, la vérification est manuelle, consignée dans le fichier de décisions.
- **Mesures sur appareil réel** : protocole manuel, documenté, résultats versionnés. Elles ne font pas partie des tests automatiques.

## Global constraints

- **Dépendances ajoutées**, rien d'autre : `serwist@9.5.13`, `@serwist/vite@9.5.13` (ou `@serwist/build@9.5.13` en repli), `@serwist/window@9.5.13`.
- **Contenu du précache.** Aucun fichier de plus de 1 MB n'est précaché ; le précache total reste sous 2 MB.
- **Caches** : `haac-assets` (GLB), `haac-data` (atlas et manifeste), précache Serwist. Pas d'IndexedDB et pas d'OPFS.
- **Budgets sur téléphone milieu de gamme**, scène complète :
  - chargement depuis le cache, jusqu'à la première image : moins de 8 s ;
  - au moins 30 images par seconde en moyenne.
- **Budget sur ordinateur, inchangé** : chargement complet en moins de 3 s ; première image et prêt à sélectionner mesurés séparément.
- **Accessibilité** : RGAA 4.1.2 / WCAG 2.1 AA pour les onglets, la boîte de dialogue, le bandeau, la barre de progression et l'encart iOS. Le focus est rendu à l'élément d'origine à la fermeture de la boîte de dialogue.
- **Confidentialité** : aucun tunnel ni hébergement public ; le HTTPS est local uniquement. Aucune donnée n'est envoyée ailleurs : la page `/bench` affiche le JSON et n'envoie rien.
- Interface en français ; nouvelles chaînes dans `strings.ts`.

## Out of scope

- Déploiement public et hébergement (licence BodyParts3D toujours à confirmer).
- Packs par région ou par système, téléchargement sélectif.
- Capacitor ou application native ; notifications push ; synchronisation en arrière-plan.
- Niveaux de détail, textures KTX2, BVH dans un worker (seulement si les mesures dépassent les budgets après le BVH différé, dans une spec ultérieure).
- Coupe haute qualité, animations, modèle féminin.
- Traduction de l'interface.

## Further notes

- Volumes actuels : 36,5 MB de GLB, 1,7 MB pour `atlas.json`, environ 1,3 MB pour le bundle JS (361 kB en gzip). Le précache de l'application tient donc dans la limite de 2 MB.
- **Quotas.** Ils ne posent pas de problème : jusqu'à 60 % du disque par origine sous Chrome et sous Safari 17 et plus. Le risque, c'est l'éviction, d'où `persist()` et l'installation sur l'écran d'accueil sous iOS (rapport, section Offline).
- WebGPU demande un contexte sécurisé. En HTTP sur une IP locale, le navigateur bascule sur WebGL2 ; le serveur HTTPS local sert à mesurer les deux backends.
- Spikes de référence : 3,8 ms par frame en WebGPU sur ordinateur, et 2,7 s de chargement, dominées par le BVH. Sur téléphone, le BVH différé est la première optimisation à essayer, parce qu'elle ne coûte presque rien.
