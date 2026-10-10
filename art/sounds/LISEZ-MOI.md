# Sons du dragon

Fabriqués par `design.py` (sound design) et `synth.py` (couches synthétiques), à partir de sons CC0 :
- « 80 CC0 creature SFX », « 80 CC0 creature SFX #2 », « 80 CC0 RPG SFX » — rubberduck (OpenGameArt)
- « CC0 Deep Monster Roar » — trazzz123 (OpenGameArt)

Fichiers utilisés par l'appli : `www/assets/sounds/*.mp3`.

## Octobre 2026 — voix refaites (`creature.py`)
Les « petits cris » (chirp, bébé), le ronronnement et le grognement du réveil sonnaient faux (voix de dessin animé,
pulsations graves). Remplacés par des voix synthétisées sur le modèle des grands animaux :
`chuff` (salut amical par le nez), `snort` (ébrouement), `rumble` (grondement de contentement), `yawn` (bâillement),
`baby` (petit grognement rauque), `eat` (croquant + grondement). Prochaine étape conseillée : de vrais enregistrements
(ex. « Compendium of Dragons SFX », Atelier Magicae, usage commercial autorisé, sans redistribution des fichiers bruts).

## Octobre 2026 — vrais enregistrements (Mixkit)
`mixkit_design.py` retravaille 9 enregistrements Mixkit (licence Mixkit : usage commercial autorisé, sans attribution,
pas de redistribution des fichiers bruts — ils restent dans `art/sounds/mixkit/`, exclu du dépôt) :
rugissements (bébé, jeune, adulte, légendaire), contentement, ébrouement, bâillement, repas, ronflement pendant
le sommeil, inspiration avant le feu, montée d'énergie de l'évolution. Seul le « salut » (chuff) reste synthétisé.

## Octobre 2026 — souffle de feu v2 (`fire_v2.py`)
Calé sur la nouvelle animation (bond en arrière, inspiration, long jet, retour) : battement d'ailes, réception,
inspiration, flammes + grondement + crépitements, deux petits bonds. L'ancien son est gardé pour l'anneau de feu
(`fire_ring.mp3`).
