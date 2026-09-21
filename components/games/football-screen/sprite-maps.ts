// V15-1 (G15-2, v1.5 grill, 17-sep): the players stop being vector discs and
// become top-down pixel-art sprites in the style of the Tehkan World Cup reference
// (references/vault-world-cup-tehkan.png), baked the KongGame.tsx way: character maps,
// '.' transparent, every other letter looked up in a per-match palette.
//
// Only three orientations are drawn by hand -- N, NE and E -- and the other five come
// from quarter turns and left-right mirrors of the character grid, which are EXACT on
// pixel art (no interpolation): S = cw(cw(N)), SE = cw(NE), SW = mirror(SE),
// W = mirror(E), NW = mirror(NE). The grid is 15 x 15 (odd, so a quarter turn keeps the
// centre pixel in place) at 2 px per cell: 30 px on screen, inside G15-2's 28-32, while
// the engine's PLAYER_RADIUS stays 12 -- the sprite is bigger than the body only on
// screen.
//
// Letters: O outline, H hair, K skin, S shirt (kit.primary; the keeper's reserved
// #39ff14, G12-1), T trim -- collar and shorts (kit.secondary; the keeper's black),
// F boots. The hair is always the head and the head always leads: that is what the
// tests use to check every derived orientation.
//
// No DOM here on purpose: bakeSpriteAtlas walks the maps and hands every opaque cell
// to a fill callback. The component's callback does the fillRect on a canvas; the
// tests' callback counts. Everything in this module allocates at module load or on a
// bake (a match starting), never per frame (criterion 20).

export type SpriteMap = readonly string[];
export type SpriteChar = 'O' | 'H' | 'K' | 'S' | 'T' | 'F';
export type SpritePalette = Record<SpriteChar, string>;

export const SPRITE_CHARS: readonly SpriteChar[] = ['O', 'H', 'K', 'S', 'T', 'F'];

export function isSpriteChar(ch: string): ch is SpriteChar {
  return ch === 'O' || ch === 'H' || ch === 'K' || ch === 'S' || ch === 'T' || ch === 'F';
}

export const SPRITE_GRID = 15;
export const SPRITE_PX = 2;
export const SPRITE_SIZE = SPRITE_GRID * SPRITE_PX; // 30
export const SPRITE_HALF = SPRITE_SIZE / 2; // 15

export const POSE_IDLE = 0;
export const POSE_RUN_0 = 1;
export const POSE_RUN_1 = 2;
export const POSE_RUN_2 = 3;
export const POSE_DOWN = 4;
export const POSE_DIVE_0 = 5;
export const POSE_DIVE_1 = 6;
export const POSE_COUNT = 7;

// Screen axes: +x right, +y DOWN, clockwise from east.
export const OCTANT_E = 0;
export const OCTANT_SE = 1;
export const OCTANT_S = 2;
export const OCTANT_SW = 3;
export const OCTANT_W = 4;
export const OCTANT_NW = 5;
export const OCTANT_N = 6;
export const OCTANT_NE = 7;
export const OCTANT_COUNT = 8;

// The atlas: octants across, poses down.
export const ATLAS_W = OCTANT_COUNT * SPRITE_SIZE; // 240
export const ATLAS_H = POSE_COUNT * SPRITE_SIZE; // 210

export function atlasCellX(octant: number): number {
  return octant * SPRITE_SIZE;
}

export function atlasCellY(pose: number): number {
  return pose * SPRITE_SIZE;
}

// The letters that do not come from the kit: the same for all eighteen players.
export const SPRITE_OUTLINE = '#141414';
export const SPRITE_HAIR = '#3b2416';
export const SPRITE_SKIN = '#f1c27d';
export const SPRITE_BOOTS = '#202020';

