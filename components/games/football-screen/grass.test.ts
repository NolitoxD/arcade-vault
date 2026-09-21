import { describe, expect, it } from 'vitest';
import { VIEW_W } from './camera';
import {
  GRASS_CELL, GRASS_SPECKLE_PERCENT, GRASS_STRIPE_WIDTH, GRASS_TILE_H, GRASS_TILE_W,
  GRASS_TONE_DARK, GRASS_TONE_DARK_SPECK, GRASS_TONE_LIGHT, GRASS_TONE_LIGHT_SPECK,
  forEachGrassCell, grassBaseTone, grassHash, grassTileOffset, grassTileTone,
} from './grass';

describe('the grass tile geometry', () => {
  it('is exactly two stripes wide and a whole number of cells both ways, so it repeats with no seam', () => {
    expect(GRASS_TILE_W).toBe(2 * GRASS_STRIPE_WIDTH);
    expect(GRASS_TILE_W % GRASS_CELL).toBe(0);
    expect(GRASS_TILE_H % GRASS_CELL).toBe(0);
    expect(GRASS_STRIPE_WIDTH % GRASS_CELL).toBe(0);
  });

  it('uses narrower mowing stripes than v1 (160) and alternates them along the world x', () => {
    expect(GRASS_STRIPE_WIDTH).toBeLessThan(160);
    expect(GRASS_STRIPE_WIDTH).toBeGreaterThanOrEqual(32);
    expect(grassBaseTone(0)).toBe(GRASS_TONE_DARK);
    expect(grassBaseTone(GRASS_STRIPE_WIDTH)).toBe(GRASS_TONE_LIGHT);
    expect(grassBaseTone(2 * GRASS_STRIPE_WIDTH)).toBe(GRASS_TONE_DARK);
    // The camera can sit left of the pitch (cameraMinX is -60): negative x alternates too.
    expect(grassBaseTone(-1)).toBe(GRASS_TONE_LIGHT);
    expect(grassBaseTone(-GRASS_STRIPE_WIDTH - 1)).toBe(GRASS_TONE_DARK);
  });
});

// The whole drawing trick in one assertion: the screen pixel s shows the tile pixel
// (s + grassTileOffset(cam)) mod TILE_W, and that has to be the stripe of the WORLD
// pixel s + cam, for any camera the game can produce.
describe('the tile drawn through the camera offset', () => {
  it('reproduces the world stripes at every screen x, negative and fractional cameras included', () => {
    const cameras = [-60, -13.4, 0, 47.6, 500, 1234.2];
    for (const camX of cameras) {
      const ox = grassTileOffset(camX, GRASS_TILE_W);
      for (let s = 0; s < VIEW_W; s++) {
        const tileX = (s + ox) % GRASS_TILE_W;
        expect(grassBaseTone(tileX)).toBe(grassBaseTone(s + Math.round(camX)));
      }
    }
  });

  it('grassTileOffset is an integer in [0, tile) for any camera', () => {
    for (const cam of [-1000.7, -60, -0.4, 0, 0.6, 95, 96, 97, 12345.5]) {
      const ox = grassTileOffset(cam, GRASS_TILE_W);
      expect(Number.isInteger(ox)).toBe(true);
      expect(ox).toBeGreaterThanOrEqual(0);
      expect(ox).toBeLessThan(GRASS_TILE_W);
    }
  });
});

describe('the speckle', () => {
  it('grassHash is deterministic and spreads over the tile', () => {
    expect(grassHash(3, 7)).toBe(grassHash(3, 7));
    expect(grassHash(3, 7)).not.toBe(grassHash(7, 3));
    const seen = new Set<number>();
    for (let y = 0; y < GRASS_TILE_H / GRASS_CELL; y++) {
      for (let x = 0; x < GRASS_TILE_W / GRASS_CELL; x++) seen.add(grassHash(x, y));
    }
    expect(seen.size).toBeGreaterThan(2000);
  });

  it('paints every cell of the tile exactly once, inside the tile', () => {
    let cells = 0;
    let outside = 0;
    forEachGrassCell((x, y, size) => {
      cells++;
      if (x < 0 || y < 0 || x + size > GRASS_TILE_W || y + size > GRASS_TILE_H) outside++;
    });
    expect(cells).toBe((GRASS_TILE_W / GRASS_CELL) * (GRASS_TILE_H / GRASS_CELL));
    expect(outside).toBe(0);
  });

  it('is soft: between 8 % and 16 % of the cells of EACH stripe are speckled, in that stripe\'s own shade', () => {
    const count = [0, 0, 0, 0];
    forEachGrassCell((x, _y, _size, tone) => {
      count[tone]++;
      // A speckle never changes stripe: it is the stripe's own darker shade.
      const base = grassBaseTone(x);
      expect(tone === base || tone === base + 1).toBe(true);
    });
    const light = count[GRASS_TONE_LIGHT_SPECK] / (count[GRASS_TONE_LIGHT] + count[GRASS_TONE_LIGHT_SPECK]);
    const dark = count[GRASS_TONE_DARK_SPECK] / (count[GRASS_TONE_DARK] + count[GRASS_TONE_DARK_SPECK]);
    expect(GRASS_SPECKLE_PERCENT).toBe(12);
    expect(light).toBeGreaterThan(0.08);
    expect(light).toBeLessThan(0.16);
    expect(dark).toBeGreaterThan(0.08);
    expect(dark).toBeLessThan(0.16);
  });

  it('bakes the same tile twice, cell by cell: no randomness, reproducible screenshots', () => {
    const first: number[] = [];
    const second: number[] = [];
    forEachGrassCell((_x, _y, _size, tone) => first.push(tone));
    forEachGrassCell((_x, _y, _size, tone) => second.push(tone));
    expect(second).toEqual(first);
    expect(grassTileTone(0, 0)).toBe(first[0]);
  });
});
