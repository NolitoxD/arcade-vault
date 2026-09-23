import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../football-logic/teams';
import {
  PREVIEW_GK_X, previewDotCount, previewGkX, previewGkY, previewSlotRole, previewSlotX, previewSlotY,
} from './formation-preview';

const X = 100;
const Y = 50;
const W = 200;
const H = 130;

describe('formation preview geometry (G15-9): a schematic, not a projection of the pitch', () => {
  it('maps a slot fraction into the rectangle, attacking to the right', () => {
    const f = FORMATIONS[0];                       // 3-3-2 NORMAL
    expect(previewSlotX(f, 0, X, W)).toBe(X + 0.22 * W);
    expect(previewSlotY(f, 0, Y, H)).toBe(Y + 0.25 * H);
    expect(previewSlotX(f, 7, X, W)).toBe(X + 0.7 * W);
    expect(previewSlotY(f, 7, Y, H)).toBe(Y + 0.65 * H);
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

  it('previewDotCount is the formation\'s slots plus the goalkeeper -- never a hard-coded team size (V15-4 raises it)', () => {
    for (const f of FORMATIONS) expect(previewDotCount(f)).toBe(f.slots.length + 1);
    expect(previewDotCount(FORMATIONS[0])).toBe(9);   // today's value; changes once V15-4 raises TEAM_SIZE
    // A hypothetical V15-4 formation with ten outfield slots needs no change here.
    const tenSlots = { id: '4-4-2', name: 'NORMAL', slots: [...FORMATIONS[0].slots, ...FORMATIONS[1].slots.slice(0, 2)] };
    expect(previewDotCount(tenSlots)).toBe(11);
  });

  it('previewSlotRole names the role of each dot, so the screen can paint by role (G15-9: "puntos por rol")', () => {
    const f = FORMATIONS[0];
    expect(previewSlotRole(f, 0)).toBe('def');
    expect(previewSlotRole(f, 3)).toBe('mid');
    expect(previewSlotRole(f, 7)).toBe('fwd');
  });

  it('is pure: the same arguments give the same numbers and nothing is cached', () => {
    const f = FORMATIONS[2];
    const a = previewSlotX(f, 1, X, W);
    const b = previewSlotX(f, 1, X, W);
    expect(a).toBe(b);
    expect(previewSlotX(f, 1, 0, W)).toBe(a - X);
  });
});
