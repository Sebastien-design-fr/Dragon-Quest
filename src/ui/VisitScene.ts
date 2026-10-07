// Scène de visite : le dragon de l'autre arrive en volant et se pose à côté du nôtre.
// Ils se saluent, l'invité transmet son message et son cadeau, et on peut faire des tours à deux.
import { DragonView } from '../engine/DragonView.js';
import { Sound } from '../engine/Sound.js';
import type { Visit } from '../family/Duo.js';
import type { EquipmentDef } from '../core/types.js';
import type { App } from './App.js';
import { h } from './dom.js';

export class VisitScene {
  private guest: DragonView | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private panel: HTMLElement | null = null;
  private timer = 0;
  private playedTricks = new Set<string>();
  active: Visit | null = null;

  constructor(private app: App) {}

  async start(v: Visit): Promise<void> {
    if (this.active) return;
    const { app } = this;
    const stage = app.catalog.stage(v.from.stage) ?? app.catalog.stages[0];
    const host = app.root.querySelector('.stage-view');
    if (!host) return;
    this.active = v;
    this.playedTricks.clear();

    this.canvas = h('canvas', { class: 'guest-canvas', 'aria-hidden': 'true' });
    host.append(this.canvas);
    const g = new DragonView(this.canvas, app.view.dependencies);
    this.guest = g;
    g.showBackdrop = false;
    g.setQuality(app.view.quality, app.view.effectsEnabled);
    // L'invité arrive par la droite et se pose face à notre dragon.
    g.mirrored = true;
    g.placement = { x: 1.2, scale: 0.7 };
    g.placeTarget = { x: 0.23, scale: 0.7 };
    await g.setStage(stage, true, v.from.variant);
    g.setEquipment(v.from.equipped.map(id => app.catalog.item(id)).filter((d): d is EquipmentDef => !!d));
    void g.play('idle');
    g.start();
    void g.play('hover');
    Sound.play('wings', { user: true });
    app.view.placeTarget = { x: -0.21, scale: 0.7 };

    // Arrivée : salut, message, cadeau.
    setTimeout(() => {
      if (this.active !== v) return;
      void g.play('bow');
      void app.act('happy');
      const gift = v.gift?.food ? 'Je t’ai apporté de quoi manger !' : v.gift?.item ? `Je t’ai apporté : ${app.catalog.item(v.gift.item)?.name ?? 'un cadeau'} !` : '';
      const text = v.message ? `${v.from.name} : « ${v.message} »` : `${v.from.name} : Coucou ${app.family.companion?.name ?? ''} ! ${gift}`;
      app.say(gift && v.message ? `${text} ${gift}` : text, null, 9000);
      if (gift) Sound.play('chest', { user: true });
    }, 2600);

    this.panel = h('div', { class: 'visit-panel' });
    host.append(this.panel);
    this.renderPanel();
    this.timer = window.setTimeout(() => this.end(), 75000);
  }

  private renderPanel(): void {
    const { app } = this;
    const duo = app.family.duo;
    const v = this.active;
    if (!this.panel || !duo || !v) return;
    this.panel.replaceChildren(
      h('div', { class: 'visit-title' }, `Visite de ${v.from.name}`, h('span', { class: 'small muted' }, ` · ${duo.level().label}`)),
      h('div', { class: 'visit-tricks' }, ...duo.tricks().map(t => h('button', {
        class: `chip${t.unlocked ? '' : ' locked'}`,
        onclick: () => {
          if (!t.unlocked) { app.toast(`Tour débloqué quand ils seront « ${['Copains', 'Complices', 'Inséparables', 'Âmes jumelles'][[10, 30, 60, 100].indexOf(t.at)]} »`); return; }
          void this.guest?.play(t.anim);
          void app.act(t.anim);
          if (!this.playedTricks.has(t.id)) { this.playedTricks.add(t.id); duo.played(); this.renderPanel(); }
          clearTimeout(this.timer);
          this.timer = window.setTimeout(() => this.end(), 60000);
        }
      }, t.unlocked ? t.label : `🔒 ${t.label}`))),
      h('button', { class: 'btn small-btn', onclick: () => this.end() }, 'Au revoir'));
  }

  end(): void {
    const v = this.active;
    if (!v) return;
    clearTimeout(this.timer);
    const g = this.guest, c = this.canvas;
    this.app.family.duo?.consume(v.id);
    this.app.say(`${v.from.name} : À bientôt !`, null, 3000);
    if (g) { g.placeTarget = { x: 1.3, scale: 0.72 }; void g.play('hover'); Sound.play('wings', { user: true }); }
    this.panel?.remove(); this.panel = null;
    this.app.view.placeTarget = { x: 0, scale: 1 };
    setTimeout(() => { g?.stop(); c?.remove(); }, 2200);
    this.guest = null; this.canvas = null; this.active = null;
    setTimeout(() => this.app.playPendingVisit(), 3000);
  }
}
