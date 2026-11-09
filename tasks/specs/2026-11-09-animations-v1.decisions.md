# Animations v1 : décisions prises à l'implémentation

## Mesure (`fit-joints`)

- **Données lues.** La commande lit les fichiers YAML des structures et les OBJ, pas l'atlas compilé. L'atlas ne peut pas être compilé tant qu'une articulation n'est pas mesurée : la règle `joint-sides` l'interdit.
- **Sens positif dans les données.** `fit.positiveDirection` donne la direction que prend l'extrémité distale sous une petite rotation positive :
  - coude et pronation : −Y, vers l'avant ;
  - genou : +Y, vers l'arrière.

  L'axe de chaque côté est orienté d'après ce champ. Les axes gauche et droit en sortent cohérents : même sens pour la flexion, sens opposés pour la prono-supination.
- **Angle de repos.** Il est mesuré entre des axes mécaniques : du centre de l'articulation à l'extrémité de chaque segment (les 15 derniers mm). Les centroïdes des os donnaient −0,7° au genou, hors amplitude, à cause de la courbure des diaphyses.
  - Résultats : coude 13,1°, genou 1,5°, contre 13,5° et 1,5° dans la note de recherche.
  - La valeur écrite est la moyenne des deux côtés.
- **Paramètres retenus.** Ils reproduisent la note de recherche à quelques dixièmes de mm et de degré près pour le côté gauche :
  - coude : contact à 6 mm (ulna) et 9 mm (radius) ;
  - avant-bras : bandes de 4 à 18 mm et de 0 à 10 mm ;
  - genou : 40 mm distaux, à partir de 10 mm devant le milieu de la région, demi-écart de 6 mm.
  - Erreurs d'ajustement : de 1,7 à 2,1 mm.
- **Écart de méthode.** `measure.ts` a d'abord été mis au point sur les vrais os, pour calibrer les méthodes, avant d'écrire ses tests. Il est maintenant couvert par des tests sur des géométries synthétiques. Chaque test a été vu en échec en cassant le comportement qu'il couvre : orientation de l'axe, signe de l'angle de repos, centre ulnaire, centre des condyles, os manquant.

## Rig (`buildAssets`)

- **Candidats.** Une instance est candidate si elle est du même côté que l'articulation et que son membre est celui de l'articulation ou inconnu.
  - Beaucoup de structures BodyParts3D n'ont ni parent ni région (biceps, droit fémoral, veine grande saphène). Avec un membre exigé, le coude ne trouvait que 8 tissus qui le croisent.
- **Capsule pour les membres inconnus.** Une instance sans membre connu ne tourne en bloc que si elle tient entière dans une capsule autour du segment distal : rayon de 0,5 × sa longueur, portée de 1 × sa longueur au-delà de son extrémité. Sinon, le tronc et la jambe gauches, situés sous le plan du coude gauche, tourneraient avec l'avant-bras.
  - Flexion : la capsule va vers l'extrémité des os mobiles, car l'avant-bras est fléchi et porté au repos.
  - Prono-supination : elle descend le long de l'axe, sur la main, sur la longueur du radius. L'extrémité la plus lointaine du radius, la tête radiale, est au-dessus du plan, et la première version de la capsule remontait l'avant-bras (revue de code).
- **Marge.** Une instance dont aucun sommet ne dépasse le plan de plus de 3 mm est au-delà de l'articulation : toucher le plan n'est pas le franchir. Avant la revue de code, l'extenseur du petit doigt, le chef ulnaire du fléchisseur ulnaire du carpe et le scaphoïde (en prono-supination) n'étaient ni mobiles ni transparents.
- **Rayon du critère de franchissement.** Il est de 80 mm, comme dans la note de recherche, au lieu de 100 mm.
  - Résultat : 26 tissus au coude et 27 au genou, contre 28 et 29 dans la note.
  - La liste fonctionnelle (`actions`) ajoute le supinateur au coude.
- **Os listés.** Les os de `moving` tournent toujours, même s'ils dépassent le plan, comme le radius au-delà de la tête ulnaire. Les os de `coupled` ne sont ni `moving` ni `crossing`.
- **Peau.** Une peau sans côté ne tourne jamais en bloc, même si elle est entièrement sous le plan, car le plan est infini. Elle ne passe en transparence que si elle franchit le plan.

## Longueur des muscles : bras de levier au repos

La spec prévoyait de comparer la longueur de la corde origine → insertion à l'angle courant et à l'angle courant − 1°. Sur les vrais meshes, cette corde fait le tour de l'axe aux grands angles. Le quadriceps « se raccourcissait » ainsi en flexion complète, parce que le vrai muscle s'enroule sur la patella alors que la corde passe derrière l'axe.

Ce qui a été retenu à la place :

