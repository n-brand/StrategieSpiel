// Computergegner: spielt einen ganzen Zug über dieselben Engine-Funktionen wie der Mensch.
// Reihenfolge: Belohnungen wählen → Einheiten (einnehmen, angreifen, ziehen) → Geld ausgeben (Forschung,
// Kachel-Aktionen, Einheiten) → neue Belohnungen. Entscheidungen über Wert pro Stern; Zufall aus dem
// Spielzustand, damit Simulationen wiederholbar sind.
// Bei der Eroberung zusätzlich: Stadtwachen gemeinsam angreifen, leere Feindstädte sofort besetzen, mit vielen
// Einheiten auf dieselbe Stadt ziehen und weitersuchen, solange ein Stamm ohne bekannte Stadt lebt.

import * as E from './engine.js';
import { UNITS, NAVAL, TECHS, ACTIONS, DIFFICULTIES, isLand, isWater, unitCap, popToGrow } from './rules.js';
import { random } from './rng.js';

// ---------- Wege über Land und Wasser ----------
// Zustände sind (Kachel, auf dem Wasser?). An Land geht es über begehbare Kacheln, aufs Wasser nur über
// eigene Häfen, auf dem Wasser über befahrbare Kacheln (Ozean mit Schiff oder Segeln), an Land überall.

const landOk = (s, p, t) => E.passable(s, p, t);
const waterOk = (s, p, t, ocean) => E.sailable(s, p, t, ocean);
const canOcean = (s, p, u) => Boolean(u.naval && NAVAL[u.naval].ocean) || E.hasTech(s, p, 'sailing');
const stateKey = (i, sea) => i * 2 + (sea ? 1 : 0);

// Schritte von einer Einheit zu allen Kacheln (kleinster Wert über beide Zustände)
function travelFrom(s, p, unit, maxSteps = 40) {
  const ocean = canOcean(s, p, unit);
  const startI = E.idx(s, unit.x, unit.y);
  const startSea = Boolean(unit.naval);
  const seen = new Set([stateKey(startI, startSea)]);
  const best = new Map([[startI, 0]]);
  let frontier = [[startI, startSea]];
  for (let d = 1; d <= maxSteps && frontier.length; d++) {
    const next = [];
    for (const [i, sea] of frontier) {
      const t = s.tiles[i];
      for (const o of E.around(s, t.x, t.y)) {
        const oi = E.idx(s, o.x, o.y);
        let nsea;
        if (!sea) {
          if (landOk(s, p, o)) nsea = false;
          else if (E.isExplored(s, p, o.x, o.y) && E.ownPort(s, p, o)) nsea = true;
          else continue;
        } else if (waterOk(s, p, o, ocean)) nsea = true;
        else if (landOk(s, p, o)) nsea = false;
        else continue;
        const k = stateKey(oi, nsea);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!best.has(oi)) best.set(oi, d);
        next.push([oi, nsea]);
      }
    }
    frontier = next;
  }
  return best;
}

// Entfernung zum Ziel für jeden Zustand (rückwärts vom Ziel aus gesucht) – zum Wählen des nächsten Schritts
function towardField(s, p, goal, ocean, maxSteps = 50) {
  const gi = E.idx(s, goal.x, goal.y);
  const gSea = isWater(E.at(s, goal.x, goal.y).terrain);
  const dist = new Map([[stateKey(gi, gSea), 0]]);
  let frontier = [[gi, gSea]];
  for (let d = 1; d <= maxSteps && frontier.length; d++) {
    const next = [];
    for (const [i, sea] of frontier) {
      const b = s.tiles[i];
      for (const a of E.around(s, b.x, b.y)) {
        const preds = [];
        if (!sea) {
          if (landOk(s, p, a)) preds.push(false);
          if (waterOk(s, p, a, ocean)) preds.push(true);
        } else {
          if (waterOk(s, p, a, ocean)) preds.push(true);
          if (E.ownPort(s, p, b) && landOk(s, p, a)) preds.push(false);
        }
        const ai = E.idx(s, a.x, a.y);
        for (const asea of preds) {
          const k = stateKey(ai, asea);
          if (dist.has(k)) continue;
          dist.set(k, d);
          next.push([ai, asea]);
        }
      }
    }
    frontier = next;
  }
  return (t) => dist.get(stateKey(E.idx(s, t.x, t.y), isWater(t.terrain)));
}

