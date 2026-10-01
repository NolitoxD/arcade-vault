import { centerY, goalLineX, type PitchDef, type Side } from './pitch';
import type { BallState } from './ball';

// G15-12 (v1.5, V15-4): the goal FRAME. Two collision circles on the goal line, one on
// each end of the mouth, plus a crossbar band on top of it. Pure arithmetic over a
// BallState: no Rng, no state, no allocation -- it is called once per step, for one
// ball, from stepBall.
//
// Boundary convention, deliberately aligned with pitch.ts's isBetweenPosts (EXCLUSIVE)
// and referee.ts's judgeBall: a ball whose centre is strictly between the posts and
// below the bar is a GOAL and the frame must never touch it. That is the negative
// control of this module's test, and it is the one property a bug here would break.
export type FrameHit = 'none' | 'post' | 'crossbar';

export const POST_RADIUS = 6;
export const BALL_RADIUS = 5;
// The band above crossbarHeight that still counts as hitting the bar. Above it the ball
// is OUT, which is exactly what judgeBall already does with a ball over the bar.
export const CROSSBAR_THICKNESS = 8;
// "rebote con perdida" (G15-12). 0.55 is half the ball's own ground bounce plus a
// little: a ball off the post comes back into play, it does not shoot away.
export const FRAME_BOUNCE = 0.55;

export function postCentreY(pitch: PitchDef, which: 0 | 1): number {
  const half = pitch.goalWidth / 2;
  return which === 0 ? centerY(pitch) - half : centerY(pitch) + half;
}

// The goal the ball is arriving at, or -1. The frame is only live within one ball
// radius plus one post radius of the goal line: everywhere else this returns -1 and the
// whole module costs two comparisons.
function goalSideNear(ball: BallState, pitch: PitchDef): Side | -1 {
  const reach = POST_RADIUS + BALL_RADIUS;
  if (ball.x <= reach) return 0;
  if (ball.x >= pitch.width - reach) return 1;
  return -1;
}

function touchesPost(ball: BallState, pitch: PitchDef, which: 0 | 1): boolean {
  const reach = POST_RADIUS + BALL_RADIUS;
  const dy = ball.y - postCentreY(pitch, which);
  return dy > -reach && dy < reach && ball.z < pitch.crossbarHeight + CROSSBAR_THICKNESS;
}

export function frameHitFor(ball: BallState, pitch: PitchDef): FrameHit {
  if (ball.owner !== null) return 'none';
  const side = goalSideNear(ball, pitch);
  if (side === -1) return 'none';
  // Only a ball travelling TOWARDS the goal line meets the frame. A cross rolled along
  // the line (vx = 0) or a ball already bounced back would otherwise be caught again
  // every step and die stuck to the post.
  if (side === 1 ? ball.vx <= 0 : ball.vx >= 0) return 'none';
  if (touchesPost(ball, pitch, 0) || touchesPost(ball, pitch, 1)) return 'post';
  const half = pitch.goalWidth / 2;
  const cy = centerY(pitch);
  if (ball.y <= cy - half || ball.y >= cy + half) return 'none';
  if (ball.z >= pitch.crossbarHeight && ball.z < pitch.crossbarHeight + CROSSBAR_THICKNESS) return 'crossbar';
  return 'none';
}

// Reflects the ball back into the pitch and takes FRAME_BOUNCE of its speed away.
// Writes into `ball`; allocates nothing. A 'none' hit is a no-op by design, so the
// caller can hand it the result of frameHitFor without a branch.
export function bounceOffFrame(ball: BallState, pitch: PitchDef, hit: FrameHit): void {
  if (hit === 'none') return;
  const side = goalSideNear(ball, pitch);
  if (side === -1) return;
  const line = goalLineX(pitch, side);
  const inward = side === 0 ? 1 : -1;
  ball.vx = -ball.vx * FRAME_BOUNCE;
  ball.vy *= FRAME_BOUNCE;
  if (hit === 'crossbar') {
    ball.vz = -Math.abs(ball.vz) * FRAME_BOUNCE;
  }
  // Make sure it cannot be judged a goal on the very next step: park it POST_RADIUS +
  // BALL_RADIUS inside the line, on the side it came from. That is exactly goalSideNear's
  // inclusive boundary, so the ball is still "near" the frame on the next step; what
  // stops a second hit is the direction check in frameHitFor (it now travels away from
  // the line), and the next move takes it out of reach.
  if (ball.vx * inward <= 0) ball.vx = Math.abs(ball.vx) * inward;
  ball.x = line + inward * (POST_RADIUS + BALL_RADIUS);
}
