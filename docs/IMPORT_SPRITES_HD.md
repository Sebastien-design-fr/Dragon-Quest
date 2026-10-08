# Préparation HD sur lumia-test

Les 40 bundles approuvés sont toujours basse définition. Aucun original conforme n'a été identifié.
Le jeu reste sur `DragonView`, poses peintes, sans nouveau moteur graphique.

### Remplacement sécurisé
1. Faire peindre les 40 **vraies** illustrations sources, non agrandies, avec un canal alpha réel et un cadrage identique entre poses d'un même stade. Le format d'entrée est PNG RGBA >=1600 px; 2048 px recommandé.
2. Les sources sont nommées `dragon_baby_full.png` etc., pour les 40 entrées (incluant les `flyMid` présents dans les bundles).
3. `python3 -m pip install Pillow`; `python3 scripts/import-hd-sprites.py <dossier_sources>`. L'outil **ne redimensionne jamais** et écrit uniquement dans `hd-import-output/`, avec un registre SHA256. Les WebP sont exportés qualité 94.
4. Comparer visuellement les huit formes debout et toutes les poses. Seule la validation artistique permet le remplacement. Le script ne garantit pas la fidélité des peintures.
5. Après validation, copier les huit bundles `hd-import-output/*.json` dans `assets/dragon-mission-approved/`, puis exécuter `DRAGON_HD_REQUIRED=1 npm run build`. Ce mode strict refuse les sprites de largeur inférieure à 1600 px et les WebP sans alpha.
6. Activer définitivement le mode strict dans le build **dans le même commit** que les 40 sprites HD validés. Conserver l'APK sous 60 Mo; mesurer son poids après GitHub Actions.

NE PAS désactiver le verrou strict pour livrer de faux sprites HD. NE PAS agrandir les 640×360 existants. La branche `graphics-engine-v2` est gelée.
