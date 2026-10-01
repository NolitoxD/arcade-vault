import { describe, expect, it } from 'vitest';
import { TEAMS } from './teams';
import { ROUND_DIFFICULTY } from './world-cup';
import { decidedRecord, playProbe, seeds, structuralProblems } from './probe-harness';

// V15-4-10, probe 3 of 3 (the harness and the rules of every probe: probe-harness.ts).
// G15-28 band 3, as Paco re-decided it on 01-oct: a GUARD AGAINST INVERSION, not a 60 %
// band. The highest difficulty the game plays (the World Cup final) must win more of the
// matches DECIDED on the scoreboard than the floor difficulty does, both orientations
// pooled. Whether the World Cup feels progressively harder is judged by playing it; if it
// feels flat, the difficulty formula is v1.6 work. Never solved by helping the loser.
// Seeds, fixed: 600..639. ESPAÑA always at home, ITALIA away; only the difficulties swap
// (orientation 1: ESPAÑA high; orientation 2: ITALIA high), as in ai.test.ts's tendency.
const HIGH = ROUND_DIFFICULTY.final;
const LOW = 1;

describe('probe: the higher difficulty wins more decided matches than the lowest (G15-28 band 3, no help for the loser)', () => {
  const highHome = seeds(600).map((s) => playProbe(s, TEAMS[0], TEAMS[1], [HIGH, LOW]));
  const highAway = seeds(600).map((s) => playProbe(s, TEAMS[0], TEAMS[1], [LOW, HIGH]));
  const asHome = decidedRecord(highHome, 0);
  const asAway = decidedRecord(highAway, 1);

  it('difficulty 8 wins more decided matches than difficulty 1, both orientations pooled', () => {
    expect(asHome.won + asAway.won).toBeGreaterThan(asHome.lost + asAway.lost);
  });

  it('structure: every match ends, no team over SENT_OFF_MAX sent off or INJURY_MAX_PER_TEAM injuries, exactly one active keeper', () => {
    expect(structuralProblems([...highHome, ...highAway])).toEqual([]);
  });
});
