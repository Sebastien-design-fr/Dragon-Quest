// Système de particules léger (pool réutilisé, aucune allocation en régime établi).
// Les presets viennent de data/effects.json ; la qualité graphique applique un multiplicateur
// (LOW = 0 : aucune particule).
import { rand } from '../core/math.js';
import type { ParticlePreset } from '../core/types.js';

interface P {
  alive: boolean; x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  preset: ParticlePreset;
}

export interface EmitterSource { (): { x: number; y: number; scale: number } | null }

interface Emitter { id: string; preset: ParticlePreset; source: EmitterSource; acc: number }

const MAX = 600;

export class ParticleSystem {
  private pool: P[] = [];
  private emitters = new Map<string, Emitter>();
  multiplier = 1;

  constructor(private presets: Map<string, ParticlePreset>) {
    for (let i = 0; i < MAX; i++) this.pool.push({ alive: false } as P);
  }

  preset(id: string): ParticlePreset | undefined { return this.presets.get(id); }

  /** Particules vivantes (panneau développeur). */
  count(): number { let n = 0; for (const p of this.pool) if (p.alive) n++; return n; }

  /** Émetteur continu (effet équipé, aura permanente…). */
  setEmitter(id: string, presetId: string, source: EmitterSource): void {
    const preset = this.presets.get(presetId);
    if (!preset) { console.warn(`Effet inconnu : ${presetId}`); return; }
    this.emitters.set(id, { id, preset, source, acc: 0 });
  }
  removeEmitter(id: string): void { this.emitters.delete(id); }
  clearEmitters(prefix = ''): void {
    for (const id of [...this.emitters.keys()]) if (id.startsWith(prefix)) this.emitters.delete(id);
  }

  burst(presetId: string, x: number, y: number, scale: number): void {
    const p = this.presets.get(presetId);
    if (!p) return;
    const n = Math.round((p.burst ?? 20) * this.multiplier);
    for (let i = 0; i < n; i++) this.spawn(p, x, y, scale);
  }

  update(dt: number): void {
    if (this.multiplier > 0) {
      for (const e of this.emitters.values()) {
        const src = e.source();
        if (!src) continue;
        e.acc += e.preset.rate * this.multiplier * dt;
        while (e.acc >= 1) { e.acc--; this.spawn(e.preset, src.x, src.y, src.scale); }
      }
    }
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; continue; }
      p.vy += p.preset.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, layer: 'magical' | 'foreground'): void {
    for (const p of this.pool) {
      if (!p.alive || p.preset.layer !== layer) continue;
      const t = p.life / p.max;
      const alpha = p.preset.fade === 'inout' ? Math.sin(Math.PI * t) : 1 - t;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.globalCompositeOperation = p.preset.blend;
      ctx.fillStyle = p.color;
      const s = p.size * (p.preset.shape === 'smoke' ? 0.6 + t : 1);
      if (p.preset.shape === 'spark') {
        ctx.fillRect(p.x - s / 2, p.y - s * 1.5, s, s * 3);
      } else if (p.preset.shape === 'heart') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + s * 0.9);
        ctx.bezierCurveTo(p.x - s * 1.6, p.y - s * 0.2, p.x - s * 0.7, p.y - s * 1.4, p.x, p.y - s * 0.5);
        ctx.bezierCurveTo(p.x + s * 0.7, p.y - s * 1.4, p.x + s * 1.6, p.y - s * 0.2, p.x, p.y + s * 0.9);
        ctx.fill();
      } else if (p.preset.shape === 'bubble') {
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.18);
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha *= 0.25; ctx.fill();
        ctx.globalAlpha /= 0.25;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private spawn(pr: ParticlePreset, x: number, y: number, scale: number): void {
    const p = this.pool.find(q => !q.alive);
    if (!p) return;
    const ang = (rand(pr.angle[0], pr.angle[1]) * Math.PI) / 180;
    const sp = rand(pr.speed[0], pr.speed[1]) * scale;
    const r = pr.spread * scale;
    p.alive = true; p.preset = pr; p.life = 0;
    p.max = rand(pr.life[0], pr.life[1]);
    p.x = x + rand(-r, r); p.y = y + rand(-r * 0.6, r * 0.6);
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
    p.size = rand(pr.size[0], pr.size[1]) * scale;
    p.color = pr.colors[(Math.random() * pr.colors.length) | 0];
  }
}
