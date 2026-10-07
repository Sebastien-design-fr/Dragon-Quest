// Animateur : une boucle de base (IDLE, SLEEP…) + une action ponctuelle (HAPPY, FIRE…)
// mélangée par-dessus avec fondu. Les clips sont des données JSON (www/data/animations/).
// Ajouter une animation = ajouter un fichier JSON et l'enregistrer dans animations/index.json.
import { ease, lerp } from '../core/math.js';
import { loadJSON } from '../core/data.js';
import type { AnimationClip, AnimEvent, Channel, Key } from '../core/types.js';
import type { Skeleton } from './Skeleton.js';

const NEUTRAL: Record<Channel, number> = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 };
const CHANNELS: Channel[] = ['x', 'y', 'rot', 'sx', 'sy'];

export class AnimationLibrary {
  private clips = new Map<string, AnimationClip>();

  async load(indexPath = 'data/animations/index.json'): Promise<void> {
    const index = await loadJSON<{ clips: string[] }>(indexPath);
    const clips = await Promise.all(index.clips.map(f => loadJSON<AnimationClip>(`data/animations/${f}`)));
    clips.forEach(c => this.clips.set(c.id, c));
  }
  get(id: string): AnimationClip | undefined { return this.clips.get(id); }
  ids(): string[] { return [...this.clips.keys()]; }
}

interface Playing {
  clip: AnimationClip;
  time: number;
  weight: number;
  fadingOut: boolean;
  firedUpTo: number;
  resolve?: () => void;
}

const FADE = 0.18;

export class Animator {
  private base: Playing | null = null;
  private action: Playing | null = null;
  speed = 1;
  onEvent: (e: AnimEvent) => void = () => {};

  constructor(private library: AnimationLibrary) {}

  get baseId(): string | null { return this.base?.clip.id ?? null; }
  get actionId(): string | null { return this.action?.clip.id ?? null; }
  /** Avancement de l'action en cours (0..1), pour les effets de lumière qui l'accompagnent. */
  get actionProgress(): number { const a = this.action; return a ? Math.min(1, a.time / a.clip.duration) : 0; }

  /** Joue un clip. Bouclé : devient la boucle de base. Ponctuel : joué par-dessus, promesse résolue à la fin. */
  play(id: string): Promise<void> {
    const clip = this.library.get(id);
    if (!clip) { console.warn(`Animation inconnue : ${id}`); return Promise.resolve(); }
    if (clip.loop) {
      if (this.base?.clip.id !== id) this.base = { clip, time: 0, weight: 1, fadingOut: false, firedUpTo: -1 };
      return Promise.resolve();
    }
    this.action?.resolve?.();
    return new Promise(resolve => {
      this.action = { clip, time: 0, weight: 0, fadingOut: false, firedUpTo: -1, resolve };
    });
  }

  update(dt: number, skeleton: Skeleton): void {
    dt *= this.speed;
    skeleton.resetPose();

    if (this.base) {
      const b = this.base;
      b.time += dt;
      this.fireEvents(b, b.clip.loop);
      if (b.time >= b.clip.duration) { b.time %= b.clip.duration; b.firedUpTo = -1; }
      this.apply(skeleton, b, 1, false);
    }

    const a = this.action;
    if (a) {
      a.time += dt;
      this.fireEvents(a, false);
      const remaining = a.clip.duration - a.time;
      a.weight = remaining < FADE ? Math.max(0, remaining / FADE) : Math.min(1, a.weight + dt / FADE);
      this.apply(skeleton, a, a.weight, true);
      if (a.time >= a.clip.duration) {
        this.action = null;
        a.resolve?.();
        if (a.clip.next) void this.play(a.clip.next);
      }
    }
  }

  private fireEvents(p: Playing, _loop: boolean): void {
    for (const e of p.clip.events ?? []) {
      if (e.t > p.firedUpTo && e.t <= p.time) this.onEvent(e);
    }
    p.firedUpTo = p.time;
  }

  private apply(skeleton: Skeleton, p: Playing, weight: number, blend: boolean): void {
    const rigUnit = skeleton.rig.motionScale ?? skeleton.rig.scale; // déplacements exprimés à l'échelle adulte
    const sprite = skeleton.rig.kind === 'sprite';
    for (const boneName in p.clip.tracks) {
      const bone = skeleton.bone(boneName);
      if (!bone) continue; // un clip peut viser des os optionnels
      // Illustration : les os souples (portés par le corps) se déplacent en pixels de l'image.
      const unit = sprite && bone.parent && bone.parent.def.parent ? 1 : rigUnit;
      const track = p.clip.tracks[boneName];
      for (const ch of CHANNELS) {
        const keys = track[ch];
        if (!keys) continue;
        let v = sample(keys, p.time, NEUTRAL[ch]);
        if (ch === 'x' || ch === 'y') v *= unit;
        bone.offset[ch] = blend ? lerp(bone.offset[ch], v, weight) : v;
      }
    }
  }
}

function sample(keys: Key[], t: number, neutral: number): number {
  if (keys.length === 0) return neutral;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const span = k1[0] - k0[0] || 1;
      return lerp(k0[1], k1[1], ease(k1[2] as string | undefined, (t - k0[0]) / span));
    }
  }
  return keys[keys.length - 1][1];
}
