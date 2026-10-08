// Interface vivante (refonte UX, point 3) : retours haptiques, petits sons, envols, ressorts, compteurs.
// Tout respecte « réduire les animations » du téléphone et les réglages de son.
import { Sound } from '../engine/Sound.js';

const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const vib = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* pas de vibreur */ } };
const SPRING = 'cubic-bezier(.3,1.5,.5,1)';

export const UI = {
  /** Cran léger (curseur, balayage). */
  tick(): void { vib(6); Sound.ui('tick'); },
  /** Appui sur un bouton important. */
  tap(): void { vib(8); Sound.ui('tap'); },
  /** Réussite (quête validée). */
  success(): void { vib([18, 40, 30]); Sound.ui('success'); },
  wait(ms: number): Promise<void> { return new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 120) : ms)); },

  /** La carte s'envole (dir 1 = droite, -1 = gauche ; up = vers le haut, vers le dragon). */
  flyOut(el: HTMLElement, dir: number, ms = 320, up = false): Promise<void> {
    if (up) Sound.ui('whoosh');
    if (reduced() || !el.animate) { el.style.opacity = '0'; return Promise.resolve(); }
    const from = el.style.transform || 'none';
    const a = el.animate([
      { transform: from, opacity: 1 },
      { transform: `translate(${dir * 115}%, ${up ? -60 : 0}%) rotate(${dir * (up ? 14 : 9)}deg) scale(${up ? 0.7 : 0.95})`, opacity: 0 }
    ], { duration: ms, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
    return a.finished.then(() => undefined, () => undefined);
  },

  /** Arrivée d'une carte depuis le côté (dir 1 = depuis la droite). */
  enter(el: HTMLElement, dir: number): void {
    if (reduced() || !el.animate) return;
    el.animate([
      { transform: `translateX(${dir * 40}%) scale(.94)`, opacity: 0 },
      { transform: 'none', opacity: 1 }
    ], { duration: 420, easing: SPRING });
  },

  /** Retour élastique à la position de repos. */
  springBack(el: HTMLElement): void {
    const from = el.style.transform;
    el.style.transform = '';
    if (reduced() || !el.animate || !from) return;
    el.animate([{ transform: from }, { transform: 'none' }], { duration: 380, easing: SPRING });
  },

  /** Nombre qui défile jusqu'à sa nouvelle valeur. */
  countUp(el: HTMLElement, from: number, to: number, ms = 700, format = (n: number) => n.toLocaleString('fr-FR')): void {
    if (from === to || reduced()) { el.textContent = format(to); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - u, 3);
      el.textContent = format(Math.round(from + (to - from) * e));
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    if (to > from) Sound.ui('coin');
  },

  /** Petit rebond (compteur qui change, badge…). */
  bump(el: Element): void {
    if (reduced() || !(el as HTMLElement).animate) return;
    (el as HTMLElement).animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 360, easing: SPRING });
  },

  /** Entrée en cascade des blocs d'un écran (changement d'onglet). */
  stagger(container: HTMLElement, dir: number): void {
    if (reduced() || !container.animate) return;
    const kids = [...container.children].slice(0, 8) as HTMLElement[];
    kids.forEach((k, i) => k.animate?.([
      { transform: `translateX(${dir * 18}px) translateY(10px)`, opacity: 0 },
      { transform: 'none', opacity: 1 }
    ], { duration: 360, delay: i * 45, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
  }
};

/**
 * Retours au toucher pour toute l'appli : vibration très courte et petit son sur les boutons principaux
 * et les onglets (l'effet d'enfoncement est en CSS).
 */
export function installTouchFeedback(root: HTMLElement): void {
  root.addEventListener('pointerdown', e => {
    const b = (e.target as HTMLElement).closest('.btn.primary, .tab, .sh-btn, .qd-link, .ds-tool, .disc-card');
    if (b) { vib(5); Sound.ui('tap'); }
  }, { passive: true });
}
