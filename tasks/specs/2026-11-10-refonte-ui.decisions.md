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
