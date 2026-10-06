// Premier lancement : choix du profil (enfant / parent), prénom, création ou rejoindre la famille.
import type { Reminders } from '../family/Reminders.js';
import type { Role, Transport } from '../link/Transport.js';
import { ICONS, clear, h, icon, put } from './dom.js';

type Step = 'role' | 'parent' | 'join' | 'permissions';

export function runSetup(root: HTMLElement, link: Transport, reminders: Reminders): Promise<void> {
  const screen = root.querySelector<HTMLElement>('#screen')!;
  const hud = root.querySelector<HTMLElement>('#hud')!;
  const tabs = root.querySelector<HTMLElement>('#tabs')!;
  root.classList.add('setup');
  clear(tabs);
  clear(hud);
  hud.append(h('div', { class: 'hud-id' }, h('div', { class: 'hud-stage' }, 'Quête du Dragon'), h('div', { class: 'hud-level' }, 'Bienvenue')));

  let step: Step = 'role';
  let role: Role = 'child';
  let name = '';
  let code = '';
  let busy = false;
  let error = '';

  return new Promise(resolve => {
    const render = () => {
      clear(screen);
      const card = h('section', { class: 'card setup-card' });
      screen.append(card);

      if (step === 'role') {
        card.append(
          h('h2', null, 'Qui utilise ce téléphone ?'),
          h('p', { class: 'muted' }, 'Chaque téléphone de la maison a un rôle. Ce choix est définitif (sauf réinstallation).'),
          h('div', { class: 'role-grid' },
            h('button', { class: 'role-btn', onclick: () => { role = 'child'; step = 'join'; render(); } },
              icon(ICONS.dragon, 34), h('strong', null, 'Enfant'), h('span', { class: 'small muted' }, 'Je fais grandir mon dragon')),
            h('button', { class: 'role-btn', onclick: () => { role = 'parent'; step = 'parent'; render(); } },
              icon(ICONS.shield, 34), h('strong', null, 'Parent'), h('span', { class: 'small muted' }, 'Je donne les missions et je valide'))));
        return;
      }

      const nameInput = h('input', { type: 'text', maxlength: '20', value: name, placeholder: role === 'child' ? 'Prénom de l’enfant' : 'Maman, Papa, Sébastien…',
        oninput: (e: Event) => { name = (e.target as HTMLInputElement).value; } });
      const back = h('button', { class: 'btn ghost', onclick: () => { step = 'role'; error = ''; render(); } }, 'Retour');

      if (step === 'parent') {
        put(card,
          h('h2', null, 'Espace parent'),
          h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Votre nom (affiché aux autres)'), nameInput),
          h('p', { class: 'small muted' }, 'Premier téléphone de la famille ? Créez-la. Sinon, demandez un code au parent déjà installé (Famille › Ajouter un téléphone › Autre parent).'),
          h('div', { class: 'col' },
            h('button', { class: 'btn primary', disabled: busy, onclick: async () => {
              if (!validName()) return;
              busy = true; render();
              await link.createFamily(name.trim());
              step = 'permissions'; busy = false; render();
            } }, 'Créer la famille'),
            h('button', { class: 'btn', onclick: () => { if (!validName()) return; step = 'join'; render(); } }, 'J’ai un code (2e parent)')),
          errorLine(), back);
        return;
      }

      if (step === 'join') {
        const codeInput = h('input', { type: 'text', inputmode: 'numeric', maxlength: '7', value: code, placeholder: '123 456', class: 'code-input',
          oninput: (e: Event) => { code = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6); } });
        put(card,
          h('h2', null, role === 'child' ? 'Relier ton téléphone' : 'Rejoindre la famille'),
          role === 'child' ? h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Ton prénom'), nameInput) : null,
          h('p', { class: 'small muted' }, 'Sur le téléphone d’un parent : Famille › Ajouter un téléphone. Un code à 6 chiffres s’affiche. Les deux téléphones doivent être sur le Wi-Fi de la maison.'),
          h('label', { class: 'field-col' }, h('span', { class: 'small' }, 'Code'), codeInput),
          h('button', { class: 'btn primary', disabled: busy, onclick: async () => {
            if (!validName()) return;
            if (code.length !== 6) { error = 'Le code contient 6 chiffres.'; render(); return; }
            busy = true; error = ''; render();
            try {
              await link.joinFamily(code, name.trim());
              step = 'permissions';
            } catch (e) {
              error = String((e as Error).message ?? e);
            }
            busy = false; render();
          } }, busy ? 'Recherche sur le Wi-Fi…' : 'Relier'),
          errorLine(), back);
        return;
      }

      // Autorisations
      put(card,
        h('h2', null, 'Dernière étape'),
        h('p', null, role === 'child'
          ? 'Autorise les notifications : ton dragon te rappellera tes missions et tu sauras tout de suite quand elles sont validées.'
          : 'Autorisez les notifications pour recevoir les missions à valider, avec les boutons Valider / Refuser.'),
        h('button', { class: 'btn primary', onclick: async () => { await reminders.requestPermission(); finish(); } }, 'Autoriser les notifications'),
        link.native ? h('p', { class: 'small muted' }, 'Ensuite, dans Réglages (ou Famille), réglez « Toujours à l’écoute » pour que le téléphone ne coupe pas l’appli.') : null,
        h('button', { class: 'btn ghost', onclick: finish }, 'Plus tard'));
    };

    const validName = () => {
      if (name.trim().length < 2) { error = 'Indiquez un prénom ou un nom.'; render(); return false; }
      error = '';
      return true;
    };
    const errorLine = () => (error ? h('p', { class: 'warn' }, error) : null);
    const finish = () => { root.classList.remove('setup'); resolve(); };

    render();
  });
}
