import {
  THREE, wasHit, box, cyl, sph, cone, mat, mesh, makeHare, makeWolf, makeRobotHare, animateLimbs, lerp,
} from './common.js';
import { makeGear } from './hub.js';
import { makeHarvester, makePalm } from './props.js';
import { sfx } from './audio.js';
import { ui } from './ui.js';

const ease = (u) => u * u * (3 - 2 * u);
const V = (a) => new THREE.Vector3(...a);

/** Tiny timeline-driven cinematic player. */
export class Cutscene {
  constructor(ctx, data) {
    this.ctx = ctx; this.data = data;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(data.sky ?? 0x101428);
    if (data.fog) scene.fog = new THREE.Fog(data.sky, 30, 120);
    scene.add(new THREE.HemisphereLight(data.hemiSky ?? 0xffffff, data.hemiGround ?? 0x556677, data.hemi ?? 1.0));
    const sun = new THREE.DirectionalLight(data.sun ?? 0xfff0d0, data.sunI ?? 1.0); sun.position.set(8, 16, 10); sun.castShadow = true;
    sun.shadow.camera.left = -25; sun.shadow.camera.right = 25; sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25; sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    this.api = { scene, update: [], gears: [] };
    data.build(scene, this.api);
    this.actors = {};
    for (const [name, d] of Object.entries(data.actors ?? {})) {
      const m = d.make(); m.position.set(...d.p); m.rotation.y = d.ry ?? 0; m.visible = d.visible !== false; scene.add(m);
      this.actors[name] = { m, anim: 'idle', from: m.position.clone(), to: null, arc: 0, ry0: m.rotation.y, ryTo: null, phase: Math.random() * 6 };
    }
    this.t = 0; this.i = -1; this.shotT = 0; this.flash = 0; this.shake = 0; this.done = false;
    this.nextShot();
    ui.letterbox(true); ui.hud(true);
  }

  nextShot() {
    this.i++;
    const sh = this.data.shots[this.i];
    if (!sh) { this.finish(); return; }
    this.shotT = 0;
    if (sh.set) for (const [n, s] of Object.entries(sh.set)) {
      const a = this.actors[n]; if (!a) continue;
      if (s.p) { a.m.position.set(...s.p); }
      if (s.visible !== undefined) a.m.visible = s.visible;
      if (s.ry !== undefined) a.m.rotation.y = s.ry;
      if (s.scale !== undefined) a.m.scale.setScalar(s.scale);
      if (s.rot) a.m.rotation.set(...s.rot);
    }
    for (const a of Object.values(this.actors)) { a.from = a.m.position.clone(); a.to = null; a.arc = 0; a.ry0 = a.m.rotation.y; a.ryTo = null; }
    for (const [n, mv] of Object.entries(sh.moves ?? {})) {
      const a = this.actors[n]; if (!a) continue;
      if (mv.to) a.to = V(mv.to);
      if (mv.ry !== undefined) a.ryTo = mv.ry;
      a.arc = mv.arc ?? 0; if (mv.anim) a.anim = mv.anim;
    }
    ui.caption(sh.text ?? '', sh.style ?? '');
    if (sh.fx === 'flash') { this.flash = 1; sfx.boom(); }
    if (sh.fx === 'shake') this.shake = sh.d ?? 1;
    if (sh.sfx && sfx[sh.sfx]) sfx[sh.sfx]();
    if (sh.api) sh.api(this.api);
  }

