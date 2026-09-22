import type { GamepadPad } from '../../../lib/gamepad';
import { STRATEGY_BY_KEY, padDown, padUp, type PadKey, type PadState } from './keyboard';

// G15-20 (Paco, 21-sep): from lib/gamepad's controls to this game's pad. "Traduce a las
// mismas entradas que el teclado": the directions are copied and the three buttons go
// through padDown/padUp -- the very calls a keydown/keyup makes -- so the gamepad
// inherits the keyboard's whole state machine (a press survives a frame with no step,
// no auto-repeat, a release only out of a press). Nothing allocates.

// The seven pad keys, in the order the menus read a gamepad's fresh pushes.
export const PAD_KEYS: readonly PadKey[] = ['up', 'down', 'left', 'right', 'a', 'b', 'c'];
const BUTTONS: readonly ('a' | 'b' | 'c')[] = ['a', 'b', 'c'];

export function routeGamepadToPad(gp: GamepadPad, pad: PadState): void {
  pad.up = gp.down.up;
  pad.down = gp.down.down;
  pad.left = gp.down.left;
  pad.right = gp.down.right;
  for (let i = 0; i < BUTTONS.length; i++) {
    const k = BUTTONS[i];
    const edge = gp.edge[k];
    if (edge === 'pressed') padDown(pad, k);
    else if (edge === 'released') padUp(pad, k);
  }
}

// L1 / R1: one step of the strategy towards ATAQUE (L1) or DEFENSA (R1), in the order
// of the 4/5/6 keys, stopping at the ends. It writes the KEYBOARD pad's strategy: the
// one field both devices share, and the one the engine already reads.
export function routeGamepadStrategy(gp: GamepadPad, pad: PadState): void {
  const delta = gp.edge.l1 === 'pressed' ? -1 : gp.edge.r1 === 'pressed' ? 1 : 0;
  if (delta === 0) return;
  const next = STRATEGY_BY_KEY.indexOf(pad.strategy) + delta;
  if (next >= 0 && next < STRATEGY_BY_KEY.length) pad.strategy = STRATEGY_BY_KEY[next];
}
