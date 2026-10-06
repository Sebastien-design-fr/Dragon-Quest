import type { QualityLevel } from '../../core/types.js';
import { Assets } from '../../engine/AssetManager.js';
import { LAYERS } from '../../engine/DragonView.js';
import type { App, Screen } from '../App.js';
import { ICONS, clear, h } from '../dom.js';

const QUALITY_LABELS: Record<QualityLevel, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute' };
const LAYER_LABELS: Record<string, string> = {
  magicalEffect: 'Effets magiques', base: 'Dragon (base)', headEquipment: 'Tête', neckEquipment: 'Cou', bodyEquipment: 'Torse',
  legEquipment: 'Pattes', wingEquipment: 'Ailes', tailEquipment: 'Queue', foregroundEffect: 'Effets avant-plan'
};

export class SettingsScreen implements Screen {
  id = 'settings'; label = 'Réglages'; icon = ICONS.settings;
  private el: HTMLElement | null = null;
  constructor(private app: App) {}

  mount(el: HTMLElement): void { this.el = el; this.refresh(); }
  unmount(): void { this.el = null; }

  refresh(): void {
    const el = this.el; if (!el) return;
    const { app } = this;
    const s = app.state.data.settings;
    clear(el);

    const seg = h('div', { class: 'segmented', role: 'radiogroup' });
    for (const q of Object.keys(app.catalog.quality) as QualityLevel[]) {
      seg.append(h('button', { class: s.quality === q ? 'active' : '', role: 'radio', 'aria-checked': s.quality === q ? 'true' : 'false',
        onclick: () => app.state.setQuality(q) }, QUALITY_LABELS[q] ?? q));
    }

    const toggle = (label: string, on: boolean, set: (v: boolean) => void) => {
      const id = 't' + Math.random().toString(36).slice(2);
      return h('label', { class: 'toggle', for: id },
        h('span', null, label),
        h('input', { id, type: 'checkbox', checked: on, onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }));
    };

    const stageSelect = h('select', { onchange: (e: Event) => {
      const v = (e.target as HTMLSelectElement).value;
      void app.setStageOverride(v ? app.catalog.stage(v) ?? null : null);
    } }, h('option', { value: '' }, 'Stade réel'),
      ...app.catalog.stages.map(st => h('option', { value: st.id, selected: app.stageOverride?.id === st.id }, st.label)));

    const stats = Assets.stats();
    el.append(
      h('section', { class: 'card' },
        h('h3', null, 'Qualité graphique'),
        h('p', { class: 'small muted' }, 'Basse : aucune particule, 30 images/s. Idéal pour les téléphones modestes.'),
        seg,
        toggle('Effets lumineux et particules', s.effects, v => app.state.setEffects(v))),
      h('section', { class: 'card' },
        h('h3', null, 'Outils de développement'),
        h('label', { class: 'field' }, h('span', null, 'Aperçu du stade'), stageSelect),
        toggle('Afficher les points d’ancrage', app.view.showAnchors, v => { app.view.showAnchors = v; }),
        toggle('Collections saisonnières toujours visibles', app.allCollections, v => { app.allCollections = v; }),
        h('h4', null, 'Couches du dragon'),
        ...LAYERS.map(l => toggle(LAYER_LABELS[l] ?? l, app.view.layers[l] !== false, v => app.view.setLayerVisible(l, v))),
        h('p', { class: 'small muted' }, `Assets définitifs détectés : ${stats.available} · chargés en mémoire : ${stats.loaded}`)),
      h('section', { class: 'card' },
        h('button', { class: 'btn danger', onclick: () => { if (confirm('Effacer toute la progression ?')) void app.state.reset(); } }, 'Réinitialiser la sauvegarde'))
    );
  }
}
