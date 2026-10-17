// Forschungsbaum: Anordnung (genug Abstand, nichts fehlt), Bilder je Technik und die Zoom-Rechnung.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TECHS, UNITS, NAVAL, ACTIONS } from '../public/js/game/rules.js';
import { techDetails } from '../public/js/ui/techinfo.js';
import { techLayout, labelLines, CENTER_RADIUS } from '../public/js/ui/techlayout.js';
import { TECH_ICON_SVG } from '../public/js/ui/techicons.js';
import { zoomAround, fitView, clampView } from '../public/js/ui/panzoom.js';

const D = 100;
const L = techLayout(D);
const ids = Object.keys(TECHS);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('Anordnung', () => {
  test('jede Technik hat genau einen Platz', () => {
    assert.deepEqual(Object.keys(L.pos).sort(), [...ids].sort());
  });

  test('genug Abstand: zwischen zwei Knöpfen mindestens 0,6 Knopfbreiten Luft', () => {
    let closest = Infinity;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) closest = Math.min(closest, dist(L.pos[ids[i]], L.pos[ids[j]]));
    }
    assert.ok(closest - D >= 0.6 * D, `engster Abstand ${((closest - D) / D).toFixed(2)} Knopfbreiten`);
  });

  test('genug Abstand zum Stamm in der Mitte', () => {
    for (const id of ids) {
      const gap = dist(L.pos[id], L.center) - CENTER_RADIUS * D - D / 2;
      assert.ok(gap >= 0.6 * D, `${id}: ${(gap / D).toFixed(2)}`);
    }
  });

  test('alles liegt mit Rand für das Preisschild auf der Fläche', () => {
    for (const id of ids) {
      const { x, y } = L.pos[id];
      for (const v of [x, y]) assert.ok(v >= 0.65 * D && v <= L.size - 0.65 * D, `${id} zu nah am Rand`);
    }
  });

  test('Linien führen von der Vorstufe zur Technik (Stufe 1 aus der Mitte)', () => {
    const into = new Map(L.edges.map(([from, to]) => [to, from]));
    assert.equal(L.edges.length, ids.length);
    for (const id of ids) assert.equal(into.get(id), TECHS[id].parent, id);
  });

  test('lange Namen werden sinnvoll getrennt (zwei kurze Zeilen statt einer langen)', () => {
    for (const id of ids) {
      const name = TECHS[id].name;
      const lines = labelLines(id, name);
      if (lines.length > 1) assert.equal(lines.join('').replace('-', ''), name, `${id}: Trennung ergibt nicht den Namen`);
      for (const line of lines) assert.ok(line.length <= 10, `${id}: Zeile „${line}“ zu lang – in LABEL_BREAKS trennen`);
    }
  });

  test('höhere Stufen liegen weiter außen', () => {
    for (const id of ids) {
      const parent = TECHS[id].parent;
      if (parent) assert.ok(dist(L.pos[id], L.center) > dist(L.pos[parent], L.center), id);
    }
  });
});

describe('Icons je Technik', () => {
  test('jede Technik hat ein eigenes 2D-Icon', () => {
    assert.deepEqual(Object.keys(TECH_ICON_SVG).sort(), [...ids].sort());
    const seen = new Set();
    for (const [id, svg] of Object.entries(TECH_ICON_SVG)) {
      assert.ok(svg.length > 100, `${id}: zu wenig Inhalt`);
      assert.ok(!seen.has(svg), `${id}: gleiches Icon wie eine andere Technik`);
      seen.add(svg);
    }
  });

  test('Icons sind sauberes SVG: nur einfache Formen, keine Fehlwerte, Gruppen geschlossen', () => {
    for (const [id, svg] of Object.entries(TECH_ICON_SVG)) {
      assert.ok(!/undefined|NaN|null/.test(svg), `${id}: Fehlwert im SVG`);
      const tags = [...svg.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]);
      for (const tag of tags) assert.ok(['path', 'circle', 'ellipse', 'g'].includes(tag), `${id}: <${tag}>`);
      assert.equal((svg.match(/<g /g) || []).length, (svg.match(/<\/g>/g) || []).length, `${id}: <g> nicht geschlossen`);
    }
  });
});

