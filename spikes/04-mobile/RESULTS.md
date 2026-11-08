# Mesures sur appareils réels (spec 2)

Budgets (spec `2026-11-08-offline-mobile.md`), téléphone milieu de gamme, scène complète :
- chargement depuis le cache jusqu'à la première image : moins de 8 s ;
- 30 images par seconde ou plus en moyenne.

## Protocole

1. **Certificat, une fois sur le Mac.** `mkcert -install` demande le mot de passe. `npm run -w app preview:https` affiche ensuite la commande qui crée le certificat pour l'IP locale.
2. **Certificat sur le téléphone.** Installer et approuver l'autorité mkcert (`mkcert -CAROOT` → `rootCA.pem`).
   - iOS : Réglages → Général → Informations → Réglages des certificats.
   - Android : Paramètres → Sécurité → Installer un certificat.
3. **Lancer le serveur.** `npm run -w app preview:https`, puis ouvrir l'URL affichée sur le téléphone, connecté au même Wi-Fi.
4. **Première visite.** Ouvrir `…/?bench=1`, attendre le JSON (environ 15 s), puis le copier : c'est la mesure réseau.
5. **Hors ligne.** Ouvrir le panneau « Hors ligne… », puis cliquer « Rendre disponible hors ligne ».
6. **Depuis le cache.** Recharger `…/?bench=1` : le champ `source` doit indiquer `cache`. C'est la mesure du budget.
7. **Repli WebGL2.** Refaire l'étape 6 avec `…/?bench=1&backend=webgl`.
8. **Consigner.** Reporter les JSON et les observations dans le tableau ci-dessous (fluidité au doigt, échauffement, onglets, sélection au tap).

## Résultats

| Appareil | Système / navigateur | Backend | Source | Première image | Prêt à sélectionner | Frame moy. | p95 | i/s | Statut budget |
|---|---|---|---|---|---|---|---|---|---|
| Mac Apple Silicon (référence) | macOS, Chrome 157 headless | WebGPU | réseau local | 692 ms | 2 592 ms | 2,6 ms | 3,0 ms | 384 | ✅ (budget ordinateur) |
| iPhone | Safari iOS 26 | WebGPU | cache | à mesurer | | | | | |
| iPhone | Safari iOS 26 | WebGL2 | cache | à mesurer | | | | | |
| Android milieu de gamme | Chrome | WebGPU / WebGL2 | cache | à mesurer | | | | | |

## Observations

(À compléter après les mesures.)
