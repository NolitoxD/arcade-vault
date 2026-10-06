import { stepsFor } from '../football-logic/clock';
import {
  GOAL_PAUSE_STEPS, HALF_TIME_PAUSE_STEPS, winnerOf,
  type MatchPhase, type MatchState,
} from '../football-logic/match';
import { sideIsHuman, type HumanSide } from '../football-logic/mode';
import type { CallKind } from '../football-logic/referee';
import { shootoutTakerId } from '../football-logic/set-pieces';
import type { FrameHit } from '../football-logic/goal-frame';

// Spec: the seven captions of the v1 (INICIO, FALTA, PENALTI, FUERA, CÓRNER, GOL,
// FINAL), plus the two the 06-sep decision added (PRÓRROGA, PENALTIS), plus the pair
// that closes a match (GANADOR / ELIMINADO -- a caption over the pitch, never a
// screen of its own; the victory screens are Task 9). No referee is drawn in the v1.
// V15-4-7: the two cards of G15-13 ("rótulo tarjeta + nombre") and the injury of G15-18.
// The name goes on a second line the component composes on the event; the kind only
// says which caption it is.
export type CaptionKind =
  | 'kickoff' | 'foul' | 'penalty' | 'out' | 'corner' | 'goal'
  | 'half-time' | 'extra-time' | 'shootout' | 'shootout-goal' | 'shootout-miss'
  | 'full-time' | 'winner' | 'eliminated' | 'draw'
  | 'card-yellow' | 'card-red' | 'injury';

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
  'card-yellow': 'TARJETA AMARILLA',
  'card-red': 'TARJETA ROJA',
  injury: 'LESIÓN',
};

const SHORT_CAPTION_STEPS = stepsFor(1.5);
const SHOOTOUT_GOAL_CAPTION_STEPS = stepsFor(1);   // D1: the camera holds the same second (celebration.ts)
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
  'shootout-goal': SHOOTOUT_GOAL_CAPTION_STEPS,
  'shootout-miss': SHORT_CAPTION_STEPS,
  'full-time': RESULT_CAPTION_STEPS,
  winner: RESULT_CAPTION_STEPS,
  eliminated: RESULT_CAPTION_STEPS,
  draw: RESULT_CAPTION_STEPS,
  // G15-13 "sin pausa extra": the cards are only queued, they never stop the game, so
  // they last what a FALTA lasts. The injury caption too: for the human, the LESIONADO
  // window is what stays on screen, not the caption.
  'card-yellow': SHORT_CAPTION_STEPS,
  'card-red': SHORT_CAPTION_STEPS,
  injury: SHORT_CAPTION_STEPS,
};

// Four is enough for the worst chain the engine can produce in one step: a golden
// goal is GOL + FINAL + GANADOR, and a shootout kick that ends the match is
// GOL + FINAL + GANADOR too. A foul that cards and injures is FALTA + TARJETA + LESIÓN.
export const CAPTION_QUEUE_MAX = 4;

// G15-11 (V15-5): who a caption is about. `squad` is the squad index of the player --
// the screen turns it into the name (lineup or squad) with a lookup, never a string
// built per frame -- or SUBJECT_NONE for a caption that names nobody. `team` is the
// subject's team (0 when nobody). D2 (Paco, 06-oct): an own goal is ABOUT THE DEFENDER --
// his team and his squad index -- and `ownGoal` says so; the screen draws GOL with
// OWN_GOAL_PREFIX + his name underneath, baked at startMatch, never composed per frame.
// The subject travels WITH the caption through the queue: two captions about two players
// never share one name slot (the V15-4 review found a second card inside 3 s renaming the
// first one while it waited).
export const SUBJECT_NONE = -1;
export const OWN_GOAL_PREFIX = 'EN PROPIA · ';

export type CaptionState = {
  kind: ShowingCaption;
  stepsLeft: number;
  team: 0 | 1;
  squad: number;
  ownGoal: boolean;
  queue: CaptionKind[];
  queueTeam: (0 | 1)[];
  queueSquad: number[];
  queueOwnGoal: boolean[];
  queueLen: number;
};

