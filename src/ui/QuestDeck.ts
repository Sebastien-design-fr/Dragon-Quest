// Écran principal (refonte UX, point 1) : la prochaine quête en grande carte, juste sous le dragon.
// - curseur « Glisse quand c'est fait » : un geste volontaire, impossible à déclencher par erreur ;
// - balayer la carte (gauche / droite) : voir les autres quêtes du jour ;
// - quête validée : la carte s'envole, le dragon réagit, la suivante arrive.
// Les quêtes détaillées (bonus, semaine, nouvelles) restent dans l'onglet Quêtes.
import type { Mission, MissionStatus } from '../family/model.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { art, cameraIcon, gemIcon, illustration, shrink } from './screens/MissionsScreen.js';
import { ringSvg } from './StageHud.js';
import { UI } from './Motion.js';

type Entry = { mission: Mission; status: MissionStatus };

/** Quête affichée (conservée d'un rafraîchissement à l'autre). */
let currentId = '';
/** Animation en cours : on ne reconstruit pas la pile au milieu. */
let busy = false;

export function questDeckBusy(): boolean { return busy; }

export function questDeck(app: App): HTMLElement | null {
  const book = app.family.book;
  if (!book) return null;
  const today = book.today();
  const dbl = book.doubleId();
  const open = today.filter(t => t.status === 'todo' || t.status === 'refused')
    .sort((a, b) => (a.status === 'refused' ? -1 : 0) - (b.status === 'refused' ? -1 : 0) || (a.mission.time ?? '99').localeCompare(b.mission.time ?? '99'));
  const waiting = today.filter(t => t.status === 'pending').length;
  const done = today.filter(t => t.status === 'done').length;
  const total = today.length;
  const streak = book.streak();

  const top = h('div', { class: 'qd-top' },
    h('span', { class: 'qd-kicker' }, open.length ? (open.length === 1 ? 'Dernière quête du jour' : 'Prochaine quête') : 'Aujourd’hui'),
    h('span', { class: 'grow' }),
    total ? h('span', { class: 'qd-progress' }, ringSvg(total ? done / total : 0, 22, 3), `${done}/${total}`) : null,
    h('span', { class: `qd-streak${streak ? '' : ' off'}` }, icon(ICONS.flame, 15), streak ? String(streak) : '0'));

  // ---------- Journée finie / jour de repos ----------
  if (!open.length) {
    const perfect = total > 0 && done === total;
    const card = h('article', { class: `qd-card qd-end${perfect ? ' perfect' : ''}` },
      h('div', { class: 'qd-end-ring' }, ringSvg(total ? (done + waiting) / total : 1, 76, 7), icon(perfect ? ICONS.star : waiting ? ICONS.clock : ICONS.moon, 30)),
      h('div', { class: 'qd-end-txt' },
        h('h3', null, perfect ? 'Journée parfaite !' : waiting ? 'Tout est envoyé !' : 'Jour de repos'),
        h('p', null, perfect ? `${app.family.companion?.name ?? 'Ton dragon'} est fier de toi. ${streak > 1 ? `Série de ${streak} jours !` : 'Reviens demain pour lancer ta série.'}`
          : waiting ? `${waiting} quête${waiting > 1 ? 's' : ''} en attente des parents.` : 'Pas de quête aujourd’hui. Envie de briller quand même ?'),
        h('button', { class: 'qd-link', onclick: () => app.show('missions') }, 'Quêtes bonus', h('span', null, '›'))));
    return h('section', { class: 'qd' }, top, h('div', { class: 'qd-stack' }, card));
  }

  let idx = Math.max(0, open.findIndex(t => t.mission.id === currentId));
  const stack = h('div', { class: `qd-stack depth-${Math.min(2, open.length - 1)}` });
  const dots = h('div', { class: 'qd-dots' });

  const render = (dir = 0) => {
    const t = open[idx];
    currentId = t.mission.id;
    const card = buildCard(app, t, dbl === t.mission.id, () => complete(card, t));
    stack.querySelector('.qd-card')?.remove();
    stack.append(card);
    if (dir) UI.enter(card, dir);
    dots.replaceChildren(...open.map((_, i) => h('i', { class: i === idx ? 'on' : '' })));
    browse(card);
  };

  /** Balayage horizontal de la carte : quête suivante / précédente. */
  const browse = (card: HTMLElement) => {
    if (open.length < 2) return;
    let x0 = 0, y0 = 0, dx = 0, drag = false, id = -1;
    card.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('.qd-slide, button')) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; drag = false;
    });
    card.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!drag && Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2) { drag = true; card.setPointerCapture(id); card.classList.add('dragging'); }
      if (!drag) return;
      dx = mx;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      card.classList.remove('dragging');
      if (!drag) return;
      if (Math.abs(dx) > 70) {
        const dir = dx < 0 ? 1 : -1;
        UI.tick();
        void UI.flyOut(card, -dir, 260).then(() => { idx = (idx + dir + open.length) % open.length; render(dir); });
      } else UI.springBack(card);
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  };

  const complete = async (card: HTMLElement, t: Entry, photo?: string) => {
    if (busy) return;
    busy = true;
    const parent = t.mission.validation === 'parent';
    UI.success();
    card.classList.add('qd-done');
    card.append(h('div', { class: 'qd-stamp' }, h('span', null, parent ? 'Envoyé !' : 'Bravo !')));
    await UI.wait(420);
    await UI.flyOut(card, 1, 380, true);
    currentId = open[(idx + 1) % open.length]?.mission.id ?? '';
    busy = false;
    if (parent) {
      void app.act('cheer');
      app.say(`Envoyé ! J’ai hâte que tes parents voient ça.`, null, 3500);
    }
    await app.family.book!.complete(t.mission.id, photo);
  };

  render();
  return h('section', { class: 'qd' }, top, stack, open.length > 1 ? dots : null,
    waiting ? h('div', { class: 'qd-wait' }, icon(ICONS.clock, 14), `${waiting} en attente des parents`) : null);

  function buildCard(app: App, t: Entry, x2: boolean, onDone: () => void): HTMLElement {
    const m = t.mission;
    const mult = x2 ? 2 : 1;
    const parent = m.validation === 'parent';
    const card = h('article', { class: `qd-card${t.status === 'refused' ? ' refused' : ''}${x2 ? ' x2' : ''}` });
    const photoBtn = parent ? h('button', { class: 'qd-photo', 'aria-label': 'Valider avec une photo', onclick: async () => {
      const input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } }) as HTMLInputElement;
      document.body.append(input);
      const file = await new Promise<File | null>(res => { input.onchange = () => res(input.files?.[0] ?? null); input.click(); setTimeout(() => res(null), 120000); });
      input.remove();
      if (!file) return;
      const p = await shrink(file);
      await complete(card, t, p ?? undefined);
    } }, cameraIcon()) : null;
    card.append(
      h('div', { class: 'qd-main' },
        art(illustration(m.title), 'qd-ill'),
        h('div', { class: 'qd-head' },
          t.status === 'refused' ? h('span', { class: 'qd-tag red' }, 'À refaire') : x2 ? h('span', { class: 'qd-tag gold' }, 'Récompense ×2') : null,
          h('h3', { class: 'qd-title' }, m.title),
          h('div', { class: 'qd-meta' },
            m.time ? h('span', null, icon(ICONS.clock, 13), `avant ${m.time.replace(':', ' h ')}`) : null,
            parent ? h('span', null, icon(ICONS.shield, 13), 'un parent valide') : null)),
        photoBtn),
      h('div', { class: 'qd-rew' },
        m.xp ? h('span', { class: 'qd-r xp' }, icon(ICONS.star, 14), `+${m.xp * mult}`, h('small', null, 'XP')) : null,
        m.gold ? h('span', { class: 'qd-r or' }, icon(ICONS.coin, 14), `+${m.gold * mult}`, h('small', null, 'or')) : null,
        h('span', { class: 'qd-r gem', title: 'Gemmes : à échanger contre de vraies récompenses' }, gemIcon(), `+${m.optional ? 2 : 1}`)),
      slider(onDone, t.status === 'refused' ? 'Glisse quand c’est refait' : 'Glisse quand c’est fait'));
    return card;
  }
}

