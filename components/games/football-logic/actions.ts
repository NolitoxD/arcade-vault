import { dist, normalizeInto, INV_SQRT2, type Vec2 } from './geometry';
import { isDown, type TeamInput } from './input';
import { PLAYER_HEIGHT, PLAYER_RADIUS, TACKLE_STEPS, isPlayerDown, isSprinting, type PlayerState } from './players';
import { LONG_PASS_VZ, givePossession, kickBall, type BallState } from './ball';
import { stepsFor } from './step';
import type { Rng } from './rng';

export type ActionKind = 'none' | 'shot' | 'short-pass' | 'long-pass' | 'steal' | 'tackle' | 'gk-release';

export type ActionEvent = {
  kind: ActionKind;
  ok: boolean; // the shot/pass got away, the steal or the tackle won the ball
  foul: boolean; // the slide touched a rival (Task 4 turns it into a free kick or a penalty)
  actorId: number; // -1 if none
  victimId: number; // the rival touched in the foul; -1 if there is none
  x: number;
  y: number; // where (the victim's position in the foul)
};

export function createActionEvent(): ActionEvent {
  return { kind: 'none', ok: false, foul: false, actorId: -1, victimId: -1, x: 0, y: 0 };
}

// Exported again (undoing half of ruling R5, whole-stage review C1): stepOpenPlay
// wipes all 18 slots at the top of every step so "the events of this step" is a
// property by construction. applyButtons/releaseFromGoalkeeper still reset their
// own slot in place before deciding.
export function clearActionEvent(out: ActionEvent): void {
  out.kind = 'none';
  out.ok = false;
  out.foul = false;
  out.actorId = -1;
  out.victimId = -1;
  out.x = 0;
  out.y = 0;
}

function setEvent(out: ActionEvent, kind: ActionKind, ok: boolean, actorId: number): void {
  out.kind = kind;
  out.ok = ok;
  out.foul = false;
  out.actorId = actorId;
  out.victimId = -1;
  out.x = 0;
  out.y = 0;
}

export const SHOT_SPEED_MIN = 700;
export const SHOT_SPEED_MAX = 950;
export const SHOT_CHARGE_SECONDS = 1;
export const SHOT_CHARGE_STEPS = stepsFor(SHOT_CHARGE_SECONDS); // 60
// Stage A addition, not in the spec — review in QA
export const SHOT_VZ_MAX = 200;
export const SHORT_PASS_SPEED = 420;
export const LONG_PASS_SPEED = 560;
export const LONG_PASS_HOLD_SECONDS = 0.25;
export const LONG_PASS_HOLD_STEPS = stepsFor(LONG_PASS_HOLD_SECONDS); // 15
export const STEAL_RANGE = 28;
export const STEAL_CHANCE = 0.65;
// Stage A addition, not in the spec — review in QA
export const STEAL_CHANCE_VS_SPRINT = 0.35;
export const TACKLE_BALL_REACH = 20;
export const TACKLE_FOUL_RADIUS = 2 * PLAYER_RADIUS; // 24
export const TACKLE_MISS_DOWN_SECONDS = 1;
export const TACKLE_MISS_DOWN_STEPS = stepsFor(TACKLE_MISS_DOWN_SECONDS); // 60
export const CONTROL_HYSTERESIS = 40;
export const GK_HOLD_SECONDS = 2;
export const GK_HOLD_STEPS = stepsFor(GK_HOLD_SECONDS); // 120

// 700 -> 950 linear, capped at SHOT_CHARGE_STEPS.
export function shotSpeed(chargeSteps: number): number {
  const t = chargeSteps >= SHOT_CHARGE_STEPS ? 1 : chargeSteps <= 0 ? 0 : chargeSteps / SHOT_CHARGE_STEPS;
  return SHOT_SPEED_MIN + (SHOT_SPEED_MAX - SHOT_SPEED_MIN) * t;
}

export function shoot(p: PlayerState, ball: BallState, dirX: number, dirY: number, chargeSteps: number, stepCount: number, out: ActionEvent): void {
  const t = chargeSteps >= SHOT_CHARGE_STEPS ? 1 : chargeSteps / SHOT_CHARGE_STEPS;
  kickBall(ball, p, dirX, dirY, shotSpeed(chargeSteps), SHOT_VZ_MAX * t, stepCount);
  setEvent(out, 'shot', true, p.id);
}

export function shortPass(p: PlayerState, ball: BallState, dirX: number, dirY: number, stepCount: number, out: ActionEvent): void {
  kickBall(ball, p, dirX, dirY, SHORT_PASS_SPEED, 0, stepCount);
  setEvent(out, 'short-pass', true, p.id);
}

