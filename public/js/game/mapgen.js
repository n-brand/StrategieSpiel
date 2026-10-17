// Kartenerzeugung: ein Kontinent aus Rauschen, Hauptstädte möglichst weit auseinander, Klimazonen je Stamm
// (Gelände und Ressourcen nach dem Stamm, dessen Hauptstadt am nächsten liegt), Dörfer, Ressourcen und Ruinen.
// Alle Hauptstädte sind über Land verbunden (Schiffe kommen erst in Etappe 2).

import { TRIBES, tribeById, isLand } from './rules.js';
import { makeRng, shuffle } from './rng.js';

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Wertrauschen: zufällige Gitterwerte, weich dazwischen interpoliert
function valueNoise(rnd, size, cell) {
  const gw = Math.ceil(size / cell) + 2;
  const grid = Array.from({ length: gw * gw }, () => rnd());
  const at = (i, j) => grid[j * gw + i];
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    return lerp(lerp(at(x0, y0), at(x0 + 1, y0), tx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty);
  };
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const eucl = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Kartentypen: Anteil Land, wie stark der Rand zu Wasser wird, ob alle Stämme über Land verbunden sind;
// water: false = gar kein Wasser (alles Land).
// islands: Land wächst als Inseln um Mittelpunkte – 'capitals' (je Stamm ein Kontinent, dazu kleine Inseln)
// oder 'many' (viele kleine Inseln); radius = Inselgröße im Verhältnis zur Kartenbreite.
export const MAP_TYPES = {
  pangaea: { name: 'Kontinent', land: 0.55, falloff: 1.1, connect: true },
  drylands: { name: 'Trockenland', land: 1, falloff: 0, water: false, connect: true },
  continents: { name: 'Kontinente', land: 0.46, islands: 'capitals', radius: 0.3, extra: 2, connect: false },
  archipelago: { name: 'Inseln', land: 0.36, islands: 'many', radius: 0.17, extra: 0, connect: false },
};

// Punkte möglichst weit auseinander wählen (mehrere Versuche, der mit dem größten Mindestabstand gewinnt)
function spreadOut(rnd, pool, k, fixed = []) {
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const chosen = fixed.length ? [...fixed] : [pool[Math.floor(rnd() * pool.length)]];
    const start = chosen.length;
    while (chosen.length < start + k - (fixed.length ? 0 : 1)) {
      let pickT = null;
      let pickD = -1;
      for (const t of pool) {
        const d = Math.min(...chosen.map((o) => eucl(o, t))) + rnd() * 0.5;
        if (d > pickD) {
          pickD = d;
          pickT = t;
        }
      }
      if (!pickT) break;
      chosen.push(pickT);
    }
    const mine = chosen.slice(fixed.length);
    let minD = Infinity;
    for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) minD = Math.min(minD, eucl(chosen[i], chosen[j]));
    if (!best || minD > best.minD) best = { chosen: mine, minD };
    if (fixed.length) break; // Zusätzliche Punkte: ein Durchgang genügt
  }
  return best.chosen;
}

