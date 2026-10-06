// Sauvegarde découplée du stockage. Aujourd'hui : stockage local de l'appareil.
// Demain : un CloudSaveBackend implémentant la même interface (et SyncSaveBackend
// combinant local + cloud, résolution par updatedAt) — sans toucher au reste du jeu.
import type { SaveData } from '../../core/types.js';

export interface SaveBackend {
  load(): Promise<SaveData | null>;
  save(data: SaveData): Promise<void>;
  clear(): Promise<void>;
}

export class LocalSaveBackend implements SaveBackend {
  constructor(private key = 'quete-du-dragon:save') {}

  async load(): Promise<SaveData | null> {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch { return null; }
  }
  async save(data: SaveData): Promise<void> {
    try { localStorage.setItem(this.key, JSON.stringify(data)); } catch (e) { console.warn('Sauvegarde impossible', e); }
  }
  async clear(): Promise<void> { try { localStorage.removeItem(this.key); } catch { /* ignoré */ } }
}

/** Exemple de squelette pour une future synchronisation (non utilisé). */
export class SyncSaveBackend implements SaveBackend {
  constructor(private local: SaveBackend, private remote: SaveBackend | null) {}
  async load(): Promise<SaveData | null> {
    const [l, r] = await Promise.all([this.local.load(), this.remote?.load().catch(() => null) ?? null]);
    if (!l) return r; if (!r) return l;
    return r.updatedAt > l.updatedAt ? r : l; // la plus récente gagne
  }
  async save(data: SaveData): Promise<void> {
    await this.local.save(data);
    void this.remote?.save(data).catch(() => {}); // le cloud n'est jamais bloquant
  }
  async clear(): Promise<void> { await this.local.clear(); await this.remote?.clear(); }
}
