import { describe, expect, it } from 'vitest';
import { PITCH } from '../football-logic/pitch';
import { createPlayers, type PlayerState } from '../football-logic/players';
import { FORMATIONS } from '../football-logic/teams';
import { DIVE_PEAK, GESTURE_IDLE, GK_DIVE_STEPS } from './gestures';
import {
  OCTANT_COUNT, OCTANT_E, OCTANT_N, OCTANT_NE, OCTANT_NW, OCTANT_S, OCTANT_SE, OCTANT_SW, OCTANT_W,
  POSE_DIVE_0, POSE_DIVE_1, POSE_DOWN, POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2,
} from './sprite-maps';
import {
  OCTANT_TAN, RUN_FRAME_STEPS, SLIDE_TILT_COS, SLIDE_TILT_RAD, SLIDE_TILT_SIN, SPRINT_FRAME_STEPS,
  choosePlayerSprite, createSpriteChoice, diveSpritePose, facingOctant, runPose,
} from './sprite-frame';

// A real outfield player from the engine's own factory (id 1, team 0, facing east).
function outfielder(): PlayerState {
  return createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH)[1];
}

describe('facingOctant', () => {
  it('maps the four axes (screen y grows DOWN)', () => {
    expect(facingOctant(1, 0)).toBe(OCTANT_E);
    expect(facingOctant(0, 1)).toBe(OCTANT_S);
    expect(facingOctant(-1, 0)).toBe(OCTANT_W);
    expect(facingOctant(0, -1)).toBe(OCTANT_N);
  });

  it('maps the four diagonals', () => {
    const d = Math.SQRT1_2;
    expect(facingOctant(d, d)).toBe(OCTANT_SE);
    expect(facingOctant(-d, d)).toBe(OCTANT_SW);
    expect(facingOctant(-d, -d)).toBe(OCTANT_NW);
    expect(facingOctant(d, -d)).toBe(OCTANT_NE);
  });

  it('switches from axis to diagonal at tan(22.5 deg), on both sides of the boundary', () => {
    expect(OCTANT_TAN).toBeCloseTo(Math.SQRT2 - 1, 6);
    expect(facingOctant(1, 0.41)).toBe(OCTANT_E);
    expect(facingOctant(1, 0.42)).toBe(OCTANT_SE);
    expect(facingOctant(0.41, 1)).toBe(OCTANT_S);
    expect(facingOctant(0.42, 1)).toBe(OCTANT_SE);
  });

  it('falls back to east on a zero vector instead of guessing', () => {
    expect(facingOctant(0, 0)).toBe(OCTANT_E);
  });

  // The AI moves at continuous angles (stepPlayerFree): every one of 72 directions round
  // the circle must land in its NEAREST octant. The expected value is computed here with
  // trigonometry -- the function under test uses none. Angles are whole degrees + 1, so
  // none of them sits exactly on a 22.5 deg boundary.
  it('lands 72 directions round the circle in their nearest octant', () => {
    for (let i = 0; i < 72; i++) {
      const rad = ((i * 5 + 1) * Math.PI) / 180;
      const expected = ((Math.round(rad / (Math.PI / 4)) % OCTANT_COUNT) + OCTANT_COUNT) % OCTANT_COUNT;
      expect([i, facingOctant(Math.cos(rad), Math.sin(rad))]).toEqual([i, expected]);
    }
  });
});

