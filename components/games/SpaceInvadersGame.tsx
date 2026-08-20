'use client';

import React, { useEffect, useRef } from 'react';

import {
  createFormation,
  formationBounds,
  INV_GAP_X,
  INV_GAP_Y,
  INV_H,
  INV_W,
  pointsFor,
  shooterCells,
  stepInterval,
  waveFor,
  type Invader,
} from './space-invaders-logic/formation';
import {
  aabb,
  createShields,
  damageShield,
  shieldHitTest,
  SHIELD_COLS,
  SHIELD_PX,
  SHIELD_ROWS,
  type Shield,
} from './space-invaders-logic/shields';
import { sfxSpaceInvaders } from '@/lib/sfx-space-invaders';

interface SpaceInvadersGameProps {
  paused: boolean;
  muted?: boolean;
  skin?: string;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Geometry (spec 23) ────────────────────────────────────────────────────────

const CANVAS_W = 600;
const CANVAS_H = 700;
const HUD_TOP_H = 36;

const INV_COLS = 11;
const CELL_W = INV_W + INV_GAP_X;
const CELL_H = INV_H + INV_GAP_Y;
const FORMATION_W = (INV_COLS - 1) * CELL_W + INV_W;
const FORMATION_START_X = (CANVAS_W - FORMATION_W) / 2;
const FORMATION_TOP = 92;
const EDGE_MARGIN = 8;
const STEP_DX = 10;
const STEP_DOWN = 18;

const UFO_Y = 44;
const UFO_W = 40;
const UFO_H = 16;

const SHIELD_Y = 556;
const CANNON_Y = 620;
const CANNON_W = 40;
const CANNON_H = 20;
const GROUND_Y = 662;
const HUD_BOTTOM_CY = 678;

// ── Tuning (spec 23) ──────────────────────────────────────────────────────────

const START_LIVES = 3;
const CANNON_SPEED = 240;

const BULLET_W = 3;
const BULLET_H = 12;
const BULLET_SPEED = 400;

const ENEMY_BULLET_W = 3;
const ENEMY_BULLET_H = 10;
const ENEMY_BULLET_SPEED = 220;
const MAX_ENEMY_BULLETS = 11;

const UFO_SPEED = 120;
const UFO_MIN_MS = 20000;
const UFO_RANGE_MS = 10000;
const UFO_POINTS: readonly number[] = [50, 100, 150, 300];

const POPUP_MS = 800;
const FLASH_MS = 200;
const DEATH_PAUSE_MS = 1000;
const CLEAR_PAUSE_MS = 900;
const SHIELD_DAMAGE_RADIUS = 2;

// Session hi-score survives remounts (retry without page reload)
let sessionHiScore = 0;

// ── Skins ─────────────────────────────────────────────────────────────────────

type Skin = {
  name: string;
  bg: string;
  hud: string;
  hudAccent: string;
  shield: string;
  // Neon-only: color de la pasada de brillo ambiental bajo los escudos (P7 —
  // una sola fillRect con shadowBlur por escudo, nunca por-píxel).
  shieldGlow?: string;
  drawInvader: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: 0 | 1 | 2,
    frame: 0 | 1,
  ) => void;
  drawCannon: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
  ) => void;
  drawUfo: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  drawPlayerBullet: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
  ) => void;
  drawEnemyBullet: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
  ) => void;
  drawExplosion: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
  ) => void;
};

// ── classic ───────────────────────────────────────────────────────────────────

const CLASSIC_GREEN = '#33ff33';
const CLASSIC_GREEN_DIM = '#1f9e1f';
const CLASSIC_UFO = '#ff3355';
const CLASSIC_BULLET = '#ffffff';
const SPRITE_PX = 3;

// type 0 = crab (bottom rows, 10 pts)
const CRAB_FRAMES = [
  [
    '..#......#..',
    '...#....#...',
    '..########..',
    '.##.####.##.',
    '############',
    '#.########.#',
    '#.#......#.#',
    '....#..#....',
  ],
  [
    '..#......#..',
    '#..#....#..#',
    '#.########.#',
    '###.####.###',
    '############',
    '.##########.',
    '..#......#..',
    '.#........#.',
  ],
];

// type 1 = squid (row 1, 20 pts)
const SQUID_FRAMES = [
  [
    '...##...',
    '..####..',
    '.######.',
    '##.##.##',
    '########',
    '.#.##.#.',
    '#......#',
    '.#....#.',
  ],
  [
    '...##...',
    '..####..',
    '.######.',
    '##.##.##',
    '########',
    '..#..#..',
    '.#.##.#.',
    '#.#..#.#',
  ],
];

// type 2 = octopus (row 0, 30 pts)
const OCTOPUS_FRAMES = [
  [
    '....####....',
    '.##########.',
    '############',
    '###..##..###',
    '############',
    '...##..##...',
    '..##.##.##..',
    '##........##',
  ],
  [
    '....####....',
    '.##########.',
    '############',
    '###..##..###',
    '############',
    '..###..###..',
    '.##..##..##.',
    '..##....##..',
  ],
];

