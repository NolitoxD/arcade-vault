import { describe, expect, it } from 'vitest';
import {
  CELLS, COLS, ROWS, R, PLAY_W, ROW_H, ROW0_Y, DEATH_LINE_Y,
  cellX, cellY, colOf, createBoard, idx, neighbors, pixelToCell, rowOf, rowShifted,
} from './grid';

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

  it('has six neighbours inside, three or four on the border', () => {
    for (const parity of [0, 1] as const) {
      for (let i = 0; i < CELLS; i++) {
        const r = rowOf(i), c = colOf(i);
        const n = neighbors(r, c, parity, nb);
        const inside = r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1;
        if (inside) expect({ i, parity, n }).toEqual({ i, parity, n: 6 });
        else expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThanOrEqual(6);
      }
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
