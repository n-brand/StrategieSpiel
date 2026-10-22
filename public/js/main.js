// StrategieSpiel – Steuerung: Startbildschirm, Spielbildschirm, Auswahl und Aktionen des Spielers,
// Züge der Computergegner (mit Animation), Forschung, Belohnungen, Spielende und Speichern.

import * as E from './game/engine.js';
import { playTurn } from './game/ai.js';
import {
  TRIBES, tribeById, UNITS, TECHS, ACTIONS, MAP_SIZES, DIFFICULTIES, TURN_LIMIT, rewardsFor, popToGrow,
  unitCap, TERRAIN_NAMES, RESOURCE_NAMES, BUILDING_NAMES, SKILL_NAMES, hasSkill,
} from './game/rules.js';
import { MAP_TYPES } from './game/mapgen.js';
import { Board } from './view/board.js';
import { unitThumb, tileThumb, cityThumb, tribeThumb } from './view/thumbs.js';
import { esc, fmt, ICONS, starAmount, toast, openModal, modalOpen } from './ui/ui.js';
import { openTechTree as showTechTree } from './ui/techtree.js';
import * as audio from './audio.js';
import * as pwa from './pwa.js';

const SAVE_KEY = 'kleine-reiche-spiel';
const SETTINGS_KEY = 'kleine-reiche-einstellungen';
const HUMAN = 0;
const app = document.getElementById('app');

const DEFAULTS = { tribe: 'eben', size: 'normal', mapType: 'pangaea', opponents: 2, difficulty: 'normal', mode: 'perfection', shadows: true, speed: 2.2, sound: true, music: true, confirmEnd: false };
let settings = { ...DEFAULTS, ...read(SETTINGS_KEY) };
audio.setSound(settings.sound);
audio.setMusic(settings.music);
const tribeMood = (id) => Math.max(0, TRIBES.findIndex((t) => t.id === id));
audio.setMood(tribeMood(settings.tribe));

let game = null;
let board = null;
let selection = null; // { kind: 'unit', id } | { kind: 'tile', x, y }
let busy = false;
let dom = {};

// ---------- Speicher ----------

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // Speicher voll oder gesperrt – Spiel läuft trotzdem weiter
  }
}

const saveSettings = () => write(SETTINGS_KEY, settings);

function saveGame() {
  if (!game) return;
  if (game.over) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignorieren
    }
    return;
  }
  write(SAVE_KEY, E.serialize(game));
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? E.deserialize(raw) : null;
  } catch {
    return null;
  }
}

// ---------- Theme ----------

function setTheme(light) {
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  write('kleine-reiche-theme', light ? 'light' : 'dark');
}

const toggleTheme = () => setTheme(document.documentElement.dataset.theme !== 'light');

const themeIcon = () => (document.documentElement.dataset.theme === 'light' ? ICONS.moon : ICONS.sun);
const soundIcon = () => (settings.sound || settings.music ? ICONS.speaker : ICONS.mute);

// ---------- Startbildschirm ----------

function renderStart() {
  board?.dispose();
  board = null;
  game = null;
  selection = null;
  const saved = loadSavedGame();
  const maxOpp = MAP_SIZES[settings.size].maxTribes - 1;
  settings.opponents = Math.min(settings.opponents, maxOpp);
  const seg = (name, options, value) =>
    `<div class="seg" role="group" data-option="${name}">${options
      .map(([v, label]) => `<button type="button" data-value="${v}" class="${String(v) === String(value) ? 'is-active' : ''}">${esc(label)}</button>`)
      .join('')}</div>`;
  app.innerHTML = `
    <section class="start">
      <div class="start-top">
        <span class="logo">Strategie<span>Spiel</span></span>
        <span class="start-tools">
          <button type="button" class="icon-btn" data-sound aria-label="Ton an/aus">${soundIcon()}</button>
          <button type="button" class="icon-btn" data-theme aria-label="Hell/Dunkel">${themeIcon()}</button>
        </span>
      </div>
      <div class="start-hero">
        <h1>Erobere die kleine Welt.</h1>
        <p>Erkunde, gründe Städte, forsche und siege – in ${TURN_LIMIT} Runden oder bis nur noch du übrig bist.</p>
      </div>
      ${
        saved
          ? `<button type="button" class="continue" data-continue>
              <img src="${tribeThumb(saved.players[HUMAN].tribe)}" alt="">
              <span><b>Weiterspielen</b><small>${esc(tribeById(saved.players[HUMAN].tribe).name)} · Runde ${saved.turn}${saved.mode === 'perfection' ? `/${saved.turnLimit}` : ''}</small></span>
              <span class="btn btn--primary btn--sm">Los</span>
            </button>`
          : ''
      }
      <div class="install" data-install hidden></div>
      <h2 class="section-title">Wähle deinen Stamm</h2>
      <div class="tribes">
        ${TRIBES.map(
          (t) => `
          <button type="button" class="tribe ${t.id === settings.tribe ? 'is-selected' : ''}" data-tribe="${t.id}" style="--tribe:${t.color};--tribe-dark:${t.dark}">
            <img class="tribe-art" src="${tribeThumb(t.id)}" alt="">
            <span class="tribe-foot"><b>${esc(t.name)}</b><small>${esc(t.text)}</small></span>
            <span class="tribe-check">${ICONS.check}</span>
          </button>`,
        ).join('')}
      </div>
      <h2 class="section-title">Spiel einstellen</h2>
      <div class="options">
        <div><span class="option-label">Kartengröße</span>${seg('size', Object.entries(MAP_SIZES).map(([k, v]) => [k, `${v.name} ${v.size}×${v.size}`]), settings.size)}</div>
        <div><span class="option-label">Landschaft</span>${seg('mapType', Object.entries(MAP_TYPES).map(([k, v]) => [k, v.name]), settings.mapType)}
          <p class="option-note">${{ pangaea: 'Ein großer Kontinent – alle über Land erreichbar.', drylands: 'Nur Land, gar kein Wasser – alle über Land erreichbar.', continents: 'Mehrere Kontinente – für Nachbarn braucht es Schiffe.', archipelago: 'Viele kleine Inseln – ohne Häfen und Boote geht nichts.' }[settings.mapType] || ''}</p></div>
        <div><span class="option-label">Gegner</span>${seg('opponents', Array.from({ length: maxOpp }, (_, i) => [i + 1, String(i + 1)]), settings.opponents)}</div>
        <div><span class="option-label">Schwierigkeit</span>${seg('difficulty', Object.entries(DIFFICULTIES).map(([k, v]) => [k, v.name]), settings.difficulty)}</div>
        <div><span class="option-label">Spielart</span>${seg('mode', [['perfection', `${TURN_LIMIT} Runden`], ['domination', 'Eroberung']], settings.mode)}
          <p class="option-note">${settings.mode === 'perfection' ? `Nach ${TURN_LIMIT} Runden gewinnt die höchste Punktzahl.` : 'Gewonnen hat, wer als Letzter übrig bleibt.'}</p></div>
      </div>
      <p class="credit">Ein Spiel von <b>Nicolas Brand</b> · 2026</p>
      <div class="start-go"><button type="button" class="btn btn--primary" data-start>Spiel starten</button></div>
    </section>`;

  app.querySelector('[data-theme]').addEventListener('click', (e) => {
    toggleTheme();
    e.currentTarget.innerHTML = themeIcon();
  });
  renderInstall();
  app.querySelector('[data-sound]').addEventListener('click', (e) => {
    const on = !(settings.sound || settings.music);
    settings.sound = settings.music = on;
    saveSettings();
    audio.setSound(on);
    audio.setMusic(on);
    audio.play('select');
    e.currentTarget.innerHTML = soundIcon();
  });
  app.querySelector('[data-continue]')?.addEventListener('click', () => startGame(saved));
  app.querySelectorAll('[data-tribe]').forEach((el) =>
    el.addEventListener('click', () => {
      settings.tribe = el.dataset.tribe;
      saveSettings();
      audio.setMood(tribeMood(settings.tribe));
      audio.play('select');
      app.querySelectorAll('[data-tribe]').forEach((o) => o.classList.toggle('is-selected', o === el));
    }),
  );
  app.querySelectorAll('[data-option]').forEach((group) =>
    group.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const key = group.dataset.option;
      settings[key] = key === 'opponents' ? Number(b.dataset.value) : b.dataset.value;
      saveSettings();
      renderStart();
    }),
  );
  app.querySelector('[data-start]').addEventListener('click', () => {
    if (saved) {
      const { el, close } = openModal(`
        <h2>Neues Spiel starten?</h2>
        <p class="modal-text">Dein laufendes Spiel wird dabei überschrieben.</p>
        <div class="modal-actions"><button type="button" class="btn" data-close>Abbrechen</button><button type="button" class="btn btn--primary" data-yes>Neues Spiel</button></div>`);
      el.querySelector('[data-yes]').addEventListener('click', () => {
        close();
        newGame();
      });
    } else newGame();
  });
}

