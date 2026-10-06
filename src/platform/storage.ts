// Préfixe de stockage : vide sur téléphone, « :<appareil> » en simulation navigateur
// (plusieurs onglets = plusieurs téléphones, chacun avec ses propres données).
let suffix = '';
export function setStorageSuffix(s: string): void { suffix = s ? ':' + s : ''; }
export function storageKey(base: string): string { return base + suffix; }

export function readStore<T>(base: string, fallback: T): T {
  try { const v = localStorage.getItem(storageKey(base)); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function writeStore(base: string, value: unknown): void {
  try { localStorage.setItem(storageKey(base), JSON.stringify(value)); } catch { /* stockage indisponible */ }
}
export function clearStore(base: string): void { try { localStorage.removeItem(storageKey(base)); } catch { /* ignoré */ } }
