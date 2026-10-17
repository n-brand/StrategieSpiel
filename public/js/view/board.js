// Spielfeld in 3D: baut Gelände, Dekoration, Grenzen und Wolken aus dem Spielzustand, zeigt Einheiten mit
// Lebenspunkten, Städte mit Namen und spielt die Ereignisse der Engine als Animationen ab.
// Sichtbar ist nur, was der Spieler (viewer) schon erkundet hat.

import * as THREE from 'three';
import * as E from '../game/engine.js';
import { tribeById, UNITS, popToGrow, isWater } from '../game/rules.js';
import { Builder, addTerrain, addDecor, addResourceOutline, cloudGeometry, unitGeometry, vertexMaterial, COLORS, WATER_TOP, OCEAN_TOP, MOUNTAIN_TOP, UNIT_SCALE, hash, faceAngle } from './models.js';
import { createScene, tween, wait, requestRender, easeOut, easeInOut, linear } from './scene.js';
import { CameraRig } from './camera.js';
import { Fire } from './fire.js';
import { ICONS } from '../ui/ui.js';

// Figuren schauen Richtung Kamera, Schiffe zeigen ihre Seite (faceAngle)
const MAX_MARKERS = 120;

// Leuchtender Umriss für Einheiten, die noch dran sind: helle, leicht vergrößerte Rückseite der Figur
const GLOW = new THREE.MeshBasicMaterial({ color: '#e3fbff', side: THREE.BackSide, transparent: true, opacity: 0.92, depthWrite: false });
const GLOW_SCALE = 1.09;
const glowCenter = new WeakMap();

function addGlow(mesh) {
  const geo = mesh.geometry;
  if (!glowCenter.has(geo)) {
    geo.computeBoundingBox();
    glowCenter.set(geo, geo.boundingBox.getCenter(new THREE.Vector3()));
  }
  const glow = new THREE.Mesh(geo, GLOW);
  glow.scale.setScalar(GLOW_SCALE); // um die Mitte der Figur vergrößert, nicht um die Füße
  glow.position.copy(glowCenter.get(geo)).multiplyScalar(1 - GLOW_SCALE);
  glow.renderOrder = -1;
  glow.visible = false;
  mesh.add(glow);
  return glow;
}

