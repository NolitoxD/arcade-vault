import { isSpriteChar, type SpriteMap, type SpritePalette } from './sprite-maps';

// G15-19: the pre-match line-up shows the two elevens STANDING, FACING the camera -- the
// one pose the top-down atlas does not have. Same pixel art and same palette letters as
// sprite-maps.ts (O outline, H hair, K skin, S shirt = kit primary or the keeper's green,
// T trim = kit secondary, F boots), baked per kit on the event of entering the screen,
// never per frame. 11 x 21 cells at 3 px: a "photo", twice as tall as a match sprite.
export const FRONT_GRID_W = 11;
export const FRONT_GRID_H = 21;
export const FRONT_PX = 3;
export const FRONT_W = FRONT_GRID_W * FRONT_PX;   // 33
export const FRONT_H = FRONT_GRID_H * FRONT_PX;   // 63

export const FRONT_STANDING: SpriteMap = [
  '....OOO....',
  '...OHHHO...',
  '..OHHHHHO..',
  '..OHKKKHO..',
  '..OKKKKKO..',
  '...OKKKO...',
  '..OOTTTOO..',
  '.OSSSTSSSO.',
  'OSSSSSSSSSO',
  'OKSSSSSSSKO',
  'OKOSSSSSOKO',
  'OKOSSSSSOKO',
  '.O.OTTTO.O.',
  '...OTTTO...',
  '...OTOTO...',
  '...OKOKO...',
  '...OKOKO...',
  '...OSOSO...',
  '...OSOSO...',
  '..OFFOFFO..',
  '..OOO.OOO..',
];

// Hands every opaque cell to `fill`, at its position inside a FRONT_W x FRONT_H canvas.
// Returns how many it painted (the tests count; the component's fill does the fillRect).
export function bakeFrontSprite(
  palette: Readonly<SpritePalette>,
  fill: (x: number, y: number, size: number, color: string) => void,
): number {
  let painted = 0;
  for (let r = 0; r < FRONT_STANDING.length; r++) {
    const row = FRONT_STANDING[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (!isSpriteChar(ch)) continue;
      fill(c * FRONT_PX, r * FRONT_PX, FRONT_PX, palette[ch]);
      painted++;
    }
  }
  return painted;
}
