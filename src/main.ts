// Point d'entrée : charge les données, la sauvegarde, le lien maison, puis assemble moteur + interface.
import { AnimationLibrary } from './engine/Animator.js';
import { Assets } from './engine/AssetManager.js';
import { DragonView } from './engine/DragonView.js';
import { ChildBook } from './family/ChildBook.js';
import { Companion } from './family/Companion.js';
import { ParentHub } from './family/ParentHub.js';
import { Reminders } from './family/Reminders.js';
import { Catalog } from './game/Catalog.js';
import { GameState } from './game/GameState.js';
import { LocalSaveBackend } from './game/save/SaveBackend.js';
import { NativeTransport, SimTransport, type Transport } from './link/Transport.js';
import { loadCapacitor } from './platform/capacitor.js';
import { setStorageSuffix } from './platform/storage.js';
import { App } from './ui/App.js';
import { runSetup } from './ui/Setup.js';

async function boot(): Promise<void> {
  // Téléphone (Capacitor) ou navigateur (simulation : ?device=parent, ?device=enfant…).
  const core = await loadCapacitor();
  const simDevice = new URLSearchParams(location.search).get('device') || 'web';
  if (!core) setStorageSuffix(simDevice);
  const link: Transport = core ? new NativeTransport(core) : new SimTransport(simDevice);
  const reminders = new Reminders(core);

  const catalog = new Catalog();
  const library = new AnimationLibrary();
  await Promise.all([Assets.init(), catalog.load(), library.load()]);

  const state = new GameState(catalog, new LocalSaveBackend());
  await state.load();

  const canvas = document.querySelector<HTMLCanvasElement>('#dragon')!;
  const view = new DragonView(canvas, {
    library, presets: catalog.presets, categories: catalog.categories, rarities: catalog.rarities, fits: catalog.fits
  });
  const { quality, effects } = state.data.settings;
  view.setQuality(catalog.quality[quality], effects);
  await view.setStage(state.stage, true);
  view.setEquipment(state.equippedDefs());
  void view.play('idle');
  view.start();
  (window as unknown as { __dragon: DragonView }).__dragon = view; // outils de test
  document.addEventListener('visibilitychange', () => (document.hidden ? view.stop() : view.start()));
  document.body.classList.add('ready');

  const root = document.querySelector<HTMLElement>('#app')!;
  let linkState = await link.getState();
  if (!linkState.paired || !linkState.role) {
    await runSetup(root, link, reminders);
    linkState = await link.getState();
  }

  let book: ChildBook | null = null;
  let hub: ParentHub | null = null;
  let companion: Companion | null = null;
  if (linkState.role === 'parent') {
    hub = new ParentHub(link);
    hub.syncMembers(linkState.members);
    await hub.sync();
    link.onInbox(() => void hub!.sync());
  } else {
    book = new ChildBook(link, state, reminders, catalog.badges);
    book.childName = linkState.deviceName;
    companion = new Companion(state);
    book.companion = companion;
    await book.init();
    link.onInbox(() => void book!.sync());
  }

  // Au retour dans l'appli : messages arrivés pendant l'absence + état à jour.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    void (book ?? hub)?.sync();
  });

  new App(root, catalog, state, view, { link, linkState, reminders, book, hub, companion });
}

boot().catch(err => {
  console.error(err);
  document.body.classList.add('ready');
  document.body.innerHTML = `<p style="color:#eee;padding:24px;font-family:sans-serif">Erreur de démarrage : ${String(err?.message ?? err)}</p>`;
});
