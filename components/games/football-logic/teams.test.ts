import { describe, expect, it } from 'vitest';
import { FORMATIONS, OUTFIELD, STRATEGIES, STRATEGY_SHIFT, TEAMS, TEAM_SIZE, slotCounts, teamById } from './teams';
import { checkFormation, checkTeam, checkTeams } from './invariants';

describe('published content (2 teams, 1 formation — the rest arrives in step 7)', () => {
  it('every published team passes checkTeam and the pair is unique', () => {
    for (const t of TEAMS) expect({ id: t.id, problems: checkTeam(t) }).toEqual({ id: t.id, problems: [] });
    expect(checkTeams(TEAMS)).toEqual([]);
  });
  it('every published formation passes checkFormation', () => {
    for (const f of FORMATIONS) expect({ id: f.id, problems: checkFormation(f) }).toEqual({ id: f.id, problems: [] });
  });
  it('3-3-2 is published with 3 defenders, 3 midfielders and 2 forwards', () => {
    const f = FORMATIONS.find((x) => x.id === '3-3-2');
    expect(f && slotCounts(f)).toEqual([3, 3, 2]);
  });
  it('team size is nine: eight outfield plus the goalkeeper', () => {
    expect(TEAM_SIZE).toBe(OUTFIELD + 1);
    expect(OUTFIELD).toBe(8);
  });
  it('strategies shift by ±STRATEGY_SHIFT and neutral by nothing', () => {
    expect(STRATEGIES.attack).toBe(STRATEGY_SHIFT);
    expect(STRATEGIES.defend).toBe(-STRATEGY_SHIFT);
    expect(STRATEGIES.neutral).toBe(0);
  });
  it('finds a team by id and nothing by a made-up id', () => {
    expect(teamById(TEAMS, 'espana')?.name).toBe('ESPAÑA');
    expect(teamById(TEAMS, 'atlantis')).toBeUndefined();
  });
});
