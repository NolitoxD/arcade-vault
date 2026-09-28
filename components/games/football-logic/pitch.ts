export type Side = 0 | 1;

export type PitchDef = {
  width: number;
  height: number;
  goalWidth: number;
  crossbarHeight: number;
  bigAreaDepth: number;
  bigAreaWidth: number;
  smallAreaDepth: number;
  smallAreaWidth: number;
  penaltySpotDist: number;
  centerCircleRadius: number;
};

// World units: a real 105 x 68 m pitch at ~19 u/m.
//
// G15-16 (v1.5, V15-4): ~10 % bigger, so eleven a side is not a crowd. Both axes scale
// by exactly 1.1, which keeps the aspect ratio (and therefore minimap.ts's 200 x 130
// and flow-layout.ts's previews) EXACT without touching those files.
//
// Paco, 24-sep: the AREAS and the CENTRE CIRCLE scale with the pitch, in proportion,
// and so does the penalty spot, which is big-area geometry (checkPitch requires it
// inside the big area and outside the small one). The GOAL does NOT: goalWidth and
// crossbarHeight stay exactly as they are, because they are what decides how many
// goals go in and they are balanced against catchChance and SHOT_POST_MARGIN.
export const PITCH: PitchDef = {
  width: 2200,               // 2000 * 1.1
  height: 1430,              // 1300 * 1.1
  goalWidth: 150,            // NOT scaled
  crossbarHeight: 50,        // NOT scaled
  bigAreaDepth: 352,         // 320 * 1.1
  bigAreaWidth: 847,         // 770 * 1.1
  smallAreaDepth: 115.5,     // 105 * 1.1
  smallAreaWidth: 385,       // 350 * 1.1
  penaltySpotDist: 231,      // 210 * 1.1
  centerCircleRadius: 192.5, // 175 * 1.1
};

export function centerX(pitch: PitchDef): number {
  return pitch.width / 2;
}

export function centerY(pitch: PitchDef): number {
  return pitch.height / 2;
}

export function goalLineX(pitch: PitchDef, side: Side): number {
  return side === 0 ? 0 : pitch.width;
}

export function penaltySpotX(pitch: PitchDef, side: Side): number {
  return side === 0 ? pitch.penaltySpotDist : pitch.width - pitch.penaltySpotDist;
}

// The goal-kick spot: on the small-area line, centre of the goal. Its only code
// consumer is judgeBall (referee.ts): since D4 a keeper's catch keeps play alive,
// it never restarts from here.
export function goalKickX(pitch: PitchDef, side: Side): number {
  return side === 0 ? pitch.smallAreaDepth : pitch.width - pitch.smallAreaDepth;
}

// Boundary conventions (deferred minor #3, decided in stage B): isBetweenPosts is
// EXCLUSIVE (a ball exactly on a post is not a goal) while isInsideBox is CLOSED
// (a keeper exactly on the area line is still inside, which is what clampToBigArea
// produces). referee.ts and ai.ts rely on both together: a ball on the goal line
// between the posts is judged by judgeBall, never picked up or caught.
export function isBetweenPosts(pitch: PitchDef, y: number): boolean {
  const half = pitch.goalWidth / 2;
  const cy = centerY(pitch);
  return y > cy - half && y < cy + half;
}

function isInsideBox(pitch: PitchDef, side: Side, depth: number, width: number, x: number, y: number): boolean {
  const half = width / 2;
  const cy = centerY(pitch);
  if (y < cy - half || y > cy + half) return false;
  return side === 0 ? x >= 0 && x <= depth : x >= pitch.width - depth && x <= pitch.width;
}

export function isInsideBigArea(pitch: PitchDef, side: Side, x: number, y: number): boolean {
  return isInsideBox(pitch, side, pitch.bigAreaDepth, pitch.bigAreaWidth, x, y);
}

export function isInsideSmallArea(pitch: PitchDef, side: Side, x: number, y: number): boolean {
  return isInsideBox(pitch, side, pitch.smallAreaDepth, pitch.smallAreaWidth, x, y);
}

// Writes into `p` (goalkeeper invariant: never outside the big area).
export function clampToBigArea(pitch: PitchDef, side: Side, p: { x: number; y: number }): void {
  const half = pitch.bigAreaWidth / 2;
  const cy = centerY(pitch);
  const minX = side === 0 ? 0 : pitch.width - pitch.bigAreaDepth;
  const maxX = side === 0 ? pitch.bigAreaDepth : pitch.width;
  if (p.x < minX) p.x = minX;
  if (p.x > maxX) p.x = maxX;
  if (p.y < cy - half) p.y = cy - half;
  if (p.y > cy + half) p.y = cy + half;
}
