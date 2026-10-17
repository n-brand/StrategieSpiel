// Kleine Vorschaubilder aus denselben 3D-Modellen wie auf der Karte (für Knöpfe, Karten, Stamm-Auswahl).
// Ein eigener, kleiner Renderer zeichnet einmal und merkt sich das Bild als Daten-URL.

import * as THREE from 'three';
import { tribeById } from '../game/rules.js';
import { Builder, addTerrain, addDecor, unitGeometry, vertexMaterial, faceAngle } from './models.js';

let renderer = null;
let scene = null;
let camera = null;
const cache = new Map();

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#5d6b7a', 1.7));
  const sun = new THREE.DirectionalLight('#fff3dd', 1.9);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
}

// dispose: Geometrie danach freigeben (nicht bei Einheiten – deren Geometrie teilt sich die Karte)
function shoot(object, { dist = 1.6, y = 0.2, w = 128, h = 128, dispose = true } = {}) {
  if (!renderer) setup();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  scene.add(object);
  camera.position.set(dist * 0.68, y + dist * 0.62, dist * 0.68);
  camera.lookAt(0, y, 0);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(object);
  if (dispose) object.geometry?.dispose();
  return url;
}

function cached(key, make) {
  if (!cache.has(key)) {
    try {
      cache.set(key, make());
    } catch (err) {
      console.error('Vorschaubild', key, err);
      cache.set(key, '');
    }
  }
  return cache.get(key);
}

export function unitThumb(type, tribeId) {
  return cached(`u|${type}|${tribeId}`, () => {
    const mesh = new THREE.Mesh(unitGeometry(type, tribeId), vertexMaterial());
    mesh.rotation.y = faceAngle(type);
    const big = type === 'giant';
    return shoot(mesh, { dist: big ? 2.3 : 1.35, y: big ? 0.32 : 0.2, dispose: false });
  });
}

// Eine einzelne Kachel (Gelände, Ressource, Gebäude, Straße); tile: { terrain, resource, building, road, climate, … }
export function tileThumb(tile, ownerTribe = null) {
  const key = `t|${tile.terrain}|${tile.resource}|${tile.building}|${tile.climate}|${tile.village}|${tile.ruin}|${tile.road ? 'road' : ''}|${ownerTribe}`;
  return cached(key, () => {
    const b = new Builder();
    const t = { x: 3, y: 5, road: false, city: null, owner: null, village: false, ruin: false, resource: null, building: null, ...tile };
    addTerrain(b, t, 0, 0, t.climate);
    const color = ownerTribe ? tribeById(ownerTribe).color : '#adb5bd';
    addDecor(b, { players: [] }, t, 0, 0, { city: null, ownerColor: color, roadDirs: t.road ? [[1, 0], [-1, 0], [0, 1]] : null });
    return shoot(new THREE.Mesh(b.build(), vertexMaterial()), { dist: 2.1, y: 0.05 });
  });
}

export function cityThumb(tribeId, level = 2, capital = false) {
  return cached(`c|${tribeId}|${level}|${capital}`, () => {
    const b = new Builder();
    const t = { x: 1, y: 1, terrain: 'field', resource: null, building: null, climate: tribeId, city: 1, owner: 1 };
    addTerrain(b, t, 0, 0, tribeId);
    const city = { id: 1, owner: 0, level, capital, wall: false, parks: 0 };
    addDecor(b, { players: [{ tribe: tribeId }] }, t, 0, 0, { city });
    return shoot(new THREE.Mesh(b.build(), vertexMaterial()), { dist: 2.1, y: 0.12 });
  });
}

// Kleine Insel mit Stadt, Wald, Berg und einer Einheit – Bild für die Stamm-Auswahl
export function tribeThumb(tribeId) {
  return cached(`tribe|${tribeId}`, () => {
    const tribe = tribeById(tribeId);
    const b = new Builder();
    const layout = [
      [-1, -1, 'forest', null], [0, -1, 'mountain', tribe.start === 'ore' ? 'ore' : null], [1, -1, 'forest', tribe.start === 'animal' ? 'animal' : null],
      [-1, 0, 'field', tribe.start === 'fruit' ? 'fruit' : 'fruit'], [0, 0, 'field', null], [1, 0, 'field', tribe.start === 'crop' ? 'crop' : null],
      [-1, 1, 'shallow', 'fish'], [0, 1, 'field', null], [1, 1, 'forest', null],
    ];
    const players = [{ tribe: tribeId }];
    for (const [x, y, terrain, resource] of layout) {
      const t = { x: x + 5, y: y + 5, terrain, resource, building: null, climate: tribeId, road: false, village: false, ruin: false, city: x === 0 && y === 0 ? 1 : null, owner: 1 };
      addTerrain(b, t, x, y, tribeId);
      const city = { id: 1, owner: 0, level: 3, capital: true, wall: false, parks: 0 };
      addDecor(b, { players }, t, x, y, { city: t.city ? city : null });
    }
    const group = new THREE.Group();
    const land = new THREE.Mesh(b.build(), vertexMaterial());
    group.add(land);
    const unit = new THREE.Mesh(unitGeometry(tribe.unit, tribeId), vertexMaterial());
    unit.position.set(0, 0, 1);
    unit.rotation.y = faceAngle(tribe.unit);
    group.add(unit);
    const url = shoot(group, { dist: 5.2, y: -0.1, w: 240, h: 180, dispose: false });
    land.geometry.dispose();
    return url;
  });
}
