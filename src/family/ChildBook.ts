// Côté enfant : liste des missions, réalisation, demandes de validation, réponses des parents,
// bonus reçus, et envoi de l'état du dragon aux parents. Le téléphone de l'enfant fait foi.
import { EventBus } from '../core/events.js';
import { loadJSON } from '../core/data.js';
import type { GameState } from '../game/GameState.js';
import type { LinkMessage, NotifSpec, Transport } from '../link/Transport.js';
import { readStore, writeStore } from '../platform/storage.js';
import {
  appliesOn, newId, rewardText, todayKey,
  type ChildSnapshot, type Mission, type MissionStatus, type RequestInfo, type Reward
} from './model.js';
import { fill, journeyFor, landmarks, weekKey } from './Expedition.js';
import type { Reminders } from './Reminders.js';
import type { Companion } from './Companion.js';
import { missionLine } from './Thoughts.js';
import { ENERGY, EMPTY_STATS, PENALTY, badgeProgress, type BadgeDef, type ChildStats, type Severity } from './badges.js';

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
  /** Sévérité des sanctions (réglée par les parents). */
  severity: Severity;
  /** Jours d'affilée avec au moins une mission oubliée. */
  missStreak: number;
  /** Équipement confisqué (sanction stricte), rendu après une journée parfaite. */
  confiscated: { id: string; category: string } | null;
  /** Dernier bilan de sanctions, affiché à l'ouverture. */
  lastPenalty: { date: string; missed: string[]; xp: number; gold: number } | null;
  /** Gemmes : monnaie des vraies récompenses. */
  gems: number;
  rewards: Reward[];
  /** Mission du jour tirée au sort : récompense doublée. */
  double: { date: string; missionId: string } | null;
  /** Boucliers de série (un jour d'oubli sans casser la série). */
  shields: number;
  /** Expédition de la semaine. */
  expedition: { week: string; steps: number; opened: boolean; seen: number };
  /** Statistiques de la semaine pour le bilan du dimanche. */
  week: { key: string; missions: number; perfect: number; bonus: number };
  bonusSeeded: boolean;
}

const KEY = 'quete-du-dragon:missions';

export class ChildBook {
  readonly events = new EventBus<{ change: void; toast: string; story: string; reward: { xp: number; gold: number; mission: boolean } }>();
  data: BookData;
  private statusTimer = 0;

  constructor(private link: Transport, private state: GameState, private reminders: Reminders, readonly badgeDefs: BadgeDef[] = []) {
    const defaults: BookData = {
      missions: [], records: {}, requests: {}, history: [], streakDays: [], seeded: false,
      energy: ENERGY.max, lastSettled: yesterdayKey(), stats: { ...EMPTY_STATS, perMission: {} }, badges: {}, title: null,
      severity: 'normal', missStreak: 0, confiscated: null, lastPenalty: null,
      gems: 0, rewards: DEFAULT_REWARDS, double: null, shields: 0,
      expedition: { week: weekKey(), steps: 0, opened: false, seen: 0 },
      week: { key: weekKey(), missions: 0, perfect: 0, bonus: 0 }, bonusSeeded: false
    };
    const saved = readStore<Partial<BookData>>(KEY, {});
    this.data = { ...defaults, ...saved, stats: { ...defaults.stats, ...(saved.stats ?? {}) } };
    if (this.data.confiscated) state.locked.add(this.data.confiscated.id);
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
    // plus de quêtes bonus installées d'office : les parents ajoutent eux-mêmes ce qu'ils veulent
    this.data.bonusSeeded = true;
    this.migrateDefaults();
    this.rollWeek();
    this.state.events.on('change', () => { this.queueStatus(); this.checkBadges(); });
    await this.sync();
  }

