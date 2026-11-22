import { THREE, box, cyl, sph, cone, mat, mesh, makeHare, makeWolf } from './common.js';
import { Hub, makeLabel, makeHippo } from './hub.js';
import { makePalm, makePine, makeMushroom, makeLion, makeHarvester, makeBoar, makeBuilding } from './props.js';
import { Runner } from './runner.js';
import { Duel } from './duel.js';
import { RopeBoss, WeightLift } from './minis.js';

/* ---------- authoring helpers ---------- */
const P = (x, y, z, w, d, o = {}) => ({ x, y, z, w, d, ...o });
const GROUND = (x, z, w, d, c) => P(x, 0, z, w, d, { h: 1, color: c });
const WALL = (x, z, w, d, h = 4, c = 0x8a8f9c) => P(x, h, z, w, d, { h, color: c });
const GATE = (needs, x, z, w, d, h = 5, c = 0xd9363e) => P(x, h, z, w, d, { h, color: c, gate: needs });
const CRATE = (x, z, w = 2.4, h = 2.4) => P(x, h, z, w, w, { h, color: 0xb07a3a, breakable: true });
const APPEAR = (needs, x, y, z, w, d, o = {}) => P(x, y, z, w, d, { h: 0.5, color: 0x9a4adb, appear: needs, ...o });
const pend = (x, y, z, o = {}) => ({ type: 'pendulum', pivot: [x, y + 6.5, z], len: 5.2, amp: 0.85, speed: 2, axis: 'x', r: 0.8, color: 0x3a3a42, ...o });
const slider = (a, b, o = {}) => ({ type: 'slider', from: a, to: b, speed: 1.5, r: 0.6, ...o });
const zone = (scene, text, x, y, z, w = 7) => { const l = makeLabel(text, '#ffe9b0', w); l.position.set(x, y, z); scene.add(l); };

const RUN_CONTROLS = 'A / D: change lane  •  Space / W: jump  •  S: slide under bars  •  R: restart';

const obsFactory = (c) => (kind, rng, w) => {
  const g = new THREE.Group();
  if (kind === 'low') { const b = box(w, 1, 0.8, c.low); b.position.y = 0.5; g.add(b); const s = box(w, 0.2, 0.82, c.stripe ?? 0xffffff); s.position.y = 0.9; g.add(s); }
  else if (kind === 'high') {
    for (const s of [-1, 1]) { const p = box(0.6, 3.4, 0.6, c.post ?? 0x555b66); p.position.set(s * (w / 2 + 0.2), 1.7, 0); g.add(p); }
    const bar = box(w + 0.8, 1.2, 0.6, c.high); bar.position.y = 1.95; g.add(bar);
  } else { const b = box(w - 0.4, 2.4, 1.6, c.wall); b.position.y = 1.2; g.add(b); const t = box(w - 0.9, 0.5, 1.7, c.stripe ?? 0xffffff); t.position.y = 2.0; g.add(t); }
  return g;
};
const sceneryFactory = (c) => (rng) => {
  const g = new THREE.Group(); const h = (c.minH ?? 4) + rng() * (c.hRange ?? 14);
  const b = box(3 + rng() * 4, h, 3 + rng() * 4, c.a[Math.floor(rng() * c.a.length)]); b.position.y = h / 2; g.add(b);
  if (c.top) { const t = cone(2.6, 2, c.top, 6); t.position.y = h + 1; g.add(t); }
  return g;
};

/* ===================================================================
   WORLD 1 – Ostankino TV Studio
   =================================================================== */
export function studioChase() {
  return {
    sky: 0x20243a, ground: 0x4a4f66, side: 0x2a2e40, line: 0xffe38a, length: 600, seed: 71, speed0: 14, speed1: 17.5,
    player: 'hare', hint: 'A Hippo officer chases you through the live set!', progressLabel: 'Live!',
    phases: [{ at: 0, kind: 'hippo' }],
    customChaser: { hippo: (g) => { const h = makeHippo(); h.rotation.y = Math.PI; h.scale.setScalar(1.3); g.add(h); } },
    makeObstacle: obsFactory({ low: 0xe23a3a, high: 0x3a7be2, wall: 0x8f5ad9 }), scenery: sceneryFactory({ a: [0x3a4466, 0x4a3a66, 0x2a5a6a], top: 0xffd23f }),
    finishMsg: 'You escaped through the stage door!', caught: 'The Hippo caught you on live TV!',
  };
}

