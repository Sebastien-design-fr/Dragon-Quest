// Voyages du petit loup : il vit dans la grotte à côté du dragon. On le touche pour l'envoyer explorer ;
// il part en courant, un médaillon indique son retour, puis il revient avec sa sacoche pleine.
// Le dragon reste là pendant tout le voyage : on peut continuer à le nourrir, le caresser, jouer avec lui.
import { DESTINATIONS, duration, fromPlace, type Loot } from '../family/Voyage.js';
import { FOOD_ART } from './StageHud.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { UI } from './Motion.js';
import { openSheet } from './screens/common.js';
import { Sound } from '../engine/Sound.js';
import { FOODS, type FoodId } from '../family/Companion.js';
import { wolfImage } from './WolfArt.js';

/** Place du loup dans la scène (unités de scène, voir DecorLayer) : à gauche du dragon, sur le sol. */
const SPOT = { dx: -0.38, dy: -0.01, h: 0.19 };

let wolf: { el: HTMLImageElement; badge: HTMLButtonElement; raf: number; mode: 'home' | 'leaving' | 'away' | 'back' | 'arriving'; t0: number } | null = null;

export function installVoyage(app: App): void {
  const v = app.family.voyage, comp = app.family.companion;
  const host = app.root.querySelector<HTMLElement>('.stage-view');
  if (!v || !comp || !host) return;
  comp.extraNotifs.push(() => v.returnNotif());

  const el = h('img', { class: 'wolf', alt: 'Le petit loup', draggable: 'false' }) as HTMLImageElement;
  const badge = h('button', { class: 'vy-badge', 'aria-label': 'Voyage du petit loup', onclick: (e: Event) => { e.stopPropagation(); voyageSheet(app); } }) as HTMLButtonElement;
  host.append(el, badge);
  wolf = { el, badge, raf: 0, mode: v.away() ? 'away' : v.data.back ? 'back' : 'home', t0: 0 };
  el.addEventListener('pointerdown', e => { e.stopPropagation(); });
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (!wolf) return;
    if (wolf.mode === 'back') { openBag(app); return; }
    if (wolf.mode === 'home') { void Sound.play('chuff', { user: true, gain: 0.3, rate: 1.6 }); el.classList.remove('wag'); void el.offsetWidth; el.classList.add('wag'); voyageSheet(app); }
  });

  const loop = (now: number) => {
    if (!wolf) return;
    const w = wolf;
    const show = app.showingOwn && app.currentId === 'dragon' && !app.root.classList.contains('lair-edit');
    const f = app.view.decor.frame;
    const r = app.view.canvas.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const s = r.width / (app.view.canvas.width || 1);
    const hgt = SPOT.h * f.u * s;
    const homeX = r.left - hr.left + (f.ox + SPOT.dx * f.u) * s;
    const groundY = r.top - hr.top + (f.oy + SPOT.dy * f.u) * s;
    const exitX = hr.width + hgt * 1.6;
    let x = homeX, pose: 'sit' | 'run1' | 'run2' = 'sit', bag = false, visible = true, flip = false;
    const run = Math.floor(now / 110) % 2 ? 'run1' : 'run2';
    if (w.mode === 'leaving') {
      const u = Math.min(1, (now - w.t0) / 1500);
      x = homeX + (exitX - homeX) * u * u; pose = run;
      if (u >= 1) w.mode = 'away';
    } else if (w.mode === 'arriving') {
      const u = Math.min(1, (now - w.t0) / 1500);
      const e = 1 - (1 - u) * (1 - u);
      x = exitX + (homeX - exitX) * e; pose = u < 1 ? run : 'sit'; bag = true; flip = true;
      if (u >= 1) {
        w.mode = 'back';
        const back = app.family.voyage?.data.back;
        if (back) app.say(`Le petit loup est rentré ${fromPlace(app.family.voyage!.dest(back.dest).name)} ! Touche-le pour ouvrir sa sacoche.`, null, 6000);
      }
    } else if (w.mode === 'away') visible = false;
    else if (w.mode === 'back') bag = true;
    el.hidden = !show || !visible || !f.u;
    if (!el.hidden) {
      const src = wolfImage(pose, bag);
      if (el.getAttribute('src') !== src) el.src = src;
      const wid = hgt * (pose === 'sit' ? 220 / 210 : 240 / 180);
      el.style.width = `${wid}px`;
      el.style.transform = `translate(${x - wid / 2}px, ${groundY - hgt}px)${flip && pose !== 'sit' ? ' scaleX(-1)' : ''}`;
      el.classList.toggle('glow', w.mode === 'back');
    }
    renderBadge(app);
    w.raf = requestAnimationFrame(loop);
  };
  wolf.raf = requestAnimationFrame(loop);

  const check = () => {
    if (!v.data.trip) return;
    if (v.check()) arrive(app);
  };
  v.events.on('change', () => app.refresh());
  window.setInterval(check, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(check, 800); });
  setTimeout(check, 1500);
}

/** Médaillon (en haut à droite de la scène) : temps restant, ou sacoche à ouvrir. */
let badgeKey = '';
function renderBadge(app: App): void {
  const v = app.family.voyage;
  if (!wolf || !v) return;
  const show = app.showingOwn && app.currentId === 'dragon' && (v.away() || !!v.data.back) && !app.root.classList.contains('lair-edit');
  wolf.badge.hidden = !show;
  if (!show) return;
  const back = !!v.data.back;
  const key = back ? 'back' : duration(v.remaining());
  if (key === badgeKey) return;
  badgeKey = key;
  wolf.badge.classList.toggle('back', back);
  wolf.badge.replaceChildren(h('img', { src: wolfImage('sit', back), alt: '' }), h('span', null, back ? 'Sacoche !' : key));
}

