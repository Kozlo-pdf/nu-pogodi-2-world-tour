# Handoff: Nu, Pogodi! 2: World Tour & Time Chaos

Fan-made 3D slapstick adventure. Plain ES modules + three.js r160 (vendored in `vendor/`), no build step.

- Repo: https://github.com/Kozlo-pdf/nu-pogodi-2-world-tour
- Live: https://kozlo-pdf.github.io/nu-pogodi-2-world-tour/ (game: `/play.html`)
- Sibling (game 1): https://github.com/Kozlo-pdf/nu-pogodi-grand-chase (same engine lineage)
- Deploy: push to `main` -> `.github/workflows/pages.yml` (GitHub Pages, source "GitHub Actions"). The deploy occasionally fails with "Found 0 artifact(s)"; it is transient, re-run it (`gh run rerun <id>`).

## Status in one paragraph
All 10 story entries (4 cinematics + 6 worlds), 2 bonus modes, gamepad support, polished models and the website are built, pushed and deployed. Systems were verified with headless-Chrome tests and bots (see "Testing"); **nobody has hand-played it end to end**, so difficulty, pacing and feel are unverified. Real length is ~1-1.5 h by estimate (the original pitch said ~15 h; this is a compact vertical build of that design). The owner reported times of 33:31.01 and 29:20.56 ("Time to beat" is in README and on the site); it is unclear which game each belongs to, and the README still says 1-1.5 h for this game. Reconcile once known.

## Run / test
```sh
python -m http.server 8000          # or double-click PLAY.bat on Windows
# http://localhost:8000/play.html
```
Debug URLs: `play.html?level=N` (0-9 story order), `&auto=1` skip intro card, `?bonus=0|1`, `?cheat=1` (unlock everything + 100 carrots).
Opening `play.html` via `file://` cannot work (module CORS); the page shows an explanatory message.

Headless tests (Chrome, SwiftShader): serve the repo, then `chrome --headless=new --disable-gpu --enable-unsafe-swiftshader --virtual-time-budget=60000 --dump-dom "http://localhost:PORT/tests/<page>?<query>"` and read the `RESULT ...` line.
- `tests/hubtest.html?t=` `carrots | fence | barn | masks | trunks | rock | pond | cannon | carpet | flags | smash | guard`
- `tests/sim.html?t=` `studio | velo | boar | rope | lift | retro | versus | zmey | mega | cut-opening | cut-island | cut-invasion | cut-ending` (add `&smart=1` for the invulnerable pickup-grabbing boss bot)
- `tests/pad.html` gamepad mapping with mocked pads; `tests/showcase.html?g=A..H` renders the model kit.

## Architecture (js/)
| File | Role |
|---|---|
| `main.js` | render loop, menus, progress, **nested mini-games** (`ctx.play(spec, cb)` swaps the active level and returns to the hub), pause/restart |
| `levels.js` | story order (`LEVELS`) + bonus modes (`BONUS`); `kind: 'cutscene' \| 'world'` |
| `worlds.js` | the six hub definitions (platform lists, things, carrots, objectives, decor) + mini-game configs |
| `hub.js` | `Hub extends Platformer`: Hare/Wolf switching, quests/flags, guards, plates/gates, levers, anchors, hide spots, carrots, countdown, label sprites |
| `platformer.js` | movement + AABB collision; per-character params `this.P`; wall-jump, crumble, bounce, launch (cannon), ice, moving platforms |
| `runner.js` | 3-lane chase engine; `customRider`/`customChaser` hooks |
| `duel.js` | generic boss (zmey / robot): telegraphs, projectiles, ammo, phases, optional harvester vehicle |
| `minis.js` | `RopeBoss` (rhythm boxing), `WeightLift`, `RetroEggs` (2D canvas), `Versus` (split-screen) |
| `cutscene.js` | timeline cinematic engine + 4 scenes (`CUTSCENES`) |
| `props.js` | shared model kit (vehicles, creatures, trees, buildings); `common.js` has Hare/Wolf/Robot builders, input + gamepad |
| `ui.js`, `audio.js`, `save.js` | HUD/cards/objectives/captions, WebAudio sfx + rumble, localStorage (`nupogodi2.v1`) |

