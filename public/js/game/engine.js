// Spiel-Engine: Zustand, Abfragen und alle Spielzüge. Kein DOM, kein 3D – läuft auch in Node (Tests, Simulation).
// Jeder Zug prüft, ob er erlaubt ist, verändert den Zustand und gibt eine Liste von Ereignissen zurück
// ({ type: 'move' | 'attack' | 'capture' | … }), die die Ansicht der Reihe nach animiert.

import {
  START_STARS, TURN_LIMIT, TRIBES, tribeById, UNITS, NAVAL, NAVAL_UPGRADE, TECHS, ACTIONS, ADJACENCY, MARKET_SOURCES,
  isLand, isWater, DAMAGE_FACTOR, BONUS_DEFENSE, WALL_DEFENSE, VETERAN_KILLS, VETERAN_HP, SIGHT, MOUNTAIN_SIGHT,
  HEAL_OWN, HEAL_OTHER, HEAL_MIND, LITERACY, popToGrow, unitCap, rewardsFor, RUIN_REWARDS, DIFFICULTIES, SCORE,
} from './rules.js';
import { generateMap } from './mapgen.js';
import { random, pickWeighted, newSeed } from './rng.js';

export const SAVE_VERSION = 1;

// ---------- Neues Spiel ----------

// tribes: Stamm-IDs, Index 0 = menschlicher Spieler
export function newGame({ tribes, size = 14, seed = newSeed(), mode = 'perfection', difficulty = 'normal', mapType = 'pangaea' }) {
  const map = generateMap({ size, tribes, seed, type: mapType });
  const s = {
    version: SAVE_VERSION,
    seed,
    rng: (seed ^ 0x9e3779b9) >>> 0,
    size,
    mapType,
    mode,
    difficulty,
    turnLimit: TURN_LIMIT,
    turn: 1,
    current: 0,
    nextId: 1,
    tiles: map.tiles.map((t) => ({ ...t, owner: null, city: null, building: null, road: false })),
    players: tribes.map((id, i) => ({
      index: i,
      tribe: id,
      human: i === 0,
      stars: START_STARS,
      techs: [tribeById(id).tech],
      explored: new Array(size * size).fill(0),
      alive: true,
      kills: 0,
      usedNames: [],
    })),
    cities: [],
    units: [],
    over: null,
  };
  map.capitals.forEach((pos, i) => {
    const city = foundCity(s, i, at(s, pos.x, pos.y), true);
    const u = makeUnit(s, i, tribeById(tribes[i]).unit, pos.x, pos.y, city.id);
    u.moved = u.attacked = u.done = false;
    reveal(s, i, pos.x, pos.y, 2);
  });
  return s;
}

// ---------- Grundlegende Abfragen ----------

export const at = (s, x, y) => (x >= 0 && y >= 0 && x < s.size && y < s.size ? s.tiles[y * s.size + x] : null);
export const idx = (s, x, y) => y * s.size + x;
export const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function around(s, x, y, r = 1) {
  const list = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue;
      const t = at(s, x + dx, y + dy);
      if (t) list.push(t);
    }
  }
  return list;
}

export const cityById = (s, id) => s.cities.find((c) => c.id === id) || null;
export const unitById = (s, id) => s.units.find((u) => u.id === id) || null;
export const unitAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y) || null;
export const cityAt = (s, x, y) => {
  const t = at(s, x, y);
  return t && t.city != null ? cityById(s, t.city) : null;
};
export const hasTech = (s, p, tech) => s.players[p].techs.includes(tech);
export const playerCities = (s, p) => s.cities.filter((c) => c.owner === p);
export const playerUnits = (s, p) => s.units.filter((u) => u.owner === p);
export const isExplored = (s, p, x, y) => s.players[p].explored[y * s.size + x] === 1;
export const tribeOf = (s, p) => tribeById(s.players[p].tribe);

// Spieler, dem die Kachel gehört (über die Stadt, zu deren Gebiet sie zählt)
export function tileOwner(s, tile) {
  if (tile.owner == null) return null;
  const c = cityById(s, tile.owner);
  return c ? c.owner : null;
}

export const cityUnits = (s, city) => s.units.filter((u) => u.home === city.id);
export const besieged = (s, city) => {
  const u = unitAt(s, city.x, city.y);
  return Boolean(u && u.owner !== city.owner);
};

export function marketIncome(s, city) {
  let n = 0;
  for (const t of s.tiles) {
    if (t.owner !== city.id || t.building !== 'market') continue;
    for (const o of around(s, t.x, t.y)) if (MARKET_SOURCES.has(o.building) && tileOwner(s, o) === city.owner) n++;
  }
  return n;
}

export function cityIncome(s, city) {
  if (besieged(s, city)) return 0;
  return city.level + (city.capital ? 1 : 0) + (city.workshop ? 1 : 0) + marketIncome(s, city);
}

