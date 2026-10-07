import { describe, expect, it } from 'vitest';
import { PITCH, centerY } from '../football-logic/pitch';
import {
  RIPPLE_AMPLITUDE, RIPPLE_STEPS, RIPPLE_TABLE_SIZE, RIPPLE_WAVE, beginNetRipple, createNetRipple, createRippleVertex,
  resetNetRipple, rippleOffset, rippleVertex, stepNetRipple,
} from './net-ripple';

const MID = centerY(PITCH);
const HALF_GOAL = PITCH.goalWidth / 2;

describe('net-ripple (G15-14)', () => {
  it('begins on the goal line of the goal scored on, with the impact clamped between the posts', () => {
    const r = createNetRipple();
    expect(r.active).toBe(false);
    // MEASURED 06-oct: a goal at the left end leaves the pre-step ball at x 2..12.
    beginNetRipple(r, PITCH, 8, MID - 20);
    expect([r.active, r.side, r.x, r.y, r.step]).toEqual([true, 0, 0, MID - 20, 0]);
    beginNetRipple(r, PITCH, 2193, MID + 400);
    expect([r.side, r.x, r.y]).toEqual([1, PITCH.width, MID + HALF_GOAL]);
    resetNetRipple(r);
    expect(r.active).toBe(false);
  });

  it('is zero ahead of the wave front, and everywhere once RIPPLE_STEPS have passed', () => {
    const r = createNetRipple();
    beginNetRipple(r, PITCH, 8, MID);
    expect(rippleOffset(r, 0)).toBe(0);              // sin(0): the wave starts flat
    for (let i = 0; i < 10; i++) stepNetRipple(r);
    expect(rippleOffset(r, 31)).toBe(0);             // the front is at 10 * 3 = 30
    let moved = false;
    for (let d = 0; d <= 30; d++) if (rippleOffset(r, d) !== 0) moved = true;
    expect(moved).toBe(true);
    for (let i = 10; i < RIPPLE_STEPS; i++) stepNetRipple(r);
    expect(r.active).toBe(false);
    for (let d = 0; d <= 200; d++) expect(rippleOffset(r, d)).toBe(0);
  });

  it('never moves a point more than RIPPLE_AMPLITUDE, and damps out over time', () => {
    const r = createNetRipple();
    beginNetRipple(r, PITCH, 8, MID);
    const peak: number[] = [];
    for (let s = 0; s < RIPPLE_STEPS; s++) {
      let max = 0;
      for (let d = 0; d <= 200; d++) {
        const off = Math.abs(rippleOffset(r, d));
        expect(off).toBeLessThanOrEqual(RIPPLE_AMPLITUDE);
        if (off > max) max = off;
      }
      peak.push(max);
      stepNetRipple(r);
    }
    expect(peak[10]).toBeGreaterThan(0);
    expect(peak[50]).toBeLessThan(peak[10] / 4);
  });

  it('rippleVertex pushes a mesh point away from the impact, in place, and leaves the impact point itself alone', () => {
    const r = createNetRipple();
    const v = createRippleVertex();
    beginNetRipple(r, PITCH, 8, MID);
    for (let i = 0; i < 10; i++) stepNetRipple(r);
    const off = rippleOffset(r, 20);
    expect(off).toBeGreaterThan(0);
    rippleVertex(r, -20, MID, v);                    // 20 u straight behind the impact, inside the net
    expect(v.x).toBeCloseTo(-20 - off, 9);
    expect(v.y).toBe(MID);
    rippleVertex(r, 0, MID, v);
    expect([v.x, v.y]).toEqual([0, MID]);
  });

  it('the wave table is built once at load: RIPPLE_TABLE_SIZE samples of one sine period', () => {
    expect(RIPPLE_WAVE.length).toBe(RIPPLE_TABLE_SIZE);
    expect(RIPPLE_WAVE[0]).toBe(0);
    expect(RIPPLE_WAVE[RIPPLE_TABLE_SIZE / 4]).toBeCloseTo(1, 6);
    expect(RIPPLE_WAVE[(RIPPLE_TABLE_SIZE * 3) / 4]).toBeCloseTo(-1, 6);
  });
});