// Hinweis „Als App installieren“ (nur im Browser, nicht in der installierten App)
function renderInstall() {
  const box = app.querySelector('[data-install]');
  if (!box) return;
  const offer = pwa.installOffer();
  box.hidden = !offer;
  if (!offer) return;
  const text =
    offer === 'ios'
      ? `Tippe auf ${ICONS.share}&nbsp;<b>Teilen</b> und dann auf „Zum Home-Bildschirm“. So startet das Spiel im Vollbild – auch offline.`
      : 'Eigenes Symbol auf dem Home-Bildschirm oder Desktop, Vollbild und auch offline spielbar.';
  box.innerHTML = `
    <img src="icons/icon-192.png" alt="">
    <span class="install-text"><b>Als App installieren</b><small>${text}</small>
      ${offer === 'prompt' ? '<button type="button" class="btn btn--primary btn--sm" data-install-go>Installieren</button>' : ''}</span>
    <button type="button" class="install-close" data-install-close aria-label="Hinweis ausblenden">${ICONS.close}</button>`;
  box.querySelector('[data-install-go]')?.addEventListener('click', () => pwa.install());
  box.querySelector('[data-install-close]').addEventListener('click', () => pwa.dismissInstall());
}

function newGame() {
  const others = TRIBES.map((t) => t.id).filter((id) => id !== settings.tribe);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const tribes = [settings.tribe, ...others.slice(0, settings.opponents)];
  const s = E.newGame({ tribes, size: MAP_SIZES[settings.size].size, mode: settings.mode, difficulty: settings.difficulty, mapType: settings.mapType });
  startGame(s);
}

// ---------- Spielbildschirm ----------

