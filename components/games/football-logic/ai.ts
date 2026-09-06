import { INV_SQRT2, dist, normalizeInto, type Vec2 } from './geometry';
import { centerY, goalLineX, isInsideSmallArea, type PitchDef } from './pitch';
import type { Formation, Strategy, TeamDef } from './teams';
import { toAxis, type Axis, type TeamInput } from './input';
import type { PenaltySide } from './set-pieces';
// Type only: erased at compile time, so ai.ts <- match.ts stays a one-way ESM edge.
import type { MatchState } from './match';
import { HALF_STEPS, perStep, stepsFor } from './step';
import {
  GK_CATCH_RADIUS, GK_LINE_DIST, GK_SPEED, PLAYER_HEIGHT, PLAYER_SPEED, TACKLE_DIST, anchorFor, isPlayerDown,
  ownGoalSide, type PlayerState,
} from './players';
import { givePossession, type BallState } from './ball';
import {
  LONG_PASS_HOLD_STEPS, SHOT_CHARGE_STEPS, SHOT_SPEED_MAX, SHOT_SPEED_MIN, STEAL_RANGE, pickPassTarget,
  type ActionEvent,
} from './actions';
import type { Rng } from './rng';

// -- Spec "Reglas de la IA": every number named, none buried -------------------
export const SHOT_RANGE = 420;
export const SHOT_TAP_DIST = 150;
export const SHOT_LANE_LENGTH = 200;
export const SHOT_LANE_RADIUS = 60;
export const PRESSURE_DIST = 90;
export const PASS_LANE_RADIUS = 50;
export const LONG_PASS_MIN_DIST = 350;
export const SPRINT_FREE_DIST = 150;
export const DRIFT_LONG = 0.3;
export const DRIFT_SHORT = 0.2;
export const SEPARATION_DIST = 60;
export const COVER_DIST = 120;
export const CHASERS: Readonly<Record<Strategy, number>> = { attack: 3, neutral: 2, defend: 1 };
export const CHARGED_SHOT_CATCH_PENALTY = 0.15;
export const STRATEGY_REVIEW_SECONDS = 5;
export const LATE_GAME_SECONDS = 30;
const STRATEGY_REVIEW_STEPS = stepsFor(STRATEGY_REVIEW_SECONDS);
const LATE_GAME_STEPS = stepsFor(LATE_GAME_SECONDS);
// Stage B assumptions S12, S13 and S15, not in the spec -- review in QA (S14, the
// defensive roll in `chase`, is confirmed by owner 2026-09-05, D2; S14b, the
// front-only slide in `chase`, is NOT: assumption, review in QA)
const DODGE_DIST = 150;
const SPRINT_LANE_RADIUS = 60;
const SHOT_POST_MARGIN = 20;
const CHASE_DEAD_ZONE = 4;

// Profile formulas (spec table "Perfil por dificultad (1-8)").
const REACTION_MS_BASE = 650;
const REACTION_MS_PER_LEVEL = 55;
const PASS_ERROR_BASE = 18;
const PASS_ERROR_PER_LEVEL = 2;
const SHOT_ERROR_BASE = 14;
const SHOT_ERROR_PER_LEVEL = 1.5;
const CATCH_BASE = 0.5;
const CATCH_PER_LEVEL = 0.05;
const PENALTY_READ_BASE = 0.5;
const PENALTY_READ_PER_LEVEL = 0.0125;
const TACKLE_BASE = 0.45;
const TACKLE_PER_LEVEL = 0.04;
// Stage B assumption S1, not in the spec — review in QA: the clamp bounds are the
// level-1 and level-8 values of each formula (the spec asks for bounds, gives none).
const REACTION_MS_MIN = 210;
const REACTION_MS_MAX = 595;
const PASS_ERROR_MIN = 2;
const PASS_ERROR_MAX = 16;
const SHOT_ERROR_MIN = 2;
const SHOT_ERROR_MAX = 12.5;
const CATCH_MIN = 0.55;
const CATCH_MAX = 0.9;
const PENALTY_READ_MIN = 0.5125;
const PENALTY_READ_MAX = 0.6;
const TACKLE_MIN = 0.49;
const TACKLE_MAX = 0.77;
// Stage B assumption S2: a small-angle skew (x' = x - e*y, y' = y + e*x, then
// normalise) stands in for a rotation; at 16 deg it is within 0.3 deg of the exact
// one and uses no trigonometry (ruling R12). e = degrees * DEG_TO_SKEW.
const DEG_TO_SKEW = Math.PI / 180;
// tan(22.5 deg) = sqrt(2) - 1: the edge between an axis sector and a diagonal sector.
const TAN_22_5 = Math.SQRT2 - 1;

