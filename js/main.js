import { THREE, wasHit, endFrame, bindTouch, disposeScene, makeHare, makeWolf, pollGamepad, setPadProfile, padHelp } from './common.js';
import { LEVELS, BONUS } from './levels.js';
import { ui } from './ui.js';
import { save } from './save.js';
import { sfx, unlockAudio, startMusic, toggleMute } from './audio.js';

setPadProfile({ square: 'KeyE', camRight: 'KeyZ', help: '🎮 ✕ jump · □ interact · △ swap · ○ grapple · R1 disguise · L1 sneak · R-stick camera · Options pause' });
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize(); bindTouch();

/* ---------- state ---------- */
let level = null, def = null, index = 0, running = false, paused = false, mini = null;
const ctx = {
  camera, save,
  win(msg) { finishLevel(msg); },
  lose(msg) { failLevel(msg); },
  play(spec, onDone) { playMini(spec, onDone); },
};

function clearHud() { ui.bar('a', null); ui.bar('b', null); ui.hint(null); ui.info(''); ui.objectives([]); ui.caption(null); ui.letterbox(false); }
function destroy(l) { if (!l) return; try { l.dispose && l.dispose(); } catch (e) { /* ignore */ } disposeScene(l.scene); }
function stats() { return `🥕 Golden Carrots ${save.carrotTotal()}/100   ⚙ Golden Gears ${save.gearCount()}/6`; }

/* ---------- building levels ---------- */
function build(d) {
  destroy(level); level = null; clearHud(); camera.up.set(0, 1, 0);
  def = d; level = d.make(ctx); ui.title(d.title); ui.hud(true);
}

function introCard(i) {
  index = i; mini = null; const d = LEVELS[i];
  if (d.kind === 'cutscene') { build(d); running = true; paused = false; ui.hideCard(); unlockAudio(); startMusic(); return; }
  build(d); running = false; paused = false;
  ui.card({
    kicker: d.act, title: d.title, body: d.intro, controls: d.controls + '\n' + stats(),
    buttons: [{ label: 'Let\'s go!  (Enter)', onClick: begin }, { label: 'Main menu', onClick: menu }],
  });
}
function begin() { unlockAudio(); startMusic(); ui.hideCard(); running = true; paused = false; }
function restart() { if (mini) { const m = mini; level = null; build2(m.spec); running = true; ui.hideCard(); return; } build(def); running = true; paused = false; ui.hideCard(); }
function build2(spec) { destroy(level); level = null; clearHud(); camera.up.set(0, 1, 0); level = spec.make(ctx); ui.title(spec.title); ui.hud(true); }

function bonusIntro(d) {
  mini = null; index = -1; build(d); running = false;
  ui.card({ kicker: 'Bonus', title: d.title, body: d.intro, controls: d.controls, buttons: [{ label: 'Play  (Enter)', onClick: begin }, { label: 'Main menu', onClick: menu }] });
}

/* ---------- mini-games launched from hubs ---------- */
function playMini(spec, onDone) {
  const parent = level; mini = { parent, parentDef: def, spec, onDone, parentTitle: def.title };
  clearHud(); running = false;
  level = spec.make(ctx); ui.title(spec.title); camera.up.set(0, 1, 0);
  ui.card({
    kicker: 'Challenge', title: spec.title, body: spec.intro, controls: spec.controls,
    buttons: [{ label: 'Start  (Enter)', onClick: begin }, { label: 'Back to the world', onClick: () => returnToHub(false) }],
  });
}
function returnToHub(ok) {
  if (!mini) return;
  const m = mini; destroy(level); level = m.parent; def = m.parentDef; mini = null;
  clearHud(); camera.up.set(0, 1, 0); ui.title(def.title); ui.hud(true); ui.hideCard();
  level.onResume && level.onResume();
  running = true; paused = false;
  m.onDone(ok);
}

