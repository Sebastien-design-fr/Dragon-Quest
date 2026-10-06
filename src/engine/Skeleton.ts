// Squelette 2D : hiérarchie d'os, pose animée et points d'ancrage.
// Un ancrage est un repère local attaché à un os : tout ce qui y est accroché
// (casque, collier, protections…) suit automatiquement l'os pendant les animations.
import { Mat2D } from '../core/math.js';
import type { AnchorDef, BoneDef, Channel, RigDef } from '../core/types.js';

export class Bone {
  readonly def: BoneDef;
  parent: Bone | null = null;
  /** Décalages appliqués par l'animateur (remis à zéro à chaque image). */
  offset: Record<Channel, number> = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 };
  readonly local = new Mat2D();
  readonly world = new Mat2D();

  constructor(def: BoneDef) { this.def = def; }

  resetPose(): void {
    const o = this.offset; o.x = 0; o.y = 0; o.rot = 0; o.sx = 1; o.sy = 1;
  }

  updateWorld(root: Mat2D): void {
    const d = this.def, o = this.offset;
    Mat2D.fromTRS(d.x + o.x, d.y + o.y, d.rotation + o.rot, d.scaleX * o.sx, d.scaleY * o.sy, this.local);
    (this.parent ? this.parent.world : root).multiply(this.local, this.world);
  }
}

export class Skeleton {
  readonly rig: RigDef;
  readonly bones: Bone[] = [];
  private byName = new Map<string, Bone>();
  private anchors = new Map<string, AnchorDef>();
  private tmp = new Mat2D();

  constructor(rig: RigDef) {
    this.rig = rig;
    for (const def of rig.bones) {
      const b = new Bone(def);
      b.parent = def.parent ? this.byName.get(def.parent) ?? null : null;
      if (def.parent && !b.parent) throw new Error(`Os parent inconnu ou déclaré après l'enfant : ${def.parent}`);
      this.bones.push(b);
      this.byName.set(def.name, b);
    }
    for (const a of rig.anchors) this.anchors.set(a.name, a);
  }

  bone(name: string): Bone | undefined { return this.byName.get(name); }
  anchor(name: string): AnchorDef | undefined { return this.anchors.get(name); }
  anchorNames(): string[] { return [...this.anchors.keys()]; }

  resetPose(): void { for (const b of this.bones) b.resetPose(); }

  update(root: Mat2D): void { for (const b of this.bones) b.updateWorld(root); }

  /** Matrice monde d'un ancrage (os animé × repère local de l'ancrage). */
  anchorWorld(name: string, out = new Mat2D()): Mat2D | null {
    const a = this.anchors.get(name);
    const b = a && this.byName.get(a.bone);
    if (!a || !b) return null;
    Mat2D.fromTRS(a.x, a.y, a.rotation, 1, 1, this.tmp);
    return b.world.multiply(this.tmp, out);
  }
}