  /**
   * Octobre 2026 : seules 3 tâches quotidiennes sont installées par défaut (chat, litière, devoirs).
   * Sur les téléphones déjà installés : on retire les quêtes d'exemple (chambre, sport, sac, bonus d'office)
   * et on met à jour les 3 tâches gardées. Les quêtes créées par les parents ne sont pas touchées.
   */
  private migrateDefaults(): void {
    const d = this.data as BookData & { defaultsV2?: boolean };
    if (d.defaultsV2) return;
    const drop = new Set(['m_chambre', 'm_sport', 'm_sac', 'b_repas', 'b_salon', 'b_voiture']);
    const removed = this.data.missions.filter(m => drop.has(m.id)).map(m => m.title);
    this.data.missions = this.data.missions.filter(m => !drop.has(m.id));
    for (const id of drop) delete this.data.records[id];
    const update: Record<string, Partial<Mission>> = {
      m_chat: { title: 'Donner à manger au chat', days: [0, 1, 2, 3, 4, 5, 6] },
      m_litiere: { title: 'Contrôler la litière', days: [0, 1, 2, 3, 4, 5, 6] },
      m_devoirs: { title: 'Faire ses devoirs', days: [1, 2, 3, 4, 5] }
    };
    this.data.missions = this.data.missions.map(m => update[m.id] ? { ...m, ...update[m.id] } : m);
    if (removed.length) this.log(`Quêtes d’exemple retirées : ${removed.join(', ')}`);
    d.defaultsV2 = true;
    this.save();
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
      .filter(m => !m.optional && appliesOn(m, now))
      .map(m => ({ mission: m, status: this.status(m.id) }))
      .sort((a, b) => order(a.status) - order(b.status) || (a.mission.time ?? '99').localeCompare(b.mission.time ?? '99'));
  }

  /** Quêtes bonus facultatives du jour. */
  bonusToday(): Array<{ mission: Mission; status: MissionStatus }> {
    const now = new Date();
    return this.data.missions.filter(m => m.optional && appliesOn(m, now)).map(m => ({ mission: m, status: this.status(m.id) }));
  }

