# Modèle de données « anatomy as code »

Vocabulaire : voir `CONTEXT.md` (Structure, Slug, Latéralité, Côté, Parent, Kind, Région, Couche, Label, Statut de revue, Genre grammatical, Mesh, Source, Référence externe). Décision structurante : ADR 0001 (une structure canonique, ses côtés comme instances).

## Problem statement

La connaissance anatomique de l'atlas (quelles structures existent, comment elles s'appellent en français, anglais et latin, comment elles s'emboîtent, à quelle profondeur elles se trouvent, quelle géométrie les illustre) n'existe aujourd'hui que dispersée dans des sources tierces : listes BodyParts3D, FMA, Wikidata. Le spike de rendu la reconstruit à la volée par heuristiques (classe de matériau devinée par mots-clés, noms anglais FMA seulement, pas de latéralité, pas de français). On ne peut ni la relire, ni la corriger, ni la traduire, ni la versionner, ni l'attribuer correctement. Le viewer, le pipeline d'assets et les contributeurs n'ont pas de référence commune.

## Solution

Chaque structure anatomique est décrite par un fichier YAML lisible, rangé par kind, validé par un JSON Schema et par des règles inter-fichiers, puis compilé en un unique `atlas.json` que le viewer et le pipeline d'assets consomment. Les sources externes sont décrites une fois dans un registre avec leur licence et leur crédit. Un import initial génère environ 2 000 fichiers à partir de BodyParts3D 4.0 et de Wikidata ; ensuite les fichiers YAML font autorité et un import relancé ne fait que compléter ce qui n'a pas été relu. Les contributeurs corrigent les données par des diffs ordinaires ; la validation dit précisément ce qui ne va pas.

## User stories

### Contributeur (anatomiste, traducteur)

1. En tant que contributeur, je veux qu'une structure tienne dans un seul fichier nommé par son slug, afin de la trouver et de la modifier sans outil spécialisé.
2. En tant que contributeur, je veux que les deux côtés d'une structure bilatérale partagent un seul fichier, afin de ne traduire et corriger « fémur » qu'une fois.
3. En tant que traducteur, je veux voir pour chaque label sa provenance et son statut (`draft` ou `reviewed`), afin de savoir quels noms il reste à vérifier.
4. En tant que traducteur, je veux passer un label à `reviewed` et avoir la garantie qu'aucun import ne l'écrasera, afin que mon travail de relecture soit définitif.
5. En tant que traducteur, je veux renseigner le genre grammatical (et le nombre) d'un label français ou latin, afin que « droit / droite » et *dexter / dextra / dextrum* soient accordés automatiquement.
6. En tant que traducteur, je veux pouvoir surcharger le nom latéralisé d'un côté quand la composition automatique est fausse, afin de corriger un cas irrégulier sans casser la règle générale.
7. En tant qu'anatomiste, je veux corriger le kind, le parent, les régions, la latéralité ou la couche d'une structure et marquer la structure `reviewed`, afin que l'import ne revienne pas sur ces corrections.
8. En tant qu'anatomiste, je veux séparer deux structures que l'import a fusionnées à tort comme côtés gauche/droit (oreillettes, artères coronaires), afin que le modèle reflète l'anatomie réelle.
9. En tant que contributeur, je veux renommer une structure en conservant son ancien slug comme alias, afin de ne casser aucun lien profond existant.
10. En tant que contributeur, je veux lancer une seule commande qui me liste toutes les erreurs (fichier, chemin dans le fichier, règle, message), afin de tout corriger en un passage.
11. En tant que contributeur, je veux que les avertissements (label sans genre, structure sans parent, absence de français) soient distingués des erreurs, afin de savoir ce qui bloque et ce qui relève de la curation.
12. En tant que contributeur, je veux que mes commentaires YAML et l'ordre de mes clés survivent à un import relancé, afin que mes notes de curation ne disparaissent pas.

### Mainteneur