export type AiProfile = {
  reactionSteps: number;
  passErrorDeg: number;
  shotErrorDeg: number;
  catchChance: number;
  penaltyReadChance: number;
  tackleChance: number;
};

function clampNum(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Pure formulas over the difficulty, as profileFor(def, difficulty) in Vault
// Fighter. `def` is received from day one (spec) and unused in v1: v1.5 attributes
// per selection plug in here. Difficulty never touches speed (criterion 14).
export function profileFor(def: TeamDef, difficulty: number): AiProfile {
  void def;
  const reactionMs = clampNum(REACTION_MS_BASE - difficulty * REACTION_MS_PER_LEVEL, REACTION_MS_MIN, REACTION_MS_MAX);
  return {
    reactionSteps: stepsFor(reactionMs / 1000),
    passErrorDeg: clampNum(PASS_ERROR_BASE - difficulty * PASS_ERROR_PER_LEVEL, PASS_ERROR_MIN, PASS_ERROR_MAX),
    shotErrorDeg: clampNum(SHOT_ERROR_BASE - difficulty * SHOT_ERROR_PER_LEVEL, SHOT_ERROR_MIN, SHOT_ERROR_MAX),
    catchChance: clampNum(CATCH_BASE + difficulty * CATCH_PER_LEVEL, CATCH_MIN, CATCH_MAX),
    penaltyReadChance: clampNum(PENALTY_READ_BASE + difficulty * PENALTY_READ_PER_LEVEL, PENALTY_READ_MIN, PENALTY_READ_MAX),
    tackleChance: clampNum(TACKLE_BASE + difficulty * TACKLE_PER_LEVEL, TACKLE_MIN, TACKLE_MAX),
  };
}

// The human team's profile (ruling R10: no angular error on human kicks). The
// keeper and the penalty read use the same difficulty as the CPU: the ONLY
// difference is the zero kick error. // confirmed by owner 2026-09-05 (D3, S9)
export function humanProfile(def: TeamDef, difficulty: number): AiProfile {
  const p = profileFor(def, difficulty);
  p.passErrorDeg = 0;
  p.shotErrorDeg = 0;
  return p;
}

// Nearest of the eight d-pad directions, by sector: |y| < |x|*tan22.5 -> axis x,
// |x| < |y|*tan22.5 -> axis y, else diagonal. Allocates nothing.
export function quantizeDir(x: number, y: number, out: { dx: Axis; dy: Axis }): void {
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  if (ax === 0 && ay === 0) {
    out.dx = 0;
    out.dy = 0;
    return;
  }
  const sx: Axis = x > 0 ? 1 : x < 0 ? -1 : 0;
  const sy: Axis = y > 0 ? 1 : y < 0 ? -1 : 0;
  if (ay < ax * TAN_22_5) {
    out.dx = sx;
    out.dy = 0;
  } else if (ax < ay * TAN_22_5) {
    out.dx = 0;
    out.dy = sy;
  } else {
    out.dx = sx;
    out.dy = sy;
  }
}

// True when a rival of `team` (not on the floor) lies within `radius` of the
// segment from (fromX, fromY) along the unit (dirX, dirY) for `length` units.
// `team` is the lane's owner (MY team): its own players are never obstacles.
export function laneBlocked(players: readonly PlayerState[], team: 0 | 1, fromX: number, fromY: number, dirX: number, dirY: number, length: number, radius: number, stepCount: number): boolean {
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team === team || isPlayerDown(q, stepCount)) continue;
    const rx = q.x - fromX;
    const ry = q.y - fromY;
    const along = rx * dirX + ry * dirY;
    if (along < 0 || along > length) continue;
    const across = rx * dirY - ry * dirX;
    if ((across < 0 ? -across : across) < radius) return true;
  }
  return false;
}

