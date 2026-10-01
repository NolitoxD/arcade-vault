import { describe, expect, it } from 'vitest';
import { TEAMS } from './teams';
import { FRIENDLY_DIFFICULTY } from './mode';
import { MATCHES, playProbe, seeds, structuralProblems, sum } from './probe-harness';

// V15-4-10, probe 1 of 3 (the harness and the rules of every probe: probe-harness.ts).
// Seeds, fixed: frame 200..239, tackles + discipline 300..339; both at the friendly
// difficulty, ESPAÑA (home) v ITALIA, as engine-invariants.test.ts plays.
const HOME = TEAMS[0];
const AWAY = TEAMS[1];
const FRIENDLY: readonly [number, number] = [FRIENDLY_DIFFICULTY, FRIENDLY_DIFFICULTY];

describe('probe: the goal frame is felt (G15-12; posts required, crossbar only reported)', () => {
  // Paco 30-sep (resolution 3): the CPU shoots low, so the crossbar belongs to the
  // player's CHARGED shots. This probe requires posts and only counts crossbars. And
  // controller ruling 01-oct: the band is "posts appear" at the friendly difficulty.
  const games = seeds(200).map((s) => playProbe(s, HOME, AWAY, FRIENDLY));
  const matchesWithAPost = games.filter((g) => g.posts > 0).length;

  it('the CPU hits a post in the forty matches at the friendly difficulty, and not in every one of them', () => {
    expect(matchesWithAPost).toBeGreaterThan(0);          // "ni rarisimo": it appears
    expect(matchesWithAPost).toBeLessThan(MATCHES);       // "ni constante"
  });

  it('structure: every match ends, caps on sendings off and injuries hold, exactly one active keeper', () => {
    expect(structuralProblems(games)).toEqual([]);
  });
});

describe('probe: tackles, fouls, cards and injuries (G15-24, G15-13, G15-18)', () => {
  const games = seeds(300).map((s) => playProbe(s, HOME, AWAY, FRIENDLY));
  const slidesStarted = sum(games, (g) => g.slidesStarted);
  const tackleEvents = sum(games, (g) => g.tackleEvents);
  const fouls = sum(games, (g) => g.fouls);

  // The clean share (tacklesWon / slidesStarted, G15-24 "~50 %"), the fouls, cards,
  // sendings off, injuries and substitutions per match are REPORTED (specs/31-vault-world-cup.md,
  // G15-28 final band table), not asserted: controller ruling 01-oct.
  it('NEGATIVE CONTROL: the two counters are NOT the same number -- per-step events are not slides', () => {
    expect(tackleEvents).toBeGreaterThan(slidesStarted * 4);
  });

  it('NEGATIVE CONTROL: the probe is counting something -- there ARE slides and there ARE fouls', () => {
    expect(slidesStarted).toBeGreaterThan(MATCHES);   // more than one slide per match
    expect(fouls).toBeGreaterThan(0);
  });

  it('structure: every match ends, no team over SENT_OFF_MAX sent off or INJURY_MAX_PER_TEAM injuries, exactly one active keeper', () => {
    expect(structuralProblems(games)).toEqual([]);
  });
});
