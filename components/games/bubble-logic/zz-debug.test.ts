import { describe, expect, it } from 'vitest';
import { CELLS, colOf, countBubbles, createBoard, rowOf } from './grid';
import { findFloating } from './match';
import {
  MAGIC_ANCHOR,
  MAGIC_BOMB,
  MAGIC_PURGE,
  MAGIC_RAY,
  MAPS,
  parseMap,
  type MapConfig,
} from './maps';
import { checkMap, checkMapsProgression } from './map-invariants';

const board = createBoard();
function parsed(cfg: MapConfig) {
  parseMap(cfg, board);
  return board;
}

// ---- candidates go here ----
const CANDIDATES: MapConfig[] = [];

describe('debug candidates', () => {
  it('reports per-map problems', () => {
    for (const cfg of CANDIDATES) {
      const b = parsed(cfg);
      const actualCount = countBubbles(b);
      const problems = checkMap(cfg, b);
      const floatArr = new Int16Array(CELLS);
      const floatN = findFloating(b, floatArr);
      const floatCells = Array.from(floatArr.slice(0, floatN)).map(
        (i) => `(${rowOf(i)},${colOf(i)})`,
      );
      // eslint-disable-next-line no-console
      console.log(
        `map ${cfg.map}: declared=${cfg.bubbles} actual=${actualCount} problems=${JSON.stringify(problems)} floating=${JSON.stringify(floatCells)}`,
      );
    }
    const all = [MAPS[0], ...CANDIDATES];
    // eslint-disable-next-line no-console
    console.log('progression:', JSON.stringify(checkMapsProgression(all)));
    expect(true).toBe(true);
  });
});
