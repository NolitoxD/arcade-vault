import { SQUAD_NAME_MAX, SQUAD_SIZE, isSquadChar, isSquadName, squadName, squadRole } from '../football-logic/squads';
import { TEAM_SIZE, type Formation, type Role } from '../football-logic/teams';

// G15-17: the ALINEACIÓN screen's model. Who starts, who sits, and the names the
// player has edited -- per selection, kept in localStorage through the injected
// closures at the bottom (the pattern of keyboard.ts's loadKeyScheme, V15-2: nothing
// in this folder touches `window`).
//
// SIZE INDEPENDENCE (Global Constraints of V15-3): the number of positions is
// `f.slots.length + 1` and the number of reserves is `SQUAD_SIZE` minus that --
// nine and nine today, eleven and seven the day V15-4 raises the team to eleven
// (G15-16), with NO change to this file. `TEAM_SIZE` is read exactly once, inside
// checkLineup, to notice when the screen and the engine disagree.

export const LINEUP_STORAGE_PREFIX = 'av_vwc_lineup_';
// Position 0 is the goalkeeper; position p >= 1 is the formation's slot p - 1.
export const GK_POSITION = 0;

export type Lineup = {
  starters: number[];   // squad index per position, length lineupPositionCount(f)
  reserves: number[];   // the rest of the squad, ascending
  names: string[];      // by SQUAD index; '' means "use the squad's own name"
};

// Created ONCE per human at mount (criterion 20); everything else writes in place.
export function createLineup(): Lineup {
  const names: string[] = [];
  for (let i = 0; i < SQUAD_SIZE; i++) names.push('');
  return { starters: [], reserves: [], names };
}

export function lineupPositionCount(f: Formation): number {
  return f.slots.length + 1;
}

export function lineupReserveCount(f: Formation): number {
  return SQUAD_SIZE - lineupPositionCount(f);
}

export function lineupRoleAt(f: Formation, position: number): Role {
  return position === GK_POSITION ? 'gk' : f.slots[position - 1].role;
}

// The rest of the squad, ascending. Length assignment + index writes, like
// world-cup.ts's advanceRound: no new array.
export function refreshReserves(f: Formation, out: Lineup): void {
  const positions = lineupPositionCount(f);
  let n = 0;
  out.reserves.length = lineupReserveCount(f);
  for (let i = 0; i < SQUAD_SIZE; i++) {
    let starting = false;
    for (let p = 0; p < positions; p++) {
      if (out.starters[p] === i) {
        starting = true;
        break;
      }
    }
    if (starting) continue;
    if (n < out.reserves.length) out.reserves[n] = i;
    n++;
  }
}

// The lowest unused squad index of the right role for each position, keeper first --
// so the number 1 always starts in goal and the number 2 always sits on the bench.
// Deterministic, so the same formation always opens on the same eleven (nine today).
// Does NOT touch `names`: an edited name belongs to the player, not to the lineup.
export function defaultLineup(f: Formation, out: Lineup): void {
  const positions = lineupPositionCount(f);
  out.starters.length = positions;
  for (let p = 0; p < positions; p++) out.starters[p] = -1;
  for (let p = 0; p < positions; p++) {
    const role = lineupRoleAt(f, p);
    for (let i = 0; i < SQUAD_SIZE; i++) {
      if (squadRole(i) !== role) continue;
      let taken = false;
      for (let q = 0; q < positions; q++) {
        if (out.starters[q] === i) {
          taken = true;
          break;
        }
      }
      if (taken) continue;
      out.starters[p] = i;
      break;
    }
  }
  refreshReserves(f, out);
}

export function lineupName(l: Lineup, teamId: string, index: number): string {
  const edited = l.names[index];
  return edited === '' ? squadName(teamId, index) : edited;
}

// G15-17: "cambio titular <-> reserva solo de la misma posición". The squad carries
// TWO goalkeepers (Paco, 23-sep), so position 0 accepts the bench keeper and nothing
// else -- and an outfield position never accepts a keeper. That falls out of the
// data and the role table, not out of a special case.
export function canSwap(f: Formation, l: Lineup, position: number, squadIndex: number): boolean {
  if (position < 0 || position >= l.starters.length) return false;
  if (squadIndex < 0 || squadIndex >= SQUAD_SIZE) return false;
  if (l.starters.includes(squadIndex)) return false;
  return squadRole(squadIndex) === lineupRoleAt(f, position);
}

export function applySwap(f: Formation, l: Lineup, position: number, squadIndex: number): boolean {
  if (!canSwap(f, l, position, squadIndex)) return false;
  l.starters[position] = squadIndex;
  refreshReserves(f, l);
  return true;
}

// ── Editing a name (G15-17: a key, upper case, twelve max, Enter) ───────────────

export function lineupTypeChar(l: Lineup, index: number, ch: string): boolean {
  const upper = ch.toUpperCase();
  // The alphabet is squads.ts's rule (fix round 1, review-7.md #3): a single typed key
  // is legal iff it is a legal squad-name character -- one shared source, not a second
  // copy of the character class living in this screen file.
  if (!isSquadChar(upper)) return false;
  const current = l.names[index];
  if ([...current].length >= SQUAD_NAME_MAX) return false;
  l.names[index] = current + upper;
  return true;
}

