import { STEPS_PER_SECOND, perStep } from '../football-logic/clock';
import { isActive } from '../football-logic/discipline';
import { GOAL_PAUSE_STEPS, type MatchPhase, type MatchState } from '../football-logic/match';
import { PLAYER_SPEED, type PlayerState } from '../football-logic/players';
import { TEAM_SIZE } from '../football-logic/teams';
import { CAPTION_STEPS, type MatchWatch } from './captions';
import { facingOctant, runPose } from './sprite-frame';
import { POSE_DEJECTED, POSE_HUG } from './sprite-maps';

// G15-4 (Paco, v1.5 grill): ONE celebration for every goal, golden goal included -- the
// scoring team runs to the scorer and hugs in a ring, the rivals hang their heads; in the
// shootout only the taker celebrates. Screen only: during the 'goal' pause (and after a
// golden goal, in 'over') the engine moves nobody, so the celebration is a DRAWN position
// that differs from the engine's frozen one. Nothing here writes the match.
//
// Everything is created once (createCelebration) and written in place; the only
// trigonometry is the ring table, at module load (criterion 20, particles.ts's rule).

export const CELEBRATION_STEPS = GOAL_PAUSE_STEPS;                    // 240: the whole 4 s pause
// In the shootout the engine moves the scorer to the centre circle and the next kick to
// the other goal ON THE STEP OF THE GOAL (measured 06-oct, seed 16), so the screen holds
// the camera on the kick for as long as its GOL caption lasts: 1 s (D1, Paco 06-oct;
// captions.ts shortens that caption to match, so camera and caption cut together).
export const SHOOTOUT_HOLD_STEPS = CAPTION_STEPS['shootout-goal'];    // 60: 1 s
// D5 (Paco, "trotando"): the team-mates run at the NORMAL run speed, PLAYER_SPEED per step
// (3 u/step = 180 u/s) -- under RUN_FAST_SPEED_SQ, so runPose shows run frames, not the sprint's.
export const HUG_RUN_SPEED = perStep(PLAYER_SPEED);                   // 3 world units per step
const HUG_RUN_UPS = HUG_RUN_SPEED * STEPS_PER_SECOND;
export const HUG_RING_SLOTS = 10;                                     // ten outfielders at most
export const HUG_RING_INNER_SLOTS = 5;
export const HUG_RING_INNER = 18;                                     // world units from the hub
export const HUG_RING_OUTER = 34;

function ringOffsets(useCos: boolean): Float32Array {
  const out = new Float32Array(HUG_RING_SLOTS);
  for (let k = 0; k < HUG_RING_SLOTS; k++) {
    const inner = k < HUG_RING_INNER_SLOTS;
    const radius = inner ? HUG_RING_INNER : HUG_RING_OUTER;
    const turn = inner
      ? k / HUG_RING_INNER_SLOTS
      : (k - HUG_RING_INNER_SLOTS + 0.5) / (HUG_RING_SLOTS - HUG_RING_INNER_SLOTS);
    const angle = turn * Math.PI * 2;
    out[k] = radius * (useCos ? Math.cos(angle) : Math.sin(angle));
  }
  return out;
}

// Slot k of the ring, relative to the hub: five close round him, five more behind them,
// offset by half a step so the outer five fill the gaps.
export const HUG_RING_X: Float32Array = ringOffsets(true);
export const HUG_RING_Y: Float32Array = ringOffsets(false);

export type CelebrationKind = 'none' | 'goal' | 'shootout';

export type Celebration = {
  kind: CelebrationKind;
  team: 0 | 1;          // the team that scored
  hubId: number;        // the scorer (or, for an own goal, see goalHubId); the taker in the shootout
  step: number;         // steps since the goal
  hubX: number;         // where the hub is drawn (the shootout: where he kicked from)
  hubY: number;
  hubFaceX: number;
  hubFaceY: number;
  camX: number;         // the shootout: where the camera is held
  camY: number;
  slot: Int8Array;      // per player id: his ring slot, -1 = not running
  startX: Float32Array; // per player id: where he stood when the goal went in
  startY: Float32Array;
};

// What the engine destroys on the step of a shootout goal, read BEFORE stepMatchRun.
export type PreStep = {
  ballX: number;
  ballY: number;
  takerId: number;      // shootout.takerId, -1 outside the shootout
  takerX: number;
  takerY: number;
  spotX: number;        // the set piece's spot (the ball when there is none)
  spotY: number;
};

export type CelebrationView = { x: number; y: number; octant: number; pose: number };

export function createCelebration(count = TEAM_SIZE * 2): Celebration {
  return {
    kind: 'none', team: 0, hubId: -1, step: 0, hubX: 0, hubY: 0, hubFaceX: 1, hubFaceY: 0, camX: 0, camY: 0,
    slot: new Int8Array(count).fill(-1), startX: new Float32Array(count), startY: new Float32Array(count),
  };
}

export function createPreStep(): PreStep {
  return { ballX: 0, ballY: 0, takerId: -1, takerX: 0, takerY: 0, spotX: 0, spotY: 0 };
}

export function createCelebrationView(): CelebrationView {
  return { x: 0, y: 0, octant: 0, pose: 0 };
}

// Called by runStep before EVERY stepMatchRun (it also replaces the old prevBallX/Y of the
// keeper's dive, G11-2). Reads the match; writes only `out`.
export function capturePreStep(match: MatchState, out: PreStep): void {
  out.ballX = match.ball.x;
  out.ballY = match.ball.y;
  const sh = match.shootout;
  out.takerId = sh === null ? -1 : sh.takerId;
  const taker = out.takerId >= 0 ? match.players[out.takerId] : null;
  out.takerX = taker === null ? 0 : taker.x;
  out.takerY = taker === null ? 0 : taker.y;
  const sp = match.setPiece;
  out.spotX = sp === null ? match.ball.x : sp.x;
  out.spotY = sp === null ? match.ball.y : sp.y;
}

