import type { Vec2 } from './geometry';
import { centerX, centerY, type PitchDef } from './pitch';
import { TEAM_SIZE, type Formation, type Strategy, type TeamDef } from './teams';
import type { TeamInput } from './input';
import type { Rng } from './rng';
import { HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, EXTRA_TIME_SECONDS, EXTRA_TIME_STEPS } from './clock';
import { STEP_MS, stepPhysics, stepsFor } from './step';
import { createPlayers, placeByFormation, type PlayerState } from './players';
import { createBall, stepBall, type BallState } from './ball';
import {
  applyButtons, applyKeeperButtons, clearActionEvent, createActionEvent, releaseFromGoalkeeper, stepTackle,
  updateControlled, type ActionEvent,
} from './actions';
import { applyKickError, keeperCatch, keeperStep, positionTeam, type AiProfile } from './ai';
import {
  clearRefereeCall, createRefereeCall, judgeBall, judgeFoul,
  type RefereeCall, type RestartKind, type SetPieceKind,
} from './referee';
import {
  SHOOTOUT_RESOLVE_STEPS, SHOOTOUT_ROUNDS, beginSetPiece, beginShootoutKick, createSetPieceState,
  createShootoutState, resetShootout, shootoutWinner, stepSetPiece, type SetPieceState, type ShootoutState,
} from './set-pieces';

export type MatchPhase = 'kickoff' | 'play' | 'set-piece' | 'goal' | 'half-time' | 'golden-goal' | 'shootout' | 'over';

// ── G9-1 (Paco, 09-sep): the training mode is a RULESET of the match, not a mode.
// The engine still does not know what it is playing; it knows two switches:
//   · timed      — advanceClock is a no-op when false: no half ends, no extra time,
//                  no shootout. The match only ends by abandon().
//   · frozenTeam — that team's outfield players skip positionTeam (their want
//                  channel stays at zero: they stand at their anchors), and never end a
//                  step holding a loose ball (dropFrozenPickup, S-FL2). Its KEEPER is
//                  untouched: keeperStep, keeperCatch and the automatic release all
//                  still run, which is what makes it a shooting drill and not a void.
// NORMAL_RULES is the default of createMatch, so every existing call and test is the
// match it always was, byte for byte (see the first G9-1 test).
export type MatchRules = { timed: boolean; frozenTeam: -1 | 0 | 1 };
export const NORMAL_RULES: Readonly<MatchRules> = { timed: true, frozenTeam: -1 };
export const TRAINING_RULES: Readonly<MatchRules> = { timed: false, frozenTeam: 1 };

export type MatchState = {
  teams: [TeamDef, TeamDef];
  players: PlayerState[];
  ball: BallState;
  score: [number, number];
  half: 1 | 2 | 3;
  clockMs: number;
  phase: MatchPhase;
  setPiece: SetPieceState | null;
  // Stage B2 (S-PK6): null until the extra time runs out level. The shootout keeps
  // its own scoreboard; `score` stays as it ended and winnerOf() puts the two together.
  shootout: ShootoutState | null;
  stepCount: number;
  controlled: [number, number];
  attackDir: [1 | -1, 1 | -1];
  halfStep: number;
  pauseStepsLeft: number;
  formationIndex: [number, number];
  strategies: [Strategy, Strategy];
  formationTable: readonly Formation[];
  pitch: PitchDef;
  profiles: readonly [AiProfile, AiProfile];
  rules: Readonly<MatchRules>;
  // One catch roll per approach of the ball, per keeper (stage B, D4): keeperCatch
  // sets it when it rolls and clears it as soon as the ball leaves the radius.
  catchRolled: [boolean, boolean];
  lastGoalTeam: 0 | 1 | -1;
  // Fix round 1: one ActionEvent per player id (18 total), not per team -- a
  // shared per-team slot let a second same-team tackler's clean outcome
  // overwrite a first tackler's foul in the same step (see stepOpenPlay).
  // Stage B (D4): gkEvent is gone (each keeper writes its own slot events[gk.id])
  // and liveControlled is the controlled tuple stepPhysics and positionTeam see
  // THIS step: match.controlled, or -1 for a team whose keeper holds the ball.
  scratch: { events: ActionEvent[]; liveControlled: [number, number]; call: RefereeCall; aim: Vec2; setPiece: SetPieceState; shootout: ShootoutState };
};

export { HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, EXTRA_TIME_SECONDS, EXTRA_TIME_STEPS };
export type { ShootoutState };
const GOAL_PAUSE_SECONDS = 2;
export const GOAL_PAUSE_STEPS = stepsFor(GOAL_PAUSE_SECONDS);
const HALF_TIME_PAUSE_SECONDS = 3;
export const HALF_TIME_PAUSE_STEPS = stepsFor(HALF_TIME_PAUSE_SECONDS);

export function kickoffTeamFor(half: 1 | 2 | 3): 0 | 1 {
  return half === 2 ? 1 : 0;
}

export function isOpenPlay(phase: MatchPhase): boolean {
  return phase === 'play' || phase === 'golden-goal';
}

function formationsOf(match: MatchState): readonly [Formation, Formation] {
  // Two reads, no per-step allocation: this tuple is rebuilt only at set-piece events.
  return [match.formationTable[match.formationIndex[0]], match.formationTable[match.formationIndex[1]]];
}

function startSetPiece(match: MatchState, kind: SetPieceKind, team: 0 | 1, x: number, y: number): void {
  const sp = match.scratch.setPiece;
  beginSetPiece(sp, kind, team, x, y, match.players, match.ball, formationsOf(match), match.strategies, match.attackDir, match.pitch, match.stepCount);
  match.setPiece = sp;
}

function startKickoff(match: MatchState, team: 0 | 1): void {
  match.phase = 'kickoff';
  startSetPiece(match, 'kickoff', team, centerX(match.pitch), centerY(match.pitch));
}

// Both teams back to their formation on their CURRENT side. Called at half-time
// right after attackDir flips, so the keeper-in-box invariant (9b) holds during
// the pause and not only once the second-half kickoff repositions everyone.
function repositionBothTeams(match: MatchState): void {
  const formations = formationsOf(match);
  placeByFormation(match.players, 0, formations[0], match.strategies[0], match.attackDir[0], match.pitch);
  placeByFormation(match.players, 1, formations[1], match.strategies[1], match.attackDir[1], match.pitch);
}

// One ActionEvent per player id, allocated once (fix round 1): players[i].id
// === i always (players.ts), so events[i] is that player's own slot -- two
// players, same team or not, never share one.
function createPlayerEvents(count: number): ActionEvent[] {
  const events: ActionEvent[] = [];
  for (let i = 0; i < count; i++) events.push(createActionEvent());
  return events;
}

export function createMatch(
  teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef,
  profiles: readonly [AiProfile, AiProfile], rules: Readonly<MatchRules> = NORMAL_RULES,
): MatchState {
  const match: MatchState = {
    teams,
    players: createPlayers([formationTable[0], formationTable[0]], pitch),
    ball: createBall(),
    score: [0, 0],
    half: 1,
    clockMs: 0,
    phase: 'kickoff',
    setPiece: null,
    shootout: null,
    stepCount: 0,
    controlled: [-1, -1],
    attackDir: [1, -1],
    halfStep: 0,
    pauseStepsLeft: 0,
    formationIndex: [0, 0],
    strategies: ['neutral', 'neutral'],
    formationTable,
    pitch,
    profiles,
    rules,
    catchRolled: [false, false],
    lastGoalTeam: -1,
    scratch: {
      events: createPlayerEvents(TEAM_SIZE * 2),
      liveControlled: [-1, -1],
      call: createRefereeCall(),
      aim: { x: 0, y: 0 },
      setPiece: createSetPieceState(),
      shootout: createShootoutState(),
    },
  };
  startKickoff(match, kickoffTeamFor(1));
  updateControlled(match.players, match.ball, match.controlled);
  return match;
}

// ── Transitions: every one guards its starting phase and returns false otherwise ──

export function resumePlay(match: MatchState): boolean {
  if (match.phase !== 'kickoff' && match.phase !== 'set-piece') return false;
  match.setPiece = null;
  match.phase = match.half === 3 ? 'golden-goal' : 'play';
  return true;
}

