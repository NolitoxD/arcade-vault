import { describe, it } from 'vitest';
import { appendFileSync } from 'node:fs';
const LOG = '/tmp/bubble-review.log';
const LOGLINE = (s: string) => appendFileSync(LOG, s + String.fromCharCode(10));
import { createBoard, idx, rowOf, colOf, COLS, ROWS, dropCeiling, countBubbles } from './grid';
import { MAPS, parseMap } from './maps';
import { createRun, createResolveOut, resolveShot } from './run';
import { createBag, refreshPalette } from './bag';
import { createShot, fire, stepShot, FLYING, ANGLE_MIN, ANGLE_MAX } from './shot';

const probe = createShot();
function land(b: ReturnType<typeof createBoard>, angle: number): number {
  fire(probe, angle, 1, 0);
  let a = FLYING;
  for (let i = 0; i < 3000 && a === FLYING; i++) a = stepShot(b, probe, 16.667);
  return a;
}

describe('SAT', () => {
  it('dense map + ceiling drops: does anchorCell ever return -1?', () => {
    for (const cfg of [MAPS[6], MAPS[7]]) {
      const b = createBoard(); parseMap(cfg, b);
      const bag = createBag(); refreshPalette(bag, b);
      for (let d = 0; d <= 4; d++) {
        let neg = 0, total = 0;
        for (let a = ANGLE_MIN; a <= ANGLE_MAX; a += (0.25 * Math.PI) / 180) {
          const c = land(b, a); total++; if (c < 0) neg++;
        }
        LOGLINE(`map ${cfg.map} after ${d} drops (count=${countBubbles(b)} parity=${b.parity}): ${neg}/${total} shots -> anchorCell === -1`);
        dropCeiling(b, bag.palette, bag.count, () => 0.37);
      }
    }
  });

  it('what resolveShot does with cell = -1', () => {
    const b = createBoard(); parseMap(MAPS[0], b);
    const run = createRun(); const bag = createBag(); refreshPalette(bag, b);
    const out = createResolveOut();
    const before = countBubbles(b);
    b.color[-1 as number] = 3; // exactly what BubbleGame.resolveAnchor does
    resolveShot(b, MAPS[0], run, bag, -1, () => 0.5, out);
    LOGLINE(`cell=-1: no throw. popped=${out.poppedN} popped[0]=${out.popped[0]} count ${before}->${countBubbles(b)} outcome=${out.outcome} score=${run.score}`);
  });
});
