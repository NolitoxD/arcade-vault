import { describe, expect, it } from 'vitest';
import { parseMaze, validateMaze } from './maze';
import { MAZES } from './mazes';

describe('MAZES', () => {
  it('contains exactly 3 layouts', () => {
    expect(MAZES.length).toBe(3);
  });

  it.each(MAZES.map((rows, index) => [index, rows] as const))(
    'maze %i has no violations under production defaults',
    (_index, rows) => {
      const violations = validateMaze(parseMaze(rows));
      expect(violations).toEqual([]);
    },
  );

  it('the three mazes are pairwise different', () => {
    const [a, b, c] = MAZES.map((rows) => JSON.stringify(rows));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });
});
