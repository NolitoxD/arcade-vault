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
  aimPass, applyButtons, applyKeeperButtons, chargeFraction, createActionEvent, freestMateDir, longPass, pickPassTarget,
  releaseFromGoalkeeper, shoot, shortPass, shotSpeed, startTackle, steal, stepTackle, updateControlled,
  type ActionEvent,
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

describe('chargeFraction (deferred minor #13: one ramp for shotSpeed and shoot)', () => {
  it('is 0 at or below zero, linear in between, 1 at or beyond SHOT_CHARGE_STEPS', () => {
    expect(chargeFraction(-5)).toBe(0);
    expect(chargeFraction(0)).toBe(0);
    expect(chargeFraction(15)).toBeCloseTo(0.25, 10);
    expect(chargeFraction(SHOT_CHARGE_STEPS)).toBe(1);
    expect(chargeFraction(SHOT_CHARGE_STEPS + 9)).toBe(1);
  });
  it('shoot with a negative charge lobs nothing (vz 0) instead of a negative vz', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    givePossession(w.ball, p, 0);
    shoot(p, w.ball, 1, 0, -3, 0, w.out);
    expect(w.ball.vz).toBe(0);
    expect(Math.sqrt(w.ball.vx ** 2 + w.ball.vy ** 2)).toBeCloseTo(shotSpeed(0), 6);
  });
});

describe('pickPassTarget: the id aimPass locks onto (same scan, so the direction is bit-identical)', () => {
  it('returns the nearer mate in the cone for a short pass, the farther for a long one, -1 with nobody', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    // Anti-coincidence: world() parks the rest of the mates at (220..420, 1290), and from the
    // passer ids 3 and 4 fall INSIDE the -x cone (dot 0.749 and 0.731 >= INV_SQRT2). Park every
    // mate this test does not place straight BELOW the passer instead: |dx| << |dy| keeps them
    // out of the +x cone and the -x cone alike, so each assertion sees only its own actors.
    for (let i = 3; i <= 8; i++) if (i !== p.id) at(w.players[i], 990 + i, 1290);
    at(w.players[1], p.x + 150 * 0.9848078, p.y + 150 * 0.1736482); // 10 deg: (0.9848078, 0.1736482)
    at(w.players[2], p.x + 80 * 0.8660254, p.y + 80 * 0.5);         // 30 deg: (0.8660254, 0.5)
    expect(pickPassTarget(p, w.players, 1, 0, false, 0)).toBe(2);
    expect(pickPassTarget(p, w.players, 1, 0, true, 0)).toBe(1);
    expect(pickPassTarget(p, w.players, -1, 0, false, 0)).toBe(-1);
    const aim = { x: 0, y: 0 };
    aimPass(p, w.players, 1, 0, false, 0, aim);
    const d = dist2(p, w.players[2]);
    expect(aim.x).toBe((w.players[2].x - p.x) / d);   // exact: aimPass now derives the direction from the picked id
    expect(aim.y).toBe((w.players[2].y - p.y) / d);
  });
});

describe('freestMateDir: the outfield mate in OWN half farthest from every rival', () => {
  it('picks the mate with the largest nearest-rival distance among those in the keeper\'s half', () => {
    const w = world();
    const gk = at(w.players[0], 25, 650, 1, 0);   // team 0 defends side 0: own half is x < 1000
    const crowded = at(w.players[1], 400, 400);
    at(w.players[10], 430, 400);                   // rival 30 u from the crowded mate
    const free = at(w.players[2], 500, 900);
    at(w.players[11], 750, 900);                   // nearest rival 250 u away
    // Anti-coincidence (pre-flight H6): world() parks mates 4-8 at (260..420, 1290), in OWN half,
    // and mate 4 has the parked rival keeper 9 at (460, 1290) EXACTLY 200 u away. With the rival
    // at 200 u the "free" mate would win only by lowest id; at 250 u it wins by margin.
    expect(dist2(w.players[4], w.players[9])).toBe(200);
    at(w.players[3], 1300, 650);                   // freest of all but in the rival half: ignored
    const out = { x: 0, y: 0 };
    expect(freestMateDir(gk, w.players, 1, PITCH, out)).toBe(true);
    const d = dist2(gk, free);
    expect(out.x).toBeCloseTo((free.x - gk.x) / d, 10);
    expect(out.y).toBeCloseTo((free.y - gk.y) / d, 10);
    expect(dist2(gk, crowded)).toBeLessThan(d);    // not the nearest: the freest
  });
  it('returns false and leaves out untouched when every outfield mate is in the rival half', () => {
    const w = world();
    const gk = at(w.players[0], 25, 650, 1, 0);
    for (let i = 1; i <= 8; i++) at(w.players[i], 1200 + i * 10, 650);
    const out = { x: 7, y: 7 };
    expect(freestMateDir(gk, w.players, 1, PITCH, out)).toBe(false);
    expect(out).toEqual({ x: 7, y: 7 });
  });
});