// Über Land erreichbar (von allen eigenen Städten und Landeinheiten aus)
function landReach(s, p) {
  const seen = new Set();
  const queue = [];
  for (const o of [...E.playerCities(s, p), ...E.playerUnits(s, p).filter((u) => !u.naval)]) {
    const i = E.idx(s, o.x, o.y);
    if (!seen.has(i)) {
      seen.add(i);
      queue.push(o);
    }
  }
  while (queue.length) {
    const t = queue.pop();
    for (const o of E.around(s, t.x, t.y)) {
      const i = E.idx(s, o.x, o.y);
      if (seen.has(i) || !landOk(s, p, o)) continue;
      seen.add(i);
      queue.push(o);
    }
  }
  return seen;
}

// ---------- Lage einschätzen ----------

function analyze(s, p) {
  const diff = DIFFICULTIES[s.difficulty] || DIFFICULTIES.normal;
  const cities = E.playerCities(s, p);
  const units = E.playerUnits(s, p);
  const enemies = s.units.filter((u) => u.owner !== p && E.isExplored(s, p, u.x, u.y));
  const threat = new Map();
  for (const c of cities) {
    let t = 0;
    for (const e of enemies) if (E.dist(e, c) <= 3) t += E.stats(e).atk * (e.hp / e.maxHp) * (E.dist(e, c) <= 1 ? 2 : 1);
    threat.set(c.id, t);
  }
  const villages = s.tiles.filter((t) => t.village && E.isExplored(s, p, t.x, t.y));
  const enemyCities = s.cities.filter((c) => c.owner !== p && E.isExplored(s, p, c.x, c.y));
  const explored = s.players[p].explored.reduce((n, v) => n + v, 0) / s.tiles.length;
  // Gefahr: wie viel Schaden in der nächsten Runde auf einer Kachel droht (grob)
  const danger = new Map();
  for (const e of enemies) {
    const st = E.stats(e);
    for (const t of E.around(s, e.x, e.y, st.move + st.range)) {
      const i = E.idx(s, t.x, t.y);
      danger.set(i, (danger.get(i) || 0) + st.atk * (e.hp / e.maxHp));
    }
  }
  // Ziele, die nur übers Wasser erreichbar sind (Grund für Häfen, Fischen und Segeln)
  const reach = landReach(s, p);
  const overseas = [...villages, ...enemyCities.map((c) => E.at(s, c.x, c.y))].filter((t) => !reach.has(E.idx(s, t.x, t.y)));
  const ports = s.tiles.filter((t) => E.ownPort(s, p, t));
  // Heimat fertig erkundet und nichts mehr zu holen? Dann muss es übers Meer weitergehen
  const ex = s.players[p].explored;
  const landFrontier = [...reach].some((i) => {
    const t = s.tiles[i];
    return E.around(s, t.x, t.y).some((o) => !ex[E.idx(s, o.x, o.y)]);
  });
  const landTargets = villages.length + enemyCities.length - overseas.length;
  const needSea = !landFrontier && landTargets === 0 && explored < 0.9;
  // Eroberung: Gegner ganz erledigen statt Punkte sammeln
  const conquest = s.mode === 'domination';
  // Bekannte Städte je Stamm (wie viele er wirklich hat, sieht man nicht): wenige = schwach, die letzte = Ausscheiden
  const knownCities = s.players.map((pl) => enemyCities.filter((c) => c.owner === pl.index).length);
  // Lebt noch ein Stamm, von dem keine Stadt bekannt ist? Dann muss weiter gesucht werden.
  const hidden = conquest && s.players.some((pl) => pl.alive && pl.index !== p && !knownCities[pl.index]);
  // Bekannte Feindstädte mit Mauer: dagegen helfen nur Katapulte, Riesen und vereinte Angriffe
  const walls = enemyCities.filter((c) => c.wall).length;
  return {
    p,
    diff,
    conquest,
    aggression: diff.aggression * (s.turn > 6 ? 1 : 0.4),
    cities,
    units,
    enemies,
    threat,
    villages,
    enemyCities,
    explored,
    danger,
    overseas,
    landTargets,
    needSea,
    ports,
    knownCities,
    hidden,
    walls,
    claimed: new Set(),
    crowd: new Map(), // Eroberung: wie viele Einheiten in diesem Zug schon auf ein gemeinsames Ziel zuhalten
  };
}

