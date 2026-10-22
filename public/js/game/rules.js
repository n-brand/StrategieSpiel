// Regeln und Kataloge von „StrategieSpiel“: Stämme, Gelände, Einheiten, Forschung, Kachel-Aktionen,
// Stadt-Belohnungen und Punkte. Reine Daten ohne Seite oder 3D – geprüft von tools/check-rules.mjs.
// Vorbild ist Polytopia; Namen, Werte im Detail und Grafik sind eigene.

export const START_STARS = 5;
export const TURN_LIMIT = 30;

// ---------- Gelände ----------

export const LAND = new Set(['field', 'forest', 'mountain']);
export const WATER = new Set(['shallow', 'ocean']);
export const isLand = (t) => LAND.has(t);
export const isWater = (t) => WATER.has(t);

export const TERRAIN_NAMES = { field: 'Wiese', forest: 'Wald', mountain: 'Berg', shallow: 'Flachwasser', ocean: 'Ozean' };
export const RESOURCE_NAMES = { fruit: 'Früchte', crop: 'Getreide', animal: 'Wild', fish: 'Fische', ore: 'Erz', whale: 'Wale' };

// ---------- Stämme ----------
// climate: Farben und Häufigkeiten für das Gelände rund um die Hauptstadt (wie die Klimazonen bei Polytopia)
// start: Ressource, die rund um die Hauptstadt garantiert ist (passend zur Start-Technik)

export const TRIBES = [
  {
    id: 'nord',
    name: 'Nordlinge',
    color: '#339af0',
    dark: '#1864ab',
    tech: 'hunting',
    unit: 'warrior',
    start: 'animal',
    text: 'Jäger aus kühlen Nadelwäldern mit viel Wild. Starten mit Jagd.',
    climate: {
      field: '#6f9f52', side: '#5c4433', tree: '#2c5e3c', tree2: '#3b7b4b', rock: '#8e959e', snow: true, palm: false,
      forest: 0.42, mountain: 0.16, fruit: 0.14, crop: 0.12, animal: 0.42, ore: 0.3, fish: 0.4, whale: 0.12,
    },
    names: {
      pre: ['Frost', 'Birken', 'Eis', 'Wolfs', 'Kiefern', 'Nebel', 'Schnee', 'Elch', 'Fjord', 'Rau', 'Tannen', 'Sturm'],
      post: ['heim', 'wald', 'berg', 'vik', 'stad', 'horn', 'tal', 'furt', 'holm', 'mark'],
    },
  },
  {
    id: 'stein',
    name: 'Steinvolk',
    color: '#f03e3e',
    dark: '#a51d1d',
    tech: 'climbing',
    unit: 'warrior',
    start: 'ore',
    text: 'Bergvolk mit reichen Erzadern zwischen roten Felsen. Starten mit Klettern.',
    climate: {
      field: '#a3a85e', side: '#6e4f37', tree: '#5d7d3c', tree2: '#708f45', rock: '#b0846a', snow: false, palm: false,
      forest: 0.2, mountain: 0.32, fruit: 0.14, crop: 0.16, animal: 0.25, ore: 0.45, fish: 0.3, whale: 0.1,
    },
    names: {
      pre: ['Fels', 'Granit', 'Erz', 'Grat', 'Basalt', 'Kupfer', 'Schiefer', 'Kamm', 'Klipp', 'Hammer', 'Quarz', 'Rot'],
      post: ['burg', 'stein', 'hold', 'grund', 'feste', 'wall', 'kuppe', 'spitz', 'eck', 'fels'],
    },
  },
  {
    id: 'eben',
    name: 'Ebenenreich',
    color: '#f59f00',
    dark: '#b86e00',
    tech: 'organization',
    unit: 'warrior',
    start: 'fruit',
    text: 'Bauern der fruchtbaren Ebenen voller Obst und Korn. Starten mit Organisation.',
    climate: {
      field: '#8cc657', side: '#7a5839', tree: '#3c8c3c', tree2: '#58a64b', rock: '#9aa1a8', snow: true, palm: false,
      forest: 0.26, mountain: 0.12, fruit: 0.36, crop: 0.3, animal: 0.25, ore: 0.25, fish: 0.35, whale: 0.1,
    },
    names: {
      pre: ['Sonnen', 'Korn', 'Apfel', 'Rosen', 'Linden', 'Weizen', 'Gold', 'Wiesen', 'Hain', 'Feld', 'Klee', 'Mohn'],
      post: ['au', 'hof', 'dorf', 'feld', 'bach', 'tal', 'garten', 'ingen', 'stett', 'rode'],
    },
  },
  {
    id: 'sand',
    name: 'Sandreiter',
    color: '#ae3ec9',
    dark: '#7a2690',
    tech: 'riding',
    unit: 'rider',
    start: 'crop',
    text: 'Reiter aus Wüsten mit Oasen und Palmen. Starten mit Reiten und einem Reiter.',
    climate: {
      field: '#e2c37a', side: '#b58a52', tree: '#78a548', tree2: '#92be58', rock: '#caa36d', snow: false, palm: true,
      forest: 0.12, mountain: 0.15, fruit: 0.18, crop: 0.24, animal: 0.2, ore: 0.3, fish: 0.35, whale: 0.12,
    },
    names: {
      pre: ['Dünen', 'Oasen', 'Sand', 'Glut', 'Palm', 'Sonnen', 'Wind', 'Staub', 'Karawan', 'Mirag', 'Dattel', 'Salz'],
      post: ['sar', 'abad', 'kesh', 'ra', 'mun', 'ir', 'dar', 'zan', 'kar', 'mir'],
    },
  },
];

