import { describe, expect, it } from 'vitest';
import { PITCH } from './pitch';
import { FORMATIONS } from './teams';
import { createTeamInput, type Axis, type TeamInput } from './input';
import { createPlayers, type PlayerState } from './players';
import { createBall, givePossession, kickBall, LONG_PASS_VZ, type BallState } from './ball';
import { STEPS_PER_SECOND, STEP_MS, perStep, stepPhysics, stepsFor, type AttackDirs } from './step';

const F = FORMATIONS[0];
const ATTACK: AttackDirs = [1, -1];
// Arbitrary outfield ids; the derived "controlled" arrives in Task 3.
const CONTROLLED: readonly [number, number] = [4, 13];
const HALF_STEPS = stepsFor(90);

// Step at which criterion 1 forces a free-ball phase (see kickTowards below).
// 300 avoids the negative test's flip point (s >= 1200) so the two effects never overlap,
// and it lands well before any sprint/tackle window so it cannot be confused with those.
const KICK_STEP = 300;
// The "long pass" example speed documented next to LONG_PASS_VZ in ball.ts.
const KICK_SPEED = 560;
// A static, non-controlled forward (id 7): its position never changes under stepPhysics
// (see "non-controlled players never move" below), so aiming the kick at it gives a
// reproducible straight-line flight/bounce/roll that ends in a real pickup — verified by
// simulation to land ~70 steps later while the ball still has ~500 u/s of roll speed left,
// i.e. comfortably inside POSSESSION_RADIUS and not resting exactly on its boundary.
const KICK_TARGET_ID = 7;

type World = { players: PlayerState[]; ball: BallState };

function createWorld(): World {
  const players = createPlayers([F, F], PITCH);
  const ball = createBall();
  givePossession(ball, players[4], 0);
  return { players, ball };
}

// Deterministic script from the step number alone: no rng, no state reads.
// Both teams move in changing directions and sprint in bursts; team 1 lags by a phase.
function script(step: number, team: 0 | 1, out: TeamInput): void {
  const phase = Math.floor(step / 45) + team * 7;
  out.dx = ((phase % 3) - 1) as Axis;
  out.dy = ((Math.floor(phase / 2) % 3) - 1) as Axis;
  out.c = step % 240 < 100 ? 'held' : 'up';
}

function run(steps: number, mutate?: (step: number, inputs: [TeamInput, TeamInput]) => void): World {
  const w = createWorld();
  const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
  for (let s = 0; s < steps; s++) {
    script(s, 0, inputs[0]);
    script(s, 1, inputs[1]);
    if (mutate) mutate(s, inputs);
    stepPhysics(w.players, w.ball, inputs, CONTROLLED, ATTACK, PITCH, s);
  }
  return w;
}

// Explicit field-by-field comparisons (no JSON.stringify) so a future field addition to
// PlayerState/BallState forces a conscious update here instead of silently passing unchecked.
function samePlayer(p: PlayerState, q: PlayerState): boolean {
  return (
    p.id === q.id &&
    p.team === q.team &&
    p.role === q.role &&
    p.slot === q.slot &&
    p.x === q.x &&
    p.y === q.y &&
    p.vx === q.vx &&
    p.vy === q.vy &&
    p.facingX === q.facingX &&
    p.facingY === q.facingY &&
    p.sprintStepsLeft === q.sprintStepsLeft &&
    p.sprintCooldownSteps === q.sprintCooldownSteps &&
    p.downUntilStep === q.downUntilStep &&
    p.chargeSteps === q.chargeSteps &&
    p.chargeButton === q.chargeButton &&
    p.tackleStepsLeft === q.tackleStepsLeft &&
    p.tackleDirX === q.tackleDirX &&
    p.tackleDirY === q.tackleDirY
  );
}

function sameBall(x: BallState, y: BallState): boolean {
  return (
    x.x === y.x &&
    x.y === y.y &&
    x.z === y.z &&
    x.vx === y.vx &&
    x.vy === y.vy &&
    x.vz === y.vz &&
    x.owner === y.owner &&
    x.ownerSinceStep === y.ownerSinceStep &&
    x.lastTouchTeam === y.lastTouchTeam &&
    x.lastTouchId === y.lastTouchId &&
    x.kickerId === y.kickerId &&
    x.kickLockUntilStep === y.kickLockUntilStep
  );
}

function sameWorld(a: World, b: World): boolean {
  for (let i = 0; i < a.players.length; i++) {
    if (!samePlayer(a.players[i], b.players[i])) return false;
  }
  return sameBall(a.ball, b.ball);
}

