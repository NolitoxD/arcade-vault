import { describe, expect, it } from 'vitest';
import { PITCH, centerY } from './pitch';
import { FORMATIONS, TEAMS, type Formation, type TeamDef } from './teams';
import { dist } from './geometry';
import { createTeamInput, copyTeamInput, type Axis, type TeamInput } from './input';
import { STEP_MS, stepsFor } from './step';
import { GK_LINE_DIST, TACKLE_DIST, TACKLE_STEPS, type PlayerState } from './players';
import type { BallState } from './ball';
import { createRng, type Rng } from './rng';
import { checkGoalkeepersInBox } from './invariants';
import {
  DEFAULT_PENALTY_READ_CHANCE, GOAL_PAUSE_STEPS, HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, HALF_TIME_PAUSE_STEPS,
  abandon, callSetPiece, createMatch, endGoalPause, endHalf, endHalfTime, isOpenPlay, kickoffTeamFor, resumePlay,
  scoreGoal, stepMatch, type MatchPhase, type MatchState,
} from './match';
import { SET_PIECE_COUNTDOWN_STEPS, type SetPieceState } from './set-pieces';
import { STEAL_CHANCE, STEAL_CHANCE_VS_SPRINT } from './actions';

const TEAM_PAIR: [TeamDef, TeamDef] = [TEAMS[0], TEAMS[1]];
const CY = centerY(PITCH);
const PHASES: readonly MatchPhase[] = ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal', 'over'];
const IDLE: readonly [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];

function fresh(): MatchState {
  return createMatch(TEAM_PAIR, FORMATIONS, PITCH);
}

function idle(match: MatchState, steps: number, rng: Rng = createRng(1)): void {
  for (let i = 0; i < steps; i++) stepMatch(match, IDLE, rng);
}

// Forces a phase with the fields that phase implies, to test the guards from every illegal start.
function forcePhase(match: MatchState, phase: MatchPhase): void {
  match.phase = phase;
  match.setPiece = phase === 'kickoff' || phase === 'set-piece' ? match.scratch.setPiece : null;
  match.half = phase === 'golden-goal' ? 3 : 1;
  match.pauseStepsLeft = phase === 'goal' || phase === 'half-time' ? 50 : 0;
}

function snapshot(match: MatchState): string {
  return JSON.stringify({
    phase: match.phase, half: match.half, score: match.score, halfStep: match.halfStep, attackDir: match.attackDir,
    pause: match.pauseStepsLeft, sp: match.setPiece, players: match.players, ball: match.ball, controlled: match.controlled,
  });
}

describe('constants', () => {
  it('two halves of 90 s under the 120 s ceiling, in steps', () => {
    expect(HALF_SECONDS).toBe(90);
    expect(HALF_SECONDS).toBeLessThanOrEqual(HALF_SECONDS_MAX);
    expect(HALF_STEPS).toBe(5400);
    expect(GOAL_PAUSE_STEPS).toBe(stepsFor(2));
    expect(HALF_TIME_PAUSE_STEPS).toBe(stepsFor(3));
  });
  it('kickoff teams: 0 in the first half and the golden goal, 1 in the second', () => {
    expect([kickoffTeamFor(1), kickoffTeamFor(2), kickoffTeamFor(3)]).toEqual([0, 1, 0]);
  });
});

describe('createMatch', () => {
  it('starts at the kickoff of the first half, 0-0, team 0 attacking +x, with a derived controlled pair', () => {
    const m = fresh();
    expect(m.phase).toBe('kickoff');
    expect(m.half).toBe(1);
    expect(m.score).toEqual([0, 0]);
    expect(m.attackDir).toEqual([1, -1]);
    expect(m.setPiece).not.toBeNull();
    expect(m.setPiece?.kind).toBe('kickoff');
    expect(m.setPiece?.team).toBe(0);
    expect(m.ball.x).toBeCloseTo(1000, 10);
    expect(m.ball.y).toBeCloseTo(CY, 10);
    expect(m.controlled[0]).toBe(m.ball.owner);
    expect(m.players[m.controlled[1]].team).toBe(1);
    expect(m.players[m.controlled[1]].role).not.toBe('gk');
    expect(m.gkPenaltyRead).toEqual([DEFAULT_PENALTY_READ_CHANCE, DEFAULT_PENALTY_READ_CHANCE]);
    expect(m.formationTable).toBe(FORMATIONS);
    expect(m.pitch).toBe(PITCH);
    expect(m.stepCount).toBe(0);
    expect(m.clockMs).toBe(0);
    expect(m.lastGoalTeam).toBe(-1);
  });
});

