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
export const PITCH: PitchDef = {
  width: 2000,
  height: 1300,
  goalWidth: 150,
  crossbarHeight: 50,
  bigAreaDepth: 320,
  bigAreaWidth: 770,
  smallAreaDepth: 105,
  smallAreaWidth: 350,
  penaltySpotDist: 210,
  centerCircleRadius: 175,
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