export const tribeById = (id) => TRIBES.find((t) => t.id === id);

// ---------- Einheiten ----------
// road = so viele Felder schafft die Einheit pro Zug auf Straßen (zwischen Straßen und Städten) – leichte weit, schwere wenig
// skills: dash = nach Bewegung angreifen · escape = nach Angriff noch ziehen · persist = nach einem Sieg erneut
// angreifen · fortify = Verteidigungsbonus in eigenen Städten · heal/convert = Gedankenformer

export const UNITS = {
  warrior: { name: 'Krieger', cost: 2, hp: 10, atk: 2, def: 2, move: 1, road: 3, range: 1, skills: ['dash', 'fortify'], tech: null },
  rider: { name: 'Reiter', cost: 3, hp: 10, atk: 2, def: 1, move: 2, road: 5, range: 1, skills: ['dash', 'escape', 'fortify'], tech: 'riding' },
  archer: { name: 'Bogenschütze', cost: 3, hp: 10, atk: 2, def: 1, move: 1, road: 3, range: 2, skills: ['dash', 'fortify'], tech: 'archery' },
  defender: { name: 'Verteidiger', cost: 3, hp: 15, atk: 1, def: 3, move: 1, road: 2, range: 1, skills: ['fortify'], tech: 'strategy' },
  swordsman: { name: 'Schwertkämpfer', cost: 5, hp: 15, atk: 3, def: 3, move: 1, road: 3, range: 1, skills: ['dash'], tech: 'smithery' },
  catapult: { name: 'Katapult', cost: 8, hp: 10, atk: 4, def: 0, move: 1, road: 2, range: 3, skills: [], tech: 'mathematics' },
  knight: { name: 'Ritter', cost: 8, hp: 10, atk: 3.5, def: 1, move: 3, road: 6, range: 1, skills: ['dash', 'persist', 'fortify'], tech: 'chivalry' },
  mindbender: { name: 'Gedankenformer', cost: 5, hp: 10, atk: 0, def: 1, move: 1, road: 3, range: 1, skills: ['heal', 'convert'], tech: 'philosophy' },
  giant: { name: 'Riese', cost: 10, hp: 40, atk: 5, def: 4, move: 1, road: 2, range: 1, skills: ['dash'], tech: null, special: true },
};

export const TRAINABLE = ['warrior', 'rider', 'archer', 'defender', 'swordsman', 'catapult', 'knight', 'mindbender'];

// Wasser: Eine Landeinheit, die auf einen eigenen Hafen zieht, wird zum Boot (Typ bleibt für das Anlanden).
// Boote fahren nur auf Flachwasser; mit Segeln zum Schiff aufrüsten (auch Ozean), mit Navigation zum Schlachtschiff.
// Lebenspunkte bleiben die der Einheit. Anlanden beendet den Zug.
export const NAVAL = {
  boat: { name: 'Boot', atk: 1, def: 1, move: 2, range: 2, skills: ['dash'], tech: 'fishing', ocean: false, cost: 0 },
  ship: { name: 'Schiff', atk: 2, def: 2, move: 3, range: 2, skills: ['dash'], tech: 'sailing', ocean: true, cost: 5 },
  battleship: { name: 'Schlachtschiff', atk: 4, def: 3, move: 3, range: 2, skills: ['dash'], tech: 'navigation', ocean: true, cost: 15 },
};
export const NAVAL_UPGRADE = { boat: 'ship', ship: 'battleship' };

