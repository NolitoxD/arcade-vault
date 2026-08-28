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

export const MAPS: readonly MapConfig[] = [MAP_1] as const;

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
