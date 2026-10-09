// Carte « Quête de famille » : l'enfant fait ses missions, le parent soigne sa dragonne,
// et les deux dragons avancent ensemble vers un même but chaque semaine.
import type { QuestState } from '../family/Duo.js';
import type { App } from './App.js';
import { ICONS, clear, h, icon } from './dom.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const COLORS = { child: '#e8833a', parent: '#a77be0' };

export function familyQuestCard(app: App): HTMLElement {
  const card = h('section', { class: 'card pq-quest' });
  let mounted = false;
  const off = app.family.duo?.events.on('change', () => {
    if (card.isConnected) mounted = true;
    else if (mounted) { off?.(); return; }
    render();
  });
  const render = () => { clear(card); fill(app, card, render); };
  render();
  return card;
}

function fill(app: App, card: HTMLElement, rerender: () => void): void {
  const duo = app.family.duo;
  const comp = app.family.companion;
  const isParent = app.isParent;
  const f = duo?.friend() ?? null;

  if (!duo || !f) {
    card.classList.add('pq-quest-empty');
    card.append(
      head('Quête de famille', 'Bientôt à deux'),
      illustration(0, 0, true),
      h('p', { class: 'small muted pq-quest-note' }, isParent
        ? 'Chaque semaine, votre enfant et vous partirez à l’aventure ensemble : ses missions et vos soins à la dragonne compteront pour la même quête. Elle commence dès que vos deux téléphones se sont vus sur le Wi-Fi de la maison.'
        : 'Chaque semaine, ton dragon et la dragonne de tes parents partiront à l’aventure ensemble : tes missions et leurs soins compteront pour la même quête. Elle commence dès que vos deux téléphones se sont vus sur le Wi-Fi de la maison.'));
    return;
  }
  card.classList.remove('pq-quest-empty');

  const q: QuestState = duo.questState();
  const meOwner = app.family.linkState.deviceName || (isParent ? 'Maman' : 'Moi');
  const mine = { owner: meOwner, dragon: comp?.name ?? 'son dragon', n: q.mine, goal: q.mineGoal, role: isParent ? 'parent' : 'child' } as const;
  const theirs = { owner: f.owner || (isParent ? 'Votre enfant' : 'Maman'), dragon: f.name, n: q.theirs, goal: q.theirsGoal, role: isParent ? 'child' : 'parent' } as const;
  const childSide = isParent ? theirs : mine;
  const parentSide = isParent ? mine : theirs;
  const pc = Math.min(1, childSide.n / childSide.goal), pp = Math.min(1, parentSide.n / parentSide.goal);

  card.classList.toggle('pq-quest-done', q.done);
  card.append(head(q.title, `Quête de famille · ${weekLabel(q.week)}`), illustration(pc, pp, false));

  const bar = (s: typeof mine) => {
    const p = Math.min(1, s.n / s.goal);
    const unit = s.role === 'child' ? 'quêtes' : 'soins';
    return h('div', { class: `pq-qbar pq-qbar-${s.role}${p >= 1 ? ' full' : ''}` },
      h('div', { class: 'pq-qbar-label' },
        h('span', null, `${s.owner} et ${s.dragon}`),
        h('strong', null, `${Math.min(s.n, 999)} / ${s.goal} ${unit}`)),
      h('div', { class: 'pq-qbar-track' }, h('div', { class: 'pq-qbar-fill', style: { width: `${Math.round(p * 100)}%` } })));
  };
  const total = Math.min(childSide.n, childSide.goal) + Math.min(parentSide.n, parentSide.goal);
  const goal = childSide.goal + parentSide.goal;
  card.append(h('div', { class: 'pq-quest-body' },
    ring(total / goal),
    h('div', { class: 'pq-quest-bars' }, bar(childSide), bar(parentSide))));

  if (q.claimed) {
    card.append(h('div', { class: 'pq-quest-claimed' }, icon(ICONS.check, 18), ' Récompense récupérée. Rendez-vous lundi pour la prochaine quête !'));
  } else if (q.done) {
    card.append(
      h('p', { class: 'small pq-quest-note' }, `Bravo à vous deux ! ${comp?.name ?? 'Ton dragon'} reçoit 100 or et un souvenir pour l’album.`),
      h('button', {
        class: 'btn primary pq-claim', onclick: () => { if (duo.claimQuest()) rerender(); }
      }, icon(ICONS.gift, 18), ' Récupérer la récompense'));
  } else {
    const left = daysLeft(q.week);
    const mineLeft = Math.max(0, mine.goal - mine.n), theirsLeft = Math.max(0, theirs.goal - theirs.n);
    const tip = mineLeft === 0
      ? `Ta part est faite ! Il reste ${theirsLeft} ${theirs.role === 'child' ? (theirsLeft > 1 ? 'quêtes' : 'quête') : (theirsLeft > 1 ? 'soins' : 'soin')} à ${theirs.owner}.`
      : isParent
        ? `Chaque repas, bain, partie de jeu ou coucher de ${mine.dragon} compte.`
        : `Chaque mission faite fait avancer ${mine.dragon} vers ${theirs.dragon}.`;
    card.append(h('p', { class: 'small muted pq-quest-note' }, tip, h('span', { class: 'pq-days' }, left <= 1 ? ' Dernier jour !' : ` Encore ${left} jours.`)));
  }
}

function head(title: string, eyebrow: string): HTMLElement {
  return h('div', { class: 'pq-quest-head' }, h('div', { class: 'pq-eyebrow' }, eyebrow), h('h3', null, title));
}

