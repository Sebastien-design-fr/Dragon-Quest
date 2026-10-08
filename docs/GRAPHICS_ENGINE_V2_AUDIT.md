# Lumia — chantier moteur graphique V2 (audit initial)

Date : 2026-10-08. Branche : `graphics-engine-v2`, créée depuis `lumia-test`.

## État confirmé dans les sources

- `src/engine/DragonView.ts` orchestre la scène, le dragon, le décor, les particules et les poses alternatives ; rendu final sur `HTMLCanvasElement` avec `CanvasRenderingContext2D`.
- `src/engine/SpriteSkin.ts` fournit `SpriteSkin` et `MeshRenderer` : maillage déformé calculé en WebGL puis intégré dans le canvas principal.
- `src/engine/Animator.ts`, `Skeleton.ts` et les clips JSON fournissent un rig et des courbes d'animation.
- `src/engine/AssetManager.ts` privilégie WebP puis PNG/JPEG/SVG, gère un manifeste, un chargement différé et un compteur de références.
- `scripts/install-approved-dragons.mjs` installe **40 sprites** approuvés depuis les bundles `assets/dragon-mission-approved/` dans `www/assets/` lors du build.
- `www/data/poses.json` active les poses sleep/flyUp/flyDown (et flyMid pour dragon/adult) pour quatre âges et deux variantes.
- `www/index.html` n'expose qu'un canvas de scène, le reste de l'interface demeure en HTML.
- `package.json` : TypeScript + Capacitor 7, aucun PixiJS actuellement.
- La CI construit un APK Android sur `lumia-test` ; **cette nouvelle branche n'est pas ajoutée au workflow Android**, afin de ne pas toucher à la release existante.

## Diagnostic / hypothèses à mesurer

1. Un pipeline WebGL hors écran → canvas 2D impose une copie/composition supplémentaire susceptible de coûter du temps GPU et de dégrader la netteté. **À quantifier**, et non à présenter comme la cause prouvée des artefacts.
2. Les dragons sont principalement illustrés en poses complètes. Un rig sur image aplatie ne peut pas révéler naturellement les surfaces et articulations cachées : le **découpage artistique** reste indispensable, quel que soit le moteur.
3. Les poses peintes `flyUp/flyDown` permettent un mouvement discret mais pas, seules, une continuité anatomique parfaite.
4. Vérifier taille des textures, DPR, filtration, anti-aliasing, mipmapping, `createImageBitmap`, pertes de contexte et latence Android.
5. Mesurer FPS médian / p95 de durée de frame, RAM, mémoire textures, temps de chargement, stabilité thermique et batterie sur **appareil Android réel**.

## Décision de travail (non définitive)

Créer un prototype **PixiJS** dans une page de test indépendante en parallèle du moteur existant. Ne pas remplacer `DragonView` tant que la comparaison A/B ne valide pas des gains de netteté, de fluidité et de fiabilité Android. Garder Capacitor et la logique applicative.

### Critères de validation du prototype

- Une illustration existante `dragon/adult` affichée sans rééchantillonnage flou évitable, avec résolution adaptée au DPR et redimensionnement responsive.
- Deux scènes comparables : (A) moteur actuel, (B) rendu GPU direct dans un seul canvas.
- Animation du même dragon avec mouvements tête, queue, paupières et ailes ; si éléments séparés absents, **identifier explicitement les assets à dessiner**, ne pas simuler une articulation complète par distorsion excessive.
- Cible indicative : 60 FPS sur appareil de référence compatible, p95 du temps total de frame < 16,7 ms ; mesurer un mode de repli à 30 FPS. Pas de promesse sans mesures.
- Aucun impact sur les sauvegardes, missions, achats/équipements, interactions parents-enfants ou versions publiées.

## Ordre d'exécution

1. Instrumenter les mesures A et capturer screenshots de référence, sur Android.
2. Répertorier sprites par stade, variantes, résolution, transparence et parties séparables.
3. Développer banc d'essai PixiJS isolé (GPU direct, resize, texture scaling, détection WebGL et fallback).
4. Reconstituer **un** dragon multicouche complet (tête, jaw, yeux, membres, ailes articulées, queue) et 4 animations : idle, walk, fly, sleep.
5. Comparer A/B sur plusieurs téléphones, profilage GPU/mémoire, puis arbitrer migration progressive.
6. Intégrer uniquement après validation ; garder le lien APK `dragon-mission-test` inchangé pendant cette phase.

## Risques clés

- Illustrations actuelles aplaties = reconstruction manuelle nécessaire pour les calques manquants.
- GPU Android divers : atlas compressés, limites textures, WebGL context loss et repli qualité.
- Licences, poids du bundle et compatibilité du package PixiJS à vérifier lors de son ajout.
- Rig/animation actuels servent de base pour la correspondance des os, mais ne garantissent pas une reprise 1:1.
