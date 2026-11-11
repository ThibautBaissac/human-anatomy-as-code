# Refonte UI — décisions d'implémentation

Décisions prises là où la spec se tait ou admet deux lectures.

- **Vue Dessus.** Un regard strictement vertical rend l'axe « haut » de l'orbite indéfini. La caméra est donc placée un cheveu derrière la verticale (direction `[0, 0.01, 1]`), ce qui met le visage en haut de l'écran sans changer le vecteur `up` d'OrbitControls.
- **Transitions caméra.** L'interpolation tourne autour de la cible (azimut par le plus court chemin, élévation et distance linéaires), pour qu'un passage Face → Dos ne traverse pas le corps. À égalité (180°), elle passe par le flanc gauche.
- **Mouvement.** Le sélecteur liste chaque articulation × côté ; le mode « les deux côtés bougent ensemble » de l'ancien panneau disparaît. Pour une sélection sans côté (fémur entier), le côté gauche est présélectionné.
- **Carte Infos, section mouvement.** Pour un muscle : ses actions (articulation, rôle). Pour un os : les muscles de l'articulation choisie dans l'outil Mouvement si l'os y participe, sinon de sa première articulation.
- **Clic vs double-clic.** Le premier clic d'un double-clic sélectionne déjà ; le double-clic ajoute le cadrage.
- **Ctrl+Z** n'agit pas quand le focus est dans un champ texte ou une liste déroulante ; il agit sur une case à cocher ou un curseur.
- **Tiroir du bas.** Le résumé (nom + Animer, ou « Touchez une structure ») n'apparaît qu'à la hauteur repliée : aux autres hauteurs, la carte Infos porte déjà le nom.
- **Focus après un dialogue** ouvert depuis le menu ⋯ ou la ligne de crédits : restitution native de `<dialog>` (le bouton ⋯, ou le lien « Licences »).
- **Survol.** L'étiquette n'existe que pour un pointeur souris ou stylet (`pointerType`), et seulement si l'appareil a un pointeur fin qui survole.
- **Changement de modèle.** Un isolement ou des structures masquées sans instance dans le nouveau modèle sont abandonnés (`keepKnown`) : la bannière ne compte que ce qui est vraiment caché, et Ctrl+Z n'« annule » rien d'invisible. Revenir au modèle d'origine ne les restaure pas.
- **Focus.** Quand le contrôle qui a le focus disparaît (fermeture de la carte, Masquer, bouton d'une bannière), le focus va à la recherche (sur téléphone, au bouton loupe) ; la fermeture du tiroir le rend au bouton « Structures ».
- **Bouton Repos.** Libellé visible « Repos », nom accessible « Position de repos » (le nom contient le libellé visible).

- **Crédits (2026-11-11).** La ligne de crédits au-dessus de la vue est retirée (user story 34) : les crédits complets restent dans ⋯ → « Données et licences… », que CC BY 4.0 admet comme attribution « raisonnable selon le support ».

- **Audit UX (2026-11-11).**
  - *Cadrage entre les panneaux.* L'interface déclare au viewer la place qu'elle couvre (en-tête, tiroir Structures, carte, barres du bas ; sur téléphone, en-tête, colonne caméra et tiroir du bas compté à sa hauteur d'arrivée, plafonnée à mi-hauteur). La projection est décalée (`setViewOffset`) pour centrer la scène dans la zone libre, sans bouger la caméra ; le décalage s'amortit sur quelques images, sauf mouvement réduit. Recentrer, les vues et les cadrages tiennent dans la zone libre. Le panneau d'outil ouvert ne compte pas : il est passager.
  - *Sélection au clic.* Une structure choisie dans la 3D et recouverte ensuite par un panneau est ramenée dans la zone libre (même distance) ; une structure de moins de 8 px est cadrée. Le double-clic cadre toujours.
  - *Vues caméra.* Sous 1 200 px de large, ou sur téléphone, les vues prédéfinies passent dans un menu « Vue » ; le téléphone garde une colonne d'icônes.
  - *Langue des noms.* Trois boutons FR / EN / LA précédés de « Noms en », à la place de la liste déroulante : l'interface reste en français.
  - *Arbre.* Trié par nom affiché (collation de la langue), filtre au-dessus, marque de langue sur un nom affiché dans une autre langue que celle choisie, œil pour masquer ou réafficher une structure. L'œil est un raccourci souris (masqué aux lecteurs d'écran) : au clavier, sélectionner puis Masquer.
  - *Accueil.* Un message unique au premier lancement (gardé dans le navigateur) ; une recherche vide propose quelques structures.
  - *Dissection.* Noms des couches sous le curseur, « Visible à partir de », et un avis quand toutes les structures affichées sont à la même profondeur.
  - *Thème clair.* Le sombre reste le défaut ; ⋯ → Thème propose Clair et « Comme le système ».
- **Rendu (2026-11-11).** La géométrie BodyParts3D n'existe qu'en version réduite à 99 % : le gain vient de l'éclairage. Environnement de studio pré-filtré (`RoomEnvironment`, intensité basse), lumière principale de face-gauche au-dessus, contre-jour froid, lampe frontale faible ; tone mapping Neutral ; rugosité par kind (os mats, vaisseaux brillants). Occlusion ambiante GTAO à mi-résolution, appliquée à la seule lumière indirecte ; le pré-rendu profondeur-normales exclut les lots transparents, si bien que les couches fantômes n'assombrissent rien. Le canvas est transparent : le fond est la couleur `--stage` du thème, hors tone mapping. ⋯ → Rendu : Détaillé (défaut sur ordinateur) ou Léger (défaut sur téléphone, sans occlusion).

Constats de revue laissés en l'état :
- Le double toucher repose sur la conversion en `dblclick` du navigateur ; il n'a pas de test e2e mobile.
- Une interruption de glissade par un geste de l'utilisateur n'a pas de test e2e (elle est couverte par l'écoute de `start` d'OrbitControls).
- Les trois aiguillages sur `Tool` (icônes, marque, contenu) restent séparés ; à regrouper si un cinquième outil arrive.
- Chaque changement de survol refait la passe d'apparence entière (≈ 0,3 ms pour 6000 instances, mesuré en revue).