export function longPass(p: PlayerState, ball: BallState, dirX: number, dirY: number, stepCount: number, out: ActionEvent): void {
  kickBall(ball, p, dirX, dirY, LONG_PASS_SPEED, LONG_PASS_VZ, stepCount);
  setEvent(out, 'long-pass', true, p.id);
}

// Rolls the rng ONLY when a steal is actually possible: the number of draws is
// part of the deterministic state, so an impossible steal must not consume one.
export function steal(p: PlayerState, ball: BallState, players: readonly PlayerState[], rng: Rng, stepCount: number, out: ActionEvent): void {
  setEvent(out, 'steal', false, p.id);
  if (ball.owner === null) return;
  const owner = players[ball.owner];
  if (owner.team === p.team || owner.role === 'gk') return;
  if (dist(p.x, p.y, owner.x, owner.y) >= STEAL_RANGE) return;
  out.victimId = owner.id;
  const chance = isSprinting(owner) ? STEAL_CHANCE_VS_SPRINT : STEAL_CHANCE;
  if (rng() < chance) {
    givePossession(ball, p, stepCount);
    out.ok = true;
  }
}

export function startTackle(p: PlayerState, dirX: number, dirY: number, out: ActionEvent): void {
  p.tackleStepsLeft = TACKLE_STEPS;
  p.tackleDirX = dirX;
  p.tackleDirY = dirY;
  p.chargeSteps = 0;
  p.chargeButton = 'none';
  setEvent(out, 'tackle', false, p.id);
}

function ballIsTakeable(ball: BallState, p: PlayerState, players: readonly PlayerState[]): boolean {
  if (ball.z > PLAYER_HEIGHT) return false;
  if (ball.owner === null) return true;
  const owner = players[ball.owner];
  return owner.team !== p.team && owner.role !== 'gk';
}

// Called every step AFTER the slide (stepPlayer) for any player with tackleStepsLeft > 0.
// Ball before body: sliding in from the front steals, sliding in from behind fouls.
export function stepTackle(p: PlayerState, ball: BallState, players: readonly PlayerState[], stepCount: number, out: ActionEvent): void {
  if (p.tackleStepsLeft <= 0) return;
  setEvent(out, 'tackle', false, p.id);
  if (ballIsTakeable(ball, p, players) && dist(p.x, p.y, ball.x, ball.y) < TACKLE_BALL_REACH) {
    givePossession(ball, p, stepCount);
    p.tackleStepsLeft = 0;
    out.ok = true;
    return;
  }
  // Foul rule (R11): touching ANY rival not on the ground counts, not only the owner.
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team === p.team || isPlayerDown(q, stepCount)) continue;
    if (dist(p.x, p.y, q.x, q.y) < TACKLE_FOUL_RADIUS) {
      p.tackleStepsLeft = 0;
      p.downUntilStep = stepCount + TACKLE_MISS_DOWN_STEPS;
      out.foul = true;
      out.victimId = q.id;
      out.x = q.x;
      out.y = q.y;
      return;
    }
  }
  p.tackleStepsLeft--;
  if (p.tackleStepsLeft === 0) p.downUntilStep = stepCount + TACKLE_MISS_DOWN_STEPS;
}

// Spec goalkeeper rule 4, direction only for now: Task 6 aims at the freest teammate.
export function releaseFromGoalkeeper(gk: PlayerState, ball: BallState, attackDir: 1 | -1, stepCount: number, out: ActionEvent): void {
  if (gk.role !== 'gk' || ball.owner !== gk.id) {
    clearActionEvent(out);
    return;
  }
  if (stepCount - ball.ownerSinceStep < GK_HOLD_STEPS) {
    clearActionEvent(out);
    return;
  }
  gk.facingX = attackDir;
  gk.facingY = 0;
  kickBall(ball, gk, attackDir, 0, LONG_PASS_SPEED, LONG_PASS_VZ, stepCount);
  setEvent(out, 'gk-release', true, gk.id);
}

function resetCharge(p: PlayerState): void {
  p.chargeSteps = 0;
  p.chargeButton = 'none';
}

