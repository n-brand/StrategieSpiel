// Installierbare App (PWA): Service Worker anmelden und Installieren anbieten.
// Android/PC (Chrome, Edge): eigener „Installieren“-Knopf über das beforeinstallprompt-Ereignis.
// iOS/iPadOS: Browser bieten keinen Knopf → Hinweis „Teilen → Zum Home-Bildschirm“.

const HINT_KEY = 'kleine-reiche-installhinweis';
const listeners = new Set();
let deferred = null;

const notify = () => listeners.forEach((fn) => fn());

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const go = () => navigator.serviceWorker.register('sw.js').catch(() => {});
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

export const isStandalone = () =>
  navigator.standalone === true || ['standalone', 'fullscreen'].some((m) => window.matchMedia?.(`(display-mode: ${m})`).matches);

// iPadOS meldet sich als Mac – erkennbar am Touchscreen
export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

function dismissed() {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

// Was der Startbildschirm anbietet: 'prompt' (Knopf), 'ios' (Anleitung) oder null
export function installOffer() {
  if (isStandalone() || dismissed()) return null;
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return null;
}

export async function install() {
  const ev = deferred;
  if (!ev) return false;
  deferred = null;
  ev.prompt();
  const choice = await ev.userChoice.catch(() => null);
  notify();
  return choice?.outcome === 'accepted';
}

export function dismissInstall() {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    // Speicher gesperrt: Hinweis kommt beim nächsten Start wieder
  }
  notify();
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // kein Browser-Banner, stattdessen unser Knopf auf dem Startbildschirm
  deferred = e;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});