Conventions: platform coordinates are **top-centre** (`x,y,z` = top surface centre; `h` = thickness downward). Characters face +z locally, vehicles' front is -z. Hub `things` types: `plate lever anchor mini hide rescue sign item gear guard`. Gates: platform with `gate:[flags]` (open when all flags true), `appear:[flags]` (solid only when true), `breakable:true` (Wolf smash), `launch:[vx,vy,vz]` (cannon), `bounce`, `crumble`, `move`. Flags are plain strings in `hub.flags`; objectives list reads them.

## Controls (keyboard / PS4)
Move WASD/arrows/stick, jump Space/✕, interact E/□, swap Tab/△, grapple F/○, disguise C/R1, sneak Shift/L1, camera Q,Z / right stick, pause Esc/Options, restart R/Share, mute M/L3. Hub camera uses Q/Z because E is interact. Versus: P1 WASD (or pad 1), P2 arrows (or pad 2).

## Chapters (story order = `?level=N`)

### 0. Opening cinematic: "The Midnight Break-In" (`cutscene.js`, `CUTSCENES.opening`)
Lab set; Wolf drops from a vent, suction-cup misfire, grabs the red lever, rift scatters six gears, title card. ~38 s. Skippable with Enter/Space/Esc/Cross. Tested: `cut-opening`.

### 1. World 1: Ostankino TV Studio (`worlds.js: tvStudio`, id `tv`)
- Objectives: `cook`, `fence`, `rock`, then mini-game `chase` -> gear.
- Cooking: Wolf stands on a **heavy plate** (`plateA`) to open a gate while the Hare pulls the oven lever (inactive character keeps holding the plate).
- Fencing: **wall-jump tower** (two walls 3.2 apart, ledge flush with wall tops at y=8), Hare only. Tested `fence`.
- Rock: **grapple** across a 14-unit gap via two anchors; Wolf only. Tested `rock`.
- Control room gate needs all three flags; inside: `Live Broadcast Chase` (runner, Hippo chaser) then gear.
- Hippo guards patrol the lobby; Hare Shift-sneak or Wolf disguise (C) lowers detection.
- 17 carrots. Gotchas: label sprites fade by distance; the control room is the only place with the gear.

### 2. World 2: 1980 Olympic Village (`olympics`, id `olympics`)
- Objectives: `velo` (bike runner), `lift` (WeightLift: mash A/D alternately, 3 lifts / 24 s), `gym` (beam course with a moving beam, lever at the top), then `box` (RopeBoss, needs the other three) -> gear.
- RopeBoss: notes fall on A/S/D (or arrows/D-pad), hits damage the Bear (12 HP), misses damage the Wolf (5 HP).
- Javelin sliders cross the spawn path. 17 carrots. Not built: Slapstick Chess.

### 3. World 3: Russian Fairytales (`fairytale`, id `fairy`)
- Starts **Hare-only**; Wolf is caged at (-28,0,-27).
- `apples` (3 items: mushroom steps, witch hill, twin-trunk wall-jump) -> flying **carpets** appear (`appear:['apples']`, moving platforms bridging the chasm). Tested `trunks`, `carpet`.
- `wolfFree`: hold E at the dungeon (1.6 s) -> Tab unlocks.
- Zmey pad needs `wolfFree` -> `Duel` boss (HP 26, 3 phases, both characters selectable; Wolf throws do 2). Then gear.
- Witch guard patrols the hill. 17 carrots.

### 4. Cinematic: "A Royal Misunderstanding" (`CUTSCENES.island`)
Savage Hares kneel to the Hare, Wolf in the pot with a carrot crown, silent negotiation. ~26 s.

### 5. World 4: Savage Tropical Island (`island`, id `island`)
- Hare-only until the pot rescue. Trials: `trial1` temple traps (pendulums, crumbling, moving), `trial2` wall-jump "wall of masks" (tested `masks`), `trial3` spear-slider field.
- `boar` mini-game (runner on a boar, tribe chaser; needs all trials), which **starts an 80 s volcano countdown** (`cfg.countdown`); failing respawns and restarts it.
- Rescue at the pot (`wolfFree`), then Wolf **smashes the crate wall** (E, one crate per press; tested `smash`) to reach the gear.
- 17 carrots.

