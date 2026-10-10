import type { App, Screen } from '../App.js';
import { ICONS, clear } from '../dom.js';
import { deviceSetupCard, membersCard, pairingCard } from './family.js';
import { comfortCard, devToolsCard, qualityCard, versionLine } from './SettingsScreen.js';

export class FamilyScreen implements Screen {
  id = 'family'; label = 'Famille'; icon = ICONS.family;
  private el: HTMLElement | null = null;
  private timer = 0;
  constructor(private app: App) {}

  mount(el: HTMLElement): void {
    this.el = el; this.refresh();
    void this.app.refreshLink();
    // Pendant un appairage, on surveille l'arrivée du nouveau téléphone.
    this.timer = window.setInterval(() => void this.app.refreshLink(), 4000);
  }
  unmount(): void { this.el = null; clearInterval(this.timer); }

  refresh(): void {
    const el = this.el; if (!el) return;
    const rerender = () => this.refresh();
    clear(el);
    el.append(
      pairingCard(this.app, rerender),
      membersCard(this.app),
      deviceSetupCard(this.app, rerender),
      comfortCard(this.app),
      qualityCard(this.app));
    if (this.app.devMode) el.append(devToolsCard(this.app));
    el.append(versionLine(this.app, rerender));
  }
}
