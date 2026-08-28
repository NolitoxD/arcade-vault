import { clearBoard, COLS, idx, type Board } from './grid';

export const MAGIC_BOMB = 1;
export const MAGIC_RAY = 2;
export const MAGIC_PURGE = 3;
export const MAGIC_ANCHOR = 4;
export type MagicId = 0 | 1 | 2 | 3 | 4;

// English initials, ids 1-6 in this order (overrides the Spanish RANVMC draft
// from the brief, per project decision): red, blue, yellow, green, magenta, cyan.
export const COLOR_CHARS = 'RBYGMC';
export const COLOR_COUNT = 6;

export type MapConfig = {
  readonly map: number; // 1..8
  readonly rows: readonly string[]; // COLS characters per row; lowercase = magic bubble
  readonly colors: readonly number[]; // declared palette, ascending ids
  readonly bubbles: number; // declared count; the invariant checks it against the layout
  readonly dropEvery: number; // shots between ceiling drops
  readonly magic: MagicId; // 1..4
};

// The game always ends on map 8, even while MAPS only holds the first map.
export const LAST_MAP = 8;

export function charToColor(ch: string): number {
  const i = COLOR_CHARS.indexOf(ch.toUpperCase());
  return i === -1 ? 0 : i + 1;
}

// 5x10 solid block, 3 colours, one magic bubble (lowercase 'y') anchored in the
// bottom row so it always has a free cell to hang a third bubble off.
const MAP_1: MapConfig = {
  map: 1,
  rows: [
    'RRBBYYRRBB',
    'RRBBYYRRBB',
    'RRBBYYRRBB',
    'RRBBYYRRBB',
    'RRBBYyRRBB',
  ],
  colors: [1, 2, 3],
  bubbles: 50,
  dropEvery: 12,
  magic: MAGIC_BOMB,
};

// 6x10, 3 colours, first internal gaps and small danglers hanging off the
// solid shoulder. Magic bubble ('r') anchors the bottom-left column, which
// runs unbroken from row 0 so popping it is a clean, guaranteed reward.
const MAP_2: MapConfig = {
  map: 2,
  rows: [
    'RBYRBYRBYR',
    'RBYRBYRBYR',
    'RBYRBYRBYR',
    'RBYRBYRBYR',
    'RBY.BYR.YR',
    'rB.RB.RBYR',
  ],
  colors: [1, 2, 3],
  bubbles: 56,
  dropEvery: 10,
  magic: MAGIC_BOMB,
};

// 6x10, 4 colours (green joins). Two columns cascade two rows past the rest
// of the block — the first map with a silhouette instead of a flat edge.
// Magic bubble ('y') sits at the tip of the left cascade column.
const MAP_3: MapConfig = {
  map: 3,
  rows: [
    'RBYGRBYGRB',
    'RBYGRBYGRB',
    'RBYGRBYGRB',
    'RBYGRBYGRB',
    '.BYGR.YGRB',
    '..yG...GR.',
  ],
  colors: [1, 2, 3, 4],
  bubbles: 52,
  dropEvery: 9,
  magic: MAGIC_RAY,
};

// 7x10, 4 colours. A jagged, comb-like ceiling: alternating deep and shallow
// columns so a straight shot into the middle finds a wall, not a gap — the
// first map that pushes the player toward the side-wall bounce. Magic bubble
// ('g') sits at the base of one of the deep teeth.
const MAP_4: MapConfig = {
  map: 4,
  rows: [
    'GYBRGYBRGY',
    'GYBRGYBRGY',
    'GYBRGYBRGY',
    'GYBRGYBRGY',
    'GYBRGYBRGY',
    'GYBRG.B.G.',
    'G.B.g.B.G.',
  ],
  colors: [1, 2, 3, 4],
  bubbles: 62,
  dropEvery: 8,
  magic: MAGIC_RAY,
};

// 7x10, 5 colours (magenta joins). Colour blocks read as separate clusters
// rather than one repeating pattern, and the bottom rows keep only three of
// the five clusters alive, each hanging on its own. Magic bubble ('m') caps
// the magenta cluster, the deepest point on the board.
const MAP_5: MapConfig = {
  map: 5,
  rows: [
    'RRBBYYGGMM',
    'RRBBYYGGMM',
    'RRBBYYGGMM',
    'RRBBYYGGMM',
    'RR.BYYG.MM',
    'RR..YY..MM',
    'RR......Mm',
  ],
  colors: [1, 2, 3, 4, 5],
  bubbles: 58,
  dropEvery: 7,
  magic: MAGIC_PURGE,
};

// 8x10, 5 colours. A one-cell-wide shaft at column 8, walled on both sides
// by columns that run the full depth of the block — a corridor a shot has
// to thread rather than a simple ragged edge. Magic bubble ('r') sits at the
// foot of the shaft's left wall, right where that shot has to land.
const MAP_6: MapConfig = {
  map: 6,
  rows: [
    'MMBBYYRRGG',
    'MMBBYYRRGG',
    'MMBBYYRRGG',
    'MMBBYYRRGG',
    'MM.BYYRR.G',
    'MM.BY.RR.G',
    '.M.BY.RR.G',
    '...BY.Rr.G',
  ],
  colors: [1, 2, 3, 4, 5],
  bubbles: 66,
  dropEvery: 6,
  magic: MAGIC_PURGE,
};

// 8x10, 6 colours (cyan joins). Dense block, barely any holes — the tightest
// margin so far. Magic bubble ('r') anchors the bottom-left column, unbroken
// from row 0.
const MAP_7: MapConfig = {
  map: 7,
  rows: [
    'RBYGMCRBYG',
    'RBYGMCRBYG',
    'RBYGMCRBYG',
    'RBYGMCRBYG',
    'RBYGMCRBYG',
    'RBYGMCRBYG',
    'RBYGMCRBYG',
    'rB.GM.R.Y.',
  ],
  colors: [1, 2, 3, 4, 5, 6],
  bubbles: 76,
  dropEvery: 6,
  magic: MAGIC_ANCHOR,
};

// 9x10, 6 colours. The final map: densest block, deepest starting reach,
// fewest shots between ceiling drops. Magic bubble ('c') anchors the
// bottom-left column, unbroken from row 0.
const MAP_8: MapConfig = {
  map: 8,
  rows: [
    'CMYGBRCMYG',
    'CMYGBRCMYG',
    'CMYGBRCMYG',
    'CMYGBRCMYG',
    'CMYGBRCMYG',
    'CMYGBRCMYG',
    'CMYGBRCMYG',
    'CMYGBRCMYG',
    'cMY.BRC.YG',
  ],
  colors: [1, 2, 3, 4, 5, 6],
  bubbles: 88,
  dropEvery: 5,
  magic: MAGIC_ANCHOR,
};

export const MAPS: readonly MapConfig[] = [
  MAP_1,
  MAP_2,
  MAP_3,
  MAP_4,
  MAP_5,
  MAP_6,
  MAP_7,
  MAP_8,
] as const;

export function configFor(map: number): MapConfig {
  const clamped = Math.max(1, Math.min(map, MAPS.length));
  return MAPS[clamped - 1];
}

export function parseMap(cfg: MapConfig, b: Board): void {
  clearBoard(b);
  for (let r = 0; r < cfg.rows.length; r++) {
    const row = cfg.rows[r];
    for (let c = 0; c < COLS && c < row.length; c++) {
      const ch = row[c];
      const color = charToColor(ch);
      if (color === 0) continue;
      const i = idx(r, c);
      b.color[i] = color;
      if (ch !== ch.toUpperCase()) b.magic[i] = cfg.magic;
    }
  }
}
