// Personnage dragon composé de couches indépendantes :
//
//   magicalEffect      (particules derrière le dragon)
//   base               (pièces du corps, une par os)
//   headEquipment, neckEquipment, bodyEquipment, legEquipment, wingEquipment, tailEquipment
//   foregroundEffect   (particules devant le dragon)
//
// Chaque couche s'active / se désactive / se remplace indépendamment. Les équipements ne sont
// JAMAIS positionnés en coordonnées écran : ils sont accrochés à un ancrage, lui-même porté
// par un os animé. Quand la tête bouge, le casque suit ; quand l'aile bat, sa protection suit.
import { Mat2D, lerp } from '../core/math.js';
import { loadJSON } from '../core/data.js';
import type {
  AnimEvent, CategoryDef, EquipmentDef, ParticlePreset, PartDef, QualityPreset, RarityDef, Rect, RigDef, StageDef
} from '../core/types.js';
import { Animator, AnimationLibrary } from './Animator.js';
import { AssetScope, Assets } from './AssetManager.js';
import { ParticleSystem } from './Particles.js';
import { drawEquipment, drawPart } from './Placeholders.js';
import { Skeleton } from './Skeleton.js';

export const LAYERS = [
  'magicalEffect', 'base', 'headEquipment', 'neckEquipment', 'bodyEquipment',
  'legEquipment', 'wingEquipment', 'tailEquipment', 'foregroundEffect'
] as const;
export type LayerName = typeof LAYERS[number] | string;

interface Drawable {
  z: number;
  layer: LayerName;
  bone: string;
  /** Pièce du dragon */
  part?: PartDef;
  partPath?: string | null;
  /** Équipement */
  equip?: { def: EquipmentDef; anchor: string; w: number; h: number; dx: number; dy: number; rot: number; path: string | null; color: string; glow: number; phase: number };
}

export interface DragonViewDeps {
  library: AnimationLibrary;
  presets: Map<string, ParticlePreset>;
  categories: Map<string, CategoryDef>;
  rarities: Map<string, RarityDef>;
}

