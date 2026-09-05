import { describe, expect, it } from 'vitest';
import { PITCH } from './pitch';
import { FORMATIONS } from './teams';
import { createTeamInput, type TeamInput } from './input';
import { createPlayers, stepPlayer, TACKLE_STEPS, type PlayerState } from './players';
import { LONG_PASS_VZ, createBall, givePossession, stickToOwner, type BallState } from './ball';
import type { Rng } from './rng';
import {
  CONTROL_HYSTERESIS, GK_HOLD_STEPS, LONG_PASS_HOLD_STEPS, LONG_PASS_SPEED, SHORT_PASS_SPEED, SHOT_CHARGE_STEPS,
  SHOT_SPEED_MAX, SHOT_SPEED_MIN, STEAL_CHANCE, STEAL_CHANCE_VS_SPRINT, STEAL_RANGE, TACKLE_MISS_DOWN_STEPS,
  aimPass, applyButtons, createActionEvent, longPass, releaseFromGoalkeeper, shoot, shortPass, shotSpeed, startTackle,
  steal, stepTackle, updateControlled, type ActionEvent,
} from './actions';

const F = FORMATIONS[0];

type World = { players: PlayerState[]; ball: BallState; out: ActionEvent; aim: { x: number; y: number } };

function world(): World {
  const players = createPlayers([F, F], PITCH);
  // Everyone parked on the bottom touch line, spaced by id, so every test places its actors explicitly.
  for (const p of players) { p.x = 100 + p.id * 40; p.y = 1290; p.facingX = 1; p.facingY = 0; }
  return { players, ball: createBall(), out: createActionEvent(), aim: { x: 0, y: 0 } };
}

function at(p: PlayerState, x: number, y: number, fx = 1, fy = 0): PlayerState {
  p.x = x; p.y = y; p.facingX = fx; p.facingY = fy;
  return p;
}

function fixedRng(values: number[]): Rng & { calls: number } {
  let i = 0;
  const fn = (() => { fn.calls++; return values[i++ % values.length]; }) as Rng & { calls: number };
  fn.calls = 0;
  return fn;
}

function speedOf(ball: BallState): number {
  return Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
}

describe('shotSpeed: 700 at a tap, 950 after one second of charge', () => {
  it('interpolates linearly and caps at SHOT_CHARGE_STEPS', () => {
    expect(shotSpeed(0)).toBe(SHOT_SPEED_MIN);
    expect(shotSpeed(30)).toBe((SHOT_SPEED_MIN + SHOT_SPEED_MAX) / 2);
    expect(shotSpeed(SHOT_CHARGE_STEPS)).toBe(SHOT_SPEED_MAX);
    expect(shotSpeed(SHOT_CHARGE_STEPS + 45)).toBe(SHOT_SPEED_MAX);
    expect(SHOT_CHARGE_STEPS).toBe(60);
  });
});

