'use client';

import React, { useEffect, useRef } from 'react';

import {
  advance,
  createBag,
  swapCurrentNext,
  type Bag,
} from './bubble-logic/bag';
import {
  CANNON_X,
  CANNON_Y,
  CANVAS_H,
  CANVAS_W,
  COLS,
  DEATH_LINE_Y,
  PLAY_W,
  ROOF_Y,
  ROWS,
  cellX,
  cellY,
  colOf,
  createBoard,
  idx,
  rowOf,
  type Board,
} from './bubble-logic/grid';
import { configFor, COLOR_COUNT } from './bubble-logic/maps';
import {
  AIM_SPEED,
  AIM_STEP,
  clampAngle,
  createShot,
  fire,
  FLYING,
  stepShot,
  traceShot,
  type Shot,
} from './bubble-logic/shot';
import {
  createResolveOut,
  createRun,
  OUTCOME_LIFE_LOST,
  OUTCOME_MAP_CLEAR,
  OUTCOME_VICTORY,
  resolveShot,
  startMap,
  type RunState,
} from './bubble-logic/run';
import { sfxBubble } from '@/lib/sfx-bubble';

interface BubbleGameProps {
  paused: boolean;
  muted?: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (map: number) => void;
  onGameOver: (finalScore: number) => void;
  onVictory: (finalScore: number) => void;
}

// ── Tuning ──────────────────────────────────────────────────────────────────

const GRAVITY = 1400; // px/s^2, same value as kong-logic/player.ts
const FALL_POOL = 64;
const CLEAR_PAUSE_MS = 1400;
const LIFE_LOST_PAUSE_MS = 1200;
const START_ANGLE = Math.PI / 2; // straight up

// Fixed banner table — indexed, never rebuilt per frame
const BANNERS = ['¡MAPA SUPERADO!', 'VIDA PERDIDA'] as const;
const BANNER_CLEAR = 0;
const BANNER_LIFE_LOST = 1;

// Reused dash patterns for the live aim trace — the array itself is never
// recreated per frame, only referenced by setLineDash.
const TRACE_DASH = [6, 6];
const NO_DASH: number[] = [];

// ── Sprites (pre-baked pixel maps, Space Invaders / Karate Champ / Kong pattern) ──
// '.' = transparent; every other char maps to a skin colour at bake time.
// Ball: B = fill, H = highlight blob. Glyphs: G = magic-icon pixel. Cannon:
// B = body, C = accent stripe. Every map is 20x20 chars (BUBBLE_PX = 2 →
// 40x40 baked sprite, matching the D = 40 bubble diameter with no scaling),
// except the cannon which has its own logical grid/scale.

const BUBBLE_PX = 2;
const MAP_SIZE = 20;
const CANNON_PX = 3;
const CANNON_COLS = 12;
const CANNON_ROWS = 16;
const CANNON_SPR_W = CANNON_COLS * CANNON_PX;
const CANNON_SPR_H = CANNON_ROWS * CANNON_PX;

// Circle with a small highlight blob, computed once at module load — a
// precise filled disc is far less error-prone here than hand-typed ASCII art,
// and this only ever runs once (not per frame, not per component instance).
function buildBubbleMap(): string[] {
  const rows: string[] = [];
  const cx = 9.5;
  const cy = 9.5;
  const rOuter = 9.3;
  const hiCx = 7;
  const hiCy = 7;
  const rHi = 2.6;
  for (let y = 0; y < MAP_SIZE; y++) {
    let row = '';
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > rOuter * rOuter) {
        row += '.';
        continue;
      }
      const hdx = x - hiCx;
      const hdy = y - hiCy;
      row += hdx * hdx + hdy * hdy <= rHi * rHi ? 'H' : 'B';
    }
    rows.push(row);
  }
  return rows;
}

const BUBBLE_MAP = buildBubbleMap();

// ── Magic glyphs (20x20, one shared 'G' colour per glyph) ───────────────────
// Small procedural drawing helpers — module load only, never touched by the
// render loop.

