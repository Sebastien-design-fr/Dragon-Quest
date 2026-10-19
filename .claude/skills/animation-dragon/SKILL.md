---
name: animation-dragon
description: Règles et méthode pour créer ou retoucher les animations du dragon, de la dragonne et du loup de Quête du Dragon (clips d'os, gestes au repos, vol, ressorts, réactions). À utiliser dès qu'on ajoute un tour, un geste, une réaction, qu'on modifie scripts/build-sprite-clips.mjs, src/engine/Organic.ts, les ressorts ou le vol de DragonView, ou quand l'utilisateur dit qu'un mouvement « fait mécanique », « manque de poids » ou « n'est pas vivant ».
---

# Animation du dragon

Le dragon est une **illustration peinte** déformée par un maillage (WebGL) qui suit des os. Ce n'est pas un
modèle 3D : la profondeur vient de la lumière, des ombres et du relief, jamais d'une rotation dans l'écran.
On anime en tournant et en déplaçant légèrement les os ; l'image elle-même n'est jamais redessinée.

## Où se trouve quoi

| Besoin | Fichier |
|---|---|
| Clips d'os (tours, réactions, gestes) | `scripts/build-sprite-clips.mjs` → génère `www/data/animations/<id>@sprite.json` |
| Liste des clips chargés | `www/data/animations/index.json` (ajouter chaque nouveau clip) |
| Vie au repos (respiration, regards, gestes au hasard) | `src/engine/Organic.ts` (`DEFAULT`, `META`, poids) |
| Caractère par stade (tempo, amplitudes, inertie) | `www/data/visual.json` → `dragons.<stade>.personality` |
| Ressorts (queue, ailes, tête), vol, bond du souffle | `src/engine/DragonView.ts` (`applySprings`, `flightTick`, `leapTick`) |
| Événements dans un clip | `emit` (particules), `flash`, `shake`, `gust` (souffle d'aile), `sound`, `swapStage` |
| Réactions de l'appli à un clip (son, loup, vibration) | `view.onClip` et `view.onGust` dans `src/ui/App.ts` |
| Tours d'amitié et commandes vocales | `TRICKS` dans `src/family/Companion.ts`, mots dans `src/ui/VoiceUI.ts` |

Os disponibles : `body`, `ground`, `spine`, `neck1`, `neck2`, `head`, `wing1` (bras), `wing2` (main de l'aile),
`wingFar`, `tail1`…`tail5`, `legFront`, `legFrontFar`, `legRear`, `legRearFar`.
Sens (degrés, à l'écran) : `neck +` penche le cou en avant ; `head +` baisse le museau ; `wing2 +` lève la pointe
de l'aile ; `wing1 +` avance le poignet ; `tail +` remonte la queue. `body.y +` = vers le bas.

Outils du script : `mix(D, clés, oscillation?, pas)` pour des poses clés adoucies, `wave(D, fn, pas)` pour une
fonction du temps, `tailWave(t, D, amp, période, extra, pas)` pour une ondulation qui va de la base à la pointe.

## Les règles du mouvement

1. **Anticipation → action → suite du mouvement.** Tout geste important se découpe à peu près en
   **20 % / 50 % / 30 %** de sa durée : on se ramasse dans le sens opposé, on agit, puis tout se pose.
   Exemple : le coup d'aile lève les ailes et accroupit le corps (0 → 0,45 s) avant de frapper (0,45 → 0,68 s).
2. **Jamais tout en même temps.** Les parties démarrent et s'arrêtent décalées de 10 à 20 % de leur durée,
   dans l'ordre du « fouet » : corps → épaules / cou → tête et ailes → bout des ailes → queue jusqu'à la pointe.
   Démarrer toutes les pistes à la même image est la première cause d'un mouvement « mécanique ».
3. **Le poids.** Ce qui est lourd part tard et s'arrête tard ; les parties souples (pointe de queue, main de l'aile)
   dépassent leur position puis reviennent (ressorts de `applySprings`). Un impact s'accompagne d'un petit
   écrasement (`spine.sy` < 1, `body.y` +) puis d'un rebond.
4. **Les ailes en vol.** Battement de ±35 à 45° ; la main de l'aile (`wing2`) **suit le bras avec un retard
   de 0,15 à 0,25 du cycle**, ce qui donne l'impression que l'aile plie ; le corps monte quand les ailes
   descendent (**contre-phase**) ; pattes repliées ; la queue ondule.
5. **Au repos, il vit toujours.** Respiration (cycle de 3 à 4 s, plus rapide chez le bébé), tête qui dérive
   lentement, petits mouvements de queue, ailes qui se réajustent. Les gestes au hasard passent par la table
   pondérée d'`Organic.ts` (avec temps de repos) : pas de boucle répétée à l'identique.
6. **Les pauses comptent.** Un tour se termine par un court arrêt sur la pose (0,2 à 0,4 s) avant le retour :
   c'est ce qui le rend lisible pour un enfant.
7. **Le caractère selon le stade** (réglé dans `visual.json`, ne pas le casser) :
   - bébé (`tempo` 1,22) : vif, un peu maladroit, gestes amples, rebondit ;
   - jeune (1,08) : énergique et curieux ;
   - adulte (0,92) : assuré, gestes plus économes ;
   - légendaire (0,84) : lent, mesuré, chaque mouvement pèse.
   Un même clip sert à tous les stades : le tempo et l'inertie font la différence.
8. **Un compagnon d'enfant**, pas un monstre : les réactions restent lisibles et rassurantes (pas de mouvement
   brusque près du visage sans anticipation, pas de tremblement inquiétant prolongé).

## Limites à respecter

- Pas de nouvelles illustrations dans le code : yeux fermés, gueule ouverte et ailes à mi-course attendent les
  images décrites dans `docs/ILLUSTRATIONS.md`. En attendant, pas de clignement ni de vraie gueule ouverte.
- Rotations modérées : au-delà d'environ 30° sur un os du cou ou de l'aile, le maillage étire la peinture.
  Préférer plusieurs os qui tournent un peu.
- `prefers-reduced-motion` : pas de secousse d'écran ni de ralenti ; les réactions restent possibles.
- Téléphones modestes : un clip est échantillonné (pas de 0,03 à 0,1 s), pas de calcul lourd par image.

## Méthode

1. Écrire ou retoucher le clip dans `scripts/build-sprite-clips.mjs` (commentaire d'une ligne : ce qu'il fait).
2. Régénérer : `node scripts/build-sprite-clips.mjs` ; vérifier avec `git status` que seuls les clips voulus changent.
3. Ajouter le clip à `www/data/animations/index.json` s'il est nouveau, puis le brancher (tour, geste au repos,
   réaction, voix).
4. Compiler (`npm run build`) et vérifier dans l'aperçu (`?device=enfant`, vue mobile). Le panneau de navigateur
   met l'animation en pause quand il n'est pas au premier plan : arrêter la boucle (`__dragon.stop()`), avancer
   à la main (`__dragon.frame(1/60)` en boucle), puis copier `__dragon.canvas` dans un canvas posé en haut de
   la page pour la capture.
5. **Capturer plusieurs moments du geste**, à des fractions irrégulières de sa durée (0 ; 0,23 ; 0,41 ; 0,68 ;
   0,87), pour ne pas tomber toujours sur la même phase. Vérifier : la pose d'anticipation se lit-elle ? les
   parties sont-elles bien décalées ? la peinture se déchire-t-elle aux articulations ?
6. Ajouter une ligne aux Nouveautés (`src/ui/WhatsNew.ts`) si le changement se voit.

Sources des règles : principes d'animation classiques (anticipation, suite du mouvement, chevauchement des
actions) et recettes d'animation procédurale de créatures ailées relevées dans des skills publics
(higgsfield-ai/skills, omer-metin/skills-for-antigravity), adaptées à ce moteur.
