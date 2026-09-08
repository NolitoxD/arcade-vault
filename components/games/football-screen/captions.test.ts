import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS } from '../football-logic/teams';
import { humanProfile, profileFor } from '../football-logic/ai';
import { createShootoutState } from '../football-logic/set-pieces';
import {
  CAPTION_QUEUE_MAX, CAPTION_STEPS, CAPTION_TEXT, collectCaptions, createCaptionState,
  createMatchWatch, pushCaption, stepCaption, updateWatch, type CaptionKind,
} from './captions';

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
