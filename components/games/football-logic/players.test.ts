import { describe, expect, it } from 'vitest';
import { PITCH, centerY, isInsideBigArea } from './pitch';
import { FORMATIONS, OUTFIELD, TEAM_SIZE } from './teams';
import { STEPS_PER_SECOND } from './step';
import {
  GK_LINE_DIST, PLAYER_SPEED, PLAYER_SPEED_WITH_BALL, SPRINT_COOLDOWN_STEPS, SPRINT_MULT, SPRINT_STEPS,
  TACKLE_DIST, TACKLE_STEPS, anchorFor, createPlayers, isPlayerDown, isSprinting, ownGoalSide,
  placeByFormation, stepPlayer, type PlayerState,
} from './players';

const F = FORMATIONS[0];

function fresh(): PlayerState[] {
  return createPlayers([F, F], PITCH);
}

// Walks `p` for `steps` steps with the same input and returns the distance covered in x.
function walk(p: PlayerState, steps: number, dx: -1 | 0 | 1, sprint: boolean, hasBall: boolean, from = 0): number {
  const x0 = p.x;
  for (let s = from; s < from + steps; s++) stepPlayer(p, dx, 0, sprint, hasBall, 1, PITCH, s);
  return p.x - x0;
}

describe('createPlayers', () => {
  it('creates 18 players whose array index is their id', () => {
    const ps = fresh();
    expect(ps).toHaveLength(2 * TEAM_SIZE);
    ps.forEach((p, i) => expect(p.id).toBe(i));
  });
  it('gives each team one goalkeeper and OUTFIELD field players with formation roles', () => {
    const ps = fresh();
    for (const team of [0, 1] as const) {
      const mine = ps.filter((p) => p.team === team);
      expect(mine.filter((p) => p.role === 'gk')).toHaveLength(1);
      expect(mine.filter((p) => p.role !== 'gk')).toHaveLength(OUTFIELD);
      expect(mine.filter((p) => p.role === 'def')).toHaveLength(3);
      expect(mine.filter((p) => p.role === 'fwd')).toHaveLength(2);
    }
    expect(ps[0].role).toBe('gk');
    expect(ps[9].role).toBe('gk');
    expect(ps[0].slot).toBe(-1);
    expect(ps[1].slot).toBe(0);
    expect(ps[10].slot).toBe(0);
  });
  it('team 0 attacks +x from the left half and team 1 is its mirror', () => {
    const ps = fresh();
    expect(ps[0].x).toBe(GK_LINE_DIST);
    expect(ps[9].x).toBe(PITCH.width - GK_LINE_DIST);
    expect(ps[0].y).toBe(centerY(PITCH));
    // Ruling R2: the published 3-3-2 puts both fwd at fraction 0.7, i.e. x = 1400 >
    // PITCH.width / 2 = 1000, so "stays in its own half" is false for the data;
    // only "stays on the pitch" and the exact mirror hold.
    for (let i = 1; i <= OUTFIELD; i++) {
      expect(ps[i].x).toBeGreaterThan(0);
      expect(ps[i].x).toBeLessThan(PITCH.width);
      expect(ps[i + TEAM_SIZE].x).toBeCloseTo(PITCH.width - ps[i].x, 6);
      expect(ps[i + TEAM_SIZE].y).toBe(ps[i].y);
    }
    expect(ps[1].facingX).toBe(1);
    expect(ps[10].facingX).toBe(-1);
  });
});

