import { describe, expect, it } from 'vitest';
import { humanProfile, profileFor } from './ai';
import { NORMAL_RULES, TRAINING_RULES, createMatch, type MatchState } from './match';
import { PITCH } from './pitch';
import { createRng } from './rng';
import { FORMATIONS, TEAMS, teamById } from './teams';
import {
  FRIENDLY_DIFFICULTY, createFriendlyMode, createWorldCupMode, drawRival, drawSeedFor, modeAbandonMatch, modeAwayId,
  modeBracket, modeDifficulty, modeEndMatch, modeFxKind, modeHomeId, modeHumanSide, modeMatchLabel, modeMatchSeed, modeRules,
  modeScore, modeScores, modeStatus, modeVictoryScreen, modeVictoryTeamId, modeVictoryTitle, sideIsHuman, type GameMode,
} from './mode';
import {
  createWorldCup, humanMatchSeed, humanPairIndex, humanSideInPair, nextCpuPair, pairAwayId, pairHomeId, resolveCpuMatch,
} from './world-cup';

const BANK_IDS: readonly string[] = TEAMS.map((t) => t.id);

function team(id: string) {
  const def = teamById(TEAMS, id);
  if (def === undefined) throw new Error(`missing team ${id}`);
  return def;
}

// A finished match with a given scoreboard; level scores go to a shootout the given
// side wins (S-PK12: match.score stays level). Same helper as world-cup.test.ts.
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

// An abandoned match: 'over' with a level score and NO shootout (winnerOf === -1).
function abandonedLevel(homeId: string, awayId: string): MatchState {
  const m = createMatch([team(homeId), team(awayId)], FORMATIONS, PITCH, [humanProfile(team(homeId), 5), profileFor(team(awayId), 5)]);
  m.phase = 'over';
  return m;
}

// The human's World Cup match with the pair in the right order (S-PK3), scored from
// the human's point of view.
function humanWorldCupMatch(m: GameMode, goalsFor: number, goalsAgainst: number, humanWins: boolean): MatchState {
  const home = modeHomeId(m);
  const away = modeAwayId(m);
  return modeHumanSide(m) === 0
    ? finished(home, away, goalsFor, goalsAgainst, humanWins ? 0 : 1)
    : finished(home, away, goalsAgainst, goalsFor, humanWins ? 1 : 0);
}

function resolveCpuPairs(m: GameMode): void {
  const wc = modeBracket(m);
  if (wc === null) throw new Error('no bracket');
  for (let p = nextCpuPair(wc); p !== -1; p = nextCpuPair(wc)) resolveCpuMatch(wc, p, 0, 1, 0);
}

describe('drawRival', () => {
  it('never returns the home team and, over 300 draws, reaches every other team of the bank', () => {
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const rival = drawRival(BANK_IDS, 'espana', rng);
      expect(rival).not.toBe('espana');
      seen.add(rival);
    }
    expect(seen.size).toBe(BANK_IDS.length - 1);
  });

  it('is deterministic for a seed and throws for a home outside the bank', () => {
    expect(drawRival(BANK_IDS, 'italia', createRng(9))).toBe(drawRival(BANK_IDS, 'italia', createRng(9)));
    expect(() => drawRival(BANK_IDS, 'atlantida', createRng(9))).toThrow();
  });
});