export class DragonView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly animator: Animator;
  readonly particles: ParticleSystem;

  stage: StageDef | null = null;
  private rig: RigDef | null = null;
  private skeleton: Skeleton | null = null;
  private drawables: Drawable[] = [];
  private stageAssets = new AssetScope();
  private equipAssets = new AssetScope();
  private equipment: EquipmentDef[] = [];

  layers: Record<string, boolean> = Object.fromEntries(LAYERS.map(l => [l, true]));
  quality: QualityPreset = { particleMultiplier: 1, permanentEffects: true, fpsCap: 60, maxResolution: 2, secondaryMotion: true };
  effectsEnabled = true;
  showAnchors = false;

  private time = 0;
  private cam: Rect = { x: -300, y: -400, w: 600, h: 420 };
  private camTarget: Rect = { ...this.cam };
  private flash = 0;
  private shake = 0;
  private tempEmitters: { id: string; until: number }[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;
  private tmp = new Mat2D();
  private tmp2 = new Mat2D();
  private camM = new Mat2D();
  /** Appelé quand un clip demande le changement de stade (animation EVOLUTION). */
  onSwapStage: (() => Promise<void> | void) | null = null;

  constructor(canvas: HTMLCanvasElement, private deps: DragonViewDeps) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.animator = new Animator(deps.library);
    this.animator.onEvent = e => this.handleEvent(e);
    this.particles = new ParticleSystem(deps.presets);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  // ---------------- Stade ----------------
  async setStage(stage: StageDef, instant = false): Promise<void> {
    const rig = await loadJSON<RigDef>(stage.rig);
    this.stage = stage;
    this.rig = rig;
    this.skeleton = new Skeleton(rig);
    // Libère les assets du stade précédent, charge uniquement ceux du nouveau.
    const previous = this.stageAssets;
    this.stageAssets = new AssetScope();
    this.drawables = [];
    for (const b of rig.bones) {
      if (!b.part) continue;
      const partPath = this.stageAssets.use(Assets.dragonPart(stage.id, b.part.key));
      this.drawables.push({ z: b.part.z, layer: 'base', bone: b.name, part: b.part, partPath });
    }
    previous.dispose();
    this.camTarget = { ...rig.camera };
    // La boucle en cours (repos, sommeil) bascule sur la variante adaptée au nouveau type de dragon.
    const loop = this.animator.baseId;
    if (loop && this.clipFor(loop) !== loop) void this.animator.play(this.clipFor(loop));
    if (instant) this.cam = { ...rig.camera };
    this.setEquipment(this.equipment);
    this.refreshPermanentEffects();
  }

  // ---------------- Équipements ----------------
  /** Remplace l'ensemble des équipements portés (prévisualisation boutique comprise). */
  setEquipment(list: EquipmentDef[]): void {
    this.equipment = list;
    if (!this.rig || !this.stage || !this.skeleton) return;
    const previous = this.equipAssets;
    this.equipAssets = new AssetScope();
    this.drawables = this.drawables.filter(d => !d.equip);
    this.particles.clearEmitters('equip:');

    for (const def of list) {
      const cat = this.deps.categories.get(def.category);
      if (!cat || !def.compatibleDragonStages.includes(this.stage.id)) continue;
      const rarity = this.deps.rarities.get(def.rarity);
      if (cat.kind === 'effect') {
        if (def.effect) {
          const preset = this.deps.presets.get(def.effect);
          this.particles.setEmitter(`equip:${def.id}`, def.effect, this.anchorSource('body_center', preset));
        }
        continue;
      }
      const path = this.equipAssets.use(Assets.equipment(def, this.stage.id));
      const off = def.offsets?.[this.stage.id] ?? {};
      const scale = this.rig.scale * (off.scale ?? 1);
      (def.anchor ?? cat.anchors).forEach((anchorName, i) => {
        const anchor = this.skeleton!.anchor(anchorName);
        if (!anchor) return;
        this.drawables.push({
          z: anchor.z + cat.zOffset, layer: cat.layer, bone: anchor.bone,
          equip: {
            def, anchor: anchorName, path,
            w: cat.defaultSize[0] * scale, h: cat.defaultSize[1] * scale,
            dx: (off.x ?? 0) * this.rig!.scale, dy: (off.y ?? 0) * this.rig!.scale, rot: off.rotation ?? 0,
            color: rarity?.color ?? '#999', glow: rarity?.glow ?? 0, phase: i * 1.3
          }
        });
      });
    }
    this.drawables.sort((a, b) => a.z - b.z);
    previous.dispose();
  }

  setLayerVisible(layer: LayerName, visible: boolean): void { this.layers[layer] = visible; }

  // ---------------- Qualité ----------------
  setQuality(q: QualityPreset, effects: boolean): void {
    this.quality = q;
    this.effectsEnabled = effects;
    this.particles.multiplier = effects ? q.particleMultiplier : 0;
    this.resize();
    this.refreshPermanentEffects();
  }

  private refreshPermanentEffects(): void {
    this.particles.clearEmitters('stage:');
    if (!this.stage || !this.effectsEnabled || !this.quality.permanentEffects) return;
    for (const id of this.stage.permanentEffects) {
      this.particles.setEmitter(`stage:${id}`, id, this.anchorSource('body_center', this.deps.presets.get(id)));
    }
  }

  // ---------------- Animations ----------------
  /** Joue une animation ; un dragon « illustration entière » utilise sa variante <id>@sprite si elle existe. */
  play(id: string): Promise<void> { return this.animator.play(this.clipFor(id)); }

  private clipFor(id: string): string {
    const base = id.split('@')[0];
    if (this.rig?.kind === 'sprite' && this.deps.library.get(base + '@sprite')) return base + '@sprite';
    return base;
  }

  private handleEvent(e: AnimEvent): void {
    switch (e.type) {
      case 'emit': {
        if (!e.preset) return;
        const preset = this.deps.presets.get(e.preset);
        const src = this.anchorSource(e.anchor ?? 'body_center', preset);
        if (e.value) { // émetteur temporaire (souffle de feu…)
          const id = `temp:${e.preset}:${this.time}`;
          this.particles.setEmitter(id, e.preset, src);
          this.tempEmitters.push({ id, until: this.time + e.value });
        } else {
          const p = src();
          if (p) this.particles.burst(e.preset, p.x, p.y, p.scale);
        }
        break;
      }
      case 'flash': this.flash = e.value ?? 1; break;
      case 'shake': this.shake = e.value ?? 6; break;
      case 'swapStage': void this.onSwapStage?.(); break;
    }
  }

  /** Source d'émission qui suit un ancrage (donc l'os animé). */
  private anchorSource(anchor: string, preset?: ParticlePreset) {
    const local = new Mat2D();
    return () => {
      if (!this.skeleton || !this.rig) return null;
      const m = this.skeleton.anchorWorld(preset?.area === 'body' ? 'body_center' : anchor, local);
      if (!m) return null;
      return { x: m.e, y: m.f, scale: this.rig.fxScale ?? this.rig.scale };
    };
  }

  // ---------------- Boucle ----------------
  start(): void {
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      const minDt = 1000 / this.quality.fpsCap - 1;
      if (this.last && now - this.last < minDt) return;
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
      this.last = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop(): void { cancelAnimationFrame(this.raf); this.last = 0; }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxResolution);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  }

  private frame(dt: number): void {
    this.time += dt;
    const sk = this.skeleton;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!sk || !this.rig) return;

    this.animator.update(dt, sk);
    sk.update(new Mat2D());

    for (const t of this.tempEmitters) if (this.time > t.until) this.particles.removeEmitter(t.id);
    this.tempEmitters = this.tempEmitters.filter(t => this.time <= t.until);
    this.particles.update(dt);

    // Caméra : cadre du stade, interpolé pendant une évolution.
    const k = Math.min(1, dt * 3);
    for (const key of ['x', 'y', 'w', 'h'] as const) this.cam[key] = lerp(this.cam[key], this.camTarget[key], k);
    const s = Math.min(W / this.cam.w, H / this.cam.h) * 0.94;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * this.dpr : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * this.dpr : 0;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.camM.a = s; this.camM.b = 0; this.camM.c = 0; this.camM.d = s;
    this.camM.e = W / 2 - (this.cam.x + this.cam.w / 2) * s + shakeX;
    this.camM.f = H / 2 - (this.cam.y + this.cam.h / 2) * s + shakeY;

    // Ombre au sol
    this.camM.apply(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    const fx = this.rig.fxScale ?? this.rig.scale;
    ctx.beginPath(); ctx.ellipse(0, 4 * fx, this.rig.bounds.w * 0.32, 10 * fx, 0, 0, Math.PI * 2); ctx.fill();

    if (this.layers.magicalEffect) { this.camM.apply(ctx); this.particles.draw(ctx, 'magical'); }

    const style = { palette: this.rig.palette, params: this.rig.params, time: this.time, effects: this.effectsEnabled && this.quality.permanentEffects };
    for (const d of this.drawables) {
      if (this.layers[d.layer] === false) continue;
      const bone = sk.bone(d.bone);
      if (!bone) continue;
      if (d.part) {
        this.camM.multiply(bone.world, this.tmp).apply(ctx);
        const img = d.partPath ? Assets.peek(d.partPath) : null;
        if (img) ctx.drawImage(img, -d.part.pivot[0] * d.part.w, -d.part.pivot[1] * d.part.h, d.part.w, d.part.h);
        else drawPart(ctx, d.part, style);
      } else if (d.equip) {
        const e = d.equip;
        const anchorM = sk.anchorWorld(e.anchor, this.tmp2);
        if (!anchorM) continue;
        let rot = e.rot;
        if (this.quality.secondaryMotion && e.def.animationProfile === 'sway') rot += Math.sin(this.time * 2.4 + e.phase) * 7;
        Mat2D.fromTRS(e.dx, e.dy, rot, 1, 1, this.tmp);
        this.camM.multiply(anchorM.multiply(this.tmp, this.tmp), this.tmp).apply(ctx);
        const img = e.path ? Assets.peek(e.path) : null;
        if (img) ctx.drawImage(img, -e.w / 2, -e.h / 2, e.w, e.h);
        else drawEquipment(ctx, e.def.placeholder?.shape ?? 'box', e.w, e.h, {
          color: e.color, tint: e.def.placeholder?.tint, time: this.time,
          glow: this.effectsEnabled && (e.def.animationProfile === 'pulse' || e.glow > 0.5) ? e.glow : 0
        });
      }
    }

    if (this.layers.foregroundEffect) { this.camM.apply(ctx); this.particles.draw(ctx, 'foreground'); }

    if (this.flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,236,190,${Math.min(1, this.flash)})`;
      ctx.fillRect(0, 0, W, H);
      this.flash = Math.max(0, this.flash - dt * 1.6);
    }
    if (this.showAnchors) this.drawAnchors(sk);
  }

  private drawAnchors(sk: Skeleton): void {
    const ctx = this.ctx;
    ctx.font = `${10 * this.dpr}px sans-serif`;
    for (const name of sk.anchorNames()) {
      const m = sk.anchorWorld(name, this.tmp2);
      if (!m) continue;
      const p = this.camM.point(m.e, m.f);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = '#7fe0ff'; ctx.lineWidth = this.dpr;
      ctx.beginPath(); ctx.moveTo(p.x - 5 * this.dpr, p.y); ctx.lineTo(p.x + 5 * this.dpr, p.y); ctx.moveTo(p.x, p.y - 5 * this.dpr); ctx.lineTo(p.x, p.y + 5 * this.dpr); ctx.stroke();
      ctx.fillStyle = '#7fe0ff'; ctx.fillText(name.replace('_anchor', ''), p.x + 6 * this.dpr, p.y - 4 * this.dpr);
    }
  }
}
