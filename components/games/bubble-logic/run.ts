import { CELLS, anyAtOrBelow, DEATH_ROW, dropCeiling, isEmptyBoard, type Board } from './grid';
import { findFloating, findGroup } from './match';
import { cascadeScore, popScore, SCORE_MAGIC, SCORE_MAP, SCORE_VICTORY } from './scoring';
import { ANCHOR_SHOTS, applyMagic } from './magic';
import { LAST_MAP, MAGIC_ANCHOR, parseMap, type MapConfig, type MagicId } from './maps';
import { pickColor, refreshPalette, remapOrphan, type Bag } from './bag';

export const MAX_LIVES = 3;
export const OUTCOME_NONE = 0;
export const OUTCOME_MAP_CLEAR = 1;
export const OUTCOME_LIFE_LOST = 2;
export const OUTCOME_VICTORY = 3;

export type RunState = {
  map: number; // 1..8
  lives: number;
  score: number;
  shotsSinceDrop: number;
  anchorShots: number; // disparos que quedan de congelación del techo
};

export type ResolveOut = {
  popped: Int16Array;
  poppedColor: Uint8Array;
  poppedN: number;
  magicHit: MagicId;
  magicCleared: Int16Array;
  magicClearedColor: Uint8Array;
  magicClearedN: number;
  fallen: Int16Array;
  fallenColor: Uint8Array;
  fallenN: number;
  gained: number;
  parityAtPop: 0 | 1; // la paridad vigente cuando se capturaron esas celdas
  ceilingDropped: boolean;
  outcome: number; // OUTCOME_*
};

export function createRun(): RunState {
  return {
    map: 1,
    lives: MAX_LIVES,
    score: 0,
    shotsSinceDrop: 0,
    anchorShots: 0,
  };
}

export function createResolveOut(): ResolveOut {
  return {
    popped: new Int16Array(CELLS),
    poppedColor: new Uint8Array(CELLS),
    poppedN: 0,
    magicHit: 0,
    magicCleared: new Int16Array(CELLS),
    magicClearedColor: new Uint8Array(CELLS),
    magicClearedN: 0,
    fallen: new Int16Array(CELLS),
    fallenColor: new Uint8Array(CELLS),
    fallenN: 0,
    gained: 0,
    parityAtPop: 0,
    ceilingDropped: false,
    outcome: OUTCOME_NONE,
  };
}

// Prepara el board y la bolsa para el mapa `run.map`. Resetea techo y ancla.
export function startMap(b: Board, cfg: MapConfig, run: RunState, bag: Bag, rand: () => number): void {
  parseMap(cfg, b);
  refreshPalette(bag, b);
  bag.current = pickColor(bag, rand);
  bag.next = pickColor(bag, rand);
  run.shotsSinceDrop = 0;
  run.anchorShots = 0;
}

// Scratch reused across calls so capturing the colour a magic bubble's blast
// cells had right before applyMagic clears them never allocates: applyMagic
// finds and empties those cells in one synchronous pass, so the only way to
// read their pre-clear colour is to snapshot the board just before calling it.
const magicSnapshot = new Uint8Array(CELLS);

// El llamante ya ha escrito la burbuja anclada en el board (color + magia).
// `cell` es esa celda. resolveShot ejecuta la secuencia completa y no aloca.
export function resolveShot(
  b: Board,
  cfg: MapConfig,
  run: RunState,
  bag: Bag,
  cell: number,
  rand: () => number,
  out: ResolveOut,
): void {
  out.poppedN = 0;
  out.magicHit = 0;
  out.magicClearedN = 0;
  out.fallenN = 0;
  out.gained = 0;
  out.ceilingDropped = false;
  out.outcome = OUTCOME_NONE;
  // The board's parity only ever changes in step 7 (dropCeiling), below —
  // capturing it now is the same value it had while every cell in this
  // resolution was captured.
  out.parityAtPop = b.parity;

  // 1. Group of the same colour touching the just-anchored cell.
  const groupN = findGroup(b, cell, out.popped);

  // A group under 3 skips popping, magic detonation, and the floating pass
  // entirely (out.poppedN stays 0) — but the shot still counts for the
  // ceiling and can itself cross the death line, below.
  if (groupN >= 3) {
    out.poppedN = groupN;

    let magicCell = -1;
    let magicColor = 0;

    // 2. Pop it, capturing colour (and the magic bubble's own colour, for
    // the Purge) before any cell is emptied.
    for (let i = 0; i < out.poppedN; i++) {
      const j = out.popped[i];
      const color = b.color[j];
      out.poppedColor[i] = color;
      if (b.magic[j] !== 0) {
        out.magicHit = b.magic[j] as MagicId;
        magicCell = j;
        magicColor = color;
      }
    }
    for (let i = 0; i < out.poppedN; i++) {
      const j = out.popped[i];
      b.color[j] = 0;
      b.magic[j] = 0;
    }
    out.gained += popScore(out.poppedN);

    // 3. Detonate the magic bubble caught in the pop, after the pop and
    // before the floating pass, so its holes can generate cascades.
    if (out.magicHit !== 0) {
      out.gained += SCORE_MAGIC;
      if (out.magicHit === MAGIC_ANCHOR) {
        run.anchorShots = ANCHOR_SHOTS;
      } else {
        magicSnapshot.set(b.color);
        out.magicClearedN = applyMagic(b, out.magicHit, magicCell, magicColor, out.magicCleared);
        for (let i = 0; i < out.magicClearedN; i++) {
          out.magicClearedColor[i] = magicSnapshot[out.magicCleared[i]];
        }
      }
    }

    // 4. Anything left disconnected from the ceiling falls.
    out.fallenN = findFloating(b, out.fallen);
    for (let i = 0; i < out.fallenN; i++) {
      const j = out.fallen[i];
      out.fallenColor[i] = b.color[j];
      b.color[j] = 0;
      b.magic[j] = 0;
    }
    out.gained += cascadeScore(out.fallenN);
  }

  // 5. Bag upkeep — always, even on a shot with no pop.
  refreshPalette(bag, b);
  remapOrphan(bag);

  // 6. Map clear / victory. Return here: no ceiling drop on an empty board.
  if (isEmptyBoard(b)) {
    run.score += out.gained + SCORE_MAP;
    if (cfg.map >= LAST_MAP) {
      run.score += SCORE_VICTORY;
      out.outcome = OUTCOME_VICTORY;
    } else {
      out.outcome = OUTCOME_MAP_CLEAR;
    }
    return;
  }

  // 7. Ceiling timer. The shot that activates the anchor does not spend a
  // freeze itself — "the next 4 shots" means the following ones, not this one.
  let ceilingDeath = false;
  if (out.magicHit !== MAGIC_ANCHOR) {
    if (run.anchorShots > 0) {
      run.anchorShots--;
    } else {
      run.shotsSinceDrop++;
      if (run.shotsSinceDrop >= cfg.dropEvery) {
        ceilingDeath = dropCeiling(b, bag.palette, bag.count, rand);
        run.shotsSinceDrop = 0;
        out.ceilingDropped = true;
      }
    }
  }

  // 8. Life lost when the mass reaches the death row (or the drop itself put it there).
  if (anyAtOrBelow(b, DEATH_ROW) || ceilingDeath) {
    run.lives--;
    run.anchorShots = 0;
    out.outcome = OUTCOME_LIFE_LOST;
  }

  // 9. Bank the points from this shot.
  run.score += out.gained;
}
