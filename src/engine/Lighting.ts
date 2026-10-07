// Intégration du dragon dans le décor : lumière de la scène (mesurée sur l'image du décor, jamais modifiée),
// réglages du dragon par stade / variante (data/visual.json), modificateurs selon l'état (sommeil, niveau…).
// Tout est générique : aucun réglage n'est écrit dans le code pour un stade particulier.

export type RGB = [number, number, number];

export interface SceneLight {
  /** Couleur ambiante moyenne autour du dragon (0..1). */
  ambient: RGB;
  /** Direction d'où vient la lumière principale (écran, normalisée ; y vers le bas). */
  dir: [number, number];
  /** Couleur de la lumière principale (0..1). */
  light: RGB;
  ambientMix: number;
  lightStrength: number;
  rimStrength: number;
  rimWidth: number;
  rimColorBoost: number;
}

export interface ShadowConfig {
  ambientOpacity: number; ambientWidth: number; ambientHeight: number;
  contactOpacity: number; contactSize: number;
  flightGrow: number; flightFade: number;
}
export interface DragonLightConfig { ambientMix: number; light: number; rim: number; topLight: number; bottomShade: number }
export interface StateModifier { light?: number; rim?: number; exposure?: number; glow?: number; glowColor?: RGB }

export interface VisualConfig {
  scenes: Record<string, Partial<SceneLight>>;
  dragons: Record<string, { shadow?: Partial<ShadowConfig>; lighting?: Partial<DragonLightConfig> }>;
  states: Record<string, StateModifier>;
}

/** Paramètres envoyés au shader du dragon pour une image. */
export interface LightUniforms {
  ambient: RGB; ambientMix: number;
  dir: [number, number]; light: RGB; lightStrength: number;
  rim: number; rimWidth: number; rimColor: RGB;
  top: number; bottom: number;
  exposure: number; glow: number; glowColor: RGB;
  enabled: boolean;
}

export const NEUTRAL_SCENE: SceneLight = {
  ambient: [0.55, 0.5, 0.45], dir: [-0.6, -0.8], light: [1, 0.92, 0.8],
  ambientMix: 0.16, lightStrength: 0.1, rimStrength: 0.32, rimWidth: 3, rimColorBoost: 1.25
};

const SHADOW_DEFAULT: ShadowConfig = { ambientOpacity: 0.42, ambientWidth: 1.25, ambientHeight: 0.16, contactOpacity: 0.55, contactSize: 0.11, flightGrow: 0.55, flightFade: 0.75 };
const LIGHT_DEFAULT: DragonLightConfig = { ambientMix: 1, light: 1, rim: 1, topLight: 0.06, bottomShade: 0.1 };

/** Réglages du dragon : default → stade → variante.default → variante.stade. */
export function dragonConfig(cfg: VisualConfig | undefined, stage: string, variant: string): { shadow: ShadowConfig; lighting: DragonLightConfig } {
  const d = cfg?.dragons ?? {};
  const chain = [d.default, d[stage], d[`${variant}.default`], d[`${variant}.${stage}`]];
  const shadow = { ...SHADOW_DEFAULT }, lighting = { ...LIGHT_DEFAULT };
  for (const c of chain) { if (c?.shadow) Object.assign(shadow, c.shadow); if (c?.lighting) Object.assign(lighting, c.lighting); }
  return { shadow, lighting };
}

/**
 * Lumière de la scène mesurée sur l'image du décor (lecture seule) :
 * couleur moyenne de la zone où se tient le dragon, direction des zones les plus lumineuses.
 */
