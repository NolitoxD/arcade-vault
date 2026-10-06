import { describe, expect, it } from 'vitest';
import { NORMAL_RULES, createMatch, type MatchState } from '../football-logic/match';
import { TEAM_SIZE } from '../football-logic/teams';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS } from '../football-logic/teams';
import { humanProfile, profileFor } from '../football-logic/ai';
import { createShootoutState, shootoutTakerId } from '../football-logic/set-pieces';
import {
  CAPTION_QUEUE_MAX, CAPTION_STEPS, CAPTION_TEXT, OWN_GOAL_PREFIX, SUBJECT_NONE, collectCaptions,
  createCaptionState, createMatchWatch, goalScoredThisStep, pushCaption, resetCaptionState, resetMatchWatch, stepCaption,
  updateWatch, type CaptionKind,
} from './captions';
import { createMatchRun, stepMatchRun } from './match-run';

function newMatch(): MatchState {
  return createMatch(
    [TEAMS[0], TEAMS[1]],
    FORMATIONS,
    PITCH,
    [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)],
  );
}

describe('CAPTION_TEXT', () => {
  it('carries the seven captions the spec names, plus the extra-time pair', () => {
    expect(CAPTION_TEXT.kickoff).toBe('INICIO');
    expect(CAPTION_TEXT.foul).toBe('FALTA');
    expect(CAPTION_TEXT.penalty).toBe('PENALTI');
    expect(CAPTION_TEXT.out).toBe('FUERA');
    expect(CAPTION_TEXT.corner).toBe('CÓRNER');
    expect(CAPTION_TEXT.goal).toBe('GOL');
    expect(CAPTION_TEXT['full-time']).toBe('FINAL');
    expect(CAPTION_TEXT['extra-time']).toBe('PRÓRROGA');
    expect(CAPTION_TEXT.shootout).toBe('PENALTIS');
    expect(CAPTION_TEXT.eliminated).toBe('ELIMINADO');
    expect(CAPTION_TEXT.draw).toBe('EMPATE');
  });

  // G15-13 + G15-18 (V15-4-7): the card and injury captions.
  it('carries the card and injury captions, the cards as short as a FALTA (G15-13: no extra pause)', () => {
    expect(CAPTION_TEXT['card-yellow']).toBe('TARJETA AMARILLA');
    expect(CAPTION_TEXT['card-red']).toBe('TARJETA ROJA');
    expect(CAPTION_TEXT.injury).toBe('LESIÓN');
    expect(CAPTION_STEPS['card-yellow']).toBe(CAPTION_STEPS.foul);
    expect(CAPTION_STEPS['card-red']).toBe(CAPTION_STEPS.foul);
    expect(CAPTION_STEPS.injury).toBe(CAPTION_STEPS.foul);
  });

  it('every caption has a positive duration', () => {
    for (const key of Object.keys(CAPTION_TEXT) as CaptionKind[]) {
      expect(CAPTION_STEPS[key]).toBeGreaterThan(0);
    }
  });
});

