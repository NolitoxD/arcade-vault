import type { FxKind } from '../football-logic/mode';
import type { Rng } from '../football-logic/rng';
import { VIEW_H, VIEW_W } from './camera';

// The two victory effects of the spec (confetti for a friendly, fireworks for the
// World Cup) on ONE pool of particles created once (criterion 20: "depósito de
// partículas creado una vez"), the pattern of KongGame's barrel pool. Typed arrays,
// written in place; nothing here allocates after createParticlePool.
//
// The fourth stream of the game (Global Constraints): the effects draw from
// createRng(fxSeedFor(runSeed)) -- never from the match rng (that would change the
// simulation, criterion 1), never from the CPU's, never from the ambience's.
export const PARTICLE_COUNT = 240;
export const FX_SEED_SALT = 0x7f4a7c15;

export function fxSeedFor(seed: number): number {
  return (seed ^ FX_SEED_SALT) >>> 0;
}

// The burst directions, precomputed ONCE at module load: the only Math.cos / Math.sin
// of the screen layer, and they never run per frame. (The engine bans trigonometry in
// its physics for determinism -- risk 3; these are constants, identical on every JS
// engine for the same index, and the physics never see them.)
export const FX_DIR_COUNT = 32;

function buildDirs(fn: (angle: number) => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < FX_DIR_COUNT; i++) out.push(fn((i / FX_DIR_COUNT) * Math.PI * 2));
  return out;
}

export const FX_DIR_X: readonly number[] = buildDirs(Math.cos);
export const FX_DIR_Y: readonly number[] = buildDirs(Math.sin);

export const FX_COLORS: readonly string[] = ['#ffcf3a', '#ff4d6d', '#6fe3ff', '#7cff6f', '#ffffff', '#ff9f1c'];

// Confetti: everything falls, sways a little, wraps at the bottom. Pixels per step.
const CONFETTI_FALL_MIN = 1.2;
const CONFETTI_FALL_MAX = 2.6;
const CONFETTI_SWAY = 0.6;
const CONFETTI_RESPAWN_Y = -4;

// Fireworks: a burst of FIREWORK_BURST_SIZE every FIREWORK_BURST_STEPS from a random
// point in the upper two thirds; each spark flies out on one of the 32 directions,
// falls under gravity and dies after 40-70 steps.
export const FIREWORK_BURST_STEPS = 45;
export const FIREWORK_BURST_SIZE = 40;
const FIREWORK_SPEED_MIN = 2;
const FIREWORK_SPEED_MAX = 5;
const FIREWORK_GRAVITY = 0.06;
const FIREWORK_LIFE_MIN = 40;
const FIREWORK_LIFE_MAX = 70;
// Confetti particles never die on their own: a life this long outlasts any screen.
// `life` is an Int16Array (ceiling 32 767): this constant must stay under it.
const CONFETTI_LIFE = 30_000;
const INT16_MAX = 32_767;
if (CONFETTI_LIFE > INT16_MAX) throw new Error(`CONFETTI_LIFE ${CONFETTI_LIFE} overflows Int16Array (max ${INT16_MAX})`);

export type ParticlePool = {
  count: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  life: Int16Array;     // steps left; 0 = inactive
  color: Uint8Array;    // index into FX_COLORS
  size: Uint8Array;     // side of the square, in px
  burstIn: number;      // fireworks: steps until the next burst
};

export function createParticlePool(count = PARTICLE_COUNT): ParticlePool {
  return {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    life: new Int16Array(count),
    color: new Uint8Array(count),
    size: new Uint8Array(count),
    burstIn: 0,
  };
}

export function activeCount(pool: ParticlePool): number {
  let n = 0;
  for (let i = 0; i < pool.count; i++) if (pool.life[i] > 0) n++;
  return n;
}

// Called once when the victory screen opens.
export function startFx(pool: ParticlePool, kind: FxKind, rng: Rng): void {
  if (kind === 'confetti') {
    for (let i = 0; i < pool.count; i++) {
      pool.x[i] = rng() * VIEW_W;
      pool.y[i] = rng() * VIEW_H;
      pool.vx[i] = (rng() - 0.5) * 2 * CONFETTI_SWAY;
      pool.vy[i] = CONFETTI_FALL_MIN + rng() * (CONFETTI_FALL_MAX - CONFETTI_FALL_MIN);
      pool.life[i] = CONFETTI_LIFE;
      pool.color[i] = Math.floor(rng() * FX_COLORS.length);
      pool.size[i] = 2 + Math.floor(rng() * 3);
    }
    pool.burstIn = 0;
    return;
  }
  for (let i = 0; i < pool.count; i++) pool.life[i] = 0;
  pool.burstIn = 1;
}

function burst(pool: ParticlePool, rng: Rng): void {
  const cx = VIEW_W * 0.15 + rng() * VIEW_W * 0.7;
  const cy = VIEW_H * 0.15 + rng() * VIEW_H * 0.5;
  const color = Math.floor(rng() * FX_COLORS.length);
  let spawned = 0;
  for (let i = 0; i < pool.count && spawned < FIREWORK_BURST_SIZE; i++) {
    if (pool.life[i] > 0) continue;
    const dir = Math.floor(rng() * FX_DIR_COUNT);
    const speed = FIREWORK_SPEED_MIN + rng() * (FIREWORK_SPEED_MAX - FIREWORK_SPEED_MIN);
    pool.x[i] = cx;
    pool.y[i] = cy;
    pool.vx[i] = FX_DIR_X[dir] * speed;
    pool.vy[i] = FX_DIR_Y[dir] * speed;
    pool.life[i] = FIREWORK_LIFE_MIN + Math.floor(rng() * (FIREWORK_LIFE_MAX - FIREWORK_LIFE_MIN));
    pool.color[i] = color;
    pool.size[i] = 2 + Math.floor(rng() * 2);
    spawned++;
  }
}

// One fixed step of the effect. Writes in place; the confetti's rng draws only on a
// wrap, the fireworks' only on a burst.
export function stepFx(pool: ParticlePool, kind: FxKind, rng: Rng): void {
  if (kind === 'confetti') {
    for (let i = 0; i < pool.count; i++) {
      pool.x[i] += pool.vx[i];
      pool.y[i] += pool.vy[i];
      if (pool.y[i] > VIEW_H) {
        pool.y[i] = CONFETTI_RESPAWN_Y;
        pool.x[i] = rng() * VIEW_W;
      }
      if (pool.x[i] < 0) pool.x[i] += VIEW_W;
      else if (pool.x[i] > VIEW_W) pool.x[i] -= VIEW_W;
    }
    return;
  }
  pool.burstIn--;
  if (pool.burstIn <= 0) {
    pool.burstIn = FIREWORK_BURST_STEPS;
    burst(pool, rng);
  }
  for (let i = 0; i < pool.count; i++) {
    if (pool.life[i] === 0) continue;
    pool.vy[i] += FIREWORK_GRAVITY;
    pool.x[i] += pool.vx[i];
    pool.y[i] += pool.vy[i];
    pool.life[i]--;
  }
}