function startGame(s) {
  game = s;
  selection = null;
  busy = false;
  const me = tribeById(game.players[HUMAN].tribe);
  app.innerHTML = `
    <section class="game" id="game" style="--c:${me.color}">
      <header class="hud">
        <button type="button" class="icon-btn" data-menu aria-label="Menü">${ICONS.menu}</button>
        <div class="hud-box hud-stars" data-stars></div>
        <div class="hud-box" data-turn></div>
        <div class="hud-spacer"></div>
        <button type="button" class="hud-box hud-score" data-score aria-label="Statistik"></button>
      </header>
      <div class="sheet" data-sheet hidden></div>
      <div class="ai-banner" data-ai hidden></div>
      <footer class="dock">
        <button type="button" class="btn" data-tech>${ICONS.flask}<span>Forschung</span></button>
        <button type="button" class="btn btn--primary dock-end" data-end>Runde beenden</button>
      </footer>
    </section>`;
  const root = app.querySelector('#game');
  dom = {
    root,
    stars: root.querySelector('[data-stars]'),
    turn: root.querySelector('[data-turn]'),
    score: root.querySelector('[data-score]'),
    sheet: root.querySelector('[data-sheet]'),
    ai: root.querySelector('[data-ai]'),
    end: root.querySelector('[data-end]'),
  };
  // Am PC: Mausrad über einer Knopfreihe scrollt sie waagerecht
  dom.sheet.addEventListener(
    'wheel',
    (e) => {
      const row = e.target.closest('.actions');
      if (!row || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || row.scrollWidth <= row.clientWidth) return;
      row.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );
  board = new Board(root, { onTap, onCapture, shadows: settings.shadows });
  board.onSound = audio.play;
  board.load(game, HUMAN);
  audio.setMood(tribeMood(game.players[HUMAN].tribe));
  const capital = E.playerCities(game, HUMAN).find((c) => c.capital) || E.playerCities(game, HUMAN)[0];
  const unit = E.playerUnits(game, HUMAN)[0];
  const focus = capital || unit;
  if (focus) board.focusTile(focus.x, focus.y, { animate: false, dist: Math.min(13, game.size * 0.95) });

  root.querySelector('[data-menu]').addEventListener('click', openMenu);
  root.querySelector('[data-tech]').addEventListener('click', openTechTree);
  dom.score.addEventListener('click', () => !modalOpen() && openStats());
  dom.end.addEventListener('click', requestEndTurn);
  updateHud();
  saveGame();
  // Laufendes Spiel: falls ein Computer am Zug war (Speichern mitten im Gegnerzug), weiterspielen
  if (!game.players[game.current].human && !game.over) runBots();
  else if (game.over) showGameOver();
  else afterHumanAction();
  if (game.turn === 1 && game.current === HUMAN) {
    toast({ title: `Willkommen, ${me.name}!`, text: 'Tippe auf deine Einheit, um sie zu bewegen.', icon: ICONS.flag, duration: 4500 });
  }
}

const isHumanTurn = () => game && !game.over && game.current === HUMAN;

function updateHud() {
  if (!game || !dom.stars) return;
  const p = game.players[HUMAN];
  dom.stars.innerHTML = `${ICONS.star}${fmt(p.stars)} <small>+${E.income(game, HUMAN)}</small>`;
  const perfection = game.mode === 'perfection';
  dom.turn.innerHTML = `<span class="hud-turn-label">Runde&nbsp;</span>${perfection ? Math.min(game.turn, game.turnLimit) : game.turn}${perfection ? `<small>/${game.turnLimit}</small>` : ''}`;
  dom.score.innerHTML = `${ICONS.trophy}${fmt(E.scoreOf(game, HUMAN).total)} <small>Pkt.</small>`;
  const idle = E.playerUnits(game, HUMAN).some((u) => E.isIdle(game, u));
  dom.end.classList.toggle('is-ready', isHumanTurn() && !idle);
  dom.end.disabled = !isHumanTurn() || busy;
}

// ---------- Auswahl ----------

const selectedUnit = () => (selection?.kind === 'unit' ? E.unitById(game, selection.id) : null);

function select(sel) {
  selection = sel;
  if (sel?.kind === 'unit' && !E.unitById(game, sel.id)) selection = null;
  refreshSelection();
}

function refreshSelection() {
  if (!board) return;
  const u = selectedUnit();
  if (u) {
    const mine = u.owner === HUMAN && isHumanTurn();
    board.setHighlights({
      select: u,
      moves: mine ? E.moveTargets(game, u) : [],
      attacks: mine ? E.attackTargets(game, u) : [],
      converts: mine ? E.convertTargets(game, u) : [],
    });
  } else if (selection?.kind === 'tile') {
    board.setHighlights({ select: selection });
  } else {
    board.setHighlights({});
  }
  renderSheet();
  board.syncUnits();
}

// Anweisung in der Auswahl-Karte: nur nennen, was gerade wirklich geht – sonst sagen, warum nichts geht
const DOT_MOVE = '<i class="mark mark--move"></i>';
const DOT_ATTACK = '<i class="mark mark--attack"></i>';
function unitHint(u) {
  const moves = E.canMove(u) && E.moveTargets(game, u).length > 0;
  const attacks = E.canAttack(u) && E.attackTargets(game, u).length > 0;
  if (moves && attacks) return `${DOT_MOVE} ziehen · ${DOT_ATTACK} angreifen`;
  if (moves) return `Tippe auf ${DOT_MOVE}, um zu ziehen`;
  if (attacks) return `Tippe auf ${DOT_ATTACK}, um anzugreifen`;
  if (!E.isIdle(game, u)) return 'Schon gezogen – nächste Runde geht es weiter';
  if (E.canAct(u)) return 'Kein freies Feld in Reichweite';
  return '';
}

function onTap(tile) {
  if (!game || busy || modalOpen()) return;
  if (!tile || !E.isExplored(game, HUMAN, tile.x, tile.y)) {
    if (selection) audio.play('deselect');
    select(null);
    return;
  }
  const u = selectedUnit();
  const there = E.unitAt(game, tile.x, tile.y);
  if (u && u.owner === HUMAN && isHumanTurn()) {
    if (there && there.owner !== HUMAN) {
      if (E.attackTargets(game, u).includes(there)) return act(() => E.attack(game, u.id, there.id), u.id);
      if (E.convertTargets(game, u).includes(there)) return act(() => E.convert(game, u.id, there.id), u.id);
    }
    if (!there && E.moveTargets(game, u).some((t) => t.x === tile.x && t.y === tile.y)) return act(() => E.move(game, u.id, tile.x, tile.y), u.id);
  }
  if (there) {
    // Zweites Tippen auf dieselbe Einheit wählt die Kachel darunter (z. B. die Stadt)
    if (selection?.kind === 'unit' && selection.id === there.id) select({ kind: 'tile', x: tile.x, y: tile.y });
    else select({ kind: 'unit', id: there.id });
  } else select({ kind: 'tile', x: tile.x, y: tile.y });
  audio.play('select');
}

// Knopf „Erobern“/„Einnehmen“ über einer Einheit: direkt einnehmen, ohne sie erst anzutippen
function onCapture(unitId) {
  if (!game || busy || modalOpen() || !isHumanTurn()) return;
  const u = E.unitById(game, unitId);
  if (!u || u.owner !== HUMAN || !E.captureTarget(game, u)) return;
  act(() => E.capture(game, unitId));
}

// Spielzug ausführen, animieren, danach Oberfläche auffrischen
async function act(fn, keepUnit = null) {
  if (busy) return;
  busy = true;
  board.setHighlights({});
  const events = fn();
  await board.play(events, { speed: 1 });
  busy = false;
  handleEvents(events);
  if (keepUnit && E.unitById(game, keepUnit)) selection = { kind: 'unit', id: keepUnit };
  else if (selection?.kind === 'unit' && !E.unitById(game, selection.id)) selection = null;
  refreshSelection();
  afterHumanAction();
}

const TECH_TOAST = (tech) => ({ title: `Neue Technik: ${TECHS[tech].name}`, text: TECHS[tech].text, icon: ICONS.flask });

// Meldungen zu Ereignissen des Spielers
function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === 'tech' && ev.player === HUMAN) {
      toast(TECH_TOAST(ev.tech));
      audio.play('tech');
    }
    if (ev.type === 'capture' && ev.by === HUMAN) {
      const c = E.cityById(game, ev.city);
      toast({ title: ev.village ? `${c.name} gegründet` : `${c.name} erobert`, icon: ICONS.flag, kind: 'good' });
    }
    if (ev.type === 'ruin' && ev.player === HUMAN) {
      const text = { stars: '+10 Sterne', tech: `Neue Technik: ${ev.detail}`, explorer: 'Ein Kundschafter erkundet die Gegend', population: `+3 Einwohner für ${ev.detail}`, veteran: 'Ein erfahrener Schwertkämpfer schließt sich an' }[ev.reward];
      toast({ title: 'Ruine erkundet', text, icon: ICONS.ruin });
    }
  }
}

