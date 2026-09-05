import type { PitchDef } from './pitch';
import { isDown, type TeamInput } from './input';
import { stepPlayer, type PlayerState } from './players';
import { stepBall, type BallState } from './ball';

// The public contract of the fixed step: everything outside players.ts/ball.ts imports the clock from here.
export { STEPS_PER_SECOND, STEP_MS, stepsFor, perStep } from './clock';

export type AttackDirs = readonly [1 | -1, 1 | -1];

// Moves the two controlled players by their team's input, ticks everyone else's
// timers, then advances the ball. Allocates nothing. Task 5 wraps it in stepMatch,
// after the actions and before the referee.
export function stepPhysics(
  players: PlayerState[],
  ball: BallState,
  inputs: readonly [TeamInput, TeamInput],
  controlled: readonly [number, number],
  attackDir: AttackDirs,
  pitch: PitchDef,
  stepCount: number,
): void {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const hasBall = ball.owner === p.id;
    if (p.id === controlled[p.team]) {
      const input = inputs[p.team];
      stepPlayer(p, input.dx, input.dy, isDown(input.c), hasBall, attackDir[p.team], pitch, stepCount);
    } else {
      stepPlayer(p, 0, 0, false, hasBall, attackDir[p.team], pitch, stepCount);
    }
  }
  stepBall(ball, players, stepCount, pitch);
}
