// Unit-Tests der Kartenerzeugung: wiederholbar, alle Hauptstädte über Land erreichbar, faire Startgebiete.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../public/js/game/mapgen.js';
import { tribeById, isLand } from '../public/js/game/rules.js';

const TRIBES = ['nord', 'stein', 'eben', 'sand'];
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const seeds = Array.from({ length: 25 }, (_, i) => i + 1);

function landReach(map, from) {
  const at = (x, y) => map.tiles[y * map.size + x];
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length) {
    const t = queue.pop();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = t.x + dx;
        const y = t.y + dy;
        if (x < 0 || y < 0 || x >= map.size || y >= map.size) continue;
        const o = at(x, y);
        if (!seen.has(`${x},${y}`) && isLand(o.terrain)) {
          seen.add(`${x},${y}`);
          queue.push(o);
        }
      }
    }
  }
  return seen;
}

describe('Kartenerzeugung', () => {
  test('gleicher Startwert ergibt die gleiche Karte, anderer eine andere', () => {
    const a = generateMap({ size: 14, tribes: TRIBES.slice(0, 3), seed: 7 });
    const b = generateMap({ size: 14, tribes: TRIBES.slice(0, 3), seed: 7 });
    const c = generateMap({ size: 14, tribes: TRIBES.slice(0, 3), seed: 8 });
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.tiles, c.tiles);
  });

  test('alle Hauptstädte sind über Land verbunden', () => {
    for (const seed of seeds) {
      const map = generateMap({ size: 16, tribes: TRIBES, seed });
      const reach = landReach(map, map.capitals[0]);
      for (const cap of map.capitals) assert.ok(reach.has(`${cap.x},${cap.y}`), `Seed ${seed}`);
    }
  });

  test('Hauptstädte liegen weit auseinander und nicht am Rand', () => {
    for (const seed of seeds) {
      const map = generateMap({ size: 16, tribes: TRIBES, seed });
      for (const cap of map.capitals) {
        assert.ok(cap.x >= 1 && cap.y >= 1 && cap.x <= 14 && cap.y <= 14, `Seed ${seed}: Rand`);
        for (const o of map.capitals) if (o !== cap) assert.ok(cheb(cap, o) >= 5, `Seed ${seed}: zu nah`);
      }
    }
  });

  test('Dörfer haben Abstand zueinander und zu Hauptstädten', () => {
    for (const seed of seeds) {
      const map = generateMap({ size: 14, tribes: TRIBES.slice(0, 3), seed });
      const villages = map.tiles.filter((t) => t.village);
      assert.ok(villages.length >= 6, `Seed ${seed}: nur ${villages.length} Dörfer`);
      for (const v of villages) {
        assert.equal(v.terrain, 'field');
        for (const cap of map.capitals) assert.ok(cheb(v, cap) >= 3);
        for (const o of villages) if (o !== v) assert.ok(cheb(v, o) >= 3);
      }
    }
  });

  test('jede Hauptstadt hat mindestens zwei Ressourcen passend zur Start-Technik', () => {
    for (const seed of seeds) {
      const map = generateMap({ size: 16, tribes: TRIBES, seed });
      map.capitals.forEach((cap, i) => {
        const want = tribeById(TRIBES[i]).start;
        const near = map.tiles.filter((t) => cheb(t, cap) === 1 && t.resource === want);
        assert.ok(near.length >= 2, `Seed ${seed}, ${TRIBES[i]}: ${near.length}× ${want}`);
      });
    }
  });

  test('Ressourcen passen zum Gelände', () => {
    const fits = { fruit: 'field', crop: 'field', animal: 'forest', ore: 'mountain', fish: 'shallow', whale: 'ocean' };
    for (const seed of seeds) {
      const map = generateMap({ size: 16, tribes: TRIBES, seed });
      for (const t of map.tiles) if (t.resource) assert.equal(t.terrain, fits[t.resource], `Seed ${seed}: ${t.resource} auf ${t.terrain}`);
    }
  });

  test('Inselkarten: jede Hauptstadt liegt an der Küste (sonst kein Hafen möglich)', () => {
    for (const type of ['archipelago', 'continents']) {
      for (const seed of seeds) {
        const map = generateMap({ size: 14, tribes: TRIBES.slice(0, 3), seed, type });
        for (const cap of map.capitals) {
          const near = map.tiles.filter((t) => cheb(t, cap) === 1);
          assert.ok(near.some((t) => !isLand(t.terrain)), `${type}, Seed ${seed}: Hauptstadt ${cap.x},${cap.y} ohne Küste`);
          assert.ok(near.filter((t) => isLand(t.terrain)).length >= 4, `${type}, Seed ${seed}: zu wenig Land`);
        }
      }
    }
  });

  test('Inselkarten haben mehr Wasser und Ruinen draußen auf dem Ozean', () => {
    const map = generateMap({ size: 16, tribes: TRIBES, seed: 3, type: 'archipelago' });
    const land = map.tiles.filter((t) => isLand(t.terrain)).length;
    assert.ok(land < 256 * 0.5, `${land} Landkacheln`);
    assert.ok(map.tiles.some((t) => t.ruin && t.terrain === 'ocean'));
  });

  test('Trockenland: gar kein Wasser – kein Flachwasser, kein Ozean, keine Fische', () => {
    for (const seed of seeds) {
      for (const size of [11, 14, 16]) {
        const map = generateMap({ size, tribes: TRIBES.slice(0, 2 + (seed % 3)), seed, type: 'drylands' });
        const wet = map.tiles.filter((t) => !isLand(t.terrain));
        assert.equal(wet.length, 0, `Seed ${seed}, ${size}×${size}: ${wet.length} Wasserkacheln`);
        assert.ok(!map.tiles.some((t) => t.resource === 'fish' || t.resource === 'whale'), `Seed ${seed}: Fisch/Wal`);
        assert.equal(map.capitals.length, 2 + (seed % 3));
      }
    }
  });

  test('Klimazonen: jede Kachel gehört zu einem der Stämme', () => {
    const map = generateMap({ size: 14, tribes: ['nord', 'sand'], seed: 4 });
    assert.ok(map.tiles.every((t) => ['nord', 'sand'].includes(t.climate)));
    assert.equal(map.tiles[map.capitals[0].y * 14 + map.capitals[0].x].climate, 'nord');
  });
});