function afterHumanAction() {
  updateHud();
  saveGame();
  if (game.over) return showGameOver();
  const city = E.playerCities(game, HUMAN).find((c) => c.pending.length);
  if (city && isHumanTurn()) chooseRewardModal(city);
}

// ---------- Auswahl-Karte ----------

const infoBtn = `<button type="button" class="sheet-info" data-sheet-info aria-label="Details">${ICONS.info}</button>`;
const closeBtn = `<button type="button" class="sheet-close" data-sheet-close aria-label="Schließen">${ICONS.close}</button>`;
const foldBtn = `<button type="button" class="sheet-fold" data-sheet-fold aria-label="Einklappen">${ICONS.chevron}</button>`;
// Eingeklappt bleibt die Karte, solange dasselbe ausgewählt ist (auch nach einem Zug)
let sheetFolded = false;
let sheetKey = '';
const selectionKey = () => (selection?.kind === 'unit' ? `u${selection.id}` : `t${selection.x},${selection.y}`);

function renderSheet() {
  const sheet = dom.sheet;
  if (!selection || !game) {
    sheet.hidden = true;
    dom.root.classList.remove('has-sheet');
    return;
  }
  if (selectionKey() !== sheetKey) sheetFolded = false;
  sheetKey = selectionKey();
  let html = '';
  let color = 'var(--line)';
  let hint = '';
  const u = selectedUnit();
  if (u) {
    const tribe = tribeById(game.players[u.owner].tribe);
    color = tribe.color;
    html = unitSheet(u, tribe);
    if (u.owner === HUMAN && isHumanTurn()) hint = unitHint(u);
  } else {
    const tile = E.at(game, selection.x, selection.y);
    const city = tile.city != null ? E.cityById(game, tile.city) : null;
    if (city) {
      color = tribeById(game.players[city.owner].tribe).color;
      html = citySheet(city);
      if (city.owner === HUMAN && isHumanTurn()) hint = 'Wähle eine Einheit zum Ausbilden';
    } else {
      html = tileSheet(tile);
      if (E.tileOwner(game, tile) === HUMAN && isHumanTurn() && E.tileActions(game, HUMAN, tile).some((a) => !a.locked)) hint = 'Wähle, was hier entstehen soll';
    }
  }
  sheet.style.setProperty('--c', color);
  sheet.innerHTML = infoBtn + foldBtn + closeBtn + html;
  if (hint) sheet.querySelector('.sheet-head > div').insertAdjacentHTML('beforeend', `<p class="sheet-hint">${hint}</p>`);
  sheet.classList.toggle('is-folded', sheetFolded);
  sheet.hidden = false;
  dom.root.classList.add('has-sheet'); // Handy hochkant: Karte ersetzt die untere Leiste
  sheet.querySelector('[data-sheet-close]').addEventListener('click', () => select(null));
  // Einklappen: nur Kopfzeile bleibt, Antippen der Kopfzeile klappt wieder auf
  const fold = (on) => {
    sheetFolded = on;
    sheet.classList.toggle('is-folded', on);
    sheet.querySelector('[data-sheet-fold]').setAttribute('aria-label', on ? 'Aufklappen' : 'Einklappen');
  };
  sheet.querySelector('[data-sheet-fold]').addEventListener('click', () => fold(!sheetFolded));
  sheet.querySelector('.sheet-head').addEventListener('click', () => sheetFolded && fold(false));
  // Handy hochkant: Werte und Hinweise stehen hinter dem Info-Knopf, die Karte bleibt klein
  sheet.querySelector('[data-sheet-info]').addEventListener('click', () => {
    openModal(`<h2>${esc(sheet.querySelector('.sheet-head h2').textContent)}</h2>${sheet.querySelector('.sheet-detail')?.innerHTML ?? ''}`, { className: 'modal--info' });
  });
  sheet.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', () => sheetAction(b.dataset.do, b.dataset.arg)));
}

// Wert mit Symbol statt Wort; das Wort steht im Tooltip und für Screenreader
const STAT_ICON = { Angriff: 'sword', Abwehr: 'shield', Bewegung: 'boot', Straße: 'road', Reichweite: 'target', Siege: 'swords', Einwohner: 'people', Einkommen: 'star', Einheiten: 'pawn' };
const SKILL_ICON = { dash: 'bolt', escape: 'boot', persist: 'swords', fortify: 'shield', heal: 'heart', convert: 'sparkle' };
const statPill = (label, value) =>
  `<span class="stat" data-stat="${STAT_ICON[label]}" title="${label}">${ICONS[STAT_ICON[label]]}<span class="vh">${label} </span><b>${value}</b></span>`;

function unitSheet(u, tribe) {
  const def = E.stats(u);
  const mine = u.owner === HUMAN;
  const head = `
    <div class="sheet-head">
      <img src="${unitThumb(u.naval || u.type, tribe.id)}" alt="">
      <div><h2>${esc(E.unitName(u))}${u.veteran ? ' ★' : ''}</h2><p>${esc(tribe.name)} · <span class="hp" title="Lebenspunkte">${ICONS.heart}${u.hp}/${u.maxHp}</span></p></div>
    </div>`;
  const stats = `<div class="stats">${statPill('Angriff', fmt(def.atk))}${statPill('Abwehr', def.def)}${statPill('Bewegung', def.move)}${u.naval ? '' : statPill('Straße', E.roadRange(u))}${statPill('Reichweite', def.range)}${u.kills ? statPill('Siege', u.kills) : ''}</div>`;
  const naval = u.naval
    ? `<p class="sheet-note">${u.naval === 'boat' ? 'Boote fahren nur auf Flachwasser.' : 'Fährt auch auf dem Ozean.'} Zum Anlanden auf ein Landfeld ziehen – das beendet den Zug.</p>`
    : '';
  const skills = def.skills.length
    ? `<ul class="skill-list">${def.skills
        .map((k) => {
          const [name, text] = SKILL_NAMES[k].split(': ');
          return `<li>${ICONS[SKILL_ICON[k]]}<span><b>${esc(name)}</b> ${esc(text)}</span></li>`;
        })
        .join('')}</ul>`
    : '';
  const detail = (more = '') => `<div class="sheet-detail">${stats}${naval}${skills}${more}</div>`;
  if (!mine || !isHumanTurn()) return head + detail();
  const actions = [];
  const up = E.upgradeOption(game, u);
  if (up && !up.locked) {
    actions.push(actionButton('upgrade', null, '', `Zum ${up.name}`, `<span class="cost">${starAmount(up.cost)}</span>${up.ok ? '' : ` · ${esc(up.reason)}`}`, up.ok, !up.ok, unitThumb(up.to, tribe.id)));
  }
  const cap = E.captureTarget(game, u);
  if (cap) actions.push(actionButton('capture', null, ICONS.flag, cap.kind === 'village' ? 'Dorf einnehmen' : 'Stadt erobern', 'Wird deine Stadt', true));
  if (E.canExamine(game, u)) actions.push(actionButton('examine', null, ICONS.ruin, 'Ruine erkunden', 'Was steckt darin?', true));
  if (E.canPromote(u)) actions.push(actionButton('promote', null, ICONS.up, 'Befördern', '+5 Lebenspunkte', true));
  if (E.canHealOthers(game, u)) actions.push(actionButton('healothers', null, ICONS.heart, 'Heilen', 'Nachbarn +4'));
  if (E.canRecover(game, u)) actions.push(actionButton('recover', null, ICONS.heart, 'Erholen', E.tileOwner(game, E.at(game, u.x, u.y)) === HUMAN ? '+4 Lebenspunkte' : '+2 Lebenspunkte'));
  if (E.canDisband(game, u)) actions.push(actionButton('disband', null, ICONS.trash, 'Auflösen', 'Einheit entlassen'));
  const status = !E.isIdle(game, u) ? '<p class="sheet-note">Diese Einheit hat in dieser Runde schon gehandelt.</p>' : '';
  const guard = E.defenseInfo(game, u);
  const guarded = guard ? `<p class="sheet-note sheet-guard">${ICONS.shield} Geschützt (${guard.reason}): Verteidigung ×${String(guard.factor).replace('.', ',')} – weniger Schaden, stärkerer Gegenschlag.</p>` : '';
  return head + detail(guarded + status) + `<div class="actions">${actions.join('')}</div>`;
}

