// Unit-Tests der Computergegner: spielen nur erlaubte Züge, breiten sich aus und bringen Partien zu Ende.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/game/engine.js';
import { playTurn } from '../public/js/game/ai.js';
import { isLand } from '../public/js/game/rules.js';
import { world, unit } from './helpers.mjs';

// Zustand gültig? (keine Doppelbelegung, nur Land, gültige LP/Sterne, Städte auf ihren Feldern)
function invariant(s) {
  const seen = new Set();
  for (const u of s.units) {
    const key = `${u.x},${u.y}`;
    assert.ok(!seen.has(key), `zwei Einheiten auf ${key}`);
    seen.add(key);
    const water = !isLand(E.at(s, u.x, u.y).terrain);
    assert.equal(Boolean(u.naval), water, `Einheit ${u.id} (${u.type}, ${u.naval}) ${water ? 'im Wasser ohne Boot' : 'an Land als Boot'}`);
    if (u.naval === 'boat') assert.equal(E.at(s, u.x, u.y).terrain, 'shallow', `Boot ${u.id} auf dem Ozean`);
    assert.ok(u.hp > 0 && u.hp <= u.maxHp, `Einheit ${u.id}: ${u.hp}/${u.maxHp} LP`);
  }
  for (const p of s.players) assert.ok(p.stars >= 0, `Spieler ${p.index}: ${p.stars} Sterne`);
  for (const c of s.cities) assert.equal(E.at(s, c.x, c.y).city, c.id);
}

function botGame(opts) {
  const s = E.newGame(opts);
  s.players.forEach((p) => (p.human = false));
  return s;
}

describe('Computergegner', () => {
  test('ganze Partien (Perfektion) laufen ohne Regelverstoß bis Runde 30', () => {
    const setups = [
      { tribes: ['nord', 'stein'], size: 11, difficulty: 'easy' },
      { tribes: ['eben', 'sand', 'nord'], size: 14, difficulty: 'normal' },
      { tribes: ['stein', 'eben', 'sand', 'nord'], size: 16, difficulty: 'crazy' },
    ];
    setups.forEach((setup, i) => {
      const s = botGame({ ...setup, seed: 500 + i });
      while (!s.over) {
        playTurn(s);
        invariant(s);
        E.endTurn(s);
      }
      assert.equal(s.over.reason, 'turns');
    });
  });

  test('breiten sich aus: nach 10 Runden haben alle mehr als eine Stadt', () => {
    const s = botGame({ tribes: ['eben', 'sand', 'nord'], size: 14, seed: 77 });
    while (s.turn <= 10) {
      playTurn(s);
      E.endTurn(s);
    }
    for (const p of s.players) assert.ok(E.playerCities(s, p.index).length > 1, `${p.tribe} hat nur ${E.playerCities(s, p.index).length} Stadt`);
  });

  test('forschen und bauen ihre Wirtschaft aus (Städte + Aufstiege ≥ 4 bis Runde 12)', () => {
    for (const seed of [12, 13, 14]) {
      const s = botGame({ tribes: ['nord', 'stein'], size: 11, seed });
      while (s.turn <= 12) {
        playTurn(s);
        E.endTurn(s);
      }
      for (const p of s.players) {
        const cities = E.playerCities(s, p.index);
        const levelUps = cities.reduce((n, c) => n + c.level - 1, 0);
        // Wer viele Städte gründet, forscht teurer – deshalb zählt Forschung mit Städten zusammen
        assert.ok(p.techs.length >= 3 && p.techs.length + cities.length >= 6, `Seed ${seed}, ${p.tribe}: ${p.techs.length} Techniken, ${cities.length} Städte`);
        assert.ok(cities.length + levelUps >= 4, `Seed ${seed}, ${p.tribe}: ${cities.length} Städte, ${levelUps} Aufstiege`);
      }
    }
  });

  test('nimmt eine sichere Beute: schwache Einheit neben dem eigenen Schwertkämpfer', () => {
    const s = world();
    s.players[0].human = false;
    const sw = unit(s, 0, 'swordsman', 4, 4);
    const prey = unit(s, 1, 'warrior', 5, 4);
    prey.hp = 3;
    playTurn(s);
    assert.equal(E.unitById(s, prey.id), null);
    assert.ok(E.unitById(s, sw.id));
  });

  test('nimmt ein Dorf ein, auf dem die eigene Einheit steht', () => {
    const s = world();
    s.players[0].human = false;
    E.at(s, 4, 4).village = true;
    unit(s, 0, 'warrior', 4, 4);
    playTurn(s);
    assert.equal(E.cityAt(s, 4, 4)?.owner, 0);
  });

  test('wählt anstehende Stadt-Belohnungen selbst', () => {
    const s = world();
    s.players[0].human = false;
    E.addPop(s, s.cities[0], 2);
    playTurn(s);
    assert.deepEqual(s.cities[0].pending, []);
  });

  test('Inselkarten: Gegner bauen Häfen, fahren mit Booten und gründen Städte auf anderen Inseln', () => {
    let ports = 0;
    let embarks = 0;
    let overseasCities = 0;
    for (const seed of [41, 42, 43]) {
      const s = botGame({ tribes: ['nord', 'eben', 'sand'], size: 14, seed, mapType: 'archipelago' });
      // Welche Kacheln gehören zur Heimatinsel jeder Hauptstadt? (über Land erreichbar)
      const home = s.cities.map((c) => {
        const seen = new Set([E.idx(s, c.x, c.y)]);
        const queue = [c];
        while (queue.length) {
          const t = queue.pop();
          for (const o of E.around(s, t.x, t.y)) {
            const i = E.idx(s, o.x, o.y);
            if (!seen.has(i) && isLand(o.terrain)) {
              seen.add(i);
              queue.push(o);
            }
          }
        }
        return seen;
      });
      while (!s.over && s.turn <= 25) {
        const ev = playTurn(s);
        embarks += ev.filter((e) => e.type === 'move' && e.embark).length;
        invariant(s);
        E.endTurn(s);
      }
      ports += s.tiles.filter((t) => t.building === 'port').length;
      for (const c of s.cities) if (!home[c.owner]?.has(E.idx(s, c.x, c.y))) overseasCities++;
    }
    assert.ok(ports >= 2, `nur ${ports} Häfen`);
    assert.ok(embarks >= 3, `nur ${embarks}× eingeschifft`);
    assert.ok(overseasCities >= 2, `nur ${overseasCities} Städte auf fremden Inseln`);
  });

  test('Eroberungs-Partien: alle Züge bleiben gültig', () => {
    const s = botGame({ tribes: ['stein', 'nord'], size: 11, seed: 31, mode: 'domination', difficulty: 'hard' });
    while (!s.over && s.turn <= 40) {
      playTurn(s);
      invariant(s);
      E.endTurn(s);
    }
  });
});

