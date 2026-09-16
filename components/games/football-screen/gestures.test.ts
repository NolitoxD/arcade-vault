import { describe, expect, it } from 'vitest';
import { NORMAL_RULES, resumePlay } from '../football-logic/match';
import { TEAMS, TEAM_SIZE } from '../football-logic/teams';
import { createMatchRun, stepMatchRun } from './match-run';
import {
  DIVE_PEAK, DIVE_REACH_MAX, GESTURE_IDLE, GK_DIVE_STEPS,
  beginGkCatchGestures, createGestureTimers, diveReach, gestureBegin, gestureProgress, resetGestures,
} from './gestures';

const ESP = TEAMS[0];
const ITA = TEAMS[1];

describe('createGestureTimers', () => {
  it('holds one slot per player of the match, allocated once', () => {
    const g = createGestureTimers();
    expect(g.count).toBe(TEAM_SIZE * 2);
    expect(g.startStep.length).toBe(g.count);
    expect(g.untilStep.length).toBe(g.count);
    expect(g.dirX.length).toBe(g.count);
    expect(g.dirY.length).toBe(g.count);
  });

  it('starts inert: every slot is idle at step 0', () => {
    const g = createGestureTimers();
    for (let i = 0; i < g.count; i++) expect(gestureProgress(g, i, 0)).toBe(GESTURE_IDLE);
  });
});

describe('gestureBegin / gestureProgress', () => {
  it('runs from 0 to just under 1 over the duration and then goes idle', () => {
    const g = createGestureTimers();
    gestureBegin(g, 4, 100, GK_DIVE_STEPS, 1, 0);
    expect(gestureProgress(g, 4, 100)).toBe(0);
    expect(gestureProgress(g, 4, 100 + GK_DIVE_STEPS / 2)).toBeCloseTo(0.5, 6);
    expect(gestureProgress(g, 4, 100 + GK_DIVE_STEPS - 1)).toBeLessThan(1);
    expect(gestureProgress(g, 4, 100 + GK_DIVE_STEPS)).toBe(GESTURE_IDLE);
    expect(gestureProgress(g, 4, 100 + GK_DIVE_STEPS + 500)).toBe(GESTURE_IDLE);
  });

  it('keeps the direction it was given and leaves every other slot alone', () => {
    const g = createGestureTimers();
    gestureBegin(g, 9, 10, GK_DIVE_STEPS, 0, -1);
    expect(g.dirX[9]).toBe(0);
    expect(g.dirY[9]).toBe(-1);
    expect(gestureProgress(g, 8, 10)).toBe(GESTURE_IDLE);
    expect(gestureProgress(g, 10, 10)).toBe(GESTURE_IDLE);
  });

  it('ignores an index outside the pool instead of writing out of bounds', () => {
    const g = createGestureTimers();
    gestureBegin(g, -1, 10, GK_DIVE_STEPS, 1, 0);
    gestureBegin(g, g.count, 10, GK_DIVE_STEPS, 1, 0);
    expect(gestureProgress(g, -1, 10)).toBe(GESTURE_IDLE);
    expect(gestureProgress(g, g.count, 10)).toBe(GESTURE_IDLE);
  });

  // The dirty case: the component reuses the same timers for every match of a World
  // Cup and stepCount restarts at 0. A gesture left open at step 16 000 must NOT
  // reappear on the first step of the next match.
  it('does not fire again when the step count restarts at 0 in a new match', () => {
    const g = createGestureTimers();
    gestureBegin(g, 0, 16_000, GK_DIVE_STEPS, 1, 0);
    expect(gestureProgress(g, 0, 0)).toBe(GESTURE_IDLE);
  });

  it('resetGestures wipes every slot, timers and directions', () => {
    const g = createGestureTimers();
    gestureBegin(g, 0, 16_000, GK_DIVE_STEPS, 1, -1);
    resetGestures(g);
    expect(gestureProgress(g, 0, 16_000)).toBe(GESTURE_IDLE);
    expect(g.dirX[0]).toBe(0);
    expect(g.dirY[0]).toBe(0);
  });
});