function actionButton(action, arg, icon, title, sub, primary = false, disabled = false, img = null) {
  return `<button type="button" class="act ${primary ? 'is-primary' : ''}" data-do="${action}" ${arg != null ? `data-arg="${esc(arg)}"` : ''} ${disabled ? 'disabled' : ''}>
    ${img ? `<img src="${img}" alt="">` : `<span class="act-icon">${icon}</span>`}<b>${esc(title)}</b><small>${sub}</small></button>`;
}

function citySheet(city) {
  const tribe = tribeById(game.players[city.owner].tribe);
  const mine = city.owner === HUMAN;
  const need = popToGrow(city.level);
  const units = E.cityUnits(game, city).length;
  const extras = [city.capital && 'Hauptstadt', city.workshop && 'Werkstatt', city.wall && 'Mauer', city.parks && `${city.parks} Park${city.parks > 1 ? 's' : ''}`].filter(Boolean);
  let html = `
    <div class="sheet-head">
      <img src="${cityThumb(tribe.id, city.level, city.capital)}" alt="">
      <div><h2>${esc(city.name)}</h2><p>${esc(tribe.name)} · Stufe ${city.level}${extras.length ? ` · ${esc(extras.join(', '))}` : ''}</p></div>
    </div>
    <div class="progress" title="Einwohner bis zur nächsten Stufe">${Array.from({ length: need }, (_, i) => `<span class="${i < city.pop ? 'is-full' : ''}"></span>`).join('')}</div>
    <div class="sheet-detail"><div class="stats">${statPill('Einwohner', `${city.pop}/${need}`)}${statPill('Einkommen', `+${E.cityIncome(game, city)}`)}${statPill('Einheiten', `${units}/${unitCap(city.level)}`)}</div></div>`;
  if (E.besieged(game, city)) html += '<p class="sheet-note is-warn">Belagert: Ein Gegner steht in der Stadt – kein Einkommen.</p>';
  if (!mine || !isHumanTurn()) return html;
  if (city.pending.length) html += `<div class="actions">${actionButton('reward', city.id, ICONS.up, 'Belohnung wählen', `Stufe ${city.pending[0]}`, true)}</div>`;
  const opts = E.trainOptions(game, city);
  html += `<div class="actions">${opts
    .filter((o) => !o.locked) // nur Freigeschaltetes
    .map((o) => {
      const sub = o.locked ? `${ICONS.lock} ${esc(o.reason.replace('Braucht ', ''))}` : `<span class="cost">${starAmount(o.cost)}</span>${o.ok ? '' : ` · ${esc(o.reason)}`}`;
      return actionButton('train', o.type, '', UNITS[o.type].name, sub, false, !o.ok, unitThumb(o.type, tribe.id));
    })
    .join('')}</div>`;
  return html;
}

function tileSheet(tile) {
  const ownerP = E.tileOwner(game, tile);
  const ownerCity = tile.owner != null ? E.cityById(game, tile.owner) : null;
  const title = tile.village ? 'Dorf' : tile.ruin ? 'Ruine' : TERRAIN_NAMES[tile.terrain];
  const parts = [];
  if (tile.resource) parts.push(RESOURCE_NAMES[tile.resource]);
  if (tile.building) parts.push(BUILDING_NAMES[tile.building]);
  if (tile.road) parts.push('Straße');
  if (ownerCity) parts.push(`Gebiet von ${ownerCity.name}`);
  const ownerTribe = ownerP != null ? game.players[ownerP].tribe : null;
  let html = `
    <div class="sheet-head">
      <img src="${tileThumb(tile, ownerTribe)}" alt="">
      <div><h2>${esc(title)}</h2><p>${esc(parts.join(' · ') || TERRAIN_NAMES[tile.terrain])}</p></div>
    </div>`;
  let notes = '';
  if (tile.village) notes += '<p class="sheet-note">Stell eine Einheit auf das Dorf und nimm es in der nächsten Runde ein – dann wird es deine Stadt.</p>';
  if (tile.ruin) notes += '<p class="sheet-note">Schick eine Einheit hierher und erkunde die Ruine.</p>';
  if (tile.terrain === 'mountain' && !E.hasTech(game, HUMAN, 'climbing')) notes += '<p class="sheet-note">Berge kann man erst mit Klettern betreten.</p>';
  html += `<div class="sheet-detail">${notes}</div>`;
  if (ownerP === HUMAN && isHumanTurn()) {
    const acts = E.tileActions(game, HUMAN, tile).filter((a) => !a.locked); // nur Freigeschaltetes
    if (acts.length) {
      html += `<div class="actions">${acts
        .map((a) => {
          const gain = [a.pop ? `+${a.pop} Einw.` : '', a.stars ? `+${a.stars} ★` : ''].filter(Boolean).join(' ');
          const sub = a.locked ? `${ICONS.lock} ${esc(a.reason.replace('Braucht ', ''))}` : `<span class="cost">${starAmount(a.cost)}</span>${gain ? ` · ${gain}` : ''}${!a.ok ? `<br>${esc(a.reason)}` : ''}`;
          const preview = ACTIONS[a.id].build || ACTIONS[a.id].road ? tileThumb({ ...tile, resource: null, building: ACTIONS[a.id].build || null, road: Boolean(ACTIONS[a.id].road) }, game.players[HUMAN].tribe) : null;
          return actionButton('tile', a.id, ICONS.star, a.name, sub, false, !a.ok, preview);
        })
        .join('')}</div>`;
    }
  }
  return html;
}

