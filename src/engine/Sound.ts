// Sons du dragon et de l'interface (Web Audio). Chargés à la demande, joués sans latence.
// Volume réglable, mode muet, silence la nuit sauf pour les gestes de l'enfant.

export type SoundId = 'purr' | 'chirp' | 'baby' | 'roar_young' | 'roar_adult' | 'roar_legendary' | 'grumble' | 'fire' | 'eat'
  | 'attack' | 'wings' | 'coins' | 'gem' | 'chest' | 'levelup' | 'evolution';

const GAIN: Partial<Record<SoundId, number>> = { coins: 1.6, gem: 1.6, chest: 1.4, purr: 0.9, roar_legendary: 0.9, evolution: 0.9 };

class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundId, Promise<AudioBuffer | null>>();
  private playing = new Map<SoundId, AudioBufferSourceNode>();
  volume = 0.7;
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

  // ---------- Sons d'interface (refonte UX, point 3) : synthétisés, aucun fichier ----------
  /** Petits sons d'interface : discrets, courts, jamais la nuit sauf geste. */
  ui(kind: 'tick' | 'tap' | 'success' | 'whoosh' | 'coin' | 'open'): void {
    if (this.muted || this.volume <= 0 || !this.uiSounds) return;
    const ctx = this.audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime, v = this.volume;
    const tone = (f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'sine', at = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + at);
      o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(gain * v, t + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t + at); o.stop(t + at + dur + 0.02);
    };
    if (kind === 'tick') tone(1800, 1400, 0.035, 0.035, 'triangle');
    else if (kind === 'tap') tone(620, 420, 0.07, 0.07, 'triangle');
    else if (kind === 'open') { tone(420, 640, 0.12, 0.06); tone(640, 900, 0.1, 0.04, 'sine', 0.06); }
    else if (kind === 'coin') { tone(1320, 1320, 0.08, 0.05, 'square'); tone(1760, 1760, 0.16, 0.05, 'square', 0.07); }
    else if (kind === 'success') { tone(523, 523, 0.14, 0.09, 'triangle'); tone(659, 659, 0.14, 0.09, 'triangle', 0.09); tone(784, 1046, 0.3, 0.1, 'triangle', 0.18); }
    else if (kind === 'whoosh') {
      const n = this.noise(ctx, 0.3), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08 * v, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      n.connect(f).connect(g).connect(ctx.destination); n.start(t); n.stop(t + 0.32);
    }
  }
  /** Sons d'interface activés (réglages). */
  uiSounds = true;

  private noiseBuf: AudioBuffer | null = null;
  private noise(ctx: AudioContext, _dur: number): AudioBufferSourceNode {
    if (!this.noiseBuf) {
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    return src;
  }

  // ---------- Ambiance sonore par décor (refonte UX, point 3) ----------
  /** Ambiance activée (réglages). */
  ambienceOn = true;
  private amb: { stage: string; nodes: AudioScheduledSourceNode[]; out: GainNode; timer: number } | null = null;

  /**
   * Ambiance douce et continue propre à chaque décor, entièrement synthétisée :
   * nid (vent tiède, petits gazouillis), cristaux (vent froid, tintements), forge (grondement, crépitements),
   * sommet légendaire (souffle profond, accord grave). Coupée la nuit (22 h – 7 h) et quand l'appli est cachée.
   */
  ambience(stage: string | null): void {
    const h = new Date().getHours();
    const want = stage && this.ambienceOn && !this.muted && this.volume > 0 && !(h >= 22 || h < 7) ? stage : null;
    if (this.amb?.stage === want) return;
    this.stopAmbience();
    if (!want) return;
    const ctx = this.audio();
    if (!ctx || ctx.state !== 'running') { if (ctx) void ctx.resume().then(() => { if (ctx.state === 'running') this.ambience(stage); }).catch(() => undefined); return; }
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5 * this.volume, t + 2.5);
    out.connect(ctx.destination);
    const nodes: AudioScheduledSourceNode[] = [];
    const P = AMBIENCE[want] ?? AMBIENCE.baby;
    // vent : bruit filtré dont la coupure ondule lentement
    const n = this.noise(ctx, 2), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = P.wind; f.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = P.wind * 0.45;
    lfo.connect(lg).connect(f.frequency);
    g.gain.value = P.windGain;
    n.connect(f).connect(g).connect(out);
    n.start(); lfo.start(); nodes.push(n, lfo);
    // nappe tonale très discrète
    for (const fr of P.drone) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = fr; og.gain.value = P.droneGain;
      const tr = ctx.createOscillator(), tg = ctx.createGain();
      tr.frequency.value = 0.05 + Math.random() * 0.08; tg.gain.value = P.droneGain * 0.6;
      tr.connect(tg).connect(og.gain);
      o.connect(og).connect(out); o.start(); tr.start(); nodes.push(o, tr);
    }
    // événements ponctuels : gazouillis, tintements, crépitements
    const timer = window.setInterval(() => {
      if (!this.amb || Math.random() > P.rate) return;
      const now = ctx.currentTime;
      if (P.event === 'crackle') {
        for (let i = 0; i < 4 + Math.random() * 6; i++) {
          const s = this.noise(ctx, 0.05), bf = ctx.createBiquadFilter(), eg = ctx.createGain(), at = now + Math.random() * 0.6;
          bf.type = 'highpass'; bf.frequency.value = 1500 + Math.random() * 2500;
          eg.gain.setValueAtTime(0.0001, at); eg.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, at + 0.004); eg.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
          s.connect(bf).connect(eg).connect(out); s.start(at, Math.random()); s.stop(at + 0.05);
        }
      } else {
        const notes = P.event === 'chime' ? [1568, 1760, 2093, 2349, 2637] : [2600, 3100, 3500];
        const k = P.event === 'chime' ? 1 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < k; i++) {
          const o = ctx.createOscillator(), eg = ctx.createGain(), at = now + i * (P.event === 'chime' ? 0.18 : 0.09);
          const fr = notes[Math.floor(Math.random() * notes.length)];
          o.type = 'sine';
          o.frequency.setValueAtTime(fr, at);
          if (P.event === 'chirp') o.frequency.exponentialRampToValueAtTime(fr * 1.25, at + 0.06);
          const dur = P.event === 'chime' ? 1.6 : 0.08;
          eg.gain.setValueAtTime(0.0001, at); eg.gain.exponentialRampToValueAtTime(P.event === 'chime' ? 0.025 : 0.018, at + 0.01); eg.gain.exponentialRampToValueAtTime(0.0001, at + dur);
          o.connect(eg).connect(out); o.start(at); o.stop(at + dur + 0.05);
        }
      }
    }, 900);
    this.amb = { stage: want, nodes, out, timer };
  }

  stopAmbience(): void {
    const a = this.amb;
    if (!a) return;
    this.amb = null;
    clearInterval(a.timer);
    const ctx = this.ctx;
    if (ctx) { const t = ctx.currentTime; a.out.gain.cancelScheduledValues(t); a.out.gain.setValueAtTime(a.out.gain.value, t); a.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); }
    setTimeout(() => { for (const n of a.nodes) { try { n.stop(); } catch { /* déjà arrêté */ } } a.out.disconnect(); }, 900);
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
      hover: () => void this.play('wings', { user: true }),
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

/** Réglages d'ambiance par décor : vent (coupure Hz, volume), nappe (fréquences, volume), événements. */
const AMBIENCE: Record<string, { wind: number; windGain: number; drone: number[]; droneGain: number; event: 'chirp' | 'chime' | 'crackle'; rate: number }> = {
  baby: { wind: 700, windGain: 0.05, drone: [196, 294], droneGain: 0.006, event: 'chirp', rate: 0.18 },
  young: { wind: 1100, windGain: 0.04, drone: [220, 330, 440], droneGain: 0.005, event: 'chime', rate: 0.22 },
  adult: { wind: 380, windGain: 0.07, drone: [55, 82.5], droneGain: 0.012, event: 'crackle', rate: 0.35 },
  legendary: { wind: 520, windGain: 0.06, drone: [65.4, 98, 130.8], droneGain: 0.01, event: 'chime', rate: 0.12 }
};

export const Sound = new SoundManager();
