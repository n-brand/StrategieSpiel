// Unit-Tests der Spiel-Engine: Kampf, Bewegung, Einnehmen, Städte, Forschung, Kachel-Aktionen, Runden, Speichern.
// Aufruf: npm test  (bzw. node --test)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/game/engine.js';
import { world, unit, has } from './helpers.mjs';

describe('Kampf', () => {
  test('Krieger gegen Krieger: 5 Schaden, 5 zurück', () => {
    const s = world();
    const a = unit(s, 0, 'warrior', 4, 4);
    const d = unit(s, 1, 'warrior', 5, 4);
    assert.deepEqual([E.combat(s, a, d).dmg, E.combat(s, a, d).ret], [5, 5]);
    E.attack(s, a.id, d.id);
    assert.equal(d.hp, 5);
    assert.equal(a.hp, 5);
  });

  test('verschanzt in der eigenen Stadt ×1,5, mit Mauer ×4', () => {
    const s = world();
    const a = unit(s, 0, 'warrior', 6, 7);
    const d = unit(s, 1, 'warrior', 7, 7); // auf der Hauptstadt von Spieler 1
    assert.equal(E.defenseBonus(s, d), 1.5);
    // 2 / (2 + 3) × 2 × 4,5 = 3,6 → 4; Rückschlag 3 / 5 × 2 × 4,5 = 5,4 → 5
    assert.deepEqual([E.combat(s, a, d).dmg, E.combat(s, a, d).ret], [4, 5]);
    s.cities[1].wall = true;
    assert.equal(E.defenseBonus(s, d), 4);
  });

  test('Gelände schützt nur mit der passenden Technik (Wald: Bogenschießen, Berg: Klettern)', () => {
    const s = world();
    const d = unit(s, 1, 'warrior', 4, 4);
    E.at(s, 4, 4).terrain = 'forest';
    assert.equal(E.defenseBonus(s, d), 1);
    s.players[1].techs.push('archery');
    assert.equal(E.defenseBonus(s, d), 1.5);
  });

  test('Verletzte Einheiten treffen schwächer', () => {
    const s = world();
    const a = unit(s, 0, 'warrior', 4, 4);
    const d = unit(s, 1, 'warrior', 5, 4);
    const full = E.combat(s, a, d).dmg;
    a.hp = 4;
    assert.ok(E.combat(s, a, d).dmg < full);
  });

  test('Bogenschütze greift aus 2 Feldern an, Krieger kann nicht zurückschlagen', () => {
    const s = world();
    const a = unit(s, 0, 'archer', 3, 4);
    const d = unit(s, 1, 'warrior', 5, 4);
    assert.deepEqual(E.attackTargets(s, a).map((u) => u.id), [d.id]);
    E.attack(s, a.id, d.id);
    assert.equal(a.hp, 10);
  });

  test('Katapult hat Reichweite 3, kann aber nicht nach dem Ziehen angreifen', () => {
    const s = world();
    const c = unit(s, 0, 'catapult', 2, 4);
    unit(s, 1, 'warrior', 5, 4);
    assert.equal(E.attackTargets(s, c).length, 1);
    E.move(s, c.id, 3, 4);
    assert.equal(E.canAttack(c), false);
  });

  test('Sieg im Nahkampf: Angreifer rückt nach; Fernkämpfer bleibt stehen', () => {
    const s = world();
    const a = unit(s, 0, 'swordsman', 4, 4);
    const d = unit(s, 1, 'warrior', 5, 4);
    d.hp = 3;
    const [ev] = E.attack(s, a.id, d.id);
    assert.equal(ev.kill, true);
    assert.deepEqual([a.x, a.y], [5, 4]);
    assert.equal(a.kills, 1);
    const b = unit(s, 0, 'archer', 2, 2);
    const e = unit(s, 1, 'warrior', 4, 2);
    e.hp = 2;
    E.attack(s, b.id, e.id);
    assert.deepEqual([b.x, b.y], [2, 2]);
  });

  test('Rückschlag kann den Angreifer besiegen', () => {
    const s = world();
    const a = unit(s, 0, 'warrior', 4, 4);
    a.hp = 2;
    const d = unit(s, 1, 'defender', 5, 4);
    const [ev] = E.attack(s, a.id, d.id);
    assert.equal(ev.retKill, true);
    assert.equal(E.unitById(s, a.id), null);
  });

  test('Nach dem Angriff: Reiter darf noch ziehen, Krieger nicht; Ritter greift nach Sieg erneut an', () => {
    const s = world();
    const r = unit(s, 0, 'rider', 4, 4);
    const t1 = unit(s, 1, 'warrior', 5, 4);
    E.attack(s, r.id, t1.id);
    assert.equal(E.canMove(r), true);
    const w = unit(s, 0, 'warrior', 2, 6);
    const t2 = unit(s, 1, 'warrior', 3, 6);
    E.attack(s, w.id, t2.id);
    assert.equal(E.canMove(w), false);
    const k = unit(s, 0, 'knight', 6, 2);
    const v = unit(s, 1, 'warrior', 7, 2);
    v.hp = 1;
    E.attack(s, k.id, v.id);
    assert.equal(E.canAttack(k), true);
  });

  test('Nicht am Zug: kein Angriff möglich', () => {
    const s = world();
    const a = unit(s, 1, 'warrior', 4, 4);
    const d = unit(s, 0, 'warrior', 5, 4);
    assert.deepEqual(E.attack(s, a.id, d.id), []);
    assert.equal(d.hp, 10);
  });

  test('Drei Siege: Beförderung gibt +5 LP und heilt voll', () => {
    const s = world();
    const u = unit(s, 0, 'warrior', 4, 4);
    u.kills = 3;
    u.hp = 2;
    E.promote(s, u.id);
    assert.deepEqual([u.maxHp, u.hp, u.veteran], [15, 15, true]);
    assert.equal(E.canPromote(u), false);
  });
});

