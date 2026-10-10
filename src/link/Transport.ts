// Lien entre les téléphones de la famille.
// - NativeTransport : module Android « HomeLink » (Wi-Fi local, service en veille, notifications natives).
// - SimTransport    : simulation dans le navigateur (plusieurs onglets = plusieurs téléphones),
//                     pour développer et tester sans appareil : ?device=parent / ?device=enfant.
import type { CapacitorCore } from '../platform/capacitor.js';

export type Role = 'child' | 'parent';

export interface NotifSpec {
  title: string;
  body: string;
  tag: string;
  channel: 'validations' | 'missions';
  actions?: NotifAction[];
}
export interface NotifAction { id: string; label: string; doneText?: string; replies: Reply[] }
export interface Reply { to: string; type: string; payload: unknown; notif?: NotifSpec | null; dismiss?: string }

export interface LinkMessage {
  id: string; from: string; fromName: string; role: string; to: string; type: string; ts: number;
  payload: any; outgoing?: boolean;
}

export interface Member { id: string; name: string; role: Role; lastSeen?: number }

export interface LinkState {
  native: boolean;
  deviceId: string;
  deviceName: string;
  role: Role | '';
  paired: boolean;
  running: boolean;
  outbox: number;
  batteryExempt: boolean;
  members: Member[];
}

export interface Transport {
  readonly native: boolean;
  getState(): Promise<LinkState>;
  setName(name: string): Promise<void>;
  createFamily(name: string): Promise<void>;
  startPairing(role: Role): Promise<{ code: string; expiresAt: number }>;
  stopPairing(): Promise<void>;
  joinFamily(code: string, name: string): Promise<{ role: Role }>;
  send(to: string, type: string, payload: unknown, notif?: NotifSpec | null, dismiss?: string): Promise<void>;
  drainInbox(): Promise<LinkMessage[]>;
  dismiss(tag: string): Promise<void>;
  requestBatteryExemption(): Promise<void>;
  leaveFamily(): Promise<void>;
  onInbox(cb: () => void): void;
  /** Widget d'écran d'accueil (refonte UX) : résumé du dragon et des quêtes. */
  updateWidget(data: WidgetData): Promise<void>;
  /** Pas du jour comptés par le téléphone (capteur de pas). */
  getSteps(): Promise<StepsInfo>;
  requestStepsPermission(): Promise<void>;
  /** Action demandée depuis le widget (« missions », « pet », « validations »…), une seule fois. */
  takeLaunchAction(): Promise<string | null>;
  onLaunchAction(cb: (action: string) => void): void;
  /** Sortie en famille (Bluetooth hors de la maison). */
  nearbyState(): Promise<NearbyState>;
  setOuting(on: boolean): Promise<NearbyState>;
  requestNearbyPermission(): Promise<void>;
  /** Rencontres en sortie pas encore jouées (identifiants des téléphones croisés). */
  takeMeets(): Promise<Array<{ peer: string; at: number }>>;
  onNearby(cb: (peer: string) => void): void;
  /** Ordres à la voix : une écoute courte (reconnaissance vocale du téléphone). */
  listen(maxMs?: number): Promise<SpeechResult>;
  stopListening(): Promise<void>;
  onSpeech(cb: (e: SpeechEvent) => void): void;
  /** La voix du dragon : lit la phrase à voix haute ; la promesse se résout quand il a fini de parler. */
  speak(text: string, pitch: number, rate: number): Promise<void>;
  stopSpeaking(): Promise<void>;
}

/** Durée estimée d'une phrase lue (secours si la fin n'est pas signalée). */
const speechMs = (text: string, rate: number) => 900 + text.length * 70 / Math.max(0.5, rate);

export interface SpeechResult { matches: string[]; error?: 'permission' | 'unavailable' | 'nomatch' | 'network' | 'busy' | string }
export interface SpeechEvent { state: 'ready' | 'speaking' | 'level' | 'partial' | 'thinking'; text?: string; level?: number }

export interface NearbyState { permission: boolean; outing: boolean; until: number; running: boolean; connected: string[] }
const NO_NEARBY: NearbyState = { permission: false, outing: false, until: 0, running: false, connected: [] };