const N_IDLE: SpriteMap = [
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '...OOOTTTOOO...',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '...OSSSSSSSO...',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
];
const N_RUN_0: SpriteMap = [
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '...OOOTTTOOO...',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '...OSSSSSSSO...',
  '....OTTOTTO....',
  '....OFFOKKO....',
  '.....OOOKKO....',
  '........OFFO...',
  '.........OO....',
];
const N_RUN_1: SpriteMap = [
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '...OOOTTTOOO...',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '...OSSSSSSSO...',
  '....OTTOTTO....',
  '.....OKKKO.....',
  '.....OKOKO.....',
  '.....OFOFO.....',
  '......O.O......',
];
const N_RUN_2: SpriteMap = [
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '...OOOTTTOOO...',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '...OSSSSSSSO...',
  '....OTTOTTO....',
  '....OKKOFFO....',
  '....OKKOOO.....',
  '...OFFO........',
  '....OO.........',
];
const N_DOWN: SpriteMap = [
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '..OOOOTTTOOOO..',
  '..OKSSSSSSSKO..',
  '..OOSSSSSSSOO..',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OTTTTTO....',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
];
const N_DIVE_0: SpriteMap = [
  '....OKO.OKO....',
  '....OKO.OKO....',
  '....OOHHHOO....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '....OOTTTOO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OTTTTTO....',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
];
const N_DIVE_1: SpriteMap = [
  '......OKO......',
  '.....OKKKO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '....OOTTTOO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '.....OTTTO.....',
  '.....OTTTO.....',
  '.....OKKKO.....',
  '.....OKKKO.....',
  '.....OFFFO.....',
  '......OOO......',
];
const NE_IDLE: SpriteMap = [
  '...............',
  '.........OOO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '....OOOTTTOOO..',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '.OFFOFFO.......',
  '.OO.OO.........',
];
const NE_RUN_0: SpriteMap = [
  '...............',
  '.........OOO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '....OOOTTTOOO..',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '..OFFOKKO......',
  '...OOOKKO......',
  '.....OFFO......',
  '.....OO........',
];
const NE_RUN_1: SpriteMap = [
  '...............',
  '.........OOO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '....OOOTTTOOO..',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '...OKKKO.......',
  '...OKOKO.......',
  '..OFOFO........',
  '..O.O..........',
];
const NE_RUN_2: SpriteMap = [
  '...............',
  '.........OOO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '....OOOTTTOOO..',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '..OKKOFFO......',
  '..OKKOOO.......',
  'OFFO...........',
  'OO.............',
];
const NE_DOWN: SpriteMap = [
  '..........OOO..',
  '........OHHHO..',
  '.......OHHHO...',
  '....OOOOTTTOOOO',
  '....OKSSSSSSSKO',
  '...OOSSSSSSSOO.',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OTTTTTO....',
  '...OTTOTTO.....',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '.OFFOFFO.......',
  '.OO.OO.........',
];
const NE_DIVE_0: SpriteMap = [
  '........OKO.OKO',
  '.......OKO.OKO.',
  '......OOHHHOO..',
  '.......OHHHO...',
  '.......OHHHO...',
  '.....OOTTTOO...',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '...OTTTTTO.....',
  '..OTTOTTO......',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '.OFFOFFO.......',
  '.OO.OO.........',
];
const NE_DIVE_1: SpriteMap = [
  '..........OKO..',
  '........OKKKO..',
  '.......OHHHO...',
  '.......OHHHO...',
  '......OOTTTOO..',
  '.....OSSSSSO...',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OTTTO......',
  '...OTTTO.......',
  '...OKKKO.......',
  '...OKKKO.......',
  '..OFFFO........',
  '..OOO..........',
];
const E_IDLE: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.....OKKSO.....',
  '.OOOOSSSSO.....',
  'OFKKTSSSSOOOO..',
  'OFKKTSSSSTHHHO.',
  '.OOOOSSSSTHHHO.',
  'OFKKTSSSSTHHHO.',
  'OFKKTSSSSOOOO..',
  '.OOOOSSSSO.....',
  '.....OKKSO.....',
  '......OOO......',
  '...............',
  '...............',
];
const E_RUN_0: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.....OKKSO.....',
  '...OOSSSSO.....',
  '..OFTSSSSOOOO..',
  '..OFTSSSSTHHHO.',
  '..OOOSSSSTHHHO.',
  '.OKKTSSSSTHHHO.',
  'OFKKTSSSSOOOO..',
  'OFOOOSSSSO.....',
  '.O...OKKSO.....',
  '......OOO......',
  '...............',
  '...............',
];
const E_RUN_1: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.....OKKSO.....',
  '....OSSSSO.....',
  '.OOOTSSSSOOOO..',
  'OFKKTSSSSTHHHO.',
  '.OOKOSSSSTHHHO.',
  'OFKKTSSSSTHHHO.',
  '.OOOTSSSSOOOO..',
  '....OSSSSO.....',
  '.....OKKSO.....',
  '......OOO......',
  '...............',
  '...............',
];
const E_RUN_2: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.O...OKKSO.....',
  'OFOOOSSSSO.....',
  'OFKKTSSSSOOOO..',
  '.OKKTSSSSTHHHO.',
  '..OOOSSSSTHHHO.',
  '..OFTSSSSTHHHO.',
  '..OFTSSSSOOOO..',
  '...OOSSSSO.....',
  '.....OKKSO.....',
  '......OOO......',
  '...............',
  '...............',
];
const E_DOWN: SpriteMap = [
  '...............',
  '...............',
  '.........OOO...',
  '.........OKO...',
  '.OOOOOOOOSSO...',
  'OFKKKTTSSSSOOO.',
  'OFKKKTTSSSSTHHO',
  '.OOOOOTSSSSTHHO',
  'OFKKKTTSSSSTHHO',
  'OFKKKTTSSSSOOO.',
  '.OOOOOOOOSSO...',
  '.........OKO...',
  '.........OOO...',
  '...............',
  '...............',
];
const E_DIVE_0: SpriteMap = [
  '...............',
  '...............',
  '...............',
  '...............',
  '.OOOOOOOOO..OOO',
  'OFKKTTSSSOOOOKK',
  'OFKKTTSSSTHHHOO',
  '.OOOOTSSSTHHH..',
  'OFKKTTSSSTHHHOO',
  'OFKKTTSSSOOOOKK',
  '.OOOOOOOOO..OOO',
  '...............',
  '...............',
  '...............',
  '...............',
];
const E_DIVE_1: SpriteMap = [
  '...............',
  '...............',
  '...............',
  '...............',
  '......OOOOO....',
  '.OOOOOSSSSOOOO.',
  'OFKKTTSSSSTHHKO',
  'OFKKTTSSSSTHHKK',
  'OFKKTTSSSSTHHKO',
  '.OOOOOSSSSOOOO.',
  '......OOOOO....',
  '...............',
  '...............',
  '...............',
  '...............',
];

