import type { PitchDef } from '../football-logic/pitch';
import { VIEW_H, VIEW_W, type Camera } from './camera';

// Spec: "minimapa con los dieciocho en una esquina". 200 x 130 keeps the 2000 x 1300
// aspect exactly, so the projection is a single scale factor per axis and nothing is
// distorted.
export const MINIMAP_W = 200;
export const MINIMAP_H = 130;
export const MINIMAP_PAD = 12;

// Local coordinates INSIDE the minimap: the component translates once and draws.
// Deliberately unclamped -- a ball that has left the pitch should show outside the
// minimap frame, exactly where it is, and the frame is drawn on top.
export function minimapX(pitch: PitchDef, worldX: number): number {
  return (worldX / pitch.width) * MINIMAP_W;
}

export function minimapY(pitch: PitchDef, worldY: number): number {
  return (worldY / pitch.height) * MINIMAP_H;
}

export type MinimapRect = { x: number; y: number; w: number; h: number };

export function createMinimapRect(): MinimapRect {
  return { x: 0, y: 0, w: 0, h: 0 };
}

// What the camera is currently showing, drawn as a frame on the minimap so the player
// can tell which slice of the pitch is on screen. Writes into out; allocates nothing.
export function minimapViewRect(cam: Camera, pitch: PitchDef, out: MinimapRect): void {
  out.x = minimapX(pitch, cam.x);
  out.y = minimapY(pitch, cam.y);
  out.w = (VIEW_W / pitch.width) * MINIMAP_W;
  out.h = (VIEW_H / pitch.height) * MINIMAP_H;
}