const valueOf = (u) => UNITS[u.type].cost + (u.naval ? NAVAL[u.naval].cost : 0) + (u.veteran ? 2 : 0);

// ---------- Belohnungen ----------

function pickReward(s, p, city, ctx) {
  const level = city.pending[0];
  const r = random(s);
  if (level === 2) return ctx.explored < 0.5 && r < 0.3 ? 'explorer' : 'workshop';
  if (level === 3) return (ctx.threat.get(city.id) || 0) > 0 || (city.capital && r < 0.4) ? 'wall' : 'resources';
  if (level === 4) {
    const ring = E.around(s, city.x, city.y, 2).filter((t) => t.owner == null && t.resource);
    return ring.length >= 3 ? 'borders' : 'growth';
  }
  // Punkte zählen bei der Eroberung nicht – dort immer der Riese
  return ctx.conquest || (ctx.aggression >= 0.5 && r < 0.6) ? 'giant' : 'park';
}

function resolveRewards(s, p, ctx, events) {
  for (const c of E.playerCities(s, p)) {
    let guard = 0;
    while (c.pending.length && guard++ < 10) events.push(...E.chooseReward(s, c.id, pickReward(s, p, c, ctx)));
  }
}

// ---------- Einheiten ----------

// Beste Angriffsmöglichkeit dieser Einheit (optional nach einer Bewegung, wenn sie Vorstoß hat)
// Nur Felder in derselben Welt (Land bleibt Land, Wasser bleibt Wasser) – Einschiffen/Anlanden ändert die Werte
const sameDomain = (s, u, t) => Boolean(u.naval) === isWater(t.terrain);

function bestAttack(s, u, ctx, allowMove = true) {
  const spots = [{ x: u.x, y: u.y, here: true }];
  if (allowMove && E.canMove(u) && E.unitHas(u, 'dash')) for (const t of E.moveTargets(s, u)) if (sameDomain(s, u, t)) spots.push({ x: t.x, y: t.y });
  const ox = u.x;
  const oy = u.y;
  let best = null;
  for (const spot of spots) {
    if (!spot.here && !E.canMove(u)) continue;
    u.x = spot.x;
    u.y = spot.y;
    const wasMoved = u.moved;
    if (!spot.here) u.moved = true;
    for (const t of E.attackTargets(s, u)) {
      const pv = E.combat(s, u, t);
      const tv = valueOf(t);
      const mv = valueOf(u);
      let v = pv.kill ? tv + 2 : (pv.dmg / t.maxHp) * tv;
      v -= pv.dies ? mv + 1 : (pv.ret / u.maxHp) * mv * 0.6;
      const nearMine = ctx.cities.some((c) => E.dist(c, t) <= 1);
      if (nearMine) v *= 1.6;
      if (E.cityAt(s, t.x, t.y)) v *= 1.2;
      // Nach der Bewegung danebenstehen: Gefahr einrechnen
      if (!spot.here && !pv.kill) v -= ((ctx.danger.get(E.idx(s, spot.x, spot.y)) || 0) / u.maxHp) * mv * 0.3;
      if (!best || v > best.v) best = { v, target: t, spot, pv };
    }
    u.moved = wasMoved;
  }
  u.x = ox;
  u.y = oy;
  return best;
}

function tryAttack(s, u, ctx, events, allowMove = true) {
  if (!E.canAttack(u)) return false;
  const best = bestAttack(s, u, ctx, allowMove);
  const threshold = 0.4 + (1 - ctx.aggression) * 0.8;
  if (!best || best.v < threshold) return false;
  if (!best.spot.here) events.push(...E.move(s, u.id, best.spot.x, best.spot.y));
  if (!E.unitById(s, u.id) || !E.attackTargets(s, u).includes(best.target)) return false;
  events.push(...E.attack(s, u.id, best.target.id));
  return true;
}