describe('releaseFromGoalkeeper', () => {
  it('kicks a long pass at the freest own-half mate once GK_HOLD_STEPS have passed, and not before', () => {
    const w = world();
    const gk = at(w.players[9], 1975, 650, -1, 0);   // team 1 defends side 1: own half is x > 1000
    const target = at(w.players[12], 1500, 300);
    at(w.players[13], 1500, 1000);
    at(w.players[4], 1470, 1000);                     // rival crowds mate 13, so 12 is the freest
    givePossession(w.ball, gk, 100);
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, 100 + GK_HOLD_STEPS - 7, w.aim, w.out);
    expect(w.ball.owner).toBe(9);
    expect(w.out.kind).toBe('none');
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, 100 + GK_HOLD_STEPS, w.aim, w.out);
    expect(w.ball.owner).toBeNull();
    const d = dist2(gk, target);
    expect(w.ball.vx).toBeCloseTo(LONG_PASS_SPEED * (target.x - gk.x) / d, 6);
    expect(w.ball.vy).toBeCloseTo(LONG_PASS_SPEED * (target.y - gk.y) / d, 6);
    expect(w.ball.vz).toBe(LONG_PASS_VZ);
    expect(w.out.kind).toBe('gk-release');
    expect(GK_HOLD_STEPS).toBe(120);
  });
  it('falls back to a straight kick along attackDir when no mate is in its half', () => {
    const w = world();
    const gk = at(w.players[9], 1975, 650, -1, 0);
    for (let i = 10; i <= 17; i++) at(w.players[i], 300 + i, 650);
    givePossession(w.ball, gk, 0);
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, GK_HOLD_STEPS, w.aim, w.out);
    expect(w.ball.vx).toBeCloseTo(-LONG_PASS_SPEED, 6);
    expect(w.ball.vy).toBe(0);
  });
  it('does nothing for an outfield player or a keeper without the ball', () => {
    const w = world();
    const p = at(w.players[4], 500, 500);
    givePossession(w.ball, p, 0);
    releaseFromGoalkeeper(p, w.ball, w.players, 1, PITCH, 500, w.aim, w.out);
    expect(w.ball.owner).toBe(4);
    releaseFromGoalkeeper(w.players[0], w.ball, w.players, 1, PITCH, 500, w.aim, w.out);
    expect(w.ball.owner).toBe(4);
  });
  it('leaves `out` alone on its no-op paths (D4: the throw applyKeeperButtons wrote in the same slot this step survives)', () => {
    const w = world();
    const gk = at(w.players[9], 1975, 650, -1, 0);
    givePossession(w.ball, gk, 100);
    w.out.kind = 'short-pass'; w.out.ok = true; w.out.actorId = 9;
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, 100 + GK_HOLD_STEPS - 7, w.aim, w.out);   // holding: no-op
    expect(w.out.kind).toBe('short-pass');
    shortPass(gk, w.ball, -1, 0, 100 + GK_HOLD_STEPS, w.out);                                         // the ball left by button
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, 100 + GK_HOLD_STEPS, w.aim, w.out);       // not the owner: no-op
    expect(w.out.kind).toBe('short-pass');
    expect(w.ball.owner).toBeNull();
  });
});

