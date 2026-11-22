import {
  THREE, isDown, wasHit, box, cyl, sph, cone, mat, mesh, makeHare, makeWolf, animateLimbs, lerpAngle, damp, clamp,
} from './common.js';
import { Platformer, DEFAULT_P } from './platformer.js';
import { sfx } from './audio.js';
import { ui } from './ui.js';

export const CHARS = {
  hare: { R: 0.35, H: 1.6, speed: 7.6, jump: 11.8, maxJumps: 2, wall: true, stealth: 0.55 },
  wolf: { R: 0.6, H: 2.3, speed: 6.3, jump: 10.6, maxJumps: 1, wall: false, stealth: 1 },
};

/* ---------- small prop builders ---------- */
export function makeLabel(text, color = '#fff2c4', w = 5) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(30,18,24,0.82)'; g.beginPath(); g.roundRect(4, 4, 504, 120, 28); g.fill();
  g.strokeStyle = color; g.lineWidth = 6; g.stroke();
  g.fillStyle = color; g.font = 'bold 54px Trebuchet MS, Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68, 480);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(w, w / 4, 1);
  return sp;
}

export function makeHippo() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.7, 0.8, 4, 10), 0x4a5f8f); body.position.y = 1.2; g.add(body);
  const head = sph(0.62, 0x9a8fa3, 12); head.position.set(0, 2.15, 0.1); head.scale.set(1.1, 0.9, 1.1); g.add(head);
  const snout = sph(0.42, 0xb9a9b9, 10); snout.position.set(0, 1.95, 0.6); snout.scale.set(1.3, 0.8, 1); g.add(snout);
  for (const s of [-1, 1]) {
    const eye = sph(0.09, 0x111111, 6); eye.position.set(s * 0.28, 2.4, 0.45); g.add(eye);
    const ear = sph(0.14, 0x9a8fa3, 6); ear.position.set(s * 0.5, 2.7, -0.05); g.add(ear);
    const leg = mesh(new THREE.CapsuleGeometry(0.2, 0.4, 4, 6), 0x2f3f66); leg.position.set(s * 0.35, 0.4, 0); g.add(leg);
    const nos = sph(0.05, 0x5a4a5a, 5); nos.position.set(s * 0.15, 2.05, 0.95); g.add(nos);
  }
  const cap = cyl(0.5, 0.6, 0.3, 0x1f2a4a, 12); cap.position.y = 2.75; g.add(cap);
  const peak = box(0.7, 0.06, 0.4, 0x111111); peak.position.set(0, 2.62, 0.55); g.add(peak);
  const badge = sph(0.08, mat(0xffd23f, 0x886600), 6); badge.position.set(0, 2.78, 0.5); g.add(badge);
  return g;
}

export function makeCarrot() {
  const g = new THREE.Group();
  const c = cone(0.2, 0.7, mat(0xffb020, 0x885500), 8); c.rotation.x = Math.PI; c.position.y = 0.35; g.add(c);
  for (let i = 0; i < 3; i++) { const l = cone(0.07, 0.35, 0x37c25a, 4); l.position.set((i - 1) * 0.08, 0.85, 0); l.rotation.z = (i - 1) * 0.4; g.add(l); }
  g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  return g;
}

export function makeGear() {
  const g = new THREE.Group();
  const m = mat(0xffc933, 0x8a5a00);
  const ring = mesh(new THREE.TorusGeometry(0.7, 0.2, 8, 20), m); g.add(ring);
  for (let i = 0; i < 10; i++) { const t = box(0.26, 0.26, 0.34, m); const a = i / 10 * Math.PI * 2; t.position.set(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0); t.rotation.z = a; g.add(t); }
  const hub = cyl(0.25, 0.25, 0.4, m, 10); hub.rotation.x = Math.PI / 2; g.add(hub);
  g.scale.setScalar(1.1);
  return g;
}