// Aims a straight, deterministic pass from `kicker` at `target`'s current position. Not part of
// `script` (which stays step-number-only): this is a one-off event, not a per-step input, and it
// legitimately reads world state (both kicker and target) the same way the reviewer's own example
// (`kickBall(w.ball, w.players[4], ...)`) needs a live PlayerState to hand to kickBall.
function kickTowards(ball: BallState, kicker: PlayerState, target: PlayerState, stepCount: number): void {
  const dx = target.x - kicker.x;
  const dy = target.y - kicker.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  kickBall(ball, kicker, dx / mag, dy / mag, KICK_SPEED, LONG_PASS_VZ, stepCount);
}

describe('fixed step', () => {
  it('STEP_MS is 1000/60 and stepsFor rounds seconds to whole steps', () => {
    expect(STEPS_PER_SECOND).toBe(60);
    expect(STEP_MS).toBeCloseTo(16.6667, 3);
    expect(stepsFor(90)).toBe(5400);
    expect(stepsFor(0.4)).toBe(24);
    expect(stepsFor(0.25)).toBe(15);
  });
  it('perStep converts u/s to u per step', () => {
    expect(perStep(180)).toBe(3);
    expect(perStep(560) * 60).toBeCloseTo(560, 10);
  });
});

describe('determinism — the test that rules (criterion 1)', () => {
  it('the same input sequence reproduces the same world step by step over a full half (5400 steps)', () => {
    const a = createWorld();
    const b = createWorld();
    const ia: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const ib: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    let firstMismatch = -1;
    let sawFreeBall = false;
    let sawRepickup = false;
    let prevOwner: number | null = a.ball.owner;
    for (let s = 0; s < HALF_STEPS && firstMismatch < 0; s++) {
      script(s, 0, ia[0]); script(s, 1, ia[1]);
      script(s, 0, ib[0]); script(s, 1, ib[1]);
      if (s === KICK_STEP) {
        // Force a real free-ball phase (flight, bounce, roll, pickup) inside the compared
        // window — the plain script never releases the ball, so flyAndRoll/pickUp were
        // previously untested by "the test that rules".
        kickTowards(a.ball, a.players[CONTROLLED[0]], a.players[KICK_TARGET_ID], s);
        kickTowards(b.ball, b.players[CONTROLLED[0]], b.players[KICK_TARGET_ID], s);
      }
      stepPhysics(a.players, a.ball, ia, CONTROLLED, ATTACK, PITCH, s);
      stepPhysics(b.players, b.ball, ib, CONTROLLED, ATTACK, PITCH, s);
      if (prevOwner !== null && a.ball.owner === null) sawFreeBall = true;
      if (sawFreeBall && prevOwner === null && a.ball.owner !== null) sawRepickup = true;
      prevOwner = a.ball.owner;
      if (!sameWorld(a, b)) firstMismatch = s;
    }
    expect(firstMismatch).toBe(-1);
    // The kick actually put the ball through a free-ball phase and it was picked back up —
    // otherwise this test would still only be certifying player movement and ball-sticking.
    expect(sawFreeBall).toBe(true);
    expect(sawRepickup).toBe(true);
    // Not vacuous: the controlled players actually moved, the ball travelled with its owner,
    // and the extra ball fields sameWorld now checks actually changed because of the kick.
    const start = createWorld();
    expect(a.players[4].x).not.toBe(start.players[4].x);
    expect(a.players[13].y).not.toBe(start.players[13].y);
    expect(a.ball.x).not.toBe(start.ball.x);
    expect(a.ball.kickerId).toBe(CONTROLLED[0]);
    expect(a.ball.lastTouchId).not.toBe(CONTROLLED[0]);
    expect(a.ball.owner).toBe(KICK_TARGET_ID);
  });
  it('a different input sequence produces a different world (proves the comparison is not blind)', () => {
    const a = run(HALF_STEPS);
    const b = run(HALF_STEPS, (s, inputs) => {
      if (s >= 1200) inputs[1].dx = (-inputs[1].dx) as Axis;
    });
    expect(sameWorld(a, b)).toBe(false);
    expect(a.players[13].x).not.toBe(b.players[13].x);
  });
  it('non-controlled players never move under stepPhysics (the AI arrives in Task 6)', () => {
    const w = run(600);
    const start = createWorld();
    for (const p of w.players) {
      if (p.id === CONTROLLED[0] || p.id === CONTROLLED[1]) continue;
      expect([p.x, p.y]).toEqual([start.players[p.id].x, start.players[p.id].y]);
    }
  });
});
