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
_Avoid_ : modèle 3D, objet, asset

**Modèle** :
L'un des deux corps que l'atlas montre : masculin ou féminin. Le modèle féminin v1 réunit des organes féminins (Human Reference Atlas) et le squelette et les muscles du modèle masculin (BodyParts3D).
_Avoid_ : version, variante (au sens du corps), genre

**Sexe** :
Appartenance d'une structure à un seul modèle (champ `sex : male | female`) ; une structure sans sexe appartient aux deux.
_Avoid_ : genre (réservé au genre grammatical)

**Variante** :
Ce qui change pour une structure partagée dans le modèle féminin : d'autres meshes, ou son absence (`variants.female`).
_Avoid_ : version, override, alternative

**Recalage** :
Transformation qui place des meshes d'une autre source dans le repère de BodyParts3D, ajustée par région sur des repères anatomiques.
_Avoid_ : registration (dans la prose française), alignement, calage

## Mouvement

**Articulation** :
Ce qui permet à des os de tourner les uns par rapport aux autres autour d'un axe, décrit dans `data/joints/` : un os fixe, des os mobiles, un mouvement à un degré de liberté (flexion-extension, pronation-supination), une amplitude et un angle de repos. À ne pas confondre avec le kind `joint`, qui désigne des meshes de capsules articulaires.
_Avoid_ : jointure, liaison

**Pose** :
Ensemble des angles articulaires affichés, articulation par articulation et côté par côté. Une articulation absente de la pose est à son angle de repos, celui de BodyParts3D (dans l'interface : « position de repos »).
_Avoid_ : posture

**Rig** :
Pour un côté d'une articulation et un modèle, la liste calculée au build des instances qui tournent avec elle, de celles qui la suivent d'une fraction de l'angle (la patella), de celles qui la franchissent (rendues transparentes pendant le mouvement) et des muscles qui agissent sur elle, avec leur bras de levier.
_Avoid_ : squelette, armature

**Action** :
Rôle d'un muscle dans le mouvement d'une articulation (fléchisseur, extenseur, pronateur, supinateur), porté par le muscle (`actions`).
_Avoid_ : fonction

**Source** :
Jeu de données externe d'où proviennent des meshes ou des noms (BodyParts3D, Wikidata…), décrit une fois avec sa version, sa licence et son crédit d'attribution.
_Avoid_ : provider, dataset, origine

**Référence externe** :
Identifiant d'une structure ou d'un côté dans une terminologie tierce (FMA, TA2, TA98, UBERON, Wikidata). La FMA est la référence d'ancrage.
_Avoid_ : mapping, code, xref
