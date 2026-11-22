import {
  THREE, isDown, wasHit, box, cyl, sph, cone, mat, mesh, makeHare, makeWolf, animateLimbs, mulberry32, lerpAngle, damp, clamp,
} from './common.js';
import { makeLabel, makeCarrot } from './hub.js';
import { sfx } from './audio.js';
import { makeBear } from './props.js';
import { ui } from './ui.js';

function baseScene(bg, hemi = 1.1) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  s.add(new THREE.HemisphereLight(0xffffff, 0x665544, hemi));
  const d = new THREE.DirectionalLight(0xffffff, 0.9); d.position.set(6, 14, 10); d.castShadow = true;
  d.shadow.camera.left = -18; d.shadow.camera.right = 18; d.shadow.camera.top = 18; d.shadow.camera.bottom = -18; d.shadow.mapSize.set(1024, 1024); s.add(d);
  return s;
}

/* ================= Boxing boss: the Hare pulls the ropes ================= */
export class RopeBoss {
  constructor(ctx, cfg = {}) {
    this.ctx = ctx;
    const scene = this.scene = baseScene(0x2a1a3a, 1.0);
    const hall = box(60, 1, 40, 0x3a2a4a); hall.position.set(0, -0.5, -8); scene.add(hall);
    const ring = box(16, 0.6, 11, 0x2a58b8); ring.position.set(0, 0.3, -8); scene.add(ring);
    for (const [x, z] of [[-8, -13.5], [8, -13.5], [-8, -2.5], [8, -2.5]]) { const p = box(0.5, 3, 0.5, 0xd9363e); p.position.set(x, 2, z); scene.add(p); }
    for (let i = 0; i < 3; i++) { const r = box(16, 0.15, 0.15, 0xffffff); r.position.set(0, 1.3 + i * 0.9, -13.5); scene.add(r); }
    for (let i = 0; i < 30; i++) { const f = sph(0.4, [0xe23a3a, 0x3a7be2, 0xe2b13a][i % 3], 6); f.position.set(-28 + i * 2, 1.5 + (i % 2) * 0.6, -24); scene.add(f); }

    this.wolf = makeWolf({ scale: 1.1 }); this.wolf.position.set(-3.2, 0.6, -8); this.wolf.rotation.y = Math.PI / 2; scene.add(this.wolf);
    for (const a of [this.wolf.userData.armL, this.wolf.userData.armR]) { const g = sph(0.28, 0xd9363e, 8); g.position.y = -0.85; a.add(g); }
    this.bear = this.makeBear(); this.bear.position.set(3.4, 0.6, -8); this.bear.rotation.y = -Math.PI / 2; scene.add(this.bear);

    this.lanes = [-3.6, 0, 3.6]; this.keys = [['KeyA', 'ArrowLeft'], ['KeyS', 'ArrowDown'], ['KeyD', 'ArrowRight']];
    this.lanes.forEach((x, i) => {
      const rope = cyl(0.07, 0.07, 10, 0xd9b86a, 6); rope.position.set(x, 5.2, 8); scene.add(rope);
      const hit = mesh(new THREE.TorusGeometry(0.9, 0.08, 6, 20), mat(0xffffff, 0x888888)); hit.position.set(x, 1.5, 8); scene.add(hit);
      const l = makeLabel(['A / ←', 'S / ↓', 'D / →'][i], '#ffe9b0', 2.2); l.position.set(x, 0.2, 8.2); scene.add(l);
    });
    const rng = mulberry32(cfg.seed ?? 5);
    this.notes = []; let t = 2.0;
    for (let i = 0; i < (cfg.count ?? 22); i++) { this.notes.push({ t, lane: Math.floor(rng() * 3), done: false, m: null }); t += 1.15 - Math.min(0.35, i * 0.015); }
    this.bearHp = cfg.bearHp ?? 12; this.bearMax = this.bearHp; this.wolfHp = 5; this.clock = 0; this.over = false; this.punch = { w: 0, b: 0 }; this.flash = 0;
    this.fall = 1.3;
    this.hud();
    ui.toast('The Hare pulls the ropes! Hit A / S / D (or arrows) as each note reaches the ring so the Wolf lands punches.', 6000);
  }
  makeBear() { return makeBear(); }
  hud() { ui.info(`🐺 ${'❤️'.repeat(this.wolfHp)}${'🖤'.repeat(5 - this.wolfHp)}`); ui.bar('a', 'Bear', this.bearHp / this.bearMax); }
  update(dt) {
    dt = Math.min(dt, 0.05); if (this.over) return; this.clock += dt;
    const cam = this.ctx.camera; cam.position.set(0, 4.8, 18); cam.lookAt(0, 3, 0); cam.up.set(0, 1, 0);
    let left = 0;
    for (const n of this.notes) {
      if (n.done) continue; left++;
      const spawn = n.t - this.fall; if (this.clock < spawn) continue;
      if (!n.m) { n.m = sph(0.5, [0xff6a6a, 0x6ad0ff, 0xffe36a][n.lane], 10); n.m.castShadow = false; this.scene.add(n.m); }
      const u = (this.clock - spawn) / this.fall; n.m.position.set(this.lanes[n.lane], 10 - u * 8.5, 8);
      if (this.clock > n.t + 0.22) { n.done = true; this.scene.remove(n.m); this.wolfHit(); }
    }
    for (let l = 0; l < 3; l++) {
      if (!wasHit(...this.keys[l])) continue;
      const cand = this.notes.filter((n) => !n.done && n.m && n.lane === l && Math.abs(this.clock - n.t) < 0.3).sort((a, b) => Math.abs(this.clock - a.t) - Math.abs(this.clock - b.t))[0];
      if (cand) { cand.done = true; this.scene.remove(cand.m); this.bearHit(); }
    }
    this.punch.w = Math.max(0, this.punch.w - dt * 3); this.punch.b = Math.max(0, this.punch.b - dt * 3); this.flash = Math.max(0, this.flash - dt);
    this.wolf.userData.armR.rotation.x = -this.punch.w * 2.3; this.wolf.userData.armL.rotation.x = Math.sin(this.clock * 6) * 0.2;
    this.wolf.position.x = -3.2 + this.punch.w * 0.8 - this.punch.b * 1.2; this.bear.position.x = 3.4 - this.punch.b * 0.8 + this.punch.w * 1.2;
    this.bear.armL.rotation.x = -this.punch.b * 2.2; this.bear.armR.rotation.x = Math.sin(this.clock * 5) * 0.2;
    this.bear.rotation.z = this.punch.w * 0.15; this.wolf.rotation.z = -this.punch.b * 0.2;
    if (this.bearHp <= 0) { this.over = true; ui.bar('a', null); ui.toast('KNOCKOUT! The Bear is down!', 2500); setTimeout(() => this.ctx.win(), 1200); }
    else if (this.wolfHp <= 0) { this.over = true; ui.bar('a', null); this.ctx.lose('The Wolf got flattened! Pull the ropes in time.'); }
    else if (left === 0) { this.over = true; ui.bar('a', null); this.ctx.lose('The Bear won on points. Pull the ropes more precisely!'); }
  }
  bearHit() { this.bearHp--; this.punch.w = 1; sfx.hit(); this.hud(); }
  wolfHit() { this.wolfHp--; this.punch.b = 1; sfx.boom(); this.hud(); }
  dispose() { ui.bar('a', null); }
}

