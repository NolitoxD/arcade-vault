import { describe, expect, it } from 'vitest';
import { COLS, createBoard, idx, type Board } from './grid';
import { findFloating, findGroup, livePalette } from './match';

const out = new Int16Array(150);
const pal = new Uint8Array(6);

function fill(b: Board, cells: [number, number, number][]) {
  for (const [r, c, v] of cells) b.color[idx(r, c)] = v;
}
function asSet(n: number): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < n; i++) s.add(out[i]);
  return s;
}

describe('findGroup', () => {
  it('finds a horizontal run of three', () => {
    const b = createBoard();
    fill(b, [[0, 0, 1], [0, 1, 1], [0, 2, 1], [0, 3, 2]]);
    expect(findGroup(b, idx(0, 0), out)).toBe(3);
    expect(asSet(3)).toEqual(new Set([idx(0, 0), idx(0, 1), idx(0, 2)]));
  });

  it('crosses the parity boundary between rows', () => {
    const b = createBoard();               // parity 0: row 0 flush, row 1 shifted
    fill(b, [[0, 4, 3], [1, 3, 3], [1, 4, 3]]);
    expect(findGroup(b, idx(0, 4), out)).toBe(3);
  });

  it('does not merge two different colours', () => {
    const b = createBoard();
    fill(b, [[0, 0, 1], [0, 1, 1], [0, 2, 2]]);
    expect(findGroup(b, idx(0, 0), out)).toBe(2);
  });

  it('returns zero for an empty cell', () => {
    expect(findGroup(createBoard(), idx(5, 5), out)).toBe(0);
  });

  it('returns the same answer when called twice in a row (no leaked visited state)', () => {
    const b = createBoard();
    fill(b, [[0, 0, 1], [0, 1, 1], [0, 2, 1]]);
    const first = findGroup(b, idx(0, 0), out);
    const second = findGroup(b, idx(0, 0), out);
    expect(second).toBe(first);
  });
});

describe('findFloating', () => {
  it('reports nothing when the whole mass hangs from row 0', () => {
    const b = createBoard();
    fill(b, [[0, 0, 1], [1, 0, 1], [2, 0, 1]]);
    expect(findFloating(b, out)).toBe(0);
  });

  it('reports the cluster left hanging when its only bridge is gone', () => {
    const b = createBoard();
    fill(b, [[0, 0, 1], [3, 5, 2], [3, 6, 2]]);
    expect(findFloating(b, out)).toBe(2);
    expect(asSet(2)).toEqual(new Set([idx(3, 5), idx(3, 6)]));
  });

  it('seeds from row 0 only, never from a pixel roof line', () => {
    const b = createBoard();
    fill(b, [[1, 0, 1], [1, 1, 1]]);       // nada en la fila 0
    expect(findFloating(b, out)).toBe(2);
  });

  it('walks through colour changes, unlike findGroup', () => {
    const b = createBoard();
    fill(b, [[0, 0, 1], [1, 0, 2], [2, 0, 3]]);
    expect(findFloating(b, out)).toBe(0);
  });
});

describe('livePalette', () => {
  it('lists each present colour once, ascending', () => {
    const b = createBoard();
    fill(b, [[0, 0, 3], [0, 1, 1], [0, 2, 3], [0, 3, 5]]);
    expect(livePalette(b, pal)).toBe(3);
    expect(Array.from(pal.subarray(0, 3))).toEqual([1, 3, 5]);
  });
  it('returns zero on an empty board', () => {
    expect(livePalette(createBoard(), pal)).toBe(0);
  });
});
