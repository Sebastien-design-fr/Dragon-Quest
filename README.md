# Quête du Dragon — socle du dragon évolutif

Jeu mobile Android : un dragon occidental noir qui grandit en 4 stades, s'anime et se personnalise avec des équipements achetés en boutique.

Ce dépôt contient **le socle technique** : moteur d'animation à squelette, couches graphiques, ancrages, boutique, inventaire, sauvegarde, qualité graphique. Les illustrations définitives ne sont pas incluses : des **placeholders procéduraux** les remplacent, et chaque fichier livré prend leur place automatiquement.

## Technologie

| Élément | Choix |
|---|---|
| Langage | TypeScript, sans framework (léger sur mobile) |
| Rendu | Canvas 2D, squelette 2D maison |
| Appli Android | Capacitor (la page web est embarquée dans un APK natif) |
| Build de l'APK | GitHub Actions (`.github/workflows/android.yml`) |

## Obtenir l'APK

1. Pousser sur `main` (ou lancer le workflow à la main dans l'onglet **Actions**).
2. Ouvrir l'exécution terminée, section **Artifacts**, télécharger `quete-du-dragon-apk`.
3. Sur le téléphone : autoriser l'installation depuis cette source, puis ouvrir l'APK.

Pour une version publiée : créer un tag `v0.1.0`, l'APK est attaché à la Release.

## Développer en local

```bash
npm install
npm run build     # manifeste des assets + compilation TypeScript -> www/js
npm run serve     # http://localhost:5173 (tester en mode téléphone dans le navigateur)
npm run rigs      # régénère les squelettes des 4 stades
```

## Architecture

```
src/
  core/        types (modèle de données), maths 2D, chargement JSON, événements
  engine/      Skeleton (os + ancrages), Animator (clips JSON, fondus),
               DragonView (couches, équipements accrochés), Particles,
               AssetManager (chargement à la demande, libération, placeholders),
               Placeholders (dessin procédural en attendant les illustrations)
  game/        Catalog (toutes les définitions), GameState (progression, achats),
               save/ (sauvegarde locale, interface prête pour le cloud)
  ui/          App + écrans Dragon, Boutique, Inventaire, Réglages
www/
  data/        TOUT le contenu du jeu, en JSON
  assets/      illustrations (vides pour l'instant)
```

### Le dragon : couches et squelette

Le dragon n'est pas une image unique. C'est un squelette d'os (corps, 2 segments de cou, tête, mâchoire, cornes, œil, paupière, 2 ailes, 4 pattes, 4 segments de queue) portant chacun une pièce graphique, plus des couches indépendantes :

`magicalEffect` · `base` · `headEquipment` · `neckEquipment` · `bodyEquipment` · `legEquipment` · `wingEquipment` · `tailEquipment` · `foregroundEffect`

Chaque couche peut être masquée (`view.setLayerVisible`) ; les équipements se remplacent par catégorie.

**Les 4 stades partagent les mêmes os et les mêmes noms d'ancrages** : seules les proportions changent. C'est ce qui donne l'impression d'un même dragon qui grandit, et ce qui permet de réutiliser animations et équipements sur tous les stades.

### Ancrages

Définis dans `www/data/rigs/<stade>.json`, chacun attaché à un os :

`head_anchor`, `mouth_anchor`, `neck_anchor`, `chest_anchor`, `front_leg_anchor`, `rear_leg_anchor`, `front_leg_far_anchor`, `rear_leg_far_anchor`, `left_wing_anchor`, `right_wing_anchor`, `tail_anchor`, `tail_tip_anchor`, `body_center`.

Un équipement est dessiné dans le repère de son ancrage, recalculé à chaque image à partir de l'os animé : **le casque suit la tête, la protection d'aile suit l'aile, la lame suit la queue**. Aucune coordonnée écran fixe.

Réglages → « Afficher les points d'ancrage » les montre en direct.

### Animations

Clips JSON dans `www/data/animations/` : `idle`, `happy`, `sleep`, `eat`, `attack`, `fire`, `level_up`, `evolution`. Une piste = un os + des canaux (`x`, `y`, `rot`, `sx`, `sy`) en **décalages par rapport à la pose de repos**, donc valables pour les 4 stades. Les événements (`emit`, `flash`, `shake`, `swapStage`) déclenchent particules et effets.

Ajouter une animation : créer `ma_anim.json`, l'ajouter dans `animations/index.json`, appeler `view.play('ma_anim')`.

## Ajouter du contenu (sans toucher au code)

### Un équipement

1. Déposer les images dans `www/assets/equipment/<categorie>/` :
   - une par stade : `eq_head_rare_02_baby.webp`, `..._young`, `..._adult`, `..._legendary` ;
   - ou une seule, sans suffixe : `eq_head_rare_02.webp` (mise à l'échelle automatique) ;
   - optionnel : `eq_head_rare_02_icon.webp` pour la vignette de boutique.
2. Ajouter l'entrée dans `www/data/equipment.json` :

```json
{ "id": "head_dragonbone", "name": "Casque d'os", "category": "head", "rarity": "rare", "price": 450,
  "description": "...", "asset": "eq_head_rare_02",
  "compatibleDragonStages": ["young", "adult", "legendary"],
  "animationProfile": "rigid", "stats": null,
  "offsets": { "adult": { "x": 0, "y": -4, "rotation": 0, "scale": 1 } } }
```

L'image doit être un PNG/WebP transparent, centré sur le point d'ancrage, sans décor. Les champs `owned` / `equipped` ne sont pas dans le catalogue : ils vivent dans la sauvegarde du joueur.

`animationProfile` : `rigid` (suit l'os), `sway` (balancement secondaire, ex. pendentif), `pulse` (halo lumineux).

### Une catégorie, une rareté, un effet, une collection

| Quoi | Fichier |
|---|---|
| Catégorie | `data/categories.json` (couche, ancrages, taille, icône) |
| Rareté | `data/rarities.json` (couleur, halo) |
| Effet de particules | `data/effects.json` |
| Collection saisonnière | `data/collections.json` (fenêtre de dates) + `"collection": "halloween"` sur l'équipement |
| Stade | `data/stages.json` + un rig |

Un équipement saisonnier n'apparaît en boutique que pendant sa fenêtre ; une fois acheté il reste dans l'inventaire.

### Les illustrations du dragon

Chaque stade est découpé en pièces transparentes, une par os :

```
www/assets/dragon/adult/dragon_adult_torso.webp
                        dragon_adult_head.webp
                        dragon_adult_jaw.webp
                        dragon_adult_neck_1.webp / neck_2
                        dragon_adult_wing.webp
                        dragon_adult_leg_front.webp / leg_rear
                        dragon_adult_tail_1.webp … tail_4
                        dragon_adult_horn_back.webp / horn_front
                        dragon_adult_eye.webp / eyelid
```

Chaque pièce est dessinée dans la boîte et autour du pivot indiqués dans le rig (`part.w`, `part.h`, `part.pivot`). Les fichiers présents remplacent leur placeholder au prochain build, sans autre modification. Prévoir un léger chevauchement aux articulations.

**Brief pour l'illustrateur** : livrer chaque stade en pièces séparées, sur fond transparent, vue de profil (tête à droite), pose neutre identique à celle des placeholders. Dans un outil type Spine ou Rive, on peut aussi caler le squelette directement sur l'illustration puis reporter les coordonnées dans le rig.

## Performance

- Seuls les fichiers réellement présents (liste générée au build) sont demandés.
- Les images d'un stade sont libérées quand le dragon évolue ; celles d'un équipement quand il est retiré.
- Particules en pool fixe (aucune allocation pendant le jeu).
- La boucle s'arrête quand l'appli passe en arrière-plan.
- `data/quality.json` : **LOW** (aucune particule, 30 i/s, résolution 1x), **MEDIUM**, **HIGH**. Les effets se coupent aussi indépendamment.

## Sauvegarde

Stockée sur l'appareil : stade, niveau, XP, or, objets possédés, objets portés, réglages. `game/save/SaveBackend.ts` définit une interface ; un futur backend cloud s'y branche (`SyncSaveBackend` en esquisse) sans changer le reste du jeu.

## À venir

- Profils Enfant / Parent, missions, validation et notifications (en discussion).
- Remplacement des placeholders par les illustrations définitives.
