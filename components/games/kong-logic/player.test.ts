import { describe, expect, it } from 'vitest';
import { CANVAS_W, GIRDERS, LADDERS, girderYAt } from './level';
import { RUN_SPEED, GRAVITY, JUMP_VY, stepPlayer } from './player';

const idle = { left: false, right: false, up: false, down: false, jump: false };
const fresh = () => ({
  x: GIRDERS[0].x0 + 60, y: girderYAt(GIRDERS[0], GIRDERS[0].x0 + 60), vy: 0,
  girder: 0, state: 'run' as const, facing: 1 as const, hammerMs: 0, climbing: null, fellFrom: 0,
});

describe('running', () => {
  it('moves and stays snapped to the slope', () => {
    const p = fresh();
    stepPlayer(p, { ...idle, right: true }, 100, new Set());
    expect(p.x).toBeCloseTo(GIRDERS[0].x0 + 60 + RUN_SPEED * 0.1, 1);
    expect(p.y).toBeCloseTo(girderYAt(GIRDERS[0], p.x), 1);
    expect(p.facing).toBe(1);
  });
});

describe('jumping', () => {
  it('leaves the ground, comes back down and lands snapped', () => {
    const p = fresh();
    stepPlayer(p, { ...idle, jump: true }, 16, new Set());
    expect(p.state).toBe('jump');
    expect(p.vy).toBeLessThan(0);
    for (let i = 0; i < 200 && p.state === 'jump'; i++) stepPlayer(p, idle, 16, new Set());
    expect(p.state).toBe('run');
    expect(p.y).toBeCloseTo(girderYAt(GIRDERS[0], p.x), 1);
  });
  it('cannot jump while holding the hammer', () => {
    const p = { ...fresh(), state: 'hammer' as const, hammerMs: 5000 };
    stepPlayer(p, { ...idle, jump: true }, 16, new Set());
    expect(p.state).toBe('hammer');
  });
  it('never soft-locks in jump when leaping past the world edge', () => {
    const p = { ...fresh(), x: GIRDERS[0].x0 + 10 };
    p.y = girderYAt(GIRDERS[0], p.x);
    stepPlayer(p, { ...idle, jump: true, left: true }, 16, new Set());
    for (let i = 0; i < 200 && p.state === 'jump'; i++) {
      stepPlayer(p, { ...idle, left: true }, 16, new Set());
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(CANVAS_W);
    }
    expect(['run', 'dead']).toContain(p.state);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(CANVAS_W);
  });
  it('gravity pulls down', () => {
    const p = fresh();
    stepPlayer(p, { ...idle, jump: true }, 16, new Set());
    const vy0 = p.vy;
    stepPlayer(p, idle, 16, new Set());
    expect(p.vy).toBeCloseTo(vy0 + GRAVITY * 0.016, 1);
    expect(JUMP_VY).toBeLessThan(0);
  });
});

describe('ladders', () => {
  const firstLadder = LADDERS.find((l) => l.from === 0)!;
  const atLadder = () => ({
    ...fresh(), x: firstLadder.x, y: girderYAt(GIRDERS[0], firstLadder.x),
  });
  it('climbs up when aligned and reaches the upper girder', () => {
    const p = atLadder();
    stepPlayer(p, { ...idle, up: true }, 16, new Set());
    expect(p.state).toBe('climb');
    for (let i = 0; i < 400 && p.state === 'climb'; i++) stepPlayer(p, { ...idle, up: true }, 16, new Set());
    expect(p.girder).toBe(1);
    expect(p.state).toBe('run');
  });
  it('refuses to go down a broken ladder but still climbs it up', () => {
    const idx = LADDERS.indexOf(firstLadder);
    const broken = new Set([idx]);
    const top = { ...atLadder(), girder: 1, y: girderYAt(GIRDERS[1], firstLadder.x) };
    stepPlayer(top, { ...idle, down: true }, 16, broken);
    expect(top.state).toBe('run');
    const bottom = atLadder();
    stepPlayer(bottom, { ...idle, up: true }, 16, broken);
    expect(bottom.state).toBe('climb');
  });
  it('cannot climb with the hammer', () => {
    const p = { ...atLadder(), state: 'hammer' as const, hammerMs: 4000 };
    stepPlayer(p, { ...idle, up: true }, 16, new Set());
    expect(p.state).toBe('hammer');
  });
});

describe('hammer timer', () => {
  it('expires back to run', () => {
    const p = { ...fresh(), state: 'hammer' as const, hammerMs: 30 };
    stepPlayer(p, idle, 16, new Set());
    expect(p.state).toBe('hammer');
    stepPlayer(p, idle, 16, new Set());
    expect(p.state).toBe('run');
    expect(p.hammerMs).toBe(0);
  });
});