// Ziel für die Bewegung: Dörfer, feindliche Städte, Ruinen, bedrohte eigene Städte, Unerforschtes
function chooseGoal(s, u, ctx) {
  const p = u.owner;
  const reach = travelFrom(s, p, u, 30);
  const steps = (t) => reach.get(E.idx(s, t.x, t.y));
  const goals = [];
  // shared: Ziel für mehrere Einheiten (Belagerung, Suche nach versteckten Städten) – jede weitere bringt etwas
  // weniger. Sonst gehört das Ziel der ersten Einheit, die es wählt.
  const add = (t, weight, shared = false) => {
    const d = steps(t);
    if (d === undefined) return;
    const key = E.idx(s, t.x, t.y);
    if (!shared && ctx.claimed.has(key)) return;
    const n = shared ? ctx.crowd.get(key) || 0 : 0;
    goals.push({ x: t.x, y: t.y, key, score: weight / (1 + d) / (1 + n * 0.3), shared });
  };
  for (const v of ctx.villages) if (!E.unitAt(s, v.x, v.y) || E.unitAt(s, v.x, v.y) === u) add(v, 10);
  for (const t of s.tiles) if (t.ruin && E.isExplored(s, p, t.x, t.y) && (!E.unitAt(s, t.x, t.y) || E.unitAt(s, t.x, t.y) === u)) add(t, 6);
  for (const c of ctx.enemyCities) {
    const guard = E.unitAt(s, c.x, c.y);
    const weight = (guard && guard.owner === c.owner ? 6 : 12) * ctx.aggression + c.level;
    if (!ctx.conquest) add(c, weight);
    // Eroberung: bis zu 8 Einheiten je Stadt, Stämme mit wenigen Städten zuerst
    else if ((ctx.crowd.get(E.idx(s, c.x, c.y)) || 0) < 8) add(c, weight + 6 / ctx.knownCities[c.owner], true);
  }
  for (const c of ctx.cities) {
    const th = ctx.threat.get(c.id) || 0;
    if (th > 0) add(c, 8 + th);
  }
  if (ctx.aggression > 0.5) for (const e of ctx.enemies) add(e, 4 * ctx.aggression);
  // Erkunden: erreichbare Kacheln am Rand des Bekannten – auch auf dem Wasser (Landeinheiten über eigene Häfen)
  if (ctx.explored < 0.95 || ctx.hidden) {
    const ocean = canOcean(s, p, u);
    for (const t of s.tiles) {
      if (!E.isExplored(s, p, t.x, t.y)) continue;
      const water = waterOk(s, p, t, ocean);
      if (!E.passable(s, p, t) && !water) continue;
      if (!E.around(s, t.x, t.y).some((o) => !E.isExplored(s, p, o.x, o.y))) continue;
      add(t, water ? (u.naval ? 4 : ctx.needSea ? 3 : 1.5) : 3, ctx.hidden);
    }
  }
  goals.sort((a, b) => b.score - a.score);
  return goals[0] || null;
}

function moveToward(s, u, goal, ctx, events) {
  if (!E.canMove(u)) return;
  const field = towardField(s, u.owner, goal, canOcean(s, u.owner, u));
  const here = field(E.at(s, u.x, u.y)) ?? 99;
  let best = null;
  for (const t of E.moveTargets(s, u)) {
    const d = field(t);
    if (d === undefined) continue;
    const danger = ctx.danger.get(E.idx(s, t.x, t.y)) || 0;
    const score = d + (danger / u.hp) * (1.2 - ctx.aggression);
    if (!best || score < best.score) best = { t, score, d };
  }
  if (best && best.d < here) events.push(...E.move(s, u.id, best.t.x, best.t.y));
}