export function callSetPiece(match: MatchState, kind: SetPieceKind, team: 0 | 1, x: number, y: number): boolean {
  if (!isOpenPlay(match.phase)) return false;
  match.phase = 'set-piece';
  startSetPiece(match, kind, team, x, y);
  return true;
}

export function scoreGoal(match: MatchState, team: 0 | 1): boolean {
  if (!isOpenPlay(match.phase) && match.phase !== 'set-piece') return false;
  match.score[team]++;
  match.lastGoalTeam = team;
  match.setPiece = null;
  if (match.half === 3) {
    match.phase = 'over';
    return true;
  }
  match.phase = 'goal';
  match.pauseStepsLeft = GOAL_PAUSE_STEPS;
  return true;
}

export function endGoalPause(match: MatchState): boolean {
  if (match.phase !== 'goal') return false;
  startKickoff(match, match.lastGoalTeam === 0 ? 1 : 0);
  return true;
}

export function endHalf(match: MatchState): boolean {
  if (match.phase !== 'play') return false;
  match.halfStep = 0;
  if (match.half === 1) {
    match.half = 2;
    match.attackDir[0] = match.attackDir[0] === 1 ? -1 : 1;
    match.attackDir[1] = match.attackDir[1] === 1 ? -1 : 1;
    repositionBothTeams(match);
    match.phase = 'half-time';
    match.pauseStepsLeft = HALF_TIME_PAUSE_STEPS;
    return true;
  }
  if (match.score[0] !== match.score[1]) {
    match.phase = 'over';
    return true;
  }
  match.half = 3;
  startKickoff(match, kickoffTeamFor(3));
  return true;
}

export function endHalfTime(match: MatchState): boolean {
  if (match.phase !== 'half-time') return false;
  startKickoff(match, kickoffTeamFor(2));
  return true;
}

export function abandon(match: MatchState): boolean {
  if (match.phase === 'over') return false;
  match.phase = 'over';
  match.setPiece = null;
  return true;
}

// The extra time ran out level: the shootout takes over (S-PK6). The clock stops
// here for good -- no branch of the shootout calls advanceClock.
export function endExtraTime(match: MatchState): boolean {
  if (match.phase !== 'golden-goal') return false;
  match.phase = 'shootout';
  resetShootout(match.scratch.shootout);
  match.shootout = match.scratch.shootout;
  startShootoutKick(match, match.scratch.shootout);
  return true;
}

// The shootout has a winner. `shootout` is deliberately NOT cleared: the screen and
// world-cup.ts read its scoreboard after the match is over, through winnerOf().
export function endShootout(match: MatchState): boolean {
  if (match.phase !== 'shootout') return false;
  match.phase = 'over';
  match.setPiece = null;
  return true;
}

// Who won: the score decides, and a level score is decided by the shootout, which
// keeps its own scoreboard. -1 while the match is undecided (or ended level with no
// shootout, which only abandon() can produce).
// Stage B2 assumption S-PK12, not in the spec -- review in QA: the shootout never adds
// to match.score, so a match decided on penalties ends 'over' with a level scoreboard
// and this is the ONE reader that puts the two together. Adding the shootout's goals to
// match.score was the alternative, discarded: it would falsify the score the HUD paints
// and the clean sheet of the scoring table.
// exported for Task 9: world-cup.ts resolves the bracket with this, and the Task 8
// HUD paints the winner with it.
export function winnerOf(match: MatchState): 0 | 1 | -1 {
  if (match.score[0] !== match.score[1]) return match.score[0] > match.score[1] ? 0 : 1;
  return match.shootout === null ? -1 : shootoutWinner(match.shootout);
}

// ── The step ──────────────────────────────────────────────────────────────────

function applyTeamChoices(match: MatchState, inputs: readonly [TeamInput, TeamInput]): void {
  for (let t = 0; t < 2; t++) {
    const idx = inputs[t].formation;
    if (idx >= 0 && idx < match.formationTable.length) match.formationIndex[t] = idx;
    match.strategies[t] = inputs[t].strategy;
  }
}

