// Erzeugt die App-Icons (SVG + PNG) für Home-Bildschirm, Browser-Tab und Manifest – ohne Abhängigkeiten.
// Aufruf: npm run icons  →  public/icons/…
// Motiv (eigene Grafik in den Farben des Spiels): eine kleine Insel mit Turm, Fahne und Tannen im Meer.
// Die Formen liegen in einem 100×100-Raster; daraus entstehen das SVG und – per Mini-Rasterizer
// mit Kantenglättung und PNG-Encoder (node:zlib) – die PNG-Dateien.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url));

const C = {
  bg: '#0e1a2b',
  glow: '#152c48',
  sea: '#2f8fc6',
  seaLeft: '#23709d',
  seaRight: '#1b5a80',
  shallow: '#5cc3dd',
  wave: '#a5e0f2',
  grass: '#8cc657',
  earthLeft: '#7a5839',
  earthRight: '#5f4430',
  pineLight: '#58a64b',
  pineDark: '#3c8c3c',
  wallLight: '#f1f3f5',
  wallDark: '#c5ccd6',
  window: '#3d4a5c',
  door: '#6b4a2b',
  roofLight: '#f59f00',
  roofDark: '#c77700',
  pole: '#2b3445',
  flag: '#f03e3e',
};

// ---------- Motiv ----------

const diamond = (cx, cy, w, h) => [[cx - w, cy], [cx, cy - h], [cx + w, cy], [cx, cy + h]];
const down = ([x, y], d) => [x, y + d];

// Kachel mit sichtbaren Seiten (isometrisch)
function slab(cx, cy, w, h, depth, top, left, right) {
  const L = [cx - w, cy];
  const F = [cx, cy + h];
  const R = [cx + w, cy];
  return [
    { pts: [L, F, down(F, depth), down(L, depth)], fill: left },
    { pts: [F, R, down(R, depth), down(F, depth)], fill: right },
    { pts: diamond(cx, cy, w, h), fill: top },
  ];
}

// Punkt auf einer senkrechten Wand von A nach B (u entlang, v nach oben)
const onWall = (A, B, hgt) => (u, v) => [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u - hgt * v];
const quad = (wall, u0, u1, v0, v1) => [wall(u0, v0), wall(u1, v0), wall(u1, v1), wall(u0, v1)];

function tower(cx, cy, w, hgt, roofH) {
  const L = [cx - w, cy];
  const F = [cx, cy + w / 2];
  const R = [cx + w, cy];
  const left = onWall(L, F, hgt);
  const right = onWall(F, R, hgt);
  const top = cy - hgt;
  const o = w * 1.3; // Dach steht etwas über
  const rL = [cx - o, top];
  const rF = [cx, top + o / 2];
  const rR = [cx + o, top];
  const apex = [cx, top - roofH];
  return [
    { pts: [L, F, down(F, -hgt), down(L, -hgt)], fill: C.wallLight },
    { pts: [F, R, down(R, -hgt), down(F, -hgt)], fill: C.wallDark },
    { pts: quad(left, 0.34, 0.66, 0.42, 0.7), fill: C.window },
    { pts: quad(right, 0.3, 0.62, 0, 0.36), fill: C.door },
    { pts: [rL, rF, apex], fill: C.roofLight },
    { pts: [rF, rR, apex], fill: C.roofDark },
    { pts: [[apex[0] - 0.55, apex[1] + 1], [apex[0] + 0.55, apex[1] + 1], [apex[0] + 0.55, apex[1] - 10], [apex[0] - 0.55, apex[1] - 10]], fill: C.pole },
    { pts: [[apex[0] + 0.55, apex[1] - 10], [apex[0] + 9.5, apex[1] - 7.6], [apex[0] + 0.55, apex[1] - 5.2]], fill: C.flag },
  ];
}

// Tanne aus zwei Kegeln (hell links, dunkel rechts)
function pine(cx, cy, w, hgt) {
  const cone = (by, cw, top) => {
    const L = [cx - cw, by];
    const F = [cx, by + cw * 0.45];
    const R = [cx + cw, by];
    const apex = [cx, top];
    return [
      { pts: [L, F, apex], fill: C.pineLight },
      { pts: [F, R, apex], fill: C.pineDark },
    ];
  };
  return [...cone(cy, w, cy - hgt * 0.68), ...cone(cy - hgt * 0.38, w * 0.74, cy - hgt)];
}

const wave = (cx, cy, s) => ({
  pts: [[cx - s, cy], [cx, cy - s / 2], [cx + s, cy], [cx + s, cy + 0.9], [cx, cy - s / 2 + 0.9], [cx - s, cy + 0.9]],
  fill: C.wave,
});

