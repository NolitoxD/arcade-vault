import { clamp } from '../football-logic/geometry';
import type { PitchDef } from '../football-logic/pitch';
import type { MatchState } from '../football-logic/match';

// The spec's numbers: a 2000 x 1300 pitch seen through an 800 x 500 window -- 40 % of
// the pitch, and the same canvas size the other thirteen games use.
export const VIEW_W = 800;
export const VIEW_H = 500;
// S-SC6: how much dead ground around the pitch the camera may show, so the two goals
// and the touchlines are not pinned to the very edge of the canvas.
export const PITCH_MARGIN = 60;
// S-SC7: the follow factor per step. 0.12 at 60 Hz settles in about a quarter of a
// second, which reads as "the camera follows the ball" and not as "the ball is glued
// to the middle of the screen".
export const CAMERA_LAG = 0.12;

export type Camera = { x: number; y: number };

export function createCamera(): Camera {
  return { x: 0, y: 0 };
}

export function cameraMinX(pitch: PitchDef): number {
  void pitch;
  return -PITCH_MARGIN;
}

export function cameraMaxX(pitch: PitchDef): number {
  return pitch.width + PITCH_MARGIN - VIEW_W;
}

export function cameraMinY(pitch: PitchDef): number {
  void pitch;
  return -PITCH_MARGIN;
}

export function cameraMaxY(pitch: PitchDef): number {
  return pitch.height + PITCH_MARGIN - VIEW_H;
}

// Criterion 13: the camera follows the ball WITHOUT leaving the pitch.
export function centreCamera(cam: Camera, x: number, y: number, pitch: PitchDef): void {
  cam.x = clamp(x - VIEW_W / 2, cameraMinX(pitch), cameraMaxX(pitch));
  cam.y = clamp(y - VIEW_H / 2, cameraMinY(pitch), cameraMaxY(pitch));
}

export function followCamera(cam: Camera, x: number, y: number, pitch: PitchDef, lag: number): void {
  const wantX = clamp(x - VIEW_W / 2, cameraMinX(pitch), cameraMaxX(pitch));
  const wantY = clamp(y - VIEW_H / 2, cameraMinY(pitch), cameraMaxY(pitch));
  cam.x += (wantX - cam.x) * lag;
  cam.y += (wantY - cam.y) * lag;
}

// S-SC8: during the shootout the ball sits on the spot of whichever goal the kicking
// team attacks, and stage B2's S-PK8 makes the two goals ALTERNATE. Following the ball
// would be a slow pan across the whole pitch between kicks, so the target is the set
// piece itself and the component CUTS to it instead of panning.
export function cameraTargetX(match: MatchState): number {
  if (match.phase === 'shootout' && match.setPiece !== null) return match.setPiece.x;
  return match.ball.x;
}

export function cameraTargetY(match: MatchState): number {
  if (match.phase === 'shootout' && match.setPiece !== null) return match.setPiece.y;
  return match.ball.y;
}

export function toScreenX(cam: Camera, worldX: number): number {
  return worldX - cam.x;
}

export function toScreenY(cam: Camera, worldY: number): number {
  return worldY - cam.y;
}

// Culling for the eighteen players and the ball: nothing is drawn off the window.
export function isOnScreen(cam: Camera, worldX: number, worldY: number, margin: number): boolean {
  const sx = worldX - cam.x;
  const sy = worldY - cam.y;
  return sx >= -margin && sx <= VIEW_W + margin && sy >= -margin && sy <= VIEW_H + margin;
}
