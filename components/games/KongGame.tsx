'use client';

import React, { useEffect, useRef } from 'react';

import {
  advanceBarrel,
  atGirderEnd,
  descendLadder,
  dropToNextGirder,
  enterLadder,
  MAX_BARRELS,
  shouldTakeLadder,
  spawnBarrel,
  type Barrel,
} from './kong-logic/barrels';
import {
  brokenLadderSet,
  CANVAS_H,
  CANVAS_W,
  configFor,
  GIRDERS,
  girderYAt,
  HAMMERS,
  KONG,
  LADDERS,
  PLAYER_SPAWN,
  TROPHY,
  type Girder,
  type Ladder,
} from './kong-logic/level';
import { stepPlayer, type Input, type Player } from './kong-logic/player';
import {
  HAMMER_MS,
  jumpedOver,
  LEVEL_TIME_MS,
  SCORE_JUMP,
  SCORE_LEVEL,
  SCORE_SMASH,
  timeBonus,
} from './kong-logic/scoring';
import { sfxKong } from '@/lib/sfx-kong';

interface KongGameProps {
  paused: boolean;
  muted?: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Tuning (spec 26) ──────────────────────────────────────────────────────────

const START_LIVES = 3;
const GIRDER_T = 14;
const FIRST_SPAWN_MS = 900;
const KONG_THROW_POSE_MS = 450;
const DEATH_PAUSE_MS = 1300;
const CLEAR_PAUSE_MS = 1700;
const RUN_FRAME_MS = 110;
const HAMMER_SWING_MS = 160;
const CLIMB_TICK_MS = 150;
const TIMER_LOW_S = 15;
const LADDER_TAKE_TOL = 8;

// Collision boxes (independent of sprite canvas sizes)
const PLAYER_W = 16;
const PLAYER_H = 30;
const PLAYER_HALF = PLAYER_W / 2;
const BARREL_W = 14;
const BARREL_H = 12;
const HAMMER_REACH = 24;
const HAMMER_PICKUP_X = 14;
const HAMMER_PICKUP_Y = 22;
const TROPHY_REACH_X = 22;

// Fixed banner table — indexed, never rebuilt per frame
const BANNERS = ['¡TROFEO!', '¡OTRA VEZ!'] as const;
const BANNER_TROPHY = 0;
const BANNER_RETRY = 1;

// Pre-built timer strings: the HUD never allocates a string per frame
const TIMER_TEXT: string[] = [];
for (let i = 0; i <= 90; i++) TIMER_TEXT.push(String(i));

// Derived static positions (pure math over level.ts constants)
const HAMMER_POS = HAMMERS.map((h) => ({
  x: h.x,
  y: girderYAt(GIRDERS[h.girder], h.x),
}));
const KONG_FOOT_Y = girderYAt(GIRDERS[5], KONG.x);

// ── Sprites (pre-baked pixel maps, Space Invaders / Karate Champ pattern) ─────
// '.' = transparent; every other char maps to a skin color at bake time.
// Player: W body, C accent, H hammer head, h hammer handle. Kong: K body,
// F face/chest. Barrel: R wood, r stave. Trophy: T gold.

const PLAYER_PX = 2;
const KONG_PX = 3;
const BARREL_PX = 2;
const HAMMER_PX = 2;
const TROPHY_PX = 2;

const POSE_RUN0 = 0;
const POSE_RUN1 = 1;
const POSE_RUN2 = 2;
const POSE_JUMP = 3;
const POSE_CLIMB0 = 4;
const POSE_CLIMB1 = 5;
const POSE_HAMMER0 = 6;
const POSE_HAMMER1 = 7;

const RUN0_MAP = [
  '................',
  '................',
  '......CCCC......',
  '.....CCCCCC.....',
  '.....WWWWWW.....',
  '.....WWWWWW.....',
  '......WWWW......',
  '....CWWWWWWC....',
  '...CC.WWWW.CC...',
  '...C..WWWW..C...',
  '......WWWW......',
  '.....CWWWWC.....',
  '.....CC..CC.....',
  '....CC....CC....',
  '....CC.....CC...',
  '...CC.......CC..',
  '...WW.......WW..',
  '..WW.........WW.',
];

const RUN1_MAP = [
  '................',
  '................',
  '......CCCC......',
  '.....CCCCCC.....',
  '.....WWWWWW.....',
  '.....WWWWWW.....',
  '......WWWW......',
  '.....CWWWWC.....',
  '.....CWWWWC.....',
  '......WWWW......',
  '......WWWW......',
  '.....CWWWWC.....',
  '......CCCC......',
  '......CCCC......',
  '......CCCC......',
  '......CC.CC.....',
  '.....WWW.WW.....',
  '.....WW...WW....',
];

const RUN2_MAP = [
  '................',
  '................',
  '......CCCC......',
  '.....CCCCCC.....',
  '.....WWWWWW.....',
  '.....WWWWWW.....',
  '......WWWW......',
  '....CWWWWWWC....',
  '...CC.WWWW.CC...',
  '...C..WWWW..C...',
  '......WWWW......',
  '.....CWWWWC.....',
  '.....CC..CC.....',
  '.....CC..CC.....',
  '....CC....CC....',
  '....CC....CC....',
  '....WW....WW....',
  '...WW......WW...',
];

const JUMP_MAP = [
  '................',
  '...C........C...',
  '...C..CCCC..C...',
  '...CCCCCCCCCC...',
  '.....WWWWWW.....',
  '.....WWWWWW.....',
  '......WWWW......',
  '......WWWW......',
  '......WWWW......',
  '.....CWWWWC.....',
  '.....CWWWWC.....',
  '.....CC..CC.....',
  '....CC....CC....',
  '...CC......CC...',
  '...WW......WW...',
  '................',
  '................',
  '................',
];

const CLIMB0_MAP = [
  '................',
  '....CC..........',
  '....CC..........',
  '....CCCCCC......',
  '.....CCCC.......',
  '.....WWWWWW.....',
  '.....WWWWWW.....',
  '.....WWWWWWCC...',
  '.....WWWW..CC...',
  '.....WWWW.......',
  '.....WWWW.......',
  '.....CWWC.......',
  '.....CC.CC......',
  '.....CC.CC......',
  '.....CC..CC.....',
  '.....WW..CC.....',
  '.........WW.....',
  '................',
];

// The second climb frame is the exact mirror — computed once at module load
const CLIMB1_MAP = CLIMB0_MAP.map((r) => r.split('').reverse().join(''));

const HAMMER0_MAP = [
  '.....HHHHHH.....',
  '.....HHHHHH.....',
  '.......hh.......',
  '.......hh.......',
  '......CCCC......',
  '.....CCCCCC.....',
  '.....WWWWWW.....',
  '.....WWWWWW.....',
  '......WWWW......',
  '.....CWWWWC.....',
  '.....CWWWWC.....',
  '......WWWW......',
  '......WWWW......',
  '.....CWWWWC.....',
  '.....CC..CC.....',
  '....CC....CC....',
  '....WW....WW....',
  '...WW......WW...',
];

const HAMMER1_MAP = [
  '................',
  '................',
  '......CCCC......',
  '.....CCCCCC.....',
  '.....WWWWWW.....',
  '.....WWWWWW.....',
  '......WWWWhhHH..',
  '......WWWWhhHH..',
  '......WWWW..HH..',
  '.....CWWWWC.....',
  '.....CWWWWC.....',
  '......WWWW......',
  '......WWWW......',
  '.....CWWWWC.....',
  '.....CC..CC.....',
  '....CC....CC....',
  '....WW....WW....',
  '...WW......WW...',
];

const PLAYER_POSES = [
  RUN0_MAP,
  RUN1_MAP,
  RUN2_MAP,
  JUMP_MAP,
  CLIMB0_MAP,
  CLIMB1_MAP,
  HAMMER0_MAP,
  HAMMER1_MAP,
];

const KONG_IDLE_MAP = [
  '........KKKKKKKK........',
  '.......KKKKKKKKKK.......',
  '.......KKFFKKFFKK.......',
  '.......KKKKKKKKKK.......',
  '.......KKFFFFFFKK.......',
  '........KKKKKKKK........',
  '....KKKKKKKKKKKKKKKK....',
  '..KKKKKKKKKKKKKKKKKKKK..',
  '.KKKK.KKFFFFFFFFKK.KKKK.',
  '.KKK..KKFFFFFFFFKK..KKK.',
  '.KKK..KKFFFFFFFFKK..KKK.',
  '.KKKK.KKKKKKKKKKKK.KKKK.',
  '..KK...KKKKKKKKKK...KK..',
  '.......KKKKKKKKKK.......',
  '......KKKK....KKKK......',
  '......KKK......KKK......',
  '.....KKKK......KKKK.....',
  '.....KKKK......KKKK.....',
];

const KONG_THROW_MAP = [
  '........KKKKKKKK........',
  '.......KKKKKKKKKK.......',
  '.......KKFFKKFFKK.......',
  '.......KKKKKKKKKK.......',
  '.......KKFFFFFFKK.......',
  '........KKKKKKKK........',
  '....KKKKKKKKKKKKKKKKKK..',
  '..KKKKKKKKKKKKKKKKKKKKKK',
  '.KKKK.KKFFFFFFFFKKKKKKKK',
  '.KKK..KKFFFFFFFFKK......',
  '.KKK..KKFFFFFFFFKK......',
  '.KKKK.KKKKKKKKKKKK......',
  '..KK...KKKKKKKKKK.......',
  '.......KKKKKKKKKK.......',
  '......KKKK....KKKK......',
  '......KKK......KKK......',
  '.....KKKK......KKKK.....',
  '.....KKKK......KKKK.....',
];

const BARREL0_MAP = [
  '.RRRRRR.',
  'RRrrrrRR',
  'RRRRRRRR',
  'RRRRRRRR',
  'RRrrrrRR',
  '.RRRRRR.',
];

const BARREL1_MAP = [
  '.RRRRRR.',
  'RrRRRRrR',
  'RRrRRrRR',
  'RRrRRrRR',
  'RrRRRRrR',
  '.RRRRRR.',
];

const HAMMER_MAP = [
  '..HHHHHH..',
  '..HHHHHH..',
  '..HHHHHH..',
  '....hh....',
  '....hh....',
  '....hh....',
  '....hh....',
  '....hh....',
  '....hh....',
  '....hh....',
];

const TROPHY_MAP = [
  '.TTTTTTTTTT.',
  'TT.TTTTTT.TT',
  'TT.TTTTTT.TT',
  '.T..TTTT..T.',
  '.TT.TTTT.TT.',
  '....TTTT....',
  '.....TT.....',
  '.....TT.....',
  '....TTTT....',
  '...TTTTTT...',
  '..TTTTTTTT..',
  '..TTTTTTTT..',
];

function bakeSprite(
  rows: readonly string[],
  px: number,
  palette: Record<string, string>,
  flip: boolean,
): HTMLCanvasElement {
  const w = rows[0].length;
  const h = rows.length;
  const el = document.createElement('canvas');
  el.width = w * px;
  el.height = h * px;
  const c = el.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[flip ? w - 1 - x : x];
      if (ch === '.') continue;
      const color = palette[ch];
      if (!color) continue;
      c.fillStyle = color;
      c.fillRect(x * px, y * px, px, px);
    }
  }
  return el;
}

