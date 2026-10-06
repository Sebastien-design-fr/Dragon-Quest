// Génère les squelettes (rigs) des 4 stades dans www/data/rigs/*.json.
//
// Les 4 stades partagent EXACTEMENT la même topologie d'os et les mêmes noms d'ancrages :
// c'est ce qui donne l'impression d'un seul dragon qui grandit, et ce qui permet aux
// animations et aux équipements d'être réutilisés d'un stade à l'autre.
// Seules les proportions changent (paramètres ci-dessous).
//
// Les fichiers générés sont de simples données : on peut les retoucher à la main
// (par exemple pour caler les ancrages sur les illustrations définitives).
// Relancer : npm run rigs
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../www/data/rigs/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const STAGES = {
  baby:      { scale: 0.5,  body: 1.0,  leg: 0.8,  neck: 0.55, head: 1.6,  eye: 1.7,  tail: 0.7,  wing: 0.55, horn: 0.35, spikes: 0.45, gold: 0 },
  young:     { scale: 0.72, body: 0.95, leg: 1.0,  neck: 1.05, head: 1.15, eye: 1.2,  tail: 1.05, wing: 0.95, horn: 0.75, spikes: 0.8,  gold: 0 },
  adult:     { scale: 1.0,  body: 1.15, leg: 1.05, neck: 1.0,  head: 1.0,  eye: 1.0,  tail: 1.0,  wing: 1.1,  horn: 1.0,  spikes: 1.0,  gold: 0 },
  legendary: { scale: 1.15, body: 1.2,  leg: 1.08, neck: 1.05, head: 1.05, eye: 1.0,  tail: 1.1,  wing: 1.25, horn: 1.6,  spikes: 1.3,  gold: 1 }
};

const PALETTE = {
  base: '#141318', mid: '#211f27', edge: '#3a3541', belly: '#3d3227', bellyLine: '#6b5434',
  membrane: '#18161c', membraneEdge: '#2e2a33', horn: '#1c1a1f', hornTip: '#6a5e50',
  claw: '#b9ad99', eye: '#f2a33a', eyeGlow: '#ffb84a', gold: '#e8b64c'
};