function actUnit(s, u, ctx, events) {
  if (!E.unitById(s, u.id)) return;
  // Einnehmen und Ruinen haben Vorrang
  if (E.captureTarget(s, u)) {
    events.push(...E.capture(s, u.id));
    return;
  }
  if (E.canExamine(s, u)) {
    events.push(...E.examine(s, u.id));
    return;
  }
  if (E.canPromote(u)) events.push(...E.promote(s, u.id));
  // Boote aufrüsten: zum Schiff (Ozean), später zum Schlachtschiff
  const up = E.upgradeOption(s, u);
  if (up?.ok && (up.to === 'ship' || (ctx.aggression >= 0.6 && s.players[u.owner].stars >= up.cost + 5))) events.push(...E.upgrade(s, u.id));
  // Gedankenformer: heilen oder bekehren
  if (u.type === 'mindbender') {
    const target = E.convertTargets(s, u).sort((a, b) => valueOf(b) - valueOf(a))[0];
    if (target) {
      events.push(...E.convert(s, u.id, target.id));
      return;
    }
    if (E.canHealOthers(s, u)) {
      events.push(...E.healOthers(s, u.id));
      return;
    }
  }
  if (tryAttack(s, u, ctx, events)) {
    if (E.unitById(s, u.id) && E.canMove(u)) retreat(s, u, ctx, events);
    if (E.unitById(s, u.id) && E.canAttack(u)) tryAttack(s, u, ctx, events, false);
    return;
  }
  // Verletzt und keine akute Gefahr: erholen
  const tile = E.at(s, u.x, u.y);
  const danger = ctx.danger.get(E.idx(s, u.x, u.y)) || 0;
  if (u.hp < u.maxHp * 0.5 && E.canRecover(s, u) && (danger < u.hp || tile.city != null)) {
    events.push(...E.recover(s, u.id));
    return;
  }
  // Letzter Verteidiger einer bedrohten Stadt bleibt stehen
  const myCity = E.cityAt(s, u.x, u.y);
  if (myCity && myCity.owner === u.owner && (ctx.threat.get(myCity.id) || 0) > 0) {
    if (E.canRecover(s, u)) events.push(...E.recover(s, u.id));
    return;
  }
  const goal = chooseGoal(s, u, ctx);
  if (goal) {
    if (goal.shared) ctx.crowd.set(goal.key, (ctx.crowd.get(goal.key) || 0) + 1);
    else ctx.claimed.add(goal.key);
    moveToward(s, u, goal, ctx, events);
  }
  if (E.unitById(s, u.id) && E.canAttack(u)) tryAttack(s, u, ctx, events, false);
  if (E.unitById(s, u.id) && E.canRecover(s, u) && u.hp < u.maxHp) events.push(...E.recover(s, u.id));
}

// Reiter nach dem Angriff zurückziehen (Rückzug)
function retreat(s, u, ctx, events) {
  let best = null;
  for (const t of E.moveTargets(s, u)) {
    if (!sameDomain(s, u, t)) continue;
    const d = ctx.danger.get(E.idx(s, t.x, t.y)) || 0;
    if (!best || d < best.d) best = { t, d };
  }
  const here = ctx.danger.get(E.idx(s, u.x, u.y)) || 0;
  if (best && best.d < here) events.push(...E.move(s, u.id, best.t.x, best.t.y));
}

// Kampfvorschau, als stünde die Einheit auf (x, y) – der Gegenschlag hängt vom Abstand ab
function combatFrom(s, u, target, x, y) {
  const ox = u.x;
  const oy = u.y;
  u.x = x;
  u.y = y;
  const pv = E.combat(s, u, target);
  u.x = ox;
  u.y = oy;
  return pv;
}