export interface StepsInfo { available: boolean; permission: boolean; today: number }

export interface WidgetData {
  name: string; sub: string; image: string; streak: number; status: string; statusDate: string;
  /** Montre : variante et stade (pour la bonne vignette du dragon). */
  variant: string; stage: string;
  /** Téléphone d'un parent : ligne affichée à la place des quêtes. */
  line?: string;
  days: Array<{ date: string; total: number; done: number; next: string }>;
  /** Illustrations selon l'humeur : endormi (la nuit, ou couché) et joyeux (journée parfaite). */
  sleepImage?: string; happyImage?: string;
  /** Le dragon dort jusqu'au lendemain matin (couché par son maître). */
  asleep?: boolean;
  /** Événement en cours (thème du widget). */
  event?: string;
  /** Quêtes du jour pour le grand widget (et le bouton « J'ai fait » des quêtes de confiance). */
  quests?: Array<{ id: string; title: string; time?: string; status: string; trust: boolean }>;
  /** Parent : avancement de l'enfant et demandes à valider. */
  child?: { name: string; done: number; total: number; pending: number; quests: Array<{ title: string; status: string }> };
}

// =====================================================================
// Android
// =====================================================================
interface HomeLinkPlugin {
  getState(): Promise<LinkState>;
  setName(o: { name: string }): Promise<void>;
  createFamily(o: { name: string }): Promise<unknown>;
  startPairing(o: { role: Role }): Promise<{ code: string; expiresAt: number }>;
  stopPairing(): Promise<void>;
  joinFamily(o: { code: string; name: string }): Promise<{ role: Role }>;
  send(o: { to: string; type: string; payload: unknown; notif?: unknown; dismiss?: string }): Promise<unknown>;
  drainInbox(): Promise<{ messages: Array<Record<string, any>> }>;
  dismiss(o: { tag: string }): Promise<void>;
  requestBatteryExemption(): Promise<void>;
  leaveFamily(): Promise<void>;
  addListener(event: 'inbox', cb: () => void): Promise<unknown>;
  addListener(event: 'launchAction', cb: (e: { action: string }) => void): Promise<unknown>;
  updateWidget(o: { data: WidgetData }): Promise<void>;
  getSteps(): Promise<StepsInfo>;
  requestStepsPermission(): Promise<void>;
  takeLaunchAction(): Promise<{ action?: string }>;
  nearbyState(): Promise<NearbyState>;
  setOuting(o: { on: boolean }): Promise<NearbyState>;
  requestNearbyPermission(): Promise<void>;
  takeMeets(): Promise<{ meets: Array<{ peer: string; at: number }> }>;
  addListener(event: 'nearby', cb: (e: { type: string; peer: string }) => void): Promise<unknown>;
  listen(o: { lang: string; maxMs: number }): Promise<{ matches?: string[]; error?: string }>;
  stopListening(): Promise<void>;
  addListener(event: 'speech', cb: (e: SpeechEvent) => void): Promise<unknown>;
  speak(o: { id: string; text: string; pitch: number; rate: number }): Promise<void>;
  stopSpeaking(): Promise<void>;
  addListener(event: 'voice', cb: (e: { id: string; ok: boolean }) => void): Promise<unknown>;
}

export class NativeTransport implements Transport {
  readonly native = true;
  private p: HomeLinkPlugin;
  constructor(core: CapacitorCore) { this.p = core.registerPlugin<HomeLinkPlugin>('HomeLink'); }

