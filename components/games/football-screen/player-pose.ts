// G11-1 (grill del paso 11, QA jugado del 09-sep y del 11-sep): a player must be a
// FIGURE seen from above -- head and shoulders -- not a plain disc. The orientation
// is the engine's own facingX/facingY (players.ts, a unit vector kept by movePlayer
// and preserved when the player stops), so nothing has to be derived and nothing has
// to be asked of the engine (G11-1: "solo drawPlayer, cero asignaciones por frame").
//
// And G11-2's diving keeper: the same maths, stretched along the direction of the
// dive. Both write into an out object created ONCE by the component, and neither uses
// a single trigonometric call -- the perpendicular of a unit vector (x, y) is
// (-y, x), which is all a top-down figure needs.
//
// Every ratio below is a fraction of PLAYER_RADIUS, so the figure scales with the
// body instead of being pinned to 12 px in three places.

export const HEAD_R_RATIO = 0.42;
export const HEAD_FORWARD_RATIO = 0.34;
export const SHOULDER_HALF_RATIO = 0.82;
export const SHOULDER_BACK_RATIO = 0.18;
export const DIVE_END_R_RATIO = 0.72;
export const DIVE_HALF_W_RATIO = 0.62;

export type PlayerPose = {
  headX: number;
  headY: number;
  headR: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
};

export function createPlayerPose(): PlayerPose {
  return { headX: 0, headY: 0, headR: 0, leftX: 0, leftY: 0, rightX: 0, rightY: 0 };
}

export function playerPose(
  x: number, y: number, facingX: number, facingY: number, radius: number, out: PlayerPose,
): void {
  // The engine keeps facing a unit vector; the only case worth guarding is the
  // degenerate one, and it is guarded with two comparisons, not with a square root.
  const zero = facingX === 0 && facingY === 0;
  const fx = zero ? 1 : facingX;
  const fy = zero ? 0 : facingY;
  const px = -fy;
  const py = fx;
  out.headX = x + fx * radius * HEAD_FORWARD_RATIO;
  out.headY = y + fy * radius * HEAD_FORWARD_RATIO;
  out.headR = radius * HEAD_R_RATIO;
  const backX = x - fx * radius * SHOULDER_BACK_RATIO;
  const backY = y - fy * radius * SHOULDER_BACK_RATIO;
  out.leftX = backX + px * radius * SHOULDER_HALF_RATIO;
  out.leftY = backY + py * radius * SHOULDER_HALF_RATIO;
  out.rightX = backX - px * radius * SHOULDER_HALF_RATIO;
  out.rightY = backY - py * radius * SHOULDER_HALF_RATIO;
}

export type DivePose = {
  frontX: number;
  frontY: number;
  backX: number;
  backY: number;
  endR: number;
  sideX: number;
  sideY: number;
};

export function createDivePose(): DivePose {
  return { frontX: 0, frontY: 0, backX: 0, backY: 0, endR: 0, sideX: 0, sideY: 0 };
}

// The stretched keeper: a capsule drawn as the quad between two circles. `reach` is
// in radius units and comes from gestures.ts's diveReach, so this function stays pure
// geometry and knows nothing about time.
export function divePose(
  x: number, y: number, dirX: number, dirY: number, radius: number, reach: number, out: DivePose,
): void {
  const zero = dirX === 0 && dirY === 0;
  const dx = zero ? 1 : dirX;
  const dy = zero ? 0 : dirY;
  const ex = dx * radius * reach;
  const ey = dy * radius * reach;
  out.frontX = x + ex;
  out.frontY = y + ey;
  out.backX = x - ex;
  out.backY = y - ey;
  out.endR = radius * DIVE_END_R_RATIO;
  out.sideX = -dy * radius * DIVE_HALF_W_RATIO;
  out.sideY = dx * radius * DIVE_HALF_W_RATIO;
}
