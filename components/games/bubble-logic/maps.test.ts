import { describe, expect, it } from 'vitest';
import { CELLS, DEATH_ROW, countBubbles, createBoard, idx } from './grid';
import {
  LAST_MAP,
  MAGIC_ANCHOR,
  MAGIC_BOMB,
  MAGIC_PURGE,
  MAGIC_RAY,
  MAPS,
  configFor,
  parseMap,
  type MapConfig,
} from './maps';
import { checkMap, checkMapsProgression } from './map-invariants';

const board = createBoard();
function parsed(cfg: MapConfig) { parseMap(cfg, board); return board; }

describe('parseMap', () => {
  it('writes colours and the magic layer from the layout strings', () => {
    const cfg: MapConfig = {
      map: 1, rows: ['RRB.......', 'BBrR......'], colors: [1, 2],
      bubbles: 7, dropEvery: 12, magic: MAGIC_BOMB,
    };
    const b = parsed(cfg);
    expect(b.color[idx(0, 0)]).toBe(1);
    expect(b.color[idx(0, 2)]).toBe(2);
    expect(b.color[idx(0, 3)]).toBe(0);
    expect(b.color[idx(1, 2)]).toBe(1);      // 'r' minúscula: mismo color
    expect(b.magic[idx(1, 2)]).toBe(MAGIC_BOMB);
    expect(countBubbles(b)).toBe(7);
    expect(b.parity).toBe(0);
  });

  it('clears whatever the board held before', () => {
    board.color[idx(9, 9)] = 6;
    board.parity = 1;
    parseMap(configFor(1), board);
    expect(board.color[idx(9, 9)]).toBe(0);
    expect(board.parity).toBe(0);
  });
});

describe('configFor', () => {
  it('clamps out-of-range map numbers', () => {
    expect(configFor(0)).toBe(MAPS[0]);
    expect(configFor(1)).toBe(MAPS[0]);
    expect(configFor(99)).toBe(MAPS[MAPS.length - 1]);
  });
});

