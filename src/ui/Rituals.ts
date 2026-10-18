// Rituels du quotidien : le soir on le couvre d'une couverture (la lumière baisse, il rêve),
// le matin on ouvre les rideaux de la grotte pour le réveiller (il raconte son rêve).
import type { App } from './App.js';
import { h } from './dom.js';
import { todayKey } from '../family/model.js';
import { sayFor } from '../family/Thoughts.js';
import { dreamContextFrom, dreamFor, surprisesFor } from '../family/Surprises.js';

const QUILT = `<svg viewBox="0 0 240 120" preserveAspectRatio="none"><defs>
<linearGradient id="qg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3a8f"/><stop offset="1" stop-color="#22215a"/></linearGradient>
<pattern id="qp" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 20h40M20 0v40" stroke="#d9a84a" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M20 12l2 5 5 .5-4 3 1.2 5-4.2-2.6-4.2 2.6 1.2-5-4-3 5-.5z" fill="#f2d48a" fill-opacity=".55"/></pattern></defs>
<path d="M6 10c40-8 188-8 228 0 4 30 4 70 0 100-40 8-188 8-228 0-4-30-4-70 0-100z" fill="url(#qg)"/>
<path d="M6 10c40-8 188-8 228 0 4 30 4 70 0 100-40 8-188 8-228 0-4-30-4-70 0-100z" fill="url(#qp)"/>
<path d="M6 10c40-8 188-8 228 0 4 30 4 70 0 100-40 8-188 8-228 0-4-30-4-70 0-100z" fill="none" stroke="#d9a84a" stroke-width="3"/>
<path d="M12 104c50 6 166 6 216 0" stroke="#f2d48a" stroke-width="2" fill="none" stroke-dasharray="2 5"/></svg>`;