export const SKILL_NAMES = {
  dash: 'Vorstoß: greift auch nach einer Bewegung an',
  escape: 'Rückzug: kann nach dem Angriff noch ziehen',
  persist: 'Ausdauer: greift nach einem Sieg erneut an',
  fortify: 'Verschanzen: in eigenen Städten stärker',
  heal: 'Heilen: heilt Nachbarn um 4',
  convert: 'Bekehren: holt Gegner auf die eigene Seite',
};

export const hasSkill = (type, skill) => UNITS[type].skills.includes(skill);

// Kampf: Schaden wie bei Polytopia – Angriffs- und Verteidigungskraft nach Lebenspunkten gewichtet
export const DAMAGE_FACTOR = 4.5;
export const BONUS_DEFENSE = 1.5; // verschanzt in der Stadt oder passendes Gelände
export const SIGHT = 1; // so weit deckt eine Einheit beim Ziehen auf
export const MOUNTAIN_SIGHT = 2; // auf Bergen weiter
export const WALL_DEFENSE = 4; // Stadtmauer
export const VETERAN_KILLS = 3;
export const DISBAND_TECH = 'freespirit'; // Einheiten auflösen erst mit Freigeist
export const VETERAN_HP = 5;
export const HEAL_OWN = 4; // Erholen im eigenen Gebiet
export const HEAL_OTHER = 2; // Erholen außerhalb
export const HEAL_MIND = 4; // Gedankenformer heilt Nachbarn

// ---------- Forschung ----------
// 5 Äste mit je einer Grundtechnik (Stufe 1), zwei Folgetechniken (Stufe 2) und je einer dritten Stufe.
// Kosten = Stufe × Anzahl Städte + 4 (mit Philosophie ein Drittel günstiger).

export const TECHS = {
  climbing: { name: 'Klettern', tier: 1, parent: null, text: 'Berge betreten – dort weitere Sicht und mehr Schutz' },
  mining: { name: 'Bergbau', tier: 2, parent: 'climbing', text: 'Mine auf Erz' },
  smithery: { name: 'Schmieden', tier: 3, parent: 'mining', text: 'Schwertkämpfer, Schmiede' },
  meditation: { name: 'Meditation', tier: 2, parent: 'climbing', text: 'Bergtempel' },
  philosophy: { name: 'Philosophie', tier: 3, parent: 'meditation', text: 'Gedankenformer, Forschung ⅓ günstiger' },

  fishing: { name: 'Fischen', tier: 1, parent: null, text: 'Fischen, Hafen – über Häfen in Booten aufs Flachwasser' },
  whaling: { name: 'Walfang', tier: 2, parent: 'fishing', text: 'Wale fangen (+10 ★)' },
  aquatism: { name: 'Aquatismus', tier: 3, parent: 'whaling', text: 'Wassertempel, Verteidigung im Wasser' },
  sailing: { name: 'Segeln', tier: 2, parent: 'fishing', text: 'Boote zu Schiffen aufrüsten – auch auf den Ozean' },
  navigation: { name: 'Navigation', tier: 3, parent: 'sailing', text: 'Schiffe zu Schlachtschiffen aufrüsten' },

  hunting: { name: 'Jagd', tier: 1, parent: null, text: 'Wild jagen' },
  archery: { name: 'Bogenschießen', tier: 2, parent: 'hunting', text: 'Bogenschütze, Verteidigung im Wald' },
  spiritualism: { name: 'Spiritualismus', tier: 3, parent: 'archery', text: 'Waldtempel, Wald pflanzen' },
  forestry: { name: 'Forstwirtschaft', tier: 2, parent: 'hunting', text: 'Holzfällerhütte, Wald roden' },
  mathematics: { name: 'Mathematik', tier: 3, parent: 'forestry', text: 'Katapult, Sägewerk' },

  organization: { name: 'Organisation', tier: 1, parent: null, text: 'Früchte ernten' },
  farming: { name: 'Landwirtschaft', tier: 2, parent: 'organization', text: 'Bauernhof' },
  construction: { name: 'Bauwesen', tier: 3, parent: 'farming', text: 'Windmühle, Wald abbrennen' },
  strategy: { name: 'Strategie', tier: 2, parent: 'organization', text: 'Verteidiger' },
  diplomacy: { name: 'Diplomatie', tier: 3, parent: 'strategy', text: 'Alle Hauptstädte sichtbar' },

  riding: { name: 'Reiten', tier: 1, parent: null, text: 'Reiter' },
  roads: { name: 'Straßen', tier: 2, parent: 'riding', text: 'Straßen – Einheiten kommen weiter (je nach Einheit)' },
  trade: { name: 'Handel', tier: 3, parent: 'roads', text: 'Markt (+★ je Werkstatt-Gebäude daneben)' },
  freespirit: { name: 'Freigeist', tier: 2, parent: 'riding', text: 'Tempel, Auflösen' },
  chivalry: { name: 'Ritterlichkeit', tier: 3, parent: 'freespirit', text: 'Ritter' },
};