describe('Bewegung', () => {
  test('Krieger: ein Feld in alle 8 Richtungen', () => {
    const s = world();
    assert.equal(E.moveTargets(s, unit(s, 0, 'warrior', 4, 4)).length, 8);
  });

  test('Reiter: zwei Felder, auch durch Wald; Berge beenden die Bewegung', () => {
    const s = world();
    s.players[0].techs.push('climbing');
    const u = unit(s, 0, 'rider', 4, 4);
    assert.equal(E.moveTargets(s, u).length, 24);
    const row = [[5, 3], [5, 4], [5, 5]];
    for (const [x, y] of row) E.at(s, x, y).terrain = 'forest';
    assert.ok(has(E.moveTargets(s, u), 6, 4), 'durch eine Waldreihe hindurch');
    for (const [x, y] of row) E.at(s, x, y).terrain = 'mountain';
    const t = E.moveTargets(s, u);
    assert.ok(has(t, 5, 4), 'auf den Berg');
    assert.equal(has(t, 6, 4), false, 'hinter einer Bergreihe ist Schluss');
  });

  test('im Waldland des Gegners zieht ein Reiter so weit wie im eigenen Land', () => {
    const s = world(11);
    for (const t of s.tiles) Object.assign(t, { terrain: 'forest', owner: t.x >= 5 ? s.cities[1].id : s.cities[0].id });
    const own = unit(s, 0, 'rider', 2, 5);
    const foreign = unit(s, 0, 'rider', 8, 5);
    assert.equal(E.tileOwner(s, E.at(s, 8, 5)), 1, 'steht im Gebiet des Gegners');
    assert.equal(E.moveTargets(s, own).length, 24);
    assert.equal(E.moveTargets(s, foreign).length, 24);
  });

  test('Berge nur mit Klettern', () => {
    const s = world();
    const u = unit(s, 0, 'warrior', 4, 4);
    E.at(s, 5, 4).terrain = 'mountain';
    assert.equal(has(E.moveTargets(s, u), 5, 4), false);
    s.players[0].techs.push('climbing');
    assert.equal(has(E.moveTargets(s, u), 5, 4), true);
  });

  test('Wasser ist (noch) nicht betretbar', () => {
    const s = world();
    const u = unit(s, 0, 'warrior', 4, 4);
    E.at(s, 5, 4).terrain = 'shallow';
    assert.equal(has(E.moveTargets(s, u), 5, 4), false);
  });

  test('Kontrollzone: neben einem Gegner endet die Bewegung', () => {
    const s = world();
    const u = unit(s, 0, 'rider', 3, 4);
    unit(s, 1, 'warrior', 6, 4);
    E.at(s, 4, 3).terrain = 'mountain';
    E.at(s, 4, 5).terrain = 'mountain';
    const t = E.moveTargets(s, u);
    assert.ok(has(t, 5, 4), 'Feld neben dem Gegner ist erreichbar');
    assert.equal(has(t, 6, 4), false, 'Gegnerfeld ist besetzt');
  });

  test('Gegner blockieren den Weg, eigene Einheiten nicht', () => {
    const s = world();
    const u = unit(s, 0, 'rider', 3, 4);
    for (const y of [3, 5]) E.at(s, 4, y).terrain = 'mountain';
    unit(s, 0, 'warrior', 4, 4);
    assert.ok(has(E.moveTargets(s, u), 5, 4), 'durch eigene Einheit hindurch');
    s.units[1].owner = 1;
    assert.equal(has(E.moveTargets(s, u), 5, 4), false);
  });

  test('Straßen: Krieger kommt zwei Felder weit', () => {
    const s = world();
    const u = unit(s, 0, 'warrior', 3, 4);
    for (const x of [3, 4, 5]) E.at(s, x, 4).road = true;
    assert.ok(has(E.moveTargets(s, u), 5, 4));
  });

  test('Unerforschte Felder sind gesperrt', () => {
    const s = world();
    const u = unit(s, 0, 'warrior', 4, 4);
    s.players[0].explored[E.idx(s, 5, 4)] = 0;
    assert.equal(has(E.moveTargets(s, u), 5, 4), false);
  });

  test('Ziehen deckt die Umgebung auf und liefert den Weg', () => {
    const s = world();
    const u = unit(s, 0, 'rider', 3, 4);
    s.players[0].explored.fill(0);
    for (const t of [E.at(s, 3, 4), ...E.around(s, 3, 4)]) s.players[0].explored[E.idx(s, t.x, t.y)] = 1;
    const ev = E.move(s, u.id, 4, 4);
    assert.equal(ev[0].type, 'move');
    assert.deepEqual(ev[0].path, [{ x: 3, y: 4 }, { x: 4, y: 4 }]);
    assert.equal(E.isExplored(s, 0, 5, 5), true);
  });
});

