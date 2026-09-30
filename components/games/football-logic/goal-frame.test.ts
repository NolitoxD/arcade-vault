import { describe, expect, it } from 'vitest';
import { PITCH, centerY, goalLineX } from './pitch';
import { createBall, type BallState } from './ball';
import { FORMATIONS, TEAMS } from './teams';
import { createMatch, resumePlay, stepMatch } from './match';
import { HALF_STEPS } from './step';
import { createRng } from './rng';
import { createTeamInput, type TeamInput } from './input';
import { profileFor } from './ai';
import { BALL_RADIUS, CROSSBAR_THICKNESS, FRAME_BOUNCE, POST_RADIUS, bounceOffFrame, frameHitFor, postCentreY } from './goal-frame';

function ballAt(x: number, y: number, z: number, vx: number, vy: number): BallState {
  const b = createBall();
  b.x = x; b.y = y; b.z = z; b.vx = vx; b.vy = vy;
  return b;
}

describe('G15-12: the two posts are collision circles on the goal line', () => {
  it('the posts sit exactly on the two ends of the goal mouth', () => {
    expect(postCentreY(PITCH, 0)).toBe(centerY(PITCH) - PITCH.goalWidth / 2);
    expect(postCentreY(PITCH, 1)).toBe(centerY(PITCH) + PITCH.goalWidth / 2);
  });
  it('a low ball arriving at the post is a post hit; one arriving a metre inside is not', () => {
    const onPost = ballAt(goalLineX(PITCH, 1) - 2, postCentreY(PITCH, 1), 10, 600, 0);
    expect(frameHitFor(onPost, PITCH)).toBe('post');
    const inside = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), 10, 600, 0);
    expect(frameHitFor(inside, PITCH)).toBe('none');
  });
  // Fix round 1 (review-3 I1): side 0 had no hit test at all.
  it('side 0: a low ball arriving at the post is a post hit; one arriving a metre inside is not', () => {
    const onPost = ballAt(goalLineX(PITCH, 0) + 2, postCentreY(PITCH, 0), 10, -600, 0);
    expect(frameHitFor(onPost, PITCH)).toBe('post');
    const inside = ballAt(goalLineX(PITCH, 0) + 2, centerY(PITCH), 10, -600, 0);
    expect(frameHitFor(inside, PITCH)).toBe('none');
  });
  // Fix round 1 (review-3 M4): the post band has a top too -- a ball over the post is out.
  it('a ball above the top of a post is NOT a post hit', () => {
    const overPost = ballAt(goalLineX(PITCH, 1) - 2, postCentreY(PITCH, 1), PITCH.crossbarHeight + CROSSBAR_THICKNESS + 1, 600, 0);
    expect(frameHitFor(overPost, PITCH)).toBe('none');
  });
  it('a ball above the crossbar is NOT a frame hit (G15-12: "por encima = fuera")', () => {
    const over = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), PITCH.crossbarHeight + CROSSBAR_THICKNESS + 1, 600, 0);
    expect(frameHitFor(over, PITCH)).toBe('none');
  });
  it('a ball arriving AT the height of the crossbar is a crossbar hit', () => {
    const bar = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), PITCH.crossbarHeight + 1, 600, 0);
    expect(frameHitFor(bar, PITCH)).toBe('crossbar');
  });
  // Added in V15-4-3: the brief's negative control ("an infinitely wide crossbar") left
  // every test above green, so the crossbar's y bounds were protected by nothing.
  it('a ball wide of the posts at crossbar height is NOT a frame hit (it is out, not a rebound)', () => {
    const wide = ballAt(goalLineX(PITCH, 1) - 2, postCentreY(PITCH, 0) - (POST_RADIUS + BALL_RADIUS) - 20, PITCH.crossbarHeight + 1, 600, 0);
    expect(frameHitFor(wide, PITCH)).toBe('none');
  });
  // Added in V15-4-3 (controller ruling, option A): a cross played along the goal line
  // used to stick to the post and report a hit on every step.
  it('a ball rolling along the goal line, or away from it, is NOT a frame hit', () => {
    const alongLine = ballAt(goalLineX(PITCH, 1), postCentreY(PITCH, 0) - 5, 0, 0, 530);
    expect(frameHitFor(alongLine, PITCH)).toBe('none');
    const away = ballAt(goalLineX(PITCH, 1) - 2, postCentreY(PITCH, 1), 10, -300, 0);
    expect(frameHitFor(away, PITCH)).toBe('none');
    const alongOtherLine = ballAt(goalLineX(PITCH, 0), postCentreY(PITCH, 1) + 5, 0, 0, -530);
    expect(frameHitFor(alongOtherLine, PITCH)).toBe('none');
  });
  it('a ball nowhere near a goal is never a frame hit', () => {
    expect(frameHitFor(ballAt(1000, 400, 0, 100, 100), PITCH)).toBe('none');
  });
});