### 6. World 5: Midnight Museum & Circus (`museum`, id `museum`)
- Wolf wears **cursed armor** (`cfg.armor`): speed 4.9, detection x1.7, clank sfx, no disguise.
- `egypt`: Wolf holds a heavy plate to open the hall door, Hare sneaks past three guards using sarcophagus **hide** spots to the lever.
- `rope`: tightrope above lion sliders (falling respawns).
- `cannon`: jump on the cannon pad (`launch:[0,22,-21]`) to land on the big-top platform (tested `cannon`: lands at z=-30.9).
- Gear needs all three flags. 16 carrots.

### 7. Cinematic: "Attack of the Clones" (`CUTSCENES.invasion`)
Rift with red eyes, Robot Hare army, Mega-Robot, the rivals take the combine harvester. ~27 s.

### 8. Final chapter: The Dacha & the Robot Apocalypse (`dacha`, id `dacha`)
- `hive`: Wolf smashes the shed crates; `fire`: Hare wall-jumps the barn (tested `barn`); `keys`: Wolf **grapples** across the pond gap (tested `pond`).
- Robot Hare guards patrol the garden (zapping respawns you).
- `final`: `Duel` vs the 3-phase Mega-Robot in the **combine harvester** (HP 40, infinite carrots on Space, specials on E from pickups). Then gear -> ending cinematic. 16 carrots.

### 9. Ending cinematic: "Back to Normal" (`CUTSCENES.ending`)
Scrap pile, hose, bee, Wolf bounces off the well roof into the water, "Nu, zayats... NU, POGODI!". Shows the credits card with carrot/gear stats.

### Bonus modes (`levels.js: BONUS`)
- **Cat & Mouse** (`Versus`): split-screen via scissor viewports; Hare needs 6 carrots, Wolf needs 3 tags, 90 s. Sets `input.splitPads` so two controllers map to two players.
- **Retro Cinema** (`RetroEggs`): 2D canvas egg-catcher; unlocks at 100 carrots. Keys Q/A/P/L or arrows/D-pad; no face-button mapping.

## Save data
`localStorage['nupogodi2.v1'] = { carrots:{id:1}, gears:{id:1}, progress:n }`. "New game" clears progress/gears but **keeps carrots** (collected carrots are not re-collectable). Carrot ids are `<worldId>:<index>`; totals are 17+17+17+17+16+16 = 100 (tested `carrots`).

## Known issues / unverified
- No human playtest: all balance (boss HP, countdown 80 s, ship-style timers, guard views) is bot-estimated. The Duel bots only prove the win path with invulnerability; the harder Zmey/Mega fights may need tuning.
- `sim.html?t=rope` reports `won=false` because the win is a `setTimeout`; its `bearHp=0` is the real pass signal.
- Digital stick only (no analog speed); inactive character is not detected by guards; Hub guards only check the active character.
- Sprite labels (`makeLabel`) can still look large when the camera is very close (they fade, but are not size-clamped).
- Headless screenshots can miss the Hare because of the post-respawn invulnerability flicker (timing artifact, not a bug).
- Not built vs. the original pitch: Slapstick Chess, a full 2D pixel episode set (only the egg game), the 15 h content volume.

## Repo / identity notes
- History was rewritten once to remove a stray author identity; all commits are now `Kozlo-pdf <249961158+Kozlo-pdf@users.noreply.github.com>` (local `user.email` set in this repo). The GitHub contributors page now lists only `Kozlo-pdf`.
- `gh` is installed per-user (winget) at `%LOCALAPPDATA%\Microsoft\WinGet\Packages\GitHub.cli_*\bin\gh.exe` and logged in as `Kozlo-pdf` with `repo` + `workflow` scopes.
- Legal: unofficial non-commercial fan tribute; the "Nu, pogodi!" names/characters belong to their rights holders. All art/sound is original and procedural; code is MIT.

## Suggested next steps
1. Hand-play all six worlds; tune boss HP/phase timers and guard sight ranges.
2. Add analog movement from the stick and a pad-friendly Retro/Versus.
3. Add Slapstick Chess to World 2 and more side quests per hub to approach the original scope.
4. Move the debug test pages behind a `?debug` flag or into CI (e.g. a GitHub Action running the headless tests).