export const botBonus = (s, p) => (s.players[p].human ? 0 : DIFFICULTIES[s.difficulty]?.bonus || 0);
export const income = (s, p) => playerCities(s, p).reduce((n, c) => n + cityIncome(s, c), 0) + botBonus(s, p);

// ---------- Erkunden ----------

export function reveal(s, p, x, y, r, events) {
  const ex = s.players[p].explored;
  const fresh = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const t = at(s, x + dx, y + dy);
      if (!t) continue;
      const i = idx(s, t.x, t.y);
      if (!ex[i]) {
        ex[i] = 1;
        fresh.push(i);
      }
    }
  }
  if (fresh.length && events) events.push({ type: 'reveal', player: p, tiles: fresh });
  return fresh;
}

// Sichtweite beim Ziehen: auf Bergen weiter
export const sight = (s, x, y) => (at(s, x, y).terrain === 'mountain' ? MOUNTAIN_SIGHT : SIGHT);

// Kundschafter: zufälliger Weg über Land, deckt dabei alles drumherum auf
export function exploreFrom(s, p, x, y, steps, events) {
  const path = [{ x, y }];
  let cx = x;
  let cy = y;
  for (let i = 0; i < steps; i++) {
    const options = around(s, cx, cy).filter((t) => isLand(t.terrain));
    if (!options.length) break;
    // Bevorzugt Richtung Unerforschtes
    const fresh = options.filter((t) => !isExplored(s, p, t.x, t.y));
    const list = fresh.length && random(s) < 0.7 ? fresh : options;
    const t = list[Math.floor(random(s) * list.length)];
    cx = t.x;
    cy = t.y;
    path.push({ x: cx, y: cy });
    reveal(s, p, cx, cy, sight(s, cx, cy), events);
  }
  if (events) events.push({ type: 'explorer', player: p, path });
}

// ---------- Städte ----------

function cityName(s, p) {
  const tribe = tribeOf(s, p);
  const used = new Set(s.cities.map((c) => c.name));
  for (let i = 0; i < 40; i++) {
    const pre = tribe.names.pre[Math.floor(random(s) * tribe.names.pre.length)];
    const post = tribe.names.post[Math.floor(random(s) * tribe.names.post.length)];
    const name = pre + post;
    if (!used.has(name)) return name;
  }
  return `${tribe.names.pre[0]}${s.cities.length + 1}`;
}

function claimTerritory(s, city, r) {
  const claimed = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const t = at(s, city.x + dx, city.y + dy);
      if (t && t.owner == null) {
        t.owner = city.id;
        claimed.push(idx(s, t.x, t.y));
      }
    }
  }
  return claimed;
}

function foundCity(s, p, tile, capital = false) {
  const city = {
    id: s.nextId++,
    x: tile.x,
    y: tile.y,
    owner: p,
    name: cityName(s, p),
    level: 1,
    pop: 0,
    capital,
    workshop: false,
    wall: false,
    parks: 0,
    border: 1,
    pending: [],
  };
  tile.village = false;
  tile.city = city.id;
  tile.terrain = 'field';
  tile.resource = null;
  tile.owner = city.id;
  s.cities.push(city);
  claimTerritory(s, city, 1);
  return city;
}

// Einwohner dazu; bei genug Einwohnern steigt die Stadt auf und wartet auf eine Belohnungswahl
export function addPop(s, city, n, events = []) {
  city.pop += n;
  events.push({ type: 'pop', city: city.id, amount: n });
  while (city.pop >= popToGrow(city.level)) {
    city.pop -= popToGrow(city.level);
    city.level++;
    city.pending.push(city.level);
    events.push({ type: 'levelup', city: city.id, level: city.level, player: city.owner });
  }
  return events;
}

// ---------- Einheiten ----------

function makeUnit(s, p, type, x, y, home = null) {
  const def = UNITS[type];
  const u = { id: s.nextId++, type, naval: null, owner: p, x, y, hp: def.hp, maxHp: def.hp, home, moved: true, attacked: true, done: true, kills: 0, veteran: false };
  s.units.push(u);
  return u;
}

export const snapshot = (u) => ({ id: u.id, type: u.type, naval: u.naval || null, owner: u.owner, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, veteran: u.veteran });

function removeUnit(s, u) {
  s.units = s.units.filter((o) => o !== u);
}

// Werte einer Einheit: auf dem Wasser die des Boots/Schiffs, sonst die der Einheit
export const stats = (u) => (u.naval ? NAVAL[u.naval] : UNITS[u.type]);
export const unitHas = (u, skill) => stats(u).skills.includes(skill);
export const unitName = (u) => (u.naval ? `${NAVAL[u.naval].name} (${UNITS[u.type].name})` : UNITS[u.type].name);

