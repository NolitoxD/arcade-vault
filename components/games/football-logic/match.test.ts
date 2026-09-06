import { describe, expect, it } from 'vitest';
import { PITCH, centerX, centerY } from './pitch';
import { FORMATIONS, TEAMS, type Formation, type TeamDef } from './teams';
import { dist } from './geometry';
import { createTeamInput, copyTeamInput, toAxis, type TeamInput } from './input';
import { STEP_MS, stepsFor } from './step';
import { GK_LINE_DIST, TACKLE_DIST, TACKLE_STEPS, type PlayerState } from './players';
import { createBall, type BallState } from './ball';
import { createRng, type Rng } from './rng';
import { checkGoalkeepersInBox } from './invariants';
import {
  GOAL_PAUSE_STEPS, HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, HALF_TIME_PAUSE_STEPS,
  abandon, callSetPiece, createMatch, endGoalPause, endHalf, endHalfTime, isOpenPlay, kickoffTeamFor, resumePlay,
  scoreGoal, stepMatch, type MatchPhase, type MatchState,
} from './match';
import { SET_PIECE_COUNTDOWN_STEPS, type SetPieceState } from './set-pieces';
import { GK_HOLD_STEPS, SHORT_PASS_SPEED, STEAL_CHANCE, STEAL_CHANCE_VS_SPRINT, freestMateDir, shotSpeed } from './actions';
import { applyKickError, humanProfile, profileFor, type AiProfile } from './ai';

const TEAM_PAIR: [TeamDef, TeamDef] = [TEAMS[0], TEAMS[1]];
const CY = centerY(PITCH);
const PHASES: readonly MatchPhase[] = ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal', 'over'];
const IDLE: readonly [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
const PROFILES: readonly [AiProfile, AiProfile] = [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)];

function fresh(): MatchState {
  return createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES);
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
    expect(m.profiles).toBe(PROFILES);
    expect(m.catchRolled).toEqual([false, false]);
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
    const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES);
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
    // Stage B (D4): keeperCatch is the one other draw the engine makes, and it WOULD fire here --
    // a misread penalty flies at the keeper's line and keeperStep slides him into
    // GK_CATCH_RADIUS in ~11 steps. Keeper on the floor: keeperCatch refuses a downed keeper, so
    // the only draw that could appear is a set piece re-firing -- exactly what this test pins
    // (expectation 9).
    m.players[9].downUntilStep = m.stepCount + 60;
    // 1 draw for the keeper's read, plus a 2nd only when it reads wrong and has to pick a side.
    const afterExecution = rng.calls;
    expect(afterExecution).toBeGreaterThanOrEqual(1);
    expect(afterExecution).toBeLessThanOrEqual(2);
    // Idle inputs never press B and a downed keeper never catches, so nothing else in the
    // engine can draw: any growth here would be stepSetPiece firing a second time.
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
    // Stage B (D4): same penalty, same ~11-step slide into GK_CATCH_RADIUS, and a catch would
    // hold the ball 2 s and throw it long -- a throw that can end in touch inside the 400-step
    // window and set `secondCall` for a reason that is not C1. Keeper on the floor: keeperCatch
    // refuses a downed keeper, so the ball goes in as it did in stage A and the only set piece
    // that could appear is the re-judged foul this test pins (expectation 9).
    m.players[9].downUntilStep = m.stepCount + 60;
    let secondCall = -1;
    for (let i = 0; i < 400 && secondCall < 0; i++) {
      stepMatch(m, IDLE, rng);
      if (m.phase === 'set-piece') secondCall = i;
    }
    expect(secondCall, 'the same foul was judged a second time after the set piece').toBe(-1);
  });
});