/* ---------- results ---------- */
function finishLevel(msg) {
  if (!running) return;
  running = false;
  if (mini) {
    sfx.win(); clearHud();
    ui.card({ kicker: 'Challenge complete!', title: mini.spec.title, body: msg ?? 'Well done!', buttons: [{ label: 'Back to the world  (Enter)', onClick: () => returnToHub(true) }] });
    return;
  }
  sfx.win(); clearHud();
  if (def.bonus) {
    ui.card({ kicker: 'Result', title: def.title, body: msg ?? 'Well done!', buttons: [{ label: 'Play again', onClick: () => bonusIntro(def) }, { label: 'Main menu', onClick: menu }] });
    return;
  }
  save.setProgress(index + 1);
  const last = index >= LEVELS.length - 1;
  if (def.kind === 'cutscene') {
    if (last) return credits();
    return introCard(index + 1);
  }
  ui.card({
    kicker: 'World complete!', title: def.title, body: def.outro + '\n\n' + stats(),
    buttons: [{ label: 'Next  (Enter)', onClick: () => introCard(index + 1) }, { label: 'Replay world (collect more carrots)', onClick: () => introCard(index) }, { label: 'Main menu', onClick: menu }],
  });
}
function credits() {
  clearHud(); ui.hud(false);
  const all = save.carrotTotal() >= 100;
  ui.card({
    kicker: 'The End', title: 'Nu, zayats… NU, POGODI!',
    body: `Thank you for playing!\n\n${stats()}\n${all ? 'All 100 Golden Carrots found: Retro Cinema is unlocked in the Bonus menu!' : 'Find all 100 Golden Carrots to unlock the Retro Cinema bonus.'}`,
    buttons: [{ label: 'Main menu', onClick: menu }, { label: 'Play the story again', onClick: () => { save.newGame(); introCard(0); } }],
  });
}
function failLevel(msg) {
  if (!running) return;
  running = false; sfx.lose(); clearHud();
  ui.card({ kicker: 'Oh no!', title: 'Nu, pogodi!', body: msg || 'Try again!',
    buttons: [{ label: 'Retry  (Enter)', onClick: restart }, { label: mini ? 'Back to the world' : 'Main menu', onClick: mini ? () => returnToHub(false) : menu }] });
}
function pauseGame() {
  if (!running || (def && def.kind === 'cutscene')) return;
  running = false; paused = true;
  ui.card({
    title: 'Paused', body: (mini ? mini.spec.title : def.title) + '\n' + stats(), controls: mini ? '' : (def.controls ?? ''),
    buttons: [{ label: 'Resume  (Esc)', onClick: () => { running = true; paused = false; ui.hideCard(); } },
      { label: 'Restart', onClick: restart }, ...(mini ? [{ label: 'Back to the world', onClick: () => returnToHub(false) }] : []), { label: 'Main menu', onClick: () => { if (mini) { destroy(level); level = mini.parent; mini = null; } menu(); } }],
  });
}

/* ---------- menus ---------- */
function worldSelect() {
  const max = save.progress;
  ui.card({
    kicker: 'World select', title: 'Where to?', body: stats(),
    buttons: [...LEVELS.map((d, i) => (i <= max && d.kind === 'world' ? { label: `${d.title}`, onClick: () => introCard(i) } : null)).filter(Boolean),
      ...LEVELS.map((d, i) => (i <= max && d.kind === 'cutscene' ? { label: `🎬 ${d.title}`, onClick: () => introCard(i) } : null)).filter(Boolean), { label: '← Back', onClick: menu }],
  });
}
function bonusMenu() {
  const buttons = BONUS.map((d) => {
    const locked = d.unlock && save.carrotTotal() < d.unlock;
    return { label: locked ? `🔒 ${d.title} (find ${d.unlock} carrots: ${save.carrotTotal()}/${d.unlock})` : d.title, onClick: locked ? bonusMenu : () => bonusIntro(d) };
  });
  ui.card({ kicker: 'Bonus', title: 'Extra modes', body: stats(), buttons: [...buttons, { label: '← Back', onClick: menu }] });
}
function menu() {
  destroy(level); level = null; def = null; mini = null; index = 0; clearHud(); ui.hud(false); running = false; paused = false;
  const max = save.progress;
  const buttons = [{ label: max > 0 ? 'New game' : 'Play  (Enter)', onClick: () => { if (max > 0) save.newGame(); introCard(0); } }];
  if (max > 0 && max < LEVELS.length) buttons.unshift({ label: `Continue – ${LEVELS[Math.min(max, LEVELS.length - 1)].title}`, onClick: () => introCard(Math.min(max, LEVELS.length - 1)) });
  if (max > 0) buttons.push({ label: 'World select', onClick: worldSelect });
  buttons.push({ label: 'Bonus: 2-player & retro', onClick: bonusMenu });
  ui.card({
    kicker: 'A fan-made 3D slapstick adventure', title: 'Nu, Pogodi! 2: World Tour & Time Chaos',
    body: 'An accidental invention scatters the Hare and the Wolf across six chaotic worlds. Collect the Golden Gears to get home, while sabotaging each other at every turn.\n\n' + stats(),
    buttons,
  });
}