// ── Skins (classic; retro/neon are pure additions to this map) ────────────────

type Skin = {
  name: string;
  bg: string;
  girder: string;
  girderTop: string;
  rivet: string;
  ladder: string;
  ladderBroken: string;
  hud: string;
  hudAccent: string;
  timerLow: string;
  playerBody: string;
  playerAccent: string;
  kongBody: string;
  kongAccent: string;
  barrel: string;
  barrelDark: string;
  hammerHead: string;
  hammerHandle: string;
  trophy: string;
};

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'classic',
    bg: '#000000',
    girder: '#ff2d8e',
    girderTop: '#ffa0d0',
    rivet: '#ffd0e8',
    ladder: '#00e5ff',
    ladderBroken: '#0e8ba0',
    hud: '#ffffff',
    hudAccent: '#ffd700',
    timerLow: '#ff3344',
    playerBody: '#ffffff',
    playerAccent: '#00e5ff',
    kongBody: '#8a4a2a',
    kongAccent: '#e0a878',
    barrel: '#c87830',
    barrelDark: '#7a4416',
    hammerHead: '#ffd700',
    hammerHandle: '#c87830',
    trophy: '#ffd700',
  },
};

type KongSprites = {
  playerR: HTMLCanvasElement[];
  playerL: HTMLCanvasElement[];
  kong: HTMLCanvasElement[];
  barrel: HTMLCanvasElement[];
  hammer: HTMLCanvasElement;
  trophy: HTMLCanvasElement;
};

