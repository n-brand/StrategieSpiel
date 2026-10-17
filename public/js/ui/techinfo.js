// Ausführliche Beschreibung jeder Technik für die Detailkarte im Forschungsbaum:
// ein Satz, wozu sie gut ist, und – aus den Spielregeln abgeleitet – was sie genau freischaltet
// (Einheiten mit Werten, Bauten und Aktionen mit Kosten und Wirkung, besondere Wirkungen).
// Reine Daten ohne DOM – geprüft in tests/techtree.test.mjs.

import {
  UNITS, NAVAL, NAVAL_UPGRADE, ACTIONS, SKILL_NAMES, TERRAIN_NAMES, RESOURCE_NAMES, BUILDING_NAMES, MARKET_SOURCES,
  BONUS_DEFENSE, SCORE, SIGHT, MOUNTAIN_SIGHT,
} from '../game/rules.js';

export const TECH_ABOUT = {
  climbing: 'Deine Einheiten können Berge betreten. Von dort sehen sie weiter und sind besser geschützt. Öffnet den Weg zu Bergbau und Meditation.',
  mining: 'Erz in den Bergen wird nutzbar – Minen lassen deine Städte schnell wachsen.',
  smithery: 'Starke Schwertkämpfer und die Schmiede, die neben Minen besonders viele Einwohner bringt.',
  meditation: 'Tempel auf Bergen bringen Einwohner und viele Punkte.',
  philosophy: 'Der Gedankenformer heilt deine Einheiten und holt Gegner auf deine Seite. Danach wird jede Forschung günstiger.',
  fishing: 'Fische fangen, Häfen bauen und mit Booten über das Flachwasser fahren.',
  whaling: 'Wale auf dem offenen Ozean bringen auf einen Schlag viele Sterne.',
  aquatism: 'Tempel auf dem Wasser und bessere Verteidigung für alle Einheiten im Wasser.',
  sailing: 'Boote werden zu Schiffen: stärker, schneller und auch auf dem offenen Ozean unterwegs.',
  navigation: 'Schiffe werden zu Schlachtschiffen – den stärksten Einheiten auf dem Wasser.',
  hunting: 'Wild im Wald jagen bringt deinen Städten Einwohner.',
  archery: 'Bogenschützen greifen aus der Entfernung an. Im Wald verteidigen sich deine Einheiten besser.',
  spiritualism: 'Tempel im Wald und neuer Wald, wo du ihn brauchst.',
  forestry: 'Holzfällerhütten bringen Einwohner. Wald lässt sich roden – das gibt einen Stern und Platz zum Bauen.',
  mathematics: 'Katapulte schießen weit und hart. Sägewerke lohnen sich neben Holzfällerhütten.',
  organization: 'Früchte ernten – der einfachste Weg, deine Städte wachsen zu lassen.',
  farming: 'Bauernhöfe auf Getreide bringen viele Einwohner.',
  construction: 'Windmühlen neben Bauernhöfen bringen weitere Einwohner. Brennst du Wald ab, entsteht neues Ackerland.',
  strategy: 'Verteidiger halten deine Städte: viel Leben und starke Abwehr.',
  diplomacy: 'Du weißt sofort, wo die Hauptstädte aller anderen Stämme liegen.',
  riding: 'Reiter sind schnell und können sich nach einem Angriff zurückziehen.',
  roads: 'Auf Straßen kommen deine Einheiten weiter – wie weit, hängt von der Einheit ab. Am Straßenende geht es noch ein Feld weiter.',
  trade: 'Märkte bringen jede Runde zusätzliche Sterne – je mehr Werkstätten daneben, desto mehr.',
  freespirit: 'Tempel auf Wiesen bringen Einwohner und viele Punkte.',
  chivalry: 'Ritter sind sehr schnell und greifen nach einem Sieg gleich noch einmal an.',
};

const num = (n) => String(n).replace('.', ',');
const factor = `×${num(BONUS_DEFENSE)}`;

// Besondere Wirkungen, die in keiner Tabelle stehen
const EFFECTS = {
  climbing: [
    ['Weitsicht', `Einheiten können Berge betreten und sehen von dort ${MOUNTAIN_SIGHT} Felder weit (sonst ${SIGHT}).`],
    ['Bergschutz', `Auf Bergen verteidigen sich deine Einheiten ${factor} so gut: weniger Schaden, stärkerer Gegenschlag.`],
  ],
  archery: [['Waldschutz', `Im Wald verteidigen sich deine Einheiten ${factor} so gut: weniger Schaden, stärkerer Gegenschlag.`]],
  aquatism: [['Wasserschutz', `Im Wasser verteidigen sich deine Einheiten ${factor} so gut: weniger Schaden, stärkerer Gegenschlag.`]],
  philosophy: [['Gelehrsamkeit', 'Jede weitere Forschung kostet ein Drittel weniger.']],
  diplomacy: [['Botschafter', 'Die Hauptstädte aller anderen Stämme werden sofort sichtbar.']],
};