export function createCaptionState(): CaptionState {
  const queue: CaptionKind[] = [];
  const queueTeam: (0 | 1)[] = [];
  const queueSquad: number[] = [];
  const queueOwnGoal: boolean[] = [];
  for (let i = 0; i < CAPTION_QUEUE_MAX; i++) {
    queue.push('kickoff');
    queueTeam.push(0);
    queueSquad.push(SUBJECT_NONE);
    queueOwnGoal.push(false);
  }
  return {
    kind: 'none', stepsLeft: 0, team: 0, squad: SUBJECT_NONE, ownGoal: false, queue, queueTeam, queueSquad, queueOwnGoal,
    queueLen: 0,
  };
}

// A caption equal to the one showing, or to the last one queued, is dropped -- equal
// meaning the same kind ABOUT THE SAME PLAYER (and the same own-goal mark): a second card
// for somebody else is news.
export function pushCaption(
  cs: CaptionState, kind: CaptionKind, team: 0 | 1 = 0, squad: number = SUBJECT_NONE, ownGoal = false,
): void {
  if (cs.kind === 'none') {
    cs.kind = kind;
    cs.stepsLeft = CAPTION_STEPS[kind];
    cs.team = team;
    cs.squad = squad;
    cs.ownGoal = ownGoal;
    return;
  }
  if (cs.kind === kind && cs.team === team && cs.squad === squad && cs.ownGoal === ownGoal) return;
  const last = cs.queueLen - 1;
  if (
    last >= 0 && cs.queue[last] === kind && cs.queueTeam[last] === team && cs.queueSquad[last] === squad
    && cs.queueOwnGoal[last] === ownGoal
  ) return;
  if (cs.queueLen >= CAPTION_QUEUE_MAX) return;
  cs.queue[cs.queueLen] = kind;
  cs.queueTeam[cs.queueLen] = team;
  cs.queueSquad[cs.queueLen] = squad;
  cs.queueOwnGoal[cs.queueLen] = ownGoal;
  cs.queueLen++;
}

export function stepCaption(cs: CaptionState): void {
  if (cs.kind === 'none') return;
  cs.stepsLeft--;
  if (cs.stepsLeft > 0) return;
  if (cs.queueLen === 0) {
    cs.kind = 'none';
    cs.stepsLeft = 0;
    cs.team = 0;
    cs.squad = SUBJECT_NONE;
    cs.ownGoal = false;
    return;
  }
  cs.kind = cs.queue[0];
  cs.team = cs.queueTeam[0];
  cs.squad = cs.queueSquad[0];
  cs.ownGoal = cs.queueOwnGoal[0];
  cs.stepsLeft = CAPTION_STEPS[cs.kind];
  for (let i = 1; i < cs.queueLen; i++) {
    cs.queue[i - 1] = cs.queue[i];
    cs.queueTeam[i - 1] = cs.queueTeam[i];
    cs.queueSquad[i - 1] = cs.queueSquad[i];
    cs.queueOwnGoal[i - 1] = cs.queueOwnGoal[i];
  }
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
  // V15-4-7. `step`: the match.stepCount the watch last looked at. match.lastCard and
  // ball.frameHit are flanks the engine sets for ONE step and clears at the top of the
  // next stepMatch; a flank counts only on a step the watch has not seen yet, so the
  // viewport guard (updateWatch + abandon + collectCaptions with no step in between)
  // never reads one twice. `injuries0/1`: match.injuriesUsed, which only ever grows --
  // the injury is read from the counter, never from the one-step lastInjury.
  step: number;
  injuries0: number;
  injuries1: number;
};

export function createMatchWatch(): MatchWatch {
  return {
    started: false, phase: 'kickoff', half: 1,
    score0: 0, score1: 0, taken0: 0, taken1: 0, scored0: 0, scored1: 0,
    call: 'none',
    step: -1, injuries0: 0, injuries1: 0,
  };
}

// G15-13: the card registerFoul showed on a step the watch has not seen yet.
export function cardShownThisStep(match: MatchState, w: MatchWatch): boolean {
  return match.lastCard.card !== 'none' && match.stepCount !== w.step;
}

// G15-18: the team the match has just injured (0, 1 or -1), from the counter. A foul
// injures at most one player, so at most one team per step.
export function injuredTeamThisStep(match: MatchState, w: MatchWatch): 0 | 1 | -1 {
  if (match.injuriesUsed[0] > w.injuries0) return 0;
  if (match.injuriesUsed[1] > w.injuries1) return 1;
  return -1;
}

