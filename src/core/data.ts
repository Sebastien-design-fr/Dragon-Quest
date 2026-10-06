// Chargement des fichiers de données JSON (www/data/), avec cache.
const cache = new Map<string, Promise<unknown>>();

export function loadJSON<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then(r => {
      if (!r.ok) throw new Error(`Données introuvables : ${path} (${r.status})`);
      return r.json();
    }));
  }
  return cache.get(path) as Promise<T>;
}

export function forgetJSON(path: string): void { cache.delete(path); }
