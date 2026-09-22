// G15-20 (Paco, 21-sep): physical gamepads through the Gamepad API. This module is the
// PURE half, shared by the whole portal: it turns one snapshot of a pad (a Gamepad, or
// any object shaped like one) into ten digital controls -- the four directions, the
// three buttons of the repo's shared A/B/C mapping, L1, R1 and Start -- with a dead
// zone on the stick and the up/pressed/held/released edges between two reads. The
// names of the first seven are the keyboard's pad keys, so a game can feed them to the
// same entries its keyboard uses. Nothing here touches navigator (that is
// gamepad-navigator.ts) and nothing allocates after createGamepadPad.

export type GamepadControl = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c' | 'l1' | 'r1' | 'start';
export const GAMEPAD_CONTROLS: readonly GamepadControl[] = ['up', 'down', 'left', 'right', 'a', 'b', 'c', 'l1', 'r1', 'start'];

export type GamepadEdge = 'up' | 'pressed' | 'held' | 'released';

// The slice of the DOM's Gamepad this module reads: a real Gamepad fits it unchanged.
export type GamepadButtonLike = { readonly pressed: boolean };
export type GamepadLike = {
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly GamepadButtonLike[];
};

export type GamepadPad = {
  connected: boolean;
  down: Record<GamepadControl, boolean>;      // this read
  edge: Record<GamepadControl, GamepadEdge>;  // this read against the one before
};

// The W3C "standard" layout. A/✕ bottom shoots, B/○ right passes, X/□ left sprints or
// switches, L1/R1 change the strategy, Start pauses; 12-15 are the d-pad. A pad that
// does not report 'standard' is still read with these indices (Paco, 22-sep: read with the standard indices).
export const STANDARD_BUTTON: Readonly<Record<GamepadControl, number>> = {
  a: 0, b: 1, c: 2, l1: 4, r1: 5, start: 9, up: 12, down: 13, left: 14, right: 15,
};
const STICK_X_AXIS = 0;
const STICK_Y_AXIS = 1;   // +y is down, like the screen
export const GAMEPAD_STICK_DEAD_ZONE = 0.5;

export function createGamepadPad(): GamepadPad {
  return {
    connected: false,
    down: { up: false, down: false, left: false, right: false, a: false, b: false, c: false, l1: false, r1: false, start: false },
    edge: { up: 'up', down: 'up', left: 'up', right: 'up', a: 'up', b: 'up', c: 'up', l1: 'up', r1: 'up', start: 'up' },
  };
}

export function nextEdge(wasDown: boolean, isDown: boolean): GamepadEdge {
  if (isDown) return wasDown ? 'held' : 'pressed';
  return wasDown ? 'released' : 'up';
}

// -1 / 0 / 1 past the dead zone (strictly more than `deadZone` of the travel).
export function stickAxis(value: number, deadZone: number): -1 | 0 | 1 {
  return value > deadZone ? 1 : value < -deadZone ? -1 : 0;
}

function buttonDown(snap: GamepadLike, index: number): boolean {
  return index < snap.buttons.length && snap.buttons[index].pressed;
}

function axisAt(snap: GamepadLike, index: number): number {
  return index < snap.axes.length ? snap.axes[index] : 0;
}

function write(pad: GamepadPad, c: GamepadControl, isDown: boolean): void {
  pad.edge[c] = nextEdge(pad.down[c], isDown);
  pad.down[c] = isDown;
}

// Fix round 1 (Task V15-2-7, finding 3): the SILENT counterpart of write -- it seeds
// down/edge from the real current state with NO transition, so the control never
// reads 'pressed' or 'released' out of this read. Used for exactly one read: the
// first one after a slot takeover, so a control the newcomer already happens to be
// holding lands on 'held' next poll (nextEdge(true, true)), not a phantom 'pressed'
// computed against the cleared baseline the takeover frame left behind.
function writeSilent(pad: GamepadPad, c: GamepadControl, isDown: boolean): void {
  pad.down[c] = isDown;
  pad.edge[c] = isDown ? 'held' : 'up';
}

// A pad that vanished or disconnected reads all up with NO released edge: like
// padBlur, letting go because the cable came out is not a shot the player asked for.
function clearGamepadPad(pad: GamepadPad): void {
  pad.connected = false;
  for (let i = 0; i < GAMEPAD_CONTROLS.length; i++) {
    const c = GAMEPAD_CONTROLS[i];
    pad.down[c] = false;
    pad.edge[c] = 'up';
  }
}