describe('Wasser und Schiffe', () => {
  // Spalte x = 5 wird Wasser, (5,4) ein eigener Hafen von Spieler 0
  function coast() {
    const s = world();
    for (let y = 0; y < 9; y++) E.at(s, 5, y).terrain = 'shallow';
    for (let y = 0; y < 9; y++) E.at(s, 6, y).terrain = 'ocean';
    const c = s.cities[0];
    E.at(s, 5, 4).owner = c.id;
    E.at(s, 5, 4).building = 'port';
    s.players[0].techs.push('fishing');
    return s;
  }

  test('Einschiffen: Landeinheit auf eigenem Hafen wird zum Boot, die Bewegung endet', () => {
    const s = coast();
    const u = unit(s, 0, 'warrior', 4, 4);
    assert.ok(has(E.moveTargets(s, u), 5, 4));
    assert.equal(has(E.moveTargets(s, u), 5, 3), false, 'Wasser ohne Hafen ist tabu');
    const [ev] = E.move(s, u.id, 5, 4);
    assert.equal(ev.embark, true);
    assert.equal(u.naval, 'boat');
    assert.equal(E.canMove(u), false);
    assert.deepEqual([E.stats(u).atk, E.stats(u).range], [1, 2]);
  });

  test('Boote fahren nur auf Flachwasser, Schiffe auch auf dem Ozean', () => {
    const s = coast();
    const u = unit(s, 0, 'warrior', 5, 4);
    u.naval = 'boat';
    let t = E.moveTargets(s, u);
    assert.ok(has(t, 5, 2), 'zwei Felder auf Flachwasser');
    assert.equal(has(t, 6, 4), false, 'kein Ozean für Boote');
    u.naval = 'ship';
    t = E.moveTargets(s, u);
    assert.ok(has(t, 6, 4));
    assert.ok(has(t, 5, 1), 'Schiffe fahren drei Felder');
  });

  test('Anlanden: Boot wird wieder Landeinheit, der Zug ist danach vorbei', () => {
    const s = coast();
    const u = unit(s, 0, 'archer', 5, 2);
    u.naval = 'boat';
    E.at(s, 4, 2).village = true;
    const [ev] = E.move(s, u.id, 4, 2);
    assert.equal(ev.land, true);
    assert.equal(u.naval, null);
    assert.equal(E.canAttack(u), false);
    assert.equal(E.captureTarget(s, u), null, 'einnehmen erst nächste Runde');
  });

  test('Boote können nicht einnehmen', () => {
    const s = coast();
    const u = unit(s, 0, 'warrior', 5, 5);
    u.naval = 'boat';
    E.at(s, 5, 5).village = true; // theoretisch – Dörfer liegen nie im Wasser
    assert.equal(E.captureTarget(s, u), null);
  });

  test('Aufrüsten: Schiff braucht Segeln und 5 ★, Schlachtschiff Navigation und 15 ★', () => {
    const s = coast();
    const u = unit(s, 0, 'warrior', 5, 4);
    u.naval = 'boat';
    assert.equal(E.upgradeOption(s, u).reason, 'Braucht Segeln');
    s.players[0].techs.push('sailing');
    s.players[0].stars = 6;
    E.upgrade(s, u.id);
    assert.equal(u.naval, 'ship');
    assert.equal(s.players[0].stars, 1);
    s.players[0].techs.push('navigation');
    assert.equal(E.upgradeOption(s, u).reason, 'Zu wenig Sterne');
    s.players[0].stars = 15;
    E.upgrade(s, u.id);
    assert.equal(u.naval, 'battleship');
    assert.equal(E.upgradeOption(s, u), null);
  });

  test('Seekampf mit den Werten des Schiffs; Aquatismus schützt im Wasser', () => {
    const s = coast();
    const a = unit(s, 0, 'warrior', 5, 2);
    a.naval = 'battleship';
    const d = unit(s, 1, 'warrior', 5, 4);
    d.naval = 'boat';
    assert.equal(E.attackTargets(s, a).length, 1, 'Reichweite 2');
    const before = E.combat(s, a, d).dmg;
    s.players[1].techs.push('aquatism');
    assert.ok(E.combat(s, a, d).dmg < before);
  });

  test('Fremde Häfen sind kein Einstieg', () => {
    const s = coast();
    E.at(s, 5, 4).owner = s.cities[1].id;
    const u = unit(s, 0, 'warrior', 4, 4);
    assert.equal(has(E.moveTargets(s, u), 5, 4), false);
  });
});

