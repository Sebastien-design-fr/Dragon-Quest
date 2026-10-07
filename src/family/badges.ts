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
  missed?: number;
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
// Depuis v0.18, l'énergie est un indicateur de vitalité positif : elle ne sert
// jamais à diminuer l'XP et une mission oubliée ne la fait plus baisser.
export const ENERGY = {
  max: 100,
  perMission: 6,
  perfectDayBonus: 10,
  missedPenalty: 0,
  dailyCap: 0,
  warningPenalty: 0
};

/** Conservé pour compatibilité : l'XP n'est plus modulé par l'énergie. */
export function xpMultiplier(_energy: number): number { return 1; }

export function energyLabel(energy: number): { label: string; detail: string; level: 'ok' | 'low' | 'tired' | 'out' } {
  if (energy < 35) return { label: 'Calme', detail: 'Les missions lui redonnent de l’entrain', level: 'low' };
  if (energy < 70) return { label: 'En forme', detail: 'Progression normale', level: 'ok' };
  return { label: 'Plein d’énergie', detail: 'Prêt pour l’aventure', level: 'ok' };
}

// Types historiques conservés pour lire les anciennes sauvegardes et snapshots.
export type Severity = 'doux' | 'normal' | 'strict';
export interface PenaltyRule {
  label: string; xp: number; gold: number; goldCap: number; mood: number;
  sickAfter: number; levelLoss: boolean; confiscateAfter: number; text: string;
}
export const PENALTY: Record<Severity, PenaltyRule> = {
  doux: { label: 'Positif', xp: 0, gold: 0, goldCap: 0, mood: 0, sickAfter: 999, levelLoss: false, confiscateAfter: 0, text: 'Aucune pénalité : les missions réussies font progresser le dragon.' },
  normal: { label: 'Positif', xp: 0, gold: 0, goldCap: 0, mood: 0, sickAfter: 999, levelLoss: false, confiscateAfter: 0, text: 'Aucune pénalité : les missions réussies font progresser le dragon.' },
  strict: { label: 'Positif', xp: 0, gold: 0, goldCap: 0, mood: 0, sickAfter: 999, levelLoss: false, confiscateAfter: 0, text: 'Aucune pénalité : les missions réussies font progresser le dragon.' }
};
