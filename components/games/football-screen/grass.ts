// V15-1 (G15-2 + brief §1, options 1-C1 and 1-C2): the pitch goes from two dark greens
// in 160-unit stripes to the Tehkan reference's look -- TWO lime greens, one stronger,
// in narrow "mowing" stripes with a soft speckle. The reference's pitch is vertical and
// its stripes horizontal; ours is horizontal, so our stripes stay VERTICAL and aligned
// with the world, like v1 (odd stripe index = light shade).
//
// The component bakes ONE tile -- two stripes wide -- into a canvas when it mounts,
// turns it into a repeating CanvasPattern once, and every frame fills the screen with
// that pattern shifted by grassTileOffset(camera): one fill call, no allocation
// (criterion 20). The speckle comes from an integer hash, never from a random source, so
// the pitch is the same pixel for pixel on every run (criterion 1's spirit applied to
// the screen: reproducible captures for the QA).
//
// No DOM here: forEachGrassCell hands every cell to a callback, exactly like
// sprite-maps.ts's bakeSpriteAtlas.

export const GRASS_STRIPE_WIDTH = 48;
export const GRASS_TILE_W = GRASS_STRIPE_WIDTH * 2; // one light + one dark stripe
export const GRASS_TILE_H = 96;
export const GRASS_CELL = 2; // pixel-art grain, matching the sprites' 2 px
export const GRASS_SPECKLE_PERCENT = 12;

export const GRASS_TONE_LIGHT = 0;
export const GRASS_TONE_LIGHT_SPECK = 1;
export const GRASS_TONE_DARK = 2;
export const GRASS_TONE_DARK_SPECK = 3;

// A 32-bit integer mix (murmur3-style finaliser over the two coordinates).
export function grassHash(x: number, y: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// Math.floor, not truncation: the camera can show x < 0 (cameraMinX is -60), and
// (-1 & 1) === 1 keeps the alternation going on that side too.
export function grassBaseTone(worldX: number): number {
  return (Math.floor(worldX / GRASS_STRIPE_WIDTH) & 1) === 1 ? GRASS_TONE_LIGHT : GRASS_TONE_DARK;
}

// The speckle is the stripe's OWN darker shade (base + 1), so it never blurs the stripes.
export function grassTileTone(cellX: number, cellY: number): number {
  const base = grassBaseTone(cellX * GRASS_CELL);
  return grassHash(cellX, cellY) % 100 < GRASS_SPECKLE_PERCENT ? base + 1 : base;
}

export function forEachGrassCell(fill: (x: number, y: number, size: number, tone: number) => void): void {
  const cols = GRASS_TILE_W / GRASS_CELL;
  const rows = GRASS_TILE_H / GRASS_CELL;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) fill(cx * GRASS_CELL, cy * GRASS_CELL, GRASS_CELL, grassTileTone(cx, cy));
  }
}

// Where the tile's origin has to sit so that the pattern follows the world: an integer
// (pixel-art grain, no half-pixel shimmer) in [0, tile).
export function grassTileOffset(camera: number, tile: number): number {
  const r = Math.round(camera) % tile;
  return r < 0 ? r + tile : r;
}