describe('the three friendly modes', () => {
  it('answer the questions the component asks, without the component knowing which one it holds', () => {
    const cpu = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    const two = createFriendlyMode('friendly-2p', 'brasil', 'argentina');
    const training = createFriendlyMode('training', 'francia', 'alemania');

    expect(modeHumanSide(cpu)).toBe(0);
    expect(modeHumanSide(two)).toBe('both');
    expect(modeHumanSide(training)).toBe(0);
    expect([modeHomeId(cpu), modeAwayId(cpu)]).toEqual(['espana', 'italia']);
    expect([modeHomeId(two), modeAwayId(two)]).toEqual(['brasil', 'argentina']);
    for (const m of [cpu, two, training]) {
      expect(modeDifficulty(m)).toBe(FRIENDLY_DIFFICULTY);   // G9-6: 5, no selector
      expect(modeScore(m)).toBe(0);
      expect(modeScores(m)).toBe(false);                      // criterion 19: no friendly writes to the table
      expect(modeBracket(m)).toBeNull();
      expect(modeMatchSeed(m, 12345)).toBe(12345);             // the run seed IS the match seed
      expect(modeStatus(m)).toBe('playing');
      expect(modeFxKind(m)).toBe('confetti');
      expect(modeVictoryTitle(m)).toBe('GANADOR');
    }
    expect(modeRules(cpu)).toBe(NORMAL_RULES);
    expect(modeRules(two)).toBe(NORMAL_RULES);
    expect(modeRules(training)).toBe(TRAINING_RULES);          // G9-1: the only mode with the switch on
    expect(modeVictoryScreen(cpu)).toBe(true);
    expect(modeVictoryScreen(two)).toBe(true);
    expect(modeVictoryScreen(training)).toBe(false);           // no clock, no end, no screen: R exits
    expect(modeMatchLabel(cpu)).toBe('AMISTOSO');
    expect(modeMatchLabel(two)).toBe('AMISTOSO A DOS');
    expect(modeMatchLabel(training)).toBe('ENTRENAMIENTO');
  });

  it('refuse the same team on both sides', () => {
    expect(() => createFriendlyMode('friendly-cpu', 'espana', 'espana')).toThrow();
  });

  it('sideIsHuman reads the four sides', () => {
    expect(sideIsHuman(0, 0)).toBe(true);
    expect(sideIsHuman(0, 1)).toBe(false);
    expect(sideIsHuman(1, 1)).toBe(true);
    expect(sideIsHuman('both', 0)).toBe(true);
    expect(sideIsHuman('both', 1)).toBe(true);
    expect(sideIsHuman('none', 0)).toBe(false);
    expect(sideIsHuman('none', 1)).toBe(false);
  });

  it('modeEndMatch on the CPU friendly: a human win is champion, a loss eliminated, an abandon at level is a draw -- and then no-ops', () => {
    const won = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    modeEndMatch(won, finished('espana', 'italia', 2, 1));
    expect(modeStatus(won)).toBe('champion');
    expect(modeVictoryTeamId(won, finished('espana', 'italia', 2, 1))).toBe('espana');
    modeEndMatch(won, finished('espana', 'italia', 0, 1));
    expect(modeStatus(won)).toBe('champion');

    const lost = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    modeEndMatch(lost, finished('espana', 'italia', 0, 0, 1));   // lost on penalties
    expect(modeStatus(lost)).toBe('eliminated');

    const level = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    modeEndMatch(level, abandonedLevel('espana', 'italia'));
    expect(modeStatus(level)).toBe('draw');
  });

  it('in the two-player friendly EITHER winner is a champion: both are human, and the screen names the one who won', () => {
    const a = createFriendlyMode('friendly-2p', 'brasil', 'argentina');
    modeEndMatch(a, finished('brasil', 'argentina', 1, 0));
    expect(modeStatus(a)).toBe('champion');
    expect(modeVictoryTeamId(a, finished('brasil', 'argentina', 1, 0))).toBe('brasil');
    const b = createFriendlyMode('friendly-2p', 'brasil', 'argentina');
    modeEndMatch(b, finished('brasil', 'argentina', 0, 3));
    expect(modeStatus(b)).toBe('champion');
    expect(modeVictoryTeamId(b, finished('brasil', 'argentina', 0, 3))).toBe('argentina');
  });

  // S-SC12 (step 8): abandon() does not touch the score, so a friendly abandoned with
  // a lead still reads GANADOR / ELIMINADO on the canvas. The friendly keeps that.
  it('modeAbandonMatch on a friendly reads the standing score like the natural end (S-SC12)', () => {
    const lead = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    const m = finished('espana', 'italia', 1, 0);
    m.shootout = null;
    modeAbandonMatch(lead, m);
    expect(modeStatus(lead)).toBe('champion');
  });
});

