import { stepsFor } from '../football-logic/clock';
import {
  GOAL_PAUSE_STEPS, HALF_TIME_PAUSE_STEPS, winnerOf,
  type MatchPhase, type MatchState,
} from '../football-logic/match';
import { sideIsHuman, type HumanSide } from '../football-logic/mode';
import type { CallKind } from '../football-logic/referee';

// Spec: the seven captions of the v1 (INICIO, FALTA, PENALTI, FUERA, CÓRNER, GOL,
// FINAL), plus the two the 06-sep decision added (PRÓRROGA, PENALTIS), plus the pair
// that closes a match (GANADOR / ELIMINADO -- a caption over the pitch, never a
// screen of its own; the victory screens are Task 9). No referee is drawn in the v1.
export type CaptionKind =
  | 'kickoff' | 'foul' | 'penalty' | 'out' | 'corner' | 'goal'
  | 'half-time' | 'extra-time' | 'shootout' | 'shootout-goal' | 'shootout-miss'
  | 'full-time' | 'winner' | 'eliminated' | 'draw';

// What the caption band is showing right now: one of the kinds, or nothing.
export type ShowingCaption = CaptionKind | 'none';

export const CAPTION_TEXT: Readonly<Record<CaptionKind, string>> = {
  kickoff: 'INICIO',
  foul: 'FALTA',
  penalty: 'PENALTI',
  out: 'FUERA',
  corner: 'CÓRNER',
  goal: 'GOL',
  // S-SC9: the spec's list has no caption for the break, but the audio table does
  // whistle at the end of every half, and a silent three-second freeze reads as a
  // hang. DESCANSO is the smallest thing that explains it.
  'half-time': 'DESCANSO',
  'extra-time': 'PRÓRROGA',
  shootout: 'PENALTIS',
  'shootout-goal': 'GOL',
  'shootout-miss': 'FALLA',
  'full-time': 'FINAL',
  winner: 'GANADOR',
  eliminated: 'ELIMINADO',
  // S-SC12 (confirmed by owner 2026-09-07): the only way a friendly ends without a
  // winner is abandon() (the viewport guard) at a level score -- in ANY phase it is
  // legal in, not only inside the shootout: a window shrunk at 0-0 in the first half
  // ends here too. Nothing else in this ruleset draws (S-PK5: sudden death always
  // produces a winner).
  draw: 'EMPATE',
};

const SHORT_CAPTION_STEPS = stepsFor(1.5);
const RESULT_CAPTION_STEPS = stepsFor(3);

// The captions that cover an engine pause last exactly as long as the pause, so the
// screen never freezes with nothing written on it.
export const CAPTION_STEPS: Readonly<Record<CaptionKind, number>> = {
  kickoff: SHORT_CAPTION_STEPS,
  foul: SHORT_CAPTION_STEPS,
  penalty: SHORT_CAPTION_STEPS,
  out: SHORT_CAPTION_STEPS,
  corner: SHORT_CAPTION_STEPS,
  goal: GOAL_PAUSE_STEPS,
  'half-time': HALF_TIME_PAUSE_STEPS,
  'extra-time': RESULT_CAPTION_STEPS,
  shootout: RESULT_CAPTION_STEPS,
  'shootout-goal': SHORT_CAPTION_STEPS,
  'shootout-miss': SHORT_CAPTION_STEPS,
  'full-time': RESULT_CAPTION_STEPS,
  winner: RESULT_CAPTION_STEPS,
  eliminated: RESULT_CAPTION_STEPS,
  draw: RESULT_CAPTION_STEPS,
};

// Four is enough for the worst chain the engine can produce in one step: a golden
// goal is GOL + FINAL + GANADOR, and a shootout kick that ends the match is
// GOL + FINAL + GANADOR too.
export const CAPTION_QUEUE_MAX = 4;

export type CaptionState = {
  kind: ShowingCaption;
  stepsLeft: number;
  queue: CaptionKind[];
  queueLen: number;
};

