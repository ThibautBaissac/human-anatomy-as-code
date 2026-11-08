# Human Anatomy As Code

Atlas 3D d'anatomie humaine dont la connaissance anatomique (noms, identifiants, hiérarchie, couches) est décrite sous forme de fichiers versionnés, séparés de la géométrie qui l'illustre.

## Structures

**Structure** :
Entité anatomique canonique, indépendante du côté : « fémur », « muscle biceps brachial ». Une structure bilatérale reste une seule structure, et ses deux côtés en sont des instances.
_Avoid_ : concept, part, élément, organe (au sens générique)

**Slug** :
Identifiant primaire d'une structure : terme anglais TA2 en kebab-case ASCII (`biceps-brachii`). Immuable une fois publié ; un ancien slug survit comme alias.
_Avoid_ : id, key, nom

**Latéralité** :
Distribution d'une structure par rapport au plan médian : `bilateral` (deux côtés), `midline` (une seule instance, traversée par le plan médian), `unpaired-left` ou `unpaired-right` (une seule instance, d'un côté : rate, foie).
_Avoid_ : symétrie, parité

**Côté** :
Instance gauche ou droite d'une structure bilatérale, qui porte ses propres identifiants externes et sa propre géométrie. Le côté est toujours celui du sujet, jamais celui de l'observateur.
_Avoid_ : variante, instance latéralisée, structure gauche / droite

**Repli** :
Opération d'import qui regroupe deux concepts sources « left X » et « right X » en une seule structure X avec deux côtés. Certaines paires sont exclues, parce que leurs deux membres sont des structures distinctes et non deux côtés : les oreillettes, les artères coronaires. Dans le code, qui est en anglais, le terme est *fold* (`noFold`).
_Avoid_ : fusion, dédoublonnage

**Groupe** :
Structure de kind `group` : un regroupement de structures de natures différentes, sans mesh propre, par exemple « paroi du corps ».
_Avoid_ : ensemble, système, catégorie

**Parent** :
Structure dont celle-ci fait partie (relation *part of*, un seul parent). Sert à la navigation et à la sélection par groupe.
_Avoid_ : catégorie, groupe, ancêtre

**Kind** :
Nature tissulaire d'une structure dans un vocabulaire court et fermé (bone, muscle, artery…). Détermine l'apparence par défaut et la couche par défaut.
_Avoid_ : type, classe, catégorie, système

**Région** :
Zone topographique du corps (membre supérieur, tête et cou…) à laquelle une structure est rattachée ; une structure peut appartenir à plusieurs régions.
_Avoid_ : zone, partie du corps

**Couche** :
Profondeur de dissection d'une structure, entier croissant de la peau (0) vers l'os. Dérivée du kind sauf surcharge explicite.
_Avoid_ : niveau, profondeur, layer d'affichage

## Noms

**Label** :
Nom d'une structure dans une langue (fr, en, la), avec sa provenance, son statut de revue et son genre grammatical.
_Avoid_ : traduction, titre, nom affiché

**Statut de revue** :
`draft` pour une donnée importée ou non vérifiée, `reviewed` pour une donnée validée par un humain. Il existe à deux niveaux : chaque label a le sien, et la structure en a un pour tous ses autres champs. Un import ne modifie jamais ce qui est `reviewed`.
_Avoid_ : validé, état

**Genre grammatical** :
Genre du terme d'un label (fr : m / f ; la : m / f / n), qui sert à accorder le qualificatif de côté (« droit » / « droite », *dexter* / *dextra* / *dextrum*).
_Avoid_ : sexe, gender

## Géométrie et provenance

**Mesh** :
Géométrie 3D qui illustre un côté (ou une structure non bilatérale), référencée par un identifiant préfixé par sa source (`bp3d:FJ1234`). Une structure sans mesh propre est illustrée par les meshes de ses descendants.
_Avoid_ : modèle, objet, asset

**Source** :
Jeu de données externe d'où proviennent des meshes ou des noms (BodyParts3D, Wikidata…), décrit une fois avec sa version, sa licence et son crédit d'attribution.
_Avoid_ : provider, dataset, origine

**Référence externe** :
Identifiant d'une structure ou d'un côté dans une terminologie tierce (FMA, TA2, TA98, UBERON, Wikidata). La FMA est la référence d'ancrage.
_Avoid_ : mapping, code, xref