  /** Mission du jour à récompense doublée (tirée au sort une fois par jour). */
  doubleId(): string | null {
    const k = todayKey();
    if (this.data.double?.date !== k) {
      const pool = this.today().filter(t => !t.mission.once).map(t => t.mission.id);
      this.data.double = pool.length ? { date: k, missionId: pool[Math.floor(Math.random() * pool.length)] } : null;
      writeStore(KEY, this.data);
    }
    return this.data.double?.missionId ?? null;
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
  async complete(id: string, photo?: string): Promise<void> {
    const found = this.data.missions.find(x => x.id === id);
    if (!found) return;
    const dbl = this.doubleId() === id ? 2 : 1;
    const m: Mission = dbl > 1 ? { ...found, xp: found.xp * 2, gold: found.gold * 2 } : found;
    const st = this.status(id);
    if (st === 'done' || st === 'pending') return;
    const date = todayKey();

    if (m.validation === 'trust') {
      this.data.records[id] = { date, status: 'done' };
      const text = this.reward(m.xp, m.gold, true);
      this.count(m, Date.now());
      this.progress(m);
      this.log(`${m.title} : ${text}`);
      this.events.emit('toast', `${m.title} : ${text}`);
      this.afterCompletion(m);
    } else {
      const req: RequestInfo = { requestId: newId('r'), kind: 'mission', missionId: m.id, title: m.title + (dbl > 1 ? ' (×2)' : ''), xp: m.xp, gold: m.gold, date, childName: this.name(), doneAt: Date.now(), photo };
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
  /** Le dragon compagnon (soins, faim, amitié). */
  companion: Companion | null = null;

  /**
   * Crédite une récompense : une quête = de l'XP et de l'or, rien d'autre (les soins du dragon sont à part).
   * Retourne le texte de la récompense obtenue.
   */
  private reward(xp: number, gold: number, mission = false): string {
    const gainedXp = Math.round(xp);
    if (gold) this.state.addGold(gold);
    if (gainedXp) this.state.addXp(gainedXp);
    if (gainedXp || gold) this.events.emit('reward', { xp: gainedXp, gold, mission });
    return rewardText(gainedXp, gold) || 'aucune récompense';
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
    this.clearSanctions();
    const today = todayKey();
    const d = parseKey(this.data.lastSettled);
    d.setDate(d.getDate() + 1);
    let guard = 0;
    while (todayKey(d) < today && guard++ < 60) {
      const key = todayKey(d);
      const due = this.data.missions.filter(m => !m.once && !m.optional && appliesOn(m, d));
      const missed = due.filter(m => {
        const r = this.data.records[m.id];
        return !(r && r.date === key && (r.status === 'done' || r.status === 'pending'));
      });
      if (missed.length && this.data.shields > 0 && this.streakBefore(key) >= 3) {
        this.data.shields--;
        this.data.streakDays.push(key);
        this.log(`Bouclier utilisé le ${key} : ta série est sauvée`);
        this.events.emit('toast', 'Ton bouclier a protégé ta série !');
      }
      if (missed.length) {
        // Plus de sanctions (octobre 2026) : une quête oubliée ne coûte rien. Seule la série s'interrompt.
        this.data.stats.missed = (this.data.stats.missed ?? 0) + missed.length;
        const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
        this.log(`Journée du ${label} : ${missed.map(m => m.title).join(', ')} non fait${missed.length > 1 ? 's' : ''}`);
      } else if (due.length) {
        this.data.missStreak = 0;
      }
      d.setDate(d.getDate() + 1);
    }
    this.data.lastSettled = yesterdayKey();
  }

  /** Série en cours juste avant le jour donné. */
  private streakBefore(key: string): number {
    const set = new Set(this.data.streakDays);
    const d = parseKey(key); d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(todayKey(d)) && n < 400) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------- Gemmes, récompenses réelles, expédition ----------
  /** Après chaque mission réussie : gemmes, étape d'expédition, statistiques de la semaine. */
  private progress(m: Mission | undefined): void {
    this.rollWeek();
    this.data.gems += m?.optional ? 2 : 1;
    this.data.week.missions++;
    if (m?.optional) this.data.week.bonus++;
    const e = this.data.expedition;
    const goal = this.expeditionGoal();
    if (e.steps < goal) {
      e.steps++;
      const marks = landmarks(journeyFor(e.week), goal);
      const reached = marks.filter(l => l.at <= e.steps).length;
      if (reached > e.seen) {
        e.seen = reached;
        const l = marks[reached - 1];
        this.events.emit('toast', `Expédition : ${l.name} atteint !`);
        this.events.emit('story', fill(l.story, this.companion?.name ?? 'Ton dragon'));
      }
    }
  }

  /** Nouvelle semaine : nouvelle expédition, compteurs remis à zéro. */
  private rollWeek(): void {
    const w = weekKey();
    if (this.data.expedition.week !== w) this.data.expedition = { week: w, steps: 0, opened: false, seen: 0 };
    if (this.data.week.key !== w) this.data.week = { key: w, missions: 0, perfect: 0, bonus: 0 };
  }

  /** Objectif de la semaine : environ 85 % des missions prévues (entre 8 et 40 étapes). */
  expeditionGoal(): number {
    const start = parseKey(this.data.expedition.week);
    let due = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      due += this.data.missions.filter(m => !m.once && !m.optional && appliesOn(m, d)).length;
    }
    return Math.max(8, Math.min(40, Math.round(due * 0.85)));
  }

  /** Ouvre le coffre de fin d'expédition. Retourne le contenu. */
  openChest(): { gems: number; gold: number; fruit: boolean } | null {
    const e = this.data.expedition;
    if (e.opened || e.steps < this.expeditionGoal()) return null;
    e.opened = true;
    const loot = { gems: 5, gold: 120, fruit: false };
    this.data.gems += loot.gems;
    this.state.addGold(loot.gold);
    if (this.companion) { this.companion.remember('exp-' + e.week, `Expédition : ${journeyFor(e.week).title}`, 'Arrivé au bout de l’expédition de la semaine.'); this.companion.save(); }
    this.log(`Coffre d’expédition : +${loot.gems} gemmes, +${loot.gold} or`);
    this.save();
    return loot;
  }

  /** Gemmes gagnées hors missions (coffre du jour, trouvailles du dragon…). */
  addGems(n: number, reason: string): void {
    if (n <= 0) return;
    this.data.gems += n;
    this.log(`${reason} : +${n} gemme${n > 1 ? 's' : ''}`);
    this.save();
  }

  /** Demande d'une vraie récompense : les gemmes sont réservées, rendues si les parents refusent. */
  async requestReward(r: Reward): Promise<boolean> {
    if (this.data.gems < r.cost) return false;
    this.data.gems -= r.cost;
    const req: RequestInfo = { requestId: newId('r'), kind: 'reward', rewardId: r.id, title: r.title, xp: 0, gold: 0, gems: r.cost, date: todayKey(), childName: this.name() };
    this.data.requests[req.requestId] = { ...req, status: 'pending' };
    this.log(`Récompense demandée : ${r.title} (${r.cost} gemmes)`);
    this.save();
    await this.link.send('parents', 'validation.request', req, this.requestNotif(req));
    this.events.emit('toast', 'Demande envoyée à tes parents');
    this.queueStatus();
    return true;
  }

  /** Bilan du dimanche soir, écrit par le dragon. */
  private weeklyRecap(): Array<{ key: string; at: Date; body: string }> {
    this.rollWeek();
    const at = parseKey(this.data.week.key); at.setDate(at.getDate() + 6); at.setHours(19, 0, 0, 0);
    const w = this.data.week, e = this.data.expedition, goal = this.expeditionGoal();
    const bond = this.companion?.bondLevel().label;
    const parts = [`${w.missions} mission${w.missions > 1 ? 's' : ''}`, `${w.perfect} journée${w.perfect > 1 ? 's' : ''} parfaite${w.perfect > 1 ? 's' : ''}`,
      e.steps >= goal ? 'expédition terminée' : `expédition à ${Math.round((e.steps / goal) * 100)} %`];
    return [{ key: 'recap-' + w.key, at, body: `Notre semaine : ${parts.join(', ')}.${bond ? ` Notre amitié : ${bond}.` : ''} Merci d’être là !` }];
  }

  /**
   * Les sanctions ont été supprimées (octobre 2026) : on efface tout ce qu'il en reste
   * (dragon malade, objet confisqué, énergie basse, bilan de pertes affiché).
   */
  clearSanctions(): void {
    let changed = false;
    if (this.data.confiscated) { this.state.locked.delete(this.data.confiscated.id); this.data.confiscated = null; changed = true; }
    if (this.data.lastPenalty) { this.data.lastPenalty = null; changed = true; }
    if (this.data.missStreak) { this.data.missStreak = 0; changed = true; }
    if (this.data.energy < ENERGY.max) { this.data.energy = ENERGY.max; changed = true; }
    if (this.companion?.data.sick) { this.companion.setSick(false); changed = true; }
    if (changed) this.save();
  }

  /** Journée parfaite : le dragon guérit, l'objet confisqué est rendu. */
  private forgive(): void {
    this.data.missStreak = 0;
    if (this.companion?.data.sick) { this.companion.setSick(false); this.events.emit('toast', 'Ton dragon est guéri !'); }
    const c = this.data.confiscated;
    if (c) {
      this.state.locked.delete(c.id);
      this.data.confiscated = null;
      this.log('Objet confisqué rendu');
      this.events.emit('toast', 'Ton équipement confisqué t’est rendu !');
    }
  }

  severityRule() { return PENALTY[this.data.severity] ?? PENALTY.normal; }

  /** Ce que coûteraient les missions encore à faire aujourd'hui si elles étaient oubliées. */
  /** Quêtes du jour qui restent à faire (plus aucun coût : les sanctions ont été supprimées). */
  pendingCost(): { count: number; xp: number; gold: number } {
    const left = this.today().filter(t => (t.status === 'todo' || t.status === 'refused') && !t.mission.once);
    return { count: left.length, xp: 0, gold: 0 };
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
        this.forgive();
        this.data.gems += 2;
        this.rollWeek(); this.data.week.perfect++;
        if (s > 0 && s % 7 === 0 && this.data.shields < 2) { this.data.shields++; this.events.emit('toast', 'Bouclier de série gagné : il protégera ta série un jour d’oubli.'); }
        if (s === 7 || s === 30 || s === 100) this.companion?.remember('streak' + s, `${s} jours de suite`, `Toutes les missions faites ${s} jours d’affilée.`);
        if (this.data.stats.perfectDays === 1) this.companion?.remember('perfect1', 'Première journée parfaite', 'Toutes les missions du jour faites pour la première fois.');
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
    if (req.kind === 'reward') {
      const answer = (approved: boolean) => ({
        id: approved ? 'ok' : 'no', label: approved ? 'Accorder' : 'Refuser', doneText: approved ? 'Récompense accordée' : 'Récompense refusée',
        replies: [
          { to: 'sender', type: 'validation.response', payload: { requestId: req.requestId, approved },
            notif: { title: approved ? 'Récompense accordée !' : 'Récompense refusée', body: approved ? req.title : `${req.title} : tes gemmes te sont rendues.`, tag: 'res-' + req.requestId, channel: 'missions' as const } },
          close(approved)
        ]
      });
      return { title: `${who} demande une récompense`, body: `${req.title} · ${req.gems} gemmes`, tag, channel: 'validations', actions: [answer(true), answer(false)] };
    }
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
        if (req.kind === 'reward') {
          req.status = p.approved ? 'approved' : 'refused';
          if (p.approved) {
            this.log(`Récompense accordée par ${by} : ${req.title}`);
            this.events.emit('toast', `Récompense accordée : ${req.title} !`);
            this.companion?.remember('reward-' + req.requestId, `Récompense : ${req.title}`, `Gagnée avec ${req.gems} gemmes.`);
          } else {
            this.data.gems += req.gems ?? 0;
            this.log(`Récompense refusée : ${req.title} (gemmes rendues)`);
            this.events.emit('toast', `${req.title} : pas pour cette fois, tes gemmes te sont rendues`);
          }
          return true;
        }
        if (p.approved) {
          const xp = req.kind === 'initiative' ? Number(p.xp) || 0 : req.xp;
          const gold = req.kind === 'initiative' ? Number(p.gold) || 0 : req.gold;
          req.status = 'approved';
          const text = this.reward(xp, gold, true);
          const m0 = req.missionId ? this.data.missions.find(x => x.id === req.missionId) : undefined;
          if (req.kind === 'initiative') { this.data.stats.initiatives++; this.data.stats.total++; this.progress(undefined); }
          else { this.count(m0, req.doneAt ?? Date.now()); this.progress(m0); }
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
      case 'warning': return false; // avertissements supprimés (ancienne version de l'appli parent)
      case 'remind': {
        // un parent rappelle une tâche : le dragon la redit (la notification est déjà affichée par le téléphone)
        const title = String(p.title ?? '').slice(0, 80);
        if (!title) return false;
        this.log(`Rappel de ${by} : ${title}`);
        this.events.emit('story', `${by} te rappelle : ${title}. On s’y met ensemble ?`);
        return true;
      }
      case 'rewards.set': {
        if (!Array.isArray(p.rewards)) return false;
        this.data.rewards = (p.rewards as Reward[]).filter(r => r && r.id && r.title).slice(0, 30);
        return true;
      }
      case 'rules': return false; // réglage des sanctions supprimé
      case 'treat': {
        this.companion?.onTreat(by);
        this.log(`Friandise envoyée par ${by}${p.message ? ` — « ${p.message} »` : ''}`);
        return true;
      }
      case 'widget.done': {
        // « J'ai fait » touché sur le widget (appli fermée) : quête de confiance du jour validée ici
        const m = this.data.missions.find(x => x.id === p.missionId);
        if (!m || m.validation !== 'trust' || (p.date && p.date !== todayKey())) return false;
        const st = this.status(m.id);
        if (st === 'done' || st === 'pending') return false;
        void this.complete(m.id);
        return false;
      }
      case 'status.request':
        this.queueStatus(0);
        return false;
      default:
        return this.onOther?.(msg) ?? false;
    }
  }

  /** Messages destinés à d'autres modules (rencontres entre dragons…). */
  onOther: ((msg: LinkMessage) => boolean) | null = null;

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
      badgeCount: Object.keys(this.data.badges).length, badgeTotal: this.badgeDefs.length,
      companion: this.companion?.summary(),
      severity: this.data.severity, missStreak: this.data.missStreak, sick: this.companion?.data.sick ?? false,
      confiscated: this.data.confiscated?.id ?? null,
      gems: this.data.gems, rewards: this.data.rewards, shields: this.data.shields,
      expedition: { title: journeyFor(this.data.expedition.week).title, steps: this.data.expedition.steps, goal: this.expeditionGoal(), opened: this.data.expedition.opened },
      week: this.weekStats()
    };
  }

