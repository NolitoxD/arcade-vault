import { describe, expect, it } from 'vitest';
import { parseMaze, validateMaze } from './maze';

const DOWN = 4;
const RIGHT = 8;

// 8x9 fixture maze (legend: # wall, . pellet, o power, T tunnel, - house
// door, H house cell, P pacman spawn, F fruit cell, space empty).
const validRows = [
  '########',
  '#o....o#',
  '#.####.#',
  '#.#HH#.#',
  '#.#H-#.#',
  'T.####.T',
  '#o....o#',
  '#P....F#',
  '########',
];

const threePowerPelletsRows = [
  '########',
  '#o....o#',
  '#.####.#',
  '#.#HH#.#',
  '#.#H-#.#',
  'T.####.T',
  '#o.....#',
  '#P....F#',
  '########',
];

const walledOffPelletRows = [
  '########',
  '#P....o#',
  '#.######',
  '#.####.#',
  '#.######',
  '#.....o#',
  '#.####.#',
  '#....F.#',
  '########',
];

describe('parseMaze', () => {
  it('reads grid dimensions from the input rows', () => {
    const maze = parseMaze(validRows);
    expect(maze.cols).toBe(8);
    expect(maze.rows).toBe(9);
  });

  it('collects pellets and power pellets', () => {
    const maze = parseMaze(validRows);
    expect(maze.pellets.size).toBe(20);
    expect(maze.powerPellets.size).toBe(4);
  });

  it('computes the adjacency bitmask for a corner cell', () => {
    const maze = parseMaze(validRows);
    // cell (1,1) is open only downward and rightward: walled above and left.
    expect(maze.adjacency[9]).toBe(DOWN | RIGHT);
  });

  it('pairs tunnel cells on the same row', () => {
    const maze = parseMaze(validRows);
    expect([...maze.tunnels].sort((a, b) => a - b)).toEqual([40, 47]);
  });
});

describe('validateMaze', () => {
  it('returns no violations for a legal maze', () => {
    const maze = parseMaze(validRows);
    const violations = validateMaze(maze, {
      expectDims: [8, 9],
      pelletRange: [10, 999],
    });
    expect(violations).toEqual([]);
  });

  it('reports a walled-off pellet as unreachable', () => {
    const maze = parseMaze(walledOffPelletRows);
    const violations = validateMaze(maze, {
      expectDims: [8, 9],
      pelletRange: [10, 999],
    });
    expect(violations.some((v) => v.includes('30'))).toBe(true);
  });

  it('reports a wrong power pellet count', () => {
    const maze = parseMaze(threePowerPelletsRows);
    const violations = validateMaze(maze, {
      expectDims: [8, 9],
      pelletRange: [10, 999],
    });
    expect(violations).toEqual(['Expected exactly 4 power pellets, found 3']);
  });
});
