'use client';

import React, { useEffect, useRef } from 'react';

import { createAiAction, decide, profileFor, type AiContext, type AiProfile } from './fighter-logic/ai';
import {
  applyDamage,
  boutWinner,
  commitRound,
  createBout,
  HIT_STUN_MS,
  isMagicReady,
  MAGIC_MAX,
  MAX_HEALTH,
  MIN_GAP,
  ROUND_TIME_MS,
  roundWinner,
  ROUNDS_TO_WIN,
  spendMagic,
  startBout,
  startRound,
  type BoutState,
  type CombatantState,
  type Side,
} from './fighter-logic/combat';
import {
  bossFighter,
  fighterById,
  ROSTER,
  selectableFighters,
  STAT_MAX,
  type FighterDef,
} from './fighter-logic/fighters';
import {
  castMagic,
  createMagicRuntime,
  MAGIC_SPECS,
  resetMagicRuntime,
  stepMagic,
  type MagicRuntime,
  type MagicSide,
} from './fighter-logic/magic';
import { STAGES, type StageDef } from './fighter-logic/stages';
import {
  acceptContinue,
  awardDamage,
  awardRound,
  BOUTS,
  createStory,
  currentDifficulty,
  currentOpponent,
  currentStage,
  declineContinue,
  loseBout,
  tickContinue,
  winBout,
  type StoryState,
} from './fighter-logic/story';
import {
  createHitOutcome,
  resolveHit,
  resolveTechnique,
  scaledRecovery,
  scaledStartup,
  TECHNIQUES,
  type Dir,
  type TechButton,
  type Technique,
} from './fighter-logic/techniques';
import { sfxVaultFighter } from '@/lib/sfx-vault-fighter';

interface VaultFighterGameProps {
  paused: boolean;
  muted?: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onBoutChange: (bout: number) => void;
  onRoundsChange: (playerRounds: number, cpuRounds: number) => void;
  onMagicReadyChange: (ready: boolean) => void;
  onGameOver: (finalScore: number) => void;
  onVictory: (finalScore: number) => void;
}

// ── Geometry ──────────────────────────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 500;
const FLOOR_Y = 424;
const ARENA_LEFT = 80;
const ARENA_RIGHT = 720;
// MIN_GAP and HIT_STUN_MS are game RULES, not canvas geometry: they live in
// fighter-logic/combat.ts, where roster-invariants can prove them against
// TECHNIQUES and ROSTER. They used to be local literals here (40 / 340), which
// killed three techniques outright and made every hit loop forever.

// ── Tuning ────────────────────────────────────────────────────────────────────

const PLAYER_SPEED = 180;
const CPU_SPEED = 140;
const LUNGE_SPEED = 260;
const WALK_FRAME_MS = 140;
const BLINK_MS = 200;

const INTRO_MS = 1300;
const ROUND_END_MS = 1200;
const BOUT_END_MS = 1700;

const SELECTABLE_FIGHTERS: readonly FighterDef[] = selectableFighters(ROSTER);
const BOSS = bossFighter(ROSTER);
const SELECT_COLS = 4;
const SELECT_ROWS = 2;

// Pre-built HUD strings so draw() never allocates one per frame.
const BOUT_TEXT: string[] = [];
for (let i = 1; i <= BOUTS; i++) BOUT_TEXT.push(`COMBATE ${String(i).padStart(2, '0')}/${BOUTS}`);
const ROUND_INTRO_TEXT: string[] = ['ASALTO 1'];
for (let i = 2; i <= 12; i++) ROUND_INTRO_TEXT.push(`ASALTO ${i}`);
const CONTINUE_TEXT: string[] = [];
for (let i = 0; i <= 10; i++) CONTINUE_TEXT.push(`CONTINUE ${i}`);
// Round clock: a round is cut short at ROUND_TIME_MS and awarded on health, so
// without this the round just ended for no visible reason. One pre-built string
// per whole second — draw() only ever indexes this array.
const ROUND_SECONDS = Math.ceil(ROUND_TIME_MS / 1000);
const TIMER_TEXT: string[] = [];
for (let i = 0; i <= ROUND_SECONDS; i++) TIMER_TEXT.push(String(i).padStart(2, '0'));
const TIMER_DANGER_SECONDS = 10;

const STAT_LABELS = ['FUE', 'VEL', 'ALC'] as const;
function statValue(def: FighterDef, idx: number): number {
  if (idx === 0) return def.strength;
  if (idx === 1) return def.speed;
  return def.reach;
}

// technique id → Technique, built once (avoids storing object refs on CombatantState)
const TECH_BY_ID = new Map<string, Technique>();
for (const t of TECHNIQUES) TECH_BY_ID.set(t.id, t);

// ── Poses (shared skeleton, 4-color pixel figure) ──────────────────────────────

const POSE_GRID_W = 20;
const POSE_GRID_H = 26;
const POSE_PX = 4;
const SPR_W = POSE_GRID_W * POSE_PX;
const SPR_H = POSE_GRID_H * POSE_PX;

const POSE_IDLE = 0;
const POSE_WALK0 = 1;
const POSE_WALK1 = 2;
const POSE_BLOCK = 3;
const POSE_CROUCH = 4;
const POSE_STUN = 5;
const POSE_KO = 6;
const POSE_TECH_BASE = 7;

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