const spriteCache: Record<string, KongSprites> = {};

function getSprites(skin: Skin): KongSprites {
  const cached = spriteCache[skin.name];
  if (cached) return cached;
  const playerPal = {
    W: skin.playerBody,
    C: skin.playerAccent,
    H: skin.hammerHead,
    h: skin.hammerHandle,
  };
  const playerR: HTMLCanvasElement[] = [];
  const playerL: HTMLCanvasElement[] = [];
  for (let i = 0; i < PLAYER_POSES.length; i++) {
    playerR.push(bakeSprite(PLAYER_POSES[i], PLAYER_PX, playerPal, false));
    playerL.push(bakeSprite(PLAYER_POSES[i], PLAYER_PX, playerPal, true));
  }
  const kongPal = { K: skin.kongBody, F: skin.kongAccent };
  const barrelPal = { R: skin.barrel, r: skin.barrelDark };
  const sprites: KongSprites = {
    playerR,
    playerL,
    kong: [
      bakeSprite(KONG_IDLE_MAP, KONG_PX, kongPal, false),
      bakeSprite(KONG_THROW_MAP, KONG_PX, kongPal, false),
    ],
    barrel: [
      bakeSprite(BARREL0_MAP, BARREL_PX, barrelPal, false),
      bakeSprite(BARREL1_MAP, BARREL_PX, barrelPal, false),
    ],
    hammer: bakeSprite(HAMMER_MAP, HAMMER_PX, playerPal, false),
    trophy: bakeSprite(TROPHY_MAP, TROPHY_PX, { T: skin.trophy }, false),
  };
  spriteCache[skin.name] = sprites;
  return sprites;
}

