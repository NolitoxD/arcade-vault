const COLS = 11;
const ROWS = 5;

const INV_W = 36;
const INV_H = 24;
const INV_GAP_X = 16;
const INV_GAP_Y = 14;

const INV_POINTS: readonly [number, number, number] = [10, 20, 30];

const STEP_ACCEL_PER_KILL_MS = 15;
const STEP_INTERVAL_FLOOR_MS = 50;

const WAVE_CONFIG: readonly (readonly [number, number, number, number])[] = [
  [800, 2000, 1, 0],
  [700, 1800, 1, 20],
  [600, 1600, 1.5, 40],
  [520, 1400, 1.5, 60],
  [440, 1200, 2, 80],
  [370, 1000, 2, 90],
  [300, 850, 2.5, 100],
  [240, 700, 2.5, 110],
  [190, 550, 3, 120],
  [150, 400, 3, 130],
] as const;

function waveFor(level: number): readonly [number, number, number, number] {
  const index = Math.min(level, WAVE_CONFIG.length) - 1;
  return WAVE_CONFIG[Math.max(index, 0)];
}

type Invader = { col: number; row: number; alive: boolean; type: 0 | 1 | 2; animFrame: 0 | 1 };

function typeForRow(row: number): 0 | 1 | 2 {
  if (row === 0) return 2;
  if (row === 1) return 1;
  return 0;
}

function createFormation(): Invader[] {
  const invaders: Invader[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      invaders.push({ col, row, alive: true, type: typeForRow(row), animFrame: 0 });
    }
  }
  return invaders;
}

function pointsFor(type: 0 | 1 | 2): number {
  return INV_POINTS[type];
}

function stepInterval(level: number, aliveCount: number): number {
  const base = waveFor(level)[0];
  const killed = COLS * ROWS - aliveCount;
  return Math.max(base - killed * STEP_ACCEL_PER_KILL_MS, STEP_INTERVAL_FLOOR_MS);
}

function formationBounds(
  invaders: Invader[],
  originX: number,
  originY: number,
): { left: number; right: number; bottom: number } | null {
  const alive = invaders.filter((i) => i.alive);
  if (alive.length === 0) return null;

  let minCol = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const invader of alive) {
    if (invader.col < minCol) minCol = invader.col;
    if (invader.col > maxCol) maxCol = invader.col;
    if (invader.row > maxRow) maxRow = invader.row;
  }

  const cellW = INV_W + INV_GAP_X;
  const cellH = INV_H + INV_GAP_Y;
  return {
    left: originX + minCol * cellW,
    right: originX + maxCol * cellW + INV_W,
    bottom: originY + maxRow * cellH + INV_H,
  };
}

function shooterCells(invaders: Invader[]): Invader[] {
  const shooters: Invader[] = [];
  for (let col = 0; col < COLS; col++) {
    let lowest: Invader | null = null;
    for (const invader of invaders) {
      if (invader.col !== col || !invader.alive) continue;
      if (lowest === null || invader.row > lowest.row) lowest = invader;
    }
    if (lowest) shooters.push(lowest);
  }
  return shooters;
}

export {
  WAVE_CONFIG,
  waveFor,
  createFormation,
  pointsFor,
  stepInterval,
  formationBounds,
  shooterCells,
  INV_W,
  INV_H,
  INV_GAP_X,
  INV_GAP_Y,
  INV_POINTS,
  STEP_ACCEL_PER_KILL_MS,
  STEP_INTERVAL_FLOOR_MS,
};
export type { Invader };
