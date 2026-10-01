import { TEAM_SIZE, type Formation, type Role, type TeamDef } from './teams';

// G15-17 (v1.5), con la adenda de Paco del 23-sep: EIGHTEEN players per selection --
// invented surnames that sound like the country (NEVER real footballers) and fixed
// shirt numbers 1-18 with the two keepers on 1 and 2. Pure DATA. The screen reads it
// through football-screen/lineup.ts and, since V15-4 (G15-10/G15-26, H12), the engine
// reads it through players.ts ONLY -- a one-way data edge (this file never imports
// players.ts) for the per-player and per-keeper attributes. Names on events are V15-5.
//
// The composition is not arbitrary. A squad has to field EVERY formation of today
// (3-3-2, 3-2-3, 4-3-1) and every eleven-a-side formation of V15-4 (4-4-2, 4-3-3,
// 5-3-2, G15-16) AND still leave a substitute in every line, which is what G15-17
// means by "reserva DEF/MED/DEL". The maximum across the six is 5 defenders,
// 4 midfielders and 3 forwards, so 6/6/4 keeps at least one of each on the bench in
// all six; the second keeper covers an injured one (G15-18). The fourteen-man squad
// this plan started from did NOT: 4-4-2 left no spare midfielder and 5-3-2 no spare
// defender. checkSquadCoversFormations is what keeps that promise honest.
export const SQUAD_SIZE = 18;
export const SQUAD_NAME_MAX = 12;

// Index -> role. The shirt number is the index + 1 (G15-17), so it is NOT stored:
// a second copy of the same fact is a second copy that can drift.
export const SQUAD_ROLES: readonly Role[] = [
  'gk', 'gk',
  'def', 'def', 'def', 'def', 'def', 'def',
  'mid', 'mid', 'mid', 'mid', 'mid', 'mid',
  'fwd', 'fwd', 'fwd', 'fwd',
];

// Upper case, one word, letters only (the accented ones the twenty languages need).
// ONE definition of the alphabet: isSquadName (a whole name, here) and isSquadChar (a
// single typed key, consumed by football-screen/lineup.ts) both test against it, so a
// language added to one can never silently diverge from the other (fix round 1,
// review-7.md #3 -- the two used to carry separate regex literals).
const SQUAD_NAME_CHARS = 'A-ZÁÉÍÓÚÑÇØÅÄÖÜ';
const SQUAD_NAME_RE = new RegExp(`^[${SQUAD_NAME_CHARS}]+$`);
const SQUAD_CHAR_RE = new RegExp(`^[${SQUAD_NAME_CHARS}]$`);

export function isSquadName(name: string): boolean {
  return SQUAD_NAME_RE.test(name) && [...name].length <= SQUAD_NAME_MAX;
}

export function isSquadChar(ch: string): boolean {
  return SQUAD_CHAR_RE.test(ch);
}

export function squadRole(index: number): Role {
  return SQUAD_ROLES[index];
}

export function squadNumber(index: number): number {
  return index + 1;
}

export function squadRoleCount(role: Role): number {
  let n = 0;
  for (const r of SQUAD_ROLES) if (r === role) n++;
  return n;
}

