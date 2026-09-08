import { describe, expect, it } from 'vitest';
import { EXTRA_TIME_STEPS, HALF_STEPS, STEP_MS } from '../football-logic/clock';
import { createTeamInput, type ButtonState } from '../football-logic/input';
import { createRng } from '../football-logic/rng';
import { createPadState, padAdvance, padDown, padToTeamInput } from './keyboard';
import { createStepBudget } from './loop';
import { AMBIENCE_MAX, createAmbienceMarks } from './sfx-map';
import { createFramePlan, planFrame, planHalfAmbience } from './match-loop';

// 1000 / 144 = 6.944 ms: two of these do not add up to one 16.667 ms step, three do.
// That is the panel the H3 finding is about -- on 60 Hz every frame plans a step and
// the bug is invisible.
const FRAME_144 = 1000 / 144;

describe('planFrame', () => {
  it('a paused frame banks no time, plans no step and consumes no pad edge', () => {
    const budget = createStepBudget();
    const plan = createFramePlan();
    // 12 ms of carry: a real accumulator caught mid-step, which must still be there
    // when the player resumes -- and must not have grown by this frame.
    const carry = planFrame('play', true, false, 12, FRAME_144, budget, plan);
    expect(plan.mode).toBe('frozen');
    expect(plan.steps).toBe(0);
    expect(plan.advancePad).toBe(false);
    expect(carry).toBe(12);
  });

  it('a 144 Hz frame with nothing banked plans no step and refuses to advance the pad', () => {
    const budget = createStepBudget();
    const plan = createFramePlan();
    const carry = planFrame('play', false, false, 0, FRAME_144, budget, plan);
    expect(plan.mode).toBe('full');
    expect(plan.steps).toBe(0);
    expect(plan.advancePad).toBe(false);
    expect(carry).toBeCloseTo(FRAME_144, 6);
  });

  it('advances the pad only on a frame that really ran a step', () => {
    const budget = createStepBudget();
    const plan = createFramePlan();
    planFrame('play', false, false, 0, STEP_MS + 1, budget, plan);
    expect(plan.steps).toBe(1);
    expect(plan.advancePad).toBe(true);
  });

  it('a captions-only frame spends steps on the queue but never on the pad', () => {
    const budget = createStepBudget();
    const plan = createFramePlan();
    // 'over' and a tripped viewport guard are the two causes; both must behave alike.
    planFrame('over', false, false, 0, STEP_MS * 3, budget, plan);
    expect(plan.mode).toBe('captions-only');
    expect(plan.steps).toBe(3);
    expect(plan.advancePad).toBe(false);
    planFrame('play', false, true, 0, STEP_MS * 3, budget, plan);
    expect(plan.mode).toBe('captions-only');
    expect(plan.steps).toBe(3);
    expect(plan.advancePad).toBe(false);
  });

  // H3, the finding the Task 8-1 review carried here: its keyboard.test.ts namesake
  // represented the zero-step frame by doing nothing, so it could not fail. This one
  // drives three real 144 Hz frames through planFrame and the pad, and pins the
  // difference against a pad advanced on every frame -- the very bug -- which ends
  // the run 'held' and hands the engine a shot the player never charged.
  it('a press survives the frames in which no step ran and reaches the first step as an edge', () => {
    const budget = createStepBudget();
    const plan = createFramePlan();
    const pad = createPadState('neutral', 0);
    const bug = createPadState('neutral', 0);
    const input = createTeamInput();
    padDown(pad, 'a');
    padDown(bug, 'a');

    let carry = 0;
    let steps = 0;
    let seenByStep: ButtonState = 'up';
    let seenByStepWithBug: ButtonState = 'up';
    for (let frame = 0; frame < 3; frame++) {
      carry = planFrame('play', false, false, carry, FRAME_144, budget, plan);
      steps += plan.steps;
      if (plan.steps > 0) {
        padToTeamInput(pad, true, input);
        seenByStep = input.a;
        padToTeamInput(bug, true, input);
        seenByStepWithBug = input.a;
      }
      if (plan.advancePad) padAdvance(pad);
      padAdvance(bug); // the bug: once per frame, step or no step
    }

    // Three 144 Hz frames are 20.83 ms: exactly one step, planned by the third.
    expect(steps).toBe(1);
    // What stepMatch would receive: a real 'pressed' edge, which actions.ts turns
    // into a shot -- against the 'held' the per-frame advance leaves, which it does
    // not, so the tap is simply lost.
    expect(seenByStep).toBe('pressed');
    expect(seenByStepWithBug).toBe('held');
  });
});

describe('planHalfAmbience', () => {
  // Seed 2 draws AMBIENCE_MAX marks in BOTH halves (asserted below), so the two rows
  // are compared mark for mark rather than through a different count -- and its third
  // mark of half 1 lands at 3 875, past the whole extra time, which is what makes the
  // window difference visible at all.
  const SEED = 2;

  it('plans the extra time over its own shorter window, not a full half', () => {
    const marks = createAmbienceMarks();
    const inExtra = planHalfAmbience(SEED, 3, marks);
    expect(inExtra).toBe(AMBIENCE_MAX);
    for (let i = 0; i < inExtra; i++) expect(marks[i]).toBeLessThan(EXTRA_TIME_STEPS);

    const first = planHalfAmbience(SEED, 1, marks);
    expect(first).toBe(AMBIENCE_MAX);
    // The counter-proof: the same seed over a first half puts its last burst beyond
    // the extra time's own cap, so planning half 3 with HALF_STEPS would silently
    // drop it -- halfStep never reaches 3 875 in a 3 600-step extra time.
    expect(marks[first - 1]).toBeGreaterThan(EXTRA_TIME_STEPS);
    expect(marks[first - 1]).toBeLessThan(HALF_STEPS);
  });

  it('draws from its own stream and leaves the match rng untouched', () => {
    const matchRng = createRng(SEED);
    const expected = createRng(SEED);
    expect(matchRng()).toBe(expected());

    const marks = createAmbienceMarks();
    planHalfAmbience(SEED, 1, marks);
    planHalfAmbience(SEED, 2, marks);
    planHalfAmbience(SEED, 3, marks);

    // If planning ever consumed the match rng, this second draw would skip ahead of
    // the reference stream and the simulation would depend on the audio layer.
    expect(matchRng()).toBe(expected());
  });

  it('gives each half different instants from the same seed', () => {
    const a = createAmbienceMarks();
    const b = createAmbienceMarks();
    planHalfAmbience(SEED, 1, a);
    planHalfAmbience(SEED, 2, b);
    expect(a[0]).not.toBe(b[0]);
  });
});
