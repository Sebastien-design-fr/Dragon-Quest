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
    showDrape(app, true);
  };
}

/** Couverture posée sur son dos tant qu'il dort. */
export function showDrape(app: App, transient = false): void {
  hideDrape();
  const host = app.root.querySelector('.stage-view') as HTMLElement | null;
  if (!host) return;
  const el = h('div', { class: 'rt-drape' });
  el.innerHTML = QUILT;
  host.append(el);
  const tick = () => {
    if (!app.sleeping || !app.showingOwn) { hideDrape(); return; }
    const b = app.view.screenPos('body_center'), m = app.view.screenPos('mouth_anchor'), t = app.view.screenPos('tail_anchor');
    if (b && m && t) {
      const w = Math.abs(m.x - t.x) * 0.55;
      el.style.width = `${w}px`;
      el.style.height = `${w * 0.42}px`;
      el.style.transform = `translate(${b.x - w * 0.5}px, ${b.y - w * 0.3}px)`;
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
