'use client';

import React, { useEffect, useRef } from 'react';

interface PongGameProps {
  paused: boolean;
  mode: 'solo' | 'versus';
  skinKey?: string;
  fastBall?: boolean;
  smallPaddles?: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onMatchEnd?: (winner: 1 | 2, score1: number, score2: number) => void;
  onVersusScoreChange?: (score1: number, score2: number) => void;
}

// ── Skin system ───────────────────────────────────────────────────────────────

type Skin = {
  name: string;
  boardBg: string;
  netColor: string;
  hudColor: string;
  drawPaddle: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    isLeft: boolean,
  ) => void;
  drawBall: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
  ) => void;
};

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'Classic',
    boardBg: '#05070d',
    netColor: 'rgba(232,240,255,0.35)',
    hudColor: 'rgba(232,240,255,0.85)',
    drawPaddle(ctx, x, y, w, h) {
      ctx.fillStyle = '#e8f0ff';
      ctx.fillRect(x, y, w, h);
    },
    drawBall(ctx, x, y, size) {
      ctx.fillStyle = '#e8f0ff';
      ctx.fillRect(x, y, size, size);
    },
  },
  retro: {
    name: 'Retro',
    boardBg: '#151004',
    netColor: 'rgba(255,196,102,0.35)',
    hudColor: 'rgba(255,214,138,0.9)',
    drawPaddle(ctx, x, y, w, h) {
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(x, y, w, h);
      // CRT highlight strip (4px at top)
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, w, 4);
    },
    drawBall(ctx, x, y, size) {
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, size, 3);
    },
  },
  neon: {
    name: 'Neon',
    boardBg: '#000000',
    netColor: 'rgba(0,245,255,0.45)',
    hudColor: '#00ffcc',
    drawPaddle(ctx, x, y, w, h, isLeft) {
      const color = isLeft ? '#00f5ff' : '#ff00e0';
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.fillStyle = isLeft
        ? 'rgba(0,245,255,0.5)'
        : 'rgba(255,0,224,0.5)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.shadowBlur = 0;
    },
    drawBall(ctx, x, y, size) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#ffff00';
      ctx.fillStyle = 'rgba(255,255,0,0.6)';
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
      ctx.shadowBlur = 0;
    },
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 800;
const H = 600;
const PADDLE_W = 14;
const PADDLE_H = 96;
const PADDLE_MARGIN = 26;
const PADDLE_SPEED = 430;
const BALL_SIZE = 14;
const BASE_BALL_SPEED = 330;
const LEVEL_BALL_SPEED_INC = 35;
const MAX_BALL_SPEED = 880;
const RALLY_ACCEL = 1.045;
const MAX_BOUNCE_ANGLE = Math.PI / 3;
const SERVE_DELAY_MS = 1000;
const START_LIVES = 3;
const POINTS_PER_LEVEL = 2;
const RALLY_POINTS = 10;
const GOAL_POINTS = 100;
const VERSUS_TARGET = 7;
const CPU_BASE_SPEED = 250;
const CPU_SPEED_PER_LEVEL = 32;
const CPU_MAX_SPEED = 620;
const CPU_BASE_DEADZONE = 42;
const CPU_DEADZONE_DEC = 5;
const CPU_MIN_DEADZONE = 12;
const FAST_BALL_MULTIPLIER = 1.35;
const SMALL_PADDLE_SCALE = 0.6;

const DASH_NET: number[] = [14, 12];
const DASH_CLEAR: number[] = [];

type PaddleAction = 'p1Up' | 'p1Down' | 'p2Up' | 'p2Down';

const SOLO_KEYS: Record<string, PaddleAction> = {
  arrowup: 'p1Up',
  w: 'p1Up',
  arrowdown: 'p1Down',
  s: 'p1Down',
};