// Spec: "the angular error is applied to the pass/shot vector with rng() centred
// on zero". One draw per call, error 0 included, so the draw count per kick is
// the same for both teams whatever their profile.
export function applyKickError(ball: BallState, errorDeg: number, rng: Rng): void {
  const e = (rng() * 2 - 1) * errorDeg * DEG_TO_SKEW;
  const vx = ball.vx;
  const vy = ball.vy;
  const nx = vx - e * vy;
  const ny = vy + e * vx;
  const before = vx * vx + vy * vy;
  const after = nx * nx + ny * ny;
  if (after === 0) return;
  const k = Math.sqrt(before / after);
  ball.vx = nx * k;
  ball.vy = ny * k;
}

// want = (target - p) / stepDist, capped to a unit vector: full speed when far,
// exact arrival when within one step (no overshoot, no jitter). No allocation.
function steerTo(p: PlayerState, targetX: number, targetY: number, unitsPerSecond: number): void {
  const stepDist = perStep(unitsPerSecond);
  const dx = (targetX - p.x) / stepDist;
  const dy = (targetY - p.y) / stepDist;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 1) {
    p.wantX = dx;
    p.wantY = dy;
  } else {
    p.wantX = dx / len;
    p.wantY = dy / len;
  }
}

function teamHasBall(players: readonly PlayerState[], ball: BallState, team: 0 | 1): boolean {
  return ball.owner !== null && players[ball.owner].team === team;
}

// Rank of `p` among its team's outfield players by distance to the ball:
// the number of eligible mates strictly nearer, or equally near with a lower id.
function chaseRank(p: PlayerState, players: readonly PlayerState[], ball: BallState, stepCount: number): number {
  const mine = dist(p.x, p.y, ball.x, ball.y);
  let rank = 0;
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team !== p.team || q.role === 'gk' || q.id === p.id || isPlayerDown(q, stepCount)) continue;
    const d = dist(q.x, q.y, ball.x, ball.y);
    if (d < mine || (d === mine && q.id < p.id)) rank++;
  }
  return rank;
}

// Spec "Los compañeros sin balón" 1-4, applied to every outfield player of `team`
// except the controlled one (moved by its TeamInput; -1 = nobody is, D4: while the
// keeper holds the ball the field player is placed here too). Runs inside stepMatch
// for BOTH teams (final-review recommendation 2), so the replay stays seed + inputs.
// Pursuit without possession: the CHASERS[strategy] nearest chase the ball (rank 0
// is the controlled), the next covers, the rest anchor. // confirmed by owner 2026-09-05 (D1, S3)
// `scratch` is the caller's Vec2 for anchorFor.
export function positionTeam(players: PlayerState[], ball: BallState, team: 0 | 1, formation: Formation, strategy: Strategy, attackDir: 1 | -1, controlled: number, pitch: PitchDef, stepCount: number, scratch: Vec2): void {
  const inPossession = teamHasBall(players, ball, team);
  const chasers = CHASERS[strategy];
  const ownGoalX = goalLineX(pitch, ownGoalSide(attackDir));
  const cy = centerY(pitch);
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.team !== team || p.role === 'gk') continue;
    p.wantSprint = false;
    if (p.id === controlled) continue;
    let targetX: number;
    let targetY: number;
    const rank = inPossession ? Infinity : chaseRank(p, players, ball, stepCount);
    if (rank < chasers) {
      // 4. pursuit: the CHASERS nearest run at the ball (rank 0 is the controlled and never gets here)
      targetX = ball.x;
      targetY = ball.y;
    } else if (rank === chasers) {
      // 4. the next one covers COVER_DIST from the ball towards own goal
      if (!normalizeInto(scratch, ownGoalX - ball.x, cy - ball.y)) {
        scratch.x = -attackDir;
        scratch.y = 0;
      }
      targetX = ball.x + scratch.x * COVER_DIST;
      targetY = ball.y + scratch.y * COVER_DIST;
    } else {
      // 1. anchor shifted by the strategy; 2. drift 30 % / 20 % towards the ball
      anchorFor(formation.slots[p.slot], strategy, attackDir, pitch, scratch);
      targetX = scratch.x + DRIFT_LONG * (ball.x - scratch.x);
      targetY = scratch.y + DRIFT_SHORT * (ball.y - scratch.y);
    }
    // 3. separation: mates closer than SEPARATION_DIST push the target away
    for (let j = 0; j < players.length; j++) {
      const q = players[j];
      if (q.team !== team || q.role === 'gk' || q.id === p.id) continue;
      const d = dist(p.x, p.y, q.x, q.y);
      if (d >= SEPARATION_DIST) continue;
      if (d === 0) {
        // Stage B assumption S4: coincident mates split along ±y by id parity
        targetY += (p.id < q.id ? -1 : 1) * SEPARATION_DIST;
        continue;
      }
      const push = SEPARATION_DIST - d;
      targetX += ((p.x - q.x) / d) * push;
      targetY += ((p.y - q.y) / d) * push;
    }
    steerTo(p, targetX, targetY, PLAYER_SPEED);
  }
}