// Eighteen invented surnames per selection, in SQUAD_ROLES order (the two keepers
// first, then six defenders, six midfielders and four forwards). None of the 360 is a
// real, identifiable footballer (G15-17, resolución (f) de Paco); all are distinct.
export const SQUAD_NAMES: Readonly<Record<string, readonly string[]>> = {
  'espana': [
    'QUEROL', 'IZAGUERRA',
    'ARBIZU', 'VILLENAR', 'ZUBELDA', 'MORCUENDE', 'LARRETA', 'VALDUERNA',
    'ESPEJEL', 'GAMONAL', 'BERRUECO', 'OLAZUBI', 'REQUEJANO', 'MONTALBÉS',
    'CENDRERO', 'MARZOLA', 'PEÑALBA', 'SARRIEGUI',
  ],
  'italia': [
    'BRANCATI', 'FEDERICI',
    'VESCARDI', 'MORANDELLI', 'TRIVELLO', 'PISANOTTI', 'CALOGERI', 'CASTELVETRI',
    'BENAZZO', 'FERRANTI', 'SCAMOZZI', 'TESSARO', 'RAVIZZONI', 'BORGHESANI',
    'GUALTIERO', 'MONTECCHI', 'SALVETTI', 'ZAMBERLAN',
  ],
  'brasil': [
    'GOULARTE', 'QUEIROLINO',
    'BEZERRIL', 'TAVARELO', 'CAMPELHO', 'DORNELAS', 'RIBAMAR', 'ARAUJEIRO',
    'SOUZEDO', 'ALMEIRAL', 'MARÇANO', 'VILARINHO', 'FURTADINHO', 'MENDONÇAL',
    'ESTEVAL', 'BRANDIM', 'NOGUEIREDO', 'PORTELINHO',
  ],
  'argentina': [
    'QUIROLA', 'URDIALDE',
    'BENAVENTI', 'SOSTIZZO', 'LARRALDE', 'ALFARACHE', 'PIROVANI', 'GAITANOZZI',
    'ZALDUENDO', 'MERCADANTE', 'OVIEDANO', 'BORDAGARAY', 'PELLEGRANO', 'MOLINARES',
    'CAMPODÓNICO', 'VILLAMAYOR', 'ECHENIQUE', 'ARANGUREZ',
  ],
  'alemania': [
    'HALBRECHT', 'KELLERBRUNN',
    'STEINKAMP', 'WEIGANDT', 'BRUNNHOFER', 'LAUTERBACH', 'OSTERMANN', 'ZIEGENHALS',
    'KIENZLE', 'DIERSEN', 'VOGELSANG', 'REINHOLZ', 'ROTHENBERG', 'DAMMSTEIN',
    'SCHÄFFLER', 'MERZBACH', 'GRUNDMEIER', 'WALDHUBER',
  ],
  'francia': [
    'DELANGES', 'LAFRENOY',
    'BOUVERET', 'MARCHANDIN', 'LEVASSIER', 'THIBAUDOT', 'GRENIVEL', 'BERTHOUMIEU',
    'ROQUEBERT', 'CHAVANOT', 'DUPERRIER', 'MALBRUNOT', 'DESROCHAIS', 'GUILLEMART',
    'SAUVIGNAC', 'PELLETANT', 'VOISENET', 'CORBINEAU',
  ],
  'inglaterra': [
    'HOLBROOK', 'ASHDOWNE',
    'WEATHERALL', 'PENHALIGON', 'BRACKWELL', 'THORNCLIFF', 'MARSDALE', 'CRANBOURNE',
    'EASTHORPE', 'KEMBLETON', 'FAIRHOLME', 'LUDGATE', 'WYNDHALL', 'BLACKMOOR',
    'SWAINSBY', 'REDMARSH', 'TILLOTSON', 'HAVERCROFT',
  ],
  'portugal': [
    'ALCOFORADO', 'AZEVEDAL',
    'SEABRINHO', 'LOURENÇAL', 'PIMENTEIRO', 'BARROCAL', 'VASCONCELO', 'MONTEIRINHO',
    'CARVALHEDO', 'TRINDADE', 'ALPUIM', 'RESENDINHO', 'CASTANHEDO', 'FIGUEIRÓ',
    'SERPILHO', 'BRAGANÇO', 'TEIXEIRAL', 'CORDEIRAL',
  ],
  'paises-bajos': [
    'VEENSTRUIK', 'STRAATMAN',
    'BOLKESTEIN', 'HOOGEVEEN', 'KRUISDIJK', 'DRIESSENAAR', 'MEERHOUT', 'VEENHUIZEN',
    'VLASBERGEN', 'TERHORST', 'SPIJKHOVEN', 'BOSVELDT', 'DOKKUMER', 'BROUWERSMA',
    'RIETVELDER', 'ZWANENBURG', 'OOSTERLEE', 'HAVERKAMPS',
  ],
  'belgica': [
    'VERSTRAELE', 'DHAENENS',
    'DECRAENE', 'MAESSCHALK', 'WOUTERSEN', 'GILLEBERT', 'PEETERMANS', 'VERSCHOOT',
    'DEBACKERE', 'LAMBRECHTS', 'VANHOECKE', 'DEMEULDER', 'MAERTENSEL', 'CLAESSENAER',
    'SERVAESEN', 'THYSSENAER', 'CALLEWAERT', 'BORREMANS',
  ],
  'croacia': [
    'BUDINEC', 'JURKOVAC',
    'TOMLJENOV', 'KRALJEC', 'VUKELAR', 'SIMUNOVAC', 'DRAGANEC', 'RADOSINEC',
    'PRELOGAR', 'MARUSEK', 'ZVONAREC', 'BLAZEVAC', 'PETRANOVIC', 'SLAVINEC',
    'SKOKANEC', 'HERCEGOVAC', 'TURKALJEC', 'MILOSAVAC',
  ],
  'uruguay': [
    'BENZANO', 'CORBALLO',
    'ARRIGONI', 'LAMARQUE', 'ZUBILLAGA', 'ORTUÑEZ', 'CASARAVILLA', 'ALMADENSO',
    'LARRAÑAGA', 'ETCHEGOIN', 'BERRUTINI', 'SANGUINÉS', 'BAUZÁTEGUI', 'RIVERANO',
    'PIRIZOLA', 'MADEROSO', 'CANDIOTTI', 'TROCHÓN',
  ],
  'mexico': [
    'ZAMUDIANO', 'ZEPEDANO',
    'CHAVARRÍN', 'OLVERANO', 'TREVIÑAL', 'MACEDONIO', 'ESQUIVIAS', 'HUIZACHAL',
    'PALOMINOS', 'ARELLANEZ', 'XOCHIPAL', 'BERISTOL', 'NAVARRETO', 'HUITZILAR',
    'CUELLARES', 'TEPANEC', 'VILLASANTE', 'MONTELLANO',
  ],
  'japon': [
    'SHIRAMI', 'MORIZAKI',
    'KUROBANE', 'TAKEMOTO', 'NAGASHIRO', 'ISHIMARU', 'FUKUHARA', 'HANABUSA',
    'ARIMATSU', 'KOZUKAWA', 'MITSUDANI', 'YAMAGURA', 'TOKUNAGI', 'SASAGAWARA',
    'HOSAKABE', 'TSUJIMORI', 'EDAMITSU', 'OKURIYAMA',
  ],
  'marruecos': [
    'BENCHRIF', 'ELHAMRANI',
    'ELMOUSSAOUI', 'OUAZZANI', 'TAZAGHRI', 'BOUKERCH', 'IDRISSOUN', 'BOUSKRAOUI',
    'ZERHOUNI', 'AMGHARI', 'LAHSSINI', 'BOUAZZAOUI', 'AZOULAYNE', 'CHERKAOUNI',
    'TIFRITINE', 'MESKALLI', 'OURAHMA', 'SEDDIKOU',
  ],
  'estados-unidos': [
    'HALVERSEN', 'STOCKWELL',
    'BRINKMAN', 'CALLOWAY', 'STRAUBECK', 'MCGARVIN', 'DELANCEY', 'LANDRIGAN',
    'WHITFIELD', 'KESSLINGER', 'HOLLOMAN', 'RAMBECK', 'HARGROVER', 'MERIWEATHER',
    'SUTTERFIELD', 'QUINTRELL', 'BRADSHER', 'WESTBROOKE',
  ],
  'colombia': [
    'ARBELÁNEZ', 'BEDOYANO',
    'CIFUENTAL', 'OSORIANO', 'BALANDRA', 'ZULETANO', 'CANTILLANO', 'QUINTERANO',
    'REVOLLEDO', 'MANCILLAS', 'TORRENEGRA', 'LOZANILLO', 'PALOMEQUE', 'SALAZARTE',
    'ESCANDÓN', 'MARULANDO', 'SANCLEMENTE', 'ORTEGÓN',
  ],
  'corea-del-sur': [
    'SEOKJUNG', 'JINHWAN',
    'NAMGIL', 'YUNSEOK', 'BAEKHUN', 'JUNGHAE', 'DOHYEOK', 'SEUNGRAE',
    'MYEONGSU', 'HAEJOON', 'SANGWOOK', 'GIJOONG', 'KWANGMIN', 'HYEONBOK',
    'TAEYOL', 'WOOJINHO', 'CHEOLBAE', 'EUNSANG',
  ],
  'noruega': [
    'BRENNHAUG', 'STRANDVIK',
    'SOLVIKEN', 'HAGENSRUD', 'MYKLEBOST', 'ØSTERLIEN', 'FJELLHEIM', 'AASHEIMEN',
    'NORDBRÅTEN', 'LIANGSETH', 'KVAMSDAL', 'BERGSVIK', 'GRØNDALEN', 'HELLESTØL',
    'TVEITANE', 'HAUGSTAD', 'RØNNEBERG', 'SKARSHOLM',
  ],
  'egipto': [
    'ABDELSAMIE', 'MOKHTARY',
    'ELGHARIB', 'SHENOUDI', 'MANSOURY', 'KHALIFAWY', 'TAWFIKY', 'ELSHERBINY',
    'RAGHEB', 'SOLIMANY', 'BADAWEY', 'NASHAATY', 'GABALLAWY', 'RASHEEDAN',
    'GHOZLANI', 'SEIFELDIN', 'ABOUHAMED', 'ZAKARIEH',
  ],
};

