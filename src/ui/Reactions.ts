// LOT 5 — Réactions du dragon aux grands moments, communes à toutes les évolutions :
// quête validée, passage de niveau, objet obtenu (intensité selon la rareté), objet équipé.
// Courtes (1 à 3 s) et jamais bloquantes : l'interface reste utilisable pendant l'effet.
import type { EquipmentDef } from '../core/types.js';
import { Sound } from '../engine/Sound.js';
import type { App } from './App.js';
import { ICONS, h, icon } from './dom.js';
import { thumb } from './screens/common.js';

/** File d'attente : deux réactions ne se chevauchent pas (la seconde attend la fin de la première). */
let busyUntil = 0;
function schedule(run: () => number): void {
  const now = performance.now();
  const wait = Math.max(0, busyUntil - now);
  busyUntil = Math.max(now, busyUntil) + 400;
  setTimeout(() => { const dur = run(); busyUntil = Math.max(busyUntil, performance.now() + dur); }, wait);
}

function stage(app: App): HTMLElement | null { return app.root.querySelector('.stage-view'); }
function canReact(app: App): boolean { return app.showingOwn && !!app.view.stage; }

/** Chiffre qui jaillit au-dessus du dragon, puis file vers le compteur d'or du bandeau si c'est de l'or. */
function floatLabel(app: App, text: string, kind: 'xp' | 'gold', delay: number): void {
  const host = stage(app);
  const head = app.view.screenPos('head_anchor');
  if (!host || !head) return;
  const el = h('div', { class: `rx-float rx-${kind}` }, kind === 'gold' ? icon(ICONS.coin, 16) : null, h('span', null, text));
  el.style.left = `${head.x + (kind === 'gold' ? 26 : -26)}px`;
  el.style.top = `${head.y - 10}px`;
  setTimeout(() => {
    host.append(el);
    const rise = el.animate([
      { transform: 'translate(-50%, 0) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%, -34px) scale(1.12)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -52px) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -64px) scale(1)', opacity: kind === 'gold' ? 1 : 0 }
    ], { duration: 1100, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    rise.onfinish = () => {
      if (kind !== 'gold') { el.remove(); return; }
      // l'or s'envole vers le compteur du bandeau
      const target = app.root.querySelector('#hud .gold') as HTMLElement | null;
      const hr = host.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (!target) { el.remove(); return; }
      const tr = target.getBoundingClientRect();
      const dx = tr.left + tr.width / 2 - (er.left + er.width / 2), dy = tr.top + tr.height / 2 - (er.top + er.height / 2);
      void hr;
      el.animate([
        { transform: 'translate(-50%, -64px) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), ${dy - 64}px) scale(.45)`, opacity: 0.9 }
      ], { duration: 520, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }).onfinish = () => {
        el.remove();
        target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260 });
      };
    };
  }, delay);
}

/** Quête validée : il se ramasse, bondit de joie, étincelles, XP et or qui jaillissent, retour au repos (≈1,5 s). */
export function missionReaction(app: App, xp: number, gold: number): void {
  if (!canReact(app)) return;
  schedule(() => {
    if (app.sleeping) { if (xp) floatLabel(app, `+${xp} XP`, 'xp', 0); if (gold) floatLabel(app, `+${gold}`, 'gold', 150); return 1400; }
    void app.view.play('cheer');
    app.view.emit('sparkle', 'head_anchor');
    if (xp) floatLabel(app, `+${xp} XP`, 'xp', 420);
    if (gold) floatLabel(app, `+${gold}`, 'gold', 560);
    return 1600;
  });
}

/** Passage de niveau : il se redresse, lumière qui monte, halo, particules ascendantes, impulsion, « Niveau N », retour. */
export function levelUpReaction(app: App, level: number): void {
  if (!canReact(app)) return;
  schedule(() => {
    const v = app.view;
    void app.act('level_up');
    v.cameraPulse(0.05, 2.4);
    v.emitFor('levelUpRise', 'body_center', 1.4);
    v.emit('glow', 'body_center');
    setTimeout(() => { v.emit('levelUpRing', 'body_center'); v.emit('levelUpBurst', 'body_center'); }, 900);
    const host = stage(app);
    if (host) {
      const banner = h('div', { class: 'rx-level' }, h('span', { class: 'rx-level-k' }, 'Niveau'), h('strong', null, String(level)));
      setTimeout(() => {
        host.append(banner);
        banner.animate([
          { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0, filter: 'blur(6px)' },
          { transform: 'translate(-50%,-50%) scale(1.12)', opacity: 1, filter: 'blur(0)', offset: 0.18 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.3 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.8 },
          { transform: 'translate(-50%,-62%) scale(.96)', opacity: 0 }
        ], { duration: 2200, easing: 'ease-out', fill: 'forwards' }).onfinish = () => banner.remove();
      }, 850);
    }
    return 2800;
  });
}

const RARITY_FX: Record<string, { preset: string; zoom: number; anim: string; pulse: number }> = {
  common: { preset: 'sparkle', zoom: 0, anim: 'cheer', pulse: 0 },
  rare: { preset: 'rare_rare', zoom: 0.015, anim: 'cheer', pulse: 1 },
  epic: { preset: 'rare_epic', zoom: 0.03, anim: 'happy', pulse: 2 },
  legendary: { preset: 'rare_legendary', zoom: 0.045, anim: 'roar', pulse: 3 }
};

/** Objet obtenu : apparition de l'objet, halo de la couleur de sa rareté, particules, réaction du dragon. */
export function itemReaction(app: App, def: EquipmentDef, how: 'buy' | 'gift'): void {
  if (!canReact(app)) return;
  const fx = RARITY_FX[def.rarity] ?? RARITY_FX.common;
  const rar = app.catalog.rarities.get(def.rarity);
  schedule(() => {
    const v = app.view;
    if (!app.sleeping) void app.act(fx.anim);
    v.emit(fx.preset, 'body_center');
    if (fx.zoom) v.cameraPulse(fx.zoom, 1.6);
    if (fx.pulse >= 2) void Sound.play('gem', { user: true });
    const host = stage(app);
    if (host) {
      const card = h('div', { class: `rx-item rx-p${fx.pulse}`, style: { '--rc': rar?.color ?? '#d9a84a' } },
        h('div', { class: 'rx-item-glow' }), thumb(app, def, 84),
        h('div', { class: 'rx-item-txt' }, h('span', { class: 'rx-item-k' }, how === 'gift' ? 'Cadeau reçu' : (rar?.label ?? 'Nouvel objet')), h('strong', null, def.name)));
      host.append(card);
      card.animate([
        { transform: 'translate(-50%,0) scale(.3) rotate(-8deg)', opacity: 0 },
        { transform: 'translate(-50%,0) scale(1.08) rotate(2deg)', opacity: 1, offset: 0.22 },
        { transform: 'translate(-50%,0) scale(1) rotate(0)', opacity: 1, offset: 0.32 },
        { transform: 'translate(-50%,0) scale(1)', opacity: 1, offset: 0.85 },
        { transform: 'translate(-50%,-14px) scale(.95)', opacity: 0 }
      ], { duration: 1800 + fx.pulse * 400, easing: 'ease-out', fill: 'forwards' }).onfinish = () => card.remove();
    }
    return 1600 + fx.pulse * 400;
  });
}

/** Objet équipé : éclat sur la partie du corps concernée, petite réaction fière. */
export function equipReaction(app: App, def: EquipmentDef): void {
  if (!canReact(app) || app.sleeping) return;
  const cat = app.catalog.categories.get(def.category);
  const anchor = cat?.anchors?.[0] ?? 'body_center';
  app.view.emit('sparkle', anchor);
  app.view.emit('glow', anchor);
  if (!app.view.animator.actionId) void app.view.play('shake');
}
