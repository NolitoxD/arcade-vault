import { describe, expect, it } from 'vitest';
import { PITCH, centerY, goalLineX, isInsideBigArea } from './pitch';
import { FORMATIONS, TEAM_SIZE, type Formation, type Strategy } from './teams';
import { createTeamInput, type TeamInput } from './input';
import { GK_LINE_DIST, createPlayers, type PlayerState } from './players';
import { CONTROL_DIST, LONG_PASS_VZ, createBall, type BallState } from './ball';
import { createRng, type Rng } from './rng';
import type { AttackDirs } from './step';
import { LONG_PASS_SPEED, SHORT_PASS_SPEED, createActionEvent, shotSpeed, type ActionEvent } from './actions';
import {
  FREE_KICK_CHARGE_STEPS, PENALTY_CHARGE_STEPS, PENALTY_SIDE_OFFSET, SET_PIECE_CLEARANCE, SET_PIECE_COUNTDOWN_STEPS,
  beginSetPiece, createSetPieceState, stepSetPiece, type SetPieceState,
} from './set-pieces';
import type { SetPieceKind } from './referee';

const F = FORMATIONS[0];
const FORMS: readonly [Formation, Formation] = [F, F];
const STRATS: readonly [Strategy, Strategy] = ['neutral', 'neutral'];
const ATTACK: AttackDirs = [1, -1];
const CY = centerY(PITCH);

type W = { players: PlayerState[]; ball: BallState; sp: SetPieceState; input: TeamInput; aim: { x: number; y: number }; out: ActionEvent };

function world(): W {
  return {
    players: createPlayers(FORMS, PITCH), ball: createBall(), sp: createSetPieceState(),
    input: createTeamInput(), aim: { x: 0, y: 0 }, out: createActionEvent(),
  };
}

function begin(w: W, kind: SetPieceKind, team: 0 | 1, x: number, y: number, step = 0): void {
  beginSetPiece(w.sp, kind, team, x, y, w.players, w.ball, FORMS, STRATS, ATTACK, PITCH, step);
}

function fixedRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

// Runs `n` steps of the set piece with the given input; returns the step at which it executed or -1.
function run(w: W, n: number, rng: Rng = createRng(1), readChance = 0.6, from = 1): number {
  for (let s = from; s < from + n; s++) {
    if (stepSetPiece(w.sp, w.input, w.players, w.ball, rng, readChance, ATTACK, PITCH, s, w.aim, w.out)) return s;
  }
  return -1;
}

function speedOf(b: BallState): number {
  return Math.sqrt(b.vx * b.vx + b.vy * b.vy);
}

