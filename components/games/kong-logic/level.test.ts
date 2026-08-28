import { describe, expect, it } from 'vitest';
import {
  CANVAS_W, CANVAS_H, GIRDERS, LADDERS, girderYAt, ladderAt,
  LEVEL_CONFIG, configFor, brokenLadderSet, HAMMERS, TROPHY, KONG, PLAYER_SPAWN,
  LAYOUTS, layoutFor, TROPHY_REACH_X, TROPHY_REACH_ABOVE, TROPHY_REACH_BELOW,
} from './level';

describe('screen geometry', () => {
  it('has 6 girders stacked bottom-to-top with alternating slope', () => {
    expect(GIRDERS).toHaveLength(6);
    for (let i = 1; i < GIRDERS.length; i++) {
      expect(Math.min(GIRDERS[i].y0, GIRDERS[i].y1)).toBeLessThan(Math.min(GIRDERS[i - 1].y0, GIRDERS[i - 1].y1));
    }
    const slopes = GIRDERS.map((g) => Math.sign(g.y1 - g.y0));
    for (let i = 1; i < slopes.length; i++) expect(slopes[i]).toBe(-slopes[i - 1]);
    for (const g of GIRDERS) {
      expect(g.x0).toBeGreaterThanOrEqual(0);
      expect(g.x1).toBeLessThanOrEqual(CANVAS_W);
      expect(Math.max(g.y0, g.y1)).toBeLessThan(CANVAS_H);
    }
  });
  it('interpolates height along a slope and clamps at the ends', () => {
    const g = GIRDERS[0];
    const mid = girderYAt(g, (g.x0 + g.x1) / 2);
    expect(mid).toBeCloseTo((g.y0 + g.y1) / 2, 1);
    expect(girderYAt(g, g.x0 - 100)).toBeCloseTo(g.y0, 5);
    expect(girderYAt(g, g.x1 + 100)).toBeCloseTo(g.y1, 5);
  });
  it('places ladders between consecutive floors, at least two per floor', () => {
    expect(LADDERS.length).toBeGreaterThanOrEqual(10);
    for (const l of LADDERS) {
      expect(l.to).toBe(l.from + 1);
      expect(l.x).toBeGreaterThan(0);
      expect(l.x).toBeLessThan(CANVAS_W);
    }
    for (let f = 0; f < GIRDERS.length - 1; f++) {
      expect(LADDERS.filter((l) => l.from === f).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('finds a ladder near an x on a given floor only', () => {
    const l = LADDERS[0];
    expect(ladderAt(l.x + 3, l.from)).toBe(l);
    expect(ladderAt(l.x + 40, l.from)).toBeNull();
    expect(ladderAt(l.x, l.from + 1)).not.toBe(l);
  });
  it('puts the trophy at the top, the hammers on real floors and the spawn at the bottom', () => {
    expect(TROPHY.y).toBeLessThan(GIRDERS[GIRDERS.length - 1].y0 + 40);
    expect(HAMMERS).toHaveLength(2);
    for (const h of HAMMERS) expect(h.girder).toBeLessThan(GIRDERS.length);
    expect(PLAYER_SPAWN.girder).toBe(0);
  });
});

describe('level config', () => {
  it('has 10 rows with the spec endpoints and clamps', () => {
    expect(LEVEL_CONFIG).toHaveLength(10);
    expect(LEVEL_CONFIG[0]).toEqual([2600, 110, 0.2, 0]);
    expect(LEVEL_CONFIG[9]).toEqual([1100, 220, 0.55, 3]);
    expect(configFor(1)).toEqual(LEVEL_CONFIG[0]);
    expect(configFor(37)).toEqual(LEVEL_CONFIG[9]);
  });
  it('gets harder monotonically', () => {
    for (let i = 1; i < LEVEL_CONFIG.length; i++) {
      expect(LEVEL_CONFIG[i][0]).toBeLessThan(LEVEL_CONFIG[i - 1][0]);
      expect(LEVEL_CONFIG[i][1]).toBeGreaterThan(LEVEL_CONFIG[i - 1][1]);
      expect(LEVEL_CONFIG[i][2]).toBeGreaterThan(LEVEL_CONFIG[i - 1][2]);
    }
  });
  it('breaks the configured number of ladders, deterministically and never all of a floor', () => {
    expect(brokenLadderSet(1).size).toBe(0);
    expect(brokenLadderSet(10).size).toBe(3);
    expect([...brokenLadderSet(10)]).toEqual([...brokenLadderSet(10)]);
    for (let f = 0; f < GIRDERS.length - 1; f++) {
      const onFloor = LADDERS.map((l, i) => ({ l, i })).filter((e) => e.l.from === f);
      const broken = onFloor.filter((e) => brokenLadderSet(10).has(e.i));
      expect(broken.length).toBeLessThan(onFloor.length);
    }
  });
});

describe('layouts', () => {
  it('exposes five layouts and clamps out-of-range levels', () => {
    expect(LAYOUTS).toHaveLength(5);
    expect(layoutFor(1)).toBe(LAYOUTS[0]);
    expect(layoutFor(5)).toBe(LAYOUTS[4]);
    expect(layoutFor(0)).toBe(LAYOUTS[0]); // clamp inferior
    expect(layoutFor(99)).toBe(LAYOUTS[4]); // clamp superior
  });

  it('keeps layout 1 identical to the shipped geometry', () => {
    expect(layoutFor(1).girders).toEqual(GIRDERS);
    expect(layoutFor(1).ladders).toEqual(LADDERS);
    expect(layoutFor(1).trophy).toEqual(TROPHY);
    expect(layoutFor(1).kong).toEqual({ x: KONG.x, girder: 4 });
    expect(layoutFor(1).hammers).toEqual(HAMMERS);
    expect(layoutFor(1).playerSpawn).toEqual(PLAYER_SPAWN);
  });
});

describe('trophy reach', () => {
  it('keeps the exact collision box moved from KongGame.tsx', () => {
    expect(TROPHY_REACH_X).toBe(22);
    expect(TROPHY_REACH_ABOVE).toBe(-34);
    expect(TROPHY_REACH_BELOW).toBe(60);
  });
});
