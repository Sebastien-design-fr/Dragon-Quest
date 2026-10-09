// Voyages : choix de la destination, départ en vol, scène vide pendant l'absence, retour avec le sac de trouvailles.
import { DESTINATIONS, duration, fromPlace, type Loot } from '../family/Voyage.js';
import { FOOD_ART } from './StageHud.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { UI } from './Motion.js';
import { openSheet } from './screens/common.js';
import { Sound } from '../engine/Sound.js';
import { FOODS, type FoodId } from '../family/Companion.js';

const OFF = { x: 1.6, scale: 0.6 };
const HOME = { x: 0, scale: 1 };

/** Le dragon est-il parti en voyage (scène vide) ? */
export function traveling(app: App): boolean { return !!app.family.voyage?.away(); }

/** Place le dragon hors de la scène (ou le ramène) sans animation. */
export function placeNow(app: App, away: boolean): void {
  const p = away ? OFF : HOME;
  app.view.placeTarget = { ...p };
  app.view.placement = { ...p };
}

export function installVoyage(app: App): void {
  const v = app.family.voyage, comp = app.family.companion;
  if (!v || !comp) return;
  comp.extraNotifs.push(() => v.returnNotif());
  if (v.away() && app.showingOwn) placeNow(app, true);
  const check = () => {
    if (!v.data.trip) return;
    const loot = v.check();
    if (loot) arrive(app);
    else app.stageHud?.render();
  };
  v.events.on('change', () => app.refresh());
  window.setInterval(check, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(check, 800); });
  setTimeout(check, 1500);
}

/** Retour : il revient en volant et se pose ; son sac attend d'être ouvert. */
function arrive(app: App): void {
  if (!app.showingOwn) return;
  app.view.placement = { ...OFF };
  app.view.placeTarget = { ...HOME };
  void app.view.play('hover');
  void Sound.play('wings', { user: true });
  setTimeout(() => {
    void app.view.play('happy');
    app.say(`Me revoilà ! Regarde ce que j’ai rapporté…`, null, 5000);
    app.stageHud?.render();
  }, 1800);
}

/** Choisir une destination. */
export function voyageSheet(app: App): void {
  const v = app.family.voyage, comp = app.family.companion;
  if (!v || !comp) return;
  if (v.data.back) { openBag(app); return; }
  const act = app.family.activity;
  const steps = act?.cfg.voyage;
  const she = comp.mode === 'parent';
  openSheet(`Où part ${comp.name} ?`, close => [
    h('p', { class: 'small muted' }, `${she ? 'Elle' : 'Il'} part seul${she ? 'e' : ''} explorer et revient avec des trouvailles (or, nourriture, parfois un fruit de feu) et une histoire.`
      + (steps && act?.data.permission ? ` Tes pas pendant son absence raccourcissent le voyage : ${steps.shortcutMinutes} min de moins tous les ${steps.stepsPerShortcut.toLocaleString('fr-FR')} pas.` : '')),
    ...DESTINATIONS.map(d => h('button', { class: 'vy-dest', style: { '--c1': d.colors[0], '--c2': d.colors[1] }, disabled: !v.left(), onclick: () => {
      const r = v.start(d.id);
      if (r === 'limit') { app.toast('Assez de voyages pour aujourd’hui : reviens demain'); return; }
      if (r !== 'ok') return;
      close();
      depart(app, d.name);
    } },
      h('span', { class: 'vy-time' }, icon(ICONS.clock, 14), ` ${d.hours} h`),
      h('span', { class: 'grow' }, h('strong', null, d.name), h('span', { class: 'small' }, d.teaser)),
      v.data.visited.includes(d.id) ? h('span', { class: 'chip-mini' }, 'Déjà visité') : h('span', { class: 'chip-mini gold' }, 'Nouveau'))),
    h('p', { class: 'small muted' }, `${v.left()} voyage${v.left() > 1 ? 's' : ''} possible${v.left() > 1 ? 's' : ''} aujourd’hui.`)
  ]);
}

function depart(app: App, name: string): void {
  const comp = app.family.companion!;
  if (app.sleeping) app.toggleSleep(false);
  app.say(`En route pour ${name.replace(/^L(a|e|es) /, m => m.toLowerCase()).replace(/^L’/, 'l’')} !`, null, 3000);
  void app.view.play('hover');
  void Sound.play('wings', { user: true });
  setTimeout(() => { app.view.placeTarget = { ...OFF }; }, 600);
  setTimeout(() => { app.stageHud?.render(); app.refresh(); }, 1800);
  UI.success();
  void comp;
}

/** Bandeau sur la scène pendant le voyage (à la place des boutons de soin). */
export function travelStrip(app: App): HTMLElement | null {
  const v = app.family.voyage, comp = app.family.companion;
  if (!v || !comp) return null;
  if (v.data.back) return h('div', { class: 'vy-strip back' },
    h('span', { class: 'grow' }, h('strong', null, `${comp.name} est rentré${comp.mode === 'parent' ? 'e' : ''} !`), h('span', { class: 'small' }, fromPlace(v.dest(v.data.back.dest).name).replace(/^d/, 'D'))),
    h('button', { class: 'btn primary small-btn', onclick: () => openBag(app) }, icon(ICONS.gift, 16), ' Ouvrir son sac'));
  if (!v.away()) return null;
  const t = v.data.trip!;
  const d = v.dest(t.dest);
  const total = t.end - t.start, left = v.remaining();
  const cut = v.shortcut();
  return h('div', { class: 'vy-strip', style: { '--c1': d.colors[0] } },
    h('span', { class: 'vy-ico' }, icon(ICONS.compass, 22)),
    h('span', { class: 'grow' },
      h('strong', null, `${comp.name} explore ${d.name.replace(/^L(a|e|es) /, m => m.toLowerCase()).replace(/^L’/, 'l’')}`),
      h('span', { class: 'small' }, `Retour dans ${duration(left)}${cut ? ` · ${duration(cut)} gagnées grâce à tes pas` : ''}`),
      h('span', { class: 'vy-bar' }, h('span', { style: { width: `${Math.min(100, ((total - left) / total) * 100)}%` } }))),
    h('button', { class: 'btn ghost small-btn', onclick: () => {
      v.recall();
      arrive(app);
      setTimeout(() => app.say(v.fill('Je suis rentré{e} plus tôt… je n’ai rien eu le temps de trouver.'), null, 4000), 1900);
    } }, 'Rappeler'));
}

/** Ouvre le sac de retour : trouvailles et histoire. */
export function openBag(app: App): void {
  const v = app.family.voyage;
  if (!v?.data.back) return;
  const loot: Loot = v.open()!;
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