const CLASSIC_INVADER_FRAMES = [CRAB_FRAMES, SQUID_FRAMES, OCTOPUS_FRAMES];

// Baked once per (type, frame) on first use; the hot path only does drawImage (P7)
let classicInvaderSprites: HTMLCanvasElement[] | null = null;
let retroInvaderSprites: HTMLCanvasElement[] | null = null;
let neonInvaderSprites: HTMLCanvasElement[] | null = null;

type BakeOpts = {
  // retro: highlight sólido (sin blur) sobre el tercio superior del sprite,
  // recortado al silueta real vía composite 'source-atop' (no bleed).
  highlight?: boolean;
  // neon: pasada extra con shadowBlur horneada UNA vez en el offscreen canvas;
  // el hot path solo hace drawImage, nunca setea shadowBlur por frame.
  glowColor?: string;
  glowBlur?: number;
};

function bakeSprite(
  rows: string[],
  color: string,
  opts?: BakeOpts,
): HTMLCanvasElement {
  const w = rows[0].length;
  const h = rows.length;
  const pad = opts?.glowColor ? Math.ceil(opts.glowBlur ?? 6) : 0;
  const el = document.createElement('canvas');
  el.width = w * SPRITE_PX + pad * 2;
  el.height = h * SPRITE_PX + pad * 2;
  const c = el.getContext('2d')!;

  function fillPixels() {
    c.fillStyle = color;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (rows[y][x] === '#') {
          c.fillRect(pad + x * SPRITE_PX, pad + y * SPRITE_PX, SPRITE_PX, SPRITE_PX);
        }
      }
    }
  }

  if (opts?.glowColor) {
    c.shadowBlur = opts.glowBlur ?? 6;
    c.shadowColor = opts.glowColor;
    fillPixels();
    c.shadowBlur = 0;
  }
  fillPixels();

  if (opts?.highlight) {
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(0, 0, el.width, Math.ceil(h * SPRITE_PX * 0.32) + pad);
    c.globalCompositeOperation = 'source-over';
  }

  return el;
}

function getClassicInvaderSprites(): HTMLCanvasElement[] {
  if (classicInvaderSprites) return classicInvaderSprites;
  const sprites: HTMLCanvasElement[] = [];
  for (let type = 0; type < 3; type++) {
    for (let frame = 0; frame < 2; frame++) {
      sprites.push(bakeSprite(CLASSIC_INVADER_FRAMES[type][frame], CLASSIC_GREEN));
    }
  }
  classicInvaderSprites = sprites;
  return sprites;
}

function drawInvaderClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 0 | 1 | 2,
  frame: 0 | 1,
) {
  const spr = getClassicInvaderSprites()[type * 2 + frame];
  ctx.drawImage(spr, x + (INV_W - spr.width) / 2, y + (INV_H - spr.height) / 2);
}

function drawCannonClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
) {
  ctx.fillStyle = CLASSIC_GREEN;
  ctx.fillRect(x, y + 12 * scale, CANNON_W * scale, 8 * scale);
  ctx.fillRect(x + 4 * scale, y + 8 * scale, 32 * scale, 4 * scale);
  ctx.fillRect(x + 17 * scale, y + 2 * scale, 6 * scale, 6 * scale);
  ctx.fillRect(x + 19 * scale, y, 2 * scale, 4 * scale);
}

function drawUfoClassic(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = CLASSIC_UFO;
  ctx.fillRect(x + 12, y, 16, 5);
  ctx.fillRect(x + 4, y + 5, 32, 6);
  ctx.fillRect(x, y + 11, UFO_W, 4);
  ctx.fillStyle = '#ffd0d8';
  ctx.fillRect(x + 6, y + 12, 3, 2);
  ctx.fillRect(x + 15, y + 12, 3, 2);
  ctx.fillRect(x + 24, y + 12, 3, 2);
  ctx.fillRect(x + 33, y + 12, 3, 2);
}

function drawPlayerBulletClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = CLASSIC_BULLET;
  ctx.fillRect(x, y, BULLET_W, BULLET_H);
}

function drawEnemyBulletClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = CLASSIC_GREEN;
  ctx.fillRect(x, y, ENEMY_BULLET_W, 4);
  ctx.fillRect(x - 2, y + 3, ENEMY_BULLET_W, 4);
  ctx.fillRect(x + 2, y + 6, ENEMY_BULLET_W, 4);
}

function drawExplosionClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
) {
  const r = 4 + t * 9;
  ctx.fillStyle = CLASSIC_GREEN;
  ctx.fillRect(x - r, y - 1.5, 5, 3);
  ctx.fillRect(x + r - 5, y - 1.5, 5, 3);
  ctx.fillRect(x - 1.5, y - r, 3, 5);
  ctx.fillRect(x - 1.5, y + r - 5, 3, 5);
  const d = r * 0.7;
  ctx.fillRect(x - d, y - d, 3, 3);
  ctx.fillRect(x + d - 3, y - d, 3, 3);
  ctx.fillRect(x - d, y + d - 3, 3, 3);
  ctx.fillRect(x + d - 3, y + d - 3, 3, 3);
}

// ── retro (CRT: saturado/pastel, highlight sólido, sin shadowBlur) ────────────

const RETRO_CRAB = '#ffcf5c';
const RETRO_SQUID = '#7fe7ff';
const RETRO_OCTOPUS = '#ff8fc2';
const RETRO_INVADER_COLORS: readonly string[] = [RETRO_CRAB, RETRO_SQUID, RETRO_OCTOPUS];
const RETRO_UFO = '#ff6b6b';
const RETRO_UFO_DOME = '#ffe3d6';
const RETRO_PLAYER = '#fff275';
const RETRO_ENEMY_BULLET = '#c9a6ff';
const RETRO_SHIELD = '#8fd9c4';
const RETRO_HIGHLIGHT = 'rgba(255,255,255,0.35)';

function getRetroInvaderSprites(): HTMLCanvasElement[] {
  if (retroInvaderSprites) return retroInvaderSprites;
  const sprites: HTMLCanvasElement[] = [];
  for (let type = 0; type < 3; type++) {
    for (let frame = 0; frame < 2; frame++) {
      sprites.push(
        bakeSprite(CLASSIC_INVADER_FRAMES[type][frame], RETRO_INVADER_COLORS[type], {
          highlight: true,
        }),
      );
    }
  }
  retroInvaderSprites = sprites;
  return sprites;
}

function drawInvaderRetro(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 0 | 1 | 2,
  frame: 0 | 1,
) {
  const spr = getRetroInvaderSprites()[type * 2 + frame];
  ctx.drawImage(spr, x + (INV_W - spr.width) / 2, y + (INV_H - spr.height) / 2);
}

function drawCannonRetro(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
) {
  ctx.fillStyle = RETRO_PLAYER;
  ctx.fillRect(x, y + 12 * scale, CANNON_W * scale, 8 * scale);
  ctx.fillRect(x + 4 * scale, y + 8 * scale, 32 * scale, 4 * scale);
  ctx.fillRect(x + 17 * scale, y + 2 * scale, 6 * scale, 6 * scale);
  ctx.fillRect(x + 19 * scale, y, 2 * scale, 4 * scale);
  ctx.fillStyle = RETRO_HIGHLIGHT;
  ctx.fillRect(x + 4 * scale, y + 8 * scale, 32 * scale, Math.max(1, 2 * scale));
}

function drawUfoRetro(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = RETRO_UFO;
  ctx.fillRect(x + 12, y, 16, 5);
  ctx.fillRect(x + 4, y + 5, 32, 6);
  ctx.fillRect(x, y + 11, UFO_W, 4);
  ctx.fillStyle = RETRO_HIGHLIGHT;
  ctx.fillRect(x + 4, y + 5, 32, 2);
  ctx.fillStyle = RETRO_UFO_DOME;
  ctx.fillRect(x + 6, y + 12, 3, 2);
  ctx.fillRect(x + 15, y + 12, 3, 2);
  ctx.fillRect(x + 24, y + 12, 3, 2);
  ctx.fillRect(x + 33, y + 12, 3, 2);
}

function drawPlayerBulletRetro(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = RETRO_PLAYER;
  ctx.fillRect(x, y, BULLET_W, BULLET_H);
}

function drawEnemyBulletRetro(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = RETRO_ENEMY_BULLET;
  ctx.fillRect(x, y, ENEMY_BULLET_W, 4);
  ctx.fillRect(x - 2, y + 3, ENEMY_BULLET_W, 4);
  ctx.fillRect(x + 2, y + 6, ENEMY_BULLET_W, 4);
}

function drawExplosionRetro(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
) {
  const r = 4 + t * 9;
  ctx.fillStyle = RETRO_UFO;
  ctx.fillRect(x - r, y - 1.5, 5, 3);
  ctx.fillRect(x + r - 5, y - 1.5, 5, 3);
  ctx.fillRect(x - 1.5, y - r, 3, 5);
  ctx.fillRect(x - 1.5, y + r - 5, 3, 5);
  const d = r * 0.7;
  ctx.fillRect(x - d, y - d, 3, 3);
  ctx.fillRect(x + d - 3, y - d, 3, 3);
  ctx.fillRect(x - d, y + d - 3, 3, 3);
  ctx.fillRect(x + d - 3, y + d - 3, 3, 3);
}

// ── neon (glow eléctrico, boardBg negro puro) ──────────────────────────────────