  update(dt) {
    if (this.done) return;
    dt = Math.min(dt, 0.05);
    if (wasHit('Enter', 'Space', 'Escape')) { this.finish(); return; }
    this.t += dt; this.shotT += dt;
    const sh = this.data.shots[this.i]; if (!sh) return;
    const u = Math.min(1, this.shotT / sh.d), e = ease(u);

    for (const a of Object.values(this.actors)) {
      if (a.to) {
        a.m.position.lerpVectors(a.from, a.to, e); a.m.position.y += a.arc * Math.sin(Math.PI * u);
        const dx = a.to.x - a.from.x, dz = a.to.z - a.from.z;
        if (a.ryTo === null && Math.hypot(dx, dz) > 0.5 && a.anim !== 'fly') a.m.rotation.y = Math.atan2(dx, dz);
      }
      if (a.ryTo !== null) a.m.rotation.y = lerp(a.ry0, a.ryTo, e);
      a.phase += dt * 12;
      this.pose(a, dt);
    }
    for (const f of this.api.update) f(this.t, dt);

    // camera
    const c = sh.cam, cam = this.ctx.camera;
    const from = V(c.from), to = V(c.to ?? c.from);
    cam.position.lerpVectors(from, to, u);
    const lf = V(c.look), lt = V(c.lookTo ?? c.look);
    const look = new THREE.Vector3().lerpVectors(lf, lt, u);
    if (this.shake > 0) { this.shake -= dt; cam.position.x += (Math.random() - 0.5) * 0.5; cam.position.y += (Math.random() - 0.5) * 0.5; }
    cam.up.set(0, 1, 0); cam.lookAt(look);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 1.6); this.scene.background = new THREE.Color().setRGB(0.1 + this.flash * 0.9, 0.1 + this.flash * 0.9, 0.16 + this.flash * 0.84); }

    if (this.shotT >= sh.d) this.nextShot();
  }

  pose(a, dt) {
    const m = a.m, u = m.userData; const moving = a.to && a.to.distanceTo(a.from) > 0.3;
    switch (a.anim) {
      case 'run': animateLimbs(m, a.phase, 0.9); break;
      case 'sneak': animateLimbs(m, a.phase * 0.5, 0.6); break;
      case 'panic': if (u.armL) { u.armL.rotation.x = -2.6 + Math.sin(a.phase * 2) * 0.5; u.armR.rotation.x = -2.6 + Math.cos(a.phase * 2) * 0.5; u.legL.rotation.x = Math.sin(a.phase * 2) * 0.8; u.legR.rotation.x = -Math.sin(a.phase * 2) * 0.8; } break;
      case 'cheer': if (u.armL) { u.armL.rotation.x = -2.7; u.armR.rotation.x = -2.7 + Math.sin(a.phase) * 0.4; u.legL.rotation.x = 0; u.legR.rotation.x = 0; } m.position.y += Math.abs(Math.sin(a.phase * 0.5)) * 0.25; break;
      case 'fist': if (u.armL) { u.armL.rotation.x = 0; u.armR.rotation.x = -2.4 + Math.sin(a.phase * 2) * 0.5; } break;
      case 'fly': m.rotation.x += dt * 6; m.rotation.z += dt * 4; if (u.armL) animateLimbs(m, 0, 0, true); break;
      case 'spin': m.rotation.y += dt * 8; break;
      case 'bob': m.position.y += Math.sin(a.phase * 0.3) * 0.02; break;
      case 'march': animateLimbs(m, a.phase * 0.7, 0.7); break;
      case 'idle': default: if (u.legL) animateLimbs(m, 0, 0.03);
    }
  }

  finish() {
    if (this.done) return; this.done = true; ui.caption(null); ui.letterbox(false); this.ctx.win();
  }
  dispose() { ui.caption(null); ui.letterbox(false); }
}

/* ============ set builders ============ */
function floor(scene, color, size = 120) { const f = box(size, 1, size, color); f.position.y = -0.5; scene.add(f); return f; }

