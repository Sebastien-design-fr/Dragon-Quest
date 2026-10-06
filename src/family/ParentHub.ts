// Côté parent : demandes de validation reçues, état des enfants, gestion des missions et bonus.
import { EventBus } from '../core/events.js';
import type { LinkMessage, Member, Transport } from '../link/Transport.js';
import { readStore, writeStore } from '../platform/storage.js';
import { newId, rewardText, type ChildSnapshot, type Mission, type RequestInfo } from './model.js';

interface Pending extends RequestInfo { childId: string; receivedAt: number }
interface HubData {
  children: Record<string, { name: string; snapshot: ChildSnapshot | null; updatedAt: number }>;
  pending: Record<string, Pending>;
  log: Array<{ at: number; text: string }>;
}

const KEY = 'quete-du-dragon:hub';

export class ParentHub {
  readonly events = new EventBus<{ change: void; toast: string }>();
  data: HubData;

  constructor(private link: Transport) {
    this.data = readStore<HubData>(KEY, { children: {}, pending: {}, log: [] });
  }

  private save(): void { writeStore(KEY, this.data); this.events.emit('change', undefined); }
  private log(text: string): void { this.data.log.unshift({ at: Date.now(), text }); this.data.log = this.data.log.slice(0, 60); }

  /** Les membres « enfant » connus du lien apparaissent même avant leur premier état. */
  syncMembers(members: Member[]): void {
    let changed = false;
    for (const m of members) {
      if (m.role !== 'child') continue;
      const c = this.data.children[m.id];
      if (!c) { this.data.children[m.id] = { name: m.name, snapshot: null, updatedAt: 0 }; changed = true; }
      else if (m.name && c.name !== m.name) { c.name = m.name; changed = true; }
    }
    if (changed) this.save();
  }

  childIds(): string[] { return Object.keys(this.data.children); }
  child(id: string) { return this.data.children[id]; }
  pendingList(): Pending[] { return Object.values(this.data.pending).sort((a, b) => a.receivedAt - b.receivedAt); }

  async sync(): Promise<void> {
    const msgs = await this.link.drainInbox();
    let changed = false;
    for (const m of msgs) changed = this.handle(m) || changed;
    if (changed) this.save();
  }

  private handle(msg: LinkMessage): boolean {
    const p = msg.payload ?? {};
    switch (msg.type) {
      case 'validation.request': {
        if (msg.outgoing) return false;
        this.data.pending[p.requestId] = { ...(p as RequestInfo), childId: msg.from, childName: msg.fromName, receivedAt: Date.now() };
        if (!this.data.children[msg.from]) this.data.children[msg.from] = { name: msg.fromName, snapshot: null, updatedAt: 0 };
        this.events.emit('toast', `${msg.fromName} : ${p.title}`);
        return true;
      }
      case 'validation.response':
      case 'validation.closed': {
        const req = this.data.pending[p.requestId];
        if (!req) return false;
        delete this.data.pending[p.requestId];
        const who = msg.outgoing ? 'Vous' : msg.fromName;
        this.log(`${who} : ${req.title} ${p.approved ? 'validé' : 'refusé'}`);
        return true;
      }
      case 'status': {
        this.data.children[msg.from] = { name: p.name || msg.fromName, snapshot: p as ChildSnapshot, updatedAt: Date.now() };
        return true;
      }
      case 'badge': {
        if (msg.outgoing) return false;
        this.log(`${msg.fromName} a débloqué « ${p.title} »`);
        return true;
      }
      case 'family.joined': {
        this.log(`${p.name} a rejoint la famille (${p.role === 'parent' ? 'parent' : 'enfant'})`);
        if (p.role === 'child') this.data.children[p.id] = { name: p.name, snapshot: null, updatedAt: 0 };
        return true;
      }
      default:
        return false;
    }
  }

