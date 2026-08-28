'use client';

import React, { useEffect, useRef } from 'react';

import { decide, opponentFor } from './karate-logic/ai';
import { barPhase, BOARD_SCORES, GREEN_ZONE, hitQuality } from './karate-logic/bonus';
import {
  applyPoint,
  matchWinner,
  OPPONENT_BONUS,
  ROUND_LIMIT_MS,
  SCORE_PER_POINT,
  timeBonus,
  type MatchState,
} from './karate-logic/scoring';
import {
  landsHit,
  resolveTechnique,
  TECHNIQUES,
  type Dir,
  type Height,
  type TechButton,
  type Technique,
} from './karate-logic/techniques';
import { sfxKarateChamp } from '@/lib/sfx-karate-champ';

interface KarateChampGameProps {
  paused: boolean;
  muted?: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Geometry (spec 25) ────────────────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 500;

const FLOOR_Y = 424;
const ARENA_LEFT = 80;
const ARENA_RIGHT = 720;
const PLAYER_START_X = 250;
const CPU_START_X = 550;
const MIN_GAP = 32;

// ── Tuning ────────────────────────────────────────────────────────────────────

const PLAYER_SPEED = 190;
const CPU_SPEED = 150;
const LUNGE_SPEED = 260;
const STUN_MS = 420;
const WALK_FRAME_MS = 140;

const INTRO_MS = 1400;
const BANNER_MS = 1100;
const WIN_MS = 1700;
const BONUS_RESULT_MS = 900;
const BONUS_WINS_EVERY = 3;

// Fixed referee banner table (spec 25) — indexed, never rebuilt per frame
const BANNERS = ['¡MEDIO PUNTO!', '¡PUNTO!', '¡GANADOR!', 'PUNTO DE ORO'] as const;
const BANNER_HALF = 0;
const BANNER_FULL = 1;
const BANNER_WINNER = 2;
const BANNER_GOLDEN = 3;

const GOLDEN_TIMER_TEXT = 'ORO';
const BONUS_LABELS = ['TABLA 1/3', 'TABLA 2/3', 'TABLA 3/3'] as const;
const BONUS_HIT_TEXT = BOARD_SCORES.map((score) => `+${score}`);
const BONUS_MISS_TEXT = 'FALLO';
const BONUS_HELP_TEXT = 'PULSA A EN LA ZONA VERDE';

// Pre-built timer strings: the HUD never allocates a string per frame
const TIMER_TEXT: string[] = [];
for (let i = 0; i <= ROUND_LIMIT_MS / 1000; i++) TIMER_TEXT.push(String(i));

// ── Poses (pre-baked 2-color pixel figures, Space Invaders sprite pattern) ────

const POSE_GRID_W = 20;
const POSE_GRID_H = 26;
const POSE_PX = 4;
const SPR_W = POSE_GRID_W * POSE_PX;
const SPR_H = POSE_GRID_H * POSE_PX;

const POSE_IDLE = 0;
const POSE_WALK0 = 1;
const POSE_WALK1 = 2;
const POSE_BLOCK_HIGH = 3;
const POSE_BLOCK_MID = 4;
const POSE_BLOCK_LOW = 5;
const POSE_STUN = 6;
const POSE_TECH_BASE = 7;

// Pose figure spec on a 20×26 grid, drawn facing right (+x = front).
// g: gi-colored segments [x1, y1, x2, y2, thickness]; s: skin-colored blocks
// [x, y, size] (hands/feet); h: head center (4×4 skin block).
type PoseSpec = {
  h: [number, number];
  g: number[][];
  s: number[][];
};

const IDLE_LEGS: number[][] = [
  [9, 15, 11, 20, 2],
  [11, 20, 11, 24, 2],
  [9, 15, 7, 20, 2],
  [7, 20, 7, 24, 2],
];
const IDLE_FEET: number[][] = [
  [12, 24.5, 2],
  [8, 24.5, 2],
];

// Order: idle, walk0, walk1, blockHigh, blockMid, blockLow, stun, then the 8
// techniques in TECHNIQUES array order.
const POSES: PoseSpec[] = [
  // idle — guard up
  {
    h: [9, 4],
    g: [
      [9, 7, 9, 15, 3],
      [9, 9, 12, 11, 2],
      [12, 11, 13, 9, 2],
      [9, 9, 7, 12, 2],
      [7, 12, 9, 13, 2],
      ...IDLE_LEGS,
    ],
    s: [[13.5, 8.5, 2], [9.5, 13, 2], ...IDLE_FEET],
  },
  // walk frame 0 — legs apart
  {
    h: [9, 4],
    g: [
      [9, 7, 9, 15, 3],
      [9, 9, 12, 11, 2],
      [12, 11, 13, 9, 2],
      [9, 9, 7, 12, 2],
      [7, 12, 9, 13, 2],
      [9, 15, 12, 20, 2],
      [12, 20, 12, 24, 2],
      [9, 15, 6, 20, 2],
      [6, 20, 6, 24, 2],
    ],
    s: [
      [13.5, 8.5, 2],
      [9.5, 13, 2],
      [13, 24.5, 2],
      [7, 24.5, 2],
    ],
  },
  // walk frame 1 — legs together
  {
    h: [9, 4],
    g: [
      [9, 7, 9, 15, 3],
      [9, 9, 12, 11, 2],
      [12, 11, 13, 9, 2],
      [9, 9, 7, 12, 2],
      [7, 12, 9, 13, 2],
      [9, 15, 10, 20, 2],
      [10, 20, 10, 24, 2],
      [9, 15, 8, 20, 2],
      [8, 20, 8, 24, 2],
    ],
    s: [
      [13.5, 8.5, 2],
      [9.5, 13, 2],
      [11, 24.5, 2],
      [9, 24.5, 2],
    ],
  },
  // block high — forearms crossed above the head
  {
    h: [9, 4.5],
    g: [
      [9, 7, 9, 15, 3],
      [9, 9, 11, 6, 2],
      [11, 6, 12, 3, 2],
      [9, 9, 8, 6, 2],
      [8, 6, 10, 3, 2],
      ...IDLE_LEGS,
    ],
    s: [[12.5, 2.5, 2], [10.5, 2.5, 2], ...IDLE_FEET],
  },
  // block mid — vertical forearms in front of the torso
  {
    h: [9, 4],
    g: [
      [9, 7, 9, 15, 3],
      [9, 9, 12, 10, 2],
      [12, 10, 12, 13, 2],
      [9, 10, 11, 11, 2],
      [11, 11, 11, 14, 2],
      ...IDLE_LEGS,
    ],
    s: [[12, 13.5, 2], [11, 14.5, 2], ...IDLE_FEET],
  },
  // block low — slight crouch, arms sweeping down-front
  {
    h: [9, 5],
    g: [
      [9, 8, 9, 16, 3],
      [9, 11, 12, 14, 2],
      [12, 14, 12, 17, 2],
      [9, 11, 10, 15, 2],
      [10, 15, 11, 17, 2],
      [9, 16, 11, 20, 2],
      [11, 20, 11, 24, 2],
      [9, 16, 7, 20, 2],
      [7, 20, 7, 24, 2],
    ],
    s: [
      [12, 17.5, 2],
      [11, 17.5, 2],
      [12, 24.5, 2],
      [8, 24.5, 2],
    ],
  },
  // stun — head thrown back, arms flailing
  {
    h: [6, 5],
    g: [
      [7, 8, 9, 15, 3],
      [7, 9, 4, 7, 2],
      [7, 10, 5, 13, 2],
      [9, 15, 12, 20, 2],
      [12, 20, 12, 24, 2],
      [9, 15, 7, 20, 2],
      [7, 20, 6, 24, 2],
    ],
    s: [
      [3.5, 6.5, 2],
      [4.5, 13.5, 2],
      [13, 24.5, 2],
      [6, 24.5, 2],
    ],
  },
  // punetazo (mid punch, lunge)
  {
    h: [9, 4],
    g: [
      [9, 7, 9, 15, 3],
      [9, 9, 16, 9, 2],
      [9, 10, 6, 10, 2],
      [9, 15, 12, 19, 2],
      [12, 19, 12, 24, 2],
      [9, 15, 6, 19, 2],
      [6, 19, 5, 24, 2],
    ],
    s: [
      [17, 9, 2],
      [5.5, 10, 2],
      [13, 24.5, 2],
      [4.5, 24.5, 2],
    ],
  },
  // punetazo-bajo (low punch, crouched)
  {
    h: [9, 7],
    g: [
      [9, 10, 9, 17, 3],
      [9, 12, 16, 15, 2],
      [9, 12, 6, 13, 2],
      [9, 17, 12, 20, 2],
      [12, 20, 12, 24, 2],
      [9, 17, 6, 20, 2],
      [6, 20, 6, 24, 2],
    ],
    s: [
      [17, 15.5, 2],
      [5.5, 13.5, 2],
      [13, 24.5, 2],
      [5, 24.5, 2],
    ],
  },
  // patada-frontal (mid front kick)
  {
    h: [8, 4],
    g: [
      [8, 7, 9, 15, 3],
      [8, 9, 11, 10, 2],
      [8, 9, 6, 11, 2],
      [9, 15, 16, 13, 2],
      [9, 15, 8, 20, 2],
      [8, 20, 8, 24, 2],
    ],
    s: [
      [11.5, 10, 2],
      [5.5, 11.5, 2],
      [17.5, 13, 2],
      [9, 24.5, 2],
    ],
  },
  // barrido (ground sweep, deep crouch)
  {
    h: [8, 12],
    g: [
      [8, 15, 8, 20, 3],
      [8, 16, 12, 18, 2],
      [8, 16, 5, 17, 2],
      [8, 21, 16, 23, 2],
      [8, 20, 5, 24, 2],
    ],
    s: [
      [12.5, 18.5, 2],
      [4.5, 17.5, 2],
      [17.5, 23, 2],
      [4.5, 24.5, 2],
    ],
  },
  // golpe-con-salto (jumping punch, airborne, legs tucked)
  {
    h: [9, 2],
    g: [
      [9, 5, 9, 12, 3],
      [9, 7, 16, 10, 2],
      [9, 7, 6, 8, 2],
      [9, 12, 7, 15, 2],
      [7, 15, 9, 17, 2],
      [9, 12, 11, 15, 2],
      [11, 15, 10, 18, 2],
    ],
    s: [
      [17, 10.5, 2],
      [5.5, 8, 2],
      [9, 17.5, 2],
      [10.5, 18.5, 2],
    ],
  },
  // golpe-alto (rising high punch)
  {
    h: [9, 4],
    g: [
      [9, 7, 9, 15, 3],
      [9, 9, 15, 4, 2],
      [9, 10, 6, 11, 2],
      ...IDLE_LEGS,
    ],
    s: [[16, 3.5, 2], [5.5, 11.5, 2], ...IDLE_FEET],
  },
  // patada-alta (high kick, torso leaning back)
  {
    h: [7, 4],
    g: [
      [7, 7, 9, 15, 3],
      [7, 9, 4, 11, 2],
      [7, 9, 10, 10, 2],
      [9, 15, 16, 6, 2],
      [9, 15, 8, 20, 2],
      [8, 20, 8, 24, 2],
    ],
    s: [
      [3.5, 11.5, 2],
      [10.5, 10, 2],
      [17, 5, 2],
      [9, 24.5, 2],
    ],
  },
  // patada-voladora (flying kick, horizontal, airborne)
  {
    h: [6, 4],
    g: [
      [7, 6, 10, 11, 3],
      [7, 7, 4, 9, 2],
      [8, 8, 11, 10, 2],
      [10, 11, 18, 8, 2],
      [10, 11, 9, 15, 2],
      [9, 15, 6, 15, 2],
    ],
    s: [
      [3.5, 9.5, 2],
      [11.5, 10.5, 2],
      [19, 7.5, 2],
      [5.5, 15, 2],
    ],
  },
];

// technique id → pose index (aligned with TECHNIQUES order), built once
const TECH_POSE_INDEX = new Map<string, number>();
for (let i = 0; i < TECHNIQUES.length; i++) {
  TECH_POSE_INDEX.set(TECHNIQUES[i].id, POSE_TECH_BASE + i);
}

function cell(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  c.fillRect(
    Math.round((cx - size / 2) * POSE_PX),
    Math.round((cy - size / 2) * POSE_PX),
    size * POSE_PX,
    size * POSE_PX,
  );
}

function drawSeg(
  c: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
) {
  const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2) + 1;
  for (let i = 0; i <= steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    cell(c, x, y, w);
  }
}