describe('the caption queue', () => {
  it('shows the first caption straight away and queues the next', () => {
    const cs = createCaptionState();
    expect(cs.kind).toBe('none');
    pushCaption(cs, 'goal');
    expect(cs.kind).toBe('goal');
    expect(cs.stepsLeft).toBe(CAPTION_STEPS.goal);
    pushCaption(cs, 'full-time');
    expect(cs.kind).toBe('goal');
    expect(cs.queueLen).toBe(1);
  });

  it('pops the queue when the current caption runs out', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'foul');
    pushCaption(cs, 'penalty');
    for (let i = 0; i < CAPTION_STEPS.foul; i++) stepCaption(cs);
    expect(cs.kind).toBe('penalty');
    expect(cs.queueLen).toBe(0);
    for (let i = 0; i < CAPTION_STEPS.penalty; i++) stepCaption(cs);
    expect(cs.kind).toBe('none');
  });

  it('does not queue the caption that is already showing', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'goal');
    pushCaption(cs, 'goal');
    expect(cs.queueLen).toBe(0);
  });

  it('drops what does not fit instead of growing the array', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'goal');
    for (let i = 0; i < 20; i++) pushCaption(cs, i % 2 === 0 ? 'foul' : 'corner');
    // Fixed-length array, never grown: the length is the constant it was built with,
    // not "whatever it happens to be".
    expect(cs.queue.length).toBe(CAPTION_QUEUE_MAX);
    expect(cs.queueLen).toBeLessThanOrEqual(CAPTION_QUEUE_MAX);
  });

  // The end of the match is a QUEUE, not a single caption: collectCaptions leaves
  // FINAL showing with GANADOR / ELIMINADO / EMPATE waiting behind it. If the
  // component stops stepping the queue when the match ends, the screen freezes on
  // FINAL and the result is never drawn (R32) -- that is what loop.ts's
  // frameMode('over', …) === 'captions-only' exists to prevent.
  it('the result caption replaces FINAL when the queue keeps being stepped', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'full-time');
    pushCaption(cs, 'winner');
    expect(cs.kind).toBe('full-time');
    for (let i = 0; i < CAPTION_STEPS['full-time']; i++) stepCaption(cs);
    expect(cs.kind).toBe('winner');
    expect(cs.queueLen).toBe(0);
  });

  it('resetCaptionState and resetMatchWatch bring both back to the freshly created state, in place', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'goal');
    pushCaption(cs, 'full-time');
    const queue = cs.queue;
    resetCaptionState(cs);
    expect(cs.kind).toBe('none');
    expect(cs.stepsLeft).toBe(0);
    expect(cs.queueLen).toBe(0);
    expect(cs.queue).toBe(queue);
    const w = createMatchWatch();
    const m = newMatch();
    m.score[0] = 2;
    updateWatch(m, w);
    resetMatchWatch(w);
    expect(w).toEqual(createMatchWatch());
  });
});

