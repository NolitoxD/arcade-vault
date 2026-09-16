import type { MatchState } from '../football-logic/match';
import { TEAM_SIZE } from '../football-logic/teams';

// G11-2 (grill del paso 11, QA jugado del 09-sep): the keeper has to STRETCH when it
// saves. The engine has no 'save' -- keeperCatch (ai.ts) writes an ActionEvent with
// kind 'gk-catch', ok and actorId = the keeper -- and G11-2 says the engine stays out
// of it, so the gesture is a SCREEN timer: one slot per player, written in place, read
// by drawPlayer, invisible to the simulation.
//
// Pre-flight finding: the event's OWN x/y are NOT the ball's position at the catch.
// keeperCatch (ai.ts) calls givePossession before stamping out.x/out.y, and
// givePossession's stickToOwner (ball.ts) has already snapped ball.x/y to
// gk.x + gk.facingX * CONTROL_DIST by then -- so ev.x - gk.x is always exactly the
// keeper's own facing, never the ball's real approach direction. The direction this
// module uses instead comes from OUTSIDE the event: the caller (VaultWorldCupGame.tsx)
// snapshots match.ball.x/y one step before calling stepMatchRun and hands that in as
// prevBallX/prevBallY -- a read, not a write, so determinism (criterion 1) is untouched.
//
// The shape is particles.ts's: typed arrays created ONCE (criterion 20), never after.
// The only Math.sqrt of this module runs inside beginGkCatchGestures -- on a save,
// which happens a handful of times per match, never per frame.

export const GK_DIVE_STEPS = 35; // ~0.6 s at 60 steps/s (G11-2)
export const GESTURE_IDLE = -1;
// The dive shoots out in the first third and comes back over the rest: a save is a
// snap, not a sine wave.
export const DIVE_PEAK = 0.35;
// How far the body stretches at the peak, in PLAYER_RADIUS units.
export const DIVE_REACH_MAX = 1.5;
// Below this, "towards the ball" is not a direction any more (the keeper is standing
// on it), so the gesture falls back to the way the keeper is facing.
const DIVE_MIN_DIST = 0.001;

export type GestureTimers = {
  count: number;
  startStep: Int32Array;
  untilStep: Int32Array;
  dirX: Float32Array;
  dirY: Float32Array;
};

export function createGestureTimers(count = TEAM_SIZE * 2): GestureTimers {
  return {
    count,
    startStep: new Int32Array(count),
    untilStep: new Int32Array(count),
    dirX: new Float32Array(count),
    dirY: new Float32Array(count),
  };
}

// Called when a match starts: stepCount restarts at 0 and a timer left open at step
// 16 000 of the previous match must not be read as "in the future".
export function resetGestures(g: GestureTimers): void {
  g.startStep.fill(0);
  g.untilStep.fill(0);
  g.dirX.fill(0);
  g.dirY.fill(0);
}

export function gestureBegin(
  g: GestureTimers, index: number, stepCount: number, durationSteps: number, dirX: number, dirY: number,
): void {
  if (index < 0 || index >= g.count || durationSteps <= 0) return;
  g.startStep[index] = stepCount;
  g.untilStep[index] = stepCount + durationSteps;
  g.dirX[index] = dirX;
  g.dirY[index] = dirY;
}

// 0 on the step the gesture starts, just under 1 on its last step, GESTURE_IDLE
// otherwise. A negative progress means the step count went BACKWARDS since the
// gesture started -- a new match reusing the same pool -- and is idle too.
export function gestureProgress(g: GestureTimers, index: number, stepCount: number): number {
  if (index < 0 || index >= g.count) return GESTURE_IDLE;
  const until = g.untilStep[index];
  if (stepCount >= until) return GESTURE_IDLE;
  const span = until - g.startStep[index];
  if (span <= 0) return GESTURE_IDLE;
  const progress = (stepCount - g.startStep[index]) / span;
  return progress < 0 ? GESTURE_IDLE : progress;
}

// Out and back, a straight ramp each way: no trigonometry, no allocation.
export function diveReach(progress: number): number {
  if (progress < 0 || progress > 1) return 0;
  const t = progress <= DIVE_PEAK ? progress / DIVE_PEAK : (1 - progress) / (1 - DIVE_PEAK);
  return t * DIVE_REACH_MAX;
}

// The one reader of the engine in this module: the same 18-slot sweep sfx-map.ts does
// for the shot, because the shootout wipes any pointer. Returns how many gestures it
// started (0 on almost every step). Reads the match; writes nothing in it.
//
// prevBallX/prevBallY, NOT ev.x/ev.y: see the header note. The caller (runStep) reads
// match.ball.x/y ONE step before calling stepMatchRun, which is much closer to "where
// the ball was when it was caught" than the post-catch value the event carries.
export function beginGkCatchGestures(
  match: MatchState, g: GestureTimers, prevBallX: number, prevBallY: number, durationSteps = GK_DIVE_STEPS,
): number {
  const events = match.scratch.events;
  let started = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.kind !== 'gk-catch' || !ev.ok) continue;
    const id = ev.actorId;
    if (id < 0 || id >= g.count || id >= match.players.length) continue;
    const gk = match.players[id];
    let dx = prevBallX - gk.x;
    let dy = prevBallY - gk.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < DIVE_MIN_DIST) {
      dx = gk.facingX;
      dy = gk.facingY;
    } else {
      dx /= len;
      dy /= len;
    }
    gestureBegin(g, id, match.stepCount, durationSteps, dx, dy);
    started++;
  }
  return started;
}
