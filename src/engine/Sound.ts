// Sons du dragon et de l'interface (Web Audio). Chargés à la demande, joués sans latence.
// Volume réglable, mode muet, silence la nuit sauf pour les gestes de l'enfant.

export type SoundId = 'purr' | 'chirp' | 'baby' | 'roar_young' | 'roar_adult' | 'roar_legendary' | 'grumble' | 'fire' | 'eat'
  | 'attack' | 'wings' | 'coins' | 'gem' | 'chest' | 'levelup' | 'evolution';

// Mixage volontairement contenu : les récompenses restent lisibles sans couvrir la voix du dragon.
const GAIN: Partial<Record<SoundId, number>> = {
  coins: 1.05, gem: 1.1, chest: 1.0, levelup: 0.95, evolution: 0.9,
  wings: 0.72, fire: 0.82, attack: 0.85, eat: 0.8, purr: 0.72,
  baby: 0.82, chirp: 0.78, roar_young: 0.82, roar_adult: 0.86, roar_legendary: 0.88,
  grumble: 0.68
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundId, Promise<AudioBuffer | null>>();
  private playing = new Map<SoundId, AudioBufferSourceNode>();
  volume = 0.65;
  muted = false;

  private audio(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    } catch { this.ctx = null; }
    return this.ctx;
  }

  private load(id: SoundId): Promise<AudioBuffer | null> {
    let p = this.buffers.get(id);
    if (!p) {
      p = fetch(`assets/sounds/${id}.mp3`).then(r => r.arrayBuffer()).then(b => this.audio()!.decodeAudioData(b)).catch(() => null);
      this.buffers.set(id, p);
    }
    return p;
  }

  /** Précharge les sons les plus fréquents. */
  warm(ids: SoundId[]): void { if (this.audio()) ids.forEach(id => void this.load(id)); }

  /**
   * Joue un son. once : ne relance pas s'il est déjà en cours (ronronnement).
   * user : déclenché par un geste (autorisé même la nuit).
   */
  async play(id: SoundId, opts: { once?: boolean; user?: boolean; rate?: number; gain?: number } = {}): Promise<void> {
    if (this.muted || this.volume <= 0) return;
    const h = new Date().getHours();
    if (!opts.user && (h >= 22 || h < 7)) return;
    if (opts.once && this.playing.has(id)) return;
    const ctx = this.audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    const buf = await this.load(id);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = this.volume * (GAIN[id] ?? 1) * (opts.gain ?? 1);
    src.connect(g).connect(ctx.destination);
    this.playing.set(id, src);
    src.onended = () => { if (this.playing.get(id) === src) this.playing.delete(id); };
    src.start();
  }

  stop(id: SoundId): void { try { this.playing.get(id)?.stop(); } catch { /* déjà fini */ } this.playing.delete(id); }

  /** Son associé à une animation du dragon, selon son stade. */
  forClip(clip: string, stage: string, variant = 'dragon'): void {
    const roar: SoundId = stage === 'baby' ? 'baby' : stage === 'young' ? 'roar_young' : stage === 'adult' ? 'roar_adult' : 'roar_legendary';
    const voice: SoundId = stage === 'baby' ? 'baby' : 'chirp';
    const pitch = (stage === 'baby' ? 1.15 : stage === 'young' ? 1.05 : stage === 'legendary' ? 0.92 : 1) * (variant === 'dragonne' ? 1.1 : 1);
    const map: Record<string, () => void> = {
      happy: () => void this.play(voice, { user: true, rate: pitch }),
      cheer: () => void this.play(voice, { user: true, rate: pitch * 1.08 }),
      welcome: () => void this.play(voice, { user: true, rate: pitch }),
      bow: () => void this.play(voice, { user: true, rate: pitch * 0.95 }),
      pet: () => void this.play('purr', { once: true, user: true, rate: pitch }),
      eat: () => void this.play('eat', { user: true, rate: pitch }),
      attack: () => void this.play('attack', { user: true, rate: pitch }),
      fire: () => void this.play('fire', { user: true, rate: pitch }),
      ring: () => void this.play('fire', { user: true, rate: pitch * 1.1 }),
      roar: () => void this.play(roar, { user: true, rate: variant === 'dragonne' ? 1.1 : 1 }),
      level_up: () => void this.play('levelup', { user: true }),
      evolution: () => void this.play('evolution', { user: true }),
      wake: () => void this.play('grumble', { user: true, rate: pitch }),
      hover: () => void this.play('wings', { once: true, user: true, gain: 0.85 }),
      dance: () => void this.play('wings', { user: true, gain: 0.6 }),
      shake: () => void this.play('wings', { user: true, gain: 0.5, rate: 1.3 }),
      giggle: () => { void this.play(voice, { user: true, rate: pitch * 1.25 }); setTimeout(() => void this.play(voice, { user: true, rate: pitch * 1.35, gain: 0.7 }), 380); },
      tail_chase: () => void this.play(voice, { user: true, rate: pitch * 1.15 }),
      purr: () => void this.play('purr', { once: true, user: true, rate: pitch }),
      dizzy: () => void this.play('grumble', { user: true, rate: pitch * 1.2 }),
      catch: () => void this.play('eat', { user: true, rate: pitch * 1.2, gain: 0.6 }),
      stretch: () => void this.play('grumble', { user: true, rate: pitch * 0.9, gain: 0.5 }),
      yawn: () => void this.play('grumble', { user: true, rate: pitch * 0.8, gain: 0.6 })
    };
    map[clip]?.();
  }
}

export const Sound = new SoundManager();
