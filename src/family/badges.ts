// Badges (succès) et énergie du dragon : règles pures, sans interface.

export type BadgeTier = 'bronze' | 'argent' | 'or' | 'legende';

export type BadgeCondition =
  | { type: 'total' | 'perfectDays' | 'streak' | 'initiatives' | 'punctual' | 'gifts' | 'level'; n: number }
  | { type: 'mission'; mission: string; n: number }
  | { type: 'stage'; stage: string };

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  tier: BadgeTier;
  reward: number;
  when: BadgeCondition;
}

export interface ChildStats {
  total: number;
  perMission: Record<string, number>;
  perfectDays: number;
  maxStreak: number;
  initiatives: number;
  punctual: number;
  gifts: number;
  warnings: number;
}

export const EMPTY_STATS: ChildStats = { total: 0, perMission: {}, perfectDays: 0, maxStreak: 0, initiatives: 0, punctual: 0, gifts: 0, warnings: 0 };

export const STAGE_ORDER = ['baby', 'young', 'adult', 'legendary'];

/** Progression vers un badge : [valeur actuelle, objectif]. */
export function badgeProgress(b: BadgeDef, s: ChildStats, level: number, stage: string): [number, number] {
  const w = b.when;
  switch (w.type) {
    case 'total': return [s.total, w.n];
    case 'mission': return [s.perMission[w.mission] ?? 0, w.n];
    case 'perfectDays': return [s.perfectDays, w.n];
    case 'streak': return [s.maxStreak, w.n];
    case 'initiatives': return [s.initiatives, w.n];
    case 'punctual': return [s.punctual, w.n];
    case 'gifts': return [s.gifts, w.n];
    case 'level': return [level, w.n];
    case 'stage': return [Math.max(0, STAGE_ORDER.indexOf(stage)), Math.max(1, STAGE_ORDER.indexOf(w.stage))];
  }
}

export const TIER_LABEL: Record<BadgeTier, string> = { bronze: 'Bronze', argent: 'Argent', or: 'Or', legende: 'Légende' };

// ---------------- Énergie ----------------
export const ENERGY = {
  max: 100,
  perMission: 8,        // gagné à chaque mission accomplie
  perfectDayBonus: 6,   // bonus quand toutes les missions du jour sont faites
  missedPenalty: 10,    // perdu par mission non faite (bilan du soir)
  dailyCap: 35,         // perte maximale par jour
  warningPenalty: 15    // perte lors d'un avertissement d'un parent
};

/** Multiplicateur d'XP selon l'énergie (le dragon fatigué progresse moins vite). */
export function xpMultiplier(energy: number): number {
  if (energy <= 0) return 0;
  if (energy < 25) return 0.5;
  if (energy < 50) return 0.75;
  return 1;
}

export function energyLabel(energy: number): { label: string; detail: string; level: 'ok' | 'low' | 'tired' | 'out' } {
  if (energy <= 0) return { label: 'Épuisé', detail: 'Plus d’XP : une mission le relancera', level: 'out' };
  if (energy < 25) return { label: 'Très fatigué', detail: 'XP × 0,5', level: 'tired' };
  if (energy < 50) return { label: 'Fatigué', detail: 'XP × 0,75', level: 'low' };
  return { label: 'En forme', detail: 'XP normal', level: 'ok' };
}
