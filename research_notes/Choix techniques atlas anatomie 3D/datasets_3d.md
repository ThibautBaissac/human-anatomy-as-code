# Open / openly licensed 3D human anatomy datasets for a web 3D atlas (state as of 2026-11-08)

Method note: sources were checked on 2026-11-08 through official pages, the GitHub API (`gh api`) and web search. Some pages could not be fetched (z-anatomy.com renders client-side only; anatomytool.org had an expired TLS certificate; 3d.nih.gov entry pages returned 404; humanatlas.io renders client-side only). Claims taken only from search-engine summaries are marked "(search summary)". Claims that come from background knowledge and were NOT verified in this session sit only under Inferences or Gaps.

---

## Z-Anatomy: license, origin, coverage, female anatomy, formats, labels, maintenance, repo

### Takeaway
Z-Anatomy is a Blender application template built from BodyParts3D (male only). It is announced as CC BY-SA 4.0, but it also bundles third-party assets under **CC BY-NC-SA 4.0 and CC BY-NC 4.0**, so the full package cannot be used as is in a commercial product. It may not even be cleanly re-licensable as BY-SA. The repo is still active as of Nov 2026, but only through automated daily commits. The female model is still a "midterm" TODO item.

### Cited Findings
- Repos under the GitHub user `Z-Anatomy` (no org): `Models-of-human-anatomy` ("Human male model", 289 stars, last push 2026-11-07, GitHub license detection = NOASSERTION), `Blender-addons` (GPL-3.0, last push 2026-07-07) and `Models-of-veterinary-anatomy` (last push 2025-11-12). — [GitHub API: users/Z-Anatomy/repos](https://github.com/Z-Anatomy)
- README: "This repository contains the Blender template of the Z-Anatomy Project. It includes models derived from 'BodyParts3D' and definitions that heavily rely on Wikipedia." Made by Gauthier Kervyn (design, 3D, anatomy) and Marcin Zielinski (Python). "Meant to be used as a navigable atlas within Blender." — [README](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- License statement: "All the code and content shared by 'Z-Anatomy' is under Creative Commons Attribution-ShareAlike 4.0 International License", which requires attribution and that derivatives be distributed "under the same license". — [License.txt](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/License.txt), [README](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- Required attributions listed by Z-Anatomy: "BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan" and "Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0". — [License.txt](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/License.txt)
- Third-party models "used as reference/included and adapted": "Brainder" and "White matter" (University of Washington, no license stated), "Cranial Nerves and Foramina – University of Dundee, CAHID – CC-BY 4.0", **"Anatomy of the Inner Ear – University of Dundee School of Medicine – CC-BY-NC-SA 4.0"**, **"Kidney – by Lissie Cowley – CC-BY-NC 4.0"**. — [License.txt](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/License.txt)
- Definitions come from Wikipedia (CC BY-SA 3.0) and are partly machine-translated ("Beware the errors created by the automatic translation"). — [License.txt](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/License.txt)
- Repo contents (sizes from the API): `Z-Anatomy.zip` 86.7 MB (the Blender app template), `Z-Biomechanics.7z` 21.6 MB, `TA2.csv` 1.5 MB, `Anatomy-shortcuts.py`, `TO DO List`, `License.txt`. There are no GitHub Releases. — [repo contents](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- `TA2.csv` has ~7,315 lines with columns `TA2ID;English;Latin;Français;Español;Portugues;Italiano;Parsi`, so it is a multilingual Terminologia Anatomica 2 term list keyed by TA2 ID. — [TA2.csv](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/TA2.csv)
- Translation credits: Portuguese, Spanish, Italian, Polish and Parsi (Persian) contributors are named. — [README](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- Install path: Blender > "Install Application Template" > `Z-Anatomy.zip` > File > New > Z-Anatomy. The README mentions Blender 3.1/3.2. — [README](https://github.com/Z-Anatomy/Models-of-human-anatomy)
- Maintenance: the last 12+ commits (2026-10-27 to 2026-11-07) are all automated, named "Mise à jour automatique depuis Export (…)", one per day at about 23:33 UTC. — [commits](https://github.com/Z-Anatomy/Models-of-human-anatomy/commits)
- Known problems, from the project's own TO DO list: labels are "currently all shown as siblings" (no parent/child hierarchy); meshes are named by name, not by anatomical ID ("REPLACE ALL THE MESHES' NAMES WITH THE ANATOMICAL ID"); the male model needs correction and validation "by a radiologist?" plus "CREATE AND INTEGRATE THE MISSING STRUCTURES"; definitions need summarising and updating to the latest nomenclature. — [TO DO List](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/TO%20DO%20List)
- Female model: listed under "MIDTERM: CREATE A FEMALE HUMAN MODEL". The plan is a surface scan, CT and MRI of a volunteer, TotalSegmentator and 3D Slicer segmentation, "DERIVE THE 3D FEMALE MODEL from the male model", then integrate female parts with a switch in the app. So **no female model exists**. — [TO DO List](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/TO%20DO%20List)
- The TO DO list links to a Unity app repo `Z-Anatomy/The-app` (branch PC-Version). That repo now returns 404 from the GitHub API, so it was deleted or made private. — [TO DO List](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/TO%20DO%20List); [GitHub API check](https://api.github.com/repos/Z-Anatomy/The-app)
- AnatomyTOOL's "Open3Dmodel" is a Z-Anatomy-based, CC BY-SA, Blender-oriented whole-body model, and "the present work is on a male model" (search summary; the page itself could not be fetched because of an expired certificate). — [anatomytool.org/open3dmodel-about](https://anatomytool.org/open3dmodel-about)

### Inferences
- **License hygiene problem.** Z-Anatomy says "all content" is CC BY-SA 4.0, but it includes adapted NC-licensed models (Dundee inner ear BY-NC-SA, Lissie Cowley kidney BY-NC). Those parts cannot legally be relicensed as BY-SA. For a commercial product, the inner-ear and kidney meshes (and anything derived from them) must be identified and removed. The UW "Brainder"/"White matter" assets have no license stated and also need checking.
- Z-Anatomy still credits BodyParts3D as CC BY-SA 2.1 JP. DBCLS now states CC BY 4.0 (see next section). Z-Anatomy's own modifications stay CC BY-SA 4.0 whatever the upstream license is.
- Hosting an 87 MB .blend inside a zip in git, with daily automated "export" commits and no tagged releases, gives no stable versioned artifact. Pin a commit SHA when ingesting.
- Format path to the web: .blend → glTF/GLB through Blender's exporter. Mesh-to-ontology mapping will need work: names map to TA2 terms by string, not by ID.

### Gaps
- Exact number of meshes/objects in Z-Anatomy.blend, and polycount: not stated anywhere I could fetch (the TA2 list of ~7,300 terms is a terminology list, not a mesh count). You would need to open the .blend and count.
- What the daily automated commits change (the API listing of the latest commit returned no file list).
- Whether z-anatomy.com (web/Unity app) offers any download beyond GitHub: the page is client-rendered and could not be read.

---

## BodyParts3D (DBCLS, Japan): license, FMA IDs, coverage, quality, status

### Takeaway
**Major update:** DBCLS's license page (updated 2025-02-27) now states **CC BY 4.0**, not the historical CC BY-SA 2.1 JP. That makes BodyParts3D the most permissive whole-body mesh base available. It is male only, its data was last updated in 2013, and it is distributed as OBJ (version 4.0) with IS-A and PART-OF trees.

### Cited Findings
- License page: the database license "is specified in the Creative Commons Attribution 4.0 International"; page last updated 2025/02/27. Required credit: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International". Parts not covered by the license require contacting the licensor. A separate NBDC Terms of Service PDF also applies. — [BodyParts3D license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
- Conflicting historical statement: Z-Anatomy credits "BodyParts3D … CC-BY-SA 2.1 Japan". — [Z-Anatomy License.txt](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/License.txt)
- Description: "a three-dimensional whole-body model for an adult human male"; references the Foundational Model of Anatomy (FMA); operation started 2007/10; **last data update 2013/05**. — [BodyParts3D description](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html)
- Download files: `isa_BP3D_4.0_obj_99.zip` (136 MB, IS-A tree meshes, "99% reduction rate"), `partof_BP3D_4.0_obj_99.zip` (62 MB, PART-OF tree meshes), plus `isa_parts_list_e.txt` (126 KB), `partof_parts_list_e.txt` (58 KB), `isa/partof_inclusion_relation_list.txt`, `isa/partof_element_parts.txt` (compound-organ definitions, 1.1 MB / 654 KB), `README_e.html`. — [BodyParts3D download](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)
- EasyAnatomyLab, a third-party web atlas, is described as CC BY 4.0 with a base body from BodyParts3D "which is CC BY (DBCLS)" (search summary), which is consistent with the relicensing. — [easyanatomylab.com/human-anatomy](https://easyanatomylab.com/human-anatomy)

### Inferences
- Because BodyParts3D is now CC BY 4.0, a project can derive meshes **directly from BodyParts3D** and choose its own output license (CC BY 4.0, or even BY-SA). Deriving from Z-Anatomy forces CC BY-SA 4.0 on the adaptation.
- The "99% reduction" OBJ files are decimated, so polycount is web-friendly, but realism is limited. Background knowledge, not verified this session: BP3D meshes come from segmented MRI/CT of a single male volunteer, with manual modelling, and have a "faceted" look.
- FMA linkage: per background knowledge (not verified in fetch), the parts-list files map BP3D file IDs (FJxxxx) to FMA concept IDs (FMAxxxxx). That would give the strongest ontology linkage among all candidates. Confirm by reading `isa_parts_list_e.txt`.

### Gaps
- Exact date when the license changed from CC BY-SA 2.1 JP to CC BY 4.0. The update-history page returned 404.
- Number of parts/meshes in v4.0. Not stated on the download page. Background knowledge suggests a few thousand element files, but this is not verified.
- Contents of the NBDC Terms of Service PDF (whether it adds anything beyond CC BY).
- Body-system gaps of BP3D (for example, peripheral nerves and lymphatics are known to be sparse) are not verified from a primary source.

---

## Open Anatomy Project / SPL atlases (3D Slicer, Harvard)

### Takeaway
There are 7 regional atlases (brain, head-neck, knee, abdomen, liver, inner ear, thorax). They are high-quality MRI/CT-derived labelmaps and models, but regional only, not whole body. Licenses are per atlas and not shown on the listing page; Head & Neck is under the "3D Slicer License, section B".

### Cited Findings
- Atlases listed: Mauritanian Anatomy Laboratory Thoracic Atlas (CT: thoracic skeleton, respiratory, cardiovascular, esophagus); SPL/NAC Brain Atlas (MRI, ">300" structures); SPL Liver Atlas (CT: liver, liver vasculature, abdominal organs); SPL Inner Ear Atlas (CT, experimental scanner, with DKFZ); SPL Head and Neck Atlas (CT: skull, mandible, upper ribs/spine, neck muscles, cartilage, vessels, glands); SPL Knee Atlas (MRI: muscles, bones, tendons, ligaments, fat, vessels, cartilage, meniscus, nerves); SPL Abdominal Atlas (CT: skeleton, vasculature, muscles, abdominal organs). The listing page shows only "Launch Viewer" links, with no license or format info. — [openanatomy.org/atlas-pages](http://www.openanatomy.org/atlas-pages/)
- The SPL Head and Neck Atlas is distributed under 3D Slicer License section B (search summary). — [SPL Head and Neck Atlas](https://openanatomy.org/atlas-pages/atlas-spl-head-and-neck.html)
- Inner ear atlas authors include Sönke Bartling, Marianna Jakab and Ron Kikinis (search summary). — [SPL Inner Ear Atlas](https://www.openanatomy.org/atlas-pages/atlas-spl-inner-ear.html)
- Frontiers in Neuroinformatics 2017 paper on the Open Anatomy browser and atlas format. — [frontiersin.org PDF](https://frontiersin.org/articles/10.3389/fninf.2017.00022/pdf)

### Inferences
- Useful as **high-detail regional supplements** (brain parcellation, knee ligaments/menisci, inner ear) and as reference for cross-sections, because they come with source volumes (NRRD labelmaps in Slicer convention, per background knowledge). They do not fill the whole-body gap.
- The 3D Slicer License is BSD-style and permissive (background knowledge). Section B covers contributions and needs per-atlas review before commercial use.

### Gaps
- Per-atlas licenses for brain, knee, liver, abdominal, inner ear and thoracic: not displayed on the pages I could fetch.
- Exact formats, structure counts per atlas, download locations (GitHub/OSF) and last update dates.
- Sex of each atlas subject.

---

## Visible Human Project (NLM): terms, derived mesh datasets, cross sections

### Takeaway
The VHP male and female datasets (CT, MRI, cryosection) can be downloaded **without a license agreement since July 2019**, under NLM general terms that require crediting NLM. They are the best open source for true axial cryosection/radiology slices of both sexes. HRA's 3D organs are derived from them.

### Cited Findings
- "No license agreement is required." The NLM Data License was replaced in **July 2019** by Terms and Conditions; no registration is required. — [VHP Getting the data](https://www.nlm.nih.gov/research/visible/getting_data.html)
- Downloads: data.nlm.nih.gov data discovery page plus an archived mirror `data.lhncbc.nlm.nih.gov/public/Visible-Human/`. Female dataset is ≈40 GB. Formats: original GE CT/MRI, `.raw` full-colour cryosections, `.rgb` 70 mm film scans, and PNG (recommended). Page last reviewed 2023-12-26. — [VHP Getting the data](https://www.nlm.nih.gov/research/visible/getting_data.html)
- Resolution: male CT axial at 1 mm, 512×512, 12-bit; male MRI at 4 mm, 256×256; male cryosections 2048×1216, 24-bit, 1 mm, 1,871 slices; female the same but cryosections at 0.33 mm, giving >5,000 slices. — [VHP Getting the data](https://www.nlm.nih.gov/research/visible/getting_data.html)
- NLM general terms: acknowledge NLM with "Courtesy of the U.S. National Library of Medicine"; "No charges, usage fees or royalties". Page last reviewed 2019-05-21. — [NLM Terms and Conditions](https://www.nlm.nih.gov/databases/download/terms_and_conditions.html)
- Pre-2019 agreements required stating intended use, gave NLM rights over resulting applications, and were terminable. — [archived vhpagree (2012)](https://webarchive.library.unt.edu/web/20121014015102/http://www.nlm.nih.gov/research/visible/vhpagree.txt)
- HRA reference organs are built from VHP male (1,871 sections at 1 mm) and VHP female (5,189 sections at 0.33 mm). — [CCF 3D Reference Library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html)

### Inferences
- For a "radiology-like" axial/coronal/sagittal viewer, the VHP cryosection and CT volumes can be resliced. They are public-domain-like in practice (US government work, credit requested), so they are compatible with any project license.
- VHP subjects do not match the BodyParts3D subject, so slices cannot be co-registered with BP3D meshes without manual registration. HRA organs, by contrast, are in VHP space.

### Gaps
- Visible Korean (KISTI) licensing and availability were not researched in this session. It is believed to require an agreement (background knowledge, unverified).
- The current NLM T&C wording specific to VHP: the generic page does not name VHP explicitly.
- Other complete VHP-derived whole-body mesh sets with open licenses (beyond HRA): none found in this session.

---

## HRA / CCF (Human Reference Atlas, HuBMAP) 3D reference organs

### Takeaway
HRA provides **CC BY 4.0, GLB, male AND female** organ models (including female reproductive organs: uterus, ovaries, fallopian tubes, placenta) in VHP space, plus "united" whole-body organ sets. Coverage is organ-centric (no complete musculoskeletal or peripheral systems). It is the main open source of female organs.

### Cited Findings
- "All CCF 3D reference objects are released under Attribution 4.0 International (CC BY 4.0)." Format GLB (extraction sites GLB/FBX), with CSV crosswalks to ASCT+B tables. Source is VHP male/female. Brain from the Allen Human Reference Atlas-3D (2020), mapped to 141 anatomical structures. — [CCF 3D Reference Library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html)
- v1.2 (June 2022) organ list, female/male: Allen brain F/M, blood vasculature F/M, bone marrow & pelvis F/M, eye F/M (L/R), **fallopian tube F (L/R)**, heart F/M, kidney F/M (L/R), knee F/M (L/R), large intestine F/M, liver F/M, lungs F/M, lymph nodes F/M, **ovary F (L/R)**, pancreas F/M, **placenta F**, **prostate M**, skin F/M, small intestine F/M, spinal cord F/M, spleen F/M, thymus F/M, ureter F/M (L/R), urinary bladder F/M, **uterus F**, and "All Organs (United)" F/M. — [CCF 3D Reference Library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html)
- ccf-releases v2.0 (2023-12-15): pancreas revised; "male and female brain model licensing was updated to … CC BY 4.0"; united male and female bodies revised. — [CHANGELOG](https://github.com/hubmapconsortium/ccf-releases/blob/main/CHANGELOG.md)
- The v2.0 `models/` folder contains `3d-vh-f-united.glb.7z`, `3d-vh-m-united.glb.zip`, the allen-brain and pancreas GLBs for each sex, and `asct-b-3d-models-crosswalk.csv`. Releases v1.0–v1.4 and v2.0 are in the repo; last repo push 2024-06-24. — [hubmapconsortium/ccf-releases](https://github.com/hubmapconsortium/ccf-releases)
- ASCT+B tables "extend the uberon and cell ontologies", so anatomical structures are linked to UBERON IDs through the crosswalk. — [ccf-releases README](https://github.com/hubmapconsortium/ccf-releases)
- NIH 3D hosts HRA united male/female entries listed as CC-BY. The female entry was published 2025-08-05 (search summary; the entry page returned 404 on fetch). — [3d.nih.gov/entries/3DPX-021627](https://3d.nih.gov/entries/3DPX-021627)
- A 2023 abstract cites "67 … 3D Reference Objects for 29 organs" (search summary). — [Building a Human Reference Atlas, PMC10737119](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10737119/)

### Inferences
- HRA is the cleanest **CC BY** source of female pelvic/reproductive organs and breast-free organ sets in a common coordinate frame. It can be merged with BodyParts3D (also CC BY 4.0 now) without any ShareAlike constraint. EasyAnatomyLab apparently did exactly this (search summary): "female pelvis, uterus, uterine tubes, ovaries, vagina, uterine ligaments, breasts, ureters, bladder, urethra and skin from the Human Reference Atlas Visible Human Female model". — [easyanatomylab.com/human-anatomy](https://easyanatomylab.com/human-anatomy)
- The scale/pose mismatch between VHP space (HRA) and the BP3D subject requires manual registration and retopology at the seams (pelvis, perineum).

### Gaps
- HRA releases after v2.0 (2024–2026, served from humanatlas.io / cdn.humanatlas.io): the site is client-rendered and could not be read. The current total object count and organ list are unverified.
- Polycount and quality of the united GLBs; whether the female set includes breast/mammary gland meshes in the official release.

---

## Other sources (AnatomyTOOL, Anatomography, Sketchfab, NIH 3D, Embodi3D, TotalSegmentator...), especially open FEMALE full-body models

### Takeaway
**No complete open (CC BY / BY-SA) female full-body anatomy model with all systems was found.** Open female data is limited to HRA organs, VHP female volumes and CT segmentation datasets (TotalSegmentator, both sexes, 117 classes, CC BY 4.0). Sketchfab and CGTrader licenses vary per upload; Zygote and Voka are commercial.

### Cited Findings
- TotalSegmentator dataset v2.0.1 (Zenodo, published 2023-10-27): 117 structures in 1,228 CT scans, from University Hospital Basel; dataset under CC BY 4.0 (per secondary listings). The software is Apache 2.0, per a secondary source (search summary). — [Zenodo 6802613](https://zenodo.org/records/6802613); [kaiko-ai eva docs](https://kaiko-ai.github.io/eva/dev/datasets/total_segmentator)
- The original 2022 paper covered 104 structures in 1,204 CTs. — [arXiv 2208.05868](https://arxiv.org/abs/2208.05868v1)
- EasyAnatomyLab: CC BY 4.0 web atlas with a male/female toggle. Female-specific parts come from HRA VHP female; skeleton, muscles and other organs are shared (from BodyParts3D). No confirmed download (search summary). — [easyanatomylab.com/human-anatomy](https://easyanatomylab.com/human-anatomy)
- AnatomyTOOL Open3Dmodel: Z-Anatomy-based, CC BY-SA, male (search summary; page certificate expired). — [anatomytool.org/open3dmodel](https://anatomytool.org/open3dmodel)
- Sketchfab/CGTrader female écorché/anatomy models: license varies per upload, some paid. Zygote female collection is commercial (search summary). — [Sketchfab human anatomy collection example](https://sketchfab.com/glb.zxc/collections/human-anatomy-28058250ab464ac5831d571102ba3b3d); [Zygote female collection](https://www.zygote.com/poly-models/3d-human-collections/3d-female-anatomy-collection); [Voka female anatomy](https://voka.io/3d-anatomy/human-body/female-anatomy/)
- The `vessels-3d` GitHub project (2026) builds "an interactive 3D human body built from open anatomy atlases, with the small vessels grown by an algorithm". This shows that others are combining open atlases (unverified quality/license). — [mauupa0/vessels-3d](https://github.com/mauupa0/vessels-3d)

### Inferences
- A female model would have to be **composed**: BP3D/Z-Anatomy shared skeleton and muscles (male-derived, so the pelvis needs female morphology), HRA female organs (CC BY), and optionally TotalSegmentator-derived female bones/organs (CC BY 4.0, low-detail NIfTI labelmaps → meshes via marching cubes). That is significant 3D work, roughly what Z-Anatomy's own TODO describes.
- Anatomography is DBCLS's web viewer on top of BodyParts3D (background knowledge). It brings no extra data license beyond BP3D.

### Gaps
- Embodi3D, NIH 3D (3d.nih.gov) per-entry licenses beyond HRA, MedShapeNet licensing (search returned nothing), and Sketchfab CC-BY full-body female models: not verified in this session.
- No source found for an open female full-body model with peripheral nerves, lymphatics or musculature.

---

## Best combination for male + female, and license compatibility (CC BY-SA + CC BY)

### Takeaway
Most permissive path: **BodyParts3D (CC BY 4.0) + HRA (CC BY 4.0) + VHP (NLM credit) + TotalSegmentator (CC BY 4.0)**. The output can be CC BY 4.0 and commercial-friendly. Using Z-Anatomy meshes adds the label work and corrections already done, but forces **CC BY-SA 4.0** on the derived asset set, and its NC-licensed parts must be removed.

### Cited Findings
- BodyParts3D: CC BY 4.0. — [BP3D license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
- HRA: CC BY 4.0. — [CCF 3D Reference Library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html)
- Z-Anatomy: CC BY-SA 4.0, with embedded CC BY-NC-SA 4.0 and CC BY-NC 4.0 components. — [Z-Anatomy License.txt](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/main/License.txt)
- Z-Anatomy Blender add-on code: GPL-3.0. — [Z-Anatomy/Blender-addons](https://github.com/Z-Anatomy/Blender-addons)
- VHP: no agreement; credit NLM. — [VHP getting data](https://www.nlm.nih.gov/research/visible/getting_data.html), [NLM T&C](https://www.nlm.nih.gov/databases/download/terms_and_conditions.html)
- Creative Commons states that CC BY material may be adapted into a work under CC BY-SA, but not the reverse, and that BY-SA material may be adapted under a later version of BY-SA. The NC licenses are not compatible with BY-SA. These pages were not fetched in this session; this is the standard CC compatibility chart. — [CC compatible licenses](https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses), [CC FAQ](https://creativecommons.org/faq/)

### Inferences
- **Open-source project:** either license works. CC BY-SA 4.0 for assets is acceptable for open source, but the copyleft also binds any commercial downstream use of the modified 3D assets. App code can use any license (MIT/Apache/AGPL), because CC licenses cover the assets, not the viewer code. Z-Anatomy's GPL-3.0 add-on matters only if you reuse its Python code.
- **Commercial product:** CC BY and CC BY-SA both allow commercial use. BY-SA means modified meshes must be published under BY-SA (a competitor can reuse them). NC components (Z-Anatomy inner ear, kidney) are forbidden in commercial use. Removing or replacing them is mandatory.
- Mixing CC BY (BP3D, HRA) into a BY-SA (Z-Anatomy-derived) asset set is allowed, and the combined adaptation becomes BY-SA 4.0. Keep a per-mesh provenance/license manifest so CC BY-only subsets can be released under CC BY.
- Ontology IDs: BP3D gives FMA (to verify), Z-Anatomy gives TA2 names and IDs via `TA2.csv`, and HRA gives UBERON via ASCT+B crosswalks. FMA↔UBERON↔TA2 crosswalks exist in UBERON xrefs (background knowledge), which makes a unified ID scheme feasible.

### Gaps
- Exact attribution text and notice obligations for a combined web atlas (CC BY 4.0 §3 compliance UI): not researched.
- Whether DBCLS's relicensing to CC BY 4.0 also covers older BP3D versions (3.0) that Z-Anatomy derived from: the license page does not say.

---

## Open rigged skeletons / musculoskeletal models for joint animation (OpenSim etc.)

### Takeaway
OpenSim models (Rajagopal full body, gait2392, arm26, wrist...) are available. The Full Body Model is under an "MIT Use Agreement" (v4.0, last updated Dec 2020). The opensim-models GitHub repo has no detected license file. These are biomechanical (.osim + geometry) models rather than game-style rigs, but they are usable as a joint/DOF reference.

### Cited Findings
- `opensim-org/opensim-models` repo ("SimTK OpenSim models (.osim) and related example files that are distributed with OpenSim"): last push 2025-11-05; GitHub license detection returned none. Models folder includes Arm26, Gait10dof18musc, Gait2354_Simbody, Gait2392_Simbody, Hamner, Leg39, Leg6Dof9Musc, Rajagopal, Rajagopal_OpenSense, SoccerKick, WristModel and others, plus a `Geometry` folder. — [opensim-org/opensim-models](https://github.com/opensim-org/opensim-models)
- SimTK Full Body Model (Rajagopal 2016): downloads FullBodyModel-4.0.zip and ModelWithSampleSimulations-4.0.zip under an "MIT Use Agreement"; project last updated 2020-12-03. — [simtk.org/home/full_body](https://simtk.org/home/full_body)
- The Rajagopal model has full-body bony geometry, 37 degrees of freedom, 80 Hill-type muscle–tendon units for the lower limbs and 17 torque actuators for the upper body (search summary of the paper). — [simtk.org/home/full_body](https://simtk.org/home/full_body); [NMBL software and models](https://nmbl.stanford.edu/software-and-models-for-the-scientific-community/)
- The OpenSim software itself is Apache 2.0 (search summary from multiple sources). — [NMBL software and models](https://nmbl.stanford.edu/software-and-models-for-the-scientific-community/)
- Z-Anatomy ships a `Z-Biomechanics.7z` (21.6 MB) archive, with content unverified. — [Z-Anatomy repo](https://github.com/Z-Anatomy/Models-of-human-anatomy)

### Inferences
- Use OpenSim joint definitions (joint centres, axes, ranges of motion) as the reference for rigging BP3D/Z-Anatomy skeletons in Blender/three.js. Background knowledge: OpenSim bone geometry is .vtp and simplified, so it is not atlas-grade.
- Read the exact "MIT Use Agreement" text before commercial use. The SimTK page does not state commercial terms explicitly.

### Gaps
- Exact text of the SimTK "MIT Use Agreement", and licenses of the other models and of `Geometry/` in opensim-models.
- Contents of Z-Anatomy's `Z-Biomechanics.7z` (rig? constraints?).
- Any open, game-ready rigged anatomical skeleton (e.g. on Sketchfab under CC BY): not found in this session.