/** Retour : le loup revient en courant avec sa sacoche. */
function arrive(app: App): void {
  if (!wolf) return;
  wolf.mode = 'arriving'; wolf.t0 = performance.now();
  void Sound.play('chuff', { user: true, gain: 0.35, rate: 1.5 });
  app.refresh();
}

/** Choisir une destination (ou voir le voyage en cours). */
export function voyageSheet(app: App): void {
  const v = app.family.voyage, comp = app.family.companion;
  if (!v || !comp) return;
  if (v.data.back) { openBag(app); return; }
  if (v.away()) { tripSheet(app); return; }
  const act = app.family.activity;
  const steps = act?.cfg.voyage;
  openSheet('Où part le petit loup ?', close => [
    h('div', { class: 'vy-intro' }, h('img', { src: wolfImage('sit', true), alt: '' }),
      h('p', { class: 'small muted' }, `Le compagnon de ${comp.name} part explorer et revient avec des trouvailles (or, nourriture, parfois un fruit de feu) et une histoire. ${comp.name} reste avec toi pendant ce temps.`
        + (steps && act?.data.permission ? ` Tes pas raccourcissent le voyage : ${steps.shortcutMinutes} min de moins tous les ${steps.stepsPerShortcut.toLocaleString('fr-FR')} pas.` : ''))),
    ...DESTINATIONS.map(d => h('button', { class: 'vy-dest', style: { '--c1': d.colors[0], '--c2': d.colors[1] }, disabled: !v.left(), onclick: () => {
      const r = v.start(d.id);
      if (r === 'limit') { app.toast('Assez de voyages pour aujourd’hui : reviens demain'); return; }
      if (r !== 'ok') return;
      close();
      depart(app);
    } },
      h('span', { class: 'vy-time' }, icon(ICONS.clock, 14), ` ${d.hours} h`),
      h('span', { class: 'grow' }, h('strong', null, d.name), h('span', { class: 'small' }, d.teaser)),
      v.data.visited.includes(d.id) ? h('span', { class: 'chip-mini' }, 'Déjà visité') : h('span', { class: 'chip-mini gold' }, 'Nouveau'))),
    h('p', { class: 'small muted' }, `${v.left()} voyage${v.left() > 1 ? 's' : ''} possible${v.left() > 1 ? 's' : ''} aujourd’hui.`)
  ]);
}

/** Voyage en cours : où il est, quand il revient. */
function tripSheet(app: App): void {
  const v = app.family.voyage!;
  const t = v.data.trip!;
  const d = v.dest(t.dest);
  const total = t.end - t.start, left = v.remaining(), cut = v.shortcut();
  openSheet('Le petit loup est en voyage', close => [
    h('div', { class: 'vy-dest current', style: { '--c1': d.colors[0], '--c2': d.colors[1] } },
      h('span', { class: 'vy-time' }, icon(ICONS.compass, 16)),
      h('span', { class: 'grow' }, h('strong', null, d.name), h('span', { class: 'small' }, `Retour dans ${duration(left)}`),
        h('span', { class: 'vy-bar' }, h('span', { style: { width: `${Math.min(100, ((total - left) / total) * 100)}%` } })))),
    cut ? h('p', { class: 'small good' }, `Tes pas lui ont déjà fait gagner ${duration(cut)}.`) : h('p', { class: 'small muted' }, 'Marche un peu : tes pas le font revenir plus vite.'),
    h('div', { class: 'row end' }, h('button', { class: 'btn ghost', onclick: () => {
      v.recall(); close();
      if (wolf) wolf.mode = 'home';
      app.say('Le petit loup est rentré plus tôt… il n’a rien eu le temps de trouver.', null, 4000);
      app.refresh();
    } }, 'Le rappeler (sans trouvailles)'))
  ]);
}

function depart(app: App): void {
  const comp = app.family.companion!;
  if (!wolf) return;
  wolf.mode = 'leaving'; wolf.t0 = performance.now();
  void Sound.play('chuff', { user: true, gain: 0.3, rate: 1.7 });
  if (!app.sleeping) void app.view.play('happy');
  app.say(`Bon voyage, petit loup ! On t’attend, ${comp.name} et moi.`, null, 3500);
  UI.success();
  setTimeout(() => app.refresh(), 1600);
}

/** Ouvre la sacoche du loup : trouvailles et histoire. */
export function openBag(app: App): void {
  const v = app.family.voyage;
  if (!v?.data.back) return;
  const loot: Loot = v.open()!;
  if (wolf) wolf.mode = 'home';
  const d = v.dest(loot.dest);
  UI.success();
  void Sound.play('chest', { user: true });
  app.view.emit('happySparkle', 'body_center');
  const foods = Object.entries(loot.food).filter(([, n]) => (n ?? 0) > 0) as Array<[FoodId, number]>;
  openSheet(d.name, () => [
    h('p', { class: 'story intro' }, loot.story),
    h('div', { class: 'vy-loot' },
      loot.gold ? h('div', { class: 'vy-item' }, h('span', { class: 'vy-coin' }, icon(ICONS.coin, 26)), h('strong', null, `+${loot.gold} or`)) : null,
      ...foods.map(([f, n]) => {
        const art = h('span', { class: 'vy-food' }); art.innerHTML = FOOD_ART[f];
        return h('div', { class: 'vy-item' }, art, h('strong', null, `${n > 1 ? n + ' × ' : ''}${FOODS.find(x => x.id === f)?.label ?? f}`));
      })),
    loot.first ? h('p', { class: 'small muted' }, 'Premier voyage ici : un souvenir a été ajouté à l’album.') : null
  ].filter((n): n is HTMLDivElement | HTMLParagraphElement => !!n) as Node[]);
  app.refresh();
}