describe('collectCaptions', () => {
  it('fires INICIO on the very first look at the match, and not again next step', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('kickoff');
    updateWatch(m, w);
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('none');
  });

  it('fires GOL when the score goes up, and only on that step', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.score[0] = 1;
    m.phase = 'goal';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('goal');
    updateWatch(m, w);
    const cs3 = createCaptionState();
    collectCaptions(m, w, 0, cs3);
    expect(cs3.kind).toBe('none');
  });

  it('turns a referee call into its caption', () => {
    const cases: [string, CaptionKind][] = [
      ['free-kick', 'foul'],
      ['penalty', 'penalty'],
      ['corner', 'corner'],
      ['throw-in', 'out'],
      ['goal-kick', 'out'],
    ];
    for (const [kind, caption] of cases) {
      const m = newMatch();
      const w = createMatchWatch();
      const cs = createCaptionState();
      collectCaptions(m, w, 0, cs);
      updateWatch(m, w);
      m.phase = 'set-piece';
      m.scratch.call.kind = kind as MatchState['scratch']['call']['kind'];
      const cs2 = createCaptionState();
      collectCaptions(m, w, 0, cs2);
      expect(cs2.kind).toBe(caption);
    }
  });

  // MEASURED (preflight 07-sep, three full CPU-vs-CPU matches, seeds 7/11/23):
  // scratch.call is a LEVEL, not an edge. clearRefereeCall only runs inside
  // stepOpenPlay and stepShootout, so the 'kickoff' / 'set-piece' / 'goal' /
  // 'half-time' phases leave it standing -- 301 steps for a restart, 421 for a goal,
  // with no variance between seeds. Without an edge detector the FALTA caption is
  // re-pushed the instant its 90 steps run out, with its whistle again, three or
  // four times per foul. This is the "step after" half of the anti-coincidence rule
  // of the Global Constraints, which every other call had missing.
  it('fires FALTA on the step the call appears and NOT on the next one, with the call still standing', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.phase = 'set-piece';
    m.scratch.call.kind = 'free-kick';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('foul');
    updateWatch(m, w);

    // The engine has NOT cleared the call: same kind, next step.
    const cs3 = createCaptionState();
    collectCaptions(m, w, 0, cs3);
    expect(cs3.kind).toBe('none');
    updateWatch(m, w);

    // And it fires again once the call really is a new one.
    m.scratch.call.kind = 'corner';
    const cs4 = createCaptionState();
    collectCaptions(m, w, 0, cs4);
    expect(cs4.kind).toBe('corner');
  });

  // The other half of the same rule, over the FULL measured life of the level rather
  // than a single step after it: 301 steps is what a restart call stands for
  // (preflight 07-sep, seeds 7/11/23, no variance). Without the `!== w.call` guard
  // this counter reads 301, not 1, and the player hears 301 foul whistles.
  it('fires exactly ONE caption while a restart call stands for its measured 301 steps', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs0 = createCaptionState();
    collectCaptions(m, w, 0, cs0);
    updateWatch(m, w);

    m.phase = 'set-piece';
    m.scratch.call.kind = 'free-kick';
    let fired = 0;
    for (let i = 0; i < 301; i++) {
      const cs = createCaptionState();
      collectCaptions(m, w, 0, cs);
      if (cs.kind !== 'none') fired++;
      updateWatch(m, w);
    }
    expect(fired).toBe(1);
  });

  // A goal call stands for 421 steps (same preflight). The GOL caption comes from the
  // score edge, not from the call, and the call itself must stay unmapped: 421 steps
  // of a standing 'goal' call must not add a single caption of their own.
  it('fires exactly ONE caption while a goal call stands for its measured 421 steps', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs0 = createCaptionState();
    collectCaptions(m, w, 0, cs0);
    updateWatch(m, w);

    m.score[0] = 1;
    m.phase = 'goal';
    m.scratch.call.kind = 'goal';
    let fired = 0;
    for (let i = 0; i < 421; i++) {
      const cs = createCaptionState();
      collectCaptions(m, w, 0, cs);
      if (cs.kind !== 'none') fired++;
      updateWatch(m, w);
    }
    expect(fired).toBe(1);
  });

  // H7: endHalf on a LEVEL second half sets half = 3 and calls startKickoff in the
  // same step (match.ts), so the half edge and the kickoff phase edge arrive
  // together. Both captions map to whistle_start, which would blow two start
  // whistles three seconds apart. PRÓRROGA wins: it says more and it whistles once.
  it('does not stack INICIO on top of PRÓRROGA when the extra time starts', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.phase = 'play';
    updateWatch(m, w);

    m.half = 3;
    m.phase = 'kickoff';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('extra-time');
    expect(cs2.queueLen).toBe(0);
  });

  it('IGNORES the phantom restart call of the shootout (stage B2 carry #3)', () => {
    // judgeShootoutKick leaves a one-step 'throw-in' in scratch.call when a kick
    // leaves the field. It is not a real restart and must not print FUERA.
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    updateWatch(m, w);
    m.scratch.call.kind = 'throw-in';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('none');
  });

  it('IGNORES that phantom restart even when the deciding kick ended the match in the same step', () => {
    // Task 8-3 review, minor 1: stepShootout clears the call, judgeShootoutKick can
    // leave a restart standing, and finishShootoutKick calls endShootout in the SAME
    // step -- so the screen sees phase 'over' with the phantom still there and with
    // nothing left to clear it (stepMatch returns immediately on 'over'). The watch
    // is what remembers the step came out of the shootout.
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    updateWatch(m, w);

    // The deciding kick: taken and scored move, the call is left standing, and the
    // phase is already 'over'.
    m.shootout.taken[0] = 5;
    m.shootout.scored[0] = 3;
    m.shootout.taken[1] = 5;
    m.shootout.scored[1] = 1;
    m.scratch.call.kind = 'throw-in';
    m.phase = 'over';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);

    expect(cs2.kind).toBe('shootout-goal');
    // FINAL and GANADOR, and no FUERA wedged between them.
    expect(cs2.queue.slice(0, cs2.queueLen)).toEqual(['full-time', 'winner']);
  });

  it('fires PRÓRROGA when the half becomes 3 and PENALTIS when the shootout starts', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.half = 3;
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('extra-time');
    updateWatch(m, w);

    m.phase = 'shootout';
    m.shootout = createShootoutState();
    const cs3 = createCaptionState();
    collectCaptions(m, w, 0, cs3);
    expect(cs3.kind).toBe('shootout');
  });

  it('tells a shootout goal from a shootout miss by the two counters', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.shootout.taken[0] = 1;
    m.shootout.scored[0] = 1;
    const csGoal = createCaptionState();
    collectCaptions(m, w, 0, csGoal);
    expect(csGoal.kind).toBe('shootout-goal');
    updateWatch(m, w);

    m.shootout.taken[1] = 1;
    const csMiss = createCaptionState();
    collectCaptions(m, w, 0, csMiss);
    expect(csMiss.kind).toBe('shootout-miss');
  });

  it('ends with FINAL and then the result, from the human team point of view', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.score[0] = 2;
    m.score[1] = 1;
    m.phase = 'over';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('goal');
    expect(cs2.queueLen).toBe(2);
    expect(cs2.queue[0]).toBe('full-time');
    expect(cs2.queue[1]).toBe('winner');
  });

  it('says ELIMINADO when the human loses', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.score[1] = 1;
    m.phase = 'over';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.queue[cs2.queueLen - 1]).toBe('eliminated');
  });

  it('says EMPATE, never GANADOR nor ELIMINADO, when the match was abandoned with no winner', () => {
    // Stage B2 §8: winnerOf can return -1 with the match over (abandon inside the
    // shootout). S-SC12 (confirmed by owner 2026-09-07): that is the only draw this
    // ruleset has, and it gets its own caption instead of silence.
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.phase = 'over';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('full-time');
    expect(cs2.queueLen).toBe(1);
    expect(cs2.queue[0]).toBe('draw');
  });
});

