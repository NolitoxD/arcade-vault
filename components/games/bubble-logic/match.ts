import { CELLS, COLS, colOf, idx, neighbors, rowOf, type Board } from './grid';

// Scratch shared by findGroup and findFloating: preallocated once, reused every
// call to keep this on the zero-allocations-per-frame path. `stamp` is bumped
// on every walk so a cell's `visited[i] === gen` check tells "seen this walk",
// without ever needing to clear the 150-cell `visited` array back out.
const stack = new Int16Array(CELLS);
const visited = new Uint16Array(CELLS);
const nb = new Int16Array(6);
let stamp = 0;

export function findGroup(b: Board, start: number, out: Int16Array): number {
  const target = b.color[start];
  if (target === 0) return 0;

  const gen = ++stamp;
  let sp = 0;
  let n = 0;
  stack[sp++] = start;
  visited[start] = gen;

  while (sp > 0) {
    const cur = stack[--sp];
    out[n++] = cur;
    const count = neighbors(rowOf(cur), colOf(cur), b.parity, nb);
    for (let k = 0; k < count; k++) {
      const j = nb[k];
      if (visited[j] === gen) continue;
      if (b.color[j] !== target) continue;
      visited[j] = gen;
      stack[sp++] = j;
    }
  }
  return n;
}

export function findFloating(b: Board, out: Int16Array): number {
  const gen = ++stamp;
  let sp = 0;

  for (let c = 0; c < COLS; c++) {
    const i = idx(0, c);
    if (b.color[i] === 0) continue;
    visited[i] = gen;
    stack[sp++] = i;
  }

  while (sp > 0) {
    const cur = stack[--sp];
    const count = neighbors(rowOf(cur), colOf(cur), b.parity, nb);
    for (let k = 0; k < count; k++) {
      const j = nb[k];
      if (b.color[j] === 0) continue;
      if (visited[j] === gen) continue;
      visited[j] = gen;
      stack[sp++] = j;
    }
  }

  let n = 0;
  for (let i = 0; i < CELLS; i++) {
    if (b.color[i] !== 0 && visited[i] !== gen) out[n++] = i;
  }
  return n;
}

// Index 0 stays unused; colour ids run 1-6, so 7 slots cover them with no
// scaling arithmetic needed to translate an id into a slot.
const seen = new Uint8Array(7);

export function livePalette(b: Board, out: Uint8Array): number {
  seen.fill(0);
  for (let i = 0; i < CELLS; i++) {
    const v = b.color[i];
    if (v !== 0) seen[v] = 1;
  }

  let n = 0;
  for (let v = 1; v < seen.length; v++) {
    if (seen[v]) out[n++] = v;
  }
  return n;
}
