// techniques.test.ts
import { describe, expect, it } from 'vitest';
import { TECHNIQUES, resolveTechnique, landsHit } from './techniques';

describe('techniques table', () => {
  it('has exactly 8 techniques, one per dir+button combo', () => {
    expect(TECHNIQUES).toHaveLength(8);
    const combos = new Set(TECHNIQUES.map((t) => `${t.input.dir}+${t.input.button}`));
    expect(combos.size).toBe(8);
  });
  it('full-point techniques are slower than their half-point siblings', () => {
    const full = TECHNIQUES.filter((t) => t.points === 1);
    const half = TECHNIQUES.filter((t) => t.points === 0.5);
    expect(full).toHaveLength(4);
    const minFull = Math.min(...full.map((t) => t.startupMs));
    const maxHalf = Math.max(...half.map((t) => t.startupMs));
    expect(minFull).toBeGreaterThan(maxHalf);
  });
  it('resolves every combo', () => {
    expect(resolveTechnique('up', 'a').name).toBe('Patada alta');
    expect(resolveTechnique('neutral', 'b').points).toBe(0.5);
  });
});

describe('landsHit', () => {
  const t = resolveTechnique('neutral', 'b'); // corto alcance
  const attacker = { x: 100, facing: 1 as const, blockingHeight: null, busyUntilMs: 0 };
  it('requires range', () => {
    const far = { x: 100 + t.range + 50, facing: -1 as const, blockingHeight: null, busyUntilMs: 0 };
    expect(landsHit(attacker, far, t, 0)).toBe(false);
    const near = { ...far, x: 100 + t.range - 5 };
    expect(landsHit(attacker, near, t, 0)).toBe(true);
  });
  it('is blocked by matching height only', () => {
    const near = { x: 100 + t.range - 5, facing: -1 as const, blockingHeight: t.height, busyUntilMs: 0 };
    expect(landsHit(attacker, near, t, 0)).toBe(false);
    expect(landsHit(attacker, { ...near, blockingHeight: t.height === 'high' ? 'low' : 'high' }, t, 0)).toBe(true);
  });
  it('attacker in recovery cannot hit', () => {
    const near = { x: 100 + t.range - 5, facing: -1 as const, blockingHeight: null, busyUntilMs: 0 };
    expect(landsHit({ ...attacker, busyUntilMs: 500 }, near, t, 100)).toBe(false);
  });
});
