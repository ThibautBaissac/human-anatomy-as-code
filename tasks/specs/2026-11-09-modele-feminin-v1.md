# Modèle féminin v1 (composite BodyParts3D + HRA)

Vocabulaire : `CONTEXT.md`. Faits mesurés sur les fichiers HRA : `research_notes/Modele feminin HRA/hra_female.md`. Spécifications précédentes : `2026-11-08-modele-de-donnees.md`, `2026-11-08-viewer-mvp.md`, `2026-11-08-offline-mobile.md`.

## Problem statement

L'atlas ne montre qu'un corps masculin. Une étudiante ou un étudiant ne peut y voir ni utérus, ni ovaires, ni trompes, ni glandes mammaires, et les organes pelviens affichés sont ceux d'un homme. Aucun modèle féminin libre du corps entier n'existe. Le Human Reference Atlas (HRA) fournit des organes féminins sous CC BY 4.0, mais il n'a pas de squelette complet, pas de muscles, et il vit dans un autre repère et un autre corps que BodyParts3D.

## Solution

Un **modèle féminin v1** composite. Il garde le squelette et les muscles de BodyParts3D et masque les 13 structures masculines, plus l'urètre et la peau masculins. Il ajoute les organes féminins du HRA (utérus et ses parties, ovaires, trompes, vagin, ligaments utérins, glandes mammaires) et remplace la vessie et le rectum par leurs versions féminines. Les organes HRA sont recalés dans le repère de BodyParts3D par région : pelvienne, et thoracique pour les seins. Un sélecteur Homme / Femme bascule entre les deux modèles. L'interface dit honnêtement ce qu'est ce modèle : des organes féminins sur un squelette et des muscles masculins. Les noms et les identifiants des nouvelles structures sont importés comme pour BodyParts3D, en `draft`. L'offline sait télécharger un modèle ou les deux.

## User stories

### Étudiant

1. En tant qu'étudiant, je veux choisir entre le modèle masculin et le modèle féminin, afin d'étudier l'anatomie des deux sexes.
2. En tant qu'étudiant, je veux voir dans le modèle féminin l'utérus et ses parties, les ovaires, les trompes, le vagin, les ligaments utérins et les glandes mammaires, à leur place dans le bassin et le thorax, afin d'en comprendre les rapports.
3. En tant qu'étudiant, je veux que le modèle féminin ne montre aucune structure masculine (testicules, prostate, pénis, urètre masculin, peau masculine), afin de ne pas être induit en erreur.
4. En tant qu'étudiant, je veux que la vessie et le rectum du modèle féminin soient ceux d'un corps féminin, afin que les rapports avec l'utérus soient justes.
5. En tant qu'étudiant, je veux lire clairement que ce modèle féminin v1 réunit des organes féminins et un squelette et des muscles masculins, et pourquoi, afin de ne pas prendre le bassin ou la musculature pour une référence féminine.
6. En tant qu'étudiant, je veux savoir que le modèle féminin n'a pas de peau, et pourquoi, afin de comprendre que la dissection y commence aux fascias et aux muscles.
7. En tant qu'étudiant, quand je change de modèle, je veux garder ma structure sélectionnée si elle existe dans les deux, et être prévenu sinon, afin de comparer sans tout reprendre.
8. En tant qu'étudiant, je veux que la recherche, l'arbre et le panneau ne proposent que les structures du modèle affiché, afin de ne pas chercher un organe absent.
9. En tant qu'étudiant, je veux partager une vue du modèle féminin par son URL, afin qu'un camarade voie la même chose.
10. En tant qu'étudiant, je veux rendre disponible hors ligne le modèle affiché, ou les deux, afin de réviser l'un ou l'autre sans réseau.
11. En tant qu'étudiant, je veux voir les noms français et latins des nouvelles structures, avec le badge « non relu » tant qu'ils ne sont pas vérifiés, afin d'apprendre sans me fier à une traduction non relue.

### Contributeur et mainteneur

