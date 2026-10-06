// Accès au runtime Capacitor (copié dans www/js/vendor/ au build). Absent dans un simple
// navigateur : l'appli bascule alors sur le lien simulé pour les tests.
export interface CapacitorCore {
  Capacitor: { isNativePlatform(): boolean; getPlatform(): string };
  registerPlugin<T>(name: string): T;
}

let core: CapacitorCore | null | undefined;

export async function loadCapacitor(): Promise<CapacitorCore | null> {
  if (core !== undefined) return core;
  try {
    // Chemin construit à l'exécution : TypeScript ne cherche pas à le résoudre.
    const path = '../vendor/capacitor-core.js';
    const mod = (await import(/* @vite-ignore */ path)) as CapacitorCore;
    core = mod.Capacitor?.isNativePlatform() ? mod : null;
  } catch {
    core = null;
  }
  return core;
}

export function isNative(): boolean { return !!core; }