// Stage B2 (Paco, 06-sep): ruling R18 is SUPERSEDED. It froze the clock in half 3
// because a golden goal with no cap had nothing to measure; with a cap of
// EXTRA_TIME_SECONDS it has, so the clock runs in the extra time exactly like in the
// two regulation halves. The one phase with a frozen clock is now the shootout, and
// it freezes by not calling this at all (S-PK6).
function advanceClock(match: MatchState): void {
  if (!match.rules.timed) return;   // G9-1: a training match has no clock at all
  match.halfStep++;
}

// Ruling R1: `RestartKind` (referee.ts) is the subset of calls that restart play.
// Narrowing to `SetPieceKind` here would not compile -- 'kickoff' is a SetPieceKind
// the referee can never call, so it is not a subtype of CallKind.
function isRestart(kind: RefereeCall['kind']): kind is RestartKind {
  return kind !== 'none' && kind !== 'goal';
}

function keeperOf(match: MatchState, team: 0 | 1): PlayerState {
  return match.players[team * TEAM_SIZE];
}

// D4: -1 while this team's keeper holds the ball (nobody reads the d-pad), else the
// derived controlled. match.controlled itself is untouched: updateControlled keeps
// the cursor on a field player and stage C reads ball.owner to draw it on the keeper.
function liveControlledFor(match: MatchState, team: 0 | 1): number {
  return match.ball.owner === keeperOf(match, team).id ? -1 : match.controlled[team];
}

// One rng draw at most, only when a roll is actually possible (keeperCatch). A catch
// is possession -- no set piece, no early return: the step goes on.
function keeperCatchFor(match: MatchState, team: 0 | 1, rng: Rng): void {
  const gk = keeperOf(match, team);
  keeperCatch(gk, match.ball, match.profiles[team].catchChance, match.catchRolled, rng, match.pitch, match.stepCount, match.scratch.events[gk.id]);
}

function runTeamAi(match: MatchState, team: 0 | 1): void {
  const { players, ball, scratch } = match;
  // G9-1: the frozen team's outfield stands still (its want channel is left at the
  // zero placeByFormation wrote); its keeper is positioned like any other.
  if (team !== match.rules.frozenTeam) {
    positionTeam(players, ball, team, match.formationTable[match.formationIndex[team]], match.strategies[team], match.attackDir[team], scratch.liveControlled[team], match.pitch, match.stepCount, scratch.aim);
  }
  keeperStep(keeperOf(match, team), players, ball, match.attackDir[team], match.pitch, match.stepCount);
}

// S-FL2 (G9-1) -- fix round 1 restates the invariant precisely: a frozen OUTFIELD
// player never ENDS A STEP owning the ball, by whatever route it got there. The
// loose-ball route: pickUp runs inside stepBall (ball.ts, not part of this change)
// and has just glued the ball to his foot at CONTROL_DIST, at rest; letting go here
// leaves it exactly there, loose, for the human to collect by getting closer than the
// statue (under 18 u; pickUp takes the nearest). Repeats every step while it lies
// there: 18 comparisons, no allocation. The tackle route (a frozen player sliding a
// rival's ball loose into his own possession) cannot reach this function at all any
// more -- applyTeamInput now refuses to hand the frozen team's controlled player any
// TeamInput, so it can never start (or continue) a tackle in the first place; see the
// guard there. The keeper is deliberately excluded here: a training drill needs
// someone to beat, and this whole invariant is about outfield statues, not him.
function dropFrozenPickup(match: MatchState): void {
  const frozen = match.rules.frozenTeam;
  const owner = match.ball.owner;
  if (frozen < 0 || owner === null) return;
  const p = match.players[owner];
  if (p.team !== frozen || p.role === 'gk') return;
  match.ball.owner = null;
}

