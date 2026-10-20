---
name: interface-jeu
description: Règles de l'interface de Quête du Dragon (écrans, barre d'actions, panneaux, cartes, mini-jeux, côté parent) pour qu'elle reste lisible, thématique et laisse la place au dragon. À utiliser dès qu'on crée ou modifie un écran, un panneau, un bouton, un HUD de mini-jeu ou du CSS dans www/css, ou quand l'utilisateur trouve un écran « chargé », « pas clair », « pas dans l'ambiance » ou « comme une appli de bureau ».
---

# Interface du jeu

Quête du Dragon est un jeu pour un enfant (6-10 ans) et ses parents, sur téléphone. Le monde (dragon, grotte,
mini-jeux) est dessiné dans un canvas ; tout le texte et les commandes sont en HTML/CSS par-dessus.
L'interface est **la roche et l'or de la grotte**, pas un tableau de bord.

## La direction visuelle (déjà en place, à respecter)

- **Matière** : pierre sombre et grain de roche (`--tex-stone`, généré au démarrage par `src/ui/ShaderTextures.ts`),
  liserés et lumières dorés, braise orange pour ce qui demande de l'attention.
- **Couleurs** : variables de `:root` dans `www/css/app.css` (`--bg`, `--panel`, `--panel-2`, `--line`, `--gold`,
  `--gold-soft`, `--text`, `--muted`, `--danger`) et `--st-glow` (teinte du stade). Pas de couleur en dur hors palette.
- **Typographie** : Cinzel (`--display`) pour les titres gravés, **Andika** (`--body`) pour tout le texte, choisie
  pour les enfants qui apprennent à lire. Pas d'autre police.
- **Mouvement** : peu, mais signifiant. Les animations répondent à une action ou marquent un moment ;
  rien ne bouge en permanence sauf l'ambiance de la grotte. `prefers-reduced-motion` coupe les mouvements non essentiels.
- **Fichiers** : la couche d'immersion est `www/css/immersion.css`, chargée **en dernier** ; y mettre les retouches
  visuelles transversales plutôt que dans les feuilles plus anciennes, qui l'écraseraient sinon.

## Protéger la scène

1. **Le dragon d'abord.** Sur l'écran du dragon, le centre et le milieu-bas restent libres ; la barre d'actions
   (`.sh-bar`) vit en bas, le HUD (niveau, XP, or) en haut, la carte d'état en haut à gauche. Pas de nouveau
   panneau permanent par-dessus la scène : utiliser une bulle passagère, une puce ou un panneau qu'on ouvre.
2. **Une seule grappe principale** d'informations permanentes par écran, au plus une petite secondaire.
3. **Le détail derrière un geste** : les textes longs, réglages et listes vont dans un panneau (`openSheet`
   dans `src/ui/screens/common.ts`) ou une page dédiée, pas déployés d'office.
4. **Lisible sur le décor** : fond sombre, liseré, ombre de texte ou léger flou derrière tout texte posé sur la scène.

## Pour un enfant

- **Cibles d'au moins 44 × 44 px**, bien espacées ; les gestes importants (valider une quête) se font en glissant,
  pas d'un simple toucher accidentel.
- **Un mot ou une icône claire** par bouton, en langage d'enfant (« Nourrir », « Laver », « Jouer »), au tutoiement.
- **Toujours un retour** : chaque toucher répond (son `UI.tap`, petite vibration, mouvement) — voir le skill
  `game-feel` pour l'échelle des grands moments.
- **Jamais d'échec humiliant** : les erreurs et refus expliquent quoi faire, avec bienveillance.
- **Le soir** : `data-night-soft` assombrit l'écran après 21 h ; ne pas ajouter de flash ou de couleurs vives la nuit.
- **Taille du texte** réglable (`data-text` = `l` / `xl`) : vérifier qu'un nouvel écran tient en `xl`.

## Côté parent

Le parent veut aller vite : informations denses mais rangées, actions principales en premier (valider, refuser
avec un motif, créer une quête). Même matière et mêmes couleurs que l'enfant, ton adulte, pas de mise en scène.

## Mini-jeux (`src/ui/games/`)

- Décor peint et étalonnage communs : `paintBackdrop`, `GRADES`, `Ambience` (`src/ui/games/Scenery.ts`).
- HUD minimal sur le bord : score, temps, pouvoirs actifs ; le centre reste au jeu.
- Effets de jeu par `Juice` (secousse, éclair, chiffres qui jaillissent), dosés selon l'importance de l'événement.
- Compte à rebours, fin de partie et récompense toujours dans le même ordre et le même style d'un jeu à l'autre.
- Un mini-jeu doit se comprendre en trois secondes sans lire : une consigne courte, un exemple visuel.

## À éviter

- Mise en page « appli de bureau » : cartes identiques partout, en-tête plus pied de page pleine largeur plus
  corps chargé.
- Placeholder plat sans matière, police système, couleur hors palette.
- Plusieurs panneaux ouverts à la fois sur la scène.
- Animation sur chaque élément, boucles décoratives qui attirent l'œil sans raison.
- Interface dessinée dans le canvas quand du HTML serait plus clair et plus accessible.

## Vérifier

1. Compiler (`npm run build`) puis ouvrir l'aperçu en vue mobile (375 × 812), `?device=enfant` et `?device=parent`.
2. Retirer `data-night-soft` pour juger les couleurs, puis le remettre pour vérifier le soir.
3. Capturer l'écran : la scène reste-t-elle lisible ? un enfant sait-il quoi toucher ? le texte tient-il en `xl` ?
4. Tester un toucher sur chaque nouveau bouton (retour sonore et visuel).
5. Ajouter une ligne aux Nouveautés (`src/ui/WhatsNew.ts`) si le changement se voit.

Source d'inspiration : principes du skill « game-ui-frontend » (openai/plugins) — protéger la scène, une seule
grappe d'informations, détail derrière un geste, interface qui appartient au monde du jeu — réécrits pour ce projet.