// ── Task 9-5: the ending as seen from each HumanSide, with and without a victory screen ──
describe('collectCaptions at the end of the match, by HumanSide', () => {
  function over(homeGoals: number, awayGoals: number): { m: MatchState; w: ReturnType<typeof createMatchWatch> } {
    const m = newMatch();
    const w = createMatchWatch();
    collectCaptions(m, w, 0, createCaptionState());
    m.score[0] = homeGoals;
    m.score[1] = awayGoals;
    // The goals are already "seen" by the watch: only the end is an edge here, so the
    // queue starts at FINAL and not at GOL.
    updateWatch(m, w);
    m.phase = 'over';
    return { m, w };
  }

  function queued(cs: ReturnType<typeof createCaptionState>): string[] {
    const out: string[] = [cs.kind];
    for (let i = 0; i < cs.queueLen; i++) out.push(cs.queue[i]);
    return out;
  }

  it('team 0 human, no screen: FINAL then GANADOR on a win, ELIMINADO on a loss (the step-8 behaviour, untouched)', () => {
    const win = over(2, 1);
    const csWin = createCaptionState();
    collectCaptions(win.m, win.w, 0, csWin);
    expect(queued(csWin)).toEqual(['full-time', 'winner']);
    const loss = over(0, 1);
    const csLoss = createCaptionState();
    collectCaptions(loss.m, loss.w, 0, csLoss);
    expect(queued(csLoss)).toEqual(['full-time', 'eliminated']);
  });

  // S-FL3 (final review §8.5): the victory screen REPLACES the GANADOR caption; it
  // does not follow it. FINAL still plays its three seconds. ELIMINADO is unaffected.
  it('with a victory screen, a human win queues FINAL only; a loss still queues ELIMINADO', () => {
    const win = over(2, 1);
    const cs = createCaptionState();
    collectCaptions(win.m, win.w, 0, cs, true);
    expect(queued(cs)).toEqual(['full-time']);
    const loss = over(0, 1);
    const cs2 = createCaptionState();
    collectCaptions(loss.m, loss.w, 0, cs2, true);
    expect(queued(cs2)).toEqual(['full-time', 'eliminated']);
  });

  it('team 1 human reads the same match the other way round', () => {
    const { m, w } = over(2, 1);
    const cs = createCaptionState();
    collectCaptions(m, w, 1, cs);
    expect(queued(cs)).toEqual(['full-time', 'eliminated']);
  });

  it("'both' (two-player friendly): whoever wins is a winner, never eliminated; with the screen, FINAL only", () => {
    const { m, w } = over(0, 3);
    const cs = createCaptionState();
    collectCaptions(m, w, 'both', cs);
    expect(queued(cs)).toEqual(['full-time', 'winner']);
    const cs2 = createCaptionState();
    collectCaptions(m, w, 'both', cs2, true);
    expect(queued(cs2)).toEqual(['full-time']);
  });

  it("'none' (a CPU pair watched on screen): FINAL only, the bracket says who won", () => {
    const { m, w } = over(1, 0);
    const cs = createCaptionState();
    collectCaptions(m, w, 'none', cs);
    expect(queued(cs)).toEqual(['full-time']);
  });

  it('an abandon at level is EMPATE for every side, screen or not', () => {
    for (const side of [0, 1, 'both', 'none'] as const) {
      for (const screen of [false, true]) {
        const { m, w } = over(1, 1);   // level, no shootout: winnerOf === -1
        const cs = createCaptionState();
        collectCaptions(m, w, side, cs, screen);
        expect(queued(cs)).toEqual(['full-time', 'draw']);
      }
    }
  });

  // Fix round 1, finding 1: the World Cup viewport guard abandons the human's match
  // (phase 'over', score untouched) and must read as FINAL + ELIMINADO regardless of
  // the standing score, matching abandonHumanMatch's unconditional 'eliminated' in
  // flow.ts. The sixth parameter is only ever true on that one call site.
  it('abandonEliminates queues ELIMINADO after FINAL whether the human was leading or level', () => {
    const leading = over(2, 1);
    const csLeading = createCaptionState();
    collectCaptions(leading.m, leading.w, 0, csLeading, false, true);
    expect(queued(csLeading)).toEqual(['full-time', 'eliminated']);

    const level = over(1, 1);
    const csLevel = createCaptionState();
    collectCaptions(level.m, level.w, 0, csLevel, false, true);
    expect(queued(csLevel)).toEqual(['full-time', 'eliminated']);
  });

  // Control: the friendly semantics (S-SC12) are unaffected when abandonEliminates is
  // left at its default false -- an abandon while leading still reads as GANADOR.
  it('control: without abandonEliminates, abandoning while leading still queues GANADOR', () => {
    const leading = over(2, 1);
    const cs = createCaptionState();
    collectCaptions(leading.m, leading.w, 0, cs, false, false);
    expect(queued(cs)).toEqual(['full-time', 'winner']);
  });
});

