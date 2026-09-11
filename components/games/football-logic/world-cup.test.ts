import { describe, expect, it } from 'vitest';
import { humanProfile, profileFor } from './ai';
import { createMatch, type MatchState } from './match';
import { PITCH } from './pitch';
import { createRng } from './rng';
import { FORMATIONS, TEAMS, teamById } from './teams';
import {
  PERFECT_BASE_SCORE, ROUND_BONUS, ROUND_DIFFICULTY, ROUND_LABELS, SCORE_CLEAN_SHEET, SCORE_GOAL, SCORE_WIN, WORLD_CUP_SIZE,
  abandonHumanMatch, checkWorldCupBracket, cpuMatchSeed, createWorldCup, currentDifficulty, humanMatchSeed, humanOpponentId,
  humanPairIndex, humanSideInPair, isFinal, isStillIn, loseHumanMatch, matchPoints, matchSeedFor, nextCpuPair,
  pairAwayId, pairCount, pairHomeId, pairResult, resolveCpuMatch, roundLabel, winHumanMatch,
  type WorldCupRound, type WorldCupState,
} from './world-cup';

const BANK_IDS: readonly string[] = TEAMS.map((t) => t.id);
const ROUNDS: readonly WorldCupRound[] = ['quarters', 'semis', 'final'];

function team(id: string) {
  const def = teamById(TEAMS, id);
  if (def === undefined) throw new Error(`missing team ${id}`);
  return def;
}

// A finished match between two ids with a given scoreboard. A level score with
// `shootoutWinner` set decides it on penalties the way the engine does: the shootout
// keeps its own scoreboard and match.score stays level (S-PK12).
function finished(homeId: string, awayId: string, homeGoals: number, awayGoals: number, shootoutWinner: 0 | 1 = 0): MatchState {
  const m = createMatch([team(homeId), team(awayId)], FORMATIONS, PITCH, [humanProfile(team(homeId), 5), profileFor(team(awayId), 5)]);
  m.score[0] = homeGoals;
  m.score[1] = awayGoals;
  if (homeGoals === awayGoals) {
    m.shootout = m.scratch.shootout;
    m.shootout.taken[0] = 5;
    m.shootout.taken[1] = 5;
    m.shootout.scored[0] = shootoutWinner === 0 ? 4 : 3;
    m.shootout.scored[1] = shootoutWinner === 0 ? 3 : 4;
  }
  m.phase = 'over';
  return m;
}

// Resolves every CPU pair of the current round (home wins 2-1) and plays the human's
// match with the given scoreboard from the human's point of view.
function playRound(wc: WorldCupState, goalsFor: number, goalsAgainst: number, humanWins: boolean): void {
  for (let p = nextCpuPair(wc); p !== -1; p = nextCpuPair(wc)) resolveCpuMatch(wc, p, 0, 2, 1);
  const pair = humanPairIndex(wc);
  const side = humanSideInPair(wc);
  const home = pairHomeId(wc, pair);
  const away = pairAwayId(wc, pair);
  const m = side === 0
    ? finished(home, away, goalsFor, goalsAgainst, humanWins ? 0 : 1)
    : finished(home, away, goalsAgainst, goalsFor, humanWins ? 1 : 0);
  if (humanWins) winHumanMatch(wc, m);
  else loseHumanMatch(wc, m);
}

