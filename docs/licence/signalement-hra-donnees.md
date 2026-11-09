# Signalement d'incohérences dans les objets de référence HRA

**Pourquoi :** en important les organes féminins du Human Reference Atlas v2.5, le projet a relevé trois incohérences. Il les corrige de son côté (`data/import/hra-overrides.yaml`), mais elles méritent d'être signalées à la source.

**À qui :** l'équipe HRA / CNS Indiana University. Le dépôt https://github.com/hubmapconsortium/hra-do-processor accepte les issues ; à défaut, utiliser le contact indiqué sur https://humanatlas.io. Vérifier le canal avant l'envoi.

---

**Objet :** Possible data issues in HRA v2.5 female 3D reference objects (round ligaments, ovary IDs, uterus metadata)

Hello HRA team,

We are building *Human Anatomy As Code*, an open 3D anatomy atlas. Its female model v1 uses your CC BY 4.0 3D reference organs, credited by DOI. Thank you for making them available. While importing them, we found three possible issues:

1. **Round ligaments of the uterus are swapped in `united-female` v1.10** (`3d-vh-f-united.glb`, DOI 10.48539/HBM637.DWBM.744). `VH_F_right_round_ligament_of_uterus` (FMA:57789) lies at x > 0 (0.002 → 0.049 m). In this file x > 0 is the subject's **left**, as the left ovary (FMA:7214) shows, so the node appears to be the left round ligament, and vice versa.

2. **Ovary identifiers differ between the GLB and its crosswalk** (`ovary-female-left` v1.3). The GLB node `VH_F_left_ovary` carries `ontologyid: FMA:7214`, whereas `crosswalk.csv` maps it to `UBERON:0002119`. Both terms do designate the left ovary, so this may be intentional. We mention it because, for other organs, the node extras and the crosswalk use the same vocabulary.

3. **Uterus v1.2 metadata cites v1.1.** The digital object `uterus-female/v1.2` gives the citation "3D Reference Organ for Uterus v1.1" (DOI 10.48539/HBM627.VTKD.892).

We also noticed that the cardinal ligaments (`VH_F_left_cardinal_ligament_of_uterus` and `VH_F_right_cardinal_ligament_of_uterus`) share the same identifier, FMA:77064, with the label "Cardinal ligament". Side-specific identifiers would help tools that keep left and right apart.

Happy to provide more details or the scripts we used.

Best regards,

Thibaut Baissac
Human Anatomy As Code