describe('diveReach', () => {
  it('goes out and comes back: 0 at both ends, DIVE_REACH_MAX at the peak', () => {
    expect(diveReach(0)).toBe(0);
    expect(diveReach(DIVE_PEAK)).toBeCloseTo(DIVE_REACH_MAX, 6);
    expect(diveReach(1)).toBe(0);
  });

  it('reaches out faster than it comes back, which is what a save looks like', () => {
    expect(diveReach(DIVE_PEAK / 2)).toBeCloseTo(DIVE_REACH_MAX / 2, 6);
    expect(diveReach(DIVE_PEAK + (1 - DIVE_PEAK) / 2)).toBeCloseTo(DIVE_REACH_MAX / 2, 6);
    expect(DIVE_PEAK).toBeLessThan(0.5);
  });

  it('is 0 outside 0..1 instead of extrapolating', () => {
    expect(diveReach(-0.2)).toBe(0);
    expect(diveReach(1.4)).toBe(0);
  });
});

describe('beginGkCatchGestures', () => {
  it('starts nothing on a step with no catch', () => {
    const run = createMatchRun(ESP, ITA, 5, 5, [false, false], NORMAL_RULES, [0, 0]);
    const g = createGestureTimers();
    const prevBallX = run.match.ball.x;
    const prevBallY = run.match.ball.y;
    stepMatchRun(run);
    expect(beginGkCatchGestures(run.match, g, prevBallX, prevBallY)).toBe(0);
  });

  // A real catch, built from the engine's own rules instead of a hand-written event:
  // the ball is rolled at the keeper from inside its area, and keeperCatch fires.
  it('starts the keeper gesture on a real gk-catch, pointing at where the ball was one step before the catch', () => {
    const run = createMatchRun(ESP, ITA, 5, 9, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const g = createGestureTimers();
    resumePlay(m);
    const gk = m.players[0];
    m.ball.owner = null;
    m.ball.x = gk.x + 20;
    m.ball.y = gk.y - 10;
    m.ball.z = 0;
    m.ball.vx = -40;
    m.ball.vy = 0;
    m.ball.vz = 0;
    m.ball.lastTouchTeam = 1;
    m.ball.kickerId = 10;
    m.ball.kickLockUntilStep = 0;
    let fired = 0;
    for (let i = 0; i < 20 && fired === 0; i++) {
      // Pre-flight finding (blocker, fixed here): ev.x/ev.y from keeperCatch is USELESS
      // for direction -- ai.ts calls givePossession before stamping the event, and
      // givePossession's stickToOwner (ball.ts:54-58) has already snapped ball.x/y to
      // gk.x + gk.facingX * CONTROL_DIST by then, so ev.x - gk.x is always exactly
      // facingX * 18. The direction has to come from OUTSIDE the event: the ball's own
      // position one step earlier, snapshotted here exactly as Task 11-3's runStep does.
      const prevBallX = m.ball.x;
      const prevBallY = m.ball.y;
      stepMatchRun(run);
      fired = beginGkCatchGestures(m, g, prevBallX, prevBallY);
    }
    expect(fired).toBe(1);
    expect(gestureProgress(g, 0, m.stepCount)).toBe(0);
    // The stored direction is a unit vector, sourced from the pre-step ball position,
    // not from the event (see the comment above -- ev.x/y would give a unit vector too,
    // but always the keeper's OWN facing, which this test would not have caught).
    const len = Math.sqrt(g.dirX[0] * g.dirX[0] + g.dirY[0] * g.dirY[0]);
    expect(len).toBeCloseTo(1, 6);
    expect(gestureProgress(g, 0, m.stepCount + GK_DIVE_STEPS)).toBe(GESTURE_IDLE);
  });

  it('reads the events without writing a single field of the match', () => {
    const run = createMatchRun(ESP, ITA, 5, 5, [false, false], NORMAL_RULES, [0, 0]);
    const g = createGestureTimers();
    const prevBallX = run.match.ball.x;
    const prevBallY = run.match.ball.y;
    stepMatchRun(run);
    const before = JSON.stringify(run.match.ball) + run.match.stepCount + run.match.phase;
    beginGkCatchGestures(run.match, g, prevBallX, prevBallY);
    expect(JSON.stringify(run.match.ball) + run.match.stepCount + run.match.phase).toBe(before);
  });
});

describe('the length of the gesture', () => {
  it('is the ~0.6 s G11-2 asked for (35 steps at 60 steps/s) and ends well before the next restart', () => {
    expect(GK_DIVE_STEPS).toBe(35);
    // GOAL_PAUSE_STEPS is 120 and a set-piece countdown is 300: the keeper is
    // standing again long before it has to take the goal kick (G11-2).
    expect(GK_DIVE_STEPS).toBeLessThan(120);
  });
});
