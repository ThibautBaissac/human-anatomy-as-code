# Spikes — résultats (2026-11-08)

Trois tests techniques avant d'écrire l'UI, définis dans `reports/Choix techniques atlas anatomie 3D.md`.
Données : BodyParts3D 4.0 (DBCLS), 2 234 meshes (`isa` + `partof`, version décimée « 99 »).
Machine de mesure : Mac Apple Silicon (Metal 3), Chrome headless. **Aucune mesure sur téléphone réel.**

## Synthèse

| Test | Verdict | Conséquence |
|---|---|---|
| 1. Noms FR / latin via Wikidata | ⚠️ Partiel : 71 % FR, 46 % latin (structures à mesh unique) | Wikidata = point de départ, pas la source finale. Curation nécessaire, latin surtout. |
| 2. `BatchedMesh` | ✅ Desktop (WebGPU ≈ 3–4 ms/frame pour 2 234 structures) · ⚠️ Fallback WebGL2 2× plus coûteux en CPU | Viable. Mesure sur iPhone / Android milieu de gamme indispensable avant de figer. |
| 3a. Étanchéité des meshes | ✅ 99 % fermés (2 215 / 2 234) | Le capping fonctionne tel quel. 19 meshes à réparer. |
| 3b. Coupes + capping | ✅ Stencil + `ClippingGroup` fonctionne sous WebGPU **et** WebGL2 | Risque n°1 du rapport levé (sur desktop). |

## 1. Couverture Wikidata (FMA → FR / latin)

Script : `01-wikidata-coverage/analyze.py`. Requête SPARQL de tous les items Wikidata ayant un FMA ID (P1402), soit 79 681 lignes.

**Direct** (FMA ID exact) :

| Ensemble | N | Dans Wikidata | TA2 ID | Label FR | Label LA |
|---|---|---|---|---|---|
| Tous concepts | 3 432 | 100 % | 26 % | 36 % | 17 % |
| Concepts feuilles | 1 682 | 100 % | 14 % | 15 % | 7 % |
| Concepts à mesh unique | 1 507 | 100 % | 11 % | 13 % | 6 % |

**Après repli sur la latéralité** (« left femur » → « femur » + suffixe de côté) :

| Ensemble | N | Label FR | Label LA |
|---|---|---|---|
| Tous concepts | 3 432 | 65 % | 37 % |
| Concepts feuilles | 1 682 | 70 % | 45 % |
| Concepts à mesh unique | 1 507 | **71 %** | **46 %** |

Constats :
- 81 % des structures à mesh unique sont latéralisées. Wikidata a « fémur », pas « fémur gauche ». La latéralité doit donc être un **attribut** du modèle de données (`side: left|right`), et non un concept séparé.
- Accord grammatical : en français, « gauche » est invariable mais « droit / droite » s'accorde ; en latin, *dexter / dextra / dextrum*. Le genre de chaque terme doit être stocké.
- 439 structures sans label FR (`out/missing_fr.txt`) : surtout des branches vasculaires fines, des segments hépatiques et des sous-parties de muscles.
- Sortie réutilisable pour amorcer les données : `out/structures_labels.csv` (FMA, nom EN, fichiers mesh, QID, TA2, TA98, FR, LA).

## 2. Benchmark `BatchedMesh`

Pages : `viewer/bench.html` (`?mode=batched|meshes`, `?backend=webgl`, `?auto=1`). Runner : `viewer/scripts/run-bench.mjs`.
Rotation caméra de 5 s par scénario, canvas 2560×1600 (DPR 2). Structures regroupées en 8 `BatchedMesh` par classe de matériau.

**Jeu complet : 2 234 structures, 6,68 M triangles**

| Variante | Toutes opaques | 50 % masquées | X-ray | Squelette seul | Draw calls | Chargement | Picking (médiane) |
|---|---|---|---|---|---|---|---|
| Batched WebGPU | 3,8 ms | 2,1 ms | 4,1 ms | 1,0 ms | 2 235 | 2,7 s | 0,5 ms |
| Batched WebGL2 | 8,3 ms | 7,1 ms | 8,1 ms | 4,4 ms | 9 | 2,6 s | 0,6 ms |
| Meshes séparés WebGPU | 7,3 ms | 4,1 ms | 7,2 ms | 1,4 ms | 2 235 | 0,2 s | 8,9 ms* |

Les durées sont des temps moyens de frame. *Picking des meshes séparés sans BVH (non câblé dans le spike).
Fichiers bruts : `02-batchedmesh/bench_desktop_full.json` et `bench_desktop.json` (sous-ensemble de 1 258 meshes).