const NEON_CRAB = '#00e5ff';
const NEON_SQUID = '#ff00e5';
const NEON_OCTOPUS = '#c6ff00';
const NEON_INVADER_COLORS: readonly string[] = [NEON_CRAB, NEON_SQUID, NEON_OCTOPUS];
const NEON_UFO = '#ff2079';
const NEON_UFO_DOME = '#ffffff';
const NEON_PLAYER = '#f5ff00';
const NEON_ENEMY_BULLET = '#ff00e5';
const NEON_SHIELD = '#39ff88';

function getNeonInvaderSprites(): HTMLCanvasElement[] {
  if (neonInvaderSprites) return neonInvaderSprites;
  const sprites: HTMLCanvasElement[] = [];
  for (let type = 0; type < 3; type++) {
    for (let frame = 0; frame < 2; frame++) {
      sprites.push(
        bakeSprite(CLASSIC_INVADER_FRAMES[type][frame], NEON_INVADER_COLORS[type], {
          glowColor: NEON_INVADER_COLORS[type],
          glowBlur: 6,
        }),
      );
    }
  }
  neonInvaderSprites = sprites;
  return sprites;
}

function drawInvaderNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 0 | 1 | 2,
  frame: 0 | 1,
) {
  const spr = getNeonInvaderSprites()[type * 2 + frame];
  ctx.drawImage(spr, x + (INV_W - spr.width) / 2, y + (INV_H - spr.height) / 2);
}

// Cañón, OVNI, balas y explosión se dibujan 1-11 veces por frame como máximo
// (nunca cientos, a diferencia de los píxeles de escudo) — glow en vivo con
// shadowBlur reseteado a mano tras cada trazo, mismo patrón que PacmanGame.
function drawCannonNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
) {
  ctx.shadowBlur = 10;
  ctx.shadowColor = NEON_PLAYER;
  ctx.fillStyle = NEON_PLAYER;
  ctx.fillRect(x, y + 12 * scale, CANNON_W * scale, 8 * scale);
  ctx.fillRect(x + 4 * scale, y + 8 * scale, 32 * scale, 4 * scale);
  ctx.fillRect(x + 17 * scale, y + 2 * scale, 6 * scale, 6 * scale);
  ctx.fillRect(x + 19 * scale, y, 2 * scale, 4 * scale);
  ctx.shadowBlur = 0;
}

function drawUfoNeon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.shadowBlur = 10;
  ctx.shadowColor = NEON_UFO;
  ctx.fillStyle = NEON_UFO;
  ctx.fillRect(x + 12, y, 16, 5);
  ctx.fillRect(x + 4, y + 5, 32, 6);
  ctx.fillRect(x, y + 11, UFO_W, 4);
  ctx.shadowBlur = 0;
  ctx.fillStyle = NEON_UFO_DOME;
  ctx.fillRect(x + 6, y + 12, 3, 2);
  ctx.fillRect(x + 15, y + 12, 3, 2);
  ctx.fillRect(x + 24, y + 12, 3, 2);
  ctx.fillRect(x + 33, y + 12, 3, 2);
}

function drawPlayerBulletNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.shadowBlur = 8;
  ctx.shadowColor = NEON_PLAYER;
  ctx.fillStyle = NEON_PLAYER;
  ctx.fillRect(x, y, BULLET_W, BULLET_H);
  ctx.shadowBlur = 0;
}

function drawEnemyBulletNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.shadowBlur = 8;
  ctx.shadowColor = NEON_ENEMY_BULLET;
  ctx.fillStyle = NEON_ENEMY_BULLET;
  ctx.fillRect(x, y, ENEMY_BULLET_W, 4);
  ctx.fillRect(x - 2, y + 3, ENEMY_BULLET_W, 4);
  ctx.fillRect(x + 2, y + 6, ENEMY_BULLET_W, 4);
  ctx.shadowBlur = 0;
}

function drawExplosionNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
) {
  const r = 4 + t * 9;
  ctx.shadowBlur = 10;
  ctx.shadowColor = NEON_UFO;
  ctx.fillStyle = NEON_UFO;
  ctx.fillRect(x - r, y - 1.5, 5, 3);
  ctx.fillRect(x + r - 5, y - 1.5, 5, 3);
  ctx.fillRect(x - 1.5, y - r, 3, 5);
  ctx.fillRect(x - 1.5, y + r - 5, 3, 5);
  const d = r * 0.7;
  ctx.fillRect(x - d, y - d, 3, 3);
  ctx.fillRect(x + d - 3, y - d, 3, 3);
  ctx.fillRect(x - d, y + d - 3, 3, 3);
  ctx.fillRect(x + d - 3, y + d - 3, 3, 3);
  ctx.shadowBlur = 0;
}

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'classic',
    bg: '#000000',
    hud: '#ffffff',
    hudAccent: CLASSIC_GREEN,
    shield: CLASSIC_GREEN_DIM,
    drawInvader: drawInvaderClassic,
    drawCannon: drawCannonClassic,
    drawUfo: drawUfoClassic,
    drawPlayerBullet: drawPlayerBulletClassic,
    drawEnemyBullet: drawEnemyBulletClassic,
    drawExplosion: drawExplosionClassic,
  },
  retro: {
    name: 'retro',
    bg: '#07070f',
    hud: '#fdf6e3',
    hudAccent: '#ffcf5c',
    shield: RETRO_SHIELD,
    drawInvader: drawInvaderRetro,
    drawCannon: drawCannonRetro,
    drawUfo: drawUfoRetro,
    drawPlayerBullet: drawPlayerBulletRetro,
    drawEnemyBullet: drawEnemyBulletRetro,
    drawExplosion: drawExplosionRetro,
  },
  neon: {
    name: 'neon',
    bg: '#000000',
    hud: '#eaffff',
    hudAccent: NEON_CRAB,
    shield: NEON_SHIELD,
    shieldGlow: NEON_SHIELD,
    drawInvader: drawInvaderNeon,
    drawCannon: drawCannonNeon,
    drawUfo: drawUfoNeon,
    drawPlayerBullet: drawPlayerBulletNeon,
    drawEnemyBullet: drawEnemyBulletNeon,
    drawExplosion: drawExplosionNeon,
  },
};

// ── State ─────────────────────────────────────────────────────────────────────

type Bullet = { x: number; y: number; active: boolean };

type GameState = {
  score: number;
  level: number;
  lives: number;
  over: boolean;
  invaders: Invader[];
  aliveCount: number;
  originX: number;
  originY: number;
  dir: 1 | -1;
  stepMs: number;
  boundsLeft: number;
  boundsRight: number;
  boundsBottom: number;
  fireMs: number;
  nextFireMs: number;
  playerBullet: Bullet;
  enemyBullets: Bullet[];
  cannonX: number;
  shields: Shield[];
  ufoActive: boolean;
  ufoX: number;
  ufoDir: 1 | -1;
  ufoMs: number;
  nextUfoMs: number;
  popupMs: number;
  popupX: number;
  popupPoints: number;
  flashMs: number;
  flashX: number;
  flashY: number;
  deathMs: number;
  clearMs: number;
};

function nextUfoDelay(): number {
  return UFO_MIN_MS + Math.random() * UFO_RANGE_MS;
}

function nextFireDelay(level: number): number {
  return waveFor(level)[1] * (0.6 + Math.random() * 0.8);
}

// Pre-sized enemy bullet pool (P1): max 11 slots, reused forever
function makeBulletPool(size: number): Bullet[] {
  const pool: Bullet[] = [];
  for (let i = 0; i < size; i++) pool.push({ x: 0, y: 0, active: false });
  return pool;
}

function loadWave(s: GameState) {
  s.invaders = createFormation();
  s.aliveCount = s.invaders.length;
  s.originX = FORMATION_START_X;
  s.originY = FORMATION_TOP + waveFor(s.level)[3];
  s.dir = 1;
  s.stepMs = 0;
  s.fireMs = 0;
  s.nextFireMs = nextFireDelay(s.level);
  s.shields = createShields(CANVAS_W, SHIELD_Y);
  s.playerBullet.active = false;
  for (let i = 0; i < s.enemyBullets.length; i++) s.enemyBullets[i].active = false;
  refreshBounds(s);
}

function refreshBounds(s: GameState) {
  const b = formationBounds(s.invaders, s.originX, s.originY);
  if (b === null) return;
  s.boundsLeft = b.left;
  s.boundsRight = b.right;
  s.boundsBottom = b.bottom;
}

function initialState(): GameState {
  const s: GameState = {
    score: 0,
    level: 1,
    lives: START_LIVES,
    over: false,
    invaders: [],
    aliveCount: 0,
    originX: FORMATION_START_X,
    originY: FORMATION_TOP,
    dir: 1,
    stepMs: 0,
    boundsLeft: 0,
    boundsRight: 0,
    boundsBottom: 0,
    fireMs: 0,
    nextFireMs: 0,
    playerBullet: { x: 0, y: 0, active: false },
    enemyBullets: makeBulletPool(MAX_ENEMY_BULLETS),
    cannonX: (CANVAS_W - CANNON_W) / 2,
    shields: [],
    ufoActive: false,
    ufoX: 0,
    ufoDir: 1,
    ufoMs: 0,
    nextUfoMs: nextUfoDelay(),
    popupMs: 0,
    popupX: 0,
    popupPoints: 0,
    flashMs: 0,
    flashX: 0,
    flashY: 0,
    deathMs: 0,
    clearMs: 0,
  };
  loadWave(s);
  return s;
}

// ── Component ─────────────────────────────────────────────────────────────────

