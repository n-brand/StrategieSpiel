// Feuer in einer besetzten Stadt: Flammen, Funken, Rauch und warmer Schein am Boden – langsam und
// in Low-Poly-Optik, ganz ohne Dateien. Board blendet es ein, solange ein Gegner in der Stadt steht.

import * as THREE from 'three';

// Flamme als Drehkörper mit 5 Kanten (Tropfenform, Spitze oben, Fuß bei y = 0)
const flameGeo = new THREE.LatheGeometry(
  [
    [0, 0],
    [0.34, 0.08],
    [0.5, 0.26],
    [0.4, 0.5],
    [0.18, 0.78],
    [0, 1],
  ].map(([r, y]) => new THREE.Vector2(r, y)),
  5,
);
const emberGeo = new THREE.OctahedronGeometry(0.022, 0);
const smokeGeo = new THREE.IcosahedronGeometry(1, 0);
const glowGeo = new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2);

const OUTER = new THREE.MeshLambertMaterial({ color: '#ff7b1c', emissive: '#f25c05', emissiveIntensity: 0.65, flatShading: true });
const INNER = new THREE.MeshLambertMaterial({ color: '#ffe066', emissive: '#fcc419', emissiveIntensity: 0.85, flatShading: true });
const EMBER = new THREE.MeshBasicMaterial({ color: '#ffd8a8' });
const SMOKE = new THREE.MeshLambertMaterial({ color: '#5f636c', flatShading: true, transparent: true, opacity: 0.32, depthWrite: false });

// Weicher Lichtfleck (Farbverlauf, einmal gezeichnet)
let glowTexture = null;
function glowMap() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 150, 50, 0.95)');
  grad.addColorStop(0.45, 'rgba(255, 110, 25, 0.4)');
  grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

// Zum Betrachter hin (Kamera schaut fest von +x/+z): dorthin rückt der gelbe Kern, damit er vorn herausschaut
const TOWARD_CAMERA = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);
const WIND = { x: 0.05, z: -0.035 }; // Rauch und Funken treiben leicht ab

const FLAMES = 7;
const EMBERS = 12;
const PUFFS = 4;

function random(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
}

