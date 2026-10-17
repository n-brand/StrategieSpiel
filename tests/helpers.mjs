// Gemeinsame Bausteine für die Unit-Tests: eine leere, übersichtliche Testwelt und Einheiten zum Hinstellen.

import * as E from '../public/js/game/engine.js';
import { UNITS } from '../public/js/game/rules.js';

// Alles Wiese, alles aufgedeckt, zwei Spieler: Hauptstadt von Spieler 0 bei (1,1), von Spieler 1 rechts unten
export function world(size = 9) {
  const s = E.newGame({ tribes: ['nord', 'stein'], size, seed: 42 });
  for (const t of s.tiles) Object.assign(t, { terrain: 'field', resource: null, village: false, ruin: false, building: null, road: false, owner: null, city: null });
  s.units = [];
  for (const p of s.players) p.explored.fill(1);
  const place = (city, x, y) => {
    Object.assign(city, { x, y, level: 1, pop: 0 });
    const tile = E.at(s, x, y);
    tile.city = city.id;
    for (const o of [tile, ...E.around(s, x, y)]) o.owner = city.id;
  };
  place(s.cities[0], 1, 1);
  place(s.cities[1], size - 2, size - 2);
  return s;
}

// Einheit mit vollen Lebenspunkten, sofort einsatzbereit
export function unit(s, p, type, x, y) {
  const def = UNITS[type];
  const u = { id: s.nextId++, type, owner: p, x, y, hp: def.hp, maxHp: def.hp, home: null, moved: false, attacked: false, done: false, kills: 0, veteran: false };
  s.units.push(u);
  return u;
}

export const has = (tiles, x, y) => tiles.some((t) => t.x === x && t.y === y);
