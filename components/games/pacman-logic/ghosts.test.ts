import { describe, expect, it } from 'vitest';
import { chaseTarget, modeSchedule, nextDir, scatterTarget } from './ghosts';
import type { ParsedMaze } from './maze';

const COLS = 28;

const UP = 0;
const LEFT = 1;
const DOWN = 2;
const RIGHT = 3;

// nextDir only reads m.cols and m.adjacency; the rest of ParsedMaze is
// irrelevant to the pure targeting/decision math under test here.
function fixtureMaze(adjacency: Record<number, number>, cols = COLS): ParsedMaze {
  const rows = 9;
  const arr = new Uint8Array(cols * rows);
  for (const [cell, mask] of Object.entries(adjacency)) arr[Number(cell)] = mask;
  return {
    cols,
    rows,
    walls: new Uint8Array(cols * rows),
    pellets: new Set(),
    powerPellets: new Set(),
    tunnels: [],
    ghostHouse: { door: -1, cells: [] },
    pacmanSpawn: 0,
    fruitCell: -1,
    adjacency: arr,
  };
}

describe('chaseTarget', () => {
  it('blinky targets the current Pac-Man cell', () => {
    const pacmanCell = 10 * COLS + 14; // (14,10)
    expect(
      chaseTarget('blinky', {
        pacmanCell,
        pacmanDir: RIGHT,
        blinkyCell: 0,
        ghostCell: 0,
        cols: COLS,
      }),
    ).toBe(pacmanCell);
  });

  it('pinky targets 4 cells ahead of Pac-Man facing right', () => {
    const pacmanCell = 10 * COLS + 14; // (14,10)
    expect(
      chaseTarget('pinky', {
        pacmanCell,
        pacmanDir: RIGHT,
        blinkyCell: 0,
        ghostCell: 0,
        cols: COLS,
      }),
    ).toBe(10 * COLS + 18); // (18,10)
  });

  it('pinky targets 4 cells ahead of Pac-Man facing up', () => {
    const pacmanCell = 10 * COLS + 14; // (14,10)
    expect(
      chaseTarget('pinky', {
        pacmanCell,
        pacmanDir: UP,
        blinkyCell: 0,
        ghostCell: 0,
        cols: COLS,
      }),
    ).toBe(6 * COLS + 14); // (14,6)
  });

  it('inky reflects blinky through 2 cells ahead of Pac-Man (horizontal)', () => {
    const pacmanCell = 10 * COLS + 14; // (14,10)
    const blinkyCell = 10 * COLS + 2; // (2,10)
    // p2 = (16,10); vector p2-blinky = (14,0); target = blinky + 2*vector = (30,10)
    expect(
      chaseTarget('inky', {
        pacmanCell,
        pacmanDir: RIGHT,
        blinkyCell,
        ghostCell: 0,
        cols: COLS,
      }),
    ).toBe(10 * COLS + 30);
  });

  it('inky reflects blinky through 2 cells ahead of Pac-Man (vertical)', () => {
    const pacmanCell = 10 * COLS + 14; // (14,10)
    const blinkyCell = 4 * COLS + 14; // (14,4)
    // p2 = (14,12); vector p2-blinky = (0,8); target = blinky + 2*vector = (14,20)
    expect(
      chaseTarget('inky', {
        pacmanCell,
        pacmanDir: DOWN,
        blinkyCell,
        ghostCell: 0,
        cols: COLS,
      }),
    ).toBe(20 * COLS + 14);
  });

  it('clyde targets Pac-Man when farther than 8 cells away', () => {
    const pacmanCell = 15 * COLS + 14; // (14,15)
    const ghostCell = 0; // (0,0), distance = sqrt(14^2+15^2) > 8
    expect(
      chaseTarget('clyde', {
        pacmanCell,
        pacmanDir: RIGHT,
        blinkyCell: 0,
        ghostCell,
        cols: COLS,
      }),
    ).toBe(pacmanCell);
  });

  it('clyde targets his scatter corner at exactly 8 cells away', () => {
    const ghostCell = 5 * COLS + 2; // (2,5)
    const pacmanCell = 5 * COLS + 10; // (10,5), distance = 8 exactly
    expect(
      chaseTarget('clyde', {
        pacmanCell,
        pacmanDir: RIGHT,
        blinkyCell: 0,
        ghostCell,
        cols: COLS,
      }),
    ).toBe(30 * COLS); // bottom-left corner, GRID_ROWS=31
  });

  it('clyde targets his scatter corner when closer than 8 cells', () => {
    const ghostCell = 5 * COLS + 10;
    const pacmanCell = 5 * COLS + 12; // distance = 2
    expect(
      chaseTarget('clyde', {
        pacmanCell,
        pacmanDir: RIGHT,
        blinkyCell: 0,
        ghostCell,
        cols: COLS,
      }),
    ).toBe(30 * COLS);
  });
});