export const canMove = (u) => !u.done && !u.moved && (!u.attacked || unitHas(u, 'escape'));
export const canAttack = (u) => !u.done && !u.attacked && (!u.moved || unitHas(u, 'dash')) && stats(u).atk > 0;
export const canAct = (u) => !u.done && !u.moved && !u.attacked;
// Hat die Einheit in diesem Zug noch wirklich etwas zu tun? (Leuchten, Hinweise, „Runde beenden“)
// Nach dem Ziehen zählt Angreifen nur, wenn ein Gegner in Reichweite steht.
export function isIdle(s, u) {
  if (canAct(u)) return true;
  if (canMove(u) && moveTargets(s, u).length) return true;
  if (canAttack(u) && attackTargets(s, u).length) return true;
  return Boolean(captureTarget(s, u)) || canExamine(s, u) || canConvert(s, u);
}

// Darf eine Landeinheit dieses Spielers die Kachel betreten? (Berge erst mit Klettern)
export function passable(s, p, tile) {
  if (!isExplored(s, p, tile.x, tile.y)) return false;
  if (isWater(tile.terrain)) return false;
  if (tile.terrain === 'mountain' && !hasTech(s, p, 'climbing')) return false;
  return true;
}

// Darf ein Boot (ocean = Schiff/Schlachtschiff) auf diese Wasserkachel?
export function sailable(s, p, tile, ocean) {
  if (!isExplored(s, p, tile.x, tile.y) || !isWater(tile.terrain)) return false;
  return tile.terrain === 'shallow' || ocean;
}

export const ownPort = (s, p, tile) => tile.building === 'port' && tileOwner(s, tile) === p;

const roadLike = (t) => t.road || t.city != null;
const stopsOn = (t) => t.terrain === 'mountain'; // nur Berge beenden die Bewegung – Wald nicht (volle Bewegung auch im Waldland des Gegners)

// Ein Schritt von `from` nach `to`: null = nicht erlaubt, sonst Kosten (halbe Punkte), ob die Bewegung endet
// und ob die Einheit dabei einschifft (eigener Hafen) oder anlandet (vom Wasser aufs Land)
export function stepRule(s, unit, from, to) {
  const p = unit.owner;
  if (unit.naval) {
    if (isWater(to.terrain)) return sailable(s, p, to, NAVAL[unit.naval].ocean) ? { road: false, stop: false } : null;
    return passable(s, p, to) ? { road: false, stop: true, land: true } : null;
  }
  if (isWater(to.terrain)) return isExplored(s, p, to.x, to.y) && ownPort(s, p, to) ? { road: false, stop: true, embark: true } : null;
  if (!passable(s, p, to)) return null;
  return { road: roadLike(from) && roadLike(to), stop: stopsOn(to) };
}

// Bewegung als Budget pro Zug (840 = teilbar durch 1…8): ein Feld kostet 840 / Bewegung,
// auf Straßen (von Straße/Stadt zu Straße/Stadt) nur 840 / Straßen-Reichweite der Einheit.
// Restschritt: Solange noch etwas übrig ist, geht immer noch ein Feld – so führt eine Straße
// auch in ihrer Richtung weiter. Mehr Felder als die Straßen-Reichweite schafft keine Einheit.
export const MOVE_BUDGET = 840;
export const roadRange = (u) => (u.naval ? stats(u).move : UNITS[u.type].road || stats(u).move * 2);

// Alle erreichbaren Kacheln (Dijkstra über das restliche Budget).
// Berge beenden die Bewegung, ebenso das Betreten eines Felds neben einem Gegner, Einschiffen und Anlanden.
export function reachable(s, unit) {
  const p = unit.owner;
  const occ = new Map(s.units.map((u) => [idx(s, u.x, u.y), u]));
  const zoc = new Set();
  for (const e of s.units) if (e.owner !== p) for (const t of around(s, e.x, e.y)) zoc.add(idx(s, t.x, t.y));
  const start = idx(s, unit.x, unit.y);
  const best = new Map([[start, MOVE_BUDGET]]);
  const stepCost = MOVE_BUDGET / stats(unit).move;
  const roadCost = MOVE_BUDGET / roadRange(unit);
  const prev = new Map();
  const open = [start];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (best.get(open[i]) > best.get(open[bi])) bi = i;
    const cur = open.splice(bi, 1)[0];
    const rem = best.get(cur);
    if (rem <= 0) continue;
    const ct = s.tiles[cur];
    // Wer gerade eingeschifft oder angelandet hat, kommt nicht weiter (Domäne gewechselt)
    if (cur !== start && Boolean(unit.naval) !== isWater(ct.terrain)) continue;
    for (const nt of around(s, ct.x, ct.y)) {
      const ni = idx(s, nt.x, nt.y);
      const rule = stepRule(s, unit, ct, nt);
      if (!rule) continue;
      const o = occ.get(ni);
      if (o && o.owner !== p) continue;
      let r = Math.max(0, rem - (rule.road ? roadCost : stepCost)); // Restschritt: geht, solange rem > 0
      if (rule.stop || zoc.has(ni)) r = 0;
      if (r > (best.has(ni) ? best.get(ni) : -1)) {
        best.set(ni, r);
        prev.set(ni, cur);
        open.push(ni);
      }
    }
  }
  return { best, prev, occ, start };
}