/* ================= Weightlifting: mash A / D ================= */
export class WeightLift {
  constructor(ctx, cfg = {}) {
    this.ctx = ctx; const scene = this.scene = baseScene(0x28303f);
    const f = box(30, 1, 20, 0x6a5a48); f.position.y = -0.5; scene.add(f);
    for (let i = 0; i < 5; i++) { const w = box(2, 2.4, 0.4, [0xe23a3a, 0x3a7be2][i % 2]); w.position.set(-12 + i * 6, 6, -9); scene.add(w); }
    this.wolf = makeWolf({ scale: 1.2 }); this.wolf.rotation.y = 0; scene.add(this.wolf);
    this.bar = new THREE.Group(); const b = cyl(0.12, 0.12, 6, 0xcccccc, 8); b.rotation.z = Math.PI / 2; this.bar.add(b);
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const p = cyl(0.9 - k * 0.2, 0.9 - k * 0.2, 0.3, k ? 0xd9363e : 0x333333, 14); p.rotation.z = Math.PI / 2; p.position.x = s * (2.5 + k * 0.4); this.bar.add(p); }
    scene.add(this.bar);
    this.need = cfg.lifts ?? 3; this.lifts = 0; this.power = 0; this.last = ''; this.time = cfg.time ?? 24; this.over = false; this.t = 0; this.hold = 0;
    ui.toast('Mash A and D alternately to power up the lift! Fill the meter 3 times before time runs out.', 5000);
  }
  update(dt) {
    dt = Math.min(dt, 0.05); if (this.over) return; this.t += dt; this.time -= dt;
    for (const [k, k2, name] of [['KeyA', 'ArrowLeft', 'L'], ['KeyD', 'ArrowRight', 'R']]) {
      if (wasHit(k, k2)) { if (this.last !== name) { this.power += 0.085; sfx.pump(); } else this.power -= 0.02; this.last = name; }
    }
    this.power = clamp(this.power - 0.26 * dt, 0, 1.05);
    if (this.power >= 1) { this.lifts++; this.power = 0.2; this.hold = 1; sfx.win(); ui.toast(`Lift ${this.lifts}/${this.need}!`, 1200); }
    this.hold = Math.max(0, this.hold - dt);
    const lift = this.lifts / this.need * 0.4 + this.power * 0.5 + this.hold * 0.8;
    this.wolf.position.set(0, 0, 0); this.wolf.userData.armL.rotation.x = -1.6 - lift; this.wolf.userData.armR.rotation.x = -1.6 - lift;
    this.wolf.position.x = Math.sin(this.t * 40) * 0.03 * this.power;
    this.bar.position.set(0, 0.6 + lift * 2.2, 0.9);
    ui.bar('a', 'Power', this.power); ui.bar('b', 'Time', this.time / 24, this.time < 6);
    ui.info(`🏋️ Lifts <b>${this.lifts}/${this.need}</b>`);
    const cam = this.ctx.camera; cam.position.set(0, 4, 10); cam.lookAt(0, 2.5, 0); cam.up.set(0, 1, 0);
    if (this.lifts >= this.need) { this.over = true; ui.bar('a', null); ui.bar('b', null); this.ctx.win(); }
    else if (this.time <= 0) { this.over = true; ui.bar('a', null); ui.bar('b', null); this.ctx.lose('The barbell crashed on the Wolf\'s toes!'); }
  }
  dispose() { ui.bar('a', null); ui.bar('b', null); }
}

