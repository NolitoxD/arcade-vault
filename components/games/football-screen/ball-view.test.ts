import { describe, expect, it } from 'vitest';
import { PITCH } from '../football-logic/pitch';
import {
  BALL_SCALE_MAX, BALL_SHADOW_FADE_MIN, BALL_SHADOW_MIN, BALL_Z_LIFT, BALL_Z_REF,
  ballHeightFraction, ballLift, ballScale, ballShadowFade, ballShadowScale,
} from './ball-view';

// The two heights this game actually produces, from the engine's own numbers:
// a full-power shot peaks at SHOT_VZ_MAX^2 / (2 * GRAVITY) = 200^2 / 1800, and a
// long pass at LONG_PASS_VZ^2 / (2 * GRAVITY) = 280^2 / 1800. GRAVITY is NOT
// exported by ball.ts and this step does not touch the engine to export it, so the
// two apexes are written here as the literals the formula gives.
const SHOT_APEX = 22.2;
const LONG_PASS_APEX = 43.6;

describe('ballHeightFraction', () => {
  it('is 0 on the ground and 1 at the crossbar, and never leaves 0..1', () => {
    expect(ballHeightFraction(0)).toBe(0);
    expect(ballHeightFraction(BALL_Z_REF)).toBe(1);
    expect(ballHeightFraction(BALL_Z_REF * 3)).toBe(1);
    expect(ballHeightFraction(-5)).toBe(0);
  });

  it('grows with the height, strictly, between the two ends', () => {
    expect(ballHeightFraction(SHOT_APEX)).toBeGreaterThan(ballHeightFraction(SHOT_APEX / 2));
    expect(ballHeightFraction(LONG_PASS_APEX)).toBeGreaterThan(ballHeightFraction(SHOT_APEX));
  });

  it('uses the crossbar as its reference: a ball above it cannot be a goal anyway', () => {
    expect(BALL_Z_REF).toBe(PITCH.crossbarHeight);
  });
});

describe('ballLift', () => {
  it('keeps the multiplier the screen has used since step 8 (0.35), untouched by G11-3', () => {
    expect(BALL_Z_LIFT).toBe(0.35);
    expect(ballLift(100)).toBeCloseTo(35, 6);
  });

  it('is 0 on the ground and never negative', () => {
    expect(ballLift(0)).toBe(0);
    expect(ballLift(-9)).toBe(0);
  });
});

describe('ballScale', () => {
  it('is 1 on the ground and BALL_SCALE_MAX at the crossbar', () => {
    expect(ballScale(0)).toBe(1);
    expect(ballScale(BALL_Z_REF)).toBeCloseTo(BALL_SCALE_MAX, 6);
    expect(ballScale(BALL_Z_REF * 10)).toBeCloseTo(BALL_SCALE_MAX, 6);
  });

  it('makes a full-power shot visibly bigger: at least 20 % at its apex', () => {
    expect(ballScale(SHOT_APEX)).toBeGreaterThan(1.2);
  });

  it('makes a long pass bigger than a shot, because it flies higher', () => {
    expect(ballScale(LONG_PASS_APEX)).toBeGreaterThan(ballScale(SHOT_APEX));
  });
});

describe('the shadow', () => {
  it('is full size and fully opaque on the ground', () => {
    expect(ballShadowScale(0)).toBe(1);
    expect(ballShadowFade(0)).toBe(1);
  });

  it('shrinks and fades as the ball climbs, bottoming out at the crossbar', () => {
    expect(ballShadowScale(BALL_Z_REF)).toBeCloseTo(BALL_SHADOW_MIN, 6);
    expect(ballShadowFade(BALL_Z_REF)).toBeCloseTo(BALL_SHADOW_FADE_MIN, 6);
    expect(ballShadowScale(SHOT_APEX)).toBeLessThan(1);
    expect(ballShadowFade(SHOT_APEX)).toBeLessThan(1);
  });

  it('never disappears: the shadow is the cue that says where the ball will land', () => {
    expect(ballShadowScale(BALL_Z_REF * 5)).toBeGreaterThan(0.3);
    expect(ballShadowFade(BALL_Z_REF * 5)).toBeGreaterThan(0.3);
  });

  it('moves the opposite way to the ball: the higher it is, the bigger the gap between the two', () => {
    expect(ballScale(SHOT_APEX)).toBeGreaterThan(ballShadowScale(SHOT_APEX));
  });
});
