// Zufall mit Startwert (mulberry32): gleiche Startzahl = gleiche Karte, gleiche Kämpfe der Computer.
// Der Spielzustand trägt seinen Zufall in state.rng mit, damit Speichern/Laden genau weiterläuft.

export function step(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

// Zufallszahl 0..1 aus dem Spielzustand (verändert state.rng)
export function random(state) {
  const { next, value } = step(state.rng);
  state.rng = next;
  return value;
}

// Eigenständiger Zufallsgenerator (z. B. für die Kartenerzeugung)
export function makeRng(seed) {
  const holder = { rng: seed >>> 0 };
  return () => random(holder);
}

export const randInt = (rnd, n) => Math.floor(rnd() * n);
export const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

export function shuffle(rnd, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Gewichtete Auswahl aus [{ weight, … }]
export function pickWeighted(rnd, list) {
  const total = list.reduce((n, e) => n + e.weight, 0);
  let r = rnd() * total;
  for (const e of list) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return list[list.length - 1];
}

export const newSeed = () => (Math.random() * 4294967296) >>> 0;