// G15-12: the one-step flank of a post or crossbar hit, on a step the watch has not seen.
export function frameHitThisStep(match: MatchState, w: MatchWatch): FrameHit {
  return match.stepCount !== w.step ? match.ball.frameHit : 'none';
}

// G15-11 / G15-4 / D3: the id of the taker whose shootout kick `team` has just taken --
// scored OR missed, both captions name him. NOT shootout.takerId: on the step of the kick
// finishShootoutKick has already put the NEXT taker on the spot (measured 06-oct, seed 16).
// shootoutTakerId is the engine's own pure rule (set-pieces.ts); the kick just counted is
// number taken[team] - 1.
export function shootoutScorerId(match: MatchState, team: 0 | 1): number {
  const sh = match.shootout;
  if (sh === null || sh.taken[team] === 0) return -1;
  return shootoutTakerId(team, sh.taken[team] - 1);
}

// G15-11: the player whose foul the referee judged on THIS step -- the first foul event in
// ascending id order, the very scan stepOpenPlay judges by. -1 when there is none. The
// events are swept at the top of the next stepMatch: read on the step, never later.
export function foulOffenderId(match: MatchState): number {
  const events = match.scratch.events;
  for (let i = 0; i < events.length; i++) {
    if (events[i].foul) return events[i].actorId;
  }
  return -1;
}

// G15-4 / G15-14: the team that scored on THIS step -- in open play or a golden goal (the
// score), or in the shootout (its own scoreboard) -- or -1. A post or a crossbar never
// moves either counter. Read against the watch BEFORE updateWatch, like the captions.
export function goalScoredThisStep(match: MatchState, w: MatchWatch): 0 | 1 | -1 {
  if (match.score[0] > w.score0) return 0;
  if (match.score[1] > w.score1) return 1;
  const sh = match.shootout;
  if (sh === null) return -1;
  if (sh.scored[0] > w.scored0) return 0;
  if (sh.scored[1] > w.scored1) return 1;
  return -1;
}

// The squad index of whoever left the pitch with the card of THIS step, if it is the
// offender; otherwise the offender's own. After a keeper's red the slot already holds
// the second keeper (review-6), and lastCard kept the one sent off.
function offenderSquad(match: MatchState, w: MatchWatch, id: number): number {
  const card = match.lastCard;
  if (cardShownThisStep(match, w) && card.playerId === id) return card.squadIndex;
  return match.players[id].squadIndex;
}

function injurySquad(match: MatchState, team: 0 | 1): number {
  const id = match.pendingInjury[team] >= 0 ? match.pendingInjury[team] : match.lastInjury;
  return id < 0 ? SUBJECT_NONE : match.players[id].squadIndex;
}

