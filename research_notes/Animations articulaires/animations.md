# Animations articulaires : faits mesurés pour coude, genou et épaule (état au 2026-11-09)

Méthode. Les fichiers `.osim` ont été téléchargés le 2026-11-09 depuis `opensim-org/opensim-models` (branche `master`) et depuis deux miroirs GitHub tiers pour MoBL-ARMS et Holzbaur. Ils ont été lus par des parsers XML écrits pour l'occasion. Les licences ont été lues dans les fenêtres « Use Agreement » des pages SimTK (`simtk.org/projects/<id>`) et dans les balises `<credits>` des fichiers. Nos chiffres de géométrie viennent du décodage des GLB `build/assets/*.glb` du modèle masculin (`@gltf-transform/core` 4.5.1 et `MeshoptDecoder` de meshoptimizer 1.3.0, tous deux dans le `node_modules` racine). Positions en coordonnées monde (matrice monde du nœud appliquée, quantization décodée), en mm, Z vers le haut, +Y postérieur, +X à gauche du sujet. Les scripts et le cache décodé (1 657 instances, 4,2 M sommets) sont restés dans le scratchpad, rien n'a été écrit dans le repo hors de cette note. Ce qui n'a pas été vérifié dans cette session est marqué « à vérifier ».

Conversion OpenSim → notre repère. OpenSim utilise X antérieur, Y haut, Z droite. Pour un membre **gauche** : `ours = (−z, −x, y)` (rotation propre, det = +1). Les longueurs OpenSim sont en mètres, ×1000 pour nos mm.

---

## 1. Modèles OpenSim ouverts : licences exactes et contenu

### 1.1 Licences, fichier par fichier

| Modèle | Où | Licence exacte constatée | CC BY 4.0 en aval ? |
|---|---|---|---|
| **Rajagopal 2016** (full body, 37 DOF) | SimTK `full_body`, paquets « Full Body Model » et « Full Body Model w/Sample Sim. » | **« MIT Use Agreement »** : texte MIT standard, « Copyright (c) 2015, Stanford University ». La copie GitHub `Models/Rajagopal/Rajagopal2016.osim` est « modified from the original distribution » (format OpenSim 4.5, `fiber_damping` 0,1) et le repo `opensim-models` n'a **aucun fichier LICENSE** (`license: null` dans l'API GitHub, README de 386 octets). | **Oui**, si on garde la notice MIT (copyright + permission) avec les données dérivées. |
| RajagopalLaiUhlrich2023 | GitHub `Models/Rajagopal/` ; SimTK `fbmodpassivecal` (Uhlrich 2022) et `model-high-flex` (Lai 2017) | `fbmodpassivecal` : « MIT Use Agreement », © 2020 Stanford University. `model-high-flex` : aucune Use Agreement trouvée sur la page projet (**à vérifier** sur la page de téléchargement). | Oui pour la part Uhlrich ; part Lai à vérifier. |
| **Gait2392** | GitHub `Models/Gait2392_Simbody/` ; distribué avec OpenSim | Aucune licence dans le fichier (credits Delp, Loan, Hoy, Zajac, Topp, Rosen, Thelen, Anderson, Seth). Paquet SimTK `opensim` « OpenSim Models and Examples » : texte CC BY 3.0 (« to make commercial use of the work »), **mais** sa ligne « Notice » renvoie à `creativecommons.org/licenses/by-nc/3.0/`. Contradiction interne. | **Ambigu** : à faire clarifier par l'équipe OpenSim avant tout usage. |
| **Arm26** | GitHub `Models/Arm26/arm26.osim` | Dans `<credits>` du fichier : « License: Creative Commons (CCBY 3.0). You are free to distribute, remix, tweak, and build upon this work, even commercially » ; adapté du modèle de K. Holzbaur. | **Oui** (adaptation sous CC BY 4.0 permise avec attribution). |
| **Hamner 2010** (`FullBodyModel_Hamner2010_v2_0.osim`) | GitHub `Models/Hamner/` ; SimTK `runningsim` paquet « 02 Full Body Model » | « Copyright (C) 2012 Stanford University and the Authors. This work is available under the Creative Commons Attribution License… by/3.0 ». La catégorie SimTK s'appelle « Creative Commons ANC Use Agreement », mais le texte dit BY 3.0. | **Oui** (CC BY 3.0). |
| **Holzbaur 2005** (« Stanford-VA upper limb model ») | SimTK `up-ext-model` ; fichier lu sur un miroir tiers (`hbwangxjtu/OpenSimPY`, format OpenSim 1.9) | « open sourced under the **BSD 3-Clause License** », © 2005 Stanford University et VA Palo Alto HCS, avec obligation de citer Holzbaur et al. 2005. Aucune clause non commerciale (vérifié dans le texte). | **Oui** (BSD-3 : garder la notice et ne pas utiliser les noms pour endosser). |
| **MoBL-ARMS** (Saul 2015) | SimTK `upexdyn` ; fichier lu sur `mitkof6/OpenSimDatabase` | BSD 3-Clause, mais le préambule dit « open sourced **solely for non-commercial purposes** » et « commercial use requires a commercial license ». | **Non** : CC BY 4.0 autorise l'usage commercial, donc incompatible. |
| Logiciel OpenSim | SimTK `opensim` | Apache 2.0 (code). Les modèles « retain their own copyright license, as specified in the individual files ». | Sans objet (code, pas données). |