Constats :
- **En WebGPU, three r187 ne fait pas de multi-draw** : un draw call par instance visible (2 235). Le batching apporte quand même 2× par rapport aux meshes séparés, car il économise les changements d'état et de bind groups.
- **En WebGL2, `WEBGL_multi_draw` réduit à 9 draw calls**, mais le coût CPU double par rapport à WebGPU (8 ms). Sur un téléphone sans WebGPU (Firefox Android, iOS < 26), c'est le chemin à surveiller.
- **Le chargement coûte cher** : 2,7 s sur desktop, contre 0,2 s pour les meshes séparés, dues à la construction du BVH et à la copie dans le batch. Avec un throttling CPU ×4, le chargement passe à 5,2 s pour 1 258 meshes. À faire : BVH précalculé au build, ou construit dans un Web Worker.
- Masquer des structures fait réellement baisser le coût, puisque les draw calls diminuent.
- Le throttling CPU de Chrome ne ralentit pas le rendu de façon réaliste : il ne sert pas d'approximation mobile.

## 3a. Étanchéité des meshes

Script : `viewer/scripts/watertight.mjs`. Un mesh est « fermé » s'il n'a aucune arête de bord et aucune arête non-manifold, après soudure des sommets à coordonnées identiques.

| Classe | Meshes | Fermés | Ouverts |
|---|---|---|---|
| artery | 593 | 592 | 1 |
| muscle | 378 | 373 | 5 |
| vein | 375 | 374 | 1 |
| bone | 369 | 369 | 0 |
| organ | 310 | 301 | 9 |
| nerve | 136 | 136 | 0 |
| cartilage | 51 | 51 | 0 |
| ligament | 22 | 19 | 3 |
| **Total** | **2 234** | **2 215 (99 %)** | **19** |

Les 19 défauts sont presque tous des arêtes non-manifold, peu nombreuses (1 à 8 par mesh). Liste complète dans `03-watertight/watertight_all.md`.

## 3b. Coupes axiale / coronale / sagittale + capping

Page : `viewer/clip.html` (`?cap=backface|stencil|none`, `?backend=webgl`). Captures : `03-clipping/*.png`.

| Stratégie | WebGPU | WebGL2 | Rendu | Limites |
|---|---|---|---|---|
| `ClippingGroup` seul | ✅ | ✅ | Structures creuses | — |
| Caps back-face (TSL `frontFacing`) | ✅ | ✅ | On voit l'intérieur ombré, avec une teinte par classe | Pas un vrai plan de coupe. Les meshes ouverts laissent voir à travers. |
| Caps stencil (`overrideMaterial` + plan stencil) | ✅ | ✅ | Faces de coupe pleines et nettes (vertèbres, organes, muscles) | Une couleur unique, un seul plan par passe dans le spike. Une couleur par classe demande une passe par classe. |

Captures clés : `clip_stencil_sagittal.png`, `clip_stencil_axial.png`, `clip_backface_sagittal.png`.

## Autres constats

- **Licence BodyParts3D : incohérence.** La page DBCLS (mise à jour le 2025-02-27) indique CC BY 4.0, mais **chaque fichier OBJ porte encore en en-tête « CC Attribution-Share Alike 2.1 Japan »**. Avant de publier des assets dérivés sous CC BY 4.0, demander une confirmation écrite au DBCLS.
- **Taille** : 6,68 M triangles donnent 183 MB en GLB brut et **37,4 MB après quantize + meshopt**. Les classes servent de packs offline naturels (muscles 12,7 MB, os 6,2 MB, etc.).
- **Piège gltf-transform** : `normals()` génère des normales *plates*, ce qui retire les indices et triple les sommets. Les normales lisses sont calculées dans `build-assets.mjs`.
- **Fichiers `FJxxxxM.obj`** : variantes miroir (côté gauche) référencées dans les listes d'éléments. Il faut les inclure.
- La classification par mots-clés (classe de matériau) est approximative (ex. « descending part of trapezius » classé `organ`). Le vrai projet doit porter le système anatomique dans ses données, pas le deviner.

## Reste à faire : test sur téléphone

Le serveur Vite écoute sur le réseau local. Sur un téléphone connecté au même Wi-Fi :

- `http://192.168.1.80:5173/bench.html?auto=1` : le benchmark démarre seul, et le JSON s'affiche en bas à droite au bout d'environ 25 s.
- `http://192.168.1.80:5173/bench.html?auto=1&backend=webgl` : chemin de repli.
- `http://192.168.1.80:5173/clip.html?cap=stencil` : coupes.

WebGPU exige un contexte sécurisé. Sur une IP locale en HTTP, le navigateur bascule automatiquement sur WebGL2. Pour tester WebGPU sur téléphone, il faut du HTTPS (par exemple `vite --https` avec un certificat local, ou un tunnel).

## Reproduire

```bash
cd spikes/viewer
npm install
npm run assets -- ../../data/raw/bodyparts3d ../../data/raw/bodyparts3d public/assets
npm run watertight -- ../../data/raw/bodyparts3d ../../data/raw/bodyparts3d ../03-watertight/watertight_all.md
npm run dev
node scripts/run-bench.mjs http://localhost:5173 ../02-batchedmesh/bench.json
node scripts/shot-clip.mjs http://localhost:5173 ../03-clipping
```

Données sources (873 MB, non versionnées) : `data/raw/bodyparts3d/`, téléchargées depuis https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
