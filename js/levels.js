import { Cutscene, CUTSCENES } from './cutscene.js';
import { RetroEggs, Versus } from './minis.js';
import { tvStudio, olympics, fairytale, island, museum, dacha } from './worlds.js';

const HUB = 'WASD / Arrows: move  •  Space: jump  •  Tab: swap Hare/Wolf  •  E: interact  •  Shift: Hare sneaks  •  F: Wolf grapples  •  C: Wolf disguise  •  Q / Z: camera  •  R: restart';

/** Main story order. */
export const LEVELS = [
  { kind: 'cutscene', act: 'Prologue', title: 'The Midnight Break-In', make: (c) => new Cutscene(c, CUTSCENES.opening) },
  {
    kind: 'world', act: 'Act 1 · Modern Mayhem', title: 'World 1 – The Ostankino TV Studio',
    intro: 'The first Golden Gear landed inside a live broadcast studio. The Hare must sneak past the Hippo guards while the Wolf disguises himself as a cameraman. Work as a team: Tab swaps between them, and one can hold a pressure plate while the other slips through!',
    controls: HUB, outro: 'The Wolf accidentally broadcast his own defeat live across the country! Golden Gear #1 recovered. A rift opens, next stop: the Olympic Village!', make: tvStudio,
  },
  {
    kind: 'world', act: 'Act 1 · Modern Mayhem', title: 'World 2 – The 1980 Olympic Village',
    intro: 'The second Golden Gear has been mistakenly awarded as an Olympic trophy! Compete in (and sabotage) the events: velodrome, weightlifting, gymnastics, and a boxing match against a heavyweight Bear.',
    controls: HUB, outro: 'The Bear is down, the trophy is yours: Golden Gear #2! Another rift tears open…', make: olympics,
  },
  {
    kind: 'world', act: 'Act 2 · Surreal Worlds', title: 'World 3 – The Realm of Russian Fairytales',
    intro: 'A time rift drops the duo into a storybook forest. Baba Yaga double-crossed the Wolf and locked him in her dungeon. As the Hare, wake the flying carpets with three magic apples, free your rival, then take on the three-headed dragon Zmey Gorynych together.',
    controls: HUB, outro: 'Zmey Gorynych is defeated: Golden Gear #3! The rift pulls the pair toward a tropical sky…', make: fairytale,
  },
  { kind: 'cutscene', act: 'Act 2', title: 'A Royal Misunderstanding', make: (c) => new Cutscene(c, CUTSCENES.island) },
  {
    kind: 'world', act: 'Act 2 · Surreal Worlds', title: 'World 4 – The Savage Tropical Island',
    intro: 'Crash-landed in a torn balloon, the Wolf is bubbling in a cooking pot, and the tribe thinks the Hare is their king! Pass the three tribal trials, lure the tribe away on a wild boar, then untie the Wolf before the volcano erupts.',
    controls: HUB, outro: 'The Wolf is free and the temple crates are smashed: Golden Gear #4! The volcano erupts and the rift swallows them both…', make: island,
  },
  {
    kind: 'world', act: 'Act 3 · The Grand Finale', title: 'World 5 – The Midnight Museum & Circus',
    intro: 'Ancient exhibits come alive beside circus performers. The Wolf is stuck in a suit of cursed armor: loud, slow and impossible to take off. Sneak, hide in sarcophagi, walk a tightrope above the lions and fire yourself from a cannon to reach the big top.',
    controls: HUB, outro: 'Golden Gear #5 is yours! Only one gear left, and it is back home…', make: museum,
  },
  { kind: 'cutscene', act: 'Final Chapter', title: 'Attack of the Clones', make: (c) => new Cutscene(c, CUTSCENES.invasion) },
  {
    kind: 'world', act: 'Final Chapter', title: 'The Dacha & the Robot Apocalypse',
    intro: 'The broken machine has mass-produced an army of laser-eyed Robot Hares! Gather the beehives, fireworks and harvester keys, then climb into the combine harvester and take down the Mega-Robot Hare, together.',
    controls: HUB, outro: 'The Mega-Robot collapses and the rift seals shut. Peace returns to the garden… almost.', make: dacha,
  },
  { kind: 'cutscene', act: 'Ending', title: 'Back to Normal', make: (c) => new Cutscene(c, CUTSCENES.ending) },
];

/** Bonus modes (not part of the story). */
export const BONUS = [
  {
    bonus: true, title: 'Cat & Mouse (2-player versus)', intro: 'Same keyboard, split screen! Player 1 is the Hare (WASD); Player 2 is the Wolf (arrow keys).',
    controls: 'P1: WASD   •   P2: Arrow keys', make: (c) => new Versus(c),
  },
  {
    bonus: true, title: 'Retro Cinema – Episode 1', intro: 'The classic handheld game, rebuilt in pixels: catch the falling eggs with the Wolf\'s basket!',
    controls: 'Q ↖   A ↙   P ↗   L ↘   (or arrow keys)', unlock: 100, make: (c) => new RetroEggs(c),
  },
];