// Spec "El portero" 1 and 4 (movement only; the catch is keeperCatch, the
// release is releaseFromGoalkeeper). Writes gk.want*; never gk.x/y directly.
export function keeperStep(gk: PlayerState, players: readonly PlayerState[], ball: BallState, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
  gk.wantSprint = false;
  if (ball.owner === gk.id) {
    gk.wantX = 0;
    gk.wantY = 0;
    return;
  }
  const side = ownGoalSide(attackDir);
  const goalX = goalLineX(pitch, side);
  const lineX = goalX + attackDir * GK_LINE_DIST;
  const cy = centerY(pitch);
  // 1b. out ONLY inside the small area, for a loose ball nobody of ours is closer to
  if (ball.owner === null && isInsideSmallArea(pitch, side, ball.x, ball.y)) {
    const mine = dist(gk.x, gk.y, ball.x, ball.y);
    let mateCloser = false;
    for (let i = 0; i < players.length && !mateCloser; i++) {
      const q = players[i];
      if (q.team !== gk.team || q.id === gk.id || isPlayerDown(q, stepCount)) continue;
      if (dist(q.x, q.y, ball.x, ball.y) < mine) mateCloser = true;
    }
    if (!mateCloser) {
      steerTo(gk, ball.x, ball.y, GK_SPEED);
      return;
    }
  }
  // 1a. on the line, at the point where the ball->goal-centre line crosses it
  // (assumption S5: parameter clamped to [0, 1], y clamped to the small-area width)
  const denom = goalX - ball.x;
  let t = denom === 0 ? 1 : (lineX - ball.x) / denom;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  let targetY = ball.y + t * (cy - ball.y);
  const half = pitch.smallAreaWidth / 2;
  if (targetY < cy - half) targetY = cy - half;
  if (targetY > cy + half) targetY = cy + half;
  steerTo(gk, lineX, targetY, GK_SPEED);
}

