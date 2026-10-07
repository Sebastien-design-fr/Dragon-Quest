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

1. Pousser sur `main` pour la version familiale, ou sur `v1-polish` pour générer l'APK de prévalidation 0.18.
2. Ouvrir l'exécution terminée, section **Artifacts**, télécharger `quete-du-dragon-apk`.
3. Sur le téléphone : autoriser l'installation depuis cette source, puis ouvrir l'APK.

**Version familiale stable :** `releases/latest/download/quete-du-dragon.apk`  
**Prévalidation 0.18 (`v1-polish`) :** la pré-release `v1-polish-test` contient également `quete-du-dragon.apk` sans remplacer la version familiale stable.

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

**Mode actuel : illustration entière.** Une image par stade dans `art/dragons/<stade>.png` (fond transparent, profil, tête à droite, même pose pour les 4 stades). `python3 scripts/import-dragons.py` la découpe, la convertit en WebP dans `www/assets/dragon/<stade>/dragon_<stade>_full.webp` et génère `www/data/rigs/<stade>.sprite.json` (ancrages des équipements, en pixels de l'image, réglables en tête du script). Les animations utilisent alors les variantes `<animation>@sprite.json` (mouvements du corps entier : respiration, saut, élan, souffle de feu…).

**Mode « pièces » (pour une animation articulée)** : chaque stade découpé en morceaux, comme ci-dessous.


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

## Mode maison : profils, missions et validations

Une seule appli, deux profils choisis au premier lancement :

- **Enfant** : son dragon, ses missions du jour (« C'est fait »), les initiatives, la boutique, l'inventaire. Rappels à l'heure de chaque mission puis relance 1 h plus tard, programmés par le téléphone lui-même.
- **Parent** : les demandes à valider (aussi directement depuis la notification : Valider / À refaire, ou +10 / +25 pour une initiative), les missions de chaque enfant (création, jours, heure, quêtes spéciales), le coup de cœur (bonus libre), l'ajout de téléphones.

Les téléphones se parlent **directement sur le Wi-Fi de la maison**, sans serveur ni compte :

- découverte automatique (mDNS / NSD), connexion TCP directe ;
- messages signés (HMAC-SHA256) avec la clé secrète de la famille, transmise une seule fois à l'appairage ;
- appairage par **code à 6 chiffres** affiché par un parent (valable 10 min, 5 essais) ;
- un service Android en veille reçoit les messages appli fermée et affiche les notifications (Android impose une petite notification permanente) ;
- hors du Wi-Fi, les messages attendent et partent au retour ;
- le téléphone de l'enfant fait foi pour le dragon : les parents reçoivent son état (niveau, missions du jour, équipement) et voient son dragon.

Le module natif est dans `plugins/home-link/` (Java), la logique dans `src/family/` et `src/link/`. Missions par défaut : `www/data/missions.json`.

**Tester sans téléphone** : `npm run build && npm run serve`, puis ouvrir deux onglets `http://localhost:5173/?device=parent` et `?device=enfant`. Les notifications apparaissent en bandeau en haut de page, avec leurs boutons.

**Outils de test** (XP, stades, couches) : appuyer 7 fois sur la ligne de version, en bas des Réglages ou de Famille.

## Performance

- Seuls les fichiers réellement présents (liste générée au build) sont demandés.
- Les images d'un stade sont libérées quand le dragon évolue ; celles d'un équipement quand il est retiré.
- Particules en pool fixe (aucune allocation pendant le jeu).
- La boucle s'arrête quand l'appli passe en arrière-plan.
- `data/quality.json` : **LOW** (aucune particule, 30 i/s, résolution 1x), **MEDIUM**, **HIGH**. Les effets se coupent aussi indépendamment.

## Sauvegarde

Stockée sur l'appareil : stade, niveau, XP, or, objets possédés, objets portés, réglages. `game/save/SaveBackend.ts` définit une interface ; un futur backend cloud s'y branche (`SyncSaveBackend` en esquisse) sans changer le reste du jeu.

## À venir

- Remplacement des placeholders par les illustrations définitives.
- Option : relais Supabase pour valider hors de la maison.
