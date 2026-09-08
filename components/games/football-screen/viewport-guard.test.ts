import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W } from './camera';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from './viewport-guard';

describe('viewportAllowed', () => {
  // R35 is a ruling, not a derivation from the canvas, so the numbers are asserted
  // literally: if this fails the threshold was moved, and the blocked panel's text,
  // the S-SC2 row of the plan, the spec and QA item C6-14 move with it.
  it('holds R35 exactly: 768 x 560', () => {
    expect(MIN_VIEWPORT_W).toBe(768);
    expect(MIN_VIEWPORT_H).toBe(560);
    // The height still clears the canvas; the width deliberately does NOT (800 wide,
    // drawn with maxWidth: 100%, so it scales down between 768 and 800).
    expect(MIN_VIEWPORT_H).toBeGreaterThanOrEqual(VIEW_H);
    expect(MIN_VIEWPORT_W).toBeLessThan(VIEW_W);
  });

  it('accepts a desktop viewport and the 800 x 600 window R35 was written for', () => {
    expect(viewportAllowed(1440, 900)).toBe(true);
    expect(viewportAllowed(800, 600)).toBe(true);
    expect(viewportAllowed(MIN_VIEWPORT_W, MIN_VIEWPORT_H)).toBe(true);
  });

  // Both boundaries by their literal numbers as well as by the constants, so a pair
  // of coincidences (a constant moved AND the arithmetic below it moved with it)
  // cannot keep the test green.
  it('rejects one pixel under either threshold', () => {
    expect(viewportAllowed(767, 560)).toBe(false);
    expect(viewportAllowed(768, 559)).toBe(false);
    expect(viewportAllowed(768, 560)).toBe(true);
    expect(viewportAllowed(MIN_VIEWPORT_W - 1, MIN_VIEWPORT_H)).toBe(false);
    expect(viewportAllowed(MIN_VIEWPORT_W, MIN_VIEWPORT_H - 1)).toBe(false);
  });

  it('rejects a phone', () => {
    expect(viewportAllowed(390, 844)).toBe(false);
  });

  it('rejects a zero or negative viewport instead of dividing by it', () => {
    expect(viewportAllowed(0, 0)).toBe(false);
    expect(viewportAllowed(-100, 900)).toBe(false);
  });
});
