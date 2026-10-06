// Côté enfant : liste des missions, réalisation, demandes de validation, réponses des parents,
// bonus reçus, et envoi de l'état du dragon aux parents. Le téléphone de l'enfant fait foi.
import { EventBus } from '../core/events.js';
import { loadJSON } from '../core/data.js';
import type { GameState } from '../game/GameState.js';
import type { LinkMessage, NotifSpec, Transport } from '../link/Transport.js';
import { readStore, writeStore } from '../platform/storage.js';
import {
  appliesOn, newId, rewardText, todayKey,
  type ChildSnapshot, type Mission, type MissionStatus, type RequestInfo
} from './model.js';
import type { Reminders } from './Reminders.js';
import { ENERGY, EMPTY_STATS, badgeProgress, xpMultiplier, type BadgeDef, type ChildStats } from './badges.js';

interface DayRecord { date: string; status: MissionStatus; requestId?: string }
interface BookData {
  missions: Mission[];
  records: Record<string, DayRecord>;
  requests: Record<string, RequestInfo & { status: 'pending' | 'approved' | 'refused' }>;
  history: Array<{ at: number; text: string }>;
  streakDays: string[]; // jours où toutes les missions du jour ont été faites
  seeded: boolean;
  /** Énergie du dragon (0-100) : baisse avec les missions oubliées, remonte avec les missions faites. */
  energy: number;
  /** Dernier jour dont le bilan (missions oubliées) a été fait. */
  lastSettled: string;
  stats: ChildStats;
  /** Badges débloqués : id -> date. */
  badges: Record<string, number>;
  /** Titre affiché (id d'un badge débloqué). */
  title: string | null;
}

const KEY = 'quete-du-dragon:missions';

export class ChildBook {
  readonly events = new EventBus<{ change: void; toast: string }>();
  data: BookData;
  private statusTimer = 0;

  constructor(private link: Transport, private state: GameState, private reminders: Reminders, readonly badgeDefs: BadgeDef[] = []) {
    const defaults: BookData = {
      missions: [], records: {}, requests: {}, history: [], streakDays: [], seeded: false,
      energy: ENERGY.max, lastSettled: yesterdayKey(), stats: { ...EMPTY_STATS, perMission: {} }, badges: {}, title: null
    };
    const saved = readStore<Partial<BookData>>(KEY, {});
    this.data = { ...defaults, ...saved, stats: { ...defaults.stats, ...(saved.stats ?? {}) } };
  }

  async init(): Promise<void> {
    if (!this.data.seeded) {
      try {
        const d = await loadJSON<{ missions: Mission[] }>('data/missions.json');
        this.data.missions = d.missions;
      } catch { /* liste vide */ }
      this.data.seeded = true;
      this.save();
    }
    this.state.events.on('change', () => { this.queueStatus(); this.checkBadges(); });
    await this.sync();
  }

  private save(): void {
    writeStore(KEY, this.data);
    this.events.emit('change', undefined);
  }

  private log(text: string): void {
    this.data.history.unshift({ at: Date.now(), text });
    this.data.history = this.data.history.slice(0, 50);
  }

  // ---------- Lecture ----------
  status(id: string, date = todayKey()): MissionStatus {
    const r = this.data.records[id];
    const m = this.data.missions.find(x => x.id === id);
    if (!r) return 'todo';
    if (m?.once) return r.status; // quête spéciale : son statut ne dépend pas du jour
    return r.date === date ? r.status : 'todo';
  }

  today(): Array<{ mission: Mission; status: MissionStatus }> {
    const now = new Date();
    return this.data.missions
      .filter(m => appliesOn(m, now))
      .map(m => ({ mission: m, status: this.status(m.id) }))
      .sort((a, b) => order(a.status) - order(b.status) || (a.mission.time ?? '99').localeCompare(b.mission.time ?? '99'));
  }