export function generateMap({ size = 14, tribes = ['nord', 'stein'], seed = 1, type = 'pangaea' } = {}) {
  const rnd = makeRng(seed);
  const cfg = MAP_TYPES[type] || MAP_TYPES.pangaea;
  const n = size * size;
  const tiles = Array.from({ length: n }, (_, i) => ({
    x: i % size,
    y: Math.floor(i / size),
    terrain: 'ocean',
    resource: null,
    climate: tribes[0],
    village: false,
    ruin: false,
  }));
  const at = (x, y) => (x >= 0 && y >= 0 && x < size && y < size ? tiles[y * size + x] : null);
  const around = (t, r = 1) => {
    const list = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!dx && !dy) continue;
        const o = at(t.x + dx, t.y + dy);
        if (o) list.push(o);
      }
    }
    return list;
  };

  // 1. Höhen: drei Rausch-Ebenen, zum Rand hin abgesenkt (Inselkarten: plus Hügel um Inselmittelpunkte)
  const big = valueNoise(rnd, size, Math.max(3, size / 3));
  const mid = valueNoise(rnd, size, Math.max(2, size / 6));
  const fine = valueNoise(rnd, size, 2);
  const c = (size - 1) / 2;
  const k = tribes.length;
  const noiseAt = (t) => big(t.x, t.y) * 0.6 + mid(t.x, t.y) * 0.3 + fine(t.x, t.y) * 0.1;
  let capitals;
  let height;
  if (cfg.islands) {
    // Erst die Hauptstädte verteilen, dann um sie herum (und um weitere Mittelpunkte) Land wachsen lassen
    const inner = tiles.filter((t) => t.x >= 2 && t.y >= 2 && t.x < size - 2 && t.y < size - 2);
    capitals = spreadOut(rnd, inner, k);
    const extraCount = cfg.islands === 'many' ? Math.max(2, Math.round(n / 40)) : cfg.extra;
    const extra = extraCount ? spreadOut(rnd, inner, extraCount, capitals) : [];
    const centers = [...capitals.map((t) => ({ t, w: 1 })), ...extra.map((t) => ({ t, w: 0.75 }))];
    const radius = cfg.radius * size;
    height = tiles.map((t) => {
      let h = noiseAt(t) * 0.35;
      for (const { t: ct, w } of centers) {
        const f = Math.max(0, 1 - eucl(ct, t) / radius);
        h += w * f * f;
      }
      return h;
    });
  } else {
    height = tiles.map((t) => {
      const edge = Math.max(Math.abs(t.x - c), Math.abs(t.y - c)) / (size / 2);
      return noiseAt(t) - edge * edge * cfg.falloff * 0.6;
    });
  }
  const sorted = [...height].sort((a, b) => b - a);
  const threshold = sorted[Math.floor(n * cfg.land)];
  tiles.forEach((t, i) => (t.terrain = cfg.water === false || height[i] > threshold ? 'field' : 'ocean'));

  // 2. Hauptstädte (Festland-Karten): möglichst weit auseinander auf Land
  if (!capitals) {
    const inner = tiles.filter((t) => isLand(t.terrain) && t.x >= 1 && t.y >= 1 && t.x < size - 1 && t.y < size - 1);
    const pool = inner.length >= k ? inner : tiles.filter((t) => t.x >= 1 && t.y >= 1 && t.x < size - 1 && t.y < size - 1);
    capitals = spreadOut(rnd, pool, k);
  }

  // Inselkarten: Ohne Hafen kommt man nie von der Heimatinsel weg – Hauptstädte im Landesinneren rücken an die Küste
  if (cfg.islands) {
    capitals.forEach((cap, i) => {
      if (around(cap).some((o) => !isLand(o.terrain))) return;
      const others = capitals.filter((_, j) => j !== i);
      const spots = tiles
        .filter((t) => isLand(t.terrain) && t.x >= 1 && t.y >= 1 && t.x < size - 1 && t.y < size - 1)
        .filter((t) => cheb(t, cap) <= 4 && others.every((o) => cheb(o, t) >= 4))
        .filter((t) => around(t).some((o) => !isLand(o.terrain)) && around(t).filter((o) => isLand(o.terrain)).length >= 4)
        .sort((a, b) => eucl(a, cap) - eucl(b, cap));
      if (spots[0]) capitals[i] = spots[0];
    });
  }

  // Rund um jede Hauptstadt genug Land (mindestens 6 der 8 Nachbarn; auf Inselkarten 5 und etwas Küste bleibt)
  for (const cap of capitals) {
    cap.terrain = 'field';
    if (!cfg.islands) for (const o of around(cap)) if (!isLand(o.terrain) && rnd() < 0.75) o.terrain = 'field';
    const water = around(cap).filter((o) => !isLand(o.terrain));
    const minLand = cfg.islands ? 5 : 6;
    const keep = cfg.islands ? 1 : 0;
    while (around(cap).filter((o) => isLand(o.terrain)).length < minLand && water.length > keep) water.pop().terrain = 'field';
  }

  // 3. Festland-Karten: alle Hauptstädte über Land verbinden (Landbrücken quer durchs Wasser)
  const connected = () => {
    const seen = new Set([capitals[0]]);
    const queue = [capitals[0]];
    while (queue.length) {
      const t = queue.pop();
      for (const o of around(t)) {
        if (!seen.has(o) && isLand(o.terrain)) {
          seen.add(o);
          queue.push(o);
        }
      }
    }
    return capitals.filter((cap) => !seen.has(cap));
  };
  for (let guard = 0; guard < 10 && cfg.connect; guard++) {
    const missing = connected();
    if (!missing.length) break;
    for (const cap of missing) {
      // Zur nächsten verbundenen Hauptstadt eine Brücke ziehen
      const target = capitals.filter((o) => !missing.includes(o)).sort((a, b) => eucl(a, cap) - eucl(b, cap))[0];
      let x = cap.x;
      let y = cap.y;
      while (x !== target.x || y !== target.y) {
        x += Math.sign(target.x - x);
        y += Math.sign(target.y - y);
        const t = at(x, y);
        if (!isLand(t.terrain)) t.terrain = 'field';
      }
    }
  }

  // 4. Klima: nächstgelegene Hauptstadt bestimmt den Stamm der Gegend
  for (const t of tiles) {
    let bestI = 0;
    let bestD = Infinity;
    capitals.forEach((cap, i) => {
      const d = eucl(cap, t) + rnd() * 0.6;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    t.climate = tribes[bestI];
  }

  // 5. Gelände je Klima: Wald, Berge, Wiese
  for (const t of tiles) {
    if (!isLand(t.terrain)) continue;
    const cl = tribeById(t.climate).climate;
    const r = rnd();
    t.terrain = r < cl.mountain ? 'mountain' : r < cl.mountain + cl.forest ? 'forest' : 'field';
  }
  for (const cap of capitals) cap.terrain = 'field';

  // 6. Wasser: Flachwasser an der Küste, sonst Ozean
  for (const t of tiles) {
    if (isLand(t.terrain)) continue;
    t.terrain = around(t).some((o) => isLand(o.terrain)) ? 'shallow' : 'ocean';
  }

  // 7. Dörfer: auf Land, mit Abstand zueinander und zu den Hauptstädten
  const land = tiles.filter((t) => isLand(t.terrain));
  const villages = [];
  const target = Math.max(k * 2, Math.round(land.length / 10));
  for (const t of shuffle(rnd, land)) {
    if (villages.length >= target) break;
    if (capitals.some((cap) => cheb(cap, t) < 3)) continue;
    if (villages.some((v) => cheb(v, t) < (cfg.islands ? 2 : 3))) continue; // auf Inseln dichter
    villages.push(t);
  }
  for (const v of villages) {
    v.terrain = 'field';
    v.village = true;
  }

  // 8. Ressourcen: viele rund um Dörfer und Hauptstädte, wenige anderswo
  const core = new Set();
  for (const s of [...capitals, ...villages]) for (const o of around(s)) core.add(o);
  for (const t of tiles) {
    if (t.village || capitals.includes(t)) continue;
    const cl = tribeById(t.climate).climate;
    const f = core.has(t) ? 1 : 0.3;
    const r = rnd();
    if (t.terrain === 'field') {
      if (r < cl.fruit * f) t.resource = 'fruit';
      else if (r < (cl.fruit + cl.crop) * f) t.resource = 'crop';
    } else if (t.terrain === 'forest') {
      if (r < cl.animal * f) t.resource = 'animal';
    } else if (t.terrain === 'mountain') {
      if (r < cl.ore * f) t.resource = 'ore';
    } else if (t.terrain === 'shallow') {
      if (r < cl.fish * f) t.resource = 'fish';
    } else if (t.terrain === 'ocean') {
      if (r < cl.whale * 0.5) t.resource = 'whale';
    }
  }

  // Jede Hauptstadt bekommt mindestens zwei Ressourcen passend zur Start-Technik
  const make = { animal: ['forest', 'animal'], ore: ['mountain', 'ore'], fruit: ['field', 'fruit'], crop: ['field', 'crop'] };
  capitals.forEach((cap, i) => {
    const want = tribeById(tribes[i]).start;
    const area = around(cap).filter((o) => isLand(o.terrain) && !o.village);
    let have = area.filter((o) => o.resource === want).length;
    for (const o of shuffle(rnd, area)) {
      if (have >= 2) break;
      if (o.resource === want) continue;
      [o.terrain, o.resource] = make[want];
      have++;
    }
    // und noch etwas Obst für den Anfang
    if (want !== 'fruit' && !area.some((o) => o.resource === 'fruit')) {
      const spot = area.find((o) => o.terrain === 'field' && !o.resource);
      if (spot) spot.resource = 'fruit';
    }
  });

  // 9. Ruinen: abseits der Siedlungen
  const ruins = [];
  const ruinTarget = Math.max(1, Math.round(n / 55));
  for (const t of shuffle(rnd, land)) {
    if (ruins.length >= ruinTarget) break;
    if (t.village || core.has(t) || capitals.includes(t)) continue;
    if ([...capitals, ...villages, ...ruins].some((o) => cheb(o, t) < 2)) continue;
    t.ruin = true;
    t.resource = null;
    ruins.push(t);
  }
  // Inselkarten: auch Ruinen draußen auf dem Ozean (nur mit Schiffen erreichbar)
  if (cfg.islands) {
    const oceanRuins = Math.max(1, Math.round(n / 120));
    let placed = 0;
    for (const t of shuffle(rnd, tiles.filter((o) => o.terrain === 'ocean'))) {
      if (placed >= oceanRuins) break;
      if ([...capitals, ...villages, ...ruins].some((o) => cheb(o, t) < 3)) continue;
      t.ruin = true;
      t.resource = null;
      ruins.push(t);
      placed++;
    }
  }

  return {
    size,
    tiles: tiles.map(({ x, y, terrain, resource, climate, village, ruin }) => ({ x, y, terrain, resource, climate, village, ruin })),
    capitals: capitals.map(({ x, y }) => ({ x, y })),
  };
}

export const tribeIds = () => TRIBES.map((t) => t.id);