export function moveTargets(s, unit) {
  if (!canMove(unit)) return [];
  const { best, occ, start } = reachable(s, unit);
  return [...best.keys()].filter((i) => i !== start && !occ.has(i)).map((i) => s.tiles[i]);
}

export function pathTo(s, unit, x, y) {
  const { best, prev, occ, start } = reachable(s, unit);
  const target = idx(s, x, y);
  if (!best.has(target) || target === start || occ.has(target)) return null;
  const path = [];
  for (let i = target; i !== start; i = prev.get(i)) path.unshift({ x: s.tiles[i].x, y: s.tiles[i].y });
  path.unshift({ x: unit.x, y: unit.y });
  return path;
}

export function move(s, unitId, x, y) {
  const u = unitById(s, unitId);
  if (!u || u.owner !== s.current || !canMove(u)) return [];
  const path = pathTo(s, u, x, y);
  if (!path) return [];
  const ev = { type: 'move', unit: u.id, path, from: u.naval || null };
  const events = [ev];
  for (const step of path.slice(1)) reveal(s, u.owner, step.x, step.y, sight(s, step.x, step.y), events);
  const target = at(s, x, y);
  if (!u.naval && isWater(target.terrain)) {
    u.naval = 'boat'; // Einschiffen im eigenen Hafen
    ev.embark = true;
  } else if (u.naval && !isWater(target.terrain)) {
    u.naval = null; // Anlanden beendet den Zug
    u.attacked = true;
    ev.land = true;
  }
  ev.to = u.naval || null;
  u.x = x;
  u.y = y;
  u.moved = true;
  return events;
}

// ---------- Schiffe aufrüsten ----------

export function upgradeOption(s, u) {
  const next = u.naval && NAVAL_UPGRADE[u.naval];
  if (!next) return null;
  const def = NAVAL[next];
  let reason = '';
  if (!hasTech(s, u.owner, def.tech)) reason = `Braucht ${TECHS[def.tech].name}`;
  else if (s.players[u.owner].stars < def.cost) reason = 'Zu wenig Sterne';
  return { to: next, name: def.name, cost: def.cost, ok: !reason, reason, locked: !hasTech(s, u.owner, def.tech) };
}

export function upgrade(s, unitId) {
  const u = unitById(s, unitId);
  if (!u || u.owner !== s.current) return [];
  const opt = upgradeOption(s, u);
  if (!opt || !opt.ok) return [];
  s.players[u.owner].stars -= opt.cost;
  u.naval = opt.to;
  return [{ type: 'upgrade', unit: u.id, naval: opt.to, cost: opt.cost }];
}

// ---------- Kampf ----------

export function defenseBonus(s, def) {
  const tile = at(s, def.x, def.y);
  if (tile.city != null) {
    const city = cityById(s, tile.city);
    if (city && city.owner === def.owner && unitHas(def, 'fortify')) return city.wall ? WALL_DEFENSE : BONUS_DEFENSE;
  }
  if (tile.terrain === 'forest' && hasTech(s, def.owner, 'archery')) return BONUS_DEFENSE;
  if (tile.terrain === 'mountain' && hasTech(s, def.owner, 'climbing')) return BONUS_DEFENSE;
  if (isWater(tile.terrain) && hasTech(s, def.owner, 'aquatism')) return BONUS_DEFENSE;
  return 1;
}

// Woher ein Verteidigungsbonus kommt (für die Anzeige): { factor, reason } oder null
export function defenseInfo(s, u) {
  const factor = defenseBonus(s, u);
  if (factor <= 1) return null;
  const tile = at(s, u.x, u.y);
  const reason = tile.city != null ? (factor === WALL_DEFENSE ? 'Stadtmauer' : 'Stadt') : { forest: 'Wald', mountain: 'Berg' }[tile.terrain] || 'Wasser';
  return { factor, reason };
}

// Vorschau eines Angriffs (gleiche Formel wie die Ausführung)
export function combat(s, att, def) {
  const A = stats(att);
  const D = stats(def);
  const atkForce = A.atk * (att.hp / att.maxHp);
  const defForce = D.def * (def.hp / def.maxHp) * defenseBonus(s, def);
  const total = atkForce + defForce || 1;
  const dmg = Math.round((atkForce / total) * A.atk * DAMAGE_FACTOR);
  const retRaw = Math.round((defForce / total) * D.def * DAMAGE_FACTOR);
  const kill = dmg >= def.hp;
  const retaliates = !kill && dist(att, def) <= D.range && retRaw > 0;
  const ret = retaliates ? retRaw : 0;
  return { dmg, ret, kill, dies: ret >= att.hp };
}

