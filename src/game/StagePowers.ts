// Pouvoirs des stades : chaque évolution débloque un pouvoir visible dans les mini-jeux.
// Les pouvoirs se cumulent (un dragon adulte garde ceux du jeune dragon).
// Données pures : les jeux interrogent `hasPower(stage, id)` et appliquent eux-mêmes l'effet.

export type PowerId = 'spark' | 'agile' | 'blaze' | 'aura';

export interface StagePower {
  id: PowerId;
  /** Stade qui débloque le pouvoir (ids de data/stages.json). */
  stage: string;
  name: string;
  /** Ce que le pouvoir change, en une phrase courte (affichée dans les jeux). */
  effect: string;
  /** Effet par mini-jeu (id de games/index.ts), affiché dans l'intro du jeu. */
  games: Record<string, string>;
}

export const STAGE_ORDER = ['baby', 'young', 'adult', 'legendary'];

export const POWERS: StagePower[] = [
  { id: 'spark', stage: 'baby', name: 'Flammèche', effect: 'Il crache ses premières boules de feu.',
    games: {} },
  { id: 'agile', stage: 'young', name: 'Ailes agiles', effect: 'Un cœur de plus en vol, des griffes plus larges pour attraper.',
    games: { race: 'Ailes agiles : un 4ᵉ cœur.', gems: 'Ailes agiles : les gemmes s’attrapent de plus loin.' } },
  { id: 'blaze', stage: 'adult', name: 'Souffle ardent', effect: 'Ses boules de feu explosent, et ses yeux voient les poissons venir.',
    games: { fire: 'Souffle ardent : la boule explose et touche aussi les cibles voisines (jamais la glace).', fish: 'Souffle ardent : un peu plus de temps pour ferrer.' } },
  { id: 'aura', stage: 'legendary', name: 'Aura légendaire', effect: 'Tout ce qui est doré vaut le double.',
    games: { gems: 'Aura légendaire : gemmes dorées ×2.', fire: 'Aura légendaire : cibles dorées ×2.', race: 'Aura légendaire : gemmes ×2.', fish: 'Aura légendaire : poisson doré ×2.' } }
];

function rank(stage: string): number {
  const i = STAGE_ORDER.indexOf(stage);
  return i < 0 ? 0 : i;
}

/** Le dragon de ce stade a-t-il ce pouvoir ? */
export function hasPower(stage: string, id: PowerId): boolean {
  const p = POWERS.find(x => x.id === id);
  return !!p && rank(stage) >= rank(p.stage);
}

/** Pouvoirs débloqués à ce stade (cumulés). */
export function powersAt(stage: string): StagePower[] {
  return POWERS.filter(p => rank(stage) >= rank(p.stage));
}

/** Pouvoir que ce stade vient d'apporter (annonce à l'évolution). */
export function powerOf(stage: string): StagePower | null {
  return POWERS.find(p => p.stage === stage) ?? null;
}

/** Effets actifs dans un mini-jeu donné. */
export function gameEffects(stage: string, gameId: string): string[] {
  return powersAt(stage).map(p => p.games[gameId]).filter((s): s is string => !!s);
}
