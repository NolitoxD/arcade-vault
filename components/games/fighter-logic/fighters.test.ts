import { describe, expect, it } from 'vitest';
import {
  bossFighter, difficultyRank, fighterById, ROSTER, ROSTER_SIZE, selectableFighters, statTotal, STAT_BUDGET,
} from './fighters';
import { checkRoster } from './roster-invariants';
import { magicKinds, MAGIC_SPECS } from './magic';

describe('roster queries', () => {
  it('finds a fighter by id and nothing by a made-up id', () => {
    expect(fighterById(ROSTER, 'nova')?.name).toBe('NOVA');
    expect(fighterById(ROSTER, 'ryu')).toBeUndefined();
  });
  it('never offers the boss as a selectable fighter', () => {
    expect(selectableFighters(ROSTER).some((f) => f.boss)).toBe(false);
    expect(bossFighter(ROSTER).id).toBe('arquitecto');
  });
  it('keeps every selectable fighter on the exact budget', () => {
    for (const f of selectableFighters(ROSTER)) {
      expect({ id: f.id, total: statTotal(f) }).toEqual({ id: f.id, total: STAT_BUDGET });
    }
  });
  it('ranks a fast fighter above a strong one on the same budget', () => {
    const fast = { strength: 3, speed: 9, reach: 3 } as never;
    const strong = { strength: 9, speed: 3, reach: 3 } as never;
    expect(difficultyRank(fast)).toBeGreaterThan(difficultyRank(strong));
  });
});

describe('the published roster', () => {
  it('publishes a roster with no invariant problems', () => {
    expect(checkRoster(ROSTER, magicKinds(MAGIC_SPECS))).toEqual([]);
  });
  it('has nine fighters: eight selectable plus the boss', () => {
    expect(ROSTER).toHaveLength(9);
    expect(selectableFighters(ROSTER)).toHaveLength(ROSTER_SIZE);
  });
  it('gives every selectable fighter a different magic', () => {
    const magics = selectableFighters(ROSTER).map((f) => f.magic);
    expect(new Set(magics).size).toBe(ROSTER_SIZE);
  });
  it('documents the boss exemption: the architect is above the budget', () => {
    expect(statTotal(bossFighter(ROSTER))).toBeGreaterThan(STAT_BUDGET);
  });
});