describe('runPose', () => {
  it('stands still when the player does not move', () => {
    expect(runPose(0, 1, 0, 0)).toBe(POSE_IDLE);
    expect(runPose(999, 7, 0.5, -0.5)).toBe(POSE_IDLE);
  });

  it('cycles RUN_0, RUN_1, RUN_2, RUN_1 every RUN_FRAME_STEPS at running speed', () => {
    const seen: number[] = [];
    for (let k = 0; k < 5; k++) seen.push(runPose(k * RUN_FRAME_STEPS, 0, 180, 0));
    expect(seen).toEqual([POSE_RUN_0, POSE_RUN_1, POSE_RUN_2, POSE_RUN_1, POSE_RUN_0]);
    expect(runPose(RUN_FRAME_STEPS - 1, 0, 180, 0)).toBe(POSE_RUN_0);
  });

  it('cycles faster when sprinting (every SPRINT_FRAME_STEPS)', () => {
    expect(SPRINT_FRAME_STEPS).toBeLessThan(RUN_FRAME_STEPS);
    const seen: number[] = [];
    for (let k = 0; k < 5; k++) seen.push(runPose(k * SPRINT_FRAME_STEPS, 0, 252, 0));
    expect(seen).toEqual([POSE_RUN_0, POSE_RUN_1, POSE_RUN_2, POSE_RUN_1, POSE_RUN_0]);
    expect(runPose(SPRINT_FRAME_STEPS, 0, 180, 0)).toBe(POSE_RUN_0);
  });

  it('puts neighbours out of phase so the eighteen do not march in step', () => {
    expect(runPose(0, 1, 180, 0)).toBe(POSE_RUN_0);
    expect(runPose(0, 2, 180, 0)).toBe(POSE_RUN_1);
  });
});

describe('diveSpritePose', () => {
  it('opens on DIVE_0, is fully stretched (DIVE_1) at the peak and closes on DIVE_0 (G15-3: 2 frames)', () => {
    expect(diveSpritePose(0)).toBe(POSE_DIVE_0);
    expect(diveSpritePose(DIVE_PEAK)).toBe(POSE_DIVE_1);
    expect(diveSpritePose((GK_DIVE_STEPS - 1) / GK_DIVE_STEPS)).toBe(POSE_DIVE_0);
    let full = 0;
    let open = 0;
    for (let k = 0; k < GK_DIVE_STEPS; k++) {
      if (diveSpritePose(k / GK_DIVE_STEPS) === POSE_DIVE_1) full++;
      else open++;
    }
    expect(full).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });
});

describe('choosePlayerSprite', () => {
  it('draws a diving keeper towards the DIVE direction, not its own facing', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.facingX = 1;
    p.facingY = 0;
    choosePlayerSprite(p, 100, false, false, 0.3, 0, -1, out);
    expect(out.octant).toBe(OCTANT_N);
    expect(out.pose).toBe(POSE_DIVE_1);
    expect(out.tilt).toBe(0);
  });

  it('keeps a parked shootout player standing still even if the engine left it sliding and down', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.vx = 180;
    p.tackleStepsLeft = 5;
    p.downUntilStep = 10_000;
    choosePlayerSprite(p, 100, true, true, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_IDLE);
    expect(out.tilt).toBe(0);
  });

  it('lays a player down in open play, but never during the shootout, taker included', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.downUntilStep = 200;
    p.facingX = -1;
    p.facingY = 0;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_DOWN);
    expect(out.octant).toBe(OCTANT_W);
    choosePlayerSprite(p, 100, true, false, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_IDLE);
  });

  it('draws a slide as the run sprite tilted, along the tackle direction (G15-3)', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.facingX = 1;
    p.facingY = 0;
    p.tackleStepsLeft = 10;
    p.tackleDirX = -1;
    p.tackleDirY = 0;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_RUN_1);
    expect(out.octant).toBe(OCTANT_W);
    expect(out.tilt).toBe(-1);
    p.tackleDirX = 1;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, out);
    expect(out.tilt).toBe(1);
    expect(SLIDE_TILT_COS).toBeCloseTo(Math.cos(SLIDE_TILT_RAD), 9);
    expect(SLIDE_TILT_SIN).toBeCloseTo(Math.sin(SLIDE_TILT_RAD), 9);
  });

  it('writes in place and returns nothing (criterion 20)', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.vx = 180;
    expect(choosePlayerSprite(p, 0, false, false, GESTURE_IDLE, 0, 0, out)).toBeUndefined();
    // id 1 at step 0: ((0 + 1 * RUN_PHASE_SPREAD) / RUN_FRAME_STEPS) | 0 = 0 -> RUN_0.
    expect(out.pose).toBe(POSE_RUN_0);
    expect(out.octant).toBe(OCTANT_E);
    p.facingX = 0;
    p.facingY = 1;
    choosePlayerSprite(p, 6, false, false, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_RUN_1);
    expect(out.octant).toBe(OCTANT_S);
  });
});
