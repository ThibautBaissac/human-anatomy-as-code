# Demande de confirmation de licence BodyParts3D (DBCLS)

**Pourquoi :** la page de licence DBCLS (mise à jour le 2025-02-27) indique CC BY 4.0, mais chaque fichier OBJ de BodyParts3D 4.0 porte encore l'en-tête « CC Attribution-Share Alike 2.1 Japan ». Tant que ce point n'est pas confirmé par écrit, le projet ne publie pas d'assets dérivés (voir `data/sources/bodyparts3d.yaml`).

**À qui :** le contact indiqué sur la page de licence, https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (« contact the licensor »), ou à défaut la page de contact du DBCLS / NBDC. Vérifier l'adresse sur le site avant l'envoi.

**Pièce jointe utile :** une capture de l'en-tête d'un fichier OBJ, par exemple les premières lignes de `FJ3259.obj`.

---

**Objet :** BodyParts3D 4.0 — confirmation of the CC BY 4.0 licence for redistributing derived 3D models

Dear BodyParts3D / DBCLS team,

I am developing *Human Anatomy As Code*, a free, open-source 3D anatomy atlas for students that works offline in a web browser. Its anatomical data (names, identifiers, hierarchy) is published under CC BY 4.0, and it is built on BodyParts3D 4.0, which we credit as requested: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International".

Before publishing anything, I would like to confirm the licence terms, because the sources we have seem to disagree:

- your licence page (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html, last updated 2025-02-27) states that the database is licensed under Creative Commons Attribution 4.0 International;
- however, every OBJ file in `isa_BP3D_4.0_obj_99.zip` and `partof_BP3D_4.0_obj_99.zip` still carries a header stating "CC Attribution-Share Alike 2.1 Japan".

Could you please confirm:

1. that the BodyParts3D 4.0 OBJ files themselves (including the `_99` reduced meshes and the `FJxxxxM` mirrored files) are covered by CC BY 4.0, and that the CC BY-SA 2.1 JP header is outdated;
2. that we may redistribute derived files (the meshes converted to glTF/GLB, compressed, and grouped by anatomical structure), together with the parts lists you publish, under CC BY 4.0 with the attribution above;
3. whether the NBDC Terms of Service add any condition for this kind of non-commercial and potentially commercial redistribution, beyond attribution.

If the OBJ headers are going to be updated, we would gladly use the new files.

Thank you very much for creating and maintaining BodyParts3D: it is the only permissively licensed whole-body model that is linked to the FMA, and it makes projects like ours possible.

Best regards,

Thibaut Baissac
Human Anatomy As Code

---

**Après la réponse :**
- Si le DBCLS confirme CC BY 4.0, retirer la réserve dans `data/sources/bodyparts3d.yaml` (champ `notes`), archiver la réponse dans `docs/licence/`, et lever le blocage du déploiement public (specs viewer et offline, « Out of scope »).
- Si le DBCLS maintient BY-SA 2.1 JP, les assets dérivés devront être publiés sous CC BY-SA, séparés de la couche sémantique (qui reste CC BY 4.0, voir `data/LICENSE.md`).
