# Projets existants : paysage des atlas d'anatomie 3D interactifs (open source et commerciaux)

Notes rédigées le 2026-11-08. Métadonnées GitHub (stars, licence, dernier push) relevées le même jour via `gh api`. Les informations datées ou non vérifiées sur la source primaire sont signalées.

## 1. Viewers d'anatomie open source (web / desktop) : quoi, quelle licence, quelle stack, quelle activité ?

### Takeaway
Il n'existe aucun atlas web open source complet (male + female, plus de 6000 structures, coupes radiologiques, animations, quiz, offline). Le paysage se réduit à : (a) des jeux de données réutilisables (BodyParts3D, passé en CC BY 4.0 en 2025 ; Z-Anatomy, CC BY-SA 4.0 ; HRA CCF, CC BY 4.0, male et female mais au niveau organe ; atlas SPL/Open Anatomy) et (b) des viewers three.js récents mais partiels (ashemag/human-atlas, 4.5k stars, MIT, male uniquement, environ 2 234 meshes ; BodyVista, MIT, environ 2 900 structures). OABrowser (Open Anatomy) est abandonné depuis 2018.

### Cited Findings

**BodyParts3D / Anatomography (DBCLS, Japon) : socle de presque tous les projets libres**
- La licence officielle actuelle est **CC BY 4.0** (page de licence mise à jour le 2025-02-27). Attribution demandée : "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International". — [DBCLS License](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
- Avant cette date, la licence était CC BY-SA 2.1 Japan. Beaucoup de projets dérivés (Z-Anatomy, notamment) portent encore cette mention. — [Wikipedia Anatomography](https://en.wikipedia.org/wiki/Anatomography) ; [Z-Anatomy README](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- La version téléchargeable est BodyParts3D 4.0 (archives OBJ du type `isa_BP3D_4.0_obj_99.zip`, plus des tables texte des parties). La page ne mentionne aucun modèle féminin. — [DBCLS download](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)
- Chaque partie porte un identifiant FMA (Foundational Model of Anatomy), par exemple FMA13478 pour la colonne vertébrale. — [Wikipedia Anatomography](https://en.wikipedia.org/wiki/Anatomography)
- Il existe un miroir GitHub, Kevin-Mattheus-Moerman/BodyParts3D : 184 stars, licence repo MIT (les données gardent la licence DBCLS), dernier push en 2024-10. — [GitHub](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)

**Z-Anatomy (Gauthier Kervyn, Marcin Zielinski, Lluís Vinent)**
- Repo `Z-Anatomy/Models-of-human-anatomy` (l'ancien `Z-Anatomy/The-blend` redirige désormais vers lui) : template Blender, "Human male model", 289 stars, 67 forks, dernier push le 2026-11-07, donc actif. Les modèles dérivent de BodyParts3D, les définitions viennent de Wikipedia (CC BY-SA 3.0). Tout le contenu Z-Anatomy est sous **CC BY-SA 4.0**. — [GitHub Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- Certains modèles intégrés ont leur propre licence : Cranial Nerves (Univ. Dundee) en CC BY 4.0, Inner Ear (Dundee) en **CC BY-NC-SA 4.0**, Kidney (Lissie Cowley) en **CC BY-NC 4.0**. Ces sous-modèles NC sont incompatibles avec une réutilisation commerciale. — [GitHub Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- Traductions des noms de structures disponibles : portugais, espagnol, italien, polonais, persan. **Le français n'y figure pas.** — [GitHub Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- App PC/mobile en **Unity** (C#) : `LluisV/Z-Anatomy`, 410 stars, 75 forks, CC BY-SA 4.0, dernier push le 2024-12-25. Les modèles sont fournis en .blend et en FBX. — [GitHub LluisV/Z-Anatomy](https://github.com/LluisV/Z-Anatomy)
- APK Android v0.9.1 (Android 7 à 10) qualifiée d'ancienne version sur itch.io ; le Play Store sert Android 11 et plus. Langues listées : anglais et espagnol. — [itch.io Z-Anatomy](https://lluisv.itch.io/z-anatomy)
- Annoncé avec plus de 5 000 structures 3D labellisées et plus de 3 500 définitions (chiffre de 2022). — [CG Channel, 2022-05-26](https://www.cgchannel.com/2022/05/check-out-amazing-free-3d-anatomy-reference-z-anatomy/2/)
- Sur le forum Slicer, un utilisateur juge le projet inactif et restreint par la licence héritée de BodyParts3D. C'est une opinion individuelle, contredite par l'activité GitHub de 2026. — [Slicer Discourse](https://discourse.slicer.org/t/open-source-human-anatomy-atlas/17734?page=2)

**Open Anatomy Project / OABrowser (Harvard SPL, Michael Halle)**
- OABrowser : viewer web WebGL (three.js) en **Angular 1**, sans installation. Il affiche des modèles 3D, des coupes d'images labellisées, l'imagerie radiologique source et une hiérarchie textuelle des structures, avec signets et sessions de visualisation partagées (Firebase). — [Frontiers in Neuroinformatics 2017](https://www.frontiersin.org/journals/neuroinformatics/articles/10.3389/fninf.2017.00022/pdf) ; [openanatomy.org/technology](https://openanatomy.org/technology.html)
- Format d'atlas en **JSON-LD (draft)** : référence les fichiers d'imagerie et de géométrie sans les dupliquer, avec des concepts identifiés par URI et des métadonnées de style RDF. Le viewer n'est pas optimisé pour le mobile. — [openanatomy.org/technology](https://openanatomy.org/technology.html)
- Repo `mhalle/oabrowser` : 37 stars, aucune licence déclarée sur GitHub, **dernier push le 2018-10-04**, donc abandonné. — [GitHub](https://github.com/mhalle/oabrowser)
- Atlas SPL Head and Neck (CT) et Knee (MRI) : sous 3D Slicer License (section B), publiés en septembre 2015. Il existe aussi un atlas abdominal CT, dont la licence n'est pas confirmée. — [SPL Head and Neck Atlas](https://openanatomy.org/atlas-pages/atlas-spl-head-and-neck.html) ; [SPL Knee Atlas](https://www.openanatomy.org/atlas-pages/atlas-spl-knee.html) ; [SPL Abdominal Atlas](https://Openanatomy.org/atlas-pages/atlas-spl-abdomen.html)

**HuBMAP Human Reference Atlas (HRA), CCF 3D Reference Object Library**
- Les objets 3D de référence sont sous **CC BY 4.0**, au format GLB. La plupart des organes existent en **version male ET female**, avec des organes propres à chaque sexe (utérus, placenta, ovaires et trompes côté female ; prostate côté male). — [CCF 3D Reference Library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html)
- Historique des versions : v1.0 (mars 2021, 11 organes), v1.1 (décembre 2021), v1.2 (juin 2022, 25 entrées dont "All Organs (United)" par sexe). Le modèle du cerveau mappe 141 structures. Les organes sont liés aux termes Uberon et aux tables ASCT+B. — [CCF 3D Reference Library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html)
- L'article HRA de 2024 annonce 36 organes dans la release v2.0. — [PMC11142047](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11142047/)
- UI (EUI, RUI, ASCT+B Reporter) : monorepo `hubmapconsortium/hra-ui`, MIT, actif (push le 2026-11-06). Stack : **Angular 21, deck.gl 8.8, luma.gl 8.5, loaders.gl/gltf, three 0.172**. — [GitHub hra-ui](https://github.com/hubmapconsortium/hra-ui)

**Viewers three.js récents (2026)**
- `ashemag/human-atlas` : 4 501 stars, 1 185 forks, **MIT** (code), créé en 2026-09. Stack React, Three.js et shadcn/ui. Il découpe BodyParts3D 4.0 (male, CC BY 4.0) en 2 234 meshes sélectionnables, 15 systèmes et 3 432 concepts cherchables, avec vue éclatée, isolation et UI mobile. La géométrie compressée pèse environ 33 MB (2,29 M triangles). Rendu par batches fusionnés, avec textures GPU par structure (visibilité, sélection, translation) pour éviter des milliers de draw calls. Il propose des outils WebMCP optionnels et inclut des scripts de validation de l'atlas. — [GitHub ashemag/human-atlas](https://github.com/ashemag/human-atlas)
- `FreedomIntelligence/BodyVista` : 148 stars, **MIT**, créé en 2026-10 et actif. Annonce 2 900 structures, 12 systèmes, 140 démonstrations dynamiques, 6 sujets microscopiques, des quiz ("Anatomy Challenge", 5 questions par round), des coupes transverses, sagittales et coronales, du dessin et de la mesure. Interface en chinois, anglais et japonais. Stack JS ES modules, Three.js, GLTFLoader, three-mesh-bvh et Vite 7, déployé sur GitHub Pages sans backend. Labs biomécaniques en Python (MuJoCo, 740 unités musculo-tendineuses). — [GitHub BodyVista](https://github.com/FreedomIntelligence/BodyVista)
- `nqwrc/3d-anatomy` : 3 stars, environ 2 800 structures, sept systèmes, données Z-Anatomy (CC BY-SA), three.js vanilla. — [GitHub](https://github.com/nqwrc/3d-anatomy)
- `thebuggeddev/anatomy` : 3 883 stars, **aucune licence**, généré par IA, README de starter générique. Non réutilisable légalement. — [GitHub](https://github.com/thebuggeddev/anatomy)
- `genisis-lab/anatomy` : 0 star, aucune licence, 24 spécimens et des quiz. — [GitHub](https://github.com/genisis-lab/anatomy)

**Autres outils académiques open source**
- **OPANEX** (Open Anatomy Explorer, Université de Gand) : viewer d'atlas web, `biocat-ugent/Open-Anatomy-Explorer`, 13 stars, Apache-2.0, push en 2026-10. Il permet d'importer ses propres modèles. — [GitHub biocat-ugent](https://github.com/biocat-ugent/Open-Anatomy-Explorer) ; [anatomytool.org](https://anatomytool.org/node/63636)
- **EduAnat2** (CREATIS / INSA Lyon et IFÉ, France) : visualisation d'imagerie médicale (NIfTI) pour l'enseignement secondaire, en Electron, qooxdoo et DESK, avec une version web. Licence CeCILL-B. Repo `valette/eduAnat2` : 8 stars, dernier push en 2025-01. — [CREATIS](https://www.creatis.insa-lyon.fr/~valette/eduanat2.html) ; [GitHub](https://github.com/valette/eduAnat2)
- **SketchNote 3D** (Université de Genève) : outil web libre d'annotation 3D pour l'enseignement de l'anatomie. — [UNIGE](https://www.unige.ch/innovations-pedagogiques/innovations/sketchnote-3d)

### Inferences
- BodyParts3D est passé de CC BY-SA à CC BY 4.0 en 2025 : un projet peut partir de BodyParts3D 4.0 sans copyleft. Réutiliser Z-Anatomy (meilleur découpage, plus de 5 000 structures, labels multilingues) impose en revanche **CC BY-SA 4.0 sur les données dérivées**, et il faut exclure les sous-modèles NC (oreille interne, rein).
- HRA est la seule source libre, avec une licence permissive, de **géométrie female** de qualité. Elle reste au niveau organe, pas atlas gross anatomy (pas de muscles ni de nerfs détaillés). Pour obtenir un modèle female complet en open source, il faut le construire.
- Patterns techniques réutilisables : le rendu batché avec textures de visibilité de human-atlas (MIT) ; la recette de déploiement statique et les coupes de BodyVista (MIT) ; le format JSON-LD d'Open Anatomy (concept → géométrie), un précédent direct d'"anatomy as code".
- Les stars élevées de human-atlas et thebuggeddev/anatomy en 2026 (projets créés en quelques jours) montrent un fort intérêt, mais ces projets restent des démos sans profondeur pédagogique.

### Gaps
- Licence exacte et état de la version web de Z-Anatomy (z-anatomy.com charge une SPA non lisible par fetch) ; nombre réel de structures en 2026.
- Licence de l'atlas abdominal SPL non confirmée ; licence du repo OABrowser non déclarée sur GitHub (le papier parle d'une "liberal open source license").
- Aucune recherche faite sur Open3DModel ni sur des viewers Babylon.js spécifiques (rien de notable n'est remonté dans les recherches GitHub).
- Le contenu de la release HRA v2.x (male/female whole body ?) n'a pas été vérifié sur la page de la librairie, qui ne montre que la v1.2.

## 2. Outils de quiz et de spaced repetition en anatomie (open source) ; licences des decks Anki

### Takeaway
Aucun outil de quiz anatomique open source mature n'a été trouvé : les repos "anatomy quiz" sur GitHub sont des jouets à 0-2 stars. Anki est open source, mais les decks anatomie populaires (AnKing via AnkiHub) sont payants, sans licence ouverte, et les images d'atlas posent des problèmes de copyright. Un module quiz plus SRS intégré et ouvert serait différenciant.

### Cited Findings
- Recherche GitHub "anatomy quiz" : les meilleurs résultats ont 1 à 2 stars (ex. `Prajj-10/cardiac-sonography-anatomy-quiz`, `p4ngpond-rhael/anatomyQuiz`). — [GitHub search](https://github.com/search?q=anatomy+quiz&type=repositories)
- BodyVista inclut un "Anatomy Challenge" : identification de structures et "find in 3D", 5 questions par round. — [GitHub BodyVista](https://github.com/FreedomIntelligence/BodyVista)
- Anki est libre et open source ; les cartes créées appartiennent à l'utilisateur. — [Wikipedia Anki](https://wikipedia.com/wiki/Anki_(software)) ; [Anki docs](https://docs.ankiweb.net/ar/faqs/can-i-use-anki-in-a-company-or-school)
- AnKing (Overhaul) est distribué via AnkiHub, sur abonnement ; le cœur de la web app AnkiHub n'est pas open source (l'add-on l'est). — [AnkiHub FAQ](https://www.ankihub.net/faq)
- Des decks anatomie communautaires allemands ont retiré les images d'atlas pour des raisons de licence et de copyright (source Reddit, faible fiabilité). — [r/medicalschoolanki](https://libreddit.app.runonflux.io/r/medicalschoolanki/comments/mlymnc/ankiphil_v2_comprehensive_ambossbased_m1physikum/gtoakfb/?context=3)
- Une page wiki secondaire rapporte qu'en 2026 Damien Elmes transfère progressivement les opérations et la gouvernance open source d'Anki à AnkiHub (non vérifié sur source primaire). — [episteme.tllm.fr](https://episteme.tllm.fr/wiki/Anki)
- Kenhub (commercial) structure son offre autour des quiz, de l'active recall et de la spaced repetition, avec une interface en anglais, allemand, espagnol et français. — [Kenhub FR](https://www.kenhub.com/fr/pour-etudiants-en-kinesitherapie) ; [Kenhub review](https://www.kenhub.com/en/library/education/is-kenhub-worth-it-a-comprehensive-review)

### Inferences
- Un export Anki (.apkg) généré depuis les données "as code" (structure, nom FR/EN/latin, capture 3D CC BY) serait une intégration à faible coût et sans équivalent ouvert.
- Les images de structures rendues depuis des meshes CC BY ou CC BY-SA résolvent le problème de copyright des images d'atlas dans les decks.

### Gaps
- Aucune licence officielle trouvée pour un deck anatomie AnKing ou communautaire précis.
- Moodle, H5P et d'autres plateformes de quiz open source utilisées en anatomie n'ont pas été explorés.

## 3. Benchmarks commerciaux : fonctionnalités, prix, plateformes, structures, female, offline, radiologie, rendu web

### Takeaway
Les leaders (Complete Anatomy, Visible Body, BioDigital, Primal) revendiquent de 6 500 à plus de 17 000 structures. Tous ont désormais un modèle female : Complete Anatomy depuis 2022, Visible Body et Essential Anatomy aussi. Complete Anatomy et Primal proposent une corrélation radiologique (coupes, CT/MRI). Modèles économiques : abonnement (Complete Anatomy ~100 $/an, Kenhub 29 $/mois, BioDigital), achat unique mobile (Visible Body Atlas 24,99 $, Essential Anatomy ~20 $) ou licence institutionnelle (Primal, Visible Body Courseware). BioDigital tourne sur le web via un fork privé de SceneJS (WebGL) avec streaming et compression. Aucun n'est open source, et le français n'est souvent couvert que par l'interface.

### Cited Findings

**Complete Anatomy (Elsevier / 3D4Medical)**
- Plus de 17 000 structures interactives, 39 modèles microscopiques, coupes dynamiques, outils de dissection virtuelle, muscle motion, cartographie origines/insertions, mode AR, atlas de plus de 700 écrans, cours (dont "Female Anatomy with Alice Roberts"). — [App Store](https://apps.apple.com/app/id1054948424) ; [IntuitionLabs](https://intuitionlabs.ai/software/medical-education-platforms/anatomy-visualization-software/complete-anatomy)
- Modèle female complet sorti en 2022, présenté comme "pas un simple échange d'organes reproducteurs" ; volumes musculaires réduits d'environ 30 % selon la littérature. — [Elsevier Connect](https://www.elsevier.com/connect/tackling-bias-by-rethinking-human-anatomy-education) ; [Stanford Lane blog 2022-01](https://laneblog.stanford.edu/2022/01/14/new-female-model-available-in-complete-anatomy/)
- Pro License affichée à 99,99 $/an (agrégateur App Store, à vérifier) ; abonnement annuel. — [appshunter](https://appshunter.io/ios/app/complete-anatomy-for-ipad/id1054948424) ; [Elsevier support](https://www.elsevier.support/essential-anatomy/answer/whats-the-difference-between-essential-anatomy-5-and-complete-anatomy)
- Disponible en français depuis le 2022-07-22 (interface), mais les vidéos et cours restent en anglais. Inclut des quiz, la dissection virtuelle et la radiologie avec coupes interactives. Licences institutionnelle, professionnelle et étudiante. — [Elsevier FR](https://www.elsevier.com/fr-fr/connect/la-plateforme-3d-complete-anatomie-disponible-en-francais)
- Des avis App Store de janvier 2026 jugent le prix excessif. — [App Store](https://apps.apple.com/app/id1054948424)

**Essential Anatomy 5 (Elsevier)**
- Achat unique (19,99 $ sur iOS ; 15 $ selon AlternativeTo, probablement daté), 11 systèmes, 8 200 structures, modèles male et female. Achats séparés par plateforme (iOS, Mac, Android), licence personnelle. — [Elsevier support](https://www.elsevier.support/essential-anatomy/answer/whats-the-difference-between-essential-anatomy-5-and-complete-anatomy) ; [App Store](https://apps.apple.com/us/app/-/id596684220) ; [AlternativeTo](https://alternativeto.net/software/essential-anatomy-5/about)

**Visible Body**
- Human Anatomy Atlas 2026 : 24,99 $ sur l'App Store US (22,99 € en FR), achat unique, mis à jour le 2026-04-04, modèles 3D male et female complets ; contenus additionnels en in-app (7,99 à 19,99 $). Une édition 2027 est déjà listée. — [AppFollow](https://apps.appfollow.io/ios/human-anatomy-atlas-2026/1117998129?country=us) ; [App Store FR](https://apps.apple.com/FR/app/id1117998129) ; [apppricinglab](https://apppricinglab.com/app/apple/1117998129)
- Suite web/Courseware : plus de 24 000 assets visuels, modèles male et female, microanatomie, muscle actions ; fonctionne dans Chrome, Safari et Edge. L'atlas télécharge des modèles détaillés au premier lancement ; l'app mobile exige une réauthentification tous les 150 jours (pas un vrai offline durable). — [Visible Body librarians](https://visiblebody.com/librarians/overview) ; [Visible Body websuite help](https://www.visiblebody.com/help/websuite) ; [DMU library](https://lib.dmu.edu/db/visiblebody/mobile-app)
- Une étude de cas en bibliothèque médicale (JMLA, versions 2019) juge HAA trop limité pour un cursus en ligne, car chaque système s'y active ou se désactive en bloc, alors que Complete Anatomy offre plus de couches. — [PMC7069813](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7069813/)

**BioDigital Human**
- Plus de 8 000 structures sélectionnables individuellement et 600 conditions de santé simulées ; version gratuite et essai. — [GetApp](https://www.getapp.com/all-software/a/biodigital/)
- Prix Premium "9,99 $/mois ou 59 $/an" selon un agrégateur templaté (non fiable ; pricing.biodigital.com non récupéré). — [subger](https://subger.com/en/service/biodigital)
- Rendu web : **fork privé de SceneJS** (WebGL, sans plugin), utilisé depuis 2009 ; le fork de 2015 a ajouté un serveur de streaming d'assets, la compression de géométrie et de textures, le PBR et un pipeline de post-effets. L'anatomie complète tourne à environ 60 FPS après optimisations (article de 2018). — [xeolabs portfolio, 2018](https://xeolabs.github.io/portfolio/biodigital-human) ; [WebGL in Production (talk)](https://tsherif.github.io/upenn-biodigital) ; [Streaming Assets, 2016](https://tsherif.github.io/webglbof2016/slides.html)
- Intégration développeur : viewer embarqué en iframe, piloté par une API JavaScript fondée sur `postMessage` (ex. `human.send("camera.orbit", {yaw: 90})`). SDK iOS et Android en beta pour des partenaires choisis. — [BioDigital Viewer API](https://developer.biodigital.com/docs/widget/getting-started/overview) ; [Android HKHuman](https://developer.biodigital.com/pages/documentation/2/android-sdk-docs/2.75.1/com/biodigital/humansdk/HKHuman.html)

**Primal Pictures (Anatomy.tv, Informa)**
- Atlas 3D du corps entier en 9 régions, plus de 6 500 structures (selon un libguide), couches ajoutables ou retirables, rotation à 360°, labels. Corrélation **CT/MRI** et ultrasons avec les modèles 3D ; produit "CT and MRI Thorax, Abdomen and Pelvis" ciblant la radiologie. Quiz, vidéos cliniques. Accès surtout institutionnel. — [Primal radiologist](https://www.primalpictures.com/professions/radiologist/) ; [Primal CT/MRI](https://primalpictures.com/product/ct-and-mri-thorax-abdomen-and-pelvis) ; [York libguide](https://researchguides.library.yorku.ca/neuroscience/primal)

**Kenhub**
- Gratuit (atlas et articles) ; Premium à partir de 29 $/mois (prix officiel), 14 $/mois selon un agrégateur. Plus de 5 000 illustrations HD (2D) à labels interactifs ; quiz, active recall et spaced repetition. Langues : EN, DE, ES, FR. La 3D est contestée selon les revues. — [Kenhub pricing](https://www.kenhub.com/en/pricing) ; [Kenhub DE](https://www.kenhub.com/de/pricing) ; [GetBodySmart](https://www.getbodysmart.com/best-anatomy-apps/)

**Anatomy.app (Anatomy Next Inc.)**
- À partir de 8,99 $/mois/utilisateur, essai gratuit ; modèles 3D, articles et quiz liés. Langues non confirmées. — [SourceForge](https://www.sourceforge.net/software/product/Anatomy.app)

**Innerbody**
- Ressource web gratuite ; Common Sense Media juge la 3D "plutôt réaliste" au niveau macro mais inutilisable en détail. — [Common Sense Media](https://www.commonsensemedia.org/website-reviews/innerbody)

### Inferences
- Le seuil de crédibilité en nombre de structures est autour de 6 500 à 8 000 (Primal, BioDigital, Essential Anatomy) ; l'objectif de plus de 6 000 du projet est cohérent avec le milieu de gamme. Complete Anatomy (plus de 17 000) reste hors de portée initiale.
- Le modèle female est devenu un standard commercial depuis 2022, mais reste absent de tout l'open source (seul HRA le couvre, au niveau organe).
- Le vrai offline est rare : Visible Body impose des réauthentifications périodiques, et les apps desktop exigent des téléchargements initiaux. Une PWA réellement offline et sans compte est un différenciateur.
- L'architecture de BioDigital (streaming, compression, iframe plus API postMessage) est une référence pour le chargement progressif et l'embed ; aujourd'hui, on la transposerait en glTF, Draco/Meshopt, KTX2 et three.js.

### Gaps
- Prix officiels 2026 de BioDigital, Complete Anatomy (page store officielle) et Primal non vérifiés sur source primaire.
- Le support offline effectif de Complete Anatomy et d'Essential Anatomy n'est pas confirmé.
- Nombre de structures du modèle female par rapport au male chez chaque vendeur non trouvé.
- Langues d'Anatomy.app et présence de coupes radiologiques chez Visible Body non vérifiées.

## 4. Littérature académique : efficacité des outils 3D web et fonctionnalités requises

### Takeaway
Les méta-analyses montrent un gain modéré des scores aux tests et une nette hausse de la satisfaction, mais pas de gain de temps ; elles signalent un biais régional. Les fonctionnalités valorisées dans les études et revues sont les couches fines (plutôt qu'un système on/off), les labels, la recherche, le dessin, les quiz et l'intégration hybride avec l'enseignement classique.

### Cited Findings
- Wang et al., BMC Medical Education 2024 : méta-analyse de 39 RCT (2 959 participants). La visualisation 3D améliore modérément les scores et la satisfaction, sans réduire le temps de test. Sans la littérature chinoise, les résultats ne sont plus significatifs (biais régional). — [BMC Med Educ 2024](https://bmcmededuc.biomedcentral.com/counter/pdf/10.1186/s12909-024-05403-4.pdf)
- Yammine & Violato 2015 (Anat Sci Educ) : la 3D améliore les connaissances factuelles (d = 0,30) et davantage les connaissances spatiales (d = 0,50). Étude ancienne. — cité via [BMC Med Educ 2024](https://bmcmededuc.biomedcentral.com/counter/pdf/10.1186/s12909-024-05403-4.pdf)
- Bandekar et al., Translational Research in Anatomy 2025 : revue systématique de 18 études. Les modules en ligne, notamment avec modèles 3D et labs virtuels, sont une alternative bénéfique, surtout quand ils sont interactifs et hybrides. — [Manipal](https://researcher.manipal.edu/en/publications/the-impact-of-online-educational-modules-on-learning-musculoskele/)
- Enquête espagnole de 2025 (Education Sciences, MDPI) sur 88 étudiants en sciences de la santé : 74,2 % utilisent des apps 3D d'anatomie, jugées utiles pour l'apprentissage et la motivation ; Complete Anatomy et Visible Body sont cités en tête. — [MDPI Educ Sci 2025](https://www.mdpi.com/2227-7102/15/3/277/html)
- Étude de cas JMLA (cursus hybride de kinésithérapie) : grille comparant couches, labels, recherche et outils de dessin ; Complete Anatomy est préféré pour la granularité des couches. — [PMC7069813](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7069813/)
- Odogwu et al., Cureus 2025 : revue PRISMA sur la simulation VR en anatomie (2019-2024). — [Cureus 2025](https://assets.cureus.com/uploads/review_article/pdf/356966/20250408-76289-lkvvo1.pdf)

### Inferences
- L'effet le plus robuste porte sur la compréhension spatiale : la dissection couche par couche et les coupes corrélées au 3D sont les fonctionnalités à prioriser.
- L'intégration hybride (export, embed, liens profonds vers une vue précise) compte autant que le viewer lui-même pour l'adoption par les enseignants.

### Gaps
- Aucune étude rigoureuse trouvée sur un outil 3D web open source spécifique, ni d'étude comparative directe entre Complete Anatomy et Visible Body.
- Aucune étude peer-reviewed mesurant le biais "male par défaut" dans les logiciels 3D (seulement des sources vendeur).

## 5. Initiatives "anatomy as data / as code" (fichiers structurés versionnés, contributions communautaires)

### Takeaway
Les briques sémantiques existent : ontologies FMA et Uberon versionnées sur GitHub, TA98 en SQLite, viewer TA2, format JSON-LD Open Anatomy, tables ASCT+B HRA liées à Uberon. En revanche, aucun projet ne combine géométrie, nomenclature multilingue, hiérarchie, contenus pédagogiques et quiz dans un dépôt versionné ouvert aux contributions. C'est le créneau "Human Anatomy As Code".

### Cited Findings
- Open Anatomy : format d'atlas JSON-LD (draft) liant des concepts URI à la géométrie et à l'imagerie ; export depuis 3D Slicer en cours (statut ancien). — [openanatomy.org/technology](https://openanatomy.org/technology.html)
- HRA : objets 3D GLB liés aux termes Uberon et aux tables ASCT+B (anatomical structures, cell types, biomarkers), avec un mapping CSV ASCT+B vers modèles 3D. — [CCF 3D Reference Library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html) ; [PMC11142047](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11142047/)
- Uberon : ontologie d'anatomie (métazoaires) sur GitHub, 169 stars, très active (push le 2026-11-08) ; licence marquée "other" par GitHub. — [GitHub obophenotype/uberon](https://github.com/obophenotype/uberon)
- Terminologia Anatomica 2 (FIPAT, 2019) : sous **CC BY-ND 4.0** ; les termes individuels sont considérés comme du domaine public ; une œuvre dérivée nécessite l'autorisation du chair FIPAT. La diffusion d'une version machine-readable était encore "en discussion" (note de l'époque 2019). — [FIPAT TA2](https://fipat.library.dal.ca/TA2) ; [TA2 Front Matter](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Front-Matter.pdf)
- TA2 Viewer (projet conjoint IFAA et Open Anatomy). — [ta2viewer.openanatomy.org](https://ta2viewer.openanatomy.org)
- `mhalle/ta98-sqlite` : TA98 en SQLite, 9 stars, licence "other", push en 2026-03. `mhalle/taviewer` : navigateur fondé sur TA98, push en 2025-05. — [GitHub ta98-sqlite](https://github.com/mhalle/ta98-sqlite) ; [GitHub taviewer](https://github.com/mhalle/taviewer)
- FMA : seule licence trouvée, un texte custom libéral (reproduction, modification, distribution libres de redevances) cité dans un post de 2006. Le statut actuel n'est pas vérifié. — [W3C list 2006](https://lists.w3.org/Archives/Public/public-semweb-lifesci/2006Dec/0052.html)
- human-atlas inclut des scripts de validation de l'atlas (buffers, noms, appartenance aux concepts, layouts) et un pipeline reproductible OBJ → optimisation → compression. C'est un précédent d'"atlas validé en CI". — [GitHub ashemag/human-atlas](https://github.com/ashemag/human-atlas)

### Inferences
- Clés de jointure naturelles pour un modèle "as code" : les identifiants FMA (déjà portés par BodyParts3D) et Uberon (portés par HRA), plus les identifiants TA98/TA2 pour la nomenclature latine et multilingue.
- La licence CC BY-ND de TA2 empêche de redistribuer une version modifiée de TA2. Il est plus sûr de référencer des identifiants et des termes individuels (domaine public selon FIPAT) que d'embarquer le corpus.

### Gaps
- Licence actuelle exacte d'Uberon et de la FMA non vérifiée sur source primaire (Uberon est généralement documentée en CC BY 4.0, ce qui reste à confirmer).
- Aucune initiative communautaire de type "Wikidata de l'anatomie 3D" avec géométrie versionnée n'a été trouvée ; à confirmer par une recherche dédiée Wikidata/Wikimedia Commons (Commons héberge des STL BodyParts3D).

## 6. Manques du marché : open source, français, offline, anatomie féminine

### Takeaway
Plusieurs manques se cumulent : (1) aucun atlas web open source complet ; (2) aucun modèle female gross anatomy libre (HRA ne couvre que les organes) ; (3) le français est absent des traductions Z-Anatomy et ne couvre que l'interface chez Complete Anatomy ; (4) le vrai offline sans compte est rare ; (5) aucun module quiz plus SRS ouvert ; (6) aucun pipeline "anatomy as code" versionné et contributif.

### Cited Findings
- Aucune application à la fois française, gratuite et open source pour les étudiants en médecine n'a été trouvée ; les pistes libres existantes (EduAnat2, SketchNote 3D, OPANEX) sont de niche ou institutionnelles. — [CREATIS EduAnat2](https://www.creatis.insa-lyon.fr/~valette/eduanat2.html) ; [UNIGE SketchNote 3D](https://www.unige.ch/innovations-pedagogiques/innovations/sketchnote-3d) ; [OPANEX GitHub](https://github.com/biocat-ugent/Open-Anatomy-Explorer)
- Traductions de Z-Anatomy : PT, ES, IT, PL, persan, sans le français. — [GitHub Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- Complete Anatomy en français (2022) : interface uniquement, cours en anglais. — [Elsevier FR](https://www.elsevier.com/fr-fr/connect/la-plateforme-3d-complete-anatomie-disponible-en-francais)
- BodyParts3D et Z-Anatomy sont des modèles male ; human-atlas est male uniquement. — [GitHub Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) ; [GitHub human-atlas](https://github.com/ashemag/human-atlas)
- Elsevier présente l'anatomie féminine comme historiquement sous-représentée et le modèle female longtemps réduit à un échange d'organes reproducteurs (source vendeur). Un développeur 3D (LinkedIn, anecdotique) note que les références de qualité pour les structures female sont bien plus rares. — [Elsevier Connect](https://www.elsevier.com/connect/tackling-bias-by-rethinking-human-anatomy-education)
- Visible Body : réauthentification tous les 150 jours sur mobile et connexion annuelle obligatoire pour Courseware. — [DMU library](https://lib.dmu.edu/db/visiblebody/mobile-app) ; [Touro libguide](https://touromed.libguides.com/VisibleBody)

### Inferences
- Positionnement défendable pour le projet : premier atlas 3D web **libre, francophone d'abord (FR/EN/latin TA), offline-first (PWA sans compte), male + female**, avec données versionnées et contributions par PR.
- Le principal risque est de produire la géométrie female gross anatomy (muscles, vaisseaux, nerfs) sous licence libre. Pistes : adapter BodyParts3D male (CC BY 4.0) en s'appuyant sur les organes HRA female (CC BY 4.0), puis faire valider par des anatomistes. C'est un chantier de modélisation, pas de code.
- Pour les coupes radiologiques, les atlas SPL (CT/MRI, 3D Slicer License) et le précédent OABrowser (coupes plus 3D plus hiérarchie) sont les seuls points de départ libres identifiés ; l'imagerie corrélée à un corps entier n'existe pas en libre.

### Gaps
- Aucune donnée de marché (nombre d'étudiants francophones, budgets) collectée.
- La disponibilité d'un jeu d'imagerie CT/MRI corps entier libre (ex. Visible Human Project, licence NLM) pour des coupes corrélées n'a pas été vérifiée dans le cadre de cette recherche.
