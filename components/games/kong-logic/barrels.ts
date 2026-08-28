import { girderYAt } from './level';
import type { Ladder, Layout } from './level';

export type Barrel = {
  x: number;
  y: number;
  girder: number;
  dir: 1 | -1;
  active: boolean;
  onLadder: Ladder | null;
};

export const MAX_BARRELS = 12;
export const DOWNHILL_FACTOR = 1.35;
export const UPHILL_FACTOR = 0.85;

export function openEdgeDir(girderIndex: number): 1 | -1 {
  return girderIndex % 2 === 1 ? 1 : -1;
}

function directionFactor(layout: Layout, b: Barrel): number {
  const g = layout.girders[b.girder];
  const dy = (g.y1 - g.y0) * b.dir;
  if (dy > 0) return DOWNHILL_FACTOR;
  if (dy < 0) return UPHILL_FACTOR;
  return 1;
}

export function spawnBarrel(pool: Barrel[], layout: Layout): Barrel | null {
  const slot = pool.find((b) => !b.active);
  if (!slot) return null;
  const girder = layout.kong.girder;
  slot.girder = girder;
  slot.dir = openEdgeDir(girder);
  slot.x = layout.kong.x;
  slot.y = girderYAt(layout.girders[girder], slot.x);
  slot.active = true;
  slot.onLadder = null;
  return slot;
}

export function advanceBarrel(layout: Layout, b: Barrel, dtMs: number, speed: number): void {
  const dt = dtMs / 1000;
  b.x += speed * dt * b.dir * directionFactor(layout, b);
  b.y = girderYAt(layout.girders[b.girder], b.x);
}

export function atGirderEnd(layout: Layout, b: Barrel): boolean {
  if (b.girder === 0) return false;
  const g = layout.girders[b.girder];
  const dir = openEdgeDir(b.girder);
  if (b.dir !== dir) return false;
  return dir === 1 ? b.x >= g.x1 : b.x <= g.x0;
}

export function dropToNextGirder(layout: Layout, b: Barrel): void {
  b.girder -= 1;
  if (b.girder < 0) {
    b.active = false;
    return;
  }
  b.dir = b.dir === 1 ? -1 : 1;
  const g = layout.girders[b.girder];
  b.x = Math.min(Math.max(b.x, g.x0), g.x1);
  b.y = girderYAt(g, b.x);
}

export function shouldTakeLadder(chance: number, rng: () => number): boolean {
  return rng() < chance;
}

// `layout` is unused today (the Ladder passed in already carries everything
// needed), but is threaded through for signature symmetry with the other
// barrel operations now that they all key off a Layout.
export function enterLadder(_layout: Layout, b: Barrel, l: Ladder): void {
  b.onLadder = l;
  b.x = l.x;
}

export function descendLadder(layout: Layout, b: Barrel, dtMs: number, speed: number): void {
  if (!b.onLadder) return;
  const l = b.onLadder;
  const dt = dtMs / 1000;
  const targetY = girderYAt(layout.girders[l.from], l.x);
  b.x = l.x;
  b.y += speed * dt;
  if (b.y >= targetY) {
    b.y = targetY;
    b.girder = l.from;
    b.onLadder = null;
    b.dir = openEdgeDir(b.girder);
  }
}