// A new match on the same screen (startMatch): nothing carries over. No allocation.
export function resetCelebration(c: Celebration): void {
  c.kind = 'none';
  c.step = 0;
  c.hubId = -1;
  c.slot.fill(-1);
}

// Who the ring forms round: the scorer (ball.lastTouchId on the goal step) when he is of the
// scoring team and still on the pitch; otherwise -- an own goal -- the scoring team's
// active outfielder nearest the ball, and its keeper if it has none.
export function goalHubId(match: MatchState, team: 0 | 1): number {
  const id = match.ball.lastTouchId;
  if (id !== null) {
    const scorer = match.players[id];
    if (scorer.team === team && isActive(scorer)) return id;
  }
  let best = team * TEAM_SIZE;
  let bestD = Infinity;
  for (let i = 0; i < match.players.length; i++) {
    const p = match.players[i];
    if (p.team !== team || p.role === 'gk' || !isActive(p)) continue;
    const dx = p.x - match.ball.x;
    const dy = p.y - match.ball.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// On the step of the goal (goalScoredThisStep !== -1), with `w` still the PREVIOUS step's:
// w.phase tells a shootout goal from any other. On an event: a handful of times a match.
export function beginCelebrationForGoal(c: Celebration, match: MatchState, w: MatchWatch, team: 0 | 1, pre: PreStep): void {
  c.team = team;
  c.step = 0;
  c.slot.fill(-1);
  if (w.phase === 'shootout') {
    if (pre.takerId < 0) {
      c.kind = 'none';
      return;
    }
    c.kind = 'shootout';
    c.hubId = pre.takerId;
    c.hubX = pre.takerX;
    c.hubY = pre.takerY;
    // Facing the goal he has just beaten: the spot is in front of it.
    c.hubFaceX = pre.spotX < match.pitch.width / 2 ? -1 : 1;
    c.hubFaceY = 0;
    c.camX = pre.spotX;
    c.camY = pre.spotY;
    return;
  }
  c.kind = 'goal';
  const hub = match.players[goalHubId(match, team)];
  c.hubId = hub.id;
  c.hubX = hub.x;
  c.hubY = hub.y;
  c.hubFaceX = hub.facingX;
  c.hubFaceY = hub.facingY;
  c.camX = hub.x;
  c.camY = hub.y;
  for (let i = 0; i < match.players.length; i++) {
    c.startX[i] = match.players[i].x;
    c.startY[i] = match.players[i].y;
  }
  // Nearest first: slot 0 to the closest team-mate. Ten passes of 22 -- on an event.
  for (let k = 0; k < HUG_RING_SLOTS; k++) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i];
      if (p.team !== team || p.role === 'gk' || p.id === hub.id || !isActive(p) || c.slot[i] !== -1) continue;
      const dx = p.x - hub.x;
      const dy = p.y - hub.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    c.slot[best] = k;
  }
}

// Once per simulated step (runStep) and per captions-only step ('over'). A goal's
// celebration ends with its pause -- the kickoff puts everybody back -- and never outlives
// CELEBRATION_STEPS; a golden goal's plays out in 'over'; the shootout's lasts its hold.
export function stepCelebration(c: Celebration, phase: MatchPhase): void {
  if (c.kind === 'none') return;
  c.step++;
  const limit = c.kind === 'shootout' ? SHOOTOUT_HOLD_STEPS : CELEBRATION_STEPS;
  if (c.step >= limit || (c.kind === 'goal' && phase !== 'goal' && phase !== 'over')) c.kind = 'none';
}

export function celebrationHoldsCamera(c: Celebration): boolean {
  return c.kind === 'shootout';
}

// Where and how `p` is drawn while the celebration lasts. false = draw him as usual.
export function celebrationView(c: Celebration, p: PlayerState, out: CelebrationView): boolean {
  if (c.kind === 'none') return false;
  if (c.kind === 'shootout') {
    if (p.id !== c.hubId) return false;
    out.x = c.hubX;
    out.y = c.hubY;
    out.pose = POSE_HUG;
    out.octant = facingOctant(c.hubFaceX, c.hubFaceY);
    return true;
  }
  if (p.team !== c.team) {
    out.x = p.x;
    out.y = p.y;
    out.pose = POSE_DEJECTED;
    out.octant = facingOctant(p.facingX, p.facingY);
    return true;
  }
  const slot = c.slot[p.id];
  if (slot < 0) {
    // The hub and the scoring team's keeper celebrate where they are.
    out.x = p.x;
    out.y = p.y;
    out.pose = POSE_HUG;
    out.octant = p.id === c.hubId ? facingOctant(c.hubFaceX, c.hubFaceY) : facingOctant(p.facingX, p.facingY);
    return true;
  }
  const sx = c.startX[p.id];
  const sy = c.startY[p.id];
  const tx = c.hubX + HUG_RING_X[slot];
  const ty = c.hubY + HUG_RING_Y[slot];
  const dx = tx - sx;
  const dy = ty - sy;
  const d = Math.sqrt(dx * dx + dy * dy);
  const run = c.step * HUG_RUN_SPEED;
  if (run >= d) {
    out.x = tx;
    out.y = ty;
    out.pose = POSE_HUG;
    out.octant = facingOctant(c.hubX - tx, c.hubY - ty);
    return true;
  }
  const ux = dx / d;
  const uy = dy / d;
  out.x = sx + ux * run;
  out.y = sy + uy * run;
  out.pose = runPose(c.step, p.id, ux * HUG_RUN_UPS, uy * HUG_RUN_UPS);
  out.octant = facingOctant(ux, uy);
  return true;
}