describe('shoot / shortPass / longPass write the ball and the event', () => {
  it('shoot releases the owner at shotSpeed along the given unit direction', () => {
    const w = world();
    const p = at(w.players[5], 900, 700);
    givePossession(w.ball, p, 10);
    shoot(p, w.ball, 0.6, 0.8, 40, 10, w.out);
    expect(w.ball.owner).toBeNull();
    expect(speedOf(w.ball)).toBeCloseTo(shotSpeed(40), 6);
    expect(w.ball.vx / w.ball.vy).toBeCloseTo(0.75, 10);
    expect(w.ball.vz).toBeGreaterThan(0);
    expect(w.out).toMatchObject({ kind: 'shot', ok: true, foul: false, actorId: 5 });
  });
  it('shortPass is a 420 u/s ground ball', () => {
    const w = world();
    const p = at(w.players[5], 900, 700);
    givePossession(w.ball, p, 10);
    shortPass(p, w.ball, 1, 0, 10, w.out);
    expect(speedOf(w.ball)).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(0);
    expect(w.out.kind).toBe('short-pass');
  });
  it('longPass is a 560 u/s lob with LONG_PASS_VZ', () => {
    const w = world();
    const p = at(w.players[5], 900, 700);
    givePossession(w.ball, p, 10);
    longPass(p, w.ball, 0, -1, 10, w.out);
    expect(speedOf(w.ball)).toBeCloseTo(LONG_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(LONG_PASS_VZ);
    expect(w.out.kind).toBe('long-pass');
  });
});

describe('steal: 65% by the injected rng, 35% against a sprinting owner, no roll out of range', () => {
  function setup(distance: number): World & { thief: PlayerState; owner: PlayerState } {
    const w = world();
    const owner = at(w.players[12], 1000, 600, -1, 0);
    givePossession(w.ball, owner, 50);
    stickToOwner(w.ball, owner);
    const thief = at(w.players[4], 1000 - distance, 600);
    return { ...w, thief, owner };
  }
  it('succeeds when rng() is below STEAL_CHANCE', () => {
    const s = setup(23);
    const rng = fixedRng([STEAL_CHANCE - 0.01]);
    steal(s.thief, s.ball, s.players, rng, 60, s.out);
    expect(s.ball.owner).toBe(4);
    expect(rng.calls).toBe(1);
    expect(s.out).toMatchObject({ kind: 'steal', ok: true, actorId: 4, victimId: 12 });
  });
  it('fails when rng() is at or above STEAL_CHANCE', () => {
    const s = setup(23);
    steal(s.thief, s.ball, s.players, fixedRng([STEAL_CHANCE + 0.01]), 60, s.out);
    expect(s.ball.owner).toBe(12);
    expect(s.out).toMatchObject({ kind: 'steal', ok: false });
  });
  it('uses STEAL_CHANCE_VS_SPRINT against a sprinting owner', () => {
    const s = setup(23);
    s.owner.sprintStepsLeft = 50;
    steal(s.thief, s.ball, s.players, fixedRng([STEAL_CHANCE_VS_SPRINT + 0.02]), 60, s.out);
    expect(s.ball.owner).toBe(12);
    const t = setup(23);
    t.owner.sprintStepsLeft = 50;
    steal(t.thief, t.ball, t.players, fixedRng([STEAL_CHANCE_VS_SPRINT - 0.02]), 60, t.out);
    expect(t.ball.owner).toBe(4);
  });
  it('does not roll the rng when the owner is out of STEAL_RANGE', () => {
    const s = setup(STEAL_RANGE + 5);
    const rng = fixedRng([0]);
    steal(s.thief, s.ball, s.players, rng, 60, s.out);
    expect(rng.calls).toBe(0);
    expect(s.ball.owner).toBe(12);
    expect(s.out.ok).toBe(false);
  });
  it('never robs a goalkeeper and does not roll for it', () => {
    const w = world();
    const gk = at(w.players[9], 1000, 600, -1, 0);
    givePossession(w.ball, gk, 50);
    const thief = at(w.players[4], 1000 - 20, 600);
    const rng = fixedRng([0]);
    steal(thief, w.ball, w.players, rng, 60, w.out);
    expect(rng.calls).toBe(0);
    expect(w.ball.owner).toBe(9);
  });
  // R8: split so the free-ball branch is proven separately from the teammate-owner
  // branch — a naive `if (owner.team === p.team) return` would pass "teammate
  // owner" alone but crash (or silently steal) on a null owner.
  it('ignores a teammate owner: no steal, no rng roll', () => {
    const w = world();
    const mate = at(w.players[6], 1000, 600);
    givePossession(w.ball, mate, 50);
    const thief = at(w.players[4], 1010, 600);
    const rng = fixedRng([0]);
    steal(thief, w.ball, w.players, rng, 60, w.out);
    expect(rng.calls).toBe(0);
    expect(w.ball.owner).toBe(6);
  });
  it('ignores a free ball: no steal, event pristine, no rng roll', () => {
    const w = world();
    const thief = at(w.players[4], 1010, 600);
    const rng = fixedRng([0]);
    steal(thief, w.ball, w.players, rng, 60, w.out);
    expect(rng.calls).toBe(0);
    expect(w.ball.owner).toBeNull();
    expect(w.out).toMatchObject({ kind: 'steal', ok: false, actorId: 4, victimId: -1 });
  });
});

// Runs the tackle the way stepMatch will: slide (stepPlayer), then resolve (stepTackle).
function runTackle(w: World, p: PlayerState, maxSteps: number, from = 0): number {
  for (let s = from; s < from + maxSteps; s++) {
    stepPlayer(p, 0, 0, false, false, 1, PITCH, s);
    stepTackle(p, w.ball, w.players, s, w.out);
    if (p.tackleStepsLeft === 0) return s;
  }
  return -1;
}

describe('sliding tackle: three outcomes', () => {
  it('steals a free ball it reaches and stays on its feet', () => {
    const w = world();
    const p = at(w.players[4], 1000, 600);
    w.ball.x = 1061; w.ball.y = 600;          // 61 u ahead, inside the 90 u slide
    startTackle(p, 1, 0, w.out);
    expect(w.out).toMatchObject({ kind: 'tackle', ok: false, foul: false, actorId: 4 });
    const endedAt = runTackle(w, p, TACKLE_STEPS + 5, 100);
    expect(endedAt).toBeGreaterThan(100);
    expect(endedAt).toBeLessThan(100 + TACKLE_STEPS);
    expect(w.ball.owner).toBe(4);
    expect(w.out).toMatchObject({ kind: 'tackle', ok: true, foul: false });
    expect(p.downUntilStep).toBe(0);
  });
  it('fouls a rival it touches and lies down for 1 s', () => {
    const w = world();
    const p = at(w.players[4], 1000, 600);
    const victim = at(w.players[14], 1000, 655);   // 55 u ahead, ball far away
    w.ball.x = 300; w.ball.y = 300;
    startTackle(p, 0, 1, w.out);
    const endedAt = runTackle(w, p, TACKLE_STEPS + 5, 200);
    expect(w.out).toMatchObject({ kind: 'tackle', ok: false, foul: true, actorId: 4, victimId: 14 });
    expect(w.out.x).toBe(victim.x);
    expect(w.out.y).toBe(victim.y);
    expect(p.downUntilStep).toBe(endedAt + TACKLE_MISS_DOWN_STEPS);
    expect(w.ball.owner).toBeNull();
  });
  it('reaches nothing: lies down for 1 s after TACKLE_STEPS', () => {
    const w = world();
    const p = at(w.players[4], 1000, 600);
    w.ball.x = 300; w.ball.y = 300;
    startTackle(p, 1, 0, w.out);
    const endedAt = runTackle(w, p, TACKLE_STEPS + 5, 300);
    expect(endedAt).toBe(300 + TACKLE_STEPS - 1);
    expect(w.out).toMatchObject({ kind: 'tackle', ok: false, foul: false });
    expect(p.downUntilStep).toBe(endedAt + TACKLE_MISS_DOWN_STEPS);
    expect(TACKLE_MISS_DOWN_STEPS).toBe(60);
  });
  it('from the front reaches the ball before the body: a steal, not a foul', () => {
    const w = world();
    const owner = at(w.players[12], 1090, 600, -1, 0);   // faces the tackler: ball 18 u in front of it, at 1072
    givePossession(w.ball, owner, 0);
    stickToOwner(w.ball, owner);
    const p = at(w.players[4], 1000, 600);
    startTackle(p, 1, 0, w.out);
    runTackle(w, p, TACKLE_STEPS + 5, 400);
    expect(w.ball.owner).toBe(4);
    expect(w.out.foul).toBe(false);
  });
  it('from behind touches the body first: a foul', () => {
    const w = world();
    const owner = at(w.players[12], 1050, 600, 1, 0);    // faces away: ball at 1068, body at 1050
    givePossession(w.ball, owner, 0);
    stickToOwner(w.ball, owner);
    const p = at(w.players[4], 1000, 600);
    startTackle(p, 1, 0, w.out);
    runTackle(w, p, TACKLE_STEPS + 5, 500);
    expect(w.ball.owner).toBe(12);
    expect(w.out).toMatchObject({ foul: true, victimId: 12 });
  });
  it('never robs a goalkeeper holding the ball', () => {
    const w = world();
    const gk = at(w.players[9], 1090, 600, -1, 0);
    givePossession(w.ball, gk, 0);
    stickToOwner(w.ball, gk);
    const p = at(w.players[4], 1000, 600);
    startTackle(p, 1, 0, w.out);
    runTackle(w, p, TACKLE_STEPS + 5, 600);
    expect(w.ball.owner).toBe(9);
  });
});

describe('releaseFromGoalkeeper', () => {
  it('kicks a long pass towards attackDir once GK_HOLD_STEPS have passed, and not before', () => {
    const w = world();
    const gk = at(w.players[9], 1975, 650, -1, 0);
    givePossession(w.ball, gk, 100);
    releaseFromGoalkeeper(gk, w.ball, -1, 100 + GK_HOLD_STEPS - 7, w.out);
    expect(w.ball.owner).toBe(9);
    expect(w.out.kind).toBe('none');
    releaseFromGoalkeeper(gk, w.ball, -1, 100 + GK_HOLD_STEPS, w.out);
    expect(w.ball.owner).toBeNull();
    expect(w.ball.vx).toBeCloseTo(-LONG_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(LONG_PASS_VZ);
    expect(w.out.kind).toBe('gk-release');
    expect(GK_HOLD_STEPS).toBe(120);
  });
  it('does nothing for an outfield player or a keeper without the ball', () => {
    const w = world();
    const p = at(w.players[4], 500, 500);
    givePossession(w.ball, p, 0);
    releaseFromGoalkeeper(p, w.ball, 1, 500, w.out);
    expect(w.ball.owner).toBe(4);
    releaseFromGoalkeeper(w.players[0], w.ball, 1, 500, w.out);
    expect(w.ball.owner).toBe(4);
  });
});

describe('applyButtons: press/hold semantics with and without the ball', () => {
  function withBall(): World & { p: PlayerState; input: TeamInput } {
    const w = world();
    const p = at(w.players[5], 900, 700);
    givePossession(w.ball, p, 0);
    return { ...w, p, input: createTeamInput() };
  }
  it('holding A for 40 steps then releasing shoots at shotSpeed(40) in the d-pad direction', () => {
    const s = withBall();
    const rng = fixedRng([0.5]);
    s.input.dx = 0; s.input.dy = -1;
    s.input.a = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 0, s.aim, s.out);
    s.input.a = 'held';
    for (let step = 1; step < 40; step++) applyButtons(s.p, s.input, s.ball, s.players, rng, step, s.aim, s.out);
    expect(s.ball.owner).toBe(5);
    expect(s.p.chargeSteps).toBe(40);
    s.input.a = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 40, s.aim, s.out);
    expect(s.out.kind).toBe('shot');
    expect(speedOf(s.ball)).toBeCloseTo(shotSpeed(40), 6);
    expect(s.ball.vy).toBeLessThan(0);
    expect(s.ball.vx).toBeCloseTo(0, 10);
    expect(s.p.chargeSteps).toBe(0);
    expect(rng.calls).toBe(0);
  });
  it('a tap of B is a short pass along the facing when the d-pad is idle', () => {
    const s = withBall();
    s.input.b = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 0, s.aim, s.out);
    s.input.b = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 1, s.aim, s.out);
    expect(s.out.kind).toBe('short-pass');
    expect(s.ball.vx).toBeCloseTo(SHORT_PASS_SPEED, 6);
  });
  it('holding B for LONG_PASS_HOLD_STEPS + 3 is a long pass', () => {
    const s = withBall();
    s.input.b = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 0, s.aim, s.out);
    s.input.b = 'held';
    for (let step = 1; step < LONG_PASS_HOLD_STEPS + 3; step++) applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), step, s.aim, s.out);
    s.input.b = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), LONG_PASS_HOLD_STEPS + 3, s.aim, s.out);
    expect(s.out.kind).toBe('long-pass');
    expect(s.ball.vz).toBe(LONG_PASS_VZ);
  });
  it('without the ball, A starts a tackle and B tries a steal', () => {
    const w = world();
    const owner = at(w.players[12], 1000, 600, -1, 0);
    givePossession(w.ball, owner, 0);
    stickToOwner(w.ball, owner);
    const p = at(w.players[4], 980, 600);
    const input = createTeamInput();
    input.b = 'pressed';
    const rng = fixedRng([0.9]);
    applyButtons(p, input, w.ball, w.players, rng, 10, w.aim, w.out);
    expect(rng.calls).toBe(1);
    expect(w.out.kind).toBe('steal');
    input.b = 'up'; input.a = 'pressed';
    applyButtons(p, input, w.ball, w.players, rng, 11, w.aim, w.out);
    expect(w.out.kind).toBe('tackle');
    expect(p.tackleStepsLeft).toBe(TACKLE_STEPS);
  });
  it('a player on the ground does nothing and drops any charge', () => {
    const s = withBall();
    s.p.chargeSteps = 20; s.p.chargeButton = 'a';
    s.p.downUntilStep = 90;
    s.input.a = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 30, s.aim, s.out);
    expect(s.out.kind).toBe('none');
    expect(s.ball.owner).toBe(5);
    expect(s.p.chargeSteps).toBe(0);
  });
  it('a player mid-tackle does nothing and drops any charge', () => {
    const s = withBall();
    s.p.chargeSteps = 20; s.p.chargeButton = 'a';
    s.p.tackleStepsLeft = TACKLE_STEPS;
    s.input.a = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 30, s.aim, s.out);
    expect(s.out.kind).toBe('none');
    expect(s.ball.owner).toBe(5);
    expect(s.p.chargeSteps).toBe(0);
  });
  it('a released B pass aims at a teammate in the cone instead of the raw d-pad direction', () => {
    // Proves applyButtons actually calls aimPass rather than passing the raw
    // direction straight through: a mate placed off-axis but inside the cone
    // must bend the pass, which the un-aimed brief behaviour would not do.
    const s = withBall();
    const mate = at(s.players[6], s.p.x + 100 * 0.9397, s.p.y + 100 * 0.3420); // 20 deg off the d-pad axis
    s.input.dx = 1; s.input.dy = 0;
    s.input.b = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 0, s.aim, s.out);
    s.input.b = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 1, s.aim, s.out);
    const dx = mate.x - s.p.x;
    const dy = mate.y - s.p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    expect(s.ball.vx / SHORT_PASS_SPEED).toBeCloseTo(dx / len, 6);
    expect(s.ball.vy / SHORT_PASS_SPEED).toBeCloseTo(dy / len, 6);
  });
});