function emptyGlyphGrid(): string[][] {
  const g: string[][] = [];
  for (let y = 0; y < MAP_SIZE; y++) g.push(new Array<string>(MAP_SIZE).fill('.'));
  return g;
}

function setGlyphPx(g: string[][], x: number, y: number, ch: string): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || xi >= MAP_SIZE || yi < 0 || yi >= MAP_SIZE) return;
  g[yi][xi] = ch;
}

function glyphLine(g: string[][], x0: number, y0: number, x1: number, y1: number, ch: string): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xe = Math.round(x1);
  const ye = Math.round(y1);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setGlyphPx(g, x, y, ch);
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function glyphRows(g: string[][]): string[] {
  return g.map((row) => row.join(''));
}

function buildBombGlyph(): string[] {
  const g = emptyGlyphGrid();
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - 9;
      const dy = y - 11;
      if (dx * dx + dy * dy <= 36) setGlyphPx(g, x, y, 'G');
    }
  }
  glyphLine(g, 12, 6, 15, 3, 'G');
  glyphLine(g, 15, 3, 17, 4, 'G');
  return glyphRows(g);
}

function buildRayGlyph(): string[] {
  const g = emptyGlyphGrid();
  glyphLine(g, 12, 2, 6, 10, 'G');
  glyphLine(g, 13, 2, 7, 10, 'G');
  glyphLine(g, 6, 10, 13, 10, 'G');
  glyphLine(g, 7, 10, 14, 10, 'G');
  glyphLine(g, 13, 10, 7, 18, 'G');
  glyphLine(g, 14, 10, 8, 18, 'G');
  return glyphRows(g);
}

function buildPurgeGlyph(): string[] {
  const g = emptyGlyphGrid();
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - 9.5;
      const dy = y - 9.5;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 64 && d2 >= 40) setGlyphPx(g, x, y, 'G');
    }
  }
  glyphLine(g, 6, 6, 13, 13, 'G');
  glyphLine(g, 13, 6, 6, 13, 'G');
  return glyphRows(g);
}

function buildAnchorGlyph(): string[] {
  const g = emptyGlyphGrid();
  const cx = 9.5;
  const cy = 9.5;
  const len = 8;
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    glyphLine(g, cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, 'G');
  }
  return glyphRows(g);
}

// Index 0 unused (colour 0 / magic 0 never renders) — indices 1-4 match
// MAGIC_BOMB/MAGIC_RAY/MAGIC_PURGE/MAGIC_ANCHOR from maps.ts directly.
const GLYPH_MAPS: readonly (string[] | null)[] = [
  null,
  buildBombGlyph(),
  buildRayGlyph(),
  buildPurgeGlyph(),
  buildAnchorGlyph(),
];

const CANNON_MAP = [
  '....CC......',
  '....BB......',
  '....BB......',
  '....BB......',
  '....BB......',
  '....BB......',
  '...BCCB.....',
  '...BCCB.....',
  '..BBCCBB....',
  '..BBCCBB....',
  '.BBBCCBBB...',
  '.BBBCCBBB...',
  'BBBBCCBBBB..',
  'BBBBCCBBBB..',
  'BBBBCCBBBB..',
  'BBBBCCBBBB..',
];

type BakeOpts = {
  highlight?: boolean;
  glowColor?: string;
  glowBlur?: number;
};

// Own to this component (each game defines its own — KongGame.tsx:383 is the
// referenced pattern). `flip` is kept for signature parity even though every
// call site here passes false: every sprite baked in this file is symmetric.
function bakeSprite(
  rows: readonly string[],
  px: number,
  palette: Record<string, string>,
  flip: boolean,
  opts?: BakeOpts,
): HTMLCanvasElement {
  const w = rows[0].length;
  const h = rows.length;
  const pad = opts?.glowColor ? Math.ceil(opts.glowBlur ?? 6) : 0;
  const el = document.createElement('canvas');
  el.width = w * px + pad * 2;
  el.height = h * px + pad * 2;
  const c = el.getContext('2d')!;

  function fillPixels() {
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const ch = row[flip ? w - 1 - x : x];
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) continue;
        c.fillStyle = color;
        c.fillRect(pad + x * px, pad + y * px, px, px);
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
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(0, 0, el.width, Math.ceil(h * px * 0.3) + pad);
    c.globalCompositeOperation = 'source-over';
  }

  return el;
}