**Conclusion licence.** Pour publier en CC BY 4.0 des données dérivées (centres, axes, amplitudes, splines de couplage), les sources sûres sont **Rajagopal 2016 (MIT)**, **Holzbaur 2005 (BSD-3)**, **Hamner 2010 et Arm26 (CC BY 3.0)**. Il faut éviter MoBL-ARMS (non commercial) et clarifier Gait2392 (BY ou BY-NC). Bonne nouvelle : les axes de coude et d'avant-bras et le rythme scapulo-huméral de MoBL-ARMS sont **identiques au chiffre près** à ceux de Holzbaur (BSD-3), comparaison faite fichier contre fichier. Holzbaur suffit donc. Des axes et des amplitudes sont probablement des faits non protégeables, mais on garde attribution et notice par prudence (avis non juridique).

### 1.2 Ce que contiennent les fichiers (mesuré)

| Modèle | Format | Articulations bras / genou | Muscles | Path points | Wrapping |
|---|---|---|---|---|---|
| Rajagopal2016 | 40000 (4.x) | `acromial_l` (torso → humérus, 3 DOF, **pas de scapula mobile**), `elbow_l` PinJoint, `radioulnar_l` PinJoint, `radius_hand_l` (verrouillé), `walker_knee_l` CustomJoint couplé, `patellofemoral_l` | 80 Millard2012 (membres inférieurs et tronc) + 17 `CoordinateActuator` : **les bras n'ont aucun muscle** | 288 `PathPoint` | 46 `PathWrap`, 40 `WrapCylinder` |
| Hamner 2010 | 40000 | `acromial_l`, `elbow_l`, `radioulnar_l` (CustomJoint), `knee_l` planaire (Yamaguchi-Zajac) | 92 Thelen2003, membres inférieurs | 288 Path + 26 Conditional + 8 Moving | wrap objects |
| Gait2392 | 40000 | `knee_l` planaire, pas de bras | 92 Thelen2003 | idem Hamner | 13 WrapObjectSet |
| Arm26 | 40000 | `r_shoulder` (1 DOF), `r_elbow` (côté droit seul) | 6 (TRIlong, TRIlat, TRImed, BIClong, BICshort, BRA) | 32 | 2 cylindres, 2 ellipsoïdes |
| Holzbaur 2005 | 10902 (1.9) | sternoclaviculaire, acromioclaviculaire, `shoulder0/1/2`, `elbow`, `radioulnar`, poignet | 22 muscles franchissent le coude (TRI×3, ANC, BIC×2, BRA, BRD, ECRL, ECRB, ECU, FCR, FCU, PL, PT, FDS×2, EDC×4, EDM) | — | — |
| MoBL-ARMS 2016 | 30000 | identique à Holzbaur pour coude, avant-bras et rythme | 50 Schutte1993 | 280 + 23 Moving + 3 Conditional | 122 `PathWrap`, 48 cylindres, 21 ellipsoïdes, 11 tores, 4 sphères |

Le modèle ne fournit les **trajets musculaires** du coude sous une licence permissive que dans Arm26 (6 muscles, CC BY 3.0) et Holzbaur (BSD-3). Rajagopal et Hamner pilotent le bras par des actionneurs de couple. Au genou, 13 muscles ont des points à la fois sur fémur/bassin et sur tibia/patella : Rajagopal `bflh bfsh gaslat gasmed grac recfem sart semimem semiten tfl vasint vaslat vasmed` (MIT), et les mêmes 13 dans Gait2392/Hamner.

