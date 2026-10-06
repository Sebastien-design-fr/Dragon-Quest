import { DAY_LABELS, rewardText, type MissionStatus } from '../../family/model.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';

const STATUS: Record<MissionStatus, string> = { todo: '', pending: 'En attente des parents', done: 'Validée', refused: 'À refaire' };

export class MissionsScreen implements Screen {
  id = 'missions'; label = 'Missions'; icon = ICONS.missions;
  private el: HTMLElement | null = null;
  private initiative = '';
  constructor(private app: App) {}

  badge(): number {
    return this.app.family.book?.today().filter(t => t.status === 'todo' || t.status === 'refused').length ?? 0;
  }

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; }

  refresh(): void {
    const el = this.el; const book = this.app.family.book;
    if (!el || !book) return;
    clear(el);
    const today = book.today();
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    el.append(h('div', { class: 'section-head' },
      h('h2', null, 'Missions du jour'),
      h('span', { class: 'muted small' }, date)));

    if (book.streak() > 0) {
      el.append(h('div', { class: 'streak' }, icon(ICONS.flame, 20),
        h('span', null, `Série de ${book.streak()} jour${book.streak() > 1 ? 's' : ''}`),
        h('span', { class: 'muted small' }, ' · bonus tous les 7 jours')));
    }

    const list = h('div', { class: 'list' });
    if (!today.length) list.append(h('p', { class: 'muted' }, 'Aucune mission aujourd’hui. Profites-en !'));
    for (const { mission: m, status } of today) {
      const done = status === 'done', pending = status === 'pending';
      list.append(h('div', { class: `list-row mission ${status}` },
        h('div', { class: `check ${status}` }, done ? icon(ICONS.check, 18) : pending ? icon(ICONS.clock, 18) : null),
        h('div', { class: 'grow' },
          h('div', { class: 'item-name' }, m.title, m.once ? h('span', { class: 'quest-tag' }, 'Quête spéciale') : null),
          h('div', { class: 'small muted' },
            [m.time ? `Avant ${m.time.replace(':', ' h ')}` : null, rewardText(m.xp, m.gold), m.validation === 'parent' ? 'validée par un parent' : null].filter(Boolean).join(' · ')),
          STATUS[status] ? h('div', { class: `status-line ${status}` }, STATUS[status]) : null),
        !done && !pending ? h('button', { class: 'btn primary', onclick: () => void book.complete(m.id) }, 'C’est fait') : null));
    }
    el.append(list);

    // Initiative
    const input = h('input', { type: 'text', maxlength: '80', placeholder: 'Ex. : j’ai vidé le lave-vaisselle', value: this.initiative,
      oninput: (e: Event) => { this.initiative = (e.target as HTMLInputElement).value; } }) as HTMLInputElement;
    el.append(h('section', { class: 'card' },
      h('h3', null, 'J’ai pris une initiative'),
      h('p', { class: 'small muted' }, 'Tu as fait quelque chose sans qu’on te le demande ? Dis-le à tes parents, ils peuvent t’accorder un bonus.'),
      h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Ce que tu as fait'), input),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: async () => {
        if (this.initiative.trim().length < 3) { this.app.toast('Décris ce que tu as fait.'); return; }
        await book.declareInitiative(this.initiative);
        this.initiative = '';
        this.refresh();
      } }, 'Envoyer'))));

    // Semaine
    const week = book.data.missions.filter(m => !m.once);
    if (week.length) {
      el.append(h('section', { class: 'card' },
        h('h3', null, 'Ma semaine'),
        ...week.map(m => h('div', { class: 'week-row' },
          h('span', { class: 'grow' }, m.title),
          h('span', { class: 'days' }, ...DAY_LABELS.map((d, i) => h('span', { class: m.days.includes(i) ? 'on' : '' }, d[0])))))));
    }

    if (book.data.history.length) {
      el.append(h('section', { class: 'card' },
        h('h3', null, 'Dernières nouvelles'),
        ...book.data.history.slice(0, 8).map(e => h('div', { class: 'log-row' },
          h('span', { class: 'muted small' }, new Date(e.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })),
          h('span', null, e.text)))));
    }
  }
}
