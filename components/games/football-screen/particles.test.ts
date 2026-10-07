import { describe, expect, it } from 'vitest';
import { createRng } from '../football-logic/rng';
import { VIEW_H, VIEW_W } from './camera';
import {
  CONFETTI_COUNT, CUP_FLASH_PERIOD, FIREWORK_BURST_SIZE, FIREWORK_BURST_STEPS, FIREWORK_LIFE_MAX, FIREWORK_POOL_COUNT,
  FX_COLORS, FX_DIR_COUNT, FX_DIR_X, FX_DIR_Y, FX_GOLD, FX_GOLD_LIGHT, FX_SEED_SALT, PARTICLE_COUNT,
  activeCount, createParticlePool, cupFlashAlpha, fxSeedFor, startConfettiRain, startFx, stepFx, writeConfettiPalette,
} from './particles';

describe('the pool', () => {
  it('is created once with typed arrays of the requested size, all inactive', () => {
    const pool = createParticlePool(10);
    expect(pool.count).toBe(10);
    expect(pool.x.length).toBe(10);
    expect(pool.life.length).toBe(10);
    expect(activeCount(pool)).toBe(0);
    expect(createParticlePool().count).toBe(PARTICLE_COUNT);
  });

  it('the fourth stream: fxSeedFor is deterministic, unsigned, and not the seed itself', () => {
    expect(fxSeedFor(12345)).toBe(fxSeedFor(12345));
    expect(fxSeedFor(12345)).not.toBe(12345);
    expect(fxSeedFor(12345)).toBeGreaterThanOrEqual(0);
    expect(fxSeedFor(-1)).toBeGreaterThanOrEqual(0);
    expect(FX_SEED_SALT).not.toBe(0);
  });

  it('the burst directions are 32 unit vectors precomputed once, starting at (1, 0)', () => {
    expect(FX_DIR_COUNT).toBe(32);
    expect(FX_DIR_X.length).toBe(32);
    for (let i = 0; i < FX_DIR_COUNT; i++) {
      expect(FX_DIR_X[i] * FX_DIR_X[i] + FX_DIR_Y[i] * FX_DIR_Y[i]).toBeCloseTo(1, 9);
    }
    expect(FX_DIR_X[0]).toBeCloseTo(1, 9);
    expect(FX_DIR_Y[0]).toBeCloseTo(0, 9);
    expect(FX_COLORS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('confetti', () => {
  it('starts with every particle active inside the view and keeps them inside for a thousand steps, wrapping at the bottom', () => {
    const pool = createParticlePool(60);
    const rng = createRng(fxSeedFor(1));
    startFx(pool, 'confetti', rng);
    expect(activeCount(pool)).toBe(60);
    for (let i = 0; i < 60; i++) {
      expect(pool.x[i]).toBeGreaterThanOrEqual(0);
      expect(pool.x[i]).toBeLessThanOrEqual(VIEW_W);
      expect(pool.y[i]).toBeGreaterThanOrEqual(-4);
      expect(pool.y[i]).toBeLessThanOrEqual(VIEW_H);
      expect(pool.vy[i]).toBeGreaterThan(0);
    }
    let wrapped = 0;
    for (let step = 0; step < 1000; step++) {
      const before = pool.y[0];
      stepFx(pool, 'confetti', rng);
      if (pool.y[0] < before) wrapped++;
      for (let i = 0; i < 60; i++) {
        expect(pool.x[i]).toBeGreaterThanOrEqual(0);
        expect(pool.x[i]).toBeLessThanOrEqual(VIEW_W);
        expect(pool.y[i]).toBeLessThanOrEqual(VIEW_H + 4);
      }
    }
    // At >= 1.2 px per step, particle 0 fell the whole 500 px view at least twice.
    expect(wrapped).toBeGreaterThanOrEqual(2);
    expect(activeCount(pool)).toBe(60);
  });
});

describe('fireworks', () => {
  it('starts empty, bursts FIREWORK_BURST_SIZE particles from one point on the first step, and bursts again FIREWORK_BURST_STEPS later', () => {
    const pool = createParticlePool();
    const rng = createRng(fxSeedFor(2));
    startFx(pool, 'fireworks', rng);
    expect(activeCount(pool)).toBe(0);
    stepFx(pool, 'fireworks', rng);
    expect(activeCount(pool)).toBe(FIREWORK_BURST_SIZE);
    // One origin: after one step of flight the spread is at most one step of speed.
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < pool.count; i++) {
      if (pool.life[i] === 0) continue;
      if (pool.x[i] < minX) minX = pool.x[i];
      if (pool.x[i] > maxX) maxX = pool.x[i];
    }
    expect(maxX - minX).toBeLessThan(12);
    for (let i = 1; i < FIREWORK_BURST_STEPS; i++) stepFx(pool, 'fireworks', rng);
    expect(activeCount(pool)).toBeLessThanOrEqual(FIREWORK_BURST_SIZE);
    stepFx(pool, 'fireworks', rng);
    expect(activeCount(pool)).toBeGreaterThan(FIREWORK_BURST_SIZE / 2);
  });

  it('particles fall under gravity and die: over 600 steps the count never exceeds the pool and some die', () => {
    const pool = createParticlePool();
    const rng = createRng(fxSeedFor(3));
    startFx(pool, 'fireworks', rng);
    let peak = 0;
    let died = false;
    for (let step = 0; step < 600; step++) {
      const before = activeCount(pool);
      stepFx(pool, 'fireworks', rng);
      const now = activeCount(pool);
      if (now > peak) peak = now;
      if (now < before) died = true;
      expect(now).toBeLessThanOrEqual(pool.count);
    }
    expect(peak).toBeGreaterThan(FIREWORK_BURST_SIZE);
    expect(died).toBe(true);
    // Gravity: a live particle's vy grows step over step.
    let live = -1;
    for (let i = 0; i < pool.count; i++) if (pool.life[i] > 1) { live = i; break; }
    expect(live).toBeGreaterThanOrEqual(0);
    const vyBefore = pool.vy[live];
    stepFx(pool, 'fireworks', rng);
    expect(pool.vy[live]).toBeGreaterThan(vyBefore);
  });

  it('is deterministic: the same effect seed gives the same positions; a different one does not', () => {
    const a = createParticlePool();
    const b = createParticlePool();
    const c = createParticlePool();
    const ra = createRng(fxSeedFor(9));
    const rb = createRng(fxSeedFor(9));
    const rc = createRng(fxSeedFor(10));
    startFx(a, 'fireworks', ra);
    startFx(b, 'fireworks', rb);
    startFx(c, 'fireworks', rc);
    for (let step = 0; step < 300; step++) {
      stepFx(a, 'fireworks', ra);
      stepFx(b, 'fireworks', rb);
      stepFx(c, 'fireworks', rc);
    }
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect(Array.from(a.life)).toEqual(Array.from(b.life));
    expect(Array.from(a.x)).not.toEqual(Array.from(c.x));
  });

  it('stepFx never replaces the pool arrays (the zero-allocation contract, as far as a test can see it)', () => {
    const pool = createParticlePool();
    const rng = createRng(1);
    const { x, y, vx, vy, life, color, size } = pool;
    startFx(pool, 'fireworks', rng);
    for (let i = 0; i < 200; i++) stepFx(pool, 'fireworks', rng);
    startFx(pool, 'confetti', rng);
    for (let i = 0; i < 200; i++) stepFx(pool, 'confetti', rng);
    expect(pool.x).toBe(x);
    expect(pool.y).toBe(y);
    expect(pool.vx).toBe(vx);
    expect(pool.vy).toBe(vy);
    expect(pool.life).toBe(life);
    expect(pool.color).toBe(color);
    expect(pool.size).toBe(size);
  });
});

// ── G15-21: the victory, denser, in the winner's kit and in gold ─────────────────
describe('the victory celebration (G15-21)', () => {
  it('every pool carries its own palette (v1\'s colours by default), rewritten in place for the kit or for gold + kit', () => {
    const pool = createParticlePool(8);
    expect(pool.palette).toEqual([...FX_COLORS]);
    expect(pool.palette).not.toBe(FX_COLORS);
    const palette = pool.palette;
    writeConfettiPalette(pool, 'kit', '#d40000', '#ffcc00');
    expect(pool.palette).toBe(palette);
    expect(pool.palette.length).toBe(FX_COLORS.length);
    expect(new Set(pool.palette)).toEqual(new Set(['#d40000', '#ffcc00', '#ffffff']));
    expect(pool.palette.filter((c) => c === '#d40000' || c === '#ffcc00').length).toBeGreaterThanOrEqual(4);
    writeConfettiPalette(pool, 'gold-kit', '#d40000', '#ffcc00');
    expect(pool.palette).toContain('#d40000');
    expect(pool.palette).toContain('#ffcc00');
    expect(pool.palette.filter((c) => c === FX_GOLD || c === FX_GOLD_LIGHT).length).toBeGreaterThanOrEqual(3);
    startFx(pool, 'confetti', createRng(5));
    for (let i = 0; i < pool.count; i++) expect(pool.color[i]).toBeLessThan(pool.palette.length);
  });

  it('startConfettiRain starts every particle ABOVE the view, and two seconds later it is raining on the pitch', () => {
    const pool = createParticlePool(CONFETTI_COUNT);
    const rng = createRng(fxSeedFor(4));
    startConfettiRain(pool, rng);
    expect(activeCount(pool)).toBe(CONFETTI_COUNT);
    for (let i = 0; i < pool.count; i++) {
      expect(pool.y[i]).toBeLessThan(0);
      expect(pool.y[i]).toBeGreaterThanOrEqual(-VIEW_H);
      expect(pool.x[i]).toBeGreaterThanOrEqual(0);
      expect(pool.x[i]).toBeLessThanOrEqual(VIEW_W);
      expect(pool.vy[i]).toBeGreaterThan(0);
    }
    for (let step = 0; step < 120; step++) stepFx(pool, 'confetti', rng);
    let inView = 0;
    for (let i = 0; i < pool.count; i++) if (pool.y[i] >= 0) inView++;
    expect(inView).toBeGreaterThan(0);
    expect(inView).toBeLessThan(CONFETTI_COUNT);
  });

  it('is denser than v1: more confetti, a bigger fireworks pool, bigger and more frequent bursts that still all fit', () => {
    expect(CONFETTI_COUNT).toBeGreaterThan(PARTICLE_COUNT);
    expect(FIREWORK_POOL_COUNT).toBeGreaterThan(PARTICLE_COUNT);
    expect(FIREWORK_BURST_SIZE / FIREWORK_BURST_STEPS).toBeGreaterThan(40 / 45);   // v1: 40 every 45 steps
    // Every spark of every burst still alive fits: the pool never refuses a burst.
    expect(Math.ceil(FIREWORK_LIFE_MAX / FIREWORK_BURST_STEPS) * FIREWORK_BURST_SIZE).toBeLessThanOrEqual(PARTICLE_COUNT);
    expect(FIREWORK_POOL_COUNT).toBeGreaterThanOrEqual(PARTICLE_COUNT);
  });

  it('cupFlashAlpha: a gold glint that is 0 when each period starts, 1 halfway, and never leaves [0, 1]', () => {
    expect(cupFlashAlpha(0)).toBe(0);
    expect(cupFlashAlpha(CUP_FLASH_PERIOD / 2)).toBe(1);
    expect(cupFlashAlpha(CUP_FLASH_PERIOD)).toBe(0);
    expect(cupFlashAlpha(CUP_FLASH_PERIOD * 7 + CUP_FLASH_PERIOD / 2)).toBe(1);
    for (let s = 0; s < CUP_FLASH_PERIOD * 3; s++) {
      const a = cupFlashAlpha(s);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});