// ── Level backdrop (baked once per level/skin; the hot path only drawImages) ──

function drawGirderInto(c: CanvasRenderingContext2D, skin: Skin, g: Girder) {
  c.fillStyle = skin.girder;
  c.beginPath();
  c.moveTo(g.x0, g.y0);
  c.lineTo(g.x1, g.y1);
  c.lineTo(g.x1, g.y1 + GIRDER_T);
  c.lineTo(g.x0, g.y0 + GIRDER_T);
  c.closePath();
  c.fill();
  // top edge highlight
  c.strokeStyle = skin.girderTop;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(g.x0, g.y0 + 1);
  c.lineTo(g.x1, g.y1 + 1);
  c.stroke();
  // rivets, two rows
  c.fillStyle = skin.rivet;
  for (let x = g.x0 + 14; x <= g.x1 - 8; x += 34) {
    const y = girderYAt(g, x);
    c.fillRect(x, y + 4, 3, 3);
    c.fillRect(x, y + GIRDER_T - 5, 3, 3);
  }
}

function drawLadderInto(
  c: CanvasRenderingContext2D,
  skin: Skin,
  l: Ladder,
  isBroken: boolean,
) {
  const yTop = girderYAt(GIRDERS[l.to], l.x);
  const yBot = girderYAt(GIRDERS[l.from], l.x) + GIRDER_T;
  const xL = l.x - 8;
  const xR = l.x + 5;
  c.fillStyle = skin.ladder;
  if (!isBroken) {
    c.fillRect(xL, yTop, 3, yBot - yTop);
    c.fillRect(xR, yTop, 3, yBot - yTop);
    for (let y = yTop + 5; y < yBot - 2; y += 9) c.fillRect(xL, y, 16, 2);
    return;
  }
  // Broken: rails and rungs stop around a visible mid gap, dashed hint inside
  const gapTop = yTop + (yBot - yTop) * 0.34;
  const gapBot = yTop + (yBot - yTop) * 0.66;
  c.fillRect(xL, yTop, 3, gapTop - yTop);
  c.fillRect(xR, yTop, 3, gapTop - yTop);
  c.fillRect(xL, gapBot, 3, yBot - gapBot);
  c.fillRect(xR, gapBot, 3, yBot - gapBot);
  for (let y = yTop + 5; y < yBot - 2; y += 9) {
    if (y > gapTop - 2 && y < gapBot) continue;
    c.fillRect(xL, y, 16, 2);
  }
  c.fillStyle = skin.ladderBroken;
  for (let y = gapTop + 2; y < gapBot - 2; y += 8) {
    c.fillRect(xL, y, 3, 3);
    c.fillRect(xR, y, 3, 3);
  }
}

function bakeLevelCanvas(
  skin: Skin,
  broken: Set<number>,
  trophy: HTMLCanvasElement,
): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = CANVAS_W;
  el.height = CANVAS_H;
  const c = el.getContext('2d')!;
  c.fillStyle = skin.bg;
  c.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (let i = 0; i < LADDERS.length; i++) {
    drawLadderInto(c, skin, LADDERS[i], broken.has(i));
  }
  for (const g of GIRDERS) drawGirderInto(c, skin, g);
  c.drawImage(
    trophy,
    TROPHY.x - trophy.width / 2,
    TROPHY.y - trophy.height / 2,
  );
  return el;
}