describe('beginSetPiece', () => {
  it('kickoff: everyone by formation, the nearest outfield player of the team takes it from the centre facing attackDir', () => {
    const w = world();
    w.players[3].x = 1700; // moved away: kickoff must reset it
    begin(w, 'kickoff', 0, 1000, CY);
    expect(w.players[3].x).toBe(F.slots[2].x * PITCH.width);
    expect(w.sp).toMatchObject({ kind: 'kickoff', team: 0, x: 1000, y: CY, dirX: 1, dirY: 0, stepsLeft: SET_PIECE_COUNTDOWN_STEPS });
    expect(w.sp.takerId).toBe(5); // slot 4 (centre mid at 900, 650) is the closest to the spot
    expect(w.ball.owner).toBe(5);
    expect(w.ball.x).toBeCloseTo(1000, 10);
    expect(w.ball.y).toBeCloseTo(CY, 10);
    expect(w.players[5].x).toBeCloseTo(1000 - CONTROL_DIST, 10);
    expect(SET_PIECE_COUNTDOWN_STEPS).toBe(300);
  });
  it('team 1 kicks off facing -x', () => {
    const w = world();
    begin(w, 'kickoff', 1, 1000, CY);
    expect(w.sp.dirX).toBe(-1);
    expect(w.players[w.sp.takerId].team).toBe(1);
    expect(w.players[w.sp.takerId].x).toBeCloseTo(1000 + CONTROL_DIST, 10);
  });
  it('corner: default direction points at the rival goal centre, a nearby rival is pushed to SET_PIECE_CLEARANCE', () => {
    const w = world();
    // a rival 100 u from the corner spot -- this is the one rival pushRivalsAway
    // actually moves in this test; the keeper is left at its formation spot
    // (see the dedicated GK-clamp test below for the case that actually
    // exercises clampToBigArea -- here the keeper starts inside its box and
    // stays far outside SET_PIECE_CLEARANCE, so it is never touched).
    w.players[12].x = 1930; w.players[12].y = 70;
    begin(w, 'corner', 0, PITCH.width, 0);
    const d12 = Math.sqrt((w.players[12].x - PITCH.width) ** 2 + (w.players[12].y - 0) ** 2);
    expect(d12).toBeGreaterThanOrEqual(SET_PIECE_CLEARANCE - 1e-6);
    // The rival keeper (player 9) is untouched by this fixture and simply
    // documents that its formation starting spot is already inside its box --
    // it is not evidence that clampToBigArea ran.
    expect(isInsideBigArea(PITCH, 1, w.players[9].x, w.players[9].y)).toBe(true);
    // direction from (2000, 0) towards (2000, 650) is straight down
    expect(w.sp.dirX).toBeCloseTo(0, 10);
    expect(w.sp.dirY).toBeCloseTo(1, 10);
    expect(w.players[w.sp.takerId].team).toBe(0);
    expect(w.players[w.sp.takerId].role).not.toBe('gk');
    // Ruling R9: the corner spot is at y = 0 with dirY ~ 1, so the naive
    // "CONTROL_DIST behind the ball" position would be y = -18, outside the
    // pitch. The taker must be clamped in, exactly like a pushed rival is.
    const taker = w.players[w.sp.takerId];
    expect(taker.x).toBeGreaterThanOrEqual(0);
    expect(taker.x).toBeLessThanOrEqual(PITCH.width);
    expect(taker.y).toBeGreaterThanOrEqual(0);
    expect(taker.y).toBeLessThanOrEqual(PITCH.height);
    // The ball itself still sits exactly on the corner spot regardless of the clamp.
    expect(w.ball.x).toBeCloseTo(PITCH.width, 10);
    expect(w.ball.y).toBeCloseTo(0, 10);
  });
  it('pushing the rival keeper past SET_PIECE_CLEARANCE clamps it back inside its own box', () => {
    // Fix for the review finding on the corner test above: that test never
    // actually drives the rival keeper through pushRivalsAway's push-then-clamp
    // path (its formation spot at (1975, 650) is ~650 u from the corner spot,
    // far past SET_PIECE_CLEARANCE=180, so it is simply skipped). This test
    // places the keeper close enough to be pushed, and picks a push direction
    // that lands it outside its own big area, so clampToBigArea has to act.
    const w = world();
    const gk = w.players[TEAM_SIZE]; // team 1's keeper (index 9)
    gk.x = 1690; gk.y = CY; // inside its box (edge at x = width - bigAreaDepth = 1680)
    begin(w, 'free-kick', 0, 1800, CY);
    // d((1800, 650), (1690, 650)) = 110 < 180: pushRivalsAway pushes it along
    // the straight line away from the spot, i.e. (-1, 0), landing it at
    // x = 1800 - 180 = 1620 -- outside the box (needs x >= 1680) -- so
    // clampToBigArea must pull it back to exactly 1680 for this to pass.
    expect(isInsideBigArea(PITCH, 1, gk.x, gk.y)).toBe(true);
    expect(gk.x).toBe(1680);
    expect(gk.y).toBe(CY);
  });
  it('throw-in / free kick do not reset the formation', () => {
    const w = world();
    w.players[3].x = 1500; w.players[3].y = 900;
    begin(w, 'throw-in', 1, 700, 0);
    expect(w.players[3].x).toBe(1500);
    begin(w, 'free-kick', 0, 1200, 400);
    expect(w.players[3].y).toBe(900);
  });
});

describe('direction and countdown', () => {
  it('keeps the last non-null d-pad direction and moves the taker behind the ball', () => {
    const w = world();
    begin(w, 'kickoff', 0, 1000, CY);
    w.input.dx = 0; w.input.dy = 1;
    run(w, 1);
    expect(w.sp.dirY).toBe(1);
    w.input.dx = 0; w.input.dy = 0;
    run(w, 100, createRng(1), 0.6, 2);
    expect(w.sp.dirX).toBe(0);
    expect(w.sp.dirY).toBe(1);
    expect(w.players[5].y).toBeCloseTo(CY - CONTROL_DIST, 10);
    expect(w.ball.y).toBeCloseTo(CY, 10);
    w.input.dx = -1; w.input.dy = -1;
    run(w, 1, createRng(1), 0.6, 102);
    expect(w.sp.dirX).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(w.sp.dirY).toBeCloseTo(-Math.SQRT1_2, 10);
  });
  it('executes exactly when the 300-step countdown reaches zero (sampled at 250, 299, 300)', () => {
    const w = world();
    begin(w, 'kickoff', 0, 1000, CY);
    expect(run(w, 250)).toBe(-1);
    expect(w.sp.stepsLeft).toBe(50);
    expect(run(w, 49, createRng(1), 0.6, 251)).toBe(-1);
    expect(w.ball.owner).toBe(5);
    expect(run(w, 1, createRng(1), 0.6, 300)).toBe(300);
    expect(w.ball.owner).toBeNull();
  });
});

