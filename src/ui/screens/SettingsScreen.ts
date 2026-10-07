import { toggleDevPanel } from '../DevPanel.js';
import type { QualityLevel } from '../../core/types.js';
import { Assets } from '../../engine/AssetManager.js';
import { LAYERS } from '../../engine/DragonView.js';
import { Sound } from '../../engine/Sound.js';
import { APP_VERSION, type App, type Screen } from '../App.js';
import { ICONS, clear, h } from '../dom.js';
import { deviceSetupCard, membersCard } from './family.js';

const QUALITY_LABELS: Record<QualityLevel, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute' };
const LAYER_LABELS: Record<string, string> = {
  magicalEffect: 'Effets magiques', base: 'Dragon (base)', headEquipment: 'Tête', neckEquipment: 'Cou', bodyEquipment: 'Torse',
  legEquipment: 'Pattes', wingEquipment: 'Ailes', tailEquipment: 'Queue', foregroundEffect: 'Effets avant-plan'
};

export function toggle(label: string, on: boolean, set: (v: boolean) => void): HTMLElement {
  const id = 't' + Math.random().toString(36).slice(2);
  return h('label', { class: 'toggle', for: id },
    h('span', null, label),
    h('input', { id, type: 'checkbox', checked: on, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }));
}

export function qualityCard(app: App): HTMLElement {
  const s = app.state.data.settings;
  const seg = h('div', { class: 'segmented', role: 'radiogroup' });
  for (const q of Object.keys(app.catalog.quality) as QualityLevel[]) {
    seg.append(h('button', { class: s.quality === q ? 'active' : '', role: 'radio', 'aria-checked': s.quality === q ? 'true' : 'false',
      onclick: () => app.state.setQuality(q) }, QUALITY_LABELS[q] ?? q));
  }
  return h('section', { class: 'card' },
    h('h3', null, 'Qualité graphique'),
    h('p', { class: 'small muted' }, 'Basse : aucune particule, 30 images/s. Idéal pour les téléphones modestes.'),
    seg,
    toggle('Effets lumineux et particules', s.effects, v => app.state.setEffects(v)));
}

export function soundCard(app: App): HTMLElement {
  const s = app.state.data.settings;
  const vol = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round((s.volume ?? 0.7) * 100)), 'aria-label': 'Volume',
    onchange: (e: Event) => { app.state.setSound(true, Number((e.target as HTMLInputElement).value) / 100); void Sound.play('chirp', { user: true }); } });
  return h('section', { class: 'card' },
    h('h3', null, 'Sons'),
    toggle('Sons du dragon', s.sound !== false, v => { app.state.setSound(v); if (v) void Sound.play('chirp', { user: true }); }),
    h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Volume'), vol),
    h('p', { class: 'small muted' }, 'Le dragon reste silencieux la nuit (22 h – 7 h), sauf quand tu le touches.'));
}

/** Version de l'appli : 7 appuis activent les outils de test. */
export function versionLine(app: App, rerender: () => void): HTMLElement {
  let taps = 0;
  return h('button', { class: 'version', onclick: () => {
    if (++taps >= 7) { app.devMode = !app.devMode; taps = 0; app.toast(app.devMode ? 'Outils de test activés' : 'Outils de test masqués'); rerender(); }
  } }, `Quête du Dragon · version ${APP_VERSION}${app.family.link.native ? '' : ' · simulation navigateur'}`);
}

export function devToolsCard(app: App): HTMLElement {
  const stageSelect = h('select', { onchange: (e: Event) => {
    const v = (e.target as HTMLSelectElement).value;
    void app.setStageOverride(v ? app.catalog.stage(v) ?? null : null);
  } }, h('option', { value: '' }, 'Stade réel'),
    ...app.catalog.stages.map(st => h('option', { value: st.id, selected: app.stageOverride?.id === st.id }, st.label)));
  const stats = Assets.stats();
  return h('section', { class: 'card dev' },
    h('h3', null, 'Outils de test'),
    h('button', { class: 'btn primary', onclick: () => toggleDevPanel(app) }, 'Panneau graphique (variantes, stades, poses)'),
    app.isParent ? null : h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => app.state.addXp(50) }, '+50 XP'),
      h('button', { class: 'btn ghost', onclick: () => app.state.addXp(app.state.xpToNext() - app.state.data.xp) }, 'Niveau suivant'),
      h('button', { class: 'btn ghost', onclick: () => app.state.addGold(1000) }, '+1000 or')),
    app.isParent ? null : h('label', { class: 'field' }, h('span', null, 'Aperçu du stade'), stageSelect),
    toggle('Afficher les points d’ancrage', app.view.showAnchors, v => { app.view.showAnchors = v; }),
    toggle('Collections saisonnières toujours visibles', app.allCollections, v => { app.allCollections = v; }),
    h('h4', null, 'Couches du dragon'),
    ...LAYERS.map(l => toggle(LAYER_LABELS[l] ?? l, app.view.layers[l] !== false, v => app.view.setLayerVisible(l, v))),
    h('p', { class: 'small muted' }, `Assets définitifs détectés : ${stats.available} · chargés en mémoire : ${stats.loaded}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn danger', onclick: async () => {
        if (!confirm('Effacer la progression du dragon ?')) return;
        await app.state.reset();
      } }, 'Réinitialiser le dragon'),
      h('button', { class: 'btn danger', onclick: async () => {
        if (!confirm('Quitter la famille ? Ce téléphone devra être relié à nouveau.')) return;
        await app.family.link.leaveFamily();
        location.reload();
      } }, 'Quitter la famille')));
}

export class SettingsScreen implements Screen {
  id = 'settings'; label = 'Réglages'; icon = ICONS.settings;
  private el: HTMLElement | null = null;
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); void this.app.refreshLink(); }
  unmount(): void { this.el = null; }

  refresh(): void {
    const el = this.el; if (!el) return;
    const rerender = () => this.refresh();
    clear(el);
    el.append(
      deviceSetupCard(this.app, rerender),
      membersCard(this.app),
      soundCard(this.app),
      qualityCard(this.app));
    if (this.app.devMode) el.append(devToolsCard(this.app));
    el.append(versionLine(this.app, rerender));
  }
}
