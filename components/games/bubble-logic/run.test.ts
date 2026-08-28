import { describe, expect, it } from 'vitest';
import { COLS, DEATH_ROW, createBoard, idx, isEmptyBoard, type Board } from './grid';
import { MAGIC_ANCHOR, MAGIC_BOMB, MAGIC_PURGE, MAGIC_RAY, type MapConfig } from './maps';
import { createBag, refreshPalette, type Bag } from './bag';
import { SCORE_MAGIC, SCORE_MAP, SCORE_VICTORY } from './scoring';
import {
  OUTCOME_LIFE_LOST, OUTCOME_MAP_CLEAR, OUTCOME_NONE, OUTCOME_VICTORY,
  createResolveOut, createRun, resolveShot,
} from './run';

const rand = () => 0;
const out = createResolveOut();

function scene(rows: string[], magic = MAGIC_BOMB, dropEvery = 99): { b: Board; cfg: MapConfig; bag: Bag } {
  const b = createBoard();
  rows.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      b.color[idx(r, c)] = Number(ch);
    }
  });
  const bag = createBag();
  refreshPalette(bag, b);
  const cfg: MapConfig = { map: 1, rows: [], colors: [1, 2], bubbles: 0, dropEvery, magic };
  return { b, cfg, bag };
}

describe('resolveShot — popping', () => {
  it('pops a group of three and scores it', () => {
    const { b, cfg, bag } = scene(['111.......']);
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 2), rand, out);
    expect(out.poppedN).toBe(3);
    expect(run.score).toBe(30);
    expect(b.color[idx(0, 0)]).toBe(0);
    expect(Array.from(out.poppedColor.subarray(0, 3))).toEqual([1, 1, 1]);
    expect(out.parityAtPop).toBe(0);
  });

  it('leaves a group of two alone', () => {
    const { b, cfg, bag } = scene(['11........']);
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 1), rand, out);
    expect(out.poppedN).toBe(0);
    expect(b.color[idx(0, 0)]).toBe(1);
    expect(run.score).toBe(0);
  });

  it('drops everything the pop disconnected and scores the cascade', () => {
    const { b, cfg, bag } = scene(['111.......', '..2.......', '..2.......']);
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 2), rand, out);
    expect(out.poppedN).toBe(3);
    expect(out.fallenN).toBe(2);
    expect(Array.from(out.fallenColor.subarray(0, 2))).toEqual([2, 2]);
    expect(run.score).toBe(30 + 20 + 40);
    expect(isEmptyBoard(b)).toBe(true);
  });
});

describe('resolveShot — magic ordering', () => {
  it('detonates after the pop and before the floating pass', () => {
    // El pop se lleva los tres 1. El rayo vacía el RESTO de la fila 0, y solo entonces
    // el 3 de la fila 1 se queda sin enganche: si la magia corriera después de las
    // colgadas, fallenN sería 0.
    const { b, cfg, bag } = scene(['1112222222', '.....3....'], MAGIC_RAY);
    b.magic[idx(0, 1)] = MAGIC_RAY;
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 1), rand, out);
    expect(out.poppedN).toBe(3);
    expect(out.magicHit).toBe(MAGIC_RAY);
    expect(out.magicClearedN).toBe(7);        // los 2 que quedaban en la fila 0
    expect(out.fallenN).toBe(1);              // solo puede caer si la magia fue antes
    expect(run.score).toBeGreaterThanOrEqual(SCORE_MAGIC);
  });

  it('does not detonate a magic bubble that merely falls as floating', () => {
    const { b, cfg, bag } = scene(['111.......', '..2.......'], MAGIC_BOMB);
    b.magic[idx(1, 2)] = MAGIC_BOMB;          // la mágica cuelga, no está en el grupo
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 2), rand, out);
    expect(out.magicHit).toBe(0);
    expect(out.magicClearedN).toBe(0);
  });

  it('purges using the colour the magic bubble had before the pop cleared it', () => {
    // El 1 de la fila 1 cuelga de un 2 que sobrevive al pop: sin la purga NO caería,
    // así que si desaparece es porque la purga leyó el color correcto (1, no 0).
    const { b, cfg, bag } = scene(['1112222222', '.....1....'], MAGIC_PURGE);
    b.magic[idx(0, 0)] = MAGIC_PURGE;
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 0), rand, out);
    expect(b.color[idx(1, 5)]).toBe(0);
  });

  it('refreshes the bag after a purge so no dead colour can be drawn', () => {
    const { b, cfg, bag } = scene(['1112222222', '.....1....'], MAGIC_PURGE);
    b.magic[idx(0, 0)] = MAGIC_PURGE;
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 0), rand, out);
    expect(Array.from(bag.palette.subarray(0, bag.count))).not.toContain(1);
    expect(Array.from(bag.palette.subarray(0, bag.count))).toContain(2);
  });
});

