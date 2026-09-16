import { describe, expect, it } from 'vitest';
import { NORMAL_RULES } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { PLAYER_RADIUS } from '../football-logic/players';
import { TEAMS } from '../football-logic/teams';
import { BALL_SCALE_MAX, BALL_SHADOW_MIN, ballLift, ballScale, ballShadowFade, ballShadowScale } from './ball-view';
import { GESTURE_IDLE, beginGkCatchGestures, createGestureTimers, diveReach, gestureProgress, resetGestures } from './gestures';
import { ballInsideGoalMouth } from './goal-net';
import { MATCH_RUN_STEP_CAP, createMatchRun, finishMatchRun, stepMatchRun } from './match-run';
import { createDivePose, createPlayerPose, divePose, playerPose } from './player-pose';

const BRA = TEAMS[2];
const FRA = TEAMS[5];
// Three different matches, not three runs of the same one: enough goals, saves and
// high balls between them to exercise every helper of the step.
const SEEDS = [23, 71, 131];

describe('the step-11 view layer over three full matches', () => {
  it('changes nothing in the simulation and produces only values inside its own bounds', () => {
    // Everything the probe observes, summed across the three matches.
    let saves = 0;
    let gestureSteps = 0;
    let airborneSteps = 0;
    let goalPhaseSteps = 0;
    let ballInsideMouthSteps = 0;
    let finiteEverywhere = true;
    let scaleInBounds = true;
    let shadowInBounds = true;
    let liftNeverNegative = true;
    let progressInBounds = true;
    let reachInBounds = true;
    let poseInsideBody = true;

    const gestures = createGestureTimers();
    const pose = createPlayerPose();
    const dive = createDivePose();

    for (const seed of SEEDS) {
      // The control: the very same match, stepped WITHOUT the screen layer.
      const control = createMatchRun(BRA, FRA, seed, 6, [false, false], NORMAL_RULES, [0, 0]);
      const controlWinner = finishMatchRun(control);
      expect(controlWinner).not.toBe(-1);

      const probed = createMatchRun(BRA, FRA, seed, 6, [false, false], NORMAL_RULES, [0, 0]);
      const m = probed.match;
      resetGestures(gestures);
      let steps = 0;
      while (m.phase !== 'over' && steps < MATCH_RUN_STEP_CAP) {
        // Pre-flight finding: the direction has to be read from the ball's position
        // BEFORE this step, not from the 'gk-catch' event -- see gestures.ts's header.
        const prevBallX = m.ball.x;
        const prevBallY = m.ball.y;
        stepMatchRun(probed);
        steps++;

        saves += beginGkCatchGestures(m, gestures, prevBallX, prevBallY);

        if (m.phase === 'goal') {
          goalPhaseSteps++;
          if (ballInsideGoalMouth(m.ball.x, m.ball.y, m.ball.z, PITCH)) ballInsideMouthSteps++;
        }

        const z = m.ball.z;
        if (z > 0) airborneSteps++;
        const scale = ballScale(z);
        const shadow = ballShadowScale(z);
        const fade = ballShadowFade(z);
        const lift = ballLift(z);
        if (!Number.isFinite(scale + shadow + fade + lift)) finiteEverywhere = false;
        if (scale < 1 || scale > BALL_SCALE_MAX) scaleInBounds = false;
        if (shadow > 1 || shadow < BALL_SHADOW_MIN || fade > 1) shadowInBounds = false;
        if (lift < 0) liftNeverNegative = false;

        for (let i = 0; i < m.players.length; i++) {
          const p = m.players[i];
          playerPose(p.x, p.y, p.facingX, p.facingY, PLAYER_RADIUS, pose);
          if (!Number.isFinite(pose.headX + pose.headY + pose.leftX + pose.rightY)) finiteEverywhere = false;
          if (Math.hypot(pose.headX - p.x, pose.headY - p.y) + pose.headR > PLAYER_RADIUS + 1e-9) poseInsideBody = false;

          const progress = gestureProgress(gestures, p.id, m.stepCount);
          if (progress !== GESTURE_IDLE) {
            gestureSteps++;
            if (progress < 0 || progress >= 1) progressInBounds = false;
            const reach = diveReach(progress);
            if (reach < 0 || reach > 1.5 + 1e-9) reachInBounds = false;
            divePose(p.x, p.y, gestures.dirX[p.id], gestures.dirY[p.id], PLAYER_RADIUS, reach, dive);
            if (!Number.isFinite(dive.frontX + dive.frontY + dive.sideX + dive.endR)) finiteEverywhere = false;
          }
        }
      }

      // THE point of the probe: the screen layer read the match and changed nothing.
      expect(steps).toBeLessThan(MATCH_RUN_STEP_CAP);
      expect(m.stepCount).toBe(control.match.stepCount);
      expect(m.score).toEqual(control.match.score);
      expect(m.half).toBe(control.match.half);
    }

    // Nothing here is allowed to be zero: a probe that never saw a save, a high ball
    // or a goal would pass while proving nothing.
    expect(saves).toBeGreaterThan(0);
    expect(gestureSteps).toBeGreaterThan(0);
    expect(airborneSteps).toBeGreaterThan(0);
    expect(goalPhaseSteps).toBeGreaterThan(0);
    expect(ballInsideMouthSteps).toBe(goalPhaseSteps);

    expect(finiteEverywhere).toBe(true);
    expect(scaleInBounds).toBe(true);
    expect(shadowInBounds).toBe(true);
    expect(liftNeverNegative).toBe(true);
    expect(progressInBounds).toBe(true);
    expect(reachInBounds).toBe(true);
    expect(poseInsideBody).toBe(true);
  });

  it('keeps one gesture per keeper: a save never starts a gesture on anybody else', () => {
    const run = createMatchRun(BRA, FRA, SEEDS[0], 6, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const gestures = createGestureTimers();
    resetGestures(gestures);
    let outfieldGestures = 0;
    let steps = 0;
    while (m.phase !== 'over' && steps < MATCH_RUN_STEP_CAP) {
      const prevBallX = m.ball.x;
      const prevBallY = m.ball.y;
      stepMatchRun(run);
      steps++;
      beginGkCatchGestures(m, gestures, prevBallX, prevBallY);
      for (let i = 0; i < m.players.length; i++) {
        const p = m.players[i];
        if (p.role !== 'gk' && gestureProgress(gestures, p.id, m.stepCount) !== GESTURE_IDLE) outfieldGestures++;
      }
    }
    expect(outfieldGestures).toBe(0);
  });
});