describe('scatterTarget', () => {
  const maze = fixtureMaze({});

  it('places blinky top-right', () => {
    expect(scatterTarget('blinky', maze)).toBe(COLS - 1);
  });

  it('places pinky top-left', () => {
    expect(scatterTarget('pinky', maze)).toBe(0);
  });

  it('places inky bottom-right', () => {
    expect(scatterTarget('inky', maze)).toBe((maze.rows - 1) * COLS + (COLS - 1));
  });

  it('places clyde bottom-left', () => {
    expect(scatterTarget('clyde', maze)).toBe((maze.rows - 1) * COLS);
  });
});

describe('nextDir', () => {
  it('never reverses at a T-junction, breaking ties up over down', () => {
    const ghostCell = 5 * COLS + 10; // (10,5)
    // Exits: UP, LEFT (reverse of currentDir RIGHT), DOWN — no plain RIGHT.
    const maze = fixtureMaze({ [ghostCell]: 0b0111 });
    const targetCell = 5 * COLS; // (0,5): equidistant from the up- and down-neighbors
    const dir = nextDir(ghostCell, RIGHT, targetCell, maze, false, () => 0);
    expect(dir).toBe(UP);
  });

  it('reverses in a dead end when the reverse is the only exit', () => {
    const ghostCell = 5 * COLS + 10;
    const maze = fixtureMaze({ [ghostCell]: 0b0010 }); // only LEFT open
    const dir = nextDir(ghostCell, RIGHT, 0, maze, false, () => 0);
    expect(dir).toBe(LEFT);
  });

  it('breaks ties by up > left > down > right for equidistant options', () => {
    const ghostCell = 5 * COLS + 10;
    // Exits: LEFT and RIGHT only, target straight above — both equidistant.
    const maze = fixtureMaze({ [ghostCell]: 0b1010 });
    const targetCell = 0 * COLS + 10;
    const dir = nextDir(ghostCell, UP, targetCell, maze, false, () => 0);
    expect(dir).toBe(LEFT);
  });

  it('picks a pseudo-random legal direction when frightened', () => {
    const ghostCell = 5 * COLS + 10;
    // Exits: UP, LEFT, DOWN. currentDir is LEFT, whose reverse (RIGHT) is
    // not an exit, so all three stay candidates in priority order.
    const maze = fixtureMaze({ [ghostCell]: 0b0111 });
    expect(nextDir(ghostCell, LEFT, 0, maze, true, () => 0)).toBe(UP);
    expect(nextDir(ghostCell, LEFT, 0, maze, true, () => 0.4)).toBe(LEFT);
    expect(nextDir(ghostCell, LEFT, 0, maze, true, () => 0.99)).toBe(DOWN);
  });
});

describe('modeSchedule', () => {
  it('starts with scatter 7000ms for level 1 (DIFFICULTY row 1)', () => {
    const schedule = modeSchedule(1);
    expect(schedule[0]).toEqual({ phase: 'scatter', durationMs: 7000 });
    expect(schedule[1]).toEqual({ phase: 'chase', durationMs: 20000 });
  });

  it('cycles scatter/chase 4 times then ends in permanent chase', () => {
    const schedule = modeSchedule(1);
    expect(schedule).toHaveLength(8);
    expect(schedule.filter((p) => p.phase === 'scatter')).toHaveLength(4);
    const last = schedule[schedule.length - 1];
    expect(last.phase).toBe('chase');
    expect(last.durationMs).toBe(Infinity);
  });

  it('uses scatterS=6000 for level 3 per DIFFICULTY table', () => {
    expect(modeSchedule(3)[0]).toEqual({ phase: 'scatter', durationMs: 6000 });
  });

  it('clamps levels above 12 to the level-12 scatterS', () => {
    expect(modeSchedule(15)[0]).toEqual({ phase: 'scatter', durationMs: 3000 });
  });
});
