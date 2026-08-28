export const CANVAS_W = 600;
export const CANVAS_H = 700;
export const GIRDER_COUNT = 6;

export type Girder = {
  index: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

export type Ladder = {
  x: number;
  from: number;
  to: number;
  broken: boolean;
};

export const GIRDERS: Girder[] = [
  { index: 0, x0: 0, x1: 600, y0: 628, y1: 652 },
  { index: 1, x0: 0, x1: 560, y0: 558, y1: 534 },
  { index: 2, x0: 40, x1: 600, y0: 436, y1: 460 },
  { index: 3, x0: 0, x1: 560, y0: 362, y1: 338 },
  { index: 4, x0: 40, x1: 600, y0: 240, y1: 264 },
  { index: 5, x0: 0, x1: 560, y0: 166, y1: 142 },
];

export const LADDERS: Ladder[] = [
  { x: 140, from: 0, to: 1, broken: false },
  { x: 380, from: 0, to: 1, broken: false },
  { x: 520, from: 0, to: 1, broken: false },
  { x: 90, from: 1, to: 2, broken: false },
  { x: 300, from: 1, to: 2, broken: false },
  { x: 490, from: 1, to: 2, broken: false },
  { x: 180, from: 2, to: 3, broken: false },
  { x: 440, from: 2, to: 3, broken: false },
  { x: 100, from: 3, to: 4, broken: false },
  { x: 350, from: 3, to: 4, broken: false },
  { x: 520, from: 3, to: 4, broken: false },
  { x: 230, from: 4, to: 5, broken: false },
  { x: 480, from: 4, to: 5, broken: false },
];

export function girderYAt(g: Girder, x: number): number {
  const cx = Math.min(Math.max(x, g.x0), g.x1);
  const t = (cx - g.x0) / (g.x1 - g.x0);
  return g.y0 + t * (g.y1 - g.y0);
}

export function ladderAt(x: number, girderIndex: number, tolerance = 8): Ladder | null {
  for (const l of LADDERS) {
    if (l.from === girderIndex && Math.abs(l.x - x) <= tolerance) return l;
  }
  return null;
}

export const LEVEL_CONFIG: readonly (readonly [number, number, number, number])[] = [
  [2600, 110, 0.2, 0],
  [2400, 120, 0.24, 0],
  [2200, 130, 0.28, 1],
  [2000, 145, 0.32, 1],
  [1850, 160, 0.36, 1],
  [1700, 172, 0.4, 2],
  [1550, 185, 0.44, 2],
  [1400, 196, 0.48, 2],
  [1250, 208, 0.52, 3],
  [1100, 220, 0.55, 3],
];

export function configFor(level: number): readonly [number, number, number, number] {
  const idx = Math.min(Math.max(level, 1), LEVEL_CONFIG.length) - 1;
  return LEVEL_CONFIG[idx];
}

const BROKEN_LADDER_ORDER = [4, 7, 9, 1, 11, 6];

export function brokenLadderSet(level: number): Set<number> {
  const target = configFor(level)[3];
  const broken = new Set<number>();
  for (const idx of BROKEN_LADDER_ORDER) {
    if (broken.size >= target) break;
    const floor = LADDERS[idx].from;
    const unbrokenLeft = LADDERS.filter((l, i) => l.from === floor && i !== idx && !broken.has(i)).length;
    if (unbrokenLeft === 0) continue;
    broken.add(idx);
  }
  return broken;
}

export const TROPHY = { x: 300, y: 100 };
export const KONG = { x: 90, y: 160 };
export const HAMMERS: { x: number; girder: number }[] = [
  { x: 460, girder: 2 },
  { x: 120, girder: 4 },
];
export const PLAYER_SPAWN = { x: 520, girder: 0 };

// Trophy pickup collision box (moved here from KongGame.tsx: kong-logic modules
// used by future pure-logic code cannot depend on a React client component).
export const TROPHY_REACH_X = 22;
export const TROPHY_REACH_ABOVE = -34;
export const TROPHY_REACH_BELOW = 60;

export type Layout = {
  girders: Girder[];
  ladders: Ladder[];
  kong: { x: number; girder: number; ledge?: 0 | 1 };
  trophy: { x: number; y: number };
  hammers: { x: number; girder: number }[];
  playerSpawn: { x: number; girder: number };
};

const LAYOUT_1: Layout = {
  girders: GIRDERS,
  ladders: LADDERS,
  kong: { x: 90, girder: 4 },
  trophy: TROPHY,
  hammers: HAMMERS,
  playerSpawn: PLAYER_SPAWN,
};

// Layouts 2-5 are placeholder copies of layout 1 until Task 8 fills them in
// with real per-map geometry.
export const LAYOUTS: readonly Layout[] = [LAYOUT_1, LAYOUT_1, LAYOUT_1, LAYOUT_1, LAYOUT_1];

export function layoutFor(level: number): Layout {
  const idx = Math.min(Math.max(level, 1), LAYOUTS.length) - 1;
  return LAYOUTS[idx];
}