describe('Einnehmen', () => {
  test('Dorf: erst in der Runde nach dem Hinziehen; neue Stadt mit 3×3 Gebiet', () => {
    const s = world();
    E.at(s, 4, 4).village = true;
    const u = unit(s, 0, 'warrior', 3, 4);
    E.move(s, u.id, 4, 4);
    assert.equal(E.captureTarget(s, u), null);
    u.moved = u.attacked = u.done = false;
    assert.equal(E.capture(s, u.id)[0].type, 'capture');
    const city = E.cityAt(s, 4, 4);
    assert.equal(city.owner, 0);
    assert.equal(E.around(s, 4, 4).filter((t) => t.owner === city.id).length, 8);
  });

  test('Fremde Stadt erobern: Hauptstadt verliert ihren Status, Gebiet wechselt mit', () => {
    const s = world();
    const enemy = s.cities[1];
    const extra = E.at(s, 4, 7);
    extra.village = true;
    const v = unit(s, 1, 'warrior', 4, 7);
    E.endTurn(s);
    E.capture(s, v.id); // Spieler 1 hat jetzt zwei Städte
    E.endTurn(s);
    const u = unit(s, 0, 'warrior', enemy.x, enemy.y);
    E.capture(s, u.id);
    assert.equal(enemy.owner, 0);
    assert.equal(enemy.capital, false);
    assert.equal(E.tileOwner(s, E.at(s, enemy.x - 1, enemy.y)), 0);
    assert.equal(s.players[1].alive, true);
  });

  test('Letzte Stadt erobert: Spieler scheidet aus, Eroberungssieg', () => {
    const s = world();
    s.mode = 'domination';
    const u = unit(s, 0, 'warrior', 7, 7);
    unit(s, 1, 'warrior', 3, 6);
    E.capture(s, u.id);
    assert.equal(s.players[1].alive, false);
    assert.equal(s.units.some((x) => x.owner === 1), false);
    assert.deepEqual([s.over.reason, s.over.winner], ['domination', 0]);
  });
});