function sheetAction(action, arg) {
  if (busy || !isHumanTurn()) return;
  const u = selectedUnit();
  switch (action) {
    case 'capture':
      return act(() => E.capture(game, u.id), u.id);
    case 'examine':
      return act(() => E.examine(game, u.id), u.id);
    case 'promote':
      return act(() => E.promote(game, u.id), u.id);
    case 'upgrade':
      return act(() => E.upgrade(game, u.id), u.id);
    case 'recover':
      return act(() => E.recover(game, u.id), u.id);
    case 'healothers':
      return act(() => E.healOthers(game, u.id), u.id);
    case 'disband': {
      const { el, close } = openModal(`
        <h2>${esc(E.unitName(u))} auflösen?</h2>
        <p class="modal-text">Die Einheit verschwindet. Das lässt sich nicht rückgängig machen.</p>
        <div class="modal-actions"><button type="button" class="btn" data-close>Abbrechen</button><button type="button" class="btn btn--primary" data-yes>Auflösen</button></div>`);
      el.querySelector('[data-yes]').addEventListener('click', () => {
        close();
        act(() => E.disband(game, u.id));
      });
      return;
    }
    case 'reward':
      return chooseRewardModal(E.cityById(game, Number(arg)));
    case 'train': {
      const tile = E.at(game, selection.x, selection.y);
      return act(() => E.train(game, tile.city, arg)).then(() => select({ kind: 'tile', x: tile.x, y: tile.y }));
    }
    case 'tile': {
      const { x, y } = selection;
      return act(() => E.tileAction(game, HUMAN, x, y, arg)).then(() => select({ kind: 'tile', x, y }));
    }
    default:
  }
}

// ---------- Belohnungen ----------

const REWARD_ICONS = { workshop: '⚒', explorer: '🧭', wall: '🧱', resources: '★', growth: '👥', borders: '⬚', park: '🌳', giant: '🗿' };

function chooseRewardModal(city) {
  if (!city || !city.pending.length) return;
  const level = city.pending[0];
  const { el, close } = openModal(
    `<h2>${esc(city.name)} ist jetzt Stufe ${level}!</h2>
     <p class="modal-text">Wähle eine Belohnung.</p>
     <div class="rewards">${rewardsFor(level)
       .map((r) => `<button type="button" class="reward" data-reward="${r.id}"><span class="reward-icon">${REWARD_ICONS[r.id] || '★'}</span><b>${esc(r.name)}</b><small>${esc(r.text)}</small></button>`)
       .join('')}</div>`,
    { closable: false },
  );
  el.querySelectorAll('[data-reward]').forEach((b) =>
    b.addEventListener('click', async () => {
      close();
      audio.play('coin');
      await act(() => E.chooseReward(game, city.id, b.dataset.reward));
    }),
  );
}

// ---------- Forschung ----------

function openTechTree() {
  if (!game) return null;
  return showTechTree({
    tribe: game.players[HUMAN].tribe,
    stars: () => game.players[HUMAN].stars,
    state: (id) => E.techState(game, HUMAN, id),
    cost: (id) => E.techCost(game, HUMAN, id),
    canResearch: () => isHumanTurn() && !busy,
    research: (id) => {
      const events = E.research(game, HUMAN, id);
      if (!events.length) {
        audio.play('error');
        return false;
      }
      handleEvents(events);
      updateHud();
      saveGame();
      refreshSelection();
      return true;
    },
    onSound: audio.play,
  });
}

// ---------- Rundenende und Computergegner ----------

// „Runde beenden“ – mit Einstellung „Runde beenden bestätigen“ erst nach Rückfrage
function requestEndTurn() {
  if (busy || !isHumanTurn() || modalOpen()) return;
  const pending = E.playerCities(game, HUMAN).find((c) => c.pending.length);
  if (pending) return chooseRewardModal(pending);
  if (!settings.confirmEnd) return endTurn();
  const left = E.playerUnits(game, HUMAN).filter((u) => E.isIdle(game, u)).length;
  const text = left ? `${left} ${left === 1 ? 'Einheit kann' : 'Einheiten können'} noch etwas tun.` : 'Alle Einheiten sind fertig.';
  const { el, close } = openModal(
    `<h2>Runde beenden?</h2>
    <p class="modal-text">${text}</p>
    <div class="modal-actions"><button type="button" class="btn" data-close>Weiterspielen</button><button type="button" class="btn btn--primary" data-yes>Runde beenden</button></div>`,
    { className: 'modal--confirm' },
  );
  const yes = el.querySelector('[data-yes]');
  yes.addEventListener('click', () => {
    close();
    endTurn();
  });
  yes.focus(); // Enter bestätigt, Esc bricht ab
}

async function endTurn() {
  if (busy || !isHumanTurn()) return;
  const pending = E.playerCities(game, HUMAN).find((c) => c.pending.length);
  if (pending) return chooseRewardModal(pending);
  select(null);
  const events = E.endTurn(game);
  board.syncUnits(); // eigene Einheiten hören auf zu leuchten
  await board.play(events);
  await runBots();
}

async function runBots() {
  busy = true;
  updateHud();
  while (game && !game.over && !game.players[game.current].human) {
    const p = game.current;
    const tribe = tribeById(game.players[p].tribe);
    dom.ai.hidden = false;
    dom.ai.style.setProperty('--c', tribe.color);
    dom.ai.innerHTML = `<span class="dot"></span>${esc(tribe.name)} ${game.players[p].alive ? 'ist am Zug' : ''}`;
    const events = playTurn(game);
    await board.play(events, { speed: settings.speed });
    const next = E.endTurn(game);
    await board.play(next, { speed: settings.speed });
    saveGame();
  }
  dom.ai.hidden = true;
  busy = false;
  if (!game) return;
  board.sync();
  updateHud();
  saveGame();
  if (game.over) return showGameOver();
  const inc = E.income(game, HUMAN);
  if (game.turn > 1) {
    toast({ title: `Runde ${game.turn}`, text: `+${inc} Sterne`, icon: ICONS.star, duration: 2000 });
    audio.play('turn');
  }
  refreshSelection();
  afterHumanAction();
}

