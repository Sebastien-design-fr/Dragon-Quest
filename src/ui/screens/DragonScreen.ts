import { TIER_LABEL, badgeProgress, energyLabel } from '../../family/badges.js';
import { FOODS, isNight, type Companion } from '../../family/Companion.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon, put } from '../dom.js';
import { playGemGame } from '../MiniGame.js';
import { openSheet } from './common.js';

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

    const comp = app.family.companion;
    put(el,
      comp ? this.companionCards(comp, today.filter(t => t.status === 'done').length) : null,
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
      comp ? null : h('section', { class: 'actions' },
        action('Caresser', ICONS.heart, () => void app.act('happy')),
        action('Nourrir', ICONS.meat, () => void app.act('eat')),
        action(app.sleeping ? 'Réveiller' : 'Dormir', ICONS.moon, () => app.toggleSleep(), app.sleeping ? 'on' : ''),
        action('Attaquer', ICONS.claw, () => tired ? app.toast('Ton dragon est trop fatigué pour attaquer.') : void app.act('attack')),
        action('Souffle', ICONS.flame, () => tired ? app.toast('Trop fatigué pour cracher du feu…') : void app.act('fire'))),
      book ? this.badgesCard() : null
    );
  }

  /** Ouvre directement le bon soin (depuis une bulle de pensée). */
  focus(a: string): void {
    const comp = this.app.family.companion;
    if (!comp) return;
    const done = this.app.family.book?.today().filter(t => t.status === 'done').length ?? 0;
    if (a === 'feed') this.feedSheet(comp);
    else if (a === 'wash') { this.app.careMode = 'wash'; this.refresh(); this.app.toast('Frotte les taches avec ton doigt'); }
    else if (a === 'play') void this.play(comp, done);
    else if (a === 'sleep') this.app.toggleSleep(true);
    else if (a === 'pet') this.app.toast('Frotte-le doucement avec ton doigt');
  }

  private companionCards(comp: Companion, doneToday: number): HTMLElement[] {
    const { app } = this;
    const d = comp.data;
    const mood = comp.mood();
    const bond = comp.bondLevel();
    const out: HTMLElement[] = [];

    if (!d.name) {
      const input = h('input', { type: 'text', maxlength: '18', placeholder: 'Pyros, Nyx, Ember…', 'aria-label': 'Nom du dragon' });
      out.push(h('section', { class: 'card name-card' },
        h('h3', null, 'Ton dragon n’a pas encore de nom'),
        h('p', { class: 'small muted' }, 'Choisis-le bien : il le portera toute sa vie, et il t’appellera par ton prénom.'),
        h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onclick: () => {
          if (!input.value.trim()) return;
          comp.setName(input.value);
          void app.act('happy');
          app.say(`${comp.name}… j’adore ! Merci${app.family.book?.childName ? ', ' + app.family.book.childName : ''} !`, null, 5000);
        } }, 'Valider'))));
    }

    const gauge = (label: string, v: number, ic: string) => h('div', { class: 'gauge' },
      h('div', { class: 'gauge-top' }, icon(ic, 16), h('span', null, label)),
      h('div', { class: `bar care-bar ${v < 25 ? 'low' : v < 50 ? 'mid' : ''}` }, h('div', { class: 'fill', style: { width: `${Math.round(v)}%` } })));
    out.push(h('section', { class: `card companion mood-${mood.key}` },
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('h2', { class: 'dragon-name' }, comp.name), h('div', { class: 'small muted' }, mood.label)),
        h('div', { class: 'bond' }, h('div', { class: 'small' }, `Amitié : ${bond.label}`),
          h('div', { class: 'bar bond-bar' }, h('div', { class: 'fill', style: { width: `${Math.round(bond.progress * 100)}%` } })))),
      h('div', { class: 'gauges' }, gauge('Faim', d.hunger, ICONS.meat), gauge('Propreté', d.clean, ICONS.drop), gauge('Humeur', d.mood, ICONS.heart)),
      comp.xpBonus() > 1 ? h('p', { class: 'small good' }, 'Dragon heureux : tes missions rapportent +10 % d’XP.')
        : h('p', { class: 'small muted' }, 'Bien nourri, propre et de bonne humeur, il te donne +10 % d’XP sur tes missions.')));

    const rations = Object.values(d.food).reduce((a, b) => a + b, 0);
    const playState = comp.canPlay(doneToday);
    const evening = isNight() || new Date().getHours() >= 20;
    const btn = (label: string, ic: string, run: () => void, extra = '', badge?: string) =>
      h('button', { class: `action ${extra}`, onclick: run }, icon(ic, 26), h('span', null, label), badge ? h('span', { class: 'action-badge' }, badge) : null);
    out.push(h('section', { class: 'actions care-actions' },
      btn('Nourrir', ICONS.meat, () => this.feedSheet(comp), '', String(rations)),
      btn(app.careMode === 'wash' ? 'Lavage…' : 'Laver', ICONS.drop, () => {
        app.careMode = app.careMode === 'wash' ? 'pet' : 'wash';
        if (app.careMode === 'wash') app.toast(d.clean >= 100 ? 'Il est déjà tout propre !' : 'Frotte les taches avec ton doigt');
        this.refresh();
      }, app.careMode === 'wash' ? 'on' : ''),
      btn('Jouer', ICONS.game, () => void this.play(comp, doneToday), playState === 'ok' ? 'glow' : 'dim'),
      btn(app.sleeping ? 'Réveiller' : evening ? 'Coucher' : 'Sieste', ICONS.moon, () => app.toggleSleep(), app.sleeping ? 'on' : ''),
      btn('Tours', ICONS.spark, () => this.tricksSheet(comp)),
      btn('Album', ICONS.album, () => this.albumSheet(comp))));
    out.push(h('p', { class: 'small muted care-hint' }, app.careMode === 'wash'
      ? 'Mode lavage : frotte les écailles avec ton doigt jusqu’à ce qu’il brille.'
      : 'Astuce : frotte-le doucement avec ton doigt pour le caresser.'));
    return out;
  }

  private feedSheet(comp: Companion): void {
    const { app } = this;
    openSheet(`Nourrir ${comp.name}`, close => {
      const list = FOODS.map(f => {
        const n = comp.data.food[f.id] ?? 0;
        return h('div', { class: 'food-row' },
          h('div', { class: 'grow' }, h('div', { class: 'item-name' }, f.label, h('span', { class: 'muted' }, `  × ${n}`)),
            h('div', { class: 'small muted' }, `${f.hint} · faim +${f.hunger}${f.mood ? `, humeur +${f.mood}` : ''}`)),
          f.price ? h('button', { class: 'btn ghost small-btn', onclick: () => {
            if (comp.buy(f.id)) { app.toast(`${f.label} achetée`); close(); this.feedSheet(comp); } else app.toast('Pas assez d’or');
          } }, `Acheter ${f.price}`) : null,
          h('button', { class: 'btn primary small-btn', disabled: n <= 0 ? true : undefined, onclick: () => {
            const r = comp.feed(f.id);
            if (r === 'ok') close();
          } }, 'Donner'));
      });
      return [
        h('p', { class: 'small muted' }, `Faim : ${Math.round(comp.data.hunger)} %. Chaque mission accomplie te donne une ration.`),
        ...list
      ];
    });
  }

  private tricksSheet(comp: Companion): void {
    const { app } = this;
    const tired = (app.family.book?.data.energy ?? 100) < 25;
    openSheet('Les tours de ' + comp.name, close => [
      h('p', { class: 'small muted' }, 'Plus vous êtes amis, plus il apprend de tours.'),
      ...comp.tricks().map(t => h('button', { class: `trick ${t.unlocked ? '' : 'locked'}`, onclick: () => {
        if (!t.unlocked) { app.toast(`Il l’apprendra au niveau d’amitié ${t.level}`); return; }
        if (tired && t.level > 1) { app.say('Je suis trop fatigué… fais une mission pour me redonner des forces.', 'missions'); close(); return; }
        close();
        void app.act(t.anim);
      } }, icon(t.unlocked ? ICONS.spark : ICONS.lock, 18), h('span', { class: 'grow' }, t.label),
        h('span', { class: 'small muted' }, t.unlocked ? 'Faire' : `Amitié ${t.level}`)))
    ]);
  }

  private albumSheet(comp: Companion): void {
    openSheet('Album souvenirs', () => comp.data.album.length
      ? comp.data.album.map(a => h('div', { class: 'album-row' },
        h('div', { class: 'album-date' }, new Date(a.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })),
        h('div', null, h('div', { class: 'item-name' }, a.title), h('div', { class: 'small muted' }, a.text))))
      : [h('p', { class: 'muted' }, 'Vos plus beaux moments s’afficheront ici : son nom, ses évolutions, vos séries de missions, vos niveaux d’amitié…')]);
  }

  private async play(comp: Companion, doneToday: number): Promise<void> {
    const { app } = this;
    const st = comp.canPlay(doneToday);
    if (st === 'played') { app.say('On a déjà joué aujourd’hui… on rejoue demain ?', null, 4000); return; }
    if (st === 'locked') { app.say('On jouera dès que tu auras fait une mission aujourd’hui !', 'missions', 5000); return; }
    const score = await playGemGame(comp.name);
    const gold = comp.finishGame(score);
    void app.act('happy');
    app.say(`Trop bien ! ${score} point${score > 1 ? 's' : ''}${gold ? ` et ${gold} or pour toi` : ''} !`, null, 5000);
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