// Bake options, same shape/intent as the bakeSprite pattern in
// SpaceInvadersGame: retro gets a solid (non-blurred) highlight clipped to the
// silhouette via 'source-atop'; neon gets a shadowBlur pass baked into the
// offscreen canvas ONCE. The hot path (drawFighter) only ever does drawImage —
// it never sets shadowBlur or creates a canvas per frame.
type PoseBakeOpts = {
  highlight?: boolean;
  glowColor?: string;
  glowBlur?: number;
};

// Baked once per (skin, gi, facing) at first use; the hot path only drawImages
function bakePose(
  spec: PoseSpec,
  giColor: string,
  skinColor: string,
  flip: boolean,
  opts?: PoseBakeOpts,
): HTMLCanvasElement {
  const pad = opts?.glowColor ? Math.ceil(opts.glowBlur ?? 6) : 0;
  const el = document.createElement('canvas');
  el.width = SPR_W + pad * 2;
  el.height = SPR_H + pad * 2;
  const c = el.getContext('2d')!;
  const mx = (x: number) => (flip ? POSE_GRID_W - 1 - x : x);

  function paint() {
    c.fillStyle = giColor;
    for (let i = 0; i < spec.g.length; i++) {
      const [x1, y1, x2, y2, w] = spec.g[i];
      drawSeg(c, mx(x1), y1, mx(x2), y2, w);
    }
    c.fillStyle = skinColor;
    cell(c, mx(spec.h[0]), spec.h[1], 4);
    for (let i = 0; i < spec.s.length; i++) {
      const [x, y, size] = spec.s[i];
      cell(c, mx(x), y, size);
    }
  }

  c.translate(pad, pad);
  if (opts?.glowColor) {
    c.shadowBlur = opts.glowBlur ?? 6;
    c.shadowColor = opts.glowColor;
    paint();
    c.shadowBlur = 0;
  }
  paint();

  if (opts?.highlight) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(0, 0, el.width, Math.ceil(SPR_H * 0.32) + pad);
    c.globalCompositeOperation = 'source-over';
  }

  return el;
}