describe('Städte', () => {
  test('Wachstum: Stufe 2 bei 2 Einwohnern, Stufe 3 bei weiteren 3; Belohnungen', () => {
    const s = world();
    const c = s.cities[0];
    E.addPop(s, c, 2);
    assert.deepEqual([c.level, c.pending], [2, [2]]);
    E.chooseReward(s, c.id, 'workshop');
    assert.equal(c.workshop, true);
    E.addPop(s, c, 3);
    assert.equal(c.level, 3);
    E.chooseReward(s, c.id, 'resources');
    assert.equal(s.players[0].stars, 10);
  });

  test('Belohnung „Grenzen“ vergrößert das Gebiet auf 5×5', () => {
    const s = world(11);
    const c = s.cities[0];
    Object.assign(c, { x: 5, y: 5 });
    E.at(s, 5, 5).city = c.id;
    E.addPop(s, c, 2 + 3 + 4);
    while (c.pending.length > 1) E.chooseReward(s, c.id, c.pending[0] === 2 ? 'workshop' : 'resources');
    E.chooseReward(s, c.id, 'borders');
    assert.equal(E.around(s, 5, 5, 2).filter((t) => t.owner === c.id).length, 24);
  });

  test('Riese erscheint in der Stadt (Belohnung ab Stufe 5)', () => {
    const s = world();
    const c = s.cities[0];
    c.level = 5;
    c.pending = [5];
    const ev = E.chooseReward(s, c.id, 'giant');
    assert.equal(ev.find((e) => e.type === 'spawn').unit.type, 'giant');
  });

  test('Einkommen: Hauptstadt Stufe 1 bringt 2 ★, mit Werkstatt 3 ★, belagert 0 ★', () => {
    const s = world();
    const c = s.cities[0];
    assert.equal(E.cityIncome(s, c), 2);
    c.workshop = true;
    assert.equal(E.cityIncome(s, c), 3);
    unit(s, 1, 'warrior', c.x, c.y);
    assert.equal(E.cityIncome(s, c), 0);
  });

  test('Einheiten ausbilden: kostet Sterne, Stadt Stufe 1 versorgt 2 Einheiten', () => {
    const s = world();
    const c = s.cities[0];
    s.players[0].stars = 20;
    E.train(s, c.id, 'warrior');
    assert.equal(s.players[0].stars, 18);
    assert.equal(E.trainOptions(s, c).find((o) => o.type === 'warrior').reason, 'Stadtfeld besetzt');
    s.units.at(-1).x = 2;
    E.train(s, c.id, 'warrior');
    s.units.at(-1).x = 0;
    assert.equal(E.trainOptions(s, c).find((o) => o.type === 'warrior').reason, 'Stadt ist voll');
    assert.equal(E.trainOptions(s, c).find((o) => o.type === 'rider').locked, true);
  });

  test('Neue Einheiten handeln erst in der nächsten Runde', () => {
    const s = world();
    const [ev] = E.train(s, s.cities[0].id, 'warrior');
    const u = E.unitById(s, ev.unit.id);
    assert.equal(E.canMove(u), false);
  });
});