describe('every transition refuses every illegal phase without touching the state', () => {
  const table: { name: string; legal: readonly MatchPhase[]; fire: (m: MatchState) => boolean }[] = [
    { name: 'resumePlay', legal: ['kickoff', 'set-piece'], fire: resumePlay },
    { name: 'callSetPiece', legal: ['play', 'golden-goal'], fire: (m) => callSetPiece(m, 'throw-in', 1, 700, 0) },
    { name: 'scoreGoal', legal: ['play', 'golden-goal', 'set-piece'], fire: (m) => scoreGoal(m, 0) },
    { name: 'endGoalPause', legal: ['goal'], fire: endGoalPause },
    { name: 'endHalf', legal: ['play'], fire: endHalf },
    { name: 'endHalfTime', legal: ['half-time'], fire: endHalfTime },
    { name: 'abandon', legal: ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal'], fire: abandon },
  ];
  for (const t of table) {
    for (const phase of PHASES) {
      if (t.legal.includes(phase)) continue;
      it(`${t.name} from ${phase} returns false and changes nothing`, () => {
        const m = fresh();
        forcePhase(m, phase);
        const before = snapshot(m);
        expect(t.fire(m)).toBe(false);
        expect(snapshot(m)).toBe(before);
      });
    }
    for (const phase of t.legal) {
      it(`${t.name} from ${phase} returns true`, () => {
        const m = fresh();
        forcePhase(m, phase);
        expect(t.fire(m)).toBe(true);
      });
    }
  }
});

describe('transition effects', () => {
  it('resumePlay goes to play in halves 1-2 and to golden-goal in half 3, clearing the set piece', () => {
    const m = fresh();
    expect(resumePlay(m)).toBe(true);
    expect(m.phase).toBe('play');
    expect(m.setPiece).toBeNull();
    forcePhase(m, 'kickoff');
    m.half = 3;
    resumePlay(m);
    expect(m.phase).toBe('golden-goal');
  });
  it('callSetPiece begins the set piece for the given team at the given spot', () => {
    const m = fresh();
    resumePlay(m);
    expect(callSetPiece(m, 'corner', 1, 0, PITCH.height)).toBe(true);
    expect(m.phase).toBe('set-piece');
    expect(m.setPiece).toMatchObject({ kind: 'corner', team: 1, x: 0, y: PITCH.height, stepsLeft: SET_PIECE_COUNTDOWN_STEPS });
    expect(m.players[m.setPiece?.takerId ?? -1].team).toBe(1);
  });
  it('scoreGoal adds to the score, pauses, and the conceding team kicks off after the pause', () => {
    const m = fresh();
    resumePlay(m);
    expect(scoreGoal(m, 1)).toBe(true);
    expect(m.score).toEqual([0, 1]);
    expect(m.phase).toBe('goal');
    expect(m.pauseStepsLeft).toBe(GOAL_PAUSE_STEPS);
    expect(endGoalPause(m)).toBe(true);
    expect(m.phase).toBe('kickoff');
    expect(m.setPiece?.team).toBe(0);
  });
  it('scoreGoal during a penalty (set-piece) counts', () => {
    const m = fresh();
    resumePlay(m);
    callSetPiece(m, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY);
    expect(scoreGoal(m, 0)).toBe(true);
    expect(m.score).toEqual([1, 0]);
  });
  it('endHalf after the first half swaps ends and pauses; endHalfTime makes team 1 kick off the second half', () => {
    const m = fresh();
    resumePlay(m);
    m.halfStep = HALF_STEPS;
    expect(endHalf(m)).toBe(true);
    expect(m.phase).toBe('half-time');
    expect(m.half).toBe(2);
    expect(m.attackDir).toEqual([-1, 1]);
    expect(m.halfStep).toBe(0);
    expect(m.players[9].x).toBe(GK_LINE_DIST);   // ends already swapped during the pause (criterion 9b holds throughout)
    expect(checkGoalkeepersInBox(m.players, m.attackDir, m.pitch)).toEqual([]);
    expect(endHalfTime(m)).toBe(true);
    expect(m.phase).toBe('kickoff');
    expect(m.setPiece?.team).toBe(1);
    expect(m.setPiece?.dirX).toBe(1);          // team 1 now attacks +x
    expect(m.players[0].x).toBe(PITCH.width - GK_LINE_DIST);   // team 0 keeper moved to the right end
    expect(checkGoalkeepersInBox(m.players, m.attackDir, m.pitch)).toEqual([]);
  });
  it('endHalf after the second half: over if the score differs, golden-goal kickoff by team 0 if tied', () => {
    const tied = fresh();
    resumePlay(tied);
    endHalf(tied); endHalfTime(tied); resumePlay(tied);
    expect(endHalf(tied)).toBe(true);
    expect(tied.phase).toBe('kickoff');
    expect(tied.half).toBe(3);
    expect(tied.setPiece?.team).toBe(0);
    const won = fresh();
    resumePlay(won);
    scoreGoal(won, 0); endGoalPause(won); resumePlay(won);
    endHalf(won); endHalfTime(won); resumePlay(won);
    expect(endHalf(won)).toBe(true);
    expect(won.phase).toBe('over');
  });
  it('a golden goal ends the match at once, and endHalf is refused in half 3', () => {
    const m = fresh();
    resumePlay(m);
    endHalf(m); endHalfTime(m); resumePlay(m); endHalf(m);   // tied → half 3 kickoff
    resumePlay(m);
    expect(m.phase).toBe('golden-goal');
    expect(endHalf(m)).toBe(false);
    expect(scoreGoal(m, 1)).toBe(true);
    expect(m.phase).toBe('over');
    expect(m.score).toEqual([0, 1]);
  });
  it('abandon ends the match from any live phase', () => {
    const m = fresh();
    expect(abandon(m)).toBe(true);
    expect(m.phase).toBe('over');
    expect(isOpenPlay('play') && isOpenPlay('golden-goal') && !isOpenPlay('over')).toBe(true);
  });
});

describe('stepMatch drives the clock and the phases with idle inputs', () => {
  // NOTE (N1): with no inputs at all, the kickoff short pass happens to roll into a
  // static rival of the published 3-3-2 (team 1's centre midfielder sits on the
  // centre line, 100 u ahead of the taker) who picks it up and, being static,
  // freezes it there for the rest of the half. That is a geometric coincidence of
  // THIS fixture, not a property of the engine: change FORMATIONS or the pass speed
  // and these step counts move. They are asserted, not tuned: if one of them ever
  // stops matching, measure the new value and report it instead of editing it away.
  it('the kickoff executes after the countdown and the first half ends at exactly HALF_STEPS steps', () => {
    const m = fresh();
    idle(m, SET_PIECE_COUNTDOWN_STEPS - 1);
    expect(m.phase).toBe('kickoff');
    idle(m, 1);
    expect(m.phase).toBe('play');
    expect(m.ball.owner).toBeNull();
    idle(m, HALF_STEPS - SET_PIECE_COUNTDOWN_STEPS - 1);
    expect(m.phase).toBe('play');
    expect(m.clockMs).toBeCloseTo((HALF_STEPS - 1) * STEP_MS, 6);
    idle(m, 1);
    expect(m.phase).toBe('half-time');
    expect(m.half).toBe(2);
    expect(m.stepCount).toBe(HALF_STEPS);
  });
  it('the half-time pause lasts HALF_TIME_PAUSE_STEPS and the second half starts with ends swapped', () => {
    const m = fresh();
    idle(m, HALF_STEPS);
    idle(m, HALF_TIME_PAUSE_STEPS - 1);
    expect(m.phase).toBe('half-time');
    idle(m, 1);
    expect(m.phase).toBe('kickoff');
    expect(m.attackDir).toEqual([-1, 1]);
    expect(m.setPiece?.team).toBe(1);
  });
  it('a 0-0 match goes to a golden goal that never times out', () => {
    const m = fresh();
    idle(m, 2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS);
    expect(m.half).toBe(3);
    expect(m.phase).toBe('kickoff');
    idle(m, SET_PIECE_COUNTDOWN_STEPS);
    expect(m.phase).toBe('golden-goal');
    const clock = m.halfStep;
    idle(m, 3 * HALF_STEPS);
    expect(m.phase).toBe('golden-goal');
    expect(m.halfStep).toBe(clock);
  });
  // I3 / ruling R18: the clock used to be frozen during golden-goal open play
  // (stepOpenPlay's `phase === 'play'` guard) but still ticked on the set-piece
  // branch of stepMatch, so halfStep jumped 5 s at every set piece of the third
  // half. The test above covers open play; this one covers the other branch.
  it('the golden-goal clock does not move through a set piece either', () => {
    const m = fresh();
    resumePlay(m); endHalf(m); endHalfTime(m); resumePlay(m); endHalf(m);   // tied -> half 3 kickoff
    resumePlay(m);
    expect(m.phase).toBe('golden-goal');
    expect(m.half).toBe(3);
    const clock = m.halfStep;
    expect(callSetPiece(m, 'throw-in', 1, 700, 0)).toBe(true);
    const rng = createRng(1);
    for (let i = 0; i < SET_PIECE_COUNTDOWN_STEPS; i++) stepMatch(m, IDLE, rng);
    expect(m.phase).not.toBe('set-piece');   // the set piece really did execute
    expect(m.halfStep).toBe(clock);
  });
  it('a 1-0 lead after two halves ends the match', () => {
    const m = fresh();
    idle(m, SET_PIECE_COUNTDOWN_STEPS + 7);
    scoreGoal(m, 0);
    idle(m, 2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS + GOAL_PAUSE_STEPS + 2 * SET_PIECE_COUNTDOWN_STEPS);
    expect(m.phase).toBe('over');
    expect(m.score).toEqual([1, 0]);
  });
  it('does nothing once over', () => {
    const m = fresh();
    abandon(m);
    const before = snapshot(m);
    idle(m, 50);
    expect(snapshot(m)).toBe(before);
    expect(m.stepCount).toBe(0);
  });
  it('stores the formation and strategy choice from the inputs and ignores an index outside the table', () => {
    const three: Formation[] = [FORMATIONS[0], { ...FORMATIONS[0], id: '3-3-2-b' }, { ...FORMATIONS[0], id: '3-3-2-c' }];
    const m = createMatch(TEAM_PAIR, three, PITCH);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].formation = 2; inputs[0].strategy = 'attack';
    inputs[1].formation = 7; inputs[1].strategy = 'defend';
    stepMatch(m, inputs, createRng(1));
    expect(m.formationIndex).toEqual([2, 0]);
    expect(m.strategies).toEqual(['attack', 'defend']);
  });
  it('the keepers never leave their box through a full idle match (criterion 9b)', () => {
    const m = fresh();
    const rng = createRng(1);
    for (let i = 0; i < 2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS; i++) {
      stepMatch(m, IDLE, rng);
      expect(checkGoalkeepersInBox(m.players, m.attackDir, m.pitch)).toEqual([]);
    }
  });
});

