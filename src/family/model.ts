// Modèle des missions partagé entre l'appli enfant et l'appli parent.

export type Validation = 'trust' | 'parent';

export interface Mission {
  id: string;
  title: string;
  xp: number;
  gold: number;
  validation: Validation;
  /** Jours de la semaine (0 = dimanche … 6 = samedi). */
  days: number[];
  /** Heure du rappel « HH:MM », ou null pour aucun rappel. */
  time: string | null;
  /** Quête spéciale ponctuelle : disparaît une fois accomplie. */
  once?: boolean;
  note?: string;
}

export type MissionStatus = 'todo' | 'pending' | 'done' | 'refused';

export interface RequestInfo {
  requestId: string;
  kind: 'mission' | 'initiative';
  missionId?: string;
  title: string;
  xp: number;
  gold: number;
  note?: string;
  childName?: string;
  date: string;
  /** Moment où l'enfant a coché la mission (ponctualité). */
  doneAt?: number;
}

/** Photo de l'état de l'enfant, envoyée aux parents. */
export interface ChildSnapshot {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  stage: string;
  stageLabel: string;
  gold: number;
  equipped: string[];
  missions: Mission[];
  today: Record<string, MissionStatus>;
  date: string;
  streak: number;
  energy?: number;
  title?: string | null;
  badgeCount?: number;
  badgeTotal?: number;
}

export const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function appliesOn(m: Mission, d = new Date()): boolean {
  return !!m.once || m.days.includes(d.getDay());
}

export function newId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

export function rewardText(xp: number, gold: number): string {
  const parts = [];
  if (xp) parts.push(`+${xp} XP`);
  if (gold) parts.push(`+${gold} or`);
  return parts.join(', ');
}
