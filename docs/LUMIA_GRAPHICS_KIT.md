# Lumia Graphics Kit — architecture réutilisable (prototype)

## Intention
Le moteur graphique est conçu comme une **bibliothèque réutilisable** pour d'autres applications, non comme un assemblage de fonctions codées en dur pour Lumia.

## Composants disponibles sur la branche `graphics-engine-v2`
- `www/labs/baby-motion.js`: contrôleur temporel indépendant du contenu (idle, sleep, fly, touch). API `setMode/touch/update`.
- `www/labs/depth-stage.js`: kit de mise en scène 2,5D ; PixiJS injecté, API `configure/resize/movePointer/tick/destroy`. Il ajoute des plans en parallaxe, un halo d'ambiance et une ombre de contact.
- `www/labs/gpu-prototype.js`: adaptateur temporaire pour le jeu Lumia. Doit **rester séparé** du kit commun.
- `www/labs/graphics-v2.html`: page de démonstration A/B visuelle.

## Important : volume ≠ véritable géométrie 3D
Les images restent planes. Les effets mis en œuvre apportent de la profondeur **dans la scène**, pas un éclairage volumétrique qui suit l'anatomie du dragon.
Pour un rendu proche de la 3D, fournir :
1. Sprites séparés pour yeux, tête, cou, membres, ailes, membranes et queue ; os / contraintes.
2. Cartes de normales correctement peintes **par morceau**, et un shader de lumière compatible Pixi.
3. Ombres portées/occlusion raisonnables, highlights localisés, couche de profondeur optionnelle.
4. Textures adaptées au DPR / atlases / budgets mémoire Android.

Éviter de prétendre qu'une normal map calculée automatiquement depuis une image entière restitue la véritable géométrie : une image plate ne contient pas la forme cachée.

## Jalons de validation
- Rendu stable sur Android réel ; FPS p50/p95, charge GPU et mémoire à relever.
- Basculer 2,5D activé/désactivé sur **les deux bébés**, conserver 30 FPS repli.
- Aucun impact sur les branches publiées tant que la validation n'est pas complète.
- Contrat futur pour extraction d'un package : `createRenderer(canvas,options)`, `loadCharacter(manifest)`, `play(animation)`, `setLighting(config)`, `dispose()`.

## Limite du prototype actuel
Dépendance PixiJS 8 injectée via CDN uniquement pour les essais, non empaquetée pour Android.
Le nouveau code n'a pas encore été exécuté dans une WebView Android : aucun gain mesuré n'est annoncé.