export function makeWitch() {
  const g = new THREE.Group();
  const cloak = cone(0.9, 2.4, 0x3a2a4a, 10); cloak.position.y = 1.2; g.add(cloak);
  const head = sph(0.4, 0x9ac28a, 10); head.position.y = 2.6; g.add(head);
  const nose = cone(0.1, 0.4, 0x7aa26a, 6); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.55, 0.5); g.add(nose);
  const brim = cyl(0.8, 0.8, 0.06, 0x1a1020, 14); brim.position.y = 2.9; g.add(brim);
  const hat = cone(0.45, 1.1, 0x1a1020, 10); hat.position.y = 3.5; g.add(hat);
  const broom = cyl(0.04, 0.04, 2.2, 0x8a5a2a, 6); broom.rotation.z = Math.PI / 2.4; broom.position.set(0.6, 1.2, 0.3); g.add(broom);
  return g;
}

const TAU = Math.PI * 2;
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Semi-open hub world: two switchable characters, quests, guards, plates/gates, mini-games.
 */
export class Hub extends Platformer {
  constructor(ctx, cfg) {
    super(ctx, { ...cfg, goal: { pos: [0, -999, 0], need: 1e9 }, tickets: [] });
    this.hcfg = cfg;
    this.rotKeys = ['KeyQ', 'KeyZ'];
    this.flags = {}; this.things = []; this.guards = []; this.carrots = [];
    this.platforms.forEach((pl, i) => { pl.def = cfg.platforms[i]; });
    this.counts = {}; this.hidden = false; this.hook = null; this.disguised = false; this.hold = 0; this.nearThing = null;
    this.step = 0; this.t2 = 0;

    // characters
    const unlocked = cfg.chars ?? ['hare', 'wolf'];
    this.unlocked = { hare: true, wolf: unlocked.includes('wolf') };
    const wolfMesh = makeWolf(); this.scene.add(wolfMesh);
    const wsp = cfg.wolfSpawn ?? [cfg.spawn[0] + 2, cfg.spawn[1], cfg.spawn[2] + 1.5];
    const rec = (mesh_, p) => ({ mesh: mesh_, pos: new THREE.Vector3(...p), vel: new THREE.Vector3(), face: Math.PI, grounded: false, ground: null, jumps: 0, coyote: 0, runPhase: 0 });
    this.chars = { hare: rec(this.hare, cfg.spawn), wolf: rec(wolfMesh, wsp) };
    this.active = 'hare';
    if (cfg.armor) this.addArmor(wolfMesh);
    this.disguiseProps = this.addDisguise(wolfMesh);
    if (cfg.wolfSpawn && !this.unlocked.wolf) wolfMesh.rotation.y = cfg.wolfFace ?? 0;
    this.syncParams();

    // things, carrots, guards
    for (const d of cfg.things ?? []) this.addThing(d);
    (cfg.carrots ?? []).forEach((p, i) => this.addCarrot(p, i));
    if (cfg.build2) cfg.build2(this.scene, this);

    this.hookLine = cyl(0.04, 0.04, 1, 0x8a5a2a, 4); this.hookLine.visible = false; this.scene.add(this.hookLine);
    this.refreshObjectives();
    this.updateHud();
    this.hint = null;
    if (cfg.intro) ui.toast(cfg.intro, 5000);
  }

