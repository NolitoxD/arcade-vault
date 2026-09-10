import { describe, expect, it } from 'vitest';
import { humanProfile, profileFor } from '../football-logic/ai';
import { createMatch, type MatchState } from '../football-logic/match';
import {
  modeAwayId, modeBracket, modeDifficulty, modeHomeId, modeHumanSide, modeScore, modeStatus, type GameMode,
} from '../football-logic/mode';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS, teamById } from '../football-logic/teams';
import {
  HUMANS_BY_MODE, MODE_BLURBS, MODE_LIST, MODE_NAMES,
  createFlowState, flowAfterModeBuilt, flowBracketAction, flowBuildMode, flowCaptionsDrained, flowConfirmBracket,
  flowConfirmDraw, flowConfirmMode, flowConfirmTeam, flowContinue, flowCpuPair, flowExitMatch, flowHumanCount,
  flowMatchOver, flowModeKind, flowMoveBracketChoice, flowMoveMode, flowMoveTeam, flowPickingHuman, flowRecordCpuResult,
  flowReset, flowSetFormation, flowSkipSpectate, flowSpectateOver, type FlowState,
} from './flow';

const BANK_IDS: readonly string[] = TEAMS.map((t) => t.id);
const BANK = BANK_IDS.length;
const SEED = 20260909;

function team(id: string) {
  const def = teamById(TEAMS, id);
  if (def === undefined) throw new Error(`missing team ${id}`);
  return def;
}

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

// The human's match of the current mode, scored from the human's side.
function humanMatch(m: GameMode, goalsFor: number, goalsAgainst: number, humanWins: boolean): MatchState {
  const home = modeHomeId(m);
  const away = modeAwayId(m);
  return modeHumanSide(m) === 0
    ? finished(home, away, goalsFor, goalsAgainst, humanWins ? 0 : 1)
    : finished(home, away, goalsAgainst, goalsFor, humanWins ? 1 : 0);
}

// Walks the selector to a mode and a team, and builds the mode as the component does.
function start(kind: string, teamIndex: number, secondIndex = -1): { f: FlowState; m: GameMode } {
  const f = createFlowState();
  while (flowModeKind(f) !== kind) flowMoveMode(f, 1);
  flowConfirmMode(f);
  f.cursor = teamIndex;
  const first = flowConfirmTeam(f, BANK);
  if (first === 'next') {
    f.cursor = secondIndex;
    expect(flowConfirmTeam(f, BANK)).toBe('done');
  } else expect(first).toBe('done');
  const m = flowBuildMode(f, BANK_IDS, SEED);
  flowAfterModeBuilt(f, m);
  return { f, m };
}

// Resolves the CPU pairs of the round by SALTAR, the way the component does.
function skipCpuPairs(f: FlowState, m: GameMode): void {
  while (flowBracketAction(f, m) !== 'play') {
    flowMoveBracketChoice(f, 1);
    expect(flowBracketAction(f, m)).toBe('skip');
    expect(flowConfirmBracket(f, m)).toBe('skip');
    const pair = flowCpuPair(m);
    const wc = modeBracket(m);
    if (wc === null) throw new Error('no bracket');
    flowRecordCpuResult(m, pair, finished(wc.entrants[pair * 2], wc.entrants[pair * 2 + 1], 1, 0));
    flowMoveBracketChoice(f, 1);   // back to VER, as the component leaves it
  }
}

