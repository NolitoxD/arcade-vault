'use client';

import React, { useEffect, useRef } from 'react';

interface RoadFighterGameProps {
  paused: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 480;
const H = 640;

const LANE_COUNT = 4;
const ROAD_X = 80;
const ROAD_W = 320;
const LANE_W = ROAD_W / LANE_COUNT;
const CURB_W = 10;
const CURB_SEG = 20;

const CAR_W = 34;
const CAR_H = 56;
const PLAYER_Y = H - 120;
const PLAYER_SPEED = 260;

const RIVAL_W = 34;
const RIVAL_H = 56;
const CAN_W = 22;
const CAN_H = 28;

const LEVEL_DISTANCE = 2000;
const SCROLL_BASE_SPEED = 240;
const SCROLL_LEVEL_FACTOR = 0.12;
const SCROLL_MAX_SPEED = 560;
const FUEL_MAX = 100;
const FUEL_DRAIN_PER_S = 4;
const FUEL_PICKUP_AMOUNT = 40;
const INVULN_MS = 2000;

// Relación de justicia del spawner (spec 16): travesía de 1 carril =
// LANE_W / PLAYER_SPEED = 80 / 260 ≈ 0.31 s, y una ventana tarda al menos
// SPAWN_WINDOW_H / SCROLL_MAX_SPEED = 260 / 560 ≈ 0.46 s en recorrer su altura.
// 0.31 < 0.46 → el gapLane (que solo se mueve ±1 por ventana) siempre es
// alcanzable lateralmente antes de que llegue la ventana siguiente.
const SPAWN_WINDOW_H = 260;
const SPAWN_MARGIN = 10;

// Los rivales avanzan más lento que el scroll: bajan por pantalla a
// scroll × RIVAL_REL_FACTOR, así el jugador los rebasa.
const RIVAL_REL_FACTOR = 0.45;

const EXPLOSION_MS = 700;
const START_LIVES = 3;

const DIST_SCORE_STEP = 100;
const DIST_SCORE_POINTS = 10;
const OVERTAKE_POINTS = 50;
const FUEL_POINTS = 25;

const FUEL_CHANCE_BASE = 0.4;
const FUEL_CHANCE_PER_LEVEL = 0.03;
const FUEL_CHANCE_MIN = 0.15; // suelo: el fuel nunca se vuelve inviable
const FUEL_RESERVE_RATIO = 0.25;

const STRIPE_WRAP = 240; // mcm(periodo bordillo 40, periodo raya 48)

const DASH_LANE: number[] = [26, 22];
const DASH_CLEAR: number[] = [];

// P4: centros de carril precomputados
const LANE_CENTERS: number[] = Array.from(
  { length: LANE_COUNT },
  (_, i) => ROAD_X + LANE_W * i + LANE_W / 2,
);

const RIVAL_COLORS = ['#ffd23a', '#3ad1ff', '#7dff5e', '#ff7ae0', '#ff8c3a'];

type MoveDir = 'left' | 'right';

const KEY_ACTIONS: Record<string, MoveDir> = {
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
};

// Scratch reutilizable del spawner (carriles no-gap) — sin literales en el RAF
const SCRATCH_LANES: number[] = [0, 0, 0];

// ── Skin system ───────────────────────────────────────────────────────────────

type Skin = {
  name: string;
  bg: string;
  road: string;
  curbA: string;
  curbB: string;
  edgeLine: string;
  laneLine: string;
  hudColor: string;
  fuelOk: string;
  fuelLow: string;
  fuelBarBg: string;
  drawPlayer: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  drawRival: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIdx: number,
  ) => void;
  drawCan: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  drawExplosion: (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    t: number,
  ) => void;
};

function drawCarBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  body: string,
  glass: string,
  glassAtTop: boolean,
) {
  ctx.fillStyle = '#101018';
  ctx.fillRect(x - 3, y + 6, 5, 14);
  ctx.fillRect(x + CAR_W - 2, y + 6, 5, 14);
  ctx.fillRect(x - 3, y + CAR_H - 20, 5, 14);
  ctx.fillRect(x + CAR_W - 2, y + CAR_H - 20, 5, 14);
  ctx.fillStyle = body;
  ctx.fillRect(x, y, CAR_W, CAR_H);
  ctx.fillStyle = glass;
  ctx.fillRect(x + 4, glassAtTop ? y + 8 : y + CAR_H - 18, CAR_W - 8, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x + 4, glassAtTop ? y + 2 : y + CAR_H - 5, CAR_W - 8, 3);
}

const RETRO_RIVAL_COLORS = ['#ffd27a', '#8ad1c0', '#c9e07a', '#e0a0c8', '#e59a5c'];

// ── Neon sprite cache (P7, spec 12) ──────────────────────────────────────────
// Hasta ~7 rivales + bidones + jugador por frame con glow serían ~15-20
// llamadas shadowBlur/frame. Cada sprite se pre-renderiza UNA vez con el blur
// horneado; el draw() del loop solo hace drawImage (coste de composición).

const NEON_PAD = 16; // margen para que el blur no se recorte

const NEON_RIVALS: { glow: string; fill: string }[] = [
  { glow: '#ffff00', fill: 'rgba(255,255,0,0.4)' },
  { glow: '#ff00e0', fill: 'rgba(255,0,224,0.4)' },
  { glow: '#39ff14', fill: 'rgba(57,255,20,0.4)' },
  { glow: '#ff6b00', fill: 'rgba(255,107,0,0.4)' },
  { glow: '#00aaff', fill: 'rgba(0,170,255,0.4)' },
];

type NeonSprites = {
  player: HTMLCanvasElement;
  rivals: HTMLCanvasElement[];
  can: HTMLCanvasElement;
};

let neonSprites: NeonSprites | null = null;