describe('Beschreibungen je Technik', () => {
  test('jede Technik erklärt in einem Satz, wozu sie gut ist, und listet, was sie freischaltet', () => {
    for (const id of ids) {
      const { about, items } = techDetails(id);
      assert.ok(about && about.length >= 30, `${id}: Erklärung fehlt oder zu kurz`);
      assert.ok(items.length >= 1, `${id}: nichts aufgelistet`);
      for (const i of items) {
        assert.ok(i.kind && i.name && i.text, `${id}: unvollständiger Eintrag`);
        assert.ok(!/undefined|NaN|null/.test(`${i.name} ${i.cost} ${i.text}`), `${id}: Fehlwert in „${i.name}“`);
      }
    }
  });

  test('jede Einheit, jedes Schiff, jeder Bau und jede Aktion steht bei ihrer Technik', () => {
    const listed = (tech, name) => techDetails(tech).items.some((i) => i.name === name);
    for (const u of Object.values(UNITS)) if (u.tech) assert.ok(listed(u.tech, u.name), `${u.name} fehlt bei ${u.tech}`);
    for (const n of Object.values(NAVAL)) assert.ok(listed(n.tech, n.name), `${n.name} fehlt bei ${n.tech}`);
    for (const a of Object.values(ACTIONS)) assert.ok(listed(a.tech, a.name), `${a.name} fehlt bei ${a.tech}`);
  });

  test('Klettern nennt Weitsicht und Bergschutz', () => {
    const names = techDetails('climbing').items.map((i) => i.name);
    assert.deepEqual(names, ['Weitsicht', 'Bergschutz']);
    assert.ok(techDetails('climbing').items[0].text.includes('2 Felder weit'));
  });

  test('Werte stimmen mit den Regeln überein (Beispiel Schwertkämpfer, Hafen)', () => {
    const sword = techDetails('smithery').items.find((i) => i.name === 'Schwertkämpfer');
    assert.equal(sword.cost, `${UNITS.swordsman.cost} ★`);
    assert.match(sword.text, new RegExp(`Angriff ${UNITS.swordsman.atk} · Abwehr ${UNITS.swordsman.def} · Leben ${UNITS.swordsman.hp}`));
    const port = techDetails('fishing').items.find((i) => i.name === 'Hafen');
    assert.equal(port.cost, `${ACTIONS.port.cost} ★`);
    assert.ok(port.text.includes('+1 Einwohner'), port.text);
  });
});

describe('Verschieben und Zoomen', () => {
  test('Zoomen um einen Punkt lässt den Punkt darunter stehen', () => {
    const v = { x: 40, y: -20, s: 0.8 };
    const z = zoomAround(v, 1.5, 300, 200, 0.2, 3);
    const before = { x: (300 - v.x) / v.s, y: (200 - v.y) / v.s };
    const after = { x: (300 - z.x) / z.s, y: (200 - z.y) / z.s };
    assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
    assert.ok(Math.abs(z.s - 1.2) < 1e-9);
  });

  test('Zoom bleibt in seinen Grenzen', () => {
    assert.equal(zoomAround({ x: 0, y: 0, s: 2 }, 10, 0, 0, 0.5, 2.4).s, 2.4);
    assert.equal(zoomAround({ x: 0, y: 0, s: 0.6 }, 0.1, 0, 0, 0.5, 2.4).s, 0.5);
  });

  test('Einpassen zeigt alles, mittig', () => {
    const f = fitView({ w: 1000, h: 1000 }, { w: 400, h: 800 }, 20);
    assert.equal(f.s, 0.36);
    assert.equal(f.x, 20);
    assert.equal(f.y, 220);
  });

  test('Verschieben bis ins Leere geht nicht – ein Teil bleibt sichtbar', () => {
    const content = { w: 1000, h: 1000 };
    const viewport = { w: 400, h: 700 };
    const far = clampView({ x: -5000, y: 5000, s: 1 }, content, viewport);
    assert.ok(far.x + content.w >= 400 * 0.35, 'rechts bleibt etwas im Bild');
    assert.ok(far.y <= 700 - 700 * 0.35, 'oben bleibt etwas im Bild');
    const ok = clampView({ x: -300, y: -200, s: 1 }, content, viewport);
    assert.deepEqual(ok, { x: -300, y: -200, s: 1 }, 'normale Lage bleibt unverändert');
  });
});
