// Kamera-Steuerung wie bei Polytopia: schräg von oben, verschieben, zoomen.
// Touch: ein Finger verschiebt (mit Schwung), zwei Finger zoomen. Maus: ziehen und Mausrad.
// Ein kurzer Tipp ohne Bewegung meldet sich über onTap(clientX, clientY).

import * as THREE from 'three';
import { requestRender, tween, easeOut } from './scene.js';

const TAP_MOVE = 10; // Pixel – mehr Bewegung ist kein Tippen mehr
const TAP_TIME = 450; // Millisekunden

export class CameraRig {
  constructor(camera, dom, { onTap } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.onTap = onTap;
    this.target = new THREE.Vector3();
    this.dist = 14;
    this.minDist = 5;
    this.maxDist = 34;
    this.yaw = Math.PI / 4;
    this.pitch = 0.93;
    this.bounds = { min: -8, max: 8 };
    this.pointers = new Map();
    this.velocity = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.listeners = new Set();
    this.bind();
    this.apply();
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  setBounds(size) {
    const half = size / 2;
    this.bounds = { min: -half, max: half };
    this.maxDist = Math.max(16, size * 2.2);
    this.dist = Math.min(this.dist, this.maxDist);
    this.apply();
  }

  apply() {
    const { min, max } = this.bounds;
    this.target.x = Math.max(min, Math.min(max, this.target.x));
    this.target.z = Math.max(min, Math.min(max, this.target.z));
    this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist));
    const h = Math.cos(this.pitch) * this.dist;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * h,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * h,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    for (const fn of this.listeners) fn();
    requestRender();
  }

  // Punkt auf dem Boden (y = 0) unter einer Bildschirmposition
  groundAt(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.plane, hit) ? hit : null;
  }

  rayAt(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster;
  }

  pan(dx, dz) {
    this.target.x += dx;
    this.target.z += dz;
    this.apply();
  }

  zoomBy(factor, clientX, clientY) {
    const before = clientX != null ? this.groundAt(clientX, clientY) : null;
    this.dist *= factor;
    this.apply();
    if (before) {
      const after = this.groundAt(clientX, clientY);
      if (after) this.pan(before.x - after.x, before.z - after.z);
    }
  }

  // Sanft zu einem Punkt schwenken
  focus(x, z, { animate = true, dist = null } = {}) {
    const from = this.target.clone();
    const fromDist = this.dist;
    const toDist = dist ?? this.dist;
    if (!animate) {
      this.target.set(x, 0, z);
      this.dist = toDist;
      this.apply();
      return Promise.resolve();
    }
    return tween(
      0.45,
      (k) => {
        this.target.set(from.x + (x - from.x) * k, 0, from.z + (z - from.z) * k);
        this.dist = fromDist + (toDist - fromDist) * k;
        this.apply();
      },
      easeOut,
    );
  }

  // Sichtbar? Sonst hinschwenken (für Aktionen der Computergegner)
  isOnScreen(x, z, margin = 0.15) {
    const v = new THREE.Vector3(x, 0, z).project(this.camera);
    return Math.abs(v.x) < 1 - margin && Math.abs(v.y) < 1 - margin;
  }

  bind() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, time: performance.now() });
      this.velocity.set(0, 0, 0);
      this.startGesture();
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      this.moveGesture();
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      const moved = Math.hypot(p.x - p.startX, p.y - p.startY);
      if (!this.multi && moved < TAP_MOVE && performance.now() - p.time < TAP_TIME && e.type === 'pointerup') {
        this.velocity.set(0, 0, 0);
        this.onTap?.(e.clientX, e.clientY);
      }
      if (this.pointers.size === 0) {
        this.multi = false;
        this.glide();
      } else this.startGesture();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY);
      },
      { passive: false },
    );
    // iOS: Zoom-Geste der Seite verhindern
    el.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  startGesture() {
    const pts = [...this.pointers.values()];
    if (pts.length === 1) {
      this.grab = this.groundAt(pts[0].x, pts[0].y);
      this.lastMove = { time: performance.now(), x: this.target.x, z: this.target.z };
    } else if (pts.length >= 2) {
      this.multi = true;
      const [a, b] = pts;
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.dist };
      this.grab = this.groundAt((a.x + b.x) / 2, (a.y + b.y) / 2);
    }
  }

  moveGesture() {
    const pts = [...this.pointers.values()];
    if (pts.length === 1 && this.grab) {
      const p = pts[0];
      if (Math.hypot(p.x - p.startX, p.y - p.startY) < TAP_MOVE && !this.dragging) return;
      this.dragging = true;
      const now = this.groundAt(p.x, p.y);
      if (!now) return;
      const before = { x: this.target.x, z: this.target.z };
      this.pan(this.grab.x - now.x, this.grab.z - now.z);
      const t = performance.now();
      const dt = Math.max(1, t - this.lastMove.time);
      this.velocity.set((this.target.x - before.x) / dt, 0, (this.target.z - before.z) / dt);
      this.lastMove.time = t;
    } else if (pts.length >= 2 && this.pinch) {
      const [a, b] = pts;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.dist = this.pinch.dist * (this.pinch.d / Math.max(20, d));
      this.apply();
      const mid = this.groundAt((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (mid && this.grab) this.pan(this.grab.x - mid.x, this.grab.z - mid.z);
    }
  }

  // Schwung nach dem Loslassen
  glide() {
    const wasDragging = this.dragging;
    this.dragging = false;
    if (!wasDragging || this.velocity.length() < 0.002) return;
    const v = this.velocity.clone().multiplyScalar(16);
    const start = this.target.clone();
    tween(
      0.5,
      (k) => {
        this.target.set(start.x + v.x * k * 6, 0, start.z + v.z * k * 6);
        this.apply();
      },
      easeOut,
    );
    this.velocity.set(0, 0, 0);
  }
}
