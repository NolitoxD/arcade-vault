import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../football-logic/players';
import {
  ATLAS_H, ATLAS_W, HAND_E, HAND_N, HAND_NE, OCTANT_COUNT, OCTANT_E, OCTANT_N, OCTANT_NE,
  PLAYER_SPRITE_MAPS, POSE_COUNT, POSE_DIVE_1, POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2,
  SPRITE_BOOTS, SPRITE_CHARS, SPRITE_GRID, SPRITE_HAIR, SPRITE_OUTLINE, SPRITE_SIZE, SPRITE_SKIN,
  atlasCellX, atlasCellY, bakeSpriteAtlas, createSpritePalette, mirrorMapX, rotateMapCW, writeSpritePalette,
  type SpriteMap,
} from './sprite-maps';

const HAND_SETS: readonly (readonly SpriteMap[])[] = [HAND_N, HAND_NE, HAND_E];
const STANDING_POSES: readonly number[] = [POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2];
const KEEPER_GREEN = '#39ff14';

// Screen axes: +x right, +y DOWN. Indexed by octant: E, SE, S, SW, W, NW, N, NE.
const EXPECTED_HEAD: readonly (readonly [number, number])[] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

function countChar(map: SpriteMap, ch: string): number {
  let n = 0;
  for (const row of map) for (const c of row) if (c === ch) n++;
  return n;
}

function opaqueCount(map: SpriteMap): number {
  let n = 0;
  for (const row of map) for (const c of row) if (c !== '.') n++;
  return n;
}

// The hair IS the head, and the head leads the body: the sign of the hair's centroid
// relative to the centre of the grid, with a one-pixel dead zone, is the direction
// the sprite faces.
function headDirection(map: SpriteMap): [number, number] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] !== 'H') continue;
      sx += x;
      sy += y;
      n++;
    }
  }
  const centre = (SPRITE_GRID - 1) / 2;
  const dx = sx / n - centre;
  const dy = sy / n - centre;
  return [dx > 1 ? 1 : dx < -1 ? -1 : 0, dy > 1 ? 1 : dy < -1 ? -1 : 0];
}

describe('the hand-drawn maps', () => {
  it('are a 15 x 15 grid for every pose of N, NE and E', () => {
    for (const set of HAND_SETS) {
      expect(set.length).toBe(POSE_COUNT);
      for (const map of set) {
        expect(map.length).toBe(SPRITE_GRID);
        for (const row of map) expect(row.length).toBe(SPRITE_GRID);
      }
    }
  });

  it('use only the transparent dot and the six palette letters', () => {
    for (const set of HAND_SETS) {
      for (const map of set) {
        for (const row of map) {
          for (const c of row) expect(c === '.' || SPRITE_CHARS.some((s) => s === c)).toBe(true);
        }
      }
    }
  });
});

describe('rotateMapCW / mirrorMapX', () => {
  it('rotateMapCW sends the top edge to the right edge, and four turns give the map back', () => {
    const marker: string[] = [];
    for (let r = 0; r < SPRITE_GRID; r++) marker.push(r === 0 ? '.......H.......' : '...............');
    expect(rotateMapCW(marker)[7][14]).toBe('H');
    const sample = HAND_NE[POSE_RUN_0];
    expect(rotateMapCW(rotateMapCW(rotateMapCW(rotateMapCW(sample))))).toEqual([...sample]);
    expect(rotateMapCW(sample)).not.toEqual([...sample]);
  });

  it('mirrorMapX flips every row left to right and is its own inverse', () => {
    const sample = HAND_E[POSE_IDLE];
    const mirrored = mirrorMapX(sample);
    for (let r = 0; r < SPRITE_GRID; r++) {
      for (let c = 0; c < SPRITE_GRID; c++) expect(mirrored[r][c]).toBe(sample[r][SPRITE_GRID - 1 - c]);
    }
    expect(mirrorMapX(mirrored)).toEqual([...sample]);
  });
});

