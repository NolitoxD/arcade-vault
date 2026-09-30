import { describe, expect, it } from 'vitest';
import { PITCH, centerY, goalLineX } from './pitch';
import { FORMATIONS, TEAMS, TEAM_SIZE } from './teams';
import {
  BALL_GROUND_DECEL, CONTROL_DIST, KICK_LOCK_STEPS, LONG_PASS_VZ, POSSESSION_RADIUS, canPickUp,
  createBall, givePossession, kickBall, stepBall, stickToOwner,
} from './ball';
import { PLAYER_HEIGHT, createPlayers, type PlayerState } from './players';
import { CROSSBAR_THICKNESS, postCentreY, type FrameHit } from './goal-frame';
import { createRefereeCall, judgeBall } from './referee';
import type { AttackDirs } from './step';

const F = FORMATIONS[0];

function world(): { players: PlayerState[]; ball: ReturnType<typeof createBall> } {
  const players = createPlayers([F, F], PITCH, [TEAMS[0].id, TEAMS[1].id]);
  // Park everyone far from the action so proximity pickups are explicit in each test.
  for (const p of players) { p.x = 50 + p.id * 10; p.y = 1250; }
  return { players, ball: createBall() };
}

describe('possession glued to the foot', () => {
  it('the ball sits CONTROL_DIST ahead of the owner along its facing, on the ground', () => {
    const { players, ball } = world();
    const p = players[4];
    p.x = 640; p.y = 410; p.facingX = 0.6; p.facingY = -0.8;
    givePossession(ball, p, 12);
    stickToOwner(ball, p);
    expect(ball.owner).toBe(4);
    expect(ball.ownerSinceStep).toBe(12);
    expect(ball.lastTouchTeam).toBe(0);
    expect(ball.lastTouchId).toBe(4);
    expect(ball.x).toBeCloseTo(640 + 0.6 * CONTROL_DIST, 10);
    expect(ball.y).toBeCloseTo(410 - 0.8 * CONTROL_DIST, 10);
    expect(ball.z).toBe(0);
    expect([ball.vx, ball.vy, ball.vz]).toEqual([0, 0, 0]);
  });
  it('stepBall follows the owner as it moves', () => {
    const { players, ball } = world();
    const p = players[13];
    givePossession(ball, p, 0);
    p.x += 33; p.y -= 21;
    stepBall(ball, players, 1, PITCH);
    expect(ball.x).toBeCloseTo(p.x + p.facingX * CONTROL_DIST, 10);
    expect(ball.y).toBeCloseTo(p.y + p.facingY * CONTROL_DIST, 10);
  });
});

describe('kickBall', () => {
  it('releases the owner, sets the velocity and locks the kicker for KICK_LOCK_STEPS', () => {
    const { players, ball } = world();
    const p = players[4];
    givePossession(ball, p, 0);
    stickToOwner(ball, p);
    kickBall(ball, p, 0.6, 0.8, 420, 0, 100);
    expect(ball.owner).toBeNull();
    expect(ball.vx).toBeCloseTo(252, 10);
    expect(ball.vy).toBeCloseTo(336, 10);
    expect(ball.kickerId).toBe(4);
    expect(ball.kickLockUntilStep).toBe(100 + KICK_LOCK_STEPS);
    expect(ball.lastTouchTeam).toBe(0);
    expect(canPickUp(ball, p, 100 + KICK_LOCK_STEPS - 3)).toBe(false);
    expect(canPickUp(ball, p, 100 + KICK_LOCK_STEPS + 2)).toBe(true);
    expect(KICK_LOCK_STEPS).toBe(15);
  });
});

