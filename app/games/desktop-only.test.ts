import { describe, expect, it } from 'vitest';
import { isDesktopOnlyBlocked } from './desktop-only';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W } from '../../components/games/football-screen/viewport-guard';

describe('isDesktopOnlyBlocked', () => {
  // Anti-coincidence risk (Global Constraints): explicitly test that NO other
  // game in the catalog is affected, not just that vault-world-cup is.
  it('never blocks a game that is not vault-world-cup, at any size', () => {
    expect(isDesktopOnlyBlocked('pacman', 320, 480)).toBe(false);
    expect(isDesktopOnlyBlocked('vault-fighter', 0, 0)).toBe(false);
    expect(isDesktopOnlyBlocked('kong', 1, 1)).toBe(false);
  });

  it('is false for a string that is not even a real game id', () => {
    expect(isDesktopOnlyBlocked('not-a-real-game', 1920, 1080)).toBe(false);
  });

  it('blocks vault-world-cup strictly below either threshold, allows it at or above both', () => {
    expect(isDesktopOnlyBlocked('vault-world-cup', MIN_VIEWPORT_W - 1, MIN_VIEWPORT_H)).toBe(true);
    expect(isDesktopOnlyBlocked('vault-world-cup', MIN_VIEWPORT_W, MIN_VIEWPORT_H - 1)).toBe(true);
    expect(isDesktopOnlyBlocked('vault-world-cup', MIN_VIEWPORT_W, MIN_VIEWPORT_H)).toBe(false);
    expect(isDesktopOnlyBlocked('vault-world-cup', 1440, 900)).toBe(false);
  });

  it('pins the thresholds imported from viewport-guard.ts', () => {
    expect(MIN_VIEWPORT_W).toBe(768);
    expect(MIN_VIEWPORT_H).toBe(560);
  });
});