// Order: idle, walk0, walk1, block, crouch, stun, ko, then the 8 techniques in
// TECHNIQUES array order (shared with karate-champ's technique set).
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
  // block — forearms crossed vertically in front of the torso
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
  // crouch — deep bend, arms low, guarding the low line
  {
    h: [9, 8],
    g: [
      [9, 11, 9, 18, 3],
      [9, 13, 12, 15, 2],
      [12, 15, 12, 18, 2],
      [9, 13, 6, 15, 2],
      [6, 15, 6, 18, 2],
      [9, 18, 11, 21, 2],
      [11, 21, 11, 24, 2],
      [9, 18, 7, 21, 2],
      [7, 21, 7, 24, 2],
    ],
    s: [
      [12.5, 18.5, 2],
      [5.5, 18.5, 2],
      [12, 24.5, 2],
      [7, 24.5, 2],
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
  // ko — flattened on the canvas floor
  {
    h: [2, 21],
    g: [
      [4, 21, 15, 19, 3],
      [15, 19, 18, 16, 2],
      [15, 19, 18, 21, 2],
      [6, 22, 9, 24, 2],
      [4, 22, 2, 25, 2],
    ],
    s: [
      [18.5, 15.5, 2],
      [18.5, 21.5, 2],
      [9.5, 24.5, 2],
      [1.5, 25.5, 2],
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

const TECH_POSE_INDEX = new Map<string, number>();
for (let i = 0; i < TECHNIQUES.length; i++) {
  TECH_POSE_INDEX.set(TECHNIQUES[i].id, POSE_TECH_BASE + i);
}

function cell(c: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  c.fillRect(
    Math.round((cx - size / 2) * POSE_PX),
    Math.round((cy - size / 2) * POSE_PX),
    size * POSE_PX,
    size * POSE_PX,
  );
}

function drawSeg(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2) + 1;
  for (let i = 0; i <= steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    cell(c, x, y, w);
  }
}

type PoseBakeOpts = {
  highlight?: boolean;
  glowColor?: string;
  glowBlur?: number;
};

// Baked once per (fighter, skin, facing) at first use; the hot path only ever
// calls drawImage — it never sets shadowBlur or creates a canvas per frame.
// `trimColor` is the per-fighter signature colour. It used to reach the sprite
// only through the neon skin's glow, so in classic and retro the eight fighters
// were eight near-black silhouettes. It now paints the torso — spec.g[0], the
// width-3 spine segment present in every pose — in all three skins.
function bakePose(
  spec: PoseSpec,
  bodyColor: string,
  trimColor: string,
  accentColor: string,
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
    c.fillStyle = bodyColor;
    for (let i = 1; i < spec.g.length; i++) {
      const [x1, y1, x2, y2, w] = spec.g[i];
      drawSeg(c, mx(x1), y1, mx(x2), y2, w);
    }
    c.fillStyle = trimColor;
    const [tx1, ty1, tx2, ty2, tw] = spec.g[0];
    drawSeg(c, mx(tx1), ty1, mx(tx2), ty2, tw);
    c.fillStyle = accentColor;
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
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(0, 0, el.width, Math.ceil(SPR_H * 0.3) + pad);
    c.globalCompositeOperation = 'source-over';
  }

  return el;
}

// ── Skins ─────────────────────────────────────────────────────────────────────

type Skin = {
  name: string;
  hud: string;
  hudAccent: string;
  hudDanger: string;
  barTrack: string;
  magicBar: string;
  panel: string;
  panelBorder: string;
  highlight: boolean;
  glow: boolean;
};

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'classic',
    hud: '#ffffff',
    hudAccent: '#ffd700',
    hudDanger: '#ff3344',
    barTrack: '#2a2a2a',
    magicBar: '#3ac8ff',
    panel: 'rgba(10, 10, 16, 0.72)',
    panelBorder: '#ffd700',
    highlight: false,
    glow: false,
  },
  retro: {
    name: 'retro',
    hud: '#fef6e4',
    hudAccent: '#ffb599',
    hudDanger: '#ff8a80',
    barTrack: '#4a3a5e',
    magicBar: '#8de8a0',
    panel: 'rgba(36, 26, 48, 0.78)',
    panelBorder: '#ffb599',
    highlight: true,
    glow: false,
  },
  neon: {
    name: 'neon',
    hud: '#eafcff',
    hudAccent: '#ff00e5',
    hudDanger: '#ff3b6e',
    barTrack: '#151022',
    magicBar: '#39ff88',
    panel: 'rgba(5, 0, 12, 0.75)',
    panelBorder: '#00eaff',
    highlight: false,
    glow: true,
  },
};

// ── Fighter sprites (module-level cache, lazy per fighter+skin) ───────────────

type FighterSprites = { right: HTMLCanvasElement[]; left: HTMLCanvasElement[] };
const spriteCache = new Map<string, FighterSprites>();