// ── Skins ─────────────────────────────────────────────────────────────────

type BubbleSkin = {
  name: string;
  bg: string;
  playBg: string;
  roof: string;
  roofEdge: string;
  wallLine: string;
  deathLine: string;
  hudText: string;
  hudAccent: string;
  hudDim: string;
  cannonBody: string;
  cannonAccent: string;
  ballHighlight: string;
  glyph: string;
  colors: readonly string[]; // index 0..5 => colour id 1..6
};

const SKINS: Record<string, BubbleSkin> = {
  classic: {
    name: 'classic',
    bg: '#05050f',
    playBg: '#0a0a1a',
    roof: '#3a3a55',
    roofEdge: '#7a7ab0',
    wallLine: '#2a2a44',
    deathLine: '#ff3355',
    hudText: '#ffffff',
    hudAccent: '#ffd700',
    hudDim: '#8a8fb5',
    cannonBody: '#c8c8d8',
    cannonAccent: '#ff2d8e',
    ballHighlight: 'rgba(255,255,255,0.85)',
    glyph: '#101018',
    colors: ['#ff3b3b', '#3b7bff', '#ffe23b', '#3bff6a', '#ff3bd1', '#3bf0ff'],
  },
  retro: {
    name: 'retro',
    bg: '#1c1330',
    playBg: '#241a3d',
    roof: '#5a4a7a',
    roofEdge: '#a893c9',
    wallLine: '#4a3a66',
    deathLine: '#ff8a80',
    hudText: '#fef6e4',
    hudAccent: '#ffd97a',
    hudDim: '#b8a8d8',
    cannonBody: '#e3d6ff',
    cannonAccent: '#ff9ecf',
    ballHighlight: 'rgba(255,255,255,0.55)',
    glyph: '#2a1f40',
    colors: ['#ff9ecf', '#8ff0ff', '#ffe08a', '#a8f0a0', '#e0a0ff', '#8affea'],
  },
  neon: {
    name: 'neon',
    bg: '#000000',
    playBg: '#000000',
    roof: '#ff00e5',
    roofEdge: '#ff6df0',
    wallLine: '#00f5ff',
    deathLine: '#ff2d55',
    hudText: '#eafcff',
    hudAccent: '#ffd400',
    hudDim: '#5ad4e0',
    cannonBody: '#00f5ff',
    cannonAccent: '#ffd400',
    ballHighlight: 'rgba(255,255,255,0.9)',
    glyph: '#ffffff',
    colors: ['#ff2d55', '#00aaff', '#ffe400', '#39ff6a', '#ff00e5', '#00f5ff'],
  },
};

type BubbleSprites = {
  balls: HTMLCanvasElement[]; // index 1..6 used
  glyphs: HTMLCanvasElement[]; // index 1..4 used (MagicId)
  cannon: HTMLCanvasElement;
};

const spriteCache: Record<string, BubbleSprites> = {};

function getSprites(skin: BubbleSkin): BubbleSprites {
  const cached = spriteCache[skin.name];
  if (cached) return cached;

  const isRetro = skin.name === 'retro';
  const isNeon = skin.name === 'neon';
  const glow = (color: string): BakeOpts => ({
    highlight: isRetro,
    glowColor: isNeon ? color : undefined,
    glowBlur: 6,
  });

  const balls: HTMLCanvasElement[] = [document.createElement('canvas')]; // index 0 unused
  for (let i = 0; i < COLOR_COUNT; i++) {
    const color = skin.colors[i];
    balls.push(
      bakeSprite(BUBBLE_MAP, BUBBLE_PX, { B: color, H: skin.ballHighlight }, false, glow(color)),
    );
  }

  const glyphs: HTMLCanvasElement[] = [document.createElement('canvas')]; // index 0 unused
  for (let m = 1; m <= 4; m++) {
    const rows = GLYPH_MAPS[m]!;
    glyphs.push(bakeSprite(rows, BUBBLE_PX, { G: skin.glyph }, false, glow(skin.glyph)));
  }

  const cannon = bakeSprite(
    CANNON_MAP,
    CANNON_PX,
    { B: skin.cannonBody, C: skin.cannonAccent },
    false,
    glow(skin.cannonBody),
  );

  const sprites: BubbleSprites = { balls, glyphs, cannon };
  spriteCache[skin.name] = sprites;
  return sprites;
}