describe('aimPass: cones onto the nearest/farthest teammate, or leaves the direction alone', () => {
  it('aims at the nearer teammate inside the cone when farthest is false', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    const aim = { x: 0, y: 0 };
    at(w.players[1], p.x + 150 * 0.9848078, p.y + 150 * 0.1736482); // far mate, 10°: (0.9848078, 0.1736482)
    const near = at(w.players[2], p.x + 80 * 0.8660254, p.y + 80 * 0.5); // near mate, 30°: (0.8660254, 0.5)
    const found = aimPass(p, w.players, 1, 0, false, 0, aim);
    expect(found).toBe(true);
    const d = dist2(p, near);
    expect(aim.x).toBeCloseTo((near.x - p.x) / d, 6);
    expect(aim.y).toBeCloseTo((near.y - p.y) / d, 6);
  });
  it('aims at the farther teammate inside the cone when farthest is true', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    const aim = { x: 0, y: 0 };
    const far = at(w.players[1], p.x + 150 * 0.9848078, p.y + 150 * 0.1736482); // 10°: (0.9848078, 0.1736482)
    at(w.players[2], p.x + 80 * 0.8660254, p.y + 80 * 0.5); // 30°: (0.8660254, 0.5)
    const found = aimPass(p, w.players, 1, 0, true, 0, aim);
    expect(found).toBe(true);
    const d = dist2(p, far);
    expect(aim.x).toBeCloseTo((far.x - p.x) / d, 6);
    expect(aim.y).toBeCloseTo((far.y - p.y) / d, 6);
  });
  it('ignores a teammate at 60 degrees, outside the 45 degree cone', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    const aim = { x: 0, y: 0 };
    at(w.players[1], p.x + 60 * 0.5, p.y + 60 * 0.8660254); // 60°: (0.5, 0.8660254)
    const found = aimPass(p, w.players, 1, 0, false, 0, aim);
    expect(found).toBe(false);
    expect(aim.x).toBe(1);
    expect(aim.y).toBe(0);
  });
  it('returns false and leaves the direction unchanged when no teammate qualifies', () => {
    const w = world(); // default line-up: every team-0 mate sits behind player 5, outside the (1,0) cone
    const p = at(w.players[5], 1000, 600, 1, 0);
    const aim = { x: 0, y: 0 };
    const found = aimPass(p, w.players, 1, 0, false, 0, aim);
    expect(found).toBe(false);
    expect(aim.x).toBe(1);
    expect(aim.y).toBe(0);
  });
  it('ignores the goalkeeper and a downed teammate even when both sit inside the cone', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    const aim = { x: 0, y: 0 };
    at(w.players[0], p.x + 50 * 0.9396926, p.y + 50 * 0.3420201); // gk, would qualify but for the role; 20°: (0.9396926, 0.3420201)
    const downed = at(w.players[3], p.x + 60 * 0.9396926, p.y + 60 * 0.3420201); // 20°: (0.9396926, 0.3420201)
    downed.downUntilStep = 100;
    const found = aimPass(p, w.players, 1, 0, false, 50, aim); // stepCount 50 < downUntilStep 100
    expect(found).toBe(false);
    expect(aim.x).toBe(1);
    expect(aim.y).toBe(0);
  });
  it('breaks an exact distance tie by keeping the lower id (ascending scan order)', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    const aim = { x: 0, y: 0 };
    // Mirrored angles, same distance: with distance alone tied, only the id
    // order can decide, so a passing test here is not a coincidence of geometry.
    const lowId = at(w.players[1], p.x + 100 * 0.9396926, p.y - 100 * 0.3420201); // 20°: (0.9396926, 0.3420201)
    at(w.players[2], p.x + 100 * 0.9396926, p.y + 100 * 0.3420201); // 20°: (0.9396926, 0.3420201)
    const found = aimPass(p, w.players, 1, 0, false, 0, aim);
    expect(found).toBe(true);
    const d = dist2(p, lowId);
    expect(aim.x).toBeCloseTo((lowId.x - p.x) / d, 6);
    expect(aim.y).toBeCloseTo((lowId.y - p.y) / d, 6);
  });
});

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

