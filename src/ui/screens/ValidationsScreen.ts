import { energyLabel } from '../../family/badges.js';
import { rewardText, type MissionStatus } from '../../family/model.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';

/** Sélecteur d'enfant (affiché seulement s'il y en a plusieurs). */
export function childPicker(app: App, rerender: () => void): HTMLElement | null {
  const hub = app.family.hub!;
  const ids = hub.childIds();
  if (!app.selectedChild && ids.length) app.selectedChild = ids[0];
  if (ids.length < 2) return null;
  return h('div', { class: 'chips' }, ...ids.map(id => h('button', {
    class: `chip${app.selectedChild === id ? ' active' : ''}`,
    onclick: () => { app.selectedChild = id; app.showChildDragon(); app.renderHud(); rerender(); }
  }, hub.child(id)?.name || 'Enfant')));
}

const STATUS_LABEL: Record<MissionStatus, string> = { todo: 'À faire', pending: 'À valider', done: 'Faite', refused: 'À refaire' };

export class ValidationsScreen implements Screen {
  id = 'validations'; label = 'Validations'; icon = ICONS.shield;
  private el: HTMLElement | null = null;
  private giftAmount = 25;
  private giftMessage = '';
  private warnAmount = 25;
  private warnReason = '';
  constructor(private app: App) {}

  badge(): number { return this.app.family.hub?.pendingList().length ?? 0; }

  mount(el: HTMLElement): void {
    this.el = el; this.refresh();
    void this.app.refreshLink();
    void this.app.family.hub?.requestStatus();
  }
  unmount(): void { this.el = null; }

