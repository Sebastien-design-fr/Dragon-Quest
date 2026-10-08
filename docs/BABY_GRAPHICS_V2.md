# Lumia — bébés dragons : lot expérimental 1

Le banc d'essai démarre sur les **deux bébés** du projet (mâle/femelle).
`BabyMotion` ajoute respiration, flottement, petit saut de réaction au toucher et micro-rotation.
Il ne prétend **pas** rendre indépendants les yeux, les pattes, la queue et les ailes :
les sources actuelles sont des illustrations aplaties, à découper/refaire pour obtenir un véritable rig.

## Vérification locale

1. `npm run build` à la racine du dépôt (installe les bundles WebP approuvés).
2. Démarrer le serveur local habituel du projet : `npm run serve`.
3. Ouvrir `/labs/graphics-v2.html` dans le serveur, avec accès Internet pour le CDN PixiJS.
4. Sélectionner mâle / femelle, puis tester les modes, le toucher et les compteurs de FPS.
5. Test logique hors interface : `node www/labs/baby-motion.test.mjs`.

Ne pas confondre FPS RAF affichés et profil GPU : il faudra profiler sur **téléphone Android réel**, en mesurant p95 et mémoire.

**Aucun build APK déclenché** : `graphics-engine-v2` reste hors des branches de publication GitHub Actions.