// Äste in Anzeige-Reihenfolge: Wurzel, dann je Kette [Stufe 2, Stufe 3]
export const TECH_TREE = [
  { root: 'climbing', chains: [['mining', 'smithery'], ['meditation', 'philosophy']] },
  { root: 'fishing', chains: [['whaling', 'aquatism'], ['sailing', 'navigation']] },
  { root: 'hunting', chains: [['archery', 'spiritualism'], ['forestry', 'mathematics']] },
  { root: 'organization', chains: [['farming', 'construction'], ['strategy', 'diplomacy']] },
  { root: 'riding', chains: [['roads', 'trade'], ['freespirit', 'chivalry']] },
];

export const LITERACY = 0.67; // Philosophie

// ---------- Kachel-Aktionen ----------
// on: Gelände; res: nötige Ressource (wird verbraucht); build: Gebäude, das stehen bleibt;
// pop: Einwohner für die Stadt, zu der die Kachel gehört; stars: Sterne sofort;
// adj: zählt angrenzende Gebäude dieser Art (pop je Gebäude = per); unique: einmal pro Stadt

export const ACTIONS = {
  harvest: { name: 'Früchte ernten', tech: 'organization', cost: 2, on: ['field'], res: 'fruit', pop: 1 },
  hunt: { name: 'Jagen', tech: 'hunting', cost: 2, on: ['forest'], res: 'animal', pop: 1 },
  fish: { name: 'Fischen', tech: 'fishing', cost: 2, on: ['shallow'], res: 'fish', pop: 1 },
  whale: { name: 'Wal fangen', tech: 'whaling', cost: 2, on: ['ocean'], res: 'whale', stars: 10 },
  farm: { name: 'Bauernhof', tech: 'farming', cost: 5, on: ['field'], res: 'crop', build: 'farm', pop: 2 },
  mine: { name: 'Mine', tech: 'mining', cost: 5, on: ['mountain'], res: 'ore', build: 'mine', pop: 2 },
  lumberhut: { name: 'Holzfällerhütte', tech: 'forestry', cost: 3, on: ['forest'], build: 'lumberhut', pop: 1, empty: true },
  clearforest: { name: 'Wald roden', tech: 'forestry', cost: 0, on: ['forest'], to: 'field', stars: 1, empty: true },
  burnforest: { name: 'Wald abbrennen', tech: 'construction', cost: 5, on: ['forest'], to: 'field', addRes: 'crop', empty: true },
  growforest: { name: 'Wald pflanzen', tech: 'spiritualism', cost: 5, on: ['field'], to: 'forest', empty: true },
  windmill: { name: 'Windmühle', tech: 'construction', cost: 5, on: ['field'], build: 'windmill', adj: 'farm', per: 1, unique: true, empty: true },
  sawmill: { name: 'Sägewerk', tech: 'mathematics', cost: 5, on: ['field'], build: 'sawmill', adj: 'lumberhut', per: 1, unique: true, empty: true },
  forge: { name: 'Schmiede', tech: 'smithery', cost: 5, on: ['field'], build: 'forge', adj: 'mine', per: 2, unique: true, empty: true },
  market: { name: 'Markt', tech: 'trade', cost: 5, on: ['field'], build: 'market', unique: true, empty: true },
  port: { name: 'Hafen', tech: 'fishing', cost: 7, on: ['shallow'], build: 'port', pop: 1, coast: true, empty: true },
  road: { name: 'Straße', tech: 'roads', cost: 3, on: ['field', 'forest'], road: true },
  temple: { name: 'Tempel', tech: 'freespirit', cost: 10, on: ['field'], build: 'temple', pop: 1, empty: true },
  foresttemple: { name: 'Waldtempel', tech: 'spiritualism', cost: 15, on: ['forest'], build: 'temple', pop: 1, empty: true },
  mountaintemple: { name: 'Bergtempel', tech: 'meditation', cost: 10, on: ['mountain'], build: 'temple', pop: 1, empty: true },
  watertemple: { name: 'Wassertempel', tech: 'aquatism', cost: 15, on: ['shallow', 'ocean'], build: 'temple', pop: 1, empty: true },
};

