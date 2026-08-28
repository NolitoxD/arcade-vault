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

// Not exported: layout 1's geometry, private to this module. Consumers
// (KongGame.tsx, tests) read it through `layoutFor`/`LAYOUTS` instead.
const GIRDERS: Girder[] = [
  { index: 0, x0: 0, x1: 600, y0: 628, y1: 652 },
  { index: 1, x0: 0, x1: 560, y0: 558, y1: 534 },
  { index: 2, x0: 40, x1: 600, y0: 436, y1: 460 },
  { index: 3, x0: 0, x1: 560, y0: 362, y1: 338 },
  { index: 4, x0: 40, x1: 600, y0: 240, y1: 264 },
  { index: 5, x0: 0, x1: 560, y0: 166, y1: 142 },
];

const LADDERS: Ladder[] = [
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

export function ladderAt(layout: Layout, x: number, girderIndex: number, tolerance = 8): Ladder | null {
  for (const l of layout.ladders) {
    if (l.from === girderIndex && Math.abs(l.x - x) <= tolerance) return l;
  }
  return null;
}

export const LEVEL_CONFIG: readonly (readonly [number, number, number, number])[] = [
  [2600, 110, 0.2, 0],
  [2200, 130, 0.28, 1],
  [1850, 160, 0.36, 2],
  [1550, 185, 0.44, 3],
  [1250, 208, 0.52, 3],
] as const;

export function configFor(level: number): readonly [number, number, number, number] {
  const idx = Math.min(Math.max(level, 1), LEVEL_CONFIG.length) - 1;
  return LEVEL_CONFIG[idx];
}

// Which ladders get broken is derived from each layout's own `ladders`
// array instead of a hardcoded index list: a fixed order like the old
// BROKEN_LADDER_ORDER only made sense for layout 1's own ladder indices,
// and would silently point at the wrong ladders (or ones on the wrong
// floor) once layouts 2-5 get their own geometry in Task 8.
//
// Breaks are chosen round-robin across floors (floor 0's own ladders first,
// then floor 1's, ...), one floor per round, instead of walking the ladder
// array start to finish. That spreads the breaks across the whole climb
// instead of piling them onto whichever floors happen to come first in the
// array — the property the old hand-picked order actually encoded. Within
// a floor, ladders are still consumed in their own array order, and a
// floor is skipped for the rest of the run once only its last unbroken
// ladder is left, which is the same "never strand a floor" guard as
// before, just falling out of round-robin consumption instead of a
// per-candidate recount.
export function brokenLadderSet(layout: Layout, level: number): Set<number> {
  const target = configFor(level)[3];
  const broken = new Set<number>();
  if (target <= 0) return broken;

  const byFloor = new Map<number, number[]>();
  layout.ladders.forEach((l, i) => {
    const list = byFloor.get(l.from);
    if (list) list.push(i);
    else byFloor.set(l.from, [i]);
  });
  const floors = [...byFloor.keys()].sort((a, b) => a - b);
  const cursor = new Map<number, number>(floors.map((f) => [f, 0]));

  let progressed = true;
  while (broken.size < target && progressed) {
    progressed = false;
    for (const floor of floors) {
      if (broken.size >= target) break;
      const list = byFloor.get(floor)!;
      const pos = cursor.get(floor)!;
      if (pos >= list.length - 1) continue; // last unbroken ladder of this floor: never break it
      broken.add(list[pos]);
      cursor.set(floor, pos + 1);
      progressed = true;
    }
  }
  return broken;
}

const TROPHY = { x: 300, y: 100 };
// Hammer 1's x was 120 (box 110-130), which sat under Kong's 72px sprite at
// x: 90 (box 54-126) — Kong draws on top and hid it entirely. Moved to 145
// (box 135-155), clear of Kong's box by 9px; nothing else about map 1
// changed, per instruction not to touch its shipped geometry otherwise.
const HAMMERS: { x: number; girder: number }[] = [
  { x: 460, girder: 2 },
  { x: 145, girder: 4 },
];
const PLAYER_SPAWN = { x: 520, girder: 0 };

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

// Layouts 2-5: same 6-girder zigzag skeleton as layout 1, but each with its
// own slope, ladder and hammer placement. Kong climbs across the set: map 2
// stands on girder 5 (the top girder itself), maps 3-4 perch on the ledge
// above it (low/high) while barrels still spawn from girder 5, and map 5
// returns him to girder 5 to guard the trophy. Difficulty rises 2->5 mainly
// through ladder spacing (further apart => longer exposed runs) since every
// floor keeps exactly 2 ladders, the minimum brokenLadderSet can never
// strand (see the guard in brokenLadderSet above).
//
// Every girder here spans the full canvas width (x0: 0, x1: 600). That is
// deliberate, not laziness: layout 1 insets alternate floors (e.g. girder 2
// starts at x0: 40 while girder 1 stops at x1: 560), which leaves a sliver
// of girder 2 (x 560-600) with no girder 1 underneath it at all — a fall
// there skips straight to girder 0, more than doubling the drop. Full-width
// girders make every floor completely covered by the one below, so the only
// vertical gap that can ever matter is the adjacent-floor one, which is kept
// under FALL_DEATH_PX (see the girder tables below).
// Girder spacing across maps 2-5 lives in a narrow window, not just under a
// ceiling: FALL_DEATH_PX (90) is the top, but there is also a floor — the
// apex of a standing jump (JUMP_VY^2 / (2*GRAVITY) from player.ts, ~66px).
// Below that, a floor "gap" is climbable by jumping straight up, which
// makes every ladder on that floor optional and quietly breaks the
// escalating-difficulty design. Each map below picks its own T (slope
// amplitude) and center-to-center spacing so min/max gap both land inside
// (apex, FALL_DEATH_PX) with a few pixels of margin on both sides — see
// level-invariants.ts's checkGirderGaps, which enforces this floor and
// ceiling for every shipped map except map 1 (untouched legacy geometry).
const GIRDERS_2: Girder[] = [
  { index: 0, x0: 0, x1: 600, y0: 611, y1: 619 },
  { index: 1, x0: 0, x1: 600, y0: 541, y1: 533 },
  { index: 2, x0: 0, x1: 600, y0: 455, y1: 463 },
  { index: 3, x0: 0, x1: 600, y0: 385, y1: 377 },
  { index: 4, x0: 0, x1: 600, y0: 299, y1: 307 },
  { index: 5, x0: 0, x1: 600, y0: 229, y1: 221 },
];

const LADDERS_2: Ladder[] = [
  { x: 150, from: 0, to: 1, broken: false },
  { x: 470, from: 0, to: 1, broken: false },
  { x: 110, from: 1, to: 2, broken: false },
  { x: 500, from: 1, to: 2, broken: false },
  { x: 180, from: 2, to: 3, broken: false },
  { x: 520, from: 2, to: 3, broken: false },
  { x: 90, from: 3, to: 4, broken: false },
  { x: 460, from: 3, to: 4, broken: false },
  { x: 140, from: 4, to: 5, broken: false },
  { x: 480, from: 4, to: 5, broken: false },
];

const LAYOUT_2: Layout = {
  girders: GIRDERS_2,
  ladders: LADDERS_2,
  kong: { x: 100, girder: 5 },
  trophy: { x: 430, y: 180 },
  hammers: [
    { x: 200, girder: 2 },
    { x: 480, girder: 4 },
  ],
  playerSpawn: { x: 520, girder: 0 },
};

const GIRDERS_3: Girder[] = [
  { index: 0, x0: 0, x1: 600, y0: 608, y1: 612 },
  { index: 1, x0: 0, x1: 600, y0: 532, y1: 528 },
  { index: 2, x0: 0, x1: 600, y0: 448, y1: 452 },
  { index: 3, x0: 0, x1: 600, y0: 372, y1: 368 },
  { index: 4, x0: 0, x1: 600, y0: 288, y1: 292 },
  { index: 5, x0: 0, x1: 600, y0: 212, y1: 208 },
];

// Ladders and hammers below are deliberately NOT mirrored near-edge pairs
// (that pattern — e.g. x 30/570 on every floor — made maps 3-5 read as the
// same map with a paint job). Each floor's pair sits at its own x, and the
// pattern differs map to map, alongside a different slope amplitude (T) per
// map: 3 is a gentle tilt, 4 is nearly flat, 5 is a moderate tilt again but
// with the widest ladder spread of the three.
const LADDERS_3: Ladder[] = [
  { x: 90, from: 0, to: 1, broken: false },
  { x: 380, from: 0, to: 1, broken: false },
  { x: 250, from: 1, to: 2, broken: false },
  { x: 520, from: 1, to: 2, broken: false },
  { x: 60, from: 2, to: 3, broken: false },
  { x: 340, from: 2, to: 3, broken: false },
  { x: 430, from: 3, to: 4, broken: false },
  { x: 560, from: 3, to: 4, broken: false },
  { x: 120, from: 4, to: 5, broken: false },
  { x: 300, from: 4, to: 5, broken: false },
];

const LAYOUT_3: Layout = {
  girders: GIRDERS_3,
  ladders: LADDERS_3,
  kong: { x: 480, girder: 5, ledge: 0 },
  trophy: { x: 200, y: 168 },
  hammers: [
    { x: 460, girder: 1 },
    { x: 140, girder: 3 },
  ],
  playerSpawn: { x: 300, girder: 0 },
};

const GIRDERS_4: Girder[] = [
  { index: 0, x0: 0, x1: 600, y0: 604, y1: 606 },
  { index: 1, x0: 0, x1: 600, y0: 524, y1: 522 },
  { index: 2, x0: 0, x1: 600, y0: 440, y1: 442 },
  { index: 3, x0: 0, x1: 600, y0: 360, y1: 358 },
  { index: 4, x0: 0, x1: 600, y0: 276, y1: 278 },
  { index: 5, x0: 0, x1: 600, y0: 196, y1: 194 },
];

const LADDERS_4: Ladder[] = [
  { x: 200, from: 0, to: 1, broken: false },
  { x: 480, from: 0, to: 1, broken: false },
  { x: 90, from: 1, to: 2, broken: false },
  { x: 560, from: 1, to: 2, broken: false },
  { x: 310, from: 2, to: 3, broken: false },
  { x: 430, from: 2, to: 3, broken: false },
  { x: 60, from: 3, to: 4, broken: false },
  { x: 250, from: 3, to: 4, broken: false },
  { x: 380, from: 4, to: 5, broken: false },
  { x: 550, from: 4, to: 5, broken: false },
];

const LAYOUT_4: Layout = {
  girders: GIRDERS_4,
  ladders: LADDERS_4,
  kong: { x: 300, girder: 5, ledge: 1 },
  trophy: { x: 100, y: 152 },
  hammers: [
    { x: 520, girder: 2 },
    { x: 90, girder: 4 },
  ],
  playerSpawn: { x: 550, girder: 0 },
};

const GIRDERS_5: Girder[] = [
  { index: 0, x0: 0, x1: 600, y0: 612, y1: 618 },
  { index: 1, x0: 0, x1: 600, y0: 539, y1: 533 },
  { index: 2, x0: 0, x1: 600, y0: 454, y1: 460 },
  { index: 3, x0: 0, x1: 600, y0: 381, y1: 375 },
  { index: 4, x0: 0, x1: 600, y0: 296, y1: 302 },
  { index: 5, x0: 0, x1: 600, y0: 223, y1: 217 },
];

const LADDERS_5: Ladder[] = [
  { x: 140, from: 0, to: 1, broken: false },
  { x: 560, from: 0, to: 1, broken: false },
  { x: 310, from: 1, to: 2, broken: false },
  { x: 470, from: 1, to: 2, broken: false },
  { x: 70, from: 2, to: 3, broken: false },
  { x: 400, from: 2, to: 3, broken: false },
  { x: 230, from: 3, to: 4, broken: false },
  { x: 540, from: 3, to: 4, broken: false },
  { x: 90, from: 4, to: 5, broken: false },
  { x: 460, from: 4, to: 5, broken: false },
];

const LAYOUT_5: Layout = {
  girders: GIRDERS_5,
  ladders: LADDERS_5,
  kong: { x: 160, girder: 5 },
  trophy: { x: 470, y: 176 },
  hammers: [
    { x: 330, girder: 1 },
    { x: 520, girder: 3 },
  ],
  playerSpawn: { x: 520, girder: 0 },
};

export const LAYOUTS: readonly Layout[] = [LAYOUT_1, LAYOUT_2, LAYOUT_3, LAYOUT_4, LAYOUT_5];

export function layoutFor(level: number): Layout {
  const idx = Math.min(Math.max(level, 1), LAYOUTS.length) - 1;
  return LAYOUTS[idx];
}

// Kong stands either on his own girder (no `ledge`) or on a dedicated
// platform above the topmost girder (`ledge` 0 = low, 1 = high). No shipped
// layout uses a ledge yet — real per-map placement lands in Task 8 — but the
// two fixed heights above the top girder's surface are exercised by tests.
const KONG_LEDGE_GAP: readonly [number, number] = [36, 74];
export const KONG_LEDGE_HALF_W = 46;

export function kongFootY(layout: Layout): number {
  const { x, girder, ledge } = layout.kong;
  if (ledge === undefined) return girderYAt(layout.girders[girder], x);
  const topGirder = layout.girders[layout.girders.length - 1];
  return girderYAt(topGirder, x) - KONG_LEDGE_GAP[ledge];
}

export type KongLedge = { x0: number; x1: number; y: number };

// Geometry for the decorative platform baked under a ledge-perched Kong.
// Not part of `girders` and not playable — purely a backdrop element.
export function kongLedgePlatform(layout: Layout): KongLedge | null {
  if (layout.kong.ledge === undefined) return null;
  return {
    x0: layout.kong.x - KONG_LEDGE_HALF_W,
    x1: layout.kong.x + KONG_LEDGE_HALF_W,
    y: kongFootY(layout),
  };
}