describe('anchorFor / placeByFormation', () => {
  const slot = { role: 'mid' as const, x: 0.45, y: 0.25 };
  it('maps a fraction to world units for the team attacking +x', () => {
    const out = { x: 0, y: 0 };
    anchorFor(slot, 'neutral', 1, PITCH, out);
    expect(out).toEqual({ x: 900, y: 325 });
  });
  it('mirrors x for the team attacking -x', () => {
    const out = { x: 0, y: 0 };
    anchorFor(slot, 'neutral', -1, PITCH, out);
    expect(out).toEqual({ x: 1100, y: 325 });
  });
  it('attack pushes towards the rival goal and defend pulls back, on both sides', () => {
    const a = { x: 0, y: 0 };
    const d = { x: 0, y: 0 };
    anchorFor(slot, 'attack', 1, PITCH, a);
    anchorFor(slot, 'defend', 1, PITCH, d);
    expect(a.x).toBeCloseTo(900 + 0.12 * PITCH.width, 6);
    expect(d.x).toBeCloseTo(900 - 0.12 * PITCH.width, 6);
    anchorFor(slot, 'attack', -1, PITCH, a);
    expect(a.x).toBeCloseTo(1100 - 0.12 * PITCH.width, 6);
  });
  it('placeByFormation rewrites positions, zeroes velocity and leaves the other team alone', () => {
    const ps = fresh();
    ps[3].x = 1500; ps[3].vx = 99; ps[12].x = 77;
    placeByFormation(ps, 0, F, 'attack', 1, PITCH);
    expect(ps[3].vx).toBe(0);
    expect(ps[3].x).toBeCloseTo((F.slots[2].x + 0.12) * PITCH.width, 6);
    expect(ps[12].x).toBe(77);
  });
});

describe('stepPlayer movement', () => {
  it('runs at PLAYER_SPEED without the ball', () => {
    const p = fresh()[4];
    expect(walk(p, 60, 1, false, false)).toBeCloseTo(PLAYER_SPEED, 6);
  });
  it('runs at PLAYER_SPEED_WITH_BALL with the ball', () => {
    const p = fresh()[4];
    expect(walk(p, 60, 1, false, true)).toBeCloseTo(PLAYER_SPEED_WITH_BALL, 6);
  });
  it('diagonals are normalized: same speed, not sqrt(2) faster', () => {
    const p = fresh()[4];
    const x0 = p.x; const y0 = p.y;
    for (let s = 0; s < 60; s++) stepPlayer(p, 1, 1, false, false, 1, PITCH, s);
    const covered = Math.sqrt((p.x - x0) ** 2 + (p.y - y0) ** 2);
    expect(covered).toBeCloseTo(PLAYER_SPEED, 6);
  });
  it('faces the last non-zero direction and keeps it when idle', () => {
    const p = fresh()[4];
    stepPlayer(p, -1, 1, false, false, 1, PITCH, 0);
    expect(p.facingX).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(p.facingY).toBeCloseTo(Math.SQRT1_2, 10);
    stepPlayer(p, 0, 0, false, false, 1, PITCH, 1);
    expect(p.facingX).toBeCloseTo(-Math.SQRT1_2, 10);
  });
  it('never leaves the pitch', () => {
    const p = fresh()[4];
    p.x = PITCH.width - 5;
    walk(p, 30, 1, true, false);
    expect(p.x).toBe(PITCH.width);
  });
  it('a goalkeeper is clamped to its own big area on both sides (criterion 9b)', () => {
    const ps = fresh();
    const gk0 = ps[0];
    walk(gk0, 400, 1, true, false);   // would run 1680 u; must stop at the box edge
    expect(gk0.x).toBe(PITCH.bigAreaDepth);
    expect(isInsideBigArea(PITCH, ownGoalSide(1), gk0.x, gk0.y)).toBe(true);
    const gk1 = ps[9];
    for (let s = 0; s < 400; s++) stepPlayer(gk1, -1, 0, true, false, -1, PITCH, s);
    expect(gk1.x).toBe(PITCH.width - PITCH.bigAreaDepth);
    for (let s = 0; s < 400; s++) stepPlayer(gk1, 0, -1, false, false, -1, PITCH, s);
    expect(gk1.y).toBe(centerY(PITCH) - PITCH.bigAreaWidth / 2);
  });
});

