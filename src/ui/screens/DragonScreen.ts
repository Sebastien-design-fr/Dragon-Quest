import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon } from '../dom.js';

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
    clear(el);

    const action = (label: string, path: string, run: () => void, extra = '') =>
      h('button', { class: `action ${extra}`, onclick: run }, icon(path, 26), h('span', null, label));

    el.append(
      h('section', { class: 'card stage-card' },
        h('h2', null, stage.label),
        h('p', { class: 'muted' }, stage.tagline),
        next ? h('p', { class: 'small' }, `Prochaine évolution : ${next.label}, au niveau ${next.minLevel}.`) : h('p', { class: 'small' }, 'Stade ultime atteint.')),
      h('section', { class: 'actions' },
        action('Caresser', ICONS.heart, () => void app.act('happy')),
        action('Nourrir', ICONS.meat, () => void app.act('eat')),
        action(app.sleeping ? 'Réveiller' : 'Dormir', ICONS.moon, () => app.toggleSleep(), app.sleeping ? 'on' : ''),
        action('Attaquer', ICONS.claw, () => void app.act('attack')),
        action('Souffle', ICONS.flame, () => void app.act('fire'))),
      h('section', { class: 'card' },
        h('h3', null, 'Tests de progression'),
        h('p', { class: 'small muted' }, 'Ces boutons simulent les missions accomplies, pour tester niveaux et évolutions.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', onclick: () => app.state.addXp(50) }, '+50 XP'),
          h('button', { class: 'btn ghost', onclick: () => app.state.addXp(app.state.xpToNext() - app.state.data.xp) }, 'Niveau suivant'),
          h('button', { class: 'btn ghost', onclick: () => app.state.addGold(1000) }, '+1000 or')))
    );
  }
}
