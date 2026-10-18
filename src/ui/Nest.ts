// Nid commun du soir (parent) : quand la dragonne est couchée et que le dragon de l'enfant dort aussi,
// le petit vient se blottir contre elle sur l'écran du parent. Il repart quand l'un des deux se réveille.
// Le matin, réveiller la dragonne réveille le petit tout doucement sur le téléphone de l'enfant (ParentHub.nestWake).
import { DragonView } from '../engine/DragonView.js';
import type { EquipmentDef } from '../core/types.js';
import type { App } from './App.js';
import { h } from './dom.js';

export class NestScene {
  private guest: DragonView | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private starting = false;

  constructor(private app: App) {
    window.setInterval(() => this.sync(), 5000);
  }

  /** Le petit dort-il contre elle en ce moment ? */
  get active(): boolean { return !!this.guest; }

  /** Vérifie s'il faut l'installer ou le renvoyer (appelé régulièrement et après chaque changement). */
  sync(): void {
    const { app } = this;
    const hub = app.family.hub;
    const id = hub?.sleepingChildren()[0] ?? null;
    const want = app.isParent && app.showingOwn && app.sleeping && app.currentId === 'dragon' && !app.visits.active && !app.root.classList.contains('evolving') && !!id;
    if (want && !this.guest && !this.starting) void this.start(id!);
    else if (!want && this.guest) this.stop();
  }

  private async start(childId: string): Promise<void> {
    const { app } = this;
    const c = app.family.hub?.child(childId);
    const snap = c?.snapshot;
    const host = app.root.querySelector('.stage-view');
    if (!snap || !host) return;
    this.starting = true;
    const canvas = h('canvas', { class: 'guest-canvas nest-canvas', 'aria-hidden': 'true' });
    host.append(canvas);
    const g = new DragonView(canvas, app.view.dependencies);
    g.sceneFrom = app.view; // même lumière (nuit) que la scène de la dragonne
    g.showBackdrop = false;
    g.idleLife = false;
    g.setQuality(app.view.quality, app.view.effectsEnabled);
    g.mirrored = true; // tourné vers elle
    g.placement = { x: 0.15, scale: 0.6 };
    g.placeTarget = { x: 0.15, scale: 0.6 };
    try {
      await g.setStage(app.catalog.stage(snap.stage) ?? app.catalog.stages[0], true, 'dragon');
    } catch { canvas.remove(); this.starting = false; return; }
    g.setEquipment(snap.equipped.map(id => app.catalog.item(id)).filter((d): d is EquipmentDef => !!d));
    void g.play('sleep');
    g.start();
    this.guest = g; this.canvas = canvas; this.starting = false;
    canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-out' });
    app.view.placeTarget = { x: -0.1, scale: 0.78 };
    const kid = snap.companion?.name ?? 'Le petit';
    app.say(`${kid} est venu se blottir contre ${app.family.companion?.name ?? 'elle'} pour la nuit.`, null, 6000);
  }

  private stop(): void {
    const g = this.guest, c = this.canvas;
    this.guest = null; this.canvas = null;
    this.app.view.placeTarget = { x: 0, scale: 1 };
    c?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => { g?.destroy(); c?.remove(); }, 650);
  }
}
