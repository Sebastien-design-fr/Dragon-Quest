# Économie du jeu (octobre 2026)

Calcul fait sur une **semaine type de l'enfant** avec les 3 missions par défaut
(`www/data/missions.json`) : nourrir le chat (10 XP, 5 or, tous les jours), contrôler la litière
(10 XP, 6 or, tous les jours), devoirs (20 XP, 10 or, du lundi au vendredi).
Une famille qui ajoute ses propres missions avance plus vite : les chiffres ci-dessous sont un plancher.

## Or gagné par semaine

| Source | Calcul | Par semaine |
|---|---|---|
| Missions | 11 or × 7 + 10 or × 5 | ≈ 127 |
| Mission « récompense ×2 » du jour | une mission doublée par jour | ≈ 50 |
| Coffre du jour | 10 + 5 × série (max 60), série moyenne ≈ 4 | ≈ 210 |
| Mini-jeux | 1re partie de chaque jeu, max 15 or (× 0,5 après le 1er jeu du jour) | ≈ 140 |
| Pas | ≈ 7 or par jour en marchant un peu | ≈ 50 |
| Passage de niveau | +50 or, ≈ 1 niveau par semaine | ≈ 50 |
| **Total** | | **≈ 620 or** |

## Ce que ça achète

| Objet | Prix | Semaines |
|---|---|---|
| Décoration de grotte | 60 – 250 | moins d'une |
| Équipement commun | 150 | ¼ |
| Équipement rare | 400 | ⅔ |
| Équipement épique | 900 | 1 ½ |
| Équipement légendaire | 2 000 | ≈ 3 |

**Objectif tenu** : chaque semaine permet d'acheter au moins un objet, et il reste toujours un grand
objet à viser. Pas de changement de prix.

## XP et évolutions

XP pour passer du niveau N au suivant : `190 + 26 × (N − 1)` (`www/data/stages.json`).
Gain ≈ 360 XP par semaine (missions, mission doublée, pas, potion).

| Évolution | Avant | Après (octobre 2026) |
|---|---|---|
| Jeune dragon | niveau 6 · ≈ 3,5 semaines | inchangé |
| Dragon adulte | niveau 15 · **≈ 10,5 semaines de plus** | **niveau 12 · ≈ 6,5 semaines de plus** |
| Dragon légendaire | niveau 30 · ≈ 30 semaines de plus | niveau 25 · ≈ 23 semaines de plus |
| Total jusqu'au légendaire | ≈ 44 semaines (10 mois) | ≈ 33 semaines (7,5 mois) |

Raison : près de 3 mois sans nouveauté entre le jeune dragon et l'adulte, c'est trop long pour un enfant.
Les reflets d'écailles (niveaux 4, 8, 12, 16, 20, 24, 28, 40) continuent de jalonner l'attente.
Un dragon déjà au-delà du niveau 12 devient adulte à la prochaine ouverture de l'appli.