  // ---------- Décisions ----------
  async decide(requestId: string, approved: boolean, bonus?: number): Promise<void> {
    const req = this.data.pending[requestId];
    if (!req) return;
    const xp = req.kind === 'initiative' ? bonus ?? 0 : req.xp;
    const gold = req.kind === 'initiative' ? bonus ?? 0 : req.gold;
    const payload = { requestId, approved, xp, gold };
    const notif = approved
      ? { title: req.kind === 'initiative' ? 'Initiative récompensée !' : 'Mission validée !', body: `${req.title} : ${rewardText(xp, gold)}`, tag: 'res-' + requestId, channel: 'missions' as const }
      : { title: req.kind === 'initiative' ? 'Initiative non retenue' : 'Mission à refaire', body: req.kind === 'initiative' ? req.title : `${req.title} : tes parents te demandent de la reprendre.`, tag: 'res-' + requestId, channel: 'missions' as const };
    await this.link.send(req.childId, 'validation.response', payload, notif);
    await this.link.send('parents', 'validation.closed', payload, null, 'req-' + requestId);
    await this.link.dismiss('req-' + requestId);
    delete this.data.pending[requestId];
    this.log(`Vous : ${req.title} ${approved ? 'validé' : 'refusé'}`);
    this.save();
  }

  async gift(childId: string, xp: number, gold: number, message: string): Promise<void> {
    await this.link.send(childId, 'gift', { xp, gold, message }, {
      title: 'Coup de cœur !', body: `${rewardText(xp, gold)}${message ? ` — « ${message} »` : ''}`, tag: newId('gift-'), channel: 'missions'
    });
    this.log(`Coup de cœur envoyé à ${this.child(childId)?.name ?? 'l’enfant'} : ${rewardText(xp, gold)}`);
    this.save();
  }

  /** Avertissement : retire de l'or à l'enfant (50 au maximum) et un peu d'énergie au dragon. */
  /** Friandise pour le dragon (elle la donne elle-même à son dragon). */
  async treat(childId: string, message: string): Promise<void> {
    await this.link.send(childId, 'treat', { message }, {
      title: 'Une friandise pour ton dragon !', body: message ? `« ${message} »` : 'Va la lui donner, il va adorer.', tag: newId('treat-'), channel: 'missions'
    });
    this.events.emit('toast', 'Friandise envoyée');
  }

  async warn(childId: string, gold: number, reason: string): Promise<void> {
    const g = Math.min(50, Math.max(0, Math.round(gold)));
    await this.link.send(childId, 'warning', { gold: g, reason }, {
      title: 'Avertissement', body: `−${g} or${reason ? ` — « ${reason} »` : ''}. Ton dragon perd aussi un peu d’énergie.`, tag: newId('warn-'), channel: 'missions'
    });
    this.log(`Avertissement à ${this.child(childId)?.name ?? 'l’enfant'} : −${g} or (${reason})`);
    this.save();
  }

  async upsertMission(childId: string, m: Mission): Promise<void> {
    const notif = m.once ? { title: 'Nouvelle quête !', body: `${m.title} · ${rewardText(m.xp, m.gold)}`, tag: 'quest-' + m.id, channel: 'missions' as const } : null;
    await this.link.send(childId, 'mission.upsert', { mission: m }, notif);
    // Mise à jour locale immédiate (l'état confirmé arrivera avec le prochain envoi de l'enfant).
    const snap = this.child(childId)?.snapshot;
    if (snap) {
      const i = snap.missions.findIndex(x => x.id === m.id);
      if (i >= 0) snap.missions[i] = m; else snap.missions.push(m);
    }
    this.save();
  }

  async removeMission(childId: string, id: string): Promise<void> {
    await this.link.send(childId, 'mission.remove', { id });
    const snap = this.child(childId)?.snapshot;
    if (snap) snap.missions = snap.missions.filter(x => x.id !== id);
    this.save();
  }

  async requestStatus(): Promise<void> { await this.link.send('children', 'status.request', {}); }
}