// The ten controls, read from one snapshot and handed to `writer` control by control --
// shared by readGamepad (edges against the pad's own history) and primeGamepadPad
// (edges suppressed, fix round 1). `writer` is always one of the two module-level
// functions above, never a closure created here, so this allocates nothing (criterion 20).
function readControls(snapshot: GamepadLike, pad: GamepadPad, writer: (pad: GamepadPad, c: GamepadControl, isDown: boolean) => void): void {
  const sx = stickAxis(axisAt(snapshot, STICK_X_AXIS), GAMEPAD_STICK_DEAD_ZONE);
  const sy = stickAxis(axisAt(snapshot, STICK_Y_AXIS), GAMEPAD_STICK_DEAD_ZONE);
  writer(pad, 'up', buttonDown(snapshot, STANDARD_BUTTON.up) || sy < 0);
  writer(pad, 'down', buttonDown(snapshot, STANDARD_BUTTON.down) || sy > 0);
  writer(pad, 'left', buttonDown(snapshot, STANDARD_BUTTON.left) || sx < 0);
  writer(pad, 'right', buttonDown(snapshot, STANDARD_BUTTON.right) || sx > 0);
  writer(pad, 'a', buttonDown(snapshot, STANDARD_BUTTON.a));
  writer(pad, 'b', buttonDown(snapshot, STANDARD_BUTTON.b));
  writer(pad, 'c', buttonDown(snapshot, STANDARD_BUTTON.c));
  writer(pad, 'l1', buttonDown(snapshot, STANDARD_BUTTON.l1));
  writer(pad, 'r1', buttonDown(snapshot, STANDARD_BUTTON.r1));
  writer(pad, 'start', buttonDown(snapshot, STANDARD_BUTTON.start));
}

export function readGamepad(snapshot: GamepadLike | null | undefined, pad: GamepadPad): void {
  if (snapshot === null || snapshot === undefined || !snapshot.connected) {
    clearGamepadPad(pad);
    return;
  }
  pad.connected = true;
  readControls(snapshot, pad, write);
}

// Fix round 1: the takeover-frame clear leaves `down` at false for every control, so
// the NEXT ordinary readGamepad against a snapshot that is still holding a button
// computes nextEdge(false, true) = 'pressed' -- a phantom press for input the player
// never newly made. This reads the real current state with NO edge (writeSilent), so
// that later read starts from the truth instead of the cleared baseline.
function primeGamepadPad(snapshot: GamepadLike, pad: GamepadPad): void {
  pad.connected = true;
  readControls(snapshot, pad, writeSilent);
}

// Per-slot memory of which position in the PREVIOUS call's list fed it, so a slot
// handed to a DIFFERENT physical pad (mando 1 drops mid-match, mando 2 compacts into
// slot 0 -- Paco, 22-sep resolution 5) can be told apart from the same pad read again.
// `GamepadLike` carries no device identity of its own; the list position is stable for
// a still-connected pad (the browser keeps a connected pad at its own fixed slot in
// that array for the whole connection), so this module reuses that position for
// identity instead. Keyed by the `GamepadPad` object itself, which the caller creates
// once per slot, so two independent games never share entries; no entry (a slot never
// yet assigned) counts like a match, because a fresh `createGamepadPad()` is already
// in the cleared state a real reset would produce.
const gamepadSlotSource = new WeakMap<GamepadPad, number>();

// Fix round 1 (Task V15-2-7, finding 3): a slot the takeover branch just cleared, whose
// very next matched read must go through primeGamepadPad instead of readGamepad --
// consumed (deleted) by that read, so it only ever suppresses the one edge right after
// a takeover, never a plain held-across-two-frames read.
const pendingPrime = new WeakSet<GamepadPad>();

// "Mando 1" is the first connected pad of the browser's list, "mando 2" the second;
// holes and disconnected entries are skipped and the slots left over are cleared.
// Returns how many connected pads were found.
export function assignGamepadSlots(list: ArrayLike<GamepadLike | null | undefined> | null, slots: readonly GamepadPad[]): number {
  let slot = 0;
  if (list !== null) {
    for (let i = 0; i < list.length && slot < slots.length; i++) {
      const g = list[i];
      if (g === null || g === undefined || !g.connected) continue;
      const target = slots[slot];
      const previousSource = gamepadSlotSource.get(target);
      if (previousSource === undefined || previousSource === i) {
        if (pendingPrime.has(target)) {
          pendingPrime.delete(target);
          primeGamepadPad(g, target);
        } else {
          readGamepad(g, target);
        }
      } else {
        // A different physical pad just took this slot over: start it from a cleared
        // state, like padBlur, instead of computing edges against the outgoing pad's
        // stale down/edge -- no ghost 'released' for a control the newcomer never
        // touched, and no false 'pressed' for one it already happened to be holding.
        // Its real buttons resume being read on the next poll -- primed silently
        // (fix round 1), so a control the newcomer is already holding then reads
        // 'held', not a phantom 'pressed' computed against this cleared baseline.
        clearGamepadPad(target);
        pendingPrime.add(target);
      }
      gamepadSlotSource.set(target, i);
      slot++;
    }
  }
  const found = slot;
  for (; slot < slots.length; slot++) {
    gamepadSlotSource.delete(slots[slot]);
    pendingPrime.delete(slots[slot]);
    readGamepad(null, slots[slot]);
  }
  return found;
}
