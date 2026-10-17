// Lässt Computergegner ganze Partien gegeneinander spielen und prüft dabei, dass nichts kaputtgeht:
// keine zwei Einheiten auf einem Feld, Einheiten nur auf begehbarem Land, Lebenspunkte und Sterne gültig,
// jede Partie endet (30 Runden oder Eroberung). Gibt eine kurze Statistik je Partie aus, zum Schluss, in welcher
// Runde die Eroberungspartien enden.
// Aufruf: node tools/sim.mjs [Anzahl Partien]

import * as E from '../public/js/game/engine.js';
import { playTurn } from '../public/js/game/ai.js';
import { isLand } from '../public/js/game/rules.js';

const games = Number(process.argv[2] || 8);
const setups = [
  { tribes: ['nord', 'stein'], size: 11, mapType: 'pangaea' },
  { tribes: ['eben', 'sand', 'nord'], size: 14, mapType: 'archipelago' },
  { tribes: ['stein', 'eben', 'sand', 'nord'], size: 16, mapType: 'continents' },
  { tribes: ['sand', 'stein', 'eben'], size: 14, mapType: 'drylands' },
];
const modes = ['perfection', 'domination'];
const difficulties = ['easy', 'normal', 'hard', 'crazy'];

function check(s) {
  const seen = new Set();
  for (const u of s.units) {
    const key = `${u.x},${u.y}`;
    if (seen.has(key)) return `zwei Einheiten auf ${key}`;
    seen.add(key);
    const t = E.at(s, u.x, u.y);
    if (!t) return `Einheit ${u.id} außerhalb der Karte`;
    if (Boolean(u.naval) === isLand(t.terrain)) return `Einheit ${u.id} (${u.type}/${u.naval}) falsch auf ${t.terrain} bei ${key}`;
    if (u.naval === 'boat' && t.terrain === 'ocean') return `Boot ${u.id} auf dem Ozean bei ${key}`;
    if (!(u.hp > 0 && u.hp <= u.maxHp)) return `Einheit ${u.id} hat ${u.hp}/${u.maxHp} LP`;
    if (!s.players[u.owner].alive) return `Einheit ${u.id} gehört einem ausgeschiedenen Spieler`;
  }
  for (const p of s.players) if (!(p.stars >= 0) || !Number.isFinite(p.stars)) return `Spieler ${p.index} hat ${p.stars} Sterne`;
  for (const c of s.cities) {
    const t = E.at(s, c.x, c.y);
    if (t.city !== c.id) return `Stadt ${c.name} nicht auf ihrem Feld`;
    if (c.pop < 0 || c.level < 1) return `Stadt ${c.name} ungültig (${c.level}/${c.pop})`;
  }
  return null;
}

let failed = 0;
const conquests = []; // Eroberungspartien: Runde des Siegs, null = kein Ende bis Runde 80
const t0 = performance.now();
for (let g = 0; g < games; g++) {
  const setup = setups[g % setups.length];
  const mode = modes[Math.floor(g / setups.length) % modes.length];
  const difficulty = difficulties[g % difficulties.length];
  const s = E.newGame({ ...setup, seed: 1000 + g, mode, difficulty });
  s.players.forEach((p) => (p.human = false));
  let error = check(s);
  let steps = 0;
  while (!s.over && !error && steps < 2000) {
    playTurn(s);
    error = check(s);
    if (error) break;
    E.endTurn(s);
    steps++;
    if (mode === 'domination' && s.turn > 80) break;
  }
  const summary = s.players
    .map((p) => {
      const cities = E.playerCities(s, p.index);
      const boats = E.playerUnits(s, p.index).filter((u) => u.naval).length;
      return `${p.tribe}: ${cities.length} St. (Stufen ${cities.map((c) => c.level).join('/') || '–'}), ${E.playerUnits(s, p.index).length} Einh. (${boats} Schiffe), ${p.techs.length} Tech, ${E.scoreOf(s, p.index).total} P${p.alive ? '' : ' ✝'}`;
    })
    .join(' | ');
  const turn = s.over?.turn;
  if (mode === 'domination') conquests.push(s.over ? turn : null);
  const end = s.over ? `${s.over.reason}, Sieger ${s.players[s.over.winner]?.tribe}, Runde ${turn}` : `kein Ende (Runde ${s.turn})`;
  const ok = !error && (s.over || mode === 'domination');
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} Partie ${g + 1} (${setup.mapType} ${setup.size}×${setup.size}, ${mode}, ${difficulty}): ${end}${error ? ` – FEHLER: ${error}` : ''}\n    ${summary}`);
}
if (conquests.length) {
  const won = conquests.filter((t) => t != null);
  const avg = won.length ? ` (Ø ${Math.round(won.reduce((a, b) => a + b, 0) / won.length)})` : '';
  console.log(`Eroberung: ${won.length} von ${conquests.length} Partien mit Sieger vor Runde 81 – Runden ${conquests.map((t) => t ?? '–').join(', ')}${avg}`);
}
console.log(`${((performance.now() - t0) / games / 1000).toFixed(2)} s pro Partie`);
if (failed) process.exit(1);