/* ================= Retro Cinema: the handheld LCD egg game ================= */
export class RetroEggs {
  constructor(ctx, cfg = {}) {
    this.ctx = ctx; this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0a0a0a);
    const c = this.cv = document.createElement('canvas'); c.id = 'retro'; c.width = 320; c.height = 240; document.body.append(c);
    this.g = c.getContext('2d'); this.pos = 0; this.eggs = []; this.score = 0; this.miss = 0; this.t = 0; this.tick = 0; this.spawn = 0; this.over = false; this.goal = cfg.goal ?? 40;
    ui.toast('Retro Cinema! Catch eggs: Q ↖  A ↙  P ↗  L ↘ (or arrow keys). Catch 40 to win!', 6000);
    this.rng = mulberry32(9);
  }
  update(dt) {
    dt = Math.min(dt, 0.05); if (this.over) return; this.t += dt;
    if (wasHit('KeyQ')) this.pos = 0; if (wasHit('KeyA')) this.pos = 1; if (wasHit('KeyP')) this.pos = 2; if (wasHit('KeyL')) this.pos = 3;
    const left = isDown('ArrowLeft'), up = isDown('ArrowUp'), right = isDown('ArrowRight'), down = isDown('ArrowDown');
    if (left || right || up || down) { const side = right ? 2 : left ? 0 : (this.pos >= 2 ? 2 : 0); this.pos = side + (down ? 1 : up ? 0 : this.pos % 2); }
    const speed = Math.max(0.22, 0.6 - this.score * 0.008);
    this.tick += dt; this.spawn += dt;
    if (this.spawn > speed * 3.2) { this.spawn = 0; this.eggs.push({ ch: Math.floor(this.rng() * 4), s: 0 }); }
    if (this.tick > speed) {
      this.tick = 0;
      for (const e of this.eggs) e.s++;
      for (let i = this.eggs.length - 1; i >= 0; i--) {
        if (this.eggs[i].s >= 5) { if (this.eggs[i].ch === this.pos) { this.score++; sfx.coin(); } else { this.miss++; sfx.hit(); } this.eggs.splice(i, 1); }
      }
    }
    this.draw();
    ui.info(`🥚 <b>${this.score}/${this.goal}</b> &nbsp; ✖ <b>${this.miss}/3</b>`);
    if (this.score >= this.goal) { this.over = true; this.ctx.win(); } else if (this.miss >= 3) { this.over = true; this.ctx.lose('Three broken eggs. Game over!'); }
  }
  draw() {
    const g = this.g; g.fillStyle = '#b9c9a0'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#1a1a1a'; g.strokeStyle = '#1a1a1a'; g.lineWidth = 3;
    const row = [60, 130], cx = [[20, 110], [300, 210]];
    for (let k = 0; k < 4; k++) {
      const left = k < 2, y0 = row[k % 2], xs = left ? 20 : 300, xe = left ? 118 : 202;
      g.beginPath(); g.moveTo(xs, y0); g.lineTo(xe, y0 + 34); g.stroke();
      for (const e of this.eggs) if (e.ch === k) { const u = e.s / 5, x = xs + (xe - xs) * u, y = y0 + 34 * u - 6; g.beginPath(); g.ellipse(x, y, 6, 8, 0, 0, 7); g.fill(); }
    }
    const px = this.pos < 2 ? 112 : 208, py = this.pos % 2 === 0 ? 120 : 190;
    g.fillRect(px - 14, py - 34, 28, 34); g.fillRect(px - 10, py - 46, 20, 14); g.fillRect(this.pos < 2 ? px + 12 : px - 28, py - 10, 16, 10);
    g.fillStyle = '#b9c9a0'; g.fillRect(px - 6, py - 42, 4, 4); g.fillRect(px + 2, py - 42, 4, 4);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 12px monospace'; g.fillText('GAME A  ' + String(this.score).padStart(3, '0'), 120, 20); g.fillText('x'.repeat(this.miss), 240, 20);
  }
  dispose() { this.cv.remove(); }
}

