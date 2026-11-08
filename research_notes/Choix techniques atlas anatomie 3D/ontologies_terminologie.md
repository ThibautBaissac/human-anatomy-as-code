# Ontologies et terminologies anatomiques pour un atlas 3D "anatomy as code" (FR / EN / Latin)

Research date: 2026-11-08. Wikidata counts below were obtained live from the public SPARQL endpoint (https://query.wikidata.org/sparql) on 2026-11-08 and will drift. Several official sites were unreachable during research (sig.biostr.washington.edu: connection refused; fipat.library.dal.ca: DNS failure; bioportal.bioontology.org: HTTP 403), so some claims rely on registries, GitHub, search-result snippets, or PDFs hosted on cdn.dal.ca. These are flagged.

## FMA (Foundational Model of Anatomy): license, maintenance status, formats, size, BodyParts3D/Z-Anatomy mapping

### Takeaway
FMA is still alive, though barely. The University of Washington SIG GitHub repo published release 5.1.0 on 2026-05-15 under CC BY 4.0, an OWL file that is now coherent under EL reasoning. Registries disagree: OBO Foundry lists it as "inactive" with a "custom" license, Bioregistry flags it "deprecated", and the BioPortal entry is stale. FMA is the native ID space of BodyParts3D (file names `FMA<id>.stl`), so it is the natural join key for the 3D meshes.

### Cited Findings
- GitHub repo `uw-sig/FMA` ("Development repository for the Foundational Model of Anatomy"): not archived, license reported as CC-BY-4.0, last push 2026-05-15, last metadata update 2026-09-20 — [GitHub uw-sig/FMA](https://github.com/uw-sig/FMA) (queried via GitHub API 2026-11-08)
- Release tag `5.1.0`, published 2026-05-15: "This version of the FMA attempts to update version 5.0.0 to make it consistent under EL reasoning (tested in ELK)". Details in `docs/Fixing_reasoning_in_the_FMA_revised.pdf`. ChangeLog: the version "is now coherent under EL reasoning in Protege… no classes that are equivalent to owl:Nothing", fixes by Todd Detwiler — [GitHub uw-sig/FMA releases](https://github.com/uw-sig/FMA/releases)
- The repo's LICENSE file is the full Creative Commons "Attribution 4.0 International" text — [GitHub uw-sig/FMA LICENSE](https://github.com/uw-sig/FMA/blob/main/LICENSE)
- Repo contents: `fma.owl` (main classes, loadable in Protégé) and `pun_fma.owl` (OWL individuals "punned" from the classes, to make SPARQL easier). In the repo, both files are Git LFS pointers of about 134 bytes, so a clone needs `git lfs` — [GitHub uw-sig/FMA README](https://github.com/uw-sig/FMA)
- OBO Foundry: "This ontology is inactive". License "CUSTOM", pointing to http://sig.biostr.washington.edu/projects/fm/FMA_Release. The bespoke OBO-format translation is deprecated. PURLs: `http://purl.obolibrary.org/obo/fma.owl` and `http://purl.org/sig/ont/fma.owl` (official). Contact: Onard Mejino — [OBO Foundry FMA](https://obofoundry.org/ontology/fma.html)
- Bioregistry: status **Deprecated**, version 5.1.0, license **CC-BY-4.0**, repository github.com/uw-sig/FMA, OWL at http://purl.org/sig/ont/fma.owl. Contacts: Mejino, Brinkley, Detwiler — [Bioregistry FMA](https://bioregistry.io/fma)
- BioPortal (from a search snippet; the page itself returned 403): status "Production", last upload 2019-05-13, newest listed version 4.12.0 (2018), "made available via the UMLS… must abide by the terms of the UMLS license". A version 5.1.0 page reportedly has an empty License field — [BioPortal FMA summary](https://bioportal.bioontology.org/ontologies/FMA/?p=summary) (not directly verified)
- An older license statement: the 2006 open-source announcement described a "perpetual, royalty-free" copyright license, not a named CC license — [LinuxMedNews 2006](https://linuxmednews.com/index.php/2006/11/17/foundational-model-of-anatomy-fma-ontology-released-as-open-source). SciCrunch lists "Creative Commons Attribution License, v3 Unported" — [SciCrunch RRID:SCR_003379](https://scicrunch.org/scicrunch/data/record/nlx_144509-1/SCR_003379/resolver/pdf&i=rrid:scr_003379)
- Size: about 75,000 classes, more than 120,000 terms, over 2.1 million relationship instances, more than 168 relationship types — [Wikipedia: Foundational Model of Anatomy](https://en.wikipedia.org/wiki/Foundational_Model_of_Anatomy). The same article notes that the online FMA browser failed when tested on 14 Oct 2025 and again on 15 Dec 2025.
- OWL2 conversion paper (2016): Detwiler, Mejino and Brinkley argue that their OWL2 conversion should become the official release. They call it the only complete OWL version that classifies under an EL reasoner, maintained by the FMA authors — [PMC4915823](https://pmc.ncbi.nlm.nih.gov/articles/PMC4915823)
- French portal HeTOP (CHU Rouen) hosts FMA version 5.0, with FR/EN browsing — [HeTOP FMA (fr)](https://cispro.chu-rouen.fr/hetop/rep/fr/FMA/)
- BodyParts3D: "Each body part is managed by an FMA identifier (FMAID)". Files are named `FMA<FMAID>.stl`, and a "BP…" ID is assigned when no FMA concept matches. License: "BodyParts3D, Copyright© 2008 The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan" — [BodyParts3D README (2011-09-15 release)](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/README_e.html)
- Z-Anatomy: content and code under CC BY-SA 4.0, models derived from BodyParts3D — [GitHub Z-Anatomy/Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy). Its labels follow TA2 (2019) — [Interoperable Europe: 3D Anat](https://interoperable-europe.ec.europa.eu/collection/ehealth/solution/3d-anat). The repo was still being pushed to on 2026-11-07 (GitHub API). The API reports its license as NOASSERTION, meaning no machine-detectable license file.
- A 3D Slicer forum user could not find individual vertebrae in the Z-Anatomy TA2 browser, although an FMA code exists (T5 = FMA9922). This suggests Z-Anatomy exposes TA2 names but not FMA IDs — [Slicer forum](https://discourse.slicer.org/t/open-source-human-anatomy-atlas/17734?page=2) (anecdotal)

### Inferences
- The CC BY 4.0 license in the official SIG repo is the strongest and most recent license evidence. It supersedes the "custom" label on OBO Foundry and the "UMLS license" note on BioPortal, which both look stale. Pin the release (tag 5.1.0) and keep a copy of the LICENSE in the project.
- Maintenance amounts to bug-fix releases by a small team (reasoning fixes in 2026). Expect no new content or anatomical revisions. Treat FMA as a stable, frozen ID space rather than a living source.
- Because BodyParts3D meshes carry FMA IDs in their file names, FMA is the cheapest join key between geometry and semantics. Z-Anatomy meshes inherit BodyParts3D geometry, but FMA IDs may need to be recovered by name matching or through Wikidata (TA2 to FMA).
- Share-alike (BodyParts3D CC BY-SA 2.1 JP, Z-Anatomy CC BY-SA 4.0) affects the meshes, not the ontology data. Keeping the semantic data (CC BY 4.0 / CC0 sources) in a separate repo or directory with its own license is cleaner.

### Gaps
- Could not reach sig.biostr.washington.edu (connection refused), so the official FMA_Release license page was not read.
- The exact class count of 5.1.0 was not measured: the OWL sits behind Git LFS and was not downloaded. The ~75k figure is older.
- Could not verify whether FMA 5.x still includes TA cross-references or French synonyms.

## Terminologia Anatomica 2 (TA2, FIPAT 2019+): license, machine-readable data, Latin/English, French

### Takeaway
TA2 provides the official Latin and English terms with numeric TA2 IDs (about 7,100+ entries). The publication is CC BY-ND 4.0, and the front matter declares individual terms public domain. Only PDFs are official. There is no official open dataset, and the TA2 Viewer (openanatomy.org) is the de facto online access. No official French TA2 translation was found. French labels must come from Wikidata, HeTOP or manual curation.

### Cited Findings
- License: the TA publication is under CC BY-ND 4.0. The unaltered PDFs may be freely copied. IFAA member societies are authorized to publish translations, and other derivative works need permission from the FIPAT Chair — [FIPAT TA2 Front Matter (PDF)](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Front-Matter.pdf)
- TA2 Part 1 states that "the individual terms in this terminology are within the public domain". TA2 was approved and adopted by the IFAA General Assembly in 2020 — [FIPAT TA2 Part 1 (PDF)](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-1.pdf). The 2019 front matter still says "pending approval", a dated inconsistency.
- Errata PDF — [FIPAT TA2 Errata](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Errata.pdf). Corrective versions followed 2.00 (2019-08-06), the last being 2.07 (2021-08-16). Rushed proofreading before the 2019 London congress is cited as the cause, and a referendum on "regular anatomical terms" vs traditional Latin is discussed — [Anatomical Science International 2024, s12565-024-00759-5](https://springerlink.bibliotecabuap.elogim.com/content/pdf/10.1007/s12565-024-00759-5.pdf) (mirror; from search snippet)
- FIPAT official pages: [fipat.library.dal.ca/TA2](https://fipat.library.dal.ca/TA2) (unreachable during research) and [IFAA Terminologies](https://libraries.dal.ca/Fipat/terminologies.html)
- TA2 Viewer: https://ta2viewer.openanatomy.org. The Wikidata TA2 ID property uses it as formatter URL — [Wikidata P7173](https://www.wikidata.org/wiki/Property:P7173)
- `mhalle/taviewer` on GitHub is "An anatomy browser based on Terminologia Anatomica (1998)", i.e. TA98 not TA2. No license is declared and the last push was 2023-01-04 — [GitHub mhalle/taviewer](https://github.com/mhalle/taviewer) (GitHub API)
- Wikidata **P7173 = "TA2 ID"**: external identifier, numeric (`[1-9][0-9]*`), single-value and distinct constraints, about 7,113 records as of Aug 2019. Examples: tibia 1397, heart 3932, thumb 151 — [Wikidata P7173](https://www.wikidata.org/wiki/Property:P7173). Note: the `P7811` guessed in the brief is wrong. TA2 is P7173.
- Wikidata **P1323 = "Terminologia Anatomica 98 ID"** (verified via SPARQL label lookup); see [Wikidata P1323](https://www.wikidata.org/wiki/Property:P1323)
- Live Wikidata counts (2026-11-08, [query.wikidata.org](https://query.wikidata.org/sparql)):
  - items with TA2 ID (P7173): **5,511**
  - …of which have a French label: **4,750 (~86%)**
  - …of which have a Latin (`la`) label: **1,768 (~32%)**
  - items with TA98 ID (P1323): **5,279**
- Search turned up no official French TA2 translation by the Société anatomique de Paris or another francophone society — [FIPAT TA2 Front Matter](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Front-Matter.pdf) (authorizes member-society translations, none listed)

### Inferences
- For the official Latin and English terms, parse the TA2 PDFs (or scrape the TA2 Viewer, after checking its terms) into a table keyed by TA2 ID. Since individual terms are public domain, storing them as data is defensible. Redistributing a reformatted "TA2 dataset" could be read as a derivative under ND, so attribute FIPAT and consider asking the FIPAT Chair for permission.
- Wikidata Latin labels are sparse (32%), so Latin must come from TA2 itself, not Wikidata.
- French: Wikidata covers ~86% of TA2-linked items. The rest needs curation from the French Wikipedia, HeTOP (CHU Rouen, which hosts FMA with French terms) or a French anatomy textbook. Wikidata FR labels are often Wikipedia article titles and may not match the French anatomical nomenclature taught in medical schools (e.g. "nouvelle nomenclature" vs older usage). Expect a manual review pass.
- 7,113 TA2 entries is a good match for the ~6,000+ structures target, but TA2 has few individual structures for small vessels and nerves compared with FMA.

### Gaps
- Could not confirm the TA2 Viewer's own data license or whether it offers a bulk export (site not fetched).
- Did not find French-language TA editions (e.g. a "Terminologie anatomique" translation by a francophone IFAA member society). Absence not definitively confirmed.
- The status of TA2 adoption vs TA98 in French medical teaching was not researched.

## UBERON: license, human coverage, cross-references, suitability

### Takeaway
UBERON is CC BY 3.0 and very actively released (monthly; latest v2026-11-05). It is cross-species, so it lacks many fine human-specific structures (e.g. vasculature, per HRA authors). It is valuable as an interoperability cross-reference (HRA, Bgee, CELLxGENE), not as the primary ID for a 6,000-structure human atlas.

### Cited Findings
- License: CC BY 3.0. Products: `uberon.owl`, `uberon-base.owl`, `uberon-basic.obo`, composite-metazoan/vertebrate. Repository github.com/obophenotype/uberon — [OBO Foundry Uberon](https://obofoundry.org/ontology/uberon.html)
- Latest GitHub releases: `v2026-11-05` and `v2026-10-01` — [GitHub obophenotype/uberon releases](https://github.com/obophenotype/uberon/releases) (GitHub API)
- HRA authors: "FMA… has a more complete list of blood vessels than UBERON". They combined UBERON and FMA for vasculature — [Boppana et al. 2023, ASCT+B](https://cns.iu.edu/docs/publications/2023-Boppana_ASCT+Bs.pdf); [Börner et al. bioRxiv 2021](https://www.biorxiv.org/content/10.1101/2021.05.31.446440.full.pdf)
- Wikidata **P1554 = "UBERON ID"**: 6,371 items. Only 2,387 items carry both a TA2 ID and an UBERON ID (SPARQL 2026-11-08)

### Inferences
- UBERON's monthly cadence and strong tooling (ODK, OLS, ROBOT) make it the best-maintained open anatomy ontology. But its CC BY 3.0 license and cross-species scope make it complementary, not canonical.
- Only ~43% of TA2-linked Wikidata items have UBERON IDs, so UBERON can't be the primary key for a TA2-sized atlas.

### Gaps
- Did not count UBERON classes with FMA xrefs (`oboInOwl:hasDbXref FMA:`). This is easy to compute from `uberon.owl` and recommended as a follow-up.
- No dedicated "human view" product of UBERON is listed on OBO Foundry.

## Wikidata as multilingual hub

### Takeaway
Wikidata (CC0) is the best practical hub. FMA ID (P1402) is on ~79,000 items, and TA2 ID (P7173), TA98 (P1323), UBERON (P1554), MeSH and SNOMED IDs act as crosswalks. FR labels are good (~86% on TA2 items), Latin labels weak. Relationship properties exist but are sparsely filled (hundreds of statements).

### Cited Findings
- **P1402 = "Foundational Model of Anatomy ID"**: numeric 4–6 digits, formatter `https://purl.org/sig/ont/fma$1`, single-value and distinct constraints. Related properties: P1323 (TA98), P7173 (TA2), P12797 (IMAIOS entity ID) — [Wikidata P1402](https://www.wikidata.org/wiki/Property:P1402)
- Live counts (2026-11-08, SPARQL):
  - P1402 FMA ID: **79,025 items**; of these, **6,034** have a French label
  - Items with both FMA ID and TA2 ID: **4,884** (~89% of TA2 items)
  - P1554 UBERON: 6,371; P486 MeSH descriptor ID: 39,570 statements (all domains); P5806 SNOMED CT ID: 1,452 statements; P12797 IMAIOS entity ID: 6 statements (new property)
- Wikidata structured data is CC0 — [Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) (not fetched this session; standard Wikidata policy)

### Inferences
- Pipeline: SPARQL dump of all items with P7173 or P1402, getting labels in `fr`, `en`, `la` plus aliases and all crosswalk IDs. One query yields a CC0 multilingual seed of ~5–6k structures, joinable to BodyParts3D via FMA ID (89% of TA2 items carry one).
- Only ~6k of 79k FMA-linked items have FR labels, because most FMA items were bot-created with English labels. For structures outside TA2, French must be curated.
- Contributing curated FR/Latin labels back to Wikidata (CC0) is a natural open-source give-back.

### Gaps
- Did not measure French alias coverage or the quality of FR labels against a French reference.

## Other sources: SNOMED CT, RadLex, MeSH, HRA ASCT+B

### Takeaway
SNOMED CT and RadLex are licensed and restricted, which makes them unsuitable as the backbone of an open dataset. MeSH anatomy is coarse. HRA ASCT+B is open but organ- and cell-focused (UBERON/FMA-mapped), useful for crosswalks, not for gross-anatomy coverage.

### Cited Findings
- SNOMED CT in France: free, but use requires accepting a licence (affiliate or "navigateur") from the French NRC (ANS). Use outside France requires registration with SNOMED International. Only alignments between an open terminology and SNOMED CT are published under an open licence — [ANS: Modalités d'accès SNOMED CT (PDF)](https://industriels.esante.gouv.fr/sites/default/files/media/document/Note_information_ANS_-_Modalites_acces_SNOMED_CT.pdf); [ANS: La SNOMED CT et le NRC français](https://esante.gouv.fr/produits-et-services/cgts-centre-de-gestion-des-terminologies-de-sante/la-snomed-ct-et-le-nrc-francais)
- RadLex: RadLex License Version 2.1, last updated 2025-01-06 (RSNA). It grants rights over identifiers, names, synonyms and ontologic relations for clinical terms. The "RadLex® Master Ontology is not available for distribution under any circumstance". The RSNA/RadLex trademarks are restricted — [RadLex License Agreement and Terms of Use (PDF)](https://www.rsna.org/uploadedFiles/RSNA/Content/Informatics/RadLex_License_Agreement_and_Terms_of_Use_V2_Final.pdf). HL7 describes RadLex as "licensed freely for commercial and non-commercial users" — [HL7 THO RadLex](https://terminology.hl7.org/CodeSystem-RadLex.html)
- HRA ASCT+B tables: hierarchical lists of Anatomical Structures, Cell Types and Biomarkers, mapped to UBERON (and FMA for vessels). HRA v2.2 has crosswalks from 3D reference objects to UBERON or FMA terms — [Börner et al. bioRxiv](https://www.biorxiv.org/content/10.1101/2021.05.31.446440.full.pdf); [Herr et al. 2023](https://cns.iu.edu/docs/publications/2023-Herr-Specimen_biological_structure.pdf); [Nature Sci Data s41597-023-01993-8](https://www.nature.com/articles/s41597-023-01993-8.pdf)

### Inferences
- Store SNOMED CT/RadLex codes only as optional cross-reference IDs (bare identifiers taken from Wikidata P5806, where licence-compatible). Never redistribute their labels or hierarchies.
- HRA's 3D-object-to-UBERON/FMA crosswalk pattern is a useful design precedent for linking meshes to ontology terms.

### Gaps
- The ASCT+B data license was not confirmed. The CC BY 4.0 found applies to the papers, so check humanatlas.io and the HRA releases.
- MeSH terms of use not fetched (NLM; believed freely usable with conditions). MeSH has French translations (INSERM/HeTOP), but this was not verified this session.
- RadLex French labels not researched.

## Relationship data (part_of, is_a, supply, innervation, origin/insertion/action) for quizzes

### Takeaway
FMA is the richest open source of structural relations (168+ relationship types, 2.1M instances, CC BY 4.0). Wikidata has dedicated properties (arterial supply, innervation, muscle origin/insertion/action, branches), but they are populated on only hundreds of items. Muscle origin/insertion/action and innervation for quizzes will likely require curation (Wikipedia infoboxes as a starting point, checked against textbooks).

### Cited Findings
- FMA: more than 168 relationship types and over 2.1 million relationship instances — [Wikipedia FMA](https://en.wikipedia.org/wiki/Foundational_Model_of_Anatomy)
- Wikidata anatomy relation properties and live usage counts (statements, 2026-11-08, SPARQL):
  - P3189 innervated by: **430**; P3190 innervates (inverse)
  - P2286 arterial supply: **458**; P2289 venous drainage: **529**; P2288 lymphatic drainage: **80**
  - P3490 muscle origin; P3491 muscle insertion: **243**; P3310 muscle action
  - P2329 antagonist muscle: **112**; P3773 antagonist of
  - P3261 anatomical branch of: **1,198**; P3262 has anatomical branch
  - P927 anatomical location: **4,699**; P4882 segmental innervation: **5**
  - Wikidata generic P361 "part of" / P279 "subclass of" also apply (hierarchy)
  - Source: [Wikidata Query Service](https://query.wikidata.org/sparql)
- HRA ASCT+B tables give part_of-style anatomical structure hierarchies per organ, plus cell types and biomarkers — [Boppana et al. 2023](https://cns.iu.edu/docs/publications/2023-Boppana_ASCT+Bs.pdf)

### Inferences
- part_of / is_a hierarchy and region/system grouping: take from FMA (complete), with the TA2 hierarchy (chapter structure) as the teaching-oriented alternative for the UI.
- Vascular supply and branches: FMA (if its OWL includes `arterial_supply` / `branch_of` properties) plus Wikidata P2286/P3261.
- Muscle origin/insertion/innervation/action: Wikidata coverage (~240–430 statements) is too thin for ~600+ muscles. Extracting English Wikipedia "Infobox muscle" fields (origin, insertion, artery, nerve, actions, antagonist) is a realistic bootstrap but needs expert review. Wikipedia text is CC BY-SA, so extracted relations should be re-expressed as structured facts and attributed.
- Feeding curated relations back to Wikidata would close the loop.

### Gaps
- Did not verify which exact relation properties exist in FMA 5.1.0 OWL (e.g. `arterial_supply`, `nerve_supply`, `attaches_to`). The FMA historically had them in the frames version, but the OWL must be inspected.
- Did not quantify Wikipedia infobox coverage.

## Practical recommendation: canonical ID strategy, format, tooling

### Takeaway
Use your own stable project ID (a slug) as the primary key, carrying **FMA ID as the main external anchor** (geometry join with BodyParts3D, CC BY 4.0) and **TA2 ID as the nomenclature anchor** (official Latin/EN). Cross-reference UBERON, TA98, Wikidata QID, plus optionally MeSH, SNOMED CT and RadLex IDs. Source FR from Wikidata (CC0) plus curation, and Latin/EN from TA2. Author in YAML (one file per structure, git-versioned), compiled to JSON / JSON-LD for the app.

### Cited Findings
- FMA IDs underpin BodyParts3D mesh file names — [BodyParts3D README](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/README_e.html)
- Z-Anatomy uses TA2 naming — [Interoperable Europe 3D Anat](https://interoperable-europe.ec.europa.eu/collection/ehealth/solution/3d-anat)
- Wikidata links FMA (P1402), TA2 (P7173), TA98 (P1323) and UBERON (P1554) — [Wikidata P1402](https://www.wikidata.org/wiki/Property:P1402); [Wikidata P7173](https://www.wikidata.org/wiki/Property:P7173)
- License landscape: FMA CC BY 4.0 ([GitHub uw-sig/FMA](https://github.com/uw-sig/FMA)); UBERON CC BY 3.0 ([OBO Foundry](https://obofoundry.org/ontology/uberon.html)); TA2 CC BY-ND 4.0 with public-domain terms ([TA2 Front Matter](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Front-Matter.pdf), [TA2 Part 1](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-1.pdf)); Wikidata CC0 ([Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing))

### Inferences
- **Why not FMA as the raw primary key?** Some meshes lack an FMA ID (BodyParts3D "BP…" IDs), and FMA's long-term future is uncertain (registry "inactive/deprecated" flags). A project slug (e.g. `musculus-biceps-brachii` or `femur-left`) decouples the project from any single upstream. FMA laterality is handled by separate left/right classes, while TA2 is mostly non-lateralized. Model laterality explicitly (`side: left|right|unpaired`, `canonical: <bilateral id>`).
- Suggested record shape (YAML, one file per structure):
  ```yaml
  id: biceps-brachii
  version: 1
  ids: { fma: 37670, ta2: <int>, ta98: <A04...>, uberon: "UBERON:0001507", wikidata: Q<...> }
  labels:
    la: { preferred: "Musculus biceps brachii", source: TA2 }
    en: { preferred: "Biceps brachii", source: TA2 }
    fr: { preferred: "Muscle biceps brachial", source: wikidata|curated, reviewed: true }
  system: musculaire
  region: membre-supérieur/bras
  parent: muscles-loge-antérieure-bras   # part_of / is_a
  relations: { innervation: [nerf-musculo-cutané], arterial_supply: [artère-brachiale], origin: [...], insertion: [...] }
  meshes: [ "FMA37670_L.glb", "FMA37670_R.glb" ]
  provenance: [...]
  ```
  (IDs above are illustrative placeholders; verify each.)
- Tooling: SPARQL against the Wikidata Query Service to seed. `owlready2`/`rdflib`/ROBOT to extract FMA hierarchy and relations from the 5.1.0 OWL. `pronto`/ROBOT for UBERON xrefs. PDF table extraction (pdfplumber) for TA2. Validate YAML with JSON Schema in CI. Optional JSON-LD `@context` mapping ids to `http://purl.org/sig/ont/fma/fma<id>`, `http://purl.obolibrary.org/obo/UBERON_<id>`, `http://www.wikidata.org/entity/Q<id>`.
- License hygiene: keep the semantic data repo under CC BY 4.0 (compatible with FMA CC BY 4.0, UBERON CC BY 3.0 attribution, Wikidata CC0), with attribution to FIPAT for TA2 terms. Keep meshes under CC BY-SA (inherited from BodyParts3D/Z-Anatomy).

### Gaps
- No measurement yet of how many BodyParts3D FMA IDs resolve to Wikidata items with TA2 IDs. That number is the key coverage metric and is computable via SPARQL against the BodyParts3D file list.
- Laterality conventions across FMA, TA2 and BodyParts3D were not examined in detail.
