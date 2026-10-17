// Low-Poly-Modelle aus einfachen Grundformen: Gelände, Bäume, Berge, Ressourcen, Dörfer, Städte, Gebäude
// und Einheiten. Alles wird mit Eckfarben zu wenigen großen Geometrien zusammengefügt (flach schattiert),
// damit auch ältere iPhones die Karte flüssig zeichnen.

import * as THREE from 'three';
import { tribeById } from '../game/rules.js';

// ---------- Zusammenfügen ----------

const tmpColor = new THREE.Color();
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export class Builder {
  constructor() {
    this.pos = [];
    this.col = [];
  }

  // geo: Grundform · color: '#rrggbb' · p: Position · r: Drehung (Bogenmaß) · s: Skalierung
  add(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    tmpMatrix.compose(tmpPos.set(...p), tmpQuat.setFromEuler(tmpEuler.set(...r)), tmpScale.set(...s));
    const src = g.attributes.position.array;
    tmpColor.set(color);
    const v = new THREE.Vector3();
    for (let i = 0; i < src.length; i += 3) {
      v.set(src[i], src[i + 1], src[i + 2]).applyMatrix4(tmpMatrix);
      this.pos.push(v.x, v.y, v.z);
      this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
    if (g !== geo) g.dispose();
    return this;
  }

  get empty() {
    return this.pos.length === 0;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// Grundformen (einmal angelegt, oft benutzt)
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone5: new THREE.ConeGeometry(1, 1, 5),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone7: new THREE.ConeGeometry(1, 1, 7),
  cyl5: new THREE.CylinderGeometry(1, 1, 1, 5),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  taper6: new THREE.CylinderGeometry(0.75, 1, 1, 6),
  ico: new THREE.IcosahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1, 0),
  dodec: new THREE.DodecahedronGeometry(1, 0),
  tetra: new THREE.TetrahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.12, 4, 12),
  dome: new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2),
};

// Feste Pseudo-Zufallszahl je Kachel (gleiche Karte sieht immer gleich aus)
export function hash(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shade(hex, amount) {
  tmpColor.set(hex);
  const hsl = {};
  tmpColor.getHSL(hsl);
  tmpColor.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return `#${tmpColor.getHexString()}`;
}

export const COLORS = {
  shallow: '#5cc3dd',
  ocean: '#2f8fc6',
  sea: '#2b7fb8',
  dust: '#c4ab7c', // Boden rund um das Trockenland (kein Meer)
  snow: '#f4f6f8',
  wood: '#8d5a2b',
  woodDark: '#6b4220',
  stone: '#c4c9d0',
  stoneDark: '#8c939c',
  wall: '#f6ecda',
  skin: '#f2c08f',
  metal: '#dee2e6',
  horse: '#9c6b46',
  road: '#d8b87c',
  cloud: '#ffffff',
};

export const LAND_TOP = 0; // Oberkante Land
export const WATER_TOP = -0.14; // Oberkante Flachwasser
export const OCEAN_TOP = -0.2;
export const MOUNTAIN_TOP = 0.16; // Oberkante des Felssockels: hier stehen Figuren, Erz, Bergtempel

// ---------- Gelände ----------

export function addTerrain(b, tile, wx, wz, climateId) {
  const cl = tribeById(climateId).climate;
  const j = (hash(tile.x, tile.y) - 0.5) * 0.06;
  if (tile.terrain === 'shallow' || tile.terrain === 'ocean') {
    const top = tile.terrain === 'shallow' ? WATER_TOP : OCEAN_TOP;
    const color = tile.terrain === 'shallow' ? COLORS.shallow : COLORS.ocean;
    b.add(G.box, shade(color, j * 0.5), { p: [wx, top - 0.05, wz], s: [1, 0.1, 1] });
    return;
  }
  b.add(G.box, cl.side, { p: [wx, -0.22, wz], s: [1, 0.4, 1] });
  b.add(G.box, shade(cl.field, j), { p: [wx, -0.015, wz], s: [1, 0.03, 1] });
}

// ---------- Dekoration ----------

function tree(b, cl, x, z, size = 1, k = 0) {
  if (cl.palm) {
    const lean = (hash(x * 10, z * 10, k) - 0.5) * 0.4;
    b.add(G.cyl5, COLORS.wood, { p: [x, 0.17 * size, z], r: [0, 0, lean], s: [0.025 * size, 0.34 * size, 0.025 * size] });
    const top = [x - Math.sin(lean) * 0.17 * size, 0.35 * size, z];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.add(G.box, i % 2 ? cl.tree : cl.tree2, {
        p: [top[0] + Math.cos(a) * 0.08 * size, top[1] - 0.02, top[2] + Math.sin(a) * 0.08 * size],
        r: [0, -a, 0.45],
        s: [0.17 * size, 0.02, 0.06 * size],
      });
    }
    return;
  }
  b.add(G.cyl5, COLORS.woodDark, { p: [x, 0.05 * size, z], s: [0.03 * size, 0.1 * size, 0.03 * size] });
  b.add(G.cone6, k % 2 ? cl.tree : cl.tree2, { p: [x, 0.22 * size, z], s: [0.15 * size, 0.3 * size, 0.15 * size] });
  b.add(G.cone6, k % 2 ? cl.tree2 : cl.tree, { p: [x, 0.36 * size, z], s: [0.1 * size, 0.2 * size, 0.1 * size] });
}

