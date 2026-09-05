import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

function take(seed: number, n: number): number[] {
  const rng = createRng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng());
  return out;
}

describe('createRng', () => {
  it('same seed yields the same sequence', () => {
    expect(take(12345, 50)).toEqual(take(12345, 50));
  });
  it('different seeds yield different sequences (not just a shifted copy)', () => {
    const a = take(12345, 50);
    const b = take(12346, 50);
    expect(a).not.toEqual(b);
    expect(a.slice(1)).not.toEqual(b.slice(0, 49));
  });
  it('stays inside [0, 1) over a long run', () => {
    // One assertion that names the offending values, instead of 100 000 expects.
    expect(take(7, 100_000).filter((v) => !(v >= 0 && v < 1))).toEqual([]);
  });
  it('is not stuck: 1000 draws use both halves of the range', () => {
    const values = take(99, 1000);
    expect(values.some((v) => v < 0.5)).toBe(true);
    expect(values.some((v) => v >= 0.5)).toBe(true);
  });
  it('seed 0 is a valid seed and differs from seed 1', () => {
    expect(take(0, 10)).not.toEqual(take(1, 10));
  });
});