describe('Forschung', () => {
  test('Kosten: Stufe × Städte + 4; Philosophie macht ⅓ günstiger', () => {
    const s = world();
    assert.equal(E.techCost(s, 0, 'riding'), 5);
    assert.equal(E.techCost(s, 0, 'archery'), 6);
    assert.equal(E.techCost(s, 0, 'chivalry'), 7);
    s.players[0].techs.push('philosophy');
    assert.equal(E.techCost(s, 0, 'chivalry'), 5);
  });

  test('Nur mit Vorgänger-Technik und genug Sternen', () => {
    const s = world();
    assert.equal(E.techState(s, 0, 'chivalry'), 'locked');
    assert.equal(E.techState(s, 0, 'riding'), 'available');
    s.players[0].stars = 2;
    assert.equal(E.techState(s, 0, 'riding'), 'expensive');
    assert.deepEqual(E.research(s, 0, 'riding'), []);
  });

  test('Erforschen kostet Sterne und schaltet Einheiten frei', () => {
    const s = world();
    E.research(s, 0, 'riding');
    assert.equal(s.players[0].stars, 0);
    assert.equal(E.trainOptions(s, s.cities[0]).find((o) => o.type === 'rider').locked, false);
  });
});

describe('Kachel-Aktionen', () => {
  test('Früchte ernten: +1 Einwohner, Ressource weg', () => {
    const s = world();
    const t = E.at(s, 2, 1);
    t.resource = 'fruit';
    s.players[0].techs.push('organization');
    E.tileAction(s, 0, 2, 1, 'harvest');
    assert.equal(t.resource, null);
    assert.equal(s.cities[0].pop, 1);
    assert.equal(s.players[0].stars, 3);
  });

  test('Windmühle zählt Bauernhöfe daneben; später gebauter Hof gibt nachträglich +1', () => {
    const s = world();
    const p = s.players[0];
    p.stars = 50;
    p.techs.push('organization', 'farming', 'construction');
    E.at(s, 0, 0).resource = 'crop';
    E.at(s, 0, 2).resource = 'crop';
    E.tileAction(s, 0, 0, 0, 'farm');
    E.tileAction(s, 0, 0, 1, 'windmill');
    const c = s.cities[0];
    assert.deepEqual([c.level, c.pop], [2, 1]); // Hof +2, Mühle +1
    E.tileAction(s, 0, 0, 2, 'farm'); // +2 und +1 für die Mühle
    assert.deepEqual([c.level, c.pop], [3, 1]);
    assert.equal(E.tileActions(s, 0, E.at(s, 2, 2)).find((a) => a.id === 'windmill').reason, `${c.name} hat schon eins`);
  });

  test('Wald roden gibt 1 ★ und macht Wiese daraus', () => {
    const s = world();
    const t = E.at(s, 2, 2);
    t.terrain = 'forest';
    s.players[0].techs.push('hunting', 'forestry');
    E.tileAction(s, 0, 2, 2, 'clearforest');
    assert.equal(t.terrain, 'field');
    assert.equal(s.players[0].stars, 6);
  });

  test('Außerhalb des eigenen Gebiets: keine Aktionen', () => {
    const s = world();
    s.players[0].techs.push('organization');
    E.at(s, 4, 4).resource = 'fruit';
    assert.deepEqual(E.tileActions(s, 0, E.at(s, 4, 4)), []);
  });

  test('Gegner auf dem Feld blockiert die Aktion', () => {
    const s = world();
    s.players[0].techs.push('organization');
    E.at(s, 2, 1).resource = 'fruit';
    unit(s, 1, 'warrior', 2, 1);
    assert.equal(E.tileActions(s, 0, E.at(s, 2, 1))[0].reason, 'Gegner auf dem Feld');
  });
});

