# Illustrations à faire générer

Descriptions prêtes à donner à un générateur d'images (ChatGPT, Gemini, Midjourney…), pour donner plus de vie
au dragon, au loup et à l'appli. Les consignes techniques détaillées (résolutions, calques, ancrages) sont dans
`DRAGON_ASSET_REQUIREMENTS.md` ; ce document donne **quoi demander** et **comment nommer les fichiers**.

## Méthode (important pour garder le même personnage)

1. **Toujours joindre l'illustration de référence** du même stade (par exemple
   `www/assets/dragon/young/dragon_young_full.webp`) et écrire : *« Use the attached image as the exact
   character reference. »* Sans image de référence, le générateur invente un autre dragon.
2. Demander un **fond transparent** (PNG). Si le générateur ne sait pas, demander un fond uni gris neutre
   (#808080) : on le détourera.
3. Un seul personnage par image, **profil, tête vers la droite**, lumière venant du haut à gauche.
4. Garder les images retenues en PNG dans `art/` ; je les convertis, je les place et je règle les ancrages.

Les descriptions sont en anglais : les générateurs y répondent plus fidèlement.

---

## 1. Le dragon de l'enfant (les 4 stades : baby, young, adult, legendary)

Style commun à rappeler dans chaque demande :

> Same black dragon as the reference: glossy black scales with bronze-gold edges, cream-beige belly plates,
> amber glowing eyes, bat-like wings with dark leathery membrane and bronze claws on the wing joints, spiky
> bronze back ridge. Painted realistic fantasy illustration, high detail, soft rim light from the top left.
> Side view, head facing right. Transparent background. Single character, full body visible, nothing cropped.

### 1.1 Yeux fermés — il pourra cligner des yeux (priorité haute)

> Exactly the same image as the reference, same pose, same framing, same canvas size, pixel-aligned.
> The only change: the eyes are gently closed (relaxed eyelids with the same black scales, a thin bronze line
> where the lids meet). Everything else must stay identical.

Fichier : `dragon_<stade>_eyes_closed.png`

### 1.2 Gueule ouverte — manger, bâiller, cracher du feu (priorité haute)

> Exactly the same image as the reference, same pose and framing, same canvas size. Only the head changes:
> jaw open about 35 degrees, visible rows of ivory teeth, dark red mouth and tongue, a faint warm orange glow
> deep in the throat. Neck and body unchanged.

Fichier : `dragon_<stade>_mouth_open.png`

### 1.3 Ailes à mi-course — un vol fluide en 3 temps (priorité haute)

> Same dragon flying, side view, head facing right, body horizontal and stretched, legs tucked under the belly,
> tail straight behind. Wings spread horizontally, exactly halfway between fully raised and fully lowered.
> Same head, body and tail position as the attached flying images (wings up / wings down): only the wings differ.

Joindre aussi `dragon_<stade>_flyUp.webp` et `dragon_<stade>_flyDown.webp`.
Fichier : `dragon_<stade>_wings_mid.png`

## 2. La dragonne du parent (mêmes 3 images, 4 stades)

Style commun :

> Same dragoness as the reference: amethyst purple scales with pearl-white and pale gold edges, iridescent
> pearly belly, violet crystal gems set in the wing bones and shoulders, elegant flowing horns and fin-like
> frills, violet eyes. Painted realistic fantasy illustration, high detail. Side view, head facing right.
> Transparent background.

Puis les mêmes demandes que 1.1, 1.2 et 1.3.
Fichiers : `dragonne_<stade>_eyes_closed.png`, `dragonne_<stade>_mouth_open.png`, `dragonne_<stade>_wings_mid.png`

## 3. Le loup compagnon (priorité moyenne)

Aujourd'hui le loup n'a qu'une image : sa course est simulée par des petits bonds. Référence à joindre :
`www/assets/companions/wolf.webp`.

Style commun :

> Same young wolf as the reference: thick dark charcoal fur with cream-beige undercoat on the chest, muzzle
> and legs, bronze-gold flame-like markings on the shoulders, back, legs and forehead, bright amber eyes,
> fluffy tail with cream tip. Painted realistic fantasy illustration, high detail, soft light from the top left.
> Side view, head facing right. Transparent background, single character.

### 3.1 Assis

> The wolf sitting on its hind legs, front legs straight, chest up, head slightly tilted, ears up, tail curled
> around the front paws. Calm and attentive.

Fichier : `wolf_sit.png`

### 3.2 Couché, endormi

> The wolf lying curled up asleep, head resting on its front paws, eyes closed, tail wrapped around the body,
> peaceful. Same scale as the reference (same head size).

Fichier : `wolf_sleep.png`

### 3.3 En pleine course (2 images)

> The wolf running at full gallop, side view: image A with all four legs stretched (front legs forward, hind
> legs back, body long); image B with all four legs gathered under the body. Ears back, tail flowing behind.
> Same scale as the reference.

Fichiers : `wolf_run_a.png`, `wolf_run_b.png`

## 4. L'icône de l'appli et l'écran de démarrage (priorité moyenne)

### 4.1 Icône (1024 × 1024)

> App icon, square 1024×1024: the head of the black dragon from the reference, three-quarter view, amber eye
> glowing, bronze-gold horns, framed by a warm ember glow on a deep night-blue background (#141327) with a
> subtle cave arch. Bold, readable at small size, no text, centered with 15 % safe margin on every side.

Fichier : `icon_1024.png` (je génère toutes les tailles Android avec `scripts/make-icon.py`).

### 4.2 Écran de démarrage (1080 × 2400, portrait)

> Vertical mobile splash screen 1080×2400: inside a dark crystal cave lit by torches, a dragon egg with bronze
> and black scales rests on a nest of warm embers, a soft golden glow rising from it. Calm, magical, mostly
> dark at the top and bottom so the app can add its title. No text.

Fichier : `splash_1080x2400.png`

## 5. L'œuf de famille et le petit dragon partagé (priorité haute)

Un œuf commun à l'enfant et au parent : chaque quête réalisée par l'un ou l'autre le réchauffe. Il se fissure
peu à peu, puis éclot en un petit dragon partagé par les deux téléphones. Il est l'enfant des deux dragons :
il mélange le noir et bronze du dragon et l'améthyste et nacre de la dragonne.

Joindre **les deux références** à chaque demande : `www/assets/dragon/baby/dragon_baby_full.webp` et
`www/assets/dragonne/baby/dragonne_baby_full.webp`.

### 5.1 L'œuf, en 5 états (même image, même cadrage)

Faire d'abord l'état 1, puis demander les suivants **en joignant l'état 1** : « Exactly the same egg, same
size, same position, same canvas. Only change: … ».

> A single dragon egg, painted realistic fantasy illustration, high detail, matching the attached dragons:
> the shell mixes glossy black scales with bronze-gold edges (from the black dragon) and amethyst purple
> scales with pearly white edges (from the purple dragoness), the two patterns swirling into each other
> like two flames meeting. Oval egg standing upright, slightly tilted, soft warm rim light from the top left.
> Centered, the egg fills 70 % of the height. Transparent background, square canvas 1024×1024, no nest,
> no shadow, no text.

| État | Changement à demander | Fichier |
|---|---|---|
| 1 | (l'œuf ci-dessus, calme) | `family_egg_1.png` |
| 2 | « A faint warm golden glow shines from inside through the scales, as if a heart beats inside. » | `family_egg_2.png` |
| 3 | « A few thin cracks appear on the upper half, glowing gold-violet light leaks from the cracks. » | `family_egg_3.png` |
| 4 | « Many cracks across the shell, a small piece of shell is missing at the top, bright light inside. » | `family_egg_4.png` |
| 5 | « The top of the shell is broken open, shell fragments float around, a burst of golden and violet light rises from inside (no dragon visible yet). » | `family_egg_5.png` |

### 5.2 La fenêtre du nid (fond du panneau)

C'est le décor du panneau : le texte, le compteur et la barre de progression seront ajoutés par l'appli.

> Vertical mobile panel background 1080×1350, painted realistic fantasy, same mood as a dark crystal cave
> lit by torches: a stone alcove carved in dark rock with gold veins, a soft round nest of straw, down
> feathers and warm embers in the lower middle, an empty space just above the nest where an egg will be
> placed (leave it empty), gentle warm light from the nest, amethyst crystals on the left side, bronze
> details on the right side (half purple, half bronze, like two families meeting). Dark and calm at the top
> (space for a title) and at the very bottom (space for a progress bar). No egg, no text, no characters.

Fichier : `family_nest_panel.png`

### 5.3 Le petit dragon partagé

Style commun à rappeler dans chaque demande :

> A baby dragon, child of the two attached dragons: rounded baby proportions (big head, big eyes, short
> legs, small wings), scales mixing glossy black with bronze-gold edges and amethyst purple with pearly
> edges, cream-pearl belly plates, small rounded horns half bronze half pearl, big warm eyes with an amber
> center and a violet ring, small violet crystal gems on the wing joints. Cute, curious, gentle — clearly
> a baby, smaller and softer than the attached baby dragons. Painted realistic fantasy illustration, high
> detail, soft rim light from the top left. Side view, head facing right. Transparent background, single
> character, full body visible, nothing cropped.

| Image | Demande | Fichier |
|---|---|---|
| Debout (référence de tous les autres) | « Standing on four legs, head slightly raised, wings folded, tail curled around. » | `family_baby_full.png` |
| Éclosion | « The same baby dragon hatching: only its head, front paws and small wings come out of the top of the attached broken egg (join `family_egg_5.png`), eyes wide open, amazed. » | `family_baby_hatch.png` |
| Endormi | « Curled up asleep in a ball, head on its paws, eyes closed, tail wrapped around, same scale as the reference. » | `family_baby_sleep.png` |
| Yeux fermés | « Exactly the same image as the standing reference, same pose, framing and canvas, pixel-aligned. The only change: eyes gently closed. » | `family_baby_eyes_closed.png` |
| Content | « Sitting, front paws raised, mouth slightly open in a happy smile, wings half open, same scale. » | `family_baby_happy.png` |

---

## Ce que je ferai à l'arrivée des images

| Image | Effet dans le jeu |
|---|---|
| Yeux fermés | clignement irrégulier et naturel ; yeux fermés pendant le sommeil |
| Gueule ouverte | bâillement, repas, rugissement et souffle de feu crédibles |
| Ailes à mi-course | battement en 3 temps, vol fluide |
| Loup assis / couché / course | le loup s'assoit, dort vraiment, galope au lieu de sautiller |
| Icône / démarrage | une appli belle dès l'écran d'accueil du téléphone |
| Œuf de famille, nid, petit dragon | fenêtre de l'œuf commun, éclosion mise en scène, petit dragon partagé sur les deux téléphones |