// Throws rather than returning '': a missing squad is a programming error (a team in
// the bank with no data), not a state of the game.
export function squadName(teamId: string, index: number): string {
  const names = SQUAD_NAMES[teamId];
  if (names === undefined) throw new Error(`no squad for ${teamId}`);
  return names[index];
}

// ── The invariant net (same shape as invariants.ts: [] when it all holds) ───────

export function checkSquad(teamId: string, names: readonly string[]): string[] {
  const problems: string[] = [];
  if (names.length !== SQUAD_SIZE) problems.push(`${teamId}: squad size ${names.length}`);
  const seen = new Set<string>();
  names.forEach((n, i) => {
    if (!isSquadName(n)) problems.push(`${teamId}[${i}]: bad name ${n}`);
    if (seen.has(n)) problems.push(`${teamId}[${i}]: duplicate name ${n}`);
    seen.add(n);
  });
  return problems;
}

export function checkSquads(teams: readonly TeamDef[]): string[] {
  const problems: string[] = [];
  if (SQUAD_ROLES.length !== SQUAD_SIZE) problems.push(`role table size ${SQUAD_ROLES.length}`);
  if (squadRoleCount('gk') !== 2) problems.push(`goalkeepers ${squadRoleCount('gk')}`);
  if (SQUAD_ROLES[0] !== 'gk' || SQUAD_ROLES[1] !== 'gk') problems.push('shirt numbers 1 and 2 are not the goalkeepers');
  if (SQUAD_SIZE <= TEAM_SIZE) problems.push(`squad of ${SQUAD_SIZE} leaves no reserve for a team of ${TEAM_SIZE}`);
  const global = new Set<string>();
  for (const t of teams) {
    const names = SQUAD_NAMES[t.id];
    if (names === undefined) {
      problems.push(`no squad for ${t.id}`);
      continue;
    }
    for (const p of checkSquad(t.id, names)) problems.push(p);
    for (const n of names) {
      if (global.has(n)) problems.push(`${t.id}: name ${n} is used by another selection`);
      global.add(n);
    }
  }
  return problems;
}