describe('free ball physics', () => {
  it('a ground pass decelerates at BALL_GROUND_DECEL and stops', () => {
    const { players, ball } = world();
    const p = players[4];
    p.x = 300; p.y = 650; p.facingX = 1; p.facingY = 0;
    givePossession(ball, p, 0);
    stickToOwner(ball, p);
    kickBall(ball, p, 1, 0, 420, 0, 0);
    // after 0.5 s (30 steps) the speed has dropped by 130 u/s
    for (let s = 1; s <= 30; s++) stepBall(ball, players, s, PITCH);
    expect(ball.vx).toBeCloseTo(420 - BALL_GROUND_DECEL * 0.5, 6);
    for (let s = 31; s <= 400; s++) stepBall(ball, players, s, PITCH);
    expect(ball.vx).toBe(0);
    expect(ball.x).toBeGreaterThan(300 + 300);   // it travelled a real distance before stopping
  });
  it('a long pass rises above PLAYER_HEIGHT and lands ~350 u away (spec: "cae a ~350 u")', () => {
    const { players, ball } = world();
    const p = players[4];
    p.x = 500; p.y = 650; p.facingX = 1; p.facingY = 0;
    givePossession(ball, p, 0);
    stickToOwner(ball, p);
    const x0 = ball.x;
    kickBall(ball, p, 1, 0, 560, LONG_PASS_VZ, 0);
    let apex = 0;
    let landing = -1;
    for (let s = 1; s <= 200 && landing < 0; s++) {
      stepBall(ball, players, s, PITCH);
      if (ball.z > apex) apex = ball.z;
      if (s > 5 && ball.z === 0) landing = ball.x - x0;
    }
    expect(apex).toBeGreaterThan(PLAYER_HEIGHT);
    expect(landing).toBeGreaterThan(320);
    expect(landing).toBeLessThan(380);
  });
  it('bounces with BALL_BOUNCE and comes to rest on the ground', () => {
    const { players, ball } = world();
    ball.x = 900; ball.y = 700; ball.z = 60; ball.vz = 0;
    let bounced = false;
    for (let s = 0; s < 300; s++) {
      stepBall(ball, players, s, PITCH);
      if (ball.vz > 0) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(ball.z).toBe(0);
    expect(ball.vz).toBe(0);
  });
  it('nothing stops the ball leaving the pitch (the referee does, in Task 4)', () => {
    const { players, ball } = world();
    ball.x = PITCH.width - 30; ball.y = 100; ball.vx = 600;
    for (let s = 0; s < 30; s++) stepBall(ball, players, s, PITCH);
    expect(ball.x).toBeGreaterThan(PITCH.width);
  });
});

describe('pickup by proximity', () => {
  it('the nearest eligible player takes a free ball inside POSSESSION_RADIUS', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600;
    players[7].x = 1000 + 9; players[7].y = 600;      // 9 u away
    players[15].x = 1000; players[15].y = 600 + 17;   // 17 u away
    stepBall(ball, players, 5, PITCH);
    expect(ball.owner).toBe(7);
  });
  it('at exactly the same distance the lowest id wins, whatever the array order says', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600;
    players[16].x = 1000 - 11; players[16].y = 600;   // id 16, 11 u to the left
    players[3].x = 1000 + 11; players[3].y = 600;     // id 3, 11 u to the right
    stepBall(ball, players, 5, PITCH);
    expect(ball.owner).toBe(3);
  });
  it('a player just outside POSSESSION_RADIUS does not take it', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600;
    players[7].x = 1000 + POSSESSION_RADIUS + 3; players[7].y = 600;
    stepBall(ball, players, 5, PITCH);
    expect(ball.owner).toBeNull();
  });
  it('a ball above PLAYER_HEIGHT flies over a player standing right under it', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600; ball.z = PLAYER_HEIGHT + 8; ball.vz = 200;
    players[7].x = 1004; players[7].y = 600;
    stepBall(ball, players, 5, PITCH);
    expect(ball.owner).toBeNull();
  });
  // Whole-stage review C2: pickUp runs inside stepPhysics, BEFORE judgeBall, so
  // without this guard a player standing on a line took a ball that had already
  // gone out and stickToOwner teleported it back inside the pitch.
  it('a ball already over a line is not picked up, however close a player stands', () => {
    const { players, ball } = world();
    // Just over the touchline, with a player on the line 1 u away -- well inside
    // POSSESSION_RADIUS, so only the out-of-play guard can stop the pickup.
    ball.x = 743; ball.y = -1;
    players[6].x = 743; players[6].y = 0;
    stepBall(ball, players, 5, PITCH);
    expect(ball.owner).toBeNull();
    expect([ball.x, ball.y]).toEqual([743, -1]);
    // Same on the goal line, where the keeper stands: this is the goal C2 cancelled. The
    // keeper is found by ROLE (review-1b I4: players[9] had quietly become an outfield
    // player of the other team), and the ball crosses BETWEEN the posts -- 38 u above
    // centerY, the C2 fixture of match.test.ts -- so this really is a goal being judged.
    let keeper: PlayerState | undefined;
    for (const q of players) if (q.team === 1 && q.role === 'gk') keeper = q;
    if (keeper === undefined) throw new Error('team 1 has no goalkeeper');
    const goalY = centerY(PITCH) - 38;
    expect(Math.abs(goalY - centerY(PITCH))).toBeLessThan(PITCH.goalWidth / 2);
    ball.x = PITCH.width + 7.5; ball.y = goalY;
    keeper.x = PITCH.width; keeper.y = goalY;
    stepBall(ball, players, 6, PITCH);
    expect(ball.owner).toBeNull();
    // And the guard is not blanket-off: one unit inside the same line it still picks up.
    ball.x = PITCH.width - 1;
    stepBall(ball, players, 7, PITCH);
    expect(ball.owner).toBe(keeper.id);
  });
  // Stage B (S6): a moving ball reaching the keeper is decided by keeperCatch
  // (catchChance), never by the free pickup; a ball at rest is a loose ball.
  it('the keeper does not pick up a MOVING ball but does pick up one at rest (an outfield player takes both)', () => {
    const { players, ball } = world();
    const gk = players[TEAM_SIZE];   // team 1's keeper; canPickUp only cares about its ROLE
    // The spot is incidental (the rule is about the ball moving, not about the area), but
    // it is anchored to the pitch so it keeps sitting near team 1's goal line -- inside
    // its own small area, whose line moved with the x1.1 areas of G15-16.
    const line = goalLineX(PITCH, 1);
    gk.x = line - 40; gk.y = centerY(PITCH);
    ball.x = line - 30; ball.y = centerY(PITCH); ball.vx = -120; ball.vy = 0;   // 10 u away, rolling towards him
    expect(gk.x).toBeGreaterThan(PITCH.width - PITCH.smallAreaDepth);
    stepBall(ball, players, 5, PITCH);
    expect(ball.owner).toBeNull();
    ball.vx = 0; ball.vy = 0; ball.x = line - 30;
    stepBall(ball, players, 6, PITCH);
    expect(ball.owner).toBe(TEAM_SIZE);
    const { players: ps, ball: b } = world();
    ps[7].x = 1000; ps[7].y = 600;
    b.x = 1010; b.y = 600; b.vx = -120;
    stepBall(b, ps, 5, PITCH);
    expect(b.owner).toBe(7);
  });
  it('a down player, a tackling player and the locked kicker cannot pick up', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600;
    players[7].x = 1006; players[7].y = 600; players[7].downUntilStep = 50;
    players[8].x = 1000; players[8].y = 607; players[8].tackleStepsLeft = 4;
    players[2].x = 994; players[2].y = 600; ball.kickerId = 2; ball.kickLockUntilStep = 50;
    stepBall(ball, players, 20, PITCH);
    expect(ball.owner).toBeNull();
    stepBall(ball, players, 55, PITCH);   // the down player is up again, the lock expired: lowest id (2) wins the tie at 6 u
    expect(ball.owner).toBe(2);
  });
});