// `human` is who the keyboard drives (mode.ts HumanSide): 0 or 1 in a solo mode and in
// the World Cup (S-PK3 may put the human on either side), 'both' in the two-player
// friendly, 'none' for a CPU pair watched on screen. `victoryScreen` (Task 9-5, S-FL3,
// final review §8.5): when the mode shows a victory screen for a human win, GANADOR is
// NOT queued -- the screen replaces it; FINAL still runs its three seconds and the flow
// moves on when the queue drains. Defaults keep every step-8 call and test unchanged.
//
// `abandonEliminates` (Fix round 1, finding 1): true ONLY on the viewport guard's call
// site in VaultWorldCupGame.tsx, for a match whose mode is scored (modeScores(mode),
// i.e. the World Cup) -- that call site is the sole place the component just called
// abandon() on the human's own match, so this is a signal the caller passes, not
// something collectCaptions infers from the match itself (abandon() leaves phase
// 'over' with the score untouched, exactly like a natural end, so there is no reliable
// internal tell). When true, the standing score never reaches the queue: FINAL still
// whistles, then ELIMINADO always follows, matching flow.ts's abandonHumanMatch, which
// eliminates unconditionally regardless of who was leading (G9-8). A natural end never
// passes true, so the default false keeps every other call site (including a friendly
// abandon, S-SC12, where GANADOR/EMPATE must still reflect how the match stood).
export function collectCaptions(
  match: MatchState, w: MatchWatch, human: HumanSide, cs: CaptionState, victoryScreen = false, abandonEliminates = false,
): void {
  if (!w.started) {
    pushCaption(cs, 'kickoff');
    return;
  }
  // 1. The goal first: scoreGoal moves the phase in the SAME step, so a phase-based
  //    rule would swallow it.
  const scorer = match.score[0] > w.score0 ? 0 : match.score[1] > w.score1 ? 1 : -1;
  if (scorer !== -1) {
    // G15-11 / D2: the subject is the last player to touch the ball (ball.lastTouchId,
    // written by every kick and every possession), read on the goal's own step -- the
    // kickoff after the pause gives the ball to somebody else. A touch by the team that
    // did NOT score is an own goal: the caption is ABOUT that defender, flagged ownGoal.
    const id = match.ball.lastTouchId;
    if (id === null) pushCaption(cs, 'goal', scorer);
    else {
      const toucher = match.players[id];
      pushCaption(cs, 'goal', toucher.team, toucher.squadIndex, toucher.team !== scorer);
    }
  }

  // 2. The shootout, read the way the stage B2 report prescribes: `taken` is the only
  //    reliable signal for BOTH outcomes, and `scored` separates them.
  const sh = match.shootout;
  if (sh !== null && (sh.taken[0] !== w.taken0 || sh.taken[1] !== w.taken1)) {
    // D3: GOL and FALLA both name the man who took THAT kick; the team whose `taken`
    // moved is the one that kicked.
    const kicked = sh.taken[0] !== w.taken0 ? 0 : 1;
    const id = shootoutScorerId(match, kicked);
    const squad = id < 0 ? SUBJECT_NONE : match.players[id].squadIndex;
    const scoredNow = sh.scored[0] !== w.scored0 || sh.scored[1] !== w.scored1;
    pushCaption(cs, scoredNow ? 'shootout-goal' : 'shootout-miss', kicked, squad);
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
      case 'free-kick': {
        const id = foulOffenderId(match);
        if (id < 0) pushCaption(cs, 'foul');
        else pushCaption(cs, 'foul', match.players[id].team, offenderSquad(match, w, id));
        break;
      }
      case 'penalty': {
        const sp = match.setPiece;
        if (sp === null || sp.takerId < 0) pushCaption(cs, 'penalty');
        else pushCaption(cs, 'penalty', match.players[sp.takerId].team, match.players[sp.takerId].squadIndex);
        break;
      }
      case 'corner': pushCaption(cs, 'corner'); break;
      case 'throw-in':
      case 'goal-kick': pushCaption(cs, 'out'); break;
      default: break;
    }
  }

  // 4b. G15-13 + G15-18 (V15-4-7): the card and the injury of the foul, AFTER its FALTA
  //     or PENALTI -- they come from the same step, and the whistle is the foul's.
  if (cardShownThisStep(match, w)) {
    const card = match.lastCard;
    const kind = card.card === 'red' ? 'card-red' : 'card-yellow';
    if (card.playerId < 0) pushCaption(cs, kind);
    else pushCaption(cs, kind, match.players[card.playerId].team, card.squadIndex);
  }
  const injured = injuredTeamThisStep(match, w);
  if (injured !== -1) pushCaption(cs, 'injury', injured, injurySquad(match, injured));

  // 5. The end. winnerOf is the ONE reader of the winner (stage B2 §8) and it can
  //    return -1 with the match over -- abandon() at a level score, the only draw this
  //    ruleset has (S-PK5). S-SC12: FINAL always whistles; then EMPATE on an abandon,
  //    nothing for a spectated pair (the bracket names the winner), GANADOR for a
  //    human win without a screen, ELIMINADO for a human loss.
  if (match.phase === 'over' && w.phase !== 'over') {
    pushCaption(cs, 'full-time');
    if (abandonEliminates) {
      pushCaption(cs, 'eliminated');
      return;
    }
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
  w.step = match.stepCount;
  w.injuries0 = match.injuriesUsed[0];
  w.injuries1 = match.injuriesUsed[1];
}

// Task 9-7: a new match on the same screen (no remount) reuses the queue and the watch.
export function resetCaptionState(cs: CaptionState): void {
  cs.kind = 'none';
  cs.stepsLeft = 0;
  cs.team = 0;
  cs.squad = SUBJECT_NONE;
  cs.ownGoal = false;
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
  w.step = -1;
  w.injuries0 = 0;
  w.injuries1 = 0;
}
