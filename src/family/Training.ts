// Entraînement du dragon : chaque mini-jeu fait progresser une caractéristique (agilité, vitesse, feu, sagesse).
// Les caractéristiques débloquent des tours spéciaux. Chaque jeu rapporte une fois par jour.
import { EventBus } from '../core/events.js';
import { readStore, writeStore } from '../platform/storage.js';
import { todayKey } from './model.js';

export type GameStat = 'agilite' | 'vitesse' | 'feu' | 'sagesse';

export const STATS: Array<{ id: GameStat; label: string; hint: string }> = [
  { id: 'agilite', label: 'Agilité', hint: 'Chasse aux gemmes' },
  { id: 'vitesse', label: 'Vitesse', hint: 'Course dans les nuages' },
  { id: 'feu', label: 'Feu', hint: 'Tir de feu' },
  { id: 'sagesse', label: 'Sagesse', hint: 'Mémoire des runes' }
];

/** Points pour passer chaque niveau de caractéristique (niveau 1 → 2 : 20 points, etc.). */
const PER_LEVEL = 20;

/** Tours spéciaux débloqués par l'entraînement. */
export interface StatTrick { id: string; label: string; anim: string; stat: GameStat; level: number }
export const STAT_TRICKS: StatTrick[] = [
  { id: 'pirouette', label: 'La pirouette', anim: 'dance', stat: 'agilite', level: 2 },
  { id: 'looping', label: 'Le looping', anim: 'hover', stat: 'vitesse', level: 2 },
  { id: 'fireball', label: 'Boule de feu géante', anim: 'ring', stat: 'feu', level: 2 },
  { id: 'wise_bow', label: 'Le salut du sage', anim: 'bow', stat: 'sagesse', level: 2 },
  { id: 'storm', label: 'Tempête de flammes', anim: 'fire', stat: 'feu', level: 4 },
  { id: 'dash', label: 'Éclair des cieux', anim: 'hover', stat: 'vitesse', level: 4 }
];

interface Data {
  stats: Record<GameStat, number>;
  best: Record<string, number>;
  day: string;
  /** Jeux déjà récompensés aujourd'hui. */
  played: string[];
}

const KEY = 'quete-du-dragon:training';

export class Training {
  readonly events = new EventBus<{ change: void; levelUp: { stat: GameStat; level: number; tricks: StatTrick[] } }>();
  data: Data;

  constructor(storageKey = KEY) {
    this.key = storageKey;
    const saved = readStore<Partial<Data>>(storageKey, {});
    this.data = {
      stats: { agilite: 0, vitesse: 0, feu: 0, sagesse: 0, ...(saved.stats ?? {}) },
      best: saved.best ?? {}, day: saved.day ?? todayKey(), played: saved.played ?? []
    };
    this.roll();
  }

  private key: string;
  private save(): void { writeStore(this.key, this.data); this.events.emit('change', undefined); }
  private roll(): void { if (this.data.day !== todayKey()) { this.data.day = todayKey(); this.data.played = []; } }

  /** Le jeu rapporte-t-il encore aujourd'hui ? */
  rewarded(gameId: string): boolean { this.roll(); return this.data.played.includes(gameId); }
  playedToday(): number { this.roll(); return this.data.played.length; }

  level(stat: GameStat): { level: number; points: number; progress: number; next: number } {
    const p = this.data.stats[stat] ?? 0;
    const level = 1 + Math.floor(p / PER_LEVEL);
    return { level, points: p, progress: (p % PER_LEVEL) / PER_LEVEL, next: level * PER_LEVEL };
  }

  /** Enregistre une partie : gain de caractéristique (même sans récompense, un peu), meilleur score. */
  record(gameId: string, stat: GameStat, score: number): { gain: number; first: boolean; best: boolean } {
    this.roll();
    const first = !this.data.played.includes(gameId);
    const gain = Math.max(1, Math.min(12, Math.round(score / 3))) * (first ? 1 : 0) + (first ? 0 : (score > 0 ? 1 : 0));
    const before = this.level(stat).level;
    this.data.stats[stat] = (this.data.stats[stat] ?? 0) + gain;
    const best = score > (this.data.best[gameId] ?? 0);
    if (best) this.data.best[gameId] = score;
    if (first) this.data.played.push(gameId);
    const after = this.level(stat).level;
    this.save();
    if (after > before) this.events.emit('levelUp', { stat, level: after, tricks: STAT_TRICKS.filter(t => t.stat === stat && t.level === after) });
    return { gain, first, best };
  }

  tricks(): Array<StatTrick & { unlocked: boolean }> {
    return STAT_TRICKS.map(t => ({ ...t, unlocked: this.level(t.stat).level >= t.level }));
  }

  /** Résumé pour les parents / le profil. */
  summary(): Record<GameStat, number> {
    return { agilite: this.level('agilite').level, vitesse: this.level('vitesse').level, feu: this.level('feu').level, sagesse: this.level('sagesse').level };
  }
}
