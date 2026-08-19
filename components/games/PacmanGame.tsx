'use client';

import React, { useEffect, useRef } from 'react';

import {
  chaseTarget,
  modeSchedule,
  nextDir,
  scatterTarget,
  type GhostId,
  type Mode,
  type TargetState,
} from './pacman-logic/ghosts';
import { parseMaze, validateMaze, type ParsedMaze } from './pacman-logic/maze';
import { MAZES } from './pacman-logic/mazes';

interface PacmanGameProps {
  paused: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Geometría (spec 19) ───────────────────────────────────────────────────────

const TILE = 16;
const GRID_COLS = 28;
const GRID_ROWS = 31;
const HUD_BAND_H = 32;
const MAZE_W = GRID_COLS * TILE; // 448
const MAZE_H = GRID_ROWS * TILE; // 496
const W = MAZE_W; // 448
const H = MAZE_H + HUD_BAND_H * 2; // 560
const MAZE_Y = HUD_BAND_H; // desplazamiento vertical del laberinto en el canvas

// ── Direcciones ───────────────────────────────────────────────────────────────
// Mismo encoding que pacman-logic/ghosts.ts: 0 up, 1 left, 2 down, 3 right.
// El bitmask de `adjacency` usa exactamente `1 << dir`.

type Dir = 0 | 1 | 2 | 3;

const UP: Dir = 0;
const LEFT: Dir = 1;
const DOWN: Dir = 2;
const RIGHT: Dir = 3;
const NO_DIR = -1;

// P1: tablas de módulo, nunca literales dentro del RAF
const DIR_DX = new Int8Array([0, -1, 0, 1]);
const DIR_DY = new Int8Array([-1, 0, 1, 0]);
const DIR_ANGLE = new Float32Array([
  -Math.PI / 2,
  Math.PI,
  Math.PI / 2,
  0,
]);

// ── Constantes de tuning (spec 19) ────────────────────────────────────────────

const PACMAN_SPEED = 140; // px/s
const TURN_TOLERANCE = 4; // px de snap al centro de celda para girar
const COLLISION_DIST = 8; // px entre centros
const START_LIVES = 3;

const PELLET_POINTS = 10;
const POWER_PELLET_POINTS = 50;
const GHOST_CHAIN_POINTS = [200, 400, 800, 1600];
const FRUIT_POINTS_PER_LEVEL = 100;
const FRUIT_TRIGGER_PELLETS = [70, 170];
const FRUIT_DURATION_MS = 9000;

const FRIGHTENED_SPEED_FACTOR = 0.55;
const FRIGHTENED_FLASH_MS = 2000;
const EYES_SPEED_FACTOR = 1.5;
const TUNNEL_SPEED_FACTOR = 0.6;

const GHOST_RELEASE_PELLETS: Record<string, number> = {
  pinky: 0,
  inky: 30,
  clyde: 60,
};
const GHOST_RELEASE_FALLBACK_MS = 4000;
const RELEASE_ORDER: GhostId[] = ['pinky', 'inky', 'clyde'];

const PELLET_SOUND_THROTTLE_MS = 150;
const DEATH_PAUSE_MS = 1200;
const LEVEL_BANNER_MS = 1200;

// Timers de animación acotados por módulo (P3)
const MOUTH_PERIOD_MS = 240;
const POWER_BLINK_MS = 400;
const FRIGHT_FLASH_PERIOD_MS = 250;
const HOUSE_BOB_MS = 900;

const EPS = 1e-6;
const MAX_SUBSTEPS = 8; // acota el bucle de avance por celda

// ── Escalado por nivel (spec 19) ──────────────────────────────────────────────
// Solo las columnas que consume este componente. La columna `scatterS` de la
// tabla del spec se ajusta en `SCATTER_S_BY_LEVEL` (pacman-logic/ghosts.ts): es
// la que `modeSchedule()` usa para construir las fases scatter↔chase.

type Difficulty = {
  ghostSpeedFactor: number;
  frightenedS: number;
};

const DIFFICULTY: Difficulty[] = [
  { ghostSpeedFactor: 0.75, frightenedS: 6 },
  { ghostSpeedFactor: 0.8, frightenedS: 5 },
  { ghostSpeedFactor: 0.83, frightenedS: 4 },
  { ghostSpeedFactor: 0.86, frightenedS: 3 },
  { ghostSpeedFactor: 0.89, frightenedS: 3 },
  { ghostSpeedFactor: 0.91, frightenedS: 2 },
  { ghostSpeedFactor: 0.93, frightenedS: 2 },
  { ghostSpeedFactor: 0.95, frightenedS: 2 },
  { ghostSpeedFactor: 0.97, frightenedS: 1 },
  { ghostSpeedFactor: 0.98, frightenedS: 1 },
  { ghostSpeedFactor: 0.98, frightenedS: 1 },
  { ghostSpeedFactor: 0.98, frightenedS: 0 },
];

const MAX_DIFFICULTY_LEVEL = DIFFICULTY.length; // 12

function difficultyFor(level: number): Difficulty {
  return DIFFICULTY[Math.min(level, MAX_DIFFICULTY_LEVEL) - 1];
}

// ── Mazes parseados (P4) ──────────────────────────────────────────────────────
// Un único parse por maze al cargar el módulo: adyacencias, pellets y spawns
// quedan precomputados; el hot path nunca re-escanea los strings.

type MazeInfo = {
  parsed: ParsedMaze;
  blinkySpawn: number; // celda transitable justo encima de la puerta
  houseCenter: number; // celda de la casa justo debajo de la puerta
  spawns: Record<GhostId, number>;
  tunnelSet: Set<number>;
};

function buildMazeInfo(rows: string[]): MazeInfo {
  const parsed = parseMaze(rows);
  const cols = parsed.cols;
  const door = parsed.ghostHouse.door;
  const houseCenter = door + cols;
  const insideRow = Math.floor(houseCenter / cols);
  const rowCells = parsed.ghostHouse.cells
    .filter((c) => Math.floor(c / cols) === insideRow)
    .sort((a, b) => a - b);

  const pinky = rowCells.includes(houseCenter)
    ? houseCenter
    : rowCells[Math.floor(rowCells.length / 2)];
  const inky = rowCells.length > 2 ? rowCells[1] : rowCells[0];
  const clyde =
    rowCells.length > 2
      ? rowCells[rowCells.length - 2]
      : rowCells[rowCells.length - 1];

  const blinkySpawn = door - cols;

  return {
    parsed,
    blinkySpawn,
    houseCenter,
    spawns: { blinky: blinkySpawn, pinky, inky, clyde },
    tunnelSet: new Set(parsed.tunnels),
  };
}

const MAZE_INFO: MazeInfo[] = MAZES.map(buildMazeInfo);

// Assertion de desarrollo (spec 19): dimensiones, conteos, túneles emparejados
// y flood-fill desde el spawn. Cero coste en el bundle de producción.
if (process.env.NODE_ENV !== 'production') {
  MAZE_INFO.forEach((info, i) => {
    const violations = validateMaze(info.parsed);
    if (violations.length > 0) {
      throw new Error(
        `PacmanGame: maze ${i + 1} inválido — ${violations.join('; ')}`,
      );
    }
  });
}

// ── Helpers de rejilla ────────────────────────────────────────────────────────

function cellCX(cell: number): number {
  return (cell % GRID_COLS) * TILE + TILE / 2;
}

function cellCY(cell: number): number {
  return Math.floor(cell / GRID_COLS) * TILE + TILE / 2;
}

function cellAt(x: number, y: number): number {
  const cx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(x / TILE)));
  const cy = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(y / TILE)));
  return cy * GRID_COLS + cx;
}

