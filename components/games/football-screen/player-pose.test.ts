import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../football-logic/players';
import {
  DIVE_END_R_RATIO, DIVE_HALF_W_RATIO, HEAD_FORWARD_RATIO, HEAD_R_RATIO,
  SHOULDER_BACK_RATIO, SHOULDER_HALF_RATIO,
  createDivePose, createPlayerPose, divePose, playerPose,
} from './player-pose';

const R = PLAYER_RADIUS;

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

describe('playerPose', () => {
  it('puts the head forward along the facing vector', () => {
    const out = createPlayerPose();
    playerPose(100, 200, 1, 0, R, out);
    expect(out.headX).toBeCloseTo(100 + R * HEAD_FORWARD_RATIO, 6);
    expect(out.headY).toBeCloseTo(200, 6);
    expect(out.headR).toBeCloseTo(R * HEAD_R_RATIO, 6);
  });

  it('follows the facing vector round: facing up puts the head above the centre', () => {
    const out = createPlayerPose();
    playerPose(100, 200, 0, -1, R, out);
    expect(out.headX).toBeCloseTo(100, 6);
    expect(out.headY).toBeCloseTo(200 - R * HEAD_FORWARD_RATIO, 6);
  });

  it('draws the shoulders PERPENDICULAR to the facing vector, whatever it is', () => {
    const out = createPlayerPose();
    const facings: readonly (readonly [number, number])[] = [
      [1, 0], [0, 1], [-1, 0], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2],
    ];
    for (const [fx, fy] of facings) {
      playerPose(0, 0, fx, fy, R, out);
      const shoulderX = out.rightX - out.leftX;
      const shoulderY = out.rightY - out.leftY;
      expect(dot(shoulderX, shoulderY, fx, fy)).toBeCloseTo(0, 6);
    }
  });

  it('gives the shoulders the full span on both sides of the body', () => {
    const out = createPlayerPose();
    playerPose(0, 0, 1, 0, R, out);
    const span = Math.hypot(out.rightX - out.leftX, out.rightY - out.leftY);
    expect(span).toBeCloseTo(2 * R * SHOULDER_HALF_RATIO, 6);
  });

  it('sits the shoulder line BEHIND the centre, so head and shoulders read as a direction', () => {
    const out = createPlayerPose();
    playerPose(0, 0, 1, 0, R, out);
    const midX = (out.leftX + out.rightX) / 2;
    expect(midX).toBeCloseTo(-R * SHOULDER_BACK_RATIO, 6);
    expect(midX).toBeLessThan(0);
    expect(out.headX).toBeGreaterThan(0);
  });

  it('keeps the whole figure inside the body circle it is drawn on', () => {
    const out = createPlayerPose();
    playerPose(0, 0, Math.SQRT1_2, -Math.SQRT1_2, R, out);
    expect(Math.hypot(out.headX, out.headY) + out.headR).toBeLessThanOrEqual(R);
    expect(Math.hypot(out.leftX, out.leftY)).toBeLessThanOrEqual(R);
    expect(Math.hypot(out.rightX, out.rightY)).toBeLessThanOrEqual(R);
  });

  it('falls back to facing right when the engine hands it a zero vector', () => {
    const out = createPlayerPose();
    playerPose(50, 50, 0, 0, R, out);
    expect(out.headX).toBeCloseTo(50 + R * HEAD_FORWARD_RATIO, 6);
    expect(out.headY).toBeCloseTo(50, 6);
    expect(Number.isFinite(out.leftX)).toBe(true);
    expect(Number.isFinite(out.rightY)).toBe(true);
  });

  it('writes in place and returns nothing (criterion 20: no allocation per frame)', () => {
    const out = createPlayerPose();
    expect(playerPose(1, 2, 1, 0, R, out)).toBeUndefined();
    const first = out.headX;
    playerPose(9, 2, 1, 0, R, out);
    expect(out.headX).not.toBe(first);
  });
});

describe('divePose', () => {
  it('collapses onto the centre when the reach is 0, so the pose starts standing', () => {
    const out = createDivePose();
    divePose(100, 100, 1, 0, R, 0, out);
    expect(out.frontX).toBeCloseTo(100, 6);
    expect(out.backX).toBeCloseTo(100, 6);
    expect(out.frontY).toBeCloseTo(100, 6);
    expect(out.backY).toBeCloseTo(100, 6);
  });

  it('stretches symmetrically along the dive direction', () => {
    const out = createDivePose();
    divePose(100, 100, 0, 1, R, 1.5, out);
    expect(out.frontY).toBeCloseTo(100 + R * 1.5, 6);
    expect(out.backY).toBeCloseTo(100 - R * 1.5, 6);
    expect(out.frontX).toBeCloseTo(100, 6);
    expect(out.backX).toBeCloseTo(100, 6);
  });

  it('gives the body a width perpendicular to the dive, narrower than the standing body', () => {
    const out = createDivePose();
    divePose(0, 0, 1, 0, R, 1.5, out);
    expect(dot(out.sideX, out.sideY, 1, 0)).toBeCloseTo(0, 6);
    expect(Math.hypot(out.sideX, out.sideY)).toBeCloseTo(R * DIVE_HALF_W_RATIO, 6);
    expect(R * DIVE_HALF_W_RATIO).toBeLessThan(R);
    expect(out.endR).toBeCloseTo(R * DIVE_END_R_RATIO, 6);
  });

  it('keeps the two ends and the sides perpendicular for a diagonal dive too', () => {
    const out = createDivePose();
    divePose(0, 0, Math.SQRT1_2, Math.SQRT1_2, R, 1, out);
    const alongX = out.frontX - out.backX;
    const alongY = out.frontY - out.backY;
    expect(dot(alongX, alongY, out.sideX, out.sideY)).toBeCloseTo(0, 6);
    expect(Math.hypot(alongX, alongY)).toBeCloseTo(2 * R, 6);
  });

  it('falls back to a horizontal dive on a zero direction instead of producing NaN', () => {
    const out = createDivePose();
    divePose(0, 0, 0, 0, R, 1.5, out);
    expect(Number.isFinite(out.frontX)).toBe(true);
    expect(Number.isFinite(out.sideY)).toBe(true);
    expect(out.frontX).toBeCloseTo(R * 1.5, 6);
  });
});
