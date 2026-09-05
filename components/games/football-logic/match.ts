import type { Vec2 } from './geometry';
import { centerX, centerY, type PitchDef } from './pitch';
import { TEAM_SIZE, type Formation, type Strategy, type TeamDef } from './teams';
import type { TeamInput } from './input';
import type { Rng } from './rng';
import { STEP_MS, stepPhysics, stepsFor } from './step';
import { createPlayers, placeByFormation, type PlayerState } from './players';
import { createBall, type BallState } from './ball';
import {
  applyButtons, clearActionEvent, createActionEvent, releaseFromGoalkeeper, stepTackle, updateControlled,
  type ActionEvent,
} from './actions';
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
  gkPenaltyRead: [number, number];
  lastGoalTeam: 0 | 1 | -1;
  // Fix round 1: one ActionEvent per player id (18 total), not per team -- a
  // shared per-team slot let a second same-team tackler's clean outcome
  // overwrite a first tackler's foul in the same step (see stepOpenPlay).
  scratch: { events: ActionEvent[]; gkEvent: ActionEvent; call: RefereeCall; aim: Vec2; setPiece: SetPieceState };
};

export const HALF_SECONDS = 90;
export const HALF_SECONDS_MAX = 120;
export const HALF_STEPS = stepsFor(HALF_SECONDS);
export const GOAL_PAUSE_SECONDS = 2;
export const GOAL_PAUSE_STEPS = stepsFor(GOAL_PAUSE_SECONDS);
export const HALF_TIME_PAUSE_SECONDS = 3;
export const HALF_TIME_PAUSE_STEPS = stepsFor(HALF_TIME_PAUSE_SECONDS);
export const DEFAULT_PENALTY_READ_CHANCE = 0.5;

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

export function createMatch(teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef): MatchState {
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
    gkPenaltyRead: [DEFAULT_PENALTY_READ_CHANCE, DEFAULT_PENALTY_READ_CHANCE],
    lastGoalTeam: -1,
    scratch: {
      events: createPlayerEvents(TEAM_SIZE * 2),
      gkEvent: createActionEvent(),
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

function stepOpenPlay(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void {
  const { players, ball, scratch } = match;
  // Whole-stage review C1: only the two controlled slots used to be cleared (by
  // applyButtons), so a judged foul stayed in its slot and was judged AGAIN as
  // soon as the set piece handed play back -- a new penalty every countdown.
  // Wiping all 18 here makes "the events of this step" true by construction.
  // 18 scalar resets, no allocation. Clearing only the judged slot would not do:
  // the scan below returns on the first foul and leaves the rest untouched.
  for (let i = 0; i < scratch.events.length; i++) clearActionEvent(scratch.events[i]);
  for (let t = 0; t < 2; t++) {
    const controlledPlayer = players[match.controlled[t]];
    applyButtons(controlledPlayer, inputs[t], ball, players, rng, match.stepCount, scratch.aim, scratch.events[controlledPlayer.id]);
  }
  releaseFromGoalkeeper(players[0], ball, match.attackDir[0], match.stepCount, scratch.gkEvent);
  releaseFromGoalkeeper(players[TEAM_SIZE], ball, match.attackDir[1], match.stepCount, scratch.gkEvent);
  stepPhysics(players, ball, inputs, match.controlled, match.attackDir, match.pitch, match.stepCount);
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
        sp, inputs[sp.team], match.players, match.ball, rng, match.gkPenaltyRead[keeperTeam],
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
