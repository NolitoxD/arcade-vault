import { centerY, type PitchDef } from '../football-logic/pitch';

// G15-14 (Paco, v1.5 grill): the net ripples with a goal -- golden goal and shootout
// included -- and never with a post or the crossbar. A damped wave runs out from the point
// of impact for ~1 s, inside the 4 s goal pause. Screen only: the component starts it on
// goalScoredThisStep (captions.ts), steps it once per simulated step and asks this module
// where each vertex of the mesh is drawn. Nothing here allocates after the module loads:
// the sine table is built once, the state and the vertex are created once by the caller.

export const RIPPLE_STEPS = 60;           // ~1 s at 60 steps/s
export const RIPPLE_AMPLITUDE = 6;        // world units, the most a point of the mesh moves
export const RIPPLE_SPEED = 3;            // world units per step the front travels
export const RIPPLE_WAVELENGTH = 24;      // world units
export const RIPPLE_FALLOFF = 60;         // world units: the swing halves at this distance
// The mesh drawn as polylines while it ripples: the 30-unit depth in 6 segments, the
// 150-unit mouth in 30 -- 5 units a segment.
export const RIPPLE_SEGMENTS_DEEP = 6;
export const RIPPLE_SEGMENTS_ACROSS = 30;
export const RIPPLE_TABLE_SIZE = 64;

function buildWave(): Float32Array {
  const out = new Float32Array(RIPPLE_TABLE_SIZE);
  for (let i = 0; i < RIPPLE_TABLE_SIZE; i++) out[i] = Math.sin((i / RIPPLE_TABLE_SIZE) * Math.PI * 2);
  return out;
}

// One sine period, sampled once at load: no trigonometry per frame (particles.ts's rule).
export const RIPPLE_WAVE: Float32Array = buildWave();

export type NetRipple = {
  active: boolean;
  side: 0 | 1;   // 0 = the goal at x = 0, 1 = the goal at x = pitch.width (drawPitch's loop)
  x: number;     // the point of impact: on the goal line...
  y: number;     // ...between the posts
  step: number;
};

export type RippleVertex = { x: number; y: number };

export function createNetRipple(): NetRipple {
  return { active: false, side: 0, x: 0, y: 0, step: 0 };
}

export function createRippleVertex(): RippleVertex {
  return { x: 0, y: 0 };
}

export function resetNetRipple(r: NetRipple): void {
  r.active = false;
  r.step = 0;
}

// ballX/ballY: the ball ONE step before the goal (VaultWorldCupGame's preStep) -- after the
// step the shootout has already moved it to the next spot.
export function beginNetRipple(r: NetRipple, pitch: PitchDef, ballX: number, ballY: number): void {
  const half = pitch.goalWidth / 2;
  const mid = centerY(pitch);
  r.side = ballX < pitch.width / 2 ? 0 : 1;
  r.x = r.side === 0 ? 0 : pitch.width;
  r.y = ballY < mid - half ? mid - half : ballY > mid + half ? mid + half : ballY;
  r.step = 0;
  r.active = true;
}

export function stepNetRipple(r: NetRipple): void {
  if (!r.active) return;
  r.step++;
  if (r.step >= RIPPLE_STEPS) r.active = false;
}

// How far a point `distance` units from the impact is pushed, outwards (+) or back (-).
export function rippleOffset(r: NetRipple, distance: number): number {
  if (!r.active) return 0;
  const front = r.step * RIPPLE_SPEED;
  if (distance > front) return 0;
  const phase = (front - distance) / RIPPLE_WAVELENGTH;
  const index = Math.floor(phase * RIPPLE_TABLE_SIZE) % RIPPLE_TABLE_SIZE;
  const time = 1 - r.step / RIPPLE_STEPS;
  return (RIPPLE_AMPLITUDE * time * time * RIPPLE_WAVE[index]) / (1 + distance / RIPPLE_FALLOFF);
}

// Where the mesh point (x, y) is drawn: pushed along the line from the impact. Writes `out`.
export function rippleVertex(r: NetRipple, x: number, y: number, out: RippleVertex): void {
  out.x = x;
  out.y = y;
  const dx = x - r.x;
  const dy = y - r.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return;
  const off = rippleOffset(r, d);
  out.x += (dx / d) * off;
  out.y += (dy / d) * off;
}
