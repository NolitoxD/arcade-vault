import { describe, expect, it } from 'vitest';
import { SCORE_JUMP, SCORE_SMASH, SCORE_LEVEL, HAMMER_MS, LEVEL_TIME_MS, timeBonus, jumpedOver } from './scoring';

describe('scoring', () => {
  it('uses the spec values', () => {
    expect([SCORE_JUMP, SCORE_SMASH, SCORE_LEVEL]).toEqual([100, 300, 1500]);
    expect(HAMMER_MS).toBe(8000);
    expect(LEVEL_TIME_MS).toBe(90_000);
  });
  it('pays 100 per remaining second, never negative', () => {
    expect(timeBonus(12_400)).toBe(1200);
    expect(timeBonus(0)).toBe(0);
    expect(timeBonus(-500)).toBe(0);
  });
  it('counts a jump only while airborne and only when the barrel is crossed', () => {
    expect(jumpedOver(100, 90, 110, true)).toBe(true);
    expect(jumpedOver(100, 110, 90, true)).toBe(true);
    expect(jumpedOver(100, 90, 110, false)).toBe(false);
    expect(jumpedOver(200, 90, 110, true)).toBe(false);
  });
});
