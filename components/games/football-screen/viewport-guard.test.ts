import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W } from './camera';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from './viewport-guard';

describe('viewportAllowed', () => {
  it('the thresholds leave room for the 800 x 500 canvas plus the HUD', () => {
    expect(MIN_VIEWPORT_W).toBeGreaterThanOrEqual(VIEW_W);
    expect(MIN_VIEWPORT_H).toBeGreaterThanOrEqual(VIEW_H);
  });

  it('accepts a desktop viewport', () => {
    expect(viewportAllowed(1440, 900)).toBe(true);
    expect(viewportAllowed(MIN_VIEWPORT_W, MIN_VIEWPORT_H)).toBe(true);
  });

  it('rejects a phone, a narrow window and a short window', () => {
    expect(viewportAllowed(390, 844)).toBe(false);
    expect(viewportAllowed(MIN_VIEWPORT_W - 1, MIN_VIEWPORT_H)).toBe(false);
    expect(viewportAllowed(MIN_VIEWPORT_W, MIN_VIEWPORT_H - 1)).toBe(false);
  });

  it('rejects a zero or negative viewport instead of dividing by it', () => {
    expect(viewportAllowed(0, 0)).toBe(false);
    expect(viewportAllowed(-100, 900)).toBe(false);
  });
});