describe('updateControlled: the derived controlled player (criteria 4 and 5)', () => {
  it('is the ball owner when an outfield player of the team has the ball', () => {
    const w = world();
    givePossession(w.ball, at(w.players[7], 500, 500), 0);
    const controlled: [number, number] = [-1, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(7);
  });
  it('is never the goalkeeper, even when the keeper holds the ball or is the nearest', () => {
    const w = world();
    givePossession(w.ball, at(w.players[0], 30, 650), 0);
    at(w.players[3], 300, 650);
    const controlled: [number, number] = [-1, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(3);
    // team 1: the keeper is 10 u from the ball, an outfield player 200 u away
    at(w.players[9], 40, 650);
    at(w.players[11], 240, 650);
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[1]).toBe(11);
  });
  it('picks the nearest outfield player with the lowest id breaking exact ties', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[8], 1000, 600 - 70);   // id 8, 70 u
    at(w.players[2], 1000 + 70, 600);   // id 2, 70 u
    at(w.players[5], 1000, 600 + 130);  // farther
    const controlled: [number, number] = [-1, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(2);
  });
  it('keeps the current one when a teammate is only 30 u closer (hysteresis)', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[6], 1000 + 100, 600);   // current, 100 u
    at(w.players[3], 1000 - 70, 600);    // 70 u: 30 closer, below CONTROL_HYSTERESIS
    const controlled: [number, number] = [6, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(6);
  });
  it('switches when a teammate is 41 u closer', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[6], 1000 + 100, 600);
    at(w.players[3], 1000 - 59, 600);    // 41 closer
    const controlled: [number, number] = [6, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(3);
    expect(CONTROL_HYSTERESIS).toBe(40);
  });
  it('ignores hysteresis when the current controlled id is not a valid outfield player of the team', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[3], 1000 - 300, 600);
    const controlled: [number, number] = [0, 9];    // both keepers: never valid as controlled
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(3);
    expect(w.players[controlled[1]].team).toBe(1);
    expect(w.players[controlled[1]].role).not.toBe('gk');
  });
  it('a rival owner does not become our controlled: our nearest does', () => {
    const w = world();
    givePossession(w.ball, at(w.players[12], 1000, 600), 0);
    at(w.players[4], 1000 - 90, 600);
    const controlled: [number, number] = [-1, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(4);
    expect(controlled[1]).toBe(12);
  });
});