export function tvStudio(ctx) {
  const plat = [
    GROUND(0, 0, 74, 74, 0x6b7285),
    WALL(0, -36.5, 76, 1.2, 10, 0x3a3f55), WALL(0, 36.5, 76, 1.2, 10, 0x3a3f55), WALL(-36.5, 0, 1.2, 74, 10, 0x3a3f55), WALL(36.5, 0, 1.2, 74, 10, 0x3a3f55),
    // cooking show kitchen (west)
    WALL(-23, -9, 18, 1.2, 5, 0xe8d9b0), WALL(-23, 9, 18, 1.2, 5, 0xe8d9b0), WALL(-32, 0, 1.2, 18, 5, 0xe8d9b0),
    WALL(-14.5, -6.2, 1.2, 4.8, 5, 0xe8d9b0), WALL(-14.5, 6.2, 1.2, 4.8, 5, 0xe8d9b0), GATE(['plateA'], -14.5, 0, 1.2, 7.6, 5, 0xd9363e),
    // fencing duel (east): wall-jump tower
    WALL(18, -4, 0.8, 6, 8, 0x9a6ab5), WALL(22, -4, 0.8, 6, 8, 0x9a6ab5), P(24, 8, -4, 5, 6, { h: 0.4, color: 0xffd23f, cp: true }),
    // rock concert (north): stage A, gap, stage B
    P(0, 1.6, -16, 18, 6, { h: 1.6, color: 0xb02a8a }), P(0, 1.6, -37, 18, 10, { h: 1.6, color: 0xb02a8a }),
    // control room
    WALL(-7, -3, 1.2, 10, 5, 0x55607a), WALL(7, -3, 1.2, 10, 5, 0x55607a), WALL(0, -8.5, 15, 1.2, 5, 0x55607a),
    WALL(-4.6, 2.5, 5.6, 1.2, 5, 0x55607a), WALL(4.6, 2.5, 5.6, 1.2, 5, 0x55607a), GATE(['cook', 'fence', 'rock'], 0, 2.5, 3.6, 1.2, 5, 0xd9363e),
  ];
  return new Hub(ctx, {
    id: 'tv', sky: 0x20243a, fog: 0x20243a, light: { sky: 0xffe9c8, ground: 0x554466, intensity: 0.9 }, spawn: [0, 0.1, 26], wolfSpawn: [2, 0.1, 27], killY: -20,
    platforms: plat, hazards: [],
    objectives: [{ flag: 'cook', text: 'Cooking show: flip the oven switch' }, { flag: 'fence', text: 'Fencing duel: climb the tower' }, { flag: 'rock', text: 'Rock concert: cross the stage' }, { flag: 'chase', text: 'Live broadcast chase' }],
    intro: 'Sneak past the Hippo guards (Shift = sneak). Tab swaps Hare and Wolf!',
    things: [
      { type: 'guard', path: [[-14, 20], [14, 20]], view: 9, fov: 70, speed: 2.8 }, { type: 'guard', path: [[14, 10], [-14, 10]], view: 9, fov: 70, speed: 2.4 },
      { type: 'sign', p: [4, 0, 30], text: 'Wolf: C = disguise as a cameraman', w: 6 },
      { type: 'plate', p: [-10, 0, 15], r: 1.7, heavy: true, flag: 'plateA' },
      { type: 'lever', p: [-27, 0, 0], flag: 'cook', text: 'Oven switch' },
      { type: 'lever', p: [24, 8, -4], flag: 'fence', text: 'Spotlight switch' },
      { type: 'anchor', p: [0, 7, -24] }, { type: 'anchor', p: [0, 7, -32] },
      { type: 'lever', p: [0, 1.6, -38], flag: 'rock', text: 'Amp switch' },
      { type: 'mini', p: [0, 0, -3], label: 'Live Broadcast Chase', flag: 'chase', spec: { make: (c) => new Runner(c, studioChase()), title: 'Live Broadcast Chase', intro: 'The Wolf accidentally broadcast his own defeat across the nation, and now a Hippo wants the footage! Run!', controls: RUN_CONTROLS } },
      { type: 'gear', p: [0, 0, -6.6], needs: ['chase'] },
    ],
    carrots: [[-30, 0.5, 30], [30, 0.5, 30], [-30, 0.5, 14], [30, 0.5, 14], [-26, 0.5, -5], [24.5, 8.6, -4], [0, 2.2, -16], [0, 2.2, -37], [-5, 0.5, -4], [5, 0.5, -6],
      [-12, 0.5, -25], [12, 0.5, -25], [28, 0.5, -20], [-28, 0.5, -22], [16, 0.5, 14], [-18, 0.5, 2], [10, 0.5, 30]],
    build(scene) {
      for (let i = 0; i < 6; i++) { const s = box(7, 4.5, 0.4, mat([0x2a6fe0, 0xe0442a, 0x2ae07a][i % 3], 0x223355)); s.position.set(-30 + i * 12, 6, -35.6); scene.add(s); }
      for (let i = 0; i < 8; i++) { const sp = cyl(0.4, 0.8, 1.2, 0x222222, 8); sp.position.set(-30 + i * 8.5, 9, 30); scene.add(sp); const b = sph(0.5, mat(0xfff0a0, 0xffe680), 8); b.position.set(-30 + i * 8.5, 8.2, 30); scene.add(b); }
      for (let i = 0; i < 4; i++) { const cam = new THREE.Group(); cam.add(box(1.6, 1.2, 2.4, 0x333b4a)); const t = cyl(0.1, 0.1, 1.8, 0x888888, 6); t.position.y = -1.5; cam.add(t); cam.position.set(-34 + i * 4.5, 2.2, -32); scene.add(cam); }
      zone(scene, 'ON AIR', 0, 6, 3.4, 5); zone(scene, 'COOKING SHOW', -23, 7, -9, 8); zone(scene, 'FENCING DUEL', 20, 10.5, -4, 8); zone(scene, 'ROCK CONCERT', 0, 10, -16, 8);
      const oven = box(3, 1.4, 1.6, 0xcccccc); oven.position.set(-29, 0.7, -5); scene.add(oven);
      for (let i = 0; i < 4; i++) { const d = cyl(1.0, 1.0, 1.0, [0xd9363e, 0x3a7be2, 0xffd23f, 0x3ac26a][i], 12); d.position.set(-5 + i * 3.4, 0.5, -34); scene.add(d); }
    },
  });
}

/* ===================================================================
   WORLD 2 – 1980 Olympic Village
   =================================================================== */
export function velodrome() {
  return {
    sky: 0x9fd6ff, ground: 0xc98a52, side: 0x6aa84f, length: 650, seed: 83, speed0: 15, speed1: 19, player: 'bike',
    hint: 'Velodrome time trial! Dodge rival cyclists and hurdles.', progressLabel: 'Laps',
    phases: [{ at: 0, kind: 'motorcycle' }],
    makeObstacle: obsFactory({ low: 0xffffff, high: 0x3a7be2, wall: 0xe23a3a, stripe: 0xffd23f }), scenery: sceneryFactory({ a: [0xd8d2c4, 0xa7b0bd, 0xc9b79c], top: 0xd9363e, hRange: 8 }),
    finishMsg: 'Gold medal!', caught: 'The Wolf overtook you on the final lap!',
  };
}

