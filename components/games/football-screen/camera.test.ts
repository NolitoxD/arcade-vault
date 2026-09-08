import { describe, expect, it } from 'vitest';
import { PITCH, centerX, centerY } from '../football-logic/pitch';
import { profileFor, type AiProfile } from '../football-logic/ai';
import { createMatch } from '../football-logic/match';
import { beginShootoutKick, createSetPieceState, createShootoutState } from '../football-logic/set-pieces';
import { FORMATIONS, TEAMS, type Formation, type TeamDef } from '../football-logic/teams';
import {
  PITCH_MARGIN, VIEW_H, VIEW_W, cameraMaxX, cameraMaxY, cameraMinX, cameraMinY,
  cameraTargetX, cameraTargetY, centreCamera, createCamera, followCamera, isOnScreen, toScreenX, toScreenY,
} from './camera';

describe('camera bounds', () => {
  it('the view is smaller than the pitch on both axes', () => {
    expect(VIEW_W).toBeLessThan(PITCH.width);
    expect(VIEW_H).toBeLessThan(PITCH.height);
  });

  it('the bounds allow exactly PITCH_MARGIN of surround on each side', () => {
    expect(cameraMinX(PITCH)).toBe(-PITCH_MARGIN);
    expect(cameraMaxX(PITCH)).toBe(PITCH.width + PITCH_MARGIN - VIEW_W);
    expect(cameraMinY(PITCH)).toBe(-PITCH_MARGIN);
    expect(cameraMaxY(PITCH)).toBe(PITCH.height + PITCH_MARGIN - VIEW_H);
  });
});

describe('centreCamera', () => {
  it('centres the target in the middle of the pitch', () => {
    const cam = createCamera();
    centreCamera(cam, centerX(PITCH), centerY(PITCH), PITCH);
    expect(cam.x).toBe(centerX(PITCH) - VIEW_W / 2);
    expect(cam.y).toBe(centerY(PITCH) - VIEW_H / 2);
  });

  it('clamps at all four corners, so the camera never leaves the pitch', () => {
    const cam = createCamera();
    centreCamera(cam, 0, 0, PITCH);
    expect(cam.x).toBe(cameraMinX(PITCH));
    expect(cam.y).toBe(cameraMinY(PITCH));
    centreCamera(cam, PITCH.width, PITCH.height, PITCH);
    expect(cam.x).toBe(cameraMaxX(PITCH));
    expect(cam.y).toBe(cameraMaxY(PITCH));
    centreCamera(cam, 0, PITCH.height, PITCH);
    expect(cam.x).toBe(cameraMinX(PITCH));
    expect(cam.y).toBe(cameraMaxY(PITCH));
    centreCamera(cam, PITCH.width, 0, PITCH);
    expect(cam.x).toBe(cameraMaxX(PITCH));
    expect(cam.y).toBe(cameraMinY(PITCH));
  });

  it('does not clamp a target that is comfortably inside', () => {
    const cam = createCamera();
    centreCamera(cam, 700, 500, PITCH);
    expect(cam.x).toBe(700 - VIEW_W / 2);
    expect(cam.y).toBe(500 - VIEW_H / 2);
  });
});

describe('followCamera', () => {
  it('moves a fraction of the way and converges without overshooting', () => {
    const cam = createCamera();
    centreCamera(cam, 600, 650, PITCH);
    const startX = cam.x;
    followCamera(cam, 1400, 650, PITCH, 0.25);
    const wanted = 1400 - VIEW_W / 2;
    expect(cam.x).toBeCloseTo(startX + (wanted - startX) * 0.25, 6);
    for (let i = 0; i < 200; i++) followCamera(cam, 1400, 650, PITCH, 0.25);
    expect(cam.x).toBeCloseTo(wanted, 3);
  });

  it('still clamps: chasing the corner never leaves the pitch', () => {
    const cam = createCamera();
    centreCamera(cam, centerX(PITCH), centerY(PITCH), PITCH);
    for (let i = 0; i < 500; i++) followCamera(cam, PITCH.width, PITCH.height, PITCH, 0.2);
    expect(cam.x).toBeLessThanOrEqual(cameraMaxX(PITCH));
    expect(cam.y).toBeLessThanOrEqual(cameraMaxY(PITCH));
  });
});

describe('world to screen', () => {
  it('subtracts the camera corner', () => {
    const cam = createCamera();
    cam.x = 400;
    cam.y = 250;
    expect(toScreenX(cam, 400)).toBe(0);
    expect(toScreenY(cam, 250)).toBe(0);
    expect(toScreenX(cam, 1200)).toBe(VIEW_W);
    expect(toScreenY(cam, 750)).toBe(VIEW_H);
  });

  it('isOnScreen accepts the margin band and rejects beyond it', () => {
    const cam = createCamera();
    cam.x = 400;
    cam.y = 250;
    expect(isOnScreen(cam, 400 - 20, 250 - 20, 30)).toBe(true);
    expect(isOnScreen(cam, 400 - 40, 250 - 20, 30)).toBe(false);
    expect(isOnScreen(cam, 1200 + 20, 750 + 20, 30)).toBe(true);
    expect(isOnScreen(cam, 1200 + 40, 750 + 20, 30)).toBe(false);
  });
});

