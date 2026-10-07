// Catalogue des mini-jeux : chaque jeu entraîne une caractéristique du dragon.
import { playGemGame } from '../MiniGame.js';
import { playFlightRace } from './FlightRace.js';
import { playFireTargets } from './FireTargets.js';
import { playRuneMemory } from './RuneMemory.js';

/** Images du dragon utilisées par les mini-jeux (URL d’images webp transparentes, dragon tourné vers la droite). */
export interface GameOpts { stand: string; flyUp: string; flyDown: string }

export type GameStat = 'agilite' | 'vitesse' | 'feu' | 'sagesse';

export const GAMES: Array<{ id: string; label: string; desc: string; stat: GameStat; statLabel: string; play: (name: string, opts: GameOpts) => Promise<number> }> = [
  { id: 'gems', label: 'Chasse aux gemmes', desc: 'Touche les gemmes qui tombent avant qu’elles ne disparaissent.', stat: 'agilite', statLabel: 'Agilité', play: name => playGemGame(name) },
  { id: 'race', label: 'Course dans les nuages', desc: 'Vole à travers la grotte en évitant les rochers.', stat: 'vitesse', statLabel: 'Vitesse', play: playFlightRace },
  { id: 'fire', label: 'Tir de feu', desc: 'Crache des boules de feu sur les cibles, mais épargne la glace.', stat: 'feu', statLabel: 'Feu', play: playFireTargets },
  { id: 'memory', label: 'Mémoire des runes', desc: 'Retrouve les paires de runes anciennes avant la fin du temps.', stat: 'sagesse', statLabel: 'Sagesse', play: playRuneMemory }
];