// The promise of the composition: every formation can be filled from this squad, with
// the keeper on top, AND every line keeps someone on the bench (G15-17's "reserva
// DEF/MED/DEL"). Called with FORMATIONS today and, by the test, with V15-4's
// eleven-a-side ones -- which is what stops V15-4 from having to reopen this file.
export function checkSquadCoversFormations(formations: readonly Formation[]): string[] {
  const problems: string[] = [];
  for (const f of formations) {
    let def = 0;
    let mid = 0;
    let fwd = 0;
    for (const s of f.slots) {
      if (s.role === 'def') def++;
      else if (s.role === 'mid') mid++;
      else fwd++;
    }
    if (def > squadRoleCount('def')) problems.push(`${f.id}: needs ${def} def, the squad has ${squadRoleCount('def')}`);
    else if (def === squadRoleCount('def')) problems.push(`${f.id}: no def on the bench`);
    if (mid > squadRoleCount('mid')) problems.push(`${f.id}: needs ${mid} mid, the squad has ${squadRoleCount('mid')}`);
    else if (mid === squadRoleCount('mid')) problems.push(`${f.id}: no mid on the bench`);
    if (fwd > squadRoleCount('fwd')) problems.push(`${f.id}: needs ${fwd} fwd, the squad has ${squadRoleCount('fwd')}`);
    else if (fwd === squadRoleCount('fwd')) problems.push(`${f.id}: no fwd on the bench`);
    if (f.slots.length + 1 > SQUAD_SIZE) problems.push(`${f.id}: needs ${f.slots.length + 1} players, the squad has ${SQUAD_SIZE}`);
  }
  return problems;
}