// ── Skins (classic, retro, neon) ───────────────────────────────────────────────

type Skin = {
  name: string;
  bg: string;
  floor: string;
  floorLine: string;
  hud: string;
  hudAccent: string;
  giPlayer: string;
  giCpu: string;
  skinTone: string;
  flagPlayer: string;
  flagCpu: string;
  board: string;
  zone: string;
  barTrack: string;
};

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'classic',
    bg: '#000000',
    floor: '#221708',
    floorLine: '#ffd700',
    hud: '#ffffff',
    hudAccent: '#ffd700',
    giPlayer: '#ffffff',
    giCpu: '#ff3344',
    skinTone: '#ffcc99',
    flagPlayer: '#ffffff',
    flagCpu: '#ff3344',
    board: '#b5722a',
    zone: '#33ff33',
    barTrack: '#333333',
  },
  // CRT pastel dojo: gis crema/salmón, sin shadowBlur — highlight sólido
  // horneado en el sprite (opts.highlight en bakePose).
  retro: {
    name: 'retro',
    bg: '#241a30',
    floor: '#8a6a52',
    floorLine: '#ffe08a',
    hud: '#fef6e4',
    hudAccent: '#ffb599',
    giPlayer: '#fff3d6',
    giCpu: '#ffab91',
    skinTone: '#f2c9a0',
    flagPlayer: '#fff3d6',
    flagCpu: '#ffab91',
    board: '#c9986a',
    zone: '#8de8a0',
    barTrack: '#5c4a6e',
  },
  // Eléctrico sobre negro puro: contornos cian (jugador) vs magenta (CPU) con
  // glow horneado en el sprite. Los pocos trazos por-frame (línea del tatami,
  // banners, HUD) llevan shadowBlur EN VIVO reseteado a mano — nunca crean
  // canvas ni corren dentro del bucle por-píxel de las poses.
  neon: {
    name: 'neon',
    bg: '#000000',
    floor: '#0a0a14',
    floorLine: '#00eaff',
    hud: '#eafcff',
    hudAccent: '#ff00e5',
    giPlayer: '#00e5ff',
    giCpu: '#ff00e5',
    skinTone: '#f5ff00',
    flagPlayer: '#00e5ff',
    flagCpu: '#ff00e5',
    board: '#39d0ff',
    zone: '#39ff88',
    barTrack: '#151022',
  },
};