export const HAND_N: readonly SpriteMap[] = [N_IDLE, N_RUN_0, N_RUN_1, N_RUN_2, N_DOWN, N_DIVE_0, N_DIVE_1];
export const HAND_NE: readonly SpriteMap[] = [NE_IDLE, NE_RUN_0, NE_RUN_1, NE_RUN_2, NE_DOWN, NE_DIVE_0, NE_DIVE_1];
export const HAND_E: readonly SpriteMap[] = [E_IDLE, E_RUN_0, E_RUN_1, E_RUN_2, E_DOWN, E_DIVE_0, E_DIVE_1];

// A quarter turn clockwise ON SCREEN: the top row becomes the right column.
export function rotateMapCW(map: SpriteMap): string[] {
  const n = map.length;
  const out: string[] = [];
  for (let r = 0; r < n; r++) {
    let row = '';
    for (let c = 0; c < n; c++) row += map[n - 1 - c][r];
    out.push(row);
  }
  return out;
}

export function mirrorMapX(map: SpriteMap): string[] {
  const out: string[] = [];
  for (const row of map) {
    let flipped = '';
    for (let c = row.length - 1; c >= 0; c--) flipped += row[c];
    out.push(flipped);
  }
  return out;
}

// [octant][pose]. Called once, at module load, into PLAYER_SPRITE_MAPS.
export function buildPlayerSpriteMaps(): SpriteMap[][] {
  const out: SpriteMap[][] = [];
  for (let octant = 0; octant < OCTANT_COUNT; octant++) out.push([]);
  for (let pose = 0; pose < POSE_COUNT; pose++) {
    const n = HAND_N[pose];
    const ne = HAND_NE[pose];
    const e = HAND_E[pose];
    const se = rotateMapCW(ne);
    out[OCTANT_E].push(e);
    out[OCTANT_SE].push(se);
    out[OCTANT_S].push(rotateMapCW(rotateMapCW(n)));
    out[OCTANT_SW].push(mirrorMapX(se));
    out[OCTANT_W].push(mirrorMapX(e));
    out[OCTANT_NW].push(mirrorMapX(ne));
    out[OCTANT_N].push(n);
    out[OCTANT_NE].push(ne);
  }
  return out;
}

export const PLAYER_SPRITE_MAPS: readonly (readonly SpriteMap[])[] = buildPlayerSpriteMaps();

// Created once by the component; the kit letters are rewritten in place on each bake.
export function createSpritePalette(): SpritePalette {
  return { O: SPRITE_OUTLINE, H: SPRITE_HAIR, K: SPRITE_SKIN, S: '#ffffff', T: '#000000', F: SPRITE_BOOTS };
}

export function writeSpritePalette(out: SpritePalette, shirt: string, trim: string): void {
  out.S = shirt;
  out.T = trim;
}

// Walks every map of the [octant][pose] table and hands each opaque cell to `fill`, at
// its atlas position. Returns how many cells it painted.
export function bakeSpriteAtlas(
  maps: readonly (readonly SpriteMap[])[],
  palette: Readonly<SpritePalette>,
  fill: (x: number, y: number, size: number, color: string) => void,
): number {
  let painted = 0;
  for (let octant = 0; octant < maps.length; octant++) {
    const poses = maps[octant];
    for (let pose = 0; pose < poses.length; pose++) {
      const map = poses[pose];
      const originX = atlasCellX(octant);
      const originY = atlasCellY(pose);
      for (let r = 0; r < map.length; r++) {
        const row = map[r];
        for (let c = 0; c < row.length; c++) {
          const ch = row[c];
          if (!isSpriteChar(ch)) continue;
          fill(originX + c * SPRITE_PX, originY + r * SPRITE_PX, SPRITE_PX, palette[ch]);
          painted++;
        }
      }
    }
  }
  return painted;
}
