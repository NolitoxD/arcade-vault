import {
  CANNON_X,
  CANNON_Y,
  D,
  PLAY_W,
  R,
  ROW0_Y,
  cellX,
  cellY,
  colOf,
  idx,
  neighbors,
  pixelToCell,
  rowOf,
  type Board,
} from './grid';

export const SHOT_SPEED = 1000; // px/s
export const SUBSTEP_MAX = 8; // px per sub-step
export const MAX_BOUNCES = 12;
export const ANGLE_MIN = (12 * Math.PI) / 180;
export const ANGLE_MAX = (168 * Math.PI) / 180;
export const AIM_SPEED = (75 * Math.PI) / 180; // rad/s while held
export const AIM_STEP = (1.5 * Math.PI) / 180; // short tap on mobile
export const FLYING = -1;

// Touching distance between two bubble centers, squared: (2R)^2 === D^2.
const HIT_D2 = D * D;

export type Shot = {
  px: number;
  py: number;
  vx: number;
  vy: number;
  color: number;
  magic: number;
  bounces: number;
  live: boolean;
};

// Scratch buffers reused across calls so hot paths (stepShot, firstHit) never allocate.
const PC = new Int16Array(2);
const NB_HIT = new Int16Array(6);
const NB_A = new Int16Array(6);
const NB_B = new Int16Array(6);

export function createShot(): Shot {
  return {
    px: CANNON_X,
    py: CANNON_Y,
    vx: 0,
    vy: 0,
    color: 0,
    magic: 0,
    bounces: 0,
    live: false,
  };
}

export function clampAngle(a: number): number {
  if (a < ANGLE_MIN) return ANGLE_MIN;
  if (a > ANGLE_MAX) return ANGLE_MAX;
  return a;
}

export function fire(s: Shot, angle: number, color: number, magic: number): void {
  const a = clampAngle(angle);
  s.px = CANNON_X;
  s.py = CANNON_Y;
  s.vx = SHOT_SPEED * Math.cos(a);
  s.vy = -SHOT_SPEED * Math.sin(a);
  s.color = color;
  s.magic = magic;
  s.bounces = 0;
  s.live = true;
}

// Finds the occupied cell touching (px, py), searching only the cell under the
// point and its up to 6 neighbours (never the whole board). Returns -1 if none.
export function firstHit(b: Board, px: number, py: number): number {
  pixelToCell(px, py, b.parity, PC);
  const r = PC[0];
  const c = PC[1];

  let best = -1;
  let bestD = Infinity;

  const under = idx(r, c);
  if (b.color[under] !== 0) {
    const dx = px - cellX(r, c, b.parity);
    const dy = py - cellY(r);
    const d = dx * dx + dy * dy;
    if (d <= HIT_D2) {
      best = under;
      bestD = d;
    }
  }

  const n = neighbors(r, c, b.parity, NB_HIT);
  for (let i = 0; i < n; i++) {
    const cell = NB_HIT[i];
    if (b.color[cell] === 0) continue;
    const rr = rowOf(cell);
    const cc = colOf(cell);
    const dx = px - cellX(rr, cc, b.parity);
    const dy = py - cellY(rr);
    const d = dx * dx + dy * dy;
    if (d <= HIT_D2 && d < bestD) {
      bestD = d;
      best = cell;
    }
  }

  return best;
}

// Picks a free cell to anchor at, given the impact point and the occupied cell
// it touched (or -1 when anchoring on the roof with nothing hit yet).
// Candidates: the cell under the point, then the neighbours of `hit`; if all
// of those are occupied, falls back to ring 2 (neighbours of neighbours).
export function anchorCell(b: Board, px: number, py: number, hit: number): number {
  pixelToCell(px, py, b.parity, PC);
  const ur = PC[0];
  const uc = PC[1];
  const under = idx(ur, uc);

  let best = -1;
  let bestD = Infinity;

  if (b.color[under] === 0) {
    const dx = px - cellX(ur, uc, b.parity);
    const dy = py - cellY(ur);
    bestD = dx * dx + dy * dy;
    best = under;
  }

  if (hit >= 0) {
    const n = neighbors(rowOf(hit), colOf(hit), b.parity, NB_A);
    for (let i = 0; i < n; i++) {
      const cell = NB_A[i];
      if (b.color[cell] !== 0) continue;
      const rr = rowOf(cell);
      const cc = colOf(cell);
      const dx = px - cellX(rr, cc, b.parity);
      const dy = py - cellY(rr);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = cell;
      }
    }
  }

  if (best >= 0) return best;

  const center = hit >= 0 ? hit : under;
  const n1 = neighbors(rowOf(center), colOf(center), b.parity, NB_A);
  for (let i = 0; i < n1; i++) {
    const n2 = neighbors(rowOf(NB_A[i]), colOf(NB_A[i]), b.parity, NB_B);
    for (let j = 0; j < n2; j++) {
      const cell = NB_B[j];
      if (b.color[cell] !== 0) continue;
      const rr = rowOf(cell);
      const cc = colOf(cell);
      const dx = px - cellX(rr, cc, b.parity);
      const dy = py - cellY(rr);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = cell;
      }
    }
  }

  return best;
}

