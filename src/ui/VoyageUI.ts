// Le loup compagnon : il vit dans la grotte à côté du dragon et part en quête pour lui. On le touche pour l'envoyer
// explorer (et, la première fois, lui donner un nom) ; il part en courant, un médaillon indique son retour, puis il
// revient avec sa sacoche pleine. Le dragon reste là pendant tout le voyage : on continue à s'en occuper.
import { DESTINATIONS, WOLF_ACCESSORIES, duration, fromPlace, type Loot } from '../family/Voyage.js';
import { FOOD_ART } from './StageHud.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { UI } from './Motion.js';
import { openSheet } from './screens/common.js';
import { Sound } from '../engine/Sound.js';
import { FOODS, type FoodId } from '../family/Companion.js';
import { wolfImage } from './WolfArt.js';
import { WolfSprite } from './WolfSprite.js';
import { Assets } from '../engine/AssetManager.js';
import { floatReward } from './Reactions.js';
import { unlocked } from './Unlocks.js';

/** Place du loup dans la scène (unités de scène, voir DecorLayer) : à gauche du dragon, sur le sol. */
const SPOT = { dx: -0.34, dy: 0.008, h: 0.17 };

let wolf: { el: HTMLCanvasElement; sprite: WolfSprite; badge: HTMLButtonElement; raf: number; mode: 'home' | 'leaving' | 'away' | 'back' | 'arriving' | 'play'; t0: number; happyUntil: number; nextPlay: number; x: number; y: number; w: number } | null = null;

export function installVoyage(app: App): void {
  const v = app.family.voyage, comp = app.family.companion;
  const host = app.root.querySelector<HTMLElement>('.stage-view');
  if (!v || !comp || !host) return;
  comp.extraNotifs.push(() => v.returnNotif());

  const sprite = new WolfSprite();
  const el = sprite.canvas;
  el.className = 'wolf';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Le loup compagnon');
  const badge = h('button', { class: 'vy-badge', 'aria-label': 'Voyage du petit loup', onclick: (e: Event) => { e.stopPropagation(); voyageSheet(app); } }) as HTMLButtonElement;
  host.append(el, badge);
  wolf = { el, sprite, badge, raf: 0, mode: v.away() ? 'away' : v.data.back ? 'back' : 'home', t0: 0, happyUntil: 0, nextPlay: performance.now() + 40000, x: 0, y: 0, w: 0 };
  el.addEventListener('pointerdown', e => { e.stopPropagation(); });
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (!wolf) return;
    if (wolf.mode === 'back') { openBag(app); return; }
    if (wolf.mode === 'home' || wolf.mode === 'play') { wolf.mode = 'home'; wolfSheet(app); }
  });

  const loop = (now: number) => {
    if (!wolf) return;
    const w = wolf;
    const show = app.showingOwn && app.currentId === 'dragon' && !app.root.classList.contains('lair-edit') && unlocked(app, 'wolf');
    const f = app.view.decor.frame;
    const r = app.view.canvas.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const s = r.width / (app.view.canvas.width || 1);
    const hgt = SPOT.h * f.u * s;
    const homeX = r.left - hr.left + (f.ox + SPOT.dx * f.u) * s;
    const groundY = r.top - hr.top + (f.oy + SPOT.dy * f.u) * s;
    const exitX = hr.width + hgt * 1.6;
    let x = homeX, running = false, bag = false, visible = true, mirror = false;
    if (w.mode === 'leaving') {
      const u = Math.min(1, (now - w.t0) / 1500);
      x = homeX + (exitX - homeX) * u * u; running = true;
      if (u >= 1) w.mode = 'away';
    } else if (w.mode === 'arriving') {
      const u = Math.min(1, (now - w.t0) / 1500);
      const e = 1 - (1 - u) * (1 - u);
      x = exitX + (homeX - exitX) * e; running = u < 1; bag = true; mirror = u < 1;
      if (u >= 1) {
        w.mode = 'back';
        const back = app.family.voyage?.data.back;
        if (back) app.say(app.family.voyage!.fill(`{L} est rentré ${fromPlace(app.family.voyage!.dest(back.dest).name)} ! Touche-le pour ouvrir sa sacoche.`), null, 6000);
      }
    } else if (w.mode === 'play') {
      // il trotte jusqu'au dragon, tourne autour de ses pattes et revient ; le dragon le suit du regard
      const u = Math.min(1, (now - w.t0) / 4200);
      const reach = f.u * s * 0.2;
      const k = u < 0.45 ? u / 0.45 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      x = homeX + reach * (k < 1 ? k * k * (3 - 2 * k) : 1); running = u < 0.45 || u > 0.6; mirror = u > 0.6;
      if (u > 0.45 && u < 0.6) w.happyUntil = now + 300;
      if (u >= 1) { w.mode = 'home'; w.nextPlay = now + 50000 + Math.random() * 60000; app.view.lookAt(null); }
      else if (!app.sleeping) app.view.lookAt(hr.left + x, hr.top + groundY - hgt * 0.5);
      if (u > 0.47 && u < 0.5 && !app.sleeping && app.view.animator.baseId?.startsWith('idle')) void app.view.play('happy');
    } else if (w.mode === 'away') visible = false;
    else if (w.mode === 'back') bag = true;
    // de temps en temps, il va jouer avec le dragon (s'il est réveillé et que personne ne le touche)
    if (w.mode === 'home' && show && !app.sleeping && now > w.nextPlay && !document.querySelector('.sheet')) { w.mode = 'play'; w.t0 = now; }
    el.hidden = !show || !visible || !f.u;
    if (!el.hidden) {
      const wid = hgt * w.sprite.aspect;
      w.sprite.draw(wid, hgt, now / 1000, { run: running, mirror, bag, happy: w.mode === 'back' || now < w.happyUntil, sleep: app.sleeping && !running, wear: Object.values(app.family.voyage?.data.wolfWear ?? {}) as string[] });
      el.style.transform = `translate(${x - wid / 2}px, ${groundY - hgt * 1.12}px)`;
      w.x = x; w.y = groundY - hgt; w.w = wid;
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
  v.events.on('wolfLevel', lv => setTimeout(() => { app.toast(`${v.wolfName(true)} passe au niveau ${lv} ! Ses quêtes sont plus rapides et plus riches.`); hearts(app, 5); }, 600));
  window.setInterval(check, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(check, 800); });
  setTimeout(check, 1500);
}