export function createCaptionState(): CaptionState {
  const queue: CaptionKind[] = [];
  for (let i = 0; i < CAPTION_QUEUE_MAX; i++) queue.push('kickoff');
  return { kind: 'none', stepsLeft: 0, queue, queueLen: 0 };
}

export function pushCaption(cs: CaptionState, kind: CaptionKind): void {
  if (cs.kind === 'none') {
    cs.kind = kind;
    cs.stepsLeft = CAPTION_STEPS[kind];
    return;
  }
  if (cs.kind === kind) return;
  if (cs.queueLen > 0 && cs.queue[cs.queueLen - 1] === kind) return;
  if (cs.queueLen >= CAPTION_QUEUE_MAX) return;
  cs.queue[cs.queueLen] = kind;
  cs.queueLen++;
}

export function stepCaption(cs: CaptionState): void {
  if (cs.kind === 'none') return;
  cs.stepsLeft--;
  if (cs.stepsLeft > 0) return;
  if (cs.queueLen === 0) {
    cs.kind = 'none';
    cs.stepsLeft = 0;
    return;
  }
  cs.kind = cs.queue[0];
  cs.stepsLeft = CAPTION_STEPS[cs.kind];
  for (let i = 1; i < cs.queueLen; i++) cs.queue[i - 1] = cs.queue[i];
  cs.queueLen--;
}

// Everything the detector needs from the PREVIOUS step, in scalars: no snapshot, no
// allocation. Stage B2 §8: a shootout kick is resolved by `taken` changing, and it
// was a goal if `scored` changed with it.
export type MatchWatch = {
  started: boolean;
  phase: MatchPhase;
  half: 1 | 2 | 3;
  score0: number;
  score1: number;
  taken0: number;
  taken1: number;
  scored0: number;
  scored1: number;
  // MEASURED (preflight 07-sep): scratch.call is a LEVEL that stands for 301 steps
  // on a restart and 421 on a goal, because clearRefereeCall only runs inside
  // stepOpenPlay and stepShootout. Remembering it here is what turns it into the
  // one-step edge the screen and the audio both assume it already is.
  call: CallKind;
};

export function createMatchWatch(): MatchWatch {
  return {
    started: false, phase: 'kickoff', half: 1,
    score0: 0, score1: 0, taken0: 0, taken1: 0, scored0: 0, scored1: 0,
    call: 'none',
  };
}

