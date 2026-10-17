// Forschungsbaum: ein Stern um den eigenen Stamm, jede Technik ein runder Knopf mit einem 2D-Icon
// im Stil der Website (techicons.js). Verschieben und Zoomen mit Maus und Fingern;
// Antippen zeigt unten, was die Technik bringt – mit dem Knopf zum Erforschen.
// Farben kommen aus dem CSS (Klassen is-done / is-available / is-expensive / is-locked).

import { TECHS, tribeById } from '../game/rules.js';
import { techLayout, labelLines, RINGS, CENTER_RADIUS } from './techlayout.js';
import { TECH_ICON_SVG } from './techicons.js';
import { techDetails } from './techinfo.js';
import { PanZoom, fitView } from './panzoom.js';
import { tribeThumb } from '../view/thumbs.js';
import { esc, ICONS, starAmount, openLayer } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const D = 100; // Knotendurchmesser in SVG-Einheiten
const READABLE = 0.78; // kleinste Start-Vergrößerung, bei der alle Namen gut lesbar sind
const LABEL_PAD = 8; // Mindestabstand der Schrift zum Kreisrand
const STATE_TEXT = { done: 'erforscht', available: 'erforschbar', expensive: 'zu teuer', locked: 'gesperrt' };

function svgEl(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

// Ein Knopf: flache Fläche, Icon, Name, Haken/Schloss, Preisschild (Sichtbarkeit per CSS)
function buildNode(parent, id, p) {
  const r = D / 2;
  const g = svgEl('g', { class: 'tt-node', 'data-id': id, transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`, tabindex: 0, role: 'button' }, parent);
  svgEl('circle', { class: 'tt-ring', r: r + 8 }, g);
  svgEl('circle', { class: 'tt-face', r }, g);
  // Icon oben, Name darunter – lange Namen zweizeilig, dann ist das Icon etwas kleiner
  const words = labelLines(id, TECHS[id].name);
  const two = words.length > 1;
  const size = two ? 38 : 46;
  const iconY = two ? -20 : -15;
  svgEl('g', { class: 'tt-icon', transform: `translate(${-size / 2} ${iconY - size / 2}) scale(${size / 48})` }, g).innerHTML = TECH_ICON_SVG[id];
  const fs = two ? 12.5 : 14;
  const lines = words.map((word, i) => {
    const y = two ? 9 + i * 13 : 19;
    const el = svgEl('text', { class: 'tt-name', y, 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
    el.textContent = word;
    // Platz im Kreis auf Höhe der Zeile (weiter unten wird der Kreis schmaler), mit Rand
    const edge = Math.max(Math.abs(y - 0.6 * fs), Math.abs(y + 0.6 * fs));
    return { el, fs, max: 2 * Math.sqrt(r * r - edge * edge) - LABEL_PAD * 2 };
  });
  const check = svgEl('g', { class: 'tt-check', transform: 'translate(36 -36)' }, g);
  svgEl('circle', { r: 13 }, check);
  svgEl('path', { d: 'M-6 0l4 4.5 8-9' }, check);
  const lock = svgEl('g', { class: 'tt-lock', transform: 'translate(36 -36)' }, g);
  svgEl('circle', { r: 13 }, lock);
  svgEl('rect', { x: -5.5, y: -1, width: 11, height: 8, rx: 1.5 }, lock);
  svgEl('path', { d: 'M-3.3 -1v-2.5a3.3 3.3 0 0 1 6.6 0v2.5' }, lock);
  const price = svgEl('g', { class: 'tt-price', transform: `translate(0 ${r})` }, g);
  svgEl('rect', { class: 'tt-price-face', x: -24, y: -10, width: 48, height: 20, rx: 10 }, price);
  const cost = svgEl('text', { class: 'tt-price-text', y: 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, price);
  return { g, cost, lines };
}

// Namen nachmessen und notfalls kleiner setzen, damit sie nicht an den Rand stoßen
// (erst möglich, wenn die Schrift geladen ist – deshalb auch nach document.fonts.ready)
function fitLabel(node) {
  let k = 1;
  for (const line of node.lines) {
    line.el.setAttribute('font-size', line.fs);
    const w = line.el.getComputedTextLength();
    if (w > line.max) k = Math.min(k, line.max / w);
  }
  if (k < 1) for (const line of node.lines) line.el.setAttribute('font-size', (line.fs * k).toFixed(2));
}

// Öffnet den Baum. Zustand und Aktionen kommen von außen:
// state(id) → 'done' | 'available' | 'expensive' | 'locked'; research(id) → true, wenn erforscht
export function openTechTree({ tribe, stars, state, cost, canResearch, research, onSound = null }) {
  const t = tribeById(tribe);
  const L = techLayout(D);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  let cleanup = () => {};
  const { el, close } = openLayer(
    `<header class="tt-head">
      <h2>Forschung</h2>
      <span class="hud-box" data-stars></span>
      <span class="tt-spacer"></span>
      <button type="button" class="icon-btn" data-close aria-label="Schließen">${ICONS.close}</button>
    </header>
    <div class="tt-view" data-view></div>
    <div class="tt-zoom">
      <button type="button" class="icon-btn" data-zoom="in" aria-label="Hineinzoomen">${ICONS.plus}</button>
      <button type="button" class="icon-btn" data-zoom="out" aria-label="Herauszoomen">${ICONS.minus}</button>
      <button type="button" class="icon-btn" data-zoom="fit" aria-label="Ganzen Baum zeigen">${ICONS.fit}</button>
    </div>
    <p class="tt-hint" data-hint>Tippe auf eine Technik · ${coarse ? 'mit dem Finger verschieben, mit zwei Fingern zoomen' : 'ziehen zum Verschieben, Mausrad zum Zoomen'}</p>
    <div class="tt-sheet" data-sheet hidden></div>`,
    { className: 'techtree', label: 'Forschung', onClose: () => cleanup() },
  );
  el.style.setProperty('--tribe', t.color);
  el.style.setProperty('--tribe-dark', t.dark);
  const view = el.querySelector('[data-view]');
  const sheet = el.querySelector('[data-sheet]');
  const hint = el.querySelector('[data-hint]');

  // ---------- Bild aufbauen ----------
  const { x: c } = L.center;
  const svg = svgEl('svg', { class: 'tt-svg' }, view);
  const defs = svgEl('defs', {}, svg);
  const glow = svgEl('radialGradient', { id: 'tt-glow' }, defs);
  svgEl('stop', { offset: '0%', class: 'tt-glow-in' }, glow);
  svgEl('stop', { offset: '100%', class: 'tt-glow-out' }, glow);
  svgEl('circle', { cx: c, cy: c, r: L.size / 2, fill: 'url(#tt-glow)' }, svg);
  for (const ring of RINGS) svgEl('circle', { class: 'tt-orbit', cx: c, cy: c, r: ring * D }, svg);
  const edges = L.edges.map(([from, to]) => {
    const a = from ? L.pos[from] : L.center;
    const b = L.pos[to];
    return { to, line: svgEl('line', { class: 'tt-edge', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, svg) };
  });
  const R = CENTER_RADIUS * D;
  const center = svgEl('g', { class: 'tt-center', transform: `translate(${c} ${c})` }, svg);
  svgEl('circle', { class: 'tt-center-face', r: R }, center);
  const clip = svgEl('clipPath', { id: 'tt-clip' }, defs);
  svgEl('circle', { r: R - 4 }, clip);
  svgEl('image', { href: tribeThumb(tribe), x: -R * 1.2, y: -R * 0.95, width: R * 2.4, height: R * 1.8, 'clip-path': 'url(#tt-clip)' }, center);
  const nodes = {};
  for (const id of Object.keys(L.pos)) nodes[id] = buildNode(svg, id, L.pos[id]);
  const fitLabels = () => Object.values(nodes).forEach(fitLabel);
  fitLabels();
  document.fonts?.ready.then(() => el.isConnected && fitLabels());

  // ---------- Zustand anzeigen ----------
  let picked = null;

  const renderSheet = () => {
    sheet.hidden = !picked;
    hint.hidden = Boolean(picked);
    if (!picked) return;
    const tech = TECHS[picked];
    const st = state(picked);
    const price = cost(picked);
    let note = '';
    if (st === 'locked') note = `Zuerst ${TECHS[tech.parent].name} erforschen.`;
    else if (st === 'expensive') note = `Dir fehlen ${price - stars()} ★.`;
    else if (st === 'available' && !canResearch()) note = 'Gerade sind die anderen am Zug.';
    const { about, items } = techDetails(picked);
    sheet.innerHTML = `
      <svg class="tt-sheet-icon" viewBox="0 0 48 48" aria-hidden="true">${TECH_ICON_SVG[picked]}</svg>
      <div class="tt-sheet-text"><h3>${esc(tech.name)}</h3><p>${esc(about)}</p>${note ? `<p class="tt-note">${esc(note)}</p>` : ''}</div>
      <ul class="tt-unlocks">${items
        .map((i) => `<li><span class="tt-kind">${esc(i.kind)}</span><b>${esc(i.name)}</b>${i.cost ? `<span class="tt-cost">${esc(i.cost)}</span>` : ''}<small>${esc(i.text)}</small></li>`)
        .join('')}</ul>
      ${
        st === 'done'
          ? `<span class="pill">${ICONS.check} Erforscht</span>`
          : `<button type="button" class="btn btn--primary" data-research ${st === 'available' && canResearch() ? '' : 'disabled'}>Erforschen für ${price} ★</button>`
      }`;
    sheet.querySelector('[data-research]')?.addEventListener('click', () => {
      if (research(picked)) update();
    });
  };

  const update = () => {
    el.querySelector('[data-stars]').innerHTML = starAmount(stars());
    for (const [id, n] of Object.entries(nodes)) {
      const st = state(id);
      n.g.setAttribute('class', `tt-node is-${st}${picked === id ? ' is-picked' : ''}`);
      n.g.setAttribute('aria-label', `${TECHS[id].name}: ${STATE_TEXT[st]}${st === 'available' || st === 'expensive' ? `, ${cost(id)} Sterne` : ''}`);
      n.cost.textContent = `${cost(id)} ★`;
    }
    for (const e of edges) {
      const st = state(e.to);
      e.line.setAttribute('class', `tt-edge is-${st === 'done' ? 'done' : st === 'locked' ? 'locked' : 'open'}`);
    }
    renderSheet();
  };

  // ---------- Verschieben und Zoomen ----------
  const pz = new PanZoom(view, {
    content: { w: L.size, h: L.size },
    onChange: (v) => {
      const { w, h } = pz.size;
      svg.setAttribute('viewBox', `${(-v.x / v.s).toFixed(1)} ${(-v.y / v.s).toFixed(1)} ${(w / v.s).toFixed(1)} ${(h / v.s).toFixed(1)}`);
    },
    onTap: (target) => pick(target.closest?.('.tt-node')?.getAttribute('data-id') || null),
  });
  const fitAll = () => pz.set(fitView(pz.content, pz.size, 16));

  // Gewählte Technik nicht unter der Detailkarte verstecken
  const keepInView = (id) => {
    const p = L.pos[id];
    const { s, x, y } = pz.view;
    const { w, h } = pz.size;
    const bottom = h - (sheet.hidden ? 0 : sheet.offsetHeight + 16);
    const r = (D / 2) * s + 14;
    const sx = p.x * s + x;
    const sy = p.y * s + y;
    if (sx < r || sx > w - r || sy < r || sy > bottom - r) pz.bring(p.x, p.y, w / 2, Math.max(r, bottom / 2));
  };

  const pick = (id) => {
    if (id === picked) return;
    picked = id;
    onSound?.(id ? 'select' : 'deselect');
    update();
    if (id) keepInView(id);
  };

  el.querySelector('.tt-zoom').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (!b) return;
    if (b.dataset.zoom === 'in') pz.zoomBy(1.3);
    else if (b.dataset.zoom === 'out') pz.zoomBy(1 / 1.3);
    else fitAll();
  });

  const onKey = (e) => {
    const node = e.target.closest?.('.tt-node');
    if (node && (e.key === 'Enter' || e.key === ' ')) pick(node.getAttribute('data-id'));
    else if (e.key === '+' || e.key === '=') pz.zoomBy(1.25);
    else if (e.key === '-') pz.zoomBy(0.8);
    else if (e.key === '0') fitAll();
    else if (e.key.startsWith('Arrow')) {
      const step = 70;
      pz.pan({ ArrowLeft: step, ArrowRight: -step }[e.key] || 0, { ArrowUp: step, ArrowDown: -step }[e.key] || 0);
    } else return;
    e.preventDefault();
  };
  const onResize = () => pz.set(pz.view);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  cleanup = () => {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
  };

  // Start: ganzer Baum, wenn er lesbar hineinpasst – sonst lesbar groß um die Mitte
  const { w, h } = pz.size;
  const fit = fitView(pz.content, { w, h }, 16);
  const s = Math.max(fit.s, READABLE);
  pz.min = Math.min(fit.s, s) * 0.85;
  pz.max = 2.4;
  pz.set(fit.s >= READABLE ? fit : { s, x: w / 2 - c * s, y: h / 2 - c * s });
  update();
  return { close, refresh: update };
}