function labSet(scene, api) {
  floor(scene, 0x3a4252);
  const wall = box(40, 14, 1, 0x56607a); wall.position.set(0, 7, -9); scene.add(wall);
  for (const [x, z] of [[-9, -2], [9, -2], [-9, 5], [9, 5]]) {
    const t = box(5, 1, 2.2, 0x8a6d4b); t.position.set(x, 0.5, z); scene.add(t);
    const m = box(1.3, 0.9, 1, mat(0x2a6fe0, 0x1a3a88)); m.position.set(x - 1, 1.4, z); scene.add(m);
    const r = cone(0.4, 1.6, 0xe23a3a, 8); r.position.set(x + 1.3, 1.8, z); scene.add(r);
  }
  const desk = box(3, 1, 1.6, 0x8a6d4b); desk.position.set(3, 0.5, -1); scene.add(desk);
  const launcher = new THREE.Group(); launcher.add(box(0.5, 0.4, 1.2, 0x2a2a2a)); const barrel = cyl(0.12, 0.12, 0.9, 0x666666, 8); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.8; launcher.add(barrel);
  launcher.position.set(3, 1.3, -1); scene.add(launcher);
  const ring = mesh(new THREE.TorusGeometry(2.6, 0.3, 10, 32), mat(0x3a8aff, 0x1a4acc)); ring.position.set(0, 3, -6); scene.add(ring);
  const disc = cyl(2.4, 2.4, 0.1, mat(0x66aaff, 0x2255cc, { transparent: true, opacity: 0.5 }), 24); disc.rotation.x = Math.PI / 2; disc.position.set(0, 3, -6); scene.add(disc);
  const lever = box(0.3, 1.4, 0.3, mat(0xff2a2a, 0x880000)); lever.position.set(-3.5, 1.5, -5); scene.add(lever);
  const console_ = box(2.4, 1.2, 1.2, 0x444a5a); console_.position.set(-3.5, 0.6, -5); scene.add(console_);
  const gears = [];
  for (let i = 0; i < 6; i++) { const g = makeGear(); g.scale.setScalar(0.5); g.position.set(Math.cos(i * 1.05) * 1.2, 3 + Math.sin(i * 1.05) * 1.2, -6); scene.add(g); gears.push(g); }
  api.gears = gears; api.ring = ring; api.disc = disc;
  const spot = new THREE.PointLight(0xaaccff, 40, 30); spot.position.set(0, 9, 4); scene.add(spot);
  api.update.push((t) => {
    gears.forEach((g, i) => { if (!g.userData.fly) { g.rotation.z += 0.02; } else { g.position.addScaledVector(g.userData.v, 0.016 * 6); g.rotation.z += 0.2; } });
    spot.position.x = Math.sin(t * 0.8) * 12; ring.rotation.z = t * 0.5;
  });
}

function islandSet(scene, api) {
  floor(scene, 0xf0dca0, 140);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, r = 16 + (i % 3) * 3;
    const t = makePalm(); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 4); t.rotation.y = i * 1.3; t.scale.setScalar(0.9 + (i % 3) * 0.12); scene.add(t);
  }
  const pot = cyl(2.2, 1.8, 2.2, 0x2a2a2a, 20); pot.position.set(0, 1.1, 0); scene.add(pot);
  const water = cyl(2.0, 2.0, 0.1, mat(0x8ed0ff, 0x224466), 20); water.position.set(0, 2.15, 0); scene.add(water);
  const fire = cone(1.8, 1.8, mat(0xff7a1a, 0xaa3300), 8); fire.position.set(0, 0.3, 0); scene.add(fire);
  const balloon = sph(5, 0xd9363e, 12); balloon.scale.set(1, 1.2, 1); balloon.position.set(-14, 12, -14); scene.add(balloon);
  const basket = box(2, 1.4, 2, 0x8a5a2a); basket.position.set(-14, 4, -14); scene.add(basket);
  api.update.push((t) => { fire.scale.y = 1 + Math.sin(t * 14) * 0.15; });
}

function dachaSet(scene, api, evening) {
  floor(scene, 0x5aa04a, 140);
  const house = box(9, 5, 7, 0xc98f6b); house.position.set(-12, 2.5, -10); scene.add(house);
  const roof = cone(7, 3, 0x8a3b2b, 4); roof.rotation.y = Math.PI / 4; roof.position.set(-12, 6.5, -10); scene.add(roof);
  for (let i = -3; i <= 3; i++) { const p = box(0.3, 1.8, 0.2, 0xe8dcc0); p.position.set(i * 2.2, 0.9, 12); scene.add(p); }
  const well = cyl(1.4, 1.4, 1.6, 0x8c8c94, 14); well.position.set(7, 0.8, -4); scene.add(well);
  const wwater = cyl(1.2, 1.2, 0.1, mat(0x5fb0ff, 0x113355), 14); wwater.position.set(7, 1.3, -4); scene.add(wwater); api.wwater = wwater;
  for (const s of [-1, 1]) { const post = box(0.2, 2.6, 0.2, 0x5b3d22); post.position.set(7 + s * 1.5, 2.2, -4); scene.add(post); }
  const wroof = cone(2.2, 1, 0xb05a2a, 4); wroof.rotation.y = Math.PI / 4; wroof.position.set(7, 3.8, -4); scene.add(wroof);
  const hive = box(1.1, 1.4, 1.1, 0xe8b830); hive.position.set(-3, 0.7, 3); scene.add(hive); api.hive = hive;
  for (let i = 0; i < 10; i++) { const f = sph(0.35, [0xff5f8a, 0xffd23f, 0xffffff][i % 3], 6); f.position.set(-4 + i * 1.4, 0.3, 7); scene.add(f); }
  for (let i = 0; i < 6; i++) { const t = new THREE.Group(); const tr = cyl(0.3, 0.4, 2, 0x5b3d22, 6); tr.position.y = 1; const c = sph(1.8, 0x2f8a3a, 8); c.position.y = 3.2; t.add(tr, c); t.position.set(-22 + i * 9, 0, -22); scene.add(t); }
  if (evening) scene.fog = new THREE.Fog(0x6a3a5a, 40, 140);
}