export function olympics(ctx) {
  const rope = (z, y, o = {}) => P(-34, y, z, 2.4, 4, { h: 0.5, color: 0xf0e6c8, ...o });
  const plat = [
    GROUND(0, 0, 90, 80, 0x4a9a4a),
    rope(-8, 0.9), rope(-14, 1.9), rope(-20, 2.9, { move: { axis: 'x', range: 3, speed: 1.2 } }), rope(-26, 3.9), rope(-32, 4.9), rope(-38, 5.9, { cp: true }),
    P(-34, 6.7, -44, 6, 6, { h: 0.5, color: 0xffd23f, cp: true }),
  ];
  return new Hub(ctx, {
    id: 'olympics', sky: 0x8fd8ff, light: { sky: 0xe6f6ff, ground: 0x6a8a5a, sun: 0xfff6d0, intensity: 1.2 }, spawn: [0, 0.1, 30], wolfSpawn: [2, 0.1, 31], killY: -20,
    platforms: plat,
    hazards: [slider([-14, 1.2, 10], [14, 1.2, 10], { r: 0.5, speed: 1.1, color: 0xffd23f }), slider([14, 1.2, 2], [-14, 1.2, 2], { r: 0.5, speed: 1.4, color: 0xffd23f, phase: 1 })],
    objectives: [{ flag: 'velo', text: 'Velodrome cycling race' }, { flag: 'lift', text: 'Weightlifting' }, { flag: 'gym', text: 'Gymnastics beams' }, { flag: 'box', text: 'Boxing: pull the ropes' }],
    intro: 'The Golden Gear is the Olympic trophy! Win events (and sabotage them) to reach the boxing arena.',
    things: [
      { type: 'sign', p: [0, 0, 26], text: 'Hazard: flying javelins ahead!', w: 6 },
      { type: 'mini', p: [-22, 0, 18], label: 'Velodrome', flag: 'velo', spec: { make: (c) => new Runner(c, velodrome()), title: 'Velodrome', intro: 'A time trial around the velodrome!', controls: RUN_CONTROLS } },
      { type: 'mini', p: [22, 0, 18], label: 'Weightlifting', flag: 'lift', spec: { make: (c) => new WeightLift(c), title: 'Weightlifting', intro: 'The Wolf must lift the barbell. Mash A and D alternately!', controls: 'Mash A / D (or ← / →) alternately' } },
      { type: 'lever', p: [-34, 6.7, -45], flag: 'gym', text: 'Finish the gymnastics routine' },
      { type: 'mini', p: [30, 0, -28], label: 'Boxing Arena', flag: 'box', needs: ['velo', 'lift', 'gym'], lockText: 'Win the other three events first!', spec: { make: (c) => new RopeBoss(c), title: 'Wolf vs. the Bear', intro: 'The Wolf is in the ring with a heavyweight Bear. The Hare secretly pulls the ropes from the rafters to keep the Wolf alive!', controls: 'A / S / D (or ← ↓ →): hit the notes as they reach the ring' } },
      { type: 'gear', p: [36, 0, -34], needs: ['box'] },
    ],
    carrots: [[-34, 0.5, 30], [34, 0.5, 30], [-38, 0.5, 5], [38, 0.5, 5], [-34, 3.5, -20], [-34, 7.3, -44], [0, 0.5, -10], [-20, 0.5, -10], [20, 0.5, -10],
      [0, 0.5, -30], [10, 0.5, -34], [38, 0.5, -34], [-10, 0.5, 20], [10, 0.5, 20], [0, 0.5, 14], [-38, 0.5, -34], [24, 0.5, -10]],
    build(scene) {
      const track = mesh(new THREE.TorusGeometry(16, 2, 4, 40), mat(0xb5513a)); track.rotation.x = Math.PI / 2; track.scale.y = 0.6; track.position.set(0, 0.05, 6); scene.add(track);
      for (let i = 0; i < 5; i++) { const r = mesh(new THREE.TorusGeometry(2, 0.22, 8, 24), mat([0x3a7be2, 0xffd23f, 0x222222, 0x3ac26a, 0xe23a3a][i])); r.position.set(-9 + i * 4.5, 14 + (i % 2) * -2.2, -40); scene.add(r); }
      for (let r = 0; r < 4; r++) { const s = box(60, 1.5, 3, [0xc9c3b3, 0xb0a99a][r % 2]); s.position.set(0, 0.75 + r * 1.5, -37 - r * 3); scene.add(s); }
      const torch = cyl(0.3, 0.5, 3, 0xc9a24a, 8); torch.position.set(0, 1.5, 22); scene.add(torch); const fl = cone(0.5, 1.4, mat(0xff7a1a, 0xff4400), 8); fl.position.set(0, 3.6, 22); scene.add(fl);
      zone(scene, 'GYMNASTICS', -34, 10, -32, 7); zone(scene, 'VELODROME', -22, 4, 18, 6); zone(scene, 'WEIGHTLIFTING', 22, 4, 18, 7); zone(scene, 'BOXING ARENA', 30, 6, -28, 7);
      const ring = box(10, 0.6, 10, 0x2a58b8); ring.position.set(30, 0.3, -34); scene.add(ring);
    },
  });
}

/* ===================================================================
   WORLD 3 – Russian Fairytales
   =================================================================== */