// Spec "El portero" 2 (D4): a moving ball inside GK_CATCH_RADIUS is caught with
// rng() < catchChance - penalty, ONE roll per approach (rolled[team] is reset when
// the ball leaves the radius or gets an owner). A catch is POSSESSION, nothing
// else: givePossession, the same path pickUp takes for a ball at rest, so the
// 2 s hold (ownerSinceStep + GK_HOLD_STEPS), the button release and the automatic
// one are one mechanism; play stays alive, no phase changes. The penalty grows
// linearly with the ball speed from SHOT_SPEED_MIN (0) to SHOT_SPEED_MAX
// (CHARGED_SHOT_CATCH_PENALTY), so passes are never penalised (assumption S7). A
// ball over a line is the referee's (same strict comparisons as pickUp, ruling
// R17); a high ball is not catchable (assumption S10, same rule as the pickup).
// Never its own throw: inside the kick lock the released ball is still within the
// radius (7-9 u per step) and `rolled` was reset while it was held, so without the
// guard the keeper would roll for -- and mostly catch -- its own release, forever
// (pre-flight H4). KICK_LOCK_STEPS (15) carry it 105-140 u out, past the radius.
export function keeperCatch(gk: PlayerState, ball: BallState, catchChance: number, rolled: [boolean, boolean], rng: Rng, pitch: PitchDef, stepCount: number, out: ActionEvent): boolean {
  const moving = ball.vx !== 0 || ball.vy !== 0 || ball.vz !== 0 || ball.z !== 0;
  const inside = ball.x >= 0 && ball.x <= pitch.width && ball.y >= 0 && ball.y <= pitch.height;
  const near = inside && dist(gk.x, gk.y, ball.x, ball.y) < GK_CATCH_RADIUS;
  if (ball.owner !== null || !near) {
    rolled[gk.team] = false;
    return false;
  }
  if (ball.kickerId === gk.id && stepCount < ball.kickLockUntilStep) return false;   // own throw, still locked: no roll, `rolled` stays false
  if (!moving || ball.z > PLAYER_HEIGHT || isPlayerDown(gk, stepCount)) return false;
  if (rolled[gk.team]) return false;
  rolled[gk.team] = true;
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  let charge = (speed - SHOT_SPEED_MIN) / (SHOT_SPEED_MAX - SHOT_SPEED_MIN);
  if (charge < 0) charge = 0;
  if (charge > 1) charge = 1;
  if (rng() >= catchChance - CHARGED_SHOT_CATCH_PENALTY * charge) return false;
  givePossession(ball, gk, stepCount);
  out.kind = 'gk-catch';
  out.ok = true;
  out.foul = false;
  out.actorId = gk.id;
  out.victimId = -1;
  out.x = ball.x;
  out.y = ball.y;
  return true;
}

// ── The CPU decision layer (Task 6b): runs OUTSIDE the step ───────────────────
// decideTeamInput is called once per step by the component (stage C) or the test,
// BEFORE stepMatch, with the CPU team's own rng -- never the match's, so the
// recorded TeamInputs replay through the engine on the match seed alone.

export type AiPlan = 'none' | 'carry' | 'shoot' | 'short-pass' | 'long-pass';

export type AiState = {
  nextDecisionStep: number;      // the reaction gate of the with-ball tree and the defensive action
  nextStrategyStep: number;      // the 5 s scoreboard review
  strategy: Strategy;
  plan: AiPlan;
  planPressed: boolean;          // the button of the plan has been pressed
  planStepsLeft: number;         // holds left before the release
  aimDx: Axis;
  aimDy: Axis;                   // d-pad of the current plan (carry direction or kick direction)
  sprint: boolean;
  penaltyChosen: boolean;
  penaltySide: PenaltySide;
  dir: Vec2;                     // scratch, created once
  quant: { dx: Axis; dy: Axis }; // scratch, created once
};

export function createAiState(): AiState {
  return {
    nextDecisionStep: 0, nextStrategyStep: 0, strategy: 'neutral',
    plan: 'none', planPressed: false, planStepsLeft: 0, aimDx: 0, aimDy: 0, sprint: false,
    penaltyChosen: false, penaltySide: 0,
    dir: { x: 0, y: 0 }, quant: { dx: 0, dy: 0 },
  };
}

// Spec "Cambio de estrategia de la CPU por marcador": losing -> attack; tied in the
// 2nd half with < 30 s -> attack; winning by one with < 30 s -> defend; golden goal -> attack.
export function chooseStrategy(score: readonly [number, number], team: 0 | 1, half: 1 | 2 | 3, halfStep: number): Strategy {
  if (half === 3) return 'attack';
  const mine = score[team];
  const theirs = score[team === 0 ? 1 : 0];
  if (mine < theirs) return 'attack';
  const late = HALF_STEPS - halfStep < LATE_GAME_STEPS;
  if (mine === theirs) return half === 2 && late ? 'attack' : 'neutral';
  return mine - theirs === 1 && late ? 'defend' : 'neutral';
}

// The eight d-pad directions with their unit vectors (data, created once).
const DIRS: readonly { dx: Axis; dy: Axis; ux: number; uy: number }[] = [
  { dx: 1, dy: 0, ux: 1, uy: 0 }, { dx: 1, dy: 1, ux: INV_SQRT2, uy: INV_SQRT2 },
  { dx: 0, dy: 1, ux: 0, uy: 1 }, { dx: -1, dy: 1, ux: -INV_SQRT2, uy: INV_SQRT2 },
  { dx: -1, dy: 0, ux: -1, uy: 0 }, { dx: -1, dy: -1, ux: -INV_SQRT2, uy: -INV_SQRT2 },
  { dx: 0, dy: -1, ux: 0, uy: -1 }, { dx: 1, dy: -1, ux: INV_SQRT2, uy: -INV_SQRT2 },
];