export function attackTargets(s, unit) {
  if (!canAttack(unit)) return [];
  const range = stats(unit).range;
  return s.units.filter((o) => o.owner !== unit.owner && dist(o, unit) <= range && isExplored(s, unit.owner, o.x, o.y));
}

export function attack(s, unitId, targetId) {
  const att = unitById(s, unitId);
  const def = unitById(s, targetId);
  if (!att || !def || att.owner !== s.current || !attackTargets(s, att).includes(def)) return [];
  const pv = combat(s, att, def);
  const ev = {
    type: 'attack',
    attacker: att.id,
    defender: def.id,
    from: { x: att.x, y: att.y },
    to: { x: def.x, y: def.y },
    dmg: pv.dmg,
    ret: 0,
    kill: false,
    retKill: false,
    ranged: stats(att).range > 1,
    advance: false,
  };
  const events = [ev];
  def.hp -= pv.dmg;
  if (def.hp <= 0) {
    removeUnit(s, def);
    ev.kill = true;
    att.kills++;
    s.players[att.owner].kills++;
    // Nahkämpfer an Land rücken auf das freie Feld nach (nicht ins Wasser)
    const tile = at(s, def.x, def.y);
    if (!att.naval && stats(att).range === 1 && passable(s, att.owner, tile)) {
      att.x = def.x;
      att.y = def.y;
      ev.advance = true;
      reveal(s, att.owner, att.x, att.y, sight(s, att.x, att.y), events);
    }
  } else if (pv.ret > 0) {
    att.hp -= pv.ret;
    ev.ret = pv.ret;
    if (att.hp <= 0) {
      removeUnit(s, att);
      ev.retKill = true;
      def.kills++;
      s.players[def.owner].kills++;
    }
  }
  // Nach dem Angriff ist Schluss – außer Rückzug (darf noch ziehen) und Ausdauer (nach einem Sieg erneut angreifen)
  att.attacked = true;
  if (ev.kill && unitHas(att, 'persist')) att.attacked = false;
  return events;
}

// ---------- Weitere Einheiten-Aktionen ----------

export function captureTarget(s, u) {
  if (!canAct(u) || u.naval) return null;
  const tile = at(s, u.x, u.y);
  if (tile.village) return { kind: 'village' };
  if (tile.city != null) {
    const city = cityById(s, tile.city);
    if (city.owner !== u.owner) return { kind: 'city', city };
  }
  return null;
}

export function capture(s, unitId) {
  const u = unitById(s, unitId);
  if (!u || u.owner !== s.current) return [];
  const target = captureTarget(s, u);
  if (!target) return [];
  const events = [];
  const tile = at(s, u.x, u.y);
  let city;
  let from = null;
  if (target.kind === 'village') {
    city = foundCity(s, u.owner, tile);
  } else {
    city = target.city;
    from = city.owner;
    city.owner = u.owner;
    city.capital = false;
    city.pending = [];
    for (const o of s.units) if (o.home === city.id) o.home = null;
  }
  events.push({ type: 'capture', city: city.id, from, by: u.owner, x: city.x, y: city.y, village: target.kind === 'village' });
  reveal(s, u.owner, city.x, city.y, city.border + 1, events);
  u.done = u.moved = u.attacked = true;
  if (from != null) checkElimination(s, from, events);
  checkGameOver(s, events);
  return events;
}

export const canRecover = (s, u) => canAct(u) && u.hp < u.maxHp;

export function recover(s, unitId) {
  const u = unitById(s, unitId);
  if (!u || u.owner !== s.current || !canRecover(s, u)) return [];
  const heal = tileOwner(s, at(s, u.x, u.y)) === u.owner ? HEAL_OWN : HEAL_OTHER;
  const before = u.hp;
  u.hp = Math.min(u.maxHp, u.hp + heal);
  u.done = u.moved = u.attacked = true;
  return [{ type: 'heal', units: [{ id: u.id, amount: u.hp - before }] }];
}

export const canPromote = (u) => u.kills >= VETERAN_KILLS && !u.veteran;

export function promote(s, unitId) {
  const u = unitById(s, unitId);
  if (!u || u.owner !== s.current || !canPromote(u)) return [];
  u.veteran = true;
  u.maxHp += VETERAN_HP;
  u.hp = u.maxHp;
  return [{ type: 'promote', unit: u.id }];
}

export const canHealOthers = (s, u) =>
  unitHas(u, 'heal') && canAct(u) && around(s, u.x, u.y).some((t) => {
    const o = unitAt(s, t.x, t.y);
    return o && o.owner === u.owner && o.hp < o.maxHp;
  });

