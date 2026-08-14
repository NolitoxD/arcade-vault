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

// Regímenes de velocidad (spec 17): factor sobre el scroll del nivel mientras
// la tecla está mantenida. El drain de fuel es proporcional al mismo factor.
const BRAKE_FACTOR = 0.6; // ↓/S mantenida: scroll × 0.6
const BOOST_FACTOR = 1.4; // ↑/W mantenida: scroll × 1.4

// Relación de justicia del spawner (specs 16+17): travesía de 1 carril =
// LANE_W / PLAYER_SPEED = 80 / 260 ≈ 0.31 s; el drift de curva por ventana
// cuesta como mucho CURVE_DRIFT_PER_WINDOW_MAX / PLAYER_SPEED = 30 / 260
// ≈ 0.12 s; y una ventana tarda al menos
// SPAWN_WINDOW_H / (SCROLL_MAX_SPEED × BOOST_FACTOR) = 340 / 784 ≈ 0.43 s
// en recorrer su altura a la velocidad máxima con TURBO.
// 0.31 + 0.12 ≈ 0.42 < 0.43 → el gapLane (que solo se mueve ±1 por ventana)
// sigue siendo alcanzable incluso en turbo permanente y con curva máxima.
const SPAWN_WINDOW_H = 340;
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

// ── Curvas (spec 17) ─────────────────────────────────────────────────────────
// El trazado entero se desplaza con un offset lateral senoidal en función de
// la distancia de mundo. Doble senoide (base × envolvente): C0-continua y la
// envolvente varía la amplitud por tramos (rectas y curvas se alternan).
// Drift acotado por construcción:
//   |offset'| ≤ CURVE_AMPLITUDE_MAX · 2π · (1/λ1 + 1/λ2) ≈ 0.0838 px/px
//   drift por ventana ≤ 0.0838 × SPAWN_WINDOW_H(340) ≈ 28.5 px
//     ≤ CURVE_DRIFT_PER_WINDOW_MAX — entra en el presupuesto de travesía
//     del invariante (comentario de SPAWN_WINDOW_H).
const CURVE_AMPLITUDE_MAX = 60; // px de offset lateral máximo del trazado
const CURVE_DRIFT_PER_WINDOW_MAX = 30; // px de drift máximo por ventana
const CURVE_WAVELENGTH = 6000; // λ1: senoide base
const CURVE_ENVELOPE_WAVELENGTH = 18000; // λ2: envolvente por tramos
const CURVE_DIST_WRAP = 18000; // mcm(λ1, λ2) — acumulador acotado (P3)
const TWO_PI = Math.PI * 2;
const CURVE_STRIP_H = 8; // la calzada se dibuja en franjas horizontales
const CURVE_STRIPS = H / CURVE_STRIP_H;
// Scratch de offsets por franja: rellenado 1 vez por frame y reutilizado por
// calzada, bordes y rayas de carril — sin literales de array en el RAF (P1)
const CURVE_SCRATCH = new Float32Array(CURVE_STRIPS + 1);

// ── Hazards (spec 17) ────────────────────────────────────────────────────────
const OIL_SLIP_MS = 600; // derrape: input lateral ignorado, deriva conservada
const PUDDLE_SLOW_FACTOR = 0.7; // charco: scroll efectivo × 0.7 mientras se pisa
const OIL_W = 40;
const OIL_H = 24;
const PUDDLE_W = 48;
const PUDDLE_H = 26;
// Frecuencia de hazards por ventana, creciente con el nivel y acotada
const HAZARD_CHANCE_BASE = 0.18;
const HAZARD_CHANCE_PER_LEVEL = 0.03;
const HAZARD_CHANCE_MAX = 0.4;

// ── Meta de tramo (spec 17) ──────────────────────────────────────────────────
const GOAL_BONUS = 200; // bonus de meta: 200 × nivel completado
const GOAL_BANNER_MS = 1000; // duración del banner META (no bloqueante)
const GOAL_LINE_H = 24;
const GOAL_SQ = 16;
const GOAL_COLS = ROAD_W / GOAL_SQ;

// ── IA de rivales (spec 17) ──────────────────────────────────────────────────
const LANE_CHANGE_TELEGRAPH_MS = 300; // intermitente antes de moverse
const LANE_CHANGE_MOVE_MS = 400; // duración de la animación de cambio
const LANE_CHANGE_COOLDOWN_MS = 1500; // por rival
const RAM_COOLDOWN_MS = 4000; // global, entre embestidas
const RAM_DISTANCE = 170; // px de distancia vertical corta para embestir
const RAM_CHANCE_PER_S = 0.9; // probabilidad/s de embestir cuando es elegible
// Probabilidad/s de cambio espontáneo, creciente con el nivel y con tope
const LANE_CHANGE_CHANCE_BASE = 0.2;
const LANE_CHANGE_CHANCE_PER_LEVEL = 0.06;
const LANE_CHANGE_CHANCE_MAX = 0.8;
const BLINK_PERIOD_MS = 200; // parpadeo del intermitente (acotado — P3)