type KarateSprites = {
  player: HTMLCanvasElement[];
  cpu: HTMLCanvasElement[];
};

const spriteCache: Record<string, KarateSprites> = {};

function getSprites(skin: Skin): KarateSprites {
  const cached = spriteCache[skin.name];
  if (cached) return cached;
  const isRetro = skin.name === 'retro';
  const isNeon = skin.name === 'neon';
  const player: HTMLCanvasElement[] = [];
  const cpu: HTMLCanvasElement[] = [];
  for (let i = 0; i < POSES.length; i++) {
    player.push(
      bakePose(POSES[i], skin.giPlayer, skin.skinTone, false, {
        highlight: isRetro,
        glowColor: isNeon ? skin.giPlayer : undefined,
        glowBlur: 6,
      }),
    );
    cpu.push(
      bakePose(POSES[i], skin.giCpu, skin.skinTone, true, {
        highlight: isRetro,
        glowColor: isNeon ? skin.giCpu : undefined,
        glowBlur: 6,
      }),
    );
  }
  const sprites = { player, cpu };
  spriteCache[skin.name] = sprites;
  return sprites;
}

// ── State ─────────────────────────────────────────────────────────────────────

// Structurally compatible with FighterState (x, facing, blockingHeight,
// busyUntilMs) so the fighter itself is passed to landsHit — no scratch copy.
type Fighter = {
  x: number;
  facing: 1 | -1;
  blockingHeight: Height | null;
  busyUntilMs: number;
  tech: Technique | null;
  techStartMs: number;
  techPose: number;
  hitEvaluated: boolean;
  stunMs: number;
  walkMs: number;
  walking: boolean;
};

type Phase = 'intro' | 'fight' | 'banner' | 'win' | 'bonus' | 'over';
type AfterBanner = 'resume' | 'win' | 'lose';

type GameState = {
  score: number;
  level: number;
  lives: number;
  over: boolean;
  wins: number;
  phase: Phase;
  phaseMs: number;
  gameMs: number;
  match: MatchState;
  player: Fighter;
  cpu: Fighter;
  bannerIdx: number;
  afterBanner: AfterBanner;
  introText: string;
  aiMs: number;
  aiMove: 'approach' | 'retreat' | 'idle';
  bonusIndex: number;
  bonusMs: number;
  bonusResultMs: number;
  bonusHit: boolean;
};

function makeFighter(x: number, facing: 1 | -1): Fighter {
  return {
    x,
    facing,
    blockingHeight: null,
    busyUntilMs: 0,
    tech: null,
    techStartMs: 0,
    techPose: 0,
    hitEvaluated: false,
    stunMs: 0,
    walkMs: 0,
    walking: false,
  };
}

function makeMatch(): MatchState {
  return { playerPoints: 0, cpuPoints: 0, roundMs: 0, goldenPoint: false };
}