describe('PLAYER_SPRITE_MAPS', () => {
  it('holds the eight octants of every pose, 15 x 15 each, with N, NE and E exactly the hand-drawn ones', () => {
    expect(PLAYER_SPRITE_MAPS.length).toBe(OCTANT_COUNT);
    for (const poses of PLAYER_SPRITE_MAPS) {
      expect(poses.length).toBe(POSE_COUNT);
      for (const map of poses) {
        expect(map.length).toBe(SPRITE_GRID);
        for (const row of map) expect(row.length).toBe(SPRITE_GRID);
      }
    }
    for (let pose = 0; pose < POSE_COUNT; pose++) {
      expect(PLAYER_SPRITE_MAPS[OCTANT_N][pose]).toEqual(HAND_N[pose]);
      expect(PLAYER_SPRITE_MAPS[OCTANT_NE][pose]).toEqual(HAND_NE[pose]);
      expect(PLAYER_SPRITE_MAPS[OCTANT_E][pose]).toEqual(HAND_E[pose]);
    }
  });

  it('points the head where the octant says, for every octant and every pose', () => {
    for (let octant = 0; octant < OCTANT_COUNT; octant++) {
      for (let pose = 0; pose < POSE_COUNT; pose++) {
        expect([octant, pose, ...headDirection(PLAYER_SPRITE_MAPS[octant][pose])])
          .toEqual([octant, pose, ...EXPECTED_HEAD[octant]]);
      }
    }
  });

  it('animates the legs: in every octant the three run frames differ from each other and from standing still', () => {
    for (let octant = 0; octant < OCTANT_COUNT; octant++) {
      const maps = PLAYER_SPRITE_MAPS[octant];
      expect(maps[POSE_RUN_0]).not.toEqual(maps[POSE_RUN_1]);
      expect(maps[POSE_RUN_1]).not.toEqual(maps[POSE_RUN_2]);
      expect(maps[POSE_RUN_0]).not.toEqual(maps[POSE_RUN_2]);
      expect(maps[POSE_RUN_1]).not.toEqual(maps[POSE_IDLE]);
    }
  });

  it('always draws hair, a kit shirt and its trim, and the boots on every standing pose (G15-2)', () => {
    for (let octant = 0; octant < OCTANT_COUNT; octant++) {
      for (let pose = 0; pose < POSE_COUNT; pose++) {
        const map = PLAYER_SPRITE_MAPS[octant][pose];
        expect(countChar(map, 'H')).toBeGreaterThan(0);
        expect(countChar(map, 'S')).toBeGreaterThan(0);
        expect(countChar(map, 'T')).toBeGreaterThan(0);
      }
      for (const pose of STANDING_POSES) expect(countChar(PLAYER_SPRITE_MAPS[octant][pose], 'F')).toBeGreaterThan(0);
    }
  });

  it('is drawn at 28-32 px on screen while the physical radius stays the engine\'s 12', () => {
    expect(SPRITE_SIZE).toBeGreaterThanOrEqual(28);
    expect(SPRITE_SIZE).toBeLessThanOrEqual(32);
    expect(PLAYER_RADIUS).toBe(12);
  });
});

describe('palette and atlas', () => {
  it('writeSpritePalette puts the kit on the shirt and the trim and keeps hair, skin, outline and boots fixed', () => {
    const palette = createSpritePalette();
    writeSpritePalette(palette, '#d40000', '#ffcc00');
    expect(palette.S).toBe('#d40000');
    expect(palette.T).toBe('#ffcc00');
    writeSpritePalette(palette, KEEPER_GREEN, '#000000');
    expect(palette.S).toBe(KEEPER_GREEN);
    expect(palette.T).toBe('#000000');
    expect(palette.H).toBe(SPRITE_HAIR);
    expect(palette.K).toBe(SPRITE_SKIN);
    expect(palette.O).toBe(SPRITE_OUTLINE);
    expect(palette.F).toBe(SPRITE_BOOTS);
  });

  it('bakes the reserved keeper green into every pose of every octant (G12-1)', () => {
    const palette = createSpritePalette();
    writeSpritePalette(palette, KEEPER_GREEN, '#000000');
    const green = new Int32Array(OCTANT_COUNT * POSE_COUNT);
    bakeSpriteAtlas(PLAYER_SPRITE_MAPS, palette, (x, y, _size, color) => {
      if (color !== KEEPER_GREEN) return;
      green[Math.floor(x / SPRITE_SIZE) * POSE_COUNT + Math.floor(y / SPRITE_SIZE)]++;
    });
    for (let i = 0; i < green.length; i++) expect(green[i]).toBeGreaterThan(0);
  });

  it('bakes every opaque cell exactly once, inside its own 30 px square of the atlas', () => {
    const palette = createSpritePalette();
    const painted = new Int32Array(OCTANT_COUNT * POSE_COUNT);
    let outside = 0;
    const total = bakeSpriteAtlas(PLAYER_SPRITE_MAPS, palette, (x, y, size) => {
      if (x < 0 || y < 0 || x + size > ATLAS_W || y + size > ATLAS_H) outside++;
      painted[Math.floor(x / SPRITE_SIZE) * POSE_COUNT + Math.floor(y / SPRITE_SIZE)]++;
    });
    let expected = 0;
    for (let octant = 0; octant < OCTANT_COUNT; octant++) {
      for (let pose = 0; pose < POSE_COUNT; pose++) {
        const cell = opaqueCount(PLAYER_SPRITE_MAPS[octant][pose]);
        expect(painted[octant * POSE_COUNT + pose]).toBe(cell);
        expected += cell;
      }
    }
    expect(outside).toBe(0);
    expect(total).toBe(expected);
  });

  it('lays the atlas out with octants across and poses down, one 30 px cell each', () => {
    expect(ATLAS_W).toBe(OCTANT_COUNT * SPRITE_SIZE);
    expect(ATLAS_H).toBe(POSE_COUNT * SPRITE_SIZE);
    expect(atlasCellX(OCTANT_NE)).toBe(7 * SPRITE_SIZE);
    expect(atlasCellY(POSE_DIVE_1)).toBe(6 * SPRITE_SIZE);
    expect(atlasCellX(0)).toBe(0);
    expect(atlasCellY(0)).toBe(0);
  });
});
