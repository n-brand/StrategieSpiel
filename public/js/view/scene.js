// 3D-Grundgerüst: Renderer, Szene, Licht, Kamera und eine kleine Animations-Schleife.
// Gezeichnet wird nur, wenn sich etwas ändert (Kamera, Animation) – das schont den Akku auf dem Handy.

import * as THREE from 'three';

const tweens = [];
let needsRender = true;
let lastFrame = 0;

export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const linear = (t) => t;

// Animation über `duration` Sekunden; fn(k) bekommt 0..1. Gibt ein Promise zurück, das am Ende auflöst.
// Sicherung: Pausiert der Browser die Zeichenschleife (Tab im Hintergrund, App gewechselt), endet die
// Animation trotzdem nach ihrer Dauer – das Spiel bleibt nie an einer Animation hängen.
export function tween(duration, fn, ease = easeInOut) {
  if (duration <= 0) {
    fn(1);
    requestRender();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const tw = { t: 0, duration, fn, ease, resolve };
    tw.timer = setTimeout(() => finishTween(tw), duration * 1000 + 200);
    tweens.push(tw);
  });
}

function finishTween(tw) {
  const i = tweens.indexOf(tw);
  if (i < 0) return;
  tweens.splice(i, 1);
  clearTimeout(tw.timer);
  tw.fn(1);
  needsRender = true;
  tw.resolve();
}

export const wait = (seconds) => tween(seconds, () => {});
export function requestRender() {
  needsRender = true;
}

export function createScene(canvas, { shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b7fb8');
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  const hemi = new THREE.HemisphereLight('#ffffff', '#5d6b7a', 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dd', 1.9);
  sun.position.set(-6, 14, 9);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // Schattenbereich an die Kartengröße anpassen
  const fitShadow = (size) => {
    const half = size / 2 + 1.5;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 50 });
    sun.shadow.camera.updateProjectionMatrix();
  };

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const frameHooks = new Set();
  let raf = 0;
  const loop = (time) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (time - lastFrame) / 1000 || 0);
    lastFrame = time;
    for (const hook of frameHooks) if (hook(dt)) needsRender = true;
    if (tweens.length) {
      needsRender = true;
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.duration);
        if (k >= 1) finishTween(tw);
        else tw.fn(tw.ease(k));
      }
    }
    if (needsRender) {
      needsRender = false;
      renderer.render(scene, camera);
      for (const hook of afterRender) hook();
    }
  };
  const afterRender = new Set();
  raf = requestAnimationFrame(loop);

  return {
    THREE,
    renderer,
    scene,
    camera,
    sun,
    fitShadow,
    onFrame: (fn) => frameHooks.add(fn),
    afterRender: (fn) => afterRender.add(fn),
    setShadows(on) {
      renderer.shadowMap.enabled = on;
      sun.castShadow = on;
      scene.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
      requestRender();
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
    },
  };
}