13. En tant que mainteneur, je veux générer l'ensemble initial des fichiers depuis BodyParts3D et Wikidata en une commande, afin de ne pas saisir 2 000 structures à la main.
14. En tant que mainteneur, je veux qu'un import relancé sur des données inchangées ne produise aucun diff, afin de pouvoir le relancer sans crainte.
15. En tant que mainteneur, je veux qu'un import ne supprime jamais un fichier, même si le concept a disparu de la source, mais qu'il me le signale, afin de décider moi-même.
16. En tant que mainteneur, je veux un rapport d'import (structures créées, complétées, ignorées, conflits de repli gauche/droite, slugs en collision, meshes sans propriétaire), afin de prioriser la curation.
17. En tant que mainteneur, je veux que la validation échoue avec un code de sortie non nul dès qu'il y a une erreur, afin de la brancher en CI.
18. En tant que mainteneur, je veux décrire chaque source une seule fois (version, licence, crédit, URL, motif des identifiants de mesh), afin que l'attribution soit générée et jamais oubliée.

### Développeur du viewer et du pipeline d'assets

19. En tant que développeur du viewer, je veux un unique `atlas.json` déterministe, afin de ne dépendre que d'un fichier et d'avoir des diffs stables.
20. En tant que développeur du viewer, je veux pour chaque mesh l'index inverse vers la structure et le côté, afin de transformer un picking en structure nommée sans heuristique.
21. En tant que développeur du viewer, je veux la couche déjà résolue (défaut du kind ou surcharge), afin d'implémenter le slider de dissection sans connaître les règles.
22. En tant que développeur du viewer, je veux les noms latéralisés déjà composés dans chaque langue, afin de ne pas réimplémenter l'accord grammatical.
23. En tant que développeur du viewer, je veux les enfants de chaque structure en plus du parent, afin de construire l'arbre de navigation sans recalcul.
24. En tant que développeur du pipeline d'assets, je veux que chaque fichier mesh BodyParts3D appartienne à exactement une structure ou à un côté, afin de nommer les nœuds GLB par `slug` ou `slug@left` / `slug@right`.

### Réutilisateur des données

25. En tant que réutilisateur, je veux que la couche sémantique soit sous CC BY 4.0 avec un crédit clair, séparée de la licence des meshes, afin de savoir ce que j'ai le droit de faire de chacune.
26. En tant que réutilisateur, je veux les références externes (FMA, TA2, TA98, UBERON, Wikidata) de chaque structure et de chaque côté, afin de croiser l'atlas avec d'autres ressources.

## Implementation decisions

### Organisation des données

- Données sémantiques : un fichier par structure, au chemin `data/structures/<kind>/<slug>.yaml`. Le dossier doit égaler le champ `kind`, le nom de fichier doit égaler le champ `slug`.
- Registre des sources : un fichier par source dans `data/sources/<id>.yaml`. Sources initiales : `bodyparts3d`, `fma`, `wikidata`.
- La couche `data/structures` et `data/sources` est publiée sous CC BY 4.0 (fichier de licence dans `data/`). Les meshes restent sous la licence de leur source, déclarée dans le registre.
- Les fichiers bruts BodyParts3D restent hors dépôt (`data/raw/`, déjà ignoré).

### Forme d'une structure

Schéma JSON draft 2020-12, `additionalProperties: false` à tous les niveaux. Forme cible :

