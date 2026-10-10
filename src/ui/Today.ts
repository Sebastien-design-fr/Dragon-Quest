// « Aujourd'hui » : une ligne de pastilles sous la scène (soins du jour, quêtes, pas, loup, coffre),
// et la routine du jour : nourrir, laver, jouer, envoyer le loup, coucher. On sait toujours quoi faire ensuite.
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { gamesSheet } from './CareSheets.js';
import { voyageSheet } from './VoyageUI.js';
import { stepsCard } from './ActivityUI.js';
import { openSheet } from './screens/common.js';
import { surprisesFor } from '../family/Surprises.js';
import { openChestOverlay } from './SurprisesUI.js';
import { floatReward } from './Reactions.js';
import { ringSvg } from './StageHud.js';
import { todayKey } from '../family/model.js';
import { isNight } from '../family/Companion.js';
import { duration } from '../family/Voyage.js';
import { UI } from './Motion.js';
import { unlocked } from './Unlocks.js';

export interface RoutineItem { id: 'feed' | 'wash' | 'play' | 'wolf' | 'sleep'; label: string; hint: string; icon: string; done: boolean; run: () => void }

const evening = () => isNight() || new Date().getHours() >= 20;

/** Les 5 soins du jour, dans l'ordre d'une journée. */
export function routine(app: App): RoutineItem[] {
  const comp = app.family.companion;
  if (!comp) return [];
  const d = comp.data, k = todayKey(), v = app.family.voyage;
  const she = comp.mode === 'parent';
  const go = (f: () => void) => () => { if (app.currentId !== 'dragon') app.show('dragon'); setTimeout(f, 250); };
  const items: RoutineItem[] = [
    { id: 'feed', label: 'Nourrir', hint: 'Lance-lui à manger', icon: ICONS.meat, done: d.fedDay === k, run: go(() => app.stageHud.openTray()) },
    { id: 'wash', label: 'Laver', hint: 'Frotte ses écailles', icon: ICONS.drop, done: d.washedDay === k || d.clean >= 95, run: go(() => { if (app.careMode !== 'wash') app.stageHud.action('wash'); }) },
    { id: 'play', label: 'Jouer', hint: 'Un mini-jeu ensemble', icon: ICONS.game, done: !!d.played, run: go(() => gamesSheet(app)) },
    { id: 'wolf', label: v?.hasWolfName() ? `Envoyer ${v.wolfName()}` : 'Envoyer le loup', hint: 'Une quête du loup', icon: ICONS.compass, done: (v?.data.day === k && (v?.data.count ?? 0) > 0), run: go(() => voyageSheet(app)) },
    { id: 'sleep', label: she ? 'La coucher' : 'Le coucher', hint: 'Le soir, à partir de 20 h', icon: ICONS.moon, done: !!d.tucked,
      run: go(() => { if (evening()) app.sleepButton(); else app.toast('Le coucher, c’est ce soir à partir de 20 h'); }) }
  ];
  return v && unlocked(app, 'wolf') ? items : items.filter(i => i.id !== 'wolf');
}

/** Toutes faites : récompense (une fois par jour), fêtée sur la scène. */
export function checkRoutine(app: App): void {
  const comp = app.family.companion;
  if (!comp) return;
  const items = routine(app);
  if (!items.length || !items.every(i => i.done)) return;
  const r = comp.claimRoutine();
  if (!r) return;
  UI.success();
  app.view.emit('happySparkle', 'body_center');
  void app.act('happy');
  floatReward(app, r.xp, r.gold, 300);
  app.toast(`Routine du jour complète ! ${r.xp ? `+${r.xp} XP, ` : ''}+${r.gold} or`);
}