const VERSUS_KEYS: Record<string, PaddleAction> = {
  w: 'p1Up',
  s: 'p1Down',
  arrowup: 'p2Up',
  arrowdown: 'p2Down',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameState {
  leftY: number;
  rightY: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  speed: number;
  serveTimer: number;
  score: number;
  lives: number;
  level: number;
  pointsWon: number;
  score1: number;
  score2: number;
  over: boolean;
}

function initialState(): GameState {
  return {
    leftY: (H - PADDLE_H) / 2,
    rightY: (H - PADDLE_H) / 2,
    ballX: (W - BALL_SIZE) / 2,
    ballY: (H - BALL_SIZE) / 2,
    vx: 0,
    vy: 0,
    speed: BASE_BALL_SPEED,
    serveTimer: SERVE_DELAY_MS,
    score: 0,
    lives: START_LIVES,
    level: 1,
    pointsWon: 0,
    score1: 0,
    score2: 0,
    over: false,
  };
}

function baseSpeed(level: number): number {
  return BASE_BALL_SPEED + (level - 1) * LEVEL_BALL_SPEED_INC;
}

// ── Component ─────────────────────────────────────────────────────────────────

function PongGame({
  paused,
  mode,
  skinKey = 'classic',
  fastBall = false,
  smallPaddles = false,
  onScoreChange,
  onLevelChange,
  onLivesChange,
  onGameOver,
  onMatchEnd,
  onVersusScoreChange,
}: PongGameProps) {
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
    const isVersus = mode === 'versus';
    const keyActions = isVersus ? VERSUS_KEYS : SOLO_KEYS;
    const speedScale = fastBall ? FAST_BALL_MULTIPLIER : 1;
    const maxBallSpeed = MAX_BALL_SPEED * speedScale;
    const paddleH = smallPaddles
      ? Math.round(PADDLE_H * SMALL_PADDLE_SCALE)
      : PADDLE_H;
    s.leftY = (H - paddleH) / 2;
    s.rightY = (H - paddleH) / 2;

    const keys: Record<PaddleAction, boolean> = {
      p1Up: false,
      p1Down: false,
      p2Up: false,
      p2Down: false,
    };

    // Reported-value trackers so callbacks only fire on change
    let reportedScore = 0;
    let reportedLevel = 1;
    let reportedLives = START_LIVES;
    let endFired = false;

    // ── Audio ───────────────────────────────────────────────────────────────
    const bounceSound = new Audio('/ball-bounce.mp3');
    const breakSound = new Audio('/break-sound.mp3');

    function playBounce() {
      try {
        (bounceSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }
    function playBreak() {
      try {
        (breakSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
      } catch {}
    }

    // ── Serve ───────────────────────────────────────────────────────────────
    function serve(dir: 1 | -1) {
      s.speed = (isVersus ? BASE_BALL_SPEED : baseSpeed(s.level)) * speedScale;
      const angle = (Math.random() * 2 - 1) * (Math.PI / 6);
      s.ballX = (W - BALL_SIZE) / 2;
      s.ballY = (H - BALL_SIZE) / 2;
      s.vx = Math.cos(angle) * s.speed * dir;
      s.vy = Math.sin(angle) * s.speed;
      s.serveTimer = SERVE_DELAY_MS;
    }

    // ── Scoring ─────────────────────────────────────────────────────────────
    function reportSolo() {
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

    function pointScored(scorer: 1 | 2) {
      playBreak();
      if (isVersus) {
        if (scorer === 1) s.score1 += 1;
        else s.score2 += 1;
        onVersusScoreChange?.(s.score1, s.score2);
        if (s.score1 >= VERSUS_TARGET || s.score2 >= VERSUS_TARGET) {
          s.over = true;
          if (!endFired) {
            endFired = true;
            onMatchEnd?.(scorer, s.score1, s.score2);
          }
          return;
        }
        serve(scorer === 1 ? 1 : -1);
        return;
      }
      if (scorer === 1) {
        s.score += GOAL_POINTS * s.level;
        s.pointsWon += 1;
        s.level = Math.floor(s.pointsWon / POINTS_PER_LEVEL) + 1;
        reportSolo();
        serve(1);
      } else {
        s.lives -= 1;
        reportSolo();
        if (s.lives <= 0) {
          s.over = true;
          if (!endFired) {
            endFired = true;
            onGameOver(s.score);
          }
          return;
        }
        serve(-1);
      }
    }

    // ── Paddle collision (swept on X to avoid tunneling) ────────────────────
    function hitPaddle(prevX: number, prevY: number, isLeft: boolean): boolean {
      const paddleY = isLeft ? s.leftY : s.rightY;
      const face = isLeft
        ? PADDLE_MARGIN + PADDLE_W
        : W - PADDLE_MARGIN - PADDLE_W;
      const edgePrev = isLeft ? prevX : prevX + BALL_SIZE;
      const edgeNow = isLeft ? s.ballX : s.ballX + BALL_SIZE;
      const crossed = isLeft
        ? s.vx < 0 && edgePrev >= face && edgeNow <= face
        : s.vx > 0 && edgePrev <= face && edgeNow >= face;
      if (!crossed) return false;

      const t = edgePrev === edgeNow ? 0 : (edgePrev - face) / (edgePrev - edgeNow);
      const yAtCross = prevY + (s.ballY - prevY) * t;
      if (yAtCross + BALL_SIZE < paddleY || yAtCross > paddleY + paddleH)
        return false;

      const rel = Math.max(
        -1,
        Math.min(
          1,
          (yAtCross + BALL_SIZE / 2 - (paddleY + paddleH / 2)) /
            (paddleH / 2),
        ),
      );
      const angle = rel * MAX_BOUNCE_ANGLE;
      s.speed = Math.min(s.speed * RALLY_ACCEL, maxBallSpeed);
      s.vx = Math.cos(angle) * s.speed * (isLeft ? 1 : -1);
      s.vy = Math.sin(angle) * s.speed;
      s.ballX = isLeft ? face : face - BALL_SIZE;
      s.ballY = yAtCross;
      playBounce();

      if (!isVersus && isLeft) {
        s.score += RALLY_POINTS * s.level;
        reportSolo();
      }
      return true;
    }

    // ── Update ──────────────────────────────────────────────────────────────
    function update(dt: number) {
      if (keys.p1Up) s.leftY -= PADDLE_SPEED * dt;
      if (keys.p1Down) s.leftY += PADDLE_SPEED * dt;
      s.leftY = Math.max(0, Math.min(H - paddleH, s.leftY));

      if (isVersus) {
        if (keys.p2Up) s.rightY -= PADDLE_SPEED * dt;
        if (keys.p2Down) s.rightY += PADDLE_SPEED * dt;
        s.rightY = Math.max(0, Math.min(H - paddleH, s.rightY));
      } else {
        const cpuSpeed = Math.min(
          CPU_BASE_SPEED + (s.level - 1) * CPU_SPEED_PER_LEVEL,
          CPU_MAX_SPEED,
        );
        const deadzone = Math.max(
          CPU_MIN_DEADZONE,
          CPU_BASE_DEADZONE - (s.level - 1) * CPU_DEADZONE_DEC,
        );
        const diff = s.ballY + BALL_SIZE / 2 - (s.rightY + paddleH / 2);
        if (Math.abs(diff) > deadzone) {
          const step = Math.min(cpuSpeed * dt, Math.abs(diff) - deadzone);
          s.rightY += diff > 0 ? step : -step;
        }
        s.rightY = Math.max(0, Math.min(H - paddleH, s.rightY));
      }

      if (s.serveTimer > 0) {
        s.serveTimer = Math.max(0, s.serveTimer - dt * 1000);
        return;
      }

      const prevX = s.ballX;
      const prevY = s.ballY;
      s.ballX += s.vx * dt;
      s.ballY += s.vy * dt;

      if (s.ballY < 0) {
        s.ballY = -s.ballY;
        s.vy = -s.vy;
        playBounce();
      } else if (s.ballY + BALL_SIZE > H) {
        s.ballY = 2 * (H - BALL_SIZE) - s.ballY;
        s.vy = -s.vy;
        playBounce();
      }

      if (!hitPaddle(prevX, prevY, true)) hitPaddle(prevX, prevY, false);

      if (s.ballX + BALL_SIZE < 0) {
        pointScored(2);
      } else if (s.ballX > W) {
        pointScored(1);
      }
    }

    // ── Draw ────────────────────────────────────────────────────────────────
    function draw() {
      const skin = skinRef.current;

      ctx.fillStyle = skin.boardBg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = skin.netColor;
      ctx.lineWidth = 4;
      ctx.setLineDash(DASH_NET);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash(DASH_CLEAR);

      skin.drawPaddle(ctx, PADDLE_MARGIN, s.leftY, PADDLE_W, paddleH, true);
      skin.drawPaddle(
        ctx,
        W - PADDLE_MARGIN - PADDLE_W,
        s.rightY,
        PADDLE_W,
        paddleH,
        false,
      );
      skin.drawBall(ctx, s.ballX, s.ballY, BALL_SIZE);

      ctx.fillStyle = skin.hudColor;
      ctx.textBaseline = 'middle';
      if (isVersus) {
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${s.score1}  –  ${s.score2}`, W / 2, 28);
      } else {
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE  ${String(s.score).padStart(6, '0')}`, 16, 22);
        ctx.textAlign = 'right';
        ctx.fillText(`LEVEL  ${String(s.level).padStart(2, '0')}`, W - 16, 22);
      }
      ctx.textAlign = 'left';
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
      const action = keyActions[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      keys[action] = true;
    }
    function handleKeyUp(e: KeyboardEvent) {
      const action = keyActions[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      keys[action] = false;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    serve(Math.random() < 0.5 ? 1 : -1);
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

export default React.memo(PongGame);