```yaml
slug: biceps-brachii             # requis, ^[a-z0-9]+(-[a-z0-9]+)*$, ≤ 120 caractères
kind: muscle                     # requis, vocabulaire fermé ci-dessous
laterality: bilateral            # requis : bilateral | midline | unpaired-left | unpaired-right
status: draft                    # requis : draft | reviewed (porte sur tous les champs hors labels)
parent: muscles-of-arm           # optionnel, slug canonique d'une autre structure
regions: [upper-limb, arm]       # optionnel, vocabulaire fermé, sans doublon
layer: 2                         # optionnel, entier ≥ 0, surcharge le défaut du kind
aliases: []                      # optionnel, anciens slugs
labels:                          # requis, au moins `en`
  en: { text: biceps brachii, source: fma, status: draft }
  fr: { text: muscle biceps brachial, gender: m, number: sg, source: wikidata, status: draft }
  la: { text: musculus biceps brachii, gender: m, source: wikidata, status: draft }
ids: { fma: 37670, ta2: 2463, ta98: A04.6.02.013, uberon: "0001507", wikidata: Q190521 }  # optionnel
sides:                           # requis si bilateral, interdit sinon
  left:
    ids: { fma: 37672 }
    meshes: [bp3d:FJ1234M]
    labels: { fr: { text: muscle biceps brachial gauche, source: curated, status: reviewed } }   # surcharge optionnelle
  right: { ids: { fma: 37671 }, meshes: [bp3d:FJ1234] }
# meshes: [bp3d:FJ3259]          # à la racine si non bilateral ; interdit si bilateral
```

