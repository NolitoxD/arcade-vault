import type { MatchPhase } from '../football-logic/match';
import { createRng } from '../football-logic/rng';
import { halfCapSteps } from './hud';
import { frameMode, planSteps, type FrameMode, type StepBudget } from './loop';
import { ambienceSeedFor, planAmbience } from './sfx-map';

// The two decisions the component's requestAnimationFrame loop makes that are pure
// enough to test: what ONE frame is allowed to do, and where a half's crowd bursts
// fall. They live here rather than inside VaultWorldCupGame.tsx's effect because the
// repo has no DOM test environment -- a decision buried in the effect is a decision
// no test can reach, which is exactly what the Task 8-1 review asked to fix (its
// carried finding #1: the zero-step-frame guard was "documented, not verified") and
// what the Task 8-4 review asked for on the ambience window (its carried finding #5:
// "enforceable only in 8-5"). The component calls these; it does not re-implement them.

export type FramePlan = {
  mode: FrameMode;
  steps: number;
  // Whether the pad may consume its edges at the end of this frame (pressed -> held,
  // released -> up). H3: an edge is consumed by a STEP, not by a frame.
  advancePad: boolean;
};

export function createFramePlan(): FramePlan {
  return { mode: 'frozen', steps: 0, advancePad: false };
}

// Writes into out and budget, allocates nothing, and RETURNS the accumulator the
// caller must keep for the next frame.
//
// A 'frozen' frame does not even feed the accumulator: pausing must not bank up real
// time that fires five steps on resume, and it must not consume a pad edge either.
// A 'captions-only' frame spends its steps on the caption queue alone, so the pad is
// not advanced there either -- the keyboard is off in both of its causes (the match
// is over, or the viewport guard tripped).
export function planFrame(
  phase: MatchPhase,
  paused: boolean,
  blocked: boolean,
  accumulatorMs: number,
  frameMs: number,
  budget: StepBudget,
  out: FramePlan,
): number {
  out.mode = frameMode(phase, paused, blocked);
  if (out.mode === 'frozen') {
    out.steps = 0;
    out.advancePad = false;
    return accumulatorMs;
  }
  planSteps(accumulatorMs + frameMs, budget);
  out.steps = budget.steps;
  // The guard H3 is about: STEP_MS is 16.667 ms, so on a 120 or 144 Hz panel a good
  // half of the frames plan zero steps. Advancing the pad on one of those would eat
  // the press before any stepMatch ever saw it -- the player's shot simply would not
  // happen.
  out.advancePad = out.mode === 'full' && budget.steps > 0;
  return budget.carryMs;
}

// The crowd bed of ONE half, from its own rng stream (spec, criterion 1: the ambience
// must never draw from the match rng) and over the window that half really lasts.
// halfCapSteps is hud.ts's own tested lookup -- HALF_STEPS in halves 1 and 2,
// EXTRA_TIME_STEPS (3 600, two thirds of a half) in the extra time. Planning half 3
// with HALF_STEPS spreads the marks over a window half again as long as the one
// ambienceDue compares against, so the marks in its back never fire.
export function planHalfAmbience(seed: number, half: 1 | 2 | 3, out: number[]): number {
  return planAmbience(createRng(ambienceSeedFor(seed, half)), halfCapSteps(half), out);
}