function SpaceInvadersGame({
  paused,
  muted = false,
  skin = 'classic',
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: SpaceInvadersGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const skinRef = useRef<Skin>(SKINS[skin] ?? SKINS.classic);
  const stateRef = useRef<GameState | null>(null);
  if (stateRef.current === null) stateRef.current = initialState();

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    mutedRef.current = muted;
    sfxSpaceInvaders.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    skinRef.current = SKINS[skin] ?? SKINS.classic;
  }, [skin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current!;

    // Callbacks only on change (P6)
    let reportedScore = s.score;
    let reportedLevel = s.level;
    let reportedLives = s.lives;
    let endFired = false;
    let sfxReady = false;

    let leftDown = false;
    let rightDown = false;

    function report() {
      if (s.score !== reportedScore) {
        reportedScore = s.score;
        onScoreChange(s.score);
      }
      if (s.level !== reportedLevel) {
        reportedLevel = s.level;
        onLevelChange(s.level);
      }
      if (s.lives !== reportedLives) {
        reportedLives = s.lives;
        onLivesChange(s.lives);
      }
    }

    function deactivateBullets() {
      s.playerBullet.active = false;
      for (let i = 0; i < s.enemyBullets.length; i++) {
        s.enemyBullets[i].active = false;
      }
    }

    function despawnUfo() {
      if (!s.ufoActive) return;
      s.ufoActive = false;
      sfxSpaceInvaders.stop('ufo');
      s.ufoMs = 0;
      s.nextUfoMs = nextUfoDelay();
    }

    function gameOver() {
      s.over = true;
      s.lives = 0;
      report();
      despawnUfo();
      if (!endFired) {
        endFired = true;
        onGameOver(s.score);
        sfxSpaceInvaders.play('game_over');
      }
    }

    function hitShields(px: number, py: number): boolean {
      for (let i = 0; i < s.shields.length; i++) {
        const idx = shieldHitTest(s.shields[i], px, py);
        if (idx !== -1) {
          damageShield(s.shields[i], idx, SHIELD_DAMAGE_RADIUS);
          return true;
        }
      }
      return false;
    }

    function stepFormation() {
      const atEdge =
        s.dir > 0
          ? s.boundsRight + STEP_DX > CANVAS_W - EDGE_MARGIN
          : s.boundsLeft - STEP_DX < EDGE_MARGIN;
      if (atEdge) {
        s.originY += STEP_DOWN;
        s.dir = s.dir > 0 ? -1 : 1;
      } else {
        s.originX += s.dir * STEP_DX;
      }
      for (let i = 0; i < s.invaders.length; i++) {
        const inv = s.invaders[i];
        if (inv.alive) inv.animFrame = inv.animFrame === 0 ? 1 : 0;
      }
      refreshBounds(s);
      sfxSpaceInvaders.play('march', s.level);
      if (s.boundsBottom >= CANNON_Y) gameOver();
    }

    function fireEnemyBullet() {
      const shooters = shooterCells(s.invaders);
      if (shooters.length === 0) return;
      const shooter = shooters[(Math.random() * shooters.length) | 0];
      for (let i = 0; i < s.enemyBullets.length; i++) {
        const b = s.enemyBullets[i];
        if (b.active) continue;
        b.x = s.originX + shooter.col * CELL_W + INV_W / 2 - ENEMY_BULLET_W / 2;
        b.y = s.originY + shooter.row * CELL_H + INV_H;
        b.active = true;
        return;
      }
    }

    function killInvader(inv: Invader, ix: number, iy: number) {
      inv.alive = false;
      s.aliveCount--;
      s.score += pointsFor(inv.type);
      s.flashMs = FLASH_MS;
      s.flashX = ix + INV_W / 2;
      s.flashY = iy + INV_H / 2;
      sfxSpaceInvaders.play('invader_hit');
      if (s.aliveCount === 0) {
        s.level += 1;
        s.clearMs = CLEAR_PAUSE_MS;
        deactivateBullets();
        despawnUfo();
        sfxSpaceInvaders.play('level_clear');
      } else {
        refreshBounds(s);
      }
    }

    function updatePlayerBullet(dt: number) {
      const b = s.playerBullet;
      if (!b.active) return;
      b.y -= BULLET_SPEED * dt;
      if (b.y + BULLET_H < 0) {
        b.active = false;
        return;
      }
      if (hitShields(b.x + BULLET_W / 2, b.y)) {
        b.active = false;
        return;
      }
      if (
        s.ufoActive &&
        aabb(b.x, b.y, BULLET_W, BULLET_H, s.ufoX, UFO_Y, UFO_W, UFO_H)
      ) {
        b.active = false;
        const points = UFO_POINTS[(Math.random() * UFO_POINTS.length) | 0] * waveFor(s.level)[2];
        s.score += points;
        s.popupMs = POPUP_MS;
        s.popupX = s.ufoX + UFO_W / 2;
        s.popupPoints = points;
        despawnUfo();
        sfxSpaceInvaders.play('ufo_hit');
        return;
      }
      for (let i = 0; i < s.invaders.length; i++) {
        const inv = s.invaders[i];
        if (!inv.alive) continue;
        const ix = s.originX + inv.col * CELL_W;
        const iy = s.originY + inv.row * CELL_H;
        if (aabb(b.x, b.y, BULLET_W, BULLET_H, ix, iy, INV_W, INV_H)) {
          b.active = false;
          killInvader(inv, ix, iy);
          return;
        }
      }
    }

    function updateEnemyBullets(dt: number) {
      for (let i = 0; i < s.enemyBullets.length; i++) {
        const b = s.enemyBullets[i];
        if (!b.active) continue;
        b.y += ENEMY_BULLET_SPEED * dt;
        if (b.y > GROUND_Y) {
          b.active = false;
          continue;
        }
        if (hitShields(b.x + ENEMY_BULLET_W / 2, b.y + ENEMY_BULLET_H)) {
          b.active = false;
          continue;
        }
        if (
          aabb(
            b.x,
            b.y,
            ENEMY_BULLET_W,
            ENEMY_BULLET_H,
            s.cannonX,
            CANNON_Y,
            CANNON_W,
            CANNON_H,
          )
        ) {
          b.active = false;
          s.lives -= 1;
          sfxSpaceInvaders.play('player_hit');
          report();
          if (s.lives <= 0) {
            gameOver();
            return;
          }
          s.deathMs = DEATH_PAUSE_MS;
          deactivateBullets();
          return;
        }
      }
    }

    function updateUfo(dtMs: number, dt: number) {
      if (!s.ufoActive) {
        s.ufoMs += dtMs;
        if (s.ufoMs >= s.nextUfoMs) {
          s.ufoActive = true;
          s.ufoDir = Math.random() < 0.5 ? 1 : -1;
          s.ufoX = s.ufoDir > 0 ? -UFO_W : CANVAS_W;
          sfxSpaceInvaders.play('ufo');
        }
        return;
      }
      s.ufoX += s.ufoDir * UFO_SPEED * dt;
      if (s.ufoX > CANVAS_W || s.ufoX + UFO_W < 0) despawnUfo();
    }

    function update(dtMs: number) {
      // Bounded animation timers (P3)
      if (s.flashMs > 0) s.flashMs = Math.max(0, s.flashMs - dtMs);
      if (s.popupMs > 0) s.popupMs = Math.max(0, s.popupMs - dtMs);

      if (s.clearMs > 0) {
        s.clearMs -= dtMs;
        if (s.clearMs <= 0) {
          s.clearMs = 0;
          loadWave(s);
        }
        report();
        return;
      }

      if (s.deathMs > 0) {
        s.deathMs -= dtMs;
        if (s.deathMs <= 0) {
          s.deathMs = 0;
          s.cannonX = (CANVAS_W - CANNON_W) / 2;
        }
        return;
      }

      const dt = dtMs / 1000;

      if (leftDown && !rightDown) s.cannonX -= CANNON_SPEED * dt;
      else if (rightDown && !leftDown) s.cannonX += CANNON_SPEED * dt;
      if (s.cannonX < EDGE_MARGIN) s.cannonX = EDGE_MARGIN;
      if (s.cannonX > CANVAS_W - CANNON_W - EDGE_MARGIN) {
        s.cannonX = CANVAS_W - CANNON_W - EDGE_MARGIN;
      }

      s.stepMs += dtMs;
      const interval = stepInterval(s.level, s.aliveCount);
      if (s.stepMs >= interval) {
        s.stepMs -= interval;
        stepFormation();
        if (s.over) return;
      }

      s.fireMs += dtMs;
      if (s.fireMs >= s.nextFireMs) {
        s.fireMs = 0;
        s.nextFireMs = nextFireDelay(s.level);
        fireEnemyBullet();
      }

      updateUfo(dtMs, dt);
      updatePlayerBullet(dt);
      if (!s.over && s.clearMs === 0) updateEnemyBullets(dt);
      if (s.over) return;

      if (s.score > sessionHiScore) sessionHiScore = s.score;
      report();
    }

    // ── Draw ────────────────────────────────────────────────────────────────
    function drawShields(skinNow: Skin) {
      // P7: una fillRect con shadowBlur por escudo (no por-píxel) para el
      // halo ambiental neon; el relleno de píxeles de abajo va siempre sin blur.
      if (skinNow.shieldGlow) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = skinNow.shieldGlow;
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = skinNow.shieldGlow;
        for (let i = 0; i < s.shields.length; i++) {
          const sh = s.shields[i];
          ctx.fillRect(
            sh.x,
            sh.y,
            SHIELD_COLS * SHIELD_PX,
            SHIELD_ROWS * SHIELD_PX,
          );
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = skinNow.shield;
      for (let i = 0; i < s.shields.length; i++) {
        const sh = s.shields[i];
        const pixels = sh.pixels;
        for (let r = 0; r < SHIELD_ROWS; r++) {
          for (let c = 0; c < SHIELD_COLS; c++) {
            if (pixels[r * SHIELD_COLS + c] === 1) {
              ctx.fillRect(
                sh.x + c * SHIELD_PX,
                sh.y + r * SHIELD_PX,
                SHIELD_PX,
                SHIELD_PX,
              );
            }
          }
        }
      }
    }

    function drawHud(skinNow: Skin) {
      ctx.font = 'bold 14px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = skinNow.hud;
      ctx.fillText(`PUNTOS ${s.score}`, 10, HUD_TOP_H / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillText(`RÉCORD ${sessionHiScore}`, CANVAS_W / 2, HUD_TOP_H / 2);

      ctx.fillStyle = skinNow.shield;
      ctx.fillRect(0, GROUND_Y, CANVAS_W, 2);

      for (let i = 0; i < s.lives; i++) {
        skinNow.drawCannon(ctx, 10 + i * 32, HUD_BOTTOM_CY - 6, 0.6);
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillText(`NIVEL ${s.level}`, CANVAS_W - 10, HUD_BOTTOM_CY);
    }

    function draw() {
      const skinNow = skinRef.current;

      ctx.fillStyle = skinNow.bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      drawShields(skinNow);

      for (let i = 0; i < s.invaders.length; i++) {
        const inv = s.invaders[i];
        if (!inv.alive) continue;
        skinNow.drawInvader(
          ctx,
          s.originX + inv.col * CELL_W,
          s.originY + inv.row * CELL_H,
          inv.type,
          inv.animFrame,
        );
      }

      if (s.ufoActive) skinNow.drawUfo(ctx, s.ufoX, UFO_Y);

      if (s.playerBullet.active) {
        skinNow.drawPlayerBullet(ctx, s.playerBullet.x, s.playerBullet.y);
      }
      for (let i = 0; i < s.enemyBullets.length; i++) {
        const b = s.enemyBullets[i];
        if (b.active) skinNow.drawEnemyBullet(ctx, b.x, b.y);
      }

      const blinkOn = s.deathMs <= 0 || Math.floor(s.deathMs / 120) % 2 === 0;
      if (!s.over && blinkOn) skinNow.drawCannon(ctx, s.cannonX, CANNON_Y, 1);

      if (s.flashMs > 0) {
        skinNow.drawExplosion(ctx, s.flashX, s.flashY, 1 - s.flashMs / FLASH_MS);
      }

      if (s.popupMs > 0) {
        ctx.font = 'bold 14px monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = skinNow.hudAccent;
        ctx.fillText(`${s.popupPoints}`, s.popupX, UFO_Y + UFO_H / 2);
      }

      if (s.clearMs > 0) {
        ctx.font = 'bold 26px monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = skinNow.hudAccent;
        ctx.fillText(`¡NIVEL ${s.level}!`, CANVAS_W / 2, CANVAS_H * 0.45);
      }

      drawHud(skinNow);
    }

    // ── Loop ────────────────────────────────────────────────────────────────
    let rafId = 0;
    let last = performance.now();
    let overDrawn = false;

    function loop(ts: number) {
      const dtMs = Math.min(ts - last, 50);
      last = ts;

      if (pausedRef.current) {
        draw();
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (s.over) {
        if (!overDrawn) {
          draw();
          overDrawn = true;
        }
        rafId = requestAnimationFrame(loop);
        return;
      }

      update(dtMs);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    // ── Keyboard ────────────────────────────────────────────────────────────
    function isTypingTarget(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement | null;
      return (
        target !== null &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (!sfxReady) {
        sfxReady = true;
        sfxSpaceInvaders.init();
        sfxSpaceInvaders.setMuted(mutedRef.current);
      }
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        leftDown = true;
        e.preventDefault();
      } else if (key === 'arrowright' || key === 'd') {
        rightDown = true;
        e.preventDefault();
      } else if (key === ' ') {
        e.preventDefault();
        if (
          !s.over &&
          !pausedRef.current &&
          s.deathMs <= 0 &&
          s.clearMs <= 0 &&
          !s.playerBullet.active
        ) {
          s.playerBullet.x = s.cannonX + CANNON_W / 2 - BULLET_W / 2;
          s.playerBullet.y = CANNON_Y - BULLET_H;
          s.playerBullet.active = true;
          sfxSpaceInvaders.play('shoot');
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') leftDown = false;
      else if (key === 'arrowright' || key === 'd') rightDown = false;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      sfxSpaceInvaders.stop('ufo');
      sfxSpaceInvaders.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}

export default React.memo(SpaceInvadersGame);