export function analyseScene(img: CanvasImageSource & { width: number; height: number }, floor: number, overrides?: Partial<SceneLight>): SceneLight {
  const N = 48;
  const out: SceneLight = { ...NEUTRAL_SCENE, ...overrides };
  try {
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, N, N);
    const px = g.getImageData(0, 0, N, N).data;
    const lum = (i: number) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    // zone du dragon : tiers central, du milieu de l'image jusqu'au sol
    let r = 0, gg = 0, b = 0, n = 0;
    const y0 = Math.floor(N * Math.max(0.2, floor - 0.45)), y1 = Math.floor(N * Math.min(1, floor + 0.05));
    for (let y = y0; y < y1; y++) for (let x = Math.floor(N * 0.2); x < Math.floor(N * 0.8); x++) {
      const i = (y * N + x) * 4; r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++;
    }
    if (n) out.ambient = [r / n / 255, gg / n / 255, b / n / 255];
    // lumière principale : barycentre des 6 % de pixels les plus lumineux, vu depuis le centre du dragon
    const all: number[] = [];
    for (let i = 0; i < N * N; i++) all.push(lum(i * 4));
    const sorted = [...all].sort((a, z) => z - a);
    const thr = sorted[Math.floor(all.length * 0.06)];
    let sx = 0, sy = 0, sw = 0, lr = 0, lg = 0, lb = 0;
    for (let i = 0; i < N * N; i++) {
      if (all[i] < thr) continue;
      const w = all[i] - thr + 1;
      sx += (i % N) * w; sy += Math.floor(i / N) * w; sw += w;
      lr += px[i * 4] * w; lg += px[i * 4 + 1] * w; lb += px[i * 4 + 2] * w;
    }
    if (sw && !overrides?.dir) {
      const cx = N * 0.5, cy = N * (floor - 0.2);
      let dx = sx / sw - cx, dy = sy / sw - cy;
      // une lumière venant du sol est rare : on garde toujours une composante venant d'en haut
      dy = Math.min(dy, -N * 0.15);
      const l = Math.hypot(dx, dy) || 1;
      out.dir = [dx / l, dy / l];
      if (!overrides?.light) {
        const m = Math.max(lr, lg, lb) || 1;
        out.light = [lr / m, lg / m, lb / m];
      }
    }
  } catch { /* image indisponible : lumière neutre */ }
  return out;
}

/** Combine scène + dragon + état en paramètres de shader. */
export function buildUniforms(scene: SceneLight, dragon: DragonLightConfig, state: StateModifier, statePulse: number, enabled: { lighting: boolean; rim: boolean }): LightUniforms {
  const boost = scene.rimColorBoost;
  const rimC: RGB = [Math.min(1.4, scene.light[0] * boost), Math.min(1.4, scene.light[1] * boost), Math.min(1.4, scene.light[2] * boost)];
  const sRim = 1 + ((state.rim ?? 1) - 1) * statePulse;
  const sLight = 1 + ((state.light ?? 1) - 1) * statePulse;
  return {
    ambient: scene.ambient, ambientMix: enabled.lighting ? scene.ambientMix * dragon.ambientMix : 0,
    dir: scene.dir, light: scene.light, lightStrength: enabled.lighting ? scene.lightStrength * dragon.light * sLight : 0,
    rim: enabled.rim ? scene.rimStrength * dragon.rim * sRim : 0, rimWidth: scene.rimWidth, rimColor: rimC,
    top: enabled.lighting ? dragon.topLight : 0, bottom: enabled.lighting ? dragon.bottomShade : 0,
    exposure: 1 + ((state.exposure ?? 1) - 1) * statePulse,
    glow: (state.glow ?? 0) * statePulse, glowColor: (state.glowColor ?? [255, 220, 160]).map(v => v / 255) as RGB,
    enabled: enabled.lighting || enabled.rim
  };
}

/** Teinte ambiante appliquée aux équipements (dessinés hors shader) : copie teintée mise en cache. */
export class TintCache {
  private cache = new Map<unknown, { key: string; canvas: HTMLCanvasElement }>();
  get(img: CanvasImageSource & { width: number; height: number }, u: LightUniforms): CanvasImageSource {
    if (!u.enabled || u.ambientMix <= 0.001) return img;
    const t = tintColor(u);
    const key = t.map(v => v.toFixed(2)).join(',');
    const hit = this.cache.get(img);
    if (hit && hit.key === key) return hit.canvas;
    const c = hit?.canvas ?? document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${Math.round(t[0] * 255)},${Math.round(t[1] * 255)},${Math.round(t[2] * 255)})`;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-over';
    this.cache.set(img, { key, canvas: c });
    return c;
  }
  clear(): void { this.cache.clear(); }
}

/** Couleur multiplicative équivalente à la teinte ambiante du shader (même formule). */
export function tintColor(u: LightUniforms): RGB {
  const a = u.ambient;
  const l = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2] || 1;
  const k = u.ambientMix;
  return [0, 1, 2].map(i => Math.min(1, (1 - k) + k * Math.min(1.6, a[i] / l) * 0.92)) as RGB;
}

/** Tache d'ombre douce pré-rendue (dégradé radial), réutilisée à toutes les tailles. */
let blob: HTMLCanvasElement | null = null;
export function shadowBlob(): HTMLCanvasElement {
  if (blob) return blob;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.35, 'rgba(0,0,0,0.82)');
  grd.addColorStop(0.7, 'rgba(0,0,0,0.32)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  blob = c;
  return c;
}