describe('createWorldCup', () => {
  it('draws exactly eight distinct teams of the bank with the human inside, for EVERY team of the bank and three seeds', () => {
    for (const humanId of BANK_IDS) {
      for (const seed of [1, 42, 1234567]) {
        const wc = createWorldCup(BANK_IDS, humanId, seed, createRng(seed));
        expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
        expect(wc.bracket).toHaveLength(WORLD_CUP_SIZE);
        expect(wc.entrants).toHaveLength(WORLD_CUP_SIZE);
        expect(wc.round).toBe('quarters');
        expect(wc.status).toBe('playing');
        expect(wc.score).toBe(0);
        expect(isStillIn(wc, humanId)).toBe(true);
        expect(humanOpponentId(wc)).not.toBe(humanId);
      }
    }
  });

  it('same seed -> same bracket and the same three match seeds; a different seed -> a different bracket', () => {
    const a = createWorldCup(BANK_IDS, 'espana', 7, createRng(7));
    const b = createWorldCup(BANK_IDS, 'espana', 7, createRng(7));
    expect(a.bracket).toEqual(b.bracket);
    expect(humanMatchSeed(a)).toBe(humanMatchSeed(b));
    for (const round of ROUNDS) {
      for (let pair = 0; pair < 4; pair++) expect(matchSeedFor(7, round, pair)).toBe(matchSeedFor(7, round, pair));
    }
    const c = createWorldCup(BANK_IDS, 'espana', 8, createRng(8));
    expect(c.bracket).not.toEqual(a.bracket);
  });

  it('bracket and entrants are independent arrays in memory', () => {
    const wc = createWorldCup(BANK_IDS, 'italia', 3, createRng(3));
    expect(wc.entrants).not.toBe(wc.bracket);
    wc.entrants[0] = 'x';
    expect(wc.bracket[0]).not.toBe('x');
  });

  // S-PK3: team 0 kicks first in the shootout, and the human is team 0 only when the
  // draw put him first in his pair. Over 200 draws he must land on both sides.
  it('the draw puts the human on either side of his pair (S-PK3 kick order is drawn too)', () => {
    let first = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (humanSideInPair(createWorldCup(BANK_IDS, 'brasil', seed, createRng(seed))) === 0) first++;
    }
    expect(first).toBeGreaterThan(50);
    expect(first).toBeLessThan(150);
  });

  it('throws when the human is not in the bank', () => {
    expect(() => createWorldCup(BANK_IDS, 'atlantida', 1, createRng(1))).toThrow();
  });
});