/** Couverture posée sur lui pendant qu'il dort : arrondie sur le dos, plis, ourlet ondulé jusqu'au sol. */
const DRAPE = `<svg viewBox="0 0 240 124" preserveAspectRatio="none"><defs>
<linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a49a6"/><stop offset=".55" stop-color="#2d2c74"/><stop offset="1" stop-color="#1c1b4c"/></linearGradient>
<radialGradient id="dh" cx=".45" cy=".12" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<pattern id="dp" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M0 17h34M17 0v34" stroke="#d9a84a" stroke-opacity=".3" stroke-width="1.3" stroke-dasharray="3 4"/><path d="M17 10l1.7 4.2 4.3.4-3.4 2.6 1 4.3-3.6-2.2-3.6 2.2 1-4.3-3.4-2.6 4.3-.4z" fill="#f2d48a" fill-opacity=".5"/></pattern>
<clipPath id="dc"><path d="M4 112 C1 72 12 36 44 21 C80 5 162 3 197 15 C224 25 237 54 238 112 Q231 121 224 112 Q217 113 210 112 Q203 121 196 112 Q189 113 182 112 Q175 121 168 112 Q161 113 154 112 Q147 121 140 112 Q133 113 126 112 Q119 121 112 112 Q105 113 98 112 Q91 121 84 112 Q77 113 70 112 Q63 121 56 112 Q49 113 42 112 Q35 121 28 112 Q21 113 14 112 Q9 121 4 112 Z"/></clipPath></defs>
<path d="M4 112 C1 72 12 36 44 21 C80 5 162 3 197 15 C224 25 237 54 238 112 Q231 121 224 112 Q217 113 210 112 Q203 121 196 112 Q189 113 182 112 Q175 121 168 112 Q161 113 154 112 Q147 121 140 112 Q133 113 126 112 Q119 121 112 112 Q105 113 98 112 Q91 121 84 112 Q77 113 70 112 Q63 121 56 112 Q49 113 42 112 Q35 121 28 112 Q21 113 14 112 Q9 121 4 112 Z" fill="url(#dg)"/>
<path d="M4 112 C1 72 12 36 44 21 C80 5 162 3 197 15 C224 25 237 54 238 112 Q231 121 224 112 Q217 113 210 112 Q203 121 196 112 Q189 113 182 112 Q175 121 168 112 Q161 113 154 112 Q147 121 140 112 Q133 113 126 112 Q119 121 112 112 Q105 113 98 112 Q91 121 84 112 Q77 113 70 112 Q63 121 56 112 Q49 113 42 112 Q35 121 28 112 Q21 113 14 112 Q9 121 4 112 Z" fill="url(#dp)"/>
<g clip-path="url(#dc)" fill="none" stroke-linecap="round">
<path d="M58 30 C54 60 50 90 52 122 M110 18 C112 52 106 88 110 122 M168 20 C172 56 166 90 170 122 M214 40 C218 70 214 96 218 122" stroke="#0e0d2c" stroke-opacity=".38" stroke-width="7"/>
<path d="M64 30 C60 60 57 90 59 122 M117 18 C119 52 113 88 117 122 M175 20 C179 56 173 90 177 122" stroke="#fff" stroke-opacity=".07" stroke-width="3"/>
<rect width="240" height="124" fill="url(#dh)"/></g>
<path d="M4 112 C1 72 12 36 44 21 C80 5 162 3 197 15 C224 25 237 54 238 112 Q231 121 224 112 Q217 113 210 112 Q203 121 196 112 Q189 113 182 112 Q175 121 168 112 Q161 113 154 112 Q147 121 140 112 Q133 113 126 112 Q119 121 112 112 Q105 113 98 112 Q91 121 84 112 Q77 113 70 112 Q63 121 56 112 Q49 113 42 112 Q35 121 28 112 Q21 113 14 112 Q9 121 4 112 Z" fill="none" stroke="#d9a84a" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

/** Nuit en cours : le soir, c'est aujourd'hui ; après minuit et le matin, c'est la veille. */
export function nightKey(d = new Date()): string {
  return d.getHours() < 12 ? todayKey(new Date(d.getTime() - 86400000)) : todayKey(d);
}

let drape: { el: HTMLElement; raf: number } | null = null;

/** Le soir : on tire la couverture sur lui. */
export function openBlanket(app: App): void {
  const host = app.root.querySelector('.stage-view') as HTMLElement | null;
  const comp = app.family.companion;
  if (!host || !comp) { app.toggleSleep(true); return; }
  const quilt = h('div', { class: 'rt-quilt' });
  quilt.innerHTML = QUILT;
  const hint = h('div', { class: 'rt-hint' }, 'Tire la couverture sur lui');
  const skip = h('button', { class: 'rt-skip', onclick: () => finish() }, 'Le couvrir');
  const overlay = h('div', { class: 'rt-blanket' }, quilt, hint, skip);
  host.append(overlay);
  const H = host.clientHeight;
  let y = 0, startY = 0, dragging = false, done = false;
  const set = (v: number) => { y = Math.max(0, Math.min(H * 0.55, v)); quilt.style.transform = `translate(-50%, ${y}px)`; app.view.backdrop.night = Math.max(app.view.backdrop.night, (y / (H * 0.55)) * 0.9); };
  set(0);
  quilt.addEventListener('pointerdown', e => { dragging = true; startY = e.clientY - y; quilt.setPointerCapture(e.pointerId); });
  quilt.addEventListener('pointermove', e => { if (dragging) set(e.clientY - startY); });
  const up = () => { if (!dragging) return; dragging = false; if (y > H * 0.3) finish(); else { quilt.animate([{ transform: quilt.style.transform }, { transform: 'translate(-50%, 0px)' }], { duration: 250 }); set(0); } };
  quilt.addEventListener('pointerup', up);
  quilt.addEventListener('pointercancel', up);
  const finish = () => {
    if (done) return;
    done = true;
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 400);
    app.toggleSleep(true);
    app.view.backdrop.night = 0.9;
    comp.data.blanketDay = nightKey();
    comp.save();
    surprisesFor(app).setDream(dreamFor(dreamContextFrom(app)));
    navigator.vibrate?.(25);
    setTimeout(() => app.say(sayFor('blanket'), null, 4000), 900);
    showDrape(app);
  };
}

/** Points du corps qui doivent être sous la couverture (la tête, elle, dépasse). */
const BODY = ['body_center', 'chest_anchor', 'neck_anchor', 'tail_anchor', 'tail_tip_anchor', 'front_leg_anchor', 'rear_leg_anchor',
  'front_leg_far_anchor', 'rear_leg_far_anchor', 'left_wing_anchor', 'right_wing_anchor'];

/** Couverture posée sur son dos tant qu'il dort. */
export function showDrape(app: App, transient = false): void {
  hideDrape();
  const host = app.root.querySelector('.stage-view') as HTMLElement | null;
  if (!host) return;
  const el = h('div', { class: 'rt-drape' });
  el.innerHTML = DRAPE;
  host.append(el);
  const tick = () => {
    if (!app.sleeping || !app.showingOwn) { hideDrape(); return; }
    // tout le corps couché, de la queue au cou, du dos jusqu'au sol ; la tête reste dehors, sur l'oreiller
    const pts = BODY.map(a => app.view.screenPos(a)).filter((p): p is { x: number; y: number } => !!p);
    const head = app.view.screenPos('head_anchor'), neck = app.view.screenPos('neck_anchor'), mid = app.view.screenPos('body_center');
    if (pts.length >= 4 && head && mid) {
      const right = head.x > mid.x;
      let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x));
      const y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
      if (neck) { if (right) x1 = Math.min(x1, neck.x); else x0 = Math.max(x0, neck.x); }
      const w0 = x1 - x0, h0 = y1 - y0;
      // marge : large côté queue, étroite côté cou (la couverture s'arrête sous le menton)
      x0 -= w0 * (right ? 0.1 : 0.04); x1 += w0 * (right ? 0.04 : 0.1);
      const top = y0 - Math.max(h0 * 0.35, w0 * 0.08), bottom = y1 + Math.max(h0 * 0.18, 10);
      el.style.width = `${x1 - x0}px`;
      el.style.height = `${Math.max(bottom - top, (x1 - x0) * 0.32)}px`;
      el.style.transform = `translate(${x0}px, ${top}px)`;
    }
    if (drape) drape.raf = requestAnimationFrame(tick);
  };
  drape = { el, raf: requestAnimationFrame(tick) };
  // la couverture se pose, puis s'efface doucement en poussière d'étoiles
  if (transient) setTimeout(() => { if (drape?.el === el) { app.view.emit('happySparkle', 'body_center'); hideDrape(); } }, 2200);
}
export function hideDrape(): void {
  if (!drape) return;
  cancelAnimationFrame(drape.raf);
  const el = drape.el;
  drape = null;
  el.classList.add('out');
  setTimeout(() => el.remove(), 400);
}

/** Le matin : rideaux tirés tant qu'on ne les a pas ouverts. */
export function morningCurtain(app: App): boolean {
  const host = app.root.querySelector('.stage-view') as HTMLElement | null;
  const comp = app.family.companion;
  if (!host || !comp || host.querySelector('.rt-curtain')) return false;
  const left = h('div', { class: 'rt-c rt-cl' }), right = h('div', { class: 'rt-c rt-cr' });
  const hint = h('div', { class: 'rt-hint' }, 'Ouvre les rideaux pour le réveiller');
  const overlay = h('div', { class: 'rt-curtain' }, left, right, hint);
  host.append(overlay);
  app.view.backdrop.night = 1;
  let open = 0, sx = 0, dragging = false, done = false;
  const set = (v: number) => {
    open = Math.max(0, Math.min(1, v));
    left.style.transform = `translateX(${-open * 100}%)`;
    right.style.transform = `translateX(${open * 100}%)`;
    app.view.backdrop.night = 1 - open;
  };
  overlay.addEventListener('pointerdown', e => { dragging = true; sx = e.clientX; overlay.setPointerCapture(e.pointerId); });
  overlay.addEventListener('pointermove', e => { if (dragging) set(Math.abs(e.clientX - sx) / (host.clientWidth * 0.45)); });
  overlay.addEventListener('pointerup', () => { dragging = false; if (open > 0.35 || open < 0.03) finish(); else set(0); });
  const finish = () => {
    if (done) return;
    done = true;
    overlay.classList.add('open');
    set(1);
    setTimeout(() => overlay.remove(), 700);
    comp.data.morningDay = todayKey();
    comp.save();
    hideDrape();
    app.wakeUp(true);
    const dream = surprisesFor(app).takeDream();
    setTimeout(() => app.say(dream ?? sayFor('morning'), null, dream ? 9000 : 4000), 1600);
  };
  return true;
}