// G15-13 + G15-18 (V15-4-7). match.lastCard and match.lastInjury are engine flanks that
// last ONE step. The card is read against the watch (a step the watch has not seen yet),
// the injury from the monotonic injuriesUsed counter -- so a second look at the same step
// (the viewport guard) never repeats them, and a step the screen only looks at after the
// flank was cleared never loses an injury.
describe('collectCaptions: cards and injuries', () => {
  function started(m: MatchState) {
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    resetCaptionState(cs);
    return { w, cs };
  }

  it('queues TARJETA AMARILLA after the FALTA of the same step, and TARJETA ROJA for a red', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    m.stepCount++;
    m.scratch.call.kind = 'free-kick';
    m.lastCard.playerId = TEAM_SIZE + 4;
    m.lastCard.squadIndex = 6;
    m.lastCard.card = 'yellow';
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('foul');
    expect(cs.queue.slice(0, cs.queueLen)).toEqual(['card-yellow']);
    updateWatch(m, w);
    m.stepCount++;
    m.lastCard.card = 'red';
    collectCaptions(m, w, 0, cs);
    expect(cs.queue.slice(0, cs.queueLen)).toEqual(['card-yellow', 'card-red']);
  });

  it('does NOT queue the card again when the screen looks twice at the same step (the viewport guard)', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    m.stepCount++;
    m.lastCard.card = 'yellow';
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('card-yellow');
    // handleResize: updateWatch, abandon, collectCaptions -- with no stepMatch in between,
    // so the flank is still standing.
    updateWatch(m, w);
    resetCaptionState(cs);
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('none');
  });

  it('LESIÓN comes from the injuriesUsed counter, not from the one-step lastInjury flank', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    // A window for team 1: lastInjury is -1 (it is only set for a keeper with no
    // replacement), so a reader of the flank would see nothing at all.
    m.stepCount++;
    m.injuriesUsed[1] = 1;
    m.pendingInjury[1] = TEAM_SIZE + 6;
    m.phase = 'injury';
    expect(m.lastInjury).toBe(-1);
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('injury');
    updateWatch(m, w);
    resetCaptionState(cs);
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('none');
  });

  it('a keeper flagged with no replacement (no window) gets LESIÓN once too', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    m.stepCount++;
    m.injuriesUsed[0] = 1;
    m.lastInjury = 0;
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('injury');
    updateWatch(m, w);
    resetCaptionState(cs);
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('none');
  });
});