// ── Board baking (rehorneado solo cuando el tablero cambia de verdad) ───────

function bakeBoard(skin: BubbleSkin, board: Board, sprites: BubbleSprites): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = PLAY_W;
  el.height = DEATH_LINE_Y;
  const c = el.getContext('2d')!;

  c.fillStyle = skin.playBg;
  c.fillRect(0, 0, PLAY_W, DEATH_LINE_Y);

  // side wall accents
  c.fillStyle = skin.wallLine;
  c.fillRect(0, 0, 2, DEATH_LINE_Y);
  c.fillRect(PLAY_W - 2, 0, 2, DEATH_LINE_Y);

  // roof bar
  const roofGlow = skin.name === 'neon';
  if (roofGlow) {
    c.shadowBlur = 8;
    c.shadowColor = skin.roof;
  }
  c.fillStyle = skin.roof;
  c.fillRect(0, 0, PLAY_W, ROOF_Y);
  if (roofGlow) c.shadowBlur = 0;
  c.fillStyle = skin.roofEdge;
  c.fillRect(0, ROOF_Y - 2, PLAY_W, 2);

  // bubbles (colour + magic glyph on top)
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      const i = idx(r, col);
      const color = board.color[i];
      if (color === 0) continue;
      const x = cellX(r, col, board.parity);
      const y = cellY(r);
      const spr = sprites.balls[color];
      c.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
      const magic = board.magic[i];
      if (magic !== 0) {
        const glyphSpr = sprites.glyphs[magic];
        c.drawImage(glyphSpr, x - glyphSpr.width / 2, y - glyphSpr.height / 2);
      }
    }
  }

  // death line, dashed — baked once, never live
  c.strokeStyle = skin.deathLine;
  c.lineWidth = 2;
  c.beginPath();
  for (let x = 0; x < PLAY_W; x += 12) {
    c.moveTo(x, DEATH_LINE_Y - 2);
    c.lineTo(Math.min(x + 7, PLAY_W), DEATH_LINE_Y - 2);
  }
  c.stroke();

  return el;
}

// ── State ─────────────────────────────────────────────────────────────────

type Phase = 'play' | 'clear' | 'lifeLost' | 'over';

