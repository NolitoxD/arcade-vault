import { describe, expect, it } from 'vitest';
import { NORMAL_RULES } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { TEAMS } from '../football-logic/teams';
import { BALL_SCALE_MAX, BALL_SHADOW_MIN, ballLift, ballScale, ballShadowFade, ballShadowScale } from './ball-view';
import {
  DIVE_REACH_MAX, GESTURE_IDLE, beginGkCatchGestures, createGestureTimers, diveReach, gestureProgress, resetGestures,
} from './gestures';
import { ballInsideGoalMouth } from './goal-net';
import { MATCH_RUN_STEP_CAP, createMatchRun, finishMatchRun, stepMatchRun } from './match-run';
import { choosePlayerSprite, createSpriteChoice } from './sprite-frame';
import {
  OCTANT_COUNT, PLAYER_SPRITE_MAPS, POSE_COUNT, POSE_DIVE_0, POSE_DIVE_1, POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2,
} from './sprite-maps';

const BRA = TEAMS[2];
const FRA = TEAMS[5];
// Three different matches, not three runs of the same one: enough goals, saves and
// high balls between them to exercise every helper of steps 11 and V15-1.
const SEEDS = [23, 71, 131];

describe('the view layer (steps 11 and V15-1) over three full matches', () => {
  it('changes nothing in the simulation and produces only values inside its own bounds', () => {
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
    let spriteInBounds = true;
    let idleSeen = 0;
    let runSeen = 0;
    let diveOpenSeen = 0;
    let diveFullSeen = 0;
    const octantSeen = new Uint8Array(OCTANT_COUNT);

    const gestures = createGestureTimers();
    const choice = createSpriteChoice();

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
        // Step-11 pre-flight finding: the dive direction is read from the ball BEFORE
        // this step, not from the 'gk-catch' event -- see gestures.ts's header.
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

        // The same inputs drawPlayer hands to choosePlayerSprite.
        const shootout = m.phase === 'shootout';
        const takerId = m.shootout === null ? -1 : m.shootout.takerId;
        for (let i = 0; i < m.players.length; i++) {
          const p = m.players[i];
          const progress = gestureProgress(gestures, p.id, m.stepCount);
          if (progress !== GESTURE_IDLE) {
            gestureSteps++;
            if (progress < 0 || progress >= 1) progressInBounds = false;
            const reach = diveReach(progress);
            if (reach < 0 || reach > DIVE_REACH_MAX + 1e-9) reachInBounds = false;
          }
          const parked = shootout && p.id !== takerId && p.role !== 'gk';
          const keeperProgress = p.role === 'gk' ? progress : GESTURE_IDLE;
          choosePlayerSprite(p, m.stepCount, shootout, parked, keeperProgress, gestures.dirX[p.id], gestures.dirY[p.id], choice);
          if (!Number.isInteger(choice.octant) || choice.octant < 0 || choice.octant >= OCTANT_COUNT) spriteInBounds = false;
          else if (!Number.isInteger(choice.pose) || choice.pose < 0 || choice.pose >= POSE_COUNT) spriteInBounds = false;
          else if (PLAYER_SPRITE_MAPS[choice.octant][choice.pose].length === 0) spriteInBounds = false;
          else octantSeen[choice.octant] = 1;
          if (choice.pose === POSE_IDLE) idleSeen++;
          if (choice.pose === POSE_RUN_0 || choice.pose === POSE_RUN_1 || choice.pose === POSE_RUN_2) runSeen++;
          if (choice.pose === POSE_DIVE_0) diveOpenSeen++;
          if (choice.pose === POSE_DIVE_1) diveFullSeen++;
        }
      }

      // THE point of the probe: the screen layer read the match and changed nothing.
      expect(steps).toBeLessThan(MATCH_RUN_STEP_CAP);
      expect(m.stepCount).toBe(control.match.stepCount);
      expect(m.score).toEqual(control.match.score);
      expect(m.half).toBe(control.match.half);
    }

    // Nothing here is allowed to be zero: a probe that never saw a save, a high ball,
    // a goal, both dive frames or a runner would pass while proving nothing.
    expect(saves).toBeGreaterThan(0);
    expect(gestureSteps).toBeGreaterThan(0);
    expect(airborneSteps).toBeGreaterThan(0);
    expect(goalPhaseSteps).toBeGreaterThan(0);
    expect(ballInsideMouthSteps).toBe(goalPhaseSteps);
    expect(idleSeen).toBeGreaterThan(0);
    expect(runSeen).toBeGreaterThan(0);
    expect(diveOpenSeen).toBeGreaterThan(0);
    expect(diveFullSeen).toBeGreaterThan(0);
    let octants = 0;
    for (let o = 0; o < OCTANT_COUNT; o++) octants += octantSeen[o];
    expect(octants).toBe(OCTANT_COUNT);

    expect(finiteEverywhere).toBe(true);
    expect(scaleInBounds).toBe(true);
    expect(shadowInBounds).toBe(true);
    expect(liftNeverNegative).toBe(true);
    expect(progressInBounds).toBe(true);
    expect(reachInBounds).toBe(true);
    expect(spriteInBounds).toBe(true);
  });

  it('keeps the dive frames on the keepers: an outfield player is never drawn diving', () => {
    const run = createMatchRun(BRA, FRA, SEEDS[0], 6, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const gestures = createGestureTimers();
    const choice = createSpriteChoice();
    resetGestures(gestures);
    let outfieldGestures = 0;
    let outfieldDives = 0;
    let steps = 0;
    while (m.phase !== 'over' && steps < MATCH_RUN_STEP_CAP) {
      const prevBallX = m.ball.x;
      const prevBallY = m.ball.y;
      stepMatchRun(run);
      steps++;
      beginGkCatchGestures(m, gestures, prevBallX, prevBallY);
      const shootout = m.phase === 'shootout';
      const takerId = m.shootout === null ? -1 : m.shootout.takerId;
      for (let i = 0; i < m.players.length; i++) {
        const p = m.players[i];
        if (p.role === 'gk') continue;
        const progress = gestureProgress(gestures, p.id, m.stepCount);
        if (progress !== GESTURE_IDLE) outfieldGestures++;
        const parked = shootout && p.id !== takerId;
        // H12 from preflight (21-sep): the real gesture fraction is passed, WITHOUT the
        // role gate (`p.role === 'gk' ? progress : GESTURE_IDLE` that the other test in
        // this file used) — otherwise outfieldDives could only be > 0 with a badly broken
        // function, because choosePlayerSprite never sees progress !== GESTURE_IDLE for an
        // outfield player. With the real fraction, outfieldDives === 0 depends on gestures
        // only starting on keepers (verified by beginGkCatchGestures), which is the
        // guarantee this test claims to give.
        choosePlayerSprite(p, m.stepCount, shootout, parked, progress, gestures.dirX[p.id], gestures.dirY[p.id], choice);
        if (choice.pose === POSE_DIVE_0 || choice.pose === POSE_DIVE_1) outfieldDives++;
      }
    }
    expect(outfieldGestures).toBe(0);
    expect(outfieldDives).toBe(0);
  });
});
