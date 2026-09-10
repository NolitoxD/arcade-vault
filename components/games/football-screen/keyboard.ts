import type { Axis, ButtonState, TeamInput } from '../football-logic/input';
import type { Strategy } from '../football-logic/teams';

// S-SC1: the repo's shared mapping (games-registry, every one of the thirteen games):
// arrows or WASD for the d-pad, j/k/l for A/B/C. Matching is always on
// e.key.toLowerCase(), never e.code, because MobileGamepad synthesises key events.
// consumed by the component (padDown/padUp/padClear take one) and, in step 9, by the
// second keyboard: it derives its own table over the same seven pad keys.
export type PadKey = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c';

// source for pickBindings below, which derives the two-player tables and SOLO
// (§8.2 of the final review): the two-player mode SPLITS this table, not extends it.
export const KEY_BINDINGS: Readonly<Record<string, PadKey>> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  j: 'a',
  k: 'b',
  l: 'c',
};

// S-SC5: formation and strategy are changed mid-match (spec, criterion 11) on the
// number row, out of the way of both the d-pad and the three buttons.
// consumed by padChoice below and by the two-player tables (formation rows 1-2-3 for J1,
// 7-8-9 for J2): each player can independently choose (§8.2 of the final review).
export const FORMATION_KEYS: readonly string[] = ['1', '2', '3'];
export const STRATEGY_KEYS: readonly string[] = ['4', '5', '6'];
export const STRATEGY_BY_KEY: readonly Strategy[] = ['attack', 'neutral', 'defend'];

// G9-2 (Paco, 09-sep): two people on one keyboard, each with their own half.
//   J1 (left)  — W/A/S/D, A/B/C on C/V/B, formation 1-2-3, strategy 4-5-6.
//   J2 (right) — the arrows, A/B/C on J/K/L (the solo map, nothing to relearn),
//                formation 7-8-9, strategy 0 ' ¡ (the rest of the Spanish ISO row).
// N and M are left free as the physical gap. In the two-player mode WASD no longer
// moves J2 and the arrows no longer move J1 -- KEY_BINDINGS is SPLIT, not extended.
// Solo and World Cup keep KEY_BINDINGS untouched. Every table is DERIVED from the
// step-8 constants (final review §8.2): pickBindings throws at module load if a key
// listed here is not in KEY_BINDINGS, so the two can never drift apart.
export type KeyTable = {
  readonly pad: Readonly<Record<string, PadKey>>;
  readonly formation: readonly string[];
  readonly strategy: readonly string[];
};

function pickBindings(source: Readonly<Record<string, PadKey>>, keys: readonly string[]): Record<string, PadKey> {
  const out: Record<string, PadKey> = {};
  for (const key of keys) {
    const value = source[key];
    if (value === undefined) throw new Error(`key not in KEY_BINDINGS: ${key}`);
    out[key] = value;
  }
  return out;
}

const P1_MOVE_KEYS: readonly string[] = ['w', 'a', 's', 'd'];
const P2_KEYS: readonly string[] = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'j', 'k', 'l'];

export const SOLO: KeyTable = { pad: KEY_BINDINGS, formation: FORMATION_KEYS, strategy: STRATEGY_KEYS };

export const TWO_PLAYER_P1: KeyTable = {
  pad: { ...pickBindings(KEY_BINDINGS, P1_MOVE_KEYS), c: 'a', v: 'b', b: 'c' },
  formation: FORMATION_KEYS,
  strategy: STRATEGY_KEYS,
};

export const TWO_PLAYER_P2: KeyTable = {
  pad: pickBindings(KEY_BINDINGS, P2_KEYS),
  formation: ['7', '8', '9'],
  strategy: ['0', "'", '¡'],
};

// Indexed by team: the two-player friendly puts J1 on team 0 and J2 on team 1.
// exported for Task 9-7: the component picks these two tables for the two-player friendly.
export const TWO_PLAYER_TABLES: readonly [KeyTable, KeyTable] = [TWO_PLAYER_P1, TWO_PLAYER_P2];

export type PadState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: ButtonState;
  b: ButtonState;
  c: ButtonState;
  formation: number;
  strategy: Strategy;
};

export function createPadState(strategy: Strategy, formation: number): PadState {
  return { up: false, down: false, left: false, right: false, a: 'up', b: 'up', c: 'up', formation, strategy };
}

export function padKeyFor(table: KeyTable, key: string): PadKey | null {
  const k = table.pad[key];
  return k === undefined ? null : k;
}

function pressButton(current: ButtonState): ButtonState {
  // OS auto-repeat fires keydown again while the key is down: a 'held' button stays
  // held instead of firing a second edge the engine would consume as a new press.
  return current === 'held' || current === 'pressed' ? current : 'pressed';
}