// `human` is who the keyboard drives (mode.ts HumanSide): 0 or 1 in a solo mode and in
// the World Cup (S-PK3 may put the human on either side), 'both' in the two-player
// friendly, 'none' for a CPU pair watched on screen. `victoryScreen` (Task 9-5, S-FL3,
// final review §8.5): when the mode shows a victory screen for a human win, GANADOR is
// NOT queued -- the screen replaces it; FINAL still runs its three seconds and the flow
// moves on when the queue drains. Defaults keep every step-8 call and test unchanged.
export function collectCaptions(match: MatchState, w: MatchWatch, human: HumanSide, cs: CaptionState, victoryScreen = false): void {
  if (!w.started) {
    pushCaption(cs, 'kickoff');
    return;
  }
  // 1. The goal first: scoreGoal moves the phase in the SAME step, so a phase-based
  //    rule would swallow it.
  if (match.score[0] > w.score0 || match.score[1] > w.score1) pushCaption(cs, 'goal');

  // 2. The shootout, read the way the stage B2 report prescribes: `taken` is the only
  //    reliable signal for BOTH outcomes, and `scored` separates them.
  const sh = match.shootout;
  if (sh !== null && (sh.taken[0] !== w.taken0 || sh.taken[1] !== w.taken1)) {
    const scoredNow = sh.scored[0] !== w.scored0 || sh.scored[1] !== w.scored1;
    pushCaption(cs, scoredNow ? 'shootout-goal' : 'shootout-miss');
  }

  // 3. Phase and half changes. endHalf on a level second half sets half = 3 AND calls
  //    startKickoff in the same step, so the two edges arrive together; PRÓRROGA and
  //    INICIO would then both fire, and both map to whistle_start (two start whistles
  //    three seconds apart). PRÓRROGA wins: it says strictly more.
  let extraTimeNow = false;
  if (match.half !== w.half && match.half === 3) {
    pushCaption(cs, 'extra-time');
    extraTimeNow = true;
  }
  if (match.phase !== w.phase) {
    if (match.phase === 'shootout') pushCaption(cs, 'shootout');
    else if (match.phase === 'half-time') pushCaption(cs, 'half-time');
    else if (!extraTimeNow && match.phase === 'kickoff' && (w.phase === 'half-time' || match.half !== w.half)) {
      pushCaption(cs, 'kickoff');
    }
  }

  // 4. The referee's call, on its EDGE. Two guards, for two different reasons:
  //    · `w.call` — MEASURED (preflight 07-sep, seeds 7/11/23, no variance): the call
  //      is a level that stands for 301 steps on a restart. Reading it as a level
  //      re-pushes FALTA the moment its 90 steps run out, whistle included, three or
  //      four times per foul.
  //    · the phase — stage B2 carry #3: judgeShootoutKick can leave a one-step
  //      phantom restart in scratch.call, and there are no throw-ins in a shootout.
  //      BOTH phases are checked (Task 8-3 review, minor 1): the deciding kick sets
  //      the call and calls endShootout in the SAME step, so by the time the screen
  //      looks, match.phase is already 'over' and nothing ever clears the call --
  //      the current phase alone would let that phantom through as a FUERA in front
  //      of FINAL. w.phase still says 'shootout' on that step, which is what closes it.
  if (match.phase !== 'shootout' && w.phase !== 'shootout' && match.scratch.call.kind !== w.call) {
    switch (match.scratch.call.kind) {
      case 'free-kick': pushCaption(cs, 'foul'); break;
      case 'penalty': pushCaption(cs, 'penalty'); break;
      case 'corner': pushCaption(cs, 'corner'); break;
      case 'throw-in':
      case 'goal-kick': pushCaption(cs, 'out'); break;
      default: break;
    }
  }

  // 5. The end. winnerOf is the ONE reader of the winner (stage B2 §8) and it can
  //    return -1 with the match over -- abandon() at a level score, the only draw this
  //    ruleset has (S-PK5). S-SC12: FINAL always whistles; then EMPATE on an abandon,
  //    nothing for a spectated pair (the bracket names the winner), GANADOR for a
  //    human win without a screen, ELIMINADO for a human loss.
  if (match.phase === 'over' && w.phase !== 'over') {
    pushCaption(cs, 'full-time');
    const winner = winnerOf(match);
    if (winner === -1) pushCaption(cs, 'draw');
    else if (human === 'none') return;
    else if (sideIsHuman(human, winner)) {
      if (!victoryScreen) pushCaption(cs, 'winner');
    } else pushCaption(cs, 'eliminated');
  }
}

export function updateWatch(match: MatchState, w: MatchWatch): void {
  w.started = true;
  w.phase = match.phase;
  w.half = match.half;
  w.score0 = match.score[0];
  w.score1 = match.score[1];
  const sh = match.shootout;
  w.taken0 = sh === null ? 0 : sh.taken[0];
  w.taken1 = sh === null ? 0 : sh.taken[1];
  w.scored0 = sh === null ? 0 : sh.scored[0];
  w.scored1 = sh === null ? 0 : sh.scored[1];
  w.call = match.scratch.call.kind;
}

// Task 9-7: a new match on the same screen (no remount) reuses the queue and the watch.
export function resetCaptionState(cs: CaptionState): void {
  cs.kind = 'none';
  cs.stepsLeft = 0;
  cs.queueLen = 0;
}

export function resetMatchWatch(w: MatchWatch): void {
  w.started = false;
  w.phase = 'kickoff';
  w.half = 1;
  w.score0 = 0;
  w.score1 = 0;
  w.taken0 = 0;
  w.taken1 = 0;
  w.scored0 = 0;
  w.scored1 = 0;
  w.call = 'none';
}