// Eroberung: Die Wache einer Feindstadt gemeinsam erledigen, auch wenn einzelne Angriffe sich nicht lohnen.
// Mit dabei ist, wer sie schon in Reichweite hat oder per Vorstoß auf ein freies Feld in Reichweite kommt
// (nicht aber, wer gerade selbst eine Stadt einnimmt). Reihenfolge: Wer trifft, ohne viel einzustecken, schlägt
// zuerst zu; den letzten Schlag führt möglichst ein Nahkämpfer an Land, der dann in die Stadt nachrückt.
// Lohnt sich nur, wenn die Wache fällt und die voraussichtlichen Verluste den Wert der Stadt nicht übersteigen.
function planStrike(s, p, guard, city, ctx) {
  const options = [];
  for (const u of E.playerUnits(s, p)) {
    if (E.captureTarget(s, u) || !E.canAttack(u)) continue;
    const st = E.stats(u);
    if (E.attackTargets(s, u).includes(guard)) options.push({ u, spots: [{ x: u.x, y: u.y, here: true }] });
    else if (E.canMove(u) && E.unitHas(u, 'dash') && E.dist(u, guard) <= st.range + st.move * 2) {
      const spots = E.moveTargets(s, u).filter((t) => sameDomain(s, u, t) && E.dist(t, guard) <= st.range);
      if (spots.length) options.push({ u, spots });
    }
  }
  const hp0 = guard.hp;
  const taken = new Set();
  const plan = [];
  let lost = 0;
  while (options.length && guard.hp > 0) {
    let best = null;
    for (const o of options) {
      for (const spot of o.spots) {
        if (!spot.here && taken.has(E.idx(s, spot.x, spot.y))) continue;
        const pv = combatFrom(s, o.u, guard, spot.x, spot.y);
        const advances = !o.u.naval && E.stats(o.u).range === 1;
        const score = pv.kill
          ? 100 + (advances ? 10 : 0) - valueOf(o.u)
          : pv.dmg - (pv.dies ? 2 * valueOf(o.u) : (pv.ret / o.u.hp) * valueOf(o.u) * 0.5);
        if (!best || score > best.score) best = { o, spot, pv, score };
      }
    }
    if (!best) break;
    plan.push({ u: best.o.u, spot: best.spot });
    options.splice(options.indexOf(best.o), 1);
    taken.add(E.idx(s, best.spot.x, best.spot.y));
    if (best.pv.dies) lost += valueOf(best.o.u);
    guard.hp -= best.pv.dmg;
  }
  const fell = guard.hp <= 0;
  guard.hp = hp0;
  // Erst in diesem Zug entdeckte Städte zählen wie die einzige bekannte ihres Stamms
  const worth = (6 + 2 * city.level + 10 / Math.max(1, ctx.knownCities[city.owner])) * ctx.aggression * 1.5;
  return fell && lost <= worth ? plan : null;
}

function assault(s, p, ctx, events) {
  if (!ctx.conquest) return;
  for (const city of s.cities) {
    const guard = E.unitAt(s, city.x, city.y);
    if (city.owner === p || !guard || guard.owner === p || !E.isExplored(s, p, city.x, city.y)) continue;
    if (ctx.diff.slack && random(s) < ctx.diff.slack) continue; // leichte Gegner lassen manches liegen
    const plan = planStrike(s, p, guard, city, ctx);
    if (!plan) continue;
    for (const { u, spot } of plan) {
      if (!E.unitById(s, guard.id) || !E.unitById(s, u.id)) break;
      if (!spot.here) events.push(...E.move(s, u.id, spot.x, spot.y));
      if (!E.attackTargets(s, u).includes(guard)) break;
      events.push(...E.attack(s, u.id, guard.id));
    }
  }
}

// Eroberung: Leere Feindstadt sofort besetzen, sonst bildet der Gegner im nächsten Zug eine neue Wache aus.
// Wer zu Beginn des eigenen Zugs darauf steht, nimmt sie ein. Am liebsten zieht die standfesteste Einheit ein –
// aber nicht der Verteidiger einer bedrohten eigenen Stadt.
function occupyCities(s, p, ctx, events) {
  if (!ctx.conquest) return;
  for (const c of s.cities) {
    if (c.owner === p || E.unitAt(s, c.x, c.y) || !E.isExplored(s, p, c.x, c.y)) continue;
    if (ctx.diff.slack && random(s) < ctx.diff.slack) continue; // leichte Gegner lassen manches liegen
    let best = null;
    for (const u of E.playerUnits(s, p)) {
      if (!E.canMove(u) || E.dist(u, c) > 6) continue;
      const guarding = E.cityAt(s, u.x, u.y);
      if (guarding && guarding.owner === p && (ctx.threat.get(guarding.id) || 0) > 0) continue;
      if (!E.moveTargets(s, u).some((t) => t.x === c.x && t.y === c.y)) continue;
      const sturdy = UNITS[u.type].def * u.hp;
      if (!best || sturdy > best.sturdy) best = { u, sturdy };
    }
    if (best) events.push(...E.move(s, best.u.id, c.x, c.y));
  }
}