describe('the World Cup mode', () => {
  it('builds the same bracket as calling world-cup.ts with the derived draw stream', () => {
    const m = createWorldCupMode(BANK_IDS, 'japon', 77);
    const direct = createWorldCup(BANK_IDS, 'japon', 77, createRng(drawSeedFor(77)));
    const wc = modeBracket(m);
    expect(wc).not.toBeNull();
    if (wc === null) return;
    expect(wc.bracket).toEqual(direct.bracket);
    expect(wc.seed).toBe(77);
    expect(modeHumanSide(m)).toBe(humanSideInPair(direct));
    expect(modeHomeId(m)).toBe(pairHomeId(direct, humanPairIndex(direct)));
    expect(modeAwayId(m)).toBe(pairAwayId(direct, humanPairIndex(direct)));
    expect(modeMatchSeed(m, 999)).toBe(humanMatchSeed(direct));   // NOT the run seed: the derived one
    expect(modeDifficulty(m)).toBe(4);
    expect(modeRules(m)).toBe(NORMAL_RULES);
    expect(modeScores(m)).toBe(true);
    expect(modeVictoryScreen(m)).toBe(false);                       // only the final has one
    expect(modeMatchLabel(m)).toBe('CUARTOS DE FINAL');
    expect(modeFxKind(m)).toBe('fireworks');
    expect(modeVictoryTitle(m)).toBe('CAMPEONES DEL MUNDO');
  });

  it('three wins through modeEndMatch make the champion: difficulty 4 -> 6 -> 8, victory screen only in the final, for EVERY team', () => {
    for (const humanId of BANK_IDS) {
      const m = createWorldCupMode(BANK_IDS, humanId, 5);
      const difficulties: number[] = [];
      const screens: boolean[] = [];
      for (let i = 0; i < 3; i++) {
        difficulties.push(modeDifficulty(m));
        screens.push(modeVictoryScreen(m));
        resolveCpuPairs(m);
        modeEndMatch(m, humanWorldCupMatch(m, 2, 0, true));
      }
      expect(difficulties).toEqual([4, 6, 8]);
      expect(screens).toEqual([false, false, true]);
      expect(modeStatus(m)).toBe('champion');
      expect(modeScore(m)).toBe(61_000 + 6_000);
      expect(modeVictoryTeamId(m, humanWorldCupMatch(m, 2, 0, true))).toBe(humanId);
    }
  });

  it('a loss is eliminated with the points so far; a level abandon is eliminated too (G9-8)', () => {
    const lost = createWorldCupMode(BANK_IDS, 'uruguay', 8);
    resolveCpuPairs(lost);
    modeEndMatch(lost, humanWorldCupMatch(lost, 1, 2, false));
    expect(modeStatus(lost)).toBe('eliminated');
    expect(modeScore(lost)).toBe(1_000);

    const abandoned = createWorldCupMode(BANK_IDS, 'uruguay', 8);
    resolveCpuPairs(abandoned);
    modeEndMatch(abandoned, humanWorldCupMatch(abandoned, 3, 0, true));
    const kept = modeScore(abandoned);
    modeAbandonMatch(abandoned, abandonedLevel(modeHomeId(abandoned), modeAwayId(abandoned)));
    expect(modeStatus(abandoned)).toBe('eliminated');
    expect(modeScore(abandoned)).toBe(kept);
  });

  // The difference between the two abandons, and the reason modeAbandonMatch exists:
  // a World Cup match abandoned WITH A LEAD is still ELIMINADO (G9-8), never a win.
  it('modeAbandonMatch with a lead: the World Cup eliminates, the friendly keeps the standing result', () => {
    const wc = createWorldCupMode(BANK_IDS, 'croacia', 6);
    resolveCpuPairs(wc);
    const leading = humanWorldCupMatch(wc, 1, 0, true);
    leading.shootout = null;
    modeAbandonMatch(wc, leading);
    expect(modeStatus(wc)).toBe('eliminated');
    expect(modeScore(wc)).toBe(0);
  });
});
