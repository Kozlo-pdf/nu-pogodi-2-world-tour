import {
  THREE, isDown, wasHit, box, cyl, sph, cone, mat, mesh, makeHare, makeWolf, makeRobotHare, animateLimbs,
  lerpAngle, damp, clamp,
} from './common.js';
import { sfx } from './audio.js';
import { makeHarvester as makeHarvesterModel } from './props.js';
import { ui } from './ui.js';

const RADIUS = 15;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Generic boss fight: dodge telegraphed attacks, grab ammo, throw it at the boss.
 * cfg: { boss: 'zmey'|'robot', hp, phases:[{at, attacks:[{type, every, n}]}], ammo:{name,color,special}, infinite, vehicle, both, floor, bg }
 */
export class Duel {
  constructor(ctx, cfg) {
    this.ctx = ctx; this.cfg = cfg;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.bg ?? 0x1a1228); scene.fog = new THREE.Fog(cfg.bg ?? 0x1a1228, 50, 130);
    scene.add(new THREE.HemisphereLight(cfg.hemiSky ?? 0xffe0c0, 0x332244, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(6, 22, 12); sun.castShadow = true;
    sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    const floor = cyl(RADIUS + 1, RADIUS + 1.5, 1, cfg.floor ?? 0x4a3a5a, 40); floor.position.y = -0.5; scene.add(floor);
    const ring = mesh(new THREE.TorusGeometry(RADIUS + 1, 0.3, 8, 48), mat(cfg.rim ?? 0xffc933, 0x443300)); ring.rotation.x = Math.PI / 2; scene.add(ring);
    const out = cyl(RADIUS * 3, RADIUS * 3, 1, cfg.out ?? 0x120a1c, 8); out.position.y = -1.5; scene.add(out);
    if (cfg.build) cfg.build(scene);

    this.boss = this.makeBoss(cfg.boss);
    this.hpMax = cfg.hp; this.hp = cfg.hp; this.phase = -1; this.bossT = 0; this.flash = 0; this.dying = 0;
    this.timers = []; this.shots = []; this.tele = []; this.pickups = []; this.thrown = [];

    this.hare = makeHare(); this.wolf = makeWolf(); this.scene.add(this.hare, this.wolf);
    this.vehicle = cfg.vehicle ? this.makeHarvester() : null;
    if (this.vehicle) { this.scene.add(this.vehicle); this.hare.visible = false; this.wolf.visible = false; }
    this.active = cfg.start ?? 'hare'; this.pos = V3(0, 0, 11); this.face = Math.PI; this.runPhase = 0;
    this.lives = cfg.lives ?? 5; this.invuln = 1.5; this.cool = 0; this.ammo = cfg.infinite ? 0 : 1; this.special = 0; this.t = 0; this.pickT = 1;
    this.nextPhase();
    this.hud();
    ui.toast(cfg.intro ?? 'Grab ammo, dodge the attacks, throw it at the boss! [Space: throw]', 5000);
    this.update(0.001);
  }

  makeBoss(kind) {
    const g = new THREE.Group(); const o = { g, heads: [], kind, r: 3.6 };
    if (kind === 'zmey') {
      const body = sph(3.2, 0x2f6a3a, 14); body.scale.set(1.2, 1, 1.1); body.position.y = 3; g.add(body);
      for (const s of [-1, 1]) { const w = box(4.2, 0.2, 2.8, 0x1f4a2a); w.position.set(s * 4.3, 5, -0.5); w.rotation.z = s * 0.5; g.add(w); }
      for (let i = 0; i < 3; i++) {
        const hg = new THREE.Group(); const x = (i - 1) * 3.2;
        const neck = cyl(0.5, 0.8, 4, 0x2f8a46, 8); neck.position.set(x * 0.7, 5.5, 0.5); neck.rotation.z = -(i - 1) * 0.3; hg.add(neck);
        const head = sph(1.0, 0x3a9a50, 10); head.position.set(x, 7.6, 1.4); hg.add(head);
        const snout = cone(0.55, 1.5, 0x3a9a50, 8); snout.rotation.x = Math.PI / 2; snout.position.set(x, 7.3, 2.6); hg.add(snout);
        for (const s of [-1, 1]) { const e = sph(0.16, mat(0xff2a2a, 0xff0000), 6); e.position.set(x + s * 0.45, 7.9, 2.0); hg.add(e); const h = cone(0.2, 0.8, 0xe8dcc0, 5); h.position.set(x + s * 0.5, 8.6, 1.2); hg.add(h); }
        g.add(hg); o.heads.push(hg);
      }
      o.mouth = (i = 1) => V3((i - 1) * 3.2, 7.3, -9 + 2.6);
      g.position.set(0, 0, -9);
    } else {
      const r = makeRobotHare(); r.scale.setScalar(6.5); g.add(r); o.robot = r;
      const iron = cyl(0.15, 0.15, 7, 0xaaaaaa, 6); iron.position.set(-4, 7, 3); iron.rotation.z = 0.5; g.add(iron);
      const tip = sph(0.3, mat(0xff6a1a, 0xff4400), 6); tip.position.set(-5.7, 10.2, 3); g.add(tip); o.tip = tip;
      o.mouth = () => V3(-4, 9, -9 + 3);
      o.r = 4.2; g.position.set(0, 0, -9);
    }
    g.rotation.y = 0; this.scene.add(g);
    return o;
  }
  makeHarvester() {
    const g = new THREE.Group(); const h = makeHarvesterModel(); g.add(h); this.reel = h.userData.reel;
    const wolf = makeWolf({ scale: 0.55 }); wolf.position.set(0, 1.5, 0.5); wolf.rotation.y = Math.PI; g.add(wolf);
    const hare = makeHare(); hare.scale.setScalar(0.5); hare.position.set(0, 3.05, 0.9); hare.rotation.y = Math.PI; g.add(hare);
    return g;
  }

  hud() {
    const hearts = '❤️'.repeat(this.lives) + '🖤'.repeat(Math.max(0, (this.cfg.lives ?? 5) - this.lives));
    const am = this.cfg.infinite ? '' : ` &nbsp; ${this.cfg.ammo?.name ?? 'Ammo'}: <b>${this.ammo}</b>`;
    const sp = this.cfg.vehicle ? ` &nbsp; ${this.cfg.ammo?.special ?? 'Special'} [E]: <b>${this.special}</b>` : '';
    const ch = this.cfg.both ? ` &nbsp; ${this.active === 'hare' ? '🐰' : '🐺'} <small>[Tab]</small>` : '';
    ui.info(hearts + am + sp + ch);
    ui.bar('a', this.cfg.bossName ?? 'Boss', this.hp / this.hpMax);
  }

  nextPhase() {
    this.phase++;
    const ph = this.cfg.phases[this.phase]; if (!ph) return;
    this.timers = ph.attacks.map((a) => ({ ...a, t: a.every * (0.5 + Math.random() * 0.6) }));
    if (this.phase > 0) {
      ui.toast(ph.msg ?? `Phase ${this.phase + 1}!`, 2600); sfx.boom();
      if (this.boss.kind === 'zmey' && this.boss.heads[this.phase - 1]) this.boss.heads[this.phase - 1].visible = false;
      if (this.boss.kind === 'robot') this.boss.g.scale.multiplyScalar(1.0);
    } else if (ph.msg) ui.toast(ph.msg, 2600);
  }

  /* ---------- attacks ---------- */
  fire(kind, a) {
    const bp = this.boss.g.position.clone().add(this.boss.mouth(a.head ?? Math.floor(Math.random() * 3)).sub(V3(0, 0, -9)));
    if (kind === 'shots') {
      const n = a.n ?? 3;
      for (let i = 0; i < n; i++) {
        const dir = this.pos.clone().sub(bp); dir.y = 0; dir.normalize().applyAxisAngle(V3(0, 1, 0), (i - (n - 1) / 2) * 0.22);
        this.spawnShot(bp.clone(), dir.multiplyScalar(a.speed ?? 9), a.color ?? this.cfg.shotColor ?? 0xff5a1a);
      }
    } else if (kind === 'ring') {
      const n = a.n ?? 14, off = Math.random() * 6;
      for (let i = 0; i < n; i++) { const an = off + i / n * Math.PI * 2; this.spawnShot(this.boss.g.position.clone().setY(1), V3(Math.sin(an), 0, Math.cos(an)).multiplyScalar(a.speed ?? 6), a.color ?? this.cfg.shotColor ?? 0xff5a1a); }
    } else if (kind === 'slam') {
      this.addTele(this.pos.clone(), a.r ?? 3.2, a.delay ?? 1.1);
    } else if (kind === 'rain') {
      for (let i = 0; i < (a.n ?? 5); i++) { const an = Math.random() * 6.28, r = Math.random() * (RADIUS - 2); this.addTele(V3(Math.cos(an) * r, 0, Math.sin(an) * r), a.r ?? 2.2, (a.delay ?? 1.2) + i * 0.15); }
    }
    sfx.pull();
  }
  spawnShot(p, v, color) {
    const m = sph(0.55, mat(color, color), 8); m.position.copy(p); m.position.y = Math.max(1, p.y * 0.3 + 0.6); m.castShadow = false; this.scene.add(m);
    this.shots.push({ m, v, life: 5 });
  }
  addTele(p, r, delay) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.3, depthWrite: false }));
    d.rotation.x = -Math.PI / 2; d.position.set(p.x, 0.06, p.z); this.scene.add(d);
    this.tele.push({ d, p, r, t: delay, max: delay });
  }

  hurt(msg) {
    if (this.invuln > 0) return;
    this.lives--; this.invuln = 1.6; sfx.hit(); this.hud();
    if (this.lives <= 0) { this.over = true; ui.bar('a', null); ui.hint(null); this.ctx.lose(msg ?? 'The boss got you! Nu, zayats…'); }
  }

  /* ---------- player actions ---------- */
  throwAt(special) {
    const bp = this.boss.g.position.clone(); bp.y = 3.5;
    const p = this.pos.clone(); p.y = 1.6;
    const dir = bp.sub(p); const d = dir.length(); dir.normalize();
    const col = special ? (this.cfg.ammo?.specialColor ?? 0xff3aff) : (this.cfg.ammo?.color ?? 0xffa020);
    const m = sph(special ? 0.6 : 0.4, mat(col, col), 8); m.position.copy(p); this.scene.add(m);
    const dmg = special ? 4 : (this.active === 'wolf' ? 2 : 1);
    this.thrown.push({ m, v: dir.multiplyScalar(26), dmg, life: 2 });
    sfx.jump();
  }

  damageBoss(n) {
    if (this.dying) return;
    this.hp = Math.max(0, this.hp - n); this.flash = 0.25; sfx.hit(); this.hud();
    const next = this.cfg.phases[this.phase + 1];
    if (next && this.hp / this.hpMax <= next.at) this.nextPhase();
    if (this.hp <= 0) { this.dying = 0.001; ui.hint(null); ui.bar('a', null); sfx.boom(); ui.toast(this.cfg.winMsg ?? 'The boss is defeated!', 3000); }
  }

  update(dt) {
    dt = Math.min(dt, 0.05); this.t += dt; const t = this.t;
    if (this.over) return;
    this.invuln = Math.max(0, this.invuln - dt); this.cool = Math.max(0, this.cool - dt);

    // boss presence
    const b = this.boss;
    b.g.position.x = Math.sin(t * 0.6) * (this.cfg.boss === 'zmey' ? 2.5 : 3.5);
    b.g.position.y = this.cfg.boss === 'robot' ? Math.abs(Math.sin(t * 2)) * 0.4 : 0;
    if (this.flash > 0) { this.flash -= dt; b.g.scale.setScalar(1 + this.flash * 0.15); } else b.g.scale.setScalar(1);
    if (b.tip) b.tip.scale.setScalar(1 + Math.sin(t * 12) * 0.3);
    if (b.robot) animateLimbs(b.robot, t * 3, 0.25);
    b.heads.forEach((h, i) => { h.rotation.z = Math.sin(t * 1.5 + i) * 0.05; });

    if (this.dying) {
      this.dying += dt; b.g.rotation.z += dt * 0.8; b.g.position.y += dt * 2; b.g.scale.setScalar(Math.max(0.01, 1 - this.dying * 0.45));
      if (this.dying > 2.4) { this.over = true; this.ctx.win(); }
    } else {
      for (const a of this.timers) { a.t -= dt; if (a.t <= 0) { a.t = a.every * (0.85 + Math.random() * 0.3); this.fire(a.type, a); } }
    }

    // player
    const ix = (isDown('KeyD', 'ArrowRight') ? 1 : 0) - (isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const iz = (isDown('KeyS', 'ArrowDown') ? 1 : 0) - (isDown('KeyW', 'ArrowUp') ? 1 : 0);
    const len = Math.hypot(ix, iz);
    const sp = this.cfg.vehicle ? 9 : this.active === 'hare' ? 7.8 : 6.2;
    if (len > 0) {
      this.pos.x += ix / len * sp * dt; this.pos.z += iz / len * sp * dt;
      this.face = lerpAngle(this.face, Math.atan2(ix, iz), damp(14, dt));
    }
    const pr = Math.hypot(this.pos.x, this.pos.z); if (pr > RADIUS) { this.pos.x *= RADIUS / pr; this.pos.z *= RADIUS / pr; }
    if (this.cfg.both && wasHit('Tab')) { this.active = this.active === 'hare' ? 'wolf' : 'hare'; sfx.pop(); this.hud(); }
    if (wasHit('Space') && this.cool <= 0 && !this.dying) {
      if (this.cfg.infinite) { this.throwAt(false); this.cool = 0.4; }
      else if (this.ammo > 0) { this.ammo--; this.throwAt(false); this.cool = this.active === 'wolf' ? 0.8 : 0.45; this.hud(); }
      else ui.toast('Out of ammo! Grab some from the arena.', 1000);
    }
    if (wasHit('KeyE') && this.special > 0 && this.cool <= 0 && !this.dying) { this.special--; this.throwAt(true); this.cool = 0.6; this.hud(); }

    const m = this.vehicle ?? (this.active === 'hare' ? this.hare : this.wolf);
    if (!this.vehicle) { this.hare.visible = this.active === 'hare' && (this.invuln <= 0 || Math.floor(t * 14) % 2 === 0); this.wolf.visible = this.active === 'wolf' && (this.invuln <= 0 || Math.floor(t * 14) % 2 === 0); }
    else m.visible = this.invuln <= 0 || Math.floor(t * 14) % 2 === 0;
    m.position.set(this.pos.x, 0, this.pos.z); m.rotation.y = this.vehicle ? this.face + Math.PI : this.face;
    if (this.reel) this.reel.rotation.x -= dt * 8;
    this.runPhase += dt * 12; if (!this.vehicle) animateLimbs(m, this.runPhase, len > 0 ? 0.9 : 0.05);

    // pickups
    this.pickT -= dt;
    if (this.pickT <= 0 && this.pickups.length < 3 && !this.dying) {
      this.pickT = 2.2;
      const a = Math.random() * 6.28, r = 4 + Math.random() * (RADIUS - 6);
      const col = this.cfg.ammo?.color ?? 0xffa020;
      const pm = new THREE.Group(); const body = sph(0.45, mat(col, col), 8); body.position.y = 0.7; pm.add(body);
      const ring = mesh(new THREE.TorusGeometry(0.7, 0.06, 6, 16), mat(0xffffff, 0x666666)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; pm.add(ring);
      pm.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); this.scene.add(pm); this.pickups.push(pm);
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pm = this.pickups[i]; pm.children[0].position.y = 0.7 + Math.sin(t * 4 + i) * 0.15;
      if (Math.hypot(this.pos.x - pm.position.x, this.pos.z - pm.position.z) < 1.5) {
        this.scene.remove(pm); this.pickups.splice(i, 1); sfx.coin();
        if (this.cfg.infinite) this.special = Math.min(4, this.special + 1); else this.ammo = Math.min(5, this.ammo + 2);
        this.hud();
      }
    }

    // enemy shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.m.position.addScaledVector(s.v, dt); s.life -= dt;
      if (Math.hypot(s.m.position.x - this.pos.x, s.m.position.z - this.pos.z) < 1.0 && this.invuln <= 0) { this.hurt(); this.kill(this.shots, i); continue; }
      if (s.life <= 0 || Math.hypot(s.m.position.x, s.m.position.z) > RADIUS + 3) this.kill(this.shots, i);
    }
    // telegraphs
    for (let i = this.tele.length - 1; i >= 0; i--) {
      const e = this.tele[i]; e.t -= dt; e.d.material.opacity = 0.2 + 0.5 * (1 - e.t / e.max); e.d.scale.setScalar(0.4 + 0.6 * (1 - e.t / e.max) + (e.t < 0.2 ? 0.1 : 0));
      if (e.t <= 0) {
        if (Math.hypot(this.pos.x - e.p.x, this.pos.z - e.p.z) < e.r && this.invuln <= 0) this.hurt();
        sfx.boom(); this.scene.remove(e.d); this.tele.splice(i, 1);
      }
    }
    // thrown
    for (let i = this.thrown.length - 1; i >= 0; i--) {
      const s = this.thrown[i]; s.m.position.addScaledVector(s.v, dt); s.life -= dt;
      const bp = this.boss.g.position;
      if (Math.hypot(s.m.position.x - bp.x, s.m.position.z - bp.z) < this.boss.r && !this.dying) { this.damageBoss(s.dmg); this.kill(this.thrown, i); continue; }
      if (s.life <= 0) this.kill(this.thrown, i);
    }

    const cam = this.ctx.camera;
    cam.position.set(this.pos.x * 0.25, 21, 18 + this.pos.z * 0.2); cam.lookAt(this.pos.x * 0.2, 1, this.pos.z * 0.15 - 2);
    cam.up.set(0, 1, 0);
  }
  kill(arr, i) { this.scene.remove(arr[i].m); arr.splice(i, 1); }
  dispose() { ui.bar('a', null); }
}