export function healOthers(s, unitId) {
  const u = unitById(s, unitId);
  if (!u || u.owner !== s.current || !canHealOthers(s, u)) return [];
  const healed = [];
  for (const t of around(s, u.x, u.y)) {
    const o = unitAt(s, t.x, t.y);
    if (o && o.owner === u.owner && o.hp < o.maxHp) {
      const before = o.hp;
      o.hp = Math.min(o.maxHp, o.hp + HEAL_MIND);
      healed.push({ id: o.id, amount: o.hp - before });
    }
  }
  u.done = u.moved = u.attacked = true;
  return [{ type: 'heal', units: healed, by: u.id }];
}

export const convertTargets = (s, u) =>
  unitHas(u, 'convert') && !u.done && !u.attacked
    ? s.units.filter((o) => o.owner !== u.owner && dist(o, u) <= 1 && o.type !== 'giant')
    : [];
export const canConvert = (s, u) => convertTargets(s, u).length > 0;

export function convert(s, unitId, targetId) {
  const u = unitById(s, unitId);
  const o = unitById(s, targetId);
  if (!u || !o || u.owner !== s.current || !convertTargets(s, u).includes(o)) return [];
  const from = o.owner;
  o.owner = u.owner;
  o.home = null;
  o.done = o.moved = o.attacked = true;
  u.done = u.moved = u.attacked = true;
  return [{ type: 'convert', unit: o.id, by: u.id, from, owner: u.owner }];
}

export const canExamine = (s, u) => !u.done && !u.attacked && at(s, u.x, u.y).ruin;

export function examine(s, unitId) {
  const u = unitById(s, unitId);
  if (!u || u.owner !== s.current || !canExamine(s, u)) return [];
  const tile = at(s, u.x, u.y);
  tile.ruin = false;
  u.done = u.moved = u.attacked = true;
  const p = u.owner;
  const player = s.players[p];
  const events = [];
  const reward = pickWeighted(() => random(s), RUIN_REWARDS);
  let result = reward.id;
  let detail = '';
  if (result === 'tech') {
    const open = Object.keys(TECHS).filter((t) => techState(s, p, t) !== 'done' && techState(s, p, t) !== 'locked');
    if (open.length) {
      const tech = open.sort((a, b) => TECHS[a].tier - TECHS[b].tier)[0];
      player.techs.push(tech);
      detail = TECHS[tech].name;
      applyTechEffects(s, p, tech, events);
    } else result = 'stars';
  }
  if (result === 'population') {
    const city = playerCities(s, p).sort((a, b) => dist(a, u) - dist(b, u))[0];
    if (city) {
      detail = city.name;
      addPop(s, city, 3, events);
    } else result = 'stars';
  }
  if (result === 'veteran') {
    const spot = [at(s, u.x, u.y), ...around(s, u.x, u.y)].find((t) => passable(s, p, t) && !unitAt(s, t.x, t.y));
    if (spot) {
      const v = makeUnit(s, p, 'swordsman', spot.x, spot.y, null);
      v.veteran = true;
      v.maxHp += VETERAN_HP;
      v.hp = v.maxHp;
      events.push({ type: 'spawn', unit: snapshot(v) });
    } else result = 'stars';
  }
  if (result === 'explorer') exploreFrom(s, p, u.x, u.y, 15, events);
  if (result === 'stars') player.stars += 10;
  events.unshift({ type: 'ruin', x: tile.x, y: tile.y, player: p, reward: result, detail });
  return events;
}

export function disband(s, unitId) {
  const u = unitById(s, unitId);
  if (!u || u.owner !== s.current) return [];
  removeUnit(s, u);
  return [{ type: 'disband', unit: u.id }];
}

// ---------- Einheiten ausbilden ----------

export function trainOptions(s, city) {
  const p = city.owner;
  const blocked = Boolean(unitAt(s, city.x, city.y));
  const full = cityUnits(s, city).length >= unitCap(city.level);
  return Object.entries(UNITS)
    .filter(([, def]) => !def.special)
    .map(([type, def]) => {
      let reason = '';
      if (def.tech && !hasTech(s, p, def.tech)) reason = `Braucht ${TECHS[def.tech].name}`;
      else if (blocked) reason = 'Stadtfeld besetzt';
      else if (full) reason = 'Stadt ist voll';
      else if (s.players[p].stars < def.cost) reason = 'Zu wenig Sterne';
      return { type, cost: def.cost, ok: !reason, reason, locked: Boolean(def.tech && !hasTech(s, p, def.tech)) };
    });
}

export function train(s, cityId, type) {
  const city = cityById(s, cityId);
  if (!city || city.owner !== s.current) return [];
  const opt = trainOptions(s, city).find((o) => o.type === type);
  if (!opt || !opt.ok) return [];
  s.players[city.owner].stars -= opt.cost;
  const u = makeUnit(s, city.owner, type, city.x, city.y, city.id);
  return [{ type: 'train', unit: snapshot(u), city: city.id, cost: opt.cost }];
}

// ---------- Forschung ----------

export function techCost(s, p, tech) {
  const cities = Math.max(1, playerCities(s, p).length);
  let cost = TECHS[tech].tier * cities + 4;
  if (hasTech(s, p, 'philosophy')) cost = Math.ceil(cost * LITERACY);
  return cost;
}

