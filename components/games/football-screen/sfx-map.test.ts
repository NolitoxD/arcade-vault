import { describe, expect, it } from 'vitest';
import { EXTRA_TIME_STEPS, HALF_STEPS } from '../football-logic/clock';
import { createRng } from '../football-logic/rng';
import { GOAL_PAUSE_STEPS, createMatch, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS } from '../football-logic/teams';
import { humanProfile, profileFor } from '../football-logic/ai';
import { createShootoutState } from '../football-logic/set-pieces';
import type { CaptionKind } from './captions';
import { CAPTION_TEXT, createMatchWatch, updateWatch } from './captions';
import {
  AMBIENCE_MAX, AMBIENCE_MIN, ambienceDue, ambienceSeedFor, createAmbienceMarks,
  goalCrowdDue, goalNetDue, halfEndWhistleDue, planAmbience, sfxForCaption, shotFiredThisStep,
} from './sfx-map';

function newMatch(): MatchState {
  return createMatch(
    [TEAMS[0], TEAMS[1]],
    FORMATIONS,
    PITCH,
    [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)],
  );
}

describe('sfxForCaption', () => {
  it('whistles the start of every half and of the extra time', () => {
    expect(sfxForCaption('kickoff')).toBe('whistle_start');
    expect(sfxForCaption('extra-time')).toBe('whistle_start');
  });

  it('whistles the end of a half and the end of the match', () => {
    expect(sfxForCaption('half-time')).toBe('whistle_end');
    expect(sfxForCaption('full-time')).toBe('whistle_end');
  });

  it('whistles fouls and penalties with the referee file', () => {
    expect(sfxForCaption('foul')).toBe('whistle_foul');
    expect(sfxForCaption('penalty')).toBe('whistle_foul');
  });

  it('the GOL caption is the SECOND link of the goal chain', () => {
    expect(sfxForCaption('goal')).toBe('goal_shout');
    expect(sfxForCaption('shootout-goal')).toBe('goal_shout');
  });

  it('says nothing for the captions the audio table leaves silent', () => {
    expect(sfxForCaption('out')).toBe('none');
    expect(sfxForCaption('corner')).toBe('none');
    expect(sfxForCaption('shootout-miss')).toBe('none');
    expect(sfxForCaption('winner')).toBe('none');
    expect(sfxForCaption('eliminated')).toBe('none');
    expect(sfxForCaption('draw')).toBe('none');
  });

  it('has an answer for every caption kind', () => {
    for (const key of Object.keys(CAPTION_TEXT) as CaptionKind[]) {
      expect(typeof sfxForCaption(key)).toBe('string');
    }
  });
});

describe('shotFiredThisStep', () => {
  it('is false on a clean step', () => {
    const m = newMatch();
    expect(shotFiredThisStep(m)).toBe(false);
  });

  it('is true when any of the eighteen slots holds a shot that got away', () => {
    const m = newMatch();
    m.scratch.events[7].kind = 'shot';
    m.scratch.events[7].ok = true;
    expect(shotFiredThisStep(m)).toBe(true);
  });

  it('is false for a shot that did NOT get away, and for a pass', () => {
    const m = newMatch();
    m.scratch.events[7].kind = 'shot';
    m.scratch.events[7].ok = false;
    expect(shotFiredThisStep(m)).toBe(false);
    m.scratch.events[7].kind = 'long-pass';
    m.scratch.events[7].ok = true;
    expect(shotFiredThisStep(m)).toBe(false);
  });
});