// D4 routing. Keeper holding the ball: the TeamInput is the keeper's (throw by button,
// exact) and, failing that, the automatic release at GK_HOLD_STEPS -- both write the
// keeper's own slot and neither draws. Otherwise the field controlled gets the
// buttons (steal draw inside) and its kick gets the profile's angular error (one draw).
// Team 0 acts first: a simultaneous steal by both resolves in its favour, same
// lowest-id rule as everywhere; QA item, criterion 14.
function applyTeamInput(match: MatchState, team: 0 | 1, input: TeamInput, rng: Rng): void {
  const { players, ball, scratch } = match;
  const gk = keeperOf(match, team);
  if (ball.owner === gk.id) {
    applyKeeperButtons(gk, input, ball, players, match.attackDir[team], match.stepCount, scratch.aim, scratch.events[gk.id]);
    releaseFromGoalkeeper(gk, ball, players, match.attackDir[team], match.pitch, match.stepCount, scratch.aim, scratch.events[gk.id]);
    return;
  }
  // Fix round 1 (G9-1 review, Important): a frozen outfield player must never
  // start or continue a tackle, whatever TeamInput it is handed -- startTackle
  // (actions.ts) does not know about training, and a tackle already under way
  // reaches givePossession from the stepTackle loop in stepOpenPlay, AFTER
  // dropFrozenPickup has already run for this step. The robust fix is to never
  // feed the frozen team's controlled player a TeamInput at all: not calling
  // applyButtons means tackleStepsLeft can never leave zero for it, so there is
  // nothing left for that loop to advance. The keeper is untouched -- this
  // branch only replaces the field-player path above, never the gk-holds-ball one.
  if (team === match.rules.frozenTeam) return;
  const controlledPlayer = players[match.controlled[team]];
  const ev = scratch.events[controlledPlayer.id];
  applyButtons(controlledPlayer, input, ball, players, rng, match.stepCount, scratch.aim, ev);
  if (ev.ok && (ev.kind === 'shot' || ev.kind === 'short-pass' || ev.kind === 'long-pass')) {
    applyKickError(ball, ev.kind === 'shot' ? match.profiles[team].shotErrorDeg : match.profiles[team].passErrorDeg, rng);
  }
}