const MOTIF = [
  ...slab(50, 60, 42, 21, 5, C.sea, C.seaLeft, C.seaRight),
  wave(14.5, 60.5, 3),
  wave(85.5, 60.5, 3),
  wave(32.5, 70.2, 2.2),
  wave(67.5, 70.2, 2.2),
  { pts: diamond(50, 62, 31, 15.5), fill: C.shallow },
  ...slab(50, 55, 26, 13, 7, C.grass, C.earthLeft, C.earthRight),
  ...tower(55, 53, 7.5, 19, 13),
  ...pine(36, 55.5, 6, 17),
  ...pine(67, 57.5, 4.5, 12),
  ...pine(43, 61, 5, 13),
];

// Varianten: abgerundet mit Rand (Browser, Android „any“) oder randlos (iOS, Android „maskable“)
function iconShapes({ rounded, scale }) {
  const shift = 2; // Motiv optisch mittig
  const t = ([x, y]) => [50 + (x - 50) * scale, 50 + (y + shift - 50) * scale];
  return [
    rounded ? { rect: 22, fill: C.bg } : { rect: 0, fill: C.bg },
    { circle: [50, 56, 40], fill: C.glow },
    ...MOTIF.map((s) => ({ pts: s.pts.map(t), fill: s.fill })),
  ];
}

export const ICONS = [
  { file: 'icon-32.png', size: 32, rounded: true, scale: 1 },
  { file: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, scale: 0.8 }, // Inhalt im sicheren Kreis (80 %)
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.9 }, // iOS rundet selbst ab
];

// ---------- Formen → Polygone ----------

function toPolygon(shape) {
  if (shape.pts) return shape.pts;
  if (shape.circle) {
    const [cx, cy, r] = shape.circle;
    return Array.from({ length: 128 }, (_, i) => [cx + r * Math.cos((i / 128) * Math.PI * 2), cy + r * Math.sin((i / 128) * Math.PI * 2)]);
  }
  const r = shape.rect;
  if (!r) return [[0, 0], [100, 0], [100, 100], [0, 100]];
  const pts = [];
  const corners = [[100 - r, r, -90], [100 - r, 100 - r, 0], [r, 100 - r, 90], [r, r, 180]];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= 24; i++) {
      const a = ((start + (i / 24) * 90) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

// ---------- SVG ----------

function toSvg(shapes) {
  const f = (n) => String(Math.round(n * 100) / 100);
  const body = shapes
    .map((s) => {
      if (s.rect != null) return `<rect width="100" height="100"${s.rect ? ` rx="${s.rect}"` : ''} fill="${s.fill}"/>`;
      if (s.circle) return `<circle cx="${f(s.circle[0])}" cy="${f(s.circle[1])}" r="${f(s.circle[2])}" fill="${s.fill}"/>`;
      return `<path d="M${s.pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z" fill="${s.fill}"/>`;
    })
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n  ${body}\n</svg>\n`;
}

// ---------- Rasterizer ----------

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Zeichnet in ss-facher Auflösung (Pixelmitte innen = gefüllt) und rechnet dann herunter
export function rasterize(shapes, size) {
  const ss = size <= 64 ? 8 : 4;
  const W = size * ss;
  const k = W / 100;
  const px = new Uint8ClampedArray(W * W * 4);
  const xs = [];
  for (const shape of shapes) {
    const [r, g, b] = rgb(shape.fill);
    const P = toPolygon(shape).map(([x, y]) => [x * k, y * k]);
    const ys = P.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(W - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i];
        const [xj, yj] = P[j];
        if (yi > sy !== yj > sy) xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, c) => a - c);
      for (let n = 0; n + 1 < xs.length; n += 2) {
        const xa = Math.max(0, Math.ceil(xs[n] - 0.5));
        const xb = Math.min(W - 1, Math.floor(xs[n + 1] - 0.5));
        for (let x = xa; x <= xb; x++) {
          const o = (y * W + x) * 4;
          px[o] = r;
          px[o + 1] = g;
          px[o + 2] = b;
          px[o + 3] = 255;
        }
      }
    }
  }
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const o = ((y * ss + dy) * W + x * ss + dx) * 4;
          const al = px[o + 3];
          r += px[o] * al;
          g += px[o + 1] * al;
          b += px[o + 2] * al;
          a += al;
        }
      }
      const o = (y * size + x) * 4;
      if (a) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round(a / (ss * ss));
    }
  }
  return out;
}

// ---------- PNG ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

export function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); // Filter 0 je Zeile
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bit pro Kanal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Ausgabe ----------

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}icon.svg`, toSvg(iconShapes({ rounded: true, scale: 1 })));
  console.log('icon.svg');
  for (const icon of ICONS) {
    const png = encodePng(icon.size, rasterize(iconShapes(icon), icon.size));
    writeFileSync(OUT + icon.file, png);
    console.log(`${icon.file} (${icon.size}×${icon.size}, ${(png.length / 1024).toFixed(1)} KB)`);
  }
}