function neutralInput(out: TeamInput): void {
  out.dx = 0;
  out.dy = 0;
  out.a = 'up';
  out.b = 'up';
  out.c = 'up';
}

function nearestRival(players: readonly PlayerState[], team: 0 | 1, x: number, y: number, stepCount: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team === team || isPlayerDown(q, stepCount)) continue;
    const d = dist(x, y, q.x, q.y);
    if (d < bestDist) {
      bestDist = d;
      best = q.id;
    }
  }
  return best;
}

function nearestRivalDist(players: readonly PlayerState[], team: 0 | 1, x: number, y: number, stepCount: number): number {
  const id = nearestRival(players, team, x, y, stepCount);
  return id === -1 ? Infinity : dist(x, y, players[id].x, players[id].y);
}

function startPlan(state: AiState, plan: AiPlan, holds: number, dx: Axis, dy: Axis): void {
  state.plan = plan;
  state.planPressed = false;
  state.planStepsLeft = holds;
  state.aimDx = dx;
  state.aimDy = dy;
  state.sprint = false;
}

// Branch 1: the straight ray, else the diagonal towards the goal centre, if it
// enters between the posts with SHOT_POST_MARGIN and the lane is clear (S15).
function tryShoot(match: MatchState, team: 0 | 1, me: PlayerState, state: AiState): boolean {
  const { players, ball, pitch } = match;
  const attack = match.attackDir[team];
  const goalX = goalLineX(pitch, attack === 1 ? 1 : 0);
  const cy = centerY(pitch);
  const dGoal = dist(me.x, me.y, goalX, cy);
  if (dGoal >= SHOT_RANGE) return false;
  const half = pitch.goalWidth / 2 - SHOT_POST_MARGIN;
  const run = attack === 1 ? goalX - me.x : me.x - goalX;
  const towardsCentre: Axis = cy > me.y ? 1 : cy < me.y ? -1 : 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const dy: Axis = attempt === 0 ? 0 : towardsCentre;
    if (attempt === 1 && dy === 0) return false;
    const yHit = me.y + dy * run;
    const off = yHit - cy;
    if ((off < 0 ? -off : off) >= half) continue;
    const ux = dy === 0 ? attack : attack * INV_SQRT2;
    const uy = dy === 0 ? 0 : dy * INV_SQRT2;
    if (laneBlocked(players, team, ball.x, ball.y, ux, uy, SHOT_LANE_LENGTH, SHOT_LANE_RADIUS, match.stepCount)) continue;
    let t = (dGoal - SHOT_TAP_DIST) / (SHOT_RANGE - SHOT_TAP_DIST);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    let charge = Math.round(SHOT_CHARGE_STEPS * t);
    if (charge < 1) charge = 1;
    startPlan(state, 'shoot', charge, attack, dy);
    return true;
  }
  return false;
}

// Branch 2: the best (advance + freedom) mate the engine's own aim assist would
// lock onto for each d-pad direction and length, with a clear lane, more advanced
// or freer than me. Returns true when a pass plan started.
function tryPass(match: MatchState, team: 0 | 1, me: PlayerState, state: AiState, myFreedom: number): boolean {
  const { players, ball } = match;
  const attack = match.attackDir[team];
  let bestScore = -Infinity;
  let bestDir = -1;
  let bestLong = false;
  for (let d = 0; d < DIRS.length; d++) {
    const dir = DIRS[d];
    for (let l = 0; l < 2; l++) {
      const long = l === 1;
      const id = pickPassTarget(me, players, dir.ux, dir.uy, long, match.stepCount);
      if (id === -1) continue;
      const mate = players[id];
      const dm = dist(me.x, me.y, mate.x, mate.y);
      if (long ? dm < LONG_PASS_MIN_DIST : dm >= LONG_PASS_MIN_DIST) continue;
      if (!normalizeInto(state.dir, mate.x - ball.x, mate.y - ball.y)) continue;
      if (laneBlocked(players, team, ball.x, ball.y, state.dir.x, state.dir.y, dm, PASS_LANE_RADIUS, match.stepCount)) continue;
      const advance = (mate.x - me.x) * attack;
      const freedom = nearestRivalDist(players, team, mate.x, mate.y, match.stepCount);
      if (advance <= 0 && freedom <= myFreedom) continue;
      const score = advance + freedom;
      if (score > bestScore) {   // strict: ties keep the lowest DIRS index (a mate on an axis also sits on the edge of two diagonal cones)
        bestScore = score;
        bestDir = d;
        bestLong = long;
      }
    }
  }
  if (bestDir === -1) return false;
  startPlan(state, bestLong ? 'long-pass' : 'short-pass', bestLong ? LONG_PASS_HOLD_STEPS : 1, DIRS[bestDir].dx, DIRS[bestDir].dy);
  return true;
}