describe('the mode selector', () => {
  it('lists the four modes of G9-1..G9-4 in order, with their names, blurbs and human counts', () => {
    expect(MODE_LIST).toEqual(['friendly-cpu', 'friendly-2p', 'training', 'world-cup']);
    expect(MODE_NAMES['friendly-cpu']).toBe('AMISTOSO');
    expect(MODE_NAMES['friendly-2p']).toBe('AMISTOSO A DOS');
    expect(MODE_NAMES.training).toBe('ENTRENAMIENTO');
    expect(MODE_NAMES['world-cup']).toBe('MUNDIAL');
    for (const kind of MODE_LIST) expect(MODE_BLURBS[kind].length).toBeGreaterThan(0);
    expect(HUMANS_BY_MODE).toEqual({ 'friendly-cpu': 1, 'friendly-2p': 2, training: 1, 'world-cup': 1 });
  });

  it('starts on mode-select at AMISTOSO, wraps in both directions, and A moves to team-select', () => {
    const f = createFlowState();
    expect(f.phase).toBe('mode-select');
    expect(flowModeKind(f)).toBe('friendly-cpu');
    flowMoveMode(f, -1);
    expect(flowModeKind(f)).toBe('world-cup');
    for (let i = 0; i < 4; i++) flowMoveMode(f, 1);
    expect(flowModeKind(f)).toBe('world-cup');
    flowMoveMode(f, 1);
    expect(flowModeKind(f)).toBe('friendly-cpu');
    flowConfirmMode(f);
    expect(f.phase).toBe('team-select');
    expect(flowPickingHuman(f)).toBe(0);
    expect(flowHumanCount(f)).toBe(1);
    // A second A on a screen that is not mode-select does nothing to the mode.
    flowMoveMode(f, 1);
    expect(flowModeKind(f)).toBe('friendly-cpu');
  });
});

describe('the team selector', () => {
  it('moves the cursor on a 4 x 4 grid, wrapping rows and columns, and refuses a slot past the bank', () => {
    const f = createFlowState();
    flowConfirmMode(f);
    flowMoveTeam(f, 1, 0, BANK);
    expect(f.cursor).toBe(1);
    flowMoveTeam(f, -1, 0, BANK);
    flowMoveTeam(f, -1, 0, BANK);
    expect(f.cursor).toBe(3);
    flowMoveTeam(f, 0, 1, BANK);
    expect(f.cursor).toBe(7);
    flowMoveTeam(f, 0, -1, BANK);
    flowMoveTeam(f, 0, -1, BANK);
    expect(f.cursor).toBe(15);
    // A bank of 14: from 10 (column 2, row 2), down would land on 14, which does not
    // exist -- stay. From 9 the same move lands on 13, which does.
    f.cursor = 10;
    flowMoveTeam(f, 0, 1, 14);
    expect(f.cursor).toBe(10);
    f.cursor = 9;
    flowMoveTeam(f, 0, 1, 14);
    expect(f.cursor).toBe(13);
    // And the cursor does nothing outside team-select.
    const idle = createFlowState();
    flowMoveTeam(idle, 1, 0, BANK);
    expect(idle.cursor).toBe(0);
  });

  it('solo modes pick one team and are done; the two-player friendly picks J1 then J2, never the same', () => {
    const solo = createFlowState();
    flowConfirmMode(solo);
    solo.cursor = 4;
    expect(flowConfirmTeam(solo, BANK)).toBe('done');
    expect(solo.picked).toEqual([4, -1]);

    const two = createFlowState();
    flowMoveMode(two, 1);
    flowConfirmMode(two);
    two.cursor = 2;
    expect(flowConfirmTeam(two, BANK)).toBe('next');
    expect(flowPickingHuman(two)).toBe(1);
    expect(flowConfirmTeam(two, BANK)).toBe('refused');   // the same team, G9-4: "sin repetir"
    two.cursor = 9;
    expect(flowConfirmTeam(two, BANK)).toBe('done');
    expect(two.picked).toEqual([2, 9]);
  });

  it('keeps one formation per human, 3-3-2 by default (G9-5)', () => {
    const f = createFlowState();
    flowMoveMode(f, 1);
    flowConfirmMode(f);
    expect(f.formation).toEqual([0, 0]);
    flowSetFormation(f, 0, 2);
    flowSetFormation(f, 1, 1);
    expect(f.formation).toEqual([2, 1]);
  });
});

