// Töne und Musik direkt aus dem Browser (Web Audio) – keine Audiodateien.
// iOS/Safari spielen erst nach einer Berührung: unlock() beim ersten Tippen aufrufen.
// Effekte: play('select' | 'step' | 'attack' | …); Musik: ruhige, sich selbst erzeugende Klänge.

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noise = null;
let soundOn = true;
let musicOn = true;
let musicTimer = 0;
let nextNote = 0;
let step = 0;
let mood = 0; // Stamm des Spielers → eigene Tonleiter

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function create() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  // iOS: Stummschalter respektieren und Musik anderer Apps nicht unterbrechen
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
  } catch {
    // ältere Browser
  }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = soundOn ? 0.8 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

// Beim ersten Tippen/Klicken aufrufen (Browser erlauben Ton erst nach einer Nutzeraktion)
export function unlock() {
  if (!ctx && !create()) return;
  if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {});
  if (musicOn) startMusic();
}

export function setSound(on) {
  soundOn = on;
  if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.05);
}

export function setMusic(on) {
  musicOn = on;
  if (!ctx) return;
  if (on) startMusic();
  else stopMusic();
}

export function setMood(index) {
  const n = SCALES.length;
  mood = Number.isInteger(index) ? ((index % n) + n) % n : 0;
}

// ---------- Bausteine ----------

function env(gain, t, peak, attack, decay) {
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(t, freq, { type = 'sine', peak = 0.3, attack = 0.005, decay = 0.2, to = null, bus = sfxBus, cutoff = null } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  const g = ctx.createGain();
  env(g, t, peak, attack, decay);
  let out = o;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.connect(f);
    out = f;
  }
  out.connect(g).connect(bus);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function hiss(t, { type = 'bandpass', freq = 1200, q = 1, peak = 0.3, attack = 0.005, decay = 0.15, to = null } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, peak, attack, decay);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
  src.stop(t + attack + decay + 0.05);
}

// ---------- Effekte ----------

const SOUNDS = {
  select: (t) => tone(t, 880, { type: 'triangle', peak: 0.12, decay: 0.08, to: 1100 }),
  deselect: (t) => tone(t, 660, { type: 'triangle', peak: 0.08, decay: 0.06, to: 520 }),
  step: (t) => hiss(t, { type: 'lowpass', freq: 500, peak: 0.12, decay: 0.07 }),
  splash: (t) => {
    hiss(t, { freq: 900, q: 0.6, peak: 0.35, decay: 0.35, to: 300 });
    tone(t, 300, { peak: 0.12, decay: 0.2, to: 120 });
  },
  land: (t) => hiss(t, { type: 'lowpass', freq: 700, peak: 0.25, decay: 0.15 }),
  attack: (t) => {
    hiss(t, { freq: 2200, q: 0.8, peak: 0.25, decay: 0.08 });
    tone(t, 160, { type: 'square', peak: 0.18, decay: 0.12, to: 70, cutoff: 900 });
  },
  arrow: (t) => {
    tone(t, 1300, { type: 'triangle', peak: 0.1, decay: 0.18, to: 500 });
    hiss(t + 0.02, { type: 'highpass', freq: 3000, peak: 0.08, decay: 0.2 });
  },
  hit: (t) => tone(t, 220, { type: 'square', peak: 0.16, decay: 0.1, to: 110, cutoff: 1200 }),
  death: (t) => {
    tone(t, 330, { type: 'sawtooth', peak: 0.14, decay: 0.45, to: 70, cutoff: 1400 });
    hiss(t, { type: 'lowpass', freq: 600, peak: 0.12, decay: 0.3 });
  },
  spawn: (t) => [523, 659, 784].forEach((f, i) => tone(t + i * 0.06, f, { type: 'triangle', peak: 0.12, decay: 0.14 })),
  capture: (t) => [392, 523, 659, 784].forEach((f, i) => tone(t + i * 0.09, f, { type: 'triangle', peak: 0.18, decay: 0.3 })),
  levelup: (t) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.07, f, { type: 'sine', peak: 0.16, decay: 0.35 })),
  tech: (t) => [880, 1175, 1568].forEach((f, i) => tone(t + i * 0.05, f, { type: 'sine', peak: 0.12, decay: 0.4 })),
  coin: (t) => {
    tone(t, 1319, { type: 'square', peak: 0.07, decay: 0.08, cutoff: 3000 });
    tone(t + 0.07, 1760, { type: 'square', peak: 0.07, decay: 0.2, cutoff: 3000 });
  },
  build: (t) => {
    for (let i = 0; i < 2; i++) {
      hiss(t + i * 0.11, { freq: 700, q: 3, peak: 0.25, decay: 0.06 });
      tone(t + i * 0.11, 180, { type: 'triangle', peak: 0.12, decay: 0.06 });
    }
  },
  upgrade: (t) => [392, 494, 587, 784].forEach((f, i) => tone(t + i * 0.06, f, { type: 'sawtooth', peak: 0.08, decay: 0.2, cutoff: 2000 })),
  heal: (t) => [660, 880].forEach((f, i) => tone(t + i * 0.08, f, { type: 'sine', peak: 0.12, decay: 0.3 })),
  reveal: (t) => hiss(t, { freq: 2600, q: 0.5, peak: 0.05, attack: 0.08, decay: 0.3, to: 1200 }),
  turn: (t) => [587, 784].forEach((f, i) => tone(t + i * 0.12, f, { type: 'sine', peak: 0.14, decay: 0.5 })),
  error: (t) => tone(t, 180, { type: 'square', peak: 0.08, decay: 0.15, cutoff: 900 }),
  victory: (t) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(t + i * 0.14, f, { type: 'triangle', peak: 0.2, decay: 0.5 })),
  defeat: (t) => [392, 349, 311, 262].forEach((f, i) => tone(t + i * 0.22, f, { type: 'triangle', peak: 0.18, decay: 0.6 })),
};

