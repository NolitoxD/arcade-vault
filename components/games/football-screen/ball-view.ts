import { PITCH } from '../football-logic/pitch';

// G11-3 (grill del paso 11, QA jugado del 11-sep): a shot has to LOOK like it goes
// up. The engine already gives the height -- ball.z, with SHOT_VZ_MAX 200 and
// GRAVITY 900 that is an apex of 22.2 units for a full-power shot -- and the screen
// already lifted the ball by 0.35 * z since step 8. What was missing is the second
// and third cue: the ball GROWS and its shadow SHRINKS and FADES. G11-3 is explicit
// that SHOT_VZ_MAX and the gravity are NOT touched here, and this module does not
// touch the lift either (BALL_Z_LIFT is the 0.35 the screen already used): if after
// playing it still reads flat, raising them is a separate task with its own replay.
//
// Everything here is a pure number in, pure number out: no state, no allocation, and
// the shadow's fade is a FACTOR for ctx.globalAlpha on purpose -- building an
// 'rgba(0,0,0,' + a + ')' string would allocate once per frame and break criterion 20.

// The crossbar is the natural ceiling of "a high ball": above it nothing can be a
// goal any more, so it is where every cue reaches its end of travel.
export const BALL_Z_REF = PITCH.crossbarHeight; // 50
export const BALL_Z_LIFT = 0.35;
export const BALL_SCALE_MAX = 1.6;
export const BALL_SHADOW_MIN = 0.55;
export const BALL_SHADOW_FADE_MIN = 0.45;

export function ballHeightFraction(z: number): number {
  if (z <= 0) return 0;
  if (z >= BALL_Z_REF) return 1;
  return z / BALL_Z_REF;
}

export function ballLift(z: number): number {
  return z > 0 ? z * BALL_Z_LIFT : 0;
}

export function ballScale(z: number): number {
  return 1 + ballHeightFraction(z) * (BALL_SCALE_MAX - 1);
}

export function ballShadowScale(z: number): number {
  return 1 - ballHeightFraction(z) * (1 - BALL_SHADOW_MIN);
}

export function ballShadowFade(z: number): number {
  return 1 - ballHeightFraction(z) * (1 - BALL_SHADOW_FADE_MIN);
}
