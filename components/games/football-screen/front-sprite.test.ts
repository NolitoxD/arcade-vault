import { describe, expect, it } from 'vitest';
import { FRONT_GRID_H, FRONT_GRID_W, FRONT_H, FRONT_PX, FRONT_STANDING, FRONT_W, bakeFrontSprite } from './front-sprite';
import { SPRITE_CHARS, createSpritePalette, mirrorMapX, writeSpritePalette } from './sprite-maps';

const KEEPER_GREEN = '#39ff14';

function firstRowWith(ch: string): number {
  for (let r = 0; r < FRONT_STANDING.length; r++) if (FRONT_STANDING[r].includes(ch)) return r;
  return -1;
}

describe('the standing front sprite (G15-19)', () => {
  it('is an 11 x 21 grid of palette letters, left-right symmetric like a player facing the camera', () => {
    expect(FRONT_STANDING.length).toBe(FRONT_GRID_H);
    for (const row of FRONT_STANDING) {
      expect(row.length).toBe(FRONT_GRID_W);
      for (const c of row) expect(c === '.' || SPRITE_CHARS.some((s) => s === c)).toBe(true);
    }
    expect(mirrorMapX(FRONT_STANDING)).toEqual([...FRONT_STANDING]);
    expect([FRONT_W, FRONT_H]).toEqual([FRONT_GRID_W * FRONT_PX, FRONT_GRID_H * FRONT_PX]);
  });

  it('wears every letter of the palette, hair above the face and boots at the bottom', () => {
    for (const ch of SPRITE_CHARS) expect([ch, firstRowWith(ch) >= 0]).toEqual([ch, true]);
    expect(firstRowWith('H')).toBeLessThan(firstRowWith('K'));
    expect(firstRowWith('F')).toBeGreaterThanOrEqual(FRONT_GRID_H - 2);
  });

  it('bakes every opaque cell once, FRONT_PX wide, inside FRONT_W x FRONT_H, in the kit it is handed (the keeper green too)', () => {
    const palette = createSpritePalette();
    writeSpritePalette(palette, KEEPER_GREEN, '#000000');
    let opaque = 0;
    for (const row of FRONT_STANDING) for (const c of row) if (c !== '.') opaque++;
    let outside = 0;
    let green = 0;
    let wrongSize = 0;
    const painted = bakeFrontSprite(palette, (x, y, size, color) => {
      if (x < 0 || y < 0 || x + size > FRONT_W || y + size > FRONT_H) outside++;
      if (size !== FRONT_PX) wrongSize++;
      if (color === KEEPER_GREEN) green++;
    });
    expect([painted, outside, wrongSize]).toEqual([opaque, 0, 0]);
    expect(green).toBeGreaterThan(0);
  });
});
