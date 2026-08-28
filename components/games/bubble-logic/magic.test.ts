import { describe, expect, it } from 'vitest';
import { CELLS, COLS, createBoard, idx, rowOf } from './grid';
import { MAGIC_ANCHOR, MAGIC_BOMB, MAGIC_PURGE, MAGIC_RAY } from './maps';
import { ANCHOR_SHOTS, applyMagic, bombCells, purgeCells, rayCells } from './magic';

const out = new Int16Array(CELLS);
function fullBoard(color = 1) {
  const b = createBoard();
  b.color.fill(color);
  return b;
}

describe('bomb', () => {
  it('clears both rings around an interior cell: 18 cells plus none of its own', () => {
    const b = fullBoard();
    const n = bombCells(b, idx(7, 5), out);
    expect(n).toBe(18); // 6 del anillo 1 + 12 del anillo 2
    for (let i = 0; i < n; i++) expect(out[i]).not.toBe(idx(7, 5));
  });
  it('clips at the board edges instead of wrapping', () => {
    const b = fullBoard();
    const n = bombCells(b, idx(0, 0), out);
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(0);
      expect(out[i]).toBeLessThan(CELLS);
      expect(Math.abs(rowOf(out[i]) - 0)).toBeLessThanOrEqual(2);
    }
  });
  it('skips empty cells', () => {
    const b = createBoard();
    b.color[idx(7, 4)] = 2;
    expect(bombCells(b, idx(7, 5), out)).toBe(1);
  });
});

describe('ray', () => {
  it('clears the whole row of the magic bubble and nothing else', () => {
    const b = fullBoard();
    const n = rayCells(b, idx(4, 3), out);
    expect(n).toBe(COLS - 1); // la propia celda ya la vació el pop
    for (let i = 0; i < n; i++) expect(rowOf(out[i])).toBe(4);
  });
});

describe('colour purge', () => {
  it('clears every bubble of the given colour, wherever it is', () => {
    const b = createBoard();
    b.color[idx(0, 0)] = 3;
    b.color[idx(9, 9)] = 3;
    b.color[idx(5, 5)] = 2;
    const n = purgeCells(b, 3, out);
    expect(n).toBe(2);
    expect(b.color[idx(5, 5)]).toBe(2);
  });
});

describe('applyMagic', () => {
  it('empties the cells it reports', () => {
    const b = fullBoard();
    const n = applyMagic(b, MAGIC_RAY, idx(4, 3), 1, out);
    for (let i = 0; i < n; i++) expect(b.color[out[i]]).toBe(0);
  });
  it('clears nothing for the anchor: its effect is persistent', () => {
    const b = fullBoard();
    expect(applyMagic(b, MAGIC_ANCHOR, idx(4, 3), 1, out)).toBe(0);
    expect(b.color[idx(4, 2)]).toBe(1);
    expect(ANCHOR_SHOTS).toBe(4);
  });
  it('uses the colour it is given, not the one left on the board', () => {
    const b = createBoard();
    b.color[idx(0, 0)] = 5;
    b.color[idx(3, 3)] = 5;
    expect(applyMagic(b, MAGIC_PURGE, idx(1, 1), 5, out)).toBe(2);
  });
});
