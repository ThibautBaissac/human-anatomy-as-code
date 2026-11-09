# Modèle féminin v1 : faits mesurés sur les fichiers HRA (état au 2026-11-09)

Méthode : sources interrogées le 2026-11-09 (HRA API `apps.humanatlas.io/api/v1`, catalogue DCAT `cdn.humanatlas.io/digital-objects/catalog.json`, GitHub API). Fichiers GLB téléchargés (~39 Mo au total) et inspectés avec `@gltf-transform/core` du repo (scripts dans le scratchpad, pas dans le repo). Le GLB `united-female` (357 Mo) n'a **pas** été téléchargé : seul son chunk JSON glTF (939 508 octets, lu par requête HTTP `Range`) a été analysé, ce qui donne noms de nœuds, extras, triangles et bounding boxes d'accessors sans les buffers. Les chiffres BodyParts3D viennent des OBJ locaux `data/raw/bodyparts3d/obj_partof/partof_BP3D_4.0_obj_99/` (et `obj_isa/` pour les meshes absents de partof). Tout ce qui n'a pas été vérifié dans cette session est marqué « à vérifier ».

---

## 1. Publication, version, licence

### Où vivent les objets 3D de référence
- **`hubmapconsortium/ccf-releases` est figé.** Dossiers `v1.0` → `v2.0`. Dernière entrée du CHANGELOG : « 2.0 - 2023-12-15 ». Dernier commit : 2024-06-24 (« Fix female larynx DOI »). La seule GitHub Release est « CCF Release v1.1 » (2021-12-17). `v2.0/models/` ne contient que les modèles modifiés dans cette release : `3d-vh-f-allen-brain.glb`, `3d-vh-f-pancreas.glb`, `3d-vh-f-united.glb.7z` (78 Mo), équivalents masculins, et `asct-b-3d-models-crosswalk.csv`. — [ccf-releases](https://github.com/hubmapconsortium/ccf-releases), [CHANGELOG](https://github.com/hubmapconsortium/ccf-releases/blob/main/CHANGELOG.md)
- **Depuis v2.1, la publication passe par les « Digital Objects » (DO) HRA**, produits par [`hra-do-processor`](https://github.com/hubmapconsortium/hra-do-processor) :
  - fichiers : `https://cdn.humanatlas.io/digital-objects/ref-organ/<organe>-female[-left|-right]/<vX.Y>/assets/3d-vh-f-<organe>.glb` (plus `assets/crosswalk.csv` et `graph.{ttl,json,jsonld,nt,nq,xml}`) ;
  - identifiants : `https://purl.humanatlas.io/ref-organ/<do>/<version>` et `https://lod.humanatlas.io/ref-organ/<do>/<version>` ;
  - catalogue machine : [catalog.json](https://cdn.humanatlas.io/digital-objects/catalog.json) (15,5 Mo, 16 722 entrées DCAT) ;
  - API : [`/api/v1/reference-organs`](https://apps.humanatlas.io/api/v1/reference-organs) (81 entrées : 45 F, 36 M) et `/api/v1/reference-organ-scene?organ-iri=…&sex=Female` (transformMatrix par organe).
- **Version courante : HRA v2.5, « 11th Release (v2.5): June 15, 2026 »**, avec « 81 3D reference objects with 1,392 3D anatomical structures ». Nouveautés 3D de v2.5 : epiploic appendage et omentum (F et M), révision des `united` F et M. — [release notes v2.5 (source YAML)](https://github.com/hubmapconsortium/hra-ui/blob/main/apps/humanatlas.io/public/assets/content/release-notes-page/v2.5.yaml). La liste exacte des DO de la release est dans [collection/hra/v2.5/assets/digital-objects.yaml](https://cdn.humanatlas.io/digital-objects/collection/hra/v2.5/assets/digital-objects.yaml). Le catalogue date la collection `hra/v2.5` du 2026-08-10 (date de traitement, pas de release). Aucune v2.6 n'apparaît encore dans le catalogue ; si le rythme semestriel (15 juin / 15 décembre) se maintient, elle est attendue vers le 2026-12-15 (inférence).

### Licence
- **Les 272 versions de DO `ref-organ` du catalogue portent toutes `dct:license "https://creativecommons.org/licenses/by/4.0/"`.** Aucune exception, cerveau Allen et ganglion lymphatique NIH compris. Le bloc `#raw-data` de chacun des 46 DO féminins de v2.5 dit textuellement : « Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) ». La collection `hra/v2.5` est elle aussi en CC BY 4.0.
- **Le GLB lui-même ne porte aucune licence** (`asset.copyright` absent ; `asset.generator` = « glTF-Transform v4.5.1 » pour les GLB par organe, « babylon.js glTF exporter for Autodesk MAYA 2023.3.5 v20260319.2 » pour le united). La licence et le crédit doivent donc venir des métadonnées DO, à recopier dans notre manifeste de provenance par mesh.
- Crédit demandé (exemple utérus) : « Browne, Kristen, and Heidi Schlehlein. 2024. *3D Reference Organ for Uterus v1.1*. https://doi.org/10.48539/HBM627.VTKD.892 ». Attention : le DO v1.2 cite encore « v1.1 ». Chaque DO a un DOI `10.48539/HBM…` (liste au §2). Citation d'ensemble : « Browne, Kristen, Heidi Schlehlein, Bruce W. Herr II, Ellen Quardokus, Andreas Bueckle, and Katy Börner. 2026. HuBMAP CCF 3D Reference Object Library. https://humanatlas.io/3d-reference-library ». Données sources : Visible Human Female (NLM ; Spitzer & Whitlock 1998, Anat Rec 253:49–57).
- Provenance non-VH à connaître : le cerveau est l'atlas Allen (Ding et al. 2016), mis en miroir et « resized to fit the Visible Human Male and Female bodies » ; le côlon féminin (`3d-sbu-f-large-intestine`) « was not based on direct imaging data… created by roughly following the general path of the Visible Human Female » ; le ganglion lymphatique vient de données Ce3D de souris (NIAID). Toutes ces provenances viennent des champs `rdfs:comment` des DO.

---

## 2. Organes de référence féminins disponibles (HRA v2.5)

45 GLB par organe et 1 ensemble `united-female`. Tailles mesurées par `Content-Length` HTTP ; total : 693 Mo dont 357 Mo pour le united. La colonne `representation_of` reproduit l'identifiant tel que l'API le donne, en UBERON ou en FMA. Les dimensions API sont en millimètres (voir le piège d'unités au §3).

| Catégorie | DO (version) | Fichier GLB | Mo | representation_of | Dim. API (mm) | DOI |
|---|---|---|---:|---|---|---|
| F-spécifique | `fallopian-tube-female-left/v1.2` | `3d-vh-f-fallopian-tube-l.glb` | 0.32 | UBERON:0001303 | 39×44×19 | 10.48539/HBM529.KBQT.896 |
| F-spécifique | `fallopian-tube-female-right/v1.2` | `3d-vh-f-fallopian-tube-r.glb` | 0.31 | UBERON:0001302 | 34×45×21 | 10.48539/HBM952.XJJV.857 |
| F-spécifique | `mammary-gland-female-left/v1.1` | `3d-vh-f-mammary-gland-l.glb` | 13.09 | FMA:57991 | 128×182×112 | 10.48539/HBM533.BNJL.834 |
| F-spécifique | `mammary-gland-female-right/v1.1` | `3d-vh-f-mammary-gland-r.glb` | 23.26 | FMA:57987 | 128×180×113 | 10.48539/HBM235.CHRK.259 |
| F-spécifique | `ovary-female-left/v1.3` | `3d-vh-f-ovary-l.glb` | 0.01 | UBERON:0002119 | 12×24×11 | 10.48539/HBM695.KCXS.294 |
| F-spécifique | `ovary-female-right/v1.3` | `3d-vh-f-ovary-r.glb` | 0.01 | UBERON:0002118 | 12×24×11 | 10.48539/HBM277.TVMB.676 |
| F-spécifique | `placenta-full-term-female/v1.1` | `3d-vh-f-placenta-full-term.glb` | 4.69 | UBERON:0001987 | 251×231×134 | 10.48539/HBM593.ZRJH.644 |
| F-spécifique | `uterus-female/v1.2` | `3d-vh-f-uterus.glb` | 0.93 | UBERON:0000995 | 52×47×59 | 10.48539/HBM627.VTKD.892 |
| os/articulation | `intervertebral-disk-female/v1.0` | `3d-vh-f-intervertebral-disk.glb` | 46.19 | UBERON:0001066 | 67×563×84 | 10.48539/HBM824.BNBP.227 |
| os/articulation | `knee-female-left/v1.3` | `3d-vh-f-knee-l.glb` | 0.33 | FMA:24978 | 102×772×110 | 10.48539/HBM892.RGKB.238 |
| os/articulation | `knee-female-right/v1.3` | `3d-vh-f-knee-r.glb` | 0.33 | FMA:24977 | 102×772×110 | 10.48539/HBM542.WHJW.673 |
| os/articulation | `manubrium-female/v1.0` | `3d-vh-f-manubrium.glb` | 0.13 | UBERON:2001553 | 72×52×40 | 10.48539/HBM668.VJNV.946 |
| os/articulation | `pelvis-female/v1.3` | `3d-vh-f-pelvis.glb` | 1.52 | UBERON:0001270 | 317×211×183 | 10.48539/HBM853.VCFM.778 |
| os/articulation | `sternum-female/v1.0` | `3d-vh-f-sternum.glb` | 0.21 | UBERON:0000975 | 37×106×25 | 10.48539/HBM669.VLNS.645 |
| partagé | `adipose-female/v1.0` | `3d-vh-f-adipose.glb` | 0.66 | UBERON:0014455 | 189×133×36 | 10.48539/HBM747.MSDM.942 |
| partagé | `blood-vasculature-female/v1.3` | `3d-vh-f-blood-vasculature.glb` | 17.05 | UBERON:0004537 | 193×799×185 | 10.48539/HBM322.KKFC.394 |
| partagé | `brain-female/v1.4` | `3d-allen-f-brain.glb` | 11.43 | UBERON:0000955 | 136×146×167 | 10.48539/HBM674.NTLM.353 |
| partagé | `epiploic-appendage-of-transverse-colon-female/v1.0` | `3d-vh-f-epiploic-appendage-of-transverse-colon.glb` | 0.51 | FMA:15046 | 70×23×25 | 10.48539/HBM926.ZRGW.252 |
| partagé | `eye-female-left/v1.3` | `3d-vh-f-eye-l.glb` | 26.19 | UBERON:0004548 | 24×24×26 | 10.48539/HBM525.TRWD.376 |
| partagé | `eye-female-right/v1.3` | `3d-vh-f-eye-r.glb` | 19.74 | UBERON:0004549 | 24×24×26 | 10.48539/HBM632.KTDP.379 |
| partagé | `heart-female/v1.3` | `3d-vh-f-heart.glb` | 1.66 | UBERON:0000948 | 143×110×101 | 10.48539/HBM449.SHRV.225 |
| partagé | `kidney-female-left/v1.3` | `3d-vh-f-kidney-l.glb` | 1.29 | UBERON:0004538 | 73×125×78 | 10.48539/HBM449.JPXL.964 |
| partagé | `kidney-female-right/v1.3` | `3d-vh-f-kidney-r.glb` | 1.32 | UBERON:0004539 | 73×98×70 | 10.48539/HBM968.HSNL.854 |
| partagé | `large-intestine-female/v1.3` | `3d-sbu-f-large-intestine.glb` | 0.37 | UBERON:0000059 | 243×295×193 | 10.48539/HBM682.RSXX.965 |
| partagé | `larynx-female/v1.1` | `3d-vh-f-larynx.glb` | 0.44 | UBERON:0001737 | 46×60×40 | 10.48539/HBM525.FJHR.643 |
| partagé | `liver-female/v1.2` | `3d-vh-f-liver.glb` | 1.66 | UBERON:0002107 | 247×170×166 | 10.48539/HBM599.GZLD.639 |
| partagé | `lung-female/v1.4` | `3d-vh-f-lung.glb` | 22.18 | UBERON:0001004 | 251×223×153 | 10.48539/HBM994.HXJP.575 |
| partagé | `lymph-node-female/v1.4` | `3d-nih-f-lymph-node.glb` | 4.33 | UBERON:0002509 | 20×11×13 | 10.48539/HBM425.PTPB.732 |
| partagé | `main-bronchus-female/v1.1` | `3d-vh-f-main-bronchus.glb` | 2.73 | UBERON:0002182 | 93×55×31 | 10.48539/HBM266.CXBT.375 |
| partagé | `mouth-female/v1.0` | `3d-vh-f-mouth.glb` | 98.89 | UBERON:0000165 | 145×108×129 | 10.48539/HBM856.VZWZ.422 |
| partagé | `omentum-female/v1.0` | `3d-vh-f-omentum.glb` | 5.66 | UBERON:0003688 | 248×191×116 | 10.48539/HBM636.GWRW.698 |
| partagé | `palatine-tonsil-female-left/v1.2` | `3d-vh-f-palatine-tonsil-l.glb` | 0.89 | FMA:54974 | 20×26×18 | 10.48539/HBM245.VCTP.795 |
| partagé | `palatine-tonsil-female-right/v1.2` | `3d-vh-f-palatine-tonsil-r.glb` | 0.63 | FMA:54973 | 18×27×16 | 10.48539/HBM549.HTLQ.527 |
| partagé | `pancreas-female/v1.3` | `3d-vh-f-pancreas.glb` | 0.68 | UBERON:0001264 | 172×57×84 | 10.48539/HBM866.PNNZ.328 |
| partagé | `renal-pelvis-female-left/v1.0` | `3d-vh-f-renal-pelvis-l.glb` | 0.06 | UBERON:0018115 | 13×24×16 | 10.48539/HBM425.ZSXF.722 |
| partagé | `renal-pelvis-female-right/v1.0` | `3d-vh-f-renal-pelvis-r.glb` | 0.05 | UBERON:0018116 | 19×20×14 | 10.48539/HBM445.MNJL.333 |
| partagé | `skin-female/v1.5` | `3d-vh-f-skin.glb` | 15.26 | UBERON:0002097 | 962×1658×327 | 10.48539/HBM453.MVPL.398 |
| partagé | `small-intestine-female/v1.2` | `3d-vh-f-small-intestine.glb` | 0.82 | UBERON:0002108 | 162×217×100 | 10.48539/HBM784.FBXB.245 |
| partagé | `spinal-cord-female/v1.1` | `3d-vh-f-spinal-cord.glb` | 7.30 | UBERON:0002240 | 18×409×82 | 10.48539/HBM242.QQQB.777 |
| partagé | `spleen-female/v1.3` | `3d-vh-f-spleen.glb` | 0.26 | UBERON:0002106 | 90×102×71 | 10.48539/HBM883.DZCZ.658 |
| partagé | `thymus-female/v1.3` | `3d-vh-f-thymus.glb` | 0.07 | UBERON:0002370 | 86×124×54 | 10.48539/HBM962.VFVM.626 |
| partagé | `trachea-female/v1.1` | `3d-vh-f-trachea.glb` | 0.70 | UBERON:0003126 | 24×108×77 | 10.48539/HBM795.KFPV.358 |
| partagé | `ureter-female-left/v1.2` | `3d-vh-f-ureter-l.glb` | 0.65 | UBERON:0001223 | 53×220×37 | 10.48539/HBM343.JGCD.345 |
| partagé | `ureter-female-right/v1.2` | `3d-vh-f-ureter-r.glb` | 0.58 | UBERON:0001222 | 35×224×36 | 10.48539/HBM375.FNHZ.563 |
| partagé | `urinary-bladder-female/v1.2` | `3d-vh-f-urinary-bladder.glb` | 0.73 | UBERON:0001255 | 52×44×62 | 10.48539/HBM595.LMKX.573 |
| ensemble | `united-female/v1.10` | `3d-vh-f-united.glb` | 357.16 | — | — | 10.48539/HBM637.DWBM.744 |

Les gros fichiers sont `mouth` (98,9 Mo, 1,6 M triangles), `intervertebral-disk` (46,2 Mo), les yeux (26,2 et 19,7 Mo), `mammary-gland-r` (23,3 Mo, 585 330 triangles) et `-l` (13,1 Mo, 270 799 triangles), `lung` (22,2 Mo) et `blood-vasculature` (17,1 Mo). Les fichiers pelviens sont petits : utérus 0,93 Mo, ovaires 9 Ko chacun.

### Spécifiquement féminin
- **Fichiers séparés** : utérus (11 meshes : col, isthme/segment inférieur, corps, fond, cornes, parois antérieure et postérieure, orifices interne et externe du col, ostium abdominal de la trompe, plus `VH_F_cervicovaginal_junction`), ovaires G/D, trompes G/D (infundibulum, fimbria, ampoule, isthme), glandes mammaires G/D (graisse, mamelon, aréole, tubercules aréolaires, lobes, canaux et sinus lactifères, ligaments suspenseurs), placenta à terme (placenta, plaque choriale, amnios, cordon, 2 artères et 1 veine ombilicales ; gestationnel, hors modèle de base).
- **Présents uniquement dans `united-female`**, sans GLB séparé : `VH_F_vagina` (UBERON:0000996, 8 780 triangles), `VH_F_broad_ligament`, ligaments ronds, cardinaux et utéro-sacrés G/D, ligaments suspenseurs de l'ovaire, ligaments propres de l'ovaire, mésovarium et mésosalpinx G/D, `VH_F_uterovesical_pouch`. Ensemble « #VHFLigamentsUterusOvaries » : 16 meshes, 75 822 triangles. Pour les avoir, il faut télécharger le united (357 Mo) et extraire ces nœuds.
- **Absents de tout le HRA** : vulve, clitoris, lèvres, urètre féminin, périnée et plancher pelvien musculaire. Le seul urètre des données HRA est celui du modèle masculin (DO prostate).
- Anomalie de données : dans le united, `VH_F_right_round_ligament_of_uterus` est en x > 0 (0,002 → 0,049 m), donc à **gauche** du sujet selon la convention vérifiée plus bas (ovaire gauche FMA:7214 en x > 0). Les étiquettes G/D des ligaments ronds semblent inversées.

### Organes partagés présents dans le corps féminin
Vessie (fond/dôme, col, trigone, orifices urétéraux), uretères, reins, bassinets, gros intestin (avec `VH_F_rectum`), intestin grêle, foie, pancréas, rate, cœur, poumons, bronches, trachée, larynx, thymus, peau, tissu adipeux sous-cutané abdominal, épiploon, appendices épiploïques, cerveau (Allen), moelle spinale, yeux, bouche, amygdales palatines, ganglion lymphatique, vascularisation sanguine (artères et veines utérines G/D, FMA:18830/18831/18897/18898 ; pas d'artère ovarienne trouvée dans le crosswalk).

### Os : il n'y a pas de squelette complet
- `pelvis-female` v1.3 : `VH_F_sacrum`, `VH_F_coccyx`, puis ilium, ischium et pubis G/D, chacun découpé en os compact et os spongieux (14 meshes, 87 448 triangles).
- `knee-female-l/r` v1.3 : **fémur, tibia, fibula et patella entiers** (fémur G de y −0,382 à +0,039 m), avec condyles, ménisque et cartilage. `sternum` et `manubrium` sont des fichiers séparés.
- **Uniquement dans le united** : vertèbres C1–C7, T1–T12, **L1–L6** (six lombaires dans le VH Female), disques intervertébraux et nuclei pulposi.
- **Il n'y a pas de côtes, de crâne, de membre supérieur, de clavicule ni de pied.**
- Le united v1.10 contient `VH_F_ilium` mais **aucun nœud pubis ni ischium** (« #VHFPelvis » : 6 meshes, 57 139 triangles). Le bassin complet n'existe que dans `3d-vh-f-pelvis.glb`.
- Le united v1.10 compte 1 160 nœuds, 956 meshes et **7 756 626 triangles**. Seuls 4 nœuds portent une transformation : `VH_F_skin` (rotation et échelle 0,8136), `VH_F_visceral_adipose` (échelle 1,43), `VH_F_omentum` et `VH_F_epiploic_appendage…` (translation nulle). Tous les autres meshes sont déjà exprimés dans le repère du corps.

---

## 3. Géométrie mesurée : repère, unités, transformation vers BodyParts3D

### HRA (mesuré dans les GLB)
| GLB | Meshes | Triangles | BBox monde min → max (m, repère glTF) |
|---|---:|---:|---|
| `3d-vh-f-uterus.glb` | 11 | 40 950 | (−0,0397, 0,0024, −0,0904) → (0,0127, 0,0532, −0,0275) |
| `3d-vh-f-ovary-l.glb` | 1 | 424 | (0,0382, 0,0490, −0,0507) → (0,0505, 0,0729, −0,0402) |
| `3d-vh-f-ovary-r.glb` | 1 | 410 | (−0,0767, 0,0489, −0,0508) → (−0,0644, 0,0729, −0,0402) |
| `3d-vh-f-fallopian-tube-l.glb` | 4 | 18 281 | (0,0121, 0,0409, −0,0520) → (0,0507, 0,0854, −0,0335) |
| `3d-vh-f-urinary-bladder.glb` | 6 | 41 290 | (−0,0405, −0,0180, −0,0593) → (0,0114, 0,0262, 0,0024) |
| `3d-vh-f-pelvis.glb` | 14 | 87 448 | (−0,1670, −0,0468, −0,1825) → (0,1498, 0,1647, 0,0003) |
| `3d-vh-f-skin.glb` | 1 | 266 696 | (−0,4869, −0,7926, −0,2191) → (0,4748, 0,8652, 0,1080) |

- **Unités : mètres dans les GLB.** Piège : l'API et le graphe annoncent `dimension_units: millimeter` (utérus 52,49 × 46,99 × 58,70), alors que le mesh mesure 0,0525 × 0,0508 × 0,0629. Les métadonnées sont en mm, la géométrie en m.
- **Axes : Y vers le haut, +Z antérieur, +X à gauche du sujet**, repère droit conforme à glTF. Preuves : le fond utérin (y 0,053) est au-dessus du col (y 0,006) ; le pubis (z ≈ −0,01) est devant le sacrum (z −0,18 à −0,08) ; l'ovaire gauche FMA:7214 est en x > 0.
- **Tous les GLB par organe partagent un même repère corps** : le sacrum et l'ovaire gauche ont des bounding boxes identiques dans le GLB par organe et dans le united, et les nœuds racines ont des transformations identité. Il n'y a donc rien à recomposer : on charge les organes tels quels.
- **Origine ≈ symphyse pubienne.** La symphyse mesurée est en (x −0,021, y −0,005, z −0,008) m ; la plante des pieds est en y ≈ −0,79 et le vertex en y ≈ +0,87. Hauteur peau : **1 658 mm**. Le plan médian du sujet est décalé d'environ −13 mm en x (mi-distance des EIAS ; centre de l'utérus x ≈ −0,0135).
- Placement RUI : le graphe DO donne pour l'utérus une `primary_global_placement` relative à `hra-ccf-body#VHFemale` avec translation (−39,745 ; 6,219 ; −86,192) mm, sans rotation ni échelle. C'est simplement le coin min de la bounding box de l'organe exprimé dans le repère corps. `/reference-organ-scene` renvoie la matrice inverse (translation 0,0397 ; −0,0062 ; 0,0862 m). `VHFemale` est défini à 1000 × 1000 × 200 mm, translaté de +400 mm en x dans `VHBothSexes` ([bodies.jsonld](https://cdn.humanatlas.io/digital-objects/graph/hra-ccf-body/v2.0/assets/bodies.jsonld)).

### BodyParts3D (mesuré dans les OBJ locaux)
- Repère : **mm, +Z vers le haut, +Y postérieur, +X à gauche du sujet.** Preuves : `FJ3288` « Left hip bone » (FMA16587) en x de +2,8 à +144,8 ; le sacrum `FJ3393` (y −81 → 7) est en arrière des os coxaux (y −139 → −1). Le repère est droit.
- BBox des 1 258 OBJ `obj_partof` : (−334,1 ; −246,8 ; −78,1) → (332,8 ; 45,2 ; 1641,4), soit une **hauteur de 1 719,5 mm**. `build/atlas.json` ne contient pas de bounding box.
- Bassin BP3D : os coxal G `FJ3288` (1 257 sommets) et D `FJ3152` (1 282), sacrum `FJ3393` (5 293). BBox : (−144,9 ; −139,1 ; 752,0) → (144,8 ; 7,3 ; 958,1).

### Repères pelviens (mêmes algorithmes sur les deux modèles, HRA converti en mm et dans les axes BP3D)
| Mesure (mm) | BP3D (homme) | HRA VH_F | HRA VH_M |
|---|---:|---:|---:|
| Distance inter-EIAS | 259,1 | 263,8 | 247,8 |
| Largeur max (crêtes iliaques) | 289,6 | 316,8 | 283,5 |
| Distance entre points ischiatiques les plus bas | 84,9 | **116,8** | 95,0 |
| Promontoire → symphyse | 120,7 | **143,0** | 138,0 |
| Hauteur crête → ischion | 206,1 | 209,4 | 218,5 |
| Inclinaison du plan EIAS–symphyse | 1,4° | 3,9° | 2,2° |

Les repères sont approximatifs : extrema de vertices (EIAS = point le plus antérieur de la moitié haute de l'os coxal ; symphyse = point pubien médian le plus antérieur ; promontoire = point le plus antérieur des 25 mm supérieurs du sacrum). Pour un recalage de production, il faut les poser à la main.

### Transformation estimée HRA féminin → BodyParts3D
Changement d'axes (rotation de +90° autour de X) et passage des m aux mm : `(x, y, z)_HRA → (1000·x, −1000·z, 1000·y)`. On applique ensuite une similitude ajustée par moindres carrés (Umeyama) sur 8 repères pelviens (EIAS G/D, crêtes G/D, ischions G/D, symphyse, promontoire) :

```
p_BP3D(mm) = s · R0 · (1000 · p_HRA(m)) + t
R0 = [[1,0,0],[0,0,-1],[0,1,0]]      s ≈ 0,932      t ≈ (11,8 ; −142,9 ; 802,3) mm
matrice 4×4 (entrée en mètres, colonnes) :
[ 932   0     0    11.8 ]
[  0    0  -932  -142.9 ]
[  0   932    0   802.3 ]
[  0    0     0      1  ]
```

- Une rotation résiduelle libre n'apporte que 0,9° : **le changement d'axes seul suffit**, les deux sujets ont la même orientation de bassin.
- Résidus : RMS **14,9 mm** ; promontoire 28,7, ischion G 16,3, ischion D 13,1, crêtes 6,7–13,4, EIAS 10–12, symphyse 6,6 mm. Ces écarts reflètent une vraie différence de forme : bassin féminin plus large en bas et plus profond. Le bruit des repères n'y est pour rien.
- **Une échelle uniforme sur tout le corps ne convient pas.** Le rapport des hauteurs vaudrait 1 719,5 / 1 658 = 1,037 (agrandir l'HRA), alors que le bassin demande 0,932 (le réduire) : le bassin féminin est plus grand que le bassin BP3D, sur un corps plus petit.
- **Le thorax demande un autre recalage.** Le sternum et le manubrium HRA, passés par la transformation pelvienne, tombent à la bonne hauteur (z 1179–1321 contre 1180–1325 chez BP3D, écart d'environ 4 mm), mais environ **4 cm trop en arrière** (centre y −129 contre −172). L'inclinaison sternale diffère aussi : l'extrémité inférieure avance de 42 mm chez l'HRA et de 67 mm chez BP3D. Il faut donc recaler les glandes mammaires sur le sternum, le manubrium et la paroi thoracique BP3D, séparément du bassin.
- Contrôle de collision après recalage pelvien :

| Organe | Distance min aux os BP3D (coxaux + sacrum) | Distance min à la vessie BP3D | Distance min au rectum BP3D | Distance min à la prostate BP3D |
|---|---:|---:|---:|---:|
| Utérus | 29,3 | 0,6 | 0,2 | — |
| Ovaire G | 14,3 | — | — | — |
| Ovaire D | 15,8 | — | — | — |
| Vessie HRA | 0,3 | 0,6 | — | 0,3 |

  Distances en mm. Les ovaires restent à 14–16 mm de la paroi osseuse (17,4 et 12,5 mm dans leur propre bassin). L'utérus touche la vessie et le rectum BP3D, dont la géométrie est masculine. Le centre de la vessie HRA est 26 mm plus antérieur que celui de la vessie BP3D.
- **Recommandation :** une similitude ancrée sur le bassin suffit pour une v1 du bloc pelvien (utérus, trompes, ovaires, vagin, ligaments). Il faut remplacer en bloc la vessie, le rectum et l'urètre BP3D par leurs équivalents HRA féminins pour éviter les interpénétrations. Le bassin, lui, doit soit rester le bassin BP3D masculin (incohérence assumée de la v1), soit être remplacé par `3d-vh-f-pelvis` recalé, avec une retouche aux jonctions L5/sacrum et à la tête fémorale. Un warp non rigide par landmarks (TPS) sur le bassin ne serait utile que pour la v2.

---

## 4. Identifiants portés par les GLB

- **Chaque nœud mesh porte des `extras`** : `label`, `ontologyid` (CURIE `UBERON:` ou `FMA:`), `representation_of` (URI OBO ou `purl.org/sig/ont/fma/`), `anatomical_structure_of` (ex. `#VHFUterus`), `source_spatial_entity` (`#VHFemaleOrgans`) et `glb_file_of_single_organs`. Certains nœuds de regroupement ont `"-"`. Le nom de nœud est un slug `VH_F_<nom>` sans identifiant.
- Chaque DO publie aussi `assets/crosswalk.csv` (`node_name,OntologyID,label`). Sur 793 nœuds des 45 crosswalks par organe : **282 FMA, 511 UBERON**, aucun sans identifiant. Le crosswalk united compte 874 nœuds, dont 103 absents des fichiers par organe.
- Incohérence observée : pour l'ovaire gauche, l'extra du GLB dit `FMA:7214` alors que `crosswalk.csv` dit `UBERON:0002119`. Il faut ingérer les deux et préférer le FMA quand il est latéralisé.
- **Jointure avec nos données :**
  - **98 identifiants FMA distincts** des crosswalks féminins correspondent déjà à un `ids.fma` (structure ou côté) de `data/structures`. Ce sont surtout des disques intervertébraux, des vaisseaux et des glandes salivaires.
  - **Aucun fichier `data/structures` ne renseigne `ids.uberon`** (0 occurrence). Pour les nœuds en UBERON, il faut une table de passage UBERON↔FMA (xrefs FMA d'UBERON, ou Wikidata P1554/P1402).
  - Les organes féminins n'ont évidemment pas de structure existante : il faudra créer `uterus`, `ovary`, `uterine-tube`, `vagina`, etc.
- Exemples :

| Nœud HRA | Identifiant | Correspondance dans notre modèle |
|---|---|---|
| `VH_F_left_ovary` | FMA:7214 (extra) / UBERON:0002119 (crosswalk) | à créer : `ovary`, côté `left` |
| `VH_F_uterus` | UBERON:0000995 | à créer : `uterus` (FMA 17558 à vérifier) |
| `VH_F_fundus_of_uterus` | FMA:17561 | à créer, parent `uterus` |
| `VH_F_isthmus_of_fallopian_tube_L` | FMA:18494 | à créer, partie de `uterine-tube` gauche |
| `VH_F_sacrum` | UBERON:0003690 | existant : `sacrum` (fma 16202), sans UBERON chez nous |
| `VH_F_urinary_bladder` | UBERON:0001255 | existant : `urinary-bladder` (FJ3149 = FMA15900) |
| `VH_F_intervertebral_disk_of_first_lumbar_vertebra` | FMA:16033 | existant : `intervertebral-disk-of-first-lumbar-vertebra` (jointure directe) |
| `VH_F_mammary_gland_L` | FMA:57991 | à créer : `mammary-gland`, côté `left` |

---

## 5. Structures BodyParts3D spécifiquement masculines (à masquer dans le modèle féminin)

Méthode : grep des slugs et labels de `data/structures/**/*.yaml` sur prostat, testi(cular), penis, scrot, seminal, deferent, epididym, spermatic, ejaculat, bulbourethral, cremaster. Les faux positifs « intestinal » ont été écartés. Résultat : **13 structures, 23 meshes.**

| Slug | Kind | Latéralité | FMA | Meshes |
|---|---|---|---|---|
| `testis` | organ | bilateral | 7210 | FJ3138, FJ3142 |
| `epididymis` | organ | bilateral | 18255 | FJ3136, FJ3141 |
| `deferent-duct` | organ | bilateral | 19234 | FJ3135, FJ3140 |
| `seminal-vesicle` | organ | bilateral | 19386 | FJ3137, FJ3143 |
| `prostate` | organ | midline | 9600 | FJ3139 |
| `glans-penis` | organ | midline | 18247 | FJ3134 |
| `corpus-cavernosum-of-penis` | organ | midline | 19618 | FJ3132 |
| `corpus-spongiosum-of-penis` | organ | midline | 19617 | FJ3133 |
| `testicular-artery` | artery | bilateral | 14758 | 2 |
| `dorsal-artery-of-penis` | artery | bilateral | 19795 | 4 |
| `testicular-vein` | vein | bilateral | 14344 | 2 |
| `deep-dorsal-vein-of-penis` | vein | midline | 21354 | 1 |
| `superficial-dorsal-vein-of-penis` | vein | bilateral | 21384 | 2 |

- **À traiter aussi, bien que non nommé « masculin » :** `urethra` (FJ3148, « Urethra » FMA19667, TA98 `A08.5.01.001M`). La géométrie est l'urètre masculin, z 708 → 792 mm, prolongé jusqu'à y −184 dans le pénis. Il faut le masquer, et le HRA n'a pas d'urètre féminin à mettre à la place.
- `urinary-bladder` (FJ3149) et `rectum` (FJ2571) sont des organes partagés mais de géométrie masculine, en conflit avec l'utérus recalé (§3). Il faut les remplacer par leurs équivalents HRA ou accepter le contact.
- `genital-system` (groupe, FMA 7160) n'a qu'un enfant déclaré, `prostate`. Les 10 autres structures génitales masculines n'ont pas de `parent`, ce qui est une dette de données à corriger avant d'introduire un filtre par sexe.
- Il n'y a pas de scrotum, de canal éjaculateur, de glande bulbo-urétrale ni de crémaster dans les données. FJ3132 et FJ3138 sont dans `obj_isa/` uniquement, pas dans `obj_partof/`.
- Les muscles du plancher pelvien BP3D (`puborectalis`, `pubococcygeus`, `iliococcygeus`, `tendinous-arch-of-levator-ani`, `external-anal-sphincter`) et `perineum` sont masculins par la forme. Le HRA ne fournit aucun équivalent féminin.

---

## 6. Autres sources ouvertes de morphologie féminine (2026)

- **TotalSegmentator CT v3.0.0** (2026-09-10) : 1 939 CT, 117 structures (os du bassin, fémurs, sacrum, muscles fessiers, ilio-psoas, vessie, prostate ; ni utérus ni ovaires), **CC BY 4.0**, 37,4 Go. Les métadonnées incluent le sexe (à vérifier dans `meta.csv`). — [Zenodo 22688904](https://zenodo.org/records/22688904). L'ancienne v2 (1 228 CT) reste en [Zenodo 10047292](https://zenodo.org/records/10047292), également CC BY 4.0.
- **TotalSegmentator MRI v3.0.0** (2026-09-10) : 1 296 IRM, 50 structures, **CC BY 4.0**, 15,2 Go. La v2 (616 IRM) était en CC BY-NC-SA 2.0. — [Zenodo 22688334](https://zenodo.org/records/22688334)
- **AMOS 2022** : 500 CT et 100 IRM, 15 organes abdominaux, dont une classe combinée « prostate/uterus » (à vérifier), **CC BY 4.0**, 24,2 Go. — [Zenodo 7155725](https://zenodo.org/records/7155725)
- **Visible Human Female (NLM)** : cryosections, CT et IRM, téléchargeables sans accord depuis 2019 avec crédit NLM. C'est la source même du HRA. — [NLM](https://www.nlm.nih.gov/research/visible/getting_data.html)
- **MakeHuman / MPFB2** : maillage de surface paramétrique féminin, sorties réputées CC0 (non vérifié dans cette session). Utile pour la silhouette ou la peau, pas pour l'anatomie interne.
- **Non ouverts**, à écarter : XCAT (licence commerciale), IT'IS Virtual Population (licence), Visible Korean/Chinese Human (accord requis), Z-Anatomy (masculin, BY-SA avec parties NC).

---

## Sources principales
- HRA API reference organs : https://apps.humanatlas.io/api/v1/reference-organs
- Catalogue DO : https://cdn.humanatlas.io/digital-objects/catalog.json ; collection v2.5 : https://cdn.humanatlas.io/digital-objects/collection/hra/v2.5/assets/digital-objects.yaml
- DO utérus (exemple) : https://lod.humanatlas.io/ref-organ/uterus-female/v1.2 (graph.ttl, assets/3d-vh-f-uterus.glb, assets/crosswalk.csv)
- United female v1.10 : https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb (DOI 10.48539/HBM637.DWBM.744)
- Corps CCF : https://cdn.humanatlas.io/digital-objects/graph/hra-ccf-body/v2.0/assets/bodies.jsonld
- Release notes v2.5 : https://github.com/hubmapconsortium/hra-ui/blob/main/apps/humanatlas.io/public/assets/content/release-notes-page/v2.5.yaml
- ccf-releases (figé à v2.0) : https://github.com/hubmapconsortium/ccf-releases