// Final review Important #1: the 18-slot sweep used to live only at the top of
// stepOpenPlay, so a foul judged on the step play stops (which hands the phase
// to 'set-piece') stayed in its slot untouched through every countdown step
// that follows -- those steps run stepMatch's 'set-piece' branch, never
// stepOpenPlay. A stage-C consumer reading scratch.events after stepMatch (the
// declared destination of ActionKind, actions.ts:9) would keep seeing that same
// foul/tackle event for the whole countdown, not just the step it happened on.
describe('scratch.events is swept every step, not only in open play (final review Important #1)', () => {
  it('the foul event is visible on the step it is judged, but every slot reads back to none on the very next (countdown) step', () => {
    const m = fresh();
    resumePlay(m);
    // Same free-ball / offender-into-victim shape as the C1 fixture above, but
    // at x = 900 -- outside BOTH big areas ([0,320] and [1680,2000]) -- so this
    // is a free kick, not a penalty: the countdown that follows is what is
    // under test, not the kick kind.
    m.ball.owner = null;
    m.ball.x = 300; m.ball.y = 1150; m.ball.z = 0;
    m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0;
    m.ball.lastTouchTeam = 0; m.ball.lastTouchId = 5;
    m.ball.kickerId = -1; m.ball.kickLockUntilStep = 0;
    const victim = m.players[5];
    victim.x = 900; victim.y = 600; victim.downUntilStep = 0;
    const offender = m.players[10];
    offender.x = 880; offender.y = 600;
    offender.tackleStepsLeft = 10;
    offender.tackleDirX = 1; offender.tackleDirY = 0;
    const rng = createRng(1);
    // Step N: the foul is judged and the phase turns to 'set-piece' on this step.
    stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('set-piece');
    expect(m.setPiece?.kind).toBe('free-kick');
    expect(m.scratch.events[offender.id]).toMatchObject({ kind: 'tackle', foul: true, victimId: victim.id });
    // Step N+1: a countdown step (stepSetPiece returns false without touching
    // `out` while stepsLeft > 0), phase still 'set-piece'. Every one of the 18
    // slots must have been swept back to 'none' -- the foul already happened.
    stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('set-piece');
    for (let i = 0; i < m.scratch.events.length; i++) {
      expect(m.scratch.events[i].kind, `slot ${i} still carries a stale event on the countdown step`).toBe('none');
    }
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
    // Stage B (D4, keeper rule 2): a moving ball inside GK_CATCH_RADIUS makes keeperCatch roll
    // BEFORE the physics. A draw of 0.99 misses at every level (catchChance <= 0.90), so the
    // shot flies on and the referee still sees it cross the line. The roll is asserted, not
    // hidden: the keeper tried and failed, and the goal stands (expectation 8).
    const rng = fixedRng([0.99]);
    stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('goal');
    expect(m.score).toEqual([1, 0]);
    expect(rng.calls).toBe(1);
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
// chosen by scanning createRng, never by luck: the FIRST draw of the recording is
// still a steal, and the threshold it applies is STEAL_CHANCE or
// STEAL_CHANCE_VS_SPRINT depending on whether the owner is sprinting (ruling R3) --
// so seedA's first draw is below both and seedC's is at or above both, making that
// first steal attempt flip either way. Whole-stage review I1: the policy DOES press
// A off the ball, so slides, fouls, free kicks and penalties do happen; and since
// stage B the rng has four consumers (steal, penalty read, keeper catch, kick
// error), so run C's divergence can arrive through any of them.

function policy(match: MatchState, team: 0 | 1, out: TeamInput): void {
  out.dx = 0; out.dy = 0; out.a = 'up'; out.b = 'up'; out.c = 'up'; out.formation = 0; out.strategy = 'neutral';
  const me = match.players[match.controlled[team]];
  const ball = match.ball;
  const step = match.stepCount;
  const attack = match.attackDir[team];
  if (ball.owner === me.id) {
    if (team === 0) {
      // Run a corridor 50 u off the centre line (clear of the static 3-3-2 lanes and the keeper), then shoot straight.
      out.dy = toAxis(CY - 50 - me.y, 3);
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
  out.dx = toAxis(ball.x - me.x, 4);
  out.dy = toAxis(ball.y - me.y, 4);
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
    p.tackleStepsLeft === q.tackleStepsLeft && p.tackleDirX === q.tackleDirX && p.tackleDirY === q.tackleDirY &&
    p.wantX === q.wantX && p.wantY === q.wantY && p.wantSprint === q.wantSprint
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
  if (a.catchRolled[0] !== b.catchRolled[0] || a.catchRolled[1] !== b.catchRolled[1]) return false;
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
  // Ruling R26: each recording fills its own set and the second test asserts the union
  // covers the seven phases (no single policy reaches all seven).
  const visitedFirst = new Set<MatchPhase>();
  const visitedGolden = new Set<MatchPhase>();

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
    for (const phase of visited) visitedFirst.add(phase);
    expect(a.phase).toBe('over');
    expect(a.score[0] + a.score[1]).toBeGreaterThanOrEqual(1);
    expect(a.half).toBeGreaterThanOrEqual(2);
    // Not vacuous: the run drove the phase machine, not just `play`. Measured once and
    // reported, never tuned (stage B, with all 16 outfield players alive): 11 325 steps,
    // 0-2, decided at the end of the second half, visiting six phases and five set-piece
    // kinds (kickoff, free-kick, goal-kick, throw-in, penalty), with run C first diverging
    // at step 1171. Change the policy, the AI or the formation and these move; measure the
    // new values and report them, never edit them away.
    // Ruling R26: six, not seven. This policy gives team 1 no shooting branch, so only
    // team 0 can be ahead on merit and the score is never level at full time -- which is
    // the only door into 'golden-goal' (endHalf sends a level match to half 3). In stage A,
    // with the mates frozen, a level score happened by coincidence; with the live AI it
    // does not, and a coincidence is not something to restore. The negative is asserted
    // here so the day this recording DOES reach a golden goal somebody has to come back and
    // re-read this comment, and the seventh phase is covered by the second recording below.
    for (const phase of ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'over'] as const) {
      expect(visited, `phase ${phase} was never visited in the recorded match`).toContain(phase);
    }
    expect(visited, 'this recording reached the golden goal: the score was level at full time with a policy in which only team 0 shoots').not.toContain('golden-goal');
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

  // Ruling R26 — second recording. The first one cannot reach 'golden-goal' by
  // construction: only team 0 has a shooting branch, so with the live AI of stage B the
  // score is never level at full time. This recording keeps the seeds, the formations and
  // the policy and changes exactly one thing: while the match is inside the two
  // regulation halves (half 1 and half 2, the two runs of HALF_STEPS the clock counts
  // before endHalf sends a level match to half 3), neither team shoots: the A button is
  // never pressed, and the carrier walks the ball back towards the centre spot instead of
  // towards the rival goal. Both halves are needed: with A alone suppressed the carrier
  // still scored six times by simply dribbling over the line (measured: 6-0, no shot
  // involved), so a "no shooting" policy has to take the carrier's heading too. Movement,
  // chasing and passes are untouched. From half 3 on the policy IS the first recording's,
  // team 0 shoots again and one golden goal ends the match.
  //
  // Measured once and reported, never tuned: 13 376 steps, 0-0 at full time, the golden
  // goal opening at step 10 979 and team 0 winning it 1-0; six phases visited (kickoff,
  // play, half-time, golden-goal, set-piece, over -- 'goal' cannot appear here because the
  // only goal of the match is the golden one, and scoreGoal in half 3 goes straight to
  // 'over'), three set-piece kinds (kickoff, free-kick, goal-kick), 527 rng draws and run C
  // first diverging at step 360. Change the policy, the AI or the formation and these move;
  // measure the new values and report them, never edit them away.
  function goldenPolicy(match: MatchState, team: 0 | 1, out: TeamInput): void {
    if (match.half === 3) {
      policy(match, team, out);
      return;
    }
    out.dx = 0; out.dy = 0; out.a = 'up'; out.b = 'up'; out.c = 'up'; out.formation = 0; out.strategy = 'neutral';
    const me = match.players[match.controlled[team]];
    const ball = match.ball;
    const step = match.stepCount;
    if (ball.owner === me.id) {
      out.dx = toAxis(centerX(match.pitch) - me.x, 4);
      out.dy = toAxis(CY - me.y, 4);
      // A pass every 90 steps, the two teams out of phase: the ball keeps changing hands,
      // so possession, steals, kick error and the keepers still draw from the rng.
      if (step % 90 === team * 45) out.b = 'pressed';
      if (step % 90 === team * 45 + 1) out.b = 'released';
      return;
    }
    out.dx = toAxis(ball.x - me.x, 4);
    out.dy = toAxis(ball.y - me.y, 4);
    if (step % 30 === team * 15) out.b = 'pressed';
  }

  it('golden goal with live AI (criterion 1, second recording)', () => {
    const a = fresh();
    const b = fresh();
    const c = fresh();
    const rngA = countingRng(seedA);
    const rngB = createRng(seedA);
    const rngC = createRng(seedC);
    const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const visited = new Set<MatchPhase>();
    let fullTimeLevel: boolean | null = null;
    let firstMismatchB = -1;
    let firstMismatchC = -1;
    let steps = 0;
    while (a.phase !== 'over' && steps < RECORD_CAP) {
      goldenPolicy(a, 0, live[0]);
      goldenPolicy(a, 1, live[1]);
      const frame: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
      copyTeamInput(live[0], frame[0]);
      copyTeamInput(live[1], frame[1]);
      stepMatch(a, live, rngA);
      stepMatch(b, frame, rngB);
      stepMatch(c, frame, rngC);
      visited.add(a.phase);
      if (fullTimeLevel === null && a.half === 3) fullTimeLevel = a.score[0] === a.score[1];
      if (firstMismatchB < 0 && !sameMatch(a, b)) firstMismatchB = steps;
      if (firstMismatchC < 0 && !sameMatch(a, c)) firstMismatchC = steps;
      steps++;
    }
    expect(a.phase).toBe('over');
    // Anti-coincidence: 'golden-goal' could also be reached and left by a forced phase --
    // here it is the engine's own route, so the half marker and the score shape are
    // pinned too. half 3 is the terminal marker of a golden goal (endHalf sets it, and
    // scoreGoal in half 3 goes straight to 'over'), and a golden goal can only ever be
    // won by exactly one goal.
    expect(visited, 'the second recording never reached the golden goal: the score was not level at full time').toContain('golden-goal');
    expect(a.half).toBe(3);
    expect(Math.abs(a.score[0] - a.score[1])).toBe(1);
    // Anti-coincidence: this is what makes the golden goal real rather than a phase the
    // match happened to pass through -- the score WAS level on the step the second half
    // ended. `null` (half 3 never reached) fails this too.
    expect(fullTimeLevel, 'the match walked into half 3 without a level score').toBe(true);
    expect(rngA.calls).toBeGreaterThan(0);
    // Determinism, the same three-run pattern as the first recording: same seed replays
    // step by step, a different seed diverges at a step this test names.
    expect(firstMismatchB).toBe(-1);
    expect(sameMatch(a, b)).toBe(true);
    expect(b.score).toEqual(a.score);
    // Anti-coincidence: sameMatch could in principle be blind to a field it does not read,
    // so the 18 final positions are compared here on their own, id by id.
    expect(a.players.length).toBe(18);
    for (let i = 0; i < a.players.length; i++) {
      expect([b.players[i].x, b.players[i].y], `player ${i} ended somewhere else in run B`).toEqual([a.players[i].x, a.players[i].y]);
    }
    expect(firstMismatchC, `run C never diverged from run A in ${steps} steps: the seed is not reaching a draw`).toBeGreaterThanOrEqual(0);
    expect(sameMatch(a, c)).toBe(false);
    for (const phase of visited) visitedGolden.add(phase);
    // Ruling R26: the seven-phase coverage the first recording used to carry alone is now
    // the union of the two recordings -- neither policy reaches every phase on its own.
    // This runs after the first recording (vitest runs a file's tests in order), which is
    // what the guard below states out loud.
    expect(visitedFirst.size, 'the first recording did not run: this assertion is the union of both recordings').toBeGreaterThan(0);
    for (const phase of PHASES) {
      expect(
        visitedFirst.has(phase) || visitedGolden.has(phase),
        `phase ${phase} was visited by neither recording`,
      ).toBe(true);
    }
  });
});

// ── D4: the keeper catches, holds and throws (stage B, Task 6a) ───────────────
//
// D4 helper: a fixed rng that counts its draws (freeBall is the C2 one, higher up in this file).
function fixedRng(values: number[]): CountingRng {
  let i = 0;
  const fn: CountingRng = Object.assign(function next(): number {
    fn.calls++;
    return values[i++ % values.length];
  }, { calls: 0 });
  return fn;
}
// Team 1's keeper (id 9) on its line; a 700 u/s shot 31 u short of it (inside GK_CATCH_RADIUS,
// off the boundary) is caught on the first step with a draw of 0 (any profile catches). Idle
// input: nobody presses anything. The catch step is stepCount 0, so ownerSinceStep === 0.
function caught(): { m: MatchState; keeper: PlayerState } {
  const m = fresh();
  resumePlay(m);
  const keeper = m.players[9];
  keeper.x = PITCH.width - GK_LINE_DIST; keeper.y = CY;
  freeBall(m, keeper.x - 31, CY, 700, 0);
  stepMatch(m, IDLE, fixedRng([0]));
  return { m, keeper };
}

describe('D4: a catch is possession, not a set piece; the team throws by button or the engine does at 2 s (spec keeper rules 2 and 4)', () => {
  it('(a) the caught ball belongs to the keeper, play goes on in the same phase with a gk-catch event, and a rival at steal range cannot take it (no rng draw)', () => {
    const { m, keeper } = caught();
    expect(m.ball.owner).toBe(9);
    expect(m.ball.ownerSinceStep).toBe(0);
    expect(m.phase).toBe('play');
    expect(m.setPiece).toBeNull();
    expect(m.scratch.events[9]).toMatchObject({ kind: 'gk-catch', ok: true, actorId: 9 });
    expect(m.controlled[1]).not.toBe(9);                     // the cursor never sits on the keeper (S-GK.6)
    const thief = m.players[m.controlled[0]];
    thief.x = keeper.x - 20; thief.y = CY;                   // inside STEAL_RANGE of the keeper
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].b = 'pressed';
    const rng = fixedRng([0]);
    stepMatch(m, inputs, rng);
    expect(m.ball.owner).toBe(9);
    expect(rng.calls).toBe(0);                               // steal() refuses a keeper owner before rolling
    expect(m.phase).toBe('play');
  });
  it('(b) B on the 10th step of the hold throws a SHORT pass to the nearest mate in the d-pad cone; A throws a LONG one to the farthest — by the keeper, exact, no rng', () => {
    for (const button of ['b', 'a'] as const) {
      const { m, keeper } = caught();
      const rng = countingRng(3);
      for (let i = 0; i < 9; i++) stepMatch(m, IDLE, rng);
      expect(m.ball.owner).toBe(9);
      // Two mates below the keeper (+y): 155 u and 461 u away, both inside the +y cone. Every 3-3-2
      // mate is at x <= 1587 with |dy| <= 325 after nine steps of drift: outside that cone (dot < 0.64).
      const near = m.players[12]; near.x = keeper.x - 40; near.y = CY + 150;
      const far = m.players[13]; far.x = keeper.x - 100; far.y = CY + 450;
      const target = button === 'b' ? near : far;
      const d = dist(keeper.x, keeper.y, target.x, target.y);
      const ux = (target.x - keeper.x) / d;
      const uy = (target.y - keeper.y) / d;
      const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
      inputs[1].dy = 1;
      inputs[1][button] = 'pressed';
      stepMatch(m, inputs, rng);
      expect(m.ball.owner).toBeNull();
      expect(m.ball.kickerId).toBe(9);
      expect(m.scratch.events[9]).toMatchObject({ kind: button === 'b' ? 'short-pass' : 'long-pass', ok: true, actorId: 9 });
      expect(m.ball.vy / m.ball.vx).toBeCloseTo(uy / ux, 6);  // exact aim: a keeper's throw carries no angular error
      if (button === 'a') expect(m.ball.z).toBeGreaterThan(0); else expect(m.ball.z).toBe(0);
      expect(m.phase).toBe('play');
      expect(rng.calls).toBe(0);                             // ten steps of a held ball and a throw: not one draw
    }
  });
  it('(c) with nobody pressing, the automatic release fires on exactly the GK_HOLD_STEPS-th step after the catch, a long pass at the freest own-half mate, and not one step before', () => {
    const { m, keeper } = caught();
    const rng = countingRng(3);
    for (let i = 0; i < GK_HOLD_STEPS - 1; i++) stepMatch(m, IDLE, rng);
    expect(m.ball.owner).toBe(9);
    expect(m.phase).toBe('play');
    const expected = { x: 0, y: 0 };
    // The target as the engine will see it: positions only change in stepPhysics, after the release.
    expect(freestMateDir(keeper, m.players, -1, PITCH, expected)).toBe(true);
    stepMatch(m, IDLE, rng);
    expect(m.ball.owner).toBeNull();
    expect(m.scratch.events[9]).toMatchObject({ kind: 'gk-release', ok: true, actorId: 9 });
    expect(m.ball.vy / m.ball.vx).toBeCloseTo(expected.y / expected.x, 6);
    expect(m.ball.z).toBeGreaterThan(0);                     // a long pass: airborne
    expect(m.phase).toBe('play');
    expect(rng.calls).toBe(0);                               // the whole hold and the release: no draw (no error on a keeper's kick)
    expect(GK_HOLD_STEPS).toBe(stepsFor(2));
    // Pre-flight H4: the five steps after the throw. The ball is 9-46 u from the keeper, moving
    // and free -- inside GK_CATCH_RADIUS for four of them -- and keeperCatch must NOT roll for
    // it (own kick inside the kick lock): the keeper never gets it back, the rng stays untouched.
    for (let i = 0; i < 5; i++) {
      stepMatch(m, IDLE, rng);
      expect(m.ball.owner).toBeNull();
      expect(m.scratch.events[9].kind).not.toBe('gk-catch');
    }
    expect(rng.calls).toBe(0);
  });
  it('(e) while the keeper holds the ball the d-pad and the sprint do not move the field controlled: the AI places it, identically with and without input; with a free ball the same d-pad does move it', () => {
    const a = caught().m;
    const b = caught().m;
    expect(sameMatch(a, b)).toBe(true);
    const c1 = a.controlled[1];
    const before: [number, number] = [a.players[c1].x, a.players[c1].y];
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[1].dx = 1; inputs[1].dy = -1; inputs[1].c = 'held';
    stepMatch(a, inputs, createRng(1));
    stepMatch(b, IDLE, createRng(1));
    expect(a.ball.owner).toBe(9);
    expect(sameMatch(a, b)).toBe(true);
    expect([a.players[c1].x, a.players[c1].y]).not.toEqual(before);   // moved, by positionTeam (drift towards the ball)
    // Control, so the equality above is not vacuous: a FREE ball at rest and the same d-pad move the controlled.
    const free = fresh(); resumePlay(free); freeBall(free, 1000, CY, 0, 0);
    const still = fresh(); resumePlay(still); freeBall(still, 1000, CY, 0, 0);
    stepMatch(free, inputs, createRng(1));
    stepMatch(still, IDLE, createRng(1));
    expect(sameMatch(free, still)).toBe(false);
  });
  it('the same shot with a draw that misses flies on (no free pickup of a moving ball by the keeper, S6), and the referee calls the goal a few steps later', () => {
    const m = fresh();
    resumePlay(m);
    const keeper = m.players[9];
    keeper.x = PITCH.width - GK_LINE_DIST; keeper.y = CY;
    freeBall(m, keeper.x - 31, CY, 700, 0);
    const rng = fixedRng([0.99]);
    stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('play');
    expect(m.ball.owner).toBeNull();
    for (let i = 0; i < 6 && m.phase === 'play'; i++) stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('goal');
    expect(m.score).toEqual([1, 0]);
    expect(rng.calls).toBe(1);                               // one roll per approach (catchRolled), never a second
  });
});

// Fix round 1 (reviewer Important #1): applyTeamInput (match.ts:266-280) is the
// only place a field player's profile-driven kick error reaches the engine, and
// nothing exercised that branch -- every rng.calls assertion above is a
// keeper/set-piece/steal case. These tests give team 0's controlled player the
// ball (the kickoff taker, already true right after createMatch: see the
// createMatch test), hold and release a button, and check the post-error
// direction against a DIRECT call to applyKickError on a copy of the pre-error
// velocity (no trig, no atan2) -- the same technique the finding asked for.
describe("applyTeamInput wires the profile's kick error into a field player's shot and pass (match.ts:266-280)", () => {
  // A diagonal aim, not an axis: with (1,0)/(0,1) a ternary swapped to the wrong
  // profile field could still leave one velocity component exactly right and
  // hide behind it. difficulty 1 gives the LARGEST error in the whole clamp
  // range (S1), and shotErrorDeg (12.5) and passErrorDeg (16) are far enough
  // apart there that a swap is not a coincidence of scale.
  const AIM_X = Math.SQRT1_2;
  const AIM_Y = Math.SQRT1_2;
  const CPU_PROFILES: readonly [AiProfile, AiProfile] = [profileFor(TEAMS[0], 1), profileFor(TEAMS[1], 1)];
  const HUMAN_PROFILES: readonly [AiProfile, AiProfile] = [humanProfile(TEAMS[0], 1), profileFor(TEAMS[1], 1)];

  function begin(profiles: readonly [AiProfile, AiProfile]): { m: MatchState; id: number } {
    const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, profiles);
    resumePlay(m);   // ball.owner is already team 0's controlled player (createMatch test, above)
    return { m, id: m.controlled[0] };
  }

  // Places every OTHER team-0 outfield player exactly opposite the aim direction
  // FROM THE PASSER's current position: dot((AIM_X, AIM_Y), theirDirection) = -1,
  // far outside the 45deg cone (INV_SQRT2), so pickPassTarget/aimPass can never
  // lock onto one and the pass direction stays the raw d-pad diagonal.
  function clearPassLane(m: MatchState, controlledId: number): void {
    const p = m.players[controlledId];
    for (const q of m.players) {
      if (q.team === 0 && q.role !== 'gk' && q.id !== controlledId) {
        q.x = p.x - AIM_X * (1000 + q.id);
        q.y = p.y - AIM_Y * (1000 + q.id);
      }
    }
  }

  it('a shot draws the rng exactly once, and the post-error direction matches applyKickError(shotErrorDeg) on the pre-error velocity', () => {
    const { m, id } = begin(CPU_PROFILES);
    const rng = fixedRng([0.9]);   // not 0.5: a 0.5 draw is zero error and would pass under any errorDeg
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].dx = 1; inputs[0].dy = 1; inputs[0].a = 'pressed';
    stepMatch(m, inputs, rng);
    expect(rng.calls).toBe(0);               // charging a shot draws nothing
    inputs[0].a = 'released';
    stepMatch(m, inputs, rng);
    expect(rng.calls).toBe(1);               // exactly one draw for the kick, on top of the zero above
    expect(m.scratch.events[id]).toMatchObject({ kind: 'shot', ok: true, actorId: id });
    const pre = shotSpeed(1);                // chargeSteps === 1: one 'pressed' step before release
    const expected = createBall();
    expected.vx = pre * AIM_X;
    expected.vy = pre * AIM_Y;
    applyKickError(expected, CPU_PROFILES[0].shotErrorDeg, fixedRng([0.9]));   // same draw the engine made
    // Ratio, not raw vx/vy: the same step's stepPhysics already ran one tick of
    // ground deceleration on the kicked ball (a uniform scale on vx AND vy), so
    // comparing magnitudes directly would fail for a reason that has nothing to
    // do with the error. The ratio is invariant to that uniform scale.
    expect(m.ball.vy / m.ball.vx).toBeCloseTo(expected.vy / expected.vx, 6);
    // Anti-coincidence: the exact (error-free) aim has ratio 1 (AIM_Y === AIM_X);
    // this fails too unless shotErrorDeg really moved the direction.
    expect(m.ball.vy / m.ball.vx).not.toBeCloseTo(1, 2);
  });

  it('a short pass draws the rng exactly once, and the post-error direction matches applyKickError(passErrorDeg) on the pre-error velocity', () => {
    const { m, id } = begin(CPU_PROFILES);
    clearPassLane(m, id);
    const rng = fixedRng([0.9]);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].dx = 1; inputs[0].dy = 1; inputs[0].b = 'pressed';
    stepMatch(m, inputs, rng);
    expect(rng.calls).toBe(0);
    clearPassLane(m, id);                    // re-pin: the passer does not move (positionTeam skips it,
                                              // charging does not move it), but re-pinning costs nothing
    inputs[0].b = 'released';
    stepMatch(m, inputs, rng);
    expect(rng.calls).toBe(1);
    expect(m.scratch.events[id]).toMatchObject({ kind: 'short-pass', ok: true, actorId: id });
    const pre = SHORT_PASS_SPEED;             // chargeSteps === 1 < LONG_PASS_HOLD_STEPS: a short pass, constant speed
    const expected = createBall();
    expected.vx = pre * AIM_X;
    expected.vy = pre * AIM_Y;
    applyKickError(expected, CPU_PROFILES[0].passErrorDeg, fixedRng([0.9]));
    expect(m.ball.vy / m.ball.vx).toBeCloseTo(expected.vy / expected.vx, 6);
    expect(m.ball.vy / m.ball.vx).not.toBeCloseTo(1, 2);
  });

  it('a human profile still draws the rng once per kick (S8) but leaves the direction exact -- zero error, not zero draws', () => {
    const { m, id } = begin(HUMAN_PROFILES);
    const rng = fixedRng([0.9]);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].dx = 1; inputs[0].dy = 1; inputs[0].a = 'pressed';
    stepMatch(m, inputs, rng);
    expect(rng.calls).toBe(0);
    inputs[0].a = 'released';
    stepMatch(m, inputs, rng);
    expect(rng.calls).toBe(1);               // same draw count as the CPU profile above: error zero included
    expect(m.scratch.events[id]).toMatchObject({ kind: 'shot', ok: true, actorId: id });
    expect(m.ball.vy / m.ball.vx).toBeCloseTo(AIM_Y / AIM_X, 10);   // exact aim: no angular error on a human kick
  });
});