describe('goalNetDue', () => {
  // MEASURED (preflight 07-sep, three CPU-vs-CPU matches, seeds 7/11/23): after a
  // goal, scratch.call.kind stays 'goal' for 421 consecutive steps, because
  // clearRefereeCall never runs in the 'goal' or 'kickoff' phases. Reading it as a
  // level plays 421 goal_net, each one cloning an HTMLAudioElement.
  it('fires on the step the goal call appears', () => {
    const m = newMatch();
    const w = createMatchWatch();
    updateWatch(m, w);
    m.scratch.call.kind = 'goal';
    expect(goalNetDue(m, w)).toBe(true);
  });

  it('does NOT fire again while the same call is still standing', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.scratch.call.kind = 'goal';
    updateWatch(m, w);          // the watch has seen it
    expect(goalNetDue(m, w)).toBe(false);
    // ... for as long as the engine leaves it there.
    for (let i = 0; i < 421; i++) expect(goalNetDue(m, w)).toBe(false);
  });

  // The spec's audio table ties goal_net to RefereeCall.kind === 'goal' with no
  // exception, so a penalty that goes in during the shootout rings the net like any
  // other goal. Excluding the shootout by PHASE, as the first draft did, produced the
  // one thing nobody wants: every shootout goal silent EXCEPT the deciding one, whose
  // endShootout puts the phase on 'over' in the same step.
  it('fires in the shootout too: the spec ties it to the call, never to the phase', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    updateWatch(m, w);
    m.scratch.call.kind = 'goal';
    expect(goalNetDue(m, w)).toBe(true);
  });
});

describe('halfEndWhistleDue', () => {
  // Spec audio table: "whistle_end: endHalf de cada parte y phase === 'over'". Two of
  // those transitions never produce a 'half-time' caption, so sfxForCaption alone
  // leaves them silent: endHalf on a LEVEL second half jumps straight to half 3 +
  // 'kickoff' (match.ts:183-201) and endExtraTime goes 'golden-goal' -> 'shootout'.
  it('stays silent while nothing changes', () => {
    const m = newMatch();
    const w = createMatchWatch();
    updateWatch(m, w);
    expect(halfEndWhistleDue(m, w)).toBe(false);
  });

  it('whistles the end of a level second half, which never becomes half-time', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.half = 2;
    m.phase = 'play';
    updateWatch(m, w);
    m.half = 3;
    m.phase = 'kickoff';        // startKickoff, in the same step as the half change
    expect(halfEndWhistleDue(m, w)).toBe(true);
  });

  it('does NOT double up with the DESCANSO whistle at the end of the first half', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.phase = 'play';
    updateWatch(m, w);
    m.half = 2;
    m.phase = 'half-time';      // this one DOES get a caption, which whistles already
    expect(halfEndWhistleDue(m, w)).toBe(false);
  });

  it('whistles the end of the extra time when the shootout takes over', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.half = 3;
    m.phase = 'golden-goal';
    updateWatch(m, w);
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    expect(halfEndWhistleDue(m, w)).toBe(true);
  });
});

describe('goalCrowdDue', () => {
  it('fires exactly once, part way into the goal pause', () => {
    const m = newMatch();
    m.phase = 'goal';
    let fired = 0;
    for (let left = GOAL_PAUSE_STEPS; left >= 0; left--) {
      m.pauseStepsLeft = left;
      if (goalCrowdDue(m)) fired++;
    }
    expect(fired).toBe(1);
  });

  it('never fires outside the goal pause', () => {
    const m = newMatch();
    m.phase = 'play';
    m.pauseStepsLeft = 0;
    expect(goalCrowdDue(m)).toBe(false);
  });
});