describe('Runden und Spielende', () => {
  test('Rundenende: nächster Spieler, Einkommen ab Runde 2, Einheiten wieder bereit', () => {
    const s = world();
    const u = unit(s, 0, 'warrior', 4, 4);
    u.moved = true;
    E.endTurn(s);
    assert.deepEqual([s.current, s.turn, s.players[1].stars], [1, 1, 5]);
    E.endTurn(s);
    assert.deepEqual([s.current, s.turn, s.players[0].stars], [0, 2, 7]);
    assert.equal(u.moved, false);
  });

  test('Perfektion: nach Runde 30 ist Schluss, höchste Punktzahl gewinnt', () => {
    const s = world();
    s.turn = 30;
    s.current = 1;
    const ev = E.endTurn(s);
    assert.equal(ev.at(-1).type, 'gameover');
    assert.equal(s.over.reason, 'turns');
    assert.equal(s.over.turn, 30, 'letzte gespielte Runde');
  });

  test('Eroberung: kein Rundenlimit – das Spielende nennt die echte Runde', () => {
    const s = world();
    s.mode = 'domination';
    s.turn = 45;
    s.current = 1;
    E.endTurn(s);
    assert.equal(s.over, null, 'nach Runde 30 geht es weiter');
    const u = unit(s, 0, 'warrior', 7, 7);
    E.capture(s, u.id);
    assert.deepEqual([s.over.reason, s.over.turn], ['domination', 46]);
  });

  test('Ausgeschiedene Spieler werden übersprungen', () => {
    const s = E.newGame({ tribes: ['nord', 'stein', 'eben'], size: 11, seed: 3 });
    s.players[1].alive = false;
    E.endTurn(s);
    assert.equal(s.current, 2);
  });

  test('Punkte setzen sich aus Erkundung, Gebiet, Städten, Forschung und Armee zusammen', () => {
    const s = world();
    const sc = E.scoreOf(s, 0);
    assert.equal(sc.parts.explore, 81 * 5);
    assert.equal(sc.parts.territory, 9 * 20);
    assert.equal(sc.parts.cities, 100 + 50);
    assert.equal(sc.parts.tech, 100);
    assert.equal(sc.total, Object.values(sc.parts).reduce((a, b) => a + b, 0));
  });
});

describe('Speichern', () => {
  test('Speichern und Laden ergeben denselben Zustand', () => {
    const s = E.newGame({ tribes: ['eben', 'sand', 'nord'], size: 14, seed: 9 });
    assert.deepEqual(E.deserialize(E.serialize(s)), s);
  });

  test('Kaputte oder fremde Spielstände werden abgelehnt', () => {
    assert.equal(E.deserialize('{"version":999}'), null);
    assert.equal(E.deserialize('kein json'), null);
  });
});

describe('Noch etwas zu tun? (Leuchten, Hinweise, Runde beenden)', () => {
  test('frische Einheit hat noch etwas zu tun', () => {
    const s = world();
    const u = unit(s, 0, 'rider', 4, 4);
    assert.equal(E.isIdle(s, u), true);
  });

  test('Reiter nach dem Ziehen ohne Gegner in Reichweite: fertig (kein Leuchten, kein „Weiß = ziehen“)', () => {
    const s = world();
    const u = unit(s, 0, 'rider', 3, 4);
    E.move(s, u.id, 4, 4);
    assert.equal(E.canAttack(u), true, 'dürfte noch angreifen …');
    assert.deepEqual(E.attackTargets(s, u), [], '… hat aber kein Ziel');
    assert.equal(E.isIdle(s, u), false);
  });

  test('Reiter nach dem Ziehen mit Gegner daneben: darf noch angreifen', () => {
    const s = world();
    const u = unit(s, 0, 'rider', 3, 4);
    unit(s, 1, 'warrior', 5, 4);
    E.move(s, u.id, 4, 4);
    assert.equal(E.isIdle(s, u), true);
  });

  test('Wild im eigenen Gebiet leuchtet erst mit Jagd – und nur, wenn die Sterne reichen', () => {
    const s = world();
    const deer = Object.assign(E.at(s, 2, 1), { terrain: 'forest', resource: 'animal' }); // neben der eigenen Hauptstadt
    s.players[0].techs = s.players[0].techs.filter((t) => t !== 'hunting'); // Nordlinge starten mit Jagd
    s.players[0].stars = 5;
    assert.equal(E.usableResource(s, 0, deer), false, 'ohne Jagd');
    s.players[0].techs.push('hunting');
    assert.equal(E.usableResource(s, 0, deer), true, 'mit Jagd');
    s.players[0].stars = 1;
    assert.equal(E.usableResource(s, 0, deer), false, 'zu wenig Sterne');
    s.players[0].stars = 5;
    assert.equal(E.usableResource(s, 1, deer), false, 'nicht im Gebiet des anderen');
    const plain = Object.assign(E.at(s, 1, 2), { terrain: 'forest', resource: null });
    assert.equal(E.usableResource(s, 0, plain), false, 'Wald ohne Wild');
  });
});