const STRIPE_WRAP = 240; // mcm(periodo bordillo 40, periodo raya 48)

const DASH_LANE: number[] = [26, 22];
const DASH_CLEAR: number[] = [];

// P4: centros de carril precomputados
const LANE_CENTERS: number[] = Array.from(
  { length: LANE_COUNT },
  (_, i) => ROAD_X + LANE_W * i + LANE_W / 2,
);

const RIVAL_COLORS = ['#ffd23a', '#3ad1ff', '#7dff5e', '#ff7ae0', '#ff8c3a'];

type KeyDir = 'left' | 'right' | 'up' | 'down';

const KEY_ACTIONS: Record<string, KeyDir> = {
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
};

// Etiquetas de régimen precomputadas para el HUD interno
const REGIME_BRAKE = 'FRENO';
const REGIME_CRUISE = 'CRUCERO';
const REGIME_BOOST = 'TURBO';

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
  telegraphColor: string;
  drawPlayer: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  drawRival: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIdx: number,
  ) => void;
  drawCan: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  drawOil: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  drawPuddle: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  drawGoal: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
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

// ── Pintores de los elementos del spec 17 ────────────────────────────────────
// Cada skin tiene su versión propia de aceite, charco y línea de meta:
// classic (abajo), retro (bloques sólidos CRT, sin blur) y neon (glow
// horneado en la caché de sprites offscreen P7 — ver getNeonSprites).

function drawOilClassic(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(8,8,14,0.85)';
  ctx.beginPath();
  ctx.ellipse(x + OIL_W / 2, y + OIL_H / 2, OIL_W / 2, OIL_H / 2, 0, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = 'rgba(130,130,170,0.35)';
  ctx.beginPath();
  ctx.ellipse(
    x + OIL_W / 2 - 7,
    y + OIL_H / 2 - 4,
    OIL_W / 5,
    OIL_H / 6,
    0,
    0,
    TWO_PI,
  );
  ctx.fill();
}

function drawPuddleClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = 'rgba(70,140,220,0.45)';
  ctx.beginPath();
  ctx.ellipse(
    x + PUDDLE_W / 2,
    y + PUDDLE_H / 2,
    PUDDLE_W / 2,
    PUDDLE_H / 2,
    0,
    0,
    TWO_PI,
  );
  ctx.fill();
  ctx.fillStyle = 'rgba(200,230,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(
    x + PUDDLE_W / 2 + 6,
    y + PUDDLE_H / 2 - 4,
    PUDDLE_W / 6,
    PUDDLE_H / 7,
    0,
    0,
    TWO_PI,
  );
  ctx.fill();
}

function drawGoalClassic(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const rowH = GOAL_LINE_H / 2;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < GOAL_COLS; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#e8e8e8' : '#15151a';
      ctx.fillRect(x + col * GOAL_SQ, y + row * rowH, GOAL_SQ, rowH);
    }
  }
}

const RETRO_RIVAL_COLORS = ['#ffd27a', '#8ad1c0', '#c9e07a', '#e0a0c8', '#e59a5c'];

// Retro (CRT): bloques sólidos sin blur, paleta cálida y highlight superior.

function drawOilRetro(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#1c1410';
  ctx.beginPath();
  ctx.ellipse(x + OIL_W / 2, y + OIL_H / 2, OIL_W / 2, OIL_H / 2, 0, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,138,0.3)';
  ctx.beginPath();
  ctx.ellipse(
    x + OIL_W / 2 - 7,
    y + OIL_H / 2 - 4,
    OIL_W / 5,
    OIL_H / 6,
    0,
    0,
    TWO_PI,
  );
  ctx.fill();
}

function drawPuddleRetro(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(138,209,192,0.5)';
  ctx.beginPath();
  ctx.ellipse(
    x + PUDDLE_W / 2,
    y + PUDDLE_H / 2,
    PUDDLE_W / 2,
    PUDDLE_H / 2,
    0,
    0,
    TWO_PI,
  );
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(
    x + PUDDLE_W / 2 + 6,
    y + PUDDLE_H / 2 - 4,
    PUDDLE_W / 6,
    PUDDLE_H / 7,
    0,
    0,
    TWO_PI,
  );
  ctx.fill();
}

