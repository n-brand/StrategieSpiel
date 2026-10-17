// PWA: Manifest, Icons, iOS-Angaben und der Service Worker (installierbar, offline spielbar).
// Der Service Worker läuft hier in einer nachgebauten Umgebung (Speicher, Netz, Ereignisse).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const text = (p) => readFileSync(join(PUBLIC, p), 'utf8');
const html = text('index.html');
const manifest = JSON.parse(text('manifest.webmanifest'));

function pngSize(file) {
  assert.ok(existsSync(join(PUBLIC, file)), `${file} fehlt – npm run icons`);
  const b = readFileSync(join(PUBLIC, file));
  assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} ist kein PNG`);
  assert.equal(b.subarray(12, 16).toString('ascii'), 'IHDR');
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

// Alle Dateien, die der Server ausliefert (relativ zu public/)
const publicFiles = (dir = '') =>
  readdirSync(join(PUBLIC, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? publicFiles(`${dir}${d.name}/`) : [`${dir}${d.name}`]));

describe('Manifest und Icons', () => {
  test('Name, Start, Anzeige und Farben passen zur Seite', () => {
    assert.equal(manifest.name, 'StrategieSpiel');
    assert.ok(manifest.short_name && manifest.short_name.length <= 15, 'Kurzname fürs Home-Bildschirm-Symbol');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.lang, 'de');
    const themeMeta = html.match(/<meta name="theme-color" content="([^"]+)"/)[1];
    assert.equal(manifest.theme_color, themeMeta);
    assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  });

  test('PNG-Icons 192 und 512 px, eines „maskable“ – Dateien haben die angegebene Größe', () => {
    const pngs = manifest.icons.filter((i) => i.type === 'image/png');
    for (const icon of pngs) assert.equal(pngSize(icon.src), icon.sizes, icon.src);
    const has = (size, purpose) => pngs.some((i) => i.sizes === size && i.purpose.split(' ').includes(purpose));
    assert.ok(has('192x192', 'any'));
    assert.ok(has('512x512', 'any'));
    assert.ok(has('512x512', 'maskable'));
    const svg = manifest.icons.find((i) => i.type === 'image/svg+xml');
    assert.match(text(svg.src), /^<svg [^>]*viewBox="0 0 100 100"/);
  });

  test('index.html: Manifest, iOS-Symbol (180 px), Vollbild und sichere Ränder', () => {
    assert.match(html, /<link rel="manifest" href="manifest.webmanifest">/);
    const touch = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)[1];
    assert.equal(pngSize(touch), '180x180');
    const favicon = html.match(/<link rel="icon" href="([^"]+\.png)"[^>]*sizes="(\d+x\d+)"/);
    assert.equal(pngSize(favicon[1]), favicon[2]);
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
    assert.match(html, /<meta name="apple-mobile-web-app-title" content="StrategieSpiel">/);
    assert.match(html, /viewport-fit=cover/);
  });
});

// ---------- Nachgebaute Service-Worker-Umgebung ----------

const ORIGIN = 'https://spiel.example';
const SCOPE = `${ORIGIN}/reiche/`;
const FONT_FILE = 'https://fonts.gstatic.com/s/nunito/v1/nunito-latin.woff2';
const keyOf = (r) => (typeof r === 'string' ? new URL(r, SCOPE).href : String(r.url));

class FakeRequest {
  constructor(url, init = {}) {
    this.url = String(url);
    this.method = init.method || 'GET';
    this.mode = init.mode || 'cors';
    this.cache = init.cache || 'default';
  }
}

class FakeResponse {
  constructor(body, { status = 200, type = 'basic' } = {}) {
    this.body = body;
    this.status = status;
    this.type = type;
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  clone() {
    return new FakeResponse(this.body, { status: this.status, type: this.type });
  }

  async text() {
    return this.body;
  }
}

class FakeCache {
  constructor(env) {
    this.env = env;
    this.map = new Map();
  }

  async match(req, opts = {}) {
    const key = keyOf(req);
    const strip = (k) => k.split('?')[0];
    for (const [k, res] of this.map) if (k === key || (opts.ignoreSearch && strip(k) === strip(key))) return res.clone();
    return undefined;
  }

  async put(req, res) {
    this.map.set(keyOf(req), res);
  }

  async add(req) {
    const res = await this.env.fetch(req);
    if (!res.ok) throw new TypeError(`${keyOf(req)}: ${res.status}`);
    await this.put(req, res);
  }

  async addAll(reqs) {
    for (const r of reqs) await this.add(r);
  }
}

function makeEnv() {
  const env = { online: true, version: 1, missing: new Set(), failHosts: new Set(), delay: new Map(), requests: [], installRequests: [] };
  const store = new Map();
  env.store = store;
  env.caches = {
    open: async (name) => {
      if (!store.has(name)) store.set(name, new FakeCache(env));
      return store.get(name);
    },
    keys: async () => [...store.keys()],
    delete: async (name) => store.delete(name),
  };
  // Netz: eigene Dateien tragen die Version im Inhalt, fremde Server liefern CORS-Antworten
  env.fetch = async (req) => {
    const url = keyOf(req);
    env.requests.push(url);
    if (req instanceof FakeRequest && req.cache === 'reload') env.installRequests.push(url);
    if (env.delay.has(url)) await new Promise((r) => setTimeout(r, env.delay.get(url)));
    const { hostname, origin, pathname } = new URL(url);
    if (!env.online || env.failHosts.has(hostname)) throw new TypeError('Failed to fetch');
    if (origin === ORIGIN) return env.missing.has(pathname) ? new FakeResponse('Nicht gefunden', { status: 404 }) : new FakeResponse(`${pathname}#v${env.version}`);
    if (hostname === 'fonts.googleapis.com') return new FakeResponse(`@font-face { src: url(${FONT_FILE}) format('woff2'); }`, { type: 'cors' });
    return new FakeResponse(`cdn:${url}`, { type: 'cors' });
  };
  // Service Worker laden; Zeitlimits laufen hier 100-mal schneller
  const handlers = {};
  const self = {
    location: new URL(`${SCOPE}sw.js`),
    registration: { scope: SCOPE },
    addEventListener: (type, fn) => {
      handlers[type] = fn;
    },
    skipWaiting: async () => {
      env.skipped = true;
    },
    clients: {
      claim: async () => {
        env.claimed = true;
      },
    },
  };
  const context = vm.createContext({
    self,
    caches: env.caches,
    fetch: env.fetch,
    Request: FakeRequest,
    URL,
    setTimeout: (fn, ms, ...args) => setTimeout(fn, ms / 100, ...args),
    clearTimeout,
  });
  vm.runInContext(`${text('sw.js')}\nglobalThis.__sw = { ASSETS, THREE, FONT_CSS, CACHE };`, context);
  const sw = context.__sw; // Werte aus der vm-Umgebung in normale Arrays/Strings übernehmen
  Object.assign(env, { ASSETS: Array.from(sw.ASSETS), THREE: sw.THREE, FONT_CSS: sw.FONT_CSS, CACHE: sw.CACHE, handlers });
  return env;
}

