import type { ParsedMaze } from './maze';

export type GhostId = 'blinky' | 'pinky' | 'inky' | 'clyde';
export type Mode = 'scatter' | 'chase' | 'frightened' | 'eyes';

type Dir = 0 | 1 | 2 | 3;

export type TargetState = {
  pacmanCell: number;
  pacmanDir: Dir;
  blinkyCell: number;
  ghostCell: number;
  cols: number;
};

// Canonical maze size fixed across the 3 shipped mazes (see specs/19-pacman.md
// GRID_ROWS). Needed here because TargetState only carries cols, not rows,
// yet Clyde's near-Pac-Man chase target falls back to his scatter corner.
const GRID_ROWS = 31;

const DIRS: Dir[] = [0, 1, 2, 3];
const DX: Record<Dir, number> = { 0: 0, 1: -1, 2: 0, 3: 1 };
const DY: Record<Dir, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };

export function chaseTarget(id: GhostId, s: TargetState): number {
  const { pacmanCell, pacmanDir, blinkyCell, ghostCell, cols } = s;
  const px = pacmanCell % cols;
  const py = Math.floor(pacmanCell / cols);

  switch (id) {
    case 'blinky':
      return pacmanCell;
    case 'pinky': {
      const tx = px + DX[pacmanDir] * 4;
      const ty = py + DY[pacmanDir] * 4;
      return ty * cols + tx;
    }
    case 'inky': {
      const p2x = px + DX[pacmanDir] * 2;
      const p2y = py + DY[pacmanDir] * 2;
      const bx = blinkyCell % cols;
      const by = Math.floor(blinkyCell / cols);
      const tx = bx + 2 * (p2x - bx);
      const ty = by + 2 * (p2y - by);
      return ty * cols + tx;
    }
    case 'clyde': {
      const gx = ghostCell % cols;
      const gy = Math.floor(ghostCell / cols);
      const distSq = (px - gx) ** 2 + (py - gy) ** 2;
      if (distSq > 64) return pacmanCell;
      return (GRID_ROWS - 1) * cols;
    }
    default:
      throw new Error(`Unknown ghost id: ${id}`);
  }
}

export function scatterTarget(id: GhostId, m: ParsedMaze): number {
  switch (id) {
    case 'blinky':
      return m.cols - 1;
    case 'pinky':
      return 0;
    case 'inky':
      return (m.rows - 1) * m.cols + (m.cols - 1);
    case 'clyde':
      return (m.rows - 1) * m.cols;
    default:
      throw new Error(`Unknown ghost id: ${id}`);
  }
}

function neighborCell(idx: number, dir: Dir, cols: number): number {
  const x = idx % cols;
  switch (dir) {
    case 0:
      return idx - cols;
    case 1:
      return x === 0 ? idx + cols - 1 : idx - 1;
    case 2:
      return idx + cols;
    case 3:
      return x === cols - 1 ? idx - (cols - 1) : idx + 1;
    default:
      throw new Error(`Unknown direction: ${dir}`);
  }
}

export function nextDir(
  ghostCell: number,
  currentDir: Dir,
  targetCell: number,
  m: ParsedMaze,
  frightened: boolean,
  rng: () => number,
): Dir {
  const exits = m.adjacency[ghostCell];
  const reverseDir = ((currentDir + 2) % 4) as Dir;
  const legal = DIRS.filter((d) => (exits & (1 << d)) !== 0);
  const candidates = legal.filter((d) => d !== reverseDir);
  const options = candidates.length > 0 ? candidates : legal;

  if (frightened) {
    const idx = Math.min(options.length - 1, Math.floor(rng() * options.length));
    return options[idx];
  }

  const tx = targetCell % m.cols;
  const ty = Math.floor(targetCell / m.cols);

  let best = options[0];
  let bestDistSq = Infinity;
  for (const d of options) {
    const n = neighborCell(ghostCell, d, m.cols);
    const nx = n % m.cols;
    const ny = Math.floor(n / m.cols);
    const distSq = (tx - nx) ** 2 + (ty - ny) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = d;
    }
  }
  return best;
}

const CHASE_MS = 20000;
const SCATTER_CYCLES = 4;
// DIFFICULTY.scatterS by level (spec 19, section "Tabla de escalado por
// nivel"), clamped at level 12+ like every other DIFFICULTY column.
const SCATTER_S_BY_LEVEL = [7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 3, 3];

export function modeSchedule(level: number): { phase: Mode; durationMs: number }[] {
  const scatterS = SCATTER_S_BY_LEVEL[Math.min(level, 12) - 1];
  const schedule: { phase: Mode; durationMs: number }[] = [];
  for (let cycle = 0; cycle < SCATTER_CYCLES; cycle++) {
    schedule.push({ phase: 'scatter', durationMs: scatterS * 1000 });
    const isLastCycle = cycle === SCATTER_CYCLES - 1;
    schedule.push({ phase: 'chase', durationMs: isLastCycle ? Infinity : CHASE_MS });
  }
  return schedule;
}