// Fix round 1: reproduces the Task 5 review finding -- scratch.events used to be
// one slot per TEAM, so stepOpenPlay's tackle loop (ascending id) let a higher-id
// teammate's clean slide overwrite a lower-id teammate's foul in the very same
// step, silently erasing it. This is reachable without any stage-B AI: a human
// controls one player, but a SECOND same-team player can already be mid-tackle
// (e.g. left sliding by a previous control switch) when the tackle loop runs.
describe('a same-team tackle no longer clobbers another same-team tackle (fix round 1)', () => {
  it('a lower-id foul survives a higher-id, same-team clean slide judged in the same step', () => {
    const m = fresh();
    resumePlay(m);
    // Ball at rest, far from both tacklers and the foul spot: nobody here is
    // close enough to pick it up instead of fouling or sliding clean (TACKLE_BALL_REACH is 20).
    m.ball.x = 1000; m.ball.y = CY; m.ball.z = 0;
    m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0;
    m.ball.owner = null;
    // Player 1 (team 0, lower id): mid-tackle, about to slide into player 10's
    // body (team 1) -- a foul. y = 50 is outside the big-area y-band [265, 1035]
    // for BOTH ends of the pitch, so this is a free kick, never a penalty,
    // regardless of x (ruling R14 is judged by judgeFoul, not re-derived here).
    const foulTaker = m.players[1];
    foulTaker.tackleStepsLeft = 10;
    foulTaker.tackleDirX = 0;
    foulTaker.tackleDirY = 1;
    foulTaker.x = 1000;
    foulTaker.y = 50;
    const victim = m.players[10];
    victim.x = 1000;
    victim.y = 54; // within TACKLE_FOUL_RADIUS (24) of where the slide lands this step
    victim.downUntilStep = 0;
    // Player 2 (team 0, higher id): mid-tackle in an empty stretch of the pitch,
    // well clear of the ball and every rival -- not merely outside
    // TACKLE_FOUL_RADIUS, but 275+ u from the nearest formation slot and 600 u
    // from the ball, so this is unambiguously a clean slide.
    const cleanSlider = m.players[2];
    cleanSlider.tackleStepsLeft = 10;
    cleanSlider.tackleDirX = 1;
    cleanSlider.tackleDirY = 0;
    cleanSlider.x = 1000;
    cleanSlider.y = 1250;
    stepMatch(m, IDLE, createRng(1));
    // Pre-fix (one ActionEvent per team): the tackle loop runs ascending id --
    // player 1 sets the foul on the shared team-0 event, then player 2's clean
    // slide immediately overwrites it back to foul=false. No set piece is ever
    // called and phase stays 'play'.
    expect(m.phase).toBe('set-piece');
    expect(m.setPiece?.kind).toBe('free-kick');
    expect(m.setPiece?.team).toBe(1); // the victim's team
  });
});

