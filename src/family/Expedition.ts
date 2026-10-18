// Expédition de la semaine : chaque mission fait avancer le dragon d'une étape sur la carte.
// Un thème différent chaque semaine, une histoire découpée en étapes, un coffre à l'arrivée.

export interface Landmark { at: number; name: string; story: string }
export interface Journey {
  id: string; title: string; intro: string; landmarks: Array<{ name: string; story: string }>; colors: [string, string];
  /** Souvenir rapporté de l'aventure (gardé dans l'album). */
  keepsake?: string;
}

export const JOURNEYS: Journey[] = [
  {
    id: 'givre', keepsake: 'un éclat de l’œuf de cristal, qui brille encore un peu la nuit', title: 'Les Montagnes de Givre', colors: ['#9fc6e8', '#2a3c5a'],
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
    id: 'emeraude', keepsake: 'une plume dorée, cadeau du renard', title: 'La Forêt d’Émeraude', colors: ['#8fd694', '#1f3a2a'],
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
    id: 'braise', keepsake: 'une petite flamme bleue dans un bocal de verre', title: 'Le Désert de Braise', colors: ['#ffb36b', '#4a2a18'],
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
    id: 'tempetes', keepsake: 'la lanterne de l’épave', title: 'Les Îles des Tempêtes', colors: ['#b9a6ff', '#241f44'],
    intro: 'Un phare s’est éteint sur les Îles des Tempêtes et les bateaux se perdent. {name} part le rallumer.',
    landmarks: [
      { name: 'Le port des pêcheurs', story: 'Les pêcheurs n’osent plus sortir. {name} leur promet de revenir avec la lumière.' },
      { name: 'L’île aux mouettes', story: 'Les mouettes se moquent de {name}… jusqu’à ce qu’il fasse un looping parfait.' },
      { name: 'La mer agitée', story: 'Les vagues sont hautes comme des maisons. {name} vole bas, bien concentré.' },
      { name: 'L’épave', story: 'Dans une vieille épave, {name} trouve une lanterne et une carte du phare.' },
      { name: 'Le phare', story: 'D’un souffle, {name} rallume le phare. Les bateaux rentrent. Le gardien lui offre un coffre.' }
    ]
  },
  {
    id: 'nuages', keepsake: 'un flocon de nuage qui ne fond jamais', title: 'La Cité des Nuages', colors: ['#cfe6ff', '#2c3b5e'],
    intro: 'Une cité flotte au-dessus des nuages, mais elle descend un peu chaque jour. {name} monte voir ce qui se passe.',
    landmarks: [
      { name: 'L’escalier de vent', story: '{name} grimpe en spirale sur un courant d’air chaud. Plus haut, encore plus haut !' },
      { name: 'Les jardins suspendus', story: 'Des fleurs poussent sur des nuages. Une jardinière explique : « Les ballons qui portent la ville se dégonflent. »' },
      { name: 'L’atelier des ballons', story: 'Les ballons sont percés de petits trous. {name} aide à les recoudre avec des fils de soie.' },
      { name: 'La grande chaudière', story: 'Il faut de l’air chaud pour les regonfler. Un doux souffle de {name}, et ça repart !' },
      { name: 'Le belvédère', story: 'La cité remonte au-dessus des nuages. Les habitants applaudissent {name} et lui offrent un coffre.' }
    ]
  },
  {
    id: 'corail', keepsake: 'un coquillage où l’on entend chanter la mer', title: 'Le Royaume de Corail', colors: ['#7fe0d6', '#123a44'],
    intro: 'La reine des tortues a perdu sa couronne de perles au fond de la mer. {name} retient sa respiration et plonge.',
    landmarks: [
      { name: 'La plage aux crabes', story: 'Les crabes forment une flèche sur le sable : la couronne est partie vers le large.' },
      { name: 'La forêt d’algues', story: 'Les algues chatouillent les ailes de {name}. Un hippocampe lui montre le passage.' },
      { name: 'Le récif multicolore', story: 'Des poissons de toutes les couleurs dansent autour de {name}. Il a presque oublié sa mission.' },
      { name: 'La grotte du poulpe', story: 'Le poulpe a trouvé la couronne. Il la rend en échange d’une histoire. {name} raconte sa meilleure.' },
      { name: 'Le palais des tortues', story: 'La reine remet sa couronne et sourit. Elle tend à {name} un coffre couvert de coquillages.' }
    ]
  },
  {
    id: 'horloge', keepsake: 'un petit engrenage doré qui tourne tout seul', title: 'La Tour de l’Horloge', colors: ['#e8c27a', '#3a2a1a'],
    intro: 'Dans la ville voisine, la grande horloge s’est arrêtée, et plus personne ne sait l’heure du goûter. {name} va la réparer.',
    landmarks: [
      { name: 'La place du marché', story: 'Tout le monde est en retard, ou en avance, personne ne sait. {name} promet de s’en occuper.' },
      { name: 'L’escalier en colimaçon', story: '365 marches ! {name} les compte en montant. Il en trouve 366. Bizarre…' },
      { name: 'La salle des engrenages', story: 'Une souris a fait son nid dans un engrenage. {name} l’aide à déménager dans une boîte bien douillette.' },
      { name: 'Le grand ressort', story: 'Il faut le remonter. {name} tire de toutes ses forces, et clic, clic, clic…' },
      { name: 'Le cadran', story: 'L’horloge sonne : c’est l’heure du goûter ! L’horloger offre un coffre à {name}.' }
    ]
  },
  {
    id: 'aurore', keepsake: 'un ruban de lumière verte, plié dans une boîte', title: 'Le Pays des Aurores', colors: ['#9ef0c0', '#14203a'],
    intro: 'Les aurores boréales ont disparu du ciel du Nord. Les ours polaires sont tristes. {name} part chercher pourquoi.',
    landmarks: [
      { name: 'La banquise', story: 'Un ourson glisse sur la glace jusqu’à {name}. « Tu vas ramener les lumières ? » demande-t-il.' },
      { name: 'L’igloo du conteur', story: 'Le vieux conteur explique : les aurores sont des rubans que le vent emmêle parfois.' },
      { name: 'La montagne des vents', story: 'Le vent du Nord a tout emmêlé en une grosse pelote. {name} commence à défaire les nœuds.' },
      { name: 'Le ciel de minuit', story: 'Ruban par ruban, {name} remet les couleurs dans le ciel : vert, violet, rose…' },
      { name: 'La grande aurore', story: 'Le ciel danse à nouveau. Les ours chantent. L’ourson offre un coffre à {name}.' }
    ]
  },
  {
    id: 'bibliotheque', keepsake: 'un marque-page qui raconte une histoire différente chaque soir', title: 'La Bibliothèque Infinie', colors: ['#d8b98a', '#2e2218'],
    intro: 'Dans une bibliothèque sans fin, un livre s’est échappé et toutes ses lettres se sont envolées. {name} part les rattraper.',
    landmarks: [
      { name: 'Le hall des dictionnaires', story: 'Les mots chuchotent. Un « A » et un « B » sont tombés sur la tête de {name}. Ça commence bien !' },
      { name: 'L’étagère des contes', story: 'Des lettres se cachent dans une histoire de princesse. {name} les attrape doucement.' },
      { name: 'L’escalier des énigmes', story: 'Chaque marche pose une devinette. {name} réfléchit bien et monte jusqu’en haut.' },
      { name: 'La salle des cartes', story: 'Les dernières lettres se sont posées sur une carte du monde. {name} les range une par une.' },
      { name: 'Le livre retrouvé', story: 'Le livre peut à nouveau se lire. Le bibliothécaire, un vieux hibou, offre un coffre à {name}.' }
    ]
  },
  {
    id: 'volcan', keepsake: 'une pierre de lave toujours tiède', title: 'Le Volcan Endormi', colors: ['#ff9a5a', '#3a1610'],
    intro: 'Le vieux volcan ronfle si fort que les maisons tremblent. {name} doit lui chanter une berceuse pour qu’il dorme en paix.',
    landmarks: [
      { name: 'Le village qui tremble', story: 'Les tasses dansent sur les tables. Les habitants comptent sur {name}.' },
      { name: 'Les sources chaudes', story: '{name} se repose dans l’eau chaude. Il en profite pour réviser sa berceuse.' },
      { name: 'Le chemin de cendres', story: 'Le sol est chaud sous les pattes. {name} avance doucement, pas à pas.' },
      { name: 'Le cratère', story: 'Le volcan ronfle : RRRRRR ! {name} chante tout doucement… le ronflement se calme.' },
      { name: 'Le sommet apaisé', story: 'Le volcan dort paisiblement. En remerciement, il fait apparaître un coffre au bord du cratère.' }
    ]
  },
  {
    id: 'cirque', keepsake: 'un nez rouge de clown qui fait rire tout le monde', title: 'Le Cirque des Étoiles', colors: ['#ff8fb0', '#2a1430'],
    intro: 'Le Cirque des Étoiles arrive en ville, mais l’acrobate s’est foulé la patte. {name} propose de la remplacer.',
    landmarks: [
      { name: 'Le grand chapiteau', story: 'Des rayures rouges et dorées partout. {name} n’a jamais vu une tente aussi grande.' },
      { name: 'Les coulisses', story: 'Les clowns maquillent {name} avec une grosse étoile sur la joue. Il est méconnaissable !' },
      { name: 'Le trapèze', story: 'Premier essai : raté. Deuxième : raté. Troisième : parfait ! {name} ne lâche jamais.' },
      { name: 'La répétition générale', story: 'L’acrobate guérie montre à {name} un dernier tour secret. Ils le feront ensemble.' },
      { name: 'Le spectacle', story: 'Le public applaudit debout ! Le directeur du cirque offre un coffre à {name}.' }
    ]
  },
  {
    id: 'jardin', keepsake: 'une graine magique qui germera un jour', title: 'Le Jardin des Géants', colors: ['#b6e07a', '#1f3018'],
    intro: 'Dans le jardin des géants, une graine magique a été emportée par le vent. {name}, tout petit à côté des fleurs, part la chercher.',
    landmarks: [
      { name: 'La haie immense', story: 'Chaque feuille est grande comme un lit. {name} se faufile entre les branches.' },
      { name: 'Le potager', story: 'Une citrouille grosse comme une maison ! {name} fait une pause à son ombre.' },
      { name: 'La mare aux grenouilles', story: 'Une grenouille géante propose à {name} de traverser sur son dos. Il accepte, poliment.' },
      { name: 'Le nid de l’oiseau', story: 'La graine est dans un nid. L’oiseau la rend quand {name} l’aide à réparer son nid.' },
      { name: 'La cabane du jardinier', story: 'Le géant jardinier est si content qu’il offre un coffre à {name}… minuscule pour lui, énorme pour un dragon.' }
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