function stepOpenPlay(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void {
  const { players, ball, scratch } = match;
  // Whole-stage review C1: only the two controlled slots used to be cleared (by
  // applyButtons), so a judged foul stayed in its slot and was judged AGAIN as
  // soon as the set piece handed play back -- a new penalty every countdown.
  // Wiping all 18 makes "the events of this step" true by construction; moved
  // to the top of stepMatch (final review Important #1) so kickoff/set-piece/
  // goal/half-time steps start clean too, not just open-play ones.
  // Stage B (Task 6a): the in-engine AI, applied to BOTH teams so the replay
  // stays seed + TeamInput. Order of the step, fixed for the rng: (1) the catch,
  // team 0 then team 1 (the only draw before the buttons; D4: a catch is
  // possession, play goes on); (2) who reads the TeamInput this step -- the field
  // controlled, or nobody when the keeper holds the ball (its input goes to the
  // keeper's throw and the field player is placed by the AI, D4); (3) placement
  // and keeper write the want channel; (4) per team, the throw + automatic
  // release (exact, no draw) OR the buttons (steal draw) + kick error (one draw);
  // (5) physics, tackles, referee, clock exactly as in stage A.
  keeperCatchFor(match, 0, rng);
  keeperCatchFor(match, 1, rng);
  scratch.liveControlled[0] = liveControlledFor(match, 0);
  scratch.liveControlled[1] = liveControlledFor(match, 1);
  runTeamAi(match, 0);
  runTeamAi(match, 1);
  applyTeamInput(match, 0, inputs[0], rng);
  applyTeamInput(match, 1, inputs[1], rng);
  stepPhysics(players, ball, inputs, scratch.liveControlled, match.attackDir, match.pitch, match.stepCount);
  dropFrozenPickup(match);
  for (let i = 0; i < players.length; i++) {
    // Fix round 1: each player writes its own outcome into its own slot
    // (events[i], since players[i].id === i) -- a second same-team tackler
    // sliding clean in the same step can no longer erase a first one's foul.
    if (players[i].tackleStepsLeft > 0) stepTackle(players[i], ball, players, match.stepCount, scratch.events[i]);
  }
  // Ruling R5: clearRefereeCall exists for exactly this -- judgeFoul only ever
  // writes a call, so a stale one from a previous step must be wiped first.
  clearRefereeCall(scratch.call);
  // Scan every player's event in ascending id order and judge the first foul.
  // First foul wins, lowest id (unchanged determinism rule, now applied across
  // all 18 slots instead of 2): team 0's ids are lower than team 1's, so a
  // simultaneous foul by both teams still resolves in favour of team 0's
  // victim -- a recorded, deferred minor (see the Task 5 report), not fixed here.
  for (let i = 0; i < scratch.events.length; i++) {
    const ev = scratch.events[i];
    if (ev.foul) {
      // Ruling R14: judgeFoul alone decides penalty vs free kick (offender's own
      // big area); match.ts must not re-derive that rule.
      judgeFoul(ev.x, ev.y, players[ev.victimId].team, match.attackDir, match.pitch, scratch.call);
      if (isRestart(scratch.call.kind)) callSetPiece(match, scratch.call.kind, scratch.call.team, scratch.call.x, scratch.call.y);
      advanceClock(match);
      return;
    }
  }
  judgeBall(ball, match.attackDir, match.pitch, scratch.call);
  if (scratch.call.kind === 'goal') {
    // On purpose, no advanceClock: the step a goal is scored on stops being play time.
    scoreGoal(match, scratch.call.team);
    return;
  }
  if (isRestart(scratch.call.kind)) {
    callSetPiece(match, scratch.call.kind, scratch.call.team, scratch.call.x, scratch.call.y);
    advanceClock(match);
    return;
  }
  advanceClock(match);
  if (match.phase === 'play') {
    if (match.halfStep >= HALF_STEPS) endHalf(match);
    return;
  }
  // Only 'golden-goal' is left (isOpenPlay is the entry condition of this function).
  // Same shape as the half above: the cap is only read from open play, so an extra
  // time whose clock runs out during a set-piece countdown ends on the first open-play
  // step after it -- which is what the two regulation halves already do with endHalf.
  if (match.halfStep >= EXTRA_TIME_STEPS) endExtraTime(match);
}

function startShootoutKick(match: MatchState, sh: ShootoutState): void {
  const sp = match.scratch.setPiece;
  beginShootoutKick(sp, sh, match.players, match.ball, formationsOf(match), match.strategies, match.attackDir, match.pitch, match.stepCount);
  match.setPiece = sp;
}

type KickOutcome = 'goal' | 'miss' | 'pending';

// S-PK2: it is a GOAL if the ball crosses the line between the posts; it is a MISS if
// the keeper saves it, if it leaves the field, or if SHOOTOUT_RESOLVE_SECONDS go by
// with neither. There is no rebound: the ball is collected and placed for the next one.
function judgeShootoutKick(match: MatchState, sh: ShootoutState, keeperTeam: 0 | 1): KickOutcome {
  if (match.ball.owner === keeperOf(match, keeperTeam).id) return 'miss';
  judgeBall(match.ball, match.attackDir, match.pitch, match.scratch.call);
  if (match.scratch.call.kind === 'goal') return match.scratch.call.team === sh.team ? 'goal' : 'miss';
  if (isRestart(match.scratch.call.kind)) return 'miss';
  return sh.resolveStepsLeft <= 0 ? 'miss' : 'pending';
}

// The kick is resolved: count it, and either the shootout has a winner (shootoutWinner
// carries the whole of S-PK5, sudden death included) or the rival steps up.
// Stage B2 assumption S-PK9, not in the spec -- review in QA: sudden death has no
// engine-side cap. Termination is left entirely to penaltyReadChance being clamped to
// [0.5125, 0.60] (ai.ts), so every kick is a miss with probability >= 0.5125 and the
// shootout ends with probability 1, expected within under two sudden-death rounds. The
// discarded alternative was a hard cap on the number of sudden-death rounds, resolved
// by a coin flip if both sides were still level when the cap was hit -- that invents a
// football rule the spec does not state, so it was left out in favour of the
// probabilistic guarantee above.
function finishShootoutKick(match: MatchState, sh: ShootoutState, scored: boolean): void {
  if (scored) sh.scored[sh.team]++;
  sh.taken[sh.team]++;
  if (shootoutWinner(sh) >= 0) {
    endShootout(match);
    return;
  }
  sh.team = sh.team === 0 ? 1 : 0;
  if (sh.taken[0] >= SHOOTOUT_ROUNDS && sh.taken[1] >= SHOOTOUT_ROUNDS) sh.suddenDeath = true;
  startShootoutKick(match, sh);
}

// One step of the shootout. No clock (S-PK6), no positioning AI and no player physics
// (S-PK4): the only things that move are the ball, once the kick is away, and the
// defending keeper, teleported to the side it dives to by executePenalty. The referee
// call is cleared every step so the goal of a kick is visible for exactly one step, the
// same property ruling R28 gave the action events.
function stepShootout(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void {
  const sh = match.shootout;
  const sp = match.setPiece;
  // Unreachable while the phase is entered through endExtraTime, which sets both (same
  // convention as nearestOutfield's -1 in set-pieces.ts): it is the narrowing the
  // compiler needs, and the safe way out if a v1.5 path ever forces the phase.
  if (sh === null || sp === null) {
    endShootout(match);
    return;
  }
  clearRefereeCall(match.scratch.call);
  const keeperTeam: 0 | 1 = sh.team === 0 ? 1 : 0;
  if (sh.resolveStepsLeft === 0) {
    const executed = stepSetPiece(
      sp, inputs[sh.team], match.players, match.ball, rng, match.profiles[keeperTeam].penaltyReadChance,
      match.attackDir, match.pitch, match.stepCount, match.scratch.aim, match.scratch.events[sp.takerId],
    );
    if (!executed) return;
    sh.resolveStepsLeft = SHOOTOUT_RESOLVE_STEPS;
  } else {
    stepBall(match.ball, match.players, match.stepCount, match.pitch);
    sh.resolveStepsLeft--;
  }
  const outcome = judgeShootoutKick(match, sh, keeperTeam);
  if (outcome === 'pending') return;
  finishShootoutKick(match, sh, outcome === 'goal');
}

// One FIXED step. Two symmetric inputs; the engine does not know which one is human.
// Ruling R7: this lives in match.ts, not in step.ts as the spec's file table says --
// step.ts keeps stepPhysics only, so match.ts can import it without an ESM cycle.
export function stepMatch(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void {
  if (match.phase === 'over') return;
  // Final review Important #1: this used to run only inside stepOpenPlay, so a
  // foul (or any other event) judged on the last open-play step before a
  // set-piece/goal/half-time phase stayed in its slot for every step of that
  // phase -- up to hundreds of steps of a stage-C consumer re-firing sound/HUD
  // for an event that already happened. Sweeping here, before the phase
  // dispatch, makes "the events of this step" true on every step, not only
  // open-play ones. The set-piece branch below writes
  // scratch.events[sp.takerId] AFTER this sweep runs (same step), so that
  // write stays visible when stepMatch returns. 18 scalar resets, no allocation.
  for (let i = 0; i < match.scratch.events.length; i++) clearActionEvent(match.scratch.events[i]);
  applyTeamChoices(match, inputs);
  switch (match.phase) {
    case 'kickoff':
    case 'set-piece': {
      const sp = match.setPiece;
      if (sp === null) {
        resumePlay(match);
        break;
      }
      const keeperTeam = sp.team === 0 ? 1 : 0;
      const executed = stepSetPiece(
        sp, inputs[sp.team], match.players, match.ball, rng, match.profiles[keeperTeam].penaltyReadChance,
        match.attackDir, match.pitch, match.stepCount, match.scratch.aim, match.scratch.events[sp.takerId],
      );
      // stepSetPiece keeps counting past zero and would fire the kick again (and
      // re-draw from the rng on a penalty): leaving the phase on this same step is
      // what guarantees it runs exactly once.
      if (executed) resumePlay(match);
      advanceClock(match);
      break;
    }
    case 'goal':
    case 'half-time': {
      match.pauseStepsLeft--;
      if (match.pauseStepsLeft <= 0) {
        if (match.phase === 'goal') endGoalPause(match);
        else endHalfTime(match);
      }
      break;
    }
    case 'play':
    case 'golden-goal':
      stepOpenPlay(match, inputs, rng);
      break;
    case 'shootout':
      stepShootout(match, inputs, rng);
      break;
    default: {
      // A ninth phase (v1.5 world cup, stage C screens) fails to compile here
      // instead of silently falling through this switch.
      const _exhaustive: never = match.phase;
      return _exhaustive;
    }
  }
  match.stepCount++;
  match.clockMs = match.halfStep * STEP_MS;
  updateControlled(match.players, match.ball, match.controlled);
}