describe('the set piece never runs twice', () => {
  // Task 4 minor: stepSetPiece keeps counting past zero and would re-execute the
  // kick (re-consuming rng on a penalty) if stepMatch called it again after it
  // returned true. stepMatch must leave the set-piece phase on that same step.
  it('a penalty draws from the rng only on the step it executes, and never again', () => {
    const m = fresh();
    resumePlay(m);
    const rng = countingRng(1);
    callSetPiece(m, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY);
    for (let i = 0; i < SET_PIECE_COUNTDOWN_STEPS - 1; i++) stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('set-piece');
    expect(rng.calls).toBe(0);   // the countdown itself is deterministic
    stepMatch(m, IDLE, rng);
    expect(m.phase).not.toBe('set-piece');
    // 1 draw for the keeper's read, plus a 2nd only when it reads wrong and has to pick a side.
    const afterExecution = rng.calls;
    expect(afterExecution).toBeGreaterThanOrEqual(1);
    expect(afterExecution).toBeLessThanOrEqual(2);
    // Idle inputs never press B, so nothing else in the engine can draw: any growth
    // here would be stepSetPiece firing a second time.
    for (let i = 0; i < 40; i++) stepMatch(m, IDLE, rng);
    expect(rng.calls).toBe(afterExecution);
  });
  // Task 4 minor: at a corner the taker is clamped onto the pitch and ends up
  // coincident with the ball on the spot. stepMatch must not run stepPhysics (and
  // therefore stickToOwner) while the set piece is pending, or the ball would be
  // dragged CONTROL_DIST off the corner arc.
  it('the ball stays exactly on the corner spot for the whole countdown', () => {
    const m = fresh();
    resumePlay(m);
    callSetPiece(m, 'corner', 1, 0, PITCH.height);
    const rng = createRng(1);
    for (let i = 0; i < 30; i++) {
      stepMatch(m, IDLE, rng);
      expect([m.ball.x, m.ball.y, m.ball.z]).toEqual([0, PITCH.height, 0]);
      expect(m.phase).toBe('set-piece');
    }
  });
});