  /* ---------- characters ---------- */
  addArmor(w) {
    const g = new THREE.Group();
    const torso = cyl(0.5, 0.55, 1.0, 0x9aa3ae, 10); torso.position.y = 1.08; g.add(torso);
    const helm = sph(0.48, 0xb6bec8, 10); helm.position.set(0, 1.82, 0); g.add(helm);
    const visor = box(0.5, 0.1, 0.2, 0x222222); visor.position.set(0, 1.85, 0.42); g.add(visor);
    const plume = cone(0.15, 0.7, 0xd0383f, 6); plume.position.y = 2.5; g.add(plume);
    w.add(g);
  }
  addDisguise(w) {
    const g = new THREE.Group();
    const cap = cyl(0.36, 0.42, 0.28, 0x2a2a2a, 10); cap.position.set(0, 2.28, 0); g.add(cap);
    const peak = box(0.5, 0.05, 0.3, 0x2a2a2a); peak.position.set(0, 2.18, 0.4); g.add(peak);
    const mus = box(0.4, 0.07, 0.1, 0x222222); mus.position.set(0, 1.62, 0.62); g.add(mus);
    g.visible = false; w.add(g); return g;
  }
  syncParams() {
    Object.assign(this.P, DEFAULT_P, CHARS[this.active]);
    if (this.hcfg?.armor && this.active === 'wolf') this.P.speed = 4.9;
    if (this.active === 'hare' && isDown('ShiftLeft', 'ShiftRight')) this.P.speed *= 0.5;
  }
  saveTo(r) { r.pos.copy(this.pos); r.vel.copy(this.vel); r.face = this.face; r.grounded = this.grounded; r.ground = this.ground; r.jumps = this.jumps; r.coyote = this.coyote; r.runPhase = this.runPhase; }
  loadFrom(r, name) {
    this.pos.copy(r.pos); this.vel.copy(r.vel); this.face = r.face; this.grounded = r.grounded; this.ground = r.ground; this.jumps = r.jumps; this.coyote = r.coyote; this.runPhase = r.runPhase;
    this.hare = r.mesh; Object.assign(this.P, DEFAULT_P, CHARS[name]);
  }
  other() { return this.active === 'hare' ? 'wolf' : 'hare'; }
  canSwitch() { return this.unlocked.wolf && !this.hook && !this.hidden; }
  switchChar() {
    const a = this.active, o = this.other();
    this.saveTo(this.chars[a]); this.loadFrom(this.chars[o], o); this.active = o;
    this.vel.set(0, 0, 0); this.grounded = false;
    sfx.pop(); ui.toast(o === 'hare' ? '🐰 Hare: wall-jump, double jump, sneak (Shift)' : '🐺 Wolf: heavy, smash (E), grapple (F), disguise (C)', 2200);
    this.updateHud();
  }
  stealthFactor() {
    let f = CHARS[this.active].stealth;
    if (this.active === 'hare' && isDown('ShiftLeft', 'ShiftRight')) f *= 0.55;
    if (this.active === 'wolf' && this.disguised) f *= 0.45;
    if (this.active === 'wolf' && this.hcfg.armor) f *= 1.7;
    return f;
  }