/**
 * Advances the shot by `dtMs`, split into sub-steps of at most SUBSTEP_MAX px
 * so it can never tunnel through a bubble. The caller MUST cap `dtMs` to the
 * render loop's frame budget (e.g. `Math.min(dt, 50)`) before calling this —
 * that cap is a precondition, not an implementation detail: at SHOT_SPEED,
 * an uncapped dt could require more sub-steps than this function is sized for.
 *
 * Each sub-step runs, in order: (a) advance position, (b) side-wall bounce,
 * (c) roof anchor, (d) bubble collision. Returns FLYING while still moving,
 * or the board index to anchor at once it stops. Does not write to `b` —
 * that is the caller's (run.ts) responsibility.
 */
export function stepShot(b: Board, s: Shot, dtMs: number): number {
  const dtSec = dtMs / 1000;
  const n = Math.max(1, Math.ceil((SHOT_SPEED * dtSec) / SUBSTEP_MAX));
  const subDt = dtSec / n;

  for (let step = 0; step < n; step++) {
    // (a) advance
    s.px += s.vx * subDt;
    s.py += s.vy * subDt;

    // (b) side walls — reflect position AND velocity so the next sub-step
    // does not read a still out-of-bounds px and bounce again.
    let bounced = false;
    if (s.px < R) {
      s.px = 2 * R - s.px;
      s.vx = -s.vx;
      bounced = true;
    } else if (s.px > PLAY_W - R) {
      s.px = 2 * (PLAY_W - R) - s.px;
      s.vx = -s.vx;
      bounced = true;
    }
    if (bounced) {
      s.bounces++;
      if (s.bounces > MAX_BOUNCES) {
        const hit = firstHit(b, s.px, s.py);
        const cell = anchorCell(b, s.px, s.py, hit);
        s.live = false;
        return cell;
      }
    }

    // (c) roof
    if (s.py <= ROW0_Y) {
      s.py = ROW0_Y;
      const hit = firstHit(b, s.px, s.py);
      const cell = anchorCell(b, s.px, s.py, hit);
      s.live = false;
      return cell;
    }

    // (d) bubble collision
    const hit = firstHit(b, s.px, s.py);
    if (hit >= 0) {
      const cell = anchorCell(b, s.px, s.py, hit);
      s.live = false;
      return cell;
    }
  }

  return FLYING;
}

const SIM_SHOT: Shot = createShot();

// Fast-forwards a shot from the cannon to its landing cell, on a scratch
// module-level Shot so callers (previews, tests) never allocate. Never
// mutates the board.
export function simulateShot(b: Board, angle: number): number {
  fire(SIM_SHOT, angle, 1, 0);
  let anchored = FLYING;
  for (let i = 0; i < 2000 && anchored === FLYING; i++) {
    anchored = stepShot(b, SIM_SHOT, 16.667);
  }
  return anchored;
}

// Writes the straight-line aim preview from the cannon up to (and including)
// the first side-wall bounce or the roof, whichever comes first. Returns the
// number of (x, y) points written into `out` (at most `maxPts`).
export function traceShot(b: Board, angle: number, out: Float32Array, maxPts: number): number {
  const a = clampAngle(angle);
  const vx = SHOT_SPEED * Math.cos(a);
  const vy = -SHOT_SPEED * Math.sin(a);

  out[0] = CANNON_X;
  out[1] = CANNON_Y;
  let n = 1;

  let tWall = Infinity;
  if (vx < 0) tWall = (R - CANNON_X) / vx;
  else if (vx > 0) tWall = (PLAY_W - R - CANNON_X) / vx;

  let tRoof = Infinity;
  if (vy < 0) tRoof = (ROW0_Y - CANNON_Y) / vy;

  const t = Math.min(tWall, tRoof);
  if (n < maxPts) {
    out[n * 2] = CANNON_X + vx * t;
    out[n * 2 + 1] = CANNON_Y + vy * t;
    n++;
  }

  return n;
}