// Whole-stage review C1: the 18 ActionEvent slots were only ever cleared for the
// two controlled players (applyButtons), so a foul stayed in scratch.events[i]
// and stepOpenPlay judged it AGAIN the moment the set piece handed play back --
// one fresh penalty every SET_PIECE_COUNTDOWN_STEPS until the half ran out.
describe('a judged foul is consumed, not re-judged after the set piece (fix C1)', () => {
  it('a penalty is called once and never repeats once play resumes', () => {
    const m = fresh();
    resumePlay(m);
    // Free ball parked in an empty stretch (nearest player ~390 u away, far
    // outside POSSESSION_RADIUS and TACKLE_BALL_REACH), so nothing here depends
    // on possession: the only event of the step is the foul.
    m.ball.owner = null;
    m.ball.x = 300; m.ball.y = 1150; m.ball.z = 0;
    m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0;
    m.ball.lastTouchTeam = 0; m.ball.lastTouchId = 5;
    m.ball.kickerId = -1; m.ball.kickLockUntilStep = 0;
    // Player 10 (team 1) slides into player 5 (team 0) inside team 1's OWN big
    // area (side 1: x in [1680, 2000], y in [265, 1035]) -> penalty. The penalty
    // is the looping case: beginSetPiece re-places BOTH teams by formation, the
    // offender stops being his team's controlled player, and his event slot is
    // then never cleared by applyButtons. (1800, 600) sits well inside the area
    // on both axes and off the penalty spot itself (1790, 650), so neither
    // boundary nor spot coincidence can carry the assertion.
    const victim = m.players[5];
    victim.x = 1800; victim.y = 600; victim.downUntilStep = 0;
    const offender = m.players[10];
    offender.x = 1780; offender.y = 600;
    offender.tackleStepsLeft = 10;
    offender.tackleDirX = 1; offender.tackleDirY = 0;
    const rng = createRng(1);
    stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('set-piece');
    expect(m.setPiece?.kind).toBe('penalty');
    expect(m.setPiece?.team).toBe(0);   // the victim's team
    // The precondition of the bug, asserted so the fixture cannot rot into a
    // free-kick-like case where applyButtons clears the slot by coincidence.
    expect(m.controlled[1]).not.toBe(offender.id);
    for (let i = 0; i < SET_PIECE_COUNTDOWN_STEPS; i++) stepMatch(m, IDLE, rng);
    expect(m.phase).not.toBe('set-piece');
    let secondCall = -1;
    for (let i = 0; i < 400 && secondCall < 0; i++) {
      stepMatch(m, IDLE, rng);
      if (m.phase === 'set-piece') secondCall = i;
    }
    expect(secondCall, 'the same foul was judged a second time after the set piece').toBe(-1);
  });
});