export function fairytale(ctx) {
  const plat = [
    GROUND(0, 20, 84, 38, 0x3a6a3a),
    P(-28, 0, -26, 20, 20, { h: 1, color: 0x5a5a60 }), P(28, 0, -26, 22, 22, { h: 1, color: 0x4a3a40 }),
    APPEAR(['apples'], -26, 0.4, -6, 4, 4, { move: { axis: 'z', range: 6.5, speed: 0.9 } }),
    APPEAR(['apples'], 26, 0.4, -6, 4, 4, { move: { axis: 'z', range: 6.5, speed: 0.9, phase: 2 } }),
    // mushroom steps to apple 1
    P(12, 1.6, 12, 3, 3, { h: 1, color: 0xd9363e }), P(17, 3.3, 9, 3, 3, { h: 1, color: 0xd9363e }), P(22, 5, 12, 3, 3, { h: 1, color: 0xd9363e }),
    // hill with apple 2
    P(-20, 2.2, 12, 8, 8, { h: 2.2, color: 0x4a7a3a }),
    // twin trunks to apple 3
    WALL(-4.6, 26, 0.8, 6, 7, 0x6b4a2a), WALL(-0.4, 26, 0.8, 6, 7, 0x6b4a2a), P(1.6, 7, 26, 4, 6, { h: 0.4, color: 0x2f8a3a }),
  ];
  return new Hub(ctx, {
    id: 'fairy', sky: 0x1a1030, fog: 0x1a1030, light: { sky: 0xb0a0ff, ground: 0x223322, sun: 0xd0d8ff, intensity: 0.85 }, spawn: [0, 0.1, 32], wolfSpawn: [-28, 0.1, -27], wolfFace: Math.PI, chars: ['hare'], killY: -20,
    platforms: plat, hazards: [],
    objectives: [{ flag: 'apples', text: 'Collect 3 magic apples (carpets!)' }, { flag: 'wolfFree', text: 'Rescue the Wolf from the dungeon' }, { flag: 'zmey', text: 'Defeat Zmey Gorynych' }],
    intro: 'Baba Yaga double-crossed the Wolf! Find magic apples to wake the flying carpets. Beware the witch (Shift = sneak).',
    things: [
      { type: 'guard', path: [[-30, 6], [-10, 6], [-10, 20], [-30, 20]], view: 9, fov: 90, speed: 2.4, model: 'witch' },
      { type: 'item', p: [22, 5.7, 12], key: 'apple', of: 3, flag: 'apples', name: 'Magic apple', doneMsg: 'The flying carpets wake up!' },
      { type: 'item', p: [-20, 2.8, 12], key: 'apple', of: 3, flag: 'apples', name: 'Magic apple', doneMsg: 'The flying carpets wake up!' },
      { type: 'item', p: [2, 7.6, 26], key: 'apple', of: 3, flag: 'apples', name: 'Magic apple', doneMsg: 'The flying carpets wake up!' },
      { type: 'sign', p: [0, 0, 28], text: 'Hare: wall-jump between two trunks!', w: 6 },
      { type: 'rescue', p: [-28, 0, -25], flag: 'wolfFree', wolfTo: [-28, 0.1, -22], label: 'Hold E: free the Wolf' },
      { type: 'mini', p: [28, 0, -30], label: 'Zmey Gorynych', flag: 'zmey', needs: ['wolfFree'], lockText: 'Free the Wolf from the dungeon first!', spec: { make: (c) => new Duel(c, ZMEY), title: 'The Three-Headed Dragon', intro: 'Zmey Gorynych guards the Golden Gear! Grab magic apples and throw them at the dragon. Swap Hare/Wolf with Tab (the Wolf hits twice as hard).', controls: 'WASD: run  •  Space: throw  •  Tab: swap character' } },
      { type: 'gear', p: [28, 0, -22], needs: ['zmey'] },
    ],
    carrots: [[-34, 0.5, 34], [34, 0.5, 34], [-34, 0.5, 6], [34, 0.5, 6], [12, 2.3, 12], [17, 4, 9], [-20, 3, 14], [-30, 0.5, -30], [-22, 0.5, -20],
      [22, 0.5, -20], [34, 0.5, -32], [26, 0.5, -34], [0, 0.5, 20], [-12, 0.5, 30], [12, 0.5, 30], [-26, 0.5, -6], [26, 0.5, 4]],
    build(scene) {
      for (let i = 0; i < 16; i++) { const a = i * 2.3; const m = makeMushroom([0xd9363e, 0x9a4adb, 0xffa020][i % 3]); m.scale.setScalar(0.6 + (i % 3) * 0.12); m.position.set(Math.cos(a) * (14 + i * 1.7) % 38, 0, 14 + Math.sin(a) * 12); scene.add(m); }
      for (let i = 0; i < 18; i++) { const t = makePine(2.4 + (i % 3) * 0.4); t.position.set(-40 + i * 4.6, 0, 40); scene.add(t); }
      const hut = new THREE.Group(); const hb = box(5, 3.5, 5, 0x6b4a2a); hb.position.y = 5.5; const hr = cone(4.2, 2.6, 0x4a2a1a, 4); hr.rotation.y = Math.PI / 4; hr.position.y = 8.5; hut.add(hb, hr);
      for (const s of [-1, 1]) { const leg = cyl(0.25, 0.25, 4.6, 0xd9a24a, 6); leg.position.set(s * 1.4, 2.3, 0); hut.add(leg); const foot = box(1.4, 0.3, 1.8, 0xd9a24a); foot.position.set(s * 1.4, 0.15, 0.4); hut.add(foot); }
      hut.position.set(-8, 0, 10); scene.add(hut);
      for (let i = -3; i <= 3; i++) { const bar = cyl(0.12, 0.12, 5, 0x333333, 5); bar.position.set(-28 + i * 1.4, 2.5, -22); scene.add(bar); }
      const cave = box(14, 9, 3, 0x1a1218); cave.position.set(28, 4.5, -37); scene.add(cave);
      for (let i = 0; i < 6; i++) { const bn = cyl(0.2, 0.2, 2, 0xe8dcc0, 5); bn.position.set(20 + i * 2.6, 0.6, -18); bn.rotation.z = 1.2; scene.add(bn); }
      const moon = sph(5, mat(0xfff7c0, 0xfff0a0), 16); moon.position.set(30, 38, -60); moon.castShadow = false; scene.add(moon);
      zone(scene, 'WITCH\'S HILL', -20, 8, 12, 6); zone(scene, 'DUNGEON', -28, 6, -26, 5); zone(scene, 'DRAGON\'S LAIR', 28, 11, -30, 7); zone(scene, 'MUSHROOM STEPS', 17, 8, 9, 7);
    },
  });
}
export const ZMEY = {
  boss: 'zmey', bossName: 'Zmey Gorynych', hp: 26, lives: 5, both: true, start: 'hare', bg: 0x1a0f1f, floor: 0x3a2a2a, rim: 0xd9363e, shotColor: 0xff5a1a,
  ammo: { name: 'Magic apples', color: 0xe23a3a }, winMsg: 'Zmey Gorynych falls with a mighty crash!',
  phases: [
    { at: 1, attacks: [{ type: 'shots', every: 2.7, n: 3 }] },
    { at: 0.66, msg: 'The second head awakens!', attacks: [{ type: 'shots', every: 2.3, n: 3 }, { type: 'slam', every: 4.2 }] },
    { at: 0.33, msg: 'The final head roars!', attacks: [{ type: 'shots', every: 2.0, n: 5 }, { type: 'slam', every: 3.4 }, { type: 'ring', every: 6.5, n: 12 }] },
  ],
};