describe('sprint burst and recovery (measured in steps, off the boundaries)', () => {
  it('sprints at x1.4 for SPRINT_STEPS, then recovers for SPRINT_COOLDOWN_STEPS, then sprints again', () => {
    const p = fresh()[4];
    // This test's own cumulative movement (~1170 u) would otherwise collide with
    // the right edge (mid starts at x=900, only 1100 u of room): pull it away
    // from the pitch clamp so this test isolates sprint/cooldown timing, which
    // "never leaves the pitch" already covers separately.
    p.x = 0;
    const perStepBase = PLAYER_SPEED / STEPS_PER_SECOND;
    // 100 steps deep into the burst: all sprinting
    expect(walk(p, 100, 1, true, false, 0)).toBeCloseTo(100 * perStepBase * SPRINT_MULT, 6);
    // 20 more finish the burst; 30 more are already cooling down at base speed
    expect(walk(p, 20, 1, true, false, 100)).toBeCloseTo(20 * perStepBase * SPRINT_MULT, 6);
    expect(isSprinting(p)).toBe(false);
    expect(walk(p, 30, 1, true, false, 120)).toBeCloseTo(30 * perStepBase, 6);
    // still cooling at step 250 (cooldown runs 120..299)
    walk(p, 100, 1, true, false, 150);
    expect(isSprinting(p)).toBe(false);
    expect(walk(p, 1, 1, true, false, 250)).toBeCloseTo(perStepBase, 6);
    // cooldown over at 300: 30 steps later it is sprinting again
    walk(p, 49, 1, true, false, 251);
    expect(walk(p, 30, 1, true, false, 300)).toBeCloseTo(30 * perStepBase * SPRINT_MULT, 6);
    expect(SPRINT_STEPS).toBe(120);
    expect(SPRINT_COOLDOWN_STEPS).toBe(180);
  });
  it('releasing C early ends the burst and still charges the full recovery', () => {
    const p = fresh()[4];
    const perStepBase = PLAYER_SPEED / STEPS_PER_SECOND;
    walk(p, 30, 1, true, false, 0);          // steps 0..29: burst
    walk(p, 1, 1, false, false, 30);         // step 30: release -> the full 180-step recovery starts
    walk(p, 144, 1, false, false, 31);       // steps 31..174: still recovering
    expect(walk(p, 1, 1, true, false, 175)).toBeCloseTo(perStepBase, 6);                // 175 < 30 + 180: no sprint
    walk(p, 39, 1, false, false, 176);       // steps 176..214: recovery ends at 210
    expect(walk(p, 1, 1, true, false, 215)).toBeCloseTo(perStepBase * SPRINT_MULT, 6);  // 215 > 210: sprints again
  });
  it('sprinting also applies with the ball', () => {
    const p = fresh()[4];
    expect(walk(p, 10, 1, true, true)).toBeCloseTo(10 * (PLAYER_SPEED_WITH_BALL / STEPS_PER_SECOND) * SPRINT_MULT, 6);
  });
});

describe('down and tackling players ignore the d-pad', () => {
  it('stays put while stepCount < downUntilStep and moves again after (1 s = 60 steps, sampled at 37 and 61)', () => {
    const p = fresh()[4];
    p.downUntilStep = 60;
    expect(isPlayerDown(p, 37)).toBe(true);
    stepPlayer(p, 1, 0, false, false, 1, PITCH, 37);
    expect(p.vx).toBe(0);
    expect(isPlayerDown(p, 61)).toBe(false);
    expect(walk(p, 1, 1, false, false, 61)).toBeCloseTo(PLAYER_SPEED / STEPS_PER_SECOND, 6);
  });
  it('a tackling player slides TACKLE_DIST along tackleDir in TACKLE_STEPS steps and ignores the d-pad', () => {
    const p = fresh()[4];
    p.tackleStepsLeft = TACKLE_STEPS; p.tackleDirX = 0; p.tackleDirY = 1;
    const y0 = p.y; const x0 = p.x;
    for (let s = 0; s < TACKLE_STEPS; s++) stepPlayer(p, -1, 0, true, false, 1, PITCH, s);
    expect(p.y - y0).toBeCloseTo(TACKLE_DIST, 6);
    expect(p.x).toBe(x0);
    // stepPlayer only slides: the countdown and the outcome belong to stepTackle (Task 3).
    expect(p.tackleStepsLeft).toBe(TACKLE_STEPS);
    expect(TACKLE_STEPS).toBe(24);
  });
});
