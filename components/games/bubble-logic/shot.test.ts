import { describe, expect, it } from 'vitest';
import {
  CELLS, COLS, PLAY_W, R, cellX, cellY, colOf, createBoard, idx, neighbors, rowOf,
} from './grid';
import {
  ANGLE_MAX, ANGLE_MIN, FLYING, MAX_BOUNCES, anchorCell, clampAngle, createShot,
  fire, firstHit, simulateShot, stepShot, traceShot,
} from './shot';

const nb = new Int16Array(6);
const D2R = (d: number) => (d * Math.PI) / 180;

function isNeighbourOfOccupied(b: ReturnType<typeof createBoard>, cell: number): boolean {
  const n = neighbors(rowOf(cell), colOf(cell), b.parity, nb);
  for (let k = 0; k < n; k++) if (b.color[nb[k]] !== 0) return true;
  return false;
}

describe('aiming', () => {
  it('clamps the angle to the legal cone', () => {
    expect(clampAngle(D2R(90))).toBeCloseTo(D2R(90), 9);
    expect(clampAngle(D2R(2))).toBeCloseTo(ANGLE_MIN, 9);
    expect(clampAngle(D2R(179))).toBeCloseTo(ANGLE_MAX, 9);
  });
});

describe('substepping', () => {
  it('never tunnels through a bubble at the worst legal dt', () => {
    const b = createBoard();
    b.color[idx(8, 5)] = 1;                     // justo encima del cañón
    const s = createShot();
    fire(s, D2R(90), 2, 0);
    let anchored = FLYING;
    for (let i = 0; i < 200 && anchored === FLYING; i++) anchored = stepShot(b, s, 50);
    expect(anchored).not.toBe(FLYING);
    expect(b.color[anchored]).toBe(0);          // stepShot no escribe en el board
    expect(anchored).not.toBe(idx(8, 5));
    expect(isNeighbourOfOccupied(b, anchored)).toBe(true);
  });

  it('stops below a solid wall of bubbles at every legal frame length', () => {
    const run = (dt: number) => {
      const b = createBoard();
      for (let c = 0; c < COLS; c++) b.color[idx(6, c)] = 1;   // muro macizo en la fila 6
      const s = createShot();
      fire(s, D2R(90), 2, 0);
      let a = FLYING;
      for (let i = 0; i < 400 && a === FLYING; i++) a = stepShot(b, s, dt);
      return a;
    };
    for (const dt of [16.667, 33.334, 50]) {
      const cell = run(dt);
      expect({ dt, row: rowOf(cell) }).toEqual({ dt, row: 7 });   // nunca por encima del muro
    }
  });
});

describe('wall bounces', () => {
  it('reflects position as well as velocity, so it never double-bounces', () => {
    const b = createBoard();
    const s = createShot();
    fire(s, ANGLE_MAX, 1, 0);                   // casi horizontal a la izquierda
    let a = FLYING, bounces = 0;
    for (let i = 0; i < 400 && a === FLYING; i++) {
      const before = s.bounces;
      a = stepShot(b, s, 16.667);
      if (s.bounces !== before) bounces++;
      expect(s.px).toBeGreaterThanOrEqual(R - 1e-6);
      expect(s.px).toBeLessThanOrEqual(PLAY_W - R + 1e-6);
    }
    expect(bounces).toBeGreaterThan(0);
  });

  it('always terminates, even at the shallowest legal angle', () => {
    const b = createBoard();
    const s = createShot();
    fire(s, ANGLE_MIN, 1, 0);
    let a = FLYING;
    for (let i = 0; i < 2000 && a === FLYING; i++) a = stepShot(b, s, 16.667);
    expect(a).not.toBe(FLYING);
    expect(s.bounces).toBeLessThanOrEqual(MAX_BOUNCES + 1);
  });

  it('anchors on row 0 when it reaches the roof unobstructed', () => {
    const b = createBoard();
    expect(rowOf(simulateShot(b, D2R(90)))).toBe(0);
  });
});

describe('anchor invariant', () => {
  it('always picks a free cell that touches an occupied one or sits on row 0', () => {
    for (let occupied = 0; occupied < CELLS; occupied++) {
      const b = createBoard();
      b.color[occupied] = 1;
      for (let deg = 15; deg <= 165; deg += 5) {
        const cell = simulateShot(b, D2R(deg));
        if (cell < 0) continue;
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(CELLS);
        expect(b.color[cell]).toBe(0);
        expect(rowOf(cell) === 0 || isNeighbourOfOccupied(b, cell)).toBe(true);
      }
    }
  });

  it('never returns an occupied cell even when the neighbourhood is packed', () => {
    const b = createBoard();
    for (let i = 0; i < COLS * 3; i++) b.color[i] = 1;
    b.color[idx(2, 5)] = 0;
    const hit = firstHit(b, cellX(2, 5, b.parity), cellY(2) + 4);
    const cell = anchorCell(b, cellX(2, 5, b.parity), cellY(2) + 4, hit);
    expect(b.color[cell]).toBe(0);
  });
});

describe('aim preview', () => {
  it('stops at the first wall bounce', () => {
    const b = createBoard();
    const pts = new Float32Array(64);
    const n = traceShot(b, D2R(20), pts, 32);
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) {
      expect(pts[i * 2]).toBeGreaterThanOrEqual(R - 1e-6);
      expect(pts[i * 2]).toBeLessThanOrEqual(PLAY_W - R + 1e-6);
    }
  });
});
