export type Vec2 = { x: number; y: number };

export const INV_SQRT2 = 1 / Math.sqrt(2);

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Writes the unit vector of (x, y) into `out`. Returns false (and leaves `out`
// untouched) for the zero vector, so callers keep their previous facing.
export function normalizeInto(out: Vec2, x: number, y: number): boolean {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return false;
  out.x = x / len;
  out.y = y / len;
  return true;
}

export function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
