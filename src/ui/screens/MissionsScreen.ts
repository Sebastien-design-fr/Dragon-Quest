import { DAY_LABELS, rewardText, type MissionStatus } from '../../family/model.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';

const STATUS: Record<MissionStatus, string> = { todo: '', pending: 'En attente des parents', done: 'Validée', refused: 'À refaire' };

export class MissionsScreen implements Screen {
  id = 'missions'; label = 'Missions'; icon = ICONS.missions;
  private el: HTMLElement | null = null;
  private initiative = '';
  constructor(private app: App) {}

  /** Prend une photo (appareil photo du téléphone), la réduit et l'envoie avec la mission. */
  private async withPhoto(id: string): Promise<void> {
    const input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } }) as HTMLInputElement;
    document.body.append(input);
    const file = await new Promise<File | null>(res => { input.onchange = () => res(input.files?.[0] ?? null); input.click(); setTimeout(() => res(null), 120000); });
    input.remove();
    if (!file) return;
    const photo = await shrink(file);
    await this.app.family.book!.complete(id, photo ?? undefined);
  }

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

    if (book.streak() > 0 || book.data.shields) {
      el.append(h('div', { class: 'streak' }, icon(ICONS.flame, 20),
        h('span', null, `Série de ${book.streak()} jour${book.streak() > 1 ? 's' : ''}`),
        h('span', { class: 'muted small' }, book.data.shields ? ` · ${book.data.shields} bouclier${book.data.shields > 1 ? 's' : ''}` : ' · bouclier tous les 7 jours')));
    }
    const dbl = book.doubleId();

    const list = h('div', { class: 'list' });
    if (!today.length) list.append(h('p', { class: 'muted' }, 'Aucune mission aujourd’hui. Profites-en !'));
    const row = (m: typeof today[number]['mission'], status: MissionStatus) => {
      const done = status === 'done', pending = status === 'pending';
      const x2 = dbl === m.id;
      return h('div', { class: `list-row mission ${status}${x2 ? ' double' : ''}` },
        h('div', { class: `check ${status}` }, done ? icon(ICONS.check, 18) : pending ? icon(ICONS.clock, 18) : null),
        h('div', { class: 'grow' },
          h('div', { class: 'item-name' }, m.title, m.once ? h('span', { class: 'quest-tag' }, 'Quête spéciale') : null, x2 ? h('span', { class: 'quest-tag x2' }, '×2 aujourd’hui') : null),
          h('div', { class: 'small muted' },
            [m.time ? `Avant ${m.time.replace(':', ' h ')}` : null, x2 ? rewardText(m.xp * 2, m.gold * 2) : rewardText(m.xp, m.gold), m.optional ? '2 gemmes' : '1 gemme', m.validation === 'parent' ? 'validée par un parent' : null].filter(Boolean).join(' · ')),
          STATUS[status] ? h('div', { class: `status-line ${status}` }, STATUS[status]) : null),
        !done && !pending ? h('div', { class: 'done-btns' },
          h('button', { class: 'btn primary', onclick: () => void book.complete(m.id) }, 'C’est fait'),
          m.validation === 'parent' ? h('button', { class: 'btn ghost small-btn', onclick: () => void this.withPhoto(m.id) }, 'Avec photo') : null) : null);
    };
    for (const { mission: m, status } of today) list.append(row(m, status));
    el.append(list);

    // Quêtes bonus
    const bonus = book.bonusToday();
    if (bonus.length) {
      el.append(h('section', { class: 'card bonus-board' },
        h('h3', null, 'Tableau des quêtes bonus'),
        h('p', { class: 'small muted' }, 'Facultatives : tu choisis celles que tu veux. Elles rapportent plus, et 2 gemmes chacune.'),
        h('div', { class: 'list' }, ...bonus.map(b => row(b.mission, b.status)))));
    }

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

/** Réduit une photo (≈ 640 px, JPEG) pour l'envoyer par le Wi-Fi de la maison. */
async function shrink(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
    const k = Math.min(1, 640 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c.toDataURL('image/jpeg', 0.62);
  } catch { return null; }
}
