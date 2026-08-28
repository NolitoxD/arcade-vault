import { describe, expect, it } from 'vitest';
import {
  CELLS, COLS, ROWS, R, PLAY_W, ROW_H, ROW0_Y, DEATH_LINE_Y, DEATH_ROW,
  anyAtOrBelow, cellX, cellY, colOf, countBubbles, createBoard, dropCeiling, idx,
  neighbors, pixelToCell, rowOf, rowShifted,
} from './grid';
import type { Board } from './grid';

const nb = new Int16Array(6);
const nb2 = new Int16Array(6);

function neighborSet(i: number, parity: 0 | 1): Set<number> {
  const n = neighbors(rowOf(i), colOf(i), parity, nb);
  const s = new Set<number>();
  for (let k = 0; k < n; k++) s.add(nb[k]);
  return s;
}

describe('hex grid neighbourhood', () => {
  it('is symmetric for every cell in both parities', () => {
    for (const parity of [0, 1] as const) {
      for (let i = 0; i < CELLS; i++) {
        for (const j of neighborSet(i, parity)) {
          const back = neighbors(rowOf(j), colOf(j), parity, nb2);
          let found = false;
          for (let k = 0; k < back; k++) if (nb2[k] === i) found = true;
          expect({ parity, i, j, found }).toEqual({ parity, i, j, found: true });
        }
      }
    }
  });

  it('gives every interior cell exactly six neighbours', () => {
    for (const parity of [0, 1] as const) {
      for (let r = 1; r < ROWS - 1; r++) {
        for (let c = 1; c < COLS - 1; c++) {
          expect({ parity, r, c, n: neighbors(r, c, parity, nb) }).toEqual({ parity, r, c, n: 6 });
        }
      }
    }
  });

  it('gives the top and bottom edges (excluding corners) exactly four neighbours', () => {
    for (const parity of [0, 1] as const) {
      for (let c = 1; c < COLS - 1; c++) {
        expect({ parity, c, n: neighbors(0, c, parity, nb) }).toEqual({ parity, c, n: 4 });
        expect({ parity, c, n: neighbors(ROWS - 1, c, parity, nb) }).toEqual({ parity, c, n: 4 });
      }
    }
  });

  // A shifted row's cells sit half a diameter to the right of a flush row's, so on the left
  // edge a shifted row still touches both diagonal neighbours in the row above/below (5 total)
  // while a flush row loses its two left diagonals (3 total) — and it's the mirror image on
  // the right edge. Measured directly from `neighbors`, keyed off rowShifted so it holds for
  // both parities without hardcoding which physical rows happen to be shifted.
  it('gives the left and right edges (excluding corners) five or three neighbours depending on row shift', () => {
    for (const parity of [0, 1] as const) {
      for (let r = 1; r < ROWS - 1; r++) {
        const shifted = rowShifted(r, parity);
        expect({ parity, r, n: neighbors(r, 0, parity, nb) }).toEqual({ parity, r, n: shifted ? 5 : 3 });
        expect({ parity, r, n: neighbors(r, COLS - 1, parity, nb) }).toEqual({ parity, r, n: shifted ? 3 : 5 });
      }
    }
  });

  // The parity flag shifts every odd-relative-to-parity row the same direction (never
  // alternating independently per side), so exactly two of the four absolute corners sit on
  // the side that shift leans away from and lose a neighbour: 2 instead of 3. Measured
  // directly from `neighbors`, not derived from the edge/interior counts above.
  it('gives each of the four absolute corners exactly the neighbour count its parity/side produces', () => {
    const expected: Record<0 | 1, { tl: number; tr: number; bl: number; br: number }> = {
      0: { tl: 2, tr: 3, bl: 2, br: 3 },
      1: { tl: 3, tr: 2, bl: 3, br: 2 },
    };
    for (const parity of [0, 1] as const) {
      const { tl, tr, bl, br } = expected[parity];
      expect(neighbors(0, 0, parity, nb)).toBe(tl);
      expect(neighbors(0, COLS - 1, parity, nb)).toBe(tr);
      expect(neighbors(ROWS - 1, 0, parity, nb)).toBe(bl);
      expect(neighbors(ROWS - 1, COLS - 1, parity, nb)).toBe(br);
    }
  });

  it('never returns itself or an out-of-range index', () => {
    for (const parity of [0, 1] as const) {
      for (let i = 0; i < CELLS; i++) {
        for (const j of neighborSet(i, parity)) {
          expect(j).not.toBe(i);
          expect(j).toBeGreaterThanOrEqual(0);
          expect(j).toBeLessThan(CELLS);
          expect(Math.abs(rowOf(j) - rowOf(i))).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('cell to pixel mapping', () => {
  it('keeps every bubble inside the play field in both parities', () => {
    for (const parity of [0, 1] as const) {
      for (let i = 0; i < CELLS; i++) {
        const x = cellX(rowOf(i), colOf(i), parity);
        expect(x - R).toBeGreaterThanOrEqual(0);
        expect(x + R).toBeLessThanOrEqual(PLAY_W);
      }
    }
  });

  it('places row 0 under the roof and row 14 above the death line', () => {
    expect(cellY(0)).toBe(ROW0_Y);
    expect(cellY(ROWS - 1) + R).toBeLessThan(DEATH_LINE_Y);
    expect(cellY(1) - cellY(0)).toBeCloseTo(ROW_H, 9);
  });

  it('round-trips every cell centre back to its own indices', () => {
    const out = new Int16Array(2);
    for (const parity of [0, 1] as const) {
      for (let i = 0; i < CELLS; i++) {
        const r = rowOf(i), c = colOf(i);
        pixelToCell(cellX(r, c, parity), cellY(r), parity, out);
        expect({ parity, i, r: out[0], c: out[1] }).toEqual({ parity, i, r, c });
      }
    }
  });

  it('clamps pixels outside the board instead of returning junk', () => {
    const out = new Int16Array(2);
    pixelToCell(-500, -500, 0, out);
    expect([out[0], out[1]]).toEqual([0, 0]);
    pixelToCell(9999, 9999, 1, out);
    expect([out[0], out[1]]).toEqual([ROWS - 1, COLS - 1]);
  });
});

describe('board container', () => {
  it('creates independent zeroed buffers', () => {
    const a = createBoard(), b = createBoard();
    expect(a.color).not.toBe(b.color);
    expect(a.color.length).toBe(CELLS);
    expect(a.magic.length).toBe(CELLS);
    expect(a.parity).toBe(0);
    a.color[idx(3, 4)] = 5;
    expect(b.color[idx(3, 4)]).toBe(0);
  });
  it('agrees on row parity', () => {
    expect(rowShifted(0, 0)).toBe(false);
    expect(rowShifted(1, 0)).toBe(true);
    expect(rowShifted(0, 1)).toBe(true);
    expect(rowShifted(1, 1)).toBe(false);
  });
});

const PALETTE = Uint8Array.from([1, 2, 3]);
const rand = () => 0; // deterministic: always palette[0]

function boardWithRows(rows: number[][]): Board {
  const b = createBoard();
  rows.forEach((row, r) => row.forEach((v, c) => { b.color[idx(r, c)] = v; }));
  return b;
}

describe('dropCeiling', () => {
  it('shifts every bubble down exactly one row and keeps the magic layer aligned', () => {
    const b = createBoard();
    b.color[idx(0, 3)] = 2;
    b.magic[idx(0, 3)] = 4;
    dropCeiling(b, PALETTE, 3, rand);
    expect(b.color[idx(1, 3)]).toBe(2);
    expect(b.magic[idx(1, 3)]).toBe(4);
    expect(b.magic[idx(0, 3)]).toBe(0);
  });

  it('toggles parity on every drop', () => {
    const b = createBoard();
    b.color[idx(0, 0)] = 1;
    expect(b.parity).toBe(0);
    dropCeiling(b, PALETTE, 3, rand);
    expect(b.parity).toBe(1);
    dropCeiling(b, PALETTE, 3, rand);
    expect(b.parity).toBe(0);
  });

  it('preserves the bubble count plus the freshly seeded row', () => {
    const b = boardWithRows([[1, 1, 2, 2, 3, 3, 1, 1, 2, 2], [0, 0, 1, 1, 0, 0, 2, 2, 0, 0]]);
    const before = countBubbles(b);
    dropCeiling(b, PALETTE, 3, rand);
    expect(countBubbles(b)).toBe(before + COLS);
  });

  it('seeds the new row 0 only with live palette colours', () => {
    const b = createBoard();
    b.color[idx(0, 0)] = 1;
    dropCeiling(b, Uint8Array.from([5, 6]), 2, () => 0.99);
    for (let c = 0; c < COLS; c++) expect([5, 6]).toContain(b.color[idx(0, c)]);
  });

  it('refuses to drop and reports the map lost when the last row is occupied', () => {
    const b = createBoard();
    b.color[idx(ROWS - 1, 4)] = 1;
    const snapshot = Uint8Array.from(b.color);
    expect(dropCeiling(b, PALETTE, 3, rand)).toBe(true);
    expect(Array.from(b.color)).toEqual(Array.from(snapshot));
    expect(b.parity).toBe(0);
  });

  it('reports the map lost when the drop pushes a bubble onto the death row', () => {
    const b = createBoard();
    b.color[idx(DEATH_ROW - 1, 2)] = 1;
    expect(dropCeiling(b, PALETTE, 3, rand)).toBe(true);
    expect(anyAtOrBelow(b, DEATH_ROW)).toBe(true);
  });
});
