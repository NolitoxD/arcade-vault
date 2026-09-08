import { describe, expect, it } from 'vitest';
import { STEP_MS } from '../football-logic/clock';
import { MAX_STEPS_PER_FRAME, createStepBudget, frameMode, planSteps } from './loop';

describe('planSteps', () => {
  it('runs no step and keeps everything below one step', () => {
    const out = createStepBudget();
    planSteps(STEP_MS - 0.01, out);
    expect(out.steps).toBe(0);
    expect(out.carryMs).toBeCloseTo(STEP_MS - 0.01, 6);
  });

  it('runs exactly the whole steps and keeps the remainder', () => {
    const out = createStepBudget();
    planSteps(STEP_MS * 4 + 3, out);
    expect(out.steps).toBe(4);
    expect(out.carryMs).toBeCloseTo(3, 6);
  });

  it('caps at MAX_STEPS_PER_FRAME and DROPS the surplus', () => {
    const out = createStepBudget();
    planSteps(STEP_MS * 40, out);
    expect(out.steps).toBe(MAX_STEPS_PER_FRAME);
    // The surplus is dropped, not carried: a backgrounded tab must not spiral.
    expect(out.carryMs).toBe(0);
  });

  it('does not cap one step below the cap', () => {
    const out = createStepBudget();
    planSteps(STEP_MS * (MAX_STEPS_PER_FRAME - 1) + 1, out);
    expect(out.steps).toBe(MAX_STEPS_PER_FRAME - 1);
    expect(out.carryMs).toBeCloseTo(1, 6);
  });

  it('never returns a negative accumulator', () => {
    const out = createStepBudget();
    planSteps(-5, out);
    expect(out.steps).toBe(0);
    expect(out.carryMs).toBe(0);
  });
});

describe('frameMode', () => {
  it('runs everything while the match is live', () => {
    expect(frameMode('play', false, false)).toBe('full');
    expect(frameMode('shootout', false, false)).toBe('full');
    expect(frameMode('kickoff', false, false)).toBe('full');
  });

  it('a paused frame runs nothing at all', () => {
    expect(frameMode('play', true, false)).toBe('frozen');
    expect(frameMode('over', true, false)).toBe('frozen');
  });

  // The bug this fixes: with the match 'over' the component used to stop calling
  // update(), so the caption queue stopped being stepped and FINAL never gave way
  // to GANADOR / ELIMINADO / EMPATE (R32). The simulation stops; the caption clock
  // does not.
  it('a finished match stops the simulation but KEEPS the caption clock', () => {
    expect(frameMode('over', false, false)).toBe('captions-only');
  });

  // Same shape for the viewport guard: blocked stops the simulation and the
  // keyboard, never the drawing and never the captions -- otherwise the EMPATE
  // that QA C6-14 asks for could not appear on the canvas.
  it('a blocked viewport stops the simulation but KEEPS the caption clock', () => {
    expect(frameMode('play', false, true)).toBe('captions-only');
    expect(frameMode('over', false, true)).toBe('captions-only');
  });
});
