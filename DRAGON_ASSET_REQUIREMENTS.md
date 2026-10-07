# DRAGON_ASSET_REQUIREMENTS

Assets à produire pour dépasser les limites constatées à l’audit du LOT 1 (`docs/visual/DRAGON_MATRIX.md`, généré par `scripts/audit-dragons.py`).
Organisation : par dragon, puis par stade. Rien ici n’est déduit d’un nombre de stades fixe : la liste suit le contenu du dépôt (2 variantes × 4 stades).

## Règles communes à tous les assets

- **Format** : PNG 32 bits, fond **transparent**, aucun halo de couleur du fond autour du dragon (détourage propre, bords anti-aliasés sur transparent).
- **Orientation** : vue de profil, **tête vers la droite**, comme les illustrations actuelles.
- **Identité** : couleurs, écailles, cornes, crête, motifs dorés/violets, proportions et nombre de doigts **strictement identiques** à l’illustration de référence du même stade (`www/assets/<variante>/<stade>/<variante>_<stade>_full.webp`). Même éclairage (lumière venant du haut à gauche), même style peint.
- **Un seul dragon par image** (pas de planche) : les planches actuelles de 8 dragons sur 1536 px donnent des poses trop petites.
- **Calques d’une même pose** (yeux fermés, gueule ouverte, aile séparée) : **même taille de toile et même cadrage au pixel près** que l’image de base, pour se superposer exactement. Seule la zone modifiée change ; le reste est transparent (calque) ou identique (variante complète).
- **Résolutions** : calculées pour l’écran le plus dense mesuré (1440×3120, densité 3,5) avec 15 % de marge. Sous ces tailles, l’image est agrandie et donc floue, quel que soit le filtrage.
- **Ne pas** découper automatiquement une aile dans la peinture actuelle : le corps situé derrière n’existe pas. Les cas où une zone doit être **repeinte** sont signalés.

Priorités : **P0** = amélioration majeure indispensable · **P1** = forte amélioration · **P2** = facultatif.

## Dragon de l’enfant (variante « dragon »)

### Bébé (baby)

Existant : NORMAL 1236×831, SLEEP 472×178, WINGS_UP 470×221, WINGS_DOWN 457×191, WINGS_MID absent. Squelette `baby.sprite.json` (19 os dont 16 souples), 13 ancrages, 22 équipements compatibles.

| Asset | Nom recommandé | Résolution mini (largeur) | Cadrage / point d’ancrage | Os concernés | Zone à repeindre | Animation rendue possible | Priorité |
|---|---|---|---|---|---|---|---|
| WINGS_UP refait en grand | `dragon_baby_wings_up.png` | 1200 px (actuel 470, agrandi ×1.86) | Dragon entier, tête à droite, **même position de tête, de corps et de queue** que WINGS_MID et WINGS_DOWN (seules les ailes changent). Ancrage : point sous le centre du corps. | wing1, wing2, wingFar | — | Vol net ; battement sans saut de la queue | **P0** |
| WINGS_MID (nouveau) | `dragon_baby_wings_mid.png` | 1200 px | Identique à WINGS_UP sauf ailes à l’horizontale (milieu du battement) | wing1, wing2, wingFar | — | Battement en 3 temps (haut → milieu → bas), timing asymétrique crédible | **P0** |
| WINGS_DOWN refait en grand | `dragon_baby_wings_down.png` | 1200 px (actuel 457, agrandi ×1.86) | Identique à WINGS_UP sauf ailes basses ; **queue identique** (aujourd’hui la queue change de forme d’une image à l’autre) | wing1, wing2, wingFar | — | Vol net et continu | **P0** |
| SLEEP refait en grand | `dragon_baby_sleep.png` | 1200 px (actuel 472, agrandi ×2.08) | Couché, tête à droite, même échelle de tête que NORMAL | spine, neck1–2, head, tail1–5 | — | Dodo net (respiration, queue qui bouge) | **P0** |
| Yeux fermés (calque) | `dragon_baby_eyes_closed.png` | 1236×831 (même toile que NORMAL) | Calque transparent superposé à NORMAL au pixel près : seulement les paupières fermées | head | Paupières (petite zone) | Clignement irrégulier (BLINK) ; aujourd’hui désactivé faute d’asset | **P1** |
| Gueule ouverte (variante) | `dragon_baby_mouth_open.png` | 1236×831 | Même toile que NORMAL ; seule la tête change (mâchoire ouverte, langue/dents visibles) | head (+ mouth_anchor) | Tête entière à repeindre (mâchoire) | Rugissement, souffle de feu, bâillement, manger crédibles | **P1** |
| Aile proche séparée | `dragon_baby_wing_front.png` | 1236×831 | Calque contenant **uniquement** l’aile côté spectateur, à sa place dans la toile ; point d’ancrage = articulation de l’épaule | wing1, wing2 | — | Ajustements d’aile, aile qui se déploie / se replie debout, battement au décollage | **P1** |
| Corps sans l’aile proche | `dragon_baby_body_no_front_wing.png` | 1236×831 | Même toile que NORMAL, aile proche **retirée** | spine, wingFar | **Dos, flanc et aile lointaine cachés par l’aile proche : à repeindre entièrement** | Indispensable avec le calque d’aile séparée (sinon trou) | **P1** |
| Atterrissage (pose) | `dragon_baby_landing.png` | 1200 px | Pattes tendues vers le sol, ailes ouvertes freinant, même échelle que NORMAL | legs, wing1–2 | — | Atterrissage avec poids (contact, poussière) | **P2** |