function forest(b, cl, wx, wz, tile, few = false) {
  const spots = few ? [[-0.25, -0.22], [0.27, 0.24]] : [[-0.24, -0.2], [0.22, -0.26], [0.02, 0.06], [-0.26, 0.26], [0.28, 0.22]];
  spots.forEach(([dx, dz], i) => {
    const sz = 0.8 + hash(tile.x, tile.y, i + 3) * 0.45;
    tree(b, cl, wx + dx, wz + dz, sz, i + tile.x);
  });
}

// Berg: breiter Felssockel mit flacher Oberseite (dort stehen Figuren und Gebäude), Gipfel nach hinten
// gerückt (von der Kamera weg), damit nichts in den Gipfeln steckt
function mountain(b, cl, wx, wz, tile) {
  const h = 0.5 + hash(tile.x, tile.y, 9) * 0.18;
  const rot = hash(tile.x, tile.y, 4) * Math.PI;
  b.add(G.taper6, shade(cl.rock, -0.04), { p: [wx, MOUNTAIN_TOP / 2, wz], r: [0, rot, 0], s: [0.46, MOUNTAIN_TOP, 0.46] });
  b.add(G.cone5, cl.rock, { p: [wx - 0.19, 0.08 + h / 2, wz - 0.19], r: [0, rot, 0], s: [0.26, h, 0.26] });
  b.add(G.cone5, shade(cl.rock, -0.07), { p: [wx - 0.27, 0.06 + h * 0.3, wz + 0.1], r: [0, rot + 1, 0], s: [0.16, h * 0.6, 0.16] });
  b.add(G.cone5, shade(cl.rock, 0.03), { p: [wx + 0.1, 0.06 + h * 0.25, wz - 0.28], r: [0, rot + 2, 0], s: [0.13, h * 0.5, 0.13] });
  if (cl.snow) b.add(G.cone5, COLORS.snow, { p: [wx - 0.19, 0.08 + h - 0.09, wz - 0.19], r: [0, rot, 0], s: [0.1, 0.18, 0.1] });
}

function fruit(b, wx, wz) {
  const spots = [[-0.18, -0.12], [0.2, 0.12], [-0.05, 0.24]];
  spots.forEach(([dx, dz], i) => {
    b.add(G.ico, '#3f9a45', { p: [wx + dx, 0.1, wz + dz], s: [0.13, 0.11, 0.13] });
    b.add(G.ico, i === 1 ? '#f59f00' : '#f03e3e', { p: [wx + dx + 0.05, 0.17, wz + dz + 0.04], s: [0.04, 0.04, 0.04] });
    b.add(G.ico, '#f03e3e', { p: [wx + dx - 0.06, 0.15, wz + dz - 0.03], s: [0.035, 0.035, 0.035] });
  });
}

function crop(b, wx, wz) {
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 2; k++) {
      const x = wx - 0.24 + i * 0.24;
      const z = wz - 0.14 + k * 0.28;
      b.add(G.cone4, k ? '#f2c94c' : '#e3b23c', { p: [x, 0.09, z], s: [0.07, 0.18, 0.07] });
    }
  }
}

function animal(b, wx, wz) {
  const x = wx + 0.08;
  const z = wz + 0.05;
  b.add(G.box, '#a8643a', { p: [x, 0.17, z], s: [0.22, 0.1, 0.09] });
  for (const [dx, dz] of [[-0.08, -0.03], [-0.08, 0.03], [0.08, -0.03], [0.08, 0.03]]) {
    b.add(G.box, '#6e3f22', { p: [x + dx, 0.06, z + dz], s: [0.025, 0.12, 0.025] });
  }
  b.add(G.box, '#a8643a', { p: [x + 0.13, 0.25, z], r: [0, 0, 0.5], s: [0.05, 0.12, 0.05] });
  b.add(G.box, '#a8643a', { p: [x + 0.17, 0.3, z], s: [0.08, 0.05, 0.05] });
  b.add(G.box, '#f1e3c8', { p: [x + 0.14, 0.36, z - 0.03], r: [0.4, 0, 0.2], s: [0.015, 0.09, 0.015] });
  b.add(G.box, '#f1e3c8', { p: [x + 0.14, 0.36, z + 0.03], r: [-0.4, 0, 0.2], s: [0.015, 0.09, 0.015] });
}

function fish(b, wx, wz) {
  b.add(G.torus, '#e7f5ff', { p: [wx, WATER_TOP + 0.005, wz], r: [Math.PI / 2, 0, 0], s: [0.24, 0.24, 0.3] });
  for (const [dx, dz, rot] of [[-0.08, -0.05, 0.4], [0.12, 0.08, 2.6]]) {
    b.add(G.oct, '#ff922b', { p: [wx + dx, WATER_TOP + 0.03, wz + dz], r: [0, rot, 0], s: [0.09, 0.035, 0.04] });
    b.add(G.tetra, '#ff922b', { p: [wx + dx - Math.cos(rot) * 0.1, WATER_TOP + 0.03, wz + dz + Math.sin(rot) * 0.1], r: [0, rot, 0], s: [0.04, 0.04, 0.04] });
  }
}