describe('flowBuildMode -- the one place a mode is built', () => {
  it('a CPU friendly: the chosen team at home, a drawn rival away, deterministic by seed, straight to the match', () => {
    const { f, m } = start('friendly-cpu', 0);
    expect(modeHomeId(m)).toBe('espana');
    expect(modeAwayId(m)).not.toBe('espana');
    expect(modeBracket(m)).toBeNull();
    expect(f.phase).toBe('match');
    const again = start('friendly-cpu', 0);
    expect(modeAwayId(again.m)).toBe(modeAwayId(m));
  });

  it('a two-player friendly: J1 at home, J2 away', () => {
    const { f, m } = start('friendly-2p', 3, 11);
    expect(modeHomeId(m)).toBe(BANK_IDS[3]);
    expect(modeAwayId(m)).toBe(BANK_IDS[11]);
    expect(modeHumanSide(m)).toBe('both');
    expect(f.phase).toBe('match');
  });

  it('training: the chosen team against a drawn statue team', () => {
    const { f, m } = start('training', 7);
    expect(modeHomeId(m)).toBe(BANK_IDS[7]);
    expect(modeAwayId(m)).not.toBe(BANK_IDS[7]);
    expect(f.phase).toBe('match');
  });

  it('the World Cup: the chosen team in a drawn bracket of eight, and the flow goes to the draw screen', () => {
    const { f, m } = start('world-cup', 5);
    const wc = modeBracket(m);
    expect(wc).not.toBeNull();
    if (wc === null) return;
    expect(wc.bracket).toContain(BANK_IDS[5]);
    expect(wc.seed).toBe(SEED);
    expect(f.phase).toBe('draw');
    flowConfirmDraw(f);
    expect(f.phase).toBe('bracket');
    expect(f.bracketChoice).toBe(0);
  });
});

describe('the bracket screen (G9-3: VER / SALTAR, then the human match)', () => {
  it('offers VER by default, SALTAR on a toggle, and PLAY once the three CPU pairs are resolved', () => {
    const { f, m } = start('world-cup', 1);
    flowConfirmDraw(f);
    expect(flowBracketAction(f, m)).toBe('spectate');
    flowMoveBracketChoice(f, 1);
    expect(flowBracketAction(f, m)).toBe('skip');
    flowMoveBracketChoice(f, -1);
    expect(flowBracketAction(f, m)).toBe('spectate');
    let pairs = 0;
    while (flowBracketAction(f, m) !== 'play') {
      const pair = flowCpuPair(m);
      expect(pair).toBeGreaterThanOrEqual(0);
      const wc = modeBracket(m);
      if (wc === null) throw new Error('no bracket');
      flowRecordCpuResult(m, pair, finished(wc.entrants[pair * 2], wc.entrants[pair * 2 + 1], 2, 2, 1));
      pairs++;
    }
    expect(pairs).toBe(3);
    expect(flowCpuPair(m)).toBe(-1);
    expect(flowConfirmBracket(f, m)).toBe('play');
    expect(f.phase).toBe('match');
  });

  it('VER moves to spectate; the end of the spectated match drains through over back to the bracket; A skips straight to it', () => {
    const { f, m } = start('world-cup', 1);
    flowConfirmDraw(f);
    expect(flowConfirmBracket(f, m)).toBe('spectate');
    expect(f.phase).toBe('spectate');
    flowSpectateOver(f);
    expect(f.phase).toBe('over');
    expect(f.after).toBe('bracket');
    flowCaptionsDrained(f);
    expect(f.phase).toBe('bracket');
    expect(flowConfirmBracket(f, m)).toBe('spectate');
    flowSkipSpectate(f);
    expect(f.phase).toBe('bracket');
    expect(flowConfirmBracket(createFlowState(), m)).toBe('none');
  });

  it('flowRecordCpuResult refuses an undecided match', () => {
    const { m } = start('world-cup', 1);
    const wc = modeBracket(m);
    if (wc === null) throw new Error('no bracket');
    const pair = flowCpuPair(m);
    const level = finished(wc.entrants[pair * 2], wc.entrants[pair * 2 + 1], 0, 0);
    level.shootout = null;
    expect(() => flowRecordCpuResult(m, pair, level)).toThrow();
  });
});