- **Bras de levier au repos.** Le rig garde, pour chaque muscle, son bras de levier au repos (`momentArmMm`). C'est la dérivée de la longueur de la corde par rapport à l'angle, en mm/rad ; il est négatif quand le muscle se raccourcit dans le sens positif. Les points d'insertion ne sont pas transmis à l'app.
- **Origine.** Pour la flexion, c'est le passage du muscle au-dessus de l'articulation : ses sommets de 3 à 50 mm au-dessus du plan. À défaut, c'est le contact avec l'os proximal, puis l'extrémité proximale du muscle.
- **Insertion.** C'est le contact (5 mm) avec un os mobile, ou à défaut l'extrémité distale si le muscle dépasse le plan.
  - Un muscle sans insertion qui suive l'articulation n'a pas de bras de levier : c'est le cas du chef court du biceps, dont le tendon distal est modélisé dans le chef long, et de muscles de la prono-supination situés au-dessus de la tête ulnaire.
- **Seuil « stable ».** Il est de 5 mm/rad en flexion-extension, au lieu de 0,5 mm pour 1°, qui aurait rendu presque tous les muscles « stables ». Il est de 1 mm/rad en prono-supination : les cordes y sont presque parallèles à l'axe, et à 5 mm/rad tous les muscles de l'avant-bras paraissaient « stables » (revue de code).
  - Avec ce seuil, le carré pronateur se raccourcit et le supinateur s'allonge en pronation.
  - Le rond pronateur reste « stable », et le chef long du biceps aussi à gauche ; à droite, sa géométrie contredit son rôle de supinateur (−3,4 mm/rad) : il est « non mesurable », et le build l'avertit.
- **Indicateur.** Le sens du mouvement vient de la lecture en cours, sinon du dernier déplacement du curseur (un retour vers 60° depuis 90° est une extension), sinon de la position par rapport au repos.
  - Quand la géométrie contredit le rôle déclaré, l'interface affiche « non mesurable sur ce modèle » plutôt qu'une flèche fausse, et le build l'avertit.
  - Cas sur les données actuelles : sartorius, gracile (ils passent devant l'axe mesuré dans BodyParts3D) et court extenseur radial du carpe.

## Données

- **Muscles non annotés.** L'extenseur ulnaire du carpe, l'extenseur des doigts et l'extenseur du petit doigt croisent le coude, mais n'ont pas de rôle reconnu au coude : ils ne sont pas annotés, mais restent transparents puisqu'ils le franchissent.
- **Tenseur du fascia lata.** Il n'est pas annoté : seul le tractus iliotibial (un fascia) existe, et seul un muscle a des actions.
- **Source `curated` pour une action.** Elle est acceptée, comme pour les labels, pour le poplité et le plantaire, absents de Rajagopal 2016.
- **Source `morrey-1981`.** Elle est ajoutée pour l'arc fonctionnel du coude (un fait cité), en plus des trois sources de la spec.
- **Notices de licence.** Les sources ont un champ `notice` (MIT, BSD-3), reproduit dans `attributions`.
- **Re-import BodyParts3D.** `actions` est une donnée de curation : un re-import la conserve (test ajouté).

## Viewer et interface

- **Pose de repos de l'avant-bras.** −85°, soit la supination complète, a été vérifiée visuellement : au repos la paume est en avant, à 0° la main est de profil, à +77° le dos de la main est en avant.
- **Angles de repos fractionnaires.** Un angle entier à moins de 0,5° du repos (13° pour 13,1°) est la pose de repos : pas de rotation, pas de transparence, rien dans l'URL.
- **Muscle sélectionné qui franchit l'articulation.** Il devient un fantôme en surbrillance : sa forme rigide serait fausse.
- **Lecture.**
  - Elle part de l'angle courant, vers le haut de l'amplitude.
  - L'arrêt garde l'angle, et retire la pose si l'angle est au repos.
  - La lecture s'arrête au changement de modèle, d'articulation ou de côté, et quand la section disparaît, par exemple en changeant d'onglet sur téléphone.
- **Page Up / Page Down.** Ils déplacent de 10°. Les navigateurs, eux, avancent de 10 % de l'amplitude (14,5° au coude).
- **Bug corrigé : nom de la peau.** GLTFLoader renomme un nœud qui porte le nom de la scène : « skin » devenait « skin_1 ». La peau n'était donc reconnue ni comme peau ni comme sélection. Le nom de l'instance vient désormais des extras du nœud (`slug`, `side`).
- **Interface en test.** `Viewer.instanceState(name)` et `Viewer.screenPointOf(name)` exposent la matrice, l'alpha et la position à l'écran d'une instance pour les tests e2e.
- **Changement de modèle (revue de code).** Les instances déplacées reviennent au repos au début de `load`, tant que les indices globaux sont encore ceux du modèle quitté. Avant, un changement femme → homme, coude fléchi, plantait.
- **Pose venue de l'extérieur.** Une pose posée de l'extérieur (curseur, URL, bouton Précédent) arrête la lecture.
- **Lecture : une seule règle d'angle.** `normaliseAngle` (pose.ts) arrondit, borne et ramène au repos, pour l'URL, le curseur et l'arrêt de la lecture.
- **Lecture : rendu.** Pendant une lecture, l'arbre est mémoïsé et la liste des muscles est calculée une fois (`musclesOf`), pas à chaque image.
- **Crédits.** Un bouton « Licences… » ouvre la liste des sources du modèle affiché, avec leur notice (MIT, BSD-3).
