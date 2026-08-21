import { describe, expect, it } from 'vitest';
import {
  THRESHOLDS, requiredCredits, isUnlocked, getRank, getStars,
  resolveSkin, crossedTiers,
} from './credits';

describe('thresholds', () => {
  it('are fixed 3/6/9', () => {
    expect(THRESHOLDS).toEqual({ retro: 3, neon: 6, extra: 9 });
    expect(requiredCredits('base')).toBe(0);
    expect(requiredCredits('neon')).toBe(6);
  });
  it('unlocks at the boundary and never below', () => {
    expect(isUnlocked('base', null)).toBe(true);
    expect(isUnlocked('retro', null)).toBe(false);
    expect(isUnlocked('retro', 2)).toBe(false);
    expect(isUnlocked('retro', 3)).toBe(true);
    expect(isUnlocked('neon', 5)).toBe(false);
    expect(isUnlocked('neon', 6)).toBe(true);
    expect(isUnlocked('extra', 8)).toBe(false);
    expect(isUnlocked('extra', 9)).toBe(true);
  });
});

describe('rank and stars', () => {
  it('maps credits to ranks with MAESTRO = full catalog', () => {
    expect(getRank(null, 9)).toBe('INVITADO');
    expect(getRank(0, 9)).toBe('NOVATO');
    expect(getRank(2, 9)).toBe('NOVATO');
    expect(getRank(3, 9)).toBe('JUGADOR');
    expect(getRank(6, 9)).toBe('VETERANO');
    expect(getRank(8, 9)).toBe('VETERANO');
    expect(getRank(9, 9)).toBe('MAESTRO DEL VAULT');
    expect(getRank(13, 13)).toBe('MAESTRO DEL VAULT');
    expect(getRank(10, 9)).toBe('MAESTRO DEL VAULT');
  });
  it('renders one star per threshold reached', () => {
    expect(getStars(null)).toBe('☆☆☆');
    expect(getStars(2)).toBe('☆☆☆');
    expect(getStars(3)).toBe('★☆☆');
    expect(getStars(6)).toBe('★★☆');
    expect(getStars(9)).toBe('★★★');
  });
});

describe('resolveSkin and crossedTiers', () => {
  const skins = [
    { key: 'classic', tier: 'base' as const },
    { key: 'retro', tier: 'retro' as const },
    { key: 'neon', tier: 'neon' as const },
  ];
  it('falls back to base when saved skin is locked or unknown', () => {
    expect(resolveSkin(skins, 'neon', 2)).toBe('classic');
    expect(resolveSkin(skins, 'neon', 6)).toBe('neon');
    expect(resolveSkin(skins, 'bogus', 9)).toBe('classic');
    expect(resolveSkin(skins, null, null)).toBe('classic');
  });
  it('lists tiers crossed between two credit counts', () => {
    expect(crossedTiers(2, 3)).toEqual(['retro']);
    expect(crossedTiers(2, 9)).toEqual(['retro', 'neon', 'extra']);
    expect(crossedTiers(3, 3)).toEqual([]);
    expect(crossedTiers(null, 3)).toEqual(['retro']);
  });
});
