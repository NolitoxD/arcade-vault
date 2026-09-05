import { describe, expect, it } from 'vitest';
import {
  PITCH, centerX, centerY, clampToBigArea, goalLineX, isBetweenPosts,
  isInsideBigArea, isInsideSmallArea, penaltySpotX,
} from './pitch';
import { checkPitch } from './invariants';

describe('PITCH', () => {
  it('passes checkPitch', () => {
    expect(checkPitch(PITCH)).toEqual([]);
  });
  it('is 2000 x 1300 as the spec says', () => {
    expect([PITCH.width, PITCH.height]).toEqual([2000, 1300]);
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
    expect(centerX(PITCH)).toBe(1000);
    expect(centerY(PITCH)).toBe(650);
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