// ── Attributes (V15-4: G15-10 per player, G15-26 per keeper) ────────────────────

// G15-26 (Paco, 23-sep): three 1-5 levels per KEEPER. reflexes feeds keeperCatch's
// chance, rushing feeds how fast keeperStep comes out (on top of G12-3), kicking feeds
// the strength of the keeper's long release and the accuracy of every throw he makes
// (the long release and the B hand throw alike). The two keepers of a
// squad are never identical: that is what makes the substitute noticeable when he
// comes on for an injury (G15-18). The number 1 is better than the number 2 in at
// least one level in every selection.
export type KeeperAttrs = { reflexes: number; rushing: number; kicking: number };

export const KEEPER_ATTRS: Readonly<Record<string, readonly [KeeperAttrs, KeeperAttrs]>> = {
  'espana': [{ reflexes: 4, rushing: 3, kicking: 4 }, { reflexes: 3, rushing: 4, kicking: 3 }],
  'italia': [{ reflexes: 5, rushing: 3, kicking: 3 }, { reflexes: 4, rushing: 3, kicking: 4 }],
  'brasil': [{ reflexes: 4, rushing: 4, kicking: 3 }, { reflexes: 3, rushing: 4, kicking: 4 }],
  'argentina': [{ reflexes: 4, rushing: 4, kicking: 4 }, { reflexes: 3, rushing: 3, kicking: 4 }],
  'alemania': [{ reflexes: 5, rushing: 4, kicking: 3 }, { reflexes: 4, rushing: 3, kicking: 3 }],
  'francia': [{ reflexes: 4, rushing: 4, kicking: 4 }, { reflexes: 4, rushing: 3, kicking: 3 }],
  'inglaterra': [{ reflexes: 4, rushing: 3, kicking: 3 }, { reflexes: 3, rushing: 4, kicking: 3 }],
  'portugal': [{ reflexes: 4, rushing: 3, kicking: 4 }, { reflexes: 3, rushing: 3, kicking: 3 }],
  'paises-bajos': [{ reflexes: 3, rushing: 4, kicking: 4 }, { reflexes: 3, rushing: 3, kicking: 4 }],
  'belgica': [{ reflexes: 5, rushing: 3, kicking: 3 }, { reflexes: 3, rushing: 3, kicking: 4 }],
  'croacia': [{ reflexes: 4, rushing: 3, kicking: 3 }, { reflexes: 3, rushing: 3, kicking: 4 }],
  'uruguay': [{ reflexes: 4, rushing: 4, kicking: 3 }, { reflexes: 3, rushing: 4, kicking: 3 }],
  'mexico': [{ reflexes: 4, rushing: 5, kicking: 3 }, { reflexes: 3, rushing: 3, kicking: 3 }],
  'japon': [{ reflexes: 3, rushing: 3, kicking: 4 }, { reflexes: 3, rushing: 4, kicking: 3 }],
  'marruecos': [{ reflexes: 4, rushing: 3, kicking: 3 }, { reflexes: 3, rushing: 3, kicking: 3 }],
  'estados-unidos': [{ reflexes: 3, rushing: 4, kicking: 3 }, { reflexes: 3, rushing: 3, kicking: 4 }],
  'colombia': [{ reflexes: 4, rushing: 3, kicking: 4 }, { reflexes: 3, rushing: 4, kicking: 3 }],
  'corea-del-sur': [{ reflexes: 4, rushing: 3, kicking: 3 }, { reflexes: 3, rushing: 3, kicking: 3 }],
  'noruega': [{ reflexes: 3, rushing: 3, kicking: 4 }, { reflexes: 3, rushing: 4, kicking: 3 }],
  'egipto': [{ reflexes: 4, rushing: 3, kicking: 3 }, { reflexes: 3, rushing: 3, kicking: 4 }],
};

