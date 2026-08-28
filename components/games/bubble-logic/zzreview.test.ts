import { describe, it, expect } from 'vitest';
import { appendFileSync } from 'node:fs';
const LOG = '/tmp/bubble-review.log';
const LOGLINE = (s: string) => appendFileSync(LOG, s + String.fromCharCode(10));
import { createBoard, dropCeiling, cellX, cellY, neighbors, pixelToCell, idx, rowOf, colOf, COLS, ROWS, CELLS, PLAY_W, R, D, anyAtOrBelow, countBubbles } from './grid';
import { MAPS, parseMap, configFor, LAST_MAP } from './maps';
import { checkMap } from './map-invariants';
import { simulateShot, ANGLE_MIN, ANGLE_MAX, createShot, fire, stepShot, FLYING } from './shot';
import { createRun } from './run';

describe('REVIEW', () => {
  it('geometry: flush/shifted x extents vs bounce walls', () => {
    const info: string[] = [];
    for (const p of [0, 1] as const) {
      const b = createBoard(); b.parity = p;
      let min = 1e9, max = -1e9;
      for (let r = 0; r < ROWS; r++) { min = Math.min(min, cellX(r,0,p)); max = Math.max(max, cellX(r,COLS-1,p)); }
      info.push(`parity${p} minX=${min} maxX=${max}`);
    }
    LOGLINE(info.join(' | ') + ' walls=[' + R + ',' + (PLAY_W-R) + ']');
    expect(true).toBe(true);
  });

  it('every map: which cells are reachable by a direct shot on the pristine board', () => {
    for (const cfg of MAPS) {
      const b = createBoard(); parseMap(cfg, b);
      const landed = new Set<number>();
      for (let a = ANGLE_MIN; a <= ANGLE_MAX + 1e-9; a += (0.25*Math.PI)/180) {
        const c = simulateShot(b, a);
        if (c >= 0) landed.add(c);
      }
      // holes = empty cells adjacent to an occupied one
      const nb = new Int16Array(6);
      const holes: number[] = [];
      for (let i = 0; i < CELLS; i++) {
        if (b.color[i] !== 0) continue;
        const n = neighbors(rowOf(i), colOf(i), b.parity, nb);
        let adj = false;
        for (let k = 0; k < n; k++) if (b.color[nb[k]] !== 0) adj = true;
        if (adj) holes.push(i);
      }
      const unreachable = holes.filter((h) => !landed.has(h));
      LOGLINE(`map ${cfg.map}: landed=${landed.size} holes=${holes.length} unreachableHoles=${unreachable.length} ${unreachable.map(h=>`(${rowOf(h)},${colOf(h)})`).join(' ')}`);
    }
    expect(true).toBe(true);
  });

  it('dropCeiling: count + parity + geometry consistency', () => {
    const cfg = MAPS[0];
    const b = createBoard(); parseMap(cfg, b);
    const pal = new Uint8Array([1,2,3]);
    let before = countBubbles(b);
    for (let k = 0; k < 6; k++) {
      const p0 = b.parity;
      const death = dropCeiling(b, pal, 3, () => 0.5);
      LOGLINE(`drop ${k}: parity ${p0}->${b.parity} count ${before}->${countBubbles(b)} death=${death}`);
      before = countBubbles(b);
    }
    expect(true).toBe(true);
  });

  it('checkMap on all 8 maps', () => {
    for (const cfg of MAPS) {
      const b = createBoard(); parseMap(cfg, b);
      const p = checkMap(cfg, b);
      LOGLINE(`map ${cfg.map}: ${p.length === 0 ? 'OK' : p.join(', ')}`);
    }
    expect(true).toBe(true);
  });
});