function weekLabel(week: string): string {
  const [y, m, d] = week.split('-').map(Number);
  return 'semaine du ' + new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function daysLeft(week: string): number {
  const [y, m, d] = week.split('-').map(Number);
  const end = new Date(y, m - 1, d + 7).getTime();
  return Math.max(1, Math.ceil((end - Date.now()) / 86400000));
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...kids: SVGElement[]): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
}

/** Deux têtes de dragon face à face ; leurs chemins se rejoignent au centre (remplis selon chaque part). */
function illustration(pChild: number, pParent: number, empty: boolean): SVGSVGElement {
  const svg = el('svg', { viewBox: '0 0 320 112', class: 'pq-quest-art', 'aria-hidden': 'true' });
  const defs = el('defs', {},
    el('radialGradient', { id: 'pqGlow' }, el('stop', { offset: '0', 'stop-color': '#ffe7a8', 'stop-opacity': '1' }), el('stop', { offset: '1', 'stop-color': '#d9a84a', 'stop-opacity': '0' })));
  svg.append(defs);
  // étoiles
  for (const [x, y, r] of [[96, 18, 1.2], [214, 14, 1], [150, 98, .9], [250, 92, 1.1], [70, 92, .8], [182, 30, .8]]) svg.append(el('circle', { cx: x, cy: y, r, fill: '#f2d48a', opacity: .55 }));
  const left = 'M70 62 C 100 62, 108 30, 160 54';
  const right = 'M250 62 C 220 62, 212 30, 160 54';
  const track = { fill: 'none', 'stroke-width': 4, 'stroke-linecap': 'round', stroke: '#2c2730', 'stroke-dasharray': '1 7' };
  svg.append(el('path', { d: left, ...track }), el('path', { d: right, ...track }));
  const prog = (d: string, p: number, color: string) => el('path', { d, fill: 'none', stroke: color, 'stroke-width': 4, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': `${Math.max(0.01, p * 100)} 100`, class: 'pq-path' });
  if (!empty) svg.append(prog(left, pChild, COLORS.child), prog(right, pParent, COLORS.parent));
  const both = pChild >= 1 && pParent >= 1;
  svg.append(el('circle', { cx: 160, cy: 54, r: both ? 26 : 16, fill: 'url(#pqGlow)', opacity: empty ? .25 : both ? 1 : .55, class: both ? 'pq-orb lit' : 'pq-orb' }));
  svg.append(el('path', { d: 'M160 44 L163 51 L170 54 L163 57 L160 64 L157 57 L150 54 L157 51 Z', fill: both ? '#fff6dc' : '#d9a84a', opacity: empty ? .35 : 1 }));
  svg.append(dragonHead(46, 62, false, empty ? '#4a4250' : COLORS.child), dragonHead(274, 62, true, empty ? '#4a4250' : COLORS.parent));
  return svg;
}

/** Tête de dragon stylisée, de profil, tournée vers la droite (ou la gauche si flip). */
function dragonHead(x: number, y: number, flip: boolean, color: string): SVGGElement {
  const g = el('g', { transform: `translate(${x} ${y}) scale(${flip ? -1 : 1} 1)` });
  g.append(
    // corne arrière
    el('path', { d: 'M-12 -12 C -22 -26, -30 -30, -38 -30 C -28 -24, -24 -16, -20 -6 Z', fill: color, opacity: .75 }),
    el('path', { d: 'M-4 -15 C -8 -28, -14 -34, -20 -38 C -14 -28, -12 -20, -12 -12 Z', fill: color, opacity: .9 }),
    // tête et museau
    el('path', { d: 'M-24 14 C -28 -4, -16 -18, 0 -17 C 10 -16, 16 -12, 22 -8 L 30 -6 C 34 -5, 36 -1, 34 3 L 30 6 C 24 8, 18 9, 12 12 C 4 22, -14 26, -24 14 Z', fill: color }),
    // mâchoire
    el('path', { d: 'M12 12 C 18 12, 24 11, 30 8 C 26 14, 18 17, 8 17 Z', fill: color, opacity: .7 }),
    // crête
    el('path', { d: 'M-24 14 L -30 8 L -26 4 L -32 -2 L -26 -4', fill: 'none', stroke: color, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }),
    // oeil et narine
    el('ellipse', { cx: 6, cy: -6, rx: 3.4, ry: 2.6, fill: '#fff4d6' }),
    el('ellipse', { cx: 6.6, cy: -6, rx: 1.2, ry: 2.2, fill: '#1a1408' }),
    el('circle', { cx: 29, cy: -2, r: 1.3, fill: '#1a1408', opacity: .7 })
  );
  return g;
}

function ring(p: number): HTMLElement {
  const r = 30, c = 2 * Math.PI * r;
  const svg = el('svg', { viewBox: '0 0 76 76', class: 'pq-ring-svg', 'aria-hidden': 'true' },
    el('defs', {}, el('linearGradient', { id: 'pqRingGrad', x1: '0', y1: '0', x2: '1', y2: '1' },
      el('stop', { offset: '0', 'stop-color': COLORS.child }), el('stop', { offset: '1', 'stop-color': COLORS.parent }))),
    el('circle', { cx: 38, cy: 38, r, fill: 'none', stroke: '#241f27', 'stroke-width': 7 }),
    el('circle', { cx: 38, cy: 38, r, fill: 'none', stroke: 'url(#pqRingGrad)', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': `${Math.max(0.001, Math.min(1, p)) * c} ${c}`, transform: 'rotate(-90 38 38)' }));
  return h('div', { class: 'pq-ring', role: 'img', 'aria-label': `Quête commune : ${Math.round(p * 100)} %` },
    svg, h('div', { class: 'pq-ring-text' }, h('strong', null, `${Math.round(Math.min(1, p) * 100)}%`), h('span', null, 'ensemble')));
}
