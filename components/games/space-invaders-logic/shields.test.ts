import { describe, expect, it } from 'vitest';
import {
  SHIELD_COLS, SHIELD_ROWS, createShields,
  shieldHitTest, damageShield, aabb,
} from './shields';

describe('shields', () => {
  it('creates 4 shields with mostly intact arch-shaped pixels', () => {
    const shields = createShields(600, 560);
    expect(shields).toHaveLength(4);
    for (const s of shields) {
      expect(s.pixels).toHaveLength(SHIELD_COLS * SHIELD_ROWS);
      const intact = s.pixels.reduce((a, b) => a + b, 0);
      expect(intact).toBeGreaterThan(SHIELD_COLS * SHIELD_ROWS * 0.6);
      expect(intact).toBeLessThan(SHIELD_COLS * SHIELD_ROWS); // notch carved
    }
  });
  it('hit test maps canvas points to pixel index and misses outside bbox', () => {
    const [s] = createShields(600, 560);
    const midTop = shieldHitTest(s, s.x + 34, s.y + 1); // mid-top, known intact from arch template
    expect(midTop).toBeGreaterThanOrEqual(0);
    expect(s.pixels[midTop]).toBe(1);
    const center = shieldHitTest(s, s.x + 33, s.y + 10);
    expect(center).toBeGreaterThanOrEqual(0);
    expect(shieldHitTest(s, s.x - 5, s.y)).toBe(-1);
    expect(shieldHitTest(s, 0, 0)).toBe(-1);
  });
  it('damage clears the pixel and its crater, and hits stop landing there', () => {
    const [s] = createShields(600, 560);
    const idx = shieldHitTest(s, s.x + 33, s.y + 10);
    damageShield(s, idx);
    expect(s.pixels[idx]).toBe(0);
    expect(shieldHitTest(s, s.x + 33, s.y + 10)).toBe(-1);
  });
});

describe('aabb', () => {
  it('detects overlap and separation', () => {
    expect(aabb(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
    expect(aabb(0, 0, 10, 10, 20, 0, 5, 5)).toBe(false);
    expect(aabb(0, 0, 10, 10, 10, 0, 5, 5)).toBe(false); // touching edges don't collide
  });
});
