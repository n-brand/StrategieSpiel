// 2D-Icons für den Forschungsbaum im Stil der Website (GameHub): flache Farbflächen, etwas dunklere
// Kontur, kleiner weißer Glanz – wie das Stern-Icon. Eigene Zeichnungen, Raster 48 × 48.
// TECH_ICON_SVG[id] liefert den Inhalt für <svg viewBox="0 0 48 48">.

const SW = 2; // Konturbreite

const path = (d, fill, stroke, w = SW, extra = '') =>
  `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"` : ''}${extra}/>`;
const line = (d, stroke, w = SW) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
// Stiel mit Kontur (Griffe, Bogen): erst breit dunkel, dann schmaler hell
const rod = (d, fill, stroke, w) => line(d, stroke, w + 2.8) + line(d, fill, w);
const circle = (cx, cy, r, fill, stroke = null, w = SW) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${w}"` : ''}/>`;
const ellipse = (cx, cy, rx, ry, rot, fill, stroke, w = SW) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const shine = (d, w = 2) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity=".75"/>`;
const waves = (y, color = '#4dabf7') => line(`M4 ${y}q5 -3.5 10 0t10 0t10 0t10 0`, color, 2.6);
const sparkle = (x, y, r) => {
  const k = r * 0.32;
  return path(`M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`, '#fcc419', '#e67700', 1.2);
};
const group = (transform, ...parts) => `<g transform="${transform}">${parts.join('')}</g>`;

// Farben (Fläche, Kontur)
const STONE = ['#ced4da', '#868e96'];
const WOOD = ['#c08552', '#6b3f1d'];
const METAL = ['#e9ecef', '#495057'];
const GOLD = ['#fcc419', '#e67700'];
const RED = ['#fa5252', '#c92a2a'];