### Jeune (young)

Existant : NORMAL 1239×931, SLEEP 637×232, WINGS_UP 666×262, WINGS_DOWN 574×284, WINGS_MID absent. Squelette `young.sprite.json` (19 os dont 16 souples), 13 ancrages, 28 équipements compatibles.

| Asset | Nom recommandé | Résolution mini (largeur) | Cadrage / point d’ancrage | Os concernés | Zone à repeindre | Animation rendue possible | Priorité |
|---|---|---|---|---|---|---|---|
| WINGS_UP refait en grand | `dragon_young_wings_up.png` | 1200 px (actuel 666, agrandi ×1.49) | Dragon entier, tête à droite, **même position de tête, de corps et de queue** que WINGS_MID et WINGS_DOWN (seules les ailes changent). Ancrage : point sous le centre du corps. | wing1, wing2, wingFar | — | Vol net ; battement sans saut de la queue | **P0** |
| WINGS_MID (nouveau) | `dragon_young_wings_mid.png` | 1200 px | Identique à WINGS_UP sauf ailes à l’horizontale (milieu du battement) | wing1, wing2, wingFar | — | Battement en 3 temps (haut → milieu → bas), timing asymétrique crédible | **P0** |
| WINGS_DOWN refait en grand | `dragon_young_wings_down.png` | 1200 px (actuel 574, agrandi ×1.49) | Identique à WINGS_UP sauf ailes basses ; **queue identique** (aujourd’hui la queue change de forme d’une image à l’autre) | wing1, wing2, wingFar | — | Vol net et continu | **P0** |
| SLEEP refait en grand | `dragon_young_sleep.png` | 1300 px (actuel 637, agrandi ×1.75) | Couché, tête à droite, même échelle de tête que NORMAL | spine, neck1–2, head, tail1–5 | — | Dodo net (respiration, queue qui bouge) | **P0** |
| Yeux fermés (calque) | `dragon_young_eyes_closed.png` | 1239×931 (même toile que NORMAL) | Calque transparent superposé à NORMAL au pixel près : seulement les paupières fermées | head | Paupières (petite zone) | Clignement irrégulier (BLINK) ; aujourd’hui désactivé faute d’asset | **P1** |
| Gueule ouverte (variante) | `dragon_young_mouth_open.png` | 1239×931 | Même toile que NORMAL ; seule la tête change (mâchoire ouverte, langue/dents visibles) | head (+ mouth_anchor) | Tête entière à repeindre (mâchoire) | Rugissement, souffle de feu, bâillement, manger crédibles | **P1** |
| Aile proche séparée | `dragon_young_wing_front.png` | 1239×931 | Calque contenant **uniquement** l’aile côté spectateur, à sa place dans la toile ; point d’ancrage = articulation de l’épaule | wing1, wing2 | — | Ajustements d’aile, aile qui se déploie / se replie debout, battement au décollage | **P1** |
| Corps sans l’aile proche | `dragon_young_body_no_front_wing.png` | 1239×931 | Même toile que NORMAL, aile proche **retirée** | spine, wingFar | **Dos, flanc et aile lointaine cachés par l’aile proche : à repeindre entièrement** | Indispensable avec le calque d’aile séparée (sinon trou) | **P1** |
| Atterrissage (pose) | `dragon_young_landing.png` | 1250 px | Pattes tendues vers le sol, ailes ouvertes freinant, même échelle que NORMAL | legs, wing1–2 | — | Atterrissage avec poids (contact, poussière) | **P2** |

