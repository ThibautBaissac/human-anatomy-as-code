# Une structure canonique, ses côtés comme instances

La FMA et BodyParts3D modélisent « fémur gauche » et « fémur droit » comme des concepts distincts, alors que TA2 et Wikidata ne nomment que « fémur ». On décrit chaque structure une seule fois, de façon canonique, avec une latéralité (`bilateral | midline | unpaired-left | unpaired-right`) et, pour les structures bilatérales, un bloc par côté qui porte ses propres identifiants FMA et son mesh. Les noms latéralisés (« fémur droit », *femur dextrum*) sont composés à partir du label canonique et de son genre grammatical, jamais stockés.

## Considered Options

- **Un fichier par concept FMA latéralisé** : correspondance 1:1 avec la source, mais deux fois plus de fichiers, des labels dupliqués, et 71 % de couverture FR au lieu de 13 % (spike Wikidata).

## Consequences

- Il faut stocker le genre grammatical de chaque label FR et latin.
- Les relations futures (innervation, vascularisation) se décrivent au niveau canonique ; une asymétrie réelle (veines gonadiques, nerfs laryngés récurrents) se décrit au niveau du côté.

## Amendement (2026-11-11)

- « Jamais stockés » ne vaut que pour les noms composés. Quand le mot de côté est au milieu du nom FMA (« long head of left biceps brachii »), la composition le mettrait en tête : le nom FMA du côté est alors stocké comme surcharge anglaise (`sides.<côté>.labels.en`), comme le prévoit la spec `2026-11-08-modele-de-donnees`. C'est le cas de 180 structures.
- Le slug dérive du nom anglais FMA et non de TA2 (même spec, *Further notes*).
- Les 71 % de couverture FR sont ceux du spike Wikidata ; le jeu de données importé en a 60 %.
