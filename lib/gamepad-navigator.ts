import { assignGamepadSlots, type GamepadPad } from './gamepad';

// G15-20: the ONE place that touches navigator. Criterion 20 exception, written into
// G15-20 itself: navigator.getGamepads() builds a new array on every call (and, in
// Chrome, a new Gamepad/GamepadButton snapshot per connected pad), and the browser
// offers no other way to read a pad. The caller (VaultWorldCupGame.tsx's
// pollGamepadFrame) only calls this while it has seen a gamepad at all (gamepadSeen,
// pre-flight H8), so a keyboard-only session never pays this allocation. Everything
// downstream writes into the slots created once by the caller.
// Some browsers throw here (permissions policy, insecure context): no pads, then.
export function pollGamepads(slots: readonly GamepadPad[]): number {
  let list: ArrayLike<Gamepad | null> | null = null;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') list = navigator.getGamepads();
  } catch {
    list = null;
  }
  return assignGamepadSlots(list, slots);
}
