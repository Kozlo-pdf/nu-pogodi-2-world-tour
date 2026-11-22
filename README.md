# Nu, Pogodi! 2: World Tour & Time Chaos

A free, fan-made 3D slapstick adventure for the browser (three.js, no build step) and the sequel to
*Nu, Pogodi! The Grand Chase*. Two rivals, six worlds, one broken time machine.

**Honest scope note:** the original design pitch called for ~15 hours. This build contains the complete structure and
all six worlds, but each world is a compact hub. A first playthrough takes roughly **1–1.5 hours** (more for 100% of the carrots).

## What is in it
- **Dual protagonists** (Tab to swap): Hare = double jump, wall-jump, sneaking; Wolf = heavy, smashes crates, grapple hook, disguise.
- **Six semi-open hubs** with objectives, guards, pressure plates and gates, hide spots, collectibles and challenge pads:
  TV Studio, Olympic Village, Russian Fairytales, Savage Island, Midnight Museum & Circus, Dacha & Robot Apocalypse.
- **Challenges / bosses:** studio chase, velodrome, boar ride (3-lane runners); weightlifting; rope-rhythm boxing; Zmey Gorynych; 3-phase Mega-Robot Hare.
- **Four cinematics** (opening, island, invasion, ending) driven by a small timeline engine.
- **100 Golden Carrots** (16-17 per world) that unlock **Retro Cinema** (a pixel egg-catching bonus).
- **2-player split-screen versus** (Cat & Mouse).

Not included from the pitch: Slapstick Chess, a full set of 2D pixel episodes (there is one retro game), and the full 15-hour content volume.

## Run locally
On Windows double-click `PLAY.bat`. Otherwise (ES modules need HTTP):
```sh
python -m http.server 8000   # then open http://localhost:8000
```
Debug URLs: `play.html?level=N` (0-9 story order), `&auto=1` to skip the intro card, `?bonus=0|1`, `?cheat=1` (unlock everything).

## Layout
```
index.html, css/site.css     website          play.html, css/game.css   game shell + HUD
js/main.js        loop, menus, nested mini-games     js/levels.js    story order + bonus modes
js/worlds.js      the six hub definitions            js/hub.js       hub engine (chars, quests, guards)
js/platformer.js  3D platformer core                 js/runner.js    3-lane chase engine
js/duel.js        boss fights                        js/minis.js     rope boxing, weightlifting, retro eggs, versus
js/cutscene.js    cinematic engine + 4 scenes        js/save.js      localStorage progress
tests/            headless Chrome test pages (hubtest.html, sim.html)
```

## Deploy
Pushing to `main` deploys via GitHub Pages (`.github/workflows/pages.yml`, Settings > Pages > Source: GitHub Actions).

## Legal
Unofficial, non-commercial fan tribute; "Nu, pogodi!" and its characters belong to their rights holders. Code is MIT, see `LICENSE`.
