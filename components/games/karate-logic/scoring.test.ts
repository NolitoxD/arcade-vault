// scoring.test.ts
import { describe, expect, it } from 'vitest';
import { SCORE_PER_POINT, OPPONENT_BONUS, timeBonus, applyPoint, matchWinner } from './scoring';

describe('scoring', () => {
  it('score constants per spec', () => {
    expect(SCORE_PER_POINT).toEqual({ half: 500, full: 1000 });
    expect(OPPONENT_BONUS).toBe(2000);
    expect(timeBonus(12_400)).toBe(1200);
  });
  const base = { playerPoints: 0, cpuPoints: 0, roundMs: 0, goldenPoint: false };
  it('wins at 2 points', () => {
    let s = applyPoint(base, 'player', 1);
    expect(matchWinner(s)).toBeNull();
    s = applyPoint(s, 'player', 1);
    expect(matchWinner(s)).toBe('player');
  });
  it('half points accumulate', () => {
    let s = applyPoint(base, 'cpu', 0.5);
    s = applyPoint(s, 'cpu', 0.5);
    s = applyPoint(s, 'cpu', 0.5);
    s = applyPoint(s, 'cpu', 0.5);
    expect(matchWinner(s)).toBe('cpu');
  });
  it('leader wins at 30s; tie goes to golden point where any point decides', () => {
    const lead = { ...base, playerPoints: 1, cpuPoints: 0.5, roundMs: 30_000 };
    expect(matchWinner(lead)).toBe('player');
    const tie = { ...base, playerPoints: 1, cpuPoints: 1, roundMs: 30_000 };
    expect(matchWinner(tie)).toBeNull();
    const golden = applyPoint({ ...tie, goldenPoint: true }, 'cpu', 0.5);
    expect(matchWinner(golden)).toBe('cpu');
  });
});