const last = new Map();

// Effekt abspielen (gleiche Effekte kurz hintereinander werden zusammengefasst)
export function play(name) {
  if (!ctx || !soundOn || ctx.state !== 'running' || !SOUNDS[name]) return;
  const now = ctx.currentTime;
  if (now - (last.get(name) || 0) < 0.05) return;
  last.set(name, now);
  SOUNDS[name](now + 0.01);
}

// ---------- Musik ----------
// Langsame Akkorde (weiche Flächen) und ab und zu ein gezupfter Ton aus einer Fünftonleiter

const SCALES = [
  [57, 60, 62, 64, 67, 69, 72], // a-Moll pentatonisch (Nordlinge)
  [55, 58, 60, 62, 65, 67, 70], // g-Moll (Steinvolk)
  [60, 62, 64, 67, 69, 72, 74], // C-Dur pentatonisch (Ebenenreich)
  [62, 63, 66, 67, 69, 70, 74], // Wüste (Sandreiter)
];
const CHORDS = [
  [0, 2, 4],
  [1, 3, 5],
  [2, 4, 6],
  [0, 3, 5],
];
const BEAT = 0.75;

function scheduleMusic() {
  if (!ctx || !musicOn) return;
  const scale = SCALES[mood];
  while (nextNote < ctx.currentTime + 1.2) {
    const t = Math.max(nextNote, ctx.currentTime + 0.05);
    const bar = Math.floor(step / 8) % CHORDS.length;
    if (step % 8 === 0) {
      for (const deg of CHORDS[bar]) tone(t, hz(scale[deg] - 12), { type: 'sine', peak: 0.05, attack: 1.2, decay: 4.5, bus: musicBus });
      tone(t, hz(scale[CHORDS[bar][0]] - 24), { type: 'triangle', peak: 0.06, attack: 0.4, decay: 5, bus: musicBus });
    }
    if (Math.random() < 0.38) {
      const deg = Math.floor(Math.random() * scale.length);
      tone(t, hz(scale[deg]), { type: 'triangle', peak: 0.045, attack: 0.01, decay: 1.4, bus: musicBus, cutoff: 2500 });
    }
    nextNote = t + BEAT;
    step++;
  }
}

function startMusic() {
  if (!ctx || musicTimer) return;
  musicBus.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
  nextNote = ctx.currentTime + 0.2;
  scheduleMusic();
  musicTimer = setInterval(scheduleMusic, 300);
}

function stopMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = 0;
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}

// Tab im Hintergrund: Musik anhalten, danach weiter
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend?.().catch(() => {});
  else ctx.resume?.().catch(() => {});
});