  /** Bilan des 7 derniers jours (le plus ancien d'abord, aujourd'hui compris) : missions faites / prévues.
   *  Reconstitué à partir des dernières traces de chaque mission, des demandes de validation et des journées parfaites. */
  private weekStats(): Array<{ date: string; done: number; total: number }> {
    const perfect = new Set(this.data.streakDays);
    const reqs = Object.values(this.data.requests);
    const out: Array<{ date: string; done: number; total: number }> = [];
    const d = new Date(); d.setDate(d.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      const key = todayKey(d);
      const due = this.data.missions.filter(m => !m.once && !m.optional && appliesOn(m, d));
      let done = 0;
      for (const m of due) {
        const r = this.data.records[m.id];
        const ok = (r && r.date === key && (r.status === 'done' || r.status === 'pending'))
          || reqs.some(q => q.missionId === m.id && q.date === key && (q.status === 'approved' || q.status === 'pending'));
        if (ok) done++;
      }
      if (perfect.has(key) && due.length) done = due.length;
      out.push({ date: key, done, total: due.length });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  queueStatus(delay = 1500): void {
    clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => void this.link.send('parents', 'status', this.snapshot()), delay);
  }

  async refreshReminders(): Promise<void> {
    const c = this.companion;
    await this.reminders.reschedule(this.data.missions, (id, date) => this.status(id, date),
      c ? { name: c.name, line: (m, kind) => missionLine(m, kind) } : undefined, [...(c?.careNotifs() ?? []), ...this.eveningWarning(), ...this.weeklyRecap()]);
  }

  /** À 20 h 30, s'il reste des missions : le dragon les rappelle gentiment (refonte UX : pas de menace). */
  private eveningWarning(): Array<{ key: string; at: Date; body: string }> {
    const cost = this.pendingCost();
    if (!cost.count) return [];
    const at = new Date(); at.setHours(20, 30, 0, 0);
    return [{ key: 'evening-' + todayKey(), at,
      body: `Il te reste ${cost.count} quête${cost.count > 1 ? 's' : ''} ce soir. On les termine ensemble ? Je t’attends !` }];
  }
}

const DEFAULT_REWARDS: Reward[] = [
  { id: 'rw_film', title: 'Choisir le film du vendredi soir', cost: 15 },
  { id: 'rw_ecran', title: '30 minutes d’écran en plus', cost: 10 },
  { id: 'rw_repas', title: 'Choisir le repas du dimanche', cost: 20 },
  { id: 'rw_sortie', title: 'Une sortie au choix (cinéma, bowling…)', cost: 60 }
];


function order(s: MissionStatus): number {
  return s === 'todo' ? 0 : s === 'refused' ? 1 : s === 'pending' ? 2 : 3;
}

function yesterdayKey(): string { const d = new Date(); d.setDate(d.getDate() - 1); return todayKey(d); }
function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return y ? new Date(y, (m || 1) - 1, d || 1) : new Date();
}
