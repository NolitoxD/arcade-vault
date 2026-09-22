import { describe, expect, it } from 'vitest';
import { createGamepadPad, readGamepad, type GamepadLike } from '../../../lib/gamepad';
import { createTeamInput } from '../football-logic/input';
import { PAD_KEYS, routeGamepadStrategy, routeGamepadToPad } from './gamepad-input';
import { createPadState, padAdvance, padBlur, padToTeamInput } from './keyboard';

// A standard-mapping pad (17 buttons, 4 axes) with the given buttons down and the left
// stick at (x, y).
function snapshot(down: readonly number[], x = 0, y = 0): GamepadLike {
  const buttons: { pressed: boolean }[] = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: down.includes(i) });
  return { connected: true, axes: [x, y, 0, 0], buttons };
}

describe('the gamepad drives the keyboard\'s own pad entries (G15-20)', () => {
  it('the directions follow the stick and the d-pad on every read', () => {
    const gp = createGamepadPad();
    const pad = createPadState('neutral', 0);
    readGamepad(snapshot([], 0.9, -0.9), gp);
    routeGamepadToPad(gp, pad);
    expect([pad.up, pad.down, pad.left, pad.right]).toEqual([true, false, false, true]);
    readGamepad(snapshot([14]), gp);
    routeGamepadToPad(gp, pad);
    expect([pad.up, pad.down, pad.left, pad.right]).toEqual([false, false, true, false]);
    expect(PAD_KEYS).toEqual(['up', 'down', 'left', 'right', 'a', 'b', 'c']);
  });

  it('a press goes through padDown: it survives a frame with no step, and is held once a step consumed it', () => {
    const gp = createGamepadPad();
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    readGamepad(snapshot([0]), gp);
    routeGamepadToPad(gp, pad);          // frame 1: pressed; no step ran, so no padAdvance
    readGamepad(snapshot([0]), gp);
    routeGamepadToPad(gp, pad);          // frame 2: the pad reads 'held' -- no second padDown
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('pressed');       // the press was not lost
    padAdvance(pad);
    readGamepad(snapshot([0]), gp);
    routeGamepadToPad(gp, pad);
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('held');
  });

  it('a release goes through padUp, and a button held since before a blur stays up (no phantom shot)', () => {
    const gp = createGamepadPad();
    const pad = createPadState('neutral', 0);
    readGamepad(snapshot([1]), gp);
    routeGamepadToPad(gp, pad);
    padAdvance(pad);
    readGamepad(snapshot([]), gp);
    routeGamepadToPad(gp, pad);
    expect(pad.b).toBe('released');
    readGamepad(snapshot([2]), gp);
    routeGamepadToPad(gp, pad);
    expect(pad.c).toBe('pressed');
    padBlur(pad);                        // the pause, or an alt-tab
    readGamepad(snapshot([2]), gp);
    routeGamepadToPad(gp, pad);          // still held on the pad
    expect(pad.c).toBe('up');
    readGamepad(snapshot([]), gp);
    routeGamepadToPad(gp, pad);          // let go: padUp on a button that is up
    expect(pad.c).toBe('up');            // no edge out of nothing (releaseButton)
  });

  it('L1 / R1 step the strategy towards ATAQUE / DEFENSA, once per press, and stop at the ends', () => {
    const gp = createGamepadPad();
    const pad = createPadState('neutral', 0);
    readGamepad(snapshot([5]), gp);
    routeGamepadStrategy(gp, pad);
    expect(pad.strategy).toBe('defend');
    readGamepad(snapshot([]), gp);
    readGamepad(snapshot([5]), gp);
    routeGamepadStrategy(gp, pad);
    expect(pad.strategy).toBe('defend');   // already at the end
    readGamepad(snapshot([]), gp);
    readGamepad(snapshot([4]), gp);
    routeGamepadStrategy(gp, pad);
    expect(pad.strategy).toBe('neutral');
    readGamepad(snapshot([4]), gp);
    routeGamepadStrategy(gp, pad);         // still held: no second step
    expect(pad.strategy).toBe('neutral');
  });
});