function drawGoalRetro(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const rowH = GOAL_LINE_H / 2;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < GOAL_COLS; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#ffe8c2' : '#3a2c14';
      ctx.fillRect(x + col * GOAL_SQ, y + row * rowH, GOAL_SQ, rowH);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, ROAD_W, 3);
}

// ── Neon sprite cache (P7, spec 12) ──────────────────────────────────────────
// Hasta ~7 rivales + bidones + jugador por frame con glow serían ~15-20
// llamadas shadowBlur/frame. Cada sprite se pre-renderiza UNA vez con el blur
// horneado; el draw() del loop solo hace drawImage (coste de composición).
// Spec 17: aceite, charco y la franja de meta completa entran en esta caché
// con su glow horneado. El intermitente no la necesita: es un fillRect plano
// (sin shadowBlur) — el glow ahí restaría legibilidad al parpadeo.

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
  oil: HTMLCanvasElement;
  puddle: HTMLCanvasElement;
  goal: HTMLCanvasElement;
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

function paintNeonOil(c: CanvasRenderingContext2D) {
  c.shadowBlur = 10;
  c.shadowColor = '#b44dff';
  c.fillStyle = 'rgba(12,6,22,0.92)';
  c.beginPath();
  c.ellipse(OIL_W / 2, OIL_H / 2, OIL_W / 2 - 1, OIL_H / 2 - 1, 0, 0, TWO_PI);
  c.fill();
  c.strokeStyle = '#b44dff';
  c.lineWidth = 2;
  c.stroke();
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(180,77,255,0.4)';
  c.beginPath();
  c.ellipse(OIL_W / 2 - 7, OIL_H / 2 - 4, OIL_W / 5, OIL_H / 6, 0, 0, TWO_PI);
  c.fill();
}

function paintNeonPuddle(c: CanvasRenderingContext2D) {
  c.shadowBlur = 10;
  c.shadowColor = '#00aaff';
  c.fillStyle = 'rgba(0,90,160,0.35)';
  c.beginPath();
  c.ellipse(
    PUDDLE_W / 2,
    PUDDLE_H / 2,
    PUDDLE_W / 2 - 1,
    PUDDLE_H / 2 - 1,
    0,
    0,
    TWO_PI,
  );
  c.fill();
  c.strokeStyle = '#00aaff';
  c.lineWidth = 2;
  c.stroke();
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(200,240,255,0.5)';
  c.beginPath();
  c.ellipse(
    PUDDLE_W / 2 + 6,
    PUDDLE_H / 2 - 4,
    PUDDLE_W / 6,
    PUDDLE_H / 7,
    0,
    0,
    TWO_PI,
  );
  c.fill();
}

