import type { Vec2 } from './geometry';
import { centerX, centerY, type PitchDef } from './pitch';
import { TEAM_SIZE, type Formation, type Strategy, type TeamDef } from './teams';
import type { TeamInput } from './input';
import type { Rng } from './rng';
import { HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS } from './clock';
import { STEP_MS, stepPhysics, stepsFor } from './step';
import { createPlayers, placeByFormation, type PlayerState } from './players';
import { createBall, type BallState } from './ball';
import {
  applyButtons, applyKeeperButtons, clearActionEvent, createActionEvent, releaseFromGoalkeeper, stepTackle,
  updateControlled, type ActionEvent,
} from './actions';
import { applyKickError, keeperCatch, keeperStep, positionTeam, type AiProfile } from './ai';
import {
  clearRefereeCall, createRefereeCall, judgeBall, judgeFoul,
  type RefereeCall, type RestartKind, type SetPieceKind,
} from './referee';
import { beginSetPiece, createSetPieceState, stepSetPiece, type SetPieceState } from './set-pieces';

export type MatchPhase = 'kickoff' | 'play' | 'set-piece' | 'goal' | 'half-time' | 'golden-goal' | 'over';

export type MatchState = {
  teams: [TeamDef, TeamDef];
  players: PlayerState[];
  ball: BallState;
  score: [number, number];
  half: 1 | 2 | 3;
  clockMs: number;
  phase: MatchPhase;
  setPiece: SetPieceState | null;
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
  scratch: { events: ActionEvent[]; liveControlled: [number, number]; call: RefereeCall; aim: Vec2; setPiece: SetPieceState };
};

export { HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS };
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

export function createMatch(teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef, profiles: readonly [AiProfile, AiProfile]): MatchState {
  const match: MatchState = {
    teams,
    players: createPlayers([formationTable[0], formationTable[0]], pitch),
    ball: createBall(),
    score: [0, 0],
    half: 1,
    clockMs: 0,
    phase: 'kickoff',
    setPiece: null,
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
    catchRolled: [false, false],
    lastGoalTeam: -1,
    scratch: {
      events: createPlayerEvents(TEAM_SIZE * 2),
      liveControlled: [-1, -1],
      call: createRefereeCall(),
      aim: { x: 0, y: 0 },
      setPiece: createSetPieceState(),
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

// ── The step ──────────────────────────────────────────────────────────────────

function applyTeamChoices(match: MatchState, inputs: readonly [TeamInput, TeamInput]): void {
  for (let t = 0; t < 2; t++) {
    const idx = inputs[t].formation;
    if (idx >= 0 && idx < match.formationTable.length) match.formationIndex[t] = idx;
    match.strategies[t] = inputs[t].strategy;
  }
}

// Ruling R18: the golden goal has no time to measure, so half 3 never advances
// the clock -- on ANY branch. The guard lives here rather than at the four call
// sites (three in stepOpenPlay, one in the set-piece branch of stepMatch)
// because the set-piece branch used to advance it and open play did not, which
// froze the clock during play and jumped it 5 s at every set piece.
function advanceClock(match: MatchState): void {
  if (match.half === 3) return;
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
  positionTeam(players, ball, team, match.formationTable[match.formationIndex[team]], match.strategies[team], match.attackDir[team], scratch.liveControlled[team], match.pitch, match.stepCount, scratch.aim);
  keeperStep(keeperOf(match, team), players, ball, match.attackDir[team], match.pitch, match.stepCount);
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
  if (match.phase === 'play') {
    advanceClock(match);
    if (match.halfStep >= HALF_STEPS) endHalf(match);
  }
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
    default: {
      // An eighth phase (v1.5 world cup, stage C screens) fails to compile here
      // instead of silently falling through this switch.
      const _exhaustive: never = match.phase;
      return _exhaustive;
    }
  }
  match.stepCount++;
  match.clockMs = match.halfStep * STEP_MS;
  updateControlled(match.players, match.ball, match.controlled);
}
