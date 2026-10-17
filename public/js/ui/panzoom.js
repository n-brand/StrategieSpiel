// Verschieben und Zoomen für flache Ansichten (Forschungsbaum): Maus ziehen, Mausrad, Doppelklick,
// ein Finger ziehen, zwei Finger zoomen. Ansicht = { x, y, s }: Bildschirm = Welt · s + (x, y).
// Die Rechenfunktionen oben kommen ohne DOM aus (tests/techtree.test.mjs).

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Zoomen um einen Bildschirmpunkt: der Weltpunkt darunter bleibt stehen
export function zoomAround(view, factor, px, py, min, max) {
  const s = clamp(view.s * factor, min, max);
  const k = s / view.s;
  return { s, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

// Ganz einpassen und mittig stellen
export function fitView(content, viewport, pad = 0) {
  const s = Math.min((viewport.w - 2 * pad) / content.w, (viewport.h - 2 * pad) / content.h);
  return { s, x: (viewport.w - content.w * s) / 2, y: (viewport.h - content.h * s) / 2 };
}

// Nicht verlieren: ein Teil des Inhalts bleibt immer im Bild
export function clampView(view, content, viewport, keep = 0.35) {
  const cw = content.w * view.s;
  const ch = content.h * view.s;
  const kx = Math.min(cw, viewport.w) * keep;
  const ky = Math.min(ch, viewport.h) * keep;
  return { s: view.s, x: clamp(view.x, kx - cw, viewport.w - kx), y: clamp(view.y, ky - ch, viewport.h - ky) };
}

const TAP_MOVE = 8; // px – weniger Bewegung gilt als Tippen
const TAP_TIME = 450; // ms

export class PanZoom {
  // el: Fläche, die Zeiger-Ereignisse bekommt; content: { w, h } in Welt-Einheiten
  constructor(el, { content, min = 0.2, max = 3, onChange = null, onTap = null }) {
    this.el = el;
    this.content = content;
    this.min = min;
    this.max = max;
    this.onChange = onChange;
    this.onTap = onTap;
    this.view = { x: 0, y: 0, s: 1 };
    this.pointers = new Map();
    this.multi = false;
    this.dragging = false;
    this.bind();
  }

  get size() {
    return { w: this.el.clientWidth, h: this.el.clientHeight };
  }

  set(view) {
    this.view = clampView(view, this.content, this.size);
    this.onChange?.(this.view);
  }

  zoomBy(factor, px = this.size.w / 2, py = this.size.h / 2) {
    this.set(zoomAround(this.view, factor, px, py, this.min, this.max));
  }

  pan(dx, dy) {
    this.set({ ...this.view, x: this.view.x + dx, y: this.view.y + dy });
  }

  // Weltpunkt an eine Bildschirmstelle schieben (z. B. gewählte Technik über die Detailkarte)
  bring(wx, wy, sx, sy) {
    this.set({ ...this.view, x: sx - wx * this.view.s, y: sy - wy * this.view.s });
  }

  local(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  bind() {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Zeiger schon weg – Ziehen klappt trotzdem, solange er über der Fläche bleibt
      }
      const p = this.local(e);
      this.pointers.set(e.pointerId, { ...p, startX: p.x, startY: p.y, time: performance.now(), target: e.target });
      if (this.pointers.size > 1) this.multi = true;
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const before = [...this.pointers.values()].map((q) => ({ x: q.x, y: q.y }));
      Object.assign(p, this.local(e));
      const pts = [...this.pointers.values()];
      if (pts.length === 1) {
        if (!this.dragging && Math.hypot(p.x - p.startX, p.y - p.startY) < TAP_MOVE) return;
        this.dragging = true;
        this.pan(p.x - before[0].x, p.y - before[0].y);
      } else {
        const [a0, b0] = before;
        const [a, b] = pts;
        const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const moved = { ...this.view, x: this.view.x + mx - (a0.x + b0.x) / 2, y: this.view.y + my - (a0.y + b0.y) / 2 };
        this.set(zoomAround(moved, d0 > 0 ? d / d0 : 1, mx, my, this.min, this.max));
      }
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      const tap = e.type === 'pointerup' && !this.multi && !this.dragging && performance.now() - p.time < TAP_TIME;
      if (this.pointers.size === 0) {
        this.multi = false;
        this.dragging = false;
      }
      if (tap) this.onTap?.(p.target);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = this.local(e);
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this.zoomBy(Math.exp(-dy * 0.0015), p.x, p.y);
      },
      { passive: false },
    );
    el.addEventListener('dblclick', (e) => {
      const p = this.local(e);
      this.zoomBy(1.6, p.x, p.y);
    });
    // iOS: Zoom-Geste der Seite verhindern
    el.addEventListener('gesturestart', (e) => e.preventDefault());
  }
}