// Erz liegt nur auf Bergen: vorne auf dem Felssockel
function ore(b, wx, wz) {
  const y = MOUNTAIN_TOP;
  b.add(G.dodec, COLORS.stoneDark, { p: [wx - 0.17, y + 0.05, wz + 0.17], s: [0.09, 0.07, 0.09] });
  b.add(G.oct, '#a5d8ff', { p: [wx - 0.14, y + 0.14, wz + 0.13], r: [0.2, 0.4, 0], s: [0.05, 0.11, 0.05] });
  b.add(G.oct, '#4dabf7', { p: [wx - 0.22, y + 0.11, wz + 0.21], r: [-0.3, 0, 0.2], s: [0.04, 0.08, 0.04] });
}

function whale(b, wx, wz) {
  b.add(G.dome, '#364fc7', { p: [wx, OCEAN_TOP, wz], s: [0.28, 0.12, 0.16] });
  b.add(G.box, '#364fc7', { p: [wx - 0.3, OCEAN_TOP + 0.06, wz], r: [0, 0, 0.6], s: [0.12, 0.03, 0.14] });
  b.add(G.ico, '#e7f5ff', { p: [wx + 0.12, OCEAN_TOP + 0.2, wz], s: [0.05, 0.08, 0.05] });
}

// Umriss zum Leuchten: dieselben Teile wie die Ressource, jedes etwas größer (nur die Form zählt)
const RESOURCE_MODELS = { fruit, crop, animal, fish, ore, whale };
export function addResourceOutline(b, tile, wx, wz) {
  const fat = { add: (geo, color, o = {}) => b.add(geo, '#ffffff', { ...o, s: (o.s || [1, 1, 1]).map((v) => v * 1.18 + 0.02) }) };
  RESOURCE_MODELS[tile.resource]?.(fat, wx, wz);
}

function hut(b, x, z, roof, wall = COLORS.wall, size = 1, rot = 0) {
  b.add(G.box, wall, { p: [x, 0.07 * size, z], r: [0, rot, 0], s: [0.18 * size, 0.14 * size, 0.18 * size] });
  b.add(G.cone4, roof, { p: [x, 0.19 * size, z], r: [0, rot + Math.PI / 4, 0], s: [0.16 * size, 0.12 * size, 0.16 * size] });
}

function village(b, wx, wz) {
  hut(b, wx - 0.12, wz - 0.08, '#8d6e63', '#e9dcc3');
  hut(b, wx + 0.16, wz + 0.12, '#a1887f', '#e9dcc3', 0.85, 0.5);
  b.add(G.cyl6, COLORS.woodDark, { p: [wx + 0.18, 0.02, wz - 0.2], s: [0.08, 0.04, 0.08] });
}

// Ruine; y = Bodenhöhe (auf dem Wasser ragt sie als kleine Felseninsel heraus)
function ruin(b, wx, wz, y = 0) {
  if (y < 0) b.add(G.dodec, COLORS.stoneDark, { p: [wx, y - 0.02, wz], s: [0.34, 0.1, 0.28] });
  b.add(G.box, COLORS.stoneDark, { p: [wx, y + 0.025, wz], s: [0.5, 0.05, 0.4] });
  for (const [dx, h] of [[-0.18, 0.32], [0.0, 0.18], [0.18, 0.26]]) b.add(G.cyl6, COLORS.stone, { p: [wx + dx, y + h / 2, wz - 0.1], s: [0.05, h, 0.05] });
  b.add(G.box, COLORS.stone, { p: [wx + 0.08, y + 0.07, wz + 0.14], r: [0, 0.6, 0.15], s: [0.3, 0.06, 0.08] });
  b.add(G.oct, '#ffd43b', { p: [wx - 0.05, y + 0.1, wz + 0.05], s: [0.04, 0.06, 0.04] });
}

// Stadt: mehr Häuser je Stufe, Dächer in Stammesfarbe, Hauptstadt mit Turm, Mauer als Ring
// Die Mitte bleibt frei für eine Einheit; Turm hinten (von der Kamera weg), Häuser im Ring drumherum
function city(b, wx, wz, c, color, dark) {
  const n = Math.min(2 + c.level, 7);
  const ring = [[0.06, -0.33], [-0.33, 0.06], [0.31, -0.2], [-0.2, 0.31], [0.34, 0.1], [0.1, 0.34], [0.3, 0.3]];
  for (let i = 0; i < n; i++) {
    const [dx, dz] = ring[i];
    const tall = 1 + (i < c.level - 1 ? 0.3 : 0);
    hut(b, wx + dx, wz + dz, i % 2 ? color : dark, COLORS.wall, 0.8 * tall, (i % 3) * 0.3);
  }
  const tx = wx - 0.28;
  const tz = wz - 0.28;
  if (c.capital) {
    b.add(G.cyl6, COLORS.wall, { p: [tx, 0.22, tz], s: [0.1, 0.44, 0.1] });
    b.add(G.cone6, color, { p: [tx, 0.51, tz], s: [0.13, 0.16, 0.13] });
    b.add(G.box, color, { p: [tx + 0.06, 0.66, tz], s: [0.1, 0.06, 0.01] });
    b.add(G.box, COLORS.woodDark, { p: [tx, 0.64, tz], s: [0.012, 0.14, 0.012] });
  } else {
    b.add(G.cyl6, COLORS.wall, { p: [tx, 0.13, tz], s: [0.08, 0.26, 0.08] });
    b.add(G.cone6, color, { p: [tx, 0.32, tz], s: [0.1, 0.12, 0.1] });
  }
  // Platz in der Mitte
  b.add(G.cyl8, '#e9dcc3', { p: [wx, 0.005, wz], s: [0.2, 0.01, 0.2] });
  if (c.wall) {
    for (const [dx, dz, sx, sz] of [[0, -0.44, 0.92, 0.06], [0, 0.44, 0.92, 0.06], [-0.44, 0, 0.06, 0.92], [0.44, 0, 0.06, 0.92]]) {
      b.add(G.box, COLORS.stone, { p: [wx + dx, 0.06, wz + dz], s: [sx, 0.12, sz] });
    }
    for (const [dx, dz] of [[-0.44, -0.44], [0.44, -0.44], [0.44, 0.44], [-0.44, 0.44]]) {
      b.add(G.cyl6, COLORS.stone, { p: [wx + dx, 0.09, wz + dz], s: [0.07, 0.18, 0.07] });
    }
  }
  for (let i = 0; i < c.parks; i++) {
    b.add(G.ico, '#51cf66', { p: [wx - 0.32 + i * 0.1, 0.12, wz + 0.36], s: [0.07, 0.09, 0.07] });
  }
}

