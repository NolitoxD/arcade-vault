import { dist } from './geometry';
import type { PitchDef } from './pitch';
import { PLAYER_HEIGHT, isPlayerDown, type PlayerState } from './players';
import { perStep, stepsFor } from './clock';

export type BallState = {
  x: number;
  y: number;
  z: number; // height, for the long pass over heads
  vx: number;
  vy: number;
  vz: number;
  owner: number | null; // id of the player carrying it glued to the foot
  ownerSinceStep: number;
  lastTouchTeam: 0 | 1 | null;
  lastTouchId: number | null;
  kickerId: number | null;
  kickLockUntilStep: number;
};

export const GRAVITY = 900;
export const BALL_GROUND_DECEL = 260;
export const BALL_BOUNCE = 0.5;
export const BALL_REST_VZ = 30;
export const CONTROL_DIST = 18;
export const POSSESSION_RADIUS = 22;
export const KICK_LOCK_SECONDS = 0.25;
export const KICK_LOCK_STEPS = stepsFor(KICK_LOCK_SECONDS);
// With GRAVITY 900 the flight lasts 2 * 280 / 900 = 0.62 s: at 560 u/s that is ~348 u (spec: "cae a ~350 u"),
// with an apex of 280² / 1800 = 43.6 u, above PLAYER_HEIGHT.
export const LONG_PASS_VZ = 280;

export function createBall(): BallState {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    owner: null, ownerSinceStep: 0,
    lastTouchTeam: null, lastTouchId: null,
    kickerId: null, kickLockUntilStep: 0,
  };
}

export function givePossession(ball: BallState, p: PlayerState, stepCount: number): void {
  ball.owner = p.id;
  ball.ownerSinceStep = stepCount;
  ball.lastTouchTeam = p.team;
  ball.lastTouchId = p.id;
  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;
  ball.z = 0;
  stickToOwner(ball, p);
}

export function stickToOwner(ball: BallState, owner: PlayerState): void {
  ball.x = owner.x + owner.facingX * CONTROL_DIST;
  ball.y = owner.y + owner.facingY * CONTROL_DIST;
  ball.z = 0;
}

// (dirX, dirY) must be a unit vector. Releases the owner and locks the kicker so
// it does not pick its own pass back up next step.
export function kickBall(ball: BallState, kicker: PlayerState, dirX: number, dirY: number, speed: number, vz: number, stepCount: number): void {
  ball.owner = null;
  ball.vx = dirX * speed;
  ball.vy = dirY * speed;
  ball.vz = vz;
  ball.lastTouchTeam = kicker.team;
  ball.lastTouchId = kicker.id;
  ball.kickerId = kicker.id;
  ball.kickLockUntilStep = stepCount + KICK_LOCK_STEPS;
}

export function canPickUp(ball: BallState, p: PlayerState, stepCount: number): boolean {
  if (isPlayerDown(p, stepCount)) return false;
  if (p.tackleStepsLeft > 0) return false;
  if (ball.kickerId === p.id && stepCount < ball.kickLockUntilStep) return false;
  return true;
}

function flyAndRoll(ball: BallState): void {
  if (ball.z > 0 || ball.vz > 0) {
    ball.vz -= perStep(GRAVITY);
    ball.z += perStep(ball.vz);
    if (ball.z <= 0) {
      ball.z = 0;
      ball.vz = -ball.vz * BALL_BOUNCE;
      if (ball.vz < BALL_REST_VZ) ball.vz = 0;
    }
  }
  ball.x += perStep(ball.vx);
  ball.y += perStep(ball.vy);
  if (ball.z === 0) {
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 0) {
      const next = speed - perStep(BALL_GROUND_DECEL);
      if (next <= 0) {
        ball.vx = 0;
        ball.vy = 0;
      } else {
        const k = next / speed;
        ball.vx *= k;
        ball.vy *= k;
      }
    }
  }
}

// Nearest eligible player inside POSSESSION_RADIUS takes a free, low ball.
// Ascending ids with a strict `<` make the lowest id win every tie.
function pickUp(ball: BallState, players: readonly PlayerState[], stepCount: number, pitch: PitchDef): void {
  // Whole-stage review C2: the referee has the last word on a ball that already
  // left the field. stepPhysics runs before judgeBall, so without this guard a
  // player standing on a line (or a keeper on his) picked the ball up and
  // stickToOwner teleported it back inside, cancelling a goal or a throw-in.
  // Same strict comparisons judgeBall uses, so no grey zone appears on the line.
  if (ball.x < 0 || ball.x > pitch.width || ball.y < 0 || ball.y > pitch.height) return;
  if (ball.z > PLAYER_HEIGHT) return;
  let best: PlayerState | null = null;
  let bestDist = POSSESSION_RADIUS;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!canPickUp(ball, p, stepCount)) continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (best !== null) givePossession(ball, best, stepCount);
}

export function stepBall(ball: BallState, players: readonly PlayerState[], stepCount: number, pitch: PitchDef): void {
  if (ball.owner !== null) {
    stickToOwner(ball, players[ball.owner]);
    return;
  }
  flyAndRoll(ball);
  pickUp(ball, players, stepCount, pitch);
}