// Gebäude, die angrenzende Gebäude zählen: neu gebautes Gebäude der Art `adj` daneben gibt nachträglich `per`
export const ADJACENCY = { farm: ['windmill', 1], lumberhut: ['sawmill', 1], mine: ['forge', 2] };
// Markt: +1 ★ pro Runde je angrenzendem Werkstatt-Gebäude
export const MARKET_SOURCES = new Set(['windmill', 'sawmill', 'forge']);

export const BUILDING_NAMES = {
  farm: 'Bauernhof', mine: 'Mine', lumberhut: 'Holzfällerhütte', windmill: 'Windmühle', sawmill: 'Sägewerk',
  forge: 'Schmiede', market: 'Markt', port: 'Hafen', temple: 'Tempel',
};

// ---------- Städte ----------

export const popToGrow = (level) => level + 1; // Einwohner bis zur nächsten Stufe
export const unitCap = (level) => level + 1; // so viele Einheiten kann eine Stadt versorgen

// Belohnung beim Erreichen einer Stufe (ab Stufe 5 immer Park oder Riese)
export const CITY_REWARDS = {
  2: [
    { id: 'workshop', name: 'Werkstatt', text: '+1 ★ pro Runde' },
    { id: 'explorer', name: 'Kundschafter', text: 'Erkundet die Umgebung' },
  ],
  3: [
    { id: 'wall', name: 'Stadtmauer', text: 'Verteidigung ×4 in der Stadt' },
    { id: 'resources', name: 'Vorräte', text: '+5 ★ sofort' },
  ],
  4: [
    { id: 'growth', name: 'Wachstum', text: '+3 Einwohner' },
    { id: 'borders', name: 'Grenzen', text: 'Gebiet wächst auf 5×5' },
  ],
  5: [
    { id: 'park', name: 'Park', text: '+250 Punkte' },
    { id: 'giant', name: 'Riese', text: 'Ein Riese erscheint' },
  ],
};
export const rewardsFor = (level) => CITY_REWARDS[Math.min(level, 5)] || [];

// ---------- Ruinen ----------

export const RUIN_REWARDS = [
  { id: 'stars', weight: 30, text: '+10 ★' },
  { id: 'tech', weight: 20, text: 'Neue Technik' },
  { id: 'explorer', weight: 20, text: 'Kundschafter' },
  { id: 'population', weight: 15, text: '+3 Einwohner' },
  { id: 'veteran', weight: 15, text: 'Erfahrener Schwertkämpfer' },
];

// ---------- Schwierigkeit der Computergegner ----------

export const DIFFICULTIES = {
  easy: { name: 'Leicht', bonus: 0, aggression: 0.35, slack: 0.3 },
  normal: { name: 'Normal', bonus: 0, aggression: 0.6, slack: 0 },
  hard: { name: 'Schwer', bonus: 1, aggression: 0.8, slack: 0 },
  crazy: { name: 'Verrückt', bonus: 2, aggression: 1, slack: 0 },
};

// ---------- Punkte ----------

export const SCORE = {
  explored: 5, // je aufgedeckter Kachel
  territory: 20, // je Kachel im eigenen Gebiet
  cityLevel: 50, // je Stadtstufe
  city: 100, // je Stadt
  tech: 100, // je Technik × Stufe
  army: 5, // je Stern Einheitenkosten
  temple: 100,
  park: 250,
};

export const MAP_SIZES = {
  small: { name: 'Klein', size: 11, maxTribes: 2 },
  normal: { name: 'Normal', size: 14, maxTribes: 3 },
  large: { name: 'Groß', size: 16, maxTribes: 4 },
};