(Identifiants de l'exemple illustratifs.)

- **Kind** (vocabulaire fermé, avec couche par défaut) : `skin` 0, `fascia` 1, `muscle` 2, `tendon` 2, `ligament` 3, `artery` 3, `vein` 3, `lymphatic` 3, `nerve` 3, `organ` 4, `cns` 4, `cartilage` 5, `joint` 5, `bone` 5, `group` (pas de couche). `group` désigne un regroupement hétérogène sans mesh propre (« human body », « body wall ») et interdit `meshes` et `layer`.
- **Régions** (vocabulaire fermé) : `head`, `neck`, `thorax`, `abdomen`, `pelvis`, `back`, `upper-limb`, `lower-limb`, et sous-régions `arm`, `forearm`, `hand`, `thigh`, `leg`, `foot`.
- **Label** : `text` requis ; `source` requis, égal à l'id d'une source du registre ou à `curated` ; `status` requis (`draft | reviewed`) ; `gender` (`m | f` en fr, `m | f | n` en la) ; `number` (`sg | pl`, défaut `sg`) ; `synonyms` (liste de chaînes) optionnel ; `description` (chaîne) optionnelle, prévue mais non remplie. `gender` est interdit pour `en`.
- **Références externes** (`ids`, à la racine et dans chaque côté) : `fma` entier, `ta2` entier, `ta98` `^A\d{2}\.\d\.\d{2}\.\d{3}[A-Z]?$`, `uberon` chaîne `^\d{7}$`, `wikidata` `^Q\d+$`. Toutes optionnelles.
- **Référence de mesh** : `<préfixe>:<id>`, préfixe déclaré par une source du registre, id conforme au motif déclaré par cette source (`bodyparts3d` : préfixe `bp3d`, motif `^FJ\d+M?$`).
- Une structure sans mesh propre (meshes absents) est illustrée par les meshes de ses descendants.

### Forme d'une source

`id`, `name`, `version`, `url`, `licence` (identifiant SPDX), `attribution` (texte de crédit), `provides` (sous-ensemble de `meshes | labels | ids`), `meshPrefix` et `meshPattern` (requis si `provides` contient `meshes`), `notes` optionnel. La source `bodyparts3d` porte en note l'incohérence de licence entre la page DBCLS (CC BY 4.0) et les en-têtes OBJ (CC BY-SA 2.1 JP).

### Module de compilation

Interface unique : `compileAtlas(dataDir) → { atlas, errors, warnings }`. Ne lève jamais d'exception pour une donnée invalide ; collecte tout. Chaque diagnostic : `{ file, pointer (JSON Pointer), rule, message, severity }`.

Règles, dans l'ordre :

1. YAML illisible → erreur `yaml-parse` ; le fichier est écarté des règles suivantes.
2. JSON Schema par fichier → erreurs `schema`.
3. Dossier ≠ kind → `kind-folder` ; nom de fichier ≠ slug → `slug-filename`.
4. Slugs et alias uniques dans l'ensemble (un alias ne peut égaler aucun slug ni autre alias) → `slug-unique`.
5. `parent` doit désigner un slug existant ; s'il désigne un alias, erreur avec le slug canonique en indice → `parent-exists`.
6. Pas de cycle dans les parents → `parent-cycle`.
7. Cohérence latéralité : `bilateral` ⇔ `sides.left` et `sides.right` présents et `meshes` absent à la racine ; sinon `sides` interdit → `laterality-shape`. (Le schéma l'exprime ; la règle existe pour un message lisible.)
8. Préfixe de mesh connu et id conforme au motif de la source → `mesh-ref`.
9. Chaque référence de mesh apparaît une seule fois dans l'ensemble → `mesh-unique`.
10. Chaque identifiant FMA apparaît une seule fois dans l'ensemble (racines et côtés) → `fma-unique`.
11. Source d'un label connue du registre ou `curated` → `label-source`.
12. Label fr ou la au statut `reviewed` sans `gender` → erreur `label-gender`. Au statut `draft` → avertissement `label-gender`.

Avertissements supplémentaires (n'échouent pas) : structure sans parent hors racine `human-body` (`orphan`) ; structure sans label `fr` (`missing-fr`) ; structure sans label `la` (`missing-la`).

`atlas` (seulement si aucune erreur) :

- `sources` : le registre, indexé par id.
- `structures` : liste triée par slug ; chaque entrée reprend les champs du fichier, plus `layer` résolu (surcharge, sinon défaut du kind, sinon `null` pour `group`), `children` (slugs triés), et pour chaque côté `labels` composés dans chaque langue présente.
- `meshIndex` : objet `{ "<ref>": { slug, side } }`, `side` valant `left`, `right` ou `null`.
- `attributions` : une entrée par source effectivement utilisée (meshes ou labels).
- Aucune date ni chemin absolu dans la sortie : deux compilations des mêmes fichiers produisent des octets identiques.

### Composition des noms latéralisés

Fonction pure, appelée par le compilateur, testée seule : `composeSideLabel(label, lang, side) → string`.

- `en` : `left <text>` / `right <text>`.
- `fr` : `<text> gauche` (sg) / `<text> gauches` (pl) ; `<text> droit | droite | droits | droites` selon `gender` et `number`.
- `la` : `<text>` suivi de `sinister | sinistra | sinistrum` ou `dexter | dextra | dextrum` selon `gender` ; au pluriel `sinistri | sinistrae | sinistra`, `dextri | dextrae | dextra`.
- Label sans `gender` en fr ou la : composition au masculin singulier, et l'avertissement `label-gender` existe déjà.
- Une surcharge `sides.<side>.labels.<lang>` l'emporte toujours sur la composition.

### Module d'import BodyParts3D + Wikidata

Interface : `importBp3d({ bp3dDir, wikidataCsv, dataDir, overrides }) → report`. Entrées : listes BodyParts3D 4.0 (`*_parts_list_e.txt`, `*_element_parts.txt`, `*_inclusion_relation_list.txt`) et l'export CSV de la requête SPARQL du spike Wikidata (FMA → QID, TA2, TA98, labels fr/la/en). `overrides` est un fichier YAML maintenu à la main dans `data/import/` (liste de non-repli, arbitrages d'égalité, slugs forcés).

Algorithme :

1. **Candidats** : tous les concepts de l'arbre *part of*, plus tout concept *is a* qui possède au moins un mesh en propre (étape 2). Les classes abstraites *is a* sans mesh propre (« variant artery », « zone of bone organ ») ne deviennent pas des structures.
2. **Propriété des meshes** : chaque fichier FJ appartient au candidat le plus spécifique qui le contient (le moins d'éléments). Égalités, dans l'ordre : concept ayant un TA2 ou TA98 dans Wikidata ; puis ayant un label fr ; puis feuille de l'arbre *is a* ; puis plus petit numéro FMA ; un arbitrage explicite de `overrides` passe avant tout. Les perdants sans autre mesh propre et hors arbre *part of* ne deviennent pas des structures. Résultat attendu : chacun des 2 234 fichiers a exactement un propriétaire.
3. **Repli de latéralité** (révisé le 2026-11-08 à la demande de l'utilisateur) :
   - **Quels noms sont concernés.** Un nom contenant exactement un mot de côté (`left` ou `right`, en mot entier, à n'importe quelle position) est un côté de la structure canonique dont le nom est le reste du nom. Exemples : « left femur » → « femur » ; « long head of left biceps brachii » → « long head of biceps brachii ».
   - **Paire complète.** Le repli n'a lieu que si les deux côtés existent : la structure est alors `bilateral`.
   - **Côté seul.** Le concept garde son nom complet. Il devient `unpaired-left` ou `unpaired-right` si le mot de côté est en tête du nom, `midline` sinon (« superior lobe of left lung »).
   - **Liste de non-repli.** Elle s'applique au nom canonique lui-même, ou à la fin du nom après « of » : `ventricle` exclut aussi « anterior wall of ventricle », mais pas « lateral ventricle ».
     - Liste initiale : `atrium`, `ventricle`, `auricle`, `coronary artery`, `gastric artery`, `gastric vein`, `colic artery`, `colic vein`, `hepatic duct`, `hepatic vein`, `lobe of liver`.
   - **Concept canonique déjà candidat.** Si le concept canonique (« femur ») est lui-même un candidat, il fusionne avec la structure repliée. Il en apporte le FMA racine, et ses meshes propres vont au côté dont le concept les contient.
   - **Nom anglais du côté.** Quand le mot de côté est au milieu du nom, le nom FMA du côté devient la surcharge anglaise de ce côté (`sides.<côté>.labels.en`), parce que la composition mettrait le mot de côté en tête.
4. **Identifiants** : FMA du concept canonique s'il existe dans BodyParts3D, sinon de l'item Wikidata dont le label anglais égale le nom canonique, sinon absent ; FMA de chaque côté depuis son concept. TA2, TA98, QID depuis Wikidata (canonique d'abord).
5. **Slug** : nom anglais FMA du concept canonique (nom BodyParts3D), en kebab-case ASCII. Collision → suffixe `-fma<id>` et ligne dans le rapport. Un slug forcé dans `overrides` l'emporte.
6. **Labels** : `en` depuis le nom FMA (`source: fma`). `fr` et `la` depuis le label Wikidata de l'item canonique (`source: wikidata`). Tous en `draft`. Genre et nombre déduits du premier mot par une table fermée, avec formes singulier et pluriel explicites :
   - fr, masculin : muscle(s), nerf(s), os, ligament(s), tendon(s), cartilage(s), ganglion(s), rameau(x), lobe(s) ;
   - fr, féminin : artère(s), veine(s), glande(s), vertèbre(s), côte(s), articulation(s), phalange(s) ;
   - la, masculin : musculus / musculi, nervus / nervi, ramus / rami, lobus / lobi ;
   - la, féminin : arteria / arteriae, vena / venae, vertebra / vertebrae, costa / costae, glandula / glandulae, cartilago / cartilagines, phalanx / phalanges ;
   - la, neutre : os / ossa, ligamentum / ligamenta.

   « os » ne permet pas de distinguer singulier et pluriel en français : il est traité comme singulier. Si le premier mot n'est pas dans la table, `gender` et `number` restent absents.
7. **Kind** : on reprend la classification du spike. On teste des mots-clés sur le nom, puis sur les ancêtres *is a* en largeur d'abord, et la première règle qui correspond l'emporte. Ordre des règles :
   1. `skin` : `^skin$`, `integument` ;
   2. `cartilage` : cartilage, disque intervertébral, symphyse, ménisque ;
   3. `fascia` : fascia, aponeurosis, retinaculum ;
   4. `ligament` : ligament ;
   5. `tendon` : tendon ;
   6. `joint` : `joint`, `articulation` ;
   7. `bone` : liste du spike ;
   8. `muscle` : liste du spike, sans `tendon` ;
   9. `artery` ;
   10. `vein` ;
   11. `lymphatic` : `lymph` ;
   12. `cns` : brain, cerebr, cerebell, spinal cord, gyrus, sulcus, thalam, colliculus, pons, medulla, ventricle of brain, lateral ventricle ;
   13. `nerve` : nerve, ganglion, plexus ;
   14. `organ` par défaut.

   Exception : un candidat sans mesh propre dont les descendants ont au moins deux kinds différents devient `group`.
8. **Parent** : parent *part of* du concept, replié sur sa structure canonique ; si ce parent n'est pas une structure, on remonte. Les deux côtés désignent des parents canoniques différents → on garde celui du côté gauche et on le signale. Concept hors arbre *part of* → pas de parent (avertissement `orphan`).
9. **Régions** : on prend les noms des ancêtres *part of* du concept, privés de leur mot de côté en tête, et on les fait correspondre par égalité exacte avec cette table : `head` → head ; `neck` → neck ; `thorax` → thorax ; `abdomen` → abdomen ; `pelvis`, `bony pelvis` → pelvis ; `back of neck`, `back of thorax`, `back of abdomen` → back ; `upper limb`, `free upper limb` → upper-limb ; `lower limb`, `free lower limb` → lower-limb ; `arm` → arm ; `forearm` → forearm ; `hand` → hand ; `thigh` → thigh ; `leg` → leg ; `foot` → foot. Une sous-région ajoute aussi sa région (arm, forearm, hand → upper-limb ; thigh, leg, foot → lower-limb). Si aucun ancêtre n'est reconnu, la structure n'a pas de régions. Une même structure peut recevoir plusieurs régions ; elles sont triées.
10. **Statut** : `status: draft` sur toute structure créée.

Règles de fusion avec des fichiers existants (le YAML fait autorité) :

- Fichier absent → création.
- Structure `reviewed` → seuls les labels absents sont ajoutés ; rien d'autre ne change.
- Structure `draft` → les champs non-label sont recalculés ; un label `reviewed` n'est jamais modifié ; un label `draft` est mis à jour ; un label absent est ajouté.
- Commentaires et ordre des clés existants préservés (API Document de la bibliothèque `yaml`).
- Jamais de suppression ; un fichier dont le concept n'existe plus dans la source est listé dans le rapport.
- Idempotence : deux imports successifs sur les mêmes entrées → aucun changement d'octet.

Rapport : compteurs (créées, mises à jour, inchangées, ignorées), conflits de parent au repli, collisions de slug, égalités de propriété arbitrées, meshes sans propriétaire, fichiers orphelins de source.

### Interface en ligne de commande

Trois commandes, exposées par le paquet outils de l'atlas : `validate` (compile, affiche `fichier:pointeur règle message`, code de sortie 1 si erreur), `build` (compile et écrit `atlas.json`, refuse d'écrire si erreur), `import-bp3d` (lance l'import puis la validation, affiche le rapport).

### Ordre de livraison

1. Schémas, registre des sources, `composeSideLabel`, `compileAtlas`, commandes `validate` et `build`, avec fixtures écrites à la main.
2. `importBp3d`, commande `import-bp3d`, fichier `overrides`, puis génération réelle du jeu de données et commit des YAML produits.

## Testing decisions

- **Deux points de test** : `compileAtlas(dataDir)` sur des répertoires de fixtures, et `importBp3d(...)` sur un extrait réduit des fichiers BodyParts3D et du CSV Wikidata versionné dans les fixtures. `composeSideLabel` est testé directement (table de cas fr/la/en × genre × nombre × côté) parce que c'est une règle linguistique dense.
- **Compilation** : une fixture valide (structure bilatérale, midline, unpaired, group, alias, surcharge de label de côté) dont on vérifie l'`atlas` produit (couche résolue, `children`, `meshIndex`, labels composés, attributions) ; une fixture par règle cassée, en vérifiant `rule`, `file` et `pointer` du diagnostic, pas le texte du message ; une vérification de déterminisme (deux compilations, octets identiques).
- **Import** : sur l'extrait, vérifier repli bilatéral, non-repli de la liste, unpaired, mot de côté interne non replié, arbitrage d'égalité, propriété unique des meshes, slug en collision ; puis sur fichiers existants : label `reviewed` intact, structure `reviewed` intacte hors labels absents, commentaire préservé, idempotence (deuxième import = zéro diff), pas de suppression. Toute sortie d'import passe `compileAtlas` sans erreur.
- **Contrôle sur données réelles** (hors suite unitaire, une fois après génération) : les 2 234 meshes ont un propriétaire unique, `validate` passe, rapport de couverture fr/la consigné.
- Pas d'antécédent de test dans le dépôt (les spikes n'en ont pas) ; `spikes/viewer/scripts/lib/bp3d.mjs` sert de référence pour la lecture des listes BodyParts3D et la classification, à réécrire et non à importer.

## Global constraints

- Node ≥ 24, TypeScript exécuté directement par Node (suppression de types native), modules ES.
- Dépendances d'exécution limitées à `yaml` (2.x) et `ajv` (8.x, mode draft 2020-12) ; tests avec `node:test`.
- JSON Schema draft 2020-12, `additionalProperties: false` partout.
- Slugs : `^[a-z0-9]+(-[a-z0-9]+)*$`, 120 caractères maximum, ASCII uniquement.
- YAML écrit en UTF-8, indentation 2 espaces, ordre des clés de structure : `slug, kind, laterality, status, parent, regions, layer, aliases, labels, ids, sides, meshes`.
- `atlas.json` déterministe : clés et listes triées, sans horodatage ni chemin absolu.
- Validation complète du jeu réel (environ 2 000 fichiers) en moins de 5 s sur la machine de développement.
- Couche sémantique sous CC BY 4.0 ; aucun texte copié de Wikipédia ; aucun export de jeu TA2 reformaté (seuls les identifiants TA2 sont stockés).

## Out of scope

- Quiz (retirés du projet).
- Relations anatomiques : innervation, vascularisation, origine, insertion, action.
- Définitions textuelles (le champ `description` existe, vide).
- Modèle féminin, attribut `sex`, sources HRA.
- Export JSON-LD, conversion LinkML.
- Remplissage des parents depuis l'OWL FMA 5.1.0 pour les structures hors arbre *part of* de BodyParts3D.
- Couches de dissection par région (une couche par structure suffit).
- Migration du spike viewer et du script d'assets vers `atlas.json` et le nommage `slug@side`.
- Branchement CI (le dépôt n'est pas encore sous git) ; la commande `validate` est prête à y être branchée.
- Licence du code (seule la licence des données est fixée ici).

## Further notes

- Écart assumé avec la décision « slug = anglais TA2 » : TA2 n'existe pas sous forme ouverte lisible par machine (rapport de choix techniques), donc le slug dérive du nom anglais FMA, très proche de TA en pratique. Les alias permettent de réaligner plus tard sans casser de lien.
- Chiffres mesurés sur BodyParts3D 4.0 : 3 432 concepts ; 1 507 concepts à mesh unique couvrent 1 352 des 2 234 fichiers, les 882 restants n'appartiennent qu'à des regroupements (d'où la propriété « candidat le plus spécifique ») ; 106 fichiers sont revendiqués par plusieurs concepts à mesh unique (d'où l'arbitrage) ; l'arbre *part of* n'a qu'un parent par concept et une seule racine (`human body`, FMA20394) ; 763 concepts à mesh unique n'ont qu'un parent *is a* (orphelins attendus).
- Le repli `left`/`right` en tête de nom donne environ 1 990 structures canoniques ; la liste de non-repli est un point de départ, la curation l'allongera.
- La latéralité `unpaired-left` / `unpaired-right` ne peut pas être déduite pour une structure nommée sans mot de côté (rate, foie) : l'import la met en `midline`, la curation corrige.
- Licence BodyParts3D à confirmer par écrit auprès du DBCLS avant toute publication d'assets dérivés.