// ── State ─────────────────────────────────────────────────────────────────────

type Phase = 'play' | 'death' | 'clear' | 'over';

type GameState = {
  score: number;
  lives: number;
  level: number;
  over: boolean;
  phase: Phase;
  phaseMs: number;
  banner: number;
  levelMs: number;
  spawnMs: number;
  kongThrowMs: number;
  animMs: number;
  runAnimMs: number;
  climbTickMs: number;
  player: Player;
  pool: Barrel[];
  prevBX: number[];
  jumpScored: boolean[];
  ladderLatch: number[];
  hammerTaken: boolean[];
};

function makePlayer(): Player {
  return {
    x: PLAYER_SPAWN.x,
    y: girderYAt(GIRDERS[PLAYER_SPAWN.girder], PLAYER_SPAWN.x),
    vy: 0,
    girder: PLAYER_SPAWN.girder,
    state: 'run',
    facing: -1,
    hammerMs: 0,
    climbing: null,
    fellFrom: 0,
  };
}

function initialState(): GameState {
  const pool: Barrel[] = [];
  const prevBX: number[] = [];
  const jumpScored: boolean[] = [];
  const ladderLatch: number[] = [];
  for (let i = 0; i < MAX_BARRELS; i++) {
    pool.push({ x: 0, y: 0, girder: 0, dir: 1, active: false, onLadder: null });
    prevBX.push(0);
    jumpScored.push(false);
    ladderLatch.push(-1);
  }
  return {
    score: 0,
    lives: START_LIVES,
    level: 1,
    over: false,
    phase: 'play',
    phaseMs: 0,
    banner: -1,
    levelMs: 0,
    spawnMs: FIRST_SPAWN_MS,
    kongThrowMs: 0,
    animMs: 0,
    runAnimMs: 0,
    climbTickMs: 0,
    player: makePlayer(),
    pool,
    prevBX,
    jumpScored,
    ladderLatch,
    hammerTaken: [false, false],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

function KongGame({
  paused,
  muted = false,
  skinKey = 'classic',
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: KongGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const skinRef = useRef<Skin>(SKINS[skinKey] ?? SKINS.classic);
  const stateRef = useRef<GameState | null>(null);
  if (stateRef.current === null) stateRef.current = initialState();

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    mutedRef.current = muted;
    sfxKong.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    skinRef.current = SKINS[skinKey] ?? SKINS.classic;
  }, [skinKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current!;

    // Callbacks only on change; HUD strings cached so draw() allocates none
    let reportedScore = s.score;
    let reportedLevel = s.level;
    let reportedLives = s.lives;
    let scoreText = `PUNTOS ${s.score}`;
    let levelText = `NIVEL ${s.level}`;
    let endFired = false;
    let sfxReady = false;

    let leftDown = false;
    let rightDown = false;
    let upDown = false;
    let downDown = false;
    let jumpHeld = false;
    let jumpQueued = false;

    // Reused scratch input for stepPlayer — never re-allocated
    const input: Input = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
    };

    // Cached per level, not per frame
    let brokenSet = brokenLadderSet(s.level);

    // Level backdrop cache (rebuilt on level rebuild or skin change only)
    let levelCanvas: HTMLCanvasElement | null = null;
    let bakedSkinName = '';

    function report() {
      if (s.score !== reportedScore) {
        reportedScore = s.score;
        scoreText = `PUNTOS ${s.score}`;
        onScoreChange(s.score);
      }
      if (s.level !== reportedLevel) {
        reportedLevel = s.level;
        levelText = `NIVEL ${s.level}`;
        onLevelChange(s.level);
      }
      if (s.lives !== reportedLives) {
        reportedLives = s.lives;
        onLivesChange(s.lives);
      }
    }

    function resetBoard() {
      const p = s.player;
      p.x = PLAYER_SPAWN.x;
      p.girder = PLAYER_SPAWN.girder;
      p.y = girderYAt(GIRDERS[p.girder], p.x);
      p.vy = 0;
      p.state = 'run';
      p.facing = -1;
      p.hammerMs = 0;
      p.climbing = null;
      p.fellFrom = 0;
      for (let i = 0; i < MAX_BARRELS; i++) {
        s.pool[i].active = false;
        s.pool[i].onLadder = null;
        s.jumpScored[i] = false;
        s.ladderLatch[i] = -1;
      }
      s.levelMs = 0;
      s.spawnMs = FIRST_SPAWN_MS;
      s.kongThrowMs = 0;
      s.climbTickMs = 0;
      s.runAnimMs = 0;
      s.banner = -1;
    }

    function rebuildLevel() {
      brokenSet = brokenLadderSet(s.level);
      s.hammerTaken[0] = false;
      s.hammerTaken[1] = false;
      levelCanvas = null;
      resetBoard();
    }

    function doGameOver() {
      s.over = true;
      s.phase = 'over';
      report();
      if (!endFired) {
        endFired = true;
        onGameOver(s.score);
        sfxKong.play('game_over');
      }
    }

    function startDeath() {
      sfxKong.play('death');
      s.player.state = 'dead';
      s.lives -= 1;
      if (s.lives <= 0) {
        s.lives = 0;
        doGameOver();
        return;
      }
      s.phase = 'death';
      s.phaseMs = DEATH_PAUSE_MS;
      s.banner = BANNER_RETRY;
      report();
    }

    function startClear() {
      s.score +=
        SCORE_LEVEL + timeBonus(Math.max(0, LEVEL_TIME_MS - s.levelMs));
      s.level += 1;
      sfxKong.play('level_clear');
      s.phase = 'clear';
      s.phaseMs = CLEAR_PAUSE_MS;
      s.banner = BANNER_TROPHY;
      report();
    }

    function updateBarrels(dtMs: number) {
      const cfg = configFor(s.level);
      const speed = cfg[1];
      const chance = cfg[2];
      for (let i = 0; i < MAX_BARRELS; i++) {
        const b = s.pool[i];
        if (!b.active) continue;
        s.prevBX[i] = b.x;
        if (b.onLadder !== null) {
          descendLadder(b, dtMs, speed);
          continue;
        }
        advanceBarrel(b, dtMs, speed);
        if (atGirderEnd(b)) {
          dropToNextGirder(b);
          s.ladderLatch[i] = -1;
          continue;
        }
        if (b.girder === 0) {
          // Girder 0 never reports atGirderEnd — deactivate off-canvas here
          if (b.x < -BARREL_W || b.x > CANVAS_W + BARREL_W) b.active = false;
          continue;
        }
        // One ladder decision per barrel-ladder encounter (latched)
        let found = -1;
        for (let li = 0; li < LADDERS.length; li++) {
          const l = LADDERS[li];
          if (l.to === b.girder && Math.abs(l.x - b.x) <= LADDER_TAKE_TOL) {
            found = li;
            break;
          }
        }
        if (found === -1) {
          s.ladderLatch[i] = -1;
        } else if (s.ladderLatch[i] !== found) {
          s.ladderLatch[i] = found;
          if (!brokenSet.has(found) && shouldTakeLadder(chance, Math.random)) {
            enterLadder(b, LADDERS[found]);
          }
        }
      }
    }

    function updatePlay(dtMs: number) {
      s.levelMs += dtMs;
      s.animMs = (s.animMs + dtMs) % 3_600_000;
      const cfg = configFor(s.level);

      // Kong throw cadence
      if (s.kongThrowMs > 0) s.kongThrowMs = Math.max(0, s.kongThrowMs - dtMs);
      s.spawnMs -= dtMs;
      if (s.spawnMs <= 0) {
        if (spawnBarrel(s.pool) !== null) s.kongThrowMs = KONG_THROW_POSE_MS;
        s.spawnMs = cfg[0];
      }

      updateBarrels(dtMs);

      // Player
      const p = s.player;
      input.left = leftDown;
      input.right = rightDown;
      input.up = upDown;
      input.down = downDown;
      input.jump = jumpQueued;
      jumpQueued = false;
      const prevPx = p.x;
      const prevState = p.state;
      stepPlayer(p, input, dtMs, brokenSet);
      if (p.x < PLAYER_HALF) p.x = PLAYER_HALF;
      if (p.x > CANVAS_W - PLAYER_HALF) p.x = CANVAS_W - PLAYER_HALF;

      if (prevState !== 'jump' && p.state === 'jump') sfxKong.play('jump');
      if (prevState === 'jump' && p.state === 'run') sfxKong.play('land');
      if (p.state === 'climb' && (upDown || downDown)) {
        s.climbTickMs += dtMs;
        if (s.climbTickMs >= CLIMB_TICK_MS) {
          s.climbTickMs = 0;
          sfxKong.play('climb');
        }
      } else {
        s.climbTickMs = 0;
      }
      if (
        (leftDown || rightDown) &&
        (p.state === 'run' || p.state === 'hammer')
      ) {
        s.runAnimMs = (s.runAnimMs + dtMs) % (RUN_FRAME_MS * 3);
      }

      // Fall death from physics (plus safety net for leaving the canvas)
      if (p.state === 'dead' || p.y > CANVAS_H + 60) {
        startDeath();
        return;
      }

      // Jumped-over scoring: per-barrel latch, one payout per jump. The check
      // runs both ways (player sweep and barrel sweep) so a stationary jump
      // over a rolling barrel also counts.
      if (p.state === 'jump') {
        for (let i = 0; i < MAX_BARRELS; i++) {
          const b = s.pool[i];
          if (
            !b.active ||
            b.onLadder !== null ||
            b.girder !== p.girder ||
            s.jumpScored[i]
          ) {
            continue;
          }
          const dy = b.y - p.y;
          if (dy <= 0 || dy > 130) continue;
          if (
            jumpedOver(b.x, prevPx, p.x, true) ||
            jumpedOver(p.x, s.prevBX[i], b.x, true)
          ) {
            s.jumpScored[i] = true;
            s.score += SCORE_JUMP;
            sfxKong.play('point');
          }
        }
      } else if (prevState === 'jump') {
        for (let i = 0; i < MAX_BARRELS; i++) s.jumpScored[i] = false;
      }

      // Barrel contact: smash with hammer, death without
      for (let i = 0; i < MAX_BARRELS; i++) {
        const b = s.pool[i];
        if (!b.active) continue;
        const reach =
          p.state === 'hammer' ? HAMMER_REACH : (PLAYER_W + BARREL_W) / 2;
        if (Math.abs(p.x - b.x) >= reach) continue;
        if (p.y - PLAYER_H >= b.y || b.y - BARREL_H >= p.y) continue;
        if (p.state === 'hammer') {
          b.active = false;
          s.score += SCORE_SMASH;
          sfxKong.play('smash');
        } else {
          startDeath();
          return;
        }
      }

      // Hammer pickup (walking touch; canvas owns state + timer per player.ts)
      if (p.state === 'run') {
        for (let i = 0; i < HAMMER_POS.length; i++) {
          if (s.hammerTaken[i]) continue;
          const h = HAMMER_POS[i];
          if (
            Math.abs(p.x - h.x) < HAMMER_PICKUP_X &&
            Math.abs(p.y - h.y) < HAMMER_PICKUP_Y
          ) {
            s.hammerTaken[i] = true;
            p.state = 'hammer';
            p.hammerMs = HAMMER_MS;
            sfxKong.play('hammer_pickup');
          }
        }
      }

      // Trophy
      const dyT = p.y - TROPHY.y;
      if (Math.abs(p.x - TROPHY.x) < TROPHY_REACH_X && dyT > -34 && dyT < 60) {
        startClear();
        return;
      }

      // Level timer runout = losing a life
      if (s.levelMs >= LEVEL_TIME_MS) {
        startDeath();
        return;
      }

      report();
    }

    function update(dtMs: number) {
      switch (s.phase) {
        case 'play':
          updatePlay(dtMs);
          return;
        case 'death':
          s.phaseMs -= dtMs;
          if (s.phaseMs <= 0) {
            resetBoard();
            s.phase = 'play';
          }
          return;
        case 'clear':
          s.phaseMs -= dtMs;
          if (s.phaseMs <= 0) {
            rebuildLevel();
            s.phase = 'play';
          }
          return;
        case 'over':
          return;
      }
    }

    // ── Draw ────────────────────────────────────────────────────────────────

    function playerPoseIndex(): number {
      const p = s.player;
      switch (p.state) {
        case 'hammer':
          return ((s.animMs / HAMMER_SWING_MS) | 0) & 1
            ? POSE_HAMMER1
            : POSE_HAMMER0;
        case 'climb':
          return ((p.y / 14) | 0) & 1 ? POSE_CLIMB1 : POSE_CLIMB0;
        case 'jump':
        case 'dead':
          return POSE_JUMP;
        case 'run':
          if (leftDown || rightDown) {
            return POSE_RUN0 + (((s.runAnimMs / RUN_FRAME_MS) | 0) % 3);
          }
          return POSE_RUN1;
      }
    }

    function drawPlayer(sprites: KongSprites) {
      const p = s.player;
      if (p.state === 'dead' && s.phaseMs % 240 < 100) return; // blink
      const arr = p.facing === 1 ? sprites.playerR : sprites.playerL;
      const spr = arr[playerPoseIndex()];
      ctx.drawImage(spr, p.x - spr.width / 2, p.y - spr.height);
    }

    function drawBanner(skinNow: Skin) {
      ctx.font = 'bold 40px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillText(BANNERS[s.banner], CANVAS_W / 2, 380);
    }

    function drawHud(skinNow: Skin) {
      ctx.textBaseline = 'middle';

      // Score TL
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = skinNow.hud;
      ctx.fillText(scoreText, 12, 20);

      // Remaining seconds TC (red under 15 s)
      let secs = Math.ceil((LEVEL_TIME_MS - s.levelMs) / 1000);
      if (secs < 0) secs = 0;
      if (secs > 90) secs = 90;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = secs < TIMER_LOW_S ? skinNow.timerLow : skinNow.hudAccent;
      ctx.fillText(TIMER_TEXT[secs], CANVAS_W / 2, 20);

      // Level BR
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillText(levelText, CANVAS_W - 12, CANVAS_H - 16);

      // Lives BL as mini player icons
      for (let i = 0; i < s.lives; i++) {
        const x = 12 + i * 20;
        ctx.fillStyle = skinNow.playerAccent;
        ctx.fillRect(x, CANVAS_H - 30, 12, 5);
        ctx.fillStyle = skinNow.playerBody;
        ctx.fillRect(x, CANVAS_H - 25, 12, 9);
      }
    }

    function draw() {
      const skinNow = skinRef.current;
      const sprites = getSprites(skinNow);

      if (levelCanvas === null || bakedSkinName !== skinNow.name) {
        levelCanvas = bakeLevelCanvas(skinNow, brokenSet, sprites.trophy);
        bakedSkinName = skinNow.name;
      }
      ctx.drawImage(levelCanvas, 0, 0);

      // Hammers still on the level
      for (let i = 0; i < HAMMER_POS.length; i++) {
        if (s.hammerTaken[i]) continue;
        const h = HAMMER_POS[i];
        ctx.drawImage(
          sprites.hammer,
          h.x - sprites.hammer.width / 2,
          h.y - sprites.hammer.height,
        );
      }

      // Kong: throw pose while spawning, chest-beat bob otherwise
      const kongSpr = s.kongThrowMs > 0 ? sprites.kong[1] : sprites.kong[0];
      const bob = s.kongThrowMs > 0 ? 0 : s.animMs % 900 < 450 ? 0 : 2;
      ctx.drawImage(
        kongSpr,
        KONG.x - kongSpr.width / 2,
        KONG_FOOT_Y - kongSpr.height + bob,
      );

      // Barrels (rotation frame from position — no per-frame state)
      for (let i = 0; i < MAX_BARRELS; i++) {
        const b = s.pool[i];
        if (!b.active) continue;
        const f = ((Math.abs(b.x) / 14) | 0) & 1;
        ctx.drawImage(sprites.barrel[f], b.x - 8, b.y - BARREL_H);
      }

      drawPlayer(sprites);

      if (s.banner >= 0 && (s.phase === 'death' || s.phase === 'clear')) {
        drawBanner(skinNow);
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
        jumpQueued = false;
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
        sfxKong.init();
        sfxKong.setMuted(mutedRef.current);
      }
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        leftDown = true;
        e.preventDefault();
      } else if (key === 'arrowright' || key === 'd') {
        rightDown = true;
        e.preventDefault();
      } else if (key === 'arrowup' || key === 'w') {
        upDown = true;
        e.preventDefault();
      } else if (key === 'arrowdown' || key === 's') {
        downDown = true;
        e.preventDefault();
      } else if (key === ' ' || key === 'j') {
        e.preventDefault();
        if (!jumpHeld) {
          jumpHeld = true;
          jumpQueued = true;
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') leftDown = false;
      else if (key === 'arrowright' || key === 'd') rightDown = false;
      else if (key === 'arrowup' || key === 'w') upDown = false;
      else if (key === 'arrowdown' || key === 's') downDown = false;
      else if (key === ' ' || key === 'j') jumpHeld = false;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      sfxKong.dispose();
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

export default React.memo(KongGame);