### Adulte (adult)

Existant : NORMAL 1244×1017, SLEEP 720×283, WINGS_UP 744×289, WINGS_DOWN 672×338, WINGS_MID absent. Squelette `adult.sprite.json` (19 os dont 16 souples), 13 ancrages, 29 équipements compatibles.

| Asset | Nom recommandé | Résolution mini (largeur) | Cadrage / point d’ancrage | Os concernés | Zone à repeindre | Animation rendue possible | Priorité |
|---|---|---|---|---|---|---|---|
| WINGS_UP refait en grand | `dragon_adult_wings_up.png` | 1250 px (actuel 744, agrandi ×1.45) | Dragon entier, tête à droite, **même position de tête, de corps et de queue** que WINGS_MID et WINGS_DOWN (seules les ailes changent). Ancrage : point sous le centre du corps. | wing1, wing2, wingFar | — | Vol net ; battement sans saut de la queue | **P0** |
| WINGS_MID (nouveau) | `dragon_adult_wings_mid.png` | 1250 px | Identique à WINGS_UP sauf ailes à l’horizontale (milieu du battement) | wing1, wing2, wingFar | — | Battement en 3 temps (haut → milieu → bas), timing asymétrique crédible | **P0** |
| WINGS_DOWN refait en grand | `dragon_adult_wings_down.png` | 1200 px (actuel 672, agrandi ×1.45) | Identique à WINGS_UP sauf ailes basses ; **queue identique** (aujourd’hui la queue change de forme d’une image à l’autre) | wing1, wing2, wingFar | — | Vol net et continu | **P0** |
| SLEEP refait en grand | `dragon_adult_sleep.png` | 1400 px (actuel 720, agrandi ×1.67) | Couché, tête à droite, même échelle de tête que NORMAL | spine, neck1–2, head, tail1–5 | — | Dodo net (respiration, queue qui bouge) | **P0** |
| Yeux fermés (calque) | `dragon_adult_eyes_closed.png` | 1244×1017 (même toile que NORMAL) | Calque transparent superposé à NORMAL au pixel près : seulement les paupières fermées | head | Paupières (petite zone) | Clignement irrégulier (BLINK) ; aujourd’hui désactivé faute d’asset | **P1** |
| Gueule ouverte (variante) | `dragon_adult_mouth_open.png` | 1244×1017 | Même toile que NORMAL ; seule la tête change (mâchoire ouverte, langue/dents visibles) | head (+ mouth_anchor) | Tête entière à repeindre (mâchoire) | Rugissement, souffle de feu, bâillement, manger crédibles | **P1** |
| Aile proche séparée | `dragon_adult_wing_front.png` | 1244×1017 | Calque contenant **uniquement** l’aile côté spectateur, à sa place dans la toile ; point d’ancrage = articulation de l’épaule | wing1, wing2 | — | Ajustements d’aile, aile qui se déploie / se replie debout, battement au décollage | **P1** |
| Corps sans l’aile proche | `dragon_adult_body_no_front_wing.png` | 1244×1017 | Même toile que NORMAL, aile proche **retirée** | spine, wingFar | **Dos, flanc et aile lointaine cachés par l’aile proche : à repeindre entièrement** | Indispensable avec le calque d’aile séparée (sinon trou) | **P1** |
| Atterrissage (pose) | `dragon_adult_landing.png` | 1350 px | Pattes tendues vers le sol, ailes ouvertes freinant, même échelle que NORMAL | legs, wing1–2 | — | Atterrissage avec poids (contact, poussière) | **P2** |
| NORMAL en plus grand | `dragon_adult_full.png` | 1350 px (actuel 1244) | Même pose, même cadrage, plus de détail | tous | — | Netteté parfaite sur les écrans très denses (aujourd’hui ≈1:1 à densité 3,5) | **P2** |

