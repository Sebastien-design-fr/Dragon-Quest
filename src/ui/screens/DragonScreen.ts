import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon, put } from '../dom.js';

export class DragonScreen implements Screen {
  id = 'dragon'; label = 'Dragon'; icon = ICONS.dragon;
  private el: HTMLElement | null = null;
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; }

  refresh(): void {
    const el = this.el; if (!el) return;
    const { app } = this;
    const stage = app.state.stage;
    const next = app.state.nextStage();
    const book = app.family.book;
    const today = book?.today() ?? [];
    const left = today.filter(t => t.status === 'todo' || t.status === 'refused').length;
    clear(el);

    const action = (label: string, path: string, run: () => void, extra = '') =>
      h('button', { class: `action ${extra}`, onclick: run }, icon(path, 26), h('span', null, label));

    put(el,
      h('section', { class: 'card stage-card' },
        h('h2', null, stage.label),
        h('p', { class: 'muted' }, stage.tagline),
        next ? h('p', { class: 'small' }, `Prochaine évolution : ${next.label}, au niveau ${next.minLevel}.`) : h('p', { class: 'small' }, 'Stade ultime atteint.')),
      book ? h('button', { class: 'card mission-summary', onclick: () => app.show('missions') },
        icon(ICONS.missions, 26),
        h('div', { class: 'grow' },
          h('div', { class: 'item-name' }, left === 0 ? (today.length ? 'Tout est fait pour aujourd’hui !' : 'Aucune mission aujourd’hui') : `${left} mission${left > 1 ? 's' : ''} à faire aujourd’hui`),
          h('div', { class: 'small muted' }, book.streak() > 1 ? `Série en cours : ${book.streak()} jours` : 'Chaque mission fait grandir ton dragon')),
        h('span', { class: 'chev' }, '›')) : null,
      h('section', { class: 'actions' },
        action('Caresser', ICONS.heart, () => void app.act('happy')),
        action('Nourrir', ICONS.meat, () => void app.act('eat')),
        action(app.sleeping ? 'Réveiller' : 'Dormir', ICONS.moon, () => app.toggleSleep(), app.sleeping ? 'on' : ''),
        action('Attaquer', ICONS.claw, () => void app.act('attack')),
        action('Souffle', ICONS.flame, () => void app.act('fire')))
    );
  }
}
