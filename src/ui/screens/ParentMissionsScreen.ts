import { DAY_LABELS, newId, rewardText, type Mission, type Validation } from '../../family/model.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';
import { childPicker } from './ValidationsScreen.js';

type Draft = Mission;

const blank = (once = false): Draft => ({
  id: newId('m_'), title: '', xp: 15, gold: 8, validation: 'parent', days: once ? [] : [1, 2, 3, 4, 5], time: once ? null : '18:00', once
});

export class ParentMissionsScreen implements Screen {
  id = 'parent-missions'; label = 'Missions'; icon = ICONS.missions;
  private el: HTMLElement | null = null;
  private draft: Draft | null = null;
  private editing = false;
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; this.draft = null; }

  refresh(): void {
    const el = this.el; const hub = this.app.family.hub;
    if (!el || !hub) return;
    clear(el);
    const rerender = () => this.refresh();
    const picker = childPicker(this.app, rerender);
    if (picker) el.append(picker);

    const id = this.app.selectedChild;
    const c = id ? hub.child(id) : null;
    if (!c) { el.append(h('p', { class: 'muted' }, 'Reliez d’abord le téléphone de votre enfant (onglet Famille).')); return; }
    if (!c.snapshot) {
      el.append(h('section', { class: 'card' },
        h('p', null, `La liste des missions arrivera du téléphone de ${c.name} dès qu’il sera sur le Wi-Fi avec l’appli ouverte.`),
        h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => void hub.requestStatus() }, 'Demander une mise à jour'))));
      return;
    }

    if (this.draft) { el.append(this.form(id!, this.draft)); return; }

    el.append(h('div', { class: 'section-head' }, h('h2', null, `Missions de ${c.name}`)),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => { this.draft = blank(); this.editing = false; rerender(); } }, icon(ICONS.plus, 16), ' Mission'),
        h('button', { class: 'btn', onclick: () => { this.draft = { ...blank(true), xp: 40, gold: 25 }; this.editing = false; rerender(); } }, icon(ICONS.spark, 16), ' Quête spéciale')));

    const list = h('div', { class: 'list' });
    const missions = [...c.snapshot.missions].sort((a, b) => Number(!!b.once) - Number(!!a.once) || (a.time ?? '99').localeCompare(b.time ?? '99'));
    for (const m of missions) {
      list.append(h('div', { class: 'list-row' },
        h('div', { class: 'grow' },
          h('div', { class: 'item-name' }, m.title, m.once ? h('span', { class: 'quest-tag' }, 'Quête spéciale') : null),
          h('div', { class: 'small muted' }, [
            m.once ? 'une seule fois' : m.days.length === 7 ? 'tous les jours' : m.days.map(d => DAY_LABELS[d]).join(' '),
            m.time ? `rappel ${m.time}` : null,
            rewardText(m.xp, m.gold),
            m.validation === 'parent' ? 'validation parent' : 'confiance'
          ].filter(Boolean).join(' · '))),
        h('button', { class: 'icon-btn', 'aria-label': `Modifier ${m.title}`, onclick: () => { this.draft = JSON.parse(JSON.stringify(m)); this.editing = true; rerender(); } }, icon(ICONS.edit, 18)),
        h('button', { class: 'icon-btn', 'aria-label': `Supprimer ${m.title}`, onclick: async () => {
          if (!confirm(`Supprimer « ${m.title} » ?`)) return;
          await hub.removeMission(id!, m.id);
        } }, icon(ICONS.trash, 18))));
    }
    el.append(list,
      h('p', { class: 'small muted' }, 'Les modifications partent vers le téléphone de l’enfant par le Wi-Fi de la maison (ou dès son retour).'));
  }

  private form(childId: string, d: Draft): HTMLElement {
    const rerender = () => this.refresh();
    const input = (label: string, attrs: Record<string, unknown>, set: (v: string) => void) =>
      h('label', { class: 'field-col' }, h('span', { class: 'small' }, label), h('input', { ...attrs, oninput: (e: Event) => set((e.target as HTMLInputElement).value) }));

    const days = h('div', { class: 'day-picker' }, ...DAY_LABELS.map((lbl, i) => h('button', {
      class: d.days.includes(i) ? 'on' : '', type: 'button', 'aria-pressed': d.days.includes(i) ? 'true' : 'false',
      onclick: () => { d.days = d.days.includes(i) ? d.days.filter(x => x !== i) : [...d.days, i].sort(); rerender(); }
    }, lbl)));

    const valSel = h('div', { class: 'segmented two' }, ...(['parent', 'trust'] as Validation[]).map(v => h('button', {
      class: d.validation === v ? 'active' : '', type: 'button', onclick: () => { d.validation = v; rerender(); }
    }, v === 'parent' ? 'Validation parent' : 'Confiance')));

    return h('section', { class: 'card' },
      h('h3', null, this.editing ? 'Modifier la mission' : d.once ? 'Nouvelle quête spéciale' : 'Nouvelle mission'),
      input('Intitulé', { type: 'text', value: d.title, maxlength: '60', placeholder: d.once ? 'Aider à préparer le repas de dimanche' : 'Ranger sa chambre' }, v => { d.title = v; }),
      h('div', { class: 'grid-2' },
        input('XP', { type: 'number', min: '0', max: '500', value: String(d.xp), inputmode: 'numeric' }, v => { d.xp = Math.max(0, Number(v) || 0); }),
        input('Or', { type: 'number', min: '0', max: '500', value: String(d.gold), inputmode: 'numeric' }, v => { d.gold = Math.max(0, Number(v) || 0); })),
      h('span', { class: 'small' }, 'Qui valide ?'), valSel,
      h('p', { class: 'small muted' }, d.validation === 'parent' ? 'L’enfant coche, un parent valide : l’XP n’est crédité qu’après.' : 'L’XP est crédité dès que l’enfant coche.'),
      d.once ? null : h('span', { class: 'small' }, 'Jours'), d.once ? null : days,
      input('Heure du rappel (vide = pas de rappel)', { type: 'time', value: d.time ?? '' }, v => { d.time = v || null; }),
      h('div', { class: 'row end' },
        h('button', { class: 'btn', onclick: () => { this.draft = null; rerender(); } }, 'Annuler'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (d.title.trim().length < 2) { this.app.toast('Donnez un intitulé.'); return; }
          if (!d.once && !d.days.length) { this.app.toast('Choisissez au moins un jour.'); return; }
          d.title = d.title.trim();
          await this.app.family.hub!.upsertMission(childId, d);
          this.app.toast(d.once ? 'Quête envoyée' : 'Mission enregistrée');
          this.draft = null;
          rerender();
        } }, d.once && !this.editing ? 'Envoyer la quête' : 'Enregistrer')));
  }
}
