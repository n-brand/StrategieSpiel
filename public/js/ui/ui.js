// Kleine Oberflächen-Bausteine: Symbole, Einblendungen und Fenster (unten als Blatt, auf dem PC mittig).

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (n) => new Intl.NumberFormat('de-DE').format(n || 0);

export const ICONS = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z" fill="#fcc419" stroke="#e67700" stroke-width="1.4" stroke-linejoin="round"/><path d="M8.6 9.4l2.2-.3" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".8"/></svg>',
  flask: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.4 15h9.2l2 3.4a1 1 0 0 1-.9 1.6H6.3a1 1 0 0 1-.9-1.6Z" fill="currentColor"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="7.4" r="1.5" fill="currentColor"/></svg>',
  music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.8" fill="currentColor"/><circle cx="16.5" cy="16" r="2.8" fill="currentColor"/></svg>',
  boat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11M12 4l6 9h-6" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3.5 16h17l-2.5 4h-12Z" fill="currentColor"/></svg>',
  mountain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 19 9.5 6l4 7 2-3 6 9Z" fill="currentColor"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6Z" fill="currentColor"/></svg>',
  shadow: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="5" fill="currentColor"/><ellipse cx="12" cy="19" rx="7" ry="2.4" fill="currentColor" opacity=".45"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11m0-11-11 11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0Z" fill="currentColor"/><path d="M7 5H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 12.5h3V17h-3Z" fill="currentColor"/><rect x="7" y="17" width="10" height="4" rx="1.2" fill="currentColor"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4.5h11l-2.5 4 2.5 4H6Z" fill="currentColor"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.9c0 5.9-8 10.6-8 10.6Z" fill="#ff6b6b"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 8h-4.5v8h-5v-8H5Z" fill="#fcc419"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2Z" fill="#da77f2"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9.5l5 5m0-5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 4.5 5.4v6c0 4.9 3.2 9 7.5 10.6 4.3-1.6 7.5-5.7 7.5-10.6v-6Z" fill="currentColor"/></svg>',
  // Werte (Einheiten- und Stadtkarte)
  sword: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.1 2.9l-.6 3.5-10.6 10.6-3-3L17.5 3.4Z" fill="currentColor"/><path d="M5.4 12.5l6 6M8.4 15.5l-3.9 3.9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="3.8" cy="20.2" r="1.7" fill="currentColor"/></svg>',
  swords: '<svg viewBox="0 0 24 24" aria-hidden="true"><g><path d="M21 3l-.6 2.6-9.3 9.3-2-2L17.4 3.6Z" fill="currentColor"/><path d="M6.6 12.4l5 5M9.1 14.9l-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></g><g transform="matrix(-1 0 0 1 24 0)"><path d="M21 3l-.6 2.6-9.3 9.3-2-2L17.4 3.6Z" fill="currentColor"/><path d="M6.6 12.4l5 5M9.1 14.9l-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></g></svg>',
  boot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2.5h6.5v8.2l4.8 1.9a4 4 0 0 1 2.7 3.8V18H5.2L6 13.4Z" fill="currentColor"/><path d="M4.5 20.6h17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  road: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M9.2 2.5h5.6L21 21.5H3ZM11.3 5h1.4v3h-1.4Zm-.2 5.5h1.8V14h-1.8Zm-.3 6h2.4v3.5h-2.4Z"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.3" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  people: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor" opacity=".55"><circle cx="15.6" cy="7.4" r="3"/><path d="M10.8 20c.2-4 2.3-7 4.8-7s4.7 3 5 7Z"/></g><circle cx="9" cy="8.4" r="3.4" fill="currentColor"/><path d="M2.8 21c.3-4.5 2.9-7.8 6.2-7.8s5.9 3.3 6.2 7.8Z" fill="currentColor"/></svg>',
  pawn: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.3" r="3.6" fill="currentColor"/><path d="M8.3 19.6 9.7 12a2.3 2.3 0 0 1 2.3-1.9 2.3 2.3 0 0 1 2.3 1.9l1.4 7.6Z" fill="currentColor"/><path d="M6 20.8h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  fit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  ruin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V9M10 20v-7M14 20V7M18 20v-9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M5 7h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
};

export const starAmount = (n, extra = '') => `<span class="star">${ICONS.star}${fmt(n)}${extra}</span>`;

// ---------- Einblendungen ----------

export function toast({ title, text = '', icon = '', kind = '', duration = 2800 }) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const shown = box.querySelectorAll('.toast:not(.is-out)');
  if (shown.length >= 3) shown[0].remove();
  const el = document.createElement('div');
  el.className = `toast ${kind ? `toast--${kind}` : ''}`;
  el.innerHTML = `${icon ? `<span class="toast-icon">${icon}</span>` : ''}<span><b>${esc(title)}</b>${text ? `<small>${esc(text)}</small>` : ''}</span>`;
  box.append(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
  }, duration);
}

// ---------- Fenster ----------

let openCount = 0;
export const modalOpen = () => openCount > 0;

// Öffnet ein Fenster; schließt mit Esc, Tippen daneben oder [data-close] (außer closable: false)
export function openModal(html, { className = '', closable = true, onClose = null } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${className}" role="dialog" aria-modal="true">${closable ? `<button type="button" class="modal-close" data-close aria-label="Schließen">${ICONS.close}</button>` : ''}${html}</div>`;
  openCount++;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    openCount--;
    document.removeEventListener('keydown', onKey);
    backdrop.classList.add('is-out');
    setTimeout(() => backdrop.remove(), 180);
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && closable) close();
  };
  backdrop.addEventListener('click', (e) => {
    if (!closable) return;
    if (e.target === backdrop || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  return { el: backdrop.querySelector('.modal'), close };
}

// Vollbild-Ebene (z. B. Forschungsbaum): zählt wie ein Fenster; schließt mit Esc oder [data-close]
export function openLayer(html, { className = '', label = '', onClose = null } = {}) {
  const layer = document.createElement('div');
  layer.className = `layer ${className}`;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  if (label) layer.setAttribute('aria-label', label);
  layer.innerHTML = html;
  openCount++;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    openCount--;
    document.removeEventListener('keydown', onKey);
    layer.classList.add('is-out');
    setTimeout(() => layer.remove(), 180);
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  layer.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(layer);
  return { el: layer, close };
}