describe('resolveShot — ceiling and the anchor magic', () => {
  it('drops the ceiling once the shot counter reaches dropEvery', () => {
    const { b, cfg, bag } = scene(['12........'], MAGIC_BOMB, 2);
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 1), rand, out);
    expect(out.ceilingDropped).toBe(false);
    resolveShot(b, cfg, run, bag, idx(0, 1), rand, out);
    expect(out.ceilingDropped).toBe(true);
    expect(run.shotsSinceDrop).toBe(0);
  });

  it('freezes the ceiling for exactly the four shots AFTER the anchor', () => {
    // Tablero que sobrevive al pop (la fila 1 sigue colgando por la columna 9) y
    // dropEvery = 1, así que sin congelación el techo bajaría en cada disparo.
    const { b, cfg, bag } = scene(['1112222222', '2222222222'], MAGIC_ANCHOR, 1);
    b.magic[idx(0, 0)] = MAGIC_ANCHOR;
    const run = createRun();

    resolveShot(b, cfg, run, bag, idx(0, 0), rand, out);
    expect(out.magicHit).toBe(MAGIC_ANCHOR);
    expect(out.magicClearedN).toBe(0);
    expect(run.anchorShots).toBe(4);          // el disparo que la activa NO gasta congelación
    expect(out.ceilingDropped).toBe(false);

    // idx(9, 9) está vacía: findGroup devuelve 0 y el disparo solo cuenta para el techo
    for (let i = 0; i < 4; i++) {
      resolveShot(b, cfg, run, bag, idx(9, 9), rand, out);
      expect({ shot: i, dropped: out.ceilingDropped }).toEqual({ shot: i, dropped: false });
    }
    expect(run.anchorShots).toBe(0);

    resolveShot(b, cfg, run, bag, idx(9, 9), rand, out);
    expect(out.ceilingDropped).toBe(true);
  });
});

describe('resolveShot — outcomes', () => {
  it('clears the map, pays the bonus and does not drop the ceiling on an empty board', () => {
    const { b, cfg, bag } = scene(['111.......'], MAGIC_BOMB, 1);
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 2), rand, out);
    expect(out.outcome).toBe(OUTCOME_MAP_CLEAR);
    expect(out.ceilingDropped).toBe(false);
    expect(run.score).toBe(30 + SCORE_MAP);
  });

  it('ends in victory when the last map is cleared', () => {
    const { b, cfg, bag } = scene(['111.......']);
    const run = createRun();
    run.map = 8;
    resolveShot(b, { ...cfg, map: 8 }, run, bag, idx(0, 2), rand, out);
    expect(out.outcome).toBe(OUTCOME_VICTORY);
    expect(run.score).toBe(30 + SCORE_MAP + SCORE_VICTORY);
  });

  it('costs a life and clears the anchor when the mass reaches the death row', () => {
    const b = createBoard();
    b.color[idx(DEATH_ROW, 3)] = 1;
    b.color[idx(0, 0)] = 1;
    const bag = createBag();
    refreshPalette(bag, b);
    const cfg: MapConfig = { map: 1, rows: [], colors: [1], bubbles: 0, dropEvery: 99, magic: MAGIC_BOMB };
    const run = createRun();
    run.anchorShots = 3;
    resolveShot(b, cfg, run, bag, idx(0, 0), rand, out);
    expect(out.outcome).toBe(OUTCOME_LIFE_LOST);
    expect(run.lives).toBe(2);
    expect(run.anchorShots).toBe(0);
  });

  it('reports nothing special on an ordinary shot', () => {
    const { b, cfg, bag } = scene(['12........']);
    const run = createRun();
    resolveShot(b, cfg, run, bag, idx(0, 1), rand, out);
    expect(out.outcome).toBe(OUTCOME_NONE);
  });
});
