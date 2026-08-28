import { describe, expect, it } from 'vitest';
import {
  CANVAS_W, CANVAS_H, girderYAt, ladderAt,
  LEVEL_CONFIG, configFor, brokenLadderSet,
  LAYOUTS, layoutFor, TROPHY_REACH_X, TROPHY_REACH_ABOVE, TROPHY_REACH_BELOW,
  kongFootY, kongLedgePlatform, KONG_LEDGE_HALF_W,
} from './level';
import { checkLayout } from './level-invariants';

const layout1 = layoutFor(1);
const GIRDERS = layout1.girders;
const LADDERS = layout1.ladders;
const TROPHY = layout1.trophy;
const HAMMERS = layout1.hammers;
const PLAYER_SPAWN = layout1.playerSpawn;

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
    expect(ladderAt(layout1, l.x + 3, l.from)).toBe(l);
    expect(ladderAt(layout1, l.x + 40, l.from)).toBeNull();
    expect(ladderAt(layout1, l.x, l.from + 1)).not.toBe(l);
  });
  it('puts the trophy at the top, the hammers on real floors and the spawn at the bottom', () => {
    expect(TROPHY.y).toBeLessThan(GIRDERS[GIRDERS.length - 1].y0 + 40);
    expect(HAMMERS).toHaveLength(2);
    for (const h of HAMMERS) expect(h.girder).toBeLessThan(GIRDERS.length);
    expect(PLAYER_SPAWN.girder).toBe(0);
  });
});

