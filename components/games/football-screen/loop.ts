import { STEP_MS } from '../football-logic/clock';
import type { MatchPhase } from '../football-logic/match';

// The screen's half of the fixed step (spec, "Paso fijo de simulación"): the engine
// takes no dtMs, so the component accumulates real frame time and spends it in whole
// STEP_MS steps. Five is the spec's cap: a backgrounded tab must not fire a hundred
// steps when it comes back.
//
// There is deliberately NO MAX_FRAME_MS clamp next to it: planSteps caps at five
// steps and DROPS the surplus, so clamping the frame first would change nothing at
// all -- a 5 000 ms frame and a 250 ms one both spend five steps and carry zero.
export const MAX_STEPS_PER_FRAME = 5;

export type StepBudget = { steps: number; carryMs: number };

export function createStepBudget(): StepBudget {
  return { steps: 0, carryMs: 0 };
}

// Writes into out; allocates nothing. When the cap bites, the surplus is DROPPED
// rather than carried, which is what keeps the loop from spiralling: carrying it
// would guarantee another capped frame, and another.
export function planSteps(accumulatorMs: number, out: StepBudget): void {
  if (accumulatorMs <= 0) {
    out.steps = 0;
    out.carryMs = 0;
    return;
  }
  let steps = Math.floor(accumulatorMs / STEP_MS);
  if (steps >= MAX_STEPS_PER_FRAME) {
    out.steps = MAX_STEPS_PER_FRAME;
    out.carryMs = 0;
    return;
  }
  if (steps < 0) steps = 0;
  out.steps = steps;
  out.carryMs = accumulatorMs - steps * STEP_MS;
}

// What a frame is allowed to do. Three modes, because the component has three
// independent reasons to stop and they stop DIFFERENT things:
//   · 'frozen'        — paused: nothing moves, not even the captions. The player
//                       asked for it and expects the screen to hold still.
//   · 'captions-only' — the match is over, or the viewport guard tripped: the
//                       simulation and the keyboard stop, the caption queue and the
//                       drawing do NOT. collectCaptions queues FINAL and then
//                       GANADOR / ELIMINADO / EMPATE in the step the match ends
//                       (R32), and those only reach the screen if stepCaption keeps
//                       being called afterwards. The same holds for the viewport
//                       guard, whose abandon() produces the one EMPATE this ruleset
//                       has and which QA C6-14 asks to read on the canvas.
//   · 'full'          — everything.
// `blocked` is tested before `paused` on purpose: a window shrunk while the game was
// paused still has to show why it stopped.
export type FrameMode = 'full' | 'captions-only' | 'frozen';

export function frameMode(phase: MatchPhase, paused: boolean, blocked: boolean): FrameMode {
  if (blocked) return 'captions-only';
  if (paused) return 'frozen';
  return phase === 'over' ? 'captions-only' : 'full';
}