### Légendaire (legendary)

Existant : NORMAL 1253×1075, SLEEP 760×348, WINGS_UP 742×287, WINGS_DOWN 742×329, WINGS_MID absent. Squelette `legendary.sprite.json` (19 os dont 16 souples), 13 ancrages, 29 équipements compatibles.

| Asset | Nom recommandé | Résolution mini (largeur) | Cadrage / point d’ancrage | Os concernés | Zone à repeindre | Animation rendue possible | Priorité |
|---|---|---|---|---|---|---|---|
| WINGS_UP refait en grand | `dragon_legendary_wings_up.png` | 1300 px (actuel 742, agrandi ×1.49) | Dragon entier, tête à droite, **même position de tête, de corps et de queue** que WINGS_MID et WINGS_DOWN (seules les ailes changent). Ancrage : point sous le centre du corps. | wing1, wing2, wingFar | — | Vol net ; battement sans saut de la queue | **P0** |
| WINGS_MID (nouveau) | `dragon_legendary_wings_mid.png` | 1300 px | Identique à WINGS_UP sauf ailes à l’horizontale (milieu du battement) | wing1, wing2, wingFar | — | Battement en 3 temps (haut → milieu → bas), timing asymétrique crédible | **P0** |
| WINGS_DOWN refait en grand | `dragon_legendary_wings_down.png` | 1300 px (actuel 742, agrandi ×1.49) | Identique à WINGS_UP sauf ailes basses ; **queue identique** (aujourd’hui la queue change de forme d’une image à l’autre) | wing1, wing2, wingFar | — | Vol net et continu | **P0** |
| SLEEP refait en grand | `dragon_legendary_sleep.png` | 1450 px (actuel 760, agrandi ×1.62) | Couché, tête à droite, même échelle de tête que NORMAL | spine, neck1–2, head, tail1–5 | — | Dodo net (respiration, queue qui bouge) | **P0** |
| Yeux fermés (calque) | `dragon_legendary_eyes_closed.png` | 1253×1075 (même toile que NORMAL) | Calque transparent superposé à NORMAL au pixel près : seulement les paupières fermées | head | Paupières (petite zone) | Clignement irrégulier (BLINK) ; aujourd’hui désactivé faute d’asset | **P1** |
| Gueule ouverte (variante) | `dragon_legendary_mouth_open.png` | 1253×1075 | Même toile que NORMAL ; seule la tête change (mâchoire ouverte, langue/dents visibles) | head (+ mouth_anchor) | Tête entière à repeindre (mâchoire) | Rugissement, souffle de feu, bâillement, manger crédibles | **P1** |
| Aile proche séparée | `dragon_legendary_wing_front.png` | 1253×1075 | Calque contenant **uniquement** l’aile côté spectateur, à sa place dans la toile ; point d’ancrage = articulation de l’épaule | wing1, wing2 | — | Ajustements d’aile, aile qui se déploie / se replie debout, battement au décollage | **P1** |
| Corps sans l’aile proche | `dragon_legendary_body_no_front_wing.png` | 1253×1075 | Même toile que NORMAL, aile proche **retirée** | spine, wingFar | **Dos, flanc et aile lointaine cachés par l’aile proche : à repeindre entièrement** | Indispensable avec le calque d’aile séparée (sinon trou) | **P1** |
| Atterrissage (pose) | `dragon_legendary_landing.png` | 1400 px | Pattes tendues vers le sol, ailes ouvertes freinant, même échelle que NORMAL | legs, wing1–2 | — | Atterrissage avec poids (contact, poussière) | **P2** |
| NORMAL en plus grand | `dragon_legendary_full.png` | 1400 px (actuel 1253) | Même pose, même cadrage, plus de détail | tous | — | Netteté parfaite sur les écrans très denses (aujourd’hui ≈1:1 à densité 3,5) | **P2** |