/* ---------- menu backdrop ---------- */
const menuScene = new THREE.Scene(); menuScene.background = new THREE.Color(0x1b1030);
{
  menuScene.add(new THREE.HemisphereLight(0xffe9d0, 0x442266, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(5, 10, 8); menuScene.add(sun);
  const g = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1, 32), new THREE.MeshStandardMaterial({ color: 0x4a3a7a })); g.position.y = -0.5; menuScene.add(g);
  const rift = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 10, 40), new THREE.MeshStandardMaterial({ color: 0x66aaff, emissive: 0x2255cc })); rift.position.set(0, 3, -4); menuScene.add(rift); menuScene.userData.rift = rift;
  const h = makeHare(), w = makeWolf(); h.position.set(-1.8, 0, 0); h.rotation.y = 0.5; w.position.set(1.8, 0, 0); w.rotation.y = -0.5; menuScene.add(h, w); menuScene.userData.actors = [h, w];
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  pollGamepad();
  if (wasHit('KeyM')) { const m = toggleMute(); ui.toast(m ? 'Sound off' : 'Sound on', 900); }
  if (ui.cardOpen) {
    if (wasHit('PadUp', 'ArrowUp')) ui.moveFocus(-1);
    else if (wasHit('PadDown', 'ArrowDown')) ui.moveFocus(1);
    else if (wasHit('PadA')) ui.clickFocused();
    else if (wasHit('Enter')) ui.enter();
    else if (paused && wasHit('Escape', 'KeyP')) ui.clickPrimary();
  } else if (running && level && (!def || def.kind !== 'cutscene' || mini)) {
    if (wasHit('Escape', 'KeyP')) pauseGame();
    else if (wasHit('KeyR')) restart();
  }
  if (running && level) { level.update(dt); }
  if (level) { if (level.render) level.render(renderer); else renderer.render(level.scene, camera); }
  else {
    const t = performance.now() / 1000;
    (menuScene.userData.actors || []).forEach((a, i) => { a.position.y = Math.abs(Math.sin(t * 3 + i * 2)) * 0.3; });
    menuScene.userData.rift.rotation.z = t * 0.5;
    camera.up.set(0, 1, 0); camera.position.set(0, 2.4, 8); camera.lookAt(0, 1.8, 0);
    renderer.render(menuScene, camera);
  }
  endFrame();
}

/* ---------- boot ---------- */
const params = new URLSearchParams(location.search);
if (params.has('cheat')) save.cheat();
if (params.has('level')) {
  const n = Math.max(0, Math.min(LEVELS.length - 1, parseInt(params.get('level'), 10) || 0)); introCard(n);
  if (params.has('auto') && LEVELS[n].kind === 'world') begin();
} else if (params.has('bonus')) { bonusIntro(BONUS[Math.min(BONUS.length - 1, parseInt(params.get('bonus'), 10) || 0)]); if (params.has('auto')) begin(); }
else menu();
window.__game = { get level() { return level; }, get running() { return running; }, begin, ctx };
frame();

/* ---------- controller hint ---------- */
addEventListener('gamepadconnected', (e) => {
  ui.toast('🎮 Controller connected: ' + e.gamepad.id.split('(')[0].trim(), 3000);
  const k = document.getElementById('keys-help'); if (k) { k.textContent = padHelp(); k.style.opacity = 0.9; }
});
