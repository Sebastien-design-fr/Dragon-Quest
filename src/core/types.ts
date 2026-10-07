// Modèle de données partagé. Tout ce qui est décrit ici vient de fichiers JSON (www/data/) :
// aucun équipement, catégorie, rareté, animation ou stade n'est codé en dur dans l'interface.

export type StageId = string; // 'baby' | 'young' | 'adult' | 'legendary' (extensible via stages.json)
export type RarityId = string; // 'common' | 'rare' | 'epic' | 'legendary' (extensible via rarities.json)
export type CategoryId = string; // 'head' | 'neck' | ... (extensible via categories.json)
export type QualityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// ---------- Squelette ----------
export interface PartDef {
  key: string;            // nom logique de la pièce -> asset dragon_<stage>_<key>
  shape: string;          // forme du placeholder procédural
  w: number;              // largeur (le long de l'os)
  h: number;              // épaisseur
  h2?: number;            // épaisseur en bout (pièces effilées)
  pivot: [number, number];// point d'attache dans la boîte de la pièce (0..1)
  z: number;              // ordre de dessin
  shade?: number;         // assombrissement (pièces en arrière-plan)
}

export interface BoneDef {
  name: string;
  parent: string | null;
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  length: number;
  /** Os souple : rayon d'influence (pixels de l'image) sur la déformation de l'illustration. */
  radius?: number;
  part: PartDef | null;
}