export function techState(s, p, tech) {
  if (hasTech(s, p, tech)) return 'done';
  const parent = TECHS[tech].parent;
  if (parent && !hasTech(s, p, parent)) return 'locked';
  return s.players[p].stars >= techCost(s, p, tech) ? 'available' : 'expensive';
}

function applyTechEffects(s, p, tech, events) {
  events.push({ type: 'tech', player: p, tech });
  if (tech === 'diplomacy') {
    for (const c of s.cities) if (c.capital && c.owner !== p) reveal(s, p, c.x, c.y, 1, events);
  }
}

export function research(s, p, tech) {
  if (p !== s.current || techState(s, p, tech) !== 'available') return [];
  const events = [];
  s.players[p].stars -= techCost(s, p, tech);
  s.players[p].techs.push(tech);
  applyTechEffects(s, p, tech, events);
  return events;
}

// ---------- Kachel-Aktionen ----------

const cityTiles = (s, city) => s.tiles.filter((t) => t.owner === city.id);

function adjacentCount(s, tile, building, p) {
  return around(s, tile.x, tile.y).filter((o) => o.building === building && tileOwner(s, o) === p).length;
}

// Was auf dieser Kachel möglich wäre (inklusive gesperrter Möglichkeiten mit Grund)
export function tileActions(s, p, tile) {
  if (!tile || tileOwner(s, tile) !== p || tile.city != null || tile.village || tile.ruin) return [];
  const city = cityById(s, tile.owner);
  const enemy = unitAt(s, tile.x, tile.y);
  const list = [];
  for (const [id, a] of Object.entries(ACTIONS)) {
    if (!a.on.includes(tile.terrain)) continue;
    if (a.res && tile.resource !== a.res) continue;
    if (a.empty && (tile.resource || tile.building)) continue;
    if (a.build && tile.building) continue;
    if (a.road && (tile.road || tile.building)) continue;
    if (a.coast && !around(s, tile.x, tile.y).some((o) => isLand(o.terrain))) continue;
    let reason = '';
    if (!hasTech(s, p, a.tech)) reason = `Braucht ${TECHS[a.tech].name}`;
    else if (a.unique && cityTiles(s, city).some((t) => t.building === a.build)) reason = `${city.name} hat schon eins`;
    else if (enemy && enemy.owner !== p) reason = 'Gegner auf dem Feld';
    else if (s.players[p].stars < a.cost) reason = 'Zu wenig Sterne';
    let pop = a.pop || 0;
    if (a.adj) pop = adjacentCount(s, tile, a.adj, p) * a.per;
    list.push({ id, name: a.name, cost: a.cost, ok: !reason, reason, pop, stars: a.stars || 0, locked: !hasTech(s, p, a.tech) });
  }
  return list;
}

// Kann der Spieler diese Ressource jetzt nutzen (Technik, eigenes Gebiet, genug Sterne)? Dann leuchtet sie.
export const usableResource = (s, p, tile) => Boolean(tile.resource) && tileActions(s, p, tile).some((a) => a.ok && ACTIONS[a.id].res === tile.resource);

export function tileAction(s, p, x, y, actionId) {
  const tile = at(s, x, y);
  if (p !== s.current) return [];
  const opt = tileActions(s, p, tile).find((o) => o.id === actionId);
  if (!opt || !opt.ok) return [];
  const a = ACTIONS[actionId];
  const city = cityById(s, tile.owner);
  const player = s.players[p];
  const events = [{ type: 'tile', x, y, action: actionId, player: p, cost: a.cost }];
  player.stars -= a.cost;
  if (a.res) tile.resource = null;
  if (a.build) tile.building = a.build;
  if (a.to) {
    tile.terrain = a.to;
    tile.resource = a.addRes || null;
  }
  if (a.road) tile.road = true;
  if (a.stars) player.stars += a.stars;
  if (opt.pop > 0) addPop(s, city, opt.pop, events);
  // Neues Gebäude neben einer passenden Mühle/Sägewerk/Schmiede: deren Stadt wächst nachträglich
  if (a.build && ADJACENCY[a.build]) {
    const [partner, per] = ADJACENCY[a.build];
    for (const o of around(s, x, y)) {
      if (o.building === partner && tileOwner(s, o) === p) addPop(s, cityById(s, o.owner), per, events);
    }
  }
  return events;
}

// ---------- Stadt-Belohnungen ----------