describe('map invariants', () => {
  it('ships the eight maps with the agreed magic pairing', () => {
    expect(MAPS).toHaveLength(LAST_MAP);
    expect(MAPS.map((m) => m.map)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(MAPS.map((m) => m.magic)).toEqual([
      MAGIC_BOMB, MAGIC_BOMB, MAGIC_RAY, MAGIC_RAY,
      MAGIC_PURGE, MAGIC_PURGE, MAGIC_ANCHOR, MAGIC_ANCHOR,
    ]);
    expect(MAPS.map((m) => m.colors.length)).toEqual([3, 3, 4, 4, 5, 5, 6, 6]);
    expect(MAPS.map((m) => m.dropEvery)).toEqual([12, 10, 9, 8, 7, 6, 6, 5]);
  });

  it('reports no problems for every published map', () => {
    MAPS.forEach((cfg) => {
      expect({ map: cfg.map, problems: checkMap(cfg, parsed(cfg)) })
        .toEqual({ map: cfg.map, problems: [] });
    });
  });

  it('reports no problems in the difficulty progression', () => {
    expect(checkMapsProgression(MAPS)).toEqual([]);
  });

  it('catches a layout whose mass does not hang from row 0', () => {
    const bad: MapConfig = {
      map: 1, rows: ['..........', 'RRR.......'], colors: [1],
      bubbles: 3, dropEvery: 12, magic: MAGIC_BOMB,
    };
    const problems = checkMap(bad, parsed(bad));
    expect(problems).toContain('row 0 empty');
    expect(problems).toContain('floating at start');
  });

  it('catches a map with no magic bubble and one with two', () => {
    const none: MapConfig = { map: 1, rows: ['RRR.......'], colors: [1], bubbles: 3, dropEvery: 12, magic: MAGIC_BOMB };
    const two: MapConfig = { map: 1, rows: ['rrR.......'], colors: [1], bubbles: 3, dropEvery: 12, magic: MAGIC_BOMB };
    expect(checkMap(none, parsed(none))).toContain('magic count 0');
    expect(checkMap(two, parsed(two))).toContain('magic count 2');
  });

  it('catches a colour the declared palette does not include', () => {
    const bad: MapConfig = { map: 1, rows: ['RRBr......'], colors: [1], bubbles: 4, dropEvery: 12, magic: MAGIC_BOMB };
    expect(checkMap(bad, parsed(bad))).toContain('colour 2 outside palette');
  });

  it('catches a map that starts on top of the death line', () => {
    const rows = Array.from({ length: DEATH_ROW - 3 }, (_, r) => (r === 0 ? 'RRr.......' : 'RRR.......'));
    const bad: MapConfig = { map: 1, rows, colors: [1], bubbles: rows.length * 3, dropEvery: 12, magic: MAGIC_BOMB };
    expect(checkMap(bad, parsed(bad))).toContain('starts too low');
  });

  it('catches a declared bubble count that does not match the layout', () => {
    const bad: MapConfig = { map: 1, rows: ['RRr.......'], colors: [1], bubbles: 99, dropEvery: 12, magic: MAGIC_BOMB };
    expect(checkMap(bad, parsed(bad))).toContain('bubble count mismatch');
  });

  it('catches a magic bubble no shot can ever complete', () => {
    // mágica azul solitaria colgando de una fila de rojas: su grupo de color tiene 1 celda,
    // así que ningún disparo puede llevarla nunca a un grupo de 3
    const bad: MapConfig = { map: 1, rows: ['RRRRRRRRRR', '.........b'], colors: [1, 2], bubbles: 11, dropEvery: 12, magic: MAGIC_BOMB };
    expect(checkMap(bad, parsed(bad))).toContain('magic bubble unpoppable');
  });

  it('catches a non-monotonic difficulty table', () => {
    const worse = MAPS.map((m, i) => (i === 0 ? { ...m, dropEvery: 1 } : m));
    expect(checkMapsProgression(worse).length).toBeGreaterThan(0);
  });

  it('catches a row that is not exactly COLS characters wide', () => {
    const bad: MapConfig = { map: 1, rows: ['RRB.....'], colors: [1, 2], bubbles: 3, dropEvery: 12, magic: MAGIC_BOMB };
    expect(checkMap(bad, parsed(bad))).toContain('row width');
  });

  it('catches a character that is neither a dot nor a known colour', () => {
    const bad: MapConfig = { map: 1, rows: ['RRBZ......'], colors: [1, 2], bubbles: 3, dropEvery: 12, magic: MAGIC_BOMB };
    expect(checkMap(bad, parsed(bad))).toContain('unknown char Z');
  });

  it('catches a declared palette colour that never appears on the board', () => {
    const bad: MapConfig = { map: 1, rows: ['RRRRRRRRRR'], colors: [1, 2, 3], bubbles: 10, dropEvery: 12, magic: MAGIC_BOMB };
    const problems = checkMap(bad, parsed(bad));
    expect(problems).toContain('palette colour 2 unused');
    expect(problems).toContain('palette colour 3 unused');
  });

  it('catches a board whose magic layer disagrees with the declared magic id', () => {
    // parseMap always writes cfg.magic, so a mismatch can only come from the
    // board itself drifting from its config — simulate that directly.
    const cfg: MapConfig = { map: 1, rows: ['Rr........'], colors: [1], bubbles: 2, dropEvery: 12, magic: MAGIC_BOMB };
    const b = parsed(cfg);
    b.magic[idx(0, 1)] = MAGIC_RAY;
    expect(checkMap(cfg, b)).toContain('magic id mismatch');
  });

  it('catches a magic pocket that is walled off from every shot angle', () => {
    // A magic pair sits alone in row 0 with free cells either side (so it IS
    // poppable in principle), but rows 10-13 form a solid, gapless floor
    // spanning every column beneath it — no simulated shot can ever get past
    // that floor to land next to the pocket, even though shots DO land lower
    // down (this is not the same failure as "no landing spot").
    const rows = [
      '.....bB...',
      ...Array.from({ length: 9 }, () => '..........'),
      'RRRRRRRRRR',
      'RRRRRRRRRR',
      'RRRRRRRRRR',
      'RRRRRRRRRR',
    ];
    const bad: MapConfig = { map: 1, rows, colors: [1, 2], bubbles: 42, dropEvery: 12, magic: MAGIC_BOMB };
    const problems = checkMap(bad, parsed(bad));
    expect(problems).toContain('magic bubble unreachable');
    expect(problems).not.toContain('no landing spot');
  });

  it('catches a board with no free cell for any shot to land on', () => {
    const rows = Array.from({ length: 15 }, () => 'RRRRRRRRRR');
    const bad: MapConfig = { map: 1, rows, colors: [1], bubbles: CELLS, dropEvery: 12, magic: MAGIC_BOMB };
    expect(checkMap(bad, parsed(bad))).toContain('no landing spot');
  });

  it('catches a map number that does not match its position', () => {
    const bad: MapConfig = { ...MAPS[0], map: 2 };
    expect(checkMapsProgression([bad])).toContain('map number mismatch');
  });

  it('catches a magic id that does not follow the design pairing table', () => {
    const bad: MapConfig = { ...MAPS[0], magic: MAGIC_RAY };
    expect(checkMapsProgression([bad])).toContain('magic pairing wrong at map 1');
  });

  it('catches a palette that shrinks between consecutive maps', () => {
    const map1: MapConfig = { ...MAPS[0], colors: [1, 2, 3] };
    const map2: MapConfig = { ...MAPS[0], map: 2, colors: [1, 2] };
    expect(checkMapsProgression([map1, map2])).toContain('colours shrink at map 2');
  });

  it('catches dropEvery increasing between consecutive maps', () => {
    const map1: MapConfig = { ...MAPS[0], dropEvery: 10 };
    const map2: MapConfig = { ...MAPS[0], map: 2, dropEvery: 15, magic: MAGIC_RAY };
    expect(checkMapsProgression([map1, map2])).toContain('dropEvery grows at map 2');
  });
});