function buildRig(id, p) {
  const s = p.scale;
  const bodyW = 190 * p.body * s, bodyH = 82 * p.body * s;
  const legLen = 82 * p.leg * s, legT = 30 * p.body * s;
  const n1 = 62 * p.neck * s, n2 = 55 * p.neck * s, nT = 38 * s;
  const headL = 92 * p.head * s, headH = 44 * p.head * s;
  const tl = [70, 62, 55, 48].map(v => v * p.tail * s);
  const tt = [36, 28, 20, 13].map(v => v * p.tail * s * (0.8 + 0.2 * p.body));
  const wingW = 210 * p.wing * s, wingH = 160 * p.wing * s;
  const hornL = 50 * p.horn * s, hornT = 10 * Math.max(p.horn, 0.6) * s;
  const eyeW = 13 * p.eye * s, eyeH = 7 * p.eye * s;

  const bones = [];
  const bone = (name, parent, x, y, rot, part, extra = {}) =>
    bones.push({ name, parent, x: r(x), y: r(y), rotation: rot, scaleX: 1, scaleY: extra.scaleY ?? 1, length: r(part?.w ?? 0), part });

  bone('root', null, 0, 0, 0, null);
  bone('body', 'root', 0, -(legLen + bodyH * 0.12), 0,
    { key: 'torso', shape: 'torso', w: r(bodyW), h: r(bodyH), pivot: [0.5, 0.5], z: 20 });

  // Pattes : l'os pointe vers le bas (rotation 90°), la pièce est dessinée le long de +x.
  bone('legRearFar', 'body', -bodyW * 0.27, bodyH * 0.18, 84, { key: 'leg_rear', shape: 'leg', w: r(legLen), h: r(legT), pivot: [0, 0.5], z: 6, shade: 0.65 });
  bone('legFrontFar', 'body', bodyW * 0.33, bodyH * 0.2, 96, { key: 'leg_front', shape: 'leg', w: r(legLen * 0.96), h: r(legT * 0.85), pivot: [0, 0.5], z: 7, shade: 0.65 });

  bone('wingFar', 'body', bodyW * 0.05, -bodyH * 0.42, 0, { key: 'wing', shape: 'wing', w: r(wingW), h: r(wingH), pivot: [0.95, 0.92], z: 2, shade: 0.7 });

  bone('tail1', 'body', -bodyW * 0.44, -bodyH * 0.02, 172, { key: 'tail_1', shape: 'tail', w: r(tl[0]), h: r(tt[0]), h2: r(tt[1]), pivot: [0, 0.5], z: 12 });
  bone('tail2', 'tail1', tl[0] * 0.92, 0, -14, { key: 'tail_2', shape: 'tail', w: r(tl[1]), h: r(tt[1]), h2: r(tt[2]), pivot: [0, 0.5], z: 11 });
  bone('tail3', 'tail2', tl[1] * 0.92, 0, -12, { key: 'tail_3', shape: 'tail', w: r(tl[2]), h: r(tt[2]), h2: r(tt[3]), pivot: [0, 0.5], z: 10 });
  bone('tail4', 'tail3', tl[2] * 0.92, 0, -10, { key: 'tail_4', shape: 'tailTip', w: r(tl[3]), h: r(tt[3]), pivot: [0, 0.5], z: 9 });

  bone('neck1', 'body', bodyW * 0.36, -bodyH * 0.22, -58, { key: 'neck_1', shape: 'neck', w: r(n1), h: r(nT), h2: r(nT * 0.85), pivot: [0, 0.5], z: 26 });
  bone('neck2', 'neck1', n1 * 0.9, 0, 14, { key: 'neck_2', shape: 'neck', w: r(n2), h: r(nT * 0.85), h2: r(nT * 0.72), pivot: [0, 0.5], z: 27 });
  bone('head', 'neck2', n2 * 0.92, 0, 48, { key: 'head', shape: 'head', w: r(headL), h: r(headH), pivot: [0.08, 0.5], z: 30 });
  bone('jaw', 'head', headL * 0.3, headH * 0.2, 6, { key: 'jaw', shape: 'jaw', w: r(headL * 0.62), h: r(headH * 0.3), pivot: [0, 0.3], z: 29 });
  bone('hornBack', 'head', headL * 0.18, -headH * 0.36, -168, { key: 'horn_back', shape: 'horn', w: r(hornL), h: r(hornT), pivot: [0, 0.5], z: 28 });
  bone('hornFront', 'head', headL * 0.3, -headH * 0.42, -152, { key: 'horn_front', shape: 'horn', w: r(hornL * 0.72), h: r(hornT * 0.85), pivot: [0, 0.5], z: 31 });
  bone('eye', 'head', headL * 0.5, -headH * 0.12, 0, { key: 'eye', shape: 'eye', w: r(eyeW), h: r(eyeH), pivot: [0.5, 0.5], z: 32 });
  bone('eyelid', 'head', headL * 0.5, -headH * 0.12, 0, { key: 'eyelid', shape: 'eyelid', w: r(eyeW * 1.25), h: r(eyeH * 1.5), pivot: [0.5, 0.5], z: 33 }, { scaleY: 0.02 });

  bone('wingNear', 'body', bodyW * 0.1, -bodyH * 0.36, 0, { key: 'wing', shape: 'wing', w: r(wingW), h: r(wingH), pivot: [0.95, 0.92], z: 36 });
  bone('legRearNear', 'body', -bodyW * 0.3, bodyH * 0.26, 88, { key: 'leg_rear', shape: 'leg', w: r(legLen), h: r(legT), pivot: [0, 0.5], z: 40 });
  bone('legFrontNear', 'body', bodyW * 0.3, bodyH * 0.28, 92, { key: 'leg_front', shape: 'leg', w: r(legLen * 0.96), h: r(legT * 0.85), pivot: [0, 0.5], z: 41 });

  const anchors = [
    { name: 'head_anchor', bone: 'head', x: r(headL * 0.38), y: r(-headH * 0.42), rotation: 0, z: 34 },
    { name: 'mouth_anchor', bone: 'head', x: r(headL * 0.98), y: r(headH * 0.18), rotation: 0, z: 35 },
    { name: 'neck_anchor', bone: 'neck2', x: r(n2 * 0.45), y: 0, rotation: 0, z: 28 },
    { name: 'chest_anchor', bone: 'body', x: r(bodyW * 0.18), y: r(-bodyH * 0.02), rotation: 0, z: 25 },
    { name: 'front_leg_anchor', bone: 'legFrontNear', x: r(legLen * 0.7), y: 0, rotation: 0, z: 42 },
    { name: 'rear_leg_anchor', bone: 'legRearNear', x: r(legLen * 0.7), y: 0, rotation: 0, z: 42 },
    { name: 'front_leg_far_anchor', bone: 'legFrontFar', x: r(legLen * 0.7), y: 0, rotation: 0, z: 8 },
    { name: 'rear_leg_far_anchor', bone: 'legRearFar', x: r(legLen * 0.7), y: 0, rotation: 0, z: 8 },
    { name: 'left_wing_anchor', bone: 'wingFar', x: r(-wingW * 0.42), y: r(-wingH * 0.62), rotation: -38, z: 3 },
    { name: 'right_wing_anchor', bone: 'wingNear', x: r(-wingW * 0.42), y: r(-wingH * 0.62), rotation: -38, z: 37 },
    { name: 'tail_anchor', bone: 'tail2', x: r(tl[1] * 0.45), y: 0, rotation: 0, z: 13 },
    { name: 'tail_tip_anchor', bone: 'tail4', x: r(tl[3] * 0.75), y: 0, rotation: 0, z: 13 },
    { name: 'body_center', bone: 'body', x: 0, y: 0, rotation: 0, z: 0 }
  ];

  const tailReach = tl.reduce((a, b) => a + b, 0) * 0.85;
  const bounds = {
    x: r(-(bodyW * 0.5 + tailReach + 70 * s)),
    y: r(-(legLen + bodyH + wingH * 1.05 + 30 * s)),
    w: 0, h: 0
  };
  bounds.w = r(bodyW * 0.5 + n1 + n2 + headL + 90 * s - bounds.x); // marge pour le souffle de feu
  bounds.h = r(-bounds.y + 24 * s);

  return {
    id,
    version: 1,
    note: 'Fichier généré par scripts/build-rigs.mjs — retouchable à la main. Unités : pixels de conception.',
    scale: s,
    params: { horn: p.horn, spikes: p.spikes, gold: p.gold },
    palette: { ...PALETTE, ...(p.gold ? { eye: '#ffcf55', eyeGlow: '#ffd76a' } : {}) },
    bounds,
    bones,
    anchors
  };
}

function r(v) { return Math.round(v * 10) / 10; }

const rigs = Object.fromEntries(Object.entries(STAGES).map(([id, p]) => [id, buildRig(id, p)]));
// Caméra : chaque stade est cadré un peu plus large que lui-même, en direction du cadre
// du légendaire, pour que la croissance reste perceptible à l'écran.
const L = rigs.legendary.bounds;
for (const rig of Object.values(rigs)) {
  const b = rig.bounds, k = 0.3;
  rig.camera = { x: r(b.x + (L.x - b.x) * k), y: r(b.y + (L.y - b.y) * k), w: r(b.w + (L.w - b.w) * k), h: r(b.h + (L.h - b.h) * k) };
  writeFileSync(OUT + rig.id + '.json', JSON.stringify(rig, null, 2));
}
console.log('rigs générés :', Object.keys(rigs).join(', '));