  getState() { return this.p.getState(); }
  setName(name: string) { return this.p.setName({ name }); }
  async createFamily(name: string) { await this.p.createFamily({ name }); }
  startPairing(role: Role) { return this.p.startPairing({ role }); }
  stopPairing() { return this.p.stopPairing(); }
  joinFamily(code: string, name: string) { return this.p.joinFamily({ code, name }); }
  async send(to: string, type: string, payload: unknown, notif?: NotifSpec | null, dismiss?: string) {
    await this.p.send({ to, type, payload: payload ?? {}, notif: notif ?? undefined, dismiss: dismiss ?? '' });
  }
  async drainInbox(): Promise<LinkMessage[]> {
    const { messages } = await this.p.drainInbox();
    return (messages || []).map(m => ({
      id: m.id, from: m.from, fromName: m.fromName, role: m.role, to: m.to, type: m.type, ts: m.ts,
      payload: parse(m.payload), outgoing: !!m.outgoing
    }));
  }
  dismiss(tag: string) { return this.p.dismiss({ tag }); }
  requestBatteryExemption() { return this.p.requestBatteryExemption(); }
  leaveFamily() { return this.p.leaveFamily(); }
  onInbox(cb: () => void) { void this.p.addListener('inbox', cb); }
  async updateWidget(data: WidgetData) { try { await this.p.updateWidget({ data }); } catch { /* ancienne version native */ } }
  async getSteps(): Promise<StepsInfo> { try { return await this.p.getSteps(); } catch { return { available: false, permission: false, today: 0 }; } }
  async requestStepsPermission() { try { await this.p.requestStepsPermission(); } catch { /* ancienne version native */ } }
  async takeLaunchAction() { try { return (await this.p.takeLaunchAction()).action || null; } catch { return null; } }
  onLaunchAction(cb: (action: string) => void) { void this.p.addListener('launchAction', e => { if (e?.action) cb(e.action); }).catch(() => undefined); }
  async nearbyState() { try { return await this.p.nearbyState(); } catch { return NO_NEARBY; } }
  async setOuting(on: boolean) { try { return await this.p.setOuting({ on }); } catch { return NO_NEARBY; } }
  async requestNearbyPermission() { try { await this.p.requestNearbyPermission(); } catch { /* ancienne version native */ } }
  async takeMeets() { try { return (await this.p.takeMeets()).meets || []; } catch { return []; } }
  onNearby(cb: (peer: string) => void) { void this.p.addListener('nearby', e => { if (e?.peer) cb(e.peer); }).catch(() => undefined); }
  async listen(maxMs = 6000): Promise<SpeechResult> {
    try { const r = await this.p.listen({ lang: 'fr-FR', maxMs }); return { matches: r.matches ?? [], error: r.error }; } catch { return { matches: [], error: 'unavailable' }; }
  }
  async stopListening() { try { await this.p.stopListening(); } catch { /* ancienne version native */ } }
  onSpeech(cb: (e: SpeechEvent) => void) { void this.p.addListener('speech', cb).catch(() => undefined); }
  private voiceWait = new Map<string, () => void>();
  private voiceHooked = false;
  speak(text: string, pitch: number, rate: number): Promise<void> {
    if (!this.voiceHooked) {
      this.voiceHooked = true;
      void this.p.addListener('voice', e => { const f = this.voiceWait.get(e?.id); if (f) { this.voiceWait.delete(e.id); f(); } }).catch(() => undefined);
    }
    const id = 'v' + Date.now() + Math.random().toString(36).slice(2, 6);
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.voiceWait.delete(id); resolve(); }, speechMs(text, rate) + 4000);
      this.voiceWait.set(id, () => { clearTimeout(timer); resolve(); });
      this.p.speak({ id, text, pitch, rate }).catch(() => { clearTimeout(timer); this.voiceWait.delete(id); resolve(); });
    });
  }
  async stopSpeaking() { try { await this.p.stopSpeaking(); } catch { /* */ } for (const f of this.voiceWait.values()) f(); this.voiceWait.clear(); }
}

function parse(v: unknown): any {
  if (typeof v !== 'string') return v ?? {};
  try { return JSON.parse(v); } catch { return {}; }
}

// =====================================================================
// Simulation navigateur
// =====================================================================
interface SimCfg { deviceId: string; deviceName: string; role: Role | ''; familyId: string }
export interface SimNotif { spec: NotifSpec; from: string; at: number }

const CHANNEL = 'quete-du-dragon-sim';

export class SimTransport implements Transport {
  readonly native = false;
  private bc: BroadcastChannel | null;
  private listeners: Array<() => void> = [];
  onNotifs: () => void = () => {};

