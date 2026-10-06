// Blocs « famille » partagés : membres reliés, ajout d'un téléphone, notifications et batterie.
import type { Role } from '../../link/Transport.js';
import type { App } from '../App.js';
import { ICONS, h, icon } from '../dom.js';

let pairing: { code: string; role: Role; expiresAt: number; members: number } | null = null;
let notifOk: boolean | null = null;

export function membersCard(app: App): HTMLElement {
  const st = app.family.linkState;
  const now = Date.now();
  const rows = st.members.map(m => {
    const recent = m.lastSeen && now - m.lastSeen < 15 * 60 * 1000;
    return h('div', { class: 'list-row' },
      h('div', { class: `dot ${recent ? 'on' : ''}` }),
      h('div', { class: 'grow' },
        h('div', { class: 'item-name' }, m.name || 'Sans nom'),
        h('div', { class: 'small muted' }, `${m.role === 'parent' ? 'Parent' : 'Enfant'} · ${m.lastSeen ? (recent ? 'vu à l’instant' : 'vu ' + since(m.lastSeen)) : 'jamais vu'}`)));
  });
  return h('section', { class: 'card' },
    h('h3', null, 'Téléphones de la famille'),
    h('p', { class: 'small muted' }, `Ce téléphone : ${st.deviceName || 'sans nom'} (${st.role === 'parent' ? 'parent' : 'enfant'})${st.outbox ? ` · ${st.outbox} message(s) en attente de livraison` : ''}`),
    ...(rows.length ? rows : [h('p', { class: 'muted' }, 'Aucun autre téléphone relié pour l’instant.')]),
    h('p', { class: 'small muted' }, 'Les échanges passent par le Wi-Fi de la maison. Hors de la maison, ils partent dès le retour.'));
}

export function pairingCard(app: App, rerender: () => void): HTMLElement {
  const st = app.family.linkState;
  if (pairing && (Date.now() > pairing.expiresAt || st.members.length > pairing.members)) {
    if (st.members.length > pairing.members) app.toast('Nouveau téléphone relié !');
    pairing = null;
  }
  const start = async (role: Role) => {
    try {
      const r = await app.family.link.startPairing(role);
      pairing = { code: r.code, role, expiresAt: r.expiresAt, members: st.members.length };
      rerender();
    } catch (e) { app.toast(String((e as Error).message ?? e)); }
  };
  if (pairing) {
    const p = pairing;
    return h('section', { class: 'card pairing' },
      h('h3', null, p.role === 'child' ? 'Relier le téléphone de l’enfant' : 'Relier un autre parent'),
      h('ol', { class: 'steps-list' },
        h('li', null, 'Installez l’appli sur l’autre téléphone (même lien de téléchargement).'),
        h('li', null, `Choisissez « ${p.role === 'child' ? 'Enfant' : 'Parent'} », puis « J’ai un code ».`),
        h('li', null, 'Saisissez ce code. Les deux téléphones doivent être sur le Wi-Fi de la maison, appli ouverte.')),
      h('div', { class: 'code' }, p.code.slice(0, 3) + ' ' + p.code.slice(3)),
      h('p', { class: 'small muted center' }, `Valable jusqu’à ${new Date(p.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`),
      h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: async () => { await app.family.link.stopPairing(); pairing = null; rerender(); } }, 'Annuler')));
  }
  return h('section', { class: 'card' },
    h('h3', null, 'Ajouter un téléphone'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => void start('child') }, icon(ICONS.plus, 16), ' Enfant'),
      h('button', { class: 'btn', onclick: () => void start('parent') }, icon(ICONS.plus, 16), ' Autre parent')));
}

export function deviceSetupCard(app: App, rerender: () => void): HTMLElement {
  const st = app.family.linkState;
  const reminders = app.family.reminders;
  if (notifOk === null) void reminders.permissionGranted().then(v => { notifOk = v; rerender(); });
  const item = (ok: boolean, title: string, text: string, btn: HTMLElement | null) =>
    h('div', { class: 'list-row' },
      h('div', { class: `check ${ok ? 'done' : 'todo'}` }, ok ? icon(ICONS.check, 18) : null),
      h('div', { class: 'grow' }, h('div', { class: 'item-name' }, title), h('div', { class: 'small muted' }, text)),
      ok ? null : btn);

  return h('section', { class: 'card' },
    h('h3', null, 'Réglages du téléphone'),
    item(notifOk !== false, 'Notifications', 'Indispensables pour les rappels et les validations.',
      h('button', { class: 'btn primary', onclick: async () => { notifOk = await reminders.requestPermission(); rerender(); } }, 'Autoriser')),
    item(st.batteryExempt, 'Toujours à l’écoute', 'Empêche le téléphone de couper l’appli pour économiser la batterie.',
      h('button', { class: 'btn primary', onclick: async () => {
        await app.family.link.requestBatteryExemption();
        setTimeout(() => void app.refreshLink(), 3000);
      } }, 'Régler')),
    st.native ? h('details', { class: 'small' },
      h('summary', null, 'Téléphone Samsung : un réglage de plus'),
      h('p', { class: 'muted' }, 'Paramètres › Batterie › Limites d’utilisation en arrière-plan › Applis jamais en veille › ajouter Quête du Dragon. Sans ça, Samsung peut couper l’écoute et les notifications n’arrivent plus.')) : null);
}

function since(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 60) return `il y a ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 48) return `il y a ${hrs} h`;
  return `il y a ${Math.round(hrs / 24)} j`;
}