// Gebäude auf Kacheln
function building(b, kind, wx, wz, tile, color) {
  switch (kind) {
    case 'farm':
      for (let i = 0; i < 4; i++) b.add(G.box, i % 2 ? '#e3b23c' : '#b5873a', { p: [wx - 0.27 + i * 0.18, 0.02, wz + 0.04], s: [0.13, 0.04, 0.6] });
      hut(b, wx + 0.26, wz - 0.3, '#c92a2a', '#f8f0e3', 0.8);
      break;
    case 'windmill':
      b.add(G.taper6, COLORS.wall, { p: [wx, 0.2, wz], s: [0.12, 0.4, 0.12] });
      b.add(G.cone6, color, { p: [wx, 0.46, wz], s: [0.14, 0.14, 0.14] });
      for (let i = 0; i < 4; i++) b.add(G.box, COLORS.woodDark, { p: [wx + 0.13, 0.4, wz], r: [(i * Math.PI) / 2 + 0.4, 0, 0], s: [0.01, 0.42, 0.06] });
      break;
    case 'lumberhut':
      hut(b, wx - 0.05, wz + 0.05, '#6b4220', '#c8a27a', 0.9);
      for (let i = 0; i < 3; i++) b.add(G.cyl6, COLORS.wood, { p: [wx + 0.2, 0.03 + i * 0.045, wz + 0.25], r: [0, 0, Math.PI / 2], s: [0.025, 0.2, 0.025] });
      break;
    case 'sawmill':
      b.add(G.box, '#c8a27a', { p: [wx, 0.09, wz], s: [0.32, 0.18, 0.22] });
      b.add(G.cone4, color, { p: [wx, 0.25, wz], r: [0, Math.PI / 4, 0], s: [0.25, 0.12, 0.2] });
      b.add(G.cyl8, COLORS.metal, { p: [wx + 0.2, 0.12, wz + 0.15], r: [Math.PI / 2, 0, 0], s: [0.09, 0.01, 0.09] });
      break;
    case 'mine':
      b.add(G.box, '#343a40', { p: [wx - 0.24, 0.1, wz + 0.26], s: [0.14, 0.18, 0.06] });
      b.add(G.box, COLORS.wood, { p: [wx - 0.24, 0.2, wz + 0.29], s: [0.2, 0.03, 0.03] });
      b.add(G.box, '#868e96', { p: [wx - 0.02, 0.04, wz + 0.32], s: [0.12, 0.06, 0.08] });
      break;
    case 'forge':
      b.add(G.box, '#adb5bd', { p: [wx, 0.1, wz], s: [0.3, 0.2, 0.24] });
      b.add(G.cone4, color, { p: [wx, 0.26, wz], r: [0, Math.PI / 4, 0], s: [0.24, 0.12, 0.2] });
      b.add(G.box, '#495057', { p: [wx + 0.1, 0.32, wz - 0.06], s: [0.06, 0.22, 0.06] });
      b.add(G.ico, '#ff922b', { p: [wx - 0.16, 0.06, wz + 0.15], s: [0.05, 0.05, 0.05] });
      break;
    case 'market':
      for (const [dx, c2] of [[-0.15, '#ff8787'], [0.15, '#ffd43b']]) {
        b.add(G.box, COLORS.wood, { p: [wx + dx, 0.06, wz], s: [0.2, 0.12, 0.16] });
        b.add(G.box, c2, { p: [wx + dx, 0.2, wz], r: [0.25, 0, 0], s: [0.24, 0.02, 0.22] });
      }
      break;
    case 'port':
      b.add(G.box, COLORS.wood, { p: [wx, WATER_TOP + 0.04, wz], s: [0.6, 0.04, 0.22] });
      for (const dx of [-0.25, 0, 0.25]) b.add(G.cyl5, COLORS.woodDark, { p: [wx + dx, WATER_TOP, wz + 0.12], s: [0.025, 0.14, 0.025] });
      b.add(G.box, color, { p: [wx + 0.2, WATER_TOP + 0.16, wz - 0.02], s: [0.1, 0.06, 0.01] });
      break;
    case 'temple': {
      const base = tile.terrain === 'shallow' || tile.terrain === 'ocean' ? WATER_TOP : tile.terrain === 'mountain' ? MOUNTAIN_TOP : 0;
      for (let i = 0; i < 3; i++) b.add(G.box, i % 2 ? '#e9dcc3' : '#f8f0e3', { p: [wx, base + 0.04 + i * 0.08, wz], s: [0.46 - i * 0.12, 0.08, 0.46 - i * 0.12] });
      b.add(G.oct, '#ffd43b', { p: [wx, base + 0.32, wz], s: [0.06, 0.09, 0.06] });
      break;
    }
    default:
  }
}