describe('Berge: weitere Sicht und Schutz', () => {
  test('wer auf einen Berg zieht, sieht 2 Felder weit – auf der Wiese nur 1', () => {
    const s = world(11);
    s.players[0].techs.push('climbing');
    s.players[0].explored.fill(0);
    E.at(s, 5, 5).terrain = 'mountain';
    const climber = unit(s, 0, 'warrior', 4, 5);
    E.reveal(s, 0, 4, 5, 1); // wie im Spiel: die Umgebung der Einheit ist bekannt
    E.move(s, climber.id, 5, 5);
    assert.equal(E.isExplored(s, 0, 7, 5), true, '2 Felder vom Berg entfernt');
    assert.equal(E.isExplored(s, 0, 3, 3), true);
    const walker = unit(s, 0, 'warrior', 4, 8);
    E.reveal(s, 0, 4, 8, 1);
    E.move(s, walker.id, 4, 9);
    assert.equal(E.isExplored(s, 0, 4, 10), true, '1 Feld neben der Wiese');
    assert.equal(E.isExplored(s, 0, 2, 9), false, '2 Felder neben der Wiese bleiben verdeckt');
  });

  test('auf dem Berg steht man geschützt: Verteidigung ×1,5, Anzeige nennt den Grund', () => {
    const s = world();
    s.players[0].techs.push('climbing');
    E.at(s, 4, 4).terrain = 'mountain';
    const u = unit(s, 0, 'warrior', 4, 4);
    assert.deepEqual(E.defenseInfo(s, u), { factor: 1.5, reason: 'Berg' });
    const open = unit(s, 0, 'warrior', 4, 6);
    assert.equal(E.defenseInfo(s, open), null);
  });
});

describe('Straßen: weiter in Richtung der Straße, Limit je Einheit', () => {
  const along = (type, from = 1) => {
    const s = world(11);
    for (let x = 1; x <= 9; x++) E.at(s, x, 4).road = true;
    const u = unit(s, 0, type, from, 4);
    return E.moveTargets(s, u).filter((t) => t.y === 4).map((t) => t.x);
  };

  test('eine Straße aus der Stadt bringt in ihrer Richtung ein Feld mehr', () => {
    const s = world();
    const u = unit(s, 0, 'warrior', 1, 1); // steht in der eigenen Hauptstadt
    assert.equal(has(E.moveTargets(s, u), 3, 1), false, 'ohne Straße nur 1 Feld');
    E.at(s, 2, 1).road = true;
    const targets = E.moveTargets(s, u);
    assert.ok(has(targets, 2, 1), 'auf die Straße');
    assert.ok(has(targets, 3, 1), 'und am Ende noch ein Feld weiter');
    assert.equal(has(targets, 1, 3), false, 'in andere Richtungen nicht weiter');
  });

  test('Straßen-Limit: Krieger 3, Reiter 5, Ritter 6, Verteidiger 2 Felder pro Zug', () => {
    assert.equal(Math.max(...along('warrior')), 4);
    assert.equal(Math.max(...along('rider')), 6);
    assert.equal(Math.max(...along('knight')), 7);
    assert.equal(Math.max(...along('defender')), 3);
  });

  test('ohne Straße bleibt es bei der normalen Bewegung', () => {
    const s = world(11);
    const w = unit(s, 0, 'warrior', 3, 4);
    const r = unit(s, 0, 'rider', 3, 7);
    assert.equal(Math.max(...E.moveTargets(s, w).map((t) => Math.abs(t.x - 3))), 1);
    assert.equal(Math.max(...E.moveTargets(s, r).map((t) => Math.abs(t.x - 3))), 2);
  });

  test('Straße durch den Wald: volle Straßen-Reichweite', () => {
    const s = world(11);
    for (let x = 1; x <= 5; x++) Object.assign(E.at(s, x, 4), { terrain: 'forest', road: true });
    const u = unit(s, 0, 'warrior', 1, 4);
    assert.ok(has(E.moveTargets(s, u), 4, 4));
    assert.equal(has(E.moveTargets(s, u), 5, 4), false, 'nicht über das Limit hinaus');
  });
});