// Aim assist for passes only (ruling R10): scans the passer's outfield teammates
// and locks onto the nearest one (short pass) or farthest one (long pass) inside
// a 45deg cone around (dirX, dirY) -- dot(dir, normalize(mate - p)) >= INV_SQRT2.
// Writes the normalized direction toward the chosen mate into `out` and returns
// true; with no mate in the cone, leaves `out` as (dirX, dirY) and returns false.
// The aim itself carries NO angular error by design: introducing error is the
// AI profile's job in stage B (Task 6), not this deterministic engine layer.
// Ties by lowest id fall out for free: players are iterated in ascending id
// order and a tie does not pass the strict `<`/`>` comparison, so the first
// (lowest id) candidate found at a given best distance is kept.
// (dirX, dirY) must be a unit vector, as in kickBall: the INV_SQRT2 threshold on
// dot(dir, normalize(mate - p)) only means 45deg when |dir| === 1.
export function aimPass(p: PlayerState, players: readonly PlayerState[], dirX: number, dirY: number, farthest: boolean, stepCount: number, out: Vec2): boolean {
  let bestId = -1;
  let bestDist = farthest ? -1 : Infinity;
  let bestDirX = 0;
  let bestDirY = 0;
  for (let i = 0; i < players.length; i++) {
    const mate = players[i];
    if (mate.id === p.id || mate.team !== p.team || mate.role === 'gk') continue;
    if (isPlayerDown(mate, stepCount)) continue;
    const d = dist(p.x, p.y, mate.x, mate.y);
    if (d === 0) continue;
    const ux = (mate.x - p.x) / d;
    const uy = (mate.y - p.y) / d;
    if (ux * dirX + uy * dirY < INV_SQRT2) continue;
    const better = farthest ? d > bestDist : d < bestDist;
    if (!better) continue;
    bestId = mate.id;
    bestDist = d;
    bestDirX = ux;
    bestDirY = uy;
  }
  if (bestId === -1) {
    out.x = dirX;
    out.y = dirY;
    return false;
  }
  out.x = bestDirX;
  out.y = bestDirY;
  return true;
}

// The three buttons with press/hold, for the controlled player of one team.
// `aim` is a scratch Vec2 owned by the caller: d-pad direction if any, else the facing.
export function applyButtons(p: PlayerState, input: TeamInput, ball: BallState, players: readonly PlayerState[], rng: Rng, stepCount: number, aim: Vec2, out: ActionEvent): void {
  clearActionEvent(out);
  if (isPlayerDown(p, stepCount) || p.tackleStepsLeft > 0) {
    resetCharge(p);
    return;
  }
  if (!normalizeInto(aim, input.dx, input.dy)) {
    aim.x = p.facingX;
    aim.y = p.facingY;
  }
  if (ball.owner === p.id) {
    if (isDown(input.a)) {
      if (p.chargeButton !== 'a') {
        p.chargeButton = 'a';
        p.chargeSteps = 0;
      }
      if (p.chargeSteps < SHOT_CHARGE_STEPS) p.chargeSteps++;
      return;
    }
    if (input.a === 'released' && p.chargeButton === 'a') {
      shoot(p, ball, aim.x, aim.y, p.chargeSteps, stepCount, out);
      resetCharge(p);
      return;
    }
    if (isDown(input.b)) {
      if (p.chargeButton !== 'b') {
        p.chargeButton = 'b';
        p.chargeSteps = 0;
      }
      if (p.chargeSteps < SHOT_CHARGE_STEPS) p.chargeSteps++;
      return;
    }
    if (input.b === 'released' && p.chargeButton === 'b') {
      const longOne = p.chargeSteps >= LONG_PASS_HOLD_STEPS;
      aimPass(p, players, aim.x, aim.y, longOne, stepCount, aim);
      if (longOne) longPass(p, ball, aim.x, aim.y, stepCount, out);
      else shortPass(p, ball, aim.x, aim.y, stepCount, out);
      resetCharge(p);
      return;
    }
    return;
  }
  resetCharge(p);
  if (input.a === 'pressed') {
    startTackle(p, aim.x, aim.y, out);
    return;
  }
  if (input.b === 'pressed') steal(p, ball, players, rng, stepCount, out);
}

function isControllable(p: PlayerState, team: 0 | 1): boolean {
  return p.team === team && p.role !== 'gk';
}

function updateTeamControl(players: readonly PlayerState[], ball: BallState, controlled: [number, number], team: 0 | 1): void {
  if (ball.owner !== null && isControllable(players[ball.owner], team)) {
    controlled[team] = ball.owner;
    return;
  }
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!isControllable(p, team)) continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    if (d < bestDist) {
      bestDist = d;
      best = p.id;
    }
  }
  const current = controlled[team];
  const currentValid = current >= 0 && current < players.length && isControllable(players[current], team);
  if (currentValid) {
    const currentDist = dist(players[current].x, players[current].y, ball.x, ball.y);
    if (bestDist > currentDist - CONTROL_HYSTERESIS) return;
  }
  controlled[team] = best;
}

// Derived, never an input (spec): owner if an outfield player of the team has the
// ball; else the nearest outfield player (never the keeper), lowest id on ties,
// with CONTROL_HYSTERESIS so it does not flicker. Writes into `controlled`.
export function updateControlled(players: readonly PlayerState[], ball: BallState, controlled: [number, number]): void {
  updateTeamControl(players, ball, controlled, 0);
  updateTeamControl(players, ball, controlled, 1);
}