function road(b, wx, wz, dirs) {
  b.add(G.cyl8, COLORS.road, { p: [wx, 0.004, wz], s: [0.13, 0.01, 0.13] });
  for (const [dx, dz] of dirs) {
    const len = Math.hypot(dx, dz) * 0.5;
    b.add(G.box, COLORS.road, { p: [wx + dx * 0.25, 0.003, wz + dz * 0.25], r: [0, -Math.atan2(dz, dx), 0], s: [len, 0.008, 0.16] });
  }
}

// Alles Feste auf einer Kachel (ohne Einheiten)
export function addDecor(b, s, tile, wx, wz, extra) {
  const cl = tribeById(tile.climate).climate;
  const owner = extra.city;
  const tribe = owner ? tribeById(s.players[owner.owner].tribe) : null;
  const color = tribe ? tribe.color : '#adb5bd';
  if (tile.terrain === 'forest') forest(b, cl, wx, wz, tile, Boolean(tile.building));
  if (tile.terrain === 'mountain') mountain(b, cl, wx, wz, tile);
  if (tile.road && extra.roadDirs) road(b, wx, wz, extra.roadDirs);
  if (tile.resource === 'fruit') fruit(b, wx, wz);
  else if (tile.resource === 'crop') crop(b, wx, wz);
  else if (tile.resource === 'animal') animal(b, wx, wz);
  else if (tile.resource === 'fish') fish(b, wx, wz);
  else if (tile.resource === 'ore') ore(b, wx, wz);
  else if (tile.resource === 'whale') whale(b, wx, wz);
  if (tile.village) village(b, wx, wz);
  if (tile.ruin) ruin(b, wx, wz, tile.terrain === 'shallow' ? WATER_TOP : tile.terrain === 'ocean' ? OCEAN_TOP : tile.terrain === 'mountain' ? MOUNTAIN_TOP : 0);
  if (tile.building) building(b, tile.building, wx, wz, tile, extra.ownerColor || color);
  if (tile.city != null && owner && owner.id === tile.city) city(b, wx, wz, owner, tribe.color, tribe.dark);
}

// ---------- Wolken über Unerforschtem ----------

export function cloudGeometry() {
  const b = new Builder();
  b.add(G.box, '#e9eef5', { p: [0, 0.12, 0], s: [1.02, 0.34, 1.02] });
  b.add(G.ico, COLORS.cloud, { p: [-0.2, 0.36, -0.12], s: [0.32, 0.22, 0.32] });
  b.add(G.ico, COLORS.cloud, { p: [0.18, 0.4, 0.1], s: [0.36, 0.26, 0.36] });
  b.add(G.ico, '#f3f6fa', { p: [0.02, 0.32, -0.28], s: [0.26, 0.18, 0.26] });
  return b.build();
}

// ---------- Einheiten ----------
// Kantige Klötzchen-Figuren: kurze Beine, Körper in Stammesfarbe, großer Würfelkopf mit eigener
// Kopfbedeckung je Stamm (daran erkennt man den Stamm), große gut lesbare Waffen, keine Bodenplatte.
// Blickrichtung +x, rechte Hand bei +z. Alles eigene Entwürfe.

const unitCache = new Map();
const bowArc = new THREE.TorusGeometry(1, 0.12, 4, 10, Math.PI);