function dirIndex(dx: Axis, dy: Axis): number {
  for (let i = 0; i < DIRS.length; i++) if (DIRS[i].dx === dx && DIRS[i].dy === dy) return i;
  return 0;
}

// Branch 3 (and 2b): carry towards the goal centre, dodging the nearest rival.
function carry(match: MatchState, team: 0 | 1, me: PlayerState, state: AiState, rivalId: number, rivalDist: number, fullDodge: boolean): void {
  const { players, pitch } = match;
  const attack = match.attackDir[team];
  const goalX = goalLineX(pitch, attack === 1 ? 1 : 0);
  const cy = centerY(pitch);
  normalizeInto(state.dir, goalX - me.x, cy - me.y);
  let vx = state.dir.x;
  let vy = state.dir.y;
  if (rivalId !== -1 && rivalDist < DODGE_DIST) {
    const q = players[rivalId];
    if (normalizeInto(state.dir, q.x - me.x, q.y - me.y)) {
      const w = fullDodge ? 1 : 1 - rivalDist / DODGE_DIST;
      vx -= state.dir.x * w;
      vy -= state.dir.y * w;
    }
  }
  quantizeDir(vx, vy, state.quant);
  if (state.quant.dx === 0 && state.quant.dy === 0) {
    state.quant.dx = attack;
  }
  startPlan(state, 'carry', 0, state.quant.dx, state.quant.dy);
  const d = DIRS[dirIndex(state.quant.dx, state.quant.dy)];
  state.sprint = !laneBlocked(players, team, me.x, me.y, d.ux, d.uy, SPRINT_FREE_DIST, SPRINT_LANE_RADIUS, match.stepCount);
}

function decideWithBall(match: MatchState, team: 0 | 1, me: PlayerState, state: AiState): void {
  const rivalId = nearestRival(match.players, team, me.x, me.y, match.stepCount);
  const rivalDist = rivalId === -1 ? Infinity : dist(me.x, me.y, match.players[rivalId].x, match.players[rivalId].y);
  if (tryShoot(match, team, me, state)) return;
  if (rivalDist < PRESSURE_DIST) {
    if (tryPass(match, team, me, state, rivalDist)) return;
    carry(match, team, me, state, rivalId, rivalDist, true);
    return;
  }
  carry(match, team, me, state, rivalId, rivalDist, false);
}

// Turns the plan into this step's buttons: pressed -> held x planStepsLeft -> released.
function executePlan(state: AiState, stepCount: number, out: TeamInput): void {
  out.dx = state.aimDx;
  out.dy = state.aimDy;
  if (state.plan === 'carry') {
    out.c = state.sprint ? 'held' : 'up';
    return;
  }
  const button = state.plan === 'shoot' ? 'a' : 'b';
  if (!state.planPressed) {
    state.planPressed = true;
    state.planStepsLeft--;
    out[button] = 'pressed';
    return;
  }
  if (state.planStepsLeft > 0) {
    state.planStepsLeft--;
    out[button] = 'held';
    return;
  }
  out[button] = 'released';
  state.plan = 'none';
  state.nextDecisionStep = stepCount + 1;
}