/* ===================================================================
   WORLD 4 – Savage Tropical Island
   =================================================================== */
export function boarRide() {
  const spear = (g, x) => { const sp = cyl(0.04, 0.04, 2.2, 0x8a5a2a, 4); sp.position.set(x, 1.6, 0); sp.rotation.x = 0.4; g.add(sp); };
  return {
    sky: 0x8fd8ff, ground: 0xc9a46b, side: 0x3f8f3a, line: 0x8a5a2a, length: 600, seed: 97, speed0: 14, speed1: 18, player: 'boar',
    hint: 'Ride the wild boar to lure the tribe away from the Wolf!', progressLabel: 'Jungle',
    customRider: {
      boar: () => {
        const group = new THREE.Group(); const inner = makeHare({ fur: 0x9fa8b5 }); inner.rotation.y = Math.PI; inner.position.y = 0.85; inner.scale.setScalar(0.8); group.add(inner);
        const boar = makeBoar(); boar.rotation.y = 0; group.add(boar);
        return { group, inner, wheels: [], kind: 'boar' };
      },
    },
    phases: [{ at: 0, kind: 'tribe' }],
    customChaser: {
      tribe: (g, c) => { for (const x of [-2, 0, 2]) { const h = makeHare({ fur: 0x9a7a55, shirt: 0x3a8a3a }); h.rotation.y = Math.PI; h.position.set(x, 0, (x === 0 ? 1.5 : 0)); g.add(h); spear(g, x); if (!c.anim) c.anim = h; } },
    },
    makeObstacle: obsFactory({ low: 0x6b4a2a, high: 0x3f8f3a, wall: 0x8a8f9c, stripe: 0xffd23f }), scenery: sceneryFactory({ a: [0x3f8f3a, 0x2f7a3a, 0x5a9a4a], top: 0x2a6a2a, hRange: 6 }),
    finishMsg: 'The tribe is lost in the jungle!', caught: 'The Savage Hares caught you!',
  };
}