// ---------- Statistik (im Spiel) ----------

// Punkte-Teile mit Symbol, auch fürs Spielende
const SCORE_PARTS = {
  explore: ['Erkundung', 'eye'],
  territory: ['Gebiet', 'flag'],
  cities: ['Städte', 'people'],
  tech: ['Forschung', 'flask'],
  army: ['Armee', 'sword'],
  temples: ['Tempel', 'sparkle'],
  parks: ['Parks', 'heart'],
};
const scorePartsHtml = (parts) =>
  `<dl class="score-parts">${Object.entries(parts)
    .map(([k, v]) => `<dt>${ICONS[SCORE_PARTS[k][1]]}${SCORE_PARTS[k][0]}</dt><dd>${fmt(v)}</dd>`)
    .join('')}</dl>`;

function openStats() {
  const perfection = game.mode === 'perfection';
  const chip = (icon, text, title) => `<span class="stat" title="${title}">${ICONS[icon]}<b>${esc(text)}</b></span>`;
  const ranking = game.players
    .map((p, i) => ({ i, p, tribe: tribeById(p.tribe), score: E.scoreOf(game, i).total }))
    .sort((a, b) => b.p.alive - a.p.alive || b.score - a.score);
  const row = (r, n) => {
    const cities = E.playerCities(game, r.i).length;
    const units = E.playerUnits(game, r.i).length;
    const sub = r.p.alive
      ? `<span title="Städte">${ICONS.people}${cities}</span><span title="Einheiten">${ICONS.pawn}${units}</span><span title="Techniken">${ICONS.flask}${r.p.techs.length}</span>`
      : 'Besiegt';
    return `<div class="rank ${r.i === HUMAN ? 'is-you' : ''} ${r.p.alive ? '' : 'is-out'}" style="--c:${r.tribe.color}">
      <span>${r.p.alive ? `${n + 1}.` : '✝'}</span><i></i>
      <div class="rank-name">${esc(r.tribe.name)}${r.i === HUMAN ? ' <small class="rank-you">Du</small>' : ''}<small class="rank-sub">${sub}</small></div>
      <b>${r.p.alive ? fmt(r.score) : '–'}</b></div>`;
  };
  openModal(
    `<h2>Statistik</h2>
     <div class="stats stats--game">
       ${chip(perfection ? 'trophy' : 'swords', perfection ? `${game.turnLimit} Runden` : 'Eroberung', 'Spielart')}
       ${chip('mountain', MAP_TYPES[game.mapType]?.name || '', 'Landschaft')}
       ${chip('bolt', DIFFICULTIES[game.difficulty]?.name || '', 'Gegner')}
       ${chip('up', perfection ? `Runde ${Math.min(game.turn, game.turnLimit)}/${game.turnLimit}` : `Runde ${game.turn}`, 'Runde')}
     </div>
     <h3 class="modal-sub">Punkte</h3>
     <div class="ranking">${ranking.map(row).join('')}</div>
     <h3 class="modal-sub">Deine Punkte</h3>
     ${scorePartsHtml(E.scoreOf(game, HUMAN).parts)}`,
    { className: 'modal--stats' },
  );
}

// ---------- Spielende ----------

function showGameOver() {
  const over = game.over;
  const won = over.winner === HUMAN;
  audio.play(won ? 'victory' : 'defeat');
  const title = won ? 'Sieg!' : over.reason === 'defeat' ? 'Niederlage' : 'Spielende';
  const reason = {
    domination: won ? 'Du hast alle anderen Stämme besiegt.' : `${tribeById(game.players[over.winner].tribe).name} hat alle besiegt.`,
    turns: won ? `Nach ${game.turnLimit} Runden hast du die meisten Punkte.` : `Nach ${game.turnLimit} Runden liegt ${tribeById(game.players[over.winner].tribe).name} vorn.`,
    defeat: 'Deine letzte Stadt ist gefallen.',
  }[over.reason];
  const ranking = game.players
    .map((p, i) => ({ i, tribe: tribeById(p.tribe), score: over.scores[i], alive: p.alive }))
    .sort((a, b) => b.score - a.score);
  const { el } = openModal(
    `<h2>${title}</h2><p class="modal-text">${esc(reason)}</p>
     <div class="ranking">${ranking
       .map((r, n) => `<div class="rank ${r.i === HUMAN ? 'is-you' : ''}" style="--c:${r.tribe.color}"><span>${n + 1}.</span><i></i>${esc(r.tribe.name)}${r.alive ? '' : ' ✝'}<b>${fmt(r.score)}</b></div>`)
       .join('')}</div>
     ${scorePartsHtml(E.scoreOf(game, HUMAN).parts)}
     <div class="modal-actions"><button type="button" class="btn" data-close>Karte ansehen</button><button type="button" class="btn btn--primary" data-new>Neues Spiel</button></div>`,
  );
  el.querySelector('[data-new]').addEventListener('click', () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignorieren
    }
    location.hash = '';
    renderStart();
    document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
  });
}

// ---------- Menü ----------

