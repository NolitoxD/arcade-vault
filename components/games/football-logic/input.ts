import type { Strategy } from './teams';

export type { Strategy } from './teams';

// A TeamInput is the input of ONE simulation step (not a frame): the component
// samples the keyboard once per frame and repeats it for every step of that frame.
// `pressed` and `released` last one step; the engine consumes them on the first.
// exported for Task 8: the component builds a TeamInput button by button; today only input.ts uses it
export type ButtonState = 'up' | 'pressed' | 'held' | 'released';
export type Axis = -1 | 0 | 1;

export type TeamInput = {
  dx: Axis;
  dy: Axis;
  a: ButtonState;
  b: ButtonState;
  c: ButtonState;
  formation: number; // index into FORMATIONS
  strategy: Strategy;
  // G15-18 (v1.5, V15-4): the substitution the team asks for, as a SQUAD index; -1 for
  // "nothing". It rides inside the TeamInput and not in a call of its own because
  // criterion 1 says the replay is seed + TeamInput: a substitution decided outside
  // would not replay. It is read ONLY while the match is in phase 'injury' for that
  // team, and ignored everywhere else.
  sub: number;
  // G15-31 (Paco, 07-oct): "A saca al momento" -- the set piece is taken on THIS step, at
  // this step's aim, instead of waiting for its countdown. Written ONLY by the screen, from
  // a fresh human press of A (keyboard.ts padQuickKick: the edge 'pressed', never 'held'),
  // and read ONLY by stepSetPiece for the five kinds that go by themselves -- never the
  // penalty. A field of its own and not `a === 'pressed'` because the recorded matches of
  // match.test.ts press A in set pieces too (24 presses, all in its run C) and none of them
  // must change: nothing but the screen writes this field, so it stays false there.
  quickKick: boolean;
};

const BUTTON_STATES: readonly ButtonState[] = ['up', 'pressed', 'held', 'released'];
const STRATEGY_NAMES: readonly Strategy[] = ['attack', 'neutral', 'defend'];

export function createTeamInput(): TeamInput {
  return { dx: 0, dy: 0, a: 'up', b: 'up', c: 'up', formation: 0, strategy: 'neutral', sub: -1, quickKick: false };
}

export function copyTeamInput(from: TeamInput, to: TeamInput): void {
  to.dx = from.dx;
  to.dy = from.dy;
  to.a = from.a;
  to.b = from.b;
  to.c = from.c;
  to.formation = from.formation;
  to.strategy = from.strategy;
  to.sub = from.sub;
  to.quickKick = from.quickKick;
}

export function isDown(b: ButtonState): boolean {
  return b === 'pressed' || b === 'held';
}

// Quantizes a signed value into the d-pad axis with a dead zone: the AI, the
// step-script of step.test.ts and the recorded-match policy all need it.
export function toAxis(v: number, dead: number): Axis {
  return v > dead ? 1 : v < -dead ? -1 : 0;
}

function isAxis(v: number): boolean {
  return v === -1 || v === 0 || v === 1;
}

// `squadSize` is a parameter (callers pass squads.ts's SQUAD_SIZE) so this file does not
// depend on the squad data. It is optional only for the callers written before V15-4
// (engine-invariants.test.ts must stay byte-identical): without it `sub` is still checked
// to be an integer >= -1, just not against the top of the squad.
export function checkTeamInput(input: TeamInput, formationCount: number, squadSize?: number): string[] {
  const problems: string[] = [];
  if (!isAxis(input.dx)) problems.push('bad dx');
  if (!isAxis(input.dy)) problems.push('bad dy');
  if (!BUTTON_STATES.includes(input.a)) problems.push('bad button a');
  if (!BUTTON_STATES.includes(input.b)) problems.push('bad button b');
  if (!BUTTON_STATES.includes(input.c)) problems.push('bad button c');
  if (!Number.isInteger(input.formation) || input.formation < 0 || input.formation >= formationCount) {
    problems.push(`formation ${input.formation} out of range`);
  }
  if (!STRATEGY_NAMES.includes(input.strategy)) problems.push('bad strategy');
  if (!Number.isInteger(input.sub) || input.sub < -1 || (squadSize !== undefined && input.sub >= squadSize)) {
    problems.push(`sub ${input.sub} out of range`);
  }
  return problems;
}
