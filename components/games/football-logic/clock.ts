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
