import { dist } from './geometry';
import { SQUAD_SIZE, squadRole } from './squads';
// From clock.ts, not step.ts: ball.ts imports this file (isActive in canPickUp), and
// step.ts imports ball.ts -- clock.ts imports nothing, so no cycle can form.
import { stepsFor } from './clock';
import { TEAM_SIZE, type Role } from './teams';
import { applySquadAttrs, type PlayerState } from './players';
// Type only: erased at compile time, so discipline.ts <- match.ts stays a one-way ESM
// edge (the same shape as ai.ts <- match.ts).
import type { MatchState } from './match';

// G15-18 (v1.5, V15-4): only a foul that the referee actually gives can injure, only
// the player who RECEIVED it, at most one per team per match, and by the match seed --
// so the roll is part of the deterministic state.
export const INJURY_CHANCE = 0.08;
export const INJURY_MAX_PER_TEAM = 1;
// Paco 24-sep (resolution 9): the LESIONADO window has a way out. Eight seconds and the
// reserve of that position comes on by itself, so a disconnected pad or a trip to the
// kitchen never leaves the match frozen.
export const INJURY_WINDOW_STEPS = stepsFor(8);

// THE one definition of "this player is on the pitch": not sent off (G15-13) and not
// injured (G15-18). Every loop in football-logic/ that walks `players` and filters by
// team uses it -- control (actions.ts isControllable, so updateTeamControl and
// nextManualControl), steal, the contact of a slide (stepTackle), the pass assist
// (pickPassTarget), the keeper's throw (freestMateDir), the positioning AI (positionTeam
// and its separation, chaseRank, mateCloserToBall, laneBlocked, nearestRival), the
// pickup (ball.ts canPickUp) and the set-piece taker (set-pieces.ts nearestOutfield and
// pushRivalsAway). Checked with
//   grep -rn "team !== \|\.team === " components/games/football-logic/*.ts | grep -v isActive
// whose every remaining production hit is in this list of DOCUMENTED EXCEPTIONS:
//  · loops that deliberately see EVERYBODY: invariants.ts checkGoalkeepersInBox (and
//    checkTeamCount, which counts the ones who left), firstFreeReserveOfRole and
//    match.ts substitute (a sent-off or injured player still holds his squad index),
//    sentOffCount (it counts the inactive), players.ts placeByFormation (everybody gets
//    a spot; an inactive player simply never moves from it -- standDown);
//  · hits that are not a loop over the players: the ball owner's team (ai.ts
//    teamHasBall, chase, decideTeamInput; actions.ts steal's owner and ballIsTakeable;
//    match.ts ownSideHasBall, dropFrozenPickup) -- an inactive player never owns the
//    ball, because nothing above gives it to him -- and team arithmetic (match.ts
//    runTeamAi's frozenTeam, the shootout's sh.team/sp.team, set-pieces.ts
//    executePenalty and beginShootoutKick, ai.ts's penalty side).
//  · set-pieces.ts shootoutTakerId is pure arithmetic and CAN name a sent-off player:
//    on purpose, G15-13 "no afectan a la tanda" -- the eleven take their kicks.
export function isActive(p: PlayerState): boolean {
  return !p.sentOff && !p.injured;
}

// A player who has just left the game (sent off, or injured with nobody to replace
// him) stops where he is: positionTeam no longer writes his want channel, so without
// this he would keep walking on the last want it gave him. A slide in progress ends.
export function standDown(p: PlayerState): void {
  p.wantX = 0;
  p.wantY = 0;
  p.wantSprint = false;
  p.vx = 0;
  p.vy = 0;
  p.tackleStepsLeft = 0;
}

// Controller addition 1 (01-oct): a player who has left the pitch -- substituted after
// an injury, or sent off -- never comes back. match.leftPitch[team] is a bitmask of the
// squad indices that have left (SQUAD_SIZE 18 fits in a 32-bit int); it is only ever
// OR-ed, never cleared, inside one match.
export function hasLeftPitch(match: MatchState, team: 0 | 1, squadIndex: number): boolean {
  return (match.leftPitch[team] & (1 << squadIndex)) !== 0;
}

function markLeftPitch(match: MatchState, team: 0 | 1, squadIndex: number): void {
  match.leftPitch[team] |= 1 << squadIndex;
}

// H6: the cap lives in the MATCH, not in the player. `injured` is cleared by the
// substitution (the reserve takes the same slot), so counting injured players would
// reset the cap to zero on every substitution and let a team be injured for ever.
// `injuriesUsed` is incremented where the injury is decided and NEVER decremented.
//
// The draw does NOT depend on whether a reserve exists: an injury is a possible outcome
// either way (an outfield player leaves, a keeper without a replacement is flagged and
// keeps playing), so the NUMBER of draws stays the same and the replay is safe.
export function canInjure(match: MatchState, victim: PlayerState): boolean {
  if (match.injuriesUsed[victim.team] >= INJURY_MAX_PER_TEAM) return false;
  if (match.pendingInjury[victim.team] >= 0) return false;
  return isActive(victim);
}

// The lowest squad index of that role that is not on the pitch and has not LEFT it
// (controller addition 1), or -1. Costs SQUAD_SIZE * players.length comparisons and runs
// only on the steps the phase is 'injury' or a keeper is sent off: never in the hot path.
export function firstFreeReserveOfRole(match: MatchState, team: 0 | 1, role: Role): number {
  for (let i = 0; i < SQUAD_SIZE; i++) {
    if (squadRole(i) !== role || hasLeftPitch(match, team, i)) continue;
    let onPitch = false;
    for (let k = 0; k < match.players.length; k++) {
      const p = match.players[k];
      if (p.team === team && p.squadIndex === i) {
        onPitch = true;
        break;
      }
    }
    if (!onPitch) return i;
  }
  return -1;
}