export function routineSheet(app: App): void {
  const comp = app.family.companion;
  if (!comp) return;
  openSheet(`La journée de ${comp.name}`, close => {
    const items = routine(app);
    const n = items.filter(i => i.done).length;
    return [
      h('p', { class: 'small muted' }, comp.data.routineDay === todayKey()
        ? 'Routine complète aujourd’hui. Bravo !'
        : `${n} soin${n > 1 ? 's' : ''} sur ${items.length}. Tout faire rapporte un petit bonus${app.isParent ? ' (XP et or)' : ' (or et amitié)'}.`),
      ...items.map(i => h('button', { class: `rt-item${i.done ? ' done' : ''}`, onclick: () => { close(); i.run(); } },
        h('span', { class: 'rt-ico' }, icon(i.done ? ICONS.check : i.icon, 20)),
        h('span', { class: 'grow' }, h('strong', null, i.label), h('span', { class: 'small muted' }, i.done ? 'Fait' : i.hint)),
        i.done ? null : h('span', { class: 'chev' }, '›')))
    ];
  });
}

/** Ligne « Aujourd'hui » : chaque pastille ouvre directement ce qu'il faut. */
export function todayStrip(app: App): HTMLElement | null {
  const comp = app.family.companion;
  if (!comp) return null;
  const chips: HTMLElement[] = [];
  const chip = (cls: string, lead: Node, label: string, sub: string, on: () => void) =>
    h('button', { class: `td-chip ${cls}`, onclick: on }, h('span', { class: 'td-lead' }, lead), h('span', { class: 'td-txt' }, h('strong', null, label), h('small', null, sub)));

  // soins du jour
  const items = routine(app);
  const done = items.filter(i => i.done).length;
  const ring = h('span', { class: 'td-ring' }, ringSvg(items.length ? done / items.length : 0, 30, 4), done >= items.length ? icon(ICONS.check, 14) : icon(ICONS.heart, 14));
  chips.push(chip(done === items.length ? 'ok' : 'todo', ring, 'Soins', `${done} / ${items.length}`, () => routineSheet(app)));

  // quêtes (enfant) ou journée de l'enfant (parent)
  const book = app.family.book, hub = app.family.hub;
  if (book) {
    const t = book.today();
    const d = t.filter(x => x.status === 'done').length;
    chips.push(chip(t.length && d >= t.length ? 'ok' : '', icon(ICONS.missions, 18), 'Quêtes', t.length ? `${d} / ${t.length}` : 'repos', () => app.show('missions')));
  } else if (hub) {
    const cid = hub.childIds()[0];
    const snap = cid ? hub.child(cid)?.snapshot : null;
    const pending = hub.pendingList().length;
    if (snap) {
      const t = Object.values(snap.date === todayKey() ? snap.today : {});
      const d = t.filter(s => s === 'done').length;
      chips.push(chip(pending ? 'alert' : '', icon(ICONS.shield, 18), snap.name, pending ? `${pending} à valider` : `${d} / ${t.length} quêtes`, () => app.show('validations')));
    }
  }

  // pas
  const act = app.family.activity;
  if (act) {
    const a = act.data;
    chips.push(chip('', icon(ICONS.foot, 18), 'Pas', a.permission && a.available ? `${(a.steps / 1000).toFixed(1).replace('.', ',')} k` : 'activer', () => {
      openSheet('Pas du jour', () => { const c = stepsCard(app); return c ? [c] : []; });
    }));
  }

  // loup
  const v = app.family.voyage;
  if (v && unlocked(app, 'wolf')) {
    const name = v.hasWolfName() ? v.wolfName(true) : 'Le loup';
    const sub = v.data.back ? 'sacoche !' : v.away() ? duration(v.remaining()) : 'prêt';
    chips.push(chip(v.data.back ? 'alert' : '', icon(ICONS.compass, 18), name, sub, () => voyageSheet(app)));
  }

  // coffre du jour (seulement s'il attend)
  const s = surprisesFor(app);
  if (s.dailyChest().available) chips.push(chip('alert', icon(ICONS.gift, 18), 'Coffre', 'à ouvrir', () => openChestOverlay(app, () => app.refresh())));

  return h('div', { class: 'td-strip', role: 'toolbar', 'aria-label': 'Aujourd’hui' }, ...chips);
}