describe('matchSeedFor', () => {
  it('gives twelve distinct 32-bit seeds for the twelve (round, pair) slots of one tournament seed, for several seeds', () => {
    for (const seed of [0, 1, 7, 42, 999_999, 0x7fffffff, 1_757_000_000_000]) {
      const seen = new Set<number>();
      for (const round of ROUNDS) {
        for (let pair = 0; pair < 4; pair++) {
          const s = matchSeedFor(seed, round, pair);
          expect(Number.isInteger(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(0xffffffff);
          seen.add(s);
        }
      }
      expect(seen.size).toBe(12);
    }
  });

  it('two tournament seeds one apart do not share a match seed', () => {
    const a = new Set<number>();
    for (const round of ROUNDS) for (let p = 0; p < 4; p++) a.add(matchSeedFor(100, round, p));
    for (const round of ROUNDS) for (let p = 0; p < 4; p++) expect(a.has(matchSeedFor(101, round, p))).toBe(false);
  });
});

describe('cpuMatchSeed and pairResult (final fix wave: bracket rules the screen used to compose inline)', () => {
  it('cpuMatchSeed equals matchSeedFor(wc.seed, wc.round, pair) for several pairs, and follows the round forward', () => {
    const wc = createWorldCup(BANK_IDS, 'brasil', 17, createRng(17));
    for (let pair = 0; pair < pairCount(wc); pair++) {
      expect(cpuMatchSeed(wc, pair)).toBe(matchSeedFor(wc.seed, wc.round, pair));
    }
    playRound(wc, 2, 0, true);
    expect(wc.round).toBe('semis');
    for (let pair = 0; pair < pairCount(wc); pair++) {
      expect(cpuMatchSeed(wc, pair)).toBe(matchSeedFor(wc.seed, wc.round, pair));
    }
  });

  it('pairResult is null before a pair resolves and returns the recorded result after, scoped to the current round', () => {
    const wc = createWorldCup(BANK_IDS, 'brasil', 17, createRng(17));
    const human = humanPairIndex(wc);
    const other = human === 0 ? 1 : 0;
    expect(pairResult(wc, other)).toBeNull();
    resolveCpuMatch(wc, other, 1, 3, 2);
    const res = pairResult(wc, other);
    expect(res).not.toBeNull();
    expect(res?.homeGoals).toBe(3);
    expect(res?.awayGoals).toBe(2);
    expect(res?.winner).toBe(1);
    expect(res?.round).toBe('quarters');
    expect(pairResult(wc, human)).toBeNull(); // the human's own pair is still unresolved
  });

  it('after advancing a round, pairResult sees no result yet for any pair of the new round', () => {
    const wc = createWorldCup(BANK_IDS, 'argentina', 23, createRng(23));
    playRound(wc, 2, 0, true);
    expect(wc.round).toBe('semis');
    for (let pair = 0; pair < pairCount(wc); pair++) expect(pairResult(wc, pair)).toBeNull();
  });
});

describe('round tables', () => {
  it('difficulty 4/6/8 and the three Spanish labels', () => {
    expect(ROUND_DIFFICULTY).toEqual({ quarters: 4, semis: 6, final: 8 });
    expect(ROUND_LABELS.quarters).toBe('CUARTOS DE FINAL');
    expect(ROUND_LABELS.semis).toBe('SEMIFINAL');
    expect(ROUND_LABELS.final).toBe('FINAL');
    const wc = createWorldCup(BANK_IDS, 'japon', 2, createRng(2));
    expect(currentDifficulty(wc)).toBe(4);
    expect(roundLabel(wc)).toBe('CUARTOS DE FINAL');
    expect(isFinal(wc)).toBe(false);
  });

  it('the scoring table of the spec, and the perfect base of 61 000', () => {
    expect(matchPoints(0, 0, false)).toBe(SCORE_CLEAN_SHEET);
    expect(matchPoints(2, 1, true)).toBe(2 * SCORE_GOAL + SCORE_WIN);
    expect(matchPoints(3, 0, true)).toBe(3 * SCORE_GOAL + SCORE_WIN + SCORE_CLEAN_SHEET);
    expect(matchPoints(1, 2, false)).toBe(SCORE_GOAL);
    expect(ROUND_BONUS).toEqual({ quarters: 5_000, semis: 10_000, final: 25_000 });
    expect(PERFECT_BASE_SCORE).toBe(61_000);
  });
});

describe('the CPU pairs of a round', () => {
  it('nextCpuPair walks the three pairs without the human; resolveCpuMatch marks each, and refuses the human pair and a repeat', () => {
    const wc = createWorldCup(BANK_IDS, 'francia', 5, createRng(5));
    const human = humanPairIndex(wc);
    const visited: number[] = [];
    for (let p = nextCpuPair(wc); p !== -1; p = nextCpuPair(wc)) {
      visited.push(p);
      resolveCpuMatch(wc, p, 1, 0, 3);
      expect(wc.resolved[p]).toBe(true);
      expect(wc.pairWinner[p]).toBe(pairAwayId(wc, p));
    }
    expect(visited).toHaveLength(3);
    expect(visited).not.toContain(human);
    expect(wc.resultCount).toBe(3);
    resolveCpuMatch(wc, human, 0, 1, 0);        // the human's pair: refused
    expect(wc.resolved[human]).toBe(false);
    resolveCpuMatch(wc, visited[0], 0, 5, 5);   // already resolved: refused
    expect(wc.pairWinner[visited[0]]).toBe(pairAwayId(wc, visited[0]));
    expect(wc.resultCount).toBe(3);
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
  });

  it('winHumanMatch throws while a CPU pair is still unresolved', () => {
    const wc = createWorldCup(BANK_IDS, 'francia', 5, createRng(5));
    const pair = humanPairIndex(wc);
    const m = humanSideInPair(wc) === 0
      ? finished(pairHomeId(wc, pair), pairAwayId(wc, pair), 1, 0)
      : finished(pairHomeId(wc, pair), pairAwayId(wc, pair), 0, 1);
    expect(() => winHumanMatch(wc, m)).toThrow();
  });

  it('winHumanMatch throws when the match does not carry the human on the side the pair says (S-PK3)', () => {
    const wc = createWorldCup(BANK_IDS, 'francia', 5, createRng(5));
    for (let p = nextCpuPair(wc); p !== -1; p = nextCpuPair(wc)) resolveCpuMatch(wc, p, 0, 1, 0);
    const pair = humanPairIndex(wc);
    // Deliberately swapped: the human on the wrong side of the pair.
    const swapped = humanSideInPair(wc) === 0
      ? finished(pairAwayId(wc, pair), pairHomeId(wc, pair), 0, 1)
      : finished(pairAwayId(wc, pair), pairHomeId(wc, pair), 1, 0);
    expect(() => winHumanMatch(wc, swapped)).toThrow();
  });
});

describe('winning the World Cup', () => {
  it('three exact wins make the champion, for EVERY team of the bank, with 61 000 + goals', () => {
    for (const humanId of BANK_IDS) {
      const wc = createWorldCup(BANK_IDS, humanId, 5, createRng(5));
      const sizes: number[] = [];
      for (let i = 0; i < 3; i++) {
        expect(wc.status).toBe('playing');
        sizes.push(wc.entrants.length);
        expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
        playRound(wc, 2, 0, true);
        expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
      }
      expect(sizes).toEqual([8, 4, 2]);
      expect(wc.status).toBe('champion');
      expect(wc.round).toBe('final');
      expect(wc.score).toBe(PERFECT_BASE_SCORE + 6 * SCORE_GOAL);
      expect(wc.resultCount).toBe(7);
    }
  });

  it('the winners of a round are exactly the next round\'s entrants, in pair order', () => {
    const wc = createWorldCup(BANK_IDS, 'uruguay', 9, createRng(9));
    const expected: string[] = [];
    for (let p = 0; p < pairCount(wc); p++) expected.push(p === humanPairIndex(wc) ? 'uruguay' : pairHomeId(wc, p));
    playRound(wc, 1, 0, true);
    expect(wc.entrants).toEqual(expected);
    expect(wc.round).toBe('semis');
    expect(currentDifficulty(wc)).toBe(6);
    expect(isStillIn(wc, expected[0])).toBe(true);
    expect(wc.resolved.every((r) => !r)).toBe(true);
  });

  it('a level match decided on penalties still scores a clean sheet for the human (S-PK12 read through match.score)', () => {
    const wc = createWorldCup(BANK_IDS, 'mexico', 4, createRng(4));
    playRound(wc, 0, 0, true);
    expect(wc.score).toBe(SCORE_WIN + SCORE_CLEAN_SHEET + ROUND_BONUS.quarters);
  });

  it('every transition is a no-op on a champion', () => {
    const wc = createWorldCup(BANK_IDS, 'croacia', 6, createRng(6));
    for (let i = 0; i < 3; i++) playRound(wc, 1, 0, true);
    const score = wc.score;
    const snapshot = JSON.stringify(wc);
    expect(nextCpuPair(wc)).toBe(-1);
    resolveCpuMatch(wc, 0, 0, 1, 0);
    abandonHumanMatch(wc);
    expect(wc.score).toBe(score);
    expect(JSON.stringify(wc)).toBe(snapshot);
  });
});

describe('losing and abandoning', () => {
  it('loseHumanMatch keeps the goals and the clean sheet, adds no win and no round bonus, and eliminates', () => {
    const a = createWorldCup(BANK_IDS, 'belgica', 12, createRng(12));
    playRound(a, 0, 1, false);
    expect(a.status).toBe('eliminated');
    expect(a.score).toBe(0);
    const b = createWorldCup(BANK_IDS, 'belgica', 12, createRng(12));
    playRound(b, 1, 2, false);
    expect(b.score).toBe(SCORE_GOAL);
    const c = createWorldCup(BANK_IDS, 'belgica', 12, createRng(12));
    playRound(c, 0, 0, false);   // lost on penalties at 0-0: the clean sheet counts for both
    expect(c.score).toBe(SCORE_CLEAN_SHEET);
    expect(c.resultCount).toBe(4);
    expect(c.results[3].winner).toBe(humanSideInPair(c) === 0 ? 1 : 0);
  });

  it('points from earlier rounds survive an elimination', () => {
    const wc = createWorldCup(BANK_IDS, 'portugal', 13, createRng(13));
    playRound(wc, 2, 0, true);
    const afterQuarters = wc.score;
    playRound(wc, 1, 3, false);
    expect(wc.score).toBe(afterQuarters + SCORE_GOAL);
    expect(wc.status).toBe('eliminated');
    expect(wc.round).toBe('semis');
  });

  it('abandonHumanMatch (G9-8, viewport guard): eliminated, the points so far are kept, nothing from the abandoned match', () => {
    const wc = createWorldCup(BANK_IDS, 'marruecos', 14, createRng(14));
    playRound(wc, 3, 1, true);
    const kept = wc.score;
    abandonHumanMatch(wc);
    expect(wc.status).toBe('eliminated');
    expect(wc.score).toBe(kept);
    expect(wc.resultCount).toBe(4);
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
  });

  it('every transition is a no-op on an eliminated tournament', () => {
    const wc = createWorldCup(BANK_IDS, 'argentina', 15, createRng(15));
    playRound(wc, 0, 2, false);
    const snapshot = JSON.stringify(wc);
    abandonHumanMatch(wc);
    resolveCpuMatch(wc, 0, 1, 0, 1);
    expect(() => winHumanMatch(wc, finished('argentina', 'italia', 1, 0))).not.toThrow();
    expect(JSON.stringify(wc)).toBe(snapshot);
  });
});

describe('checkWorldCupBracket', () => {
  function valid(): WorldCupState {
    return createWorldCup(BANK_IDS, 'espana', 21, createRng(21));
  }

  it('accepts a freshly drawn bracket and a mid-tournament one', () => {
    const wc = valid();
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
    playRound(wc, 1, 0, true);
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
  });

  it('rejects a duplicate seed, a seed outside the bank, and a bracket of the wrong size', () => {
    const dup = valid();
    dup.bracket[1] = dup.bracket[0];
    expect(checkWorldCupBracket(dup, BANK_IDS)).not.toEqual([]);
    const foreign = valid();
    foreign.bracket[2] = 'atlantida';
    expect(checkWorldCupBracket(foreign, BANK_IDS)).not.toEqual([]);
    const short = valid();
    short.bracket.pop();
    expect(checkWorldCupBracket(short, BANK_IDS)).not.toEqual([]);
  });

  it('rejects entrants of the wrong size for the round, an entrant outside the bracket, and a missing human', () => {
    const wrongSize = valid();
    wrongSize.round = 'semis';
    expect(checkWorldCupBracket(wrongSize, BANK_IDS)).not.toEqual([]);
    const outside = valid();
    outside.entrants[3] = 'atlantida';
    expect(checkWorldCupBracket(outside, BANK_IDS)).not.toEqual([]);
    const noHuman = valid();
    noHuman.entrants[noHuman.entrants.indexOf('espana')] = noHuman.entrants[0] === 'espana' ? noHuman.entrants[1] : noHuman.entrants[0];
    expect(checkWorldCupBracket(noHuman, BANK_IDS)).not.toEqual([]);
  });

  it('rejects a resolved pair whose winner is neither of its two teams', () => {
    const wc = valid();
    const p = nextCpuPair(wc);
    resolveCpuMatch(wc, p, 0, 1, 0);
    wc.pairWinner[p] = 'atlantida';
    expect(checkWorldCupBracket(wc, BANK_IDS)).not.toEqual([]);
  });
});
