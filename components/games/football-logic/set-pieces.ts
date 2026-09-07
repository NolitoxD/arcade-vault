import { clamp, dist, normalizeInto, type Vec2 } from './geometry';
import { centerY, clampToBigArea, goalLineX, penaltySpotX, type PitchDef, type Side } from './pitch';
import { OUTFIELD, TEAM_SIZE, type Formation, type Strategy } from './teams';
import type { TeamInput } from './input';
import { ownGoalSide, placeAroundCentreSpot, placeByFormation, type PlayerState } from './players';
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

// exported for Task 8: the HUD counts the set piece down in seconds, not in steps
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

// Returns -1 only if the team has no outfield player: unreachable while TEAM_SIZE
// is 9 and rosters are fixed (stage B decision); v1.5 substitutions/sendings-off
// must keep at least one outfield player or guard beginSetPiece before indexing.
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

// ── The shootout (stage B2, S-PK1..S-PK6) ────────────────────────────────────
//
// The state lives here, not in match.ts, because every kick IS the penalty set
// piece above (S-PK1) and because beginShootoutKick (Task 7b-2) needs placeTaker,
// which is private to this file. match.ts re-exports the type, so MatchState reads
// `shootout: ShootoutState | null` exactly as the spec's data model writes it.

export const SHOOTOUT_ROUNDS = 5;
// exported for Task 8: the HUD counts the resolution down in seconds, not in steps
export const SHOOTOUT_RESOLVE_SECONDS = 4;
export const SHOOTOUT_RESOLVE_STEPS = stepsFor(SHOOTOUT_RESOLVE_SECONDS);

export type ShootoutState = {
  taken: [number, number];        // kicks already taken by each team
  scored: [number, number];       // the shootout's own scoreboard -- never added to match.score
  team: 0 | 1;                    // whose turn it is
  takerId: number;                // this turn's outfield taker
  suddenDeath: boolean;           // false through the first five of each team
  resolveStepsLeft: number;       // countdown after the kick (S-PK2); 0 while it is still to be taken
};

export function createShootoutState(): ShootoutState {
  return { taken: [0, 0], scored: [0, 0], team: 0, takerId: -1, suddenDeath: false, resolveStepsLeft: 0 };
}

// In place: the object is created once per match (match.scratch.shootout) and the
// step never allocates.
export function resetShootout(sh: ShootoutState): void {
  sh.taken[0] = 0;
  sh.taken[1] = 0;
  sh.scored[0] = 0;
  sh.scored[1] = 0;
  sh.team = 0;                    // S-PK3: team 0 kicks first
  sh.takerId = -1;
  sh.suddenDeath = false;
  sh.resolveStepsLeft = 0;
}

// Kicks `team` still has coming. Inside the five it is what is left of the five;
// in sudden death it is the kick of the current round it still owes (the rounds
// alternate, so the trailing team always owes exactly one).
function kicksLeft(taken: readonly [number, number], team: 0 | 1): number {
  const regulation = SHOOTOUT_ROUNDS - taken[team];
  const round = taken[team === 0 ? 1 : 0] - taken[team];
  const most = regulation > round ? regulation : round;
  return most > 0 ? most : 0;
}

// The whole of S-PK5 in one pure function of the counters, so the phase machine and
// the HUD read the same rule. Stage B2 assumption S-PK12, not in the spec -- review in
// QA: this scoreboard is the shootout's own and is never added to match.score, so
// winnerOf (match.ts) is the single reader that turns it into the winner of the match.
// The rule itself: the shootout is cut as soon as it is mathematically
// impossible to catch up, and in sudden death the first team to miss loses.
export function shootoutWinner(sh: ShootoutState): 0 | 1 | -1 {
  if (sh.scored[0] > sh.scored[1] + kicksLeft(sh.taken, 1)) return 0;
  if (sh.scored[1] > sh.scored[0] + kicksLeft(sh.taken, 0)) return 1;
  // S-PK5, literally "the first to miss loses": level on goals, with one team one
  // kick ahead of the other, can only mean that extra kick missed -- had it scored,
  // the scores would differ. So the rival wins there and then, without taking its
  // own kick of the round. The `scored[0] === scored[1]` guard is what makes this
  // clause fire ONLY on a miss: without it, a kick that is SCORED while the taker
  // is a kick ahead (e.g. [6,5]/[6,5], team 1 still owes its sixth) would also
  // match `taken[0] !== taken[1]` and hand the match to the team that just scored
  // (Stage B2 finding H1). With the guard, this clause and the two cut clauses
  // above are mutually exclusive -- the cuts need an UNEVEN scoreboard, this one
  // needs an EVEN one -- so the order they are checked in stops mattering.
  if (sh.scored[0] === sh.scored[1] && sh.taken[0] >= SHOOTOUT_ROUNDS && sh.taken[1] >= SHOOTOUT_ROUNDS && sh.taken[0] !== sh.taken[1]) {
    return sh.taken[0] > sh.taken[1] ? 1 : 0;
  }
  return -1;
}

