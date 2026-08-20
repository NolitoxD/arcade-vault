import { describe, expect, it } from 'vitest';
import {
  WAVE_CONFIG, waveFor, createFormation, pointsFor,
  stepInterval, formationBounds, shooterCells,
} from './formation';

describe('waves', () => {
  it('has 10 rows with spec endpoints', () => {
    expect(WAVE_CONFIG).toHaveLength(10);
    expect(WAVE_CONFIG[0]).toEqual([800, 2000, 1, 0]);
    expect(WAVE_CONFIG[9]).toEqual([150, 400, 3, 130]);
  });
  it('clamps beyond level 10', () => {
    expect(waveFor(10)).toEqual(WAVE_CONFIG[9]);
    expect(waveFor(37)).toEqual(WAVE_CONFIG[9]);
    expect(waveFor(1)).toEqual(WAVE_CONFIG[0]);
  });
});

describe('formation', () => {
  it('creates 55 invaders with classic type layout', () => {
    const f = createFormation();
    expect(f).toHaveLength(55);
    expect(f.filter((i) => i.type === 2)).toHaveLength(11); // octopus row 0
    expect(f.filter((i) => i.type === 1)).toHaveLength(11); // squid row 1
    expect(f.filter((i) => i.type === 0)).toHaveLength(33); // crabs rows 2-4
    expect(f.every((i) => i.alive)).toBe(true);
  });
  it('scores 10/20/30 by type', () => {
    expect(pointsFor(0)).toBe(10);
    expect(pointsFor(1)).toBe(20);
    expect(pointsFor(2)).toBe(30);
  });
  it('accelerates 15ms per kill with a 50ms floor', () => {
    expect(stepInterval(1, 55)).toBe(800);
    expect(stepInterval(1, 54)).toBe(785);
    expect(stepInterval(1, 1)).toBe(50); // 800 - 54*15 = -10 → floor
  });
  it('bounds shrink when edge columns die and null when empty', () => {
    const f = createFormation();
    const full = formationBounds(f, 0, 0)!;
    for (const i of f) if (i.col === 0) i.alive = false;
    const trimmed = formationBounds(f, 0, 0)!;
    expect(trimmed.left).toBeGreaterThan(full.left);
    for (const i of f) i.alive = false;
    expect(formationBounds(f, 0, 0)).toBeNull();
  });
  it('shooters are the lowest alive invader per column', () => {
    const f = createFormation();
    let shooters = shooterCells(f);
    expect(shooters).toHaveLength(11);
    expect(shooters.every((i) => i.row === 4)).toBe(true);
    for (const i of f) if (i.col === 3 && i.row === 4) i.alive = false;
    shooters = shooterCells(f);
    expect(shooters.find((i) => i.col === 3)!.row).toBe(3);
  });
});
