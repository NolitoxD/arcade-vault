import { clamp, dist, normalizeInto, type Vec2 } from './geometry';
import { centerY, clampToBigArea, goalLineX, type PitchDef, type Side } from './pitch';
import { TEAM_SIZE, type Formation, type Strategy } from './teams';
import type { TeamInput } from './input';
import { ownGoalSide, placeByFormation, type PlayerState } from './players';
import { CONTROL_DIST, givePossession, stickToOwner, type BallState } from './ball';
import { stepsFor, type AttackDirs } from './step';
import type { Rng } from './rng';
import { longPass, shoot, shortPass, type ActionEvent } from './actions';
import type { SetPieceKind } from './referee';

export type PenaltySide = -1 | 0 | 1;

export type SetPieceState = {
  kind: SetPieceKind;
  team: 0 | 1;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  side: PenaltySide;
  stepsLeft: number;
  takerId: number;
};

export const SET_PIECE_COUNTDOWN_SECONDS = 5;
export const SET_PIECE_COUNTDOWN_STEPS = stepsFor(SET_PIECE_COUNTDOWN_SECONDS);
export const SET_PIECE_CLEARANCE = 180;
export const PENALTY_SIDE_OFFSET = 55;
export const FREE_KICK_CHARGE_STEPS = stepsFor(0.4); // shotSpeed(24) = 800
export const PENALTY_CHARGE_STEPS = stepsFor(0.6); // shotSpeed(36) = 850

const scratch: Vec2 = { x: 0, y: 0 };

export function createSetPieceState(): SetPieceState {
  return { kind: 'kickoff', team: 0, x: 0, y: 0, dirX: 1, dirY: 0, side: 0, stepsLeft: 0, takerId: -1 };
}

function rivalSide(team: 0 | 1, attackDir: AttackDirs): Side {
  return attackDir[team] === 1 ? 1 : 0;
}

function nearestOutfield(players: readonly PlayerState[], team: 0 | 1, x: number, y: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.team !== team || p.role === 'gk') continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bestDist) {
      bestDist = d;
      best = p.id;
    }
  }
  return best;
}

// Ruling R9: the taker's own position is clamped into the pitch exactly like
// pushRivalsAway clamps a pushed rival, so a corner/goal-kick at y = 0 (or any
// spot within CONTROL_DIST of an edge) never puts the taker outside the lines.
// The ball itself still lands exactly on (sp.x, sp.y) -- the spec's fixed spot
// for the set piece -- regardless of where the clamp puts the taker's feet.
function placeTaker(sp: SetPieceState, taker: PlayerState, ball: BallState, pitch: PitchDef): void {
  taker.facingX = sp.dirX;
  taker.facingY = sp.dirY;
  taker.x = clamp(sp.x - sp.dirX * CONTROL_DIST, 0, pitch.width);
  taker.y = clamp(sp.y - sp.dirY * CONTROL_DIST, 0, pitch.height);
  taker.vx = 0;
  taker.vy = 0;
  stickToOwner(ball, taker);
  ball.x = sp.x;
  ball.y = sp.y;
}

function pushRivalsAway(sp: SetPieceState, players: PlayerState[], attackDir: AttackDirs, pitch: PitchDef): void {
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team === sp.team) continue;
    const d = dist(sp.x, sp.y, q.x, q.y);
    if (d >= SET_PIECE_CLEARANCE) continue;
    if (!normalizeInto(scratch, q.x - sp.x, q.y - sp.y)) {
      scratch.x = -attackDir[sp.team];
      scratch.y = 0;
    }
    q.x = sp.x + scratch.x * SET_PIECE_CLEARANCE;
    q.y = sp.y + scratch.y * SET_PIECE_CLEARANCE;
    if (q.x < 0) q.x = 0;
    if (q.x > pitch.width) q.x = pitch.width;
    if (q.y < 0) q.y = 0;
    if (q.y > pitch.height) q.y = pitch.height;
    if (q.role === 'gk') clampToBigArea(pitch, ownGoalSide(attackDir[q.team]), q);
  }
}