  refresh(): void {
    const el = this.el; const hub = this.app.family.hub;
    if (!el || !hub) return;
    const app = this.app;
    clear(el);
    const rerender = () => this.refresh();

    if (!hub.childIds().length) {
      el.append(h('section', { class: 'card' },
        h('h2', null, 'Bienvenue'),
        h('p', null, 'Reliez maintenant le téléphone de votre enfant : onglet Famille, « Ajouter un téléphone », Enfant.'),
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => app.show('family') }, 'Aller à Famille'))));
      return;
    }

    const picker = childPicker(app, rerender);
    if (picker) el.append(picker);

    // ---- Demandes en attente ----
    const pending = hub.pendingList();
    el.append(h('div', { class: 'section-head' }, h('h2', null, 'À valider'), pending.length ? h('span', { class: 'count' }, String(pending.length)) : null));
    if (!pending.length) el.append(h('p', { class: 'muted' }, 'Rien à valider pour le moment.'));
    for (const r of pending) {
      const isInit = r.kind === 'initiative';
      el.append(h('section', { class: 'card request' },
        h('div', { class: 'row' },
          h('span', { class: 'badge' }, isInit ? 'Initiative' : 'Mission'),
          h('span', { class: 'small muted' }, `${r.childName ?? ''} · ${new Date(r.receivedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`)),
        h('div', { class: 'item-name big' }, r.title),
        isInit ? h('p', { class: 'small muted' }, 'Choisissez le bonus à accorder (XP et or).') : h('p', { class: 'small muted' }, rewardText(r.xp, r.gold)),
        isInit
          ? h('div', { class: 'row' },
              ...[10, 25, 50].map(n => h('button', { class: 'btn primary', onclick: () => void hub.decide(r.requestId, true, n) }, `+${n}`)),
              h('button', { class: 'btn', onclick: () => void hub.decide(r.requestId, false) }, 'Refuser'))
          : h('div', { class: 'row end' },
              h('button', { class: 'btn', onclick: () => void hub.decide(r.requestId, false) }, 'À refaire'),
              h('button', { class: 'btn primary', onclick: () => void hub.decide(r.requestId, true) }, 'Valider'))));
    }

    // ---- Journée de l'enfant ----
    const id = app.selectedChild;
    const c = id ? hub.child(id) : null;
    const snap = c?.snapshot;
    if (c) {
      const card = h('section', { class: 'card' }, h('h3', null, `La journée de ${c.name}`));
      if (!snap) card.append(h('p', { class: 'small muted' }, 'Pas encore de nouvelles de son téléphone. Elles arrivent dès qu’il est sur le Wi-Fi, appli ouverte.'));
      else {
        const today = snap.missions.filter(m => snap.today[m.id]);
        if (!today.length) card.append(h('p', { class: 'small muted' }, 'Aucune mission aujourd’hui.'));
        for (const m of today) {
          const st = snap.today[m.id];
          card.append(h('div', { class: 'week-row' }, h('span', { class: 'grow' }, m.title), h('span', { class: `pill ${st}` }, STATUS_LABEL[st])));
        }
        if (snap.energy !== undefined) {
          const en = energyLabel(snap.energy);
          card.append(h('div', { class: `energy-line ${en.level}` },
            h('span', null, `Énergie du dragon : ${snap.energy} % · ${en.label}`),
            h('div', { class: 'bar energy-bar' }, h('div', { class: 'fill', style: { width: `${snap.energy}%` } }))));
        }
        card.append(h('p', { class: 'small muted' }, [
          `Série : ${snap.streak} jour${snap.streak > 1 ? 's' : ''}`,
          snap.badgeTotal ? `succès : ${snap.badgeCount}/${snap.badgeTotal}` : null,
          snap.title ? `titre : ${snap.title}` : null,
          `état reçu ${new Date(c.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        ].filter(Boolean).join(' · ')));
      }
      el.append(card);

      // ---- Coup de cœur ----
      const msg = h('input', { type: 'text', maxlength: '60', placeholder: 'Bravo pour ta note de maths !', value: this.giftMessage,
        oninput: (e: Event) => { this.giftMessage = (e.target as HTMLInputElement).value; } });
      el.append(h('section', { class: 'card' },
        h('h3', null, h('span', { class: 'row' }, icon(ICONS.gift, 18), ' Coup de cœur')),
        h('p', { class: 'small muted' }, `Un bonus pour une attitude, une bonne note, un service rendu… ${c.name} le reçoit en notification.`),
        h('div', { class: 'segmented four' }, ...[10, 25, 50, 100].map(n =>
          h('button', { class: this.giftAmount === n ? 'active' : '', onclick: () => { this.giftAmount = n; rerender(); } }, `+${n}`))),
        h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Message (facultatif)'), msg),
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: async () => {
          await hub.gift(id!, this.giftAmount, this.giftAmount, this.giftMessage.trim());
          this.giftMessage = '';
          app.toast('Coup de cœur envoyé');
        } }, 'Envoyer'))));
    }

    // ---- Avertissement (malus) ----
    if (c && id) {
      const reason = h('input', { type: 'text', maxlength: '80', placeholder: 'Chambre pas rangée malgré 3 rappels', value: this.warnReason,
        oninput: (e: Event) => { this.warnReason = (e.target as HTMLInputElement).value; } });
      el.append(h('section', { class: 'card warn-card' },
        h('h3', null, 'Avertissement'),
        h('p', { class: 'small muted' }, `Retire de l’or à ${c.name} et un peu d’énergie à son dragon. Jamais de niveau ni d’objet. Le motif lui est affiché.`),
        h('div', { class: 'segmented' }, ...[10, 25, 50].map(n =>
          h('button', { class: this.warnAmount === n ? 'active' : '', onclick: () => { this.warnAmount = n; rerender(); } }, `−${n} or`))),
        h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Motif (obligatoire)'), reason),
        h('div', { class: 'row end' }, h('button', { class: 'btn danger', onclick: async () => {
          if (this.warnReason.trim().length < 3) { app.toast('Indiquez le motif.'); return; }
          if (!confirm(`Envoyer un avertissement à ${c.name} (−${this.warnAmount} or) ?`)) return;
          await hub.warn(id, this.warnAmount, this.warnReason.trim());
          this.warnReason = '';
          app.toast('Avertissement envoyé');
        } }, 'Envoyer l’avertissement'))));
    }

    if (hub.data.log.length) {
      el.append(h('section', { class: 'card' },
        h('h3', null, 'Activité'),
        ...hub.data.log.slice(0, 10).map(e => h('div', { class: 'log-row' },
          h('span', { class: 'muted small' }, new Date(e.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })),
          h('span', null, e.text)))));
    }
  }
}