describe('G15-12: the bounce sends it back into the pitch and it loses speed', () => {
  it('a post bounce reverses the x component and keeps the ball inside', () => {
    const b = ballAt(goalLineX(PITCH, 1) - 2, postCentreY(PITCH, 1), 10, 600, 0);
    const speedBefore = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    bounceOffFrame(b, PITCH, 'post');
    expect(b.vx).toBeLessThan(0);
    expect(b.x).toBeLessThan(goalLineX(PITCH, 1));
    expect(Math.sqrt(b.vx * b.vx + b.vy * b.vy)).toBeLessThan(speedBefore);
    expect(Math.sqrt(b.vx * b.vx + b.vy * b.vy)).toBeCloseTo(speedBefore * FRAME_BOUNCE, 6);
  });
  it('side 0: a post bounce reverses the x component and keeps the ball inside', () => {
    const b = ballAt(goalLineX(PITCH, 0) + 2, postCentreY(PITCH, 0), 10, -600, 0);
    const speedBefore = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    bounceOffFrame(b, PITCH, 'post');
    expect(b.vx).toBeGreaterThan(0);
    expect(b.x).toBeGreaterThan(goalLineX(PITCH, 0));
    expect(Math.sqrt(b.vx * b.vx + b.vy * b.vy)).toBeCloseTo(speedBefore * FRAME_BOUNCE, 6);
  });
  it('a crossbar bounce drops it back into the field of play, not over the line', () => {
    const b = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), PITCH.crossbarHeight + 1, 600, 0);
    bounceOffFrame(b, PITCH, 'crossbar');
    expect(b.vx).toBeLessThan(0);
    expect(b.vz).toBeLessThanOrEqual(0);
    expect(b.x).toBeLessThan(goalLineX(PITCH, 1));
  });
  it('NEGATIVE CONTROL: a goal is still a goal -- the frame never eats a ball between the posts', () => {
    const b = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), 10, 600, 0);
    expect(frameHitFor(b, PITCH)).toBe('none');
    const before = { x: b.x, vx: b.vx };
    bounceOffFrame(b, PITCH, frameHitFor(b, PITCH));
    expect(b.x).toBe(before.x);
    expect(b.vx).toBe(before.vx);
  });
  it('POST_RADIUS and BALL_RADIUS are small enough that the mouth is still wider than the ball', () => {
    expect(PITCH.goalWidth - 2 * (POST_RADIUS + BALL_RADIUS)).toBeGreaterThan(4 * BALL_RADIUS);
  });
});

// Fix round 1 (review-3 I2): stepBall only runs in open play and on the shootout's resolve
// steps, so ball.frameHit is swept by stepMatch itself -- otherwise a hit on the step that
// changes phase would stay set for the whole pause and the screen would ring every step.
describe('G15-12: ball.frameHit is an event of ONE step, also across a phase change', () => {
  it('a post hit on the last step of the half is visible on that step and gone on the next', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
    const idle: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const rng = createRng(1);
    resumePlay(m);
    m.halfStep = HALF_STEPS - 1;   // this step ends the half
    // A free ball 12 u short of side 1's post, rolling at it: one step of flight (10 u)
    // puts it in the post's reach. Nobody is near: the post is the only event.
    m.ball.owner = null;
    m.ball.x = goalLineX(PITCH, 1) - 12; m.ball.y = postCentreY(PITCH, 1); m.ball.z = 0;
    m.ball.vx = 600; m.ball.vy = 0; m.ball.vz = 0;
    m.ball.lastTouchTeam = 0; m.ball.lastTouchId = 5;
    m.ball.kickerId = -1; m.ball.kickLockUntilStep = 0;
    stepMatch(m, idle, rng);
    expect(m.phase).toBe('half-time');
    expect(m.ball.frameHit).toBe('post');
    stepMatch(m, idle, rng);
    expect(m.phase).toBe('half-time');
    expect(m.ball.frameHit).toBe('none');
  });
});