describe('the crowd ambience', () => {
  it('derives a different seed for every half, so no two halves share instants', () => {
    const seed = 123456;
    const a = ambienceSeedFor(seed, 1);
    const b = ambienceSeedFor(seed, 2);
    const c = ambienceSeedFor(seed, 3);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it('is deterministic: the same seed and half give the same instants', () => {
    const marksA = createAmbienceMarks();
    const marksB = createAmbienceMarks();
    const nA = planAmbience(createRng(ambienceSeedFor(99, 1)), HALF_STEPS, marksA);
    const nB = planAmbience(createRng(ambienceSeedFor(99, 1)), HALF_STEPS, marksB);
    expect(nA).toBe(nB);
    expect(marksA.slice(0, nA)).toEqual(marksB.slice(0, nB));
  });

  it('plans two or three bursts, strictly inside the half and in order', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const marks = createAmbienceMarks();
      const n = planAmbience(createRng(ambienceSeedFor(seed, 1)), HALF_STEPS, marks);
      expect(n).toBeGreaterThanOrEqual(AMBIENCE_MIN);
      expect(n).toBeLessThanOrEqual(AMBIENCE_MAX);
      for (let i = 0; i < n; i++) {
        expect(marks[i]).toBeGreaterThan(0);
        expect(marks[i]).toBeLessThan(HALF_STEPS);
        if (i > 0) expect(marks[i]).toBeGreaterThan(marks[i - 1]);
      }
    }
  });

  it('two halves of the same match get different instants', () => {
    const first = createAmbienceMarks();
    const second = createAmbienceMarks();
    const n1 = planAmbience(createRng(ambienceSeedFor(7, 1)), HALF_STEPS, first);
    const n2 = planAmbience(createRng(ambienceSeedFor(7, 2)), HALF_STEPS, second);
    expect(first.slice(0, n1)).not.toEqual(second.slice(0, n2));
  });

  it('ambienceDue fires once per mark and never past the last one', () => {
    const marks = createAmbienceMarks();
    const n = planAmbience(createRng(ambienceSeedFor(5, 1)), HALF_STEPS, marks);
    let index = 0;
    let fired = 0;
    for (let step = 0; step <= HALF_STEPS; step++) {
      if (ambienceDue(marks, n, index, step)) {
        fired++;
        index++;
      }
    }
    expect(fired).toBe(n);
    expect(ambienceDue(marks, n, n, HALF_STEPS)).toBe(false);
  });

  // Regression for the skeleton bug the Self-Review flagged: the extra time (half 3)
  // is capped at EXTRA_TIME_STEPS, not HALF_STEPS -- a match lasting a few minutes,
  // not forty-five. Planning it with HALF_STEPS is exactly the mistake the component
  // made until Task 8-5 step 4, and it is invisible to every other test in this file
  // because they only ever pass HALF_STEPS.
  it('the extra time gets its OWN, shorter window: EXTRA_TIME_STEPS, not HALF_STEPS', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const marks = createAmbienceMarks();
      const n = planAmbience(createRng(ambienceSeedFor(seed, 3)), EXTRA_TIME_STEPS, marks);
      expect(n).toBeGreaterThanOrEqual(AMBIENCE_MIN);
      expect(n).toBeLessThanOrEqual(AMBIENCE_MAX);
      for (let i = 0; i < n; i++) {
        expect(marks[i]).toBeGreaterThan(0);
        expect(marks[i]).toBeLessThan(EXTRA_TIME_STEPS); // no mark past the real extra-time window
        if (i > 0) expect(marks[i]).toBeGreaterThan(marks[i - 1]); // strictly increasing: no repeated instants
      }
    }
  });

  it('would have caught the bug: the LAST mark planned with HALF_STEPS lands past EXTRA_TIME_STEPS', () => {
    // MEASURED (preflight 07-sep, mulberry32 of the repo, seeds 1..12): the failure
    // mode depends on how many bursts the draw gives. With count = 3 the last mark
    // falls in [3780, 5220) and ALWAYS clears 3600; with count = 2 it falls in
    // [2970, 5130) and CROSSES it -- seeds 1 and 4 give 3396 and 3260, below the cap,
    // and this assertion would go red for reasons that have nothing to do with the
    // bug. ambienceSeedFor(2, 3) draws three bursts: [882, 2124, 5080], clearing the
    // cap by 1480 steps.
    const marks = createAmbienceMarks();
    const n = planAmbience(createRng(ambienceSeedFor(2, 3)), HALF_STEPS, marks);
    // Pinned FIRST, so that if the draw ever stopped giving three bursts this test
    // would fail on the fixture and not on the assertion underneath it.
    expect(n).toBe(AMBIENCE_MAX);
    // Proof that the wrong call site is not just "less precise" but actively silent
    // for part of the extra time: the marks it plans in the second half of its window
    // fall beyond the step count halfStep ever reaches in half 3, so
    // ambienceDue(marks, n, index, match.halfStep) never fires for them.
    expect(marks[n - 1]).toBeGreaterThan(EXTRA_TIME_STEPS);
  });
});
