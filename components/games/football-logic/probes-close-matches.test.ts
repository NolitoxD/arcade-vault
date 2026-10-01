import { describe, expect, it } from 'vitest';
import { TEAMS } from './teams';
import { FRIENDLY_DIFFICULTY } from './mode';
import { ROUND_DIFFICULTY } from './world-cup';
import { blowoutShare, closeShare, playProbe, seeds, structuralProblems, type Probe } from './probe-harness';

// V15-4-10, probe 2 of 3 (the harness and the rules of every probe: probe-harness.ts).
// G15-28 bands 1 and 2, at the difficulties the game actually plays (controller ruling
// 01-oct). In a match "at difficulty d" BOTH profiles carry d: the World Cup's CPU pairs
// play d v d, and the human's profile is humanProfile(team, d). Seeds, fixed:
//   friendly            400..439  FRIENDLY_DIFFICULTY v FRIENDLY_DIFFICULTY
//   World Cup ladder    500..539  rung = ladder[seed % 4] on both sides (ten per round)
// Both orientations: ESPAÑA at home, then the same seeds with ITALIA at home.
const ESP = TEAMS[0];
const ITA = TEAMS[1];
const LADDER: readonly number[] = [
  ROUND_DIFFICULTY['round-16'], ROUND_DIFFICULTY.quarters, ROUND_DIFFICULTY.semis, ROUND_DIFFICULTY.final,
];

function ladderRung(seed: number): number {
  return LADDER[seed % LADDER.length];
}

describe('probe: most matches stay alive to the end (G15-28 bands 1 and 2, at the difficulties played)', () => {
  const friendly: readonly (readonly Probe[])[] = [
    seeds(400).map((s) => playProbe(s, ESP, ITA, [FRIENDLY_DIFFICULTY, FRIENDLY_DIFFICULTY])),
    seeds(400).map((s) => playProbe(s, ITA, ESP, [FRIENDLY_DIFFICULTY, FRIENDLY_DIFFICULTY])),
  ];
  const ladder: readonly (readonly Probe[])[] = [
    seeds(500).map((s) => playProbe(s, ESP, ITA, [ladderRung(s), ladderRung(s)])),
    seeds(500).map((s) => playProbe(s, ITA, ESP, [ladderRung(s), ladderRung(s)])),
  ];

  for (const [label, sets] of [['friendly', friendly], ['World Cup ladder', ladder]] as const) {
    for (const o of [0, 1] as const) {
      it(`${label}, orientation ${o + 1}: at least 70 % drawn or decided by one goal, at most 5 % blowouts`, () => {
        expect(closeShare(sets[o])).toBeGreaterThanOrEqual(0.7);
        expect(blowoutShare(sets[o])).toBeLessThanOrEqual(0.05);
      });
    }
  }

  it('structure: every match ends, no team over SENT_OFF_MAX sent off or INJURY_MAX_PER_TEAM injuries, exactly one active keeper', () => {
    expect(structuralProblems([...friendly[0], ...friendly[1], ...ladder[0], ...ladder[1]])).toEqual([]);
  });
});