/** Curseur à faire glisser jusqu'au bout pour valider. */
function slider(onDone: () => void, label: string): HTMLElement {
  const knob = h('span', { class: 'qd-knob', role: 'slider', 'aria-label': label, tabindex: '0', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, icon(ICONS.check, 22));
  const fill = h('span', { class: 'qd-fill' });
  const text = h('span', { class: 'qd-slide-txt' }, label, h('span', { class: 'qd-arrows' }, '›››'));
  const track = h('div', { class: 'qd-slide' }, fill, text, knob);
  let id = -1, x0 = 0, max = 0, x = 0, last = 0;
  const set = (v: number) => {
    x = Math.max(0, Math.min(max, v));
    const k = max ? x / max : 0;
    knob.style.transform = `translateX(${x}px)`;
    fill.style.width = `${x + knob.offsetWidth}px`;
    text.style.opacity = String(Math.max(0, 1 - k * 1.6));
    knob.setAttribute('aria-valuenow', String(Math.round(k * 100)));
    // petits crans de vibration en glissant
    const step = Math.floor(k * 6);
    if (step !== last) { last = step; UI.tick(); }
  };
  knob.addEventListener('pointerdown', e => {
    id = e.pointerId; knob.setPointerCapture(id);
    max = track.clientWidth - knob.offsetWidth - 8;
    x0 = e.clientX - x;
    track.classList.add('active');
  });
  knob.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - x0); });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    track.classList.remove('active');
    if (max && x / max > 0.82) { set(max); track.classList.add('ok'); onDone(); }
    else { knob.style.transition = fill.style.transition = 'transform .35s cubic-bezier(.3,1.6,.5,1), width .35s cubic-bezier(.3,1.6,.5,1)'; set(0); setTimeout(() => { knob.style.transition = fill.style.transition = ''; }, 360); }
  };
  knob.addEventListener('pointerup', end);
  knob.addEventListener('pointercancel', end);
  // accessibilité : Entrée ou espace valident aussi
  knob.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); max = track.clientWidth - knob.offsetWidth - 8; set(max); track.classList.add('ok'); onDone(); } });
  return track;
}