// ── G15-11 (V15-5): who each caption is about ─────────────────────────────────
// The subject travels WITH the caption through the queue, so two captions about two
// players never share one name slot (the V15-4 review: a second card inside 3 s renamed
// the first one while it was still waiting).
describe('G15-11: every caption carries its own subject', () => {
  function started(m: MatchState) {
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    resetCaptionState(cs);
    return { w, cs };
  }

  it('pushCaption carries the subject (and the own-goal mark) with the caption, and stepCaption hands it over with the kind', () => {
    const cs = createCaptionState();
    // Two DIFFERENT subjects on purpose: with the same one, a stepCaption that forgot to
    // hand the subject over would still show the right name, by coincidence.
    pushCaption(cs, 'foul', 1, 7);
    pushCaption(cs, 'injury', 0, 2);
    pushCaption(cs, 'goal', 1, 4, true);   // an own goal by player 4 of team 1 (D2): the mark travels too
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['foul', 1, 7, false]);
    for (let i = 0; i < CAPTION_STEPS.foul; i++) stepCaption(cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['injury', 0, 2, false]);
    for (let i = 0; i < CAPTION_STEPS.injury; i++) stepCaption(cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['goal', 1, 4, true]);
    for (let i = 0; i < CAPTION_STEPS.goal; i++) stepCaption(cs);
    expect([cs.kind, cs.squad, cs.ownGoal]).toEqual(['none', SUBJECT_NONE, false]);
  });

  it('two cards for two players keep a name each, also back to back (the single name slot of V15-4 is gone)', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'foul', 0, 3);
    pushCaption(cs, 'card-yellow', 0, 3);
    pushCaption(cs, 'foul', 1, 9);
    pushCaption(cs, 'card-yellow', 1, 9);
    expect(cs.queue.slice(0, cs.queueLen)).toEqual(['card-yellow', 'foul', 'card-yellow']);
    expect(cs.queueSquad.slice(0, cs.queueLen)).toEqual([3, 9, 9]);
    expect(cs.queueTeam.slice(0, cs.queueLen)).toEqual([0, 1, 1]);
    // The same kind about a DIFFERENT player, straight after: queued, not swallowed.
    const back = createCaptionState();
    pushCaption(back, 'card-yellow', 0, 3);
    pushCaption(back, 'card-yellow', 1, 9);
    expect([back.queueLen, back.queue[0], back.queueSquad[0]]).toEqual([1, 'card-yellow', 9]);
  });

  it('the same caption about the same player is still queued once', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'foul', 1, 9);
    // The subject is part of the state: this line is what puts the test in red before the
    // code exists (the old state has no team/squad), so it is not an empty test.
    expect([cs.kind, cs.team, cs.squad]).toEqual(['foul', 1, 9]);
    pushCaption(cs, 'foul', 1, 9);
    expect(cs.queueLen).toBe(0);
    pushCaption(cs, 'card-red', 1, 9);
    pushCaption(cs, 'card-red', 1, 9);
    expect(cs.queueLen).toBe(1);
    // A caption with no subject keeps the old rule.
    pushCaption(cs, 'full-time');
    pushCaption(cs, 'full-time');
    expect(cs.queue.slice(0, cs.queueLen)).toEqual(['card-red', 'full-time']);
  });

  it('GOL names the last player to touch the ball; in an own goal that is the DEFENDER, flagged ownGoal; nobody when nobody touched it', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    const scorer = m.players[TEAM_SIZE + 9];
    m.ball.lastTouchId = scorer.id;
    m.score[1] = 1;
    m.phase = 'goal';
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['goal', 1, scorer.squadIndex, false]);
    expect(scorer.squadIndex).toBeGreaterThanOrEqual(0);
    updateWatch(m, w);
    resetCaptionState(cs);
    // A team-0 defender put it in his own net: team 1 scores, but the caption is ABOUT the
    // defender (D2: "EN PROPIA · <defender's name>"), so it carries HIS team and squad index.
    const defender = m.players[4];
    expect(defender.team).toBe(0);
    m.ball.lastTouchId = defender.id;
    m.score[1] = 2;
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['goal', 0, defender.squadIndex, true]);
    expect(OWN_GOAL_PREFIX).toBe('EN PROPIA · ');
    updateWatch(m, w);
    resetCaptionState(cs);
    m.ball.lastTouchId = null;
    m.score[0] = 1;
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['goal', 0, SUBJECT_NONE, false]);
  });

  it('GOL of the shootout names the man who took THAT kick, not the next taker the engine already put on the spot', () => {
    const m = newMatch();
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    const { w, cs } = started(m);
    // Team 0's third kick went in. The next taker of the SAME team is used as the trap:
    // the two teams' default lineups share squad indices slot by slot, so only a taker
    // of the same team tells a right name from a wrong one.
    m.shootout.taken[0] = 3;
    m.shootout.scored[0] = 1;
    m.shootout.taken[1] = 2;
    m.shootout.team = 1;
    m.shootout.takerId = shootoutTakerId(0, 3);
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    const scorer = m.players[shootoutTakerId(0, 2)];
    const next = m.players[shootoutTakerId(0, 3)];
    expect([cs.kind, cs.team, cs.squad]).toEqual(['shootout-goal', 0, scorer.squadIndex]);
    expect(scorer.squadIndex).not.toBe(next.squadIndex);
  });

  it('FALTA names the offender of the step\'s foul and PENALTI the taker who will kick it', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    const offender = m.players[TEAM_SIZE + 5];
    const victim = m.players[3];
    const ev = m.scratch.events[offender.id];
    ev.kind = 'tackle';
    ev.foul = true;
    ev.actorId = offender.id;
    ev.victimId = victim.id;
    m.scratch.call.kind = 'free-kick';
    m.phase = 'set-piece';
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad]).toEqual(['foul', 1, offender.squadIndex]);

    const p = newMatch();
    const s = started(p);
    const taker = p.players[7];
    p.setPiece = p.scratch.setPiece;
    p.setPiece.kind = 'penalty';
    p.setPiece.takerId = taker.id;
    p.scratch.call.kind = 'penalty';
    p.phase = 'set-piece';
    p.stepCount++;
    collectCaptions(p, s.w, 0, s.cs);
    expect([s.cs.kind, s.cs.team, s.cs.squad]).toEqual(['penalty', 0, taker.squadIndex]);
  });

  it('TARJETA names the carded man from lastCard (not the slot) and LESIÓN the injured one, each in its own caption', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    const fouler = m.players[TEAM_SIZE + 4];
    const victim = m.players[6];
    const ev = m.scratch.events[fouler.id];
    ev.kind = 'tackle';
    ev.foul = true;
    ev.actorId = fouler.id;
    ev.victimId = victim.id;
    m.scratch.call.kind = 'free-kick';
    m.lastCard.playerId = fouler.id;
    m.lastCard.squadIndex = fouler.squadIndex;
    m.lastCard.card = 'yellow';
    m.injuriesUsed[0] = 1;
    m.pendingInjury[0] = victim.id;
    m.phase = 'injury';
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad]).toEqual(['foul', 1, fouler.squadIndex]);
    expect(cs.queue.slice(0, cs.queueLen)).toEqual(['card-yellow', 'injury']);
    expect(cs.queueTeam.slice(0, cs.queueLen)).toEqual([1, 0]);
    expect(cs.queueSquad.slice(0, cs.queueLen)).toEqual([fouler.squadIndex, victim.squadIndex]);

    // A keeper's red: the slot already holds the second keeper (squad 1) when the screen
    // looks, and the caption must still name the one sent off (squad 0) -- review-6.
    const k = newMatch();
    const s = started(k);
    k.players[0].squadIndex = 1;
    k.lastCard.playerId = 0;
    k.lastCard.squadIndex = 0;
    k.lastCard.card = 'red';
    k.stepCount++;
    collectCaptions(k, s.w, 0, s.cs);
    expect([s.cs.kind, s.cs.team, s.cs.squad]).toEqual(['card-red', 0, 0]);
  });

  // MEASURED 06-oct: CPU v CPU, seed 16, difficulty 5, ESPAÑA v ITALIA in 4-4-2 ends 0-0
  // and goes to penalties, where team 0 scores three (0-0, 3-0 on penalties) and team 1
  // misses its three (pre-flight). On the step of each kick the engine has ALREADY put the
  // next taker on the spot, so this one run covers the GOL and the FALLA (D3) of the shootout.
  it('a real shootout (CPU v CPU, seed 16): every GOL and every FALLA, read step by step, names the man who took THAT kick', () => {
    const run = createMatchRun(TEAMS[0], TEAMS[1], 16, 5, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const w = createMatchWatch();
    const cs = createCaptionState();
    let named = 0;
    let missed = 0;
    for (let i = 0; i < 20_000 && m.phase !== 'over'; i++) {
      const takerBefore = m.shootout === null ? -1 : m.shootout.takerId;
      stepMatchRun(run);
      resetCaptionState(cs);
      collectCaptions(m, w, 'none', cs);
      updateWatch(m, w);
      if (cs.kind !== 'shootout-goal' && cs.kind !== 'shootout-miss') continue;
      expect(takerBefore).toBeGreaterThanOrEqual(0);
      expect([cs.team, cs.squad]).toEqual([m.players[takerBefore].team, m.players[takerBefore].squadIndex]);
      if (cs.kind === 'shootout-goal') {
        expect(m.shootout === null ? -1 : m.shootout.takerId).not.toBe(takerBefore);
        named++;
      } else missed++;
    }
    expect(named).toBe(3);
    expect(missed).toBeGreaterThan(0);
  });

  it('goalScoredThisStep: the team that scored on this step, in open play or in the shootout; -1 for a post, a miss and the step after', () => {
    const m = newMatch();
    const w = createMatchWatch();
    collectCaptions(m, w, 0, createCaptionState());
    updateWatch(m, w);
    m.ball.frameHit = 'post';
    m.stepCount++;
    expect(goalScoredThisStep(m, w)).toBe(-1);
    m.score[1] = 1;
    expect(goalScoredThisStep(m, w)).toBe(1);
    updateWatch(m, w);
    expect(goalScoredThisStep(m, w)).toBe(-1);
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    updateWatch(m, w);
    m.shootout.taken[0] = 1;
    expect(goalScoredThisStep(m, w)).toBe(-1);      // a miss: taken moved, scored did not
    m.shootout.scored[0] = 1;
    expect(goalScoredThisStep(m, w)).toBe(0);
  });
});