// Vecino en `dir` con wrap horizontal de túnel (misma regla que ghosts.ts)
function stepCell(cell: number, dir: Dir): number {
  const x = cell % GRID_COLS;
  switch (dir) {
    case UP:
      return cell - GRID_COLS;
    case LEFT:
      return x === 0 ? cell + GRID_COLS - 1 : cell - 1;
    case DOWN:
      return cell + GRID_COLS;
    default:
      return x === GRID_COLS - 1 ? cell - (GRID_COLS - 1) : cell + 1;
  }
}

function canGo(m: ParsedMaze, cell: number, dir: Dir): boolean {
  return (m.adjacency[cell] & (1 << dir)) !== 0;
}

function reverseOf(dir: Dir): Dir {
  return ((dir + 2) % 4) as Dir;
}

// ── Skins ─────────────────────────────────────────────────────────────────────

type Skin = {
  name: string;
  bg: string;
  hud: string;
  hudAccent: string;
  pellet: string;
  powerPellet: string;
  banner: string;
  drawWalls: (ctx: CanvasRenderingContext2D, m: ParsedMaze) => void;
  drawPacman: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dir: Dir,
    open: number,
    radius: number,
  ) => void;
  drawGhost: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    id: GhostId,
    dir: Dir,
    mode: Mode,
    flashing: boolean,
  ) => void;
  drawFruit: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
  ) => void;
};

const CLASSIC_WALL = '#2121de';
const CLASSIC_WALL_EDGE = '#4d4dff';
const CLASSIC_DOOR = '#ffb8ff';

function isHardWall(m: ParsedMaze, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= m.cols || y >= m.rows) return true;
  return m.walls[y * m.cols + x] === 1;
}

function drawWallsClassic(ctx: CanvasRenderingContext2D, m: ParsedMaze) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = CLASSIC_WALL;

  const inset = 2;
  ctx.beginPath();
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      if (m.walls[y * m.cols + x] !== 1) continue;
      const px = x * TILE;
      const py = y * TILE;
      // Solo se traza el borde del bloque que da a pasillo: los bloques de
      // 2 celdas de grosor quedan como el contorno redondeado del clásico.
      if (!isHardWall(m, x, y - 1)) {
        ctx.moveTo(px, py + inset);
        ctx.lineTo(px + TILE, py + inset);
      }
      if (!isHardWall(m, x, y + 1)) {
        ctx.moveTo(px, py + TILE - inset);
        ctx.lineTo(px + TILE, py + TILE - inset);
      }
      if (!isHardWall(m, x - 1, y)) {
        ctx.moveTo(px + inset, py);
        ctx.lineTo(px + inset, py + TILE);
      }
      if (!isHardWall(m, x + 1, y)) {
        ctx.moveTo(px + TILE - inset, py);
        ctx.lineTo(px + TILE - inset, py + TILE);
      }
    }
  }
  ctx.stroke();

  ctx.strokeStyle = CLASSIC_WALL_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Puerta de la casa
  ctx.fillStyle = CLASSIC_DOOR;
  for (let i = 0; i < m.walls.length; i++) {
    if (m.walls[i] !== 2) continue;
    ctx.fillRect(
      (i % m.cols) * TILE,
      Math.floor(i / m.cols) * TILE + TILE / 2 - 2,
      TILE,
      4,
    );
  }
}

function drawPacmanClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Dir,
  open: number,
  radius: number,
) {
  if (radius <= 0) return;
  const ang = DIR_ANGLE[dir];
  const half = 0.02 + open * 0.3 * Math.PI;
  ctx.fillStyle = '#ffe600';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, ang + half, ang - half);
  ctx.closePath();
  ctx.fill();
}

function drawGhostBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  const r = 7;
  const top = y - 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, top, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r);
  ctx.lineTo(x + r * 0.6, y + r - 3);
  ctx.lineTo(x + r * 0.2, y + r);
  ctx.lineTo(x - r * 0.2, y + r - 3);
  ctx.lineTo(x - r * 0.6, y + r);
  ctx.lineTo(x - r, y + r - 3);
  ctx.lineTo(x - r, top);
  ctx.closePath();
  ctx.fill();
}

function drawGhostEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Dir,
) {
  const dx = DIR_DX[dir] * 1.6;
  const dy = DIR_DY[dir] * 1.6;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - 2.6, y - 2, 2.6, 0, Math.PI * 2);
  ctx.arc(x + 2.6, y - 2, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2121de';
  ctx.beginPath();
  ctx.arc(x - 2.6 + dx, y - 2 + dy, 1.3, 0, Math.PI * 2);
  ctx.arc(x + 2.6 + dx, y - 2 + dy, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawGhostClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: GhostId,
  dir: Dir,
  mode: Mode,
  flashing: boolean,
) {
  if (mode === 'eyes') {
    drawGhostEyes(ctx, x, y, dir);
    return;
  }
  if (mode === 'frightened') {
    drawGhostBody(ctx, x, y, flashing ? '#ffffff' : '#2121de');
    ctx.fillStyle = flashing ? '#ff0000' : '#ffffff';
    ctx.fillRect(x - 3.4, y - 3, 2, 2);
    ctx.fillRect(x + 1.4, y - 3, 2, 2);
    ctx.fillRect(x - 4, y + 2, 8, 1.5);
    return;
  }
  drawGhostBody(ctx, x, y, SKIN_GHOST_COLORS[id]);
  drawGhostEyes(ctx, x, y, dir);
}

const SKIN_GHOST_COLORS: Record<GhostId, string> = {
  blinky: '#ff0000',
  pinky: '#ffb8ff',
  inky: '#00ffff',
  clyde: '#ffb852',
};

function drawFruitClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
) {
  const r = 3.4 * scale;
  ctx.fillStyle = '#ff2d2d';
  ctx.beginPath();
  ctx.arc(x - 3 * scale, y + 2 * scale, r, 0, Math.PI * 2);
  ctx.arc(x + 3 * scale, y + 3 * scale, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3ad13a';
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.moveTo(x - 3 * scale, y + 2 * scale);
  ctx.lineTo(x + 1 * scale, y - 5 * scale);
  ctx.lineTo(x + 3 * scale, y + 3 * scale);
  ctx.stroke();
}

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'classic',
    bg: '#000000',
    hud: '#ffffff',
    hudAccent: '#ffe600',
    pellet: '#ffb897',
    powerPellet: '#ffb897',
    banner: '#ffe600',
    drawWalls: drawWallsClassic,
    drawPacman: drawPacmanClassic,
    drawGhost: drawGhostClassic,
    drawFruit: drawFruitClassic,
  },
};

// ── Teclado ───────────────────────────────────────────────────────────────────
// Flechas + WASD, 4 direcciones (compatible con la síntesis de teclado del
// MobileGamepad del spec 10, que añadirá @mobile-porter).

const KEY_DIRS: Record<string, Dir | undefined> = {
  arrowup: UP,
  w: UP,
  arrowleft: LEFT,
  a: LEFT,
  arrowdown: DOWN,
  s: DOWN,
  arrowright: RIGHT,
  d: RIGHT,
};

// ── Estado ────────────────────────────────────────────────────────────────────

type GhostState = 'house' | 'exiting' | 'out' | 'eyes' | 'entering';

type Ghost = {
  id: GhostId;
  x: number;
  y: number;
  dir: Dir;
  state: GhostState;
  frightened: boolean;
  wantsExit: boolean;
  eatenThisFright: boolean;
};