// G15-12 (V15-4-3): the frame lives inside stepBall, so these run the ball through the
// real step and hand each position to the real referee. Team 0 shoots at side 1.
describe('G15-12: the goal frame inside stepBall, judged by judgeBall', () => {
  const ATTACK: AttackDirs = [1, -1];
  // Rolls a shot at `side`'s goal line for up to 30 steps and reports what the frame did
  // and what the referee called first (or 'none' if the ball stayed in play). Side 1 is
  // attacked by team 0, side 0 by team 1.
  function shootAtGoal(y: number, z: number, side: 0 | 1 = 1): { hits: number; lastHit: FrameHit; call: string; ball: ReturnType<typeof createBall> } {
    const { players, ball } = world();
    const inward = side === 1 ? -1 : 1;
    ball.x = goalLineX(PITCH, side) + inward * 40; ball.y = y; ball.z = z; ball.vx = -inward * 600;
    ball.lastTouchTeam = side === 1 ? 0 : 1; ball.lastTouchId = side === 1 ? 5 : TEAM_SIZE + 5;
    const out = createRefereeCall();
    let hits = 0;
    let lastHit: FrameHit = 'none';
    for (let s = 1; s <= 30; s++) {
      stepBall(ball, players, s, PITCH);
      if (ball.frameHit !== 'none') { hits++; lastHit = ball.frameHit; }
      judgeBall(ball, ATTACK, PITCH, out);
      if (out.kind !== 'none') break;
    }
    return { hits, lastHit, call: out.kind, ball };
  }

  it('a shot at the post from inside the pitch bounces back into play: no goal, no goal kick', () => {
    const r = shootAtGoal(postCentreY(PITCH, 1), 0);
    expect(r.lastHit).toBe('post');
    expect(r.hits).toBe(1);
    expect(r.call).toBe('none');
    expect(r.ball.x).toBeLessThan(goalLineX(PITCH, 1));
    expect(r.ball.vx).toBeLessThan(0);
  });
  // Fix round 1 (review-3 I1): the same flight at the other goal.
  it('side 0: a shot at the post bounces back into play, once, with no call', () => {
    const r = shootAtGoal(postCentreY(PITCH, 0), 0, 0);
    expect(r.lastHit).toBe('post');
    expect(r.hits).toBe(1);
    expect(r.call).toBe('none');
    expect(r.ball.x).toBeGreaterThan(goalLineX(PITCH, 0));
    expect(r.ball.vx).toBeGreaterThan(0);
  });
  it('a shot between the posts is still a goal: the frame never touches it', () => {
    const r = shootAtGoal(centerY(PITCH), 0);
    expect(r.hits).toBe(0);
    expect(r.call).toBe('goal');
  });
  it('a ball over the crossbar is still OUT for the referee (G15-12: "por encima = fuera")', () => {
    const r = shootAtGoal(centerY(PITCH), PITCH.crossbarHeight + CROSSBAR_THICKNESS + 20);
    expect(r.hits).toBe(0);
    expect(r.call).toBe('goal-kick');
  });
});
