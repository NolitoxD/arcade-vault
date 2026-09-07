// The FIXED simulation step. No dtMs ever enters the engine: a variable step
// would only be deterministic within one machine (60 fps vs 144 fps diverge).
// This file imports nothing, so players.ts and ball.ts can use it without
// forming an import cycle with step.ts (which imports them).
export const STEPS_PER_SECOND = 60;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

export function stepsFor(seconds: number): number {
  return Math.round(seconds * STEPS_PER_SECOND);
}

export function perStep(unitsPerSecond: number): number {
  return unitsPerSecond / STEPS_PER_SECOND;
}

// The duration of a half, in seconds and in steps. Here rather than in match.ts
// (Task 6b) so ai.ts can read the clock through step.ts without importing match.ts
// at runtime; match.ts re-exports all three, so its own consumers do not move.
export const HALF_SECONDS = 90;
export const HALF_SECONDS_MAX = 120;
export const HALF_STEPS = stepsFor(HALF_SECONDS);

// Stage B2 (Paco, 06-sep): the golden goal now lives inside a capped extra time, so
// half 3 finally has something to measure. Here, next to HALF_SECONDS, so ai.ts and
// match.ts read it through step.ts without importing match.ts at runtime.
export const EXTRA_TIME_SECONDS = 60;
export const EXTRA_TIME_STEPS = stepsFor(EXTRA_TIME_SECONDS);
