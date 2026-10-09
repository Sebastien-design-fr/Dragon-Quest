import type { Companion } from '../../family/Companion.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon, put } from '../dom.js';
import { openSheet } from './common.js';
import { Sound } from '../../engine/Sound.js';
import { fill, journeyFor, landmarks } from '../../family/Expedition.js';
import { openLair } from '../Lair.js';
import { shareCard } from '../ShareCard.js';
import { ringSvg } from '../StageHud.js';
import { gamesSheet } from '../CareSheets.js';
import { dailyChestCard, nextStageCard } from '../SurprisesUI.js';
import { familyQuestCard } from '../FamilyQuestCard.js';
import { openPhotoMode } from '../PhotoMode.js';
import { questDeck, questDeckBusy } from '../QuestDeck.js';
import { appearanceSheet, collectionCard } from '../Appearance.js';
import { eventCard } from '../Seasonal.js';

export class DragonScreen implements Screen {
  id = 'dragon'; label = 'Dragon'; icon = ICONS.dragon;
  private el: HTMLElement | null = null;
  constructor(private app: App) { if (app.isParent) this.label = 'Ma dragonne'; }

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; }

  refresh(): void {
    const el = this.el; if (!el) return;
    const { app } = this;
    const comp = app.family.companion;
    const book = app.family.book;
    if (questDeckBusy()) return; // la carte s'envole : l'écran suivra
    clear(el);
    if (!comp) return;
    // Refonte UX : la prochaine quête d'abord (un seul geste), puis « À découvrir » en carrousel horizontal.
    const discover = [
      eventCard(app), dailyChestCard(app), nextStageCard(app), collectionCard(app),
      book ? this.expeditionCard(comp) : null,
      app.family.duo ? familyQuestCard(app) : null,
      app.family.duo ? this.friendCard(comp) : null
    ].filter((x): x is HTMLElement => !!x);
    put(el,
      this.nameCard(comp),
      book ? questDeck(app) : this.careStrip(comp),
      h('div', { class: 'disc-head' }, h('h3', null, 'À découvrir'), h('span', { class: 'small muted' }, 'glisse →')),
      h('div', { class: 'disc' }, ...discover.map(c => h('div', { class: 'disc-item' }, c))),
      h('div', { class: 'ds-tools' },
        h('button', { class: 'ds-tool', onclick: () => openLair(app) }, icon(ICONS.dragon, 22), h('span', null, 'Sa grotte')),
        h('button', { class: 'ds-tool', onclick: () => appearanceSheet(app) }, icon(ICONS.drop, 22), h('span', null, 'Reflets')),
        h('button', { class: 'ds-tool', onclick: () => openPhotoMode(app) }, icon(ICONS.star, 22), h('span', null, 'Photo')),
        h('button', { class: 'ds-tool', onclick: () => void shareCard(app) }, icon(ICONS.gift, 22), h('span', null, 'Partager')),
        h('button', { class: 'ds-tool', onclick: () => this.albumSheet(comp) }, icon(ICONS.album, 22), h('span', null, 'Album')),
        app.isParent ? h('button', { class: 'ds-tool', onclick: () => app.openChest('owned') }, icon(ICONS.inventory, 22), h('span', null, 'Équipements')) : null),
      h('p', { class: 'small muted ds-hint' }, app.careMode === 'wash'
        ? 'Mode lavage : frotte ses écailles avec ton doigt jusqu’à ce qu’il brille.'
        : 'Gratte-lui la tête, chatouille son ventre, touche sa queue… Appui long sur lui : toutes les actions. Glisse vers le haut : il s’envole !')
    );
  }

  /** Ouvre directement le bon soin (depuis une bulle de pensée). */
  focus(a: string): void {
    const { app } = this;
    if (a === 'feed') app.stageHud.openTray();
    else if (a === 'wash') app.stageHud.action('wash');
    else if (a === 'play') gamesSheet(app);
    else if (a === 'sleep') app.sleepButton();
    else if (a === 'pet') app.toast('Gratte-lui la tête avec ton doigt');
  }

  private nameCard(comp: Companion): HTMLElement | null {
    const { app } = this;
    if (comp.data.name) return null;
    const input = h('input', { type: 'text', maxlength: '18', placeholder: 'Pyros, Nyx, Ember…', 'aria-label': 'Nom du dragon' });
    return h('section', { class: 'card name-card' },
      h('h3', null, app.isParent ? 'Ta dragonne n’a pas encore de nom' : 'Ton dragon n’a pas encore de nom'),
      h('p', { class: 'small muted' }, app.isParent ? 'Choisis-le bien : elle le portera toute sa vie.' : 'Choisis-le bien : il le portera toute sa vie, et il t’appellera par ton prénom.'),
      h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onclick: () => {
        if (!input.value.trim()) return;
        comp.setName(input.value);
        void app.act('happy');
        const who = app.family.book?.childName ?? app.family.linkState.deviceName;
        app.say(`${comp.name}… j’adore ! Merci${who ? ', ' + who : ''} !`, null, 5000);
      } }, 'Valider')));
  }

  /** Dragonne (parent) : ce que les soins lui apportent aujourd'hui. */
  private careStrip(comp: Companion): HTMLElement {
    const left = comp.careXpLeft();
    const rations = Object.values(comp.data.food).reduce((a, b) => a + b, 0);
    return h('div', { class: 'ds-today' },
      h('span', { class: 'ds-ring' }, ringSvg(1 - left / 100, 58, 6), h('span', { class: 'ds-ring-n' }, h('strong', null, String(100 - left)), h('small', null, 'XP'))),
      h('span', { class: 'grow ds-today-txt' },
        h('span', { class: 'ds-kicker' }, 'Aujourd’hui'),
        h('strong', null, left ? `Encore ${left} XP de soins possibles` : 'Elle a reçu tous ses soins du jour !'),
        h('span', { class: 'small muted' }, `${rations} ration${rations > 1 ? 's' : ''} en réserve · de nouvelles chaque matin`)));
  }

  private albumSheet(comp: Companion): void {
    openSheet('Album souvenirs', () => comp.data.album.length
      ? comp.data.album.map(a => h('div', { class: 'album-row' },
        h('div', { class: 'album-date' }, new Date(a.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })),
        h('div', null, h('div', { class: 'item-name' }, a.title), h('div', { class: 'small muted' }, a.text))))
      : [h('p', { class: 'muted' }, 'Vos plus beaux moments s’afficheront ici : son nom, ses évolutions, vos niveaux d’amitié…')]);
  }

  /** L'autre dragon de la famille : amitié, visites, cadeaux. */
  private friendCard(comp: Companion): HTMLElement {
    const { app } = this;
    const duo = app.family.duo!;
    const f = duo.friend();
    const lv = duo.level();
    if (!f) return h('section', { class: 'card friend-card' },
      h('h3', null, app.isParent ? 'Le dragon de votre enfant' : 'La dragonne de tes parents'),
      h('p', { class: 'small muted' }, 'Les deux dragons se rencontreront dès que vos deux téléphones auront ouvert l’appli à la maison (même Wi-Fi).'));
    return h('section', { class: 'card friend-card' },
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('div', { class: 'small muted' }, `${f.variant === 'dragonne' ? 'La dragonne' : 'Le dragon'} de ${f.owner}`), h('div', { class: 'item-name' }, `${f.name} · niveau ${f.level}`)),
        h('div', { class: 'bond' }, h('div', { class: 'small' }, `${comp.name} & ${f.name} : ${lv.label}`),
          h('div', { class: 'bar bond-bar' }, h('div', { class: 'fill', style: { width: `${Math.round(lv.progress * 100)}%` } })))),
      h('p', { class: 'small muted' }, 'Chaque visite et chaque cadeau les rapprochent, et débloque des tours à deux.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary grow', onclick: () => this.visitSheet(comp) }, `Rendre visite à ${f.name}`),
        h('span', { class: 'small muted' }, `${duo.visitsLeft()} / 3 aujourd’hui`)));
  }

  private visitSheet(comp: Companion): void {
    const { app } = this;
    const duo = app.family.duo!;
    const f = duo.friend()!;
    let gift: { food?: 'meat' | 'fish' | 'fireFruit'; item?: string } | undefined;
    let price = 0;
    openSheet(`${comp.name} va voir ${f.name}`, close => {
      const msg = h('input', { type: 'text', maxlength: '120', placeholder: app.isParent ? 'Je suis fière de toi !' : 'Merci pour tout !' }) as HTMLInputElement;
      const gifts = h('div', { class: 'gift-list' });
      const render = () => {
        const items = app.catalog.shopItems(null, {}).filter(d => !f.owned.includes(d.id) && d.compatibleDragonStages.includes(f.stage) && app.catalog.categories.get(d.category)?.kind !== 'effect').slice(0, 12);
        const opt = (label: string, cost: number, g: typeof gift) => h('button', {
          class: `gift${JSON.stringify(g) === JSON.stringify(gift) ? ' on' : ''}`,
          onclick: () => { gift = g; price = cost; render(); }
        }, h('span', null, label), h('span', { class: 'small muted' }, cost ? `${cost} or` : ''));
        gifts.replaceChildren(
          opt('Pas de cadeau', 0, undefined),
          opt('Viande grillée', 25, { food: 'meat' }), opt('Poisson des montagnes', 40, { food: 'fish' }), opt('Fruit de feu', 120, { food: 'fireFruit' }),
          ...items.map(d => opt(d.name, d.price, { item: d.id })));
      };
      render();
      return [
        h('p', { class: 'small muted' }, `${comp.name} vole jusqu’au téléphone de ${f.owner} et se pose à côté de ${f.name}. Ton message s’affichera dans sa bulle.`),
        h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Message (facultatif)'), msg),
        h('span', { class: 'small' }, `Un cadeau ? (ton or : ${app.state.data.gold})`), gifts,
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: async () => {
          const r = await duo.sendVisit(msg.value, gift, price);
          if (r === 'limit') { app.toast('Déjà 3 visites aujourd’hui : reviens demain'); return; }
          if (r === 'gold') { app.toast('Pas assez d’or pour ce cadeau'); return; }
          close();
          void app.act('hover');
          app.say(`Je file voir ${f.name} !`, null, 4000);
        } }, 'Envoyer'))
      ];
    });
  }

  private expeditionCard(comp: Companion): HTMLElement {
    const book = this.app.family.book!;
    const e = book.data.expedition, goal = book.expeditionGoal();
    const j = journeyFor(e.week);
    const done = e.steps >= goal;
    return h('button', { class: `card expedition${done && !e.opened ? ' ready' : ''}`, style: { '--c1': j.colors[0], '--c2': j.colors[1] }, onclick: () => this.mapSheet(comp) },
      h('div', { class: 'row' }, h('div', { class: 'grow' },
        h('div', { class: 'small muted' }, 'Expédition de la semaine'),
        h('div', { class: 'item-name' }, j.title)),
        h('span', { class: 'small' }, done ? (e.opened ? 'Terminée' : 'Coffre à ouvrir !') : `${e.steps} / ${goal}`)),
      h('div', { class: 'bar exp-bar' }, h('div', { class: 'fill', style: { width: `${Math.min(100, (e.steps / goal) * 100)}%` } })),
      h('div', { class: 'small muted' }, 'Chaque mission fait avancer ' + comp.name + ' d’une étape.'));
  }

  private mapSheet(comp: Companion): void {
    const { app } = this;
    const book = app.family.book!;
    const e = book.data.expedition, goal = book.expeditionGoal();
    const j = journeyFor(e.week);
    const marks = landmarks(j, goal);
    openSheet(j.title, close => {
      // Carte : chemin sinueux, repères, position du dragon.
      const W = 320, H = 190, pts: Array<[number, number]> = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([20 + t * (W - 40), H / 2 + Math.sin(t * Math.PI * 2.4) * 55 * (0.6 + 0.4 * t)]); }
      const at = (k: number) => pts[Math.min(40, Math.round((k / goal) * 40))];
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'exp-map');
      const add = (tag: string, attrs: Record<string, string>) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.append(n); return n; };
      add('rect', { x: '0', y: '0', width: String(W), height: String(H), rx: '14', fill: j.colors[1] });
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      add('path', { d, fill: 'none', stroke: 'rgba(255,255,255,.18)', 'stroke-width': '6', 'stroke-linecap': 'round' });
      const prog = pts.slice(0, Math.round((Math.min(e.steps, goal) / goal) * 40) + 1);
      if (prog.length > 1) add('path', { d: prog.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), fill: 'none', stroke: j.colors[0], 'stroke-width': '4', 'stroke-linecap': 'round', 'stroke-dasharray': '1 7' });
      marks.forEach((m, i) => {
        const [x, y] = at(m.at);
        const reached = e.steps >= m.at;
        add('circle', { cx: String(x), cy: String(y), r: i === marks.length - 1 ? '9' : '6', fill: reached ? j.colors[0] : '#2a2630', stroke: '#f2d48a', 'stroke-width': '1.5' });
      });
      const [dx, dy] = at(Math.min(e.steps, goal));
      add('circle', { cx: String(dx), cy: String(dy - 12), r: '7', fill: '#d9a84a' });
      add('path', { d: `M${dx - 4},${dy - 8} L${dx},${dy - 2} L${dx + 4},${dy - 8} Z`, fill: '#d9a84a' });
      const txt = add('text', { x: String(dx), y: String(dy - 9), 'text-anchor': 'middle', 'font-size': '9', fill: '#1a1408', 'font-weight': '700' });
      txt.textContent = '◆';

      const nodes: Node[] = [svg as unknown as Node,
        h('p', { class: 'story intro' }, fill(j.intro, comp.name)),
        ...marks.map((m, i) => e.steps >= m.at
          ? h('div', { class: 'story-row' }, h('div', { class: 'item-name' }, `${i + 1}. ${m.name}`), h('p', { class: 'small' }, fill(m.story, comp.name)))
          : h('div', { class: 'story-row locked' }, h('div', { class: 'item-name' }, `${i + 1}. ???`), h('p', { class: 'small muted' }, `Encore ${m.at - e.steps} mission${m.at - e.steps > 1 ? 's' : ''} pour le découvrir.`)))];
      if (e.steps >= goal && !e.opened) nodes.push(h('button', { class: 'btn primary chest-btn', onclick: () => {
        const loot = book.openChest();
        if (!loot) return;
        void Sound.play('chest', { user: true });
        close();
        void app.act('roar');
        app.view.emit('evolutionBurst', 'body_center');
        app.say(`Le coffre contenait ${loot.gems} gemmes, ${loot.gold} or et un fruit de feu !`, null, 7000);
      } }, 'Ouvrir le coffre'));
      else if (!e.opened) nodes.push(h('p', { class: 'small muted' }, `Le coffre (5 gemmes, 120 or, un fruit de feu) t’attend au bout. Nouvelle expédition chaque lundi.`));
      return nodes;
    });
  }

}
