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
}

export interface WidgetData {
  name: string; sub: string; image: string; streak: number; status: string; statusDate: string;
  /** Téléphone d'un parent : ligne affichée à la place des quêtes. */
  line?: string;
  days: Array<{ date: string; total: number; done: number; next: string }>;
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
  updateWidget(o: { data: WidgetData }): Promise<void>;
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