// Fix round 1 (reviewer Important #1): cameraTargetX/Y had no direct test. The real
// guard in camera.ts is `match.phase === 'shootout' && match.setPiece !== null`, read
// against `match.setPiece.x/y`, not against `match.shootout` -- these fixtures drive
// the actual engine call (beginShootoutKick, set-pieces.ts) rather than hand-typing a
// SetPieceState, so a future edit to either cameraTargetX/Y or to the goal-side
// computation it depends on would break these.
describe('cameraTargetX/Y (shootout cut, S-SC8)', () => {
  const TEAM_PAIR: [TeamDef, TeamDef] = [TEAMS[0], TEAMS[1]];
  const PROFILES: readonly [AiProfile, AiProfile] = [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)];
  const FORMATION_PAIR: [Formation, Formation] = [FORMATIONS[0], FORMATIONS[0]];

  it('(a) open play: the target is the ball -- an off-centre position rules out a fixed answer', () => {
    const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES);
    m.phase = 'play';
    m.setPiece = null;
    // 333/444 is off-centre and far from both shootout answers below (1790 and 210),
    // so a bug that returned a goal x/y here could not be mistaken for the ball's.
    m.ball.x = 333;
    m.ball.y = 444;
    expect(cameraTargetX(m)).toBe(333);
    expect(cameraTargetY(m)).toBe(444);
  });

  it('(b) shootout, team 0 kicking (default attackDir [1,-1]): cuts to the goal team 0 attacks', () => {
    const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES);
    // createMatch's default attackDir is [1, -1] and createShootoutState() defaults
    // sh.team to 0 (S-PK3): team 0 kicks first.
    const sh = createShootoutState();
    beginShootoutKick(
      m.scratch.setPiece, sh, m.players, m.ball, FORMATION_PAIR, m.strategies, m.attackDir, m.pitch, m.stepCount,
    );
    m.setPiece = m.scratch.setPiece;
    m.phase = 'shootout';
    // beginShootoutKick also places the ball at the taker's feet, which sits near the
    // penalty spot -- too close to the set-piece target to catch a mutation that reads
    // match.ball instead of match.setPiece. Pull the ball away so the two can never
    // coincide, isolating exactly which one cameraTargetX/Y actually reads.
    m.ball.x = 50;
    m.ball.y = 50;

    // Hand-derived from beginShootoutKick (set-pieces.ts:293-295):
    //   defending = sh.team === 0 ? 1 : 0  = 1
    //   side      = ownGoalSide(attackDir[1]) = ownGoalSide(-1) = 1   (players.ts:56-58)
    //   sp.x      = penaltySpotX(PITCH, 1) = 2000 - 210 = 1790        (pitch.ts)
    //   sp.y      = centerY(PITCH)         = 1300 / 2   = 650
    expect(cameraTargetX(m)).toBe(1790);
    expect(cameraTargetY(m)).toBe(650);
  });

  it('(c) shootout, team 1 kicking: cuts to the OTHER goal, each on its own half of the pitch', () => {
    const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES);
    const sh = createShootoutState();
    sh.team = 1;
    beginShootoutKick(
      m.scratch.setPiece, sh, m.players, m.ball, FORMATION_PAIR, m.strategies, m.attackDir, m.pitch, m.stepCount,
    );
    m.setPiece = m.scratch.setPiece;
    m.phase = 'shootout';
    // Same reason as (b): decouple the ball from the set-piece spot so a mutation
    // that reads match.ball instead of match.setPiece cannot slip through unnoticed.
    m.ball.x = 50;
    m.ball.y = 50;

    // defending = sh.team === 0 ? 1 : 0  = 0  (team 1 is kicking now)
    // side      = ownGoalSide(attackDir[0]) = ownGoalSide(1) = 0
    // sp.x      = penaltySpotX(PITCH, 0) = 210
    const targetX = cameraTargetX(m);
    expect(targetX).toBe(210);
    // 1000 is centerX(PITCH) = 2000 / 2: the pitch midline that separates the two
    // goals. Team 0's target (b) sits on the right half, team 1's on the left --
    // never the same number, and never on the same side.
    expect(targetX).not.toBe(1790);
    expect(targetX).toBeLessThan(centerX(PITCH));
    expect(1790).toBeGreaterThan(centerX(PITCH));
  });

  it('(d) the clamp still applies after the cut: centring on the goal line cannot show past the pitch edge', () => {
    const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES);
    const sp = createSetPieceState();
    sp.x = PITCH.width; // the goal line itself (x=2000): the worst case for the right clamp
    sp.y = centerY(PITCH);
    m.setPiece = sp;
    m.phase = 'shootout';

    const cam = createCamera();
    centreCamera(cam, cameraTargetX(m), cameraTargetY(m), PITCH);
    // Unclamped this would centre at x = 2000 - VIEW_W / 2 = 1600, well past the
    // pitch edge. cameraMaxX(PITCH) = 2000 + 60 - 800 = 1260 is what clamping gives.
    expect(cam.x).toBe(cameraMaxX(PITCH));
    expect(cam.y).toBe(centerY(PITCH) - VIEW_H / 2);
  });
});