## Dragonne du parent (variante « dragonne »)

### Bébé (baby)

Existant : NORMAL 1510×978, SLEEP 457×183, WINGS_UP 490×221, WINGS_DOWN 532×204, WINGS_MID absent. Squelette `baby.dragonne.json` (19 os dont 16 souples), 13 ancrages, 22 équipements compatibles.

| Asset | Nom recommandé | Résolution mini (largeur) | Cadrage / point d’ancrage | Os concernés | Zone à repeindre | Animation rendue possible | Priorité |
|---|---|---|---|---|---|---|---|
| WINGS_UP refait en grand | `dragonne_baby_wings_up.png` | 1200 px (actuel 490, agrandi ×1.78) | Dragon entier, tête à droite, **même position de tête, de corps et de queue** que WINGS_MID et WINGS_DOWN (seules les ailes changent). Ancrage : point sous le centre du corps. | wing1, wing2, wingFar | — | Vol net ; battement sans saut de la queue | **P0** |
| WINGS_MID (nouveau) | `dragonne_baby_wings_mid.png` | 1200 px | Identique à WINGS_UP sauf ailes à l’horizontale (milieu du battement) | wing1, wing2, wingFar | — | Battement en 3 temps (haut → milieu → bas), timing asymétrique crédible | **P0** |
| WINGS_DOWN refait en grand | `dragonne_baby_wings_down.png` | 1200 px (actuel 532, agrandi ×1.78) | Identique à WINGS_UP sauf ailes basses ; **queue identique** (aujourd’hui la queue change de forme d’une image à l’autre) | wing1, wing2, wingFar | — | Vol net et continu | **P0** |
| SLEEP refait en grand | `dragonne_baby_sleep.png` | 1200 px (actuel 457, agrandi ×2.14) | Couché, tête à droite, même échelle de tête que NORMAL | spine, neck1–2, head, tail1–5 | — | Dodo net (respiration, queue qui bouge) | **P0** |
| Yeux fermés (calque) | `dragonne_baby_eyes_closed.png` | 1510×978 (même toile que NORMAL) | Calque transparent superposé à NORMAL au pixel près : seulement les paupières fermées | head | Paupières (petite zone) | Clignement irrégulier (BLINK) ; aujourd’hui désactivé faute d’asset | **P1** |
| Gueule ouverte (variante) | `dragonne_baby_mouth_open.png` | 1510×978 | Même toile que NORMAL ; seule la tête change (mâchoire ouverte, langue/dents visibles) | head (+ mouth_anchor) | Tête entière à repeindre (mâchoire) | Rugissement, souffle de feu, bâillement, manger crédibles | **P1** |
| Aile proche séparée | `dragonne_baby_wing_front.png` | 1510×978 | Calque contenant **uniquement** l’aile côté spectateur, à sa place dans la toile ; point d’ancrage = articulation de l’épaule | wing1, wing2 | — | Ajustements d’aile, aile qui se déploie / se replie debout, battement au décollage | **P1** |
| Corps sans l’aile proche | `dragonne_baby_body_no_front_wing.png` | 1510×978 | Même toile que NORMAL, aile proche **retirée** | spine, wingFar | **Dos, flanc et aile lointaine cachés par l’aile proche : à repeindre entièrement** | Indispensable avec le calque d’aile séparée (sinon trou) | **P1** |
| Atterrissage (pose) | `dragonne_baby_landing.png` | 1200 px | Pattes tendues vers le sol, ailes ouvertes freinant, même échelle que NORMAL | legs, wing1–2 | — | Atterrissage avec poids (contact, poussière) | **P2** |