// Haut, Hose und Kopfbedeckung je Stamm (y = Kopfmitte, Kopf ist 0,15 groß)
const LOOKS = {
  // Fellmütze mit Bommel, blonder Bart
  nord: {
    skin: '#f3d6bd',
    pants: '#34495e',
    hat(b, x, y, s, t) {
      b.add(G.box, '#f1f3f5', { p: [x, y + 0.072 * s, 0], s: [0.166 * s, 0.046 * s, 0.166 * s] });
      b.add(G.box, t.color, { p: [x, y + 0.112 * s, 0], s: [0.136 * s, 0.05 * s, 0.136 * s] });
      b.add(G.box, '#f8f9fa', { p: [x, y + 0.152 * s, 0], s: [0.042 * s, 0.038 * s, 0.042 * s] });
      b.add(G.box, '#e3b65c', { p: [x + 0.072 * s, y - 0.052 * s, 0], s: [0.02 * s, 0.05 * s, 0.12 * s] });
    },
  },
  // spitzer Steinhelm mit rotem Band, Kriegsbemalung
  stein: {
    skin: '#d9a066',
    pants: '#5c4433',
    hat(b, x, y, s, t) {
      b.add(G.box, '#8e959e', { p: [x, y + 0.07 * s, 0], s: [0.166 * s, 0.05 * s, 0.166 * s] });
      b.add(G.box, t.color, { p: [x, y + 0.087 * s, 0], s: [0.17 * s, 0.016 * s, 0.17 * s] });
      b.add(G.cone4, '#adb5bd', { p: [x, y + 0.15 * s, 0], r: [0, Math.PI / 4, 0], s: [0.122 * s, 0.11 * s, 0.122 * s] });
      b.add(G.box, t.color, { p: [x + 0.0765 * s, y - 0.035 * s, 0], s: [0.004 * s, 0.012 * s, 0.11 * s] });
    },
  },
  // Strohhut mit breiter Krempe und Hutband in Stammesfarbe
  eben: {
    skin: '#e8b98a',
    pants: '#7a5839',
    hat(b, x, y, s, t) {
      b.add(G.cyl8, '#f2cf6b', { p: [x, y + 0.08 * s, 0], s: [0.15 * s, 0.014 * s, 0.15 * s] });
      b.add(G.cyl8, '#f2cf6b', { p: [x, y + 0.112 * s, 0], s: [0.084 * s, 0.056 * s, 0.084 * s] });
      b.add(G.cyl8, t.color, { p: [x, y + 0.096 * s, 0], s: [0.087 * s, 0.016 * s, 0.087 * s] });
    },
  },
  // Kopftuch mit Knoten, Schleier vor dem Mund, Tuchende im Nacken
  sand: {
    skin: '#a8754f',
    pants: '#4a2f5c',
    hat(b, x, y, s, t) {
      b.add(G.box, '#f5ecdc', { p: [x, y + 0.08 * s, 0], s: [0.17 * s, 0.07 * s, 0.17 * s] });
      b.add(G.box, '#efe2cc', { p: [x, y + 0.13 * s, 0], s: [0.11 * s, 0.04 * s, 0.11 * s] });
      b.add(G.box, t.color, { p: [x + 0.0765 * s, y - 0.045 * s, 0], s: [0.006 * s, 0.05 * s, 0.13 * s] });
      b.add(G.box, '#f5ecdc', { p: [x - 0.09 * s, y + 0.01 * s, 0], s: [0.03 * s, 0.11 * s, 0.07 * s] });
    },
  },
};

// Eine Figur; gibt die Höhe der Hände zurück. robe = langes Gewand statt Beine (Gedankenformer)
function figure(b, t, { x = 0, y = 0, s = 1, robe = false } = {}) {
  const look = LOOKS[t.id] || LOOKS.eben;
  if (robe) b.add(G.box, t.color, { p: [x, y + 0.1 * s, 0], s: [0.12 * s, 0.2 * s, 0.16 * s] });
  else {
    for (const z of [-0.033, 0.033]) b.add(G.box, look.pants, { p: [x, y + 0.04 * s, z * s], s: [0.056 * s, 0.08 * s, 0.05 * s] });
    b.add(G.box, t.color, { p: [x, y + 0.14 * s, 0], s: [0.1 * s, 0.12 * s, 0.14 * s] });
    b.add(G.box, t.dark, { p: [x, y + 0.088 * s, 0], s: [0.104 * s, 0.018 * s, 0.144 * s] });
  }
  for (const z of [-0.09, 0.09]) {
    b.add(G.box, t.color, { p: [x, y + 0.15 * s, z * s], s: [0.046 * s, 0.09 * s, 0.04 * s] });
    b.add(G.box, look.skin, { p: [x + 0.005 * s, y + 0.093 * s, z * s], s: [0.042 * s, 0.034 * s, 0.042 * s] });
  }
  const hy = y + 0.275 * s; // Kopfmitte
  b.add(G.box, look.skin, { p: [x, hy, 0], s: [0.15 * s, 0.15 * s, 0.15 * s] });
  for (const z of [-0.034, 0.034]) b.add(G.box, '#212529', { p: [x + 0.076 * s, hy + 0.012 * s, z * s], s: [0.004 * s, 0.03 * s, 0.022 * s] });
  look.hat(b, x, hy, s, t);
  return y + 0.093 * s;
}

function horse(b, coat, cloth, { armor = null } = {}) {
  const dark = shade(coat, -0.12);
  for (const [dx, dz] of [[-0.1, -0.045], [-0.1, 0.045], [0.1, -0.045], [0.1, 0.045]]) b.add(G.box, dark, { p: [dx, 0.055, dz], s: [0.04, 0.11, 0.04] });
  b.add(G.box, coat, { p: [0, 0.17, 0], s: [0.3, 0.13, 0.13] });
  b.add(G.box, coat, { p: [0.16, 0.26, 0], r: [0, 0, -0.5], s: [0.08, 0.14, 0.075] });
  b.add(G.box, coat, { p: [0.23, 0.32, 0], s: [0.12, 0.07, 0.07] });
  for (const z of [-0.036, 0.036]) b.add(G.box, '#212529', { p: [0.27, 0.335, z], s: [0.02, 0.018, 0.004] });
  b.add(G.box, '#3b2a1e', { p: [0.13, 0.31, 0], r: [0, 0, -0.5], s: [0.03, 0.14, 0.03] });
  b.add(G.box, '#3b2a1e', { p: [-0.17, 0.16, 0], r: [0, 0, 0.5], s: [0.035, 0.14, 0.035] });
  if (armor) b.add(G.box, armor, { p: [0, 0.165, 0], s: [0.31, 0.09, 0.14] });
  b.add(G.box, cloth, { p: [-0.01, 0.24, 0], s: [0.14, 0.02, 0.15] });
}