export function lineupBackspace(l: Lineup, index: number): void {
  const chars = [...l.names[index]];
  if (chars.length === 0) return;
  chars.pop();
  l.names[index] = chars.join('');
}

// Enter. An empty (or somehow illegal) name goes back to the squad's own.
export function lineupEndEdit(l: Lineup, index: number): void {
  const name = l.names[index];
  if (name !== '' && !isSquadName(name)) l.names[index] = '';
}

// ── The invariant net ───────────────────────────────────────────────────────────

export function checkLineup(f: Formation, l: Lineup): string[] {
  const problems: string[] = [];
  const positions = lineupPositionCount(f);
  if (l.starters.length !== positions) problems.push(`starters ${l.starters.length} for ${positions} positions`);
  if (l.names.length !== SQUAD_SIZE) problems.push(`names ${l.names.length}`);
  const seen = new Set<number>();
  for (let p = 0; p < l.starters.length; p++) {
    const i = l.starters[p];
    if (i < 0 || i >= SQUAD_SIZE) problems.push(`position ${p} holds ${i}`);
    else if (squadRole(i) !== lineupRoleAt(f, p)) problems.push(`position ${p} holds a ${squadRole(i)}`);
    if (seen.has(i)) problems.push(`player ${i} starts twice`);
    seen.add(i);
  }
  for (const n of l.names) {
    if (n !== '' && !isSquadName(n)) problems.push(`edited name ${n} is illegal`);
  }
  // The one place TEAM_SIZE is read: the screen and the engine must agree on how many
  // play. V15-4 raises both at once; until then a mismatch has to be visible.
  if (positions !== TEAM_SIZE) problems.push(`team size ${positions} but the engine plays ${TEAM_SIZE}`);
  return problems;
}

// ── Persistence, per selection (G15-17) ────────────────────────────────────────

export function lineupStorageKey(teamId: string): string {
  return LINEUP_STORAGE_PREFIX + teamId;
}

// The formation id AND the starter count travel inside on purpose: when V15-4 raises
// the team to eleven, a lineup stored today no longer matches and parseLineup falls
// back to the default -- instead of pushing nine indices into eleven positions.
export function serializeLineup(f: Formation, l: Lineup): string {
  return JSON.stringify({ f: f.id, n: lineupPositionCount(f), s: l.starters, m: l.names });
}

// A type predicate, not a cast: the Global Constraints ban new `as`.
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isStringArray(v: unknown): v is string[] {
  if (!Array.isArray(v)) return false;
  for (const item of v) if (typeof item !== 'string') return false;
  return true;
}

function isNumberArray(v: unknown): v is number[] {
  if (!Array.isArray(v)) return false;
  for (const item of v) if (typeof item !== 'number' || !Number.isInteger(item)) return false;
  return true;
}

// Two halves, read independently: the NAMES come back whenever they are legal, the
// STARTERS only when the formation and the size match and the result passes
// checkLineup. That is what lets the player change formation -- or upgrade to V15-4 --
// without losing the names he typed.
export function parseLineup(raw: string | null, f: Formation, out: Lineup): void {
  defaultLineup(f, out);
  for (let i = 0; i < SQUAD_SIZE; i++) out.names[i] = '';
  if (raw === null || raw === '') return;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isRecord(parsed)) return;
  const names = parsed.m;
  if (isStringArray(names) && names.length === SQUAD_SIZE) {
    for (let i = 0; i < SQUAD_SIZE; i++) {
      const n = names[i];
      out.names[i] = n === '' || isSquadName(n) ? n : '';
    }
  }
  if (parsed.f !== f.id || parsed.n !== lineupPositionCount(f)) return;
  const starters = parsed.s;
  if (!isNumberArray(starters) || starters.length !== lineupPositionCount(f)) return;
  const backup = [...out.starters];
  for (let p = 0; p < starters.length; p++) out.starters[p] = starters[p];
  refreshReserves(f, out);
  if (checkLineup(f, out).length === 0) return;
  for (let p = 0; p < backup.length; p++) out.starters[p] = backup[p];
  refreshReserves(f, out);
}

export function loadLineup(read: (key: string) => string | null, teamId: string, f: Formation, out: Lineup): void {
  try {
    parseLineup(read(lineupStorageKey(teamId)), f, out);
  } catch {
    // fix round 1 (review-7.md #1): parseLineup(null, ...), not defaultLineup, because
    // it also clears `names` -- a bare defaultLineup left a previous selection's
    // edited names on `out`, so they leaked onto whichever team loaded next.
    parseLineup(null, f, out);
  }
}

export function saveLineup(write: (key: string, value: string) => void, teamId: string, f: Formation, l: Lineup): void {
  try {
    write(lineupStorageKey(teamId), serializeLineup(f, l));
  } catch {
    // no-op: a private window or blocked site data just forgets, like the key scheme.
  }
}