export function padDown(pad: PadState, k: PadKey): void {
  switch (k) {
    case 'up': pad.up = true; return;
    case 'down': pad.down = true; return;
    case 'left': pad.left = true; return;
    case 'right': pad.right = true; return;
    case 'a': pad.a = pressButton(pad.a); return;
    case 'b': pad.b = pressButton(pad.b); return;
    case 'c': pad.c = pressButton(pad.c); return;
  }
}

// The mirror of pressButton: a button only RELEASES from a press. A keyup on a
// button that was already up is not an edge -- it happens whenever the keydown never
// reached the pad (paused, blocked) or a blur lifted the button first, and marking it
// 'released' would hand the engine a shot the player never asked for on the next step.
function releaseButton(current: ButtonState): ButtonState {
  return current === 'pressed' || current === 'held' ? 'released' : 'up';
}

export function padUp(pad: PadState, k: PadKey): void {
  switch (k) {
    case 'up': pad.up = false; return;
    case 'down': pad.down = false; return;
    case 'left': pad.left = false; return;
    case 'right': pad.right = false; return;
    case 'a': pad.a = releaseButton(pad.a); return;
    case 'b': pad.b = releaseButton(pad.b); return;
    case 'c': pad.c = releaseButton(pad.c); return;
  }
}

// Lift one key without producing an edge -- padBlur for a single key. The component
// uses it for a BUTTON released while the game is paused or the viewport guard has
// tripped: the button must come up (the finger really is off the key), but the
// release must not survive into the resumed match as a shot. Directions are never
// routed here: they are released normally in every state, because a direction left
// standing is repo-wide bug #1.
export function padClear(pad: PadState, k: PadKey): void {
  switch (k) {
    case 'up': pad.up = false; return;
    case 'down': pad.down = false; return;
    case 'left': pad.left = false; return;
    case 'right': pad.right = false; return;
    case 'a': pad.a = 'up'; return;
    case 'b': pad.b = 'up'; return;
    case 'c': pad.c = 'up'; return;
  }
}

// Returns true when the key was a formation/strategy choice of THIS table, so the
// caller knows to preventDefault. The engine applies both every step
// (applyTeamChoices): writing them into the TeamInput IS the change.
export function padChoice(pad: PadState, table: KeyTable, key: string): boolean {
  const f = table.formation.indexOf(key);
  if (f >= 0) {
    pad.formation = f;
    return true;
  }
  const s = table.strategy.indexOf(key);
  if (s >= 0) {
    pad.strategy = STRATEGY_BY_KEY[s];
    return true;
  }
  return false;
}

// The invariant of the two-player mode (spec risk 6: "ninguno puede pisarse"): the
// first key of `a` that `b` also reads, in any of its three rows, or null. Consumed
// by keyboard.test.ts and by the closing probe of the step; never by the loop
// (Object.keys allocates).
export function tablesShareKey(a: KeyTable, b: KeyTable): string | null {
  const readsKey = (key: string): boolean =>
    b.pad[key] !== undefined || b.formation.includes(key) || b.strategy.includes(key);
  for (const key of Object.keys(a.pad)) if (readsKey(key)) return key;
  for (const key of a.formation) if (readsKey(key)) return key;
  for (const key of a.strategy) if (readsKey(key)) return key;
  return null;
}

// Repo-wide bug #1 (VaultFighterGame's own comment): alt-tabbing with a direction
// held would leave the player running forever. Buttons go straight to 'up' -- a
// blur is not a release the player meant, so it must not fire a shot.
export function padBlur(pad: PadState): void {
  pad.up = false;
  pad.down = false;
  pad.left = false;
  pad.right = false;
  pad.a = 'up';
  pad.b = 'up';
  pad.c = 'up';
}

function axisOf(negative: boolean, positive: boolean): Axis {
  if (negative === positive) return 0;
  return negative ? -1 : 1;
}

// `first` is false for the second and later simulation steps of the SAME frame.
// input.ts: "pressed and released last one step and the engine consumes them on the
// first". The keyboard is sampled once per frame, so the component repeats the same
// TeamInput across the frame's steps -- with the edges downgraded from the second on,
// or a single tap would fire up to five shots.
export function padToTeamInput(pad: PadState, first: boolean, out: TeamInput): void {
  out.dx = axisOf(pad.left, pad.right);
  out.dy = axisOf(pad.up, pad.down);
  out.a = first ? pad.a : settle(pad.a);
  out.b = first ? pad.b : settle(pad.b);
  out.c = first ? pad.c : settle(pad.c);
  out.formation = pad.formation;
  out.strategy = pad.strategy;
}

function settle(b: ButtonState): ButtonState {
  if (b === 'pressed') return 'held';
  if (b === 'released') return 'up';
  return b;
}

// Called ONCE at the end of each frame **that actually ran a step**, after every step
// of that frame. Calling it on a zero-step frame would consume an edge no stepMatch
// ever saw -- see the "a press survives a frame in which no step ran" test and the
// `budget.steps > 0` guard in the component's update().
export function padAdvance(pad: PadState): void {
  pad.a = settle(pad.a);
  pad.b = settle(pad.b);
  pad.c = settle(pad.c);
}