// Bootsrumpf: unten schmaler, vorne spitz (Blickrichtung +x), sitzt etwas im Wasser
function hull(b, len, h, w, wood, dark) {
  b.add(G.box, wood, { p: [-0.04, h / 2 - 0.03, 0], s: [len * 0.8, h, w] });
  b.add(G.box, dark, { p: [-0.04, h - 0.025, 0], s: [len * 0.82, 0.03, w * 1.06] });
  b.add(G.cone4, wood, { p: [len * 0.4, h / 2 - 0.03, 0], r: [0, 0, -Math.PI / 2], s: [w * 0.72, len * 0.28, h * 0.72] });
}

export const NAVAL_KINDS = new Set(['boat', 'ship', 'battleship']);
// Blickrichtung: Figuren schräg von vorn (man sieht Front und rechte Seite – Waffenhand), Schiffe von der Seite
export const faceAngle = (kind) => (NAVAL_KINDS.has(kind) ? Math.PI / 4 : 0);

// Modell einer Einheit (Blickrichtung +x), zentriert auf dem Boden; kind = Einheitentyp oder Bootsart
export function unitGeometry(type, tribeId) {
  const key = `${type}|${tribeId}`;
  if (unitCache.has(key)) return unitCache.get(key);
  const t = tribeById(tribeId);
  const b = new Builder();
  switch (type) {
    case 'warrior': {
      const hand = figure(b, t);
      b.add(G.box, COLORS.wood, { p: [0.05, hand + 0.07, 0.11], r: [0, 0, -0.35], s: [0.026, 0.18, 0.026] });
      b.add(G.box, COLORS.woodDark, { p: [0.09, hand + 0.15, 0.11], r: [0, 0, -0.35], s: [0.055, 0.075, 0.055] });
      break;
    }
    case 'archer': {
      const hand = figure(b, t);
      // Bogen in der rechten Hand, Wölbung nach außen (gut sichtbar)
      b.add(bowArc, COLORS.wood, { p: [0.03, hand + 0.06, 0.125], r: [0, Math.PI / 2, Math.PI / 2], s: [0.14, 0.14, 0.14] });
      b.add(G.box, '#f1f3f5', { p: [0.03, hand + 0.06, 0.125], s: [0.006, 0.28, 0.006] });
      b.add(G.box, COLORS.woodDark, { p: [-0.075, 0.2, 0.03], r: [0.35, 0, 0], s: [0.045, 0.13, 0.055] });
      b.add(G.box, t.color, { p: [-0.075, 0.28, 0.06], r: [0.35, 0, 0], s: [0.03, 0.03, 0.03] });
      break;
    }
    case 'defender': {
      const hand = figure(b, t);
      b.add(G.box, COLORS.wood, { p: [0.04, hand + 0.12, 0.115], s: [0.018, 0.42, 0.018] });
      b.add(G.cone4, COLORS.metal, { p: [0.04, hand + 0.36, 0.115], s: [0.025, 0.06, 0.025] });
      // großer Schild vor dem Körper
      b.add(G.box, COLORS.metal, { p: [0.075, 0.16, -0.035], s: [0.03, 0.21, 0.18] });
      b.add(G.box, t.color, { p: [0.091, 0.16, -0.035], s: [0.006, 0.18, 0.15] });
      b.add(G.box, '#ffd43b', { p: [0.096, 0.16, -0.035], s: [0.006, 0.05, 0.05] });
      break;
    }
    case 'swordsman': {
      const hand = figure(b, t);
      b.add(G.box, COLORS.metal, { p: [0.075, hand + 0.19, 0.12], r: [0, 0, -0.25], s: [0.05, 0.32, 0.014] });
      b.add(G.box, '#ffd43b', { p: [0.036, hand + 0.035, 0.12], r: [0, 0, -0.25], s: [0.026, 0.024, 0.1] });
      b.add(G.box, COLORS.woodDark, { p: [0.027, hand + 0.005, 0.12], r: [0, 0, -0.25], s: [0.022, 0.055, 0.022] });
      for (const z of [-0.09, 0.09]) b.add(G.box, COLORS.metal, { p: [0, 0.205, z], s: [0.058, 0.03, 0.05] });
      break;
    }
    case 'rider': {
      horse(b, COLORS.horse, t.color);
      const hand = figure(b, t, { y: 0.17, s: 0.85 });
      b.add(G.box, COLORS.wood, { p: [0.12, hand + 0.1, 0.1], r: [0, 0, -1.05], s: [0.018, 0.34, 0.018] });
      b.add(G.cone4, COLORS.metal, { p: [0.27, hand + 0.19, 0.1], r: [0, 0, -1.05], s: [0.022, 0.05, 0.022] });
      break;
    }
    case 'knight': {
      horse(b, '#e9ecef', t.color, { armor: t.color });
      const hand = figure(b, t, { y: 0.17, s: 0.85 });
      for (const z of [-0.077, 0.077]) b.add(G.box, COLORS.metal, { p: [0, 0.346, z], s: [0.05, 0.026, 0.045] });
      b.add(G.cyl6, COLORS.wood, { p: [0.17, hand + 0.13, 0.1], r: [0, 0, -1.2], s: [0.016, 0.55, 0.016] });
      b.add(G.box, t.color, { p: [0.33, hand + 0.24, 0.1], r: [0, 0, -1.2], s: [0.004, 0.07, 0.06] });
      break;
    }
    case 'mindbender': {
      const hand = figure(b, t, { robe: true });
      b.add(G.box, COLORS.wood, { p: [0.045, hand + 0.1, 0.115], s: [0.02, 0.36, 0.02] });
      b.add(G.ico, '#da77f2', { p: [0.045, hand + 0.3, 0.115], s: [0.05, 0.05, 0.05] });
      b.add(G.ico, '#f3d9fa', { p: [0.045, hand + 0.3, 0.115], s: [0.028, 0.028, 0.028] });
      break;
    }
    case 'catapult':
      b.add(G.box, COLORS.wood, { p: [0, 0.075, 0], s: [0.36, 0.06, 0.22] });
      for (const [dx, dz] of [[-0.12, -0.125], [0.12, -0.125], [-0.12, 0.125], [0.12, 0.125]]) b.add(G.cyl8, COLORS.woodDark, { p: [dx, 0.065, dz], r: [Math.PI / 2, 0, 0], s: [0.065, 0.035, 0.065] });
      for (const dz of [-0.08, 0.08]) b.add(G.box, COLORS.woodDark, { p: [-0.02, 0.19, dz], s: [0.045, 0.2, 0.035] });
      b.add(G.box, COLORS.woodDark, { p: [-0.02, 0.28, 0], s: [0.05, 0.035, 0.2] });
      b.add(G.box, COLORS.wood, { p: [0.04, 0.26, 0], r: [0, 0, -0.95], s: [0.035, 0.38, 0.035] });
      b.add(G.box, COLORS.woodDark, { p: [0.19, 0.37, 0], s: [0.08, 0.035, 0.08] });
      b.add(G.ico, '#868e96', { p: [0.19, 0.42, 0], s: [0.055, 0.055, 0.055] });
      b.add(G.box, t.color, { p: [-0.13, 0.15, 0], s: [0.07, 0.09, 0.23] });
      break;
    case 'giant': {
      const hand = figure(b, t, { s: 1.9 });
      b.add(G.box, COLORS.woodDark, { p: [0.1, hand + 0.16, 0.2], r: [0, 0, -0.4], s: [0.06, 0.34, 0.06] });
      b.add(G.box, '#5c3d24', { p: [0.17, hand + 0.32, 0.2], r: [0, 0, -0.4], s: [0.11, 0.13, 0.11] });
      break;
    }
    case 'boat':
      hull(b, 0.44, 0.1, 0.2, COLORS.wood, COLORS.woodDark);
      b.add(G.cyl5, COLORS.woodDark, { p: [0.04, 0.25, 0], s: [0.012, 0.34, 0.012] });
      b.add(G.box, t.color, { p: [0.08, 0.28, 0], r: [0, 0, -0.08], s: [0.12, 0.2, 0.012] });
      b.add(G.box, '#f8f9fa', { p: [0.08, 0.28, 0], r: [0, 0, -0.08], s: [0.124, 0.05, 0.014] });
      figure(b, t, { x: -0.12, y: 0, s: 0.62 });
      break;
    case 'ship':
      hull(b, 0.58, 0.13, 0.24, '#7a4a24', '#5a3518');
      for (const [dx, h] of [[-0.06, 0.36], [0.14, 0.42]]) {
        b.add(G.cyl5, COLORS.woodDark, { p: [dx, 0.08 + h / 2, 0], s: [0.014, h, 0.014] });
        b.add(G.box, dx < 0 ? '#f8f9fa' : t.color, { p: [dx + 0.04, 0.1 + h * 0.55, 0], s: [0.14, h * 0.6, 0.012] });
      }
      b.add(G.box, t.color, { p: [0.19, 0.52, 0], s: [0.08, 0.04, 0.01] });
      figure(b, t, { x: -0.21, y: 0.02, s: 0.62 });
      break;
    case 'battleship':
      hull(b, 0.64, 0.15, 0.26, '#495057', '#343a40');
      b.add(G.box, '#adb5bd', { p: [-0.02, 0.2, 0], s: [0.2, 0.1, 0.16] });
      b.add(G.box, t.color, { p: [-0.02, 0.26, 0], s: [0.14, 0.04, 0.12] });
      b.add(G.cyl8, '#212529', { p: [0.18, 0.19, 0], r: [0, 0, Math.PI / 2], s: [0.03, 0.24, 0.03] });
      b.add(G.cyl6, '#868e96', { p: [-0.08, 0.34, 0], s: [0.03, 0.16, 0.03] });
      b.add(G.box, t.color, { p: [-0.03, 0.42, 0], s: [0.08, 0.05, 0.01] });
      figure(b, t, { x: -0.22, y: 0.04, s: 0.6 });
      break;
    default:
      figure(b, t);
  }
  const geo = b.build();
  unitCache.set(key, geo);
  return geo;
}

// Figuren größer als maßstabsgetreu – wie bei Polytopia gut erkennbar
export const UNIT_SCALE = { default: 1.45, giant: 1.3, catapult: 1.35, rider: 1.4, knight: 1.4 };

// Material mit Eckfarben, flach schattiert
export function vertexMaterial(extra = {}) {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...extra });
}

export { G as PRIMITIVES };