function openMenu() {
  const speeds = [['1', '1×'], ['2.2', '2×'], ['4.5', '4×']];
  const speedNow = speeds.reduce((best, [v]) => (Math.abs(Number(v) - settings.speed) < Math.abs(Number(best) - settings.speed) ? v : best), '2.2');
  const light = document.documentElement.dataset.theme === 'light';
  const toggle = (key, label, icon) =>
    `<label class="set-row"><span class="set-label">${icon}${label}</span><input type="checkbox" class="switch" data-set="${key}" ${settings[key] ? 'checked' : ''}></label>`;
  const seg = (key, options, value) =>
    `<div class="seg seg--sm" role="group" data-seg="${key}">${options
      .map(([v, label]) => `<button type="button" data-value="${v}" class="${v === value ? 'is-active' : ''}">${label}</button>`)
      .join('')}</div>`;
  const { el, close } = openModal(
    `<h2>Menü</h2>
    <div class="menu-top">
      <button type="button" class="btn btn--primary" data-close>Weiterspielen</button>
      <button type="button" class="btn" data-stats>${ICONS.trophy}Statistik</button>
      <button type="button" class="btn" data-help>So wird gespielt</button>
    </div>
    <div class="menu-settings">
      ${toggle('sound', 'Töne', ICONS.speaker)}
      ${toggle('music', 'Musik', ICONS.music)}
      ${toggle('shadows', 'Schatten', ICONS.shadow)}
      ${toggle('confirmEnd', 'Runde beenden bestätigen', ICONS.check)}
      <div class="set-row"><span class="set-label">${light ? ICONS.sun : ICONS.moon}Design</span>${seg('theme', [['dark', 'Dunkel'], ['light', 'Hell']], light ? 'light' : 'dark')}</div>
      <div class="set-row" title="Tempo der Gegner"><span class="set-label">${ICONS.bolt}Tempo der Gegner</span>${seg('speed', speeds, speedNow)}</div>
    </div>
    <button type="button" class="btn btn--sm menu-home" data-home>Zum Hauptmenü</button>
    <p class="credit credit--menu">StrategieSpiel · von Nicolas Brand</p>`,
    { className: 'modal--menu' },
  );
  el.querySelector('[data-stats]').addEventListener('click', () => {
    close();
    openStats();
  });
  el.querySelector('[data-help]').addEventListener('click', () => {
    close();
    openHelp();
  });
  // Schalter: sofort übernehmen und merken
  el.querySelectorAll('[data-set]').forEach((input) =>
    input.addEventListener('change', () => {
      const key = input.dataset.set;
      settings[key] = input.checked;
      saveSettings();
      if (key === 'sound') audio.setSound(settings.sound);
      if (key === 'music') audio.setMusic(settings.music);
      if (key === 'shadows') board?.setShadows(settings.shadows);
      audio.play('select');
    }),
  );
  el.querySelectorAll('[data-seg]').forEach((group) =>
    group.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      group.querySelectorAll('button').forEach((o) => o.classList.toggle('is-active', o === b));
      if (group.dataset.seg === 'theme') setTheme(b.dataset.value === 'light');
      else {
        settings.speed = Number(b.dataset.value);
        saveSettings();
      }
      audio.play('select');
    }),
  );
  el.querySelector('[data-home]').addEventListener('click', () => {
    close();
    saveGame();
    renderStart();
  });
}

function openHelp() {
  const row = (icon, text) => `<li><span class="help-ico">${icon}</span><span>${text}</span></li>`;
  const stats = ['Angriff', 'Abwehr', 'Bewegung', 'Straße', 'Reichweite', 'Siege'].map((k) => `<span class="stat" data-stat="${STAT_ICON[k]}">${ICONS[STAT_ICON[k]]}${k}</span>`).join(' ');
  openModal(`
    <h2>So wird gespielt</h2>
    <div class="help">
      <h3>${ICONS.trophy} Ziel</h3>
      <ul>
        ${row(ICONS.trophy, `„${TURN_LIMIT} Runden“: Nach Runde ${TURN_LIMIT} gewinnt die höchste Punktzahl.`)}
        ${row(ICONS.swords, '„Eroberung“: Der letzte Stamm mit Städten gewinnt.')}
      </ul>
      <h3>${ICONS.pawn} Einheiten</h3>
      <ul>
        ${row(ICONS.pawn, 'Antippen: <b>weiße Punkte</b> = ziehen, <b>rote Ringe</b> = angreifen.')}
        ${row(ICONS.mountain, 'Berge und Felder neben Gegnern beenden die Bewegung. Auf Bergen (Klettern): Sicht 2, geschützt.')}
        ${row(ICONS.road, 'Auf Straßen und zwischen Städten kommst du weiter – wie weit, steht unter „Straße“ in den Details.')}
        ${row(ICONS.shield, 'Schild an der Lebensanzeige = geschützt, verteidigt besser.')}
        ${row(ICONS.flag, 'Steht eine Einheit zu Rundenbeginn auf einem Dorf, wird es deine Stadt.')}
        <li class="help-stats">${stats}</li>
      </ul>
      <h3>${ICONS.star} Sterne und Städte</h3>
      <ul>
        ${row(ICONS.star, 'Jede Stadt bringt Sterne pro Runde – zum Ausbilden, Forschen und Bauen.')}
        ${row(ICONS.people, 'Felder im eigenen Gebiet antippen: Ernten, Jagen und Bauen bringen Einwohner.')}
        ${row(ICONS.up, 'Genug Einwohner: Die Stadt steigt auf, du wählst eine Belohnung.')}
      </ul>
      <h3>${ICONS.boat} Wasser und Schiffe</h3>
      <ul>
        ${row(ICONS.boat, 'Fischen: Hafen auf Flachwasser. Wer darauf zieht, wird zum Boot.')}
        ${row(ICONS.up, 'Segeln: Schiff (auch Ozean). Navigation: Schlachtschiff.')}
        ${row(ICONS.flag, 'Anlanden auf einem Landfeld beendet den Zug.')}
      </ul>
      <h3>${ICONS.flask} Forschung</h3>
      <ul>
        ${row(ICONS.flask, 'Jede Technik schaltet etwas frei. Mehr Städte = teurere Forschung.')}
      </ul>
      <h3>${ICONS.sword} Kampf</h3>
      <ul>
        ${row(ICONS.sword, 'Schaden hängt von Angriff, Abwehr und Lebenspunkten beider Seiten ab.')}
        ${row(ICONS.shield, 'Geschützt (×1,5): in eigenen Städten, im Wald (Bogenschießen), auf Bergen (Klettern), im Wasser (Aquatismus). Hinter einer Mauer ×4.')}
      </ul>
    </div>`);
}

// ---------- Tastatur (PC) ----------

document.addEventListener('keydown', (e) => {
  if (!game || !board || modalOpen()) return;
  if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
  const step = 1;
  const keys = { ArrowLeft: [-step, step], ArrowRight: [step, -step], ArrowUp: [-step, -step], ArrowDown: [step, step], a: [-step, step], d: [step, -step], w: [-step, -step], s: [step, step] };
  const k = keys[e.key];
  if (k) {
    board.rig.pan(k[0] * 0.7, k[1] * 0.7);
    e.preventDefault();
  } else if (e.key === 'Escape') select(null);
  else if (e.key === 't' || e.key === 'T') openTechTree();
  else if (e.key === '+' || e.key === '=') board.rig.zoomBy(0.85);
  else if (e.key === '-') board.rig.zoomBy(1.18);
});

// ---------- Start ----------

// Browser (vor allem iOS) erlauben Ton erst nach einer Berührung oder Taste
for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, audio.unlock, { passive: true, capture: true });

function boot() {
  try {
    renderStart();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="boot"><span class="logo">Strategie<span>Spiel</span></span><p>Das Spiel konnte nicht starten.<br>${esc(err.message)}</p></div>`;
  }
  pwa.onInstallChange(renderInstall);
  pwa.registerServiceWorker();
}

boot();

// Für Tests und Fehlersuche in der Browser-Konsole
window.kleineReiche = {
  get state() {
    return game;
  },
  get board() {
    return board;
  },
  tap: (x, y) => onTap(game && E.at(game, x, y)),
};

export { hasSkill };