// Called only when a keeper is created (createPlayers) or comes on (a substitution),
// never inside the step.
export function keeperAttrsFor(teamId: string, squadIndex: number): KeeperAttrs {
  const pair = KEEPER_ATTRS[teamId];
  if (pair === undefined) throw new Error(`no keepers for ${teamId}`);
  if (squadIndex !== 0 && squadIndex !== 1) throw new Error(`squad index ${squadIndex} is not a goalkeeper`);
  return pair[squadIndex];
}

// G15-10, "por jugador SOLO velocidad y chut, derivados del rol con pequena variacion
// por seleccion". DERIVED, not stored: a table of 360 pairs would be 360 more numbers
// to keep in sync with SQUAD_ROLES. The role sets the base, and the selection shifts it
// by a deterministic hash of (teamId, index) -- no Rng, no module state, same answer
// for ever.
const ROLE_SPEED: Readonly<Record<Role, number>> = { gk: 3, def: 3, mid: 4, fwd: 4 };
const ROLE_SHOT: Readonly<Record<Role, number>> = { gk: 1, def: 2, mid: 3, fwd: 4 };

function attrHash(teamId: string, index: number, salt: number): number {
  let h = salt;
  for (let i = 0; i < teamId.length; i++) h = Math.imul(h ^ teamId.charCodeAt(i), 0x01000193) >>> 0;
  return Math.imul(h ^ index, 0x01000193) >>> 0;
}

function clampLevel(v: number): number {
  return v < 1 ? 1 : v > 5 ? 5 : v;
}

// Returns a NEW object on purpose: it is called 22 times when the match is created and
// once per substitution, NEVER inside stepMatch (criterion 20 is about the step).
export function outfieldAttrsFor(teamId: string, index: number): { speed: number; shot: number } {
  const role = squadRole(index);
  const speedShift = (attrHash(teamId, index, 0x811c9dc5) % 3) - 1;   // -1, 0 or +1
  const shotShift = (attrHash(teamId, index, 0x9e3779b9) % 3) - 1;
  return { speed: clampLevel(ROLE_SPEED[role] + speedShift), shot: clampLevel(ROLE_SHOT[role] + shotShift) };
}

function checkLevel(problems: string[], where: string, name: string, v: number): void {
  if (!Number.isInteger(v) || v < 1 || v > 5) problems.push(`${where}: ${name} ${v} out of 1..5`);
}

// The invariant net of the attributes (same shape as checkSquads: [] when it all holds).
export function checkAttributes(teams: readonly TeamDef[]): string[] {
  const problems: string[] = [];
  for (const t of teams) {
    const a = t.attrs;
    checkLevel(problems, t.id, 'defence', a.defence);
    checkLevel(problems, t.id, 'attack', a.attack);
    checkLevel(problems, t.id, 'counter', a.counter);
    checkLevel(problems, t.id, 'shooting', a.shooting);
    checkLevel(problems, t.id, 'passing', a.passing);
    const pair = KEEPER_ATTRS[t.id];
    if (pair === undefined) {
      problems.push(`${t.id}: no keeper attributes`);
      continue;
    }
    for (let k = 0; k < pair.length; k++) {
      checkLevel(problems, `${t.id}: keeper ${k}`, 'reflexes', pair[k].reflexes);
      checkLevel(problems, `${t.id}: keeper ${k}`, 'rushing', pair[k].rushing);
      checkLevel(problems, `${t.id}: keeper ${k}`, 'kicking', pair[k].kicking);
    }
    if (pair[0].reflexes === pair[1].reflexes && pair[0].rushing === pair[1].rushing && pair[0].kicking === pair[1].kicking) {
      problems.push(`${t.id}: the two keepers are identical`);
    }
  }
  return problems;
}
