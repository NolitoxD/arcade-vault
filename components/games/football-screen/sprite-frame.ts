import { PLAYER_SPEED, isPlayerDown, type PlayerState } from '../football-logic/players';
import { DIVE_REACH_MAX, GESTURE_IDLE, diveReach } from './gestures';
import {
  OCTANT_E, OCTANT_N, OCTANT_NE, OCTANT_NW, OCTANT_S, OCTANT_SE, OCTANT_SW, OCTANT_W,
  POSE_DIVE_0, POSE_DIVE_1, POSE_DOWN, POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2,
} from './sprite-maps';

// V15-1 (G15-2 + G15-3): which cell of the sprite atlas each player shows this frame.
// Pure, per player, written into an out object created ONCE by the component, and
// without a single trigonometric call per frame: the octant comes from comparing |x|
// with |y| * tan(22.5 deg), the run frame from the step count, the player id and the
// speed, and the keeper's two dive frames from gestures.ts's own reach curve.
//
// The priorities copy the exclusions drawPlayer already had (stage B2 §8 and its
// Minor 2): a diving keeper first, then the parked fifteen of the shootout (standing,
// whatever the engine left in their slide/floor fields), then lying down (never during
// the shootout, taker included), then sliding, then running or standing still.

// tan(22.5 deg) = sqrt(2) - 1: below it a direction is an axis, above it a diagonal.
export const OCTANT_TAN = 0.41421356;

export function facingOctant(fx: number, fy: number): number {
  const ax = fx < 0 ? -fx : fx;
  const ay = fy < 0 ? -fy : fy;
  if (ax === 0 && ay === 0) return OCTANT_E;
  if (ay <= ax * OCTANT_TAN) return fx > 0 ? OCTANT_E : OCTANT_W;
  if (ax <= ay * OCTANT_TAN) return fy > 0 ? OCTANT_S : OCTANT_N;
  if (fx > 0) return fy > 0 ? OCTANT_SE : OCTANT_NE;
  return fy > 0 ? OCTANT_SW : OCTANT_NW;
}

export const RUN_FRAME_STEPS = 6; // 10 frames/s at 60 steps/s
export const SPRINT_FRAME_STEPS = 4;
// Each id shifts its cycle by this many steps, so neighbours do not run in lockstep.
export const RUN_PHASE_SPREAD = 5;
export const RUN_MIN_SPEED_SQ = 1;
// Between a normal run (PLAYER_SPEED 180) and a sprint (180 * SPRINT_MULT 1.4 = 252).
export const RUN_FAST_SPEED_SQ = (PLAYER_SPEED * 1.2) * (PLAYER_SPEED * 1.2);
// RUN_1 (legs together) is the passing frame between the two strides.
const RUN_CYCLE: readonly number[] = [POSE_RUN_0, POSE_RUN_1, POSE_RUN_2, POSE_RUN_1];

export function runPose(stepCount: number, id: number, vx: number, vy: number): number {
  const speedSq = vx * vx + vy * vy;
  if (speedSq <= RUN_MIN_SPEED_SQ) return POSE_IDLE;
  const frameSteps = speedSq > RUN_FAST_SPEED_SQ ? SPRINT_FRAME_STEPS : RUN_FRAME_STEPS;
  const frame = ((stepCount + id * RUN_PHASE_SPREAD) / frameSteps) | 0;
  return RUN_CYCLE[frame & 3];
}

// G15-3: "estirada GK 2 fotogramas" chosen by the fraction of the gesture. The reach
// curve (gestures.ts) goes 0 -> DIVE_REACH_MAX -> 0 over the 35 steps, so the sprite
// goes DIVE_0 -> DIVE_1 -> DIVE_0 with it.
export const DIVE_FULL_FRACTION = 0.6;

export function diveSpritePose(progress: number): number {
  return diveReach(progress) >= DIVE_REACH_MAX * DIVE_FULL_FRACTION ? POSE_DIVE_1 : POSE_DIVE_0;
}

// G15-3: "deslizamiento = carrera inclinada". The only trigonometry of V15-1, computed
// ONCE at module load so the component can tilt the sprite with setTransform.
export const SLIDE_TILT_RAD = 0.45;
export const SLIDE_TILT_COS = Math.cos(SLIDE_TILT_RAD);
export const SLIDE_TILT_SIN = Math.sin(SLIDE_TILT_RAD);

export type SpriteChoice = { octant: number; pose: number; tilt: -1 | 0 | 1 };

export function createSpriteChoice(): SpriteChoice {
  return { octant: OCTANT_E, pose: POSE_IDLE, tilt: 0 };
}

// diveProgress: gestureProgress(...) for a keeper, GESTURE_IDLE for everybody else.
// diveDirX/diveDirY: gestures.dirX/dirY of that player (read only while diving).
export function choosePlayerSprite(
  p: PlayerState, stepCount: number, shootout: boolean, parked: boolean,
  diveProgress: number, diveDirX: number, diveDirY: number, out: SpriteChoice,
): void {
  out.tilt = 0;
  if (diveProgress !== GESTURE_IDLE) {
    out.octant = facingOctant(diveDirX, diveDirY);
    out.pose = diveSpritePose(diveProgress);
    return;
  }
  out.octant = facingOctant(p.facingX, p.facingY);
  if (parked) {
    out.pose = POSE_IDLE;
    return;
  }
  if (!shootout && isPlayerDown(p, stepCount)) {
    out.pose = POSE_DOWN;
    return;
  }
  if (!shootout && p.tackleStepsLeft > 0) {
    out.octant = facingOctant(p.tackleDirX, p.tackleDirY);
    out.pose = POSE_RUN_1;
    out.tilt = p.tackleDirX < 0 ? -1 : 1;
    return;
  }
  out.pose = runPose(stepCount, p.id, p.vx, p.vy);
}