export function island(ctx) {
  const plat = [
    GROUND(0, 0, 80, 80, 0xf0dca0),
    // trial 1: temple traps (east)
    P(16, 1, 10, 4, 4, { h: 1, color: 0xc9a46b }), P(22, 2, 10, 3, 3, { crumble: true }), P(28, 3, 10, 3, 3, { move: { axis: 'x', range: 2, speed: 1.2 } }), P(34, 4, 10, 5, 5, { h: 1, color: 0xc9a46b, cp: true }),
    // trial 2: wall jump (west)
    WALL(-27.6, 2, 0.8, 6, 8, 0x8a5a2a), WALL(-24, 2, 0.8, 6, 8, 0x8a5a2a), P(-22, 8, 2, 4.4, 6, { h: 0.4, color: 0xffd23f, cp: true }),
    // temple crate gate
    WALL(-9, -20, 12, 2, 4, 0x6b5a4a), WALL(9, -20, 12, 2, 4, 0x6b5a4a), CRATE(-2.4, -20, 2.4, 4), CRATE(0, -20, 2.4, 4), CRATE(2.4, -20, 2.4, 4),
  ];
  return new Hub(ctx, {
    id: 'island', sky: 0x8fd8ff, light: { sky: 0xe6f6ff, ground: 0xe0c98a, sun: 0xfff6d0, intensity: 1.3 }, spawn: [0, 0.1, 32], wolfSpawn: [0, 0.1, 0], chars: ['hare'], killY: -5,
    platforms: plat,
    hazards: [pend(22, 2, 10, { axis: 'z', phase: 0.5 }), pend(28, 3, 10, { axis: 'z', phase: 2 }),
      slider([-14, 1, -24], [-14, 1, -36], { speed: 1.6, r: 0.55, color: 0xcccccc }), slider([-10, 1, -36], [-10, 1, -24], { speed: 1.9, r: 0.55, color: 0xcccccc, phase: 1 }),
      slider([-6, 1, -24], [-6, 1, -36], { speed: 1.4, r: 0.55, color: 0xcccccc, phase: 2 }), slider([-2, 1, -36], [-2, 1, -24], { speed: 2.1, r: 0.55, color: 0xcccccc, phase: 3 })],
    objectives: [{ flag: 'trial1', text: 'Tribal trial: temple traps' }, { flag: 'trial2', text: 'Tribal trial: the wall of masks' }, { flag: 'trial3', text: 'Tribal trial: spear field' },
      { flag: 'boar', text: 'Ride the boar to distract the tribe' }, { flag: 'wolfFree', text: 'Free the Wolf before the volcano erupts' }],
    countdown: { start: 'boar', end: 'wolfFree', seconds: 80, label: 'Volcano erupts in', begin: 'The tribe is distracted: untie the Wolf, quick, the volcano is rumbling!', fail: 'The volcano rumbled! Back to the checkpoint. Hurry!' },
    intro: 'The tribe thinks you are their king! Pass the three trials, then rescue your rival from the cooking pot.',
    things: [
      { type: 'lever', p: [34, 4, 10], flag: 'trial1', text: 'Trial 1: temple relic' },
      { type: 'lever', p: [-22, 8, 2], flag: 'trial2', text: 'Trial 2: mask relic' },
      { type: 'lever', p: [-8, 0, -37], flag: 'trial3', text: 'Trial 3: spear relic' },
      { type: 'mini', p: [0, 0, 20], label: 'Boar Ride', flag: 'boar', needs: ['trial1', 'trial2', 'trial3'], lockText: 'Pass the three tribal trials first!', spec: { make: (c) => new Runner(c, boarRide()), title: 'The Wild Boar Ride', intro: 'Ride a wild boar through the jungle so the whole tribe chases you instead of guarding the pot!', controls: RUN_CONTROLS } },
      { type: 'rescue', p: [0, 0, 3.4], flag: 'wolfFree', needs: ['boar'], lockText: 'The tribe is still guarding the pot! Distract them first.', label: 'Hold E: untie the Wolf', wolfTo: [0, 0.1, 5] },
      { type: 'gear', p: [0, 0, -27], needs: ['wolfFree'] },
      { type: 'sign', p: [-8, 0, -18], text: 'Wolf: smash the crates (E)!', w: 5 },
    ],
    carrots: [[-34, 0.5, 34], [34, 0.5, 34], [-34, 0.5, 0], [34, 0.5, -10], [16, 2, 10], [22, 3, 10], [34, 5, 10], [-22, 8.6, 2], [-8, 0.5, -30], [0, 0.5, -32], [14, 0.5, -30],
      [-30, 0.5, -34], [30, 0.5, -34], [20, 0.5, 24], [-20, 0.5, 24], [0, 0.5, 10], [-16, 0.5, -10]],
    build(scene) {
      const water = box(400, 1, 400, mat(0x2a9fd8, 0x0a3a55, { transparent: true, opacity: 0.85 })); water.position.set(0, -3, 0); water.castShadow = false; scene.add(water);
      for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, r = 46; const t = makePalm(); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); t.rotation.y = i * 1.7; t.scale.setScalar(1.1); scene.add(t); }
      const pot = cyl(2.4, 2.0, 2.2, 0x2a2a2a, 20); pot.position.set(0, 1.1, 0); scene.add(pot); const wt = cyl(2.2, 2.2, 0.1, mat(0x8ed0ff, 0x224466), 20); wt.position.set(0, 2.15, 0); scene.add(wt);
      const fire = cone(2, 1.4, mat(0xff7a1a, 0xaa3300), 8); fire.position.set(0, 0.5, 0); scene.add(fire);
      const vol = cone(18, 22, 0x4a3a32, 12); vol.position.set(0, 11, -60); scene.add(vol); const lava = cone(5, 4, mat(0xff4a1a, 0xff3300), 12); lava.position.set(0, 21, -60); scene.add(lava);
      for (let i = 0; i < 5; i++) { const h = cone(2.6, 3.4, 0x8a5a2a, 6); h.position.set(-30 + i * 14, 1.7, -44); scene.add(h); }
      zone(scene, 'TEMPLE TRAPS', 28, 7, 10, 6); zone(scene, 'WALL OF MASKS', -24, 11, 2, 7); zone(scene, 'SPEAR FIELD', -8, 5, -30, 6); zone(scene, 'TEMPLE', 0, 8, -20, 5);
    },
  });
}

/* ===================================================================
   WORLD 5 – Midnight Museum & Circus
   =================================================================== */
