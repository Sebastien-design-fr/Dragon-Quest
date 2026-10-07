// Capteurs du téléphone : souffler dans le micro (il crache du feu), secouer le téléphone (il se réveille / a le tournis).
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { sayFor } from '../family/Thoughts.js';

/** Souffle magique : on écoute le micro quelques secondes ; un souffle fort et assez long = gerbe de feu. */
export async function startBlow(app: App): Promise<void> {
  if (app.sleeping) { app.say('Chut… il dort.', null, 2000); return; }
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) { app.toast('Le micro n’est pas disponible sur cet appareil'); return; }
  const meter = h('div', { class: 'sn-fill' });
  const label = h('div', { class: 'sn-label' }, 'Souffle fort dans le micro !');
  const overlay = h('div', { class: 'sn-blow' },
    h('div', { class: 'sn-card' }, icon(ICONS.flame, 30), label, h('div', { class: 'sn-meter' }, meter),
      h('button', { class: 'btn ghost small-btn', onclick: () => stop('cancel') }, 'Arrêter')));
  app.root.querySelector('.stage-view')?.append(overlay);
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let raf = 0;
  let finished = false;
  const stop = (why: 'ok' | 'cancel' | 'timeout' | 'error') => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop());
    void ctx?.close();
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 300);
    if (why === 'timeout') app.say('Plus fort ! On réessaie ?', null, 3000);
  };
  try {
    stream = await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch {
    stop('error');
    app.toast('Autorise le micro pour souffler avec lui');
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const t0 = performance.now();
  let charge = 0, last = t0, noise = 0.01, calib = 0;
  const step = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    // calibration du bruit ambiant pendant les premières 400 ms
    if (now - t0 < 400) { noise = Math.max(noise, rms); calib++; raf = requestAnimationFrame(step); return; }
    const level = Math.max(0, (rms - noise * 1.5) / 0.12);
    const blowing = level > 0.35;
    charge = Math.max(0, Math.min(1, charge + (blowing ? dt * 1.1 : -dt * 0.6)));
    meter.style.width = `${Math.round(charge * 100)}%`;
    overlay.classList.toggle('hot', blowing);
    if (blowing && Math.random() < 0.25) app.view.emit('embers', 'mouth_anchor');
    if (charge >= 1) {
      stop('ok');
      void app.act('fire');
      setTimeout(() => app.view.emit('fireRing', 'mouth_anchor'), 600);
      navigator.vibrate?.([40, 60, 80]);
      app.say(sayFor('blow'), null, 4000);
      app.family.companion?.cheer();
      return;
    }
    if (now - t0 > 9000) { stop('timeout'); return; }
    raf = requestAnimationFrame(step);
  };
  void calib;
  label.textContent = 'Souffle fort dans le micro !';
  raf = requestAnimationFrame(step);
}

/** Secouer le téléphone : endormi, il se réveille en grognant ; éveillé, il a le tournis. */
export function installShake(app: App): void {
  let lastShake = 0, peaks: number[] = [];
  window.addEventListener('devicemotion', e => {
    const a = e.acceleration?.x != null ? e.acceleration : null;
    const g = e.accelerationIncludingGravity;
    const mag = a ? Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) : g ? Math.abs(Math.hypot(g.x ?? 0, g.y ?? 0, g.z ?? 0) - 9.81) : 0;
    const now = Date.now();
    if (mag < 14) return;
    peaks = peaks.filter(t => now - t < 700);
    peaks.push(now);
    if (peaks.length < 3 || now - lastShake < 4000) return;
    lastShake = now; peaks = [];
    if (!app.showingOwn || !app.family.companion) return;
    if (app.sleeping) {
      app.toggleSleep(false);
      void app.view.play('wake');
      app.say(sayFor('shakeAwake'), null, 3500);
    } else {
      void app.act('dizzy');
      app.say(sayFor('dizzy'), null, 3000);
    }
  });
}
