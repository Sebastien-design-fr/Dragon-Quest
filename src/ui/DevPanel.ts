// Panneau de test graphique (développement uniquement) : choisir variante → stade → pose / état,
// vitesse de lecture, comparaisons avant / après, et mesures (images/s, temps par image, particules…).
import { Assets } from '../engine/AssetManager.js';
import { MeshRenderer } from '../engine/SpriteSkin.js';
import type { QualityLevel } from '../core/types.js';
import type { App } from './App.js';
import { h } from './dom.js';

type PoseChoice = { id: string; label: string; run: (app: App) => void };

const POSES: PoseChoice[] = [
  { id: 'idle', label: 'Repos (IDLE)', run: a => { a.view.debugPose = null; void a.view.play('idle'); } },
  { id: 'sleep', label: 'Couché (SLEEP)', run: a => { a.view.debugPose = null; void a.view.play('sleep'); } },
  { id: 'fly', label: 'Vol animé (FLY)', run: a => { a.view.debugPose = null; void a.view.play('idle'); void a.view.fly(); } },
  { id: 'flyUp', label: 'Ailes hautes, fixe (WINGS_UP)', run: a => { a.view.debugPose = 'flyUp'; } },
  { id: 'flyMid', label: 'Ailes au milieu, fixe (WINGS_MID)', run: a => { a.view.debugPose = 'flyMid'; } },
  { id: 'flyDown', label: 'Ailes basses, fixe (WINGS_DOWN)', run: a => { a.view.debugPose = 'flyDown'; } },
  { id: 'sleepPose', label: 'Couché, fixe', run: a => { a.view.debugPose = 'sleep'; } },
  { id: 'happy', label: 'Joie (HAPPY)', run: a => { a.view.debugPose = null; void a.view.play('happy'); } },
  { id: 'eat', label: 'Manger', run: a => { a.view.debugPose = null; void a.view.play('eat'); } },
  { id: 'roar', label: 'Rugissement', run: a => { a.view.debugPose = null; void a.view.play('roar'); } },
  { id: 'level_up', label: 'Niveau (LEVEL_UP)', run: a => { a.view.debugPose = null; void a.view.play('level_up'); } },
  { id: 'evolution', label: 'Évolution (sans changer de stade)', run: a => { a.view.debugPose = null; void a.view.play('evolution'); } }
];

let panel: HTMLElement | null = null;
let timer = 0;

export function toggleDevPanel(app: App): void {
  if (panel) { closeDevPanel(); return; }
  const view = app.view;
  const variants = Assets.variants();
  const stages = app.catalog.stages;
  let variant = app.ownVariant;
  let stage = (app.stageOverride ?? app.state.stage).id;

  const sel = (opts: Array<[string, string]>, value: string, on: (v: string) => void) =>
    h('select', { onchange: (e: Event) => on((e.target as HTMLSelectElement).value) },
      ...opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  const apply = async () => {
    const st = app.catalog.stage(stage);
    if (st) await app.devShow(variant, st);
  };
  const speedBtns = h('div', { class: 'dv-row' }, ...[0.25, 0.5, 1, 2].map(x =>
    h('button', { class: `dv-chip${view.timeScale === x ? ' on' : ''}`, onclick: (e: Event) => {
      view.timeScale = x;
      (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('.dv-chip').forEach(b => b.classList.toggle('on', b === e.currentTarget));
    } }, `${x}×`)));
  const check = (label: string, value: boolean, on: (v: boolean) => void) => {
    const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
    box.checked = value;
    box.addEventListener('change', () => on(box.checked));
    return h('label', { class: 'dv-check' }, box, h('span', null, label));
  };
  const stats = h('pre', { class: 'dv-stats' });
  const q = app.state.data.settings.quality;

  panel = h('div', { class: 'dv' },
    h('div', { class: 'dv-head' }, h('strong', null, 'Panneau graphique'), h('button', { class: 'dv-x', onclick: () => closeDevPanel() }, '×')),
    h('div', { class: 'dv-grid' },
      h('span', null, 'Dragon'), sel(variants.map(v => [v, v]), variant, v => { variant = v; void apply(); }),
      h('span', null, 'Stade'), sel(stages.map(s => [s.id, s.label]), stage, v => { stage = v; void apply(); }),
      h('span', null, 'Pose / état'), sel(POSES.map(p => [p.id, p.label]), 'idle', v => POSES.find(p => p.id === v)?.run(app)),
      h('span', null, 'Qualité'), sel([['HIGH', 'HIGH'], ['MEDIUM', 'MEDIUM'], ['LOW', 'LOW']], q, v => app.state.setQuality(v as QualityLevel))),
    h('div', { class: 'dv-label' }, 'Vitesse'), speedBtns,
    h('div', { class: 'dv-label' }, 'Comparer avec l’ancien rendu'),
    check('Densité plafonnée à 2 (avant)', view.debug.capDpr2, v => view.setDebug({ capDpr2: v })),
    check('Sans mipmaps (avant)', view.debug.noMipmaps, v => view.setDebug({ noMipmaps: v })),
    h('div', { class: 'dv-label' }, 'Intégration au décor (LOT 2)'),
    check('Ombres', view.fx.shadows, v => { view.fx.shadows = v; }),
    check('Éclairage (teinte, lumière, haut/bas)', view.fx.lighting, v => { view.fx.lighting = v; }),
    check('Lumière de contour', view.fx.rim, v => { view.fx.rim = v; }),
    h('div', { class: 'dv-label' }, 'Couches d’ambiance du décor'),
    check('Lueurs', view.backdrop.layers.lights, v => { view.backdrop.layers.lights = v; }),
    check('Poussières', view.backdrop.layers.motes, v => { view.backdrop.layers.motes = v; }),
    check('Teinte de nuit', view.backdrop.layers.tint, v => { view.backdrop.layers.tint = v; }),
    check('Points d’ancrage', view.showAnchors, v => { view.showAnchors = v; }),
    stats);
  document.body.append(panel);

  const mem = () => {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return m ? `${Math.round(m.usedJSHeapSize / 1048576)} Mo (JS)` : 'non mesurable ici';
  };
  const tick = () => {
    const s = view.stats, d = view.debugInfo();
    stats.textContent = [
      `FPS ${s.fps.toFixed(0)} · image ${s.frameMs.toFixed(1)} ms`,
      `écran ${s.refreshHz} Hz · 1 image / ${s.divisor} rafraîchissement${s.divisor > 1 ? 's' : ''}`,
      `état ${d.state || '—'}`,
      `variante ${view.variant} · stade ${view.stage?.id ?? '—'} · pose ${d.pose}`,
      `poses chargées ${d.poses.join(', ') || 'aucune'}`,
      `particules ${d.particles} · qualité ${app.state.data.settings.quality}`,
      `canvas ${s.canvas} · densité ${s.renderDpr} (écran ${window.devicePixelRatio})`,
      `texture ${d.tex}`,
      `lumière scène ${view.backdrop.scene.ambient.map(x => Math.round(x * 255)).join(',')} · dir ${view.backdrop.scene.dir.map(x => x.toFixed(2)).join(',')}`,
      `contextes WebGL ${MeshRenderer.contexts} · mémoire ${mem()} · images ${Assets.stats().loaded}`
    ].join('\n');
  };
  tick();
  timer = window.setInterval(tick, 500);
}

export function closeDevPanel(): void {
  clearInterval(timer);
  panel?.remove();
  panel = null;
}