export interface AnchorDef {
  name: string;   // head_anchor, tail_anchor, ...
  bone: string;   // os qui porte l'ancrage : l'équipement suit cet os pendant les animations
  x: number; y: number; rotation: number;
  z: number;      // profondeur de dessin des équipements accrochés ici
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface RigDef {
  id: StageId;
  version: number;
  /** parts : dragon découpé en pièces (une par os) ; sprite : illustration entière sur un seul os. */
  kind?: 'parts' | 'sprite';
  /** Échelle des équipements. */
  scale: number;
  /** Échelle des déplacements des animations (défaut : scale). */
  motionScale?: number;
  /** Pose peinte (sleep, flyUp, flyDown) : clés de placement « <pose> » et « <pose>:<ancrage> » dans fits.json. */
  pose?: string;
  /** Échelle des particules et de l'ombre (défaut : scale). */
  fxScale?: number;
  params: { horn: number; spikes: number; gold: number };
  palette: Record<string, string>;
  bounds: Rect;
  camera: Rect;
  bones: BoneDef[];
  anchors: AnchorDef[];
  /** Illustration déformée par un maillage (taille des mailles en pixels de l'image). */
  skin?: { grid: number };
}

export interface StageDef {
  id: StageId;
  label: string;
  tagline: string;
  minLevel: number;
  rig: string;               // chemin du rig (data/rigs/<id>.json)
  permanentEffects: string[];// presets de particules toujours actifs (ex. légendaire)
}

// ---------- Animations ----------
export type Channel = 'x' | 'y' | 'rot' | 'sx' | 'sy';
/** [temps (s), valeur, easing?] */
export type Key = [number, number] | [number, number, string];

export interface AnimEvent {
  t: number;
  type: 'emit' | 'flash' | 'shake' | 'swapStage' | 'sound';
  preset?: string;
  anchor?: string;
  value?: number;
}

export interface AnimationClip {
  id: string;
  duration: number;
  loop: boolean;
  /** Animation à enchaîner à la fin d'un clip non bouclé (par défaut : retour à la boucle de base). */
  next?: string;
  /** Pistes par os puis par canal. Les valeurs sont des DÉCALAGES par rapport à la pose de repos
   *  (sx/sy : multiplicateurs), ce qui rend le clip valable pour les 4 stades. */
  tracks: Record<string, Partial<Record<Channel, Key[]>>>;
  events?: AnimEvent[];
}

// ---------- Équipements ----------
export interface CategoryDef {
  id: CategoryId;
  label: string;
  layer: string;              // couche graphique : headEquipment, neckEquipment, ...
  anchors: string[];          // ancrages par défaut (plusieurs = l'objet est dupliqué : 4 pattes, 2 ailes)
  defaultSize: [number, number]; // taille de l'asset au stade adulte (mise à l'échelle par stade)
  zOffset: number;            // décalage de profondeur par rapport à l'ancrage
  kind: 'attachment' | 'effect';
  icon: string;               // glyphe d'interface
  order: number;
}

export interface RarityDef {
  id: RarityId;
  label: string;
  color: string;
  order: number;
  glow: number;               // intensité de halo (0 = aucun)
  description: string;
}

export interface CollectionDef {
  id: string;
  label: string;
  /** Fenêtre de disponibilité annuelle MM-JJ (peut chevaucher le nouvel an). */
  from: string;
  to: string;
  accent: string;
}

export interface Transform2D { x?: number; y?: number; rotation?: number; scale?: number }

export interface EquipmentDef {
  id: string;
  name: string;
  category: CategoryId;
  rarity: RarityId;
  price: number;
  description: string;
  /** Nom de base des fichiers : eq_head_common_01 -> eq_head_common_01_<stage>.webp */
  asset: string;
  compatibleDragonStages: StageId[];
  /** Ancrages spécifiques (sinon ceux de la catégorie). */
  anchor?: string[];
  /** Réglages fins par stade (décalage, rotation, échelle). */
  offsets?: Record<StageId, Transform2D>;
  /** rigid | sway | pulse : comportement secondaire pendant les animations. */
  animationProfile: string;
  /** Pour les effets : preset de particules. */
  effect?: string;
  /** Champ prévu pour de futurs bonus ; non utilisé aujourd'hui. */
  stats?: Record<string, number> | null;
  collection?: string | null;
  placeholder?: { shape: string; tint?: string };
}

/**
 * Placement d'une image d'équipement sur un dragon « illustration entière ».
 * Unités : 1 = rig.scale pixels de l'image du dragon (les mêmes nombres conviennent aux 4 stades).
 */
export interface EquipFit {
  x?: number; y?: number;       // décalage par rapport à l'ancrage
  rotation?: number;            // degrés
  width?: number;               // largeur de l'objet
  flipX?: boolean;              // miroir horizontal
  crop?: [number, number];      // ne garder qu'une partie de l'image (fraction horizontale 0..1)
  pivot?: [number, number];     // point de l'image posé sur l'ancrage (0..1), défaut centre
  hidden?: boolean;             // ne pas afficher cet objet sur ce stade / cet ancrage
}
/** clé "*" = tous les stades ; "<stade>" ; "<stade>:<ancrage>" ou "*:<ancrage>" pour un ancrage précis. */
export type FitTable = Record<string, EquipFit>;

export interface ParticlePreset {
  id: string;
  layer: 'magical' | 'foreground';
  colors: string[];
  blend: 'lighter' | 'source-over';
  rate: number;          // particules / seconde (avant multiplicateur de qualité)
  burst?: number;        // émission ponctuelle
  life: [number, number];
  size: [number, number];
  speed: [number, number];
  angle: [number, number]; // degrés
  gravity: number;
  spread: number;        // rayon de la zone d'émission (relatif à l'échelle du dragon)
  area: 'anchor' | 'body';
  fade: 'out' | 'inout';
  shape: 'circle' | 'spark' | 'smoke' | 'heart' | 'bubble';
}

export interface QualityPreset {
  particleMultiplier: number;
  permanentEffects: boolean;
  fpsCap: number;
  maxResolution: number;
  secondaryMotion: boolean;
}

// ---------- Sauvegarde ----------
export interface SaveData {
  version: number;
  updatedAt: number;
  stage: StageId;
  level: number;
  xp: number;
  gold: number;
  owned: string[];
  equipped: Record<CategoryId, string>;
  settings: { quality: QualityLevel; effects: boolean; sound?: boolean; volume?: number };
}
