import type { Formation, OutfieldRole } from '../football-logic/teams';

// G15-9: the mini pitch of the team selector and, from V15-3-9, the one of the
// ALINEACIÓN screen. A SCHEMATIC, not a projection of the match: it takes a
// formation's unit fractions into an arbitrary rectangle and nothing else. It does
// not know PitchDef, it picks no colours (the .tsx paints the kit) and it draws no
// attack arrows (G15-9: "sin flechas de ataque"). Everything is derived from
// `f.slots`, never from a hard-coded team size -- V15-4 raises it and this file
// does not move. Pure arithmetic; nothing allocates.

// The goalkeeper has no FormationSlot. In the match it stands GK_LINE_DIST = 25 u off
// its own line on a 2000 u pitch (0.0125), which in a 150 px preview would be under
// two pixels from the frame and eat the dot. 0.045 clears the frame without lying
// about where the keeper is. (Deliberately NOT imported from players.ts: the engine
// is out of bounds in this step, and a schematic must not be coupled to the physics.)
export const PREVIEW_GK_X = 0.045;

export function previewSlotX(f: Formation, slot: number, x: number, w: number): number {
  return x + f.slots[slot].x * w;
}

export function previewSlotY(f: Formation, slot: number, y: number, h: number): number {
  return y + f.slots[slot].y * h;
}

export function previewSlotRole(f: Formation, slot: number): OutfieldRole {
  return f.slots[slot].role;
}

export function previewGkX(x: number, w: number): number {
  return x + PREVIEW_GK_X * w;
}

export function previewGkY(y: number, h: number): number {
  return y + h / 2;
}

// The outfield slots plus the goalkeeper: 9 today, 11 once V15-4 raises TEAM_SIZE.
export function previewDotCount(f: Formation): number {
  return f.slots.length + 1;
}