// Whole-stage review C2: stepPhysics (and inside it pickUp) runs BEFORE the
// referee, so a ball already over a line was picked up and stuck back onto a
// player's foot inside the pitch -- cancelling the goal (C) or the throw-in (A).
// Probes A-D are the reviewer's, kept as tests.
function freeBall(m: MatchState, x: number, y: number, vx: number, vy: number): void {
  m.ball.owner = null;
  m.ball.x = x; m.ball.y = y; m.ball.z = 0;
  m.ball.vx = vx; m.ball.vy = vy; m.ball.vz = 0;
  m.ball.lastTouchTeam = 0; m.ball.lastTouchId = 5;
  m.ball.kickerId = -1; m.ball.kickLockUntilStep = 0;
}

describe('the referee judges the ball before anybody picks it up (fix C2)', () => {
  // x = 743 is off every static 3-3-2 lane and off centerX, so only the y axis
  // (the touchline, which is what these two cases are about) decides anything.
  const OUT_X = 743;
  it('A - a free ball over the touchline is a throw-in even with a player standing on the line', () => {
    const m = fresh();
    resumePlay(m);
    freeBall(m, OUT_X, 2, 0, -180);   // y = 2 - perStep(180) = -1, just over the line
    const onTheLine = m.players[6];
    onTheLine.x = OUT_X; onTheLine.y = 0;   // exactly on the line: this case IS about the line
    stepMatch(m, IDLE, createRng(1));
    expect(m.phase).toBe('set-piece');
    expect(m.setPiece?.kind).toBe('throw-in');
    expect(m.setPiece?.team).toBe(1);      // team 0 touched it last
    expect(m.setPiece?.y).toBe(0);
    expect(m.setPiece?.x).toBeCloseTo(OUT_X, 10);
  });
  it('B - the same ball with nobody near is a throw-in too (the control case)', () => {
    const m = fresh();
    resumePlay(m);
    freeBall(m, OUT_X, 2, 0, -180);        // nearest player is ~470 u away in the published formation
    stepMatch(m, IDLE, createRng(1));
    expect(m.phase).toBe('set-piece');
    expect(m.setPiece?.kind).toBe('throw-in');
    expect(m.setPiece?.team).toBe(1);
    expect(m.setPiece?.y).toBe(0);
  });
  // y = 612 is between the posts (575 < y < 725) but off centerY, so the goal
  // cannot be an artefact of the ball sitting exactly on the middle of the goal.
  const GOAL_Y = 612;
  it('C - a 700 u/s shot over the goal line between the posts is a goal with the keeper ON his line', () => {
    const m = fresh();
    resumePlay(m);
    freeBall(m, 1996, GOAL_Y, 700, 0);     // x = 1996 + perStep(700) = 2007.67, 7.67 u past the line
    const keeper = m.players[9];
    keeper.x = PITCH.width; keeper.y = GOAL_Y;   // on the goal line, 7.67 u from the ball
    stepMatch(m, IDLE, createRng(1));
    expect(m.phase).toBe('goal');
    expect(m.score).toEqual([1, 0]);
  });
  it('D - the same shot with the keeper off the ball line is a goal too (the control case)', () => {
    const m = fresh();
    resumePlay(m);
    freeBall(m, 1996, GOAL_Y, 700, 0);
    const keeper = m.players[9];
    keeper.x = PITCH.width; keeper.y = 500;      // 112 u from the ball: out of POSSESSION_RADIUS
    stepMatch(m, IDLE, createRng(1));
    expect(m.phase).toBe('goal');
    expect(m.score).toEqual([1, 0]);
  });
});

// ── The full match with RECORDED inputs (criterion 1 on stepMatch) ────────────
//
// The policies below read the match state (no rng) to produce each step's
// TeamInput, which run A records. Run B replays the recording with the same seed
// and must match A step by step; run C replays it with a seed whose first draw
// falls on the other side of BOTH steal thresholds and must diverge. Seeds are
// chosen by scanning createRng, never by luck: the steal is the only rng consumer
// here (nobody tackles, so there are no fouls and no penalties), and the threshold
// it applies is STEAL_CHANCE or STEAL_CHANCE_VS_SPRINT depending on whether the
// owner is sprinting (ruling R3) -- so seedA's first draw is below both and
// seedC's is at or above both, making the first steal attempt flip either way.

function sign(v: number, dead: number): Axis {
  return v > dead ? 1 : v < -dead ? -1 : 0;
}

