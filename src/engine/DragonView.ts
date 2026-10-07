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
import { Mat2D } from '../core/math.js';
import { loadJSON } from '../core/data.js';
import type {
  AnimEvent, CategoryDef, EquipFit, EquipmentDef, FitTable, ParticlePreset, PartDef, QualityPreset, RarityDef, Rect, RigDef, StageDef
} from '../core/types.js';
import { Animator, AnimationLibrary } from './Animator.js';
import { AssetScope, Assets } from './AssetManager.js';
import { ParticleSystem } from './Particles.js';
import { drawEquipment, drawPart } from './Placeholders.js';
import { Skeleton } from './Skeleton.js';
import { TintCache, buildUniforms, dragonConfig, shadowBlob, type DragonLightConfig, type LightUniforms, type ShadowConfig, type VisualConfig } from './Lighting.js';
import { OrganicLife, personalityFor } from './Organic.js';
import { flightConfig, flightPhase, type FlightConfig } from './Flight.js';
import { MeshRenderer, SpriteSkin } from './SpriteSkin.js';
import { Backdrop, type BackdropDef } from './Backdrop.js';

/** Taches de saleté : [ancrage, décalage x, y, rayon, intensité] (unités : échelle des effets). */
const DIRT_SPOTS: Array<[string, number, number, number, number]> = [
  ['body_center', -40, 10, 34, 1], ['body_center', 40, -20, 26, 0.8], ['chest_anchor', 0, 10, 22, 0.9],
  ['neck_anchor', -6, 0, 16, 0.7], ['tail_anchor', 10, -5, 22, 0.9], ['tail_anchor', 60, -25, 18, 0.7],
  ['front_leg_anchor', 0, 15, 18, 1], ['rear_leg_anchor', 0, 15, 20, 1], ['head_anchor', -10, 12, 14, 0.6],
  ['right_wing_anchor', 30, 40, 26, 0.6]
];

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
  equip?: { def: EquipmentDef; anchor: string; w: number; h: number; dx: number; dy: number; rot: number; path: string | null; color: string; glow: number; phase: number; fit: EquipFit | null };
}

export interface DragonViewDeps {
  library: AnimationLibrary;
  presets: Map<string, ParticlePreset>;
  categories: Map<string, CategoryDef>;
  rarities: Map<string, RarityDef>;
  fits?: { categories: Record<string, FitTable>; items: Record<string, FitTable> };
  backdrops?: Record<string, BackdropDef>;
  /** Poses peintes disponibles : variante -> stade -> ['sleep', 'flyUp', 'flyDown']. */
  poses?: Record<string, Record<string, string[]>>;
  /** Intégration au décor : lumière, ombres, états (data/visual.json). */
  visual?: VisualConfig;
}

type PoseId = 'sleep' | 'flyUp' | 'flyMid' | 'flyDown';

/**
 * Battement d'ailes : poids des images (haut, milieu, bas) selon la phase du cycle (0..1).
 * Asymétrique : descente rapide et énergique (≈35 % du cycle), remontée plus lente.
 * Avec seulement deux images (pas de milieu), fondu court entre haut et bas.
 */
function flapWeights(phase: number, hasMid: boolean): [number, number, number] {
  const p = phase - Math.floor(phase);
  // positions clés : 0 haut · 0,175 milieu (descente) · 0,35 bas · 0,65 milieu (remontée) · 1 haut
  const keys: Array<[number, number]> = [[0, 0], [0.175, 1], [0.35, 2], [0.65, 1], [1, 0]];
  let pos = 0;
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; const u = (p - t0) / (t1 - t0); pos = v0 + (v1 - v0) * u; break; }
  }
  // pos 0..2 → poids avec fondu court (les images restent nettes la plupart du temps)
  const sharp = (x: number) => Math.min(1, Math.max(0, (x - 0.3) / 0.4));
  if (!hasMid) { const k = sharp(pos / 2); return [1 - k, 0, k]; }
  if (pos <= 1) { const k = sharp(pos); return [1 - k, k, 0]; }
  const k = sharp(pos - 1); return [0, 1 - k, k];
}

/** Lissage exponentiel indépendant de la cadence : même résultat à 30, 60, 90 ou 120 images/s. */
const damp = (a: number, b: number, rate: number, dt: number) => b + (a - b) * Math.exp(-rate * dt);