// S-PK3: team 0 opens (resetShootout) and they alternate; each team's takers go by
// ascending id without repeating until its eight outfield players are used up, and
// then it starts again. players[i].id === i and id `team * TEAM_SIZE` is the keeper,
// so the outfield ids of a team are team * TEAM_SIZE + 1 .. + OUTFIELD.
export function shootoutTakerId(team: 0 | 1, taken: number): number {
  return team * TEAM_SIZE + 1 + (taken % OUTFIELD);
}

// S-PK1: every kick IS the penalty set piece -- same countdown, same d-pad side, same
// keeper read, same automatic execution. Three things are laid on top of it: the taker
// is the one S-PK3 names instead of the nearest player, the rest are parked around the
// centre spot (S-PK4/S-PK7), and the resolution countdown starts at zero because the
// kick is still to be taken.
// Stage B2 assumption S-PK8, not in the spec -- review in QA: the spot is the one in
// front of the goal the kicking team attacks, so the two goals alternate through the
// shootout. executePenalty derives its target from attackDir, and there is no notion
// in the engine of "both teams shoot at one goal".
// Stage B2 assumption S-PK10, not in the spec -- review in QA: finding H7 -- S-PK10
// clears a leftover slide, tackle or charge on the fifteen parked outfield players, but
// the two goalkeepers never go through placeAroundCentreSpot -- and placeByFormation,
// the only thing beginSetPiece does to them, resets vx/vy/want*/facing but not
// downUntilStep/tackleStepsLeft/chargeSteps
// (players.ts, placeByFormation). A keeper whose extra time ended mid-slide would
// otherwise stay frozen in that pose for the whole shootout -- the same artefact
// S-PK10 already fixes for the outfield fifteen. Harmless today (executePenalty
// teleports the keeper by `gk.y` directly, without going through the physics that read
// these fields), but the same reasoning that put the fix on the fifteen puts it here.
export function beginShootoutKick(
  sp: SetPieceState, sh: ShootoutState, players: PlayerState[], ball: BallState,
  formations: readonly [Formation, Formation], strategies: readonly [Strategy, Strategy],
  attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
): void {
  const defending: 0 | 1 = sh.team === 0 ? 1 : 0;
  const side = ownGoalSide(attackDir[defending]);
  beginSetPiece(sp, 'penalty', sh.team, penaltySpotX(pitch, side), centerY(pitch), players, ball, formations, strategies, attackDir, pitch, stepCount);
  sh.takerId = shootoutTakerId(sh.team, sh.taken[sh.team]);
  sh.resolveStepsLeft = 0;
  sp.takerId = sh.takerId;
  placeAroundCentreSpot(players, sh.takerId, pitch);
  // S-PK10, extended to the keepers (H7): same three fields as placeAroundCentreSpot,
  // on the two players it does not touch.
  for (const gk of [players[sh.team * TEAM_SIZE], players[defending * TEAM_SIZE]]) {
    gk.tackleStepsLeft = 0;
    gk.downUntilStep = 0;
    gk.chargeSteps = 0;
    gk.chargeButton = 'none';
  }
  const taker = players[sh.takerId];
  givePossession(ball, taker, stepCount);
  placeTaker(sp, taker, ball, pitch);
}