export const TECH_ICON_SVG = {
  // ---------- Klettern ----------
  climbing: [
    path('M25 42L35 23L45 42Z', '#adb5bd', '#868e96'),
    path('M4 42L21 10L38 42Z', ...STONE),
    path('M21 10L38 42H26Z', '#adb5bd', null),
    path('M21 10L26.6 20.4L23.6 18.6L21 21.6L18.2 18.8L15.4 20.4Z', '#fff', '#868e96', 1.4),
    line('M4 42L21 10L38 42Z', '#868e96'),
    line('M21 10V3', '#495057', 1.8),
    path('M21.6 3.2L28.6 5.2L21.6 7.2Z', ...RED, 1.2),
  ].join(''),
  mining: [
    path('M7 42L11 30L21 25L32 28L40 42Z', '#adb5bd', '#6c757d'),
    path('M21 25L32 28L40 42H27Z', '#868e96', null),
    line('M7 42L11 30L21 25L32 28L40 42Z', '#6c757d'),
    circle(16, 35, 2.8, ...GOLD, 1.2),
    circle(27, 33, 2.3, ...GOLD, 1.2),
    circle(23, 39, 1.9, ...GOLD, 1.2),
    // Spitzhacke: Kopf symmetrisch, Stiel mittig und rechtwinklig – schräg gestellt, Spitze trifft das Erz
    group(
      'translate(21 14) rotate(-35)',
      rod('M0 2V27', WOOD[0], WOOD[1], 3.4),
      path('M-17 7Q0 -11 17 7Q0 -1 -17 7Z', ...METAL, 1.8),
      path('M-2.6 -2.2H2.6V4.6H-2.6Z', '#868e96', '#495057', 1.4),
      shine('M-9 2.2Q0 -3.4 9 2.2', 1.4),
    ),
  ].join(''),
  smithery: [
    path('M7 30H42L34 35H29.5L32 41H13L15.5 35H10Q7 35 7 32.5Z', '#868e96', '#343a40', 1.8),
    shine('M10.5 31.6H31', 1.6),
    group(
      'rotate(-40 25 17)',
      path('M25 1L28.4 6.4V22H21.6V6.4Z', '#f8f9fa', '#495057', 1.6),
      line('M25 6V20', '#ced4da', 1.4),
      path('M17.5 22H32.5V25.6H17.5Z', ...GOLD, 1.6),
      path('M23.2 25.6H26.8V32.5H23.2Z', '#9c6638', WOOD[1], 1.4),
      circle(25, 34.3, 2.4, ...GOLD, 1.4),
    ),
  ].join(''),
  meditation: [
    path('M4 43L17 22H31L44 43Z', ...STONE),
    path('M24 22H31L44 43H29Z', '#adb5bd', null),
    line('M4 43L17 22H31L44 43Z', '#868e96'),
    path('M17 13H31V22H17Z', '#fff', '#868e96', 1.6),
    path('M22 15.5H26V22H22Z', '#495057', null),
    path('M11 13.5Q18 12.5 24 4.5Q30 12.5 37 13.5Z', ...RED, 1.8),
  ].join(''),
  philosophy: [
    path('M4 15V40Q14 37 24 41Q34 37 44 40V15Z', '#4dabf7', '#1864ab'),
    path('M24 14Q16 9 7 11V36Q16 34 24 38Z', '#fff', '#868e96', 1.6),
    path('M24 14Q32 9 41 11V36Q32 34 24 38Z', '#f1f3f5', '#868e96', 1.6),
    line('M11 17.5Q15.5 16.5 20 18.5M11 22.5Q15.5 21.5 20 23.5M11 27.5Q15.5 26.5 20 28.5M28 18.5Q32.5 16.5 37 17.5M28 23.5Q32.5 21.5 37 22.5M28 28.5Q32.5 26.5 37 27.5', '#adb5bd', 1.4),
    sparkle(24, 6, 5),
  ].join(''),

  // ---------- Fischen ----------
  fishing: [
    waves(42),
    path('M32.5 23L43 15.5L41 23L43 30.5Z', '#ff922b', '#d9480f', 1.8),
    path('M16 16Q20.5 9.5 27 15.5Z', '#ff922b', '#d9480f', 1.6),
    path('M6 23Q18.5 9 33.5 23Q18.5 37 6 23Z', '#ffa94d', '#d9480f', 1.8),
    line('M18.5 17.5Q16 23 18.5 28.5', '#d9480f', 1.4),
    circle(12.5, 21.5, 2, '#343a40'),
    shine('M11 18Q16 14.5 23 15.5', 1.8),
  ].join(''),
  whaling: [
    waves(43),
    line('M17 13Q15 8 11 7M17 13Q19 8 23 7M17 13V5.5', '#74c0fc', 2.2),
    path('M37.5 25L45 18.5L44.5 25.5L46 32.5Z', '#5c7cfa', '#364fc7', 1.8),
    path('M4 27.5Q5 15.5 21.5 15.5Q35.5 15.5 38.5 24.5Q40.5 34 28.5 35H12.5Q4 35 4 27.5Z', '#5c7cfa', '#364fc7', 1.8),
    path('M6.5 30Q13.5 34.5 28.5 33.6Q35.5 33 37.6 29.6Q29.5 30.8 21.5 30.8Q12.5 30.8 6.5 30Z', '#dbe4ff', null),
    circle(12.5, 24.5, 1.7, '#212529'),
    shine('M10 20Q15.5 16.8 23 17.2', 1.8),
  ].join(''),
  aquatism: [
    path('M24 4C24 4 10 20 10 29A14 14 0 0 0 38 29C38 20 24 4 24 4Z', '#4dabf7', '#1864ab'),
    line('M14 33q3.3 -2.8 6.6 0t6.6 0t6.6 0', '#fff', 2.2),
    shine('M16.5 26Q17 20 21.5 15', 2.4),
  ].join(''),
  sailing: [
    waves(44),
    line('M24 5V33', WOOD[1], 2.4),
    path('M25.6 8L39 30H25.6Z', '#fff', '#868e96', 1.6),
    path('M22.4 12L12 30H22.4Z', '#f1f3f5', '#868e96', 1.6),
    path('M24 4.6L30.5 6.4L24 8.2Z', ...RED, 1.1),
    path('M7 32H41L36 40H12Z', ...WOOD),
    shine('M11 34.2H32', 1.6),
  ].join(''),
  navigation: [
    circle(24, 24, 19, ...GOLD),
    circle(24, 24, 14.5, '#fff', '#e67700', 1.4),
    line('M24 11.5V14M24 34V36.5M11.5 24H14M34 24H36.5', '#adb5bd', 1.6),
    group('rotate(35 24 24)', path('M24 12.5L28 24H20Z', ...RED, 1.2), path('M24 35.5L20 24H28Z', '#868e96', '#495057', 1.2)),
    circle(24, 24, 2, '#343a40'),
  ].join(''),

  // ---------- Jagd ----------
  hunting: [
    path('M24 25C30.5 25 35.5 30.5 35.5 35.5C35.5 40.5 30.5 41 24 39C17.5 41 12.5 40.5 12.5 35.5C12.5 30.5 17.5 25 24 25Z', '#b07a4a', WOOD[1]),
    ellipse(12, 20, 3.6, 4.8, -25, '#b07a4a', WOOD[1]),
    ellipse(19.5, 12.5, 3.8, 5.2, -8, '#b07a4a', WOOD[1]),
    ellipse(28.5, 12.5, 3.8, 5.2, 8, '#b07a4a', WOOD[1]),
    ellipse(36, 20, 3.6, 4.8, 25, '#b07a4a', WOOD[1]),
    shine('M17.5 30Q20 27.6 24 27.4', 1.6),
  ].join(''),
  archery: group(
    'rotate(-40 24 24)',
    rod('M15 5Q35 24 15 43', WOOD[0], WOOD[1], 3.2),
    line('M15 5V43', '#495057', 1.2),
    line('M6 24H39', '#7a4a24', 2.2),
    path('M43.5 24L36 19.8L37.8 24L36 28.2Z', '#ced4da', '#495057', 1.4),
    path('M10.5 24L5.5 19.5H9.5L13.5 24Z', ...RED, 1.1),
    path('M10.5 24L5.5 28.5H9.5L13.5 24Z', ...RED, 1.1),
  ),
  spiritualism: [
    path('M8 42Q24 31 40 42Z', '#9c6638', WOOD[1]),
    line('M24 37V20', '#2b8a3e', 3),
    path('M24 27C16 27 11.5 21 11.5 16.5C18 16.5 24 19.5 24 27Z', '#69db7c', '#2b8a3e', 1.8),
    path('M24 22.5C31 22.5 36.5 17 36.5 12C29.5 12 24 15.5 24 22.5Z', '#8ce99a', '#2b8a3e', 1.8),
    sparkle(11, 8, 4.5),
    sparkle(37.5, 30, 3.5),
  ].join(''),
  forestry: [
    path('M10 31V39Q24 45 38 39V31Z', '#b07a4a', '#7a4a24'),
    ellipse(24, 31, 14, 4.6, 0, '#f2c48d', '#7a4a24'),
    ellipse(24, 31, 7.5, 2.2, 0, 'none', '#c08552', 1.4),
    group(
      'rotate(28 24 20)',
      rod('M24 8V33', WOOD[0], WOOD[1], 3.2),
      path('M19.5 6.5H27L36.5 2.5Q40.5 11 36.5 19.5L27 15.5H19.5Z', '#adb5bd', '#495057', 1.8),
      line('M35.6 4.8Q38.6 11 35.6 17.2', '#f8f9fa', 2.2),
    ),
  ].join(''),
  mathematics: [
    path('M6 42V9L39 42Z M12 36H25L12 23Z', '#ffe066', '#e67700', SW, ' fill-rule="evenodd"'),
    line('M6 15H9.5M6 20H9.5M6 25H9.5M6 30H9.5M6 35H9.5', '#e67700', 1.4),
    group(
      'rotate(40 32 20)',
      path('M29 4H35V29H29Z', ...RED, 1.6),
      path('M29 4H35V8.5H29Z', '#ffc9c9', '#c92a2a', 1.4),
      path('M29 29H35L32 35.5Z', '#f2c48d', '#7a4a24', 1.4),
      path('M31 33.2H33L32 35.5Z', '#343a40', null),
    ),
  ].join(''),

  // ---------- Organisation ----------
  organization: [
    circle(24, 20, 8, '#ff6b6b', '#a51111'),
    circle(16.5, 30, 8, '#f03e3e', '#a51111'),
    circle(31.5, 30, 8, '#f03e3e', '#a51111'),
    line('M24 12V7.5', '#2b8a3e', 2),
    path('M24 8.5C27 3.5 33 3 36 5C33.5 9 28.5 10 24 8.5Z', '#51cf66', '#2b8a3e', 1.6),
    circle(20.5, 17, 1.9, '#fff'),
    circle(13, 27, 1.9, '#fff'),
    circle(28, 27, 1.9, '#fff'),
  ].join(''),
  farming: [
    path('M24 41Q15 38 12 30Q20 32 24 39Z', '#94d82d', '#5c940d', 1.5),
    path('M24 41Q33 38 36 30Q28 32 24 39Z', '#94d82d', '#5c940d', 1.5),
    line('M24 45V12', '#e67700', 2.4),
    ...[14, 20, 26, 32].flatMap((y) => [ellipse(19.6, y + 2, 3, 5.4, -35, '#ffd43b', '#e67700', 1.5), ellipse(28.4, y + 2, 3, 5.4, 35, '#ffd43b', '#e67700', 1.5)]),
    ellipse(24, 9, 3, 5.4, 0, '#ffd43b', '#e67700', 1.5),
  ].join(''),
  construction: [
    path('M17 43L20.5 20H27.5L31 43Z', '#fff', null),
    path('M24 20H27.5L31 43H24Z', '#e9ecef', null),
    line('M17 43L20.5 20H27.5L31 43Z', '#868e96'),
    path('M22 43V37Q24 34.5 26 37V43Z', '#9c6638', WOOD[1], 1.4),
    path('M18.5 21L24 13.5L29.5 21Z', ...RED, 1.8),
    ...[45, 135, 225, 315].map((a) => group(`rotate(${a} 24 16)`, path('M24 16L25.5 2.5H30L26.5 16.5Z', '#f8f9fa', '#868e96', 1.4), line('M25.4 6H29.4M25 10H28.4', '#adb5bd', 1))),
    circle(24, 16, 2.4, '#495057'),
  ].join(''),
  strategy: [
    path('M24 4.5L39.5 10V22C39.5 32 32.5 39.5 24 43.5C15.5 39.5 8.5 32 8.5 22V10Z', '#dee2e6', '#495057'),
    path('M24 9L35 13V22.5C35 29.5 30 35 24 38.5C18 35 13 29.5 13 22.5V13Z', ...RED, 1.4),
    path('M24 15L26.4 20.2L32 20.8L27.8 24.6L29 30.2L24 27.3L19 30.2L20.2 24.6L16 20.8L21.6 20.2Z', '#fff', null),
    shine('M12.5 12.5L21.5 9.5', 1.8),
  ].join(''),
  diplomacy: [
    path('M9 9H33Q37 9 37 13V37H13Q9 37 9 33Z', '#fff3bf', '#c29b2f'),
    path('M9 9Q5 9 5 13Q5 17 9 17H13V13Q13 9 9 9Z', '#ffe8a3', '#c29b2f', 1.6),
    line('M17 16H32M17 21H32M17 26H26', '#d4b04a', 2),
    path('M28 39L26 46L30 43.5L33.5 46L33 39Z', '#e03131', '#a51111', 1.2),
    circle(31, 34, 6.5, '#e03131', '#a51111'),
    circle(31, 34, 3.2, 'none', '#ff8787', 1.4),
  ].join(''),

  // ---------- Reiten ----------
  riding: [
    line('M13 8V24A11 11 0 0 0 35 24V8', '#495057', 10.5),
    line('M13 8V24A11 11 0 0 0 35 24V8', '#ced4da', 7),
    ...[[13, 12], [13, 19], [14.4, 27], [35, 12], [35, 19], [33.6, 27]].map(([x, y]) => circle(x, y, 1.3, '#495057')),
    shine('M11.4 10V22', 1.4),
  ].join(''),
  roads: [
    path('M2 43Q6 35.5 12 43Z', '#69db7c', '#2b8a3e', 1.4),
    path('M36 43Q42 35.5 46 43Z', '#69db7c', '#2b8a3e', 1.4),
    path('M19 6H29L42 43H6Z', '#d8b87c', '#a0763a'),
    line('M24 10.5V14.5M24 19.5V25M24 30.5V38', '#fff8e1', 2.6),
  ].join(''),
  trade: [
    line('M11 19V31M37 19V31', '#7a4a24', 2.6),
    path('M8 30H40V40H8Z', WOOD[0], '#7a4a24'),
    shine('M11 32.6H29', 1.6),
    circle(16.5, 27, 3.2, ...GOLD, 1.4),
    circle(24, 27, 3.2, '#ff6b6b', '#c92a2a', 1.4),
    circle(31.5, 27, 3.2, '#69db7c', '#2b8a3e', 1.4),
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const x = 6 + i * 6;
      return path(`M${x} 9H${x + 6}V17A3 3 0 0 1 ${x} 17Z`, i % 2 ? '#fff' : '#fa5252', '#c92a2a', 1.2);
    }),
    line('M5 9H43', '#c92a2a', 2.6),
  ].join(''),
  freespirit: [
    path('M8 37H40V42H8Z', '#dee2e6', '#868e96', 1.8),
    ...[12, 19.5, 27, 34.5].map((x) => path(`M${x - 1.8} 21H${x + 1.8}V37H${x - 1.8}Z`, '#fff', '#868e96', 1.4)),
    path('M9 17H39V21.5H9Z', '#f1f3f5', '#868e96', 1.6),
    path('M7 17L24 7.5L41 17Z', ...GOLD),
    shine('M14 15.4L24 10', 1.6),
  ].join(''),
  chivalry: [
    path('M24 9C24 3 31 1.5 38 4C33 5 30 8 30 12.5C28 10 26 9 24 9Z', ...RED, 1.6),
    path('M14 40V23C14 14 18.5 9 24 9C29.5 9 34 14 34 23V40Z', '#dee2e6', null),
    path('M24 9C29.5 9 34 14 34 23V40H27V23C27 15 25.5 10.5 24 9Z', '#ced4da', null),
    line('M14 40V23C14 14 18.5 9 24 9C29.5 9 34 14 34 23V40Z', '#495057'),
    line('M17.5 24.5H30.5M17.5 29H30.5', '#495057', 2.2),
    line('M24 9V19', '#adb5bd', 1.6),
    path('M11.5 40H36.5V44H11.5Z', '#adb5bd', '#495057', 1.8),
    shine('M17 20Q18 14 22 11.5', 1.8),
  ].join(''),
};