  constructor(readonly device: string) {
    this.bc = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
    this.bc?.addEventListener('message', e => {
      const d = e.data as { to?: string; kind: string };
      if (d.to && d.to !== this.device) return;
      if (d.kind === 'inbox') this.listeners.forEach(l => l());
      if (d.kind === 'notifs') this.onNotifs();
      if (d.kind === 'nearby') this.nearbyCbs.forEach(cb => cb((d as { peer?: string }).peer ?? ''));
    });
  }

  private key(k: string, dev = this.device) { return `sim:${dev}:${k}`; }
  private read<T>(k: string, fallback: T): T {
    try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
  }
  private write(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignoré */ } }

  private cfg(): SimCfg { return this.read<SimCfg>(this.key('cfg'), { deviceId: this.device, deviceName: '', role: '', familyId: '' }); }
  private family(id: string): Record<string, Member> { return this.read(`sim:family:${id}`, {}); }

  async getState(): Promise<LinkState> {
    const c = this.cfg();
    const fam = c.familyId ? this.family(c.familyId) : {};
    return {
      native: false, deviceId: c.deviceId, deviceName: c.deviceName, role: c.role, paired: !!c.familyId,
      running: true, outbox: 0, batteryExempt: true,
      members: Object.values(fam).filter(m => m.id !== c.deviceId).map(m => ({ ...m, lastSeen: Date.now() }))
    };
  }

  async setName(name: string) { this.write(this.key('cfg'), { ...this.cfg(), deviceName: name }); }

  async createFamily(name: string) {
    const familyId = 'fam-' + Math.random().toString(36).slice(2, 8);
    this.write(this.key('cfg'), { deviceId: this.device, deviceName: name, role: 'parent', familyId });
    this.write(`sim:family:${familyId}`, { [this.device]: { id: this.device, name, role: 'parent' } });
  }

  async startPairing(role: Role) {
    const code = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
    const expiresAt = Date.now() + 10 * 60 * 1000;
    this.write('sim:pairing', { code, role, familyId: this.cfg().familyId, host: this.device, expiresAt });
    return { code, expiresAt };
  }

  async stopPairing() { localStorage.removeItem('sim:pairing'); }

  async joinFamily(code: string, name: string): Promise<{ role: Role }> {
    await new Promise(r => setTimeout(r, 400)); // simule la recherche sur le réseau
    const p = this.read<{ code: string; role: Role; familyId: string; host: string; expiresAt: number } | null>('sim:pairing', null);
    if (!p || Date.now() > p.expiresAt) throw new Error('Le téléphone parent n’est pas en attente d’appairage.');
    if (p.code !== code) throw new Error('Code incorrect.');
    localStorage.removeItem('sim:pairing');
    this.write(this.key('cfg'), { deviceId: this.device, deviceName: name, role: p.role, familyId: p.familyId });
    const fam = this.family(p.familyId);
    fam[this.device] = { id: this.device, name, role: p.role };
    this.write(`sim:family:${p.familyId}`, fam);
    const host = fam[p.host];
    this.deliver(p.host, this.makeMsg(p.host, 'family.joined', { id: this.device, name, role: p.role }, host?.name), null);
    return { role: p.role };
  }

  private makeMsg(to: string, type: string, payload: unknown, _toName?: string): LinkMessage {
    const c = this.cfg();
    return { id: Math.random().toString(36).slice(2), from: c.deviceId, fromName: c.deviceName, role: c.role, to, type, ts: Date.now(), payload: JSON.parse(JSON.stringify(payload ?? {})) };
  }

  private recipients(to: string): string[] {
    const c = this.cfg();
    const members = Object.values(this.family(c.familyId)).filter(m => m.id !== c.deviceId);
    if (to === 'parents') return members.filter(m => m.role === 'parent').map(m => m.id);
    if (to === 'children') return members.filter(m => m.role === 'child').map(m => m.id);
    if (to === 'family') return members.map(m => m.id);
    return [to];
  }

  private deliver(dev: string, msg: LinkMessage, notif: NotifSpec | null | undefined, dismiss?: string) {
    const inbox = this.read<LinkMessage[]>(this.key('inbox', dev), []);
    inbox.push(msg);
    this.write(this.key('inbox', dev), inbox);
    const notifs = this.read<SimNotif[]>(this.key('notifs', dev), []).filter(n => !dismiss || n.spec.tag !== dismiss);
    if (notif) notifs.push({ spec: notif, from: msg.from, at: Date.now() });
    this.write(this.key('notifs', dev), notifs);
    this.bc?.postMessage({ to: dev, kind: 'inbox' });
    this.bc?.postMessage({ to: dev, kind: 'notifs' });
  }

  async send(to: string, type: string, payload: unknown, notif?: NotifSpec | null, dismiss?: string) {
    for (const dev of this.recipients(to)) this.deliver(dev, this.makeMsg(dev, type, payload), notif, dismiss);
  }

  async drainInbox() {
    const inbox = this.read<LinkMessage[]>(this.key('inbox'), []);
    this.write(this.key('inbox'), []);
    return inbox;
  }

  async dismiss(tag: string) {
    this.write(this.key('notifs'), this.notifications().filter(n => n.spec.tag !== tag));
    this.onNotifs();
  }

  async requestBatteryExemption() { /* sans objet dans le navigateur */ }
  /** Navigateur : le résumé du widget est gardé pour les tests. */
  async updateWidget(data: WidgetData) { localStorage.setItem(`sim:${this.device}:widget`, JSON.stringify(data)); }
  /** Navigateur : pas simulés (sim:<appareil>:steps), autorisation (sim:<appareil>:stepsPerm, accordée par défaut). */
  async getSteps(): Promise<StepsInfo> {
    const perm = this.read<boolean>(this.key('stepsPerm'), true);
    return { available: true, permission: perm, today: perm ? this.read<number>(this.key('steps'), 0) : 0 };
  }
  async requestStepsPermission() { this.write(this.key('stepsPerm'), true); }
  /** Navigateur : la phrase « entendue » se règle dans sim:<appareil>:speech (sinon reconnaissance du navigateur si elle existe). */
  private speechCbs: Array<(e: SpeechEvent) => void> = [];
  async listen(maxMs = 6000): Promise<SpeechResult> {
    const said = this.read<string | null>(this.key('speech'), null);
    const emit = (e: SpeechEvent) => this.speechCbs.forEach(cb => cb(e));
    if (said !== null) {
      emit({ state: 'ready' });
      await new Promise(r => setTimeout(r, 500)); emit({ state: 'speaking' }); emit({ state: 'partial', text: said });
      await new Promise(r => setTimeout(r, 600)); emit({ state: 'thinking' });
      return said ? { matches: [said] } : { matches: [], error: 'nomatch' };
    }
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return { matches: [], error: 'unavailable' };
    return new Promise(resolve => {
      const rec = new Ctor(); rec.lang = 'fr-FR'; rec.interimResults = true; rec.maxAlternatives = 5;
      let done = false;
      const fin = (r: SpeechResult) => { if (!done) { done = true; resolve(r); } };
      rec.onstart = () => emit({ state: 'ready' });
      rec.onresult = (ev: any) => {
        const res = ev.results[ev.results.length - 1];
        if (!res.isFinal) { emit({ state: 'partial', text: res[0].transcript }); return; }
        fin({ matches: Array.from({ length: res.length }, (_, i) => res[i].transcript as string) });
      };
      rec.onerror = (ev: any) => fin({ matches: [], error: ev.error === 'not-allowed' ? 'permission' : 'nomatch' });
      rec.onend = () => fin({ matches: [], error: 'nomatch' });
      this.recognizer = rec;
      try { rec.start(); } catch { fin({ matches: [], error: 'unavailable' }); }
      setTimeout(() => { try { rec.stop(); } catch { /* */ } }, maxMs);
    });
  }
  private recognizer: any = null;
  async stopListening() { try { this.recognizer?.stop(); } catch { /* */ } }
  onSpeech(cb: (e: SpeechEvent) => void) { this.speechCbs.push(cb); }
  /** Navigateur : synthèse vocale du navigateur si elle existe (sim:<appareil>:spoken garde la dernière phrase pour les tests). */
  speak(text: string, pitch: number, rate: number): Promise<void> {
    localStorage.setItem(this.key('spoken'), JSON.stringify(text));
    const ss = window.speechSynthesis;
    if (!ss || this.read<boolean>(this.key('mute'), false)) return new Promise(r => setTimeout(r, Math.min(1500, speechMs(text, rate) / 4)));
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR'; u.pitch = pitch; u.rate = rate;
      const timer = setTimeout(resolve, speechMs(text, rate) + 3000);
      u.onend = () => { clearTimeout(timer); resolve(); };
      u.onerror = () => { clearTimeout(timer); resolve(); };
      ss.cancel(); ss.speak(u);
    });
  }
  async stopSpeaking() { try { window.speechSynthesis?.cancel(); } catch { /* */ } }
  private launchCbs: Array<(a: string) => void> = [];
  async takeLaunchAction() { const a = this.read<string | null>(this.key('launch'), null); localStorage.removeItem(this.key('launch')); return a; }
  onLaunchAction(cb: (action: string) => void) { this.launchCbs.push(cb); }
  // Sortie en famille simulée : deux onglets en sortie en même temps « se croisent ».
  private nearbyCbs: Array<(peer: string) => void> = [];
  async nearbyState(): Promise<NearbyState> {
    const until = this.read<number>(this.key('outing'), 0);
    return { permission: this.read<boolean>(this.key('nearbyPerm'), true), outing: until > Date.now(), until, running: until > Date.now(), connected: [] };
  }
  async setOuting(on: boolean) {
    this.write(this.key('outing'), on ? Date.now() + 3 * 3600000 : 0);
    if (on) {
      const c = this.cfg();
      for (const m of Object.values(this.family(c.familyId))) {
        if (m.id === c.deviceId || this.read<number>(this.key('outing', m.id), 0) < Date.now()) continue;
        for (const [a, b] of [[c.deviceId, m.id], [m.id, c.deviceId]]) {
          const list = this.read<Array<{ peer: string; at: number }>>(this.key('meets', a), []);
          list.push({ peer: b, at: Date.now() });
          this.write(this.key('meets', a), list);
          this.bc?.postMessage({ to: a, kind: 'nearby', peer: b });
        }
        this.nearbyCbs.forEach(cb => cb(m.id));
      }
    }
    return this.nearbyState();
  }
  async requestNearbyPermission() { this.write(this.key('nearbyPerm'), true); }
  async takeMeets() { const l = this.read<Array<{ peer: string; at: number }>>(this.key('meets'), []); this.write(this.key('meets'), []); return l; }
  onNearby(cb: (peer: string) => void) { this.nearbyCbs.push(cb); }

  /** Tests : simule un appui sur le widget. */
  launch(action: string) { this.launchCbs.forEach(c => c(action)); }

  async leaveFamily() {
    localStorage.removeItem(this.key('cfg'));
    localStorage.removeItem(this.key('inbox'));
    localStorage.removeItem(this.key('notifs'));
  }

  onInbox(cb: () => void) { this.listeners.push(cb); }

  // ----- Notifications simulées (bandeau dans la page) -----
  notifications(): SimNotif[] { return this.read<SimNotif[]>(this.key('notifs'), []); }

  /** Équivalent d'un appui sur un bouton de notification Android. */
  async act(tag: string, actionIndex: number) {
    const n = this.notifications().find(x => x.spec.tag === tag);
    const action = n?.spec.actions?.[actionIndex];
    if (!n || !action) return;
    for (const r of action.replies) {
      await this.send(r.to === 'sender' ? n.from : r.to, r.type, r.payload, r.notif, r.dismiss);
      const self = this.makeMsg(this.device, r.type, r.payload);
      self.outgoing = true;
      const inbox = this.read<LinkMessage[]>(this.key('inbox'), []);
      inbox.push(self);
      this.write(this.key('inbox'), inbox);
    }
    await this.dismiss(tag);
    this.listeners.forEach(l => l());
  }
}