type GameState = {
  score: number;
  level: number;
  lives: number;
  over: boolean;
  mazeIndex: number;
  pellets: Set<number>;
  powerPellets: Set<number>;
  pelletsEaten: number;
  fruitIndex: number;
  fruitMs: number;
  pac: { x: number; y: number; dir: Dir; desired: number; mouthMs: number };
  ghosts: Ghost[];
  schedule: { phase: Mode; durationMs: number }[];
  phaseIdx: number;
  phaseMs: number;
  frightenedMs: number;
  chainIdx: number;
  releaseIdx: number;
  releaseFallbackMs: number;
  deathMs: number;
  readyMs: number;
  clearMs: number;
  blinkMs: number;
  bobMs: number;
};

function makeGhost(id: GhostId): Ghost {
  return {
    id,
    x: 0,
    y: 0,
    dir: LEFT,
    state: 'house',
    frightened: false,
    wantsExit: false,
    eatenThisFright: false,
  };
}

function initialState(): GameState {
  const s: GameState = {
    score: 0,
    level: 1,
    lives: START_LIVES,
    over: false,
    mazeIndex: 0,
    pellets: new Set<number>(),
    powerPellets: new Set<number>(),
    pelletsEaten: 0,
    fruitIndex: 0,
    fruitMs: 0,
    pac: { x: 0, y: 0, dir: LEFT, desired: NO_DIR, mouthMs: 0 },
    ghosts: [
      makeGhost('blinky'),
      makeGhost('pinky'),
      makeGhost('inky'),
      makeGhost('clyde'),
    ],
    schedule: modeSchedule(1),
    phaseIdx: 0,
    phaseMs: 0,
    frightenedMs: 0,
    chainIdx: 0,
    releaseIdx: 0,
    releaseFallbackMs: 0,
    deathMs: 0,
    readyMs: LEVEL_BANNER_MS,
    clearMs: 0,
    blinkMs: 0,
    bobMs: 0,
  };
  loadLevel(s, 1);
  return s;
}

function loadLevel(s: GameState, level: number) {
  s.level = level;
  s.mazeIndex = (level - 1) % MAZE_INFO.length;
  const info = MAZE_INFO[s.mazeIndex];
  s.pellets = new Set(info.parsed.pellets);
  s.powerPellets = new Set(info.parsed.powerPellets);
  s.pelletsEaten = 0;
  s.fruitIndex = 0;
  s.fruitMs = 0;
  s.schedule = modeSchedule(level);
  s.readyMs = LEVEL_BANNER_MS;
  s.clearMs = 0;
  placeEntities(s);
}

function placeEntities(s: GameState) {
  const info = MAZE_INFO[s.mazeIndex];
  s.pac.x = cellCX(info.parsed.pacmanSpawn);
  s.pac.y = cellCY(info.parsed.pacmanSpawn);
  s.pac.dir = LEFT;
  s.pac.desired = NO_DIR;

  for (let i = 0; i < s.ghosts.length; i++) {
    const g = s.ghosts[i];
    const cell = info.spawns[g.id];
    g.x = cellCX(cell);
    g.y = cellCY(cell);
    g.frightened = false;
    g.wantsExit = false;
    g.eatenThisFright = false;
    if (g.id === 'blinky') {
      g.state = 'out';
      g.dir = LEFT;
    } else {
      g.state = 'house';
      g.dir = UP;
    }
  }

  s.phaseIdx = 0;
  s.phaseMs = 0;
  s.frightenedMs = 0;
  s.chainIdx = 0;
  s.releaseIdx = 0;
  s.releaseFallbackMs = 0;
  s.deathMs = 0;
}

// Scratch de módulo para chaseTarget: sin literales de objeto en el RAF (P1)
const TARGET_SCRATCH: TargetState = {
  pacmanCell: 0,
  pacmanDir: 0,
  blinkyCell: 0,
  ghostCell: 0,
  cols: GRID_COLS,
};

// ── Componente ────────────────────────────────────────────────────────────────