function extendable() {
  const waits = [];
  return { waits, waitUntil: (p) => waits.push(Promise.resolve(p)) };
}

async function lifecycle(env, type) {
  const ev = extendable();
  env.handlers[type](ev);
  await Promise.all(ev.waits);
}

// Anfrage der Seite: liefert, was der Service Worker antwortet (null = nicht eingegriffen)
async function request(env, url, { mode = 'cors', method = 'GET' } = {}) {
  const ev = { request: { url: new URL(url, SCOPE).href, method, mode }, ...extendable(), response: null };
  ev.respondWith = (p) => {
    ev.response = Promise.resolve(p);
  };
  env.handlers.fetch(ev);
  const res = ev.response ? await ev.response : null;
  await Promise.all(ev.waits);
  return res;
}

describe('Service Worker', () => {
  test('kennt jede Datei des Spiels – sonst fehlt offline etwas', () => {
    const env = makeEnv();
    const listed = env.ASSETS.filter((a) => a !== './');
    const files = publicFiles().filter((f) => f !== 'sw.js');
    assert.deepEqual(files.filter((f) => !listed.includes(f)), [], 'In sw.js (ASSETS) nachtragen');
    assert.deepEqual(listed.filter((f) => !files.includes(f)), [], 'Steht in ASSETS, gibt es aber nicht');
  });

  test('Three.js und Schrift: dieselben Adressen wie in index.html', () => {
    const env = makeEnv();
    const importmap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
    assert.equal(env.THREE, importmap.imports.three);
    assert.match(env.THREE, /@\d+\.\d+\.\d+\//, 'feste Version (wird dauerhaft gespeichert)');
    assert.ok(html.includes(`href="${env.FONT_CSS}"`));
  });

  test('Installieren speichert Spiel, Three.js und Schrift – frisch vom Server', async () => {
    const env = makeEnv();
    await lifecycle(env, 'install');
    const cache = env.store.get(env.CACHE);
    for (const a of env.ASSETS) assert.ok(cache.map.has(new URL(a, SCOPE).href), a);
    for (const url of [env.THREE, env.FONT_CSS, FONT_FILE]) assert.ok(cache.map.has(url), url);
    assert.equal(env.installRequests.length, env.ASSETS.length, 'eigene Dateien am Browser-Cache vorbei geladen');
    assert.ok(env.skipped);
  });

  test('Installieren klappt ohne Schrift, aber nicht, wenn eine Spieldatei fehlt', async () => {
    const noFont = makeEnv();
    noFont.failHosts.add('fonts.googleapis.com');
    await lifecycle(noFont, 'install');
    assert.ok(noFont.store.get(noFont.CACHE).map.has(noFont.THREE));

    const broken = makeEnv();
    broken.missing.add('/reiche/js/game/engine.js');
    await assert.rejects(lifecycle(broken, 'install'));
    assert.ok(!broken.skipped);
  });

  test('Offline: Spiel startet aus dem Speicher, auch mit ?-Parameter in der Adresse', async () => {
    const env = makeEnv();
    await lifecycle(env, 'install');
    env.online = false;
    assert.equal((await request(env, SCOPE, { mode: 'navigate' })).body, '/reiche/#v1');
    assert.equal((await request(env, `${SCOPE}?quelle=app`, { mode: 'navigate' })).body, '/reiche/#v1');
    assert.equal((await request(env, 'js/main.js')).body, '/reiche/js/main.js#v1');
    assert.equal((await request(env, env.THREE)).body, `cdn:${env.THREE}`);
    await assert.rejects(request(env, 'gibt-es-nicht.js'), 'nichts gespeichert und kein Netz → Fehler');
  });

  test('Online: immer die neueste Fassung – und die wird für offline gemerkt', async () => {
    const env = makeEnv();
    await lifecycle(env, 'install');
    env.version = 2;
    assert.equal((await request(env, 'js/main.js')).body, '/reiche/js/main.js#v2');
    env.online = false;
    assert.equal((await request(env, 'js/main.js')).body, '/reiche/js/main.js#v2');
  });

  test('Langsames Netz: nach dem Zeitlimit die gespeicherte Fassung, die späte Antwort wird nachgetragen', async () => {
    const env = makeEnv();
    await lifecycle(env, 'install');
    env.version = 2;
    env.delay.set(`${SCOPE}css/style.css`, 300); // länger als das (beschleunigte) Zeitlimit von 40 ms
    assert.equal((await request(env, 'css/style.css')).body, '/reiche/css/style.css#v1');
    assert.equal((await env.store.get(env.CACHE).match(`${SCOPE}css/style.css`)).body, '/reiche/css/style.css#v2');
  });

  test('Fremde Server: aus dem Speicher ohne Netz, Neues wird gespeichert', async () => {
    const env = makeEnv();
    await lifecycle(env, 'install');
    env.requests.length = 0;
    assert.equal((await request(env, env.THREE)).body, `cdn:${env.THREE}`);
    assert.deepEqual(env.requests, [], 'Three.js nicht erneut geladen');
    const other = 'https://fonts.gstatic.com/s/nunito/v1/nunito-latin-ext.woff2';
    await request(env, other);
    env.online = false;
    assert.equal((await request(env, other)).body, `cdn:${other}`);
  });

  test('Aufräumen: alte eigene Speicher weg, Speicher anderer Spiele bleiben', async () => {
    const env = makeEnv();
    await env.caches.open('kleine-reiche-v0');
    await env.caches.open('gamehub-v3');
    await lifecycle(env, 'install');
    await lifecycle(env, 'activate');
    assert.deepEqual((await env.caches.keys()).sort(), [env.CACHE, 'gamehub-v3'].sort());
    assert.ok(env.claimed);
  });

  test('Lässt Formulare (POST) und fremde Seiten in Ruhe', async () => {
    const env = makeEnv();
    assert.equal(await request(env, 'js/main.js', { method: 'POST' }), null);
    assert.equal(await request(env, 'https://example.org/irgendwas.js'), null);
  });
});
