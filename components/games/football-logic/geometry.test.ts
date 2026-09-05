import { describe, expect, it } from 'vitest';
import { INV_SQRT2, clamp, dist, normalizeInto, type Vec2 } from './geometry';

describe('geometry', () => {
  it('dist is euclidean (3-4-5 scaled by 7)', () => {
    expect(dist(10, 20, 31, 48)).toBe(35);
  });
  it('normalizeInto writes a unit vector and returns true', () => {
    const out: Vec2 = { x: 0, y: 0 };
    expect(normalizeInto(out, 30, -40)).toBe(true);
    expect(out.x).toBeCloseTo(0.6, 10);
    expect(out.y).toBeCloseTo(-0.8, 10);
  });
  it('normalizeInto leaves out untouched and returns false for the zero vector', () => {
    const out: Vec2 = { x: 0.6, y: 0.8 };
    expect(normalizeInto(out, 0, 0)).toBe(false);
    expect(out).toEqual({ x: 0.6, y: 0.8 });
  });
  it('INV_SQRT2 is the diagonal factor', () => {
    expect(INV_SQRT2 * INV_SQRT2).toBeCloseTo(0.5, 12);
  });
  it('clamp holds both ends', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(7, 0, 10)).toBe(7);
  });
});