// Ruling R19 / criterion 11: formation and strategy change in the middle of play
// and the placement responds ON THE VERY NEXT STEP, not at the next set piece.
describe('criterion 11: live placement responds at once to a formation or strategy change', () => {
  // A second formation whose slot 0 sits 300 u further up the pitch than the 3-3-2's.
  const shifted: Formation = {
    id: '3-3-2-shifted', name: 'SHIFTED',
    slots: FORMATIONS[0].slots.map((s, i) => (i === 0 ? { ...s, x: s.x + 0.15 } : s)),
  };
  // Two identical matches run in lockstep; at the switch step only one changes its
  // input. Whatever the drift target is at that moment, the changed side must move
  // differently on THAT step -- not at the next set piece.
  function pair(table: readonly Formation[]): [MatchState, MatchState] {
    const a = createMatch(TEAM_PAIR, table, PITCH, PROFILES);
    const b = createMatch(TEAM_PAIR, table, PITCH, PROFILES);
    resumePlay(a); resumePlay(b);
    const ra = createRng(1); const rb = createRng(1);
    for (let i = 0; i < 120; i++) { stepMatch(a, IDLE, ra); stepMatch(b, IDLE, rb); }
    expect(sameMatch(a, b)).toBe(true);
    return [a, b];
  }
  it('switching the strategy to attack moves a defender further towards the rival goal on the next step', () => {
    const [control, switched] = pair(FORMATIONS);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].strategy = 'attack';
    stepMatch(control, IDLE, createRng(1));
    stepMatch(switched, inputs, createRng(1));
    expect(switched.strategies[0]).toBe('attack');
    expect(switched.players[1].x).toBeGreaterThan(control.players[1].x);   // slot 0 defender, team 0 attacks +x
  });
  it('switching the formation index moves the player of the changed slot on the next step, and nobody else', () => {
    const [control, switched] = pair([FORMATIONS[0], shifted]);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].formation = 1;
    stepMatch(control, IDLE, createRng(1));
    stepMatch(switched, inputs, createRng(1));
    expect(switched.formationIndex[0]).toBe(1);
    expect(switched.players[1].x).toBeGreaterThan(control.players[1].x);
    expect(switched.players[2].x).toBe(control.players[2].x);               // slot 1 is identical in both tables
    expect(switched.players[2].y).toBe(control.players[2].y);
  });
  it('and the human side is symmetric: team 1 responds the same step to its own strategy change', () => {
    const [control, switched] = pair(FORMATIONS);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[1].strategy = 'attack';
    stepMatch(control, IDLE, createRng(1));
    stepMatch(switched, inputs, createRng(1));
    expect(switched.players[10].x).toBeLessThan(control.players[10].x);      // team 1 attacks -x
  });
});