describe('applyKeeperButtons (D4): the keeper holding the ball throws by button, exact, from the step after taking it', () => {
  // Team 1 keeper (id 9) on its line, attacking -x. Its eight outfield mates are
  // parked BEHIND it near the goal line at x = 1990, y = 100..170, so from the
  // keeper they lie almost straight up (+15, -480..-550): outside the -x cone,
  // the +y cone and the +x cone every test below opens. Only the mates each test
  // places with `at` are candidates. The keeper faces +y on purpose: a neutral
  // d-pad must open the cone along attackDir, never along the facing (S-GK.1).
  function holding(): World & { gk: PlayerState; input: TeamInput } {
    const w = world();
    for (let i = 10; i <= 17; i++) at(w.players[i], 1990, 100 + (i - 10) * 10);
    const gk = at(w.players[9], 1975, 650, 0, 1);
    givePossession(w.ball, gk, 100);
    return { ...w, gk, input: createTeamInput() };
  }
  function unitTo(from: PlayerState, to: PlayerState): { x: number; y: number } {
    const d = dist2(from, to);
    return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
  }
  it('B pressed with the d-pad on -x throws a SHORT pass at the nearest mate in the cone and turns the keeper to face it', () => {
    const s = holding();
    const near = at(s.players[12], 1775, 700);        // 206 u away, 14 deg off -x: in the cone
    at(s.players[13], 1475, 550);                     // 510 u away, 11 deg off -x: in the cone, farther
    s.input.dx = -1; s.input.b = 'pressed';
    applyKeeperButtons(s.gk, s.input, s.ball, s.players, -1, 101, s.aim, s.out);
    const u = unitTo(s.gk, near);
    expect(s.ball.owner).toBeNull();
    expect(s.ball.kickerId).toBe(9);
    expect(speedOf(s.ball)).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(s.ball.vz).toBe(0);
    expect(s.ball.vx / speedOf(s.ball)).toBeCloseTo(u.x, 10);
    expect(s.ball.vy / speedOf(s.ball)).toBeCloseTo(u.y, 10);
    expect([s.gk.facingX, s.gk.facingY]).toEqual([u.x, u.y]);
    expect(s.out).toMatchObject({ kind: 'short-pass', ok: true, foul: false, actorId: 9 });
  });
  it('A pressed throws a LONG pass at the farthest mate in the same cone', () => {
    const s = holding();
    at(s.players[12], 1775, 700);
    const far = at(s.players[13], 1475, 550);
    s.input.dx = -1; s.input.a = 'pressed';
    applyKeeperButtons(s.gk, s.input, s.ball, s.players, -1, 101, s.aim, s.out);
    const u = unitTo(s.gk, far);
    expect(s.ball.owner).toBeNull();
    expect(speedOf(s.ball)).toBeCloseTo(LONG_PASS_SPEED, 6);
    expect(s.ball.vz).toBe(LONG_PASS_VZ);
    expect(s.ball.vx / speedOf(s.ball)).toBeCloseTo(u.x, 10);
    expect(s.ball.vy / speedOf(s.ball)).toBeCloseTo(u.y, 10);
    expect(s.out).toMatchObject({ kind: 'long-pass', ok: true, actorId: 9 });
  });
  it('a neutral d-pad opens the cone along attackDir (towards the rival half), not along the keeper\'s facing; the d-pad on +y opens it there', () => {
    const neutral = holding();
    const ahead = at(neutral.players[12], 1775, 700);   // in the -x cone only
    at(neutral.players[14], 1975, 850);                 // 200 u straight down (+y): in the +y cone only
    neutral.input.b = 'pressed';                        // dx = dy = 0
    applyKeeperButtons(neutral.gk, neutral.input, neutral.ball, neutral.players, -1, 101, neutral.aim, neutral.out);
    const u = unitTo(neutral.gk, ahead);
    expect(neutral.ball.vx / speedOf(neutral.ball)).toBeCloseTo(u.x, 10);
    expect(neutral.ball.vy / speedOf(neutral.ball)).toBeCloseTo(u.y, 10);
    const down = holding();
    at(down.players[12], 1775, 700);
    const below = at(down.players[14], 1975, 850);
    down.input.dy = 1; down.input.b = 'pressed';
    applyKeeperButtons(down.gk, down.input, down.ball, down.players, -1, 101, down.aim, down.out);
    const v = unitTo(down.gk, below);
    expect(down.ball.vx / speedOf(down.ball)).toBeCloseTo(v.x, 10);
    expect(down.ball.vy / speedOf(down.ball)).toBeCloseTo(v.y, 10);
  });
  it('with nobody in the cone the throw goes straight along the aim (d-pad on +x: no mate that way)', () => {
    const s = holding();
    s.input.dx = 1; s.input.b = 'pressed';
    applyKeeperButtons(s.gk, s.input, s.ball, s.players, -1, 101, s.aim, s.out);
    expect(s.ball.vx).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(s.ball.vy).toBe(0);
    expect(s.out.kind).toBe('short-pass');
  });
  it('only a press fires: a held B (a steal attempt carried over) throws nothing; A and B pressed together -> A wins', () => {
    const held = holding();
    at(held.players[12], 1775, 700);
    held.input.dx = -1; held.input.b = 'held';
    applyKeeperButtons(held.gk, held.input, held.ball, held.players, -1, 101, held.aim, held.out);
    expect(held.ball.owner).toBe(9);
    expect(held.out.kind).toBe('none');
    const both = holding();
    at(both.players[12], 1775, 700);
    both.input.dx = -1; both.input.a = 'pressed'; both.input.b = 'pressed';
    applyKeeperButtons(both.gk, both.input, both.ball, both.players, -1, 101, both.aim, both.out);
    expect(both.out.kind).toBe('long-pass');
  });
  it('never on the step the keeper took the ball (S-GK.4), never for an outfield player, never for a keeper without the ball; no rng anywhere', () => {
    const same = holding();                           // ownerSinceStep = 100
    at(same.players[12], 1775, 700);
    same.input.dx = -1; same.input.b = 'pressed';
    applyKeeperButtons(same.gk, same.input, same.ball, same.players, -1, 100, same.aim, same.out);
    expect(same.ball.owner).toBe(9);
    expect(same.out.kind).toBe('none');
    applyKeeperButtons(same.gk, same.input, same.ball, same.players, -1, 101, same.aim, same.out);
    expect(same.ball.owner).toBeNull();
    const w = world();
    const p = at(w.players[4], 500, 500);
    givePossession(w.ball, p, 0);
    const input = createTeamInput(); input.b = 'pressed';
    applyKeeperButtons(p, input, w.ball, w.players, 1, 5, w.aim, w.out);
    expect(w.ball.owner).toBe(4);
    applyKeeperButtons(w.players[0], input, w.ball, w.players, 1, 5, w.aim, w.out);
    expect(w.ball.owner).toBe(4);
    expect(w.out.kind).toBe('none');
    // The signature has no rng: a throw can never move the deterministic draw count.
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
  // M9 (final review of stage C, I3). The screen's pad clears a button to 'up' with
  // no 'released' edge when the window blurs or the game is paused -- deliberately,
  // or the resumed match would fire a shot the player never asked for. The charge it
  // leaves behind used to survive for ever: the next tap of J went out at 950 instead
  // of 700, measured end to end.
  it('an armed charge whose button reads up is dropped, so the next press starts at zero', () => {
    const s = withBall();
    const rng = fixedRng([0.5]);
    s.input.a = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 0, s.aim, s.out);
    s.input.a = 'held';
    for (let step = 1; step < 60; step++) applyButtons(s.p, s.input, s.ball, s.players, rng, step, s.aim, s.out);
    expect(s.p.chargeSteps).toBe(60);
    expect(s.p.chargeButton).toBe('a');

    // The blur: 'up' without ever passing through 'released'.
    s.input.a = 'up';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 60, s.aim, s.out);
    expect(s.p.chargeSteps).toBe(0);
    expect(s.p.chargeButton).toBe('none');
    expect(s.out.kind).toBe('none');
    expect(s.ball.owner).toBe(5);

    // And the shot that follows the reset is a tap, not the cannon of the old charge.
    s.input.a = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 61, s.aim, s.out);
    expect(s.p.chargeSteps).toBe(1);
    s.input.a = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 62, s.aim, s.out);
    expect(s.out.kind).toBe('shot');
    expect(speedOf(s.ball)).toBeCloseTo(shotSpeed(1), 6);
    expect(rng.calls).toBe(0);
  });
  it('a stale released, after the charge was dropped, fires nothing', () => {
    const s = withBall();
    const rng = fixedRng([0.5]);
    s.input.a = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 0, s.aim, s.out);
    s.input.a = 'up';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 1, s.aim, s.out);
    expect(s.p.chargeButton).toBe('none');
    // The key really coming up later: an edge the engine never saw armed.
    s.input.a = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 2, s.aim, s.out);
    expect(s.out.kind).toBe('none');
    expect(s.ball.owner).toBe(5);
    expect(s.ball.vx).toBe(0);
    expect(s.ball.vy).toBe(0);
  });
  it('the charge of B is dropped the same way, and B held normally still accumulates', () => {
    const s = withBall();
    const rng = fixedRng([0.5]);
    s.input.b = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 0, s.aim, s.out);
    s.input.b = 'held';
    for (let step = 1; step < 30; step++) applyButtons(s.p, s.input, s.ball, s.players, rng, step, s.aim, s.out);
    expect(s.p.chargeSteps).toBe(30);   // a normal hold still ramps
    expect(s.p.chargeButton).toBe('b');
    s.input.b = 'up';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 30, s.aim, s.out);
    expect(s.p.chargeSteps).toBe(0);
    expect(s.p.chargeButton).toBe('none');
    expect(s.out.kind).toBe('none');
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