function unitsPhase(s, p, ctx, events) {
  const order = { catapult: 0, archer: 1, mindbender: 2, knight: 3, rider: 4, swordsman: 5, giant: 6, warrior: 7, defender: 8 };
  const units = E.playerUnits(s, p).sort((a, b) => {
    const ca = E.captureTarget(s, a) ? -1 : 0;
    const cb = E.captureTarget(s, b) ? -1 : 0;
    return ca - cb || (order[a.type] ?? 9) - (order[b.type] ?? 9);
  });
  // Eroberung: erst gemeinsam auf Stadtwachen, dann hinein in leere Feindstädte
  assault(s, p, ctx, events);
  occupyCities(s, p, ctx, events);
  for (const u of units) {
    if (ctx.diff.slack && random(s) < ctx.diff.slack) continue; // leichte Gegner lassen manches liegen
    actUnit(s, u, ctx, events);
  }
}

// ---------- Geld ausgeben ----------

function techValue(s, p, tech, ctx, depth = 0) {
  let v = 0.3;
  for (const [, a] of Object.entries(ACTIONS)) {
    if (a.tech !== tech || a.road) continue;
    for (const t of s.tiles) {
      if (E.tileOwner(s, t) !== p || t.city != null || t.village) continue;
      if (!a.on.includes(t.terrain)) continue;
      if (a.res && t.resource !== a.res) continue;
      if (a.empty && (t.resource || t.building)) continue;
      v += (a.pop || 0) * (a.empty ? 0.15 : 1) + (a.stars || 0) / 5;
    }
  }
  const unit = Object.entries(UNITS).find(([, d]) => d.tech === tech);
  if (unit) {
    const maxThreat = Math.max(0, ...ctx.threat.values());
    v += tech === 'riding' ? 1.5 + ctx.villages.length * 0.2 : 0;
    v += ['archery', 'strategy'].includes(tech) ? maxThreat * 0.3 + 0.5 : 0;
    v += ['smithery', 'chivalry', 'mathematics'].includes(tech) ? ctx.aggression * (s.turn / 6) : 0;
  }
  if (tech === 'climbing') v += s.tiles.filter((t) => E.tileOwner(s, t) === p && t.terrain === 'mountain').length * 0.4;
  if (tech === 'philosophy') v += 1.5;
  // Seefahrt lohnt sich, wenn Dörfer oder Gegner nur übers Wasser erreichbar sind (oder die Heimat ausgeschöpft ist)
  const over = ctx.overseas.length + (ctx.needSea ? 3 : 0);
  if (tech === 'fishing' && over) v += 2 + over * 0.4 + (ctx.landTargets ? 0 : 2);
  if (tech === 'sailing' && over) v += 1.2 + over * 0.25;
  if (tech === 'navigation' && over) v += ctx.aggression * (s.turn / 8);
  // Eroberung gegen Mauern: Katapulte (Mathematik) samt Weg dorthin
  if (ctx.conquest && ctx.walls && ['hunting', 'forestry', 'mathematics'].includes(tech)) v += 2 + ctx.walls;
  if (depth < 1) {
    for (const [id, t] of Object.entries(TECHS)) if (t.parent === tech) v += techValue(s, p, id, ctx, depth + 1) * 0.4;
  }
  return v;
}

function trainChoice(s, city, purpose) {
  const opts = E.trainOptions(s, city).filter((o) => o.ok);
  const has = (t) => opts.find((o) => o.type === t);
  const pref = {
    defend: ['defender', 'archer', 'swordsman', 'warrior'],
    expand: ['rider', 'warrior'],
    attack: ['knight', 'swordsman', 'catapult', 'archer', 'rider', 'warrior'],
  }[purpose];
  for (const t of pref) if (has(t)) return has(t);
  return null;
}