export class Fire {
  constructor(seed) {
    const rnd = random(seed + 7);
    this.rnd = rnd;
    this.group = new THREE.Group();
    this.level = 0; // 0 = aus, 1 = volle Flammen
    this.target = 1;
    this.t = rnd() * 10;

    // Flammen im Kreis um die Stadtmitte (dort steht der Eindringling)
    this.flames = [];
    for (let i = 0; i < FLAMES; i++) {
      const angle = (i / FLAMES) * Math.PI * 2 + (rnd() - 0.5) * 0.7;
      const dist = 0.27 + rnd() * 0.13;
      const f = {
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        h: 0.28 + rnd() * 0.2, // schlank und hoch
        w: 0.15 + rnd() * 0.07,
        speed: 2 + rnd() * 1.2, // langsames Flackern (Periode 2–3 s)
        phase: rnd() * Math.PI * 2,
        outer: new THREE.Mesh(flameGeo, OUTER),
        inner: new THREE.Mesh(flameGeo, INNER),
      };
      f.outer.position.set(f.x, 0, f.z);
      const r = f.w * 0.5;
      f.inner.position.set(f.x + TOWARD_CAMERA.x * r * 0.6, 0, f.z + TOWARD_CAMERA.z * r * 0.6);
      this.group.add(f.outer, f.inner);
      this.flames.push(f);
    }

    // Funken steigen aus den Flammen auf
    this.embers = Array.from({ length: EMBERS }, () => {
      const e = { mesh: new THREE.Mesh(emberGeo, EMBER), age: 0, life: 0 };
      this.group.add(e.mesh);
      this.spawnEmber(e, rnd() * 2);
      return e;
    });

    // Rauchwolken über der Stadt
    this.puffs = Array.from({ length: PUFFS }, (_, i) => {
      const p = { mesh: new THREE.Mesh(smokeGeo, SMOKE), age: 0, life: 3.6 };
      this.group.add(p.mesh);
      this.spawnPuff(p, (i / PUFFS) * p.life);
      return p;
    });

    // Warmer Schein auf dem Boden
    this.glowMat = new THREE.MeshBasicMaterial({ map: glowMap(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.glow = new THREE.Mesh(glowGeo, this.glowMat);
    this.glow.position.y = 0.012;
    this.glow.renderOrder = -1;
    this.group.add(this.glow);

    this.group.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    this.update(0);
  }

  spawnEmber(e, age = 0) {
    const f = this.flames[Math.floor(this.rnd() * this.flames.length)];
    e.x = f.x;
    e.z = f.z;
    e.y = 0.12 + this.rnd() * 0.1;
    e.rise = 0.22 + this.rnd() * 0.14;
    e.life = 1.6 + this.rnd() * 1.2;
    e.phase = this.rnd() * Math.PI * 2;
    e.age = age % e.life;
  }

  spawnPuff(p, age = 0) {
    p.x = (this.rnd() - 0.5) * 0.25;
    p.z = (this.rnd() - 0.5) * 0.25;
    p.size = 0.09 + this.rnd() * 0.05;
    p.spin = (this.rnd() - 0.5) * 0.6;
    p.age = age;
  }

  // Ein Bild weiter (dt in Sekunden). false = ganz erloschen, kann weg.
  update(dt) {
    this.t += dt;
    this.level += (this.target - this.level) * Math.min(1, dt * 1.5); // sanft auf- und abblenden
    const L = this.level;
    const t = this.t;

    for (const f of this.flames) {
      const k = 1 + 0.14 * Math.sin(t * f.speed + f.phase) + 0.06 * Math.sin(t * f.speed * 2.3 + f.phase * 1.7);
      const squash = 1.06 - 0.06 * k; // höher = schmaler
      f.outer.scale.set(f.w * L * squash, f.h * L * k, f.w * L * squash);
      f.outer.rotation.set(0.07 * Math.sin(t * f.speed * 0.75 + f.phase * 2), t * 0.25 + f.phase, 0.09 * Math.sin(t * f.speed * 0.6 + f.phase));
      const k2 = 1 + 0.18 * Math.sin(t * f.speed * 1.4 + f.phase + 1) + 0.05 * Math.sin(t * f.speed * 3.1 + f.phase);
      f.inner.scale.set(f.w * 0.6 * L, f.h * 0.6 * L * k2, f.w * 0.6 * L);
      f.inner.rotation.copy(f.outer.rotation);
    }

    for (const e of this.embers) {
      e.age += dt;
      if (e.age >= e.life) this.spawnEmber(e);
      const a = e.age / e.life;
      e.mesh.position.set(e.x + Math.sin(e.age * 2.2 + e.phase) * 0.04 + WIND.x * e.age, e.y + e.age * e.rise, e.z + Math.cos(e.age * 1.7 + e.phase) * 0.04 + WIND.z * e.age);
      e.mesh.scale.setScalar(L * (1 - a) * (0.7 + 0.3 * Math.sin(e.age * 9 + e.phase)));
      e.mesh.rotation.y = e.age * 3;
    }

    for (const p of this.puffs) {
      p.age += dt;
      if (p.age >= p.life) this.spawnPuff(p);
      const a = p.age / p.life;
      const grow = 0.35 + 0.65 * Math.min(1, a * 1.6); // wächst beim Aufsteigen …
      const fade = Math.min(1, (1 - a) / 0.35); // … und löst sich oben auf
      p.mesh.position.set(p.x + WIND.x * p.age * 1.5, 0.5 + a * 1.1, p.z + WIND.z * p.age * 1.5);
      p.mesh.scale.setScalar(p.size * grow * fade * L);
      p.mesh.rotation.set(p.age * p.spin, p.age * p.spin * 0.7, 0);
    }

    this.glowMat.opacity = L * (0.5 + 0.1 * Math.sin(t * 1.6));
    this.glow.scale.setScalar(0.92 + 0.06 * Math.sin(t * 1.1));
    return this.target > 0 || this.level > 0.02;
  }

  dispose() {
    this.glowMat.dispose();
  }
}
