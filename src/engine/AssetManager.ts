// Gestion des assets graphiques.
//
// - Convention de nommage = seule « configuration » nécessaire : déposer un fichier
//   au bon chemin suffit pour qu'il remplace le placeholder (aucune logique à modifier).
// - Seuls les fichiers listés dans assets/manifest.json (généré au build) sont demandés :
//   pas de requête inutile, pas d'erreur 404 sur mobile.
// - Chargement à la demande + compteur de références : les images d'un stade ou d'un
//   équipement qui ne sont plus affichées sont libérées.
import { loadJSON } from '../core/data.js';
import type { EquipmentDef, StageId } from '../core/types.js';

export type Img = HTMLImageElement | ImageBitmap;
const EXTENSIONS = ['webp', 'png', 'jpg'];

interface Entry { refs: number; promise: Promise<Img | null>; image: Img | null }

class AssetManagerImpl {
  private available = new Set<string>();
  private entries = new Map<string, Entry>();

  async init(): Promise<void> {
    try {
      const m = await loadJSON<{ files: string[] }>('assets/manifest.json');
      this.available = new Set(m.files.map(f => 'assets/' + f));
    } catch {
      this.available = new Set(); // pas de manifeste : tout en placeholders
    }
  }

  // ----- Conventions de nommage -----
  dragonPart(stage: StageId, key: string): string | null {
    return this.firstAvailable(`assets/dragon/${stage}/dragon_${stage}_${key}`);
  }
  equipment(def: EquipmentDef, stage: StageId): string | null {
    const dir = `assets/equipment/${def.category}/${def.asset}`;
    return this.firstAvailable(`${dir}_${stage}`) ?? this.firstAvailable(dir);
  }
  background(stage: StageId): string | null {
    return this.firstAvailable(`assets/backgrounds/bg_${stage}`);
  }
  equipmentIcon(def: EquipmentDef): string | null {
    return this.firstAvailable(`assets/equipment/${def.category}/${def.asset}_icon`) ?? this.equipment(def, 'adult');
  }
  private firstAvailable(base: string): string | null {
    for (const ext of EXTENSIONS) if (this.available.has(`${base}.${ext}`)) return `${base}.${ext}`;
    return null;
  }

  // ----- Cycle de vie -----
  acquire(path: string): Promise<Img | null> {
    let e = this.entries.get(path);
    if (!e) {
      const entry: Entry = { refs: 0, image: null, promise: Promise.resolve(null) };
      entry.promise = loadImage(path).then(img => (entry.image = img)).catch(() => null);
      this.entries.set(path, entry);
      e = entry;
    }
    e.refs++;
    return e.promise;
  }

  /** Image déjà chargée (ou null si encore en cours / indisponible). */
  peek(path: string): Img | null { return this.entries.get(path)?.image ?? null; }

  release(path: string): void {
    const e = this.entries.get(path);
    if (!e) return;
    if (--e.refs <= 0) {
      if (e.image && 'close' in e.image) e.image.close();
      this.entries.delete(path);
    }
  }

  stats(): { loaded: number; available: number } {
    return { loaded: this.entries.size, available: this.available.size };
  }
}

async function loadImage(path: string): Promise<Img> {
  if ('createImageBitmap' in window) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(path);
    return createImageBitmap(await res.blob());
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = path;
  });
}

export const Assets = new AssetManagerImpl();

/** Regroupe les assets utilisés par un objet (un stade, un équipement…) pour les libérer d'un coup. */
export class AssetScope {
  private paths = new Set<string>();
  use(path: string | null): string | null {
    if (path && !this.paths.has(path)) { this.paths.add(path); void Assets.acquire(path); }
    return path;
  }
  dispose(): void { this.paths.forEach(p => Assets.release(p)); this.paths.clear(); }
}