12. En tant que contributeur, je veux qu'une structure propre à un sexe le déclare (`sex`), et qu'une structure partagée dont la géométrie diffère le déclare (`variants.female`), afin que le modèle de données dise ce que chaque modèle montre.
13. En tant que mainteneur, je veux télécharger les fichiers HRA nécessaires par une commande, à une version figée, avec leur DOI, afin de rendre le build reproductible.
14. En tant que mainteneur, je veux que les repères du recalage, les matrices calculées et l'écart résiduel soient versionnés et recalculables par une commande, afin de pouvoir les relire et les corriger.
15. En tant que mainteneur, je veux que le build des assets applique le recalage et simplifie les meshes trop lourds, afin que le modèle féminin reste léger.
16. En tant que mainteneur, je veux que chaque organe HRA soit crédité avec son DOI dans les attributions, et seulement dans le modèle où il apparaît, afin de respecter la licence CC BY 4.0.
17. En tant que mainteneur, je veux que les incohérences connues du HRA (ligaments ronds gauche et droit inversés, identifiants des ovaires) soient corrigées par arbitrage versionné, afin de ne pas propager leurs erreurs.
18. En tant que mainteneur, je veux un test de fumée du modèle féminin (chargement, bascule, sélection d'un organe féminin, absence de structure masculine), afin de détecter une régression.

## Implementation decisions

### Modèle de données (`tools/atlas`)

- **Champ `sex`.** Une structure peut porter `sex: male | female`. Absent, elle appartient aux deux modèles.
- **Bloc `variants.female`.** Une structure sans `sex` peut porter ce bloc, qui remplace pour le modèle féminin soit sa géométrie (`meshes` à la racine, ou `sides.<côté>.meshes`), soit sa présence (`hidden: true`). Une structure qui porte `sex` ne peut pas avoir de `variants`. Le schéma et une règle de compilation (`variant-shape`) le vérifient.
- **Compilation par modèle.** Le compilateur produit `build/atlas-male.json` et `build/atlas-female.json`.
  - Chaque atlas contient les structures de son modèle, avec la géométrie du modèle : `variants` y est déjà résolu.
  - Il contient aussi son `meshIndex` et ses `attributions` : seules les sources dont les meshes ou les labels apparaissent dans ce modèle.
  - `build/atlas.json` resta produit un temps pour compatibilité ; il est supprimé depuis le 2026-11-10 (voir les décisions).
- **Règles de validation.**
  - `mesh-unique` s'applique **par modèle**.
  - `fma-unique` s'applique à l'ensemble.
  - Une structure partagée sans mesh dans le modèle féminin (`hidden: true`) disparaît de cet atlas. Ses enfants restent rattachés au premier ancêtre présent.
- **Registre des sources.** Nouvelle source `data/sources/hra.yaml` : préfixe `hra`, motif `^[a-z0-9-]+/[A-Za-z0-9_]+$` (`<organe>/<nœud GLB>`), version HRA, licence CC-BY-4.0, URL du catalogue.
  - Nouveau champ optionnel `dois` : organe → DOI, utilisé pour l'attribution par organe.
  - Le schéma des sources est étendu en conséquence.

### Fichiers HRA (`tools/hra`)

- **Commande `hra-fetch`.** Elle lit la liste figée `data/import/hra-files.yaml` (organe, version, fichier, DOI) et télécharge dans `data/raw/hra/` (non versionné) :
  - les GLB par organe utilisés : utérus, ovaires G/D, trompes G/D, glandes mammaires G/D, vessie, gros intestin (pour `VH_F_rectum`), bassin et sternum (repères seulement) ;
  - leurs `crosswalk.csv`.

  Elle vérifie le sha256 de chaque fichier.
- **Extraction depuis le corps complet.** Le vagin et les ligaments utérins n'existent que dans `united-female` (357 MB). La commande télécharge ce fichier une fois, en extrait les nœuds listés dans `hra-files.yaml` (vagin, ligaments larges, ronds, cardinaux, utéro-sacrés, suspenseurs de l'ovaire, ligaments propres de l'ovaire) vers `data/raw/hra/extracted-united.glb`, puis supprime le gros fichier. Aucun fichier HRA n'est versionné dans le dépôt.

### Recalage (`tools/hra`)

- **Transformation de base**, de HRA vers BodyParts3D : rotation de +90° autour de X (Y vers le haut devient Z vers le haut), conversion des mètres en millimètres (×1000). Les deux repères ont +X à gauche du sujet.
- **Transformations régionales**, des similitudes (échelle uniforme, rotation, translation) ajustées au sens des moindres carrés (méthode d'Umeyama) sur des paires de repères anatomiques. Deux régions :
  - **pelvienne** : utérus, ovaires, trompes, vagin, ligaments, vessie, rectum. Repères : les 8 points du bassin de la recherche (promontoire, épines iliaques antéro-supérieures et postéro-supérieures, symphyse, tubérosités ischiatiques…) ;
  - **thoracique** : glandes mammaires. Repères : manubrium, angle sternal, processus xiphoïde, plus deux points costaux.
- **Fichier `data/import/hra-registration.yaml`**, versionné. Pour chaque région, il donne :
  - les repères (nom, coordonnées BodyParts3D en mm, coordonnées HRA dans le repère de base) ;
  - la liste des organes concernés ;
  - la matrice 4×4 calculée, l'échelle et l'écart résiduel (RMS et maximal, en mm) ;
  - une éventuelle correction manuelle (`adjust` : translation en mm), appliquée après l'ajustement.
- **Commande `hra-register`.** Elle recalcule les matrices à partir des repères et réécrit le fichier en préservant les commentaires. Elle échoue si l'écart RMS d'une région dépasse 25 mm.
- **Repères en données.** Les coordonnées sont saisies dans le fichier, relevées une fois par script et relues. Elles ne sont jamais devinées au build.

### Import des structures féminines (`tools/atlas`, `importHra`)

- **Entrées** : les GLB HRA téléchargés et leurs `crosswalk.csv`, le CSV Wikidata, et le fichier d'arbitrages `data/import/hra-overrides.yaml`.
- **Structures `sex: female`.** Chaque nœud HRA retenu devient une structure, ou un côté :
  - slug : label anglais du nœud en kebab-case, sans le préfixe `VH_F_` ;
  - `ids.uberon` et `ids.fma` depuis `extras.ontologyid` et la table de correspondance ; quand la table et le GLB divergent, l'arbitrage tranche ;
  - les paires gauche/droite (ovaires, trompes, glandes mammaires, ligaments) sont regroupées en une structure bilatérale, par la même règle que BodyParts3D ;
  - parent : `uterus` pour ses parties, `female-genital-system` (structure de groupe créée, `sex: female`, rattachée au `genital-system` existant) pour les organes génitaux, `mammary-gland` sous `thorax` ;
  - labels : `en` depuis le label HRA (`source: hra`) ; `fr` et `la` depuis Wikidata par l'identifiant UBERON ou FMA, avec la table des genres existante ; tout en `draft`.
- **Variantes `female`.** `urinary-bladder` et `rectum` reçoivent `variants.female.meshes`, qui pointent vers les nœuds HRA. `skin` reçoit `variants.female.hidden: true`.
- **Structures `sex: male`.** Les 13 structures masculines listées par la recherche, plus `urethra`, reçoivent `sex: male` : la géométrie de l'urètre de BodyParts3D est masculine, et le HRA n'a pas d'urètre féminin.
- **Wikidata.** La requête SPARQL (`data/import/wikidata-fma.rq`) est étendue à l'identifiant UBERON (P1554), et l'export CSV gagne une colonne `uberon`.
- **Fusion.** Mêmes règles que `importBp3d` : le YAML fait autorité, ce qui est `reviewed` n'est jamais modifié, et il n'y a ni suppression ni écrasement.
- **Arbitrages** (`hra-overrides.yaml`) : inversion des ligaments ronds gauche et droit du corps complet, identifiants des ovaires, slugs forcés si besoin.

### Assets (`tools/assets`)

- **Références `hra:<organe>/<nœud>`.** La géométrie est lue dans `data/raw/hra/` (GLB par organe ou `extracted-united.glb`). Le build applique la transformation de base, puis celle de la région de l'organe, et recalcule les normales lisses.
- **Simplification.** Un mesh de plus de 60 000 triangles est simplifié à 50 000 au plus (simplificateur de meshoptimizer, déjà en dépendance), avec une erreur relative de 1 % au plus. En pratique, cela concerne les glandes mammaires.
- **Fichiers.** Les fichiers par kind de BodyParts3D sont inchangés et partagés par les deux modèles. Les instances HRA vont dans des fichiers `female-<kind>.<sha8>.glb`.
- **Manifeste.**
  - `models.male` et `models.female` listent les kinds (et donc les fichiers) de chaque modèle, avec leur taille totale.
  - Une instance masquée dans le modèle féminin reste dans le fichier partagé, et le viewer ne l'affiche pas.

### Viewer et interface (`app`)

- **Sélecteur.** Le sélecteur « Modèle : Homme / Femme » est placé dans l'en-tête et encodé dans l'URL (`sex=f` ; absent = homme). Changer de modèle :
  1. recharge l'atlas du modèle ;
  2. charge les fichiers manquants ;
  3. reconstruit les batches ;
  4. garde la caméra, la langue, les couches et les coupes ;
  5. garde la sélection si le slug existe dans le nouvel atlas, et sinon l'efface et l'annonce (« Le fémur… » / « La prostate n'existe pas dans le modèle féminin »).
- **Encart d'explication** dans le modèle féminin, sous l'en-tête, refermable, avec un lien « En savoir plus » qui ouvre une boîte de dialogue. Texte : « Modèle féminin v1 : organes féminins (Human Reference Atlas) sur le squelette et les muscles du modèle masculin (BodyParts3D). Pas de peau. Le bassin et la musculature ne sont pas des références féminines. »
- **Recherche, arbre, panneau.** Ils ne portent que sur les structures du modèle affiché.
- **Attributions.** La barre d'état affiche celles du modèle affiché. Le panneau « Hors ligne » liste les DOI HRA du modèle féminin.
- **Offline.**
  - `offlineStatus` reçoit la liste des fichiers d'un modèle.
  - Le panneau propose « Rendre disponible hors ligne : ce modèle » et « les deux modèles ».
  - Le nettoyage du service worker conserve les fichiers des deux modèles.

### Ordre de livraison

1. Modèle de données : `sex`, `variants`, compilation par modèle, source `hra`.
2. `hra-fetch` et `hra-register`, avec saisie et relecture des repères.
3. `importHra` et l'extension de la requête Wikidata. Génération et commit des YAML féminins.
4. Assets HRA (recalage, simplification, fichiers et manifeste par modèle).
5. Viewer et interface : sélecteur, encart, offline par modèle. Tests de fumée.

## Testing decisions

- **`compileAtlas`** (répertoires de fixtures) :
  - atlas par modèle (structures, `meshIndex`, attributions) ;
  - `hidden` ;
  - variantes de meshes ;
  - `mesh-unique` par modèle ;
  - `variant-shape` ;
  - enfants d'une structure masquée rattachés au premier ancêtre présent.
- **`importHra`** sur un petit GLB de fixture écrit par le test (quelques nœuds avec `extras.ontologyid`) et une table de correspondance minimale :
  - structures féminines, regroupement gauche/droite ;
  - identifiants et arbitrages ;
  - variantes ajoutées à des structures existantes ;
  - `sex: male` posé ;
  - fusion non destructive (labels relus intacts, idempotence).
- **Recalage** (fonctions pures) :
  - ajustement d'Umeyama sur des points synthétiques (transformation connue retrouvée, écart résiduel calculé) ;
  - composition base × région ;
  - échec au-delà du seuil RMS.
- **`buildAssets`** sur une fixture HRA :
  - transformations appliquées (sommets attendus) ;
  - simplification au-delà du seuil ;
  - fichiers `female-*` ;
  - manifeste `models`.
- **Test de fumée du modèle féminin** (Playwright, WebGPU) :
  - `?sex=f` charge sans erreur ;
  - la recherche « utérus » sélectionne une structure féminine ;
  - « prostate » ne donne aucun résultat ;
  - la bascule vers Homme garde une sélection partagée (fémur) et annonce la disparition d'une structure féminine ;
  - l'encart est visible et refermable.
- **Test de fumée offline** : le choix « les deux modèles » rend les deux modèles disponibles, et le modèle féminin recharge hors ligne.

## Global constraints

- Aucune nouvelle dépendance d'exécution. Le simplificateur vient de `meshoptimizer` (déjà présent), l'ajustement est codé dans le projet.
- Version HRA figée : v2.5 (2026-06-15), une version d'organe par fichier dans `hra-files.yaml`, avec sha256.
- Aucun fichier HRA brut dans le dépôt ; seuls les dérivés de build sont publiés, et seulement après la confirmation de licence DBCLS pour la partie BodyParts3D.
- Recalage : écart RMS de 25 mm au plus par région, consigné dans `hra-registration.yaml`.
- Poids du modèle féminin, fichiers propres seulement : moins de 15 MB après meshopt. Chaque mesh simplifié compte 50 000 triangles au plus.
- Budgets inchangés sur ordinateur (chargement complet en moins de 3 s par modèle) et sur mobile (spec 2).
- Tous les nouveaux labels sont en `draft`. Interface en français, chaînes dans `strings.ts`. RGAA 4.1.2 pour le sélecteur, l'encart et la boîte de dialogue.

## Out of scope

- Morphologie féminine réelle : bassin, volumes musculaires, peau (TotalSegmentator, segmentation).
- Vulve, urètre féminin, plancher pelvien féminin : absents du HRA.
- Organes HRA partagés autres que la vessie et le rectum (cœur, poumons, reins…) : le modèle féminin garde ceux de BodyParts3D.
- Placenta, grossesse.
- Seins sur peau : seules les glandes mammaires sont montrées.
- Comparaison côte à côte des deux modèles.

## Further notes

- Les mesures de la recherche montrent qu'une échelle unique pour tout le corps est impossible : la taille donne ×1,037, le bassin ×0,932. La région pelvienne laisse 15 mm d'écart RMS (29 mm au promontoire), ce qui traduit une vraie différence de forme entre les deux bassins.
- Les fichiers par organe du HRA partagent un même repère corporel, dont l'origine est proche de la symphyse pubienne. Ils se chargent donc en place, sans recomposition.
- Sur 1 438 structures, 98 identifiants FMA du HRA correspondent déjà à notre jeu. Aucune structure n'a encore `ids.uberon` : l'import en remplira.
- Les incohérences du HRA relevées (ligaments ronds inversés dans le corps complet, identifiants des ovaires, métadonnées de version de l'utérus) seront signalées à l'équipe HRA. Le mail est à envoyer par l'utilisateur.