function chase(match: MatchState, team: 0 | 1, me: PlayerState, profile: AiProfile, state: AiState, rng: Rng, out: TeamInput): void {
  const { players, ball } = match;
  out.dx = toAxis(ball.x - me.x, CHASE_DEAD_ZONE);
  out.dy = toAxis(ball.y - me.y, CHASE_DEAD_ZONE);
  const d = dist(me.x, me.y, ball.x, ball.y);
  out.c = d > SPRINT_FREE_DIST ? 'held' : 'up';
  if (match.stepCount < state.nextDecisionStep) return;
  state.nextDecisionStep = match.stepCount + profile.reactionSteps;
  if (ball.owner === null) return;
  const owner = players[ball.owner];
  if (owner.team === team || owner.role === 'gk') return;
  const dO = dist(me.x, me.y, owner.x, owner.y);
  if (dO < STEAL_RANGE) {
    out.b = 'pressed';
    return;
  }
  if (dO >= TACKLE_DIST) return;
  // Stage B assumption S14b, not in the spec -- review in QA: slide only from the FRONT
  // (a slide from behind is a foul by construction). D2 fixes the willingness, not this.
  const inFront = (me.x - owner.x) * owner.facingX + (me.y - owner.y) * owner.facingY > 0;
  if (!inFront) return;
  // tackleChance is the WILLINGNESS to slide at reach on each reaction tick; the
  // outcome stays geometric (stepTackle) and steals keep STEAL_CHANCE for both
  // teams. // confirmed by owner 2026-09-05 (D2, S14)
  if (rng() < profile.tackleChance) out.a = 'pressed';
}

// Called ONCE PER STEP by the component (stage C) or the test, BEFORE stepMatch,
// with the CPU team's own rng (never the match's). Writes a TeamInput valid by
// construction. Allocates nothing: state.dir and state.quant are the two scratch
// objects created once in createAiState.
export function decideTeamInput(match: MatchState, team: 0 | 1, profile: AiProfile, state: AiState, rng: Rng, out: TeamInput): void {
  neutralInput(out);
  out.formation = match.formationIndex[team];   // S18: the CPU never changes formation
  if (match.stepCount >= state.nextStrategyStep) {
    state.strategy = chooseStrategy(match.score, team, match.half, match.halfStep);
    state.nextStrategyStep = match.stepCount + STRATEGY_REVIEW_STEPS;
  }
  out.strategy = state.strategy;
  const phase = match.phase;
  if (phase === 'kickoff' || phase === 'set-piece') {
    state.plan = 'none';
    const sp = match.setPiece;
    if (sp !== null && sp.kind === 'penalty' && sp.team === team) {
      // Stage B assumption S11, not in the spec -- review in QA: uniform over the
      // three sides, ONE draw per penalty, kept through the whole countdown.
      if (!state.penaltyChosen) {
        state.penaltyChosen = true;
        const r = rng();
        state.penaltySide = r < 1 / 3 ? -1 : r < 2 / 3 ? 0 : 1;
      }
      out.dy = state.penaltySide;
    }
    return;
  }
  state.penaltyChosen = false;
  if (phase !== 'play' && phase !== 'golden-goal') {
    state.plan = 'none';
    return;
  }
  const { players, ball } = match;
  const me = players[match.controlled[team]];
  if (isPlayerDown(me, match.stepCount) || me.tackleStepsLeft > 0) {
    state.plan = 'none';
    return;
  }
  if (ball.owner === me.id) {
    // S16: winning the ball decides on the spot (plan 'none'); a carry is re-read at the gate.
    if (state.plan === 'none' || (state.plan === 'carry' && match.stepCount >= state.nextDecisionStep)) {
      decideWithBall(match, team, me, state);
      state.nextDecisionStep = match.stepCount + profile.reactionSteps;
    }
    executePlan(state, match.stepCount, out);
    return;
  }
  state.plan = 'none';
  if (ball.owner !== null && players[ball.owner].team === team) {
    // A same-team owner that is not `me` can only be our keeper (updateControlled
    // hands the cursor to any outfield owner). D4: the engine routes this TeamInput
    // to the keeper's throw; the CPU never presses, so neutral input = the
    // automatic release at GK_HOLD_STEPS, and positionTeam places the field
    // controlled meanwhile. // confirmed by owner 2026-09-05 (D4, S17)
    return;
  }
  chase(match, team, me, profile, state, rng, out);
}