  /* ---------- things ---------- */
  addThing(d) {
    const sc = this.scene, t = { ...d, v: new THREE.Vector3(...(d.p ?? [0, 0, 0])) };
    const at = (o) => { o.position.copy(t.v); sc.add(o); return o; };
    if (d.type === 'plate') {
      const r = d.r ?? 1.4;
      t.mesh = at(cyl(r, r, 0.16, d.heavy ? mat(0xb04a4a) : mat(0x4a7ab0), 20)); t.mesh.position.y += 0.08;
      if (d.label !== false) { const l = makeLabel(d.heavy ? 'HEAVY: Wolf' : 'Stand here', '#ffd9a8', 3.2); l.position.set(t.v.x, t.v.y + 1.4, t.v.z); sc.add(l); }
    } else if (d.type === 'lever') {
      const g = new THREE.Group(); g.add(box(1, 0.4, 1, 0x444444));
      t.stick = new THREE.Group(); const rod = cyl(0.07, 0.07, 1.2, 0xcccccc, 8); rod.position.y = 0.6; const kn = sph(0.2, mat(0xff4444, 0x550000), 8); kn.position.y = 1.25;
      t.stick.add(rod, kn); t.stick.position.y = 0.25; t.stick.rotation.z = 0.7; g.add(t.stick); at(g); t.mesh = g;
      if (d.text) { const l = makeLabel(d.text, '#ffd9a8', 3.6); l.position.set(t.v.x, t.v.y + 2.4, t.v.z); sc.add(l); }
    } else if (d.type === 'anchor') {
      t.mesh = at(new THREE.Group());
      const ring = mesh(new THREE.TorusGeometry(0.55, 0.12, 8, 16), mat(0xffc933, 0x664400)); t.mesh.add(ring);
      const core = sph(0.18, mat(0xffffff, 0xffffaa), 8); t.mesh.add(core);
      const l = makeLabel('Wolf: F', '#ffd9a8', 2.4); l.position.y = 1.1; t.mesh.add(l);
    } else if (d.type === 'mini') {
      t.mesh = at(new THREE.Group());
      const pad = cyl(1.8, 1.8, 0.2, mat(0x7a3adb, 0x3a1a8a), 24); pad.position.y = 0.1; t.mesh.add(pad);
      const ring = mesh(new THREE.TorusGeometry(1.8, 0.1, 6, 28), mat(0xffd23f, 0x886600)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; t.mesh.add(ring);
      const l = makeLabel(d.label ?? 'Mini-game', '#ffd9a8', 5); l.position.y = 3.2; t.mesh.add(l); t.pad = pad;
    } else if (d.type === 'hide') {
      t.mesh = at(new THREE.Group());
      const body = box(1.1, 2.3, 0.9, d.color ?? 0xd9b86a); body.position.y = 1.15; t.mesh.add(body);
      const face = sph(0.3, 0xf0d78a, 8); face.position.set(0, 1.9, 0.45); t.mesh.add(face);
      const l = makeLabel('Hare: hide (E)', '#ffd9a8', 3); l.position.y = 3.1; t.mesh.add(l);
    } else if (d.type === 'rescue') {
      t.mesh = at(new THREE.Group());
      const ring = mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 24), mat(0x52e08a, 0x1a7a40)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; t.mesh.add(ring);
      const l = makeLabel(d.label ?? 'Hold E: free the Wolf', '#9affc0', 4.6); l.position.y = 3.6; t.mesh.add(l);
    } else if (d.type === 'sign') {
      t.mesh = at(new THREE.Group()); const l = makeLabel(d.text, '#ffe9b0', d.w ?? 6); l.position.y = 2.2; t.mesh.add(l);
      const post = box(0.12, 2.2, 0.12, 0x5b3d22); post.position.y = 1.1; t.mesh.add(post);
    } else if (d.type === 'gear') {
      t.mesh = at(makeGear()); t.mesh.position.y += 1.4;
    } else if (d.type === 'item') {
      t.mesh = at(new THREE.Group());
      const ap = sph(0.4, mat(0xe23a3a, 0x661111), 10); ap.position.y = 0.6; t.mesh.add(ap);
      const lf = cone(0.14, 0.4, 0x37c25a, 4); lf.position.y = 1.1; t.mesh.add(lf);
      t.mesh.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    } else if (d.type === 'guard') {
      this.addGuard(d); return;
    }
    this.things.push(t);
  }