/** Petits cœurs qui s'envolent au-dessus du loup. */
function hearts(app: App, n = 3): void {
  const host = app.root.querySelector<HTMLElement>('.stage-view');
  if (!wolf || !host || wolf.el.hidden) return;
  for (let i = 0; i < n; i++) {
    const el = h('span', { class: 'wolf-heart' }, icon(ICONS.heart, 16));
    el.style.left = `${wolf.x + (Math.random() - 0.5) * wolf.w * 0.5}px`;
    el.style.top = `${wolf.y}px`;
    host.append(el);
    el.animate([{ transform: 'translate(-50%, 0) scale(.5)', opacity: 0 }, { transform: 'translate(-50%, -20px) scale(1.1)', opacity: 1, offset: 0.3 }, { transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 30}px), -60px) scale(.9)`, opacity: 0 }],
      { duration: 1300, delay: i * 180, easing: 'ease-out', fill: 'both' }).onfinish = () => el.remove();
  }
}

/** Le loup : le caresser, lui donner une friandise, l'envoyer en quête. */
export function wolfSheet(app: App): void {
  const v = app.family.voyage, comp = app.family.companion;
  if (!v || !comp) return;
  if (!v.hasWolfName()) { nameSheet(app, () => wolfSheet(app)); return; }
  const lv = v.wolfLevel();
  openSheet(v.wolfName(true), close => [
    h('div', { class: 'vy-intro' }, h('img', { src: Assets.art('companions/wolf') ?? wolfImage('sit', false), alt: '' }),
      h('div', { class: 'grow' },
        h('div', { class: 'item-name' }, `Niveau ${lv.level}`),
        h('div', { class: 'bar bond-bar' }, h('div', { class: 'fill', style: { width: `${Math.round(lv.progress * 100)}%` } })),
        h('p', { class: 'small muted' }, lv.next === null ? 'Niveau maximum : le meilleur chercheur de trésors !' : `Chaque quête, caresse et friandise le fait progresser. Au niveau suivant, ses quêtes sont plus rapides et plus riches.`))),
    h('div', { class: 'wf-actions' },
      h('button', { class: 'btn primary', onclick: () => {
        close(); v.petWolf();
        if (wolf) wolf.happyUntil = performance.now() + 2500;
        void Sound.play('chuff', { user: true, gain: 0.3, rate: 1.6 });
        setTimeout(() => hearts(app, 3), 250);
        navigator.vibrate?.(15);
      } }, icon(ICONS.hand, 18), ' Caresser'),
      h('button', { class: 'btn', onclick: () => {
        const r = v.treatWolf();
        if (r === 'full') { app.toast(`${v.wolfName(true)} a eu assez de friandises aujourd’hui`); return; }
        if (r === 'none') { app.toast('Plus de ration : le garde-manger se remplit demain matin'); return; }
        close();
        if (wolf) wolf.happyUntil = performance.now() + 3000;
        setTimeout(() => hearts(app, 4), 250);
        app.say(`${v.wolfName(true)} croque sa friandise. Il remue la queue !`, null, 3500);
      } }, icon(ICONS.meat, 18), ' Friandise'),
      h('button', { class: 'btn', onclick: () => { close(); setTimeout(() => voyageSheet(app), 250); } }, icon(ICONS.compass, 18), v.away() ? ' Sa quête' : ' En quête !')),
    h('div', { class: 'row end' },
      h('button', { class: 'btn small-btn', onclick: () => { close(); setTimeout(() => accessoriesSheet(app), 250); } }, icon(ICONS.star, 14), ' Accessoires'),
      h('button', { class: 'btn ghost small-btn', onclick: () => { close(); nameSheet(app); } }, 'Renommer'))
  ]);
}

/** Accessoires du loup : acheter, mettre, retirer. */
export function accessoriesSheet(app: App): void {
  const v = app.family.voyage;
  if (!v) return;
  openSheet(`Les accessoires de ${v.wolfName()}`, close => {
    const list = h('div', { class: 'acc-list' });
    const render = () => list.replaceChildren(...WOLF_ACCESSORIES.map(a => {
      const owned = v.owns(a.id), worn = v.wearing(a.id);
      return h('button', { class: `acc-item${worn ? ' worn' : ''}`, onclick: () => {
        const r = v.buyAccessory(a.id);
        if (r === 'gold') { app.toast(`Il faut ${a.price} or`); return; }
        if (r === 'ok') { UI.success(); app.toast(`${a.label} : ${v.wolfName(true)} le porte tout de suite !`); if (wolf) wolf.happyUntil = performance.now() + 2500; }
        render();
      } },
        h('span', { class: 'acc-dot', style: a.color ? { background: a.color } : {} }, icon(a.slot === 'dos' ? ICONS.inventory : a.slot === 'medaille' ? ICONS.star : ICONS.heart, 16)),
        h('span', { class: 'grow' }, h('strong', null, a.label), h('span', { class: 'small muted' }, a.effect)),
        h('span', { class: 'acc-state' }, worn ? 'Porté' : owned ? 'Mettre' : h('span', null, icon(ICONS.coin, 13), ` ${a.price}`)));
    }));
    render();
    return [h('p', { class: 'small muted' }, `Un accessoire par place (cou, médaille, dos). Touche un accessoire acheté pour le mettre ou l’enlever. Ton or : ${app.state.data.gold}.`), list,
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: close }, 'Terminé'))];
  });
}

/** Médaillon (en haut à droite de la scène) : temps restant, ou sacoche à ouvrir. */
let badgeKey = '';
function renderBadge(app: App): void {
  const v = app.family.voyage;
  if (!wolf || !v) return;
  const show = app.showingOwn && app.currentId === 'dragon' && (v.away() || !!v.data.back) && !app.root.classList.contains('lair-edit') && unlocked(app, 'wolf');
  wolf.badge.hidden = !show;
  if (!show) return;
  const back = !!v.data.back;
  const key = back ? 'back' : duration(v.remaining());
  if (key === badgeKey) return;
  badgeKey = key;
  wolf.badge.classList.toggle('back', back);
  wolf.badge.replaceChildren(h('img', { src: Assets.art('companions/wolf') ?? wolfImage('sit', back), alt: '' }), h('span', null, back ? 'Sacoche !' : key));
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
  if (!unlocked(app, 'wolf')) { app.toast('Le loup compagnon arrive au niveau 3 : continue tes quêtes !'); return; }
  if (v.data.back) { openBag(app); return; }
  if (v.away()) { tripSheet(app); return; }
  if (!v.hasWolfName()) { nameSheet(app, () => voyageSheet(app)); return; }
  const act = app.family.activity;
  const steps = act?.cfg.voyage;
  openSheet(`Où part ${v.wolfName(true)} ?`, close => [
    h('div', { class: 'vy-intro' }, h('img', { src: Assets.art('companions/wolf') ?? wolfImage('sit', true), alt: '' }),
      h('p', { class: 'small muted' }, `Le compagnon de ${comp.name} part en quête pour lui et revient avec des trouvailles (or, nourriture, parfois un fruit de feu) et une histoire. ${comp.name} reste avec toi pendant ce temps.`
        + (steps && act?.data.permission ? ` Tes pas raccourcissent le voyage : ${steps.shortcutMinutes} min de moins tous les ${steps.stepsPerShortcut.toLocaleString('fr-FR')} pas.` : ''))),
    ...DESTINATIONS.map(d => (d.minLevel ?? 1) > v.wolfLevel().level ? h('div', { class: 'vy-dest locked', style: { '--c1': d.colors[0], '--c2': d.colors[1] } },
      h('span', { class: 'vy-time' }, icon(ICONS.lock, 14), ` ${d.hours} h`),
      h('span', { class: 'grow' }, h('strong', null, d.name), h('span', { class: 'small' }, `Au niveau ${d.minLevel} de ${v.wolfName()}`))) : h('button', { class: 'vy-dest', style: { '--c1': d.colors[0], '--c2': d.colors[1] }, disabled: !v.left(), onclick: () => {
      const r = v.start(d.id);
      if (r === 'limit') { app.toast('Assez de voyages pour aujourd’hui : reviens demain'); return; }
      if (r !== 'ok') return;
      close();
      depart(app);
    } },
      h('span', { class: 'vy-time' }, icon(ICONS.clock, 14), ` ${d.hours} h`),
      h('span', { class: 'grow' }, h('strong', null, d.name), h('span', { class: 'small' }, d.teaser)),
      v.data.visited.includes(d.id) ? h('span', { class: 'chip-mini' }, 'Déjà visité') : h('span', { class: 'chip-mini gold' }, 'Nouveau'))),
    h('div', { class: 'row' },
      h('p', { class: 'small muted grow' }, `${v.left()} voyage${v.left() > 1 ? 's' : ''} possible${v.left() > 1 ? 's' : ''} aujourd’hui.`),
      h('button', { class: 'btn ghost small-btn', onclick: () => { close(); nameSheet(app); } }, 'Renommer'))
  ]);
}

/** Donner (ou changer) le nom du loup. */
export function nameSheet(app: App, then?: () => void): void {
  const v = app.family.voyage, comp = app.family.companion;
  if (!v || !comp) return;
  const input = h('input', { type: 'text', maxlength: '18', placeholder: 'Fenrir, Lupin, Akela…', value: v.data.wolfName ?? '', 'aria-label': 'Nom du loup' }) as HTMLInputElement;
  const ideas = ['Fenrir', 'Lupin', 'Akela', 'Sköll', 'Hati', 'Ombre', 'Croc', 'Givre'];
  openSheet(v.hasWolfName() ? 'Renommer le loup' : 'Le compagnon de ' + comp.name, close => [
    h('div', { class: 'vy-intro' }, h('img', { src: Assets.art('companions/wolf') ?? wolfImage('sit', false), alt: '' }),
      h('p', { class: 'small muted' }, v.hasWolfName() ? 'Choisis-lui un nouveau nom.' : `Ce petit loup vit avec ${comp.name} et part en quête pour lui. Comment s’appelle-t-il ?`)),
    input,
    h('div', { class: 'vy-names' }, ...ideas.map(n => h('button', { class: 'chip-mini', onclick: () => { input.value = n; } }, n))),
    h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => {
      if (!input.value.trim()) { input.focus(); return; }
      v.setWolfName(input.value);
      close();
      UI.success();
      if (wolf) wolf.happyUntil = performance.now() + 2500;
      app.say(`${v.wolfName(true)} ! Il adore son nom.`, null, 4000);
      if (then) setTimeout(then, 500);
    } }, 'Valider'))
  ]);
}

/** Voyage en cours : où il est, quand il revient. */
function tripSheet(app: App): void {
  const v = app.family.voyage!;
  const t = v.data.trip!;
  const d = v.dest(t.dest);
  const total = t.end - t.start, left = v.remaining(), cut = v.shortcut();
  openSheet(`${v.wolfName(true)} est en voyage`, close => [
    h('div', { class: 'vy-dest current', style: { '--c1': d.colors[0], '--c2': d.colors[1] } },
      h('span', { class: 'vy-time' }, icon(ICONS.compass, 16)),
      h('span', { class: 'grow' }, h('strong', null, d.name), h('span', { class: 'small' }, `Retour dans ${duration(left)}`),
        h('span', { class: 'vy-bar' }, h('span', { style: { width: `${Math.min(100, ((total - left) / total) * 100)}%` } })))),
    cut ? h('p', { class: 'small good' }, `Tes pas lui ont déjà fait gagner ${duration(cut)}.`) : h('p', { class: 'small muted' }, 'Marche un peu : tes pas le font revenir plus vite.'),
    h('div', { class: 'row end' }, h('button', { class: 'btn ghost', onclick: () => {
      v.recall(); close();
      if (wolf) wolf.mode = 'home';
      app.say(v.fill('{L} est rentré plus tôt… il n’a rien eu le temps de trouver.'), null, 4000);
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
  app.say(`Bon voyage, ${app.family.voyage?.data.wolfName ?? 'petit loup'} ! On t’attend, ${comp.name} et moi.`, null, 3500);
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
  floatReward(app, 0, loot.gold, 400);
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