/** Mesures pour le panneau développeur. */
export interface ViewStats { fps: number; frameMs: number; renderDpr: number; canvas: string; refreshHz: number; divisor: number }

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
  /** Dragon fatigué (énergie basse) : couleurs ternies. */
  tired = false;
  /** Saleté des écailles (0 = propre, 1 = très sale) : taches dessinées sur l'illustration. */
  dirt = 0;
  private dirtCanvas: HTMLCanvasElement | null = null;

  private time = 0;
  private cam: Rect = { x: -300, y: -400, w: 600, h: 420 };
  private camTarget: Rect = { ...this.cam };
  private flash = 0;
  private shake = 0;
  private tempEmitters: { id: string; until: number }[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;
  /** Cadence : durée moyenne entre deux rafraîchissements de l'écran, nombre de rafraîchissements par image. */
  private vsync = 1000 / 60;
  private vsyncLast = 0;
  private skipped = 0;
  private divisor = 1;
  /** Vitesse de lecture (panneau développeur : 0,25× à 2×). */
  timeScale = 1;
  /** Panneau développeur : pose peinte forcée, comparaisons avant / après. */
  debugPose: PoseId | null = null;
  debug = { capDpr2: false, noMipmaps: false };
  /** LOT 2 : ombres et éclairage, désactivables (panneau développeur). */
  fx = { shadows: true, lighting: true, rim: true };
  /** Dragon invité : utilise la lumière de la scène de l'hôte. */
  sceneFrom: DragonView | null = null;
  private dcfg: { shadow: ShadowConfig; lighting: DragonLightConfig } = dragonConfig(undefined, 'adult', 'dragon');
  private lightState = { key: 'idle', w: 1 };
  /** Paramètres d'éclairage de l'image en cours (partagés avec les poses peintes). */
  private lightU: LightUniforms | null = null;
  private tints = new TintCache();
  readonly stats: ViewStats = { fps: 0, frameMs: 0, renderDpr: 1, canvas: '', refreshHz: 60, divisor: 1 };
  private tmp = new Mat2D();
  private tmp2 = new Mat2D();
  private camM = new Mat2D();
  /** Illustration déformable (os souples) et son rendu WebGL. */
  private skin: SpriteSkin | null = null;
  private skinPart: Drawable | null = null;
  private restAnchors = new Map<string, Mat2D>();
  private mesh: MeshRenderer | null | undefined;
  /** Position dans la scène (fraction de largeur) et taille relative — pour accueillir un second dragon. */
  placement = { x: 0, scale: 1 };
  /** Dragon tourné vers la gauche (invité face à l'hôte). */
  mirrored = false;
  placeTarget = { x: 0, scale: 1 };
  /** Dessiner le décor (faux pour un dragon invité superposé). */
  showBackdrop = true;
  /** Regard : direction visée par la tête (-1..1), suivie en douceur. */
  private look = { x: 0, y: 0, tx: 0, ty: 0, until: 0 };
  /** Décor derrière le dragon. */
  readonly backdrop = new Backdrop();
  /** Poses peintes (couché, ailes hautes, ailes basses) : vues filles dessinées dans ce canvas. */
  private poseViews: Partial<Record<PoseId, DragonView>> = {};
  private poseW = { sleep: 0, fly: 0 };
  private isPoseChild = false;
  /** Vie au repos : petits comportements joués au hasard. */
  idleLife = true;
  /** Vie organique (LOT 3) : mouvements de fond et micro-comportements, réglés par stade. */
  readonly life = new OrganicLife();
  /** Ressorts (queue, ailes, tête) : ils suivent le corps avec un léger retard. */
  private springs = new Map<string, { v: number; vel: number }>();
  private prevBody = { y: 0, x: 0 };
  /** Vol mis en scène : trajectoire dans la scène. */
  private flight: { t: number; dur: number; baseMirror: boolean; resolve?: () => void; dustUp?: boolean; dustDown?: boolean } | null = null;
  /** Vol (LOT 4) : réglages du stade, effets sur le corps calculés à l'image précédente, demi-tour progressif. */
  private fcfg: FlightConfig = flightConfig(undefined, 'adult', 'dragon');
  private flightBody = { y: 0, rot: 0, sy: 1, sx: 1 };
  private airborne = false;
  private facing = 1;
  private impact = { v: 0, vel: 0 };
  private bob = 0;
  private lift = 0;
  /** Battement d'ailes : phase et durée d'un cycle (s). */
  private flapPhase = 0;
  private flapRate = 1;
  /** Caméra (LOT 5) : micro-zoom centré sur le dragon. */
  private camFx = { amp: 0, t: 0, dur: 1 };
  /** Appelé à chaque animation lancée (sons). */
  onClip: ((clip: string) => void) | null = null;
  /** Appelé quand un clip demande le changement de stade (animation EVOLUTION). */
  onSwapStage: (() => Promise<void> | void) | null = null;

  get dependencies(): DragonViewDeps { return this.deps; }

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
  /** Quel dragon est affiché : 'dragon' (enfant) ou 'dragonne' (parent). */
  variant = 'dragon';

  async setStage(stage: StageDef, instant = false, variant = this.variant, rigPath?: string): Promise<void> {
    this.variant = variant;
    // Rig propre à la variante s'il existe (data/rigs/<stade>.<variante>.json), sinon celui du dragon.
    const own = variant !== 'dragon' ? stage.rig.replace(/\.sprite\.json$/, `.${variant}.json`) : null;
    const rig = rigPath ? await loadJSON<RigDef>(rigPath)
      : (own && own !== stage.rig ? await loadJSON<RigDef>(own).catch(() => null) : null) ?? await loadJSON<RigDef>(stage.rig);
    this.stage = stage;
    this.rig = rig;
    this.skeleton = new Skeleton(rig);
    // Libère les assets du stade précédent, charge uniquement ceux du nouveau.
    const previous = this.stageAssets;
    this.stageAssets = new AssetScope();
    this.drawables = [];
    this.skin = null;
    this.skinPart = null;
    for (const b of rig.bones) {
      if (!b.part) continue;
      const partPath = this.stageAssets.use(Assets.dragonPart(stage.id, b.part.key, variant));
      this.drawables.push({ z: b.part.z, layer: 'base', bone: b.name, part: b.part, partPath });
    }
    previous.dispose();
    this.camTarget = { ...rig.camera };
    this.dcfg = dragonConfig(this.deps.visual, stage.id, variant);
    this.life.setPersonality(personalityFor(this.deps.visual as never, stage.id, variant));
    this.fcfg = flightConfig(this.deps.visual as never, stage.id, variant);
    const sc = this.deps.visual?.scenes;
    this.backdrop.sceneOverrides = sc ? { ...sc.default, ...sc[stage.id] } : undefined;
    this.tints.clear();
    this.backdrop.setStage(stage.id, this.deps.backdrops?.[stage.id] ?? null, Assets.background(stage.id));
    // La boucle en cours (repos, sommeil) bascule sur la variante adaptée au nouveau type de dragon.
    const loop = this.animator.baseId;
    if (loop && this.clipFor(loop) !== loop) void this.animator.play(this.clipFor(loop));
    if (instant) this.cam = { ...rig.camera };
    this.setEquipment(this.equipment);
    this.refreshPermanentEffects();
    if (!this.isPoseChild) void this.loadPoses(stage, variant);
  }

  /** Charge les poses peintes du stade (si elles existent) comme vues filles. */
  private async loadPoses(stage: StageDef, variant: string): Promise<void> {
    for (const v of Object.values(this.poseViews)) v?.dispose();
    this.poseViews = {};
    const list = (this.deps.poses?.[variant]?.[stage.id] ?? []) as PoseId[];
    for (const pose of list) {
      const child = new DragonView(document.createElement('canvas'), this.deps);
      child.isPoseChild = true;
      child.idleLife = false;
      child.showBackdrop = false;
      try {
        await child.setStage(stage, true, variant, `data/rigs/${stage.id}.${variant}.${pose}.json`);
      } catch { continue; }
      if (this.stage !== stage || this.variant !== variant) return; // stade changé entre-temps
      child.setEquipment(this.equipment);
      this.poseViews[pose] = child;
    }
    // la boucle en cours peut maintenant utiliser la pose peinte
    const loop = this.animator.baseId;
    if (loop && this.clipFor(loop) !== loop) void this.animator.play(this.clipFor(loop));
  }

  /** Vue définitivement retirée (dragon invité) : arrête la boucle, libère images et contextes WebGL. */
  destroy(): void {
    this.stop();
    for (const v of Object.values(this.poseViews)) v?.dispose();
    this.poseViews = {};
    this.dispose();
  }

  private dispose(): void { this.stageAssets.dispose(); this.equipAssets.dispose(); this.mesh?.release(); this.mesh = undefined; this.skin = null; }

  // ---------------- Équipements ----------------
  /** Remplace l'ensemble des équipements portés (prévisualisation boutique comprise). */
  setEquipment(list: EquipmentDef[]): void {
    this.equipment = list;
    for (const v of Object.values(this.poseViews)) v?.setEquipment(list);
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
        const fit = path ? this.fitFor(def, anchorName) : null;
        if (fit?.hidden) return;
        this.drawables.push({
          z: anchor.z + cat.zOffset, layer: cat.layer, bone: anchor.bone,
          equip: {
            def, anchor: anchorName, path,
            w: cat.defaultSize[0] * scale, h: cat.defaultSize[1] * scale,
            dx: (off.x ?? 0) * this.rig!.scale, dy: (off.y ?? 0) * this.rig!.scale, rot: off.rotation ?? 0,
            color: rarity?.color ?? '#999', glow: rarity?.glow ?? 0, phase: i * 1.3, fit
          }
        });
      });
    }
    this.drawables.sort((a, b) => a.z - b.z);
    previous.dispose();
  }

  /** Placement d'un objet : catégorie puis objet ; "*" puis stade ; puis ancrage précis. */
  private fitFor(def: EquipmentDef, anchor: string): EquipFit {
    const st = this.stage!.id;
    const pose = this.rig?.pose;
    const keys = ['*', st, `*:${anchor}`, `${st}:${anchor}`, ...(pose ? [pose, `${pose}:${anchor}`] : [])];
    const out: EquipFit = {};
    for (const table of [this.deps.fits?.categories[def.category], this.deps.fits?.items[def.id]]) {
      if (!table) continue;
      for (const k of keys) if (table[k]) Object.assign(out, table[k]);
    }
    return out;
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
  play(id: string): Promise<void> {
    if (id.startsWith('sleep') && this.flight) { this.mirrored = this.flight.baseMirror; this.flight.resolve?.(); this.flight = null; this.airborne = false; this.placement.x = this.placeTarget.x; }
    const clip = this.deps.library.get(this.clipFor(id));
    if (clip && !clip.loop) this.onClip?.(id.split('@')[0]);
    return this.animator.play(this.clipFor(id));
  }

  private clipFor(id: string): string {
    let base = id.split('@')[0];
    if (base === 'sleep' && this.poseViews.sleep) base = 'sleep_pose';
    if (base === 'hover' && this.poseViews.flyUp && this.poseViews.flyDown) base = 'fly_pose';
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

  /** Repère monde d'un ancrage ; sur une illustration déformée, il suit la déformation de l'image. */
  anchorWorld(name: string, out: Mat2D): Mat2D | null {
    if (this.skin) {
      const rest = this.restAnchors.get(name);
      return rest ? this.skin.deform(rest, out) : null;
    }
    return this.skeleton?.anchorWorld(name, out) ?? null;
  }

  /** La tête regarde vers un point du canvas (coordonnées CSS), ou revient au repos (null). */
  lookAt(clientX: number | null, clientY = 0): void {
    if (clientX === null || !this.skin) { this.look.tx = 0; this.look.ty = 0; return; }
    const head = new Mat2D();
    if (!this.anchorWorld('head_anchor', head)) return;
    const p = this.camM.point(head.e, head.f);
    const r = this.canvas.getBoundingClientRect();
    const dx = (clientX - r.left) * this.dpr - p.x, dy = (clientY - r.top) * this.dpr - p.y;
    const reach = Math.max(r.width, r.height) * this.dpr * 0.5;
    this.look.tx = Math.max(-1, Math.min(1, dx / reach));
    this.look.ty = Math.max(-1, Math.min(1, dy / reach));
    this.look.until = this.time + 2.5;
  }

  /** Construit le maillage dès que l'image du dragon est chargée. */
  private ensureSkin(): void {
    if (this.skin || !this.rig?.skin || !this.skeleton) return;
    const d = this.drawables.find(x => x.part?.shape === 'sprite');
    const img = d?.partPath ? Assets.peek(d.partPath) : null;
    if (!d || !img || !(img as HTMLImageElement).width) return;
    if (this.mesh === undefined) this.mesh = MeshRenderer.create();
    if (!this.mesh) return;
    const sk = this.skeleton;
    const skin = new SpriteSkin(sk, sk.bone(d.bone)!, d.part!, img as HTMLImageElement, this.rig.skin.grid);
    if (!skin.boneCount) return;
    // Repères de repos des ancrages (le squelette est encore en pose de repos ici).
    this.restAnchors.clear();
    for (const name of sk.anchorNames()) { const m = sk.anchorWorld(name); if (m) this.restAnchors.set(name, m); }
    this.mesh.setMesh(skin, img as HTMLImageElement);
    this.skin = skin;
    this.skinPart = d;
  }

  /** Source d'émission qui suit un ancrage (donc l'os animé). */
  private anchorSource(anchor: string, preset?: ParticlePreset) {
    const local = new Mat2D();
    return () => {
      if (!this.skeleton || !this.rig) return null;
      const m = this.anchorWorld(preset?.area === 'body' ? 'body_center' : anchor, local);
      if (!m) return null;
      return { x: m.e, y: m.f, scale: this.rig.fxScale ?? this.rig.scale };
    };
  }

  /** Vol mis en scène : décolle, fait un tour de la scène en se retournant, se repose. */
  fly(): Promise<void> {
    if ((this.animator.baseId ?? '').startsWith('sleep') || this.flight) return Promise.resolve();
    const pv = this.poseViews;
    if (!(pv.flyUp && pv.flyDown)) {
      // pas de poses de vol peintes : ancienne animation
      this.flight = { t: 0, dur: 3.4, baseMirror: this.mirrored };
      return this.play('hover');
    }
    // vol entièrement procédural : accroupi → décollage → vol → descente → atterrissage
    this.onClip?.('hover');
    return new Promise(resolve => { this.flight = { t: 0, dur: this.fcfg.cruise, baseMirror: this.mirrored, resolve }; });
  }

  // ---------------- Boucle ----------------
  start(): void {
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      // Fréquence réelle de l'écran (60, 90, 120 Hz…), mesurée en continu.
      if (this.vsyncLast) {
        const d = now - this.vsyncLast;
        if (d > 4 && d < 40) this.vsync += (d - this.vsync) * 0.05;
      }
      this.vsyncLast = now;
      // Une image tous les N rafraîchissements, N entier : cadence régulière (90 Hz plafonné à 60 → 90, 120 Hz → 60).
      const hz = 1000 / this.vsync;
      this.divisor = Math.max(1, Math.floor(hz / this.quality.fpsCap + 0.05));
      if (++this.skipped < this.divisor) return;
      this.skipped = 0;
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
      if (this.last && now > this.last) this.stats.fps += (1000 / (now - this.last) - this.stats.fps) * 0.1;
      this.last = now;
      const t0 = performance.now();
      this.frame(dt * this.timeScale);
      this.stats.frameMs += (performance.now() - t0 - this.stats.frameMs) * 0.1;
      this.stats.refreshHz = Math.round(hz);
      this.stats.divisor = this.divisor;
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop(): void { cancelAnimationFrame(this.raf); this.last = 0; }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    // Densité réelle de l'écran (plafonnée par la qualité) : pas d'agrandissement flou par le navigateur.
    this.dpr = Math.min(window.devicePixelRatio || 1, this.debug.capDpr2 ? 2 : this.quality.maxResolution);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.smoothing(this.ctx);
    this.stats.renderDpr = Math.round(this.dpr * 100) / 100;
    this.stats.canvas = `${this.canvas.width}×${this.canvas.height}`;
  }

  /** Lissage de qualité pour les images réduites (décor, équipements) : à réappliquer après chaque redimensionnement. */
  private smoothing(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  /** État courant pour le panneau développeur. */
  debugInfo(): { state: string; pose: string; particles: number; tex: string; contexts: number; poses: string[] } {
    const pv = this.poseViews;
    const pose = this.debugPose ?? (this.poseW.sleep > 0.5 ? 'sleep' : this.poseW.fly > 0.5 ? 'fly (up/down)' : 'normal');
    let particles = this.particles.count();
    for (const v of Object.values(pv)) if (v) particles += v.particles.count();
    return {
      state: [this.animator.baseId, this.animator.actionId].filter(Boolean).join(' + ') + (this.flight ? ' · vol' : ''),
      pose, particles, tex: this.mesh?.texInfo ?? '—', contexts: MeshRenderer.contexts,
      poses: Object.keys(pv)
    };
  }

  /** Réglages de comparaison (panneau développeur) : appliqués immédiatement. */
  setDebug(d: Partial<{ capDpr2: boolean; noMipmaps: boolean }>): void {
    Object.assign(this.debug, d);
    this.resize();
    if (d.noMipmaps !== undefined) { MeshRenderer.mipmaps = !d.noMipmaps; this.skin = null; for (const v of Object.values(this.poseViews)) if (v) v.skin = null; }
  }

  private frame(dt: number): void {
    this.time += dt;
    const sk = this.skeleton;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!sk || !this.rig) return;

    this.ensureSkin();
    this.animator.update(dt, sk);
    this.applyLook(dt, sk);
    this.lifeTick(dt, sk);
    this.applySprings(dt, sk);
    this.applyFlightBody(dt, sk);
    sk.update(new Mat2D());
    this.skin?.update();

    for (const t of this.tempEmitters) if (this.time > t.until) this.particles.removeEmitter(t.id);
    this.tempEmitters = this.tempEmitters.filter(t => this.time <= t.until);
    this.particles.update(dt);

    // Caméra : cadre du stade, interpolé pendant une évolution.
    for (const key of ['x', 'y', 'w', 'h'] as const) this.cam[key] = damp(this.cam[key], this.camTarget[key], 3, dt);
    const s0 = Math.min(W / this.cam.w, H / this.cam.h) * 0.94;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * this.dpr : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * this.dpr : 0;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.placement.x = damp(this.placement.x, this.placeTarget.x, 2.2, dt);
    this.placement.scale = damp(this.placement.scale, this.placeTarget.scale, 2.2, dt);
    // micro-zoom d'événement : monte vite, redescend en douceur (les pattes restent sur le sol)
    let zoom = 1;
    if (this.camFx.amp) {
      this.camFx.t += dt;
      const u = this.camFx.t / this.camFx.dur;
      if (u >= 1) this.camFx.amp = 0;
      else zoom = 1 + this.camFx.amp * (u < 0.25 ? Math.sin((u / 0.25) * Math.PI / 2) : 0.5 + 0.5 * Math.cos(((u - 0.25) / 0.75) * Math.PI));
    }
    const s = s0 * this.placement.scale * zoom;
    // demi-tour en vol : le dragon pivote (largeur qui passe par zéro) au lieu de se retourner d'un coup
    const want = this.mirrored ? -1 : 1;
    this.facing = this.flight ? damp(this.facing, want, 9, dt) : want;
    const sx = s * this.facing;
    this.camM.a = sx; this.camM.b = 0; this.camM.c = 0; this.camM.d = s;
    this.camM.e = W / 2 - (this.cam.x + this.cam.w / 2) * sx + this.placement.x * W + shakeX;
    // le sol (y = 0) reste à la même hauteur quelle que soit la taille
    this.camM.f = H / 2 - (this.cam.y + this.cam.h / 2) * s0 + shakeY;
    this.flightTick(dt);

    // Décor (sol aligné sous les pattes du dragon)
    const feet = this.camM.point(0, 0);
    if (this.showBackdrop) this.backdrop.draw(ctx, W, H, feet.y, this.camM.e - W / 2, this.time, dt, this.effectsEnabled && this.quality.permanentEffects);

    // Ombres (sous le dragon, au sol) puis éclairage de l'image
    this.updateLighting(dt);
    if (this.fx.shadows) this.drawShadows(ctx);

    // En vol : tout le dragon monte (le décor et l'ombre restent au sol)
    this.camM.f -= this.lift * H;

    if (this.layers.magicalEffect) { this.camM.apply(ctx); this.particles.draw(ctx, 'magical'); }

    ctx.filter = this.tired ? 'grayscale(0.75) brightness(0.62) contrast(0.92)' : 'none';
    // boucle de repos à vitesse légèrement variable (cycle non reconnaissable), rythme propre au stade
    const onIdleLoop = (this.animator.baseId ?? '').startsWith('idle') && !this.animator.actionId;
    this.animator.speed = (this.tired ? 0.6 : 1) * (onIdleLoop ? this.life.idleRate() * this.life.p.tempo : Math.sqrt(this.life.p.tempo));
    // Poses peintes : fondu entre l'image debout et l'image couchée / en vol.
    const pv = this.poseViews;
    const base = this.animator.baseId ?? '', act = this.animator.actionId ?? '';
    let wantSleep = pv.sleep && base.startsWith('sleep') && !act ? 1 : 0;
    let wantFly = !wantSleep && pv.flyUp && pv.flyDown && (act.startsWith('fly_pose') || this.airborne) ? 1 : 0;
    const dp = this.debugPose;
    if (dp) { wantSleep = dp === 'sleep' && pv.sleep ? 1 : 0; wantFly = dp !== 'sleep' && pv[dp] ? 1 : 0; }
    this.poseW.sleep = damp(this.poseW.sleep, wantSleep, 4, dt);
    this.poseW.fly = damp(this.poseW.fly, wantFly, 6, dt);
    const wBase = Math.max(0, 1 - this.poseW.sleep - this.poseW.fly);
    if (wBase > 0.01) this.drawDragon(ctx, W, H, wBase);
    if (this.poseW.sleep > 0.01 && pv.sleep) pv.sleep.renderPose(ctx, this, W, H, this.poseW.sleep);
    if (this.poseW.fly > 0.01 && pv.flyUp && pv.flyDown) {
      // battements : ailes hautes / ailes basses, presque nets avec un court fondu
      this.flapPhase += dt / (this.fcfg.flapPeriod * this.flapRate);
      let w3 = flapWeights(this.flapPhase, !!pv.flyMid);
      if (dp === 'flyUp') w3 = [1, 0, 0]; else if (dp === 'flyMid' && pv.flyMid) w3 = [0, 1, 0]; else if (dp === 'flyDown') w3 = [0, 0, 1];
      const frames: Array<DragonView | undefined> = [pv.flyUp, pv.flyMid, pv.flyDown];
      // dessin du plus faible au plus fort : l'image dominante reste nette par-dessus
      const order = [0, 1, 2].sort((a, b) => w3[a] - w3[b]);
      for (const i of order) if (w3[i] > 0.01 && frames[i]) frames[i]!.renderPose(ctx, this, W, H, this.poseW.fly * (i === order[2] ? 1 : w3[i]));
    }
    ctx.globalAlpha = 1;

    ctx.filter = 'none';
    if (this.layers.foregroundEffect) { this.camM.apply(ctx); this.particles.draw(ctx, 'foreground'); }

    if (this.flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,236,190,${Math.min(1, this.flash)})`;
      ctx.fillRect(0, 0, W, H);
      this.flash = Math.max(0, this.flash - dt * 1.6);
    }
    if (this.showAnchors) this.drawAnchors(sk);
  }

  /** Taches de saleté posées sur les écailles (uniquement sur le dragon, pas autour). */
  private withDirt(src: HTMLCanvasElement, W: number, H: number): HTMLCanvasElement {
    const c = this.dirtCanvas ?? (this.dirtCanvas = document.createElement('canvas'));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const m = new Mat2D();
    const k = this.rig?.fxScale ?? 2;
    for (const [anchor, dx, dy, r, a] of DIRT_SPOTS) {
      if (!this.anchorWorld(anchor, m)) continue;
      const p = this.camM.point(m.e + dx * k, m.f + dy * k);
      const rad = Math.abs(r * k * this.camM.a);
      const alpha = Math.min(0.7, this.dirt * a * 0.85);
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      grd.addColorStop(0, `rgba(168,146,112,${alpha})`);
      grd.addColorStop(0.55, `rgba(140,120,92,${alpha * 0.55})`);
      grd.addColorStop(1, 'rgba(140,120,92,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(p.x, p.y, rad, 0, Math.PI * 2); g.fill();
      // grains de terre
      g.fillStyle = `rgba(150,128,96,${Math.min(0.85, this.dirt * 1.1)})`;
      let seed = (dx * 31 + dy * 17 + r) | 0;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const grains = Math.round(18 * this.dirt * a);
      for (let i = 0; i < grains; i++) {
        const ang = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * rad * 0.8;
        g.beginPath(); g.arc(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, (0.8 + rnd() * 1.6) * this.dpr, 0, Math.PI * 2); g.fill();
      }
    }
    // Voile poussiéreux général
    g.fillStyle = `rgba(120,108,92,${this.dirt * 0.2})`;
    g.fillRect(0, 0, W, H);
    return c;
  }

  /** Coordonnées CSS (relatives au canvas) d'un ancrage, pour placer une bulle. */
  /** Vue réellement visible : la pose peinte (couché, en vol) quand elle a pris le dessus. */
  private visible(): DragonView {
    const pv = this.poseViews;
    if (this.poseW.sleep > 0.5 && pv.sleep?.skeleton) return pv.sleep;
    if (this.poseW.fly > 0.5 && pv.flyUp?.skeleton) return pv.flyUp;
    return this;
  }

  screenPos(anchor: string): { x: number; y: number } | null {
    const m = new Mat2D();
    const v = this.visible();
    if (!(v === this ? this.anchorWorld(anchor, m) : v.skeleton?.anchorWorld(anchor, m))) return null;
    const p = this.camM.point(m.e, m.f);
    return { x: p.x / this.dpr, y: p.y / this.dpr };
  }

  /** Le point (coordonnées écran) touche-t-il le dragon ? */
  hitTest(clientX: number, clientY: number): boolean {
    const r = this.canvas.getBoundingClientRect();
    const inv = this.camM.invert();
    const w = inv.point((clientX - r.left) * this.dpr, (clientY - r.top) * this.dpr);
    const v = this.visible();
    if (v !== this && v.skin) return v.skin.contains(w.x, w.y);
    if (this.skin) return this.skin.contains(w.x, w.y);
    const b = this.rig?.bounds;
    return !!b && w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h;
  }

  /** Petite gerbe de particules à l'endroit touché. */
  burstAt(clientX: number, clientY: number, preset: string): void {
    const r = this.canvas.getBoundingClientRect();
    const w = this.camM.invert().point((clientX - r.left) * this.dpr, (clientY - r.top) * this.dpr);
    this.particles.burst(preset, w.x, w.y, this.rig?.fxScale ?? 2);
  }

  /** Micro-zoom sur le dragon (passage de niveau, objet rare…). */
  cameraPulse(amp: number, dur = 1.6): void { this.camFx = { amp, t: 0, dur }; }

  /** Effet continu pendant quelques secondes (particules ascendantes…). */
  emitFor(preset: string, anchor: string, seconds: number): void {
    const id = `temp:${preset}:${this.time}`;
    this.particles.setEmitter(id, preset, this.anchorSource(anchor, this.deps.presets.get(preset)));
    this.tempEmitters.push({ id, until: this.time + seconds });
  }

  /** Effet ponctuel sur un ancrage (cœurs sur la tête…). */
  emit(preset: string, anchor = 'head_anchor'): void {
    const src = this.anchorSource(anchor, this.deps.presets.get(preset))();
    if (src) this.particles.burst(preset, src.x, src.y, src.scale);
  }

  /** Dessine le dragon (illustration déformée + équipements) avec une opacité donnée. */
  private drawDragon(ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number): void {
    const sk = this.skeleton!, rig = this.rig!;
    ctx.globalAlpha = alpha;
    const style = { palette: rig.palette, params: rig.params, time: this.time, effects: this.effectsEnabled && this.quality.permanentEffects };
    for (const d of this.drawables) {
      if (this.layers[d.layer] === false) continue;
      const bone = sk.bone(d.bone);
      if (!bone) continue;
      if (d === this.skinPart && this.mesh?.ready) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.mesh.lighting = this.lightU ? { u: this.lightU, mirrored: this.camM.a < 0 } : null;
        const gl = this.mesh.render(this.camM, W, H);
        // copie pixel pour pixel : aucun filtrage nécessaire (le lissage « high » coûterait cher pour rien)
        ctx.imageSmoothingQuality = 'low';
        ctx.drawImage(this.dirt > 0.04 ? this.withDirt(gl, W, H) : gl, 0, 0);
        ctx.imageSmoothingQuality = 'high';
      } else if (d.part) {
        this.camM.multiply(bone.world, this.tmp).apply(ctx);
        const img = d.partPath ? Assets.peek(d.partPath) : null;
        if (img) ctx.drawImage(img, -d.part.pivot[0] * d.part.w, -d.part.pivot[1] * d.part.h, d.part.w, d.part.h);
        else drawPart(ctx, d.part, style);
      } else if (d.equip) {
        const e = d.equip;
        const anchorM = this.anchorWorld(e.anchor, this.tmp2);
        if (!anchorM) continue;
        const raw = e.path ? Assets.peek(e.path) : null;
        // même teinte ambiante que le dragon (copie teintée en cache, l'image source reste intacte)
        const img = raw && this.lightU ? this.tints.get(raw as HTMLImageElement, this.lightU) as HTMLImageElement : raw;
        const f = img ? e.fit : null;
        const s = rig.scale;
        let rot = e.rot + (f?.rotation ?? 0);
        if (this.quality.secondaryMotion && e.def.animationProfile === 'sway') rot += Math.sin(this.time * 2.4 + e.phase) * (f ? 2 : 7);
        Mat2D.fromTRS(e.dx + (f?.x ?? 0) * s, e.dy + (f?.y ?? 0) * s, rot, f?.flipX ? -1 : 1, 1, this.tmp);
        this.camM.multiply(anchorM.multiply(this.tmp, this.tmp), this.tmp).apply(ctx);
        if (img) {
          const [c0, c1] = f?.crop ?? [0, 1];
          const sw = img.width * (c1 - c0);
          const w = f?.width !== undefined ? f.width * s : e.w;
          const hh = w * img.height / sw;
          const [px, py] = f?.pivot ?? [0.5, 0.5];
          ctx.drawImage(img, img.width * c0, 0, sw, img.height, -px * w, -py * hh, w, hh);
        } else drawEquipment(ctx, e.def.placeholder?.shape ?? 'box', e.w, e.h, {
          color: e.color, tint: e.def.placeholder?.tint, time: this.time,
          glow: this.effectsEnabled && (e.def.animationProfile === 'pulse' || e.glow > 0.5) ? e.glow : 0
        });
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Vue fille (pose peinte) : même caméra et mêmes mouvements que la vue principale, dessinée dans son canvas. */
  private renderPose(ctx: CanvasRenderingContext2D, main: DragonView, W: number, H: number, alpha: number): void {
    const sk = this.skeleton;
    if (!sk || !this.rig) return;
    this.time = main.time;
    this.dirt = main.dirt;
    this.ensureSkin();
    sk.resetPose();
    for (const b of main.skeleton!.bones) {
      const mine = sk.bone(b.def.name);
      if (mine) Object.assign(mine.offset, b.offset);
    }
    sk.update(new Mat2D());
    this.skin?.update();
    this.camM.copy(main.camM);
    this.lightU = main.lightU;
    this.fx = main.fx;
    this.drawDragon(ctx, W, H, alpha);
  }

  /** Vie au repos : couches organiques + micro-comportements (table pondérée du stade). */
  private lifeTick(dt: number, sk: Skeleton): void {
    if (this.isPoseChild) return;
    const base = this.animator.baseId ?? '';
    const act = this.animator.actionId;
    const sleeping = base.startsWith('sleep');
    const idle = base.startsWith('idle') && !this.flight;
    const unit = this.rig?.motionScale ?? 1;
    // mouvements de fond : aussi pendant une action courte (ils s'atténuent naturellement sous le clip)
    this.life.apply(dt, sk, !this.idleLife ? (sleeping ? 'sleep' : 'off') : sleeping ? 'sleep' : idle ? 'idle' : 'off', unit);
    if (!this.idleLife) return;
    const r = this.life.tick(dt, idle && !act);
    if (!r) return;
    if (r.fly) { void this.fly(); return; }
    if (r.clip) { void this.play(r.clip); return; }
    if (r.look) {
      const L = this.look;
      L.tx = r.look[0]; L.ty = r.look[1]; L.until = this.time + r.look[2];
    }
  }

  /** Lumière de l'image : scène (décor) + dragon (stade / variante) + état (repos, sommeil, niveau…). */
  private updateLighting(dt: number): void {
    const host = this.sceneFrom ?? this;
    let scene = host.backdrop.scene;
    // la nuit (voile bleuté sur le décor), le dragon reçoit la même ambiance
    const night = host.backdrop.layers.tint ? host.backdrop.night : 0;
    if (night > 0) {
      const k = 0.55 * night;
      scene = { ...scene, ambient: scene.ambient.map((v, i) => v * (1 - k) + [0.16, 0.2, 0.42][i] * k) as [number, number, number], ambientMix: scene.ambientMix + 0.12 * night };
    }
    const act = (this.animator.actionId ?? '').split('@')[0];
    const base = (this.animator.baseId ?? 'idle').split('@')[0].replace(/_pose$/, '');
    const states = this.deps.visual?.states ?? {};
    const key = act && states[act] ? act : states[base] ? base : 'idle';
    if (key !== this.lightState.key) this.lightState = { key, w: 0 };
    this.lightState.w = damp(this.lightState.w, 1, 3.5, dt);
    // une action : effet qui monte puis redescend avec l'animation
    const env = key === act ? Math.pow(Math.sin(Math.PI * this.animator.actionProgress), 0.6) : 1;
    this.lightU = buildUniforms(scene, this.dcfg.lighting, states[key] ?? {}, this.lightState.w * env, { lighting: this.fx.lighting, rim: this.fx.rim });
    if (night > 0) this.lightU.exposure *= 1 - 0.12 * night;
  }

  /**
   * Ombres générées depuis la silhouette réellement affichée (debout, couché ou en vol), pour tous les stades :
   * ombre ambiante douce, occlusion le long du contact au sol, petites ombres de contact sous les pattes.
   * Au sol : plus petites, plus sombres, plus nettes ; en vol : plus grandes, plus pâles, plus diffuses.
   */
  private drawShadows(ctx: CanvasRenderingContext2D): void {
    const v = this.visible();
    const skin = v.skin;
    if (!skin) return;
    const P = skin.positions;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < P.length; i += 8) {
      const x = P[i], y = P[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!isFinite(minX)) return;
    // bande de contact : sommets proches du bas de la silhouette
    const band = maxY - (maxY - minY) * 0.12;
    let bMin = Infinity, bMax = -Infinity;
    for (let i = 0; i < P.length; i += 4) { if (P[i + 1] >= band) { const x = P[i]; if (x < bMin) bMin = x; if (x > bMax) bMax = x; } }
    if (!isFinite(bMin)) { bMin = minX; bMax = maxX; }
    const S = this.dcfg.shadow;
    const W = maxX - minX;
    const air = Math.min(1, this.lift / 0.12 + (this.poseW.fly > 0.5 ? 0.6 : 0));
    const ground = 1 - air;
    const blob = shadowBlob();
    ctx.save();
    this.camM.apply(ctx);
    const put = (cx: number, w: number, hgt: number, a: number) => {
      if (a <= 0.005 || w <= 0) return;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(blob, cx - w / 2, -hgt / 2, w, hgt);
    };
    // ombre ambiante : centrée sous le contact au sol, s'élargit et pâlit en vol
    const cGround = (bMin + bMax) / 2, cAir = (minX + maxX) / 2;
    const cx = cGround * ground + cAir * air;
    const wGround = (bMax - bMin) * S.ambientWidth + W * 0.15;
    const wAir = W * (0.7 + S.flightGrow * air);
    const w = wGround * ground + wAir * air;
    put(cx, w, w * S.ambientHeight * (1 + air * 0.6), S.ambientOpacity * (1 - S.flightFade * air));
    if (ground > 0.02) {
      // occlusion serrée le long du contact
      put(cGround, (bMax - bMin) * 1.02, W * S.contactSize * 0.55, S.contactOpacity * 0.65 * ground);
      // petites ombres de contact sous chaque patte (ancrages des pattes de la pose affichée)
      const m = this.tmp2;
      for (const a of ['front_leg_anchor', 'rear_leg_anchor', 'front_leg_far_anchor', 'rear_leg_far_anchor']) {
        const ok = v === this ? this.anchorWorld(a, m) : v.skeleton?.anchorWorld(a, m);
        if (!ok) continue;
        const far = a.includes('far') ? 0.7 : 1;
        put(m.e, W * S.contactSize * far, W * S.contactSize * 0.32 * far, S.contactOpacity * ground * far);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Ressorts amortis : la queue et les ailes traînent un peu derrière les mouvements du corps. */
  private applySprings(dt: number, sk: Skeleton): void {
    if (!this.quality.secondaryMotion || dt <= 0) return;
    const body = sk.bone('body');
    if (!body) return;
    const vy = (body.offset.y - this.prevBody.y) / dt;
    const vx = (body.offset.x - this.prevBody.x) / dt + (this.flight ? 60 : 0);
    this.prevBody.y = body.offset.y; this.prevBody.x = body.offset.x;
    const chain: Array<[string, number, number]> = [
      ['tail1', 0.010, 0.004], ['tail2', 0.018, 0.007], ['tail3', 0.026, 0.010], ['tail4', 0.032, 0.012], ['tail5', 0.038, 0.014],
      ['wing2', -0.03, 0], ['wingFar', -0.02, 0], ['head', 0.012, 0]
    ];
    for (const [name, gy, gx] of chain) {
      const b = sk.bone(name);
      if (!b) continue;
      const target = b.offset.rot + Math.max(-14, Math.min(14, vy * gy + vx * gx));
      let st = this.springs.get(name);
      if (!st) { st = { v: target, vel: 0 }; this.springs.set(name, st); }
      // intégration à pas fixe (1/240 s) : même comportement quelle que soit la cadence
      const k = this.life.p.inertia.k, c = this.life.p.inertia.c, h = 1 / 240;
      for (let left = dt; left > 1e-6; left -= h) {
        const step = Math.min(h, left);
        st.vel += (k * (target - st.v) - c * st.vel) * step;
        st.v += st.vel * step;
      }
      b.offset.rot = st.v;
    }
  }

  /**
   * Vol (LOT 4), commun à toutes les évolutions, réglé par stade (data/visual.json → flight) :
   * accroupi (anticipation) → impulsion + poussière → montée à grands battements → vol et demi-tour
   * → descente plané → contact (écrasement léger, poussière, éventuelle secousse) → récupération.
   */
  private flightTick(dt: number): void {
    const f = this.flight;
    if (!f) {
      this.lift = damp(this.lift, 0, 6, dt);
      this.airborne = false;
      this.flapRate = 1;
      this.flightBody.y = 0; this.flightBody.rot = damp(this.flightBody.rot, 0, 6, dt);
      return;
    }
    const legacy = !f.resolve;
    f.t += dt;
    if (legacy) {
      const u = Math.min(1, f.t / f.dur);
      const ease = (x: number) => x * x * (3 - 2 * x);
      const up = u < 0.2 ? ease(u / 0.2) : u > 0.82 ? ease((1 - u) / 0.18) : 1;
      this.lift = 0.14 * up;
      const cruise = u < 0.2 ? 0 : u > 0.82 ? 1 : (u - 0.2) / 0.62;
      this.placement.x = this.placeTarget.x + 0.1 * Math.sin(cruise * Math.PI * 2);
      this.placement.scale = this.placeTarget.scale * (1 - 0.2 * up);
      this.mirrored = u > 0.2 && u < 0.82 && Math.cos(cruise * Math.PI * 2) < 0 ? !f.baseMirror : f.baseMirror;
      this.airborne = up > 0.3;
      if (u >= 1) { this.flight = null; this.mirrored = f.baseMirror; }
      return;
    }
    const c = this.fcfg;
    const P = flightPhase(c, f.t);
    const prevLift = this.lift;
    this.airborne = P.airborne;
    this.flapRate = P.flapRate;
    // battement : le corps monte pendant la descente des ailes, retombe doucement à la remontée
    const fp = this.flapPhase - Math.floor(this.flapPhase);
    const push = fp < 0.35 ? Math.sin((fp / 0.35) * Math.PI / 2) : Math.cos(((fp - 0.35) / 0.65) * Math.PI / 2);
    this.bob = damp(this.bob, P.airborne ? push - 0.5 : 0, 10, dt);
    this.lift = c.height * P.height + c.bob * this.bob * P.height;
    // trajectoire horizontale : aller, demi-tour, retour (pendant la phase de vol uniquement)
    const x = c.travel * Math.sin(P.cruise * Math.PI * 2);
    this.placement.x = this.placeTarget.x + x;
    this.placement.scale = this.placeTarget.scale * (1 - c.recede * P.height);
    const goingLeft = P.cruise > 0 && P.cruise < 1 && Math.cos(P.cruise * Math.PI * 2) < 0;
    this.mirrored = goingLeft ? !f.baseMirror : f.baseMirror;
    // inclinaison : nez vers le haut en montée, vers le bas en descente, petite houle en vol
    const vy = (this.lift - prevLift) / Math.max(1e-3, dt);
    this.flightBody.rot = damp(this.flightBody.rot, Math.max(-c.tilt, Math.min(c.tilt, -vy * c.tilt * 2.5)), 5, dt);
    // accroupi avant le saut (sur l'image debout) puis détente
    this.flightBody.y = P.crouch * c.crouchDepth;
    // poussière au décollage et à l'atterrissage
    if (!f.dustUp && P.airborne) { f.dustUp = true; this.emit('dust', 'front_leg_anchor'); this.emit('dust', 'rear_leg_anchor'); }
    if (!f.dustDown && P.touchdown) {
      f.dustDown = true;
      // poussière à l'atterrissage pour tous les stades ; landingDust = nombre de nuages par patte
      for (let i = 0; i < Math.max(1, Math.round(c.landingDust)); i++) {
        this.emit('dustLand', 'front_leg_anchor'); this.emit('dustLand', 'rear_leg_anchor');
      }
      this.emit('dustLand', 'front_leg_far_anchor'); this.emit('dustLand', 'rear_leg_far_anchor');
      this.impact.vel -= c.impact * 14;           // écrasement léger à l'impact, amorti ensuite
      if (c.shake > 0) this.shake = Math.max(this.shake, c.shake);
    }
    if (P.done) {
      this.flight = null;
      this.mirrored = f.baseMirror;
      this.airborne = false;
      this.placement.x = this.placeTarget.x;
      f.resolve?.();
    }
  }

  /** Effets du vol sur le corps (accroupi, inclinaison, écrasement à l'atterrissage), avant la déformation. */
  private applyFlightBody(dt: number, sk: Skeleton): void {
    const body = sk.bone('body');
    if (!body) return;
    // ressort de l'écrasement d'atterrissage (indépendant de la cadence)
    const k = 260, cc = 16, h = 1 / 240;
    for (let left = dt; left > 1e-6; left -= h) {
      const st = Math.min(h, left);
      this.impact.vel += (-k * this.impact.v - cc * this.impact.vel) * st;
      this.impact.v += this.impact.vel * st;
    }
    const sq = Math.max(-0.06, Math.min(0.04, this.impact.v));
    const fb = this.flightBody;
    const unit = this.rig?.motionScale ?? 1;
    body.offset.y += fb.y * unit;
    body.offset.rot += fb.rot;
    body.offset.sy *= 1 + sq - fb.y * 0.004;
    body.offset.sx *= 1 - sq * 0.45;
  }

  /** Regard : s'ajoute à l'animation en cours (tête et cou), avec un retour progressif au repos. */
  private applyLook(dt: number, sk: Skeleton): void {
    if (!this.skin) return;
    const L = this.look;
    if (this.time > L.until) { L.tx = 0; L.ty = 0; }
    L.x = damp(L.x, L.tx, 4, dt); L.y = damp(L.y, L.ty, 4, dt);
    if (Math.abs(L.x) + Math.abs(L.y) < 1e-3) return;
    // vers le haut / le bas : la tête pivote ; vers l'avant / l'arrière : le cou se tend ou se recule.
    const head = sk.bone('head'), n2 = sk.bone('neck2'), n1 = sk.bone('neck1');
    if (head) head.offset.rot += L.y * 16 - L.x * 3;
    if (n2) n2.offset.rot += L.y * 5 + L.x * 6;
    if (n1) n1.offset.rot += L.x * 5;
  }

  private drawAnchors(sk: Skeleton): void {
    const ctx = this.ctx;
    ctx.font = `${10 * this.dpr}px sans-serif`;
    for (const name of sk.anchorNames()) {
      const m = this.anchorWorld(name, this.tmp2);
      if (!m) continue;
      const p = this.camM.point(m.e, m.f);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = '#7fe0ff'; ctx.lineWidth = this.dpr;
      ctx.beginPath(); ctx.moveTo(p.x - 5 * this.dpr, p.y); ctx.lineTo(p.x + 5 * this.dpr, p.y); ctx.moveTo(p.x, p.y - 5 * this.dpr); ctx.lineTo(p.x, p.y + 5 * this.dpr); ctx.stroke();
      ctx.fillStyle = '#7fe0ff'; ctx.fillText(name.replace('_anchor', ''), p.x + 6 * this.dpr, p.y - 4 * this.dpr);
    }
  }
}
