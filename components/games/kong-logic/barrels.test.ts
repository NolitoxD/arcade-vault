import { describe, expect, it } from 'vitest';
import { layoutFor } from './level';
import {
  MAX_BARRELS, spawnBarrel, advanceBarrel, atGirderEnd, dropToNextGirder,
  shouldTakeLadder, enterLadder, descendLadder, openEdgeDir,
} from './barrels';

const layout = layoutFor(1);

const pool = () => Array.from({ length: MAX_BARRELS }, () => ({
  x: 0, y: 0, girder: 0, dir: 1 as const, active: false, onLadder: null,
}));

describe('barrel pool', () => {
  it('reuses inactive slots and refuses when full', () => {
    const p = pool();
    for (let i = 0; i < MAX_BARRELS; i++) expect(spawnBarrel(p, layout)).not.toBeNull();
    expect(spawnBarrel(p, layout)).toBeNull();
    p[3].active = false;
    expect(spawnBarrel(p, layout)).toBe(p[3]);
  });
});

describe('spawning', () => {
  it('spawns barrels from Kong girder, not always from the top one', () => {
    const p = pool();
    // girder: 2 (not layoutFor(1)'s own girder: 4) so this actually exercises
    // spawnBarrel reading kong.girder/kong.x off the given layout, rather than
    // happening to match layoutFor(1)'s defaults.
    const customLayout = { ...layoutFor(1), kong: { x: 300, girder: 2 } };
    const b = spawnBarrel(p, customLayout)!;
    expect(b.girder).toBe(2);
    expect(b.x).toBe(300);
  });
});

describe('rolling', () => {
  it('advances along the girder and sits on its slope', () => {
    const p = pool();
    const b = spawnBarrel(p, layout)!;
    const x0 = b.x;
    advanceBarrel(layout, b, 100, 120);
    expect(b.x).not.toBe(x0);
    const g = layout.girders[b.girder];
    expect(b.y).toBeCloseTo(g.y0 + ((g.y1 - g.y0) * (b.x - g.x0)) / (g.x1 - g.x0), 0);
  });
  it('covers more x-distance downhill than uphill on the same girder', () => {
    const p = pool();
    const bDown = spawnBarrel(p, layout)!;
    bDown.girder = 1;
    bDown.x = 300;
    bDown.dir = -1;
    const bUp = spawnBarrel(p, layout)!;
    bUp.girder = 1;
    bUp.x = 300;
    bUp.dir = 1;
    advanceBarrel(layout, bDown, 100, 120);
    advanceBarrel(layout, bUp, 100, 120);
    const distDown = Math.abs(bDown.x - 300);
    const distUp = Math.abs(bUp.x - 300);
    expect(distDown).toBeGreaterThan(distUp);
  });
  it('detects the end of a girder and drops reversing direction', () => {
    const p = pool();
    const b = spawnBarrel(p, layout)!;
    b.girder = 3;
    b.x = layout.girders[3].x1 + 10;
    b.dir = 1;
    expect(atGirderEnd(layout, b)).toBe(true);
    dropToNextGirder(layout, b);
    expect(b.girder).toBe(2);
    expect(b.dir).toBe(-1);
    expect(b.active).toBe(true);
  });
  it('deactivates when dropping below the bottom girder', () => {
    const p = pool();
    const b = spawnBarrel(p, layout)!;
    b.girder = 0;
    dropToNextGirder(layout, b);
    expect(b.active).toBe(false);
  });
});

describe('ladders', () => {
  it('takes a ladder only when the roll passes the chance', () => {
    expect(shouldTakeLadder(0.4, () => 0.1)).toBe(true);
    expect(shouldTakeLadder(0.4, () => 0.9)).toBe(false);
    expect(shouldTakeLadder(0, () => 0)).toBe(false);
  });
  it('descends a ladder and lands on the lower girder', () => {
    const p = pool();
    const b = spawnBarrel(p, layout)!;
    const l = layout.ladders.find((x) => x.from === 2)!;
    b.girder = l.to;
    b.x = l.x;
    enterLadder(layout, b, l);
    expect(b.onLadder).toBe(l);
    for (let i = 0; i < 200 && b.onLadder; i++) descendLadder(layout, b, 16, 150);
    expect(b.onLadder).toBeNull();
    expect(b.girder).toBe(l.from);
  });
  it('reorients toward the open edge after descending and eventually reaches it', () => {
    const p = pool();
    const b = spawnBarrel(p, layout)!;
    const l = layout.ladders.find((x) => x.from === 2)!;
    b.girder = l.to;
    b.x = l.x;
    enterLadder(layout, b, l);
    for (let i = 0; i < 200 && b.onLadder; i++) descendLadder(layout, b, 16, 150);
    expect(b.dir).toBe(openEdgeDir(b.girder));
    for (let i = 0; i < 500 && !atGirderEnd(layout, b); i++) advanceBarrel(layout, b, 16, 150);
    expect(atGirderEnd(layout, b)).toBe(true);
  });
});
