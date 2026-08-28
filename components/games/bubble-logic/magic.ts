import { CELLS, COLS, colOf, idx, neighbors, rowOf, type Board } from './grid';
import { MAGIC_ANCHOR, MAGIC_BOMB, MAGIC_PURGE, MAGIC_RAY, type MagicId } from './maps';

export const ANCHOR_SHOTS = 4;

// Scratch shared across the ring walk: `ring1` has to be held aside while we
// walk each ring-1 cell's own neighbours to build ring2 (`nb` gets overwritten
// on every one of those calls), and `seen` is a generation-stamped marker —
// same trick as `visited` in match.ts — so the origin cell and ring1 never
// leak into ring2, and a ring2 cell reached from two different ring1 parents
// is only ever reported once.
const ring1 = new Int16Array(6);
const nb = new Int16Array(6);
const seen = new Uint16Array(CELLS);
let stamp = 0;

// Ring 2 is derived by applying `neighbors` to every ring-1 cell rather than a
// hand-written 18-cell offset table: a table would be a second source of
// truth for the hex geometry that could silently drift from `neighbors` the
// day the mesh changes. This costs a few dozen lookups once per detonation,
// not per frame.
export function bombCells(b: Board, cell: number, out: Int16Array): number {
  const gen = ++stamp;
  seen[cell] = gen;

  const ring1Count = neighbors(rowOf(cell), colOf(cell), b.parity, ring1);
  let n = 0;
  for (let i = 0; i < ring1Count; i++) {
    const j = ring1[i];
    seen[j] = gen;
    if (b.color[j] !== 0) out[n++] = j;
  }

  for (let i = 0; i < ring1Count; i++) {
    const r1 = ring1[i];
    const count = neighbors(rowOf(r1), colOf(r1), b.parity, nb);
    for (let k = 0; k < count; k++) {
      const j = nb[k];
      if (seen[j] === gen) continue;
      seen[j] = gen;
      if (b.color[j] !== 0) out[n++] = j;
    }
  }

  return n;
}

// The magic bubble's own cell is excluded: the normal pop already emptied it
// before applyMagic runs.
export function rayCells(b: Board, cell: number, out: Int16Array): number {
  const row = rowOf(cell);
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    const i = idx(row, c);
    if (i === cell) continue;
    if (b.color[i] !== 0) out[n++] = i;
  }
  return n;
}

export function purgeCells(b: Board, color: number, out: Int16Array): number {
  let n = 0;
  for (let i = 0; i < CELLS; i++) {
    if (b.color[i] === color) out[n++] = i;
  }
  return n;
}

// Applies the effect: writes to `out` the cells it pops and empties them from
// the board. ANCHOR pops nothing (returns 0): its effect is persistent state
// that run.ts owns and applies over the following shots.
export function applyMagic(
  b: Board,
  magic: MagicId,
  cell: number,
  color: number,
  out: Int16Array,
): number {
  let n: number;
  switch (magic) {
    case MAGIC_BOMB:
      n = bombCells(b, cell, out);
      break;
    case MAGIC_RAY:
      n = rayCells(b, cell, out);
      break;
    case MAGIC_PURGE:
      n = purgeCells(b, color, out);
      break;
    case MAGIC_ANCHOR:
      return 0;
    default:
      return 0;
  }

  for (let i = 0; i < n; i++) {
    const j = out[i];
    b.color[j] = 0;
    b.magic[j] = 0;
  }
  return n;
}