// G15-18 lets the HUMAN pick "cualquier posicion", so for an outfield player any free
// outfield reserve counts; for a keeper, only another keeper (resolutions 6 and 7).
export function hasSubstituteFor(match: MatchState, team: 0 | 1, out: PlayerState): boolean {
  if (out.role === 'gk') return firstFreeReserveOfRole(match, team, 'gk') >= 0;
  return firstFreeReserveOfRole(match, team, 'def') >= 0
    || firstFreeReserveOfRole(match, team, 'mid') >= 0
    || firstFreeReserveOfRole(match, team, 'fwd') >= 0;
}

// G15-18 + controller additions 1 and 2: the reserve `squadIndex` takes the slot of
// `out`. The one place a squad index enters the pitch, for an injury (match.ts
// substitute) and for a sent-off keeper (sendOffKeeper). The index that leaves is
// recorded for good; the one that comes on starts clean -- not injured, no fouls, no
// card -- because he is a different footballer, who has not fouled anybody.
export function bringOn(match: MatchState, out: PlayerState, squadIndex: number): void {
  markLeftPitch(match, out.team, out.squadIndex);
  out.squadIndex = squadIndex;
  out.injured = false;
  out.fouls = 0;
  out.card = 'none';
  out.sentOff = false;
  applySquadAttrs(out, match.teams[out.team].id);
}

// G15-13 (v1.5, V15-4): cards are DETERMINISTIC -- a function of how many fouls that
// player has made in this match, with no Rng anywhere. Yellow on the second, red on the
// fourth (which G15-13 describes as "the second yellow"), and a team never loses more
// than SENT_OFF_MAX players: a third red is a caption and nothing else, so a match can
// never fizzle out into five against eleven.
export type Card = 'none' | 'yellow' | 'red';

export const CARD_YELLOW_AT = 2;
export const CARD_RED_AT = 4;
export const SENT_OFF_MAX = 2;

export function cardForFouls(fouls: number): Card {
  if (fouls === CARD_YELLOW_AT) return 'yellow';
  if (fouls === CARD_RED_AT) return 'red';
  return 'none';
}

export function sentOffCount(players: readonly PlayerState[], team: 0 | 1): number {
  let n = 0;
  for (let i = 0; i < players.length; i++) if (players[i].team === team && players[i].sentOff) n++;
  return n;
}

function sendOff(match: MatchState, p: PlayerState): void {
  p.sentOff = true;
  markLeftPitch(match, p.team, p.squadIndex);
  standDown(p);
}

// Paco 24-sep (resolution 6). The sent-off KEEPER does not leave a hole in the goal:
// the SECOND keeper takes his slot -- players[team * TEAM_SIZE], which keeperOf reads
// and which match.ts and set-pieces.ts (executePenalty, beginShootoutKick) all assume
// is a goalkeeper -- through the same bringOn the injury substitution uses, and the
// team gives up an OUTFIELD player instead. keeperOf is never touched and no
// PlayerState is ever moved in the array. Returns false when there is no keeper left,
// in which case the caller shows the caption and sends NOBODY off.
export function sendOffKeeper(match: MatchState, team: 0 | 1): boolean {
  const reserve = firstFreeReserveOfRole(match, team, 'gk');
  if (reserve < 0) return false;
  // Who pays for it: the active outfield player FARTHEST from the ball, ties broken by
  // the lowest id. Derived from the state, so it replays; no Rng.
  let victimId = -1;
  let best = -1;
  for (let i = 0; i < match.players.length; i++) {
    const p = match.players[i];
    if (p.team !== team || p.role === 'gk' || !isActive(p)) continue;
    const d = dist(p.x, p.y, match.ball.x, match.ball.y);
    if (d > best) {
      best = d;
      victimId = p.id;
    }
  }
  if (victimId < 0) return false;
  sendOff(match, match.players[victimId]);
  // The offending keeper's IDENTITY leaves; the slot stays and becomes the second keeper.
  bringOn(match, match.players[team * TEAM_SIZE], reserve);
  return true;
}

// Counts the foul, decides the card and applies the sending off. Returns the card TO
// SHOW, which is 'red' even when nobody actually leaves (the caption without the sending
// off, G15-13 for the third red and resolution 6 for a keeper with no replacement), and
// writes it into match.lastCard -- with the squad index of the carded player taken
// BEFORE a keeper's slot changes identity, so the caption names the one who was sent
// off. Allocates nothing.
export function registerFoul(match: MatchState, offenderId: number): Card {
  const p = match.players[offenderId];
  p.fouls++;
  const card = cardForFouls(p.fouls);
  match.lastCard.playerId = p.id;
  match.lastCard.squadIndex = p.squadIndex;
  match.lastCard.card = card;
  if (card === 'none') return 'none';
  p.card = card;
  if (card !== 'red') return card;
  const team = p.team;
  if (sentOffCount(match.players, team) >= SENT_OFF_MAX) return 'red';   // caption only
  if (p.role === 'gk') {
    sendOffKeeper(match, team);                                          // false -> caption only
    return 'red';
  }
  sendOff(match, p);
  return 'red';
}
