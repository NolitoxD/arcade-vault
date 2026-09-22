import { describe, expect, it } from 'vitest';
import {
  GAMEPAD_CONTROLS, GAMEPAD_STICK_DEAD_ZONE, STANDARD_BUTTON, assignGamepadSlots, createGamepadPad, nextEdge, readGamepad,
  stickAxis, type GamepadLike,
} from './gamepad';

// A standard-mapping pad (17 buttons, 4 axes) with the given buttons down and the left
// stick at (x, y).
function snapshot(down: readonly number[], x = 0, y = 0): GamepadLike {
  const buttons: { pressed: boolean }[] = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: down.includes(i) });
  return { connected: true, axes: [x, y, 0, 0], buttons };
}

describe('lib/gamepad: from a pad snapshot to edges (G15-20)', () => {
  it('nextEdge walks up -> pressed -> held -> released -> up', () => {
    expect(nextEdge(false, true)).toBe('pressed');
    expect(nextEdge(true, true)).toBe('held');
    expect(nextEdge(true, false)).toBe('released');
    expect(nextEdge(false, false)).toBe('up');
  });

  it('reads the standard mapping: A/✕ 0 shoots (a), B/○ 1 passes (b), X/□ 2 sprints/switches (c), L1 4, R1 5, Start 9', () => {
    expect(STANDARD_BUTTON.a).toBe(0);
    expect(STANDARD_BUTTON.b).toBe(1);
    expect(STANDARD_BUTTON.c).toBe(2);
    expect(STANDARD_BUTTON.l1).toBe(4);
    expect(STANDARD_BUTTON.r1).toBe(5);
    expect(STANDARD_BUTTON.start).toBe(9);
    const pad = createGamepadPad();
    readGamepad(snapshot([0, 2, 5, 9]), pad);
    expect(pad.connected).toBe(true);
    expect(pad.down.a).toBe(true);
    expect(pad.down.b).toBe(false);
    expect(pad.down.c).toBe(true);
    expect(pad.down.l1).toBe(false);
    expect(pad.down.r1).toBe(true);
    expect(pad.down.start).toBe(true);
  });

  it('the d-pad buttons 12-15 and the left stick both drive the four directions', () => {
    const pad = createGamepadPad();
    readGamepad(snapshot([12, 15]), pad);
    expect([pad.down.up, pad.down.down, pad.down.left, pad.down.right]).toEqual([true, false, false, true]);
    readGamepad(snapshot([], -0.9, 0.8), pad);
    expect([pad.down.up, pad.down.down, pad.down.left, pad.down.right]).toEqual([false, true, true, false]);
    readGamepad(snapshot([13], 0.9, 0), pad);
    expect([pad.down.up, pad.down.down, pad.down.left, pad.down.right]).toEqual([false, true, false, true]);
  });

  it('the stick has a dead zone: up to 0.5 is centred, past it is a direction', () => {
    expect(GAMEPAD_STICK_DEAD_ZONE).toBe(0.5);
    expect(stickAxis(0.5, GAMEPAD_STICK_DEAD_ZONE)).toBe(0);
    expect(stickAxis(-0.5, GAMEPAD_STICK_DEAD_ZONE)).toBe(0);
    expect(stickAxis(0.51, GAMEPAD_STICK_DEAD_ZONE)).toBe(1);
    expect(stickAxis(-0.51, GAMEPAD_STICK_DEAD_ZONE)).toBe(-1);
    const pad = createGamepadPad();
    readGamepad(snapshot([], 0.3, -0.45), pad);   // a resting stick drifts: nothing moves
    expect([pad.down.up, pad.down.down, pad.down.left, pad.down.right]).toEqual([false, false, false, false]);
  });

  it('a button kept down is pressed on the first read and held after; letting go is released once, then up', () => {
    const pad = createGamepadPad();
    readGamepad(snapshot([0]), pad);
    expect(pad.edge.a).toBe('pressed');
    readGamepad(snapshot([0]), pad);
    expect(pad.edge.a).toBe('held');
    readGamepad(snapshot([]), pad);
    expect(pad.edge.a).toBe('released');
    readGamepad(snapshot([]), pad);
    expect(pad.edge.a).toBe('up');
    readGamepad(snapshot([], 0, 1), pad);          // directions have edges too (menus step once per push)
    expect(pad.edge.down).toBe('pressed');
  });

  it('a missing or disconnected pad reads everything up, with no released edge (like padBlur)', () => {
    const pad = createGamepadPad();
    readGamepad(snapshot([0, 12]), pad);
    readGamepad(null, pad);
    expect(pad.connected).toBe(false);
    for (const c of GAMEPAD_CONTROLS) {
      expect(pad.down[c]).toBe(false);
      expect(pad.edge[c]).toBe('up');
    }
    readGamepad(snapshot([0]), pad);
    readGamepad({ connected: false, axes: [], buttons: [] }, pad);
    expect(pad.edge.a).toBe('up');
    readGamepad(undefined, pad);
    expect(pad.connected).toBe(false);
  });

  it('a pad with fewer buttons or axes than the standard layout reads the missing ones up and centred', () => {
    const pad = createGamepadPad();
    readGamepad({ connected: true, axes: [], buttons: [{ pressed: true }, { pressed: false }] }, pad);
    expect(pad.connected).toBe(true);
    expect(pad.down.a).toBe(true);
    expect(pad.down.start).toBe(false);
    expect(pad.down.up).toBe(false);
    expect(pad.down.right).toBe(false);
  });

  it('a slot taken over by a DIFFERENT physical pad starts cleared, not with the outgoing pad\'s edges', () => {
    const slots = [createGamepadPad(), createGamepadPad()];
    // Pad at list index 0 holds `a` for two reads (pressed -> held); pad at index 1 holds `b`, unrelated.
    assignGamepadSlots([snapshot([0]), snapshot([1])], slots);
    assignGamepadSlots([snapshot([0]), snapshot([1])], slots);
    expect(slots[0].edge.a).toBe('held');
    expect(slots[1].edge.b).toBe('held');

    // The pad at index 0 disconnects; the pad that was at index 1 (already holding `b`) compacts into slot 0.
    assignGamepadSlots([null, snapshot([1])], slots);
    // A control the newcomer never touched: no ghost 'released'.
    expect(slots[0].down.a).toBe(false);
    expect(slots[0].edge.a).toBe('up');
    // A control the newcomer was already holding: no false 'pressed' on the takeover read either.
    expect(slots[0].down.b).toBe(false);
    expect(slots[0].edge.b).toBe('up');

    // One frame later, the same physical pad is still there and still holding `b`:
    // fix round 1 primes that read silently, so it lands on 'held', not a phantom
    // 'pressed' computed against the cleared baseline (see the focused test below).
    expect(assignGamepadSlots([null, snapshot([1])], slots)).toBe(1);
    expect(slots[0].connected).toBe(true);
    expect(slots[0].down.b).toBe(true);
    expect(slots[0].edge.b).toBe('held');
  });

  it('fix round 1 (Task V15-2-7, finding 3): a control the newcomer is already holding at the moment of takeover never fires a phantom press, on the takeover frame or the one after', () => {
    const slots = [createGamepadPad(), createGamepadPad()];
    // Index 0 holds nothing; index 1 holds `a` from the very first read (already pressed
    // when it shows up, exactly like a pad that took `a` over mid-hold).
    assignGamepadSlots([snapshot([]), snapshot([0])], slots);
    assignGamepadSlots([snapshot([]), snapshot([0])], slots);
    expect(slots[1].edge.a).toBe('held');

    // Index 0 disconnects; the pad at index 1 (still holding `a`) compacts into slot 0.
    assignGamepadSlots([null, snapshot([0])], slots);
    expect(slots[0].down.a).toBe(false);
    expect(slots[0].edge.a).toBe('up');            // no edge on the takeover frame itself

    // The frame that matters: the newcomer is STILL holding `a`. Before fix round 1 this
    // read nextEdge(false, true) against the cleared baseline and produced a phantom
    // 'pressed' -- a shot the player never newly asked for, one frame after the takeover.
    assignGamepadSlots([null, snapshot([0])], slots);
    expect(slots[0].down.a).toBe(true);
    expect(slots[0].edge.a).toBe('held');           // not 'pressed'

    // From here on it reads like any other held button: let go, and it releases once.
    assignGamepadSlots([null, snapshot([])], slots);
    expect(slots[0].edge.a).toBe('released');
    assignGamepadSlots([null, snapshot([])], slots);
    expect(slots[0].edge.a).toBe('up');
  });

  it('assignGamepadSlots fills the slots with the connected pads in order, skips the holes and clears the rest', () => {
    const slots = [createGamepadPad(), createGamepadPad()];
    const off: GamepadLike = { connected: false, axes: [], buttons: [] };
    expect(assignGamepadSlots([null, snapshot([1]), off, snapshot([2])], slots)).toBe(2);
    expect(slots[0].down.b).toBe(true);
    expect(slots[1].down.c).toBe(true);
    expect(assignGamepadSlots([undefined, snapshot([0])], slots)).toBe(1);
    expect(slots[0].down.a).toBe(true);
    expect(slots[1].connected).toBe(false);
    expect(slots[1].edge.c).toBe('up');            // cleared, not released
    expect(assignGamepadSlots(null, slots)).toBe(0);
    expect(slots[0].connected).toBe(false);
  });
});