describe('Computergegner im Eroberungsmodus', () => {
  // Testwelt: Hauptstadt des Gegners bei (7,7), Runde 10 (ab Runde 7 voll angriffslustig)
  function conquestWorld() {
    const s = world();
    s.mode = 'domination';
    s.turn = 10;
    s.players[0].human = false;
    return s;
  }

  // Weitere Stadt in der Testwelt (Felder wie bei einer Gründung)
  function addCity(s, owner, x, y) {
    const city = { id: s.nextId++, x, y, owner, name: `Testort ${x}/${y}`, level: 1, pop: 0, capital: false, workshop: false, wall: false, parks: 0, border: 1, pending: [] };
    s.cities.push(city);
    const tile = E.at(s, x, y);
    tile.city = city.id;
    for (const o of [tile, ...E.around(s, x, y)]) if (o.owner == null) o.owner = city.id;
    return city;
  }

  test('nach dem Fall der Wache zieht noch im selben Zug eine Einheit in die leere Stadt', () => {
    const s = conquestWorld();
    const guard = unit(s, 1, 'defender', 7, 7);
    guard.hp = 3;
    unit(s, 0, 'catapult', 2, 7); // zu weit weg zum Schießen, zieht Richtung Stadt
    unit(s, 0, 'archer', 5, 7); // erledigt die Wache aus der Ferne (rückt nicht nach)
    unit(s, 0, 'warrior', 6, 6); // steht direkt neben der Stadt
    playTurn(s);
    assert.equal(E.unitById(s, guard.id), null, 'die Wache lebt noch');
    assert.equal(E.unitAt(s, 7, 7)?.owner, 0, 'niemand ist in die leere Stadt gezogen');
  });

  test('knackt eine ummauerte Stadt, wenn die vereinte Kraft für die Wache reicht', () => {
    const s = conquestWorld();
    s.cities[1].wall = true;
    const guard = unit(s, 1, 'defender', 7, 7);
    const army = [[6, 6], [6, 7], [7, 6]].map(([x, y]) => unit(s, 0, 'swordsman', x, y));
    army.push(unit(s, 0, 'knight', 6, 8));
    playTurn(s);
    assert.equal(E.unitById(s, guard.id), null, 'die Wache lebt noch');
    assert.equal(E.unitAt(s, 7, 7)?.owner, 0, 'niemand steht in der Stadt');
    // Schwertkämpfer zuerst, der Ritter gibt den Rest: niemand fällt
    for (const u of army) assert.ok(E.unitById(s, u.id), `${u.type} ist gefallen`);
  });

  test('holt für den gemeinsamen Angriff auch Einheiten aus der zweiten Reihe dazu', () => {
    const s = conquestWorld();
    s.cities[1].wall = true;
    const guard = unit(s, 1, 'defender', 7, 7);
    for (const [x, y] of [[6, 6], [6, 7], [7, 6]]) unit(s, 0, 'swordsman', x, y);
    const knight = unit(s, 0, 'knight', 4, 8); // erst per Vorstoß neben der Stadt …
    E.at(s, 2, 8).village = true; // … und ohne den Angriff wäre das Dorf sein nächstes Ziel
    playTurn(s);
    assert.equal(E.unitById(s, guard.id), null, 'die Wache lebt noch');
    assert.equal(E.unitAt(s, 7, 7), knight, 'der Ritter ist nicht nachgerückt');
  });

  test('besetzt eine schon leere Feindstadt, bevor es andere Kämpfe sucht', () => {
    const s = conquestWorld();
    const prey = unit(s, 1, 'warrior', 5, 5);
    prey.hp = 2; // leichte Beute auf der anderen Seite
    const w = unit(s, 0, 'warrior', 6, 6);
    playTurn(s);
    assert.equal(E.unitAt(s, 7, 7), w, 'der Krieger steht nicht in der leeren Stadt');
  });

  test('opfert keine Einheit, wenn die Kraft für die ummauerte Stadt nicht reicht', () => {
    const s = conquestWorld();
    s.cities[1].wall = true;
    const guard = unit(s, 1, 'defender', 7, 7);
    const sw = unit(s, 0, 'swordsman', 6, 6);
    playTurn(s);
    assert.equal(guard.hp, guard.maxHp, 'die Wache wurde angegriffen');
    assert.equal(sw.hp, sw.maxHp);
  });

  test('wirft für eine Stadt nicht mehr Einheiten weg, als sie wert ist', () => {
    const s = conquestWorld();
    s.cities[1].wall = true;
    addCity(s, 1, 7, 1);
    addCity(s, 1, 1, 7); // nicht die letzte Stadt des Gegners
    const guard = unit(s, 1, 'defender', 7, 7);
    // Vier Ritter schaffen es, aber zwei fielen dabei (16 ★) – mehr, als eine kleine Stadt wert ist
    const knights = [[6, 6], [6, 7], [7, 6], [6, 8]].map(([x, y]) => unit(s, 0, 'knight', x, y));
    playTurn(s);
    assert.equal(guard.hp, guard.maxHp, 'die Wache wurde angegriffen');
    for (const k of knights) assert.ok(E.unitById(s, k.id), 'ein Ritter ist gefallen');
  });

  test('der Verteidiger einer bedrohten eigenen Stadt bleibt, statt eine leere Feindstadt zu besetzen', () => {
    const s = conquestWorld();
    unit(s, 1, 'defender', 7, 7);
    const mine = addCity(s, 0, 4, 4);
    addCity(s, 1, 6, 4); // leer und in Reichweite des Reiters
    unit(s, 1, 'warrior', 4, 6); // bedroht die eigene Stadt
    const rider = unit(s, 0, 'rider', 4, 4);
    playTurn(s);
    assert.equal(E.unitAt(s, mine.x, mine.y), rider, 'der Reiter hat die eigene Stadt verlassen');
  });

  test('mehrere Einheiten ziehen gemeinsam auf dieselbe Feindstadt zu', () => {
    const s = conquestWorld();
    s.cities[1].wall = true;
    unit(s, 1, 'defender', 7, 7);
    const army = [[1, 3], [2, 3], [3, 2]].map(([x, y]) => unit(s, 0, 'warrior', x, y));
    const before = army.map((w) => E.dist(w, s.cities[1]));
    playTurn(s);
    army.forEach((w, i) => assert.ok(E.dist(w, s.cities[1]) < before[i], `Krieger ${i + 1} ist nicht näher gekommen`));
  });

  test('sucht weiter, solange ein Stamm lebt, von dem keine Stadt bekannt ist', () => {
    const s = conquestWorld();
    // Fast alles erkundet (77 von 81 Feldern) – nur die gegnerische Hauptstadt und drei Felder daneben nicht
    for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) s.players[0].explored[E.idx(s, x, y)] = 0;
    const w = unit(s, 0, 'warrior', 1, 7);
    playTurn(s);
    assert.ok(E.dist(w, s.cities[1]) < 6, 'der Krieger sucht nicht');
  });

  test('wählt bei der Eroberung auf Stufe 5 immer den Riesen statt des Parks', () => {
    const s = conquestWorld();
    s.difficulty = 'easy'; // sonst nimmt die KI den Riesen ohnehin oft
    E.addPop(s, s.cities[0], 14); // Stufe 1 → 5
    playTurn(s);
    assert.equal(s.cities[0].parks, 0, 'Park gewählt');
    assert.ok(s.units.some((u) => u.owner === 0 && u.type === 'giant'), 'kein Riese');
  });

  test('kleine Karten: meist gewinnt ein Stamm vor Runde 60', () => {
    const ends = [];
    for (let seed = 31; seed <= 40; seed++) {
      const s = botGame({ tribes: ['stein', 'nord'], size: 11, seed, mode: 'domination' });
      while (!s.over && s.turn < 60) {
        playTurn(s);
        invariant(s);
        E.endTurn(s);
      }
      ends.push(s.over ? s.turn : '–');
    }
    const won = ends.filter((t) => t !== '–').length;
    assert.ok(won >= 8, `nur ${won} von 10 Partien mit Sieger vor Runde 60 (Ende: ${ends.join(', ')})`);
  });
});