function getFighterSprites(def: FighterDef, skin: Skin): FighterSprites {
  const key = `${def.id}|${skin.name}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const right: HTMLCanvasElement[] = [];
  const left: HTMLCanvasElement[] = [];
  const opts: PoseBakeOpts = {
    highlight: skin.highlight,
    glowColor: skin.glow ? def.palette.trim : undefined,
    glowBlur: 6,
  };
  for (let i = 0; i < POSES.length; i++) {
    right.push(bakePose(POSES[i], def.palette.body, def.palette.trim, def.palette.accent, false, opts));
    left.push(bakePose(POSES[i], def.palette.body, def.palette.trim, def.palette.accent, true, opts));
  }
  const sprites = { right, left };
  spriteCache.set(key, sprites);
  return sprites;
}

// ── Stage baking (8 backgrounds, one offscreen canvas per bout/skin) ──────────

function drawSilhouette(c: CanvasRenderingContext2D, stage: StageDef) {
  c.fillStyle = stage.accent;
  c.globalAlpha = 0.28;
  switch (stage.silhouette) {
    case 'towers': {
      const widths = [60, 90, 50, 110, 70, 95, 55];
      let x = 10;
      for (let i = 0; i < widths.length; i++) {
        const h = 90 + ((i * 47) % 160);
        c.fillRect(x, FLOOR_Y - h, widths[i], h);
        x += widths[i] + 14;
      }
      break;
    }
    case 'pipes': {
      for (let i = 0; i < 5; i++) c.fillRect(40 + i * 150, 40, 26, FLOOR_Y - 60);
      for (let i = 0; i < 4; i++) c.fillRect(0, 90 + i * 80, CANVAS_W, 18);
      break;
    }
    case 'arcs': {
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(90 + i * 210, FLOOR_Y, 100, Math.PI, 2 * Math.PI);
        c.fill();
      }
      break;
    }
    case 'grid': {
      for (let x = 0; x <= CANVAS_W; x += 50) c.fillRect(x, 20, 3, FLOOR_Y - 20);
      for (let y = 20; y < FLOOR_Y; y += 50) c.fillRect(0, y, CANVAS_W, 3);
      break;
    }
    case 'spires': {
      const bases = [60, 220, 380, 540, 700];
      for (let i = 0; i < bases.length; i++) {
        const h = 130 + ((i * 61) % 140);
        c.beginPath();
        c.moveTo(bases[i] - 30, FLOOR_Y);
        c.lineTo(bases[i], FLOOR_Y - h);
        c.lineTo(bases[i] + 30, FLOOR_Y);
        c.closePath();
        c.fill();
      }
      break;
    }
    case 'dunes': {
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.ellipse(80 + i * 170, FLOOR_Y + 30, 160, 90, 0, 0, 2 * Math.PI);
        c.fill();
      }
      break;
    }
    case 'ribs': {
      for (let i = 0; i < 8; i++) c.fillRect(30 + i * 100, 30, 20, FLOOR_Y - 30);
      c.globalAlpha = 0.18;
      for (let i = 0; i < 6; i++) c.fillRect(0, 60 + i * 60, CANVAS_W, 10);
      break;
    }
    case 'core': {
      for (let r = 220; r > 40; r -= 45) {
        c.beginPath();
        c.arc(CANVAS_W / 2, FLOOR_Y - 60, r, 0, 2 * Math.PI);
        c.lineWidth = 14;
        c.strokeStyle = stage.accent;
        c.stroke();
      }
      break;
    }
  }
  c.globalAlpha = 1;
}

function bakeStage(stage: StageDef, skin: Skin): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = CANVAS_W;
  el.height = CANVAS_H;
  const c = el.getContext('2d')!;

  const grad = c.createLinearGradient(0, 0, 0, FLOOR_Y);
  grad.addColorStop(0, stage.sky[0]);
  grad.addColorStop(1, stage.sky[1]);
  c.fillStyle = grad;
  c.fillRect(0, 0, CANVAS_W, FLOOR_Y);

  drawSilhouette(c, stage);

  c.fillStyle = stage.ground;
  c.fillRect(0, FLOOR_Y, CANVAS_W, CANVAS_H - FLOOR_Y);
  c.fillStyle = stage.accent;
  if (skin.glow) {
    c.shadowBlur = 10;
    c.shadowColor = stage.accent;
    c.fillRect(0, FLOOR_Y, CANVAS_W, 3);
    c.shadowBlur = 0;
  } else {
    c.fillRect(0, FLOOR_Y, CANVAS_W, 3);
  }
  if (skin.highlight) {
    c.globalAlpha = 0.12;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, CANVAS_W, 40);
    c.globalAlpha = 1;
  }

  return el;
}

// ── State ─────────────────────────────────────────────────────────────────────

type Phase = 'select' | 'intro' | 'fight' | 'round-end' | 'bout-end' | 'continue' | 'over';

type GameState = {
  phase: Phase;
  phaseMs: number;
  gameMs: number;
  selectIndex: number;
  introText: string;
  roundBanner: Side | 'draw' | null;
  boutBannerWinner: Side | null;
  wasKo: boolean;
  aiMs: number;
  cpuMove: 'approach' | 'retreat' | 'idle';
  blinkMs: number;
  over: boolean;
  victory: boolean;
};

function initialState(): GameState {
  return {
    phase: 'select',
    phaseMs: 0,
    gameMs: 0,
    selectIndex: 0,
    introText: '',
    roundBanner: null,
    boutBannerWinner: null,
    wasKo: false,
    aiMs: 0,
    cpuMove: 'idle',
    blinkMs: 0,
    over: false,
    victory: false,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

function VaultFighterGame({
  paused,
  muted = false,
  skinKey = 'classic',
  onScoreChange,
  onBoutChange,
  onRoundsChange,
  onMagicReadyChange,
  onGameOver,
  onVictory,
}: VaultFighterGameProps) {
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
    sfxVaultFighter.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    skinRef.current = SKINS[skinKey] ?? SKINS.classic;
  }, [skinKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current!;

    // ── State created once, mutated in place — never reallocated per frame ──
    const bout: BoutState = createBout(SELECTABLE_FIGHTERS[0], SELECTABLE_FIGHTERS[0]);
    const playerRt: MagicRuntime = createMagicRuntime();
    const cpuRt: MagicRuntime = createMagicRuntime();
    const playerSide: MagicSide = { side: 'player', c: bout.player, rt: playerRt };
    const cpuSide: MagicSide = { side: 'cpu', c: bout.cpu, rt: cpuRt };
    const hitOut = createHitOutcome();
    const aiOut = createAiAction();
    const aiCtx: AiContext = {
      distance: 0,
      playerAttacking: false,
      playerAttackHeight: null,
      cpuBusy: false,
      cpuMagicReady: false,
    };
    let story: StoryState = createStory(ROSTER, SELECTABLE_FIGHTERS[0].id);
    let profile: AiProfile = profileFor(SELECTABLE_FIGHTERS[0], 1);
    let stageCanvas: HTMLCanvasElement | null = null;
    let bakedBoutIndex = -1;
    let bakedSkinName = '';

    // Resolved lazily and cached by reference, refreshed only when the
    // fighter or the skin actually changes — drawFighter() never re-derives
    // a cache key (which would allocate a string) once per frame.
    let playerSprites: FighterSprites = getFighterSprites(bout.player.def, skinRef.current);
    let cpuSprites: FighterSprites = getFighterSprites(bout.cpu.def, skinRef.current);
    let playerSpriteFighterId = bout.player.def.id;
    let playerSpriteSkin = skinRef.current.name;
    let cpuSpriteFighterId = bout.cpu.def.id;
    let cpuSpriteSkin = skinRef.current.name;

    function refreshSpritesIfNeeded(skinNow: Skin) {
      if (bout.player.def.id !== playerSpriteFighterId || playerSpriteSkin !== skinNow.name) {
        playerSprites = getFighterSprites(bout.player.def, skinNow);
        playerSpriteFighterId = bout.player.def.id;
        playerSpriteSkin = skinNow.name;
      }
      if (bout.cpu.def.id !== cpuSpriteFighterId || cpuSpriteSkin !== skinNow.name) {
        cpuSprites = getFighterSprites(bout.cpu.def, skinNow);
        cpuSpriteFighterId = bout.cpu.def.id;
        cpuSpriteSkin = skinNow.name;
      }
    }

    // Reported-value caches so callbacks fire only on change, and HUD strings
    // are only rebuilt when the underlying number changes (TIMER_TEXT pattern).
    let reportedScore = -1;
    let reportedBout = -1;
    let reportedPlayerRounds = -1;
    let reportedCpuRounds = -1;
    let reportedMagicReady = false;
    let scoreText = 'PUNTOS 0';
    let boutText = BOUT_TEXT[0];
    // Regenerated only when the whole second changes, never per frame.
    let timerSeconds = ROUND_SECONDS;
    let timerText = TIMER_TEXT[ROUND_SECONDS];
    let rivalName = '';
    let endFired = false;
    let sfxReady = false;

    let leftDown = false;
    let rightDown = false;
    let upDown = false;
    let downDown = false;

    function report() {
      if (story.score !== reportedScore) {
        reportedScore = story.score;
        scoreText = `PUNTOS ${story.score}`;
        onScoreChange(story.score);
      }
      if (story.bout !== reportedBout) {
        reportedBout = story.bout;
        boutText = BOUT_TEXT[Math.min(story.bout, BOUT_TEXT.length - 1)];
        onBoutChange(story.bout + 1);
      }
      if (bout.playerRounds !== reportedPlayerRounds || bout.cpuRounds !== reportedCpuRounds) {
        reportedPlayerRounds = bout.playerRounds;
        reportedCpuRounds = bout.cpuRounds;
        onRoundsChange(bout.playerRounds, bout.cpuRounds);
      }
    }

    function updateTimerText() {
      let secs = Math.ceil((ROUND_TIME_MS - bout.roundMs) / 1000);
      if (secs < 0) secs = 0;
      else if (secs > ROUND_SECONDS) secs = ROUND_SECONDS;
      if (secs !== timerSeconds) {
        timerSeconds = secs;
        timerText = TIMER_TEXT[secs];
      }
    }

    function canAct(c: CombatantState): boolean {
      return c.techId === null && s.gameMs >= c.busyUntilMs && s.gameMs >= c.stunUntilMs && c.health > 0;
    }

    // Re-checked on every phase transition that can change bout.player.magic
    // out from under the fight loop (a new round or bout resets it to 0), not
    // just once per fight frame — otherwise the C button stays lit through
    // the round/bout-end panels and the next intro banner.
    function reportMagicReady() {
      const readyNow = isMagicReady(bout.player);
      if (readyNow !== reportedMagicReady) {
        reportedMagicReady = readyNow;
        onMagicReadyChange(readyNow);
        if (readyNow) sfxVaultFighter.play('magic_ready');
      }
    }

    // Called when the run truly ends (CAMPEÓN/ELIMINADO) so the C button
    // never stays lit forever on a screen with no more input to give.
    function forceMagicReadyOff() {
      if (reportedMagicReady) {
        reportedMagicReady = false;
        onMagicReadyChange(false);
      }
    }

    function bakeCurrentStage() {
      const stage = currentStage(STAGES, story);
      stageCanvas = bakeStage(stage, skinRef.current);
      bakedBoutIndex = story.bout;
      bakedSkinName = skinRef.current.name;
    }

    function startTechnique(c: CombatantState, t: Technique) {
      c.techId = t.id;
      c.techStartMs = s.gameMs;
      c.hitEvaluated = false;
      c.stance = 'stand';
      c.walking = false;
      sfxVaultFighter.play('whoosh');
    }

    // Begins (or restarts, on CONTINUE) the bout at story's current index.
    function startBoutFor() {
      const playerDef = fighterById(ROSTER, story.playerId) ?? SELECTABLE_FIGHTERS[0];
      const opponentDef = story.bout === BOUTS - 1 ? BOSS : currentOpponent(ROSTER, story);
      startBout(bout, playerDef, opponentDef);
      updateTimerText();
      resetMagicRuntime(playerRt);
      resetMagicRuntime(cpuRt);
      profile = profileFor(opponentDef, currentDifficulty(story));
      rivalName = opponentDef.name;
      s.aiMs = 0;
      s.cpuMove = 'idle';
      s.gameMs = 0;
      s.introText = `¡${playerDef.name} VS ${opponentDef.name}!`;
      s.phase = 'intro';
      s.phaseMs = INTRO_MS;
      bakeCurrentStage();
      report();
      reportMagicReady();
    }

    function confirmSelection() {
      const chosen = SELECTABLE_FIGHTERS[s.selectIndex];
      story = createStory(ROSTER, chosen.id);
      endFired = false;
      s.over = false;
      s.victory = false;
      reportedScore = -1;
      reportedBout = -1;
      reportedPlayerRounds = -1;
      reportedCpuRounds = -1;
      startBoutFor();
    }

    function moveSelect(dx: number, dy: number) {
      let col = s.selectIndex % SELECT_COLS;
      let row = Math.floor(s.selectIndex / SELECT_COLS);
      col = (col + dx + SELECT_COLS) % SELECT_COLS;
      row = (row + dy + SELECT_ROWS) % SELECT_ROWS;
      s.selectIndex = row * SELECT_COLS + col;
      sfxVaultFighter.play('select');
    }

    function doGameOver() {
      s.over = true;
      s.phase = 'over';
      report();
      forceMagicReadyOff();
      if (!endFired) {
        endFired = true;
        onGameOver(story.score);
        sfxVaultFighter.play('game_over');
      }
    }

    function doVictory() {
      s.over = true;
      s.victory = true;
      s.phase = 'over';
      report();
      forceMagicReadyOff();
      if (!endFired) {
        endFired = true;
        onVictory(story.score);
        sfxVaultFighter.play('champion');
      }
    }

    // Melee damage goes straight into applyDamage, which is the single funnel
    // and absorbs the shield (MURO) itself. The component no longer knows the
    // shield exists; it only scores what actually got through.
    function dealDamage(from: Side, to: Side, rawDamage: number) {
      const dealt = applyDamage(bout, to, rawDamage);
      if (from === 'player' && dealt > 0) awardDamage(story, dealt);
    }

    function updateTechnique(atk: CombatantState, def: CombatantState, atkSide: Side, dtMs: number) {
      if (atk.techId === null) return;
      const t = TECH_BY_ID.get(atk.techId);
      if (t === undefined) {
        atk.techId = null;
        return;
      }
      const elapsed = s.gameMs - atk.techStartMs;
      const startup = scaledStartup(t, atk.def);
      const recovery = scaledRecovery(t, atk.def);

      if (t.advance > 0 && elapsed < startup) {
        atk.x += atk.facing * LUNGE_SPEED * (dtMs / 1000);
        clampSeparation(atk, def);
      }

      if (!atk.hitEvaluated && elapsed >= startup) {
        atk.hitEvaluated = true;
        resolveHit(atk, atk.def, def, t, atk.techStartMs, hitOut);
        atk.busyUntilMs = atk.techStartMs + startup + recovery;
        if (hitOut.result === 'hit' || hitOut.result === 'grazed') {
          const defSide: Side = atkSide === 'player' ? 'cpu' : 'player';
          dealDamage(atkSide, defSide, hitOut.damage);
          def.stunUntilMs = s.gameMs + HIT_STUN_MS;
          sfxVaultFighter.play('hit');
        } else if (hitOut.result === 'blocked') {
          sfxVaultFighter.play('block');
        } else if (hitOut.result === 'miss' || hitOut.result === 'evaded') {
          // Whiffing used to be completely silent, which is what made a
          // technique that fell short impossible to read.
          sfxVaultFighter.play('miss');
        }
      }

      if (elapsed >= startup + recovery) atk.techId = null;
    }

    // GLITCH's SALTO DE FASE teleports its caster to the far side of the foe, so
    // "the player is on the left" stops being true mid-round. Facing and the
    // separation clamps are therefore derived from the REAL order of the two x
    // positions on every frame, never from the round's opening arrangement.
    function syncFacing() {
      const p = bout.player;
      const c = bout.cpu;
      if (p.x <= c.x) {
        p.facing = 1;
        c.facing = -1;
      } else {
        p.facing = -1;
        c.facing = 1;
      }
    }

    // Keeps `mover` from walking through `other`, on whichever side it stands.
    function clampSeparation(mover: CombatantState, other: CombatantState) {
      if (mover.facing === 1) {
        if (mover.x > other.x - MIN_GAP) mover.x = other.x - MIN_GAP;
      } else if (mover.x < other.x + MIN_GAP) {
        mover.x = other.x + MIN_GAP;
      }
    }

    function updatePlayerControl(dt: number, dtMs: number) {
      const p = bout.player;
      if (!canAct(p)) {
        p.walking = false;
        return;
      }
      if (leftDown) {
        // ← is always "back": block AND retreat at once, same as → is always
        // "forward" — the classic fighting-game convention. Direction is
        // derived from facing (never from screen side) for the same reason
        // rightDown below does: GLITCH's phase jump can put the player on
        // either side of the arena.
        p.stance = 'block';
        p.x -= p.facing * PLAYER_SPEED * dt;
        if (p.x < ARENA_LEFT) p.x = ARENA_LEFT;
        else if (p.x > ARENA_RIGHT) p.x = ARENA_RIGHT;
        clampSeparation(p, bout.cpu);
        p.walking = true;
        p.walkMs = (p.walkMs + dtMs) % (WALK_FRAME_MS * 2);
        return;
      }
      if (downDown) {
        p.stance = 'crouch';
        p.walking = false;
        return;
      }
      p.stance = 'stand';
      if (rightDown) {
        // → is always "forward", i.e. toward the rival — which is -x after a
        // phase jump has put the player on the right-hand side.
        p.x += p.facing * PLAYER_SPEED * dt;
        if (p.x < ARENA_LEFT) p.x = ARENA_LEFT;
        else if (p.x > ARENA_RIGHT) p.x = ARENA_RIGHT;
        clampSeparation(p, bout.cpu);
        p.walking = true;
        p.walkMs = (p.walkMs + dtMs) % (WALK_FRAME_MS * 2);
      } else {
        p.walking = false;
      }
    }

    function runAiDecision() {
      const p = bout.player;
      const c = bout.cpu;
      const playerTechId = p.techId;
      aiCtx.distance = Math.abs(c.x - p.x);
      aiCtx.playerAttacking = playerTechId !== null && !p.hitEvaluated;
      aiCtx.playerAttackHeight = playerTechId !== null ? (TECH_BY_ID.get(playerTechId)?.height ?? null) : null;
      aiCtx.cpuBusy = !canAct(c);
      aiCtx.cpuMagicReady = isMagicReady(c);
      decide(profile, aiCtx, Math.random, aiOut);

      if (!canAct(c)) {
        s.cpuMove = 'idle';
        return;
      }
      if (aiOut.magic) {
        spendMagic(c);
        castMagic(MAGIC_SPECS[c.def.magic], cpuSide, playerSide, bout, s.gameMs);
        sfxVaultFighter.play('magic_cast');
        s.cpuMove = 'idle';
        return;
      }
      c.stance = aiOut.stance;
      const dir = aiOut.attackDir;
      const button = aiOut.attackButton;
      if (dir !== null && button !== null) {
        startTechnique(c, resolveTechnique(dir, button));
        s.cpuMove = 'idle';
        return;
      }
      s.cpuMove = aiOut.move;
    }

    function updateCpuMovement(dt: number, dtMs: number) {
      const c = bout.cpu;
      c.walking = false;
      if (canAct(c) && c.stance === 'stand') {
        if (s.cpuMove === 'approach') {
          c.x += c.facing * CPU_SPEED * dt;
          c.walking = true;
        } else if (s.cpuMove === 'retreat') {
          c.x -= c.facing * CPU_SPEED * dt;
          c.walking = true;
        }
        if (c.walking) {
          if (c.x > ARENA_RIGHT) c.x = ARENA_RIGHT;
          else if (c.x < ARENA_LEFT) c.x = ARENA_LEFT;
          clampSeparation(c, bout.player);
          c.walkMs = (c.walkMs + dtMs) % (WALK_FRAME_MS * 2);
        }
      }
    }

    function startRoundEnd(winner: Side | 'draw') {
      const wasKo = bout.player.health === 0 || bout.cpu.health === 0;
      const perfect = winner === 'player' && bout.player.health === MAX_HEALTH;
      commitRound(bout, winner);
      if (winner === 'player') awardRound(story, perfect);
      s.roundBanner = winner;
      s.wasKo = wasKo;
      s.phase = 'round-end';
      s.phaseMs = ROUND_END_MS;
      if (wasKo) sfxVaultFighter.play('ko');
      else if (winner === 'player') sfxVaultFighter.play('round_win');
      else if (winner === 'cpu') sfxVaultFighter.play('round_lose');
      report();
    }

    function updateFight(dtMs: number) {
      const dt = dtMs / 1000;
      s.gameMs += dtMs;
      bout.roundMs += dtMs;
      s.blinkMs += dtMs;
      updateTimerText();

      const cpuHealthBefore = bout.cpu.health;
      stepMagic(playerSide, cpuSide, bout, dtMs, s.gameMs);
      const magicDamageToCpu = cpuHealthBefore - bout.cpu.health;
      if (magicDamageToCpu > 0) awardDamage(story, magicDamageToCpu);

      // stepMagic() can knock a fighter (e.g. ONDA) past the arena edge —
      // clamp here unconditionally, since the knockback lands before
      // updatePlayerControl runs this frame and isn't itself walk input.
      if (bout.player.x < ARENA_LEFT) bout.player.x = ARENA_LEFT;
      else if (bout.player.x > ARENA_RIGHT) bout.player.x = ARENA_RIGHT;
      if (bout.cpu.x < ARENA_LEFT) bout.cpu.x = ARENA_LEFT;
      else if (bout.cpu.x > ARENA_RIGHT) bout.cpu.x = ARENA_RIGHT;

      // Recomputed every frame, not only on startRound(): a teleport or a
      // knockback can swap the two sides at any moment.
      syncFacing();

      updatePlayerControl(dt, dtMs);

      s.aiMs += dtMs;
      if (s.aiMs >= profile.reactionMs) {
        s.aiMs = 0;
        runAiDecision();
      }
      updateCpuMovement(dt, dtMs);

      updateTechnique(bout.player, bout.cpu, 'player', dtMs);
      if (s.phase !== 'fight') return;
      updateTechnique(bout.cpu, bout.player, 'cpu', dtMs);
      if (s.phase !== 'fight') return;

      reportMagicReady();
      report();

      const winner = roundWinner(bout);
      if (winner !== null) startRoundEnd(winner);
    }

    function afterRoundEnd() {
      const winner = boutWinner(bout);
      if (winner === null) {
        startRound(bout);
        updateTimerText();
        resetMagicRuntime(playerRt);
        resetMagicRuntime(cpuRt);
        const roundIdx = Math.min(bout.round - 1, ROUND_INTRO_TEXT.length - 1);
        s.introText = ROUND_INTRO_TEXT[roundIdx];
        s.phase = 'intro';
        s.phaseMs = INTRO_MS;
        reportMagicReady();
        return;
      }
      s.boutBannerWinner = winner;
      s.phase = 'bout-end';
      s.phaseMs = BOUT_END_MS;
      if (winner === 'player') sfxVaultFighter.play('bout_win');
    }

    function afterBoutEnd() {
      const winner = s.boutBannerWinner;
      if (winner === 'player') {
        winBout(story);
        if (story.status === 'champion') {
          doVictory();
          return;
        }
        startBoutFor();
        return;
      }
      loseBout(story);
      s.phase = 'continue';
      sfxVaultFighter.play('continue');
      report();
      forceMagicReadyOff();
    }

    function updateContinue(dtMs: number) {
      tickContinue(story, dtMs);
      if (story.status === 'eliminated') doGameOver();
    }

    function update(dtMs: number) {
      switch (s.phase) {
        case 'select':
          return;
        case 'intro':
          s.phaseMs -= dtMs;
          if (s.phaseMs <= 0) s.phase = 'fight';
          return;
        case 'fight':
          updateFight(dtMs);
          return;
        case 'round-end':
          s.phaseMs -= dtMs;
          if (s.phaseMs <= 0) afterRoundEnd();
          return;
        case 'bout-end':
          s.phaseMs -= dtMs;
          if (s.phaseMs <= 0) afterBoutEnd();
          return;
        case 'continue':
          updateContinue(dtMs);
          return;
        case 'over':
          return;
      }
    }

    // ── Draw ────────────────────────────────────────────────────────────────

    // A technique in progress outranks hit stun: `updateTechnique` keeps
    // resolving and landing that attack while `techId` is set, so drawing the
    // stun pose over it showed a fighter reeling while its punch still
    // connected. Stun only takes over once the technique has ended.
    function poseFor(c: CombatantState): number {
      if (c.health === 0) return POSE_KO;
      if (c.techId !== null) return TECH_POSE_INDEX.get(c.techId) ?? POSE_IDLE;
      if (s.gameMs < c.stunUntilMs) return POSE_STUN;
      if (c.stance === 'block') return POSE_BLOCK;
      if (c.stance === 'crouch') return POSE_CROUCH;
      if (c.walking) return c.walkMs < WALK_FRAME_MS ? POSE_WALK0 : POSE_WALK1;
      return POSE_IDLE;
    }

    function drawFighter(c: CombatantState, sprites: FighterSprites) {
      const arr = c.facing === 1 ? sprites.right : sprites.left;
      const spr = arr[poseFor(c)];
      const build = c.def.build;
      const pad = (spr.width - SPR_W) / 2;
      const dw = spr.width * build;
      const dh = spr.height * build;
      ctx.drawImage(spr, c.x - dw / 2, FLOOR_Y - (SPR_H + pad) * build, dw, dh);
    }

    function drawBar(x: number, y: number, w: number, h: number, frac: number, fg: string, track: string, rightAligned: boolean) {
      ctx.fillStyle = track;
      ctx.fillRect(x, y, w, h);
      const filled = Math.max(0, Math.min(1, frac)) * w;
      ctx.fillStyle = fg;
      if (rightAligned) ctx.fillRect(x + w - filled, y, filled, h);
      else ctx.fillRect(x, y, filled, h);
    }

    function drawHud(skinNow: Skin) {
      const barW = 340;
      const barH = 18;
      const magicH = 8;
      const leftX = 20;
      const rightX = CANVAS_W - 20 - barW;
      const barY = 18;

      drawBar(leftX, barY, barW, barH, bout.player.health / MAX_HEALTH, skinNow.hudDanger, skinNow.barTrack, false);
      drawBar(rightX, barY, barW, barH, bout.cpu.health / MAX_HEALTH, skinNow.hudDanger, skinNow.barTrack, true);
      ctx.strokeStyle = skinNow.hud;
      ctx.lineWidth = 2;
      ctx.strokeRect(leftX, barY, barW, barH);
      ctx.strokeRect(rightX, barY, barW, barH);

      const playerReady = isMagicReady(bout.player);
      const cpuReady = isMagicReady(bout.cpu);
      const blink = Math.floor(s.blinkMs / BLINK_MS) % 2 === 0;
      if (!playerReady || blink) {
        drawBar(leftX, barY + barH + 4, barW, magicH, bout.player.magic / MAGIC_MAX, skinNow.magicBar, skinNow.barTrack, false);
      }
      if (!cpuReady || blink) {
        drawBar(rightX, barY + barH + 4, barW, magicH, bout.cpu.magic / MAGIC_MAX, skinNow.magicBar, skinNow.barTrack, true);
      }

      ctx.font = 'bold 14px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = skinNow.hud;
      ctx.fillText(scoreText, leftX, barY + barH + magicH + 20);

      ctx.textAlign = 'center';
      // Round clock, dead centre between the two health bars.
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = timerSeconds <= TIMER_DANGER_SECONDS ? skinNow.hudDanger : skinNow.hudAccent;
      ctx.fillText(timerText, CANVAS_W / 2, 28);
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillText(boutText, CANVAS_W / 2, 52);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = skinNow.hud;
      ctx.fillText(rivalName, CANVAS_W / 2, 68);

      // Round pips: 3 per side, filled left-to-right for the player and
      // right-to-left for the CPU so both grow toward the centre.
      const pipY = 80;
      const pipSize = 10;
      for (let i = 0; i < ROUNDS_TO_WIN; i++) {
        ctx.fillStyle = i < bout.playerRounds ? skinNow.hudAccent : skinNow.barTrack;
        ctx.fillRect(CANVAS_W / 2 - 24 - i * 18, pipY, pipSize, pipSize);
        ctx.fillStyle = i < bout.cpuRounds ? skinNow.hudAccent : skinNow.barTrack;
        ctx.fillRect(CANVAS_W / 2 + 14 + i * 18, pipY, pipSize, pipSize);
      }
    }

    function drawPanel(text: string, subtitle: string, skinNow: Skin) {
      ctx.fillStyle = skinNow.panel;
      ctx.fillRect(0, 190, CANVAS_W, 120);
      ctx.strokeStyle = skinNow.panelBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 190, CANVAS_W, 120);
      ctx.font = 'bold 40px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = skinNow.hudAccent;
      if (skinNow.glow) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = skinNow.hudAccent;
      }
      ctx.fillText(text, CANVAS_W / 2, 235);
      ctx.shadowBlur = 0;
      if (subtitle) {
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = skinNow.hud;
        ctx.fillText(subtitle, CANVAS_W / 2, 280);
      }
    }

    function drawSelect(skinNow: Skin) {
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.font = 'bold 26px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = skinNow.hudAccent;
      ctx.fillText('ELIGE TU LUCHADOR', CANVAS_W / 2, 34);

      const cardW = 172;
      const cardH = 190;
      const gapX = 20;
      const gapY = 16;
      const gridW = SELECT_COLS * cardW + (SELECT_COLS - 1) * gapX;
      const originX = (CANVAS_W - gridW) / 2;
      const originY = 60;

      for (let i = 0; i < SELECTABLE_FIGHTERS.length; i++) {
        const def = SELECTABLE_FIGHTERS[i];
        const col = i % SELECT_COLS;
        const row = Math.floor(i / SELECT_COLS);
        const x = originX + col * (cardW + gapX);
        const y = originY + row * (cardH + gapY);
        const selected = i === s.selectIndex;

        ctx.fillStyle = 'rgba(20,20,30,0.85)';
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeStyle = selected ? skinNow.hudAccent : '#444455';
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(x, y, cardW, cardH);

        // Same three-colour reading as the sprite: body block, trim torso
        // stripe, accent head. Without the trim stripe seven of the eight cards
        // were near-identical dark rectangles.
        ctx.fillStyle = def.palette.body;
        ctx.fillRect(x + cardW / 2 - 18, y + 14, 36, 44);
        ctx.fillStyle = def.palette.trim;
        ctx.fillRect(x + cardW / 2 - 6, y + 14, 12, 44);
        ctx.fillStyle = def.palette.accent;
        ctx.fillRect(x + cardW / 2 - 10, y + 18, 20, 16);

        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = selected ? skinNow.hudAccent : skinNow.hud;
        ctx.fillText(def.name, x + cardW / 2, y + 78);

        for (let j = 0; j < STAT_LABELS.length; j++) {
          const label = STAT_LABELS[j];
          const value = statValue(def, j);
          const barY = y + 96 + j * 20;
          ctx.font = '10px monospace';
          ctx.textAlign = 'left';
          ctx.fillStyle = skinNow.hud;
          ctx.fillText(label, x + 10, barY);
          drawBar(x + 42, barY - 5, cardW - 54, 8, value / STAT_MAX, skinNow.hudAccent, skinNow.barTrack, false);
          ctx.textAlign = 'center';
        }

        ctx.font = '11px monospace';
        ctx.fillStyle = skinNow.hud;
        ctx.fillText(MAGIC_SPECS[def.magic].label, x + cardW / 2, y + cardH - 14);
      }

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = skinNow.hud;
      ctx.fillText('CRUCETA PARA MOVER · A PARA CONFIRMAR', CANVAS_W / 2, CANVAS_H - 20);
    }

    // Visual duration of the area-magic flash, mirroring magic.ts's private
    // AREA_FLASH_MS — a rendering constant only, not a rule: it just times
    // the fade of a canvas effect, so duplicating the number here doesn't
    // reimplement any game logic.
    const AREA_FLASH_VISUAL_MS = 220;

    // 'self-state' (MURO): a halo around the fighter while rt.shield > 0 —
    // otherwise TORRE's shield is invisible and looks like it does nothing.
    function drawShieldHalo(c: CombatantState) {
      if (c.shield <= 0) return;
      const build = c.def.build;
      const rx = (SPR_W * build) / 2 + 6;
      const ry = (SPR_H * build) / 2 + 6;
      const cy = FLOOR_Y - (SPR_H * build) / 2;
      ctx.strokeStyle = c.def.palette.trim;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(c.x, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 'foe-state' (DESTELLO / SALTO DE FASE / CORROSIÓN): a tint over the
    // affected fighter while stunned or poisoned — CORROSIÓN in particular
    // never shows the stun pose (its stunMs is 0), so the six DoT bites of
    // damage would otherwise have no visible cause at all.
    function drawStatusTint(c: CombatantState, rt: MagicRuntime) {
      const stunned = s.gameMs < c.stunUntilMs;
      const poisoned = rt.dotTicksLeft > 0;
      if (!stunned && !poisoned) return;
      const build = c.def.build;
      const rx = (SPR_W * build) / 2;
      const ry = (SPR_H * build) / 2;
      const cy = FLOOR_Y - ry;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = poisoned ? '#5cff6e' : '#ffee55';
      ctx.beginPath();
      ctx.ellipse(c.x, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 'area' (SÍSMICO / DUPLICADO): a fading flash at the caster's feet,
    // sized by that fighter's own magic radius — SÍSMICO (170) reads
    // visibly wider than DUPLICADO (110) with no extra runtime state.
    function drawAreaFlash(c: CombatantState, rt: MagicRuntime) {
      if (rt.areaFlashMs <= 0) return;
      const spec = MAGIC_SPECS[c.def.magic];
      if (spec.kind !== 'area') return;
      const alpha = Math.min(1, rt.areaFlashMs / AREA_FLASH_VISUAL_MS) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c.def.palette.trim;
      ctx.beginPath();
      ctx.ellipse(c.x, FLOOR_Y - 10, spec.radius, spec.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 'projectile' (DESCARGA / ONDA): a small fast bolt vs. a wide slow
    // one — both size and trail length come straight from the runtime's own
    // knockback/velocity, so DESCARGA (knockback 0) reads small-and-quick
    // and ONDA (knockback 90) reads wide-and-heavy without new state.
    function drawProjectile(rt: MagicRuntime, casterDef: FighterDef) {
      if (!rt.projectileActive) return;
      const radius = 6 + Math.min(12, rt.projectileKnockback / 8);
      const trailLen = Math.min(40, Math.abs(rt.projectileVx) / 12);
      const dirX = rt.projectileVx >= 0 ? -1 : 1;
      ctx.strokeStyle = casterDef.palette.trim;
      ctx.lineWidth = radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(rt.projectileX, rt.projectileY);
      ctx.lineTo(rt.projectileX + dirX * trailLen, rt.projectileY);
      ctx.stroke();
      ctx.fillStyle = casterDef.palette.accent;
      ctx.beginPath();
      ctx.arc(rt.projectileX, rt.projectileY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawScene(skinNow: Skin) {
      refreshSpritesIfNeeded(skinNow);
      if (stageCanvas) ctx.drawImage(stageCanvas, 0, 0);
      drawShieldHalo(bout.player);
      drawShieldHalo(bout.cpu);
      drawStatusTint(bout.player, playerRt);
      drawStatusTint(bout.cpu, cpuRt);
      drawFighter(bout.player, playerSprites);
      drawFighter(bout.cpu, cpuSprites);
      drawAreaFlash(bout.player, playerRt);
      drawAreaFlash(bout.cpu, cpuRt);
      drawProjectile(playerRt, bout.player.def);
      drawProjectile(cpuRt, bout.cpu.def);
      drawHud(skinNow);
    }

    function draw() {
      const skinNow = skinRef.current;

      if (bakedBoutIndex !== story.bout || bakedSkinName !== skinNow.name) {
        if (s.phase !== 'select') bakeCurrentStage();
      }

      if (s.phase === 'select') {
        drawSelect(skinNow);
        return;
      }

      drawScene(skinNow);

      if (s.phase === 'intro') {
        drawPanel(s.introText, '', skinNow);
      } else if (s.phase === 'round-end') {
        const label = s.wasKo ? 'K.O.' : s.roundBanner === 'draw' ? 'EMPATE' : s.roundBanner === 'player' ? 'ASALTO GANADO' : 'ASALTO PERDIDO';
        drawPanel(label, '', skinNow);
      } else if (s.phase === 'bout-end') {
        drawPanel(s.boutBannerWinner === 'player' ? 'COMBATE GANADO' : 'COMBATE PERDIDO', '', skinNow);
      } else if (s.phase === 'continue') {
        const seconds = Math.min(10, Math.ceil(story.continueMsLeft / 1000));
        drawPanel(CONTINUE_TEXT[seconds], 'A: SÍ · B: NO', skinNow);
      } else if (s.phase === 'over') {
        drawPanel(s.victory ? 'CAMPEÓN' : 'ELIMINADO', '', skinNow);
      }
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
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
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
      if (s.phase === 'select') {
        if (button === 'a') confirmSelection();
        return;
      }
      if (s.phase === 'continue') {
        if (button === 'a') {
          acceptContinue(story);
          if (story.status === 'fighting') startBoutFor();
        } else {
          declineContinue(story);
          if (story.status === 'eliminated') doGameOver();
        }
        return;
      }
      if (s.phase !== 'fight') return;
      const p = bout.player;
      if (!canAct(p) || p.stance === 'block') return;
      startTechnique(p, resolveTechnique(heldDir(), button));
    }

    function pressMagic() {
      if (s.over || pausedRef.current || s.phase !== 'fight') return;
      const p = bout.player;
      if (!isMagicReady(p) || !canAct(p) || p.stance === 'block') return;
      spendMagic(p);
      // 'area' magics (DUPLICADO, SÍSMICO) apply their damage synchronously
      // inside castMagic, right here — not later inside stepMagic — so the
      // updateFight() health-diff around stepMagic never sees it. Measure
      // around this call too, or those two fighters' magic scores nothing.
      const cpuHealthBefore = bout.cpu.health;
      castMagic(MAGIC_SPECS[p.def.magic], playerSide, cpuSide, bout, s.gameMs);
      const damage = cpuHealthBefore - bout.cpu.health;
      if (damage > 0) awardDamage(story, damage);
      sfxVaultFighter.play('magic_cast');
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (!sfxReady) {
        sfxReady = true;
        sfxVaultFighter.init();
        sfxVaultFighter.setMuted(mutedRef.current);
      }
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        e.preventDefault();
        if (s.phase === 'select' && !leftDown && !pausedRef.current) moveSelect(-1, 0);
        leftDown = true;
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault();
        if (s.phase === 'select' && !rightDown && !pausedRef.current) moveSelect(1, 0);
        rightDown = true;
      } else if (key === 'arrowup' || key === 'w') {
        e.preventDefault();
        if (s.phase === 'select' && !upDown && !pausedRef.current) moveSelect(0, -1);
        upDown = true;
      } else if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
        if (s.phase === 'select' && !downDown && !pausedRef.current) moveSelect(0, 1);
        downDown = true;
      } else if (key === ' ' || key === 'j') {
        e.preventDefault();
        pressButton('a');
      } else if (key === 'k') {
        e.preventDefault();
        pressButton('b');
      } else if (key === 'l') {
        e.preventDefault();
        pressMagic();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') leftDown = false;
      else if (key === 'arrowright' || key === 'd') rightDown = false;
      else if (key === 'arrowup' || key === 'w') upDown = false;
      else if (key === 'arrowdown' || key === 's') downDown = false;
    }

    // Repo-wide bug #1: alt-tabbing away with a direction held would leave
    // the fighter blocking/crouching forever if these aren't released here.
    function handleBlur() {
      leftDown = false;
      rightDown = false;
      upDown = false;
      downDown = false;
      if (bout.player.stance === 'block' || bout.player.stance === 'crouch') {
        bout.player.stance = 'stand';
      }
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
      sfxVaultFighter.dispose();
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

export default React.memo(VaultFighterGame);