  addGuard(d) {
    const g = { path: d.path, i: 0, wait: 0, y: d.y ?? 0, speed: d.speed ?? 2.6, view: d.view ?? 9, fov: (d.fov ?? 80) * Math.PI / 180, alert: 0, mesh: new THREE.Group(), kind: d.kind };
    const body = d.model === 'robot' ? this.robotBody() : d.model === 'witch' ? makeWitch() : makeHippo();
    g.mesh.add(body);
    const sect = new THREE.Mesh(new THREE.CircleGeometry(g.view, 24, -Math.PI / 2 - g.fov / 2, g.fov), new THREE.MeshBasicMaterial({ color: 0xffe36b, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    sect.rotation.x = -Math.PI / 2; sect.position.y = 0.08; g.mesh.add(sect); g.sect = sect;
    g.mesh.position.set(g.path[0][0], g.y, g.path[0][1]); this.scene.add(g.mesh);
    this.guards.push(g);
  }
  robotBody() {
    const g = new THREE.Group();
    const r = makeHare({ fur: 0x8f9ba8, white: 0xc9d2da, shirt: 0x5c6670, pants: 0x444c55, pupil: 0xff2a2a });
    r.scale.setScalar(1.3); g.add(r); this.robotHares = (this.robotHares ?? []).concat([r]);
    return g;
  }

  addCarrot(p, i) {
    const id = `${this.hcfg.id}:${i}`;
    if (this.ctx.save.hasCarrot(id)) return;
    const m = makeCarrot(); m.position.set(...p); this.scene.add(m);
    this.carrots.push({ id, m, p: new THREE.Vector3(...p), base: p[1] });
  }

  setFlag(f, v = true) {
    if (this.flags[f] === v) return;
    this.flags[f] = v; this.refreshObjectives();
  }
  refreshObjectives() {
    const o = this.hcfg.objectives ?? [];
    ui.objectives(o.map((x) => ({ text: x.text, done: !!this.flags[x.flag] })));
  }
  need(list) { return (list ?? []).every((f) => this.flags[f]); }

  updateHud() {
    if (!this.chars) return;
    const mine = this.hcfg.carrots?.length ?? 0, got = this.carrotsHere();
    ui.info(`${this.active === 'hare' ? '🐰 Hare' : '🐺 Wolf'}${this.unlocked.wolf ? ' <small>[Tab: swap]</small>' : ''} &nbsp; 🥕 <b>${got}/${mine}</b> &nbsp; 💫 <b>${this.oops}</b>`);
  }
  carrotsHere() { return (this.hcfg.carrots?.length ?? 0) - this.carrots.length; }

  /* ---------- movement overrides ---------- */
  movePlayer(dt) {
    const a = this.active;
    this.syncParams();
    if (this.hidden) { this.vel.set(0, 0, 0); this.grounded = true; }
    else if (this.hook) this.stepHook(dt);
    else super.movePlayer(dt);
    this.stepInactive(dt);
    // armour clank
    if (this.hcfg.armor && a === 'wolf' && this.grounded && Math.hypot(this.vel.x, this.vel.z) > 2) {
      this.step += dt; if (this.step > 0.42) { this.step = 0; sfx.plug(); }
    }
  }
  stepInactive(dt) {
    const a = this.active, o = this.other();
    if (!this.unlocked[o]) return;
    this.saveTo(this.chars[a]); this.loadFrom(this.chars[o], o); this.noInput = true;
    Platformer.prototype.movePlayer.call(this, dt);
    this.animate(dt);
    if (this.pos.y < (this.cfg.killY ?? -15)) this.pos.copy(this.checkpoint);
    this.saveTo(this.chars[o]); this.noInput = false; this.loadFrom(this.chars[a], a);
  }
  stepHook(dt) {
    const h = this.hook; h.t += dt;
    const from = this.pos.clone(); from.y += 1.2;
    const dir = h.target.clone().sub(from); const d = dir.length();
    if (d < 1.9 || h.t > 2.2) {
      dir.normalize(); this.vel.copy(dir.multiplyScalar(13)); this.vel.y += 5; this.boostT = 1.1; this.noCutT = 1.0; this.hook = null; this.grounded = false; this.jumps = 1; this.hookLine.visible = false; return;
    }
    dir.normalize(); this.pos.addScaledVector(dir, 24 * dt); this.vel.set(0, 0, 0);
    this.face = lerpAngle(this.face, Math.atan2(dir.x, dir.z), damp(14, dt));
    this.hookLine.visible = true;
    const mid = from.clone().add(h.target).multiplyScalar(0.5); this.hookLine.position.copy(mid);
    this.hookLine.scale.set(1, from.distanceTo(h.target), 1);
    this.hookLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h.target.clone().sub(from).normalize());
  }

  /* ---------- main update ---------- */
  update(dt) {
    dt = Math.min(dt, 0.05);
    super.update(dt);
    this.t2 += dt;
    const act = this.chars[this.active], c = this.pos;

    if (this.hidden) this.hare.visible = false;
    // switching & abilities
    if (wasHit('Tab') && this.canSwitch()) this.switchChar();
    if (this.active === 'wolf' && !this.hidden) {
      if (wasHit('KeyC') && !this.hcfg.armor) { this.disguised = !this.disguised; this.disguiseProps.visible = this.disguised; sfx.pop(); ui.toast(this.disguised ? 'Disguised! Guards notice you less (no smash/grapple).' : 'Disguise off.', 1600); }
      if (wasHit('KeyF') && !this.disguised && !this.hook) this.tryGrapple();
    }

    // gates & breakables
    for (const pl of this.platforms) {
      const d = pl.def; if (!d) continue;
      if (d.gate) { const open = this.need(d.gate); if (!pl.broken) { pl.solid = !open; pl.mesh.visible = !open; } }
      if (d.appear) { const on = this.need(d.appear); pl.solid = on; pl.mesh.visible = on; }
    }

    this.updateThings(dt);
    this.updateGuards(dt);
    this.updateCarrots(dt);
    this.updateCountdown(dt);
    this.interact(dt);
    this.updateHud();
  }

  tryGrapple() {
    const from = this.pos.clone(); from.y += 1.2; let best = null, bd = 20;
    const fx = Math.sin(this.face), fz = Math.cos(this.face);
    for (const t of this.things) {
      if (t.type !== 'anchor') continue;
      const d = t.v.distanceTo(from); if (d > bd || d < 3) continue;
      const dot = ((t.v.x - from.x) * fx + (t.v.z - from.z) * fz) / (d || 1);
      if (dot < -0.3) continue;
      bd = d; best = t;
    }
    if (best) { this.hook = { target: best.v.clone(), t: 0 }; sfx.pull(); }
    else ui.toast('No grapple anchor in range.', 1000);
  }

  updateThings(dt) {
    const chars = [this.chars[this.active], ...(this.unlocked[this.other()] ? [this.chars[this.other()]] : [])];
    const who = [{ n: this.active, p: this.pos }];
    if (this.unlocked[this.other()]) who.push({ n: this.other(), p: this.chars[this.other()].pos });
    for (const t of this.things) {
      if (t.type === 'plate') {
        let occ = false;
        for (const w of who) if (dist2(w.p, t.v) < (t.r ?? 1.4) && Math.abs(w.p.y - t.v.y) < 0.8 && (!t.heavy || w.n === 'wolf')) occ = true;
        if (occ) { if (!this.flags[t.flag]) sfx.pop(); this.setFlag(t.flag, true); t.on = true; } else if (!t.latch) { this.setFlag(t.flag, false); t.on = false; }
        t.mesh.position.y = t.v.y + (t.on ? 0.02 : 0.08);
      } else if (t.type === 'anchor') t.mesh.rotation.y += dt * 2;
      else if (t.type === 'item' && !t.got) {
        t.mesh.rotation.y += dt * 2; t.mesh.position.y = t.v.y + Math.sin(this.t2 * 3) * 0.1;
        if (dist2(this.pos, t.v) < 1.3 && Math.abs(this.pos.y - t.v.y) < 2.4) {
          t.got = true; this.scene.remove(t.mesh); this.counts[t.key] = (this.counts[t.key] ?? 0) + 1; sfx.coin();
          ui.toast(`${t.name ?? 'Item'} ${this.counts[t.key]}/${t.of}`, 1800);
          if (this.counts[t.key] >= t.of) { this.setFlag(t.flag); ui.toast(t.doneMsg ?? 'All collected!', 3500); }
        }
      }
      else if (t.type === 'gear') { t.mesh.rotation.y += dt * 1.5; t.mesh.position.y = t.v.y + 1.4 + Math.sin(this.t2 * 2) * 0.2; }
      else if (t.type === 'mini') { t.mesh.children[1].rotation.z += dt; t.pad.material = mat(this.flags[t.flag] ? 0x2faa60 : 0x7a3adb, this.flags[t.flag] ? 0x115533 : 0x3a1a8a); }
    }
    if (this.hidden) this.hare.visible = false;
  }

  updateGuards(dt) {
    const ph = this.pos, stealth = this.stealthFactor();
    for (const g of this.guards) {
      g.alert = Math.max(0, g.alert - dt);
      const tgt = g.path[g.i], m = g.mesh.position;
      if (g.wait > 0) g.wait -= dt;
      else {
        const dx = tgt[0] - m.x, dz = tgt[1] - m.z, d = Math.hypot(dx, dz);
        if (d < 0.2) { g.i = (g.i + 1) % g.path.length; g.wait = 0.8; }
        else { m.x += dx / d * g.speed * dt; m.z += dz / d * g.speed * dt; g.mesh.rotation.y = lerpAngle(g.mesh.rotation.y, Math.atan2(dx, dz), damp(6, dt)); }
      }
      if (g.mesh.children[0].userData && this.robotHares) { /* legs animate */ }
      g.sect.material.color.setHex(g.alert > 0 ? 0xff3a3a : 0xffe36b); g.sect.material.opacity = g.alert > 0 ? 0.4 : 0.22;
      if (this.hidden || this.invuln > 0) continue;
      const dx = ph.x - m.x, dz = ph.z - m.z, d = Math.hypot(dx, dz);
      if (Math.abs(ph.y - m.y) > 3) continue;
      const seen = d < g.view * stealth;
      let diff = Math.abs(((Math.atan2(dx, dz) - g.mesh.rotation.y + Math.PI) % TAU + TAU) % TAU - Math.PI);
      if ((seen && diff < g.fov / 2) || d < 1.9) { g.alert = 1.5; this.respawn(g.kind === 'robot' ? 'Zapped by a Robot Hare!' : 'Spotted by security!'); }
    }
  }

  updateCarrots(dt) {
    for (let i = this.carrots.length - 1; i >= 0; i--) {
      const k = this.carrots[i]; k.m.rotation.y += dt * 2.2; k.m.position.y = k.base + Math.sin(this.t2 * 3 + i) * 0.12;
      const cp = this.pos; if (Math.abs(cp.x - k.p.x) < 1.1 && Math.abs(cp.z - k.p.z) < 1.1 && cp.y < k.p.y + 1.6 && cp.y + this.P.H > k.p.y - 0.2) {
        this.scene.remove(k.m); this.carrots.splice(i, 1); this.ctx.save.addCarrot(k.id); sfx.coin();
        ui.toast(`🥕 Golden Carrot! ${this.carrotsHere()}/${this.hcfg.carrots.length}  (total ${this.ctx.save.carrotTotal()}/100)`, 1600);
      }
    }
  }

  updateCountdown(dt) {
    const cd = this.hcfg.countdown; if (!cd) return;
    if (this.flags[cd.start] && !this.flags[cd.end]) {
      if (this.cdT === undefined) { this.cdT = cd.seconds; ui.toast(cd.begin ?? 'The clock is ticking!', 3000); }
      this.cdT -= dt;
      ui.bar('a', cd.label ?? 'Time', this.cdT / cd.seconds, this.cdT < 15);
      if (this.cdT <= 0) { this.cdT = cd.seconds; this.respawn(cd.fail ?? 'Out of time! Try again.'); }
    } else if (this.flags[cd.end]) ui.bar('a', null);
  }

  interact(dt) {
    let best = null, bd = 99, label = null;
    const p = this.pos, a = this.active;
    for (const t of this.things) {
      let r = 2.3, lab = null, ok = false;
      if (t.type === 'lever') { ok = true; lab = this.flags[t.flag] ? 'E: toggle lever' : 'E: pull lever'; }
      else if (t.type === 'mini') { ok = true; r = 2.6; lab = this.flags[t.flag] && !t.replay ? 'Completed ✔ (E: replay)' : `E: ${t.label ?? 'start'}`; if (t.needs && !this.need(t.needs)) lab = t.lockText ?? 'Locked: finish the other objectives first'; }
      else if (t.type === 'hide' && a === 'hare') { ok = true; lab = 'E: hide in here'; }
      else if (t.type === 'rescue' && a === 'hare' && !this.flags[t.flag]) { ok = true; r = 2.8; lab = t.needs && !this.need(t.needs) ? (t.lockText ?? 'Not yet…') : 'Hold E: free the Wolf'; }
      else if (t.type === 'sign') { ok = true; r = 4.2; lab = t.text; t.signOnly = true; }
      else if (t.type === 'gear') { ok = true; r = 2.2; lab = this.need(t.needs) ? '' : 'The Golden Gear is locked: finish the objectives!'; t.autogear = true; }
      if (!ok) continue;
      const d = dist2(p, t.v); if (d < r && Math.abs(p.y - t.v.y) < 3 && d < bd) { bd = d; best = t; label = lab; }
    }
    // breakable crates (Wolf)
    let crate = null;
    if (a === 'wolf' && !this.disguised) for (const pl of this.platforms) {
      if (!pl.def?.breakable || !pl.solid) continue;
      const dx = Math.max(Math.abs(p.x - pl.cur.x) - pl.w / 2, 0), dz = Math.max(Math.abs(p.z - pl.cur.z) - pl.d / 2, 0);
      if (Math.hypot(dx, dz) < 1.6 && p.y < pl.maxy && p.y + 2 > pl.miny) { crate = pl; break; }
    }
    if (this.hidden) { ui.hint('E: come out'); if (wasHit('KeyE')) { this.hidden = false; this.hare.visible = true; } return; }
    let text = best ? label : null;
    if (crate && !best) text = 'E: SMASH!';
    ui.hint(text);
    if (best && best.type === 'gear' && this.need(best.needs) && dist2(p, best.v) < 2.2) { this.collectGear(); return; }
    this.hold = (best && best.type === 'rescue') ? this.hold : 0;
    if (crate && !best && wasHit('KeyE')) { crate.broken = true; crate.solid = false; crate.mesh.visible = false; sfx.boom(); this.puff(crate.cur); ui.toast('SMASH!', 700); return; }
    if (!best) return;
    if (best.type === 'lever' && wasHit('KeyE')) { const v = !this.flags[best.flag]; this.setFlag(best.flag, v); best.stick.rotation.z = v ? -0.7 : 0.7; sfx.pull(); }
    else if (best.type === 'hide' && wasHit('KeyE')) { this.hidden = true; this.pos.set(best.v.x, best.v.y, best.v.z); sfx.pop(); ui.toast('Hidden! Guards can\'t see you.', 1200); }
    else if (best.type === 'mini' && wasHit('KeyE')) {
      if (best.needs && !this.need(best.needs)) { ui.toast(best.lockText ?? 'Finish the other objectives first!', 2000); return; }
      this.ctx.play(best.spec, (ok) => { if (ok) { this.setFlag(best.flag); ui.toast('Challenge complete! ✔', 2200); } });
    } else if (best.type === 'rescue' && !this.flags[best.flag]) {
      if (best.needs && !this.need(best.needs)) { if (wasHit('KeyE')) ui.toast(best.lockText ?? 'Not yet…', 2000); return; }
      if (isDown('KeyE')) { this.hold += dt; ui.bar('b', 'Freeing…', this.hold / 1.6); if (this.hold > 1.6) { this.hold = 0; ui.bar('b', null); this.unlockWolf(best); } }
      else { this.hold = 0; ui.bar('b', null); }
    }
  }

  unlockWolf(t) {
    this.setFlag(t.flag); this.unlocked.wolf = true; sfx.win();
    const w = this.chars.wolf; if (t.wolfTo) w.pos.set(...t.wolfTo);
    ui.toast('🐺 The Wolf joins you! Press Tab to swap characters.', 4000); this.updateHud();
  }

  puff(p) {
    for (let i = 0; i < 8; i++) {
      const s = sph(0.25, 0xd9d2c0, 5); s.position.set(p.x + (Math.random() - 0.5) * 2, p.y + Math.random() * 1.5, p.z + (Math.random() - 0.5) * 2); s.castShadow = false;
      this.scene.add(s); const v = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6); let life = 0.6;
      const tick = () => { life -= 0.016; s.position.addScaledVector(v, 0.016); v.y -= 0.2; s.scale.multiplyScalar(0.97); if (life > 0) setTimeout(tick, 16); else this.scene.remove(s); };
      tick();
    }
  }

  onResume() {
    ui.bar('a', null); ui.bar('b', null); this.refreshObjectives(); this.updateHud(); this.placeCamera(true); this.cdT = undefined;
    for (const k of ['KeyE', 'Space']) { /* swallow held keys */ }
  }

  collectGear() {
    if (this.done) return; this.done = true; ui.hint(null); ui.objectives([]); ui.bar('a', null); ui.bar('b', null);
    this.ctx.save.addGear(this.hcfg.id); this.ctx.win();
  }
}
