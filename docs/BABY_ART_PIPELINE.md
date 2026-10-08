# Lumia V2 — production des calques bébé (mâle et femelle)

## Contrat d'intégration réel
Emplacements prévus :
- `www/assets/layers/dragon/baby/rig.json`
- `www/assets/layers/dragonne/baby/rig.json`

Chacun contient `parts`, avec pour chaque élément :
`name`, `texture` (nom local `*.webp`), `position: [x,y]`, optionnellement `parent`, `pivot: [u,v]`, `offset`, `z`.

Les textures doivent être **des couches anatomiques découpées et correctement repeintes** à partir des illustrations approuvées. La transparence, le raccord des articulations et les surfaces cachées doivent être validés par un regard humain. Ne PAS exporter des recadrages bruts comme si les morceaux manquants étaient dessinés.

## Liste d'assets par variante
`body.webp`, `head.webp`, `neck.webp`, `jaw.webp`, `eye.webp`, `eyelid.webp`, `tail.webp`, `wingNear.webp`, `wingFar.webp`, `legFrontNear.webp`, `legFrontFar.webp`, `legRearNear.webp`, `legRearFar.webp`.

À compléter par cartes de normales rédigées pour chaque élément après validation des silhouettes et du rig. Une carte générée automatiquement à partir d'une image aplatie est une approximation.

## Protocole de contrôle
1. Comparer silhouette et couleurs avec l'original, sans écart de proportion.
2. Régler les pivots ; contrôler les raccords entre tête, cou, corps, queue, membranes.
3. Jouer `idle`, `sleep`, `fly`, `happy` à 0.25×, 1× et 2×.
4. Tester mâle et femelle séparément sur Android ; relever FPS, p95, mémoire, captures.
5. Enregistrer des rapports de validation Android distincts avant toute généralisation.
6. Ne jamais promouvoir automatiquement les formes jeune/adulte/légendaire sur un simple test JavaScript.

## État
Le moteur sait charger conditionnellement `rig.json` et anime ses os s'il est fourni. Ces ensembles de textures anatomiques ne sont **pas encore livrés** : le fallback sprite entier reste normal, et les tests de code ne prouvent pas la qualité artistique.

## Assemblage retenu le 08/10/2026
Référence : la dernière planche corrigée, avec une queue anatomique (pas une troisième aile) sur la dragonne. Les deux **gabarits provisoires de 13 os** sont disponibles dans `assets/rig-templates/`. Ils définissent les noms, attaches et ordre de profondeur, **pas** des points d'articulation validés.

IMPORTANT : les planches générées affichent visuellement des fonds quadrillés, mais il faut vérifier les **vrais canaux alpha** des fichiers individuels. Ne pas découper les boîtes de légende de la planche comme des calques.
Exporter chaque partie séparément en WebP RGBA avec extension peinte sous les jonctions, dimensions cohérentes et géométrie revue.

Avant le transfert du gabarit vers `www/assets/layers/<variante>/baby/rig.json` :
1. Installer Pillow puis lancer `python3 scripts/check-baby-layers.py www/assets/layers/dragon/baby` et la même commande pour `dragonne`.
2. Examiner chaque raccord sur les mouvements extrêmes (aile haute/basse, mâchoire ouverte, tête tournée).
3. Comparer côte à côte avec le modèle de référence. La vérification automatisée ne détecte pas tous les contours parasites et ne remplace pas cette inspection.
4. Ne créer le manifeste de production qu'après la présence des 13 images validées. Sinon le moteur doit conserver les sprites existants.

Les nouveaux gabarits sont intentionnellement hors du dossier `www/assets/layers` afin de ne pas activer un personnage incomplet dans l'APK.
