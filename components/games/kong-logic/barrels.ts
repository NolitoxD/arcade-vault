import { GIRDERS, KONG, girderYAt } from './level';
import type { Ladder } from './level';

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

function directionFactor(b: Barrel): number {
  const g = GIRDERS[b.girder];
  const dy = (g.y1 - g.y0) * b.dir;
  if (dy > 0) return DOWNHILL_FACTOR;
  if (dy < 0) return UPHILL_FACTOR;
  return 1;
}

export function spawnBarrel(pool: Barrel[]): Barrel | null {
  const slot = pool.find((b) => !b.active);
  if (!slot) return null;
  const girder = GIRDERS.length - 1;
  slot.girder = girder;
  slot.dir = openEdgeDir(girder);
  slot.x = KONG.x;
  slot.y = girderYAt(GIRDERS[girder], slot.x);
  slot.active = true;
  slot.onLadder = null;
  return slot;
}

export function advanceBarrel(b: Barrel, dtMs: number, speed: number): void {
  const dt = dtMs / 1000;
  b.x += speed * dt * b.dir * directionFactor(b);
  b.y = girderYAt(GIRDERS[b.girder], b.x);
}

export function atGirderEnd(b: Barrel): boolean {
  if (b.girder === 0) return false;
  const g = GIRDERS[b.girder];
  const dir = openEdgeDir(b.girder);
  if (b.dir !== dir) return false;
  return dir === 1 ? b.x >= g.x1 : b.x <= g.x0;
}

export function dropToNextGirder(b: Barrel): void {
  b.girder -= 1;
  if (b.girder < 0) {
    b.active = false;
    return;
  }
  b.dir = b.dir === 1 ? -1 : 1;
  const g = GIRDERS[b.girder];
  b.x = Math.min(Math.max(b.x, g.x0), g.x1);
  b.y = girderYAt(g, b.x);
}

export function shouldTakeLadder(chance: number, rng: () => number): boolean {
  return rng() < chance;
}

export function enterLadder(b: Barrel, l: Ladder): void {
  b.onLadder = l;
  b.x = l.x;
}

export function descendLadder(b: Barrel, dtMs: number, speed: number): void {
  if (!b.onLadder) return;
  const l = b.onLadder;
  const dt = dtMs / 1000;
  const targetY = girderYAt(GIRDERS[l.from], l.x);
  b.x = l.x;
  b.y += speed * dt;
  if (b.y >= targetY) {
    b.y = targetY;
    b.girder = l.from;
    b.onLadder = null;
    b.dir = openEdgeDir(b.girder);
  }
}