describe('the end of a match', () => {
  it('a won friendly: over -> victory once the captions drain; CONTINUAR resets to mode-select keeping the mode cursor', () => {
    const { f, m } = start('friendly-cpu', 0);
    flowMatchOver(f, m, humanMatch(m, 1, 0, true), false);
    expect(f.phase).toBe('over');
    expect(f.after).toBe('victory');
    expect(modeStatus(m)).toBe('champion');
    flowCaptionsDrained(f);
    expect(f.phase).toBe('victory');
    flowContinue(f);
    expect(f.phase).toBe('mode-select');
    expect(f.picked).toEqual([-1, -1]);
    expect(flowModeKind(f)).toBe('friendly-cpu');
  });

  it('a lost friendly and a level abandon go back to mode-select after the caption (spec 60-61)', () => {
    const lost = start('friendly-cpu', 0);
    flowMatchOver(lost.f, lost.m, humanMatch(lost.m, 0, 2, false), false);
    expect(lost.f.after).toBe('mode-select');
    flowCaptionsDrained(lost.f);
    expect(lost.f.phase).toBe('mode-select');

    const level = start('friendly-2p', 0, 1);
    const abandoned = finished('espana', 'italia', 1, 1);
    abandoned.shootout = null;
    flowMatchOver(level.f, level.m, abandoned, true);
    expect(modeStatus(level.m)).toBe('draw');
    expect(level.f.after).toBe('mode-select');
  });

  it('a World Cup round won goes back to the bracket with the next difficulty; the final won goes to victory', () => {
    const { f, m } = start('world-cup', 2);
    flowConfirmDraw(f);
    const difficulties: number[] = [];
    for (let round = 0; round < 3; round++) {
      skipCpuPairs(f, m);
      difficulties.push(modeDifficulty(m));
      expect(flowConfirmBracket(f, m)).toBe('play');
      flowMatchOver(f, m, humanMatch(m, 2, 0, true), false);
      expect(f.phase).toBe('over');
      flowCaptionsDrained(f);
    }
    expect(difficulties).toEqual([4, 6, 8]);
    expect(f.phase).toBe('victory');
    expect(modeStatus(m)).toBe('champion');
    expect(modeScore(m)).toBe(67_000);
  });

  it('a World Cup match lost, or abandoned with a lead (G9-8), is eliminated and returns to mode-select', () => {
    const lost = start('world-cup', 2);
    flowConfirmDraw(lost.f);
    skipCpuPairs(lost.f, lost.m);
    flowConfirmBracket(lost.f, lost.m);
    flowMatchOver(lost.f, lost.m, humanMatch(lost.m, 0, 1, false), false);
    expect(modeStatus(lost.m)).toBe('eliminated');
    expect(lost.f.after).toBe('mode-select');

    const abandoned = start('world-cup', 2);
    flowConfirmDraw(abandoned.f);
    skipCpuPairs(abandoned.f, abandoned.m);
    flowConfirmBracket(abandoned.f, abandoned.m);
    const leading = humanMatch(abandoned.m, 1, 0, true);
    flowMatchOver(abandoned.f, abandoned.m, leading, true);
    expect(modeStatus(abandoned.m)).toBe('eliminated');
    expect(abandoned.f.after).toBe('mode-select');
  });

  // S-FL4: R leaves a training match (no clock, no natural end) and nothing else.
  it('R exits the training match to mode-select and does nothing in a timed match', () => {
    const training = start('training', 4);
    flowExitMatch(training.f, training.m);
    expect(training.f.phase).toBe('mode-select');
    const friendly = start('friendly-cpu', 4);
    flowExitMatch(friendly.f, friendly.m);
    expect(friendly.f.phase).toBe('match');
  });

  it('every transition is a no-op outside its phase', () => {
    const f = createFlowState();
    flowConfirmDraw(f);
    flowSpectateOver(f);
    flowSkipSpectate(f);
    flowCaptionsDrained(f);
    flowContinue(f);
    expect(f.phase).toBe('mode-select');
    flowReset(f);
    expect(f).toEqual(createFlowState());
  });
});