export function museum(ctx) {
  const plat = [
    GROUND(0, 0, 90, 70, 0x6a5a6a),
    // museum hall (south-west) with heavy-plate door
    WALL(-27, 0, 26, 1.2, 5, 0xc9b79c), WALL(-27, 24, 26, 1.2, 5, 0xc9b79c), WALL(-40, 12, 1.2, 24, 5, 0xc9b79c),
    WALL(-14, 4.2, 1.2, 7.2, 5, 0xc9b79c), WALL(-14, 20.4, 1.2, 7.2, 5, 0xc9b79c), GATE(['plateM'], -14, 12.3, 1.2, 9, 5, 0x8a3b2b),
    // tightrope tower and ropes (east)
    P(4, 1.7, -12, 3, 3, { h: 1.7, color: 0xc9a24a }), P(8, 3.4, -12, 3, 3, { h: 1.7, color: 0xc9a24a }), P(12, 5.1, -12, 3, 3, { h: 1.7, color: 0xc9a24a }),
    P(19, 5.1, -12, 10, 1.2, { h: 0.3, color: 0xf0e6c8 }), P(29, 5.1, -12, 10, 1.2, { h: 0.3, color: 0xf0e6c8 }), P(37, 5.1, -12, 4, 4, { h: 0.5, color: 0xd9363e, cp: true }),
    // circus cannon and big-top platform
    P(-28, 1, -14, 3, 3, { h: 1, color: 0x333333, launch: [0, 22, -21] }), P(-28, 7, -31, 8, 8, { h: 0.5, color: 0xd9363e, cp: true }),
  ];
  return new Hub(ctx, {
    id: 'museum', sky: 0x241830, fog: 0x241830, light: { sky: 0xd0b0ff, ground: 0x3a2a3a, sun: 0xffe0c0, intensity: 0.8 }, spawn: [0, 0.1, 30], wolfSpawn: [2, 0.1, 31], armor: true, killY: -20,
    platforms: plat,
    hazards: [slider([14, 0.9, -12], [34, 0.9, -12], { speed: 1.3, r: 1.1, color: 0xd9a24a }), slider([34, 0.9, -12], [14, 0.9, -12], { speed: 1.7, r: 1.1, color: 0xd9a24a, phase: 1.5 }), slider([20, 0.9, -12], [30, 0.9, -12], { speed: 2.2, r: 1.1, color: 0xd9a24a, phase: 3 })],
    objectives: [{ flag: 'egypt', text: 'Egyptian hall: reach the sarcophagus lever' }, { flag: 'rope', text: 'Tightrope over the lions' }, { flag: 'cannon', text: 'Fire yourself out of the circus cannon' }],
    intro: 'The Wolf is stuck in cursed armor: LOUD and slow! Guards hear him from afar. Use the Hare to sneak, the Wolf to hold plates. Hide in sarcophagi (E).',
    things: [
      { type: 'plate', p: [-9, 0, 28], r: 1.7, heavy: true, flag: 'plateM' },
      { type: 'guard', path: [[-38, 20], [-16, 20]], view: 10, fov: 70, speed: 2.8 }, { type: 'guard', path: [[-16, 4], [-38, 4]], view: 10, fov: 70, speed: 2.6 }, { type: 'guard', path: [[-26, 6], [-26, 18]], view: 8, fov: 80, speed: 2.2 },
      { type: 'hide', p: [-20, 0, 12] }, { type: 'hide', p: [-30, 0, 11] }, { type: 'hide', p: [-23, 0, 2.5] }, { type: 'hide', p: [-34, 0, 21.5] },
      { type: 'lever', p: [-38, 0, 12], flag: 'egypt', text: 'Pharaoh\'s lever' },
      { type: 'lever', p: [37, 5.1, -12], flag: 'rope', text: 'Circus bell' },
      { type: 'sign', p: [6, 0, -4], text: 'Tightrope ahead, lions below!', w: 6 },
      { type: 'lever', p: [-30, 7, -28], flag: 'cannon', text: 'Big top bell' },
      { type: 'sign', p: [-28, 0, -8], text: 'Jump on the cannon!', w: 5 },
      { type: 'gear', p: [-26, 7, -32.5], needs: ['egypt', 'rope', 'cannon'] },
    ],
    carrots: [[-34, 0.5, 30], [34, 0.5, 30], [38, 0.5, 8], [0, 0.5, 14], [-22, 0.5, 20], [-36, 0.5, 6], [8, 3.5, -12], [19, 5.8, -12], [29, 5.8, -12], [-28, 7.6, -28],
      [-28, 0.5, -22], [0, 0.5, -26], [20, 0.5, -28], [34, 0.5, -26], [-6, 0.5, 20], [14, 0.5, 4]],
    build(scene) {
      for (let i = 0; i < 6; i++) { const p = cyl(0.8, 1, 8, 0xe9e2d2, 10); p.position.set(-37 + i * 4.4, 4, 33); scene.add(p); }
      for (let i = 0; i < 6; i++) { const f = box(2.4, 3, 0.2, [0xff7ab6, 0x7ad7ff, 0xffd36b][i % 3]); f.position.set(-39, 3.2, 3 + i * 3.4); scene.add(f); }
      const big = cone(26, 16, 0xd9363e, 12); big.position.set(-28, 22, -30); scene.add(big);
      for (let i = 0; i < 10; i++) { const pl = cyl(0.4, 0.4, 14, i % 2 ? 0xf5f1e6 : 0xd9363e, 6); pl.position.set(-28 + Math.cos(i * 0.63) * 24, 7, -30 + Math.sin(i * 0.63) * 24); scene.add(pl); }
      const bar = cyl(0.5, 0.5, 4, 0x333333, 10); bar.rotation.x = -1.0; bar.position.set(-28, 2.4, -15.5); scene.add(bar);
      for (let i = 0; i < 3; i++) { const l = makeLion(); l.position.set(18 + i * 8, 0, -8.2); l.rotation.y = Math.PI * (i % 2); scene.add(l); }
      zone(scene, 'EGYPTIAN HALL', -27, 7, 0, 7); zone(scene, 'LION TIGHTROPE', 24, 10, -12, 7); zone(scene, 'CIRCUS CANNON', -28, 5, -14, 7); zone(scene, 'BIG TOP', -28, 11, -31, 5);
    },
  });
}

/* ===================================================================
   WORLD 6 – The Dacha & the Robot Apocalypse
   =================================================================== */
export const MEGA = {
  boss: 'robot', bossName: 'Mega-Robot Hare', hp: 40, lives: 6, vehicle: true, infinite: true, bg: 0x3a1a2a, floor: 0x4a6a3a, rim: 0xe0a030, hemiSky: 0xffc0a0, shotColor: 0xff2a2a,
  ammo: { name: 'Carrots', special: 'Hive/Firework', color: 0xffa020, specialColor: 0xffd23f }, winMsg: 'The Mega-Robot Hare collapses into scrap!',
  intro: 'Wolf drives the combine harvester, Hare fires the Carrot Slingshot! Space: carrots (infinite)  •  E: beehives & fireworks (grab the glowing pickups)',
  phases: [
    { at: 1, msg: 'Phase 1: the Robot Hare awakens!', attacks: [{ type: 'shots', every: 2.3, n: 3 }] },
    { at: 0.66, msg: 'Phase 2: laser rain!', attacks: [{ type: 'shots', every: 2.1, n: 3 }, { type: 'rain', every: 3.8, n: 5 }] },
    { at: 0.33, msg: 'Phase 3: overload!', attacks: [{ type: 'shots', every: 1.7, n: 5 }, { type: 'ring', every: 5, n: 16 }, { type: 'slam', every: 3.2 }] },
  ],
};