describe('automatic execution by kind', () => {
  it('kickoff and throw-in are short passes in the chosen direction', () => {
    const w = world();
    begin(w, 'kickoff', 0, 1000, CY);
    w.input.dy = 1;
    run(w, SET_PIECE_COUNTDOWN_STEPS);
    expect(speedOf(w.ball)).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(w.ball.vy).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(0);
    expect(w.out.kind).toBe('short-pass');
    const t = world();
    begin(t, 'throw-in', 1, 700, 0);
    run(t, SET_PIECE_COUNTDOWN_STEPS);
    expect(t.out.kind).toBe('short-pass');
    expect(t.ball.lastTouchTeam).toBe(1);
  });
  it('goal kick and corner are long passes', () => {
    const w = world();
    begin(w, 'goal-kick', 0, PITCH.smallAreaDepth, CY);
    run(w, SET_PIECE_COUNTDOWN_STEPS);
    expect(speedOf(w.ball)).toBeCloseTo(LONG_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(LONG_PASS_VZ);
    expect(w.ball.vx).toBeGreaterThan(0); // towards the rival goal by default
    const c = world();
    begin(c, 'corner', 1, 0, PITCH.height);
    run(c, SET_PIECE_COUNTDOWN_STEPS);
    expect(c.out.kind).toBe('long-pass');
  });
  it('a free kick is a shot at shotSpeed(FREE_KICK_CHARGE_STEPS)', () => {
    const w = world();
    begin(w, 'free-kick', 0, 1500, 500);
    run(w, SET_PIECE_COUNTDOWN_STEPS);
    expect(w.out.kind).toBe('shot');
    expect(speedOf(w.ball)).toBeCloseTo(shotSpeed(FREE_KICK_CHARGE_STEPS), 6);
    expect(shotSpeed(FREE_KICK_CHARGE_STEPS)).toBe(800);
  });
});

describe('penalty', () => {
  function penalty(side: -1 | 0 | 1, rng: Rng, readChance = 0.6): W {
    const w = world();
    begin(w, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY);
    w.input.dy = side;
    run(w, 1);
    w.input.dy = 0; // the side sticks once chosen
    run(w, SET_PIECE_COUNTDOWN_STEPS, rng, readChance, 2);
    return w;
  }
  it('the keeper reads the side when rng() < penaltyReadChance and saves', () => {
    const w = penalty(1, fixedRng([0.59]));
    const gk = w.players[TEAM_SIZE];
    expect(w.ball.owner).toBe(gk.id);
    expect(gk.y).toBeCloseTo(CY + PENALTY_SIDE_OFFSET, 6);
    expect(w.out).toMatchObject({ kind: 'shot', ok: false });
  });
  it('the keeper guesses wrong when rng() >= penaltyReadChance and the ball flies at shotSpeed(PENALTY_CHARGE_STEPS)', () => {
    const w = penalty(1, fixedRng([0.61, 0.3])); // not read; second roll picks the lower of the other sides (-1)
    expect(w.ball.owner).toBeNull();
    expect(speedOf(w.ball)).toBeCloseTo(shotSpeed(PENALTY_CHARGE_STEPS), 6);
    expect(shotSpeed(PENALTY_CHARGE_STEPS)).toBe(850);
    expect(w.ball.vy).toBeGreaterThan(0); // aimed at centerY + 55
    expect(w.ball.vx).toBeGreaterThan(0);
    expect(w.players[TEAM_SIZE].y).toBeCloseTo(CY - PENALTY_SIDE_OFFSET, 6);
    expect(w.out).toMatchObject({ kind: 'shot', ok: true });
  });
  it('a centre shot is saved when the keeper stays (reads) and scores when it dives', () => {
    expect(penalty(0, fixedRng([0.1])).ball.owner).toBe(TEAM_SIZE);
    expect(penalty(0, fixedRng([0.9, 0.7])).ball.owner).toBeNull(); // dives to +1
  });
  it('a read chance of 1 always saves and 0 never does, whatever the seed', () => {
    for (const seed of [3, 17, 4242]) {
      expect(penalty(-1, createRng(seed), 1).ball.owner).toBe(TEAM_SIZE);
      expect(penalty(-1, createRng(seed), 0).ball.owner).toBeNull();
    }
  });
  it('the keeper starts on its line at the goal centre and the box holds the penalty spot', () => {
    const w = world();
    begin(w, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY);
    expect(w.players[TEAM_SIZE].x).toBe(goalLineX(PITCH, 1) - GK_LINE_DIST);
    expect(w.players[TEAM_SIZE].y).toBe(CY);
    expect(w.ball.x).toBeCloseTo(PITCH.width - PITCH.penaltySpotDist, 10);
  });
});
