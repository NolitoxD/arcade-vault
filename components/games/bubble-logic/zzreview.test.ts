import { describe, it, expect } from 'vitest';
import { appendFileSync } from 'node:fs';
const LOG = '/tmp/bubble-review.log';
const LOGLINE = (s: string) => appendFileSync(LOG, s + String.fromCharCode(10));
import { createBoard, idx, rowOf, colOf, COLS, CELLS, countBubbles, cellX, cellY } from './grid';
import { MAPS, parseMap, MAGIC_ANCHOR, MAGIC_PURGE, MAGIC_RAY, MAGIC_BOMB } from './maps';
import { createRun, createResolveOut, resolveShot, startMap, OUTCOME_LIFE_LOST, OUTCOME_MAP_CLEAR, OUTCOME_VICTORY } from './run';
import { createBag } from './bag';

const rnd = () => 0.5;

describe('REVIEW2', () => {
  it('anchor magic: freeze + reset on life lost + reset on startMap', () => {
    const b = createBoard();
    const cfg = { map: 1, rows: ['RRR.......'], colors: [1], bubbles: 3, dropEvery: 1, magic: MAGIC_ANCHOR as const };
    // board: row0 cols 0..2 red, one is magic; plus a big blob so board never empties
    b.color[idx(0,0)] = 1; b.color[idx(0,1)] = 1; b.magic[idx(0,1)] = MAGIC_ANCHOR;
    for (let c = 4; c < 10; c++) { b.color[idx(0,c)] = 2; }
    const run = createRun(); const bag = createBag(); const out = createResolveOut();
    b.color[idx(0,2)] = 1; // the "just anchored" cell
    resolveShot(b, cfg as never, run, bag, idx(0,2), rnd, out);
    LOGLINE(`anchor: popped=${out.poppedN} magicHit=${out.magicHit} anchorShots=${run.anchorShots} shotsSinceDrop=${run.shotsSinceDrop} score=${run.score} outcome=${out.outcome}`);
    // next shots should burn anchor charges, not the ceiling counter
    for (let k = 0; k < 5; k++) {
      b.color[idx(1,0)] = 3;
      resolveShot(b, cfg as never, run, bag, idx(1,0), rnd, out);
      LOGLINE(`  shot ${k}: anchorShots=${run.anchorShots} shotsSinceDrop=${run.shotsSinceDrop} dropped=${out.ceilingDropped} outcome=${out.outcome} lives=${run.lives}`);
    }
    startMap(b, MAPS[0], run, bag, rnd);
    LOGLINE(`  after startMap: anchorShots=${run.anchorShots} shotsSinceDrop=${run.shotsSinceDrop} parity=${b.parity} score=${run.score} current=${bag.current} next=${bag.next}`);
  });

  it('scoring: map clear does not double count / victory', () => {
    const b = createBoard();
    const cfg8 = { ...MAPS[7] };
    const run = createRun(); run.map = 8; const bag = createBag(); const out = createResolveOut();
    b.color[idx(0,0)] = 1; b.color[idx(0,1)] = 1; b.color[idx(0,2)] = 1;
    resolveShot(b, cfg8 as never, run, bag, idx(0,2), rnd, out);
    LOGLINE(`victory: gained=${out.gained} score=${run.score} outcome=${out.outcome} (expect 30 pop +1000 map +5000 victory = 6030)`);
  });

  it('purge orphans bag.current? (current is NOT remapped)', () => {
    const b = createBoard();
    const cfg = { map: 5, rows: [], colors: [1,2], bubbles: 0, dropEvery: 99, magic: MAGIC_PURGE as const };
    // group of 3 colour 2 with the magic; plus colour-2 bubbles elsewhere; plus colour 1 anchor blob
    for (let c = 0; c < 10; c++) b.color[idx(0,c)] = 1;
    b.color[idx(1,0)] = 2; b.color[idx(1,1)] = 2; b.color[idx(1,2)] = 2; b.magic[idx(1,1)] = MAGIC_PURGE;
    b.color[idx(1,5)] = 2; b.color[idx(1,6)] = 2;
    const run = createRun(); const bag = createBag(); const out = createResolveOut();
    bag.palette.set([1,2]); bag.count = 2; bag.current = 2; bag.next = 2;
    resolveShot(b, cfg as never, run, bag, idx(1,2), rnd, out);
    LOGLINE(`purge: cleared=${out.magicClearedN} palette=[${Array.from(bag.palette.slice(0,bag.count))}] current=${bag.current} next=${bag.next}`);
  });

  it('anchorCell can return -1? probe a full board', () => {
    // handled in shot review below
    expect(true).toBe(true);
  });

  it('life lost leaves shotsSinceDrop dirty if caller does not restart', () => {
    const b = createBoard();
    const cfg = { map: 1, rows: [], colors: [1], bubbles: 0, dropEvery: 2, magic: MAGIC_BOMB as const };
    for (let c = 0; c < 10; c++) b.color[idx(0,c)] = 1;
    b.color[idx(14,0)] = 2; // already at death row
    const run = createRun(); const bag = createBag(); const out = createResolveOut();
    b.color[idx(1,0)] = 3;
    resolveShot(b, cfg as never, run, bag, idx(1,0), rnd, out);
    LOGLINE(`lifeLost: outcome=${out.outcome} lives=${run.lives} shotsSinceDrop=${run.shotsSinceDrop} anchorShots=${run.anchorShots}`);
  });
});