export function dacha(ctx) {
  const plat = [
    GROUND(0, 16, 80, 38, 0x5aa04a),
    P(0, 0, -31, 24, 18, { h: 1, color: 0x5aa04a }),
    // shed with crate door (Wolf smashes)
    WALL(-26, -3.6, 10, 1.2, 4, 0xc98f6b), WALL(-26, 3.6, 10, 1.2, 4, 0xc98f6b), WALL(-31.2, 0, 1.2, 8, 4, 0xc98f6b), CRATE(-21.6, -1.5, 2.4, 5.5), CRATE(-21.6, 1.5, 2.4, 5.5),
    // barn wall-jump tower (Hare)
    WALL(26, 8, 0.8, 6, 8, 0xa0462f), WALL(30, 8, 0.8, 6, 8, 0xa0462f), P(32, 8, 8, 5, 6, { h: 0.4, color: 0xffd23f, cp: true }),
  ];
  return new Hub(ctx, {
    id: 'dacha', sky: 0xff9a5a, fog: 0xc07a6a, light: { sky: 0xffc88a, ground: 0x665544, sun: 0xff8a3a, intensity: 1.1 }, spawn: [0, 0.1, 30], wolfSpawn: [2, 0.1, 31], killY: -20,
    platforms: plat, hazards: [],
    objectives: [{ flag: 'hive', text: 'Take the beehives (Wolf smashes the shed)' }, { flag: 'fire', text: 'Take the fireworks (Hare climbs the barn)' }, { flag: 'keys', text: 'Take the harvester keys (Wolf grapples across)' }, { flag: 'final', text: 'Defeat the Mega-Robot Hare' }],
    intro: 'Robot Hares are everywhere! Gather the harvester, beehives and fireworks, working together as rivals.',
    things: [
      { type: 'guard', model: 'robot', kind: 'robot', path: [[-14, 24], [14, 24]], view: 10, fov: 70, speed: 2.6 }, { type: 'guard', model: 'robot', kind: 'robot', path: [[14, 14], [-14, 14]], view: 10, fov: 70, speed: 2.4 },
      { type: 'guard', model: 'robot', kind: 'robot', path: [[0, 4], [20, 4], [20, 18], [0, 18]], view: 9, fov: 80, speed: 2.8 },
      { type: 'lever', p: [-27, 0, 0], flag: 'hive', text: 'Beehives' },
      { type: 'lever', p: [32, 8, 8], flag: 'fire', text: 'Fireworks' },
      { type: 'anchor', p: [0, 7, -10] }, { type: 'anchor', p: [0, 7, -18] },
      { type: 'lever', p: [0, 0, -33], flag: 'keys', text: 'Harvester keys' },
      { type: 'sign', p: [-8, 0, -2], text: 'Wolf: F to grapple across the pond!', w: 6 },
      { type: 'mini', p: [0, 0, 10], label: 'Mega-Robot Hare', flag: 'final', needs: ['hive', 'fire', 'keys'], lockText: 'Gather the beehives, fireworks and harvester keys first!', spec: { make: (c) => new Duel(c, MEGA), title: 'The Mega-Robot Hare', intro: 'A 50-foot Robot Hare with a soldering iron. Drive the combine harvester and blast it with carrots, beehives and fireworks!', controls: 'WASD: drive  •  Space: carrots  •  E: beehives/fireworks (pick up glowing orbs)' } },
      { type: 'gear', p: [0, 0, 18], needs: ['final'] },
    ],
    carrots: [[-34, 0.5, 34], [34, 0.5, 34], [-34, 0.5, 12], [34, 0.5, 12], [-27, 0.5, 2], [-27, 0.5, -2], [32, 8.6, 8], [0, 0.5, -31], [-8, 0.5, -34], [8, 0.5, -34],
      [20, 0.5, 26], [-20, 0.5, 26], [10, 0.5, 20], [-10, 0.5, 8], [30, 0.5, -2], [-30, 0.5, -10]],
    build(scene) {
      const pond = cyl(14, 14, 0.4, mat(0x4aa0e0, 0x0a3a55, { transparent: true, opacity: 0.8 }), 28); pond.position.set(0, -2.6, -12); pond.castShadow = false; scene.add(pond);
      const house = makeBuilding(10, 6, 8, 0xc98f6b); house.position.set(-22, 0, 28); scene.add(house); const roof = cone(8, 3.5, 0x8a3b2b, 4); roof.rotation.y = Math.PI / 4; roof.position.set(-22, 7.7, 28); scene.add(roof);
      for (let i = -8; i <= 8; i++) { const p = box(0.3, 1.8, 0.2, 0xe8dcc0); p.position.set(i * 4.5, 0.9, 36); scene.add(p); }
      for (let i = 0; i < 10; i++) { const f = sph(0.4, [0xff5f8a, 0xffd23f, 0xffffff][i % 3], 6); f.position.set(-28 + i * 6, 0.3, 21); scene.add(f); }
      const well = cyl(1.4, 1.4, 1.6, 0x8c8c94, 14); well.position.set(24, 0.8, 24); scene.add(well);
      for (let i = 0; i < 4; i++) { const hv = box(1.1, 1.4, 1.1, 0xe8b830); hv.position.set(-27 + (i % 2) * 2, 0.7, -2 + Math.floor(i / 2) * 2); scene.add(hv); }
      const rift = mesh(new THREE.TorusGeometry(16, 1.2, 8, 40), mat(0x331122, 0xaa1133)); rift.position.set(0, 36, -50); scene.add(rift);
      const harv = makeHarvester(); harv.position.set(14, 0, 30); harv.rotation.y = 0.5; scene.add(harv);
      zone(scene, 'SHED', -26, 7, 0, 4); zone(scene, 'BARN', 28, 11, 8, 4); zone(scene, 'POND', 0, 9, -12, 4); zone(scene, 'ROBOT INVASION!', 0, 12, 6, 8);
    },
  });
}
