import { TIER_LABEL, badgeProgress, energyLabel } from '../../family/badges.js';
import { FOODS, isNight, type Companion } from '../../family/Companion.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h, icon, put } from '../dom.js';
import { playGemGame } from '../MiniGame.js';
import { openSheet } from './common.js';
import { Sound } from '../../engine/Sound.js';
import { todayKey } from '../../family/model.js';
import { fill, journeyFor, landmarks } from '../../family/Expedition.js';
import { openLair } from '../Lair.js';
import { shareCard } from '../ShareCard.js';
import { sayFor } from '../../family/Thoughts.js';

export class DragonScreen implements Screen {
  id = 'dragon'; label = 'Dragon'; icon = ICONS.dragon;
  private el: HTMLElement | null = null;
  private showAllBadges = false;
  constructor(private app: App) { if (app.isParent) this.label = 'Dragonne'; }

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
        h('div', { class: 'row' }, h('h2', { class: 'grow' }, app.stageLabel(stage.label)), book?.titleText() ? h('span', { class: 'badge title-badge' }, book.titleText()) : null),
        h('p', { class: 'muted' }, stage.tagline),
        next ? h('p', { class: 'small' }, `Prochaine évolution : ${app.stageLabel(next.label)}, au niveau ${next.minLevel} (encore ${levelsLeft} niveau${levelsLeft > 1 ? 'x' : ''}).`) : h('p', { class: 'small' }, 'Stade ultime atteint.')),
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
    const book = app.family.book;

    // Sanctions : bilan d'hier, maladie, objet confisqué, ce que coûtera un oubli ce soir.
    if (book) {
      const lp = book.data.lastPenalty;
      const rule = book.severityRule();
      const lines: Array<HTMLElement | null> = [];
      if (lp && lp.date === todayKey()) lines.push(h('p', null, `Oublié : ${lp.missed.join(', ')}. Perdu : ${lp.xp} XP et ${lp.gold} or.`));
      if (d.sick) lines.push(h('p', null, `${comp.name} est malade : pas de tours ni de jeu, et pas de bonus d’XP. Une journée où toutes les missions sont faites le guérira.`));
      if (book.data.confiscated) {
        const def = app.catalog.item(book.data.confiscated.id);
        lines.push(h('p', null, `Confisqué : ${def?.name ?? 'un équipement'}, rendu après une journée parfaite.`));
      }
      if (lines.length) out.push(h('section', { class: 'card penalty-card' },
        h('h3', null, 'Missions oubliées'), ...lines,
        h('p', { class: 'small muted' }, `Règle fixée par tes parents : ${rule.label}. ${rule.text}`)));
      const cost = book.pendingCost();
      if (cost.count && new Date().getHours() >= 17 && !lines.length) out.push(h('section', { class: 'card warn-card' },
        h('p', { class: 'small' }, `Encore ${cost.count} mission${cost.count > 1 ? 's' : ''} aujourd’hui. Oubliées, elles coûteront ${cost.xp} XP et ${cost.gold} or demain matin.`)));
    }

    if (!d.name) {
      const input = h('input', { type: 'text', maxlength: '18', placeholder: 'Pyros, Nyx, Ember…', 'aria-label': 'Nom du dragon' });
      out.push(h('section', { class: 'card name-card' },
        h('h3', null, app.isParent ? 'Ta dragonne n’a pas encore de nom' : 'Ton dragon n’a pas encore de nom'),
        h('p', { class: 'small muted' }, app.isParent ? 'Choisis-le bien : elle le portera toute sa vie.' : 'Choisis-le bien : il le portera toute sa vie, et il t’appellera par ton prénom.'),
        h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onclick: () => {
          if (!input.value.trim()) return;
          comp.setName(input.value);
          void app.act('happy');
          const who = app.family.book?.childName ?? app.family.linkState.deviceName;
          app.say(`${comp.name}… j’adore ! Merci${who ? ', ' + who : ''} !`, null, 5000);
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
      app.isParent ? null : comp.xpBonus() > 1 ? h('p', { class: 'small good' }, 'Dragon heureux : tes missions rapportent +10 % d’XP.')
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
      btn('Voler', ICONS.wing, () => {
        if (app.sleeping) { app.toast('Il dort… réveille-le d’abord'); return; }
        void app.act('hover');
      }, app.sleeping ? 'dim' : ''),
      btn('Câlin', ICONS.hand, () => {
        if (app.sleeping) { app.toast('Chut… il dort'); return; }
        comp.pet(); void app.act('pet'); app.say(sayFor('pet'), null, 2500);
      }),
      btn('Tours', ICONS.spark, () => this.tricksSheet(comp)),
      btn('Album', ICONS.album, () => this.albumSheet(comp))));
    out.push(h('p', { class: 'small muted care-hint' }, app.careMode === 'wash'
      ? 'Mode lavage : frotte les écailles avec ton doigt jusqu’à ce qu’il brille.'
      : 'Astuce : frotte-le doucement avec ton doigt pour le caresser.'));
    if (book) out.push(this.expeditionCard(comp));
    if (app.family.duo) out.push(this.friendCard(comp));
    if (app.isParent) out.push(h('p', { class: 'small muted care-hint' },
      `Chaque soin la fait grandir : encore ${comp.careXpLeft()} XP possibles aujourd’hui. Des rations arrivent chaque matin.`),
      h('button', { class: 'btn', onclick: () => app.show('inventory') }, 'Mes équipements'));
    out.push(h('div', { class: 'row lair-row' },
      h('button', { class: 'btn grow', onclick: () => openLair(app) }, icon(ICONS.dragon, 18), ' Sa grotte'),
      h('button', { class: 'btn grow', onclick: () => void shareCard(app) }, icon(ICONS.star, 18), ' Partager')));
    return out;
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
        if (comp.data.sick) { app.say('Je suis trop malade pour faire des tours… une journée parfaite me guérira.', 'missions'); close(); return; }
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
    if (st === 'sick') { app.say('Je suis malade… on jouera quand je serai guéri. Fais toutes tes missions aujourd’hui !', 'missions', 5000); return; }
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