  streak(): number {
    let n = 0;
    const d = new Date(); d.setDate(d.getDate() - 1);
    const set = new Set(this.data.streakDays);
    if (set.has(todayKey())) n++;
    while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------- Actions de l'enfant ----------
  async complete(id: string): Promise<void> {
    const m = this.data.missions.find(x => x.id === id);
    if (!m) return;
    const st = this.status(id);
    if (st === 'done' || st === 'pending') return;
    const date = todayKey();

    if (m.validation === 'trust') {
      this.data.records[id] = { date, status: 'done' };
      const text = this.reward(m.xp, m.gold, true);
      this.count(m, Date.now());
      this.log(`${m.title} : ${text}`);
      this.events.emit('toast', `${m.title} : ${text}`);
      this.afterCompletion(m);
    } else {
      const req: RequestInfo = { requestId: newId('r'), kind: 'mission', missionId: m.id, title: m.title, xp: m.xp, gold: m.gold, date, childName: this.name(), doneAt: Date.now() };
      this.data.records[id] = { date, status: 'pending', requestId: req.requestId };
      this.data.requests[req.requestId] = { ...req, status: 'pending' };
      this.log(`${m.title} : envoyé aux parents`);
      await this.link.send('parents', 'validation.request', req, this.requestNotif(req));
      this.events.emit('toast', 'Envoyé aux parents pour validation');
      if (m.once) this.save();
    }
    this.checkBadges();
    this.save();
    await this.refreshReminders();
    this.queueStatus();
  }

  async declareInitiative(text: string): Promise<void> {
    const req: RequestInfo = { requestId: newId('r'), kind: 'initiative', title: text.trim().slice(0, 80), xp: 0, gold: 0, date: todayKey(), childName: this.name() };
    this.data.requests[req.requestId] = { ...req, status: 'pending' };
    this.log(`Initiative : ${req.title}`);
    this.save();
    await this.link.send('parents', 'validation.request', req, this.requestNotif(req));
    this.events.emit('toast', 'Initiative envoyée aux parents');
  }

  pendingRequests() { return Object.values(this.data.requests).filter(r => r.status === 'pending'); }

  private name(): string { return this.childName || 'Votre enfant'; }
  childName = '';

  /**
   * Crédite une récompense. Pour une mission (mission = true), l'XP est modulé par l'énergie
   * du dragon AVANT que la mission ne la fasse remonter : un dragon épuisé ne gagne pas d'XP
   * sur la mission qui le relance. Retourne le texte de la récompense obtenue.
   */
  private reward(xp: number, gold: number, mission = false): string {
    const mult = mission ? xpMultiplier(this.data.energy) : 1;
    const gainedXp = Math.round(xp * mult);
    if (gold) this.state.addGold(gold);
    if (gainedXp) this.state.addXp(gainedXp);
    if (mission) this.data.energy = Math.min(ENERGY.max, this.data.energy + ENERGY.perMission);
    const text = rewardText(gainedXp, gold) || 'aucune récompense';
    if (mission && mult < 1) return mult === 0 ? `${text} (dragon épuisé : pas d’XP, il reprend des forces)` : `${text} (dragon fatigué : XP × ${String(mult).replace('.', ',')})`;
    return text;
  }

  /** Statistiques pour les badges. */
  private count(m: Mission | undefined, doneAt: number): void {
    const s = this.data.stats;
    s.total++;
    if (m) {
      s.perMission[m.id] = (s.perMission[m.id] ?? 0) + 1;
      if (m.time) {
        const [hh, mm] = m.time.split(':').map(Number);
        const limit = new Date(doneAt); limit.setHours(hh, mm, 0, 0);
        if (doneAt <= limit.getTime()) s.punctual++;
      }
    }
  }

  // ---------- Badges ----------
  checkBadges(): void {
    let changed = false;
    for (const b of this.badgeDefs) {
      if (this.data.badges[b.id]) continue;
      const [v, target] = badgeProgress(b, this.data.stats, this.state.data.level, this.state.data.stage);
      if (v < target) continue;
      this.data.badges[b.id] = Date.now();
      changed = true;
      this.log(`Succès débloqué : ${b.title}${b.reward ? ` (+${b.reward} or)` : ''}`);
      this.events.emit('toast', `Succès débloqué : ${b.title} !`);
      void this.link.send('parents', 'badge', { id: b.id, title: b.title, tier: b.tier },
        { title: `${this.name()} a débloqué un succès`, body: `${b.title} — ${b.description}`, tag: 'badge-' + b.id, channel: 'missions' });
      if (b.reward) this.state.addGold(b.reward);
    }
    if (changed) this.save();
  }

  setTitle(id: string | null): void {
    this.data.title = id && this.data.badges[id] ? id : null;
    this.save();
    this.queueStatus(0);
  }

  titleText(): string | null {
    return this.badgeDefs.find(b => b.id === this.data.title)?.title ?? null;
  }

  // ---------- Bilan quotidien (malus) ----------
  /** Fait le bilan des jours passés : chaque mission oubliée (ou refusée) fait baisser l'énergie. */
  private settle(): void {
    const today = todayKey();
    const d = parseKey(this.data.lastSettled);
    d.setDate(d.getDate() + 1);
    let guard = 0;
    while (todayKey(d) < today && guard++ < 60) {
      const key = todayKey(d);
      const due = this.data.missions.filter(m => !m.once && appliesOn(m, d));
      const missed = due.filter(m => {
        const r = this.data.records[m.id];
        return !(r && r.date === key && (r.status === 'done' || r.status === 'pending'));
      });
      if (missed.length) {
        const loss = Math.min(ENERGY.dailyCap, missed.length * ENERGY.missedPenalty);
        this.data.energy = Math.max(0, this.data.energy - loss);
        const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
        this.log(`Bilan du ${label} : ${missed.length} mission${missed.length > 1 ? 's' : ''} oubliée${missed.length > 1 ? 's' : ''}, énergie −${loss}`);
        if (guard === 1 || todayKey(d) === yesterdayKey()) this.events.emit('toast', `Ton dragon a perdu ${loss} d’énergie (missions oubliées)`);
      }
      d.setDate(d.getDate() + 1);
    }
    this.data.lastSettled = yesterdayKey();
  }

  private afterCompletion(m: Mission): void {
    if (m.once) {
      this.data.missions = this.data.missions.filter(x => x.id !== m.id);
      delete this.data.records[m.id];
    }
    const all = this.today();
    if (all.length && all.every(t => t.status === 'done')) {
      const k = todayKey();
      if (!this.data.streakDays.includes(k)) {
        this.data.streakDays.push(k);
        this.data.streakDays = this.data.streakDays.slice(-60);
        const s = this.streak();
        this.data.stats.perfectDays++;
        this.data.stats.maxStreak = Math.max(this.data.stats.maxStreak, s);
        this.data.energy = Math.min(ENERGY.max, this.data.energy + ENERGY.perfectDayBonus);
        if (s > 0 && s % 7 === 0) { this.reward(50, 50); this.events.emit('toast', `Série de ${s} jours ! Bonus +50 XP, +50 or`); }
        else this.events.emit('toast', 'Toutes les missions du jour sont faites !');
      }
    }
  }

  // ---------- Notifications envoyées aux parents ----------
  private requestNotif(req: RequestInfo): NotifSpec {
    const tag = 'req-' + req.requestId;
    const who = req.childName ?? 'Votre enfant';
    const close = (approved: boolean) => ({ to: 'parents', type: 'validation.closed', payload: { requestId: req.requestId, approved }, dismiss: tag });
    if (req.kind === 'initiative') {
      const bonus = (n: number) => ({
        id: `b${n}`, label: `+${n}`, doneText: `Bonus de ${n} envoyé`,
        replies: [
          { to: 'sender', type: 'validation.response', payload: { requestId: req.requestId, approved: true, xp: n, gold: n },
            notif: { title: 'Initiative récompensée !', body: `${req.title} : +${n} XP, +${n} or`, tag: 'res-' + req.requestId, channel: 'missions' as const } },
          close(true)
        ]
      });
      return {
        title: `${who} a pris une initiative`, body: req.title, tag, channel: 'validations',
        actions: [bonus(10), bonus(25), {
          id: 'no', label: 'Refuser', doneText: 'Initiative refusée',
          replies: [{ to: 'sender', type: 'validation.response', payload: { requestId: req.requestId, approved: false } }, close(false)]
        }]
      };
    }
    return {
      title: `${who} a terminé une mission`, body: `${req.title} · ${rewardText(req.xp, req.gold)}`, tag, channel: 'validations',
      actions: [
        { id: 'ok', label: 'Valider', doneText: 'Mission validée',
          replies: [
            { to: 'sender', type: 'validation.response', payload: { requestId: req.requestId, approved: true },
              notif: { title: 'Mission validée !', body: `${req.title} : ${rewardText(req.xp, req.gold)}`, tag: 'res-' + req.requestId, channel: 'missions' } },
            close(true)
          ] },
        { id: 'no', label: 'À refaire', doneText: 'Mission à refaire',
          replies: [
            { to: 'sender', type: 'validation.response', payload: { requestId: req.requestId, approved: false },
              notif: { title: 'Mission à refaire', body: `${req.title} : tes parents te demandent de la reprendre.`, tag: 'res-' + req.requestId, channel: 'missions' } },
            close(false)
          ] }
      ]
    };
  }

  // ---------- Messages reçus ----------
  async sync(): Promise<void> {
    const before = this.data.lastSettled;
    this.settle();
    const msgs = await this.link.drainInbox();
    let changed = before !== this.data.lastSettled;
    for (const m of msgs) changed = this.handle(m) || changed;
    if (changed) { this.checkBadges(); this.save(); }
    await this.refreshReminders();
    this.queueStatus();
  }

  private handle(msg: LinkMessage): boolean {
    if (msg.outgoing) return false;
    const p = msg.payload ?? {};
    const by = msg.fromName || 'Un parent';
    switch (msg.type) {
      case 'validation.response': {
        const req = this.data.requests[p.requestId];
        if (!req || req.status !== 'pending') return false; // déjà traité par un autre parent
        if (p.approved) {
          const xp = req.kind === 'initiative' ? Number(p.xp) || 0 : req.xp;
          const gold = req.kind === 'initiative' ? Number(p.gold) || 0 : req.gold;
          req.status = 'approved';
          const text = this.reward(xp, gold, true);
          const m0 = req.missionId ? this.data.missions.find(x => x.id === req.missionId) : undefined;
          if (req.kind === 'initiative') { this.data.stats.initiatives++; this.data.stats.total++; }
          else this.count(m0, req.doneAt ?? Date.now());
          this.log(`${req.title} validé par ${by} : ${text}`);
          this.events.emit('toast', `${req.title} validé : ${text}`);
          if (req.missionId) {
            this.data.records[req.missionId] = { date: req.date, status: 'done', requestId: req.requestId };
            const m = this.data.missions.find(x => x.id === req.missionId);
            if (m) this.afterCompletion(m);
          }
        } else {
          req.status = 'refused';
          this.log(`${req.title} : à refaire (${by})`);
          this.events.emit('toast', `${req.title} : à refaire`);
          if (req.missionId) this.data.records[req.missionId] = { date: req.date, status: 'refused', requestId: req.requestId };
        }
        return true;
      }
      case 'mission.upsert': {
        const m = p.mission as Mission;
        if (!m?.id) return false;
        const i = this.data.missions.findIndex(x => x.id === m.id);
        if (i >= 0) this.data.missions[i] = m; else this.data.missions.push(m);
        if (m.once && i < 0) {
          this.log(`Nouvelle quête de ${by} : ${m.title}`);
          this.events.emit('toast', `Nouvelle quête : ${m.title}`);
        }
        return true;
      }
      case 'mission.remove': {
        this.data.missions = this.data.missions.filter(x => x.id !== p.id);
        delete this.data.records[p.id];
        return true;
      }
      case 'gift': {
        const xp = Number(p.xp) || 0, gold = Number(p.gold) || 0;
        this.reward(xp, gold);
        this.data.stats.gifts++;
        const text = `Coup de cœur de ${by} : ${rewardText(xp, gold)}`;
        this.log(p.message ? `${text} — « ${p.message} »` : text);
        this.events.emit('toast', text);
        return true;
      }
      case 'warning': {
        // Avertissement d'un parent : retire de l'or (plafonné) et de l'énergie. Jamais de niveau ni d'objet.
        const gold = Math.min(50, Math.max(0, Number(p.gold) || 0));
        this.state.addGold(-gold);
        this.data.energy = Math.max(0, this.data.energy - ENERGY.warningPenalty);
        this.data.stats.warnings++;
        const text = `Avertissement de ${by} : −${gold} or${p.reason ? ` — « ${p.reason} »` : ''}`;
        this.log(text);
        this.events.emit('toast', text);
        return true;
      }
      case 'status.request':
        this.queueStatus(0);
        return false;
      default:
        return false;
    }
  }

  // ---------- État envoyé aux parents ----------
  snapshot(): ChildSnapshot {
    const d = this.state.data;
    const today: Record<string, MissionStatus> = {};
    for (const t of this.today()) today[t.mission.id] = t.status;
    return {
      name: this.name(), level: d.level, xp: d.xp, xpToNext: this.state.xpToNext(), stage: d.stage,
      stageLabel: this.state.stage.label, gold: d.gold, equipped: Object.values(d.equipped),
      missions: this.data.missions, today, date: todayKey(), streak: this.streak(),
      energy: this.data.energy, title: this.titleText(),
      badgeCount: Object.keys(this.data.badges).length, badgeTotal: this.badgeDefs.length
    };
  }

  queueStatus(delay = 1500): void {
    clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => void this.link.send('parents', 'status', this.snapshot()), delay);
  }

  async refreshReminders(): Promise<void> {
    await this.reminders.reschedule(this.data.missions, (id, date) => this.status(id, date));
  }
}

function order(s: MissionStatus): number {
  return s === 'todo' ? 0 : s === 'refused' ? 1 : s === 'pending' ? 2 : 3;
}

function yesterdayKey(): string { const d = new Date(); d.setDate(d.getDate() - 1); return todayKey(d); }
function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return y ? new Date(y, (m || 1) - 1, d || 1) : new Date();
}