function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  return (
    target !== null &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

function BubbleGame({
  paused,
  muted = false,
  skinKey = 'classic',
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  onVictory,
}: BubbleGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const skinRef = useRef<BubbleSkin>(SKINS[skinKey] ?? SKINS.classic);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    mutedRef.current = muted;
    sfxBubble.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    skinRef.current = SKINS[skinKey] ?? SKINS.classic;
  }, [skinKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── Domain state — created once, outside the loop ─────────────────────
    const board = createBoard();
    const run: RunState = createRun();
    const bag: Bag = createBag();
    const shot: Shot = createShot();
    const resolveOut = createResolveOut();
    const tracePts = new Float32Array(64);

    // Falling-bubble pool: parallel typed arrays, never an array of objects.
    const fallX = new Float32Array(FALL_POOL);
    const fallY = new Float32Array(FALL_POOL);
    const fallVY = new Float32Array(FALL_POOL);
    const fallColor = new Uint8Array(FALL_POOL);
    const fallActive = new Uint8Array(FALL_POOL);

    let cfg = configFor(run.map);
    startMap(board, cfg, run, bag, Math.random);

    let phase: Phase = 'play';
    let phaseMs = 0;
    let banner = -1;
    let angle = START_ANGLE;
    let endFired = false;
    let sfxReady = false;

    let leftDown = false;
    let rightDown = false;
    let fireHeld = false;
    let fireQueued = false;
    let swapHeld = false;
    let swapQueued = false;

    let boardCanvas: HTMLCanvasElement | null = null;
    let bakedSkinName = '';

    function rebake() {
      const skin = skinRef.current;
      boardCanvas = bakeBoard(skin, board, getSprites(skin));
      bakedSkinName = skin.name;
    }
    rebake();

    // Callbacks only on change — HUD strings cached so draw() allocates none.
    let reportedScore = run.score;
    let reportedLives = run.lives;
    let reportedMap = run.map;
    let scoreText = `PUNTOS ${run.score}`;
    let mapText = `MAPA ${run.map}`;
    let ceilingText = `TECHO ${Math.max(0, cfg.dropEvery - run.shotsSinceDrop)}`;
    let anchorText = '';

    function refreshHudText() {
      scoreText = `PUNTOS ${run.score}`;
      mapText = `MAPA ${run.map}`;
      ceilingText = `TECHO ${Math.max(0, cfg.dropEvery - run.shotsSinceDrop)}`;
      anchorText = run.anchorShots > 0 ? `ANCLA ${run.anchorShots}` : '';
    }
    refreshHudText();

    function report() {
      let changed = false;
      if (run.score !== reportedScore) {
        reportedScore = run.score;
        changed = true;
      }
      if (run.lives !== reportedLives) {
        reportedLives = run.lives;
        onLivesChange(run.lives);
      }
      if (run.map !== reportedMap) {
        reportedMap = run.map;
        onLevelChange(run.map);
      }
      if (changed) onScoreChange(run.score);
      refreshHudText();
    }

    function doGameOver() {
      phase = 'over';
      report();
      if (!endFired) {
        endFired = true;
        sfxBubble.play('game_over');
        onGameOver(run.score);
      }
    }

    function doVictory() {
      phase = 'over';
      report();
      if (!endFired) {
        endFired = true;
        onVictory(run.score);
      }
    }

    function findFreeFallSlot(): number {
      for (let i = 0; i < FALL_POOL; i++) {
        if (!fallActive[i]) return i;
      }
      return -1;
    }

    function dumpFallen() {
      for (let i = 0; i < resolveOut.fallenN; i++) {
        const slot = findFreeFallSlot();
        if (slot === -1) continue;
        const cell = resolveOut.fallen[i];
        const r = rowOf(cell);
        const c = colOf(cell);
        fallX[slot] = cellX(r, c, resolveOut.parityAtPop);
        fallY[slot] = cellY(r);
        fallVY[slot] = 0;
        fallColor[slot] = resolveOut.fallenColor[i];
        fallActive[slot] = 1;
      }
    }

    // Bubbles fall past DEATH_LINE_Y, into the HUD/cannon area, before being
    // deactivated — off the bottom of the whole 700px canvas, not just off
    // the 550px boardCanvas.
    const FALL_DESPAWN_Y = 700 + 40;

    function updateFallPool(dtMs: number) {
      const dtSec = dtMs / 1000;
      for (let i = 0; i < FALL_POOL; i++) {
        if (!fallActive[i]) continue;
        fallVY[i] += GRAVITY * dtSec;
        fallY[i] += fallVY[i] * dtSec;
        if (fallY[i] > FALL_DESPAWN_Y) fallActive[i] = 0;
      }
    }

    function resolveAnchor(cell: number) {
      board.color[cell] = shot.color;
      board.magic[cell] = shot.magic;
      resolveShot(board, cfg, run, bag, cell, Math.random, resolveOut);

      dumpFallen();
      rebake();
      advance(bag, Math.random);

      sfxBubble.play('stick');
      if (resolveOut.poppedN >= 3) sfxBubble.play('pop');
      if (resolveOut.magicHit !== 0) sfxBubble.play('magic');
      if (resolveOut.ceilingDropped) sfxBubble.play('drop');

      if (resolveOut.outcome === OUTCOME_MAP_CLEAR) {
        run.map += 1;
        cfg = configFor(run.map);
        startMap(board, cfg, run, bag, Math.random);
        rebake();
        banner = BANNER_CLEAR;
        phase = 'clear';
        phaseMs = CLEAR_PAUSE_MS;
        sfxBubble.play('map_clear');
      } else if (resolveOut.outcome === OUTCOME_LIFE_LOST) {
        if (run.lives > 0) {
          startMap(board, cfg, run, bag, Math.random);
          rebake();
          banner = BANNER_LIFE_LOST;
          phase = 'lifeLost';
          phaseMs = LIFE_LOST_PAUSE_MS;
          sfxBubble.play('life_lost');
        } else {
          doGameOver();
        }
      } else if (resolveOut.outcome === OUTCOME_VICTORY) {
        sfxBubble.play('victory');
        doVictory();
      }

      report();
    }

    function updatePlay(dtMs: number) {
      const dtSec = dtMs / 1000;
      if (leftDown) angle = clampAngle(angle + AIM_SPEED * dtSec);
      if (rightDown) angle = clampAngle(angle - AIM_SPEED * dtSec);

      if (swapQueued) {
        swapQueued = false;
        if (!shot.live) swapCurrentNext(bag);
      }

      if (fireQueued) {
        fireQueued = false;
        if (!shot.live) {
          fire(shot, angle, bag.current, 0);
          sfxBubble.play('shoot');
        }
      }

      if (shot.live) {
        const bouncesBefore = shot.bounces;
        const cell = stepShot(board, shot, dtMs);
        if (shot.bounces > bouncesBefore) sfxBubble.play('bounce');
        if (cell !== FLYING) resolveAnchor(cell);
      }
    }

    function update(dtMs: number) {
      updateFallPool(dtMs);
      switch (phase) {
        case 'play':
          updatePlay(dtMs);
          return;
        case 'clear':
        case 'lifeLost':
          phaseMs -= dtMs;
          if (phaseMs <= 0) {
            phase = 'play';
            banner = -1;
          }
          return;
        case 'over':
          return;
      }
    }

    // ── Draw ──────────────────────────────────────────────────────────────

    // Two scalar-returning functions instead of one returning {x, y}: an
    // object literal here would allocate every frame the shot sits idle.
    const MUZZLE_LEN = 46;
    function muzzleX(): number {
      return CANNON_X + Math.cos(angle) * MUZZLE_LEN;
    }
    function muzzleY(): number {
      return CANNON_Y - Math.sin(angle) * MUZZLE_LEN;
    }

    function drawCannon(sprites: BubbleSprites) {
      const spr = sprites.cannon;
      const pad = (spr.height - CANNON_SPR_H) / 2;
      ctx.save();
      ctx.translate(CANNON_X, CANNON_Y);
      ctx.rotate(Math.PI / 2 - angle);
      ctx.drawImage(spr, -spr.width / 2, -spr.height + pad);
      ctx.restore();
    }

    function drawTrace(skin: BubbleSkin) {
      const n = traceShot(board, angle, tracePts, 64);
      if (n < 2) return;
      ctx.strokeStyle = skin.hudAccent;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.setLineDash(TRACE_DASH);
      ctx.beginPath();
      ctx.moveTo(tracePts[0], tracePts[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(tracePts[i * 2], tracePts[i * 2 + 1]);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
      ctx.globalAlpha = 1;
    }

    // Hoisted out of drawHud (declared once, not per call): a function
    // declaration nested inside a function body is a fresh closure on every
    // invocation, and drawHud runs every frame.
    const HUD_X = PLAY_W + 20;
    function drawHudLabel(skin: BubbleSkin, text: string, y: number) {
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = skin.hudDim;
      ctx.fillText(text, HUD_X, y);
    }
    function drawHudValue(skin: BubbleSkin, text: string, y: number, color: string) {
      const isNeon = skin.name === 'neon';
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = color;
      if (isNeon) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
      }
      ctx.fillText(text, HUD_X, y);
      if (isNeon) ctx.shadowBlur = 0;
    }

    function drawHud(skin: BubbleSkin, sprites: BubbleSprites) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      drawHudLabel(skin, 'MAPA', 46);
      drawHudValue(skin, mapText, 72, skin.hudAccent);

      drawHudLabel(skin, 'PUNTOS', 126);
      drawHudValue(skin, scoreText, 152, skin.hudText);

      drawHudLabel(skin, 'TECHO', 206);
      drawHudValue(skin, ceilingText, 232, skin.hudDim);

      if (run.anchorShots > 0) {
        drawHudLabel(skin, 'ANCLA', 286);
        drawHudValue(skin, anchorText, 312, skin.hudAccent);
      }

      drawHudLabel(skin, 'SIGUIENTE', 400);
      const nextSpr = sprites.balls[bag.next || bag.current];
      const nx = HUD_X + 16;
      const ny = 440;
      const size = 32;
      ctx.drawImage(nextSpr, nx - size / 2, ny - size / 2, size, size);
    }

    function drawBanner(skin: BubbleSkin) {
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = skin.hudAccent;
      if (skin.name === 'neon') {
        ctx.shadowBlur = 14;
        ctx.shadowColor = skin.hudAccent;
        ctx.fillText(BANNERS[banner], PLAY_W / 2, DEATH_LINE_Y / 2);
        ctx.shadowBlur = 0;
        return;
      }
      ctx.fillText(BANNERS[banner], PLAY_W / 2, DEATH_LINE_Y / 2);
    }

    function draw() {
      const skin = skinRef.current;
      const sprites = getSprites(skin);

      if (boardCanvas === null || bakedSkinName !== skin.name) rebake();

      ctx.fillStyle = skin.bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(boardCanvas!, 0, 0);

      // falling bubbles
      for (let i = 0; i < FALL_POOL; i++) {
        if (!fallActive[i]) continue;
        const spr = sprites.balls[fallColor[i]];
        ctx.drawImage(spr, fallX[i] - spr.width / 2, fallY[i] - spr.height / 2);
      }

      if (!shot.live && phase === 'play') drawTrace(skin);

      drawCannon(sprites);

      if (shot.live) {
        const spr = sprites.balls[shot.color];
        ctx.drawImage(spr, shot.px - spr.width / 2, shot.py - spr.height / 2);
      } else {
        const spr = sprites.balls[bag.current || 1];
        ctx.drawImage(spr, muzzleX() - spr.width / 2, muzzleY() - spr.height / 2);
      }

      drawHud(skin, sprites);

      if (banner >= 0 && (phase === 'clear' || phase === 'lifeLost')) drawBanner(skin);
    }

    // ── Loop ──────────────────────────────────────────────────────────────
    let rafId = 0;
    let last = performance.now();
    let overDrawn = false;

    function loop(ts: number) {
      const dtMs = Math.min(ts - last, 50);
      last = ts;

      if (pausedRef.current) {
        fireQueued = false;
        swapQueued = false;
        draw();
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (phase === 'over') {
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

    // ── Keyboard ──────────────────────────────────────────────────────────
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (!sfxReady) {
        sfxReady = true;
        sfxBubble.init();
        sfxBubble.setMuted(mutedRef.current);
      }
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        e.preventDefault();
        if (!leftDown) angle = clampAngle(angle + AIM_STEP);
        leftDown = true;
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault();
        if (!rightDown) angle = clampAngle(angle - AIM_STEP);
        rightDown = true;
      } else if (key === ' ' || key === 'j') {
        e.preventDefault();
        if (!fireHeld) {
          fireHeld = true;
          fireQueued = true;
        }
      } else if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
        if (!swapHeld) {
          swapHeld = true;
          swapQueued = true;
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') leftDown = false;
      else if (key === 'arrowright' || key === 'd') rightDown = false;
      else if (key === ' ' || key === 'j') fireHeld = false;
      else if (key === 'arrowdown' || key === 's') swapHeld = false;
    }

    // Window blur is the repo's #1 transversal bug (no other game handles
    // it): without this, alt-tabbing while a direction is held leaves it
    // "stuck" — the cannon keeps spinning after focus returns. Bubble fixes
    // it locally from day one.
    function handleBlur() {
      leftDown = false;
      rightDown = false;
      fireHeld = false;
      fireQueued = false;
      swapHeld = false;
      swapQueued = false;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      sfxBubble.dispose();
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

export default React.memo(BubbleGame);
