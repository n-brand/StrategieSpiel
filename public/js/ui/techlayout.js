// Forschungsbaum als Stern: Lage der Techniken um den eigenen Stamm in der Mitte.
// Reine Rechnung ohne DOM – geprüft in tests/techtree.test.mjs.
// Maße in Knotendurchmessern (D): Abstände großzügig, damit Namen und Bilder Luft haben.

import { TECH_TREE } from '../game/rules.js';

// Richtung der fünf Äste (Grad, 0 = rechts, im Uhrzeigersinn)
export const BRANCH_ANGLES = { riding: -90, organization: -18, climbing: 54, fishing: 126, hunting: 198 };
export const RINGS = [1.95, 3.35, 4.95]; // Abstand der Stufen 1–3 von der Mitte
export const SPREAD = [21, 25]; // Auffächern der beiden Ketten je Ast (Grad) auf Stufe 2 und 3
export const CENTER_RADIUS = 0.74; // Stamm-Bild in der Mitte

// Lange Namen passen nicht in eine Zeile im Kreis: Trennstelle für zwei Zeilen
export const LABEL_BREAKS = {
  forestry: ['Forst-', 'wirtschaft'],
  farming: ['Land-', 'wirtschaft'],
  spiritualism: ['Spiritua-', 'lismus'],
  chivalry: ['Ritter-', 'lichkeit'],
  archery: ['Bogen-', 'schießen'],
  organization: ['Organi-', 'sation'],
  philosophy: ['Philo-', 'sophie'],
};

export const labelLines = (id, name) => LABEL_BREAKS[id] || [name];

export function techLayout(D = 100) {
  const size = Math.ceil(2 * (RINGS[2] + 0.75) * D); // äußerer Ring + Knoten + Preisschild
  const c = size / 2;
  const at = (r, deg) => ({ x: c + r * D * Math.cos((deg * Math.PI) / 180), y: c + r * D * Math.sin((deg * Math.PI) / 180) });
  const pos = {};
  const edges = []; // [von, nach]; von = null heißt: aus der Mitte
  for (const { root, chains } of TECH_TREE) {
    const a = BRANCH_ANGLES[root];
    pos[root] = at(RINGS[0], a);
    edges.push([null, root]);
    chains.forEach(([t2, t3], i) => {
      const side = i === 0 ? -1 : 1;
      pos[t2] = at(RINGS[1], a + side * SPREAD[0]);
      pos[t3] = at(RINGS[2], a + side * SPREAD[1]);
      edges.push([root, t2], [t2, t3]);
    });
  }
  return { D, size, center: { x: c, y: c }, pos, edges };
}
