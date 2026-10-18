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

---

## Ce que je ferai à l'arrivée des images

| Image | Effet dans le jeu |
|---|---|
| Yeux fermés | clignement irrégulier et naturel ; yeux fermés pendant le sommeil |
| Gueule ouverte | bâillement, repas, rugissement et souffle de feu crédibles |
| Ailes à mi-course | battement en 3 temps, vol fluide |
| Loup assis / couché / course | le loup s'assoit, dort vraiment, galope au lieu de sautiller |
| Icône / démarrage | une appli belle dès l'écran d'accueil du téléphone |
