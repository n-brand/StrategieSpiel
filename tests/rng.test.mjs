// Unit-Tests des Zufalls mit Startwert: wiederholbar, gleichmäßig, Hilfsfunktionen korrekt.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, random, shuffle, pickWeighted } from '../public/js/game/rng.js';

describe('Zufall', () => {
  test('gleicher Startwert = gleiche Folge', () => {
    const a = makeRng(123);
    const b = makeRng(123);
    for (let i = 0; i < 50; i++) assert.equal(a(), b());
  });

  test('Werte liegen zwischen 0 und 1 und sind grob gleichverteilt', () => {
    const r = makeRng(9);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1);
      buckets[Math.floor(v * 10)]++;
    }
    for (const b of buckets) assert.ok(b > 1700 && b < 2300, `Eimer mit ${b}`);
  });

  test('der Zufall im Spielzustand läuft nach Speichern/Laden genauso weiter', () => {
    const s = { rng: 42 };
    random(s);
    const copy = JSON.parse(JSON.stringify(s));
    assert.equal(random(s), random(copy));
  });

  test('mischen behält alle Elemente', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8];
    const mixed = shuffle(makeRng(5), list);
    assert.deepEqual([...mixed].sort((a, b) => a - b), list);
    assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8], 'Original unverändert');
  });

  test('gewichtete Auswahl folgt den Gewichten', () => {
    const r = makeRng(1);
    const list = [{ id: 'a', weight: 9 }, { id: 'b', weight: 1 }];
    let a = 0;
    for (let i = 0; i < 5000; i++) if (pickWeighted(r, list).id === 'a') a++;
    assert.ok(a > 4300 && a < 4700, `a = ${a}`);
  });
});