Sources : [opensim-models](https://github.com/opensim-org/opensim-models) ; [SimTK full_body](https://simtk.org/projects/full_body) ; [SimTK runningsim](https://simtk.org/projects/runningsim) ; [SimTK up-ext-model](https://simtk.org/projects/up-ext-model) ; [SimTK upexdyn](https://simtk.org/projects/upexdyn) ; [SimTK fbmodpassivecal](https://simtk.org/projects/fbmodpassivecal) ; [SimTK opensim](https://simtk.org/projects/opensim) ; Rajagopal et al., IEEE TBME 63(10):2068-79, 2016, [doi:10.1109/TBME.2016.2586891](https://doi.org/10.1109/TBME.2016.2586891) ; Holzbaur, Murray, Delp, Ann Biomed Eng 33:829-840, 2005 ; Saul et al., CMBBE 18:1445-58, 2015 ; Delp et al., IEEE TBME 37:757-767, 1990 ; Yamaguchi & Zajac, J Biomech 1989.

---

## 2. Centres, axes, amplitudes : coude, genou, épaule

### 2.1 Coude (huméro-ulnaire) et avant-bras (radio-ulnaires)

Définitions OpenSim, valeurs brutes du fichier. Le frame parent est l'humérus, d'origine au centre gléno-huméral (GH).

| Modèle | Centre du coude dans le frame humérus (m) | Axe de flexion (frame humérus) | Amplitude | Axe prono-supination (frame ulna) | Amplitude |
|---|---|---|---|---|---|
| Rajagopal / Hamner (gauche) | (0,013144 ; −0,286273 ; 0,009595) | (−0,226 ; −0,022 ; 0,974) : Rajagopal via `orientation` (0,0228627 ; −0,228018 ; 0,0051689) du frame de PinJoint, Hamner explicite | `elbow_flex_l` 0 → 150° | (−0,0564 ; −0,9984 ; 0,0020), passant par (−0,00673 ; −0,01301 ; −0,02608) | `pro_sup_l` 0 → 90° |
| Holzbaur = MoBL = Arm26 (droit) | (0,0061 ; −0,2904 ; −0,0123) | (0,0494 ; 0,0366 ; 0,9981) | 0 → 130° | (−0,0172 ; 0,9927 ; −0,1197), passant par (0,0004 ; −0,0115 ; 0,0200) | −90 → +90° |

Dans notre repère (membre gauche, pose zéro OpenSim, frames supposés parallèles au sol, convention Delp **à vérifier visuellement**) : axe de flexion Rajagopal = (−0,974 ; 0,226 ; −0,022), soit **13° de rotation dans le plan axial**. Holzbaur miroir = (−0,998 ; 0,049 ; −0,037), soit 2,8°. L'axe de prono-supination Rajagopal = (−0,002 ; 0,056 ; −0,998), quasi vertical. Celui de Holzbaur est incliné de 6,9° dans le plan frontal, ce qui donne une forme d'angle de portage.

Os mobiles. Flexion : ulna, puis radius et main en aval (Rajagopal : `elbow_l` enfant `ulna_l`, `radioulnar_l` enfant `radius_l`, `radius_hand_l` enfant `hand_l`). Prono-supination : **radius et main seuls**, l'ulna reste fixe dans tous ces modèles.

Amplitudes cliniques :
- **AAOS** (Greene & Heckman, *The Clinical Measurement of Joint Motion*, 1994) : flexion 0–150°, pronation 80°, supination 80° (**à vérifier** dans l'ouvrage).
- **CDC / Soucie et al. 2011**, hommes de 20 à 44 ans, moyenne et IC 95 % : flexion **144,6°** (143,6–145,6), extension 0,8°, pronation **76,9°** (75,6–78,2), supination **85,0°** (83,8–86,2) ([CDC Joint ROM Study](https://archive.cdc.gov/www_cdc_gov/ncbddd/jointrom/index.html) ; Haemophilia 17:500-7, [doi:10.1111/j.1365-2516.2010.02399.x](https://doi.org/10.1111/j.1365-2516.2010.02399.x)).
- **Arc fonctionnel**, Morrey et al. (JBJS Am 63:872-7, 1981) : 30–130° de flexion, 50° de pronation, 50° de supination.

Recommandation : flexion 0–145°, pronation 0–77°, supination 0–85°, avec un repère visuel de l'arc fonctionnel.

### 2.2 Genou

| Modèle | Centre dans le frame fémur (origine = centre de hanche, m) | Cinématique | Amplitude |
|---|---|---|---|
| Rajagopal `walker_knee_l` | (−0,00809 ; −0,40796 ; 0,00275) | Rotation principale autour de −X du frame orienté (1,64157 ; −1,44618 ; 1,5708), soit dans le frame fémur (0 ; 0,0707 ; −0,9975) et chez nous (0,998 ; 0 ; 0,071), 4° dans le plan frontal. Couplages par SimmSpline sur `knee_angle_l` : rotation tibiale (axe ≈ vertical) 0 → −0,184 rad (−10,5°) à 40°, −0,260 rad (−14,9°) à 90°, −0,262 à 120° ; ab/adduction max 0,0335 rad (1,9°) à 50° ; translations ≤ 1,6 mm et ≤ 6,8 mm. | 0 → 120° (LaiUhlrich2023 : 0 → 140°, polynômes) |
| Rajagopal `patellofemoral_l` | même point | Patella **couplée** (`CoordinateCouplerConstraint` coefficient 1) : rotation 0 → −1,786 rad (−102°) à 120° ; translation X (antérieur) +52,4 → −22,7 mm ; Y −10,8 → −40,8 mm (vers 70°) → −18,7 mm | — |
| Gait2392 / Hamner `knee_l` | translations par spline : X ≈ −4,1 mm, Y ≈ −395,9 mm à 0° | Rotation autour du Z fémoral (0,0,1), chez nous (−1,0,0) ; centre mobile par splines en X/Y (Yamaguchi & Zajac 1989) | **−120 → +10°** (flexion négative) |

Os mobiles : tibia, fibula, puis talus et pied en aval. La patella suit sa propre trajectoire couplée.

Amplitudes cliniques : AAOS 0–135° (à vérifier). CDC / Soucie, hommes de 20 à 44 ans : flexion **137,7°** (136,5–138,9), extension 1,0°. La rotation automatique terminale (*screw-home*) est encodée par la spline de rotation tibiale de Rajagopal (environ 10° sur les 40 premiers degrés). Pour l'enseignement, c'est un argument pour **walker_knee plutôt qu'une charnière**.

### 2.3 Épaule (gléno-humérale et rythme scapulo-huméral)

- **Rajagopal / Hamner** : `acromial_l` au point (0,003155 ; 0,3715 ; −0,17) du frame torse. Trois rotations : `arm_flex` autour de Z (−90 → 90°), `arm_add` autour de −X (−120 → 90°), `arm_rot` autour de −Y (−90 → 90°). **La scapula et la clavicule sont soudées au torse** (mesh `hat_ribs_scap.vtp`), donc ce modèle ne sert pas au rythme scapulo-huméral et ne permet pas 180° de flexion.
- **Holzbaur 2005 (BSD-3) = MoBL** : chaîne sternoclaviculaire → `unrotscap` → acromioclaviculaire → `unrothum` → `shoulder0/1/2`. Coordonnées indépendantes : `elv_angle` (plan d'élévation, axe ≈ Y (0,0048 ; 0,9991 ; 0,0424), −90 → 130°), `shoulder_elv` (élévation thoraco-humérale, axe (−0,9983 ; 0,0023 ; 0,0589), **0 → 180°**), `shoulder_rot` (axe ≈ Y, −90 → 20°). Le centre GH est en (−0,00955 ; −0,034 ; 0,009) du frame scapula.
  - **Rythme** : les 10 `CoordinateCouplerConstraint` sont des splines **linéaires** de `shoulder_elv`. Pour 150° (2,618 rad) d'élévation : SC r2 = −0,6336 rad (−36,3°, axe (0,0153 ; 0,9893 ; −0,1451)) ; SC r3 = +0,322 rad à 180° (+18,4°, axe (−0,9945 ; 0 ; −0,1050)) ; AC r3 = **+1,0367 rad (+59,4°)**, axe (−0,7541 ; 0,2976 ; 0,5855), la rotation latérale (upward rotation) ; AC r1 = +0,466 rad (26,7°), axe (0,6377 ; 0,1186 ; 0,7611) ; AC r2 = −0,128 rad (−7,3°). Les corps fantômes `unrot*` annulent ces rotations pour que `shoulder_elv` reste un angle thoraco-huméral.
  - Lecture : environ 59° de rotation scapulaire pour 150° d'élévation humérale, soit un rapport GH:ST d'environ 1,5:1 (estimation, la décomposition n'est pas exacte à cause des rotations SC). Inman (JBJS 1944) donne classiquement 2:1. Holzbaur dit s'appuyer sur des régressions de de Groot & Brand (Clin Biomech 2001) (**à vérifier** dans le texte).
- Amplitudes cliniques : AAOS flexion 180°, abduction 180°, extension 60°, rotation externe 90°, rotation interne 70° (**à vérifier**). CDC/Soucie, hommes de 20 à 44 ans : flexion **168,8°** (167,3–170,3) ; l'étude ne mesure pas l'abduction.
- Os mobiles : humérus et tout l'aval ; scapula et clavicule via le rythme. Pour notre atlas, cela s'applique aux instances `scapula@left`, `clavicle@left` et à leurs muscles attachés.

---

## 3. Faisabilité sur NOS meshes (BodyParts3D simplifiés, `build/assets`)

### 3.1 Méthode

1. Décodage de toutes les instances mâles, sommets en coordonnées monde.
2. **Surfaces articulaires par proximité** : sommets d'un os à moins de *d* mm d'un sommet de l'os voisin. Écarts mesurés : humérus–ulna min 0,52 mm ; humérus–radius min 4,46 mm ; fémur–tibia min 1,22 mm ; fémur–patella 1,07 mm ; humérus–scapula 0,98 mm ; fémur–os coxal 0,42 mm. Les cartilages articulaires sont absents, d'où ces écarts.
3. Ajustements par moindres carrés : sphère algébrique (Kåsa), cercle 2D, et **cylindre itératif**. Pour le cylindre : on part d'une direction initiale, on coupe le nuage en deux moitiés le long de l'axe, on fait un cercle 2D par moitié, et la droite qui joint les deux centres devient le nouvel axe, sur 30 itérations.
4. Épicondyles : sommets d'X minimal et maximal dans les 35 mm (humérus) ou 50 mm (fémur) distaux.
5. Comparaison avec OpenSim **dans un repère anatomique** construit sur nos os, façon OpenSim : Y = du milieu des épicondyles vers le centre proximal (GH ou hanche), Z = droite (médial pour un membre gauche), X = Y×Z antérieur. Les offsets OpenSim sont ensuite mis à l'échelle par le rapport des longueurs de segment. Une comparaison directe en repère monde serait fausse, parce que notre humérus est abducté de 10,9°.

Limite : os simplifiés (humérus 2 073 sommets, ulna 496, radius 368, fémur 1 623, tibia 880). Les rms des ajustements valent 0,5 à 4 mm, ce qui donne des erreurs d'axe de quelques degrés.

### 3.2 Coude gauche (mm, notre repère)

| Grandeur | Valeur | Qualité |
|---|---|---|
| Épicondyle médial / latéral | (177,7 ; −68,2 ; 1048,4) / (240,8 ; −60,7 ; 1054,3) ; largeur 63,8 | — |
| TEA (axe trans-épicondylien) | (0,989 ; 0,118 ; 0,093) | — |
| Sphère du capitulum (81 sommets de l'humérus à moins de 9 mm du radius) | centre (226,9 ; −68,4 ; 1043,0), r 9,3 | rms 2,11 |
| Sphère de la trochlée (134 sommets à moins de 6 mm de l'ulna) | (210,5 ; −64,6 ; 1040,6), r 13,8 | rms 3,94 (selle : mauvais ajustement) |
| **Axe de flexion = cylindre trochlée ∪ capitulum** (215 sommets) | **direction (0,951 ; 0,167 ; 0,260)**, passe par (213,3 ; −68,1 ; 1044,8), r 11,0 | rms 1,72 ; 10,3° du TEA |
| **Centre du coude** (projection sur l'axe du milieu capitulum/trochlée) | **(217,7 ; −67,3 ; 1046,0)** | — |
| Contrôle segment mobile : incisure trochléaire de l'ulna, cercle autour du même axe | r 13,1, centre à **3,1 mm** de l'axe huméral | coaxialité correcte |
| Centre de la tête radiale (cercle perpendiculaire à l'axe PCA du radius, 10 mm proximaux) | (230,5 ; −71,3 ; 1031,2), r 9,4 | rms 1,87 |
| Centre de la tête ulnaire (cercle, 4 à 18 mm distaux) | (239,5 ; −116,2 ; 813,2), r 6,3 | rms 1,84 |
| **Axe de prono-supination** (tête ulnaire → tête radiale) | **(−0,040 ; 0,202 ; 0,979)**, longueur 222,8 ; passe à **3,1 mm** du centre du capitulum (cohérent avec l'anatomie) | — |
| Centre GH (136 sommets de la tête humérale à moins de 6 mm de la scapula) | (160,1 ; −75,1 ; 1313,8), r 20,3 | rms 0,52 |
| Longueur de l'humérus (GH → centre du coude) | 274,1 | — |
| Pose de repos BodyParts3D | humérus **abducté de 10,9°** ; coude **fléchi de 13,5°** (sagittal), 15,0° en 3D ; angle de portage environ 7° (projection frontale) | — |

Dans le repère anatomique de l'humérus, l'axe cylindre vaut (0,056 ; −0,074 ; 0,996) : −4,3° en frontal et 3,2° en axial.

| Comparaison (mise à l'échelle par la longueur de l'humérus) | Écart de centre | Angle avec notre axe cylindre / TEA |
|---|---|---|
| Rajagopal/Hamner (×0,956) | 18,3 mm, surtout en Z (+16,1, médial) et en X (+8,6) | 16,6° / 14,7° (l'axe Rajagopal a 13° de rotation axiale) |
| Holzbaur/Arm26 (×0,943) | 18,6 mm, presque tout en Z (+18,5) | **6,4°** / 8,1° |

Interprétation. Le décalage médial d'environ 18 mm vient surtout de la **définition des frames**. Le Y des frames OpenSim ne passe pas par le milieu des épicondyles (l'épicondyle médial est plus saillant), alors que le nôtre y passe par construction. Holzbaur est plus proche de notre géométrie que Rajagopal pour l'orientation. **Recommandation** : prendre l'axe et le centre **ajustés sur nos os**, garder les modèles OpenSim pour les amplitudes et les couplages, et tolérer un écart de 5 à 15° entre axes « littérature » et axes « mesh ».

### 3.3 Genou gauche (mm)

| Grandeur | Valeur | Qualité |
|---|---|---|
| Épicondyle médial / latéral | (32,0 ; −72,0 ; 403,7) / (112,6 ; −78,8 ; 395,1) ; largeur 81,4 | — |
| TEA | (0,991 ; −0,084 ; −0,106) | — |
| Sphère du condyle postérieur médial (sommets avec y > −81, z < 408, x < milieu − 6) | (48,9 ; −71,0 ; 389,3), r 20,3 | rms 1,68, n 182 |
| Sphère du condyle postérieur latéral | (95,6 ; −72,6 ; 392,0), r 18,7 | rms 1,75, n 148 |
| **Axe de flexion = GCA** (centres des deux sphères) | **(0,998 ; −0,034 ; 0,056)** : 3,2° sur l'horizontale, −1,9° en axial ; 9,8° du TEA | — |
| **Centre du genou** (milieu des deux centres) | **(72,2 ; −71,8 ; 390,6)** | — |
| Cylindre sur les deux condyles | (0,999 ; −0,019 ; 0,050), à 0,9° du GCA | rms 4,11 (rayons inégaux, moins fiable) |
| Centroïde du contact tibial (92 sommets du tibia à moins de 8 mm du fémur) | (73,2 ; −81,0 ; 370,2) | — |
| Centre de hanche (162 sommets à moins de 6 mm de l'os coxal) | (87,5 ; −78,9 ; 810,9), r 23,3 | rms 0,46 |
| Longueur du fémur (hanche → genou) | 420,6 ; axe mécanique à 2,2° de la verticale | — |
| Patella, centroïde relatif au centre du genou | (10,7 ; −39,8 ; −8,2) | — |
| Pose de repos | genou fléchi de 1,5° (sagittal), 1,4° en frontal | — |

| Comparaison (mise à l'échelle par la longueur du fémur) | Écart de centre | Angle de l'axe avec GCA / TEA |
|---|---|---|
| Rajagopal `walker_knee_l` (×1,031) | **5,6 mm** | **3,2°** / 8,0° |
| Gait2392/Hamner à 0° (×1,062) | **0,8 mm** | 6,1° / 3,9° |

Le genou concorde bien avec OpenSim : moins de 6 mm et de 6°. On peut **transposer directement le walker_knee de Rajagopal** (axe, splines de rotation tibiale et de translation, trajectoire de la patella) dans un repère fémoral construit sur nos os, avec une échelle de 1,031.

### 3.4 Épaule gauche (points de départ)

- Centre GH (160,1 ; −75,1 ; 1313,8), r 20,3.
- Contact clavicule–manubrium : centroïde de 104 paires à moins de 6 mm, (15,4 ; −136,2 ; 1315,6), approximation du centre SC.
- Contact clavicule–scapula : 33 paires, (142,5 ; −65,4 ; 1346,0), approximation du centre AC.
- Ces trois points suffisent pour placer la chaîne SC → AC → GH de Holzbaur. Ses axes sont à exprimer dans un repère thorax et scapula à construire (**non fait**).

### 3.5 Problèmes de données découverts dans `build/atlas-male.json`

- **12 structures de kind `bone` sont des muscles ou un fascia** : `extensor-carpi-ulnaris`, `fibularis-brevis`, `fibularis-longus`, `fibularis-tertius`, `humeral-head-of-flexor-carpi-ulnaris`, `iliotibial-tract`, `levator-scapulae`, `subscapularis`, `tibialis-anterior`, `tibialis-posterior`, `ulnar-head-of-flexor-carpi-ulnaris`, `ulnar-head-of-pronator-teres`. Un rig qui traiterait le kind `bone` comme segment rigide les déplacerait à tort.
- **Aucun nerf de membre** : le GLB `nerve` (37 instances) ne contient que des nerfs orbitaires et crâniens. Pas de nerf médian, ulnaire, radial, sciatique, tibial ni fibulaire commun.
- **Aucun ligament ni cartilage articulaire** au coude et au genou (pas de croisés, de collatéraux ni de ménisques). Le kind `ligament` (18 instances) couvre le larynx, l'œil et le `long-plantar-ligament`. Seulement 3 tendons, dont `calcaneal-tendon`.
- La **peau est une seule instance midline** de 102 467 sommets et 203 382 triangles : impossible de la déformer localement sans la découper.

---

## 4. Tissus mous qui franchissent l'articulation, et coûts

### 4.1 Méthode de sélection

Plan passant par le centre articulaire, de normale ≈ axe du membre (coude (0,04 ; 0,08 ; 1), genou vertical). Une instance est **candidate** si sa bbox monde chevauche le plan d'au moins *M* mm de chaque côté et coupe un carré de ±80 mm (coude) ou ±90 mm (genou) autour du centre en XY. Elle est **confirmée** si elle a au moins 3 sommets de chaque côté, à plus de *M* mm du plan, dans une sphère de 80 ou 90 mm. On a testé *M* = 15 mm (strict) et *M* = 3 mm (fonctionnel, qui attrape les muscles des épicondyles et de l'olécrane). La colonne `[v/t/b]` donne sommets, triangles, et sommets à ±60 mm du plan (bande à déformer).

**Coude gauche, M = 3 mm (28 instances confirmées ; 68 146 v et 108 642 t hors peau ; 20 679 v dans la bande)**
- artery (4) : `brachial-artery@left`, `inferior-ulnar-collateral-artery@left`, `radial-recurrent-artery@left`, `superior-ulnar-collateral-artery@left`
- muscle (16) : `anconeus`, `brachialis`, `brachioradialis`, `extensor-carpi-radialis-brevis`, `extensor-carpi-radialis-longus`, `extensor-digiti-minimi`, `extensor-digitorum`, `flexor-carpi-radialis`, `flexor-digitorum-superficialis` (6 742 v), `humeral-head-of-pronator-teres`, `lateral-head-of-triceps-brachii`, `long-head-of-biceps-brachii`, `long-head-of-triceps-brachii`, `medial-head-of-triceps-brachii`, `palmaris-longus`, `supinator` (tous `@left`)
- vein (4) : `basilic-vein` (9 177 v), `cephalic-vein` (11 505 v), `medial-brachial-vein`, `median-cubital-vein`
- « bone » : `humerus`, `ulna`, et `extensor-carpi-ulnaris` (muscle mal classé)
- skin : `skin` (1 448 v dans la bande)
- Avec M = 15 mm, il ne reste que 16 instances (40 144 v et 72 958 t hors peau). Le critère par plan perd les muscles des épicondyles et de l'olécrane. `humeral-head-of-flexor-carpi-ulnaris` (bbox z max 1048,3, kind `bone`) échappe aux deux seuils alors qu'il franchit le coude. `short-head-of-biceps-brachii` s'arrête à z = 1065 : le tendon distal commun est modélisé dans le chef long. **Il faut compléter le critère géométrique par une liste fonctionnelle**, par exemple celle des 22 muscles de Holzbaur.

**Genou gauche, M = 3 mm (29 instances ; 108 674 v et 198 964 t hors peau ; 34 066 v dans la bande)**
- artery (5) : `anterior-tibial-recurrent-artery`, `descending-genicular-artery`, `medial-superior-genicular-artery`, `middle-genicular-artery`, `popliteal-artery` (8 368 v)
- muscle (15) : `adductor-magnus`, `gracilis`, `lateral-head-of-gastrocnemius`, `long-head-of-biceps-femoris`, `medial-head-of-gastrocnemius`, `plantaris`, `popliteus`, `rectus-femoris`, `sartorius`, `semimembranosus`, `semitendinosus`, `short-head-of-biceps-femoris`, `vastus-intermedius`, `vastus-lateralis`, `vastus-medialis`
- vein (5) : `anterior-tibial-vein`, `genicular-vein`, `great-saphenous-vein` (15 199 v), `popliteal-vein`, `small-saphenous-vein`
- « bone » : `femur`, `patella`, `iliotibial-tract` (fascia mal classé, 9 425 v)
- skin (2 320 v dans la bande)
- Les 13 muscles du genou de Rajagopal sont tous présents (tfl ↔ via `iliotibial-tract`). La sélection géométrique ajoute `adductor-magnus` et `popliteus`, mais aucun ligament, faute de meshes.

Mouvement **rigide** (seulement `setMatrixAt`, coût négligeable) : avant-bras et main gauches, 82 instances et 72 562 v ; jambe et pied gauches, 76 instances et 101 006 v. Peau du membre : environ 13 137 v pour le bras gauche (x > 170, z < 1200) et environ 14 501 v pour la jambe gauche (x > 0, z < 600).

### 4.2 Les quatre approches, chiffrées

| Approche | Coût par frame | Mémoire ou transfert | Compatibilité avec notre viewer | Pièges visuels |
|---|---|---|---|---|
| **(a) Masquer** les tissus qui franchissent | 0 ; `setVisibleAt` sur 16 à 29 instances, plus la peau | 0 | Native (`BatchedMesh`) | Trou pédagogique. On peut le compenser par des **lignes d'action** (polylignes des path points Rajagopal/Holzbaur). |
| **(b) LBS CPU**, poids automatiques par distance aux deux segments | Coude 40–68 k v, genou 102–109 k v, plus la peau du membre si on la découpe (13–15 k). Environ 2 matrices 3×4 par sommet (position et normale), de l'ordre de 5 M flops, quelques ms en JS (**estimation, à mesurer**). | Ré-upload position + normale en float32 : 24 o/v, soit **1,6 Mo par frame au coude, 2,6 Mo au genou** (98 et 157 Mo/s à 60 fps). | `BatchedMesh.setGeometryAt` (r187) recopie tous les attributs de la géométrie avec `addUpdateRange`. Les GLB sont quantifiés (`KHR_mesh_quantization`) : il faut garder une copie float ou re-quantifier. Le BVH de picking (`computeBatchedBoundsTree`) devient faux : `refit` à chaque frame (**à vérifier** pour l'API batched de three-mesh-bvh) ou picking désactivé pendant l'animation. | **Candy-wrapper** en prono-supination (torsion autour de l'axe long, cas d'école de la LBS). Perte de volume dans le pli du coude et du genou. Poids euclidiens qui « fuient » d'un muscle voisin à l'autre. Tubes vasculaires écrasés. |
| **(c) GPU skinning** (`SkinnedMesh`, sorti du batch) | CPU : quelques `mat4` d'os. GPU : LBS dans le vertex shader (node `Skinning.js` de r187, 4 influences par sommet `skinIndex`/`skinWeight`), aussi dans les passes d'ombre. | Attributs `JOINTS_0`/`WEIGHTS_0` : +8 à 20 o/v, une seule fois. | `BatchedMesh.js` r187 ne contient **aucun code skin ou morph** : il faut masquer l'instance batchée et afficher un `SkinnedMesh` (un par kind/matériau, environ 5 draw calls de plus). `SkinnedMesh.raycast` skinne sur CPU (lent sur 100 k v, mais seulement au clic). | Mêmes artefacts LBS que (b). Le DQS (Kavan 2008) supprime le candy-wrapper mais produit un gonflement aux plis ; three.js n'en a pas, il faudrait un node TSL maison. |
| **(d) Morph targets** cuits hors ligne (Blender ou pipeline) | GPU : somme pondérée de 2 cibles adjacentes. CPU : 0. | Coude 68 k v × 7 poses (pas de 25°, 0–150°) × position+normale int16 (16 o) ≈ **7,6 Mo** brut (11,4 Mo en float32) ; genou 109 k v × 6 poses ≈ **10,4 Mo**, avant meshopt. | Hors `BatchedMesh`, donc même extraction que (c). Morph et skin cohabitent dans glTF/three (morph appliqué avant le skin). | Interpolation linéaire entre poses = corde au lieu d'arc : rétrécissement r(1−cos(Δ/2)). Avec Δ = 25° et r = 250 mm (poignet), **5,9 mm** à mi-intervalle ; avec Δ = 15°, 2,1 mm. Donc : **skinning rigide + morphs correctifs** (pose-space deformation) restreints à la bande ±60 mm (13–34 k v, sparse accessors). |

**Self-intersection.** À 145° de flexion du coude et 135–140° au genou, les tissus réels se compriment. Toute méthode de skinning produit de l'interpénétration (biceps dans les fléchisseurs de l'avant-bras, mollet dans la cuisse), et le seuil exact où elle commence **n'a pas été mesuré sur nos meshes**. Le projet `anatomy_studio` (§5) l'accepte et rend en double face. Deux pistes : limiter l'animation pédagogique à 0–130° (proche de l'arc fonctionnel), ou fondre les tissus en transparence au-delà.

**Poids automatiques.** Le simple « distance aux deux segments osseux » (ou un smoothstep sur la distance signée au plan articulaire, sur ±40 mm) suffit pour une première version au genou. Plus robustes : les poids par diffusion de chaleur (Baran & Popović 2007, base des « automatic weights » de Blender) et les bounded biharmonic weights (Jacobson et al. 2011). Il faut **un seul champ de poids partagé par toutes les structures** pour éviter déchirures et interpénétrations entre muscles voisins : c'est la leçon chiffrée d'`anatomy_studio`. Pour le candy-wrapper de la prono-supination : DQS, ou chaîne d'os de torsion (twist) répartie le long de l'avant-bras, ou centres de rotation optimisés (Le & Hodgins 2016).

**Recommandation pour l'implémentation.** Os et instances non franchissantes : rigides via `setMatrixAt`, ce qui est natif, sans perte et garde le BVH valide. Instances franchissantes : approche (a) en v1, avec lignes d'action OpenSim en option. Puis (c) avec poids cuits hors ligne (champ partagé) et éventuellement des morphs correctifs (d) dans la bande. La peau : la masquer pendant l'animation, ou la découper en patchs par membre au build.

Références : Kavan, Collins, Žára, O'Sullivan, « Geometric skinning with approximate dual quaternion blending », ACM TOG 27(4), 2008 ; Lewis, Cordner, Fong, « Pose space deformation », SIGGRAPH 2000 ; Baran & Popović, « Automatic rigging and animation of 3D characters », ACM TOG 26(3), 2007 ; Jacobson, Baran, Popović, Sorkine, « Bounded biharmonic weights for real-time deformation », ACM TOG 30(4), 2011 ; Le & Hodgins, « Real-time skeletal skinning with optimized centers of rotation », ACM TOG 35(4), 2016 ; three.js r187 `src/objects/BatchedMesh.js` (méthodes `setGeometryAt`, `setMatrixAt`, aucune référence skin/morph) et `src/nodes/accessors/Skinning.js` (lus dans `node_modules/three`).

---

## 5. Projets ouverts existants

| Projet | Licence | Données | Approche |
|---|---|---|---|
| [BruceGoodGuy/anatomy_studio](https://github.com/BruceGoodGuy/anatomy_studio) (actif en oct. 2026) | **Aucune licence** (tous droits réservés) : idées citables, code non réutilisable | Muscles **Z-Anatomy** (CC BY-SA, crédit affiché), cinématique `RajagopalLaiUhlrich2023.osim` + `MoBL_ARMS` (rythme scapulo-huméral), os OpenSim `.vtp` | Pipeline Python + OpenSim 4.6 qui exporte un `viewer.html` three.js autonome (~4 Mo). **Membres inférieurs** : champ de poids partagé, solution de **Laplace** avec les surfaces osseuses comme bord, plus des disques virtuels à mi-cuisse et mi-jambe pour borner la diffusion, puis mélange **dual quaternion**. **Membre supérieur** : chaque point suit l'os du segment de trajet musculaire le plus proche, avec lissage le long du muscle et aux interfaces. QA automatique : triangles retournés (KO > 25 par muscle), arêtes étirées (KO > ×6), volume inversé (KO > 6 %), pénétration entre muscles (KO > 8 mm). L'ancienne méthode (chaque muscle suit son propre trajet) donnait 50–120 triangles retournés par muscle et des arêtes ×33 au fond d'un squat. |
| [opensim-org/opensim-viewer](https://github.com/opensim-org/opensim-viewer) + [opensim-viewer-backend](https://github.com/opensim-org/opensim-viewer-backend) | Apache-2.0 | Modèles et mouvements OpenSim | Le backend convertit `.osim` et les mouvements en glTF animé (pygltflib, `convert{xxx}2Gltf.py`). Os rigides, muscles en lignes. Rien sur BodyParts3D. |
| [MyoHub/myo_sim](https://github.com/MyoHub/myo_sim) + [zalo/mujoco_wasm](https://github.com/zalo/mujoco_wasm) | Apache-2.0 / MIT | Modèles MuJoCo (MyoArm 38 DOF/63 muscles, MyoLeg 29/80, MyoElbow) | Simulation en navigateur (WASM), segments rigides et tendons en lignes. Provenance OpenSim des modèles non vérifiée : si MyoArm dérive de MoBL-ARMS, la chaîne de licence pose question. |
| [ashemag/human-atlas](https://github.com/ashemag/human-atlas) | MIT (code) + BP3D CC BY 4.0 | BodyParts3D, 2 234 meshes | Vues éclatées, couches, recherche ; **pas d'animation articulaire** (aucune mention dans le README). |
| Recherche « BodyParts3D rigged / joint animation three.js » | — | — | Aucun projet trouvé (recherche web du 2026-11-09 : résultats génériques sur les skeletons three.js seulement). Z-Anatomy (Blender) : présence d'un rig non vérifiée. |

Conséquence : **personne ne publie un rig ouvert de BodyParts3D**. La combinaison « os BP3D + cinématique Rajagopal (MIT) / Holzbaur (BSD-3) + tissus mous déformés » serait nouvelle. `anatomy_studio` montre que le problème dur est la déformation cohérente des muscles, pas la cinématique.

---

## 6. Ce qui reste à vérifier

- Licence de `model-high-flex` (Lai 2017), et CC BY ou BY-NC pour « OpenSim Models and Examples » (Gait2392).
- Orientation exacte des frames OpenSim en pose zéro (parallèles au sol ?) et signe de `pro_sup` dans Rajagopal (0 = supination ?), à contrôler en chargeant le modèle dans OpenSim ou OpenSim Creator.
- Valeurs AAOS et de Groot & Brand, à relire dans les sources primaires.
- API de `refit` du BVH batched dans three-mesh-bvh ; débit réel de `setGeometryAt` sur mobile.
- Correction des 12 kinds `bone` erronés, à remonter dans la pipeline atlas, hors périmètre de cette note.
