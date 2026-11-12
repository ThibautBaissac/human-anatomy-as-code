# Human Anatomy As Code

Atlas 3D d'anatomie humaine, libre et utilisable hors ligne dans un navigateur. Il s'adresse à ceux qui apprennent l'anatomie. La connaissance anatomique (noms, identifiants, hiérarchie, couches, relations) est écrite en fichiers YAML versionnés dans `data/`. Elle est séparée de la géométrie qui l'illustre, les meshes de BodyParts3D et du Human Reference Atlas. Un nom corrigé ou une relation ajoutée passe donc par une revue de code, comme n'importe quel changement.

```
sources brutes (data/raw) → import → data/ (YAML versionné) → build/ (atlas JSON + modèles GLB) → app/ (Vite, PWA)
```

En ligne : https://thibautbaissac.github.io/human-anatomy-as-code/

## Lancer l'app

La version de Node exigée est dans [`package.json`](package.json) (`engines`).

```bash
npm install
```

Les sources brutes ne sont pas versionnées (`data/raw/` est ignoré). Pour BodyParts3D, télécharger depuis la page indiquée dans [`data/sources/bodyparts3d.yaml`](data/sources/bodyparts3d.yaml) les deux archives `isa_BP3D_4.0_obj_99.zip` et `partof_BP3D_4.0_obj_99.zip`, ainsi que les listes `*_parts_list_e.txt`, `*_element_parts.txt` et `*_inclusion_relation_list.txt`. Placer le tout dans `data/raw/bodyparts3d/`, puis décompresser chaque archive dans son dossier :

```bash
cd data/raw/bodyparts3d && unzip -q isa_BP3D_4.0_obj_99.zip -d obj_isa && unzip -q partof_BP3D_4.0_obj_99.zip -d obj_partof && cd -
```

Les organes du HRA se téléchargent avec :

```bash
npm run -w tools/hra fetch
```

Construire les atlas et les modèles dans `build/`, puis lancer l'app sur http://localhost:5174 :

```bash
npm run data && npm run assets
```

```bash
npm run dev
```

`npm run import` régénère `data/` depuis les sources brutes. Il ne sert qu'à changer de version de source ou à modifier l'import : les fichiers de `data/` sont la référence et ils sont relus à la main.

## Déployer sur GitHub Pages

```bash
npm run deploy:pages
```

Le script ([`app/scripts/deploy-pages.sh`](app/scripts/deploy-pages.sh)) construit l'app avec `HAAC_BASE=/human-anatomy-as-code/`, puis pousse `app/dist` en un seul commit sur la branche `gh-pages`. Le push est forcé : chaque déploiement remplace le précédent sans garder d'historique, car il pèse environ 60 Mo. Le site est construit à partir de `build/` tel qu'il est sur la machine, donc `npm run data && npm run assets` doivent être à jour avant.

Pages sert le site sous un sous-chemin, pas à la racine. Toute URL absolue dans l'app doit donc passer par `BASE` ([`app/src/offline/urls.ts`](app/src/offline/urls.ts)) ou par `import.meta.env.BASE_URL`. Un `'/assets/…'` écrit en dur marche en local et renvoie une 404 sur Pages. Les e2e tournent avec la base `/` et ne verront pas cette erreur. Pour tester sous le sous-chemin, lancer `npm run -w app build:pages`, puis :

```bash
HAAC_BASE=/human-anatomy-as-code/ npm run -w app preview
```

L'app est ensuite sur http://localhost:5174/human-anatomy-as-code/.

## Pour aller plus loin

- [`CONTEXT.md`](CONTEXT.md) : le vocabulaire du projet (structure, côté, relation, réseau…), à lire avant de toucher `data/` ou le code qui le lit.
- [`docs/adr/`](docs/adr/) : les décisions d'architecture et leurs raisons.
- [`data/LICENSE.md`](data/LICENSE.md) et [`docs/licence/`](docs/licence/) : la licence des données, celles des meshes, et les échanges en cours avec les sources.