function PacmanGame({
  paused,
  skinKey = 'classic',
  onScoreChange,
  onLevelChange,
  onLivesChange,
  onGameOver,
}: PacmanGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const skinRef = useRef<Skin>(SKINS[skinKey ?? 'classic'] ?? SKINS.classic);
  const stateRef = useRef<GameState | null>(null);
  if (stateRef.current === null) stateRef.current = initialState();

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
    const s = stateRef.current!;

    // Callbacks solo cuando el valor cambia (P6)
    let reportedScore = s.score;
    let reportedLevel = s.level;
    let reportedLives = s.lives;
    let endFired = false;

    // ── Audio ───────────────────────────────────────────────────────────────
    const pelletSound = new Audio('/ball-bounce.mp3');
    const breakSound = new Audio('/break-sound.mp3');
    let lastPelletSoundAt = -PELLET_SOUND_THROTTLE_MS;

    function playPellet(now: number) {
      if (now - lastPelletSoundAt < PELLET_SOUND_THROTTLE_MS) return;
      lastPelletSoundAt = now;
      try {
        (pelletSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }
    function playBonus() {
      try {
        (pelletSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }
    function playBreak() {
      try {
        (breakSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }

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

    // ── Movimiento ──────────────────────────────────────────────────────────
    // Avance continuo con puntos de decisión exactos en el centro de cada
    // celda: el paso se corta en el centro y se hace snap, así los giros y las
    // decisiones de los fantasmas nunca dependen del framerate.
    function stepEntity(
      e: { x: number; y: number; dir: Dir },
      dist: number,
      m: ParsedMaze,
      onCenter: ((cell: number) => void) | null,
    ) {
      let remaining = dist;
      let guard = 0;
      while (remaining > EPS && guard++ < MAX_SUBSTEPS) {
        const cell = cellAt(e.x, e.y);
        const ccx = cellCX(cell);
        const ccy = cellCY(cell);
        const ahead =
          DIR_DX[e.dir] * (e.x - ccx) + DIR_DY[e.dir] * (e.y - ccy);

        let toNext: number;
        if (ahead > -EPS && ahead < EPS) {
          if (onCenter) onCenter(cell);
          if (!canGo(m, cell, e.dir)) return; // parado contra el muro
          toNext = TILE;
        } else if (ahead > 0) {
          toNext = TILE - ahead;
        } else {
          toNext = -ahead;
        }

        const move = Math.min(remaining, toNext);
        remaining -= move;
        if (move >= toNext - EPS) {
          const target = ahead < -EPS ? cell : stepCell(cell, e.dir);
          e.x = cellCX(target);
          e.y = cellCY(target);
        } else {
          e.x += DIR_DX[e.dir] * move;
          e.y += DIR_DY[e.dir] * move;
        }
      }
    }

    function tryTurn(cell: number) {
      const d = s.pac.desired;
      if (d === NO_DIR || d === s.pac.dir) return;
      const m = MAZE_INFO[s.mazeIndex].parsed;
      if (!canGo(m, cell, d as Dir)) return;

      if (d !== reverseOf(s.pac.dir)) {
        const ccx = cellCX(cell);
        const ccy = cellCY(cell);
        const off =
          Math.abs(DIR_DX[s.pac.dir]) * Math.abs(s.pac.x - ccx) +
          Math.abs(DIR_DY[s.pac.dir]) * Math.abs(s.pac.y - ccy);
        if (off > TURN_TOLERANCE) return; // el buffer se conserva
        s.pac.x = ccx;
        s.pac.y = ccy;
      }
      s.pac.dir = d as Dir;
      s.pac.desired = NO_DIR;
    }

    // ── Fantasmas ───────────────────────────────────────────────────────────
    function ghostMode(g: Ghost): Mode {
      if (g.state === 'eyes' || g.state === 'entering') return 'eyes';
      if (g.frightened && s.frightenedMs > 0) return 'frightened';
      return s.schedule[s.phaseIdx].phase;
    }

    function ghostSpeed(g: Ghost): number {
      const base = PACMAN_SPEED * difficultyFor(s.level).ghostSpeedFactor;
      if (g.state === 'eyes' || g.state === 'entering') {
        return base * EYES_SPEED_FACTOR;
      }
      let sp = base;
      if (g.frightened && s.frightenedMs > 0) sp *= FRIGHTENED_SPEED_FACTOR;
      if (MAZE_INFO[s.mazeIndex].tunnelSet.has(cellAt(g.x, g.y))) {
        sp *= TUNNEL_SPEED_FACTOR;
      }
      return sp;
    }

    function ghostDecide(g: Ghost, cell: number) {
      const info = MAZE_INFO[s.mazeIndex];
      const m = info.parsed;

      if (g.state === 'eyes') {
        if (cell === info.blinkySpawn) {
          g.state = 'entering';
          g.dir = DOWN;
          g.x = cellCX(m.ghostHouse.door);
          return;
        }
        g.dir = nextDir(cell, g.dir, m.ghostHouse.door, m, false, Math.random);
        return;
      }

      const mode = ghostMode(g);
      if (mode === 'frightened') {
        g.dir = nextDir(cell, g.dir, cell, m, true, Math.random);
        return;
      }

      let target: number;
      if (mode === 'scatter') {
        target = scatterTarget(g.id, m);
      } else {
        TARGET_SCRATCH.pacmanCell = cellAt(s.pac.x, s.pac.y);
        TARGET_SCRATCH.pacmanDir = s.pac.dir;
        TARGET_SCRATCH.blinkyCell = cellAt(s.ghosts[0].x, s.ghosts[0].y);
        TARGET_SCRATCH.ghostCell = cell;
        target = chaseTarget(g.id, TARGET_SCRATCH);
      }
      g.dir = nextDir(cell, g.dir, target, m, false, Math.random);
    }

    let deciding: Ghost = s.ghosts[0];
    function decideCb(cell: number) {
      ghostDecide(deciding, cell);
    }

    // Frightened es un modo GLOBAL (spec 19): un fantasma que abandona la casa
    // con la fase azul en curso se incorpora a ella con el tiempo restante —
    // sale azul y comestible, no puede matar al jugador a mitad de power-pellet.
    // Se sincroniza tanto al arrancar la salida como al completarla, para cubrir
    // los dos órdenes posibles (power-pellet antes o durante el recorrido).
    // Excepción (comportamiento del arcade): el que YA fue comido en esta misma
    // fase azul re-sale en modo normal — salir azul otra vez permitiría farmear
    // la cadena comiéndose al mismo fantasma a valores crecientes.
    function syncFrightenedWithGlobal(g: Ghost) {
      g.frightened = s.frightenedMs > 0 && !g.eatenThisFright;
    }

    // Salida escalonada de la casa: recorrido guionizado (la puerta no existe
    // en `adjacency`, así que el pathfinding normal no puede atravesarla).
    function moveExiting(g: Ghost, dist: number) {
      const info = MAZE_INFO[s.mazeIndex];
      const doorX = cellCX(info.parsed.ghostHouse.door);
      const outY = cellCY(info.blinkySpawn);
      let left = dist;

      const dx = doorX - g.x;
      if (Math.abs(dx) > EPS) {
        g.dir = dx > 0 ? RIGHT : LEFT;
        const move = Math.min(left, Math.abs(dx));
        g.x += Math.sign(dx) * move;
        left -= move;
        if (Math.abs(doorX - g.x) <= EPS) g.x = doorX;
      }
      if (left > EPS && Math.abs(doorX - g.x) <= EPS) {
        g.dir = UP;
        const move = Math.min(left, g.y - outY);
        g.y -= move;
        if (g.y <= outY + EPS) {
          g.y = outY;
          g.state = 'out';
          g.dir = LEFT;
          syncFrightenedWithGlobal(g);
        }
      }
    }

    // Ojos entrando: bajada guionizada desde la celda sobre la puerta.
    function moveEntering(g: Ghost, dist: number) {
      const info = MAZE_INFO[s.mazeIndex];
      const inY = cellCY(info.houseCenter);
      g.x = cellCX(info.parsed.ghostHouse.door);
      g.dir = DOWN;
      g.y = Math.min(g.y + dist, inY);
      if (g.y >= inY - EPS) {
        g.y = inY;
        g.state = 'house';
        g.wantsExit = true;
        g.frightened = false;
      }
    }

    function someoneExiting(): boolean {
      for (let i = 0; i < s.ghosts.length; i++) {
        if (s.ghosts[i].state === 'exiting') return true;
      }
      return false;
    }

    function updateReleases(dtMs: number) {
      // Acumulador acotado (P3)
      s.releaseFallbackMs = Math.min(
        s.releaseFallbackMs + dtMs,
        GHOST_RELEASE_FALLBACK_MS,
      );
      if (someoneExiting()) return;

      // Un fantasma revivido tiene prioridad sobre la cola de salidas
      for (let i = 0; i < s.ghosts.length; i++) {
        const g = s.ghosts[i];
        if (g.state === 'house' && g.wantsExit) {
          g.state = 'exiting';
          g.wantsExit = false;
          syncFrightenedWithGlobal(g);
          return;
        }
      }

      if (s.releaseIdx >= RELEASE_ORDER.length) return;
      const id = RELEASE_ORDER[s.releaseIdx];
      // s.ghosts es [blinky, pinky, inky, clyde] y RELEASE_ORDER omite a
      // blinky (empieza fuera) → el índice de la cola desplaza en 1.
      const g = s.ghosts[s.releaseIdx + 1];
      if (g.state !== 'house') {
        s.releaseIdx++;
        return;
      }
      const ready =
        s.pelletsEaten >= GHOST_RELEASE_PELLETS[id] ||
        s.releaseFallbackMs >= GHOST_RELEASE_FALLBACK_MS;
      if (!ready) return;
      g.state = 'exiting';
      syncFrightenedWithGlobal(g);
      s.releaseIdx++;
      s.releaseFallbackMs = 0;
    }

    function forceReverse() {
      for (let i = 0; i < s.ghosts.length; i++) {
        const g = s.ghosts[i];
        if (g.state === 'out') g.dir = reverseOf(g.dir);
      }
    }

    function updateModes(dtMs: number) {
      if (s.frightenedMs > 0) {
        // El timer scatter/chase se pausa mientras dura frightened
        s.frightenedMs -= dtMs;
        if (s.frightenedMs <= 0) {
          s.frightenedMs = 0;
          for (let i = 0; i < s.ghosts.length; i++) {
            s.ghosts[i].frightened = false;
            s.ghosts[i].eatenThisFright = false;
          }
        }
        return;
      }
      const phase = s.schedule[s.phaseIdx];
      if (phase.durationMs === Infinity) return; // chase permanente: sin acumular (P3)
      s.phaseMs += dtMs;
      if (s.phaseMs >= phase.durationMs) {
        s.phaseMs = 0;
        s.phaseIdx = Math.min(s.phaseIdx + 1, s.schedule.length - 1);
        forceReverse();
      }
    }

    function startFrightened() {
      forceReverse();
      s.chainIdx = 0;
      // Fase azul nueva: el historial de comidos de la anterior se borra
      for (let i = 0; i < s.ghosts.length; i++) {
        s.ghosts[i].eatenThisFright = false;
      }
      const frightenedS = difficultyFor(s.level).frightenedS;
      if (frightenedS <= 0) return; // nivel ≥12: solo reversa, sin fase azul
      s.frightenedMs = frightenedS * 1000;
      for (let i = 0; i < s.ghosts.length; i++) {
        const g = s.ghosts[i];
        if (g.state === 'out') g.frightened = true;
      }
    }

    // ── Consumo ─────────────────────────────────────────────────────────────
    function consume(now: number) {
      const cell = cellAt(s.pac.x, s.pac.y);

      if (s.pellets.delete(cell)) {
        s.score += PELLET_POINTS;
        s.pelletsEaten++;
        s.releaseFallbackMs = 0;
        playPellet(now);
        if (
          s.fruitIndex < FRUIT_TRIGGER_PELLETS.length &&
          s.pelletsEaten >= FRUIT_TRIGGER_PELLETS[s.fruitIndex]
        ) {
          s.fruitIndex++;
          s.fruitMs = FRUIT_DURATION_MS;
        }
      } else if (s.powerPellets.delete(cell)) {
        s.score += POWER_PELLET_POINTS;
        s.pelletsEaten++;
        s.releaseFallbackMs = 0;
        playBonus();
        startFrightened();
      }

      if (s.fruitMs > 0 && cell === MAZE_INFO[s.mazeIndex].parsed.fruitCell) {
        s.fruitMs = 0;
        s.score += FRUIT_POINTS_PER_LEVEL * s.level;
        playBonus();
      }
    }

    function die() {
      playBreak();
      s.lives -= 1;
      s.frightenedMs = 0;
      s.fruitMs = 0;
      report(); // onLivesChange(0) siempre antes de onGameOver
      if (s.lives <= 0) {
        s.over = true;
        if (!endFired) {
          endFired = true;
          onGameOver(s.score);
        }
        return;
      }
      s.deathMs = DEATH_PAUSE_MS;
    }

    function checkCollisions() {
      for (let i = 0; i < s.ghosts.length; i++) {
        const g = s.ghosts[i];
        if (g.state === 'eyes' || g.state === 'entering') continue;
        if (g.state === 'house') continue;

        let dx = g.x - s.pac.x;
        if (dx > MAZE_W / 2) dx -= MAZE_W;
        else if (dx < -MAZE_W / 2) dx += MAZE_W;
        const dy = g.y - s.pac.y;
        if (dx * dx + dy * dy > COLLISION_DIST * COLLISION_DIST) continue;

        if (g.frightened && s.frightenedMs > 0) {
          s.score +=
            GHOST_CHAIN_POINTS[
              Math.min(s.chainIdx, GHOST_CHAIN_POINTS.length - 1)
            ];
          s.chainIdx++;
          g.frightened = false;
          g.eatenThisFright = true;
          // Comido durante la salida: ya está sobre la columna de la puerta, así
          // que baja directo. `eyes` navegaría con `adjacency`, que en la celda
          // de la puerta no tiene salidas.
          g.state = g.state === 'exiting' ? 'entering' : 'eyes';
          playBreak();
          continue;
        }
        die();
        return;
      }
    }

    // ── Update ──────────────────────────────────────────────────────────────
    function update(dtMs: number, now: number) {
      // Timers de animación acotados por módulo (P3)
      s.blinkMs = (s.blinkMs + dtMs) % POWER_BLINK_MS;
      s.bobMs = (s.bobMs + dtMs) % HOUSE_BOB_MS;

      if (s.clearMs > 0) {
        s.clearMs -= dtMs;
        if (s.clearMs <= 0) {
          s.clearMs = 0;
          loadLevel(s, s.level + 1);
          report();
        }
        return;
      }

      if (s.deathMs > 0) {
        s.deathMs -= dtMs;
        if (s.deathMs <= 0) {
          s.deathMs = 0;
          placeEntities(s);
          s.readyMs = LEVEL_BANNER_MS;
        }
        return;
      }

      if (s.readyMs > 0) {
        s.readyMs -= dtMs;
        if (s.readyMs <= 0) s.readyMs = 0;
        return;
      }

      const m = MAZE_INFO[s.mazeIndex].parsed;
      const dt = dtMs / 1000;

      s.pac.mouthMs = (s.pac.mouthMs + dtMs) % MOUTH_PERIOD_MS;
      tryTurn(cellAt(s.pac.x, s.pac.y));
      stepEntity(s.pac, PACMAN_SPEED * dt, m, tryTurn);

      consume(now);

      if (s.pellets.size === 0 && s.powerPellets.size === 0) {
        s.clearMs = LEVEL_BANNER_MS;
        report();
        return;
      }

      updateModes(dtMs);
      updateReleases(dtMs);

      for (let i = 0; i < s.ghosts.length; i++) {
        const g = s.ghosts[i];
        const dist = ghostSpeed(g) * dt;
        if (g.state === 'exiting') moveExiting(g, dist);
        else if (g.state === 'entering') moveEntering(g, dist);
        else if (g.state !== 'house') {
          // Callback estable + variable de captura: sin closures nuevas por
          // frame dentro del RAF (P1).
          deciding = g;
          stepEntity(g, dist, m, decideCb);
        }
      }

      if (s.fruitMs > 0) {
        s.fruitMs = Math.max(0, s.fruitMs - dtMs);
      }

      checkCollisions();
      report();
    }

    // ── Laberinto pre-renderizado (P7) ──────────────────────────────────────
    let wallCanvas: HTMLCanvasElement | null = null;
    let wallMaze = -1;
    let wallSkin: Skin | null = null;

    function wallLayer(): HTMLCanvasElement {
      const skin = skinRef.current;
      if (wallCanvas === null) {
        wallCanvas = document.createElement('canvas');
        wallCanvas.width = MAZE_W;
        wallCanvas.height = MAZE_H;
      }
      // Invalidación por identidad (sin construir claves por frame — P1):
      // solo se repinta al rotar de maze o al cambiar de skin.
      if (wallMaze !== s.mazeIndex || wallSkin !== skin) {
        const wctx = wallCanvas.getContext('2d')!;
        wctx.clearRect(0, 0, MAZE_W, MAZE_H);
        skin.drawWalls(wctx, MAZE_INFO[s.mazeIndex].parsed);
        wallMaze = s.mazeIndex;
        wallSkin = skin;
      }
      return wallCanvas;
    }

    // ── Draw ────────────────────────────────────────────────────────────────
    function draw() {
      const skin = skinRef.current;
      const info = MAZE_INFO[s.mazeIndex];

      ctx.fillStyle = skin.bg;
      ctx.fillRect(0, 0, W, H);

      ctx.drawImage(wallLayer(), 0, MAZE_Y);

      // Pellets vivos (coste decreciente durante el nivel)
      ctx.fillStyle = skin.pellet;
      for (const cell of s.pellets) {
        ctx.fillRect(cellCX(cell) - 1.5, MAZE_Y + cellCY(cell) - 1.5, 3, 3);
      }

      if (s.blinkMs < POWER_BLINK_MS / 2) {
        ctx.fillStyle = skin.powerPellet;
        for (const cell of s.powerPellets) {
          ctx.beginPath();
          ctx.arc(cellCX(cell), MAZE_Y + cellCY(cell), 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (s.fruitMs > 0) {
        skin.drawFruit(
          ctx,
          cellCX(info.parsed.fruitCell),
          MAZE_Y + cellCY(info.parsed.fruitCell),
          1,
        );
      }

      // Pac-Man
      const dying = s.deathMs > 0;
      const openT = s.pac.mouthMs / MOUTH_PERIOD_MS;
      const open = dying ? 1 : Math.abs(1 - 2 * openT);
      const radius = dying ? (s.deathMs / DEATH_PAUSE_MS) * 7 : 7;
      skin.drawPacman(ctx, s.pac.x, MAZE_Y + s.pac.y, s.pac.dir, open, radius);

      // Fantasmas
      const flashing =
        s.frightenedMs > 0 &&
        s.frightenedMs <= FRIGHTENED_FLASH_MS &&
        Math.floor(s.frightenedMs / FRIGHT_FLASH_PERIOD_MS) % 2 === 0;
      for (let i = 0; i < s.ghosts.length && !dying; i++) {
        const g = s.ghosts[i];
        const bob =
          g.state === 'house'
            ? Math.sin((s.bobMs / HOUSE_BOB_MS) * Math.PI * 2) * 3
            : 0;
        skin.drawGhost(
          ctx,
          g.x,
          MAZE_Y + g.y + bob,
          g.id,
          g.dir,
          ghostMode(g),
          flashing,
        );
      }

      drawHud(skin);

      if (s.readyMs > 0) {
        drawBanner(skin, 'READY!');
      } else if (s.clearMs > 0) {
        drawBanner(skin, `¡NIVEL ${s.level + 1}!`);
      }
    }

    function drawHud(skin: Skin) {
      ctx.font = 'bold 14px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = skin.hud;
      ctx.textAlign = 'left';
      ctx.fillText(`PUNTOS ${s.score}`, 10, HUD_BAND_H / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = skin.hudAccent;
      ctx.fillText(`NIVEL ${s.level}`, W - 10, HUD_BAND_H / 2);

      const bandY = MAZE_Y + MAZE_H + HUD_BAND_H / 2;
      for (let i = 0; i < s.lives; i++) {
        skin.drawPacman(ctx, 18 + i * 22, bandY, RIGHT, 0.6, 7);
      }
      if (s.fruitMs > 0) {
        skin.drawFruit(ctx, W - 24, bandY, 1.1);
        ctx.textAlign = 'right';
        ctx.fillStyle = skin.hud;
        ctx.fillText(`${FRUIT_POINTS_PER_LEVEL * s.level}`, W - 40, bandY);
      }
    }

    function drawBanner(skin: Skin, text: string) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = skin.banner;
      ctx.font = 'bold 26px monospace';
      ctx.fillText(text, W / 2, MAZE_Y + MAZE_H * 0.62);
    }

    // ── Loop ────────────────────────────────────────────────────────────────
    let rafId = 0;
    let last = performance.now();
    let pauseDrawn = false;
    let overDrawn = false;

    function loop(ts: number) {
      const dtMs = Math.min(ts - last, 50);
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

      update(dtMs, ts);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    // ── Teclado ─────────────────────────────────────────────────────────────
    function handleKeyDown(e: KeyboardEvent) {
      // El modal de guardado de la play-page vive sobre el canvas montado: sin
      // esta guarda, el preventDefault de WASD se comería las letras al
      // escribir el nombre del jugador.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const dir = KEY_DIRS[e.key.toLowerCase()];
      if (dir === undefined) return;
      e.preventDefault();
      s.pac.desired = dir; // buffer: se aplica en cuanto el giro es legal
    }

    document.addEventListener('keydown', handleKeyDown);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
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

export default React.memo(PacmanGame);