function actorsHareWolf(hp, wp) {
  return { hare: { make: () => makeHare(), p: hp, ry: 0 }, wolf: { make: () => makeWolf(), p: wp, ry: 0 } };
}

/* ============ the four cutscenes ============ */
export const CUTSCENES = {
  opening: {
    sky: 0x0e1224, hemi: 0.55, build: labSet,
    actors: {
      ...actorsHareWolf([-1, 0, 30], [5, 14, 6]),
    },
    shots: [
      { d: 4, cam: { from: [-12, 6, 14], to: [-2, 4.5, 11], look: [0, 2, -2] }, text: 'The House of Young Technicians. Midnight. A spotlight sweeps across the dark lab, where a glowing Quantum Teleportation Portal spins six Golden Gears.' },
      { d: 3, cam: { from: [8, 5, 12], to: [7, 3, 9], look: [5, 1.5, 3] }, text: 'A vent bursts open. THE WOLF drops in and lands on his face. THUD!', set: { wolf: { p: [5, 9, 3], visible: true } }, moves: { wolf: { to: [5, 0, 3], anim: 'panic' } }, sfx: 'hit' },
      { d: 3.5, cam: { from: [8, 3, 6], to: [6, 2.5, 3], look: [3, 1.3, 0] }, text: 'He spots the Laser Net Launcher on the desk, and rubs his paws together.', moves: { wolf: { to: [3.5, 0, 0.8], anim: 'sneak' } } },
      { d: 3.5, cam: { from: [-4, 3, 18], to: [-2, 2.6, 10], look: [-1, 1.4, 6] }, text: 'Meanwhile the Hare strolls down the corridor, humming a cheerful tune and carrying a model airplane.', set: { hare: { p: [-1, 0, 20] } }, moves: { hare: { to: [-1, 0, 8], anim: 'run' } } },
      { d: 3.5, cam: { from: [2, 2.2, 5], to: [1, 2, 4], look: [1.5, 1.5, 3] }, text: 'WOLF: "Aha! Zayats!"', moves: { wolf: { to: [3, 0, 0.8], ry: 0.6, anim: 'panic' }, hare: { to: [-1, 0, 6], anim: 'idle' } } },
      { d: 3.5, cam: { from: [6, 3, 5], to: [5, 3, 4], look: [3, 1.4, 0] }, text: 'He fires! The gun shoots a suction cup on a spring… which bounces off a pipe and smacks the Wolf between the eyes.', moves: { wolf: { to: [0, 0, -3.5], anim: 'panic', arc: 1.2 } }, sfx: 'hit' },
      { d: 3, cam: { from: [-1, 3, 3], to: [-2, 3, 1], look: [-3, 1.5, -5] }, text: 'Dazed, he trips over the cables, and grabs the Main Red Lever!', moves: { wolf: { to: [-3.5, 0, -3.5], anim: 'panic' } }, fx: 'shake' },
      { d: 3, cam: { from: [-3, 2, 6], to: [-2, 2.4, 4], look: [-1, 1.5, 6] }, text: 'HARE: "No, no, no! Stop!"', moves: { hare: { to: [-1, 0, 5], anim: 'panic' } } },
      { d: 4.5, cam: { from: [0, 5, 11], to: [0, 4, 8], look: [0, 3, -4] }, text: 'BOOM! A rainbow shockwave! The Golden Gears shoot out like fireworks into swirling time-rifts, lifting the rivals into the vortex.', fx: 'flash', moves: { wolf: { to: [0, 6, -8], anim: 'fly' }, hare: { to: [0, 5, -8], anim: 'fly' } } },
      { d: 3, cam: { from: [0, 3, 12], look: [0, 3, 0] }, text: 'Nu, Pogodi! 2', style: 'title', set: { wolf: { visible: false }, hare: { visible: false } } },
      { d: 3, cam: { from: [0, 3, 12], look: [0, 3, 0] }, text: 'World Tour & Time Chaos', style: 'title' },
    ],
  },

  island: {
    sky: 0x8fd8ff, hemi: 1.0, build: islandSet,
    actors: {
      ...actorsHareWolf([14, 0, 22], [0, 2.1, 0]),
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
        const a = i / 8 * Math.PI * 2;
        return [`s${i}`, { make: () => makeHare({ fur: 0x9a7a55, white: 0xe8d9b8, shirt: 0x3a8a3a, pants: 0x7a5a30 }), p: [Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5], ry: a + Math.PI }];
      })),
    },
    shots: [
      { d: 4, cam: { from: [-6, 9, 14], to: [-2, 6, 10], look: [-10, 8, -8] }, text: 'A tattered hot-air balloon hangs limp in the palm trees. Below, a tribe of Savage Hares dances around a boiling iron cauldron.', moves: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`s${i}`, { anim: 'cheer' }])) },
      { d: 3.5, cam: { from: [0, 4, 9], to: [0, 3.4, 6.5], look: [0, 2.6, 0] }, text: 'Inside the pot, up to his chin in warm water, sits the Wolf, wearing a crown of carrots and onions. He looks miserable.', moves: { wolf: { anim: 'idle' } } },
      { d: 4, cam: { from: [16, 3, 16], to: [10, 2.5, 12], look: [4, 1.4, 3] }, text: 'The bushes rustle. The Hare steps out, brushing leaves off his ears. The Savage Hares gasp, and kneel: their king has returned!', moves: { hare: { to: [8, 0, 8], anim: 'run' }, ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`s${i}`, { anim: 'panic' }])) } },
      { d: 3.5, cam: { from: [-5, 3, 7], to: [-3, 3.2, 6], look: [0, 2.6, 0] }, text: 'The Wolf points at himself, makes puppy-dog eyes, and pantomimes swimming away.', moves: { wolf: { anim: 'panic' }, hare: { anim: 'idle' } } },
      { d: 3.5, cam: { from: [9, 2.4, 11], to: [8, 2.2, 10], look: [8, 1.4, 8] }, text: 'The Hare crosses his arms, taps his foot, and points an accusing finger: the broken machine, remember?', moves: { hare: { to: [6, 0, 5], ry: 2.4, anim: 'fist' } } },
      { d: 3.5, cam: { from: [-2, 3.4, 6], to: [-1, 3.2, 5], look: [0, 2.6, 0] }, text: 'The Wolf sighs, slumps, and holds up a small Golden Gear he fished out of the water.', moves: { wolf: { anim: 'cheer' } } },
      { d: 4, cam: { from: [10, 3, 12], to: [7, 2.4, 8], look: [5, 1.4, 3] }, text: 'The Hare smiles, nods, and turns to the chief, clearing his throat to negotiate a royal pardon…', moves: { hare: { to: [4.5, 0, 3], anim: 'run' } } },
    ],
  },

  invasion: {
    sky: 0xff9a5a, hemi: 0.9, hemiSky: 0xffc88a, hemiGround: 0x665544, sun: 0xff8a3a, sunI: 1.2, fog: true,
    build(scene, api) {
      dachaSet(scene, api, false);
      const rift = mesh(new THREE.TorusGeometry(14, 1.2, 8, 40), mat(0x331122, 0xaa1133)); rift.position.set(0, 30, -34); scene.add(rift); api.rift = rift;
      for (let i = 0; i < 40; i++) { const e = sph(0.35, mat(0xff2a2a, 0xff0000), 6); const a = Math.random() * Math.PI * 2, r = Math.random() * 12; e.position.set(Math.cos(a) * r, 30 + Math.sin(a) * r, -34); scene.add(e); }
      const barn = box(7, 4, 6, 0x8a3b2b); barn.position.set(14, 2, -6); scene.add(barn);
      const harv = makeHarvester(); harv.position.set(14, 0, -1); harv.visible = false; scene.add(harv); api.harv = harv; const reel = harv.userData.reel;
      api.update.push((t, dt) => { rift.rotation.z = t * 0.2; reel.rotation.x = t * 5; if (harv.userData.go) { harv.position.z -= 6 * dt; harv.position.x -= 2.2 * dt; harv.rotation.y = 0.3; } });
    },
    actors: {
      ...actorsHareWolf([-2, 0, 8], [2, 0, 8]),
      mega: { make: () => { const r = makeRobotHare(); r.scale.setScalar(9); const iron = cyl(0.1, 0.1, 5, 0xaaaaaa, 6); iron.position.set(-0.6, 1.4, 0.8); iron.rotation.z = 0.4; r.add(iron); return r; }, p: [0, 0, -40], ry: 0, visible: false },
      ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`r${i}`, { make: () => makeRobotHare(), p: [-14 + (i % 6) * 5.6, 0, -34 - Math.floor(i / 6) * 4], ry: 0, visible: false }])),
    },
    shots: [
      { d: 3.5, cam: { from: [0, 3, 16], to: [0, 3, 12], look: [0, 1.5, 6] }, text: 'With a final POP the rift spits them back into the peaceful dacha garden. Dusting themselves off, they hold up all six Golden Gears…', moves: { hare: { anim: 'cheer' }, wolf: { anim: 'cheer' } } },
      { d: 3.5, cam: { from: [0, 4, 14], to: [0, 7, 14], look: [0, 22, -34] }, text: '…and freeze. The sky is torn open by a mechanical rift. Hundreds of glowing red eyes peer down through the smoke.', moves: { hare: { anim: 'panic' }, wolf: { anim: 'panic' } }, fx: 'shake' },
      { d: 4.5, cam: { from: [-16, 3, -10], to: [-8, 4, -10], look: [0, 3, -34] }, text: 'STOMP, STOMP. An army of Robot Hares marches through the fences, crushing flowerbeds.', set: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`r${i}`, { visible: true }])), moves: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`r${i}`, { to: [-14 + (i % 6) * 5.6, 0, -14 - Math.floor(i / 6) * 4], anim: 'march' }])) },
      { d: 4, cam: { from: [0, 4, 6], to: [0, 6, 6], look: [0, 16, -26] }, text: 'Behind them towers a colossal Mega-Robot Hare with a giant soldering iron.', set: { mega: { visible: true } }, moves: { mega: { to: [0, 0, -26], anim: 'march' } }, fx: 'shake' },
      { d: 3.5, cam: { from: [1, 2.8, 8], to: [0, 2.6, 7], look: [0, 2, 8] }, text: 'The Wolf gulps, fur standing on end. He slowly turns to look at the Hare. The Hare looks back at the Wolf.', moves: { wolf: { anim: 'panic', ry: -0.4 }, hare: { anim: 'idle', ry: 0.4 } } },
      { d: 4, cam: { from: [6, 3, 6], to: [12, 3, 2], look: [14, 1.5, -4] }, text: 'Without a word, the Wolf pulls out the keys to a rusty Combine Harvester. The Hare grabs a double-barreled Carrot Slingshot.', moves: { wolf: { to: [12, 0, -1], anim: 'run' }, hare: { to: [12.5, 0, -2], anim: 'run' } } },
      { d: 4, cam: { from: [-2, 4, 14], to: [8, 3, 6], look: [14, 1.5, -2] }, text: 'Black smoke belches from the exhaust. The rivals nod sharply, and charge straight at the giant robot!', set: { wolf: { visible: false }, hare: { visible: false } }, api: (x) => { x.harv.visible = true; x.harv.userData.go = true; } },
    ],
  },

  ending: {
    sky: 0x6a3a5a, hemi: 0.8, hemiSky: 0xffb0a0, hemiGround: 0x443344, sun: 0xff9a7a, sunI: 0.9, fog: true,
    build(scene, api) {
      dachaSet(scene, api, true);
      const scrap = new THREE.Group();
      for (let i = 0; i < 14; i++) { const b = box(1 + Math.random() * 2, 0.8 + Math.random() * 2, 1 + Math.random() * 2, 0x8f9ba8); b.position.set((Math.random() - 0.5) * 8, 0.8, (Math.random() - 0.5) * 6); b.rotation.set(Math.random(), Math.random(), Math.random()); scrap.add(b); }
      scrap.position.set(-4, 0, -14); scene.add(scrap);
      const bee = sph(0.18, mat(0xffd23f, 0x886600), 8); bee.position.set(2, 2, 6); bee.visible = false; scene.add(bee); api.bee = bee;
      api.update.push((t) => { if (bee.visible) { bee.position.y += Math.sin(t * 30) * 0.02; } });
      const hose = mesh(new THREE.TorusGeometry(0.6, 0.12, 6, 14), mat(0x2f9e4a)); hose.rotation.x = Math.PI / 2; hose.position.set(-0.2, 0.12, 3); scene.add(hose);
    },
    actors: {
      ...actorsHareWolf([6.5, 0, -1.2], [-4, 0, 8]),
      bee: { make: () => { const g = new THREE.Group(); const b = sph(0.2, mat(0xffd23f, 0x886600), 8); g.add(b); for (const s of [-1, 1]) { const w = box(0.3, 0.02, 0.18, 0xffffff); w.position.set(s * 0.22, 0.18, 0); g.add(w); } return g; }, p: [5, 3.5, 6], ry: 0, visible: false },
    },
    shots: [
      { d: 4, cam: { from: [-6, 4, 6], to: [-2, 4, 4], look: [-4, 3, -14] }, text: 'The Mega-Robot Hare collapses into a heap of scrap as the portal in the sky seals shut. Silence returns… only crickets chirp.' },
      { d: 3.5, cam: { from: [-1, 2.4, 14], to: [1, 2.2, 10], look: [3, 1.4, 4] }, text: 'The Wolf wipes his brow, and spots the exhausted Hare leaning against the well.', moves: { wolf: { to: [-2, 0, 6], anim: 'idle' } } },
      { d: 3.5, cam: { from: [-6, 2.2, 8], to: [-3, 2, 7], look: [2, 1.4, 1] }, text: 'A mischievous smile spreads across his face. He cracks his knuckles and tiptoes forward.  WOLF: "Zayats…"', moves: { wolf: { to: [2, 0, 1], anim: 'sneak' } } },
      { d: 3, cam: { from: [4, 2.5, 6], to: [5, 2.2, 5], look: [6, 1.2, -1] }, text: 'The Hare yelps and runs, but his foot catches in a garden hose! The Wolf lunges with outstretched claws…', moves: { hare: { to: [6.2, 0, -0.4], anim: 'panic' }, wolf: { to: [4.5, 0, 0.6], anim: 'run' } } },
      { d: 3, cam: { from: [3, 2.2, 5], to: [4, 2, 3], look: [4.5, 1.8, 0.5] }, text: 'BZZZZZZ! A single angry bee from a knocked-over beehive zooms straight onto the tip of his nose. YOWWW!', set: { bee: { visible: true, p: [-1, 3.5, 5] } }, moves: { bee: { to: [4.6, 2.1, 0.7], anim: 'bob' }, wolf: { anim: 'panic' } }, sfx: 'hit' },
      { d: 3.5, cam: { from: [3, 5, 8], to: [6, 4, 5], look: [7, 2, -4] }, text: 'His nose swells like a bright red tomato. He leaps ten feet in the air, bounces off the roof of the well, and plunges straight down into the freezing water. SPLASH!', set: { bee: { visible: false } }, moves: { wolf: { to: [7, -1, -4], anim: 'fly', arc: 9 } }, fx: 'shake' },
      { d: 4, cam: { from: [4, 3, 3], to: [5, 2.6, 1], look: [6.6, 1.2, -2] }, text: 'The Hare frees his foot and bursts out laughing, waving cheerfully down into the well.', moves: { hare: { to: [6.6, 0, -1.2], anim: 'cheer', ry: 3.14 } }, set: { wolf: { visible: false } } },
      { d: 5, cam: { from: [5, 3, 6], to: [7, 2.6, 2], look: [7, 1.6, -4] }, text: 'From the depths of the well, the soaked, shivering Wolf pokes out his head, shakes a furious fist at the sky and delivers his timeless catchphrase:  "Nu, zayats… NU, POGODI!"', set: { wolf: { visible: true, p: [7, 0.6, -4], rot: [0, 0, 0] } }, moves: { wolf: { anim: 'fist', ry: 0.2 } } },
    ],
  },
};