function spendPhase(s, p, ctx, events) {
  const player = s.players[p];
  for (let guard = 0; guard < 40; guard++) {
    const options = [];
    // Forschung
    for (const tech of Object.keys(TECHS)) {
      if (E.techState(s, p, tech) !== 'available') continue;
      const cost = E.techCost(s, p, tech);
      options.push({ kind: 'tech', tech, cost, value: techValue(s, p, tech, ctx) });
    }
    // Kachel-Aktionen (ohne Straßen und Umgestalten)
    for (const t of s.tiles) {
      if (E.tileOwner(s, t) !== p) continue;
      for (const a of E.tileActions(s, p, t)) {
        if (!a.ok || ['road', 'clearforest', 'burnforest', 'growforest'].includes(a.id)) continue;
        if (a.id === 'market' && E.marketIncome(s, E.cityById(s, t.owner)) < 1) continue;
        const city = E.cityById(s, t.owner);
        // Einwohner sind die wichtigste Investition: jede Stadtstufe bringt dauerhaft Sterne
        let value = a.pop * 1.3 + a.stars / 4 + (ACTIONS[a.id].build === 'temple' ? 0.6 : 0);
        if (a.pop && city.pop + a.pop >= popToGrow(city.level)) value += 0.8;
        // Hafen als Tor zu Zielen übers Wasser (je näher daran, desto besser)
        if (a.id === 'port' && (ctx.overseas.length || ctx.needSea) && ctx.ports.length < 1 + Math.floor(ctx.cities.length / 3)) {
          const near = ctx.overseas.length ? Math.min(...ctx.overseas.map((o) => E.dist(o, t))) : 4;
          value += 3 + 4 / (1 + near);
        }
        if (value <= 0) continue;
        options.push({ kind: 'tile', x: t.x, y: t.y, action: a.id, cost: a.cost, value });
      }
    }
    // Einheiten
    const mobile = E.playerUnits(s, p).filter((u) => u.type !== 'defender').length;
    for (const c of E.playerCities(s, p)) {
      if (E.cityUnits(s, c).length >= unitCap(c.level) || E.unitAt(s, c.x, c.y)) continue;
      const th = ctx.threat.get(c.id) || 0;
      let purpose = null;
      let value = 0;
      if (th > 0) {
        purpose = 'defend';
        value = 2.5 + th / 3;
      } else if (ctx.villages.length > mobile - 1 && s.turn < 20) {
        purpose = 'expand';
        value = 1.6 + ctx.villages.length * 0.1;
      } else if (ctx.enemyCities.length || ctx.enemies.length) {
        purpose = 'attack';
        value = 0.8 + ctx.aggression * 1.6 * Math.min(1, s.turn / 10);
      } else if (mobile < 2 + ctx.cities.length) {
        purpose = 'expand';
        value = 1;
      }
      if (!purpose) continue;
      const choice = trainChoice(s, c, purpose);
      if (choice) options.push({ kind: 'train', city: c.id, type: choice.type, cost: choice.cost, value: value * (choice.cost / 3) });
    }
    if (!options.length) break;
    for (const o of options) o.ratio = o.value / Math.max(1, o.cost);
    options.sort((a, b) => b.ratio - a.ratio);
    ctx.log?.push(`★${player.stars}: ${options.slice(0, 4).map((o) => `${o.kind}:${o.tech || o.action || o.type}=${o.ratio.toFixed(2)}`).join(' ')}`);
    const pick = options[0];
    if (pick.ratio < 0.12) break;
    if (ctx.diff.slack && random(s) < ctx.diff.slack * 0.5) break;
    let ev = [];
    if (pick.kind === 'tech') ev = E.research(s, p, pick.tech);
    else if (pick.kind === 'tile') ev = E.tileAction(s, p, pick.x, pick.y, pick.action);
    else ev = E.train(s, pick.city, pick.type);
    if (!ev.length) break;
    events.push(...ev);
    if (player.stars <= 0) break;
  }
}

// ---------- Ein ganzer Zug ----------

// log: optionales Array, in das die Kaufentscheidungen geschrieben werden (zum Nachvollziehen)
export function playTurn(s, { log = null } = {}) {
  const p = s.current;
  const events = [];
  if (s.over || !s.players[p].alive) return events;
  let ctx = analyze(s, p);
  resolveRewards(s, p, ctx, events);
  unitsPhase(s, p, ctx, events);
  if (s.over) return events;
  ctx = analyze(s, p);
  ctx.log = log;
  spendPhase(s, p, ctx, events);
  resolveRewards(s, p, analyze(s, p), events);
  return events;
}

export { isLand };