function policy(match: MatchState, team: 0 | 1, out: TeamInput): void {
  out.dx = 0; out.dy = 0; out.a = 'up'; out.b = 'up'; out.c = 'up'; out.formation = 0; out.strategy = 'neutral';
  const me = match.players[match.controlled[team]];
  const ball = match.ball;
  const step = match.stepCount;
  const attack = match.attackDir[team];
  if (ball.owner === me.id) {
    if (team === 0) {
      // Run a corridor 50 u off the centre line (clear of the static 3-3-2 lanes and the keeper), then shoot straight.
      out.dy = sign(CY - 50 - me.y, 3);
      out.dx = attack;
      out.c = 'held';
      const goalX = attack === 1 ? match.pitch.width : 0;
      if (Math.abs(goalX - me.x) < 300 && out.dy === 0) out.a = step % 2 === 0 ? 'pressed' : 'released';
    } else {
      out.dx = attack;
      if (step % 90 === 0) out.b = 'pressed';
      if (step % 90 === 1) out.b = 'released';
    }
    return;
  }
  out.dx = sign(ball.x - me.x, 4);
  out.dy = sign(ball.y - me.y, 4);
  // Whole-stage review I1: without this the recorded match never pressed A off the
  // ball, so in its whole length there was not one slide, one foul, one free kick
  // or one penalty -- which is exactly why C1 (a foul re-judged after the set
  // piece) survived the suite. Slide at the rival carrying the ball, at most one
  // attempt per TACKLE_STEPS (the length of a slide) so the two controlled
  // players are not permanently on the floor and the match still produces goals.
  const owner = ball.owner === null ? null : match.players[ball.owner];
  if (owner !== null && owner.team !== team && step % TACKLE_STEPS === 0
      && dist(me.x, me.y, owner.x, owner.y) < TACKLE_DIST) {
    out.a = 'pressed';
    return;
  }
  if (step % 30 === team * 15) out.b = 'pressed';
}

function seedWhere(pred: (firstDraw: number) => boolean): number {
  for (let seed = 1; seed < 10_000; seed++) if (pred(createRng(seed)())) return seed;
  throw new Error('no seed found');
}

type CountingRng = Rng & { calls: number };

function countingRng(seed: number): CountingRng {
  const inner = createRng(seed);
  const fn: CountingRng = Object.assign(function next(): number {
    fn.calls++;
    return inner();
  }, { calls: 0 });
  return fn;
}

// Explicit field-by-field comparison (no JSON.stringify), the pattern of sameWorld
// in step.test.ts extended with every MatchState scalar: a field added later has to
// be added here consciously instead of silently going unchecked.
function samePlayer(p: PlayerState, q: PlayerState): boolean {
  return (
    p.id === q.id && p.team === q.team && p.role === q.role && p.slot === q.slot &&
    p.x === q.x && p.y === q.y && p.vx === q.vx && p.vy === q.vy &&
    p.facingX === q.facingX && p.facingY === q.facingY &&
    p.sprintStepsLeft === q.sprintStepsLeft && p.sprintCooldownSteps === q.sprintCooldownSteps &&
    p.downUntilStep === q.downUntilStep && p.chargeSteps === q.chargeSteps && p.chargeButton === q.chargeButton &&
    p.tackleStepsLeft === q.tackleStepsLeft && p.tackleDirX === q.tackleDirX && p.tackleDirY === q.tackleDirY
  );
}

function sameBall(x: BallState, y: BallState): boolean {
  return (
    x.x === y.x && x.y === y.y && x.z === y.z &&
    x.vx === y.vx && x.vy === y.vy && x.vz === y.vz &&
    x.owner === y.owner && x.ownerSinceStep === y.ownerSinceStep &&
    x.lastTouchTeam === y.lastTouchTeam && x.lastTouchId === y.lastTouchId &&
    x.kickerId === y.kickerId && x.kickLockUntilStep === y.kickLockUntilStep
  );
}

function sameSetPiece(a: SetPieceState | null, b: SetPieceState | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.kind === b.kind && a.team === b.team && a.x === b.x && a.y === b.y &&
    a.dirX === b.dirX && a.dirY === b.dirY && a.side === b.side &&
    a.stepsLeft === b.stepsLeft && a.takerId === b.takerId
  );
}

function sameMatch(a: MatchState, b: MatchState): boolean {
  if (a.phase !== b.phase || a.half !== b.half || a.stepCount !== b.stepCount || a.halfStep !== b.halfStep) return false;
  if (a.clockMs !== b.clockMs || a.pauseStepsLeft !== b.pauseStepsLeft || a.lastGoalTeam !== b.lastGoalTeam) return false;
  if (a.score[0] !== b.score[0] || a.score[1] !== b.score[1]) return false;
  if (a.controlled[0] !== b.controlled[0] || a.controlled[1] !== b.controlled[1]) return false;
  if (a.attackDir[0] !== b.attackDir[0] || a.attackDir[1] !== b.attackDir[1]) return false;
  if (a.formationIndex[0] !== b.formationIndex[0] || a.formationIndex[1] !== b.formationIndex[1]) return false;
  if (a.strategies[0] !== b.strategies[0] || a.strategies[1] !== b.strategies[1]) return false;
  if (a.gkPenaltyRead[0] !== b.gkPenaltyRead[0] || a.gkPenaltyRead[1] !== b.gkPenaltyRead[1]) return false;
  if (!sameSetPiece(a.setPiece, b.setPiece)) return false;
  if (a.players.length !== b.players.length) return false;
  for (let i = 0; i < a.players.length; i++) {
    if (!samePlayer(a.players[i], b.players[i])) return false;
  }
  return sameBall(a.ball, b.ball);
}

