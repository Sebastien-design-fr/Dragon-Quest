import { TIER_LABEL, badgeProgress, energyLabel } from '../../family/badges.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon, put } from '../dom.js';

export class DragonScreen implements Screen {
  id = 'dragon'; label = 'Dragon'; icon = ICONS.dragon;
  private el: HTMLElement | null = null;
  private showAllBadges = false;
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
    const energy = book?.data.energy ?? 100;
    const en = energyLabel(energy);
    const tired = energy < 25;
    clear(el);

    const action = (label: string, path: string, run: () => void, extra = '') =>
      h('button', { class: `action ${extra}`, onclick: run }, icon(path, 26), h('span', null, label));
    const levelsLeft = next ? next.minLevel - app.state.data.level : 0;

    put(el,
      h('section', { class: 'card stage-card' },
        h('div', { class: 'row' }, h('h2', { class: 'grow' }, stage.label), book?.titleText() ? h('span', { class: 'badge title-badge' }, book.titleText()) : null),
        h('p', { class: 'muted' }, stage.tagline),
        next ? h('p', { class: 'small' }, `Prochaine évolution : ${next.label}, au niveau ${next.minLevel} (encore ${levelsLeft} niveau${levelsLeft > 1 ? 'x' : ''}).`) : h('p', { class: 'small' }, 'Stade ultime atteint.')),
      book ? h('section', { class: `card energy ${en.level}` },
        h('div', { class: 'row' },
          icon(ICONS.flame, 20),
          h('strong', { class: 'grow' }, `Énergie : ${en.label}`),
          h('span', { class: 'small muted' }, `${energy} %`)),
        h('div', { class: 'bar energy-bar' }, h('div', { class: 'fill', style: { width: `${energy}%` } })),
        h('p', { class: 'small muted' }, energy >= 50
          ? 'Chaque mission redonne de l’énergie. Les missions oubliées en font perdre chaque soir.'
          : `${en.detail}. Fais tes missions pour lui redonner des forces !`)) : null,
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
        action('Attaquer', ICONS.claw, () => tired ? app.toast('Ton dragon est trop fatigué pour attaquer.') : void app.act('attack')),
        action('Souffle', ICONS.flame, () => tired ? app.toast('Trop fatigué pour cracher du feu…') : void app.act('fire'))),
      book ? this.badgesCard() : null
    );
  }

  private badgesCard(): HTMLElement {
    const { app } = this;
    const book = app.family.book!;
    const defs = book.badgeDefs;
    const unlocked = defs.filter(b => book.data.badges[b.id]);
    const locked = defs.filter(b => !book.data.badges[b.id]).map(b => ({ b, p: badgeProgress(b, book.data.stats, app.state.data.level, app.state.data.stage) }))
      .sort((x, y) => y.p[0] / y.p[1] - x.p[0] / x.p[1]);
    const shownLocked = this.showAllBadges ? locked : locked.slice(0, 3);

    const tile = (id: string, title: string, desc: string, tier: string, isOn: boolean, progress?: [number, number]) =>
      h('button', {
        class: `badge-tile tier-${tier}${isOn ? ' on' : ''}${book.data.title === id ? ' selected' : ''}`,
        'aria-label': `${title} : ${desc}`,
        onclick: () => {
          if (!isOn) { app.toast(desc); return; }
          book.setTitle(book.data.title === id ? null : id);
          app.toast(book.data.title === id ? `Titre affiché : ${title}` : 'Titre retiré');
        }
      },
        h('span', { class: 'medal' }, isOn ? icon(ICONS.star, 22) : icon(ICONS.lock, 18)),
        h('span', { class: 'badge-title' }, title),
        progress ? h('span', { class: 'badge-prog' }, h('span', { style: { width: `${Math.min(100, (progress[0] / progress[1]) * 100)}%` } })) : h('span', { class: 'badge-tier' }, TIER_LABEL[tier as keyof typeof TIER_LABEL]));

    return h('section', { class: 'card' },
      h('div', { class: 'section-head' }, h('h3', null, 'Succès'), h('span', { class: 'small muted' }, `${unlocked.length} / ${defs.length}`)),
      unlocked.length ? h('p', { class: 'small muted' }, 'Touche un succès débloqué pour l’afficher comme titre.') : null,
      h('div', { class: 'badge-grid' },
        ...unlocked.map(b => tile(b.id, b.title, b.description, b.tier, true)),
        ...shownLocked.map(({ b, p }) => tile(b.id, b.title, `${b.description} (${Math.min(p[0], p[1])}/${p[1]})`, b.tier, false, p))),
      locked.length > 3 ? h('button', { class: 'btn ghost', onclick: () => { this.showAllBadges = !this.showAllBadges; this.refresh(); } },
        this.showAllBadges ? 'Voir moins' : `Voir les ${locked.length} succès à débloquer`) : null);
  }
}