function initialState(): GameState {
  return {
    score: 0,
    level: 1,
    lives: 1,
    over: false,
    wins: 0,
    phase: 'intro',
    phaseMs: INTRO_MS,
    gameMs: 0,
    match: makeMatch(),
    player: makeFighter(PLAYER_START_X, 1),
    cpu: makeFighter(CPU_START_X, -1),
    bannerIdx: BANNER_HALF,
    afterBanner: 'resume',
    introText: 'RIVAL 1',
    aiMs: 0,
    aiMove: 'idle',
    bonusIndex: 0,
    bonusMs: 0,
    bonusResultMs: 0,
    bonusHit: false,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

function KarateChampGame({
  paused,
  muted = false,
  skinKey = 'classic',
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: KarateChampGameProps) {
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
    sfxKarateChamp.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    skinRef.current = SKINS[skinKey] ?? SKINS.classic;
  }, [skinKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current!;

    // Callbacks only on change; HUD strings cached here so draw() allocates none
    let reportedScore = s.score;
    let reportedLevel = s.level;
    let reportedLives = s.lives;
    let scoreText = `PUNTOS ${s.score}`;
    let levelText = `RIVAL ${s.level}`;
    let endFired = false;
    let sfxReady = false;

    let leftDown = false;
    let rightDown = false;
    let upDown = false;
    let downDown = false;

    // Reused scratch context for decide() — never re-allocated
    const aiCtx = {
      distance: 0,
      playerAttacking: false,
      playerAttackHeight: null as Height | null,
      cpuBusy: false,
    };

    function report() {
      if (s.score !== reportedScore) {
        reportedScore = s.score;
        scoreText = `PUNTOS ${s.score}`;
        onScoreChange(s.score);
      }
      if (s.level !== reportedLevel) {
        reportedLevel = s.level;
        levelText = `RIVAL ${s.level}`;
        onLevelChange(s.level);
      }
      if (s.lives !== reportedLives) {
        reportedLives = s.lives;
        onLivesChange(s.lives);
      }
    }

    function canAct(f: Fighter): boolean {
      return f.tech === null && f.stunMs <= 0 && s.gameMs >= f.busyUntilMs;
    }

    function startTechnique(f: Fighter, t: Technique) {
      f.tech = t;
      f.techStartMs = s.gameMs;
      f.techPose = TECH_POSE_INDEX.get(t.id) ?? POSE_IDLE;
      f.hitEvaluated = false;
      f.blockingHeight = null;
      f.walking = false;
      sfxKarateChamp.play('whoosh');
    }

    function resetCorners() {
      resetFighter(s.player, PLAYER_START_X);
      resetFighter(s.cpu, CPU_START_X);
      s.aiMs = 0;
      s.aiMove = 'idle';
    }

    function resetFighter(f: Fighter, x: number) {
      f.x = x;
      f.tech = null;
      f.hitEvaluated = false;
      f.stunMs = 0;
      f.blockingHeight = null;
      f.busyUntilMs = 0;
      f.walking = false;
      f.walkMs = 0;
    }

    function doGameOver() {
      s.lives = 0;
      s.over = true;
      s.phase = 'over';
      report();
      if (!endFired) {
        endFired = true;
        onGameOver(s.score);
        sfxKarateChamp.play('game_over');
      }
    }

    function startWin() {
      s.phase = 'win';
      s.phaseMs = WIN_MS;
      s.score +=
        OPPONENT_BONUS + timeBonus(Math.max(0, ROUND_LIMIT_MS - s.match.roundMs));
      s.wins += 1;
      sfxKarateChamp.play('gong');
      report();
    }

    function startBonus() {
      s.phase = 'bonus';
      s.bonusIndex = 0;
      s.bonusMs = 0;
      s.bonusResultMs = 0;
      s.bonusHit = false;
    }

    function nextMatch() {
      s.level += 1;
      s.introText = `RIVAL ${s.level}`;
      s.match = makeMatch();
      resetCorners();
      s.phase = 'intro';
      s.phaseMs = INTRO_MS;
      sfxKarateChamp.play('gong');
      report();
    }

    function landPoint(who: 'player' | 'cpu', t: Technique) {
      const defender = who === 'player' ? s.cpu : s.player;
      defender.stunMs = STUN_MS;
      sfxKarateChamp.play('hit');
      s.match = applyPoint(s.match, who, t.points);
      if (who === 'player') {
        s.score += t.points === 1 ? SCORE_PER_POINT.full : SCORE_PER_POINT.half;
      }
      const winner = matchWinner(s.match);
      s.bannerIdx = t.points === 1 ? BANNER_FULL : BANNER_HALF;
      s.afterBanner =
        winner === null ? 'resume' : winner === 'player' ? 'win' : 'lose';
      s.phase = 'banner';
      s.phaseMs = BANNER_MS;
      sfxKarateChamp.play(t.points === 1 ? 'full_point' : 'half_point');
      report();
    }

    function updateTechnique(f: Fighter, def: Fighter, who: 'player' | 'cpu', dt: number) {
      const t = f.tech;
      if (t === null) return;
      const elapsed = s.gameMs - f.techStartMs;
      // "avanza" techniques lunge forward during startup
      if (t.input.dir === 'forward' && elapsed < t.startupMs) {
        const dir = def.x > f.x ? 1 : -1;
        f.x += dir * LUNGE_SPEED * dt;
        if (dir > 0 && f.x > def.x - MIN_GAP) f.x = def.x - MIN_GAP;
        if (dir < 0 && f.x < def.x + MIN_GAP) f.x = def.x + MIN_GAP;
      }
      if (!f.hitEvaluated && elapsed >= t.startupMs) {
        f.hitEvaluated = true;
        // busyUntilMs still holds the PREVIOUS technique's end (≤ techStartMs,
        // guaranteed by the canAct gate), so landsHit's busy check is honest
        const landed = landsHit(f, def, t, f.techStartMs);
        f.busyUntilMs = f.techStartMs + t.startupMs + t.recoveryMs;
        if (landed) {
          landPoint(who, t);
          return;
        }
        const dist = Math.abs(def.x - f.x);
        if (dist <= t.range && def.blockingHeight === t.height) {
          sfxKarateChamp.play('block');
        }
      }
      if (elapsed >= t.startupMs + t.recoveryMs) f.tech = null;
    }

    function runAiDecision() {
      aiCtx.distance = Math.abs(s.cpu.x - s.player.x);
      aiCtx.playerAttacking = s.player.tech !== null && !s.player.hitEvaluated;
      aiCtx.playerAttackHeight = s.player.tech !== null ? s.player.tech.height : null;
      aiCtx.cpuBusy = !canAct(s.cpu);
      const action = decide(s.level, aiCtx, Math.random);
      s.aiMove = action.move;
      if (s.cpu.tech === null) s.cpu.blockingHeight = action.block;
      if (action.attack !== null && canAct(s.cpu)) {
        startTechnique(
          s.cpu,
          resolveTechnique(action.attack.dir, action.attack.button),
        );
      }
    }

    function handleTimeout() {
      const winner = matchWinner(s.match);
      if (winner === 'player') {
        startWin();
        return;
      }
      if (winner === 'cpu') {
        doGameOver();
        return;
      }
      // Tie at 30 s → golden point: next clean technique decides. lastPointBy
      // is cleared so a stale earlier point can never resolve the match.
      s.match = { ...s.match, goldenPoint: true, lastPointBy: undefined };
      s.bannerIdx = BANNER_GOLDEN;
      s.afterBanner = 'resume';
      s.phase = 'banner';
      s.phaseMs = BANNER_MS;
      sfxKarateChamp.play('gong');
    }

    function updateFight(dtMs: number) {
      const dt = dtMs / 1000;
      s.gameMs += dtMs;
      s.match.roundMs += dtMs;

      if (s.player.stunMs > 0) s.player.stunMs = Math.max(0, s.player.stunMs - dtMs);
      if (s.cpu.stunMs > 0) s.cpu.stunMs = Math.max(0, s.cpu.stunMs - dtMs);

      // Player movement (← retreats / → advances) while free
      s.player.walking = false;
      if (canAct(s.player)) {
        const vx = (rightDown ? 1 : 0) - (leftDown ? 1 : 0);
        if (vx !== 0) {
          s.player.x += vx * PLAYER_SPEED * dt;
          if (s.player.x < ARENA_LEFT) s.player.x = ARENA_LEFT;
          if (s.player.x > s.cpu.x - MIN_GAP) s.player.x = s.cpu.x - MIN_GAP;
          s.player.walking = true;
          s.player.walkMs = (s.player.walkMs + dtMs) % (WALK_FRAME_MS * 2);
        }
      }

      // CPU decision cadence gated by reactionMs; acts on the result until next
      s.aiMs += dtMs;
      if (s.aiMs >= opponentFor(s.level)[0]) {
        s.aiMs = 0;
        runAiDecision();
      }

      s.cpu.walking = false;
      if (canAct(s.cpu) && s.cpu.blockingHeight === null) {
        if (s.aiMove === 'approach') {
          s.cpu.x -= CPU_SPEED * dt;
          s.cpu.walking = true;
        } else if (s.aiMove === 'retreat') {
          s.cpu.x += CPU_SPEED * dt;
          s.cpu.walking = true;
        }
        if (s.cpu.walking) {
          if (s.cpu.x > ARENA_RIGHT) s.cpu.x = ARENA_RIGHT;
          if (s.cpu.x < s.player.x + MIN_GAP) s.cpu.x = s.player.x + MIN_GAP;
          s.cpu.walkMs = (s.cpu.walkMs + dtMs) % (WALK_FRAME_MS * 2);
        }
      }

      updateTechnique(s.player, s.cpu, 'player', dt);
      if (s.phase !== 'fight') return;
      updateTechnique(s.cpu, s.player, 'cpu', dt);
      if (s.phase !== 'fight') return;

      if (!s.match.goldenPoint && s.match.roundMs >= ROUND_LIMIT_MS) {
        handleTimeout();
      }
    }

    function updateBonus(dtMs: number) {
      if (s.bonusResultMs > 0) {
        s.bonusResultMs -= dtMs;
        if (s.bonusResultMs <= 0) {
          s.bonusResultMs = 0;
          s.bonusIndex += 1;
          if (s.bonusIndex >= BOARD_SCORES.length) {
            nextMatch();
            return;
          }
          s.bonusMs = 0;
        }
        return;
      }
      s.bonusMs += dtMs;
    }

    function strikeBoard() {
      const quality = hitQuality(barPhase(s.bonusMs, s.bonusIndex));
      s.bonusHit = quality === 'hit';
      if (s.bonusHit) {
        s.score += BOARD_SCORES[s.bonusIndex];
        sfxKarateChamp.play('board_break');
      } else {
        sfxKarateChamp.play('board_miss');
      }
      s.bonusResultMs = BONUS_RESULT_MS;
      report();
    }

    function update(dtMs: number) {
      switch (s.phase) {
        case 'intro':
          s.phaseMs -= dtMs;
          if (s.phaseMs <= 0) s.phase = 'fight';
          return;
        case 'fight':
          updateFight(dtMs);
          return;
        case 'banner':
          s.phaseMs -= dtMs;
          if (s.phaseMs <= 0) {
            if (s.afterBanner === 'resume') {
              resetCorners();
              s.phase = 'fight';
            } else if (s.afterBanner === 'win') {
              startWin();
            } else {
              doGameOver();
            }
          }
          return;
        case 'win':
          s.phaseMs -= dtMs;
          if (s.phaseMs <= 0) {
            if (s.wins % BONUS_WINS_EVERY === 0) startBonus();
            else nextMatch();
          }
          return;
        case 'bonus':
          updateBonus(dtMs);
          return;
        case 'over':
          return;
      }
    }

    // ── Draw ────────────────────────────────────────────────────────────────

    function poseFor(f: Fighter): number {
      if (f.stunMs > 0) return POSE_STUN;
      if (f.tech !== null) return f.techPose;
      if (f.blockingHeight === 'high') return POSE_BLOCK_HIGH;
      if (f.blockingHeight === 'mid') return POSE_BLOCK_MID;
      if (f.blockingHeight === 'low') return POSE_BLOCK_LOW;
      if (f.walking) {
        return f.walkMs < WALK_FRAME_MS ? POSE_WALK0 : POSE_WALK1;
      }
      return POSE_IDLE;
    }

    // Neon sprites are baked with symmetric glow padding, so they're larger
    // than SPR_W × SPR_H; centering on spr.width/height keeps the same visual
    // anchor (feet on FLOOR_Y, horizontally centered on f.x) for every skin.
    function drawFighter(sprites: HTMLCanvasElement[], f: Fighter) {
      const spr = sprites[poseFor(f)];
      const pad = (spr.width - SPR_W) / 2;
      ctx.drawImage(spr, f.x - spr.width / 2, FLOOR_Y - SPR_H - pad);
    }

    function drawFlag(x: number, y: number, filled: boolean, color: string) {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.fillRect(x, y, 2, 18);
      ctx.beginPath();
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + 14, y + 4);
      ctx.lineTo(x + 2, y + 8);
      ctx.closePath();
      if (filled) ctx.fill();
      else ctx.stroke();
    }

    function drawHud(skinNow: Skin) {
      ctx.font = 'bold 16px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = skinNow.hud;
      ctx.fillText(scoreText, 12, 22);

      // Match points as flags TC: player halves fill outward left of center,
      // CPU halves right of center. 2 points to win = 4 half-flags per side.
      const playerHalves = s.match.playerPoints * 2;
      const cpuHalves = s.match.cpuPoints * 2;
      for (let i = 0; i < 4; i++) {
        drawFlag(CANVAS_W / 2 - 40 - i * 22, 10, i < playerHalves, skinNow.flagPlayer);
        drawFlag(CANVAS_W / 2 + 26 + i * 22, 10, i < cpuHalves, skinNow.flagCpu);
      }

      // Timer under the flags
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = skinNow.hudAccent;
      const isNeon = skinNow.name === 'neon';
      if (isNeon) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = skinNow.hudAccent;
      }
      if (s.match.goldenPoint) {
        ctx.fillText(GOLDEN_TIMER_TEXT, CANVAS_W / 2, 44);
      } else {
        let secs = Math.ceil((ROUND_LIMIT_MS - s.match.roundMs) / 1000);
        if (secs < 0) secs = 0;
        if (secs > 30) secs = 30;
        ctx.fillText(TIMER_TEXT[secs], CANVAS_W / 2, 44);
      }

      // Rival level BR
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillText(levelText, CANVAS_W - 12, CANVAS_H - 18);
      if (isNeon) ctx.shadowBlur = 0;
    }

    function drawBanner(skinNow: Skin, text: string) {
      ctx.font = 'bold 44px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = skinNow.hudAccent;
      if (skinNow.name === 'neon') {
        ctx.shadowBlur = 14;
        ctx.shadowColor = skinNow.hudAccent;
        ctx.fillText(text, CANVAS_W / 2, 190);
        ctx.shadowBlur = 0;
        return;
      }
      ctx.fillText(text, CANVAS_W / 2, 190);
    }

    function drawBonus(skinNow: Skin) {
      const sprites = getSprites(skinNow);
      const idx = s.bonusIndex;

      // Fighter mid-tatami; punch pose while the strike result shows
      const pose = s.bonusResultMs > 0 ? POSE_TECH_BASE : POSE_IDLE;
      const spr = sprites.player[pose];
      const pad = (spr.width - SPR_W) / 2;
      ctx.drawImage(spr, 330 - spr.width / 2, FLOOR_Y - SPR_H - pad);

      // Board on two posts
      ctx.fillStyle = skinNow.hud;
      ctx.fillRect(440, 330, 6, FLOOR_Y - 330);
      ctx.fillRect(540, 330, 6, FLOOR_Y - 330);
      ctx.fillStyle = skinNow.board;
      if (s.bonusResultMs > 0 && s.bonusHit) {
        // Broken: two tilted halves
        ctx.save();
        ctx.translate(465, 335);
        ctx.rotate(-0.5);
        ctx.fillRect(-25, -8, 50, 16);
        ctx.restore();
        ctx.save();
        ctx.translate(520, 335);
        ctx.rotate(0.5);
        ctx.fillRect(-25, -8, 50, 16);
        ctx.restore();
      } else {
        ctx.fillRect(438, 322, 110, 16);
      }

      // Labels
      ctx.font = 'bold 22px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillText(BONUS_LABELS[idx], CANVAS_W / 2, 120);
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = skinNow.hud;
      ctx.fillText(BONUS_HELP_TEXT, CANVAS_W / 2, 150);

      if (s.bonusResultMs > 0) {
        ctx.font = 'bold 34px monospace';
        ctx.fillStyle = s.bonusHit ? skinNow.zone : skinNow.flagCpu;
        ctx.fillText(s.bonusHit ? BONUS_HIT_TEXT[idx] : BONUS_MISS_TEXT, CANVAS_W / 2, 210);
      }

      // Oscillating bar
      const barX = 250;
      const barY = 452;
      const barW = 300;
      const barH = 16;
      ctx.fillStyle = skinNow.barTrack;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = skinNow.zone;
      ctx.fillRect(
        barX + GREEN_ZONE[0] * barW,
        barY,
        (GREEN_ZONE[1] - GREEN_ZONE[0]) * barW,
        barH,
      );
      ctx.strokeStyle = skinNow.hud;
      ctx.strokeRect(barX, barY, barW, barH);
      const phase = barPhase(s.bonusMs, idx);
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillRect(barX + phase * barW - 2, barY - 5, 4, barH + 10);
    }

    function draw() {
      const skinNow = skinRef.current;

      ctx.fillStyle = skinNow.bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Tatami
      ctx.fillStyle = skinNow.floor;
      ctx.fillRect(0, FLOOR_Y, CANVAS_W, CANVAS_H - FLOOR_Y);
      ctx.fillStyle = skinNow.floorLine;
      if (skinNow.name === 'neon') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = skinNow.floorLine;
        ctx.fillRect(0, FLOOR_Y, CANVAS_W, 3);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillRect(0, FLOOR_Y, CANVAS_W, 3);
      }

      if (s.phase === 'bonus') {
        drawBonus(skinNow);
      } else {
        const sprites = getSprites(skinNow);
        drawFighter(sprites.player, s.player);
        drawFighter(sprites.cpu, s.cpu);

        if (s.phase === 'intro') drawBanner(skinNow, s.introText);
        else if (s.phase === 'banner') drawBanner(skinNow, BANNERS[s.bannerIdx]);
        else if (s.phase === 'win') drawBanner(skinNow, BANNERS[BANNER_WINNER]);
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

    function heldDir(): Dir {
      if (upDown) return 'up';
      if (downDown) return 'down';
      if (rightDown) return 'forward';
      return 'neutral';
    }

    function pressButton(button: TechButton) {
      if (s.over || pausedRef.current) return;
      if (s.phase === 'bonus') {
        if (button === 'a' && s.bonusResultMs <= 0) strikeBoard();
        return;
      }
      if (s.phase !== 'fight') return;
      if (!canAct(s.player)) return;
      startTechnique(s.player, resolveTechnique(heldDir(), button));
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (!sfxReady) {
        sfxReady = true;
        sfxKarateChamp.init();
        sfxKarateChamp.setMuted(mutedRef.current);
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
        pressButton('a');
      } else if (key === 'k') {
        e.preventDefault();
        pressButton('b');
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') leftDown = false;
      else if (key === 'arrowright' || key === 'd') rightDown = false;
      else if (key === 'arrowup' || key === 'w') upDown = false;
      else if (key === 'arrowdown' || key === 's') downDown = false;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      sfxKarateChamp.dispose();
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

export default React.memo(KarateChampGame);