const skill = (id) => SKILL_NAMES[id].split(':')[0];
const terrains = (list) => list.map((t) => TERRAIN_NAMES[t]).join(' oder ');
// „auf einer Wiese“, „im Wald“ … – zweite Form, wenn das Feld frei sein muss
const PLACE = {
  field: ['auf einer Wiese', 'auf einer freien Wiese'],
  forest: ['im Wald', 'in freiem Wald'],
  mountain: ['auf einem Berg', 'auf einem freien Berg'],
  shallow: ['im Flachwasser', 'in freiem Flachwasser'],
  ocean: ['auf dem Ozean', 'auf freiem Ozean'],
};
const WITH = { fruit: 'Früchten', crop: 'Getreide', animal: 'Wild', fish: 'Fischen', ore: 'Erz', whale: 'Walen' };

// „Krieger 3, Reiter 5, …“ – Straßen-Reichweite je Einheit, aus den Regeln
const ROAD_LIST = Object.values(UNITS)
  .filter((u) => !u.special)
  .map((u) => `${u.name} ${u.road}`)
  .join(', ');

function stats(u) {
  return [`Angriff ${num(u.atk)}`, `Abwehr ${num(u.def)}`, u.hp ? `Leben ${u.hp}` : '', `Bewegung ${u.move}`, u.road ? `Straße ${u.road}` : '', u.range > 1 ? `Reichweite ${u.range}` : '']
    .filter(Boolean)
    .join(' · ');
}

function actionText(a) {
  const where = a.to
    ? `${terrains(a.on)} wird ${TERRAIN_NAMES[a.to]}${a.addRes ? ` mit ${RESOURCE_NAMES[a.addRes]}` : ''}`
    : `${a.on.map((t) => PLACE[t][a.empty ? 1 : 0]).join(' oder ')}${a.res ? ` mit ${WITH[a.res]}` : ''}`;
  const parts = [where];
  if (a.pop) parts.push(`+${a.pop} Einwohner`);
  if (a.adj) parts.push(`+${a.per} Einwohner je ${BUILDING_NAMES[a.adj]} daneben`);
  if (a.stars) parts.push(`+${a.stars} ★ sofort`);
  if (a.build === 'temple') parts.push(`+${SCORE.temple} Punkte`);
  if (a.build === 'market') parts.push(`+1 ★ pro Runde je ${[...MARKET_SOURCES].map((b) => BUILDING_NAMES[b]).join(', ').replace(/, ([^,]*)$/, ' oder $1')} daneben`);
  if (a.build === 'port') parts.push('hier steigen Einheiten in Boote');
  if (a.road) parts.push(`pro Zug auf Straßen bis zu: ${ROAD_LIST}`);
  if (a.unique) parts.push('einmal pro Stadt');
  return parts.join(' · ');
}

// Alles, was eine Technik freischaltet: [{ kind, name, cost, text }]
export function techDetails(id) {
  const items = [];
  for (const u of Object.values(UNITS)) {
    if (u.tech === id) items.push({ kind: 'Einheit', name: u.name, cost: `${u.cost} ★`, text: [stats(u), u.skills.map(skill).join(', ')].filter(Boolean).join(' · ') });
  }
  for (const [kind, n] of Object.entries(NAVAL)) {
    if (n.tech !== id) continue;
    const from = Object.keys(NAVAL_UPGRADE).find((k) => NAVAL_UPGRADE[k] === kind);
    const how = from ? `${NAVAL[from].name} aufrüsten` : 'Einheiten auf deinem Hafen werden zum Boot';
    items.push({ kind: 'Schiff', name: n.name, cost: n.cost ? `${n.cost} ★` : 'frei', text: `${how} · ${stats(n)} · ${n.ocean ? 'auch auf dem Ozean' : 'nur Flachwasser'}` });
  }
  for (const a of Object.values(ACTIONS)) {
    if (a.tech === id) items.push({ kind: a.build ? 'Bau' : 'Aktion', name: a.name, cost: a.cost ? `${a.cost} ★` : 'kostenlos', text: actionText(a) });
  }
  for (const [name, text] of EFFECTS[id] || []) items.push({ kind: 'Wirkung', name, cost: '', text });
  return { about: TECH_ABOUT[id], items };
}
