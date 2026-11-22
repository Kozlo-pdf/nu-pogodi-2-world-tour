const KEY = 'nupogodi2.v1';
const fresh = () => ({ carrots: {}, gears: {}, progress: 0 });
let data = fresh();
try { data = { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (e) { /* private mode */ }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };

export const save = {
  hasCarrot: (id) => !!data.carrots[id],
  addCarrot(id) { data.carrots[id] = 1; persist(); },
  carrotTotal: () => Object.keys(data.carrots).length,
  addGear(id) { data.gears[id] = 1; persist(); },
  gearCount: () => Object.keys(data.gears).length,
  get progress() { return data.progress; },
  setProgress(n) { if (n > data.progress) { data.progress = n; persist(); } },
  newGame() { data.progress = 0; data.gears = {}; persist(); },
  cheat() { data.progress = 99; for (let i = 0; i < 100; i++) data.carrots['cheat:' + i] = 1; persist(); },
};
