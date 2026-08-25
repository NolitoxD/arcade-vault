import { describe, expect, it } from 'vitest';
import { BOARD_SCORES, barPhase, GREEN_ZONE, hitQuality } from './bonus';

describe('bonus boards', () => {
  it('scores 1000/2000/4000', () => {
    expect(BOARD_SCORES).toEqual([1000, 2000, 4000]);
  });
  it('bar oscillates 0..1 and speeds up per board', () => {
    expect(barPhase(0, 0)).toBeCloseTo(0);
    expect(barPhase(600, 0)).toBeCloseTo(1); // half of 1200ms period reaches the top
    expect(barPhase(1200, 0)).toBeCloseTo(0); // full period returns
    expect(barPhase(325, 2)).toBeCloseTo(1); // 650ms period board 3
  });
  it('hit inside the green zone only', () => {
    expect(hitQuality((GREEN_ZONE[0] + GREEN_ZONE[1]) / 2)).toBe('hit');
    expect(hitQuality(GREEN_ZONE[0] - 0.05)).toBe('miss');
    expect(hitQuality(GREEN_ZONE[1] + 0.05)).toBe('miss');
  });
});
