// Pas du jour et potion d'expérience (octobre 2026).
// Les pas sont comptés par le téléphone lui-même (capteur de pas, sans cloud) : chaque palier franchi
// rapporte un peu d'XP et d'or, une fois par jour. Pour l'enfant, les gains restent petits (les quêtes
// sont la source principale d'XP) ; pour un parent, qui n'a pas de quêtes, ils comptent davantage.
// Tous les chiffres sont dans data/activity.json.
import { EventBus } from '../core/events.js';
import { loadJSON } from '../core/data.js';
import type { GameState } from '../game/GameState.js';
import type { StepsInfo, Transport } from '../link/Transport.js';
import { readStore, writeStore } from '../platform/storage.js';
import { todayKey } from './model.js';

export interface StepTier { at: number; xp: number; gold: number }
export interface ActivityConfig {
  steps: { child: StepTier[]; parent: StepTier[] };
  xpShop: { child: { xp: number; prices: number[] }; parent: { xp: number; prices: number[] } };
  voyage: { perDay: number; stepsPerShortcut: number; shortcutMinutes: number; maxShortcut: number; gold: { child: [number, number]; parent: [number, number] } };
}

export const DEFAULT_ACTIVITY: ActivityConfig = {
  steps: {
    child: [{ at: 2000, xp: 2, gold: 2 }, { at: 5000, xp: 3, gold: 3 }, { at: 8000, xp: 3, gold: 3 }, { at: 10000, xp: 2, gold: 2 }],
    parent: [{ at: 2000, xp: 5, gold: 4 }, { at: 5000, xp: 10, gold: 8 }, { at: 8000, xp: 12, gold: 10 }, { at: 10000, xp: 13, gold: 8 }]
  },
  xpShop: { child: { xp: 10, prices: [40] }, parent: { xp: 10, prices: [20, 30, 40] } },
  voyage: { perDay: 3, stepsPerShortcut: 1000, shortcutMinutes: 10, maxShortcut: 0.5, gold: { child: [3, 8], parent: [8, 18] } }
};

interface Data {
  day: string;
  steps: number;
  /** Paliers déjà récompensés aujourd'hui (valeur « at »). */
  claimed: number[];
  /** Potions d'expérience achetées aujourd'hui. */
  potions: number;
  /** Capteur indisponible / autorisation refusée (dernière lecture). */
  available: boolean;
  permission: boolean;
  asked: boolean;
}

const KEY = 'quete-du-dragon:activity';

export class Activity {
  readonly events = new EventBus<{ change: void; tier: StepTier }>();
  data: Data;
  cfg: ActivityConfig = DEFAULT_ACTIVITY;

  constructor(private link: Transport, private state: GameState, readonly role: 'child' | 'parent') {
    this.data = { day: todayKey(), steps: 0, claimed: [], potions: 0, available: true, permission: false, asked: false, ...readStore<Partial<Data>>(KEY, {}) };
    this.roll();
  }

  async load(): Promise<void> {
    try {
      const c = await loadJSON<Partial<ActivityConfig>>('data/activity.json');
      this.cfg = { ...DEFAULT_ACTIVITY, ...c, steps: { ...DEFAULT_ACTIVITY.steps, ...(c.steps ?? {}) }, xpShop: { ...DEFAULT_ACTIVITY.xpShop, ...(c.xpShop ?? {}) }, voyage: { ...DEFAULT_ACTIVITY.voyage, ...(c.voyage ?? {}) } };
    } catch { /* réglages par défaut */ }
  }

  private save(): void { writeStore(KEY, this.data); this.events.emit('change', undefined); }

  private roll(): void {
    const k = todayKey();
    if (this.data.day !== k) { this.data.day = k; this.data.steps = 0; this.data.claimed = []; this.data.potions = 0; }
  }

  tiers(): Array<StepTier & { reached: boolean }> {
    return this.cfg.steps[this.role].map(t => ({ ...t, reached: this.data.steps >= t.at }));
  }
  next(): StepTier | null { return this.cfg.steps[this.role].find(t => this.data.steps < t.at) ?? null; }
  /** XP et or maximum par jour avec les pas. */
  dailyMax(): { xp: number; gold: number } {
    return this.cfg.steps[this.role].reduce((a, t) => ({ xp: a.xp + t.xp, gold: a.gold + t.gold }), { xp: 0, gold: 0 });
  }

  /** Lit les pas du jour et crédite les paliers franchis. */
  async refresh(): Promise<StepsInfo> {
    this.roll();
    let info: StepsInfo;
    try { info = await this.link.getSteps(); } catch { info = { available: false, permission: false, today: 0 }; }
    this.data.available = info.available;
    this.data.permission = info.permission;
    if (info.available && info.permission) this.data.steps = Math.max(this.data.steps, Math.round(info.today));
    for (const t of this.cfg.steps[this.role]) {
      if (this.data.steps < t.at || this.data.claimed.includes(t.at)) continue;
      this.data.claimed.push(t.at);
      if (t.xp) this.state.addXp(t.xp);
      if (t.gold) this.state.addGold(t.gold);
      this.events.emit('tier', t);
    }
    this.save();
    return info;
  }

  async askPermission(): Promise<void> {
    this.data.asked = true;
    this.save();
    await this.link.requestStepsPermission();
  }

  // ---------- Potion d'expérience ----------
  potion(): { xp: number; price: number | null; left: number; perDay: number } {
    this.roll();
    const s = this.cfg.xpShop[this.role];
    const left = Math.max(0, s.prices.length - this.data.potions);
    return { xp: s.xp, price: left ? s.prices[this.data.potions] : null, left, perDay: s.prices.length };
  }

  buyPotion(): 'ok' | 'limit' | 'gold' {
    const p = this.potion();
    if (p.price === null) return 'limit';
    if (this.state.data.gold < p.price) return 'gold';
    this.state.addGold(-p.price);
    this.data.potions++;
    this.state.addXp(p.xp);
    this.save();
    return 'ok';
  }
}