export function beginSetPiece(
  sp: SetPieceState, kind: SetPieceKind, team: 0 | 1, x: number, y: number,
  players: PlayerState[], ball: BallState,
  formations: readonly [Formation, Formation], strategies: readonly [Strategy, Strategy],
  attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
): void {
  sp.kind = kind;
  sp.team = team;
  sp.x = x;
  sp.y = y;
  sp.side = 0;
  sp.stepsLeft = SET_PIECE_COUNTDOWN_STEPS;
  if (kind === 'kickoff' || kind === 'penalty') {
    placeByFormation(players, 0, formations[0], strategies[0], attackDir[0], pitch);
    placeByFormation(players, 1, formations[1], strategies[1], attackDir[1], pitch);
  } else {
    pushRivalsAway(sp, players, attackDir, pitch);
  }
  if (kind === 'kickoff' || !normalizeInto(scratch, goalLineX(pitch, rivalSide(team, attackDir)) - x, centerY(pitch) - y)) {
    scratch.x = attackDir[team];
    scratch.y = 0;
  }
  sp.dirX = scratch.x;
  sp.dirY = scratch.y;
  sp.takerId = nearestOutfield(players, team, x, y);
  const taker = players[sp.takerId];
  givePossession(ball, taker, stepCount);
  placeTaker(sp, taker, ball, pitch);
}

// The two sides other than `side`, ascending: (-1,0,1) minus side.
function otherSide(side: PenaltySide, pickLower: boolean): PenaltySide {
  if (side === -1) return pickLower ? 0 : 1;
  if (side === 0) return pickLower ? -1 : 1;
  return pickLower ? -1 : 0;
}

function executePenalty(
  sp: SetPieceState, taker: PlayerState, players: PlayerState[], ball: BallState,
  rng: Rng, penaltyReadChance: number, attackDir: AttackDirs, pitch: PitchDef, stepCount: number, aim: Vec2, out: ActionEvent,
): void {
  const side = rivalSide(sp.team, attackDir);
  const targetY = centerY(pitch) + sp.side * PENALTY_SIDE_OFFSET;
  normalizeInto(aim, goalLineX(pitch, side) - ball.x, targetY - ball.y);
  const gk = players[(sp.team === 0 ? 1 : 0) * TEAM_SIZE];
  const guess: PenaltySide = rng() < penaltyReadChance ? sp.side : otherSide(sp.side, rng() < 0.5);
  gk.y = centerY(pitch) + guess * PENALTY_SIDE_OFFSET;
  shoot(taker, ball, aim.x, aim.y, PENALTY_CHARGE_STEPS, stepCount, out);
  if (guess === sp.side) {
    givePossession(ball, gk, stepCount);
    out.ok = false;
  }
}

// Returns true on the step the set piece executes. `input` is the taking team's input.
export function stepSetPiece(
  sp: SetPieceState, input: TeamInput, players: PlayerState[], ball: BallState,
  rng: Rng, penaltyReadChance: number, attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
  aim: Vec2, out: ActionEvent,
): boolean {
  const taker = players[sp.takerId];
  if (sp.kind === 'penalty') {
    if (input.dy !== 0) sp.side = input.dy;
  } else if (normalizeInto(aim, input.dx, input.dy)) {
    sp.dirX = aim.x;
    sp.dirY = aim.y;
    placeTaker(sp, taker, ball, pitch);
  }
  sp.stepsLeft--;
  if (sp.stepsLeft > 0) return false;
  switch (sp.kind) {
    case 'kickoff':
    case 'throw-in':
      shortPass(taker, ball, sp.dirX, sp.dirY, stepCount, out);
      break;
    case 'goal-kick':
    case 'corner':
      longPass(taker, ball, sp.dirX, sp.dirY, stepCount, out);
      break;
    case 'free-kick':
      shoot(taker, ball, sp.dirX, sp.dirY, FREE_KICK_CHARGE_STEPS, stepCount, out);
      break;
    case 'penalty':
      executePenalty(sp, taker, players, ball, rng, penaltyReadChance, attackDir, pitch, stepCount, aim, out);
      break;
  }
  return true;
}