const RECORD_CAP = 4 * HALF_STEPS;   // two halves, pauses and a long golden goal fit comfortably

describe('full match with recorded inputs (criterion 1)', () => {
  const seedA = seedWhere((v) => v < STEAL_CHANCE_VS_SPRINT);
  const seedC = seedWhere((v) => v >= STEAL_CHANCE);

  it('run A ends over with at least one goal, run B replays it identically step by step, run C diverges on the seed', () => {
    const a = fresh();
    const b = fresh();
    const c = fresh();
    const rngA = countingRng(seedA);
    const rngB = createRng(seedA);
    const rngC = createRng(seedC);
    const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const recorded: [TeamInput, TeamInput][] = [];
    const visited = new Set<MatchPhase>();
    let sawFoulSetPiece = false;
    let firstMismatchB = -1;
    let firstMismatchC = -1;
    let steps = 0;
    while (a.phase !== 'over' && steps < RECORD_CAP) {
      policy(a, 0, live[0]);
      policy(a, 1, live[1]);
      const frame: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
      copyTeamInput(live[0], frame[0]);
      copyTeamInput(live[1], frame[1]);
      recorded.push(frame);
      stepMatch(a, live, rngA);
      stepMatch(b, frame, rngB);
      stepMatch(c, frame, rngC);
      visited.add(a.phase);
      // I1: the whole foul chain (startTackle -> stepTackle -> judgeFoul ->
      // callSetPiece -> beginSetPiece -> stepSetPiece -> resumePlay) is only
      // exercised end to end if a set piece is actually born of a foul.
      const sp = a.setPiece;
      if (sp !== null && (sp.kind === 'free-kick' || sp.kind === 'penalty')) sawFoulSetPiece = true;
      if (firstMismatchB < 0 && !sameMatch(a, b)) firstMismatchB = steps;
      if (firstMismatchC < 0 && !sameMatch(a, c)) firstMismatchC = steps;
      steps++;
    }
    expect(a.phase).toBe('over');
    expect(a.score[0] + a.score[1]).toBeGreaterThanOrEqual(1);
    expect(a.half).toBeGreaterThanOrEqual(2);
    // Not vacuous: the run drove the whole phase machine, not just `play`. Measured
    // once and reported, never tuned: 14 915 steps, 1-2, decided in the golden goal,
    // visiting all seven phases and four set-piece kinds (kickoff, free-kick,
    // goal-kick, throw-in), with 17 free kicks born of a slide and run C first
    // diverging at step 1410. Change the policy or the formation and these move;
    // measure the new values and report them, never edit them away.
    for (const phase of PHASES) {
      expect(visited, `phase ${phase} was never visited in the recorded match`).toContain(phase);
    }
    expect(sawFoulSetPiece, 'the recorded match never produced a foul: the tackle chain is untested end to end').toBe(true);
    expect(rngA.calls).toBeGreaterThan(0);
    expect(firstMismatchB).toBe(-1);
    expect(sameMatch(a, b)).toBe(true);
    // Ruling R3: the negative is an explicit step, not just "not equal at the end".
    expect(firstMismatchC, `run C never diverged from run A in ${steps} steps: the seed is not reaching a steal roll`).toBeGreaterThanOrEqual(0);
    expect(sameMatch(a, c)).toBe(false);
    expect(recorded.length).toBe(steps);
  });

  it('replaying the recording from a fresh match a second time gives the same score and the same final step', () => {
    const a = fresh();
    const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const recorded: [TeamInput, TeamInput][] = [];
    const rngA = createRng(seedA);
    while (a.phase !== 'over' && recorded.length < RECORD_CAP) {
      policy(a, 0, live[0]);
      policy(a, 1, live[1]);
      const frame: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
      copyTeamInput(live[0], frame[0]);
      copyTeamInput(live[1], frame[1]);
      recorded.push(frame);
      stepMatch(a, live, rngA);
    }
    const replay = fresh();
    const rngR = createRng(seedA);
    for (const frame of recorded) stepMatch(replay, frame, rngR);
    expect(replay.phase).toBe('over');
    expect(replay.score).toEqual(a.score);
    expect(replay.stepCount).toBe(a.stepCount);
  });
});