export class Board {
  constructor(container, { onTap, onCapture, shadows = true } = {}) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Spielkarte');
    this.labelsEl = document.createElement('div');
    this.labelsEl.className = 'labels';
    container.prepend(this.canvas, this.labelsEl);
    this.view = createScene(this.canvas, { shadows });
    this.onTap = onTap;
    this.onCapture = onCapture; // Knopf „Erobern“ über einer Einheit
    this.rig = new CameraRig(this.view.camera, this.canvas, { onTap: (x, y) => this.handleTap(x, y) });
    this.view.afterRender(() => this.updateLabels());
    this.units = new Map(); // id → { mesh, label, owner, type }
    this.cityLabels = new Map();
    this.floats = new Set();
    this.speed = 1;
    this.root = new THREE.Group();
    this.view.scene.add(this.root);
    this.fires = new Map(); // Stadt-ID → Feuer (Gegner steht in der Stadt)
    this.fireClock = 0;
    this.view.onFrame((dt) => this.animateFires(dt));
    this.createMarkers();
  }

  // ---------- Aufbau ----------

  load(s, viewer = 0) {
    this.s = s;
    this.viewer = viewer;
    this.c = (s.size - 1) / 2;
    for (const v of this.units.values()) this.removeUnitView(v);
    this.units.clear();
    for (const el of this.cityLabels.values()) el.remove();
    this.cityLabels.clear();
    for (const fire of this.fires.values()) this.removeFire(fire);
    this.fires.clear();
    this.replace('resourceGlow', null);
    this.resourceGlowKey = null;
    this.rig.setBounds(s.size);
    this.view.fitShadow(s.size);
    this.buildSea();
    this.buildTerrain();
    this.buildDecor();
    this.buildBorders();
    this.buildClouds();
    this.syncUnits();
    this.syncCityLabels();
    requestRender();
  }

  wx(x) {
    return x - this.c;
  }

  wz(y) {
    return y - this.c;
  }

  seen(x, y) {
    return E.isExplored(this.s, this.viewer, x, y);
  }

  replace(name, object) {
    if (this[name]) {
      this.root.remove(this[name]);
      this[name].geometry?.dispose();
    }
    this[name] = object;
    if (object) this.root.add(object);
  }

  buildSea() {
    const size = this.s.size * 4 + 20;
    const dry = this.s.mapType === 'drylands'; // Trockenland: trockener Boden statt Meer drumherum
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ color: dry ? COLORS.dust : COLORS.sea }));
    this.view.scene.background.set(dry ? COLORS.dust : COLORS.sea);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = OCEAN_TOP - 0.08;
    mesh.receiveShadow = true;
    this.replace('sea', mesh);
  }

  buildTerrain() {
    const b = new Builder();
    for (const t of this.s.tiles) addTerrain(b, t, this.wx(t.x), this.wz(t.y), t.climate);
    const mesh = new THREE.Mesh(b.build(), this.terrainMat || (this.terrainMat = vertexMaterial()));
    mesh.receiveShadow = true;
    this.replace('terrain', mesh);
  }

  buildDecor() {
    const s = this.s;
    const b = new Builder();
    for (const t of s.tiles) {
      if (!this.seen(t.x, t.y)) continue;
      const cityId = t.city ?? t.owner;
      const extra = { city: cityId != null ? E.cityById(s, cityId) : null };
      if (t.road) {
        extra.roadDirs = E.around(s, t.x, t.y)
          .filter((o) => o.road || o.city != null)
          .map((o) => [o.x - t.x, o.y - t.y]);
      }
      addDecor(b, s, t, this.wx(t.x), this.wz(t.y), extra);
    }
    const mesh = b.empty ? null : new THREE.Mesh(b.build(), this.decorMat || (this.decorMat = vertexMaterial()));
    if (mesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    this.replace('decor', mesh);
    this.decorDirty = false;
  }

  // Grenzlinien in Stammesfarbe, wo das Gebiet an fremdes oder freies Land stößt
  buildBorders() {
    const s = this.s;
    const b = new Builder();
    const edges = [
      [1, 0, 0.47, 0, 0.06, 1],
      [-1, 0, -0.47, 0, 0.06, 1],
      [0, 1, 0, 0.47, 1, 0.06],
      [0, -1, 0, -0.47, 1, 0.06],
    ];
    for (const t of s.tiles) {
      if (t.owner == null || !this.seen(t.x, t.y)) continue;
      const p = E.tileOwner(s, t);
      if (p == null) continue;
      const color = tribeById(s.players[p].tribe).color;
      const y = t.terrain === 'shallow' ? WATER_TOP + 0.012 : t.terrain === 'ocean' ? OCEAN_TOP + 0.012 : 0.012;
      for (const [dx, dy, ox, oz, sx, sz] of edges) {
        const n = E.at(s, t.x + dx, t.y + dy);
        if (n && E.tileOwner(s, n) === p) continue;
        b.add(new THREE.BoxGeometry(1, 1, 1), color, { p: [this.wx(t.x) + ox, y, this.wz(t.y) + oz], s: [sx, 0.024, sz] });
      }
    }
    this.replace('borders', b.empty ? null : new THREE.Mesh(b.build(), this.borderMat || (this.borderMat = vertexMaterial())));
    this.bordersDirty = false;
  }

  buildClouds() {
    const s = this.s;
    const n = s.size * s.size;
    const mesh = new THREE.InstancedMesh(cloudGeometry(), vertexMaterial(), n);
    mesh.frustumCulled = false;
    this.cloudScale = new Float32Array(n);
    for (let i = 0; i < n; i++) this.cloudScale[i] = this.seen(i % s.size, Math.floor(i / s.size)) ? 0 : 1;
    this.replace('clouds', mesh);
    this.updateClouds();
  }

  updateClouds(indices = null) {
    const s = this.s;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const list = indices || Array.from({ length: s.size * s.size }, (_, i) => i);
    for (const i of list) {
      const x = i % s.size;
      const y = Math.floor(i / s.size);
      const k = this.cloudScale[i];
      const wobble = 0.92 + hash(x, y, 7) * 0.16;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(hash(x, y, 5) * 4) * (Math.PI / 2));
      m.compose(new THREE.Vector3(this.wx(x), 0.05 + (1 - k) * 0.6, this.wz(y)), q, new THREE.Vector3(k * wobble, k * wobble, k * wobble));
      this.clouds.setMatrixAt(i, m);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    requestRender();
  }

  // Wolken über neu aufgedeckten Kacheln auflösen
  dissolveClouds(indices, duration = 0.35) {
    const list = indices.filter((i) => this.cloudScale[i] > 0);
    if (!list.length) return Promise.resolve();
    const start = list.map((i) => this.cloudScale[i]);
    return tween(
      duration,
      (k) => {
        list.forEach((i, n) => (this.cloudScale[i] = start[n] * (1 - k)));
        this.updateClouds(list);
      },
      easeOut,
    );
  }

  // ---------- Markierungen ----------

  createMarkers() {
    const dot = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 14);
    const ring = new THREE.TorusGeometry(0.36, 0.035, 6, 28);
    ring.rotateX(Math.PI / 2);
    const mk = (geo, color, opacity = 0.9, onTop = false) => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: !onTop }), MAX_MARKERS);
      mesh.count = 0;
      mesh.renderOrder = 5;
      mesh.frustumCulled = false;
      this.view.scene.add(mesh);
      return mesh;
    };
    this.moveMarks = mk(dot, '#ffffff', 0.85, true); // leere Felder: immer obenauf
    this.attackMarks = mk(ring, '#ff3b3b', 0.95);
    this.convertMarks = mk(ring, '#d0bfff', 0.95);
    const sel = new THREE.TorusGeometry(0.44, 0.045, 6, 32);
    sel.rotateX(Math.PI / 2);
    this.selectRing = new THREE.Mesh(sel, new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.95, depthWrite: false }));
    this.selectRing.visible = false;
    this.selectRing.renderOrder = 6;
    this.view.scene.add(this.selectRing);
  }

  heightAt(x, y) {
    const t = E.at(this.s, x, y);
    if (!t) return 0;
    return t.terrain === 'shallow' ? WATER_TOP : t.terrain === 'ocean' ? OCEAN_TOP : t.terrain === 'mountain' ? MOUNTAIN_TOP : 0;
  }

  setHighlights({ select = null, moves = [], attacks = [], converts = [] } = {}) {
    const m = new THREE.Matrix4();
    const put = (mesh, list, lift) => {
      mesh.count = Math.min(list.length, MAX_MARKERS);
      list.slice(0, MAX_MARKERS).forEach((t, i) => {
        m.makeTranslation(this.wx(t.x), this.heightAt(t.x, t.y) + lift, this.wz(t.y));
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    put(this.moveMarks, moves, 0.04);
    put(this.attackMarks, attacks, 0.05);
    put(this.convertMarks, converts, 0.05);
    this.selectRing.visible = Boolean(select);
    if (select) this.selectRing.position.set(this.wx(select.x), this.heightAt(select.x, select.y) + 0.03, this.wz(select.y));
    requestRender();
  }

  // ---------- Einheiten ----------

  unitColor(owner) {
    const t = tribeById(this.s.players[owner].tribe);
    return { color: t.color, dark: t.dark };
  }

  createUnitView(u) {
    const { color } = this.unitColor(u.owner);
    const mesh = new THREE.Mesh(unitGeometry(u.naval || u.type, this.s.players[u.owner].tribe), vertexMaterial());
    mesh.castShadow = true;
    mesh.position.set(this.wx(u.x), this.heightAt(u.x, u.y), this.wz(u.y));
    mesh.rotation.y = faceAngle(u.naval || u.type) + (hash(u.id, 3) - 0.5) * 0.5;
    mesh.scale.setScalar(UNIT_SCALE[u.naval || u.type] || UNIT_SCALE.default);
    mesh.userData.unitId = u.id;
    this.root.add(mesh);
    const label = document.createElement('div');
    label.className = 'lbl lbl-hp';
    label.style.setProperty('--c', color);
    this.labelsEl.append(label);
    const view = { id: u.id, mesh, label, glow: addGlow(mesh), owner: u.owner, type: u.naval || u.type, baseScale: UNIT_SCALE[u.naval || u.type] || UNIT_SCALE.default };
    view.top = (mesh.geometry.boundingBox?.max.y ?? 0.7) * view.baseScale; // Kopfhöhe (für den Knopf darüber)
    this.units.set(u.id, view);
    this.updateUnitLabel(view, u);
    return view;
  }

  updateUnitLabel(view, u) {
    if (!u) return;
    view.label.textContent = Math.max(0, Math.round(u.hp));
    view.label.classList.toggle('is-low', u.hp <= u.maxHp * 0.35);
    view.label.classList.toggle('is-vet', u.veteran);
    view.label.classList.toggle('is-guarded', E.defenseBonus(this.s, u) > 1); // steht geschützt (Berg, Wald, Stadt …)
  }

  removeUnitView(view) {
    this.root.remove(view.mesh);
    view.mesh.material.dispose();
    view.label.remove();
    view.capture?.remove();
    this.units.delete(view.id);
  }

  // Ansicht der Einheiten an den Zustand angleichen
  syncUnits() {
    const s = this.s;
    const alive = new Set();
    for (const u of s.units) {
      alive.add(u.id);
      let view = this.units.get(u.id);
      if (view && (view.owner !== u.owner || view.type !== (u.naval || u.type))) {
        this.removeUnitView(view);
        view = null;
      }
      if (!view) view = this.createUnitView(u);
      view.mesh.position.set(this.wx(u.x), this.heightAt(u.x, u.y), this.wz(u.y));
      view.mesh.scale.setScalar(view.baseScale);
      const visible = this.seen(u.x, u.y);
      view.mesh.visible = visible;
      view.label.hidden = !visible;
      this.updateUnitLabel(view, u);
      const mine = u.owner === this.viewer && s.current === this.viewer && !s.over;
      const spent = mine && !E.isIdle(s, u);
      view.mesh.material.color.setScalar(spent ? 0.62 : 1);
      view.glow.visible = mine && !spent;
      view.label.classList.toggle('is-spent', spent);
      this.setCaptureButton(view, mine && visible ? E.captureTarget(s, u) : null);
    }
    for (const view of [...this.units.values()]) if (!alive.has(view.id)) this.removeUnitView(view);
    this.syncFires();
    this.syncResourceGlow();
    requestRender();
  }

  // Ressourcen, die du jetzt nutzen kannst (Technik, eigenes Gebiet, genug Sterne), leuchten wie Einheiten, die noch dran sind
  syncResourceGlow() {
    const s = this.s;
    const mine = s.current === this.viewer && !s.over;
    const tiles = mine ? s.tiles.filter((t) => t.resource && this.seen(t.x, t.y) && E.usableResource(s, this.viewer, t)) : [];
    const key = tiles.map((t) => E.idx(s, t.x, t.y)).join(',');
    if (key === this.resourceGlowKey) return;
    this.resourceGlowKey = key;
    let mesh = null;
    if (tiles.length) {
      const b = new Builder();
      for (const t of tiles) addResourceOutline(b, t, this.wx(t.x), this.wz(t.y));
      mesh = new THREE.Mesh(b.build(), GLOW);
      mesh.renderOrder = -1;
    }
    this.replace('resourceGlow', mesh);
  }

  // Feuer, solange ein Gegner in einer Stadt steht – bis er abzieht oder die Stadt einnimmt (dann erlischt es langsam)
  syncFires() {
    const s = this.s;
    const burning = new Set(s.cities.filter((c) => E.besieged(s, c) && this.seen(c.x, c.y)).map((c) => c.id));
    for (const id of burning) {
      let fire = this.fires.get(id);
      if (!fire) {
        const c = E.cityById(s, id);
        fire = new Fire(id);
        fire.group.position.set(this.wx(c.x), this.heightAt(c.x, c.y), this.wz(c.y));
        this.root.add(fire.group);
        this.fires.set(id, fire);
      }
      fire.target = 1;
    }
    for (const [id, fire] of this.fires) if (!burning.has(id)) fire.target = 0;
  }

  // Bild für Bild (höchstens 30 pro Sekunde – ruhige Bewegung, schont den Akku)
  animateFires(dt) {
    if (!this.fires.size) return false;
    this.fireClock += dt;
    if (this.fireClock < 1 / 30) return false;
    const step = this.fireClock;
    this.fireClock = 0;
    for (const [id, fire] of this.fires) {
      if (!fire.update(step)) {
        this.removeFire(fire);
        this.fires.delete(id);
      }
    }
    return true;
  }

  removeFire(fire) {
    this.root.remove(fire.group);
    fire.dispose();
  }

  // Knopf direkt über der Einheit, solange sie eine Stadt erobern oder ein Dorf einnehmen kann – ein Tipp genügt
  setCaptureButton(view, target) {
    if (!target) {
      view.capture?.remove();
      view.capture = null;
      return;
    }
    if (!view.capture) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lbl lbl-capture';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCapture?.(view.id);
      });
      this.labelsEl.append(btn);
      view.capture = btn;
    }
    if (view.capture.dataset.kind !== target.kind) {
      view.capture.dataset.kind = target.kind;
      view.capture.innerHTML = `<span>${ICONS.flag}${target.kind === 'village' ? 'Einnehmen' : 'Erobern'}</span>`;
    }
    requestRender();
  }

  // ---------- Beschriftungen ----------

  syncCityLabels() {
    const s = this.s;
    const ids = new Set();
    for (const c of s.cities) {
      if (!this.seen(c.x, c.y)) continue;
      ids.add(c.id);
      let el = this.cityLabels.get(c.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'lbl lbl-city';
        this.labelsEl.append(el);
        this.cityLabels.set(c.id, el);
      }
      const tribe = tribeById(s.players[c.owner].tribe);
      el.style.setProperty('--c', tribe.color);
      const need = popToGrow(c.level);
      const pips = Array.from({ length: need }, (_, i) => `<span class="${i < c.pop ? 'is-full' : ''}"></span>`).join('');
      el.innerHTML = `<span class="lbl-city-name ${c.capital ? 'is-capital' : ''}"><i>${c.level}</i>${escapeHtml(c.name)}</span><span class="lbl-pop">${pips}</span>`;
      el.dataset.x = c.x;
      el.dataset.y = c.y;
    }
    for (const [id, el] of [...this.cityLabels]) {
      if (!ids.has(id)) {
        el.remove();
        this.cityLabels.delete(id);
      }
    }
    requestRender();
  }

  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.view.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height, behind: v.z > 1 };
  }

  updateLabels() {
    for (const view of this.units.values()) {
      if (view.label.hidden) continue;
      const p = view.mesh.position;
      const sp = this.project(p.x, p.y, p.z);
      view.label.style.transform = `translate3d(${sp.x}px, ${sp.y + 6}px, 0) translate(-50%, 0)`;
      if (view.capture) {
        const top = this.project(p.x, p.y + view.top + 0.1, p.z);
        view.capture.style.transform = `translate3d(${top.x}px, ${top.y}px, 0) translate(-50%, -100%)`;
      }
    }
    for (const el of this.cityLabels.values()) {
      const x = Number(el.dataset.x);
      const y = Number(el.dataset.y);
      const sp = this.project(this.wx(x), 0, this.wz(y) + 0.5);
      el.style.transform = `translate3d(${sp.x}px, ${sp.y}px, 0) translate(-50%, -20%)`;
    }
    for (const f of this.floats) {
      const sp = this.project(f.x, f.y, f.z);
      f.el.style.transform = `translate3d(${sp.x}px, ${sp.y - f.rise}px, 0) translate(-50%, -50%)`;
    }
  }

  // Aufsteigende Zahl/Text über einer Kachel
  float(x, y, text, kind = '') {
    if (!this.seen(x, y)) return;
    const el = document.createElement('div');
    el.className = `lbl lbl-float ${kind}`;
    el.textContent = text;
    this.labelsEl.append(el);
    const f = { el, x: this.wx(x), y: 0.6, z: this.wz(y), rise: 0 };
    this.floats.add(f);
    tween(
      1.1 / this.speed,
      (k) => {
        f.rise = k * 34;
        el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      },
      linear,
    ).then(() => {
      this.floats.delete(f);
      el.remove();
    });
  }

  // ---------- Tippen ----------

  handleTap(clientX, clientY) {
    const s = this.s;
    if (!s) return;
    // Erst Einheiten (sie ragen über die Nachbarkachel), dann der Boden
    const ray = this.rig.rayAt(clientX, clientY);
    const meshes = [...this.units.values()].filter((v) => v.mesh.visible).map((v) => v.mesh);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) {
      const u = E.unitById(s, hit.object.userData.unitId);
      if (u) {
        this.onTap?.(E.at(s, u.x, u.y));
        return;
      }
    }
    const g = this.rig.groundAt(clientX, clientY);
    if (!g) return this.onTap?.(null);
    const x = Math.round(g.x + this.c);
    const y = Math.round(g.z + this.c);
    this.onTap?.(E.at(s, x, y));
  }

  focusTile(x, y, opts) {
    return this.rig.focus(this.wx(x), this.wz(y), opts);
  }

  isTileOnScreen(x, y) {
    return this.rig.isOnScreen(this.wx(x), this.wz(y));
  }

  // ---------- Ereignisse abspielen ----------

  async play(events, { speed = 1 } = {}) {
    this.speed = speed;
    for (const ev of events) {
      try {
        await this.playOne(ev);
      } catch (err) {
        console.error('Animation', ev, err);
      }
    }
    this.sync();
  }

  sync() {
    if (this.terrainDirty) {
      this.buildTerrain();
      this.terrainDirty = false;
    }
    if (this.decorDirty) this.buildDecor();
    if (this.bordersDirty) this.buildBorders();
    // Wolken: alles Erkundete frei
    const s = this.s;
    const changed = [];
    for (let i = 0; i < s.size * s.size; i++) {
      const want = s.players[this.viewer].explored[i] ? 0 : 1;
      if (this.cloudScale[i] !== want) {
        this.cloudScale[i] = want;
        changed.push(i);
      }
    }
    if (changed.length) this.updateClouds(changed);
    this.syncUnits();
    this.syncCityLabels();
  }

  // Ton abspielen, wenn der Spieler die Stelle sieht (x/y weglassen = immer)
  sfx(name, x = null, y = null) {
    if (x == null || this.seen(x, y)) this.onSound?.(name);
  }

  // Wie lange eine Animation dauert (Computerzüge schneller)
  t(seconds) {
    return seconds / this.speed;
  }

  async playOne(ev) {
    const s = this.s;
    switch (ev.type) {
      case 'move':
        return this.animMove(ev);
      case 'attack':
        return this.animAttack(ev);
      case 'train':
      case 'spawn': {
        const u = E.unitById(s, ev.unit.id) || ev.unit;
        let view = this.units.get(ev.unit.id);
        if (!view) view = this.createUnitView({ ...ev.unit, hp: u.hp, maxHp: u.maxHp, veteran: u.veteran });
        view.mesh.position.set(this.wx(ev.unit.x), this.heightAt(ev.unit.x, ev.unit.y), this.wz(ev.unit.y));
        const vis = this.seen(ev.unit.x, ev.unit.y);
        view.mesh.visible = vis;
        view.label.hidden = !vis;
        if (!vis) return;
        this.sfx('spawn');
        await tween(this.t(0.3), (k) => view.mesh.scale.setScalar(view.baseScale * (0.2 + 0.8 * k + Math.sin(k * Math.PI) * 0.25)), easeOut);
        return;
      }
      case 'reveal': {
        if (ev.player !== this.viewer) return;
        this.decorDirty = this.bordersDirty = true;
        this.buildDecor();
        this.buildBorders();
        this.syncCityLabels();
        this.dissolveClouds(ev.tiles, this.t(0.4));
        this.sfx('reveal');
        return wait(this.t(0.06));
      }
      case 'capture': {
        this.decorDirty = this.bordersDirty = true;
        this.buildDecor();
        this.buildBorders();
        this.syncCityLabels();
        if (!this.seen(ev.x, ev.y)) return;
        this.float(ev.x, ev.y, ev.village ? 'Neue Stadt!' : 'Erobert!', 'is-star');
        this.sfx('capture');
        return wait(this.t(0.5));
      }
      case 'tile': {
        this.terrainDirty = true;
        this.buildTerrain();
        this.terrainDirty = false;
        this.buildDecor();
        this.buildBorders();
        this.sfx('build', ev.x, ev.y);
        return wait(this.t(0.1));
      }
      case 'pop': {
        const c = E.cityById(s, ev.city);
        if (c) this.syncCityLabels();
        return;
      }
      case 'levelup': {
        const c = E.cityById(s, ev.city);
        if (!c) return;
        this.buildDecor();
        this.syncCityLabels();
        this.float(c.x, c.y, `Stufe ${ev.level}!`, 'is-star');
        this.sfx('levelup', c.x, c.y);
        return wait(this.t(0.4));
      }
      case 'reward':
      case 'territory':
        this.buildDecor();
        this.buildBorders();
        this.syncCityLabels();
        return;
      case 'convert': {
        const old = this.units.get(ev.unit);
        if (old) this.removeUnitView(old);
        const u = E.unitById(s, ev.unit);
        if (u) {
          this.createUnitView(u);
          this.float(u.x, u.y, 'Bekehrt!', 'is-heal');
          this.sfx('upgrade', u.x, u.y);
        }
        return wait(this.t(0.4));
      }
      case 'heal': {
        for (const h of ev.units) {
          const u = E.unitById(s, h.id);
          const view = this.units.get(h.id);
          if (u && view) {
            this.updateUnitLabel(view, u);
            this.float(u.x, u.y, `+${h.amount}`, 'is-heal');
            this.sfx('heal', u.x, u.y);
          }
        }
        return wait(this.t(0.35));
      }
      case 'upgrade': {
        const u = E.unitById(s, ev.unit);
        if (!u) return;
        const view = this.swapModel(ev.unit, ev.naval, u.x, u.y);
        if (view && this.seen(u.x, u.y)) {
          this.float(u.x, u.y, ev.naval === 'ship' ? 'Schiff!' : 'Schlachtschiff!', 'is-star');
          this.sfx('upgrade');
          await tween(this.t(0.3), (k) => view.mesh.scale.setScalar(view.baseScale * (0.6 + 0.4 * k + Math.sin(k * Math.PI) * 0.2)), easeOut);
        }
        return;
      }
      case 'promote': {
        const u = E.unitById(s, ev.unit);
        const view = this.units.get(ev.unit);
        if (u && view) {
          this.updateUnitLabel(view, u);
          this.float(u.x, u.y, '★ Veteran', 'is-star');
          this.sfx('levelup', u.x, u.y);
        }
        return wait(this.t(0.3));
      }
      case 'disband': {
        const view = this.units.get(ev.unit);
        if (view) await this.animDeath(view);
        return;
      }
      case 'eliminated':
        for (const id of ev.units) {
          const view = this.units.get(id);
          if (view) this.removeUnitView(view);
        }
        return;
      case 'ruin': {
        this.buildDecor();
        const text = { stars: '+10 ★', tech: 'Neue Technik!', explorer: 'Kundschafter!', population: '+3 Einwohner', veteran: 'Schwertkämpfer!' }[ev.reward];
        this.float(ev.x, ev.y, text || 'Ruine erkundet', 'is-star');
        this.sfx('coin', ev.x, ev.y);
        return wait(this.t(0.4));
      }
      default:
    }
  }

  // Einschiffen, Anlanden, Aufrüsten: Modell tauschen (Figur ↔ Boot/Schiff)
  swapModel(unitId, kind, x, y) {
    const old = this.units.get(unitId);
    const u = E.unitById(this.s, unitId);
    if (!old || !u) return null;
    const visible = !old.label.hidden;
    this.removeUnitView(old);
    const view = this.createUnitView({ ...u, naval: ['boat', 'ship', 'battleship'].includes(kind) ? kind : null, x, y });
    view.mesh.visible = visible;
    view.label.hidden = !visible;
    return view;
  }

  async animMove(ev) {
    let view = this.units.get(ev.unit);
    if (!view) return;
    const path = ev.path;
    const anySeen = path.some((p) => this.seen(p.x, p.y));
    const last = path[path.length - 1];
    if (!anySeen) {
      view.mesh.position.set(this.wx(last.x), this.heightAt(last.x, last.y), this.wz(last.y));
      if (ev.embark || ev.land) this.swapModel(ev.unit, ev.to || E.unitById(this.s, ev.unit)?.type, last.x, last.y);
      return;
    }
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const ax = this.wx(a.x);
      const az = this.wz(a.y);
      const bx = this.wx(b.x);
      const bz = this.wz(b.y);
      const ay = this.heightAt(a.x, a.y);
      const by = this.heightAt(b.x, b.y);
      view.mesh.rotation.y = Math.atan2(-(bz - az), bx - ax);
      this.sfx('step', b.x, b.y);
      const vis = this.seen(a.x, a.y) || this.seen(b.x, b.y);
      view.mesh.visible = vis;
      view.label.hidden = !vis;
      await tween(
        this.t(0.17),
        (k) => {
          view.mesh.position.set(ax + (bx - ax) * k, ay + (by - ay) * k + Math.sin(k * Math.PI) * 0.14, az + (bz - az) * k);
        },
        linear,
      );
    }
    view.mesh.rotation.y = faceAngle(view.type);
    if (ev.embark || ev.land) {
      const u = E.unitById(this.s, ev.unit);
      view = this.swapModel(ev.unit, ev.to || u?.type, last.x, last.y);
      this.float(last.x, last.y, ev.embark ? 'Leinen los!' : 'Gelandet', 'is-heal');
      this.sfx(ev.embark ? 'splash' : 'land', last.x, last.y);
    }
  }

  async animAttack(ev) {
    const att = this.units.get(ev.attacker);
    const def = this.units.get(ev.defender);
    const visible = this.seen(ev.from.x, ev.from.y) || this.seen(ev.to.x, ev.to.y);
    if (!visible) return;
    const ax = this.wx(ev.from.x);
    const az = this.wz(ev.from.y);
    const dx = this.wx(ev.to.x);
    const dz = this.wz(ev.to.y);
    if (att) att.mesh.rotation.y = Math.atan2(-(dz - az), dx - ax);
    // Sieg im Nahkampf mit Nachrücken: in einer Bewegung auf das Feld stürmen
    if (ev.advance && att) return this.animCharge(ev, att, def);
    this.sfx(ev.ranged ? 'arrow' : 'attack');
    if (ev.ranged) {
      // Geschoss im Bogen
      const shot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: '#3b2a1e' }));
      this.root.add(shot);
      await tween(
        this.t(0.38),
        (k) => shot.position.set(ax + (dx - ax) * k, 0.35 + Math.sin(k * Math.PI) * 0.8, az + (dz - az) * k),
        linear,
      );
      this.root.remove(shot);
      shot.geometry.dispose();
    } else if (att) {
      const ox = att.mesh.position.x;
      const oz = att.mesh.position.z;
      await tween(this.t(0.12), (k) => att.mesh.position.set(ox + (dx - ox) * 0.4 * k, att.mesh.position.y, oz + (dz - oz) * 0.4 * k), easeInOut);
      tween(this.t(0.14), (k) => att.mesh.position.set(ox + (dx - ox) * 0.4 * (1 - k), att.mesh.position.y, oz + (dz - oz) * 0.4 * (1 - k)), easeInOut);
    }
    this.float(ev.to.x, ev.to.y, `−${ev.dmg}`, 'is-dmg');
    this.sfx('hit');
    if (def) {
      const u = E.unitById(this.s, ev.defender);
      if (u) this.updateUnitLabel(def, u);
      else def.label.textContent = '0';
      const base = def.mesh.position.clone();
      await tween(this.t(0.18), (k) => def.mesh.position.set(base.x + Math.sin(k * Math.PI * 4) * 0.04, base.y, base.z), linear);
    }
    if (ev.kill && def) {
      this.sfx('death');
      await this.animDeath(def);
    }
    if (ev.ret) {
      this.float(ev.from.x, ev.from.y, `−${ev.ret}`, 'is-dmg');
      this.sfx('hit');
      const u = E.unitById(this.s, ev.attacker);
      if (att && u) this.updateUnitLabel(att, u);
      await wait(this.t(0.15));
    }
    if (ev.retKill && att) {
      this.sfx('death');
      await this.animDeath(att);
    }
    if (att) att.mesh.rotation.y = faceAngle(att.type);
  }

  // Angreifer stürmt in einem Zug auf das Feld des Gegners (Sprung, nach vorn gelehnt).
  // Beim Aufprall fliegt der Gegner nach hinten weg – kein Zurückweichen, kein zweiter Schritt.
  async animCharge(ev, att, def) {
    const { from, to } = ev;
    const ax = this.wx(from.x);
    const az = this.wz(from.y);
    const ay = this.heightAt(from.x, from.y);
    const bx = this.wx(to.x);
    const bz = this.wz(to.y);
    const by = this.heightAt(to.x, to.y);
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const dir = { x: (bx - ax) / len, z: (bz - az) / len };
    att.mesh.visible = true;
    att.label.hidden = false;
    this.sfx('attack');
    let impact = null;
    await tween(
      this.t(0.46),
      (k) => {
        const f = easeInOut(k);
        att.mesh.position.set(ax + (bx - ax) * f, ay + (by - ay) * f + Math.sin(f * Math.PI) * 0.16, az + (bz - az) * f);
        att.mesh.rotation.z = -Math.sin(f * Math.PI) * 0.22;
        if (!impact && f >= 0.42) impact = this.knockOut(ev, def, dir);
      },
      linear,
    );
    att.mesh.rotation.z = 0;
    await impact;
    this.sfx('step', to.x, to.y);
    await this.turnBack(att);
  }

  // Getroffener Gegner: fliegt in Stoßrichtung ein Stück weg, kippt um und verschwindet
  async knockOut(ev, view, dir) {
    this.float(ev.to.x, ev.to.y, `−${ev.dmg}`, 'is-dmg');
    this.sfx('hit');
    wait(this.t(0.08)).then(() => this.sfx('death'));
    if (!view) return;
    view.label.hidden = true;
    const start = view.mesh.position.clone();
    const turned = view.mesh.quaternion.clone();
    const axis = new THREE.Vector3(dir.z, 0, -dir.x); // kippt vom Angreifer weg
    const tilt = new THREE.Quaternion();
    const size = view.mesh.scale.x;
    await tween(
      this.t(0.32),
      (k) => {
        view.mesh.position.set(start.x + dir.x * 0.45 * k, start.y + Math.sin(k * Math.PI) * 0.12, start.z + dir.z * 0.45 * k);
        view.mesh.quaternion.copy(tilt.setFromAxisAngle(axis, k * 1.4)).multiply(turned);
        view.mesh.scale.setScalar(size * (1 - k * k));
      },
      easeOut,
    );
    this.removeUnitView(view);
  }

  // Zurück in die Grundhaltung drehen (kürzester Weg)
  async turnBack(view) {
    const from = view.mesh.rotation.y;
    const to = faceAngle(view.type);
    const turn = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    await tween(this.t(0.14), (k) => (view.mesh.rotation.y = from + turn * k), easeOut);
  }

  async animDeath(view) {
    const start = view.mesh.scale.x;
    view.label.hidden = true;
    await tween(
      this.t(0.3),
      (k) => {
        view.mesh.scale.setScalar(start * (1 - k));
        view.mesh.rotation.z = k * 1.2;
      },
      easeInOut,
    );
    this.removeUnitView(view);
  }

  setShadows(on) {
    this.view.setShadows(on);
  }

  // Bild der aktuellen Ansicht (für „Weiterspielen“)
  snapshot(width = 160) {
    this.view.renderer.render(this.view.scene, this.view.camera);
    const src = this.canvas;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = width;
    const ctx = c.getContext('2d');
    const side = Math.min(src.width, src.height);
    ctx.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, width, width);
    return c.toDataURL('image/jpeg', 0.75);
  }

  dispose() {
    this.view.dispose();
    this.canvas.remove();
    this.labelsEl.remove();
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export { isWater, UNITS };
