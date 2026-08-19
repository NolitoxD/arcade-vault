export type ParsedMaze = {
  cols: number;
  rows: number;
  walls: Uint8Array;
  pellets: Set<number>;
  powerPellets: Set<number>;
  tunnels: number[];
  ghostHouse: { door: number; cells: number[] };
  pacmanSpawn: number;
  fruitCell: number;
  adjacency: Uint8Array;
};

type ValidateOptions = {
  expectDims?: [number, number];
  pelletRange?: [number, number];
};

const UP = 1;
const LEFT = 2;
const DOWN = 4;
const RIGHT = 8;

// walls encodes both blocker kinds so validateMaze can tell them apart
// without re-reading the raw rows: 0 open, 1 hard wall (#), 2 house door (-).
const WALL = 1;
const DOOR = 2;

export function parseMaze(rows: string[]): ParsedMaze {
  const rowCount = rows.length;
  const cols = rowCount > 0 ? rows[0].length : 0;
  const walls = new Uint8Array(cols * rowCount);
  const pellets = new Set<number>();
  const powerPellets = new Set<number>();
  const tunnels: number[] = [];
  const houseCells: number[] = [];
  let door = -1;
  let pacmanSpawn = -1;
  let fruitCell = -1;

  for (let y = 0; y < rowCount; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      switch (rows[y][x]) {
        case '#':
          walls[idx] = WALL;
          break;
        case '-':
          walls[idx] = DOOR;
          if (door === -1) door = idx;
          break;
        case '.':
          pellets.add(idx);
          break;
        case 'o':
          powerPellets.add(idx);
          break;
        case 'T':
          tunnels.push(idx);
          break;
        case 'H':
          houseCells.push(idx);
          break;
        case 'P':
          pacmanSpawn = idx;
          break;
        case 'F':
          fruitCell = idx;
          break;
        default:
          break;
      }
    }
  }

  const adjacency = computeAdjacency(cols, rowCount, walls, tunnels);

  return {
    cols,
    rows: rowCount,
    walls,
    pellets,
    powerPellets,
    tunnels,
    ghostHouse: { door, cells: houseCells },
    pacmanSpawn,
    fruitCell,
    adjacency,
  };
}

function computeAdjacency(
  cols: number,
  rowCount: number,
  walls: Uint8Array,
  tunnels: number[],
): Uint8Array {
  const adjacency = new Uint8Array(cols * rowCount);

  for (let y = 0; y < rowCount; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      if (walls[idx] !== 0) continue;

      let exits = 0;
      if (y > 0 && walls[idx - cols] === 0) exits |= UP;
      if (x > 0 && walls[idx - 1] === 0) exits |= LEFT;
      if (y < rowCount - 1 && walls[idx + cols] === 0) exits |= DOWN;
      if (x < cols - 1 && walls[idx + 1] === 0) exits |= RIGHT;
      adjacency[idx] = exits;
    }
  }

  // Grid-edge tunnel pairs also exit off the board (wrap-around); there is
  // no geometric neighbor for that direction, so the bit is added manually.
  const tunnelsByRow = groupByRow(tunnels, cols);
  for (const cells of tunnelsByRow.values()) {
    if (cells.length !== 2) continue;
    const [a, b] = cells.slice().sort((p, q) => p - q);
    if (a % cols === 0 && b % cols === cols - 1) {
      adjacency[a] |= LEFT;
      adjacency[b] |= RIGHT;
    }
  }

  return adjacency;
}

function groupByRow(cells: number[], cols: number): Map<number, number[]> {
  const byRow = new Map<number, number[]>();
  for (const idx of cells) {
    const row = Math.floor(idx / cols);
    const list = byRow.get(row);
    if (list) list.push(idx);
    else byRow.set(row, [idx]);
  }
  return byRow;
}

export function validateMaze(
  m: ParsedMaze,
  options: ValidateOptions = {},
): string[] {
  const [expectCols, expectRows] = options.expectDims ?? [28, 31];
  const [minPellets, maxPellets] = options.pelletRange ?? [230, 250];
  const violations: string[] = [];

  if (m.cols !== expectCols || m.rows !== expectRows) {
    violations.push(
      `Expected maze dimensions ${expectCols}x${expectRows}, got ${m.cols}x${m.rows}`,
    );
  }

  if (m.powerPellets.size !== 4) {
    violations.push(
      `Expected exactly 4 power pellets, found ${m.powerPellets.size}`,
    );
  }

  if (m.pellets.size < minPellets || m.pellets.size > maxPellets) {
    violations.push(
      `Expected ${minPellets}-${maxPellets} pellets, found ${m.pellets.size}`,
    );
  }

  let doorCount = 0;
  for (const value of m.walls) if (value === DOOR) doorCount++;
  if (doorCount !== 1) {
    violations.push(
      `Expected exactly 1 ghost house door cell, found ${doorCount}`,
    );
  }

  const tunnelsByRow = groupByRow(m.tunnels, m.cols);
  for (const [row, cells] of tunnelsByRow) {
    const xs = cells.map((idx) => idx % m.cols).sort((a, b) => a - b);
    const isValidPair = xs.length === 2 && xs[0] === 0 && xs[1] === m.cols - 1;
    if (!isValidPair) {
      violations.push(
        `Tunnel cells in row ${row} are not a valid left/right pair`,
      );
    }
  }

  if (m.pacmanSpawn === -1) {
    violations.push('No Pac-Man spawn cell found');
  } else {
    const visited = floodFillFromSpawn(m);
    for (const idx of m.pellets) {
      if (!visited.has(idx)) {
        violations.push(
          `Pellet at cell ${idx} is unreachable from Pac-Man spawn`,
        );
      }
    }
    for (const idx of m.powerPellets) {
      if (!visited.has(idx)) {
        violations.push(
          `Power pellet at cell ${idx} is unreachable from Pac-Man spawn`,
        );
      }
    }
  }

  return violations;
}

function floodFillFromSpawn(m: ParsedMaze): Set<number> {
  const visited = new Set<number>([m.pacmanSpawn]);
  const queue: number[] = [m.pacmanSpawn];

  const wrapPartner = new Map<number, number>();
  for (const cells of groupByRow(m.tunnels, m.cols).values()) {
    if (cells.length === 2) {
      wrapPartner.set(cells[0], cells[1]);
      wrapPartner.set(cells[1], cells[0]);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % m.cols;
    const y = Math.floor(idx / m.cols);

    const neighbors: number[] = [];
    if (y > 0) neighbors.push(idx - m.cols);
    if (y < m.rows - 1) neighbors.push(idx + m.cols);
    if (x > 0) neighbors.push(idx - 1);
    if (x < m.cols - 1) neighbors.push(idx + 1);
    const wrap = wrapPartner.get(idx);
    if (wrap !== undefined) neighbors.push(wrap);

    for (const n of neighbors) {
      if (visited.has(n) || m.walls[n] !== 0) continue;
      visited.add(n);
      queue.push(n);
    }
  }

  return visited;
}
