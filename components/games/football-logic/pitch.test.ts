import { describe, expect, it } from 'vitest';
import {
  PITCH, centerX, centerY, clampToBigArea, goalKickX, goalLineX, isBetweenPosts,
  isInsideBigArea, isInsideSmallArea, penaltySpotX,
} from './pitch';
import { checkPitch } from './invariants';

describe('PITCH', () => {
  it('passes checkPitch', () => {
    expect(checkPitch(PITCH)).toEqual([]);
  });
  // G15-16 (Paco, 24-sep): every length scales by exactly 1.1 EXCEPT the goal mouth,
  // which is what decides how many goals go in and is balanced against catchChance and
  // SHOT_POST_MARGIN. The v1 number is written next to each one so the 1.1 is auditable
  // and so the one exception is impossible to miss.
  it('PITCH is 2200 x 1430 (G15-16: the v1 pitch x 1.1; the goal does NOT scale)', () => {
    expect([PITCH.width, PITCH.height]).toEqual([2200, 1430]);
    expect(PITCH.width).toBeCloseTo(2000 * 1.1, 6);
    expect(PITCH.height).toBeCloseTo(1300 * 1.1, 6);
    // The goal mouth, untouched.
    expect(PITCH.goalWidth).toBe(150);
    expect(PITCH.crossbarHeight).toBe(50);
    // The areas, the penalty spot and the centre circle, in proportion.
    expect(PITCH.bigAreaDepth).toBeCloseTo(320 * 1.1, 6);
    expect(PITCH.bigAreaWidth).toBeCloseTo(770 * 1.1, 6);
    expect(PITCH.smallAreaDepth).toBeCloseTo(105 * 1.1, 6);
    expect(PITCH.smallAreaWidth).toBeCloseTo(350 * 1.1, 6);
    expect(PITCH.penaltySpotDist).toBeCloseTo(210 * 1.1, 6);
    expect(PITCH.centerCircleRadius).toBeCloseTo(175 * 1.1, 6);
    // The aspect ratio is EXACTLY the one of v1, which is what keeps minimap.ts's
    // 200 x 130 and flow-layout.ts's previews correct without touching them.
    expect(PITCH.width / PITCH.height).toBeCloseTo(2000 / 1300, 12);
  });
});

describe('pitch queries', () => {
  it('goal lines sit on both ends', () => {
    expect(goalLineX(PITCH, 0)).toBe(0);
    expect(goalLineX(PITCH, 1)).toBe(PITCH.width);
  });
  it('penalty spots are penaltySpotDist away from their goal line', () => {
    expect(penaltySpotX(PITCH, 0)).toBe(PITCH.penaltySpotDist);
    expect(penaltySpotX(PITCH, 1)).toBe(PITCH.width - PITCH.penaltySpotDist);
  });
  it('goalKickX sits on the small-area line at both ends', () => {
    expect(goalKickX(PITCH, 0)).toBe(PITCH.smallAreaDepth);
    expect(goalKickX(PITCH, 1)).toBe(PITCH.width - PITCH.smallAreaDepth);
  });
  it('between posts is symmetric around centerY and excludes the posts', () => {
    const half = PITCH.goalWidth / 2;
    expect(isBetweenPosts(PITCH, centerY(PITCH))).toBe(true);
    expect(isBetweenPosts(PITCH, centerY(PITCH) + half - 1)).toBe(true);
    expect(isBetweenPosts(PITCH, centerY(PITCH) - half - 1)).toBe(false);
    expect(isBetweenPosts(PITCH, centerY(PITCH) + half)).toBe(false);
  });
  it('big and small areas are anchored to their own side', () => {
    // 17 and 88 are arbitrary offsets: no boundary numbers on purpose.
    expect(isInsideBigArea(PITCH, 0, PITCH.bigAreaDepth - 17, centerY(PITCH) + 88)).toBe(true);
    expect(isInsideBigArea(PITCH, 1, PITCH.bigAreaDepth - 17, centerY(PITCH) + 88)).toBe(false);
    expect(isInsideBigArea(PITCH, 1, PITCH.width - PITCH.bigAreaDepth + 17, centerY(PITCH) - 88)).toBe(true);
    expect(isInsideSmallArea(PITCH, 0, PITCH.smallAreaDepth - 17, centerY(PITCH))).toBe(true);
    expect(isInsideSmallArea(PITCH, 0, PITCH.smallAreaDepth + 17, centerY(PITCH))).toBe(false);
    expect(isInsideSmallArea(PITCH, 0, 5, centerY(PITCH) + PITCH.smallAreaWidth / 2 + 17)).toBe(false);
  });
  it('centerX/centerY are the middle of the pitch', () => {
    expect(centerX(PITCH)).toBe(PITCH.width / 2);
    expect(centerY(PITCH)).toBe(PITCH.height / 2);
  });
  it('clampToBigArea pulls a point back inside its own side box on both axes', () => {
    const p = { x: PITCH.bigAreaDepth + 133, y: -40 };
    clampToBigArea(PITCH, 0, p);
    expect(p.x).toBe(PITCH.bigAreaDepth);
    expect(p.y).toBe(centerY(PITCH) - PITCH.bigAreaWidth / 2);
    const q = { x: 300, y: 700 };
    clampToBigArea(PITCH, 1, q);
    expect(q.x).toBe(PITCH.width - PITCH.bigAreaDepth);
    expect(q.y).toBe(700);
  });
});