export function chooseReward(s, cityId, rewardId) {
  const city = cityById(s, cityId);
  if (!city || city.owner !== s.current || !city.pending.length) return [];
  const level = city.pending[0];
  if (!rewardsFor(level).some((r) => r.id === rewardId)) return [];
  city.pending.shift();
  const p = city.owner;
  const events = [{ type: 'reward', city: city.id, reward: rewardId, level }];
  switch (rewardId) {
    case 'workshop':
      city.workshop = true;
      break;
    case 'explorer':
      exploreFrom(s, p, city.x, city.y, 15, events);
      break;
    case 'wall':
      city.wall = true;
      break;
    case 'resources':
      s.players[p].stars += 5;
      break;
    case 'growth':
      addPop(s, city, 3, events);
      break;
    case 'borders': {
      city.border = 2;
      const claimed = claimTerritory(s, city, 2);
      events.push({ type: 'territory', city: city.id, tiles: claimed });
      reveal(s, p, city.x, city.y, 3, events);
      break;
    }
    case 'park':
      city.parks++;
      break;
    case 'giant': {
      const spot = [at(s, city.x, city.y), ...around(s, city.x, city.y)].find((t) => passable(s, p, t) && !unitAt(s, t.x, t.y));
      if (spot) {
        const g = makeUnit(s, p, 'giant', spot.x, spot.y, null);
        events.push({ type: 'spawn', unit: snapshot(g) });
      } else s.players[p].stars += 5;
      break;
    }
    default:
  }
  return events;
}

// ---------- Rundenablauf ----------

export function startTurn(s, p) {
  const events = [{ type: 'turn', player: p, turn: s.turn }];
  for (const u of s.units) if (u.owner === p) u.moved = u.attacked = u.done = false;
  if (s.turn > 1) {
    const amount = income(s, p);
    s.players[p].stars += amount;
    events.push({ type: 'income', player: p, stars: amount });
  }
  return events;
}

export function endTurn(s) {
  if (s.over) return [];
  const events = [];
  const n = s.players.length;
  let p = s.current;
  for (let i = 0; i < n; i++) {
    p = (p + 1) % n;
    if (p === 0) s.turn++;
    if (s.players[p].alive) break;
  }
  if (s.mode === 'perfection' && s.turn > s.turnLimit) {
    finish(s, 'turns', events);
    return events;
  }
  s.current = p;
  events.push(...startTurn(s, p));
  return events;
}

function checkElimination(s, p, events) {
  const player = s.players[p];
  if (!player.alive || playerCities(s, p).length) return;
  player.alive = false;
  const gone = s.units.filter((u) => u.owner === p).map((u) => u.id);
  s.units = s.units.filter((u) => u.owner !== p);
  events.push({ type: 'eliminated', player: p, units: gone });
}

function checkGameOver(s, events) {
  if (s.over) return;
  const alive = s.players.filter((pl) => pl.alive);
  const humans = s.players.filter((pl) => pl.human);
  if (humans.length && humans.every((pl) => !pl.alive)) finish(s, 'defeat', events);
  else if (alive.length === 1) finish(s, 'domination', events);
}

function finish(s, reason, events) {
  const scores = s.players.map((_, p) => scoreOf(s, p).total);
  let winner;
  if (reason === 'domination') winner = s.players.findIndex((pl) => pl.alive);
  else {
    winner = 0;
    scores.forEach((sc, p) => {
      if (s.players[p].alive && (sc > scores[winner] || !s.players[winner].alive)) winner = p;
    });
  }
  // Bei „30 Runden“ endet das Spiel erst beim Wechsel in Runde 31 – angezeigt wird die letzte gespielte
  s.over = { reason, winner, scores, turn: s.mode === 'perfection' ? Math.min(s.turn, s.turnLimit) : s.turn };
  events.push({ type: 'gameover', ...s.over });
}

// ---------- Punkte ----------

export function scoreOf(s, p) {
  const player = s.players[p];
  const cities = playerCities(s, p);
  const explored = player.explored.reduce((n, v) => n + v, 0);
  const territory = s.tiles.filter((t) => tileOwner(s, t) === p).length;
  const temples = s.tiles.filter((t) => t.building === 'temple' && tileOwner(s, t) === p).length;
  const parts = {
    explore: explored * SCORE.explored,
    territory: territory * SCORE.territory,
    cities: cities.length * SCORE.city + cities.reduce((n, c) => n + c.level, 0) * SCORE.cityLevel,
    tech: player.techs.reduce((n, t) => n + TECHS[t].tier, 0) * SCORE.tech,
    army: playerUnits(s, p).reduce((n, u) => n + UNITS[u.type].cost + (u.naval ? NAVAL[u.naval].cost : 0), 0) * SCORE.army,
    temples: temples * SCORE.temple,
    parks: cities.reduce((n, c) => n + c.parks, 0) * SCORE.park,
  };
  return { parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
}

// ---------- Speichern ----------

export const serialize = (s) => JSON.stringify(s);
// Spielstand lesen; kaputte oder alte Stände ergeben null
export function deserialize(json) {
  let s;
  try {
    s = JSON.parse(json);
  } catch {
    return null;
  }
  if (!s || s.version !== SAVE_VERSION || !Array.isArray(s.tiles)) return null;
  return s;
}

export { TRIBES };
