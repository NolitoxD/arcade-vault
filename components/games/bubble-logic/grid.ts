export const COLS = 10;
export const ROWS = 15;
export const CELLS = ROWS * COLS;
export const D = 40;
export const R = 20;
export const ROW_H = R * Math.sqrt(3);
export const PLAY_W = COLS * D + R;
export const HUD_W = 180;
export const CANVAS_W = 600;
export const CANVAS_H = 700;
export const ROOF_Y = 24;
export const ROW0_Y = ROOF_Y + R;
export const DEATH_ROW = 14;
export const DEATH_LINE_Y = 550;
export const CANNON_X = 210;
export const CANNON_Y = 620;

export type Board = { color: Uint8Array; magic: Uint8Array; parity: 0 | 1 };

export function createBoard(): Board {
  return { color: new Uint8Array(CELLS), magic: new Uint8Array(CELLS), parity: 0 };
}

export function clearBoard(b: Board): void {
  b.color.fill(0);
  b.magic.fill(0);
  b.parity = 0;
}

export function idx(r: number, c: number): number {
  return r * COLS + c;
}

export function rowOf(i: number): number {
  return Math.floor(i / COLS);
}

export function colOf(i: number): number {
  return i % COLS;
}

export function rowShifted(r: number, parity: 0 | 1): boolean {
  return (r + parity) % 2 === 1;
}

// Flat offset tables (row delta, col delta pairs) instead of arrays of pairs,
// so each neighbour costs one index into a single typed lookup.
const NB_FLUSH = [0, -1, 0, 1, -1, -1, -1, 0, 1, -1, 1, 0] as const; // row not shifted
const NB_SHIFTED = [0, -1, 0, 1, -1, 0, -1, 1, 1, 0, 1, 1] as const; // row shifted

export function neighbors(r: number, c: number, parity: 0 | 1, dst: Int16Array): number {
  const t = rowShifted(r, parity) ? NB_SHIFTED : NB_FLUSH;
  let n = 0;
  for (let k = 0; k < 12; k += 2) {
    const rr = r + t[k];
    const cc = c + t[k + 1];
    if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
    dst[n++] = idx(rr, cc);
  }
  return n;
}

export function cellX(r: number, c: number, parity: 0 | 1): number {
  return R + D * c + (rowShifted(r, parity) ? R : 0);
}

export function cellY(r: number): number {
  return ROW0_Y + ROW_H * r;
}

export function pixelToCell(x: number, y: number, parity: 0 | 1, out: Int16Array): void {
  let r = Math.round((y - ROW0_Y) / ROW_H);
  if (r < 0) r = 0;
  else if (r > ROWS - 1) r = ROWS - 1;

  const offset = rowShifted(r, parity) ? R : 0;
  let c = Math.round((x - R - offset) / D);
  if (c < 0) c = 0;
  else if (c > COLS - 1) c = COLS - 1;

  out[0] = r;
  out[1] = c;
}

export function countBubbles(b: Board): number {
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (b.color[i] !== 0) n++;
  return n;
}

export function anyAtOrBelow(b: Board, row: number): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (b.color[i] !== 0 && rowOf(i) >= row) return true;
  }
  return false;
}

export function isEmptyBoard(b: Board): boolean {
  for (let i = 0; i < CELLS; i++) if (b.color[i] !== 0) return false;
  return true;
}
