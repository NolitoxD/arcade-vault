import { CELLS, COLS, DEATH_ROW, colOf, countBubbles, idx, neighbors, rowOf, type Board } from './grid';
import { findFloating, findGroup, livePalette } from './match';
import { ANGLE_MAX, ANGLE_MIN, simulateShot } from './shot';
import { charToColor, COLOR_COUNT, type MapConfig } from './maps';

// Scratch buffers reused across calls so a full check never allocates.
const FLOATING = new Int16Array(CELLS);
const MAGIC_GROUP = new Int16Array(CELLS);
const NB = new Int16Array(6);
const PALETTE = new Uint8Array(COLOR_COUNT + 1);
const LANDED = new Uint8Array(CELLS);

const ANGLE_STEP = (0.5 * Math.PI) / 180;

export function checkMap(cfg: MapConfig, b: Board): string[] {
  const problems: string[] = [];

  if (cfg.rows.some((row) => row.length !== COLS)) problems.push('row width');

  const badChars = new Set<string>();
  for (const row of cfg.rows) {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      if (charToColor(ch) === 0) badChars.add(ch);
    }
  }
  for (const ch of badChars) problems.push(`unknown char ${ch}`);

  let startsTooLow = false;
  for (let i = 0; i < CELLS; i++) {
    if (b.color[i] !== 0 && rowOf(i) >= DEATH_ROW - 4) {
      startsTooLow = true;
      break;
    }
  }
  if (startsTooLow) problems.push('starts too low');

  let row0Filled = false;
  for (let c = 0; c < COLS; c++) {
    if (b.color[idx(0, c)] !== 0) {
      row0Filled = true;
      break;
    }
  }
  if (!row0Filled) problems.push('row 0 empty');

  const floatingCount = findFloating(b, FLOATING);
  if (floatingCount > 0) problems.push('floating at start');

  if (countBubbles(b) !== cfg.bubbles) problems.push('bubble count mismatch');

  const boardColors = new Set<number>();
  for (let i = 0; i < CELLS; i++) {
    if (b.color[i] !== 0) boardColors.add(b.color[i]);
  }
  for (const v of boardColors) {
    if (!cfg.colors.includes(v)) problems.push(`colour ${v} outside palette`);
  }
  const paletteLen = livePalette(b, PALETTE);
  const livePaletteSet = new Set<number>();
  for (let i = 0; i < paletteLen; i++) livePaletteSet.add(PALETTE[i]);
  for (const v of cfg.colors) {
    if (!livePaletteSet.has(v)) problems.push(`palette colour ${v} unused`);
  }

  let magicCell = -1;
  let magicCount = 0;
  let magicMismatch = false;
  for (let i = 0; i < CELLS; i++) {
    if (b.magic[i] !== 0) {
      magicCount++;
      if (magicCell === -1) magicCell = i;
      if (b.magic[i] !== cfg.magic) magicMismatch = true;
    }
  }
  if (magicCount !== 1) problems.push(`magic count ${magicCount}`);
  if (magicMismatch) problems.push('magic id mismatch');

  let magicGroupCount = 0;
  const hasSingleMagic = magicCount === 1;
  if (hasSingleMagic) {
    magicGroupCount = findGroup(b, magicCell, MAGIC_GROUP);

    let hasFreeAdjacent = false;
    if (magicGroupCount >= 2) {
      for (let k = 0; k < magicGroupCount && !hasFreeAdjacent; k++) {
        const cell = MAGIC_GROUP[k];
        const n = neighbors(rowOf(cell), colOf(cell), b.parity, NB);
        for (let j = 0; j < n; j++) {
          if (b.color[NB[j]] === 0) {
            hasFreeAdjacent = true;
            break;
          }
        }
      }
    }
    if (magicGroupCount < 2 || !hasFreeAdjacent) problems.push('magic bubble unpoppable');
  }

  // Sweep every reachable angle once; reuse the landing set for both the
  // global "is this map dead on arrival" check and the magic-specific one.
  LANDED.fill(0);
  let anyLanding = false;
  for (let a = ANGLE_MIN; a <= ANGLE_MAX + 1e-9; a += ANGLE_STEP) {
    const cell = simulateShot(b, a);
    if (cell >= 0) {
      LANDED[cell] = 1;
      anyLanding = true;
    }
  }
  if (!anyLanding) problems.push('no landing spot');

  if (hasSingleMagic) {
    let reachable = false;
    for (let k = 0; k < magicGroupCount && !reachable; k++) {
      const cell = MAGIC_GROUP[k];
      const n = neighbors(rowOf(cell), colOf(cell), b.parity, NB);
      for (let j = 0; j < n; j++) {
        if (LANDED[NB[j]]) {
          reachable = true;
          break;
        }
      }
    }
    if (!reachable) problems.push('magic bubble unreachable');
  }

  return problems;
}

// Design constant: map N pairs with magic MAGIC_BY_MAP[N-1] (1-indexed maps).
const MAGIC_BY_MAP = [1, 1, 2, 2, 3, 3, 4, 4] as const;

// A ceiling drop on the very first shot leaves no room to react; treat that as
// part of "the drop-every curve isn't a valid progression", same as growth.
const MIN_DROP_EVERY = 2;

export function checkMapsProgression(maps: readonly MapConfig[]): string[] {
  const problems: string[] = [];

  for (let i = 0; i < maps.length; i++) {
    const cfg = maps[i];

    if (cfg.map !== i + 1) problems.push('map number mismatch');

    const expectedMagic = MAGIC_BY_MAP[cfg.map - 1];
    if (expectedMagic !== undefined && cfg.magic !== expectedMagic) {
      problems.push(`magic pairing wrong at map ${cfg.map}`);
    }

    if (cfg.dropEvery < MIN_DROP_EVERY) {
      problems.push(`dropEvery grows at map ${cfg.map}`);
    }

    if (i > 0) {
      const prev = maps[i - 1];
      if (cfg.dropEvery > prev.dropEvery) problems.push(`dropEvery grows at map ${cfg.map}`);
      if (cfg.colors.length < prev.colors.length) problems.push(`colours shrink at map ${cfg.map}`);
    }
  }

  return problems;
}