function makeNeonSprite(
  w: number,
  h: number,
  paint: (c: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = w + NEON_PAD * 2;
  el.height = h + NEON_PAD * 2;
  const c = el.getContext('2d')!;
  c.translate(NEON_PAD, NEON_PAD);
  paint(c);
  return el;
}

function paintNeonCar(
  c: CanvasRenderingContext2D,
  glow: string,
  fill: string,
  glassAtTop: boolean,
) {
  c.fillStyle = '#101018';
  c.fillRect(-3, 6, 5, 14);
  c.fillRect(CAR_W - 2, 6, 5, 14);
  c.fillRect(-3, CAR_H - 20, 5, 14);
  c.fillRect(CAR_W - 2, CAR_H - 20, 5, 14);
  c.shadowBlur = 12;
  c.shadowColor = glow;
  c.fillStyle = fill;
  c.fillRect(0, 0, CAR_W, CAR_H);
  c.strokeStyle = glow;
  c.lineWidth = 2;
  c.strokeRect(1, 1, CAR_W - 2, CAR_H - 2);
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fillRect(4, glassAtTop ? 8 : CAR_H - 18, CAR_W - 8, 10);
}

function paintNeonCan(c: CanvasRenderingContext2D) {
  c.shadowBlur = 10;
  c.shadowColor = '#ffe600';
  c.fillStyle = 'rgba(255,230,0,0.35)';
  c.fillRect(0, 4, CAN_W, CAN_H - 4);
  c.strokeStyle = '#ffe600';
  c.lineWidth = 2;
  c.strokeRect(1, 5, CAN_W - 2, CAN_H - 6);
  c.fillRect(4, -1, CAN_W - 8, 5);
  c.shadowBlur = 0;
  c.fillStyle = '#ffe600';
  c.font = 'bold 12px monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('F', CAN_W / 2, 4 + (CAN_H - 4) / 2);
}

function getNeonSprites(): NeonSprites {
  if (neonSprites) return neonSprites;
  neonSprites = {
    player: makeNeonSprite(CAR_W, CAR_H, (c) =>
      paintNeonCar(c, '#00f5ff', 'rgba(0,245,255,0.4)', true),
    ),
    rivals: NEON_RIVALS.map((r) =>
      makeNeonSprite(CAR_W, CAR_H, (c) =>
        paintNeonCar(c, r.glow, r.fill, false),
      ),
    ),
    can: makeNeonSprite(CAN_W, CAN_H, paintNeonCan),
  };
  return neonSprites;
}

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'Classic',
    bg: '#0a1408',
    road: '#23232b',
    curbA: '#d92b2b',
    curbB: '#e8e8e8',
    edgeLine: 'rgba(232,232,232,0.8)',
    laneLine: 'rgba(232,232,232,0.55)',
    hudColor: 'rgba(232,240,255,0.9)',
    fuelOk: '#00ff88',
    fuelLow: '#ff3b30',
    fuelBarBg: 'rgba(232,240,255,0.15)',
    drawPlayer(ctx, x, y) {
      drawCarBody(ctx, x, y, '#ff2d2d', '#5a0d0d', true);
    },
    drawRival(ctx, x, y, colorIdx) {
      drawCarBody(ctx, x, y, RIVAL_COLORS[colorIdx], '#22242e', false);
    },
    drawCan(ctx, x, y) {
      ctx.fillStyle = '#7a5200';
      ctx.fillRect(x + 3, y, 9, 6);
      ctx.fillStyle = '#ffb400';
      ctx.fillRect(x, y + 4, CAN_W, CAN_H - 4);
      ctx.fillStyle = '#4a3200';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', x + CAN_W / 2, y + 4 + (CAN_H - 4) / 2);
    },
    drawExplosion(ctx, cx, cy, t) {
      const r = 12 + t * 34;
      ctx.fillStyle = 'rgba(255,140,0,0.7)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,120,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  retro: {
    name: 'Retro',
    bg: '#151004',
    road: '#2b2416',
    curbA: '#ff8c42',
    curbB: '#ffe8c2',
    edgeLine: 'rgba(255,214,138,0.8)',
    laneLine: 'rgba(255,214,138,0.5)',
    hudColor: 'rgba(255,214,138,0.9)',
    fuelOk: '#9be564',
    fuelLow: '#ff5e5b',
    fuelBarBg: 'rgba(255,214,138,0.15)',
    drawPlayer(ctx, x, y) {
      drawCarBody(ctx, x, y, '#ffb347', '#6b3f10', true);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, CAR_W, 4);
    },
    drawRival(ctx, x, y, colorIdx) {
      drawCarBody(ctx, x, y, RETRO_RIVAL_COLORS[colorIdx], '#3a2c14', false);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, CAR_W, 4);
    },
    drawCan(ctx, x, y) {
      ctx.fillStyle = '#8a6a1f';
      ctx.fillRect(x + 3, y, 9, 6);
      ctx.fillStyle = '#e5c15a';
      ctx.fillRect(x, y + 4, CAN_W, CAN_H - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y + 4, CAN_W, 4);
      ctx.fillStyle = '#4a3200';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', x + CAN_W / 2, y + 4 + (CAN_H - 4) / 2);
    },
    drawExplosion(ctx, cx, cy, t) {
      const r = 12 + t * 34;
      ctx.fillStyle = 'rgba(255,140,66,0.75)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,232,194,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  neon: {
    name: 'Neon',
    bg: '#000000',
    road: '#050510',
    curbA: '#ff00e0',
    curbB: '#00f5ff',
    edgeLine: 'rgba(0,245,255,0.9)',
    laneLine: 'rgba(0,245,255,0.5)',
    hudColor: '#00ffcc',
    fuelOk: '#39ff14',
    fuelLow: '#ff1744',
    fuelBarBg: 'rgba(0,255,204,0.12)',
    drawPlayer(ctx, x, y) {
      ctx.drawImage(getNeonSprites().player, x - NEON_PAD, y - NEON_PAD);
    },
    drawRival(ctx, x, y, colorIdx) {
      ctx.drawImage(getNeonSprites().rivals[colorIdx], x - NEON_PAD, y - NEON_PAD);
    },
    drawCan(ctx, x, y) {
      ctx.drawImage(getNeonSprites().can, x - NEON_PAD, y - NEON_PAD);
    },
    drawExplosion(ctx, cx, cy, t) {
      // Transitoria (≤700 ms, mundo congelado): blur en vivo asumible
      const r = 12 + t * 34;
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#ff00e0';
      ctx.fillStyle = 'rgba(255,0,224,0.55)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    },
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Rival {
  x: number;
  y: number;
  prevY: number;
  hit: boolean;
  color: number;
}

interface FuelCan {
  x: number;
  y: number;
}

interface SpawnWindow {
  gapLane: number;
  bottom: number;
}

interface GameState {
  playerX: number;
  score: number;
  lives: number;
  level: number;
  fuel: number;
  scrollSpeed: number;
  relSpeed: number;
  levelDist: number;
  scoreAcc: number;
  spawnAcc: number;
  stripeOffset: number;
  lastGapLane: number;
  invulnMs: number;
  exploding: boolean;
  explosionMs: number;
  explosionX: number;
  explosionY: number;
  rivals: Rival[];
  cans: FuelCan[];
  windows: SpawnWindow[];
  over: boolean;
}

function initialState(): GameState {
  return {
    playerX: LANE_CENTERS[1] - CAR_W / 2,
    score: 0,
    lives: START_LIVES,
    level: 1,
    fuel: FUEL_MAX,
    scrollSpeed: SCROLL_BASE_SPEED,
    relSpeed: SCROLL_BASE_SPEED * RIVAL_REL_FACTOR,
    levelDist: 0,
    scoreAcc: 0,
    spawnAcc: 0,
    stripeOffset: 0,
    lastGapLane: 1,
    invulnMs: 0,
    exploding: false,
    explosionMs: 0,
    explosionX: 0,
    explosionY: 0,
    rivals: [],
    cans: [],
    windows: [],
    over: false,
  };
}

function scrollSpeedFor(level: number): number {
  return Math.min(
    SCROLL_BASE_SPEED * (1 + SCROLL_LEVEL_FACTOR * (level - 1)),
    SCROLL_MAX_SPEED,
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function RoadFighterGame({
  paused,
  skinKey = 'classic',
  onScoreChange,
  onLevelChange,
  onLivesChange,
  onGameOver,
}: RoadFighterGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const skinRef = useRef<Skin>(SKINS[skinKey ?? 'classic'] ?? SKINS.classic);
  const stateRef = useRef<GameState>(initialState());

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    skinRef.current = SKINS[skinKey ?? 'classic'] ?? SKINS.classic;
  }, [skinKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = stateRef.current;

    const keys: Record<MoveDir, boolean> = { left: false, right: false };

    // Callbacks solo cuando el valor cambia
    let reportedScore = 0;
    let reportedLevel = 1;
    let reportedLives = START_LIVES;
    let endFired = false;

    // ── Audio ───────────────────────────────────────────────────────────────
    const pickupSound = new Audio('/ball-bounce.mp3');
    const crashSound = new Audio('/break-sound.mp3');

    function playPickup() {
      try {
        (pickupSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }
    function playCrash() {
      try {
        (crashSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }

    // ── Reporting ───────────────────────────────────────────────────────────
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

    // ── Spawner por ventanas — invariante del carril transitable ────────────
    function spawnWindow(overshoot: number) {
      // 2. Hueco alcanzable: gapLane ± 1 respecto a la ventana anterior
      const step = Math.floor(Math.random() * 3) - 1;
      const gapLane = Math.max(
        0,
        Math.min(LANE_COUNT - 1, s.lastGapLane + step),
      );
      s.lastGapLane = gapLane;

      const bottom = overshoot;
      const top = bottom - SPAWN_WINDOW_H;

      // 1. Hueco garantizado: los rivales solo van a carriles != gapLane
      let n = 0;
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        if (lane !== gapLane) SCRATCH_LANES[n++] = lane;
      }
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = SCRATCH_LANES[i];
        SCRATCH_LANES[i] = SCRATCH_LANES[j];
        SCRATCH_LANES[j] = tmp;
      }

      // 3. Densidad acotada: nunca más de LANE_COUNT − 1 carriles ocupados
      const occupied = Math.min(
        1 + Math.floor((s.level - 1) / 2),
        LANE_COUNT - 1,
      );
      const span = SPAWN_WINDOW_H - RIVAL_H - SPAWN_MARGIN * 2;
      for (let i = 0; i < occupied; i++) {
        const lane = SCRATCH_LANES[i];
        const y = top + SPAWN_MARGIN + Math.random() * span;
        s.rivals.push({
          x: LANE_CENTERS[lane] - RIVAL_W / 2,
          y,
          prevY: y,
          hit: false,
          color: Math.floor(Math.random() * RIVAL_COLORS.length),
        });
      }
      // Densidad extra a niveles altos: 2º rival en un carril ya ocupado
      if (s.level >= 5) {
        const lane = SCRATCH_LANES[0];
        const y = top + SPAWN_MARGIN + Math.random() * (span / 2 - RIVAL_H);
        s.rivals.push({
          x: LANE_CENTERS[lane] - RIVAL_W / 2,
          y,
          prevY: y,
          hit: false,
          color: Math.floor(Math.random() * RIVAL_COLORS.length),
        });
      }

      // 4. Fuel accesible: los bidones solo aparecen en el gapLane
      const chance = Math.max(
        FUEL_CHANCE_BASE - (s.level - 1) * FUEL_CHANCE_PER_LEVEL,
        FUEL_CHANCE_MIN,
      );
      if (Math.random() < chance) {
        s.cans.push({
          x: LANE_CENTERS[gapLane] - CAN_W / 2,
          y: top + SPAWN_MARGIN + Math.random() * (SPAWN_WINDOW_H - CAN_H - SPAWN_MARGIN * 2),
        });
      }

      s.windows.push({ gapLane, bottom });
    }

    // ── Muerte (tubería única) y respawn ────────────────────────────────────
    function respawnGapLane(): number {
      // Ventana que cubre la banda del jugador; si no, la más cercana por arriba
      let nearest = -1;
      let nearestBottom = -Infinity;
      for (let i = 0; i < s.windows.length; i++) {
        const w = s.windows[i];
        if (w.bottom >= PLAYER_Y && w.bottom - SPAWN_WINDOW_H <= PLAYER_Y + CAR_H) {
          return w.gapLane;
        }
        if (w.bottom < PLAYER_Y && w.bottom > nearestBottom) {
          nearestBottom = w.bottom;
          nearest = i;
        }
      }
      return nearest >= 0 ? s.windows[nearest].gapLane : s.lastGapLane;
    }

    function die(fromFuel: boolean) {
      playCrash();
      s.lives -= 1;
      if (fromFuel) s.fuel = FUEL_MAX;
      report();
      if (s.lives <= 0) {
        s.over = true;
        if (!endFired) {
          endFired = true;
          onGameOver(s.score);
        }
        return;
      }
      s.exploding = true;
      s.explosionMs = EXPLOSION_MS;
      s.explosionX = s.playerX + CAR_W / 2;
      s.explosionY = PLAYER_Y + CAR_H / 2;
    }

    function respawn() {
      s.exploding = false;
      s.playerX = LANE_CENTERS[respawnGapLane()] - CAR_W / 2;
      s.invulnMs = INVULN_MS;
    }

    // ── Update ──────────────────────────────────────────────────────────────
    function update(dt: number) {
      if (s.exploding) {
        // Mundo congelado durante la explosión
        s.explosionMs -= dt * 1000;
        if (s.explosionMs <= 0) respawn();
        return;
      }

      const scroll = s.scrollSpeed;
      const rel = s.relSpeed;

      if (keys.left) s.playerX -= PLAYER_SPEED * dt;
      if (keys.right) s.playerX += PLAYER_SPEED * dt;

      // Distancia → puntos y nivel (acumuladores acotados — P3)
      s.scoreAcc += scroll * dt;
      while (s.scoreAcc >= DIST_SCORE_STEP) {
        s.scoreAcc -= DIST_SCORE_STEP;
        s.score += DIST_SCORE_POINTS * s.level;
      }
      s.levelDist += scroll * dt;
      while (s.levelDist >= LEVEL_DISTANCE) {
        s.levelDist -= LEVEL_DISTANCE;
        s.level += 1;
        s.scrollSpeed = scrollSpeedFor(s.level);
        s.relSpeed = s.scrollSpeed * RIVAL_REL_FACTOR;
      }

      s.stripeOffset = (s.stripeOffset + scroll * dt) % STRIPE_WRAP;

      // Spawner: cadencia en distancia relativa para que las ventanas
      // enlosen sin huecos ni solapes a velocidad de entidad
      s.spawnAcc += rel * dt;
      while (s.spawnAcc >= SPAWN_WINDOW_H) {
        const overshoot = s.spawnAcc - SPAWN_WINDOW_H;
        s.spawnAcc = overshoot;
        spawnWindow(overshoot);
      }

      for (let i = s.rivals.length - 1; i >= 0; i--) {
        const r = s.rivals[i];
        r.prevY = r.y;
        r.y += rel * dt;
        if (r.y > H) {
          if (!r.hit) s.score += OVERTAKE_POINTS * s.level; // rebase
          s.rivals.splice(i, 1);
        }
      }
      for (let i = s.cans.length - 1; i >= 0; i--) {
        s.cans[i].y += rel * dt;
        if (s.cans[i].y > H) s.cans.splice(i, 1);
      }
      for (let i = s.windows.length - 1; i >= 0; i--) {
        s.windows[i].bottom += rel * dt;
        if (s.windows[i].bottom - SPAWN_WINDOW_H > H) s.windows.splice(i, 1);
      }

      // Fuel: drenaje acotado a [0, FUEL_MAX]
      s.fuel = Math.max(0, s.fuel - FUEL_DRAIN_PER_S * dt);

      if (s.invulnMs > 0) s.invulnMs = Math.max(0, s.invulnMs - dt * 1000);

      // Bidones: recogerlos nunca depende de la invulnerabilidad
      for (let i = s.cans.length - 1; i >= 0; i--) {
        const c = s.cans[i];
        if (
          s.playerX < c.x + CAN_W &&
          s.playerX + CAR_W > c.x &&
          PLAYER_Y < c.y + CAN_H &&
          PLAYER_Y + CAR_H > c.y
        ) {
          s.cans.splice(i, 1);
          s.fuel = Math.min(FUEL_MAX, s.fuel + FUEL_PICKUP_AMOUNT);
          s.score += FUEL_POINTS * s.level;
          playPickup();
        }
      }

      report();

      if (s.fuel <= 0) {
        die(true);
        return;
      }

      if (s.invulnMs > 0) return;

      // Arcén
      if (s.playerX < ROAD_X || s.playerX + CAR_W > ROAD_X + ROAD_W) {
        die(false);
        return;
      }

      // Rivales — AABB con barrido vertical (prevY → y) contra tunneling
      for (let i = 0; i < s.rivals.length; i++) {
        const r = s.rivals[i];
        const top = Math.min(r.prevY, r.y);
        const bottom = Math.max(r.prevY, r.y) + RIVAL_H;
        if (
          s.playerX < r.x + RIVAL_W &&
          s.playerX + CAR_W > r.x &&
          PLAYER_Y < bottom &&
          PLAYER_Y + CAR_H > top
        ) {
          r.hit = true; // un rival chocado no cuenta como rebase
          die(false);
          return;
        }
      }
    }

    // ── Draw ────────────────────────────────────────────────────────────────
    function draw() {
      const skin = skinRef.current;

      ctx.fillStyle = skin.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = skin.road;
      ctx.fillRect(ROAD_X, 0, ROAD_W, H);

      // Bordillos con scroll
      const curbOff = s.stripeOffset % (CURB_SEG * 2);
      let alt = 0;
      for (let y = curbOff - CURB_SEG * 2; y < H; y += CURB_SEG, alt ^= 1) {
        ctx.fillStyle = alt === 0 ? skin.curbA : skin.curbB;
        ctx.fillRect(ROAD_X - CURB_W, y, CURB_W, CURB_SEG);
        ctx.fillRect(ROAD_X + ROAD_W, y, CURB_W, CURB_SEG);
      }

      ctx.fillStyle = skin.edgeLine;
      ctx.fillRect(ROAD_X, 0, 3, H);
      ctx.fillRect(ROAD_X + ROAD_W - 3, 0, 3, H);

      // Rayas de carril discontinuas con scroll
      ctx.strokeStyle = skin.laneLine;
      ctx.lineWidth = 4;
      ctx.setLineDash(DASH_LANE);
      ctx.lineDashOffset = -s.stripeOffset;
      for (let i = 1; i < LANE_COUNT; i++) {
        const x = ROAD_X + LANE_W * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.setLineDash(DASH_CLEAR);
      ctx.lineDashOffset = 0;

      for (let i = 0; i < s.cans.length; i++) {
        skin.drawCan(ctx, s.cans[i].x, s.cans[i].y);
      }
      for (let i = 0; i < s.rivals.length; i++) {
        skin.drawRival(ctx, s.rivals[i].x, s.rivals[i].y, s.rivals[i].color);
      }

      if (s.exploding) {
        skin.drawExplosion(
          ctx,
          s.explosionX,
          s.explosionY,
          1 - s.explosionMs / EXPLOSION_MS,
        );
      } else if (
        s.invulnMs <= 0 ||
        Math.floor(s.invulnMs / 100) % 2 === 0
      ) {
        skin.drawPlayer(ctx, s.playerX, PLAYER_Y);
      }

      // HUD interno: score, nivel y barra de fuel con marca de reserva
      ctx.fillStyle = skin.hudColor;
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE  ${String(s.score).padStart(6, '0')}`, 12, 20);
      ctx.textAlign = 'right';
      ctx.fillText(`LEVEL  ${String(s.level).padStart(2, '0')}`, W - 12, 20);

      const barX = 60;
      const barY = H - 24;
      const barW = 200;
      const barH = 12;
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('FUEL', 12, barY + barH / 2);
      ctx.fillStyle = skin.fuelBarBg;
      ctx.fillRect(barX, barY, barW, barH);
      const ratio = s.fuel / FUEL_MAX;
      ctx.fillStyle = ratio <= FUEL_RESERVE_RATIO ? skin.fuelLow : skin.fuelOk;
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.strokeStyle = skin.hudColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
      // Marca de reserva
      ctx.fillStyle = skin.hudColor;
      ctx.fillRect(barX + barW * FUEL_RESERVE_RATIO, barY - 3, 2, barH + 6);
    }

    // ── Loop ────────────────────────────────────────────────────────────────
    let rafId = 0;
    let last = performance.now();
    let pauseDrawn = false;
    let overDrawn = false;

    function loop(ts: number) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;

      if (pausedRef.current) {
        if (!pauseDrawn) {
          draw();
          pauseDrawn = true;
        }
        rafId = requestAnimationFrame(loop);
        return;
      }
      pauseDrawn = false;

      if (s.over) {
        if (!overDrawn) {
          draw();
          overDrawn = true;
        }
        rafId = requestAnimationFrame(loop);
        return;
      }

      update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    // ── Keyboard ────────────────────────────────────────────────────────────
    function handleKeyDown(e: KeyboardEvent) {
      const action = KEY_ACTIONS[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      keys[action] = true;
    }
    function handleKeyUp(e: KeyboardEvent) {
      const action = KEY_ACTIONS[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      keys[action] = false;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
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
        width={W}
        height={H}
        style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}

export default React.memo(RoadFighterGame);