describe('level config', () => {
  it('has one difficulty row per map, with the spec endpoints and clamps', () => {
    expect(LEVEL_CONFIG).toHaveLength(5);
    expect(LEVEL_CONFIG[0]).toEqual([2600, 110, 0.2, 0]);
    expect(LEVEL_CONFIG[4]).toEqual([1250, 208, 0.52, 3]);
    expect(configFor(1)).toEqual(LEVEL_CONFIG[0]);
    expect(configFor(6)).toBe(LEVEL_CONFIG[4]); // clamp
  });
  it('gets harder monotonically', () => {
    for (let i = 1; i < LEVEL_CONFIG.length; i++) {
      expect(LEVEL_CONFIG[i][0]).toBeLessThan(LEVEL_CONFIG[i - 1][0]);
      expect(LEVEL_CONFIG[i][1]).toBeGreaterThan(LEVEL_CONFIG[i - 1][1]);
      expect(LEVEL_CONFIG[i][2]).toBeGreaterThan(LEVEL_CONFIG[i - 1][2]);
    }
  });
  it('breaks the configured number of ladders, deterministically and never all of a floor', () => {
    expect(brokenLadderSet(layout1, 1).size).toBe(0);
    expect(brokenLadderSet(layout1, 5).size).toBe(3);
    expect([...brokenLadderSet(layout1, 5)]).toEqual([...brokenLadderSet(layout1, 5)]);
    for (let f = 0; f < GIRDERS.length - 1; f++) {
      const onFloor = LADDERS.map((l, i) => ({ l, i })).filter((e) => e.l.from === f);
      const broken = onFloor.filter((e) => brokenLadderSet(layout1, 5).has(e.i));
      expect(broken.length).toBeLessThan(onFloor.length);
    }
  });
  it('spreads breaks across floors instead of piling onto one, while other floors have none', () => {
    const floorsWithLadders = new Set(LADDERS.map((l) => l.from)).size;
    for (const level of [3, 4]) { // 2 and 3 breaks respectively in the shipped table
      const broken = brokenLadderSet(layout1, level);
      const perFloor = new Map<number, number>();
      for (const idx of broken) {
        const floor = LADDERS[idx].from;
        perFloor.set(floor, (perFloor.get(floor) ?? 0) + 1);
      }
      // Only floors that received a break count toward "floors touched so far".
      // As long as some floor still has zero breaks, no floor may have two.
      if (perFloor.size < floorsWithLadders) {
        expect(Math.max(...perFloor.values())).toBe(1);
      }
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

  it('pins layout 1 to its exact shipped geometry', () => {
    const l = layoutFor(1);
    expect(l.girders).toEqual([
      { index: 0, x0: 0, x1: 600, y0: 628, y1: 652 },
      { index: 1, x0: 0, x1: 560, y0: 558, y1: 534 },
      { index: 2, x0: 40, x1: 600, y0: 436, y1: 460 },
      { index: 3, x0: 0, x1: 560, y0: 362, y1: 338 },
      { index: 4, x0: 40, x1: 600, y0: 240, y1: 264 },
      { index: 5, x0: 0, x1: 560, y0: 166, y1: 142 },
    ]);
    expect(l.ladders).toEqual([
      { x: 140, from: 0, to: 1, broken: false },
      { x: 380, from: 0, to: 1, broken: false },
      { x: 520, from: 0, to: 1, broken: false },
      { x: 90, from: 1, to: 2, broken: false },
      { x: 300, from: 1, to: 2, broken: false },
      { x: 490, from: 1, to: 2, broken: false },
      { x: 180, from: 2, to: 3, broken: false },
      { x: 440, from: 2, to: 3, broken: false },
      { x: 100, from: 3, to: 4, broken: false },
      { x: 350, from: 3, to: 4, broken: false },
      { x: 520, from: 3, to: 4, broken: false },
      { x: 230, from: 4, to: 5, broken: false },
      { x: 480, from: 4, to: 5, broken: false },
    ]);
    expect(l.trophy).toEqual({ x: 300, y: 100 });
    expect(l.kong).toEqual({ x: 90, girder: 4 });
    expect(l.hammers).toEqual([
      { x: 460, girder: 2 },
      { x: 145, girder: 4 },
    ]);
    expect(l.playerSpawn).toEqual({ x: 520, girder: 0 });
  });
});

describe('kong platform', () => {
  it('stands on its own girder when no ledge is set', () => {
    const l = layoutFor(1);
    expect(kongFootY(l)).toBeCloseTo(girderYAt(l.girders[l.kong.girder], l.kong.x), 5);
    expect(kongLedgePlatform(l)).toBeNull();
  });

  it('stands above the top girder on a ledge, high above low', () => {
    const l = layoutFor(1);
    const topGirderY = girderYAt(l.girders[l.girders.length - 1], l.kong.x);
    const low = { ...l, kong: { ...l.kong, ledge: 0 as const } };
    const high = { ...l, kong: { ...l.kong, ledge: 1 as const } };
    expect(kongFootY(low)).toBeLessThan(topGirderY);
    expect(kongFootY(high)).toBeLessThan(kongFootY(low));
  });

  it('bakes a platform rect centered on kong.x when ledged', () => {
    const base = layoutFor(1);
    const l = { ...base, kong: { ...base.kong, ledge: 0 as const } };
    const rect = kongLedgePlatform(l);
    expect(rect).not.toBeNull();
    expect(rect!.y).toBe(kongFootY(l));
    expect(rect!.x0).toBe(l.kong.x - KONG_LEDGE_HALF_W);
    expect(rect!.x1).toBe(l.kong.x + KONG_LEDGE_HALF_W);
  });
});

describe('trophy reach', () => {
  it('keeps the exact collision box moved from KongGame.tsx', () => {
    expect(TROPHY_REACH_X).toBe(22);
    expect(TROPHY_REACH_ABOVE).toBe(-34);
    expect(TROPHY_REACH_BELOW).toBe(60);
  });
});

describe('layout invariants', () => {
  it('reports no problems for the four fully-drawn maps (2-5) at their own level', () => {
    LAYOUTS.slice(1).forEach((layout, i) => {
      const level = i + 2;
      expect({ map: level, problems: checkLayout(layout, level) })
        .toEqual({ map: level, problems: [] });
    });
  });

  // Map 1 predates the girders-too-far-apart invariant (added in Task 8's
  // review round 1) and does not pass it: girder 2 starts later (x0: 40)
  // than girder 1 ends (x1: 560), so at that shared edge the vertical gap
  // peaks at 120.3px — well past FALL_DEATH_PX (90) — and the same alternating
  // inset pattern repeats for every other floor pair too. This is real,
  // shipped geometry, not a bug this task introduces: moveOnGirder clamps
  // the player's x to their *current* girder's own x0..x1 while running, so
  // the only way to reach a girder's problem edge is to jump there on
  // purpose, and the map is already in production, played and approved by
  // the game's owner as-is. Per instruction, map 1 is left untouched — this
  // test documents the known exception instead of silently excluding it.
  it('flags map 1 for its known, pre-existing, walking-unreachable girder gaps', () => {
    expect(checkLayout(LAYOUTS[0], 1)).toEqual([
      'girders 0-1 too far apart',
      'girders 1-2 too far apart',
      'girders 2-3 too far apart',
      'girders 3-4 too far apart',
      'girders 4-5 too far apart',
    ]);
  });

  it('detects an unreachable trophy', () => {
    const broken = { ...LAYOUTS[0], trophy: { x: 300, y: -500 } };
    expect(checkLayout(broken, 1)).toContain('trophy unreachable');
  });

  it('detects a floor with no way up when it has no ladder at all', () => {
    // brokenLadderSet itself refuses to break a floor's last ladder, so the
    // only way checkLayout can see a floor stranded is if the layout never
    // gave it one in the first place — the mistake Task 8's 4 new maps could
    // make. Any level works here since floor 2 has zero ladders regardless
    // of how many the level config asks to break.
    const noLadder = {
      ...LAYOUTS[0],
      ladders: LAYOUTS[0].ladders.filter((l) => l.from !== 2),
    };
    expect(checkLayout(noLadder, 1)).toContain('floor 2 has no exit');
  });

  it('detects kong not standing on a real girder', () => {
    const broken = { ...LAYOUTS[0], kong: { x: 90, girder: 99 } };
    expect(checkLayout(broken, 1)).toContain('kong has no girder');
  });

  it('detects a hammer off its girder', () => {
    const broken = {
      ...LAYOUTS[0],
      hammers: [{ x: 9999, girder: 2 }, LAYOUTS[0].hammers[1]],
    };
    expect(checkLayout(broken, 1)).toContain('hammer 0 off girder');
  });

  it('detects an invalid spawn (off girder or inside trophy reach)', () => {
    const offGirder = { ...LAYOUTS[0], playerSpawn: { x: 9999, girder: 0 } };
    expect(checkLayout(offGirder, 1)).toContain('spawn invalid');

    const onTrophy = { ...LAYOUTS[0], playerSpawn: { x: TROPHY.x, girder: 5 } };
    expect(checkLayout(onTrophy, 1)).toContain('spawn invalid');
  });

  it('detects two adjacent girders separated by more than FALL_DEATH_PX', () => {
    // Start from a clean, currently-passing layout (map 2) and yank girder 1
    // far out of reach of girder 0 below it.
    const base = LAYOUTS[1];
    const tooFar = {
      ...base,
      girders: base.girders.map((g, i) => (i === 1 ? { ...g, y0: g.y0 - 200, y1: g.y1 - 200 } : g)),
    };
    expect(checkLayout(tooFar, 2)).toContain('girders 0-1 too far apart');
  });

  it('detects two adjacent girders separated by less than the jump apex', () => {
    // Same idea, opposite direction: collapse girder 1 onto girder 0's own
    // height so the "gap" between them is climbable by jumping in place.
    const base = LAYOUTS[1];
    const tooClose = {
      ...base,
      girders: base.girders.map((g, i) => (i === 1 ? { ...g, y0: base.girders[0].y0, y1: base.girders[0].y1 } : g)),
    };
    expect(checkLayout(tooClose, 2)).toContain('girders 0-1 too close');
  });
});