### Jeune (young)

Existant : NORMAL 1524×1024, SLEEP 611×227, WINGS_UP 630×264, WINGS_DOWN 612×289, WINGS_MID absent. Squelette `young.dragonne.json` (19 os dont 16 souples), 13 ancrages, 28 équipements compatibles.

| Asset | Nom recommandé | Résolution mini (largeur) | Cadrage / point d’ancrage | Os concernés | Zone à repeindre | Animation rendue possible | Priorité |
|---|---|---|---|---|---|---|---|
| WINGS_UP refait en grand | `dragonne_young_wings_up.png` | 1200 px (actuel 630, agrandi ×1.57) | Dragon entier, tête à droite, **même position de tête, de corps et de queue** que WINGS_MID et WINGS_DOWN (seules les ailes changent). Ancrage : point sous le centre du corps. | wing1, wing2, wingFar | — | Vol net ; battement sans saut de la queue | **P0** |
| WINGS_MID (nouveau) | `dragonne_young_wings_mid.png` | 1200 px | Identique à WINGS_UP sauf ailes à l’horizontale (milieu du battement) | wing1, wing2, wingFar | — | Battement en 3 temps (haut → milieu → bas), timing asymétrique crédible | **P0** |
| WINGS_DOWN refait en grand | `dragonne_young_wings_down.png` | 1200 px (actuel 612, agrandi ×1.57) | Identique à WINGS_UP sauf ailes basses ; **queue identique** (aujourd’hui la queue change de forme d’une image à l’autre) | wing1, wing2, wingFar | — | Vol net et continu | **P0** |
| SLEEP refait en grand | `dragonne_young_sleep.png` | 1300 px (actuel 611, agrandi ×1.82) | Couché, tête à droite, même échelle de tête que NORMAL | spine, neck1–2, head, tail1–5 | — | Dodo net (respiration, queue qui bouge) | **P0** |
| Yeux fermés (calque) | `dragonne_young_eyes_closed.png` | 1524×1024 (même toile que NORMAL) | Calque transparent superposé à NORMAL au pixel près : seulement les paupières fermées | head | Paupières (petite zone) | Clignement irrégulier (BLINK) ; aujourd’hui désactivé faute d’asset | **P1** |
| Gueule ouverte (variante) | `dragonne_young_mouth_open.png` | 1524×1024 | Même toile que NORMAL ; seule la tête change (mâchoire ouverte, langue/dents visibles) | head (+ mouth_anchor) | Tête entière à repeindre (mâchoire) | Rugissement, souffle de feu, bâillement, manger crédibles | **P1** |
| Aile proche séparée | `dragonne_young_wing_front.png` | 1524×1024 | Calque contenant **uniquement** l’aile côté spectateur, à sa place dans la toile ; point d’ancrage = articulation de l’épaule | wing1, wing2 | — | Ajustements d’aile, aile qui se déploie / se replie debout, battement au décollage | **P1** |
| Corps sans l’aile proche | `dragonne_young_body_no_front_wing.png` | 1524×1024 | Même toile que NORMAL, aile proche **retirée** | spine, wingFar | **Dos, flanc et aile lointaine cachés par l’aile proche : à repeindre entièrement** | Indispensable avec le calque d’aile séparée (sinon trou) | **P1** |
| Atterrissage (pose) | `dragonne_young_landing.png` | 1250 px | Pattes tendues vers le sol, ailes ouvertes freinant, même échelle que NORMAL | legs, wing1–2 | — | Atterrissage avec poids (contact, poussière) | **P2** |

### Adulte (adult)

Existant : NORMAL 1524×1011, SLEEP 709×273, WINGS_UP 750×284, WINGS_DOWN 698×311, WINGS_MID absent. Squelette `adult.dragonne.json` (19 os dont 16 souples), 13 ancrages, 29 équipements compatibles.