/* ================= Versus: Cat & Mouse, split-screen ================= */
export class Versus {
  constructor(ctx) {
    this.ctx = ctx; const scene = this.scene = baseScene(0x9fd6ff);
    const f = box(44, 1, 44, 0x6aa84f); f.position.y = -0.5; scene.add(f);
    this.walls = [];
    const rows = [[-8, -8, 6, 1.2], [9, -6, 1.2, 8], [0, 3, 8, 1.2], [-11, 8, 1.2, 8], [11, 11, 6, 1.2], [-2, -14, 1.2, 6], [3, 14, 7, 1.2]];
    for (const [x, z, w, d] of rows) { const b = box(w, 2.6, d, 0xc98f6b); b.position.set(x, 1.3, z); scene.add(b); this.walls.push({ x, z, hw: w / 2, hd: d / 2 }); }
    this.hare = makeHare(); this.wolf = makeWolf(); scene.add(this.hare, this.wolf);
    this.h = new THREE.Vector3(-16, 0, 16); this.w = new THREE.Vector3(16, 0, -16); this.hf = 0; this.wf = 0;
    this.carrots = []; this.hc = 0; this.tags = 0; this.time = 90; this.inv = 0; this.over = false; this.t = 0;
    this.rng = mulberry32(3); for (let i = 0; i < 6; i++) this.addCarrot();
    this.cams = [new THREE.PerspectiveCamera(60, 1, 0.1, 200), new THREE.PerspectiveCamera(60, 1, 0.1, 200)];
    this.div = document.createElement('div'); this.div.style.cssText = 'position:fixed;left:50%;top:0;bottom:0;width:4px;margin-left:-2px;background:#000;z-index:3;pointer-events:none'; document.body.append(this.div);
    ui.toast('VERSUS: Player 1 = Hare (WASD) grabs 6 carrots. Player 2 = Wolf (arrow keys) tags the Hare 3 times. 90 seconds!', 6000);
  }
  addCarrot() { const m = makeCarrot(); m.scale.setScalar(1.4); for (let k = 0; k < 20; k++) { const x = (this.rng() - 0.5) * 38, z = (this.rng() - 0.5) * 38; if (!this.hit(x, z, 1)) { m.position.set(x, 0, z); break; } } this.scene.add(m); this.carrots.push(m); }
  hit(x, z, r) { return this.walls.some((w) => Math.abs(x - w.x) < w.hw + r && Math.abs(z - w.z) < w.hd + r); }
  move(p, ix, iz, sp, dt, f) {
    const len = Math.hypot(ix, iz); if (!len) return f;
    const nx = p.x + ix / len * sp * dt, nz = p.z + iz / len * sp * dt;
    if (!this.hit(nx, p.z, 0.5) && Math.abs(nx) < 21) p.x = nx; if (!this.hit(p.x, nz, 0.5) && Math.abs(nz) < 21) p.z = nz;
    return lerpAngle(f, Math.atan2(ix, iz), damp(14, dt));
  }
  update(dt) {
    dt = Math.min(dt, 0.05); if (this.over) return; this.t += dt; this.time -= dt; this.inv = Math.max(0, this.inv - dt);
    this.hf = this.move(this.h, (isDown('KeyD') ? 1 : 0) - (isDown('KeyA') ? 1 : 0), (isDown('KeyS') ? 1 : 0) - (isDown('KeyW') ? 1 : 0), 8.4, dt, this.hf);
    this.wf = this.move(this.w, (isDown('ArrowRight') ? 1 : 0) - (isDown('ArrowLeft') ? 1 : 0), (isDown('ArrowDown') ? 1 : 0) - (isDown('ArrowUp') ? 1 : 0), 7.6, dt, this.wf);
    this.hare.position.copy(this.h); this.hare.rotation.y = this.hf; this.wolf.position.copy(this.w); this.wolf.rotation.y = this.wf;
    animateLimbs(this.hare, this.t * 14, 0.8); animateLimbs(this.wolf, this.t * 12, 0.8);
    this.hare.visible = this.inv <= 0 || Math.floor(this.t * 14) % 2 === 0;
    for (let i = this.carrots.length - 1; i >= 0; i--) {
      const c = this.carrots[i]; c.rotation.y += dt * 2;
      if (Math.hypot(c.position.x - this.h.x, c.position.z - this.h.z) < 1.2) { this.scene.remove(c); this.carrots.splice(i, 1); this.hc++; sfx.coin(); if (this.hc < 6) this.addCarrot(); }
    }
    if (this.inv <= 0 && Math.hypot(this.w.x - this.h.x, this.w.z - this.h.z) < 1.3) { this.tags++; this.inv = 2; sfx.hit(); this.h.set(-16 + Math.random() * 4, 0, 16 - Math.random() * 4); }
    ui.info(`🐰 Carrots <b>${this.hc}/6</b> &nbsp; 🐺 Tags <b>${this.tags}/3</b> &nbsp; ⏱ ${Math.ceil(this.time)}`);
    if (this.hc >= 6) this.end('🐰 Player 1 (Hare) wins! All carrots collected.');
    else if (this.tags >= 3) this.end('🐺 Player 2 (Wolf) wins! "Nu, zayats, pogodi!"');
    else if (this.time <= 0) this.end(this.hc >= this.tags * 2 ? '⏱ Time! The Hare wins on carrots.' : '⏱ Time! The Wolf wins on tags.');
  }
  end(msg) { this.over = true; this.ctx.win(msg); }
  render(r) {
    const W = window.innerWidth, H = window.innerHeight; r.setScissorTest(true);
    [[this.h, 0], [this.w, 1]].forEach(([p, i]) => {
      const cam = this.cams[i]; cam.aspect = (W / 2) / H; cam.updateProjectionMatrix();
      cam.position.set(p.x, 10, p.z + 9); cam.lookAt(p.x, 1, p.z);
      r.setViewport(i * W / 2, 0, W / 2, H); r.setScissor(i * W / 2, 0, W / 2, H); r.render(this.scene, cam);
    });
    r.setScissorTest(false); r.setViewport(0, 0, W, H);
  }
  dispose() { this.div.remove(); }
}
