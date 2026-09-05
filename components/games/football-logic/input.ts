import type { Strategy } from './teams';

export type { Strategy } from './teams';

// A TeamInput is the input of ONE simulation step (not a frame): the component
// samples the keyboard once per frame and repeats it for every step of that frame.
// `pressed` and `released` last one step; the engine consumes them on the first.
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
};

const BUTTON_STATES: readonly ButtonState[] = ['up', 'pressed', 'held', 'released'];
const STRATEGY_NAMES: readonly Strategy[] = ['attack', 'neutral', 'defend'];

export function createTeamInput(): TeamInput {
  return { dx: 0, dy: 0, a: 'up', b: 'up', c: 'up', formation: 0, strategy: 'neutral' };
}

export function copyTeamInput(from: TeamInput, to: TeamInput): void {
  to.dx = from.dx;
  to.dy = from.dy;
  to.a = from.a;
  to.b = from.b;
  to.c = from.c;
  to.formation = from.formation;
  to.strategy = from.strategy;
}

export function isDown(b: ButtonState): boolean {
  return b === 'pressed' || b === 'held';
}

function isAxis(v: number): boolean {
  return v === -1 || v === 0 || v === 1;
}

export function checkTeamInput(input: TeamInput, formationCount: number): string[] {
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
  return problems;
}