| Asset | Nom recommandé | Résolution mini (largeur) | Cadrage / point d’ancrage | Os concernés | Zone à repeindre | Animation rendue possible | Priorité |
|---|---|---|---|---|---|---|---|
| WINGS_UP refait en grand | `dragonne_adult_wings_up.png` | 1250 px (actuel 750, agrandi ×1.43) | Dragon entier, tête à droite, **même position de tête, de corps et de queue** que WINGS_MID et WINGS_DOWN (seules les ailes changent). Ancrage : point sous le centre du corps. | wing1, wing2, wingFar | — | Vol net ; battement sans saut de la queue | **P0** |
| WINGS_MID (nouveau) | `dragonne_adult_wings_mid.png` | 1250 px | Identique à WINGS_UP sauf ailes à l’horizontale (milieu du battement) | wing1, wing2, wingFar | — | Battement en 3 temps (haut → milieu → bas), timing asymétrique crédible | **P0** |
| WINGS_DOWN refait en grand | `dragonne_adult_wings_down.png` | 1200 px (actuel 698, agrandi ×1.43) | Identique à WINGS_UP sauf ailes basses ; **queue identique** (aujourd’hui la queue change de forme d’une image à l’autre) | wing1, wing2, wingFar | — | Vol net et continu | **P0** |
| SLEEP refait en grand | `dragonne_adult_sleep.png` | 1400 px (actuel 709, agrandi ×1.70) | Couché, tête à droite, même échelle de tête que NORMAL | spine, neck1–2, head, tail1–5 | — | Dodo net (respiration, queue qui bouge) | **P0** |
| Yeux fermés (calque) | `dragonne_adult_eyes_closed.png` | 1524×1011 (même toile que NORMAL) | Calque transparent superposé à NORMAL au pixel près : seulement les paupières fermées | head | Paupières (petite zone) | Clignement irrégulier (BLINK) ; aujourd’hui désactivé faute d’asset | **P1** |
| Gueule ouverte (variante) | `dragonne_adult_mouth_open.png` | 1524×1011 | Même toile que NORMAL ; seule la tête change (mâchoire ouverte, langue/dents visibles) | head (+ mouth_anchor) | Tête entière à repeindre (mâchoire) | Rugissement, souffle de feu, bâillement, manger crédibles | **P1** |
| Aile proche séparée | `dragonne_adult_wing_front.png` | 1524×1011 | Calque contenant **uniquement** l’aile côté spectateur, à sa place dans la toile ; point d’ancrage = articulation de l’épaule | wing1, wing2 | — | Ajustements d’aile, aile qui se déploie / se replie debout, battement au décollage | **P1** |
| Corps sans l’aile proche | `dragonne_adult_body_no_front_wing.png` | 1524×1011 | Même toile que NORMAL, aile proche **retirée** | spine, wingFar | **Dos, flanc et aile lointaine cachés par l’aile proche : à repeindre entièrement** | Indispensable avec le calque d’aile séparée (sinon trou) | **P1** |
| Atterrissage (pose) | `dragonne_adult_landing.png` | 1350 px | Pattes tendues vers le sol, ailes ouvertes freinant, même échelle que NORMAL | legs, wing1–2 | — | Atterrissage avec poids (contact, poussière) | **P2** |

### Légendaire (legendary)

Existant : NORMAL 1536×1022, SLEEP 742×342, WINGS_UP 735×284, WINGS_DOWN 734×328, WINGS_MID absent. Squelette `legendary.dragonne.json` (19 os dont 16 souples), 13 ancrages, 29 équipements compatibles.