function paintNeonGoal(c: CanvasRenderingContext2D) {
  const rowH = GOAL_LINE_H / 2;
  c.fillStyle = '#0a0a14';
  c.fillRect(0, 0, ROAD_W, GOAL_LINE_H);
  c.shadowBlur = 8;
  c.shadowColor = '#00f5ff';
  c.fillStyle = 'rgba(0,245,255,0.9)';
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < GOAL_COLS; col++) {
      if ((row + col) % 2 === 0) {
        c.fillRect(col * GOAL_SQ, row * rowH, GOAL_SQ, rowH);
      }
    }
  }
  c.shadowBlur = 0;
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
    oil: makeNeonSprite(OIL_W, OIL_H, paintNeonOil),
    puddle: makeNeonSprite(PUDDLE_W, PUDDLE_H, paintNeonPuddle),
    goal: makeNeonSprite(ROAD_W, GOAL_LINE_H, paintNeonGoal),
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
    telegraphColor: '#ffb400',
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
    drawOil: drawOilClassic,
    drawPuddle: drawPuddleClassic,
    drawGoal: drawGoalClassic,
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
    // Intermitente = información de gameplay: rojo saturado, deliberadamente
    // fuera de la paleta pastel de los rivales retro para máxima legibilidad
    // sobre el asfalto cálido y los bordes de carrocería.
    telegraphColor: '#ff3b30',
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
    drawOil: drawOilRetro,
    drawPuddle: drawPuddleRetro,
    drawGoal: drawGoalRetro,
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
    // Intermitente = información de gameplay: blanco puro, único tono que no
    // usa ningún glow de rival (amarillo/magenta/verde/naranja/azul) ni el
    // cian del jugador — legible sobre fondo negro y sobre cualquier coche.
    telegraphColor: '#ffffff',
    drawPlayer(ctx, x, y) {
      ctx.drawImage(getNeonSprites().player, x - NEON_PAD, y - NEON_PAD);
    },
    drawRival(ctx, x, y, colorIdx) {
      ctx.drawImage(getNeonSprites().rivals[colorIdx], x - NEON_PAD, y - NEON_PAD);
    },
    drawCan(ctx, x, y) {
      ctx.drawImage(getNeonSprites().can, x - NEON_PAD, y - NEON_PAD);
    },
    drawOil(ctx, x, y) {
      ctx.drawImage(getNeonSprites().oil, x - NEON_PAD, y - NEON_PAD);
    },
    drawPuddle(ctx, x, y) {
      ctx.drawImage(getNeonSprites().puddle, x - NEON_PAD, y - NEON_PAD);
    },
    drawGoal(ctx, x, y) {
      ctx.drawImage(getNeonSprites().goal, x - NEON_PAD, y - NEON_PAD);
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

// IA de rivales (spec 17): estado embebido en los objetos del pool, no estado
// React. forbiddenA/forbiddenB son la REGLA DURA: gapLane de su ventana + el
// de la ventana adyacente hacia el jugador — destinos prohibidos siempre.
interface Rival {
  x: number; // x base (sin offset de curva; la curva se aplica al usarla)
  y: number;
  prevY: number;
  hit: boolean;
  color: number;
  lane: number;
  targetLane: number;
  fromX: number;
  toX: number;
  forbiddenA: number; // gapLane de su ventana
  forbiddenB: number; // gapLane de la ventana adyacente hacia el jugador
  cooldownMs: number; // cooldown de cambio de carril (timer acotado — P3)
  telegraph: -1 | 0 | 1; // 0 = sin cambio; ±1 = lado telegrafiado
  telegraphMs: number;
  moveMs: number;
}

interface FuelCan {
  x: number;
  y: number;
}

interface Hazard {
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
  speedFactor: number; // régimen actual (0.6 | 1 | 1.4) para el HUD
  levelDist: number;
  scoreAcc: number;
  spawnAcc: number;
  stripeOffset: number;
  curveDist: number; // distancia de mundo para la curva, acotada (P3)
  lastGapLane: number;
  invulnMs: number;
  slipMs: number; // derrape por aceite (acotado — P3)
  slipVx: number; // deriva lateral conservada durante el derrape
  ramCooldownMs: number; // cooldown global de embestidas (acotado — P3)
  goalY: number; // y de la línea de meta; > H = inactiva
  bannerMs: number; // banner META (acotado — P3)
  bannerText: string;
  blinkMs: number; // reloj de parpadeo del intermitente (acotado — P3)
  exploding: boolean;
  explosionMs: number;
  explosionX: number;
  explosionY: number;
  rivals: Rival[];
  cans: FuelCan[];
  oils: Hazard[];
  puddles: Hazard[];
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
    speedFactor: 1,
    levelDist: 0,
    scoreAcc: 0,
    spawnAcc: 0,
    stripeOffset: 0,
    curveDist: 0,
    lastGapLane: 1,
    invulnMs: 0,
    slipMs: 0,
    slipVx: 0,
    ramCooldownMs: 0,
    goalY: H + GOAL_LINE_H,
    bannerMs: 0,
    bannerText: '',
    blinkMs: 0,
    exploding: false,
    explosionMs: 0,
    explosionX: 0,
    explosionY: 0,
    rivals: [],
    cans: [],
    oils: [],
    puddles: [],
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

    const keys: Record<KeyDir, boolean> = {
      left: false,
      right: false,
      up: false,
      down: false,
    };

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
    // Derrape: reutiliza /ball-bounce.mp3 (spec 17 — sin assets nuevos)
    function playSkid() {
      try {
        (pickupSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }
    function playCrash() {
      try {
        (crashSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }

    // ── Curvas ──────────────────────────────────────────────────────────────
    // Offset lateral del trazado para una fila de pantalla. Todas las
    // entidades ligadas a carril se dibujan/colisionan como
    // carril → x_base + curveOffsetAt(fila) — la carretera se mueve en bloque.
    function curveOffsetAt(screenY: number): number {
      const d = s.curveDist + (H - screenY);
      return (
        CURVE_AMPLITUDE_MAX *
        Math.sin((TWO_PI * d) / CURVE_WAVELENGTH) *
        Math.sin((TWO_PI * d) / CURVE_ENVELOPE_WAVELENGTH)
      );
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
      // gapLane de la ventana adyacente hacia el jugador (la anterior, que
      // queda por debajo de la nueva) — segundo carril prohibido de la IA
      const prevGap = s.lastGapLane;

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
          lane,
          targetLane: lane,
          fromX: 0,
          toX: 0,
          forbiddenA: gapLane,
          forbiddenB: prevGap,
          cooldownMs: 400 + Math.random() * LANE_CHANGE_COOLDOWN_MS,
          telegraph: 0,
          telegraphMs: 0,
          moveMs: 0,
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
          lane,
          targetLane: lane,
          fromX: 0,
          toX: 0,
          forbiddenA: gapLane,
          forbiddenB: prevGap,
          cooldownMs: 400 + Math.random() * LANE_CHANGE_COOLDOWN_MS,
          telegraph: 0,
          telegraphMs: 0,
          moveMs: 0,
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

      // Hazards (spec 17): SIEMPRE en carril != gapLane — invariante intacto.
      // Preferimos un carril no-gap sin rival; si todos están ocupados, uno
      // cualquiera no-gap (el solape con un rival es solo visual).
      const hazardChance = Math.min(
        HAZARD_CHANCE_BASE + (s.level - 1) * HAZARD_CHANCE_PER_LEVEL,
        HAZARD_CHANCE_MAX,
      );
      if (Math.random() < hazardChance) {
        const idx =
          occupied < n
            ? occupied + Math.floor(Math.random() * (n - occupied))
            : Math.floor(Math.random() * n);
        const lane = SCRATCH_LANES[idx];
        const hy =
          top +
          SPAWN_MARGIN +
          Math.random() * (SPAWN_WINDOW_H - PUDDLE_H - SPAWN_MARGIN * 2);
        if (Math.random() < 0.5) {
          s.oils.push({ x: LANE_CENTERS[lane] - OIL_W / 2, y: hy });
        } else {
          s.puddles.push({ x: LANE_CENTERS[lane] - PUDDLE_W / 2, y: hy });
        }
      }

      s.windows.push({ gapLane, bottom });
    }

    // ── IA de rivales (spec 17) ─────────────────────────────────────────────
    function laneIsLegal(r: Rival, lane: number): boolean {
      return (
        lane >= 0 &&
        lane < LANE_COUNT &&
        lane !== r.forbiddenA &&
        lane !== r.forbiddenB
      );
    }

    function startLaneChange(r: Rival, target: number) {
      r.targetLane = target;
      r.telegraph = target > r.lane ? 1 : -1;
      r.telegraphMs = LANE_CHANGE_TELEGRAPH_MS;
      r.moveMs = 0;
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
      s.slipMs = 0;
      s.slipVx = 0;
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
      s.playerX =
        LANE_CENTERS[respawnGapLane()] -
        CAR_W / 2 +
        curveOffsetAt(PLAYER_Y + CAR_H / 2);
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

      // Régimen de velocidad (spec 17): FRENO / CRUCERO / TURBO por flags
      const speedFactor =
        keys.up && !keys.down
          ? BOOST_FACTOR
          : keys.down && !keys.up
            ? BRAKE_FACTOR
            : 1;
      s.speedFactor = speedFactor;

      // Charco: hazard de velocidad — scroll efectivo × 0.7 mientras se pisa,
      // sin alterar el control lateral
      let onPuddle = false;
      for (let i = 0; i < s.puddles.length; i++) {
        const p = s.puddles[i];
        const px = p.x + curveOffsetAt(p.y + PUDDLE_H / 2);
        if (
          s.playerX < px + PUDDLE_W &&
          s.playerX + CAR_W > px &&
          PLAYER_Y < p.y + PUDDLE_H &&
          PLAYER_Y + CAR_H > p.y
        ) {
          onPuddle = true;
          break;
        }
      }

      // Scroll efectivo: la fórmula de puntos por distancia no cambia — el
      // régimen y el charco solo alteran los píxeles de mundo recorridos
      const scroll =
        s.scrollSpeed * speedFactor * (onPuddle ? PUDDLE_SLOW_FACTOR : 1);
      const rel = scroll * RIVAL_REL_FACTOR;

      // Lateral: durante el derrape (aceite) el input se ignora y el coche
      // conserva la deriva que llevaba
      if (s.slipMs > 0) {
        s.slipMs = Math.max(0, s.slipMs - dt * 1000);
        s.playerX += s.slipVx * dt;
      } else {
        if (keys.left) s.playerX -= PLAYER_SPEED * dt;
        if (keys.right) s.playerX += PLAYER_SPEED * dt;
      }

      // Distancia → puntos y nivel (acumuladores acotados — P3)
      s.scoreAcc += scroll * dt;
      while (s.scoreAcc >= DIST_SCORE_STEP) {
        s.scoreAcc -= DIST_SCORE_STEP;
        s.score += DIST_SCORE_POINTS * s.level;
      }
      s.levelDist += scroll * dt;
      while (s.levelDist >= LEVEL_DISTANCE) {
        s.levelDist -= LEVEL_DISTANCE;
        // Meta de tramo (spec 17): bonus 200 × nivel completado, línea de
        // meta y banner no bloqueante. La meta NO recarga fuel.
        const completed = s.level;
        s.level += 1;
        s.scrollSpeed = scrollSpeedFor(s.level);
        s.score += GOAL_BONUS * completed;
        s.goalY = -GOAL_LINE_H;
        s.bannerMs = GOAL_BANNER_MS;
        s.bannerText = `+${GOAL_BONUS * completed}`;
      }

      s.stripeOffset = (s.stripeOffset + scroll * dt) % STRIPE_WRAP;
      s.curveDist = (s.curveDist + scroll * dt) % CURVE_DIST_WRAP;
      s.blinkMs = (s.blinkMs + dt * 1000) % BLINK_PERIOD_MS;
      if (s.bannerMs > 0) s.bannerMs = Math.max(0, s.bannerMs - dt * 1000);
      if (s.ramCooldownMs > 0)
        s.ramCooldownMs = Math.max(0, s.ramCooldownMs - dt * 1000);
      // La línea de meta es pintura sobre el asfalto: baja a velocidad de
      // scroll y se desactiva (y deja de moverse) al salir por abajo
      if (s.goalY <= H) s.goalY += scroll * dt;

      // Spawner: cadencia en distancia relativa para que las ventanas
      // enlosen sin huecos ni solapes a velocidad de entidad
      s.spawnAcc += rel * dt;
      while (s.spawnAcc >= SPAWN_WINDOW_H) {
        const overshoot = s.spawnAcc - SPAWN_WINDOW_H;
        s.spawnAcc = overshoot;
        spawnWindow(overshoot);
      }

      // Carril del jugador (para embestidas), corregido por la curva
      const offPlayer = curveOffsetAt(PLAYER_Y + CAR_H / 2);
      const playerLane = Math.max(
        0,
        Math.min(
          LANE_COUNT - 1,
          Math.floor((s.playerX + CAR_W / 2 - offPlayer - ROAD_X) / LANE_W),
        ),
      );
      const laneChangeChance = Math.min(
        LANE_CHANGE_CHANCE_BASE +
          (s.level - 1) * LANE_CHANGE_CHANCE_PER_LEVEL,
        LANE_CHANGE_CHANCE_MAX,
      );

      for (let i = s.rivals.length - 1; i >= 0; i--) {
        const r = s.rivals[i];
        r.prevY = r.y;
        r.y += rel * dt;
        if (r.y > H) {
          if (!r.hit) s.score += OVERTAKE_POINTS * s.level; // rebase
          s.rivals.splice(i, 1);
          continue;
        }

        // Máquina de estados de la IA: telegrafiado → animación → cooldown
        if (r.telegraph !== 0) {
          if (r.moveMs > 0) {
            r.moveMs = Math.max(0, r.moveMs - dt * 1000);
            const t = 1 - r.moveMs / LANE_CHANGE_MOVE_MS;
            r.x = r.fromX + (r.toX - r.fromX) * t;
            if (r.moveMs === 0) {
              r.lane = r.targetLane;
              r.telegraph = 0;
              r.cooldownMs = LANE_CHANGE_COOLDOWN_MS;
            }
          } else {
            r.telegraphMs = Math.max(0, r.telegraphMs - dt * 1000);
            if (r.telegraphMs === 0) {
              r.moveMs = LANE_CHANGE_MOVE_MS;
              r.fromX = r.x;
              r.toX = LANE_CENTERS[r.targetLane] - RIVAL_W / 2;
            }
          }
        } else if (r.cooldownMs > 0) {
          r.cooldownMs = Math.max(0, r.cooldownMs - dt * 1000);
        } else if (r.y > 0 && r.y + RIVAL_H < PLAYER_Y) {
          // Embestida: mismo mecanismo con condición de disparo distinta
          // (jugador en carril adyacente a distancia corta) + cooldown global
          if (
            s.ramCooldownMs === 0 &&
            Math.abs(playerLane - r.lane) === 1 &&
            PLAYER_Y - (r.y + RIVAL_H) < RAM_DISTANCE &&
            Math.random() < RAM_CHANCE_PER_S * dt
          ) {
            if (laneIsLegal(r, playerLane)) {
              startLaneChange(r, playerLane);
              s.ramCooldownMs = RAM_COOLDOWN_MS;
            } else {
              // REGLA DURA: sin destino legal no hay cambio; cooldown reiniciado
              r.cooldownMs = LANE_CHANGE_COOLDOWN_MS;
            }
          } else if (Math.random() < laneChangeChance * dt) {
            const firstDir = Math.random() < 0.5 ? -1 : 1;
            if (laneIsLegal(r, r.lane + firstDir)) {
              startLaneChange(r, r.lane + firstDir);
            } else if (laneIsLegal(r, r.lane - firstDir)) {
              startLaneChange(r, r.lane - firstDir);
            } else {
              // REGLA DURA: sin destino legal no hay cambio; cooldown reiniciado
              r.cooldownMs = LANE_CHANGE_COOLDOWN_MS;
            }
          }
        }
      }
      for (let i = s.cans.length - 1; i >= 0; i--) {
        s.cans[i].y += rel * dt;
        if (s.cans[i].y > H) s.cans.splice(i, 1);
      }
      for (let i = s.oils.length - 1; i >= 0; i--) {
        s.oils[i].y += rel * dt;
        if (s.oils[i].y > H) s.oils.splice(i, 1);
      }
      for (let i = s.puddles.length - 1; i >= 0; i--) {
        s.puddles[i].y += rel * dt;
        if (s.puddles[i].y > H) s.puddles.splice(i, 1);
      }
      for (let i = s.windows.length - 1; i >= 0; i--) {
        s.windows[i].bottom += rel * dt;
        if (s.windows[i].bottom - SPAWN_WINDOW_H > H) s.windows.splice(i, 1);
      }

      // Fuel: drenaje proporcional al régimen (spec 17), acotado a [0, FUEL_MAX]
      s.fuel = Math.max(0, s.fuel - FUEL_DRAIN_PER_S * speedFactor * dt);

      if (s.invulnMs > 0) s.invulnMs = Math.max(0, s.invulnMs - dt * 1000);

      // Bidones: recogerlos nunca depende de la invulnerabilidad
      for (let i = s.cans.length - 1; i >= 0; i--) {
        const c = s.cans[i];
        const cx = c.x + curveOffsetAt(c.y + CAN_H / 2);
        if (
          s.playerX < cx + CAN_W &&
          s.playerX + CAR_W > cx &&
          PLAYER_Y < c.y + CAN_H &&
          PLAYER_Y + CAR_H > c.y
        ) {
          s.cans.splice(i, 1);
          s.fuel = Math.min(FUEL_MAX, s.fuel + FUEL_PICKUP_AMOUNT);
          s.score += FUEL_POINTS * s.level;
          playPickup();
        }
      }

      // Aceite: hazard de control — derrape con deriva conservada. El derrape
      // no es choque en sí (el choque resultante sí, por la tubería normal).
      if (s.slipMs <= 0) {
        for (let i = 0; i < s.oils.length; i++) {
          const o = s.oils[i];
          const ox = o.x + curveOffsetAt(o.y + OIL_H / 2);
          if (
            s.playerX < ox + OIL_W &&
            s.playerX + CAR_W > ox &&
            PLAYER_Y < o.y + OIL_H &&
            PLAYER_Y + CAR_H > o.y
          ) {
            s.slipMs = OIL_SLIP_MS;
            s.slipVx =
              (keys.right ? PLAYER_SPEED : 0) - (keys.left ? PLAYER_SPEED : 0);
            playSkid();
            break;
          }
        }
      }

      report();

      if (s.fuel <= 0) {
        die(true);
        return;
      }

      if (s.invulnMs > 0) return;

      // Arcén (desplazado por la curva en la fila del jugador)
      const roadLeft = ROAD_X + offPlayer;
      if (s.playerX < roadLeft || s.playerX + CAR_W > roadLeft + ROAD_W) {
        die(false);
        return;
      }

      // Rivales — AABB con barrido vertical (prevY → y) contra tunneling
      for (let i = 0; i < s.rivals.length; i++) {
        const r = s.rivals[i];
        const rx = r.x + curveOffsetAt(r.y + RIVAL_H / 2);
        const top = Math.min(r.prevY, r.y);
        const bottom = Math.max(r.prevY, r.y) + RIVAL_H;
        if (
          s.playerX < rx + RIVAL_W &&
          s.playerX + CAR_W > rx &&
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

      // Offsets de curva por franja: rellenados una vez y reutilizados por
      // calzada, bordes y rayas de carril (scratch de módulo — P1)
      for (let i = 0; i <= CURVE_STRIPS; i++) {
        CURVE_SCRATCH[i] = curveOffsetAt(i * CURVE_STRIP_H);
      }

      // Calzada en franjas horizontales siguiendo la curva
      ctx.fillStyle = skin.road;
      for (let i = 0; i < CURVE_STRIPS; i++) {
        ctx.fillRect(
          ROAD_X + CURVE_SCRATCH[i],
          i * CURVE_STRIP_H,
          ROAD_W,
          CURVE_STRIP_H + 1,
        );
      }

      // Bordillos con scroll, desplazados por la curva en su fila
      const curbOff = s.stripeOffset % (CURB_SEG * 2);
      let alt = 0;
      for (let y = curbOff - CURB_SEG * 2; y < H; y += CURB_SEG, alt ^= 1) {
        const off = curveOffsetAt(y + CURB_SEG / 2);
        ctx.fillStyle = alt === 0 ? skin.curbA : skin.curbB;
        ctx.fillRect(ROAD_X - CURB_W + off, y, CURB_W, CURB_SEG);
        ctx.fillRect(ROAD_X + ROAD_W + off, y, CURB_W, CURB_SEG);
      }

      // Líneas de borde en franjas
      ctx.fillStyle = skin.edgeLine;
      for (let i = 0; i < CURVE_STRIPS; i++) {
        const off = CURVE_SCRATCH[i];
        const y = i * CURVE_STRIP_H;
        ctx.fillRect(ROAD_X + off, y, 3, CURVE_STRIP_H + 1);
        ctx.fillRect(ROAD_X + ROAD_W - 3 + off, y, 3, CURVE_STRIP_H + 1);
      }

      // Rayas de carril discontinuas con scroll, como polilíneas curvas
      ctx.strokeStyle = skin.laneLine;
      ctx.lineWidth = 4;
      ctx.setLineDash(DASH_LANE);
      ctx.lineDashOffset = -s.stripeOffset;
      for (let i = 1; i < LANE_COUNT; i++) {
        const x0 = ROAD_X + LANE_W * i;
        ctx.beginPath();
        ctx.moveTo(x0 + CURVE_SCRATCH[0], 0);
        for (let j = 1; j <= CURVE_STRIPS; j++) {
          ctx.lineTo(x0 + CURVE_SCRATCH[j], j * CURVE_STRIP_H);
        }
        ctx.stroke();
      }
      ctx.setLineDash(DASH_CLEAR);
      ctx.lineDashOffset = 0;

      // Línea de meta (puramente visual — no ocupa carriles)
      if (s.goalY < H && s.goalY > -GOAL_LINE_H) {
        skin.drawGoal(
          ctx,
          ROAD_X + curveOffsetAt(s.goalY + GOAL_LINE_H / 2),
          s.goalY,
        );
      }

      // Hazards sobre el asfalto, bajo coches y bidones
      for (let i = 0; i < s.oils.length; i++) {
        const o = s.oils[i];
        skin.drawOil(ctx, o.x + curveOffsetAt(o.y + OIL_H / 2), o.y);
      }
      for (let i = 0; i < s.puddles.length; i++) {
        const p = s.puddles[i];
        skin.drawPuddle(ctx, p.x + curveOffsetAt(p.y + PUDDLE_H / 2), p.y);
      }

      for (let i = 0; i < s.cans.length; i++) {
        const c = s.cans[i];
        skin.drawCan(ctx, c.x + curveOffsetAt(c.y + CAN_H / 2), c.y);
      }
      const blinkOn = s.blinkMs < BLINK_PERIOD_MS / 2;
      for (let i = 0; i < s.rivals.length; i++) {
        const r = s.rivals[i];
        const rx = r.x + curveOffsetAt(r.y + RIVAL_H / 2);
        skin.drawRival(ctx, rx, r.y, r.color);
        // Intermitente de telegrafiado (información de gameplay): parpadea
        // hacia el lado del cambio durante telegrafiado y animación
        if (r.telegraph !== 0 && blinkOn) {
          ctx.fillStyle = skin.telegraphColor;
          const bx = r.telegraph > 0 ? rx + RIVAL_W - 2 : rx - 4;
          ctx.fillRect(bx, r.y + 4, 6, 9);
          ctx.fillRect(bx, r.y + RIVAL_H - 13, 6, 9);
        }
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

      // Indicador de régimen (spec 17) junto a la barra de fuel
      ctx.fillStyle =
        s.speedFactor > 1
          ? skin.fuelOk
          : s.speedFactor < 1
            ? skin.fuelLow
            : skin.hudColor;
      ctx.fillText(
        s.speedFactor > 1
          ? REGIME_BOOST
          : s.speedFactor < 1
            ? REGIME_BRAKE
            : REGIME_CRUISE,
        barX + barW + 14,
        barY + barH / 2,
      );

      // Banner META (no bloqueante — el juego sigue corriendo debajo)
      if (s.bannerMs > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, H / 2 - 64, W, 84);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px monospace';
        ctx.fillText('META', W / 2, H / 2 - 30);
        ctx.fillStyle = skin.fuelOk;
        ctx.font = 'bold 20px monospace';
        ctx.fillText(s.bannerText, W / 2, H / 2 + 4);
      }
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
