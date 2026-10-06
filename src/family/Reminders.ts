// Rappels programmés sur le téléphone de l'enfant (générés localement : aucun réseau nécessaire).
// Pour chaque mission avec une heure : un rappel à l'heure prévue, puis une relance 1 h plus tard
// si elle n'est toujours pas faite. Les 7 prochains jours sont programmés à chaque ouverture de l'appli.
import type { CapacitorCore } from '../platform/capacitor.js';
import { appliesOn, todayKey, type Mission, type MissionStatus } from './model.js';

interface LocalNotificationsPlugin {
  requestPermissions(): Promise<{ display: string }>;
  checkPermissions(): Promise<{ display: string }>;
  createChannel(c: { id: string; name: string; description?: string; importance?: number; vibration?: boolean }): Promise<void>;
  schedule(o: { notifications: Array<Record<string, unknown>> }): Promise<unknown>;
  getPending(): Promise<{ notifications: Array<{ id: number }> }>;
  cancel(o: { notifications: Array<{ id: number }> }): Promise<void>;
}

const CHANNEL = 'qd_reminders';

/** Voix du dragon : les rappels sont écrits par lui. */
export interface DragonVoice { name: string; line: (m: Mission, kind: 'now' | 'late') => string }
/** Notification de soin prévue (faim, il s'ennuie…). */
export interface CareNotif { key: string; at: Date; body: string }
const DAYS_AHEAD = 7;
const FOLLOW_UP_MIN = 60;

export class Reminders {
  private ln: LocalNotificationsPlugin | null;
  private ready = false;

  constructor(core: CapacitorCore | null) {
    this.ln = core ? core.registerPlugin<LocalNotificationsPlugin>('LocalNotifications') : null;
  }

  get available(): boolean { return !!this.ln; }

  async requestPermission(): Promise<boolean> {
    if (!this.ln) return false;
    try {
      const r = await this.ln.requestPermissions();
      return r.display === 'granted';
    } catch { return false; }
  }

  async permissionGranted(): Promise<boolean> {
    if (!this.ln) return true;
    try { return (await this.ln.checkPermissions()).display === 'granted'; } catch { return false; }
  }

  private async init(): Promise<void> {
    if (this.ready || !this.ln) return;
    try {
      await this.ln.createChannel({ id: CHANNEL, name: 'Rappels de missions', description: 'Rappels à l’heure des missions', importance: 4, vibration: true });
    } catch { /* déjà créé */ }
    this.ready = true;
  }

  /** statusFor(missionId, dateKey) : statut de la mission ce jour-là. */
  async reschedule(missions: Mission[], statusFor: (id: string, date: string) => MissionStatus, voice?: DragonVoice, care: CareNotif[] = []): Promise<void> {
    if (!this.ln) return;
    await this.init();
    try {
      const pending = await this.ln.getPending();
      if (pending.notifications.length) await this.ln.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });

      const now = Date.now();
      const list: Array<Record<string, unknown>> = [];
      for (let d = 0; d < DAYS_AHEAD; d++) {
        const day = new Date(); day.setDate(day.getDate() + d);
        const key = todayKey(day);
        for (const m of missions) {
          if (!m.time || !appliesOn(m, day) || (m.once && d > 0)) continue;
          const st = statusFor(m.id, key);
          if (st === 'done' || st === 'pending') continue;
          const [hh, mm] = m.time.split(':').map(Number);
          const at = new Date(day); at.setHours(hh, mm, 0, 0);
          const follow = new Date(at.getTime() + FOLLOW_UP_MIN * 60000);
          if (voice) {
            if (at.getTime() > now) list.push(this.notif(m, key, 0, at, `${voice.name} : ${m.title}`, voice.line(m, 'now')));
            if (follow.getTime() > now) list.push(this.notif(m, key, 1, follow, `${voice.name} s’inquiète…`, voice.line(m, 'late')));
          } else {
            if (at.getTime() > now) list.push(this.notif(m, key, 0, at, `C’est l’heure : ${m.title}`, 'Ton dragon compte sur toi.'));
            if (follow.getTime() > now) list.push(this.notif(m, key, 1, follow, `Toujours pas fait : ${m.title}`, 'Ton dragon commence à s’ennuyer…'));
          }
        }
      }
      for (const c of care) {
        if (c.at.getTime() <= now) continue;
        list.unshift({ id: hash('care|' + c.key), title: voice?.name ?? 'Ton dragon', body: c.body, channelId: CHANNEL, schedule: { at: c.at, allowWhileIdle: true }, extra: { care: c.key } });
      }
      if (list.length) await this.ln.schedule({ notifications: list.slice(0, 60) });
    } catch (e) {
      console.warn('Rappels non programmés', e);
    }
  }

  private notif(m: Mission, date: string, slot: number, at: Date, title: string, body: string): Record<string, unknown> {
    return {
      id: hash(`${m.id}|${date}|${slot}`),
      title, body,
      channelId: CHANNEL,
      schedule: { at, allowWhileIdle: true },
      extra: { missionId: m.id }
    };
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) % 2000000000 + 1;
}
