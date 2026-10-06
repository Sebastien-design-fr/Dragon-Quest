// Expédition de la semaine : chaque mission fait avancer le dragon d'une étape sur la carte.
// Un thème différent chaque semaine, une histoire découpée en étapes, un coffre à l'arrivée.

export interface Landmark { at: number; name: string; story: string }
export interface Journey { id: string; title: string; intro: string; landmarks: Array<{ name: string; story: string }>; colors: [string, string] }

export const JOURNEYS: Journey[] = [
  {
    id: 'givre', title: 'Les Montagnes de Givre', colors: ['#9fc6e8', '#2a3c5a'],
    intro: 'On raconte qu’un œuf de cristal dort au sommet des Montagnes de Givre. {name} veut le voir de ses propres yeux.',
    landmarks: [
      { name: 'Le village du pied des monts', story: 'Les villageois offrent une couverture de laine à {name}. « Là-haut, même le feu gèle », dit une vieille femme.' },
      { name: 'Le pont de glace', story: 'Le pont craque sous les griffes de {name}. Un souffle de feu bien dosé fait fondre juste ce qu’il faut pour passer.' },
      { name: 'La grotte des échos', story: 'Une voix répète tout ce que dit {name}… puis répond une phrase qu’il n’a jamais prononcée : « Continue. »' },
      { name: 'Le lac gelé', story: 'Sous la glace, des poissons d’argent tournent en rond. {name} en garde un pour le retour.' },
      { name: 'Le sommet', story: 'L’œuf de cristal est là, et il brille plus fort quand {name} s’approche. Au pied de l’œuf : un coffre.' }
    ]
  },
  {
    id: 'emeraude', title: 'La Forêt d’Émeraude', colors: ['#8fd694', '#1f3a2a'],
    intro: 'Un renard parlant a volé une plume d’or à {name}. Sa piste s’enfonce dans la Forêt d’Émeraude.',
    landmarks: [
      { name: 'L’orée des fougères', story: 'Des traces de pattes, une odeur de miel… {name} est sur la bonne piste.' },
      { name: 'Le chêne millénaire', story: 'Le vieux chêne murmure : « Le renard n’est pas méchant. Il a peur. »' },
      { name: 'La rivière des lucioles', story: 'Des milliers de lucioles éclairent le chemin. {name} n’avait jamais rien vu d’aussi beau.' },
      { name: 'Le terrier secret', story: 'Le renard garde la plume pour réchauffer ses petits. {name} lui laisse… et gagne un ami.' },
      { name: 'La clairière dorée', story: 'Pour le remercier, le renard montre à {name} un coffre caché sous les racines.' }
    ]
  },
  {
    id: 'braise', title: 'Le Désert de Braise', colors: ['#ffb36b', '#4a2a18'],
    intro: 'Au cœur du Désert de Braise, une flamme bleue ne s’éteint jamais. On dit qu’elle rend les dragons plus forts.',
    landmarks: [
      { name: 'L’oasis des marchands', story: 'Un marchand vend des cartes « garanties fausses ». {name} en achète une, par curiosité.' },
      { name: 'Les dunes chantantes', story: 'Le vent fait chanter le sable. {name} fredonne avec lui pour ne pas se perdre.' },
      { name: 'La cité engloutie', story: 'Des tours de pierre dépassent du sable. Sur un mur : un dragon gravé… qui ressemble à {name}.' },
      { name: 'Le canyon rouge', story: 'Une tempête de sable ! {name} protège une caravane sous ses ailes jusqu’à ce qu’elle passe.' },
      { name: 'La flamme bleue', story: '{name} touche la flamme : elle ne brûle pas, elle réchauffe. Juste à côté, un coffre ancien.' }
    ]
  },
  {
    id: 'tempetes', title: 'Les Îles des Tempêtes', colors: ['#b9a6ff', '#241f44'],
    intro: 'Un phare s’est éteint sur les Îles des Tempêtes et les bateaux se perdent. {name} part le rallumer.',
    landmarks: [
      { name: 'Le port des pêcheurs', story: 'Les pêcheurs n’osent plus sortir. {name} leur promet de revenir avec la lumière.' },
      { name: 'L’île aux mouettes', story: 'Les mouettes se moquent de {name}… jusqu’à ce qu’il fasse un looping parfait.' },
      { name: 'La mer agitée', story: 'Les vagues sont hautes comme des maisons. {name} vole bas, bien concentré.' },
      { name: 'L’épave', story: 'Dans une vieille épave, {name} trouve une lanterne et une carte du phare.' },
      { name: 'Le phare', story: 'D’un souffle, {name} rallume le phare. Les bateaux rentrent. Le gardien lui offre un coffre.' }
    ]
  }
];

/** Lundi de la semaine (clé AAAA-MM-JJ). */
export function weekKey(d = new Date()): string {
  const m = new Date(d); m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}

/** Thème de la semaine (tourne d'une semaine à l'autre). */
export function journeyFor(week: string): Journey {
  const [y, mo, da] = week.split('-').map(Number);
  const n = Math.floor(Date.UTC(y, mo - 1, da) / (7 * 86400000));
  return JOURNEYS[((n % JOURNEYS.length) + JOURNEYS.length) % JOURNEYS.length];
}

/** Étapes : les repères sont répartis régulièrement sur l'objectif de la semaine. */
export function landmarks(j: Journey, goal: number): Landmark[] {
  return j.landmarks.map((l, i) => ({ ...l, at: Math.max(1, Math.round((goal * (i + 1)) / j.landmarks.length)) }));
}

export const fill = (text: string, name: string) => text.replace(/\{name\}/g, name);