| Asset | Nom recommandé | Résolution mini (largeur) | Cadrage / point d’ancrage | Os concernés | Zone à repeindre | Animation rendue possible | Priorité |
|---|---|---|---|---|---|---|---|
| WINGS_UP refait en grand | `dragonne_legendary_wings_up.png` | 1300 px (actuel 735, agrandi ×1.50) | Dragon entier, tête à droite, **même position de tête, de corps et de queue** que WINGS_MID et WINGS_DOWN (seules les ailes changent). Ancrage : point sous le centre du corps. | wing1, wing2, wingFar | — | Vol net ; battement sans saut de la queue | **P0** |
| WINGS_MID (nouveau) | `dragonne_legendary_wings_mid.png` | 1300 px | Identique à WINGS_UP sauf ailes à l’horizontale (milieu du battement) | wing1, wing2, wingFar | — | Battement en 3 temps (haut → milieu → bas), timing asymétrique crédible | **P0** |
| WINGS_DOWN refait en grand | `dragonne_legendary_wings_down.png` | 1300 px (actuel 734, agrandi ×1.50) | Identique à WINGS_UP sauf ailes basses ; **queue identique** (aujourd’hui la queue change de forme d’une image à l’autre) | wing1, wing2, wingFar | — | Vol net et continu | **P0** |
| SLEEP refait en grand | `dragonne_legendary_sleep.png` | 1450 px (actuel 742, agrandi ×1.66) | Couché, tête à droite, même échelle de tête que NORMAL | spine, neck1–2, head, tail1–5 | — | Dodo net (respiration, queue qui bouge) | **P0** |
| Yeux fermés (calque) | `dragonne_legendary_eyes_closed.png` | 1536×1022 (même toile que NORMAL) | Calque transparent superposé à NORMAL au pixel près : seulement les paupières fermées | head | Paupières (petite zone) | Clignement irrégulier (BLINK) ; aujourd’hui désactivé faute d’asset | **P1** |
| Gueule ouverte (variante) | `dragonne_legendary_mouth_open.png` | 1536×1022 | Même toile que NORMAL ; seule la tête change (mâchoire ouverte, langue/dents visibles) | head (+ mouth_anchor) | Tête entière à repeindre (mâchoire) | Rugissement, souffle de feu, bâillement, manger crédibles | **P1** |
| Aile proche séparée | `dragonne_legendary_wing_front.png` | 1536×1022 | Calque contenant **uniquement** l’aile côté spectateur, à sa place dans la toile ; point d’ancrage = articulation de l’épaule | wing1, wing2 | — | Ajustements d’aile, aile qui se déploie / se replie debout, battement au décollage | **P1** |
| Corps sans l’aile proche | `dragonne_legendary_body_no_front_wing.png` | 1536×1022 | Même toile que NORMAL, aile proche **retirée** | spine, wingFar | **Dos, flanc et aile lointaine cachés par l’aile proche : à repeindre entièrement** | Indispensable avec le calque d’aile séparée (sinon trou) | **P1** |
| Atterrissage (pose) | `dragonne_legendary_landing.png` | 1400 px | Pattes tendues vers le sol, ailes ouvertes freinant, même échelle que NORMAL | legs, wing1–2 | — | Atterrissage avec poids (contact, poussière) | **P2** |

## Comportements désactivés faute d’asset

| Comportement | Stades concernés | Raison | Asset qui le débloque |
|---|---|---|---|
| BLINK (clignement) | tous | Les yeux font partie de la peinture ; une déformation ne peut pas les fermer proprement | yeux fermés (P1) |
| WING_ADJUST ample / repli d’aile debout | tous | L’aile proche est peinte sur le corps : la tourner de plus de quelques degrés étire le dos | aile proche séparée + corps repeint (P1) |
| Gueule ouverte (rugir, cracher le feu) | tous | Aucune mâchoire séparée ; l’animation actuelle ne fait que lever la tête | gueule ouverte (P1) |
| Battement de vol en 3 temps | tous | WINGS_MID absent ; une interpolation d’images donnerait une aile fantôme | WINGS_MID (P0) |

## Remarque sur les illustrations debout

Les images NORMAL de la dragonne (1510–1536 px) suffisent partout. Celles du dragon de l’enfant (1236–1253 px) sont affichées à peu près 1:1 sur un écran de densité 3,5 : nettes, mais sans marge. Ce n’est pas prioritaire.
