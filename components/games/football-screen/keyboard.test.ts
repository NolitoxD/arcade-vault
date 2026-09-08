import { describe, expect, it } from 'vitest';
import { createTeamInput } from '../football-logic/input';
import { FORMATION_COUNT } from '../football-logic/teams';
import { checkTeamInput } from '../football-logic/input';
import {
  createPadState, padAdvance, padBlur, padChoice, padClear, padDown, padKeyFor, padToTeamInput, padUp,
} from './keyboard';

describe('padKeyFor', () => {
  it('maps both the arrows and WASD to the d-pad, and jkl to A/B/C', () => {
    expect(padKeyFor('arrowup')).toBe('up');
    expect(padKeyFor('w')).toBe('up');
    expect(padKeyFor('arrowdown')).toBe('down');
    expect(padKeyFor('s')).toBe('down');
    expect(padKeyFor('arrowleft')).toBe('left');
    expect(padKeyFor('a')).toBe('left');
    expect(padKeyFor('arrowright')).toBe('right');
    expect(padKeyFor('d')).toBe('right');
    expect(padKeyFor('j')).toBe('a');
    expect(padKeyFor('k')).toBe('b');
    expect(padKeyFor('l')).toBe('c');
  });

  it('ignores anything else', () => {
    expect(padKeyFor('q')).toBeNull();
    expect(padKeyFor('enter')).toBeNull();
    expect(padKeyFor(' ')).toBeNull();
  });
});

describe('button state machine', () => {
  it('a fresh press is pressed, and only becomes held after the frame advances', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    expect(pad.a).toBe('pressed');
    padAdvance(pad);
    expect(pad.a).toBe('held');
    padAdvance(pad);
    expect(pad.a).toBe('held');
  });

  it('a key repeat does not restart the press', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'b');
    padAdvance(pad);
    padDown(pad, 'b');
    expect(pad.b).toBe('held');
  });

  it('a release is released for one advance and then up', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'c');
    padAdvance(pad);
    padUp(pad, 'c');
    expect(pad.c).toBe('released');
    padAdvance(pad);
    expect(pad.c).toBe('up');
  });

  it('a press and a release inside the same frame still produce released', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    padUp(pad, 'a');
    expect(pad.a).toBe('released');
  });

  it('blur releases the d-pad and lifts every button', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'left');
    padDown(pad, 'a');
    padAdvance(pad);
    padBlur(pad);
    expect(pad.left).toBe(false);
    expect(pad.a).toBe('up');
  });

  // A keyup whose keydown never reached the pad -- swallowed because the game was
  // paused or blocked, or arriving after a blur already lifted the button. Marking
  // it 'released' would leave an edge the engine consumes on resume as a shot the
  // player never asked for. Symmetric to pressButton, which refuses to restart a
  // press that is already down.
  it('a keyup with no keydown leaves the button up, with no phantom edge', () => {
    const pad = createPadState('neutral', 0);
    padUp(pad, 'a');
    expect(pad.a).toBe('up');
    padDown(pad, 'a');
    padAdvance(pad);
    padBlur(pad);          // alt-tab: the button is lifted without an edge
    padUp(pad, 'a');       // the real keyup arrives when the window comes back
    expect(pad.a).toBe('up');
  });

  // padClear is what the component uses for a button released while paused or
  // blocked: the button has to come up, but without the edge that padUp produces.
  it('padClear lifts one button without an edge and leaves the rest alone', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    padDown(pad, 'b');
    padDown(pad, 'left');
    padAdvance(pad);
    padClear(pad, 'a');
    expect(pad.a).toBe('up');
    expect(pad.b).toBe('held');
    padClear(pad, 'left');
    expect(pad.left).toBe(false);
  });
});

describe('padToTeamInput', () => {
  it('turns the four direction flags into the axes, opposites cancelling', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'left');
    padDown(pad, 'up');
    padToTeamInput(pad, true, out);
    expect(out.dx).toBe(-1);
    expect(out.dy).toBe(-1);
    padDown(pad, 'right');
    padToTeamInput(pad, true, out);
    expect(out.dx).toBe(0);
  });

  it('downgrades pressed to held and released to up after the first step of a frame', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'a');
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('pressed');
    // Same frame, second simulation step: the engine already consumed the edge.
    padToTeamInput(pad, false, out);
    expect(out.a).toBe('held');

    padUp(pad, 'a');
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('released');
    padToTeamInput(pad, false, out);
    expect(out.a).toBe('up');
  });

  it('always produces an input the engine accepts', () => {
    const pad = createPadState('attack', 2);
    const out = createTeamInput();
    padDown(pad, 'down');
    padDown(pad, 'right');
    padDown(pad, 'b');
    padToTeamInput(pad, true, out);
    expect(checkTeamInput(out, FORMATION_COUNT)).toEqual([]);
  });

  // The rule the component's update() has to honour: an edge is consumed by a STEP,
  // not by a frame. A frame that plans zero steps (STEP_MS is 16.667 ms, so on a
  // 120 Hz panel half the frames plan none) must leave 'pressed' standing, or the
  // shot the player asked for is silently dropped.
  it('a press survives a frame in which no step ran', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'a');
    // Frame with budget.steps === 0: no padToTeamInput, no padAdvance.
    padToTeamInput(pad, true, out);   // the NEXT frame, which does run a step
    expect(out.a).toBe('pressed');
    // And the symmetric case: once a step has run, the frame ends with padAdvance
    // and the edge is gone.
    padAdvance(pad);
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('held');
  });
});

describe('padChoice', () => {
  it('1/2/3 pick the formation and 4/5/6 the strategy', () => {
    const pad = createPadState('neutral', 0);
    expect(padChoice(pad, '3')).toBe(true);
    expect(pad.formation).toBe(2);
    expect(padChoice(pad, '1')).toBe(true);
    expect(pad.formation).toBe(0);
    expect(padChoice(pad, '4')).toBe(true);
    expect(pad.strategy).toBe('attack');
    expect(padChoice(pad, '5')).toBe(true);
    expect(pad.strategy).toBe('neutral');
    expect(padChoice(pad, '6')).toBe(true);
    expect(pad.strategy).toBe('defend');
  });

  it('leaves the pad alone for any other key', () => {
    const pad = createPadState('neutral', 1);
    expect(padChoice(pad, '7')).toBe(false);
    expect(pad.formation).toBe(1);
    expect(pad.strategy).toBe('neutral');
  });
});
