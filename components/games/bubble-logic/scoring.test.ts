import { describe, expect, it } from 'vitest';
import { cascadeScore, popScore, SCORE_MAGIC, SCORE_MAP, SCORE_VICTORY } from './scoring';

describe('scoring', () => {
  it('pays ten per popped bubble', () => {
    expect(popScore(0)).toBe(0);
    expect(popScore(3)).toBe(30);
  });
  it('pays a growing 20*i for each bubble in the cascade', () => {
    expect(cascadeScore(0)).toBe(0);
    expect(cascadeScore(1)).toBe(20);
    expect(cascadeScore(3)).toBe(120);      // 20 + 40 + 60
    expect(cascadeScore(10)).toBe(1100);
  });
  it('keeps the milestone values from the spec', () => {
    expect([SCORE_MAGIC, SCORE_MAP, SCORE_VICTORY]).toEqual([200, 1000, 5000]);
  });
});
