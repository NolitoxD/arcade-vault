import { describe, expect, it } from 'vitest';
import { FORMATIONS, OUTFIELD, TEAM_SIZE, slotCounts } from '../football-logic/teams';
import {
  PREVIEW_GK_X, previewDotCount, previewGkX, previewGkY, previewSlotRole, previewSlotX, previewSlotY,
} from './formation-preview';

const X = 100;
const Y = 50;
const W = 200;
const H = 130;

describe('formation preview geometry (G15-9): a schematic, not a projection of the pitch', () => {
  it('maps a slot fraction into the rectangle, attacking to the right', () => {
    const f = FORMATIONS[0];                       // 4-4-2 NORMAL
    // The fractions come from the formation, not from a copy of them: what this test
    // owns is the MAPPING (x + fraction * w), which is the part the screen depends on.
    const first = 0;
    const last = f.slots.length - 1;
    expect(previewSlotX(f, first, X, W)).toBe(X + f.slots[first].x * W);
    expect(previewSlotY(f, first, Y, H)).toBe(Y + f.slots[first].y * H);
    expect(previewSlotX(f, last, X, W)).toBe(X + f.slots[last].x * W);
    expect(previewSlotY(f, last, Y, H)).toBe(Y + f.slots[last].y * H);
  });

  it('puts the goalkeeper on its own line, inside the rectangle and left of every outfield slot', () => {
    expect(PREVIEW_GK_X).toBeGreaterThan(0);
    expect(previewGkX(X, W)).toBe(X + PREVIEW_GK_X * W);
    expect(previewGkY(Y, H)).toBe(Y + H / 2);
    for (const f of FORMATIONS) {
      for (let s = 0; s < f.slots.length; s++) {
        expect(previewGkX(X, W)).toBeLessThan(previewSlotX(f, s, X, W));
      }
    }
  });

  it('every dot of every formation lands strictly inside the rectangle', () => {
    for (const f of FORMATIONS) {
      expect(previewGkX(X, W)).toBeGreaterThan(X);
      for (let s = 0; s < f.slots.length; s++) {
        expect(previewSlotX(f, s, X, W)).toBeGreaterThan(X);
        expect(previewSlotX(f, s, X, W)).toBeLessThan(X + W);
        expect(previewSlotY(f, s, Y, H)).toBeGreaterThan(Y);
        expect(previewSlotY(f, s, Y, H)).toBeLessThan(Y + H);
      }
    }
  });

  it('previewDotCount is the formation\'s slots plus the goalkeeper -- never a hard-coded team size (V15-4 raised it)', () => {
    for (const f of FORMATIONS) expect(previewDotCount(f)).toBe(f.slots.length + 1);
    expect(previewDotCount(FORMATIONS[0])).toBe(TEAM_SIZE);
    // A formation with a DIFFERENT number of outfield slots -- the nine-a-side shape of
    // the v1 -- still needs no change here, which is the whole point of deriving it.
    const eightSlots = { id: '3-3-2', name: 'NORMAL', slots: FORMATIONS[0].slots.slice(0, OUTFIELD - 2) };
    expect(previewDotCount(eightSlots)).toBe(TEAM_SIZE - 2);
  });

  it('previewSlotRole names the role of each dot, so the screen can paint by role (G15-9: "puntos por rol")', () => {
    const f = FORMATIONS[0];
    // Derived from the SHAPE, not from three memorised indices: the slots of every
    // formation are the defenders, then the midfielders, then the forwards, so the two
    // boundaries are slotCounts. With the 4-4-2 of G15-16 the fourth slot is a defender
    // and the fifth is the first midfielder -- one index later than in the nine-a-side.
    const [defs, mids] = slotCounts(f);
    expect(previewSlotRole(f, 0)).toBe('def');
    expect(previewSlotRole(f, defs - 1)).toBe('def');
    expect(previewSlotRole(f, defs)).toBe('mid');
    expect(previewSlotRole(f, defs + mids - 1)).toBe('mid');
    expect(previewSlotRole(f, defs + mids)).toBe('fwd');
    expect(previewSlotRole(f, f.slots.length - 1)).toBe('fwd');
  });

  it('is pure: the same arguments give the same numbers and nothing is cached', () => {
    const f = FORMATIONS[2];
    const a = previewSlotX(f, 1, X, W);
    const b = previewSlotX(f, 1, X, W);
    expect(a).toBe(b);
    expect(previewSlotX(f, 1, 0, W)).toBe(a - X);
  });
});
