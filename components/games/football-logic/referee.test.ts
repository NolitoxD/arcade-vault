import { describe, expect, it } from 'vitest';
import { PITCH, centerY, penaltySpotX } from './pitch';
import { createBall, type BallState } from './ball';
import type { AttackDirs } from './step';
import {
  createRefereeCall, judgeBall, judgeFoul, teamAttackingSide, teamDefendingSide,
  type RefereeCall, type RestartKind, type SetPieceKind,
} from './referee';

const FIRST_HALF: AttackDirs = [1, -1]; // team 0 shoots at side 1, defends side 0
const SECOND_HALF: AttackDirs = [-1, 1];
const CY = centerY(PITCH);

function ball(over: Partial<BallState>): BallState {
  return { ...createBall(), ...over };
}

function judge(b: BallState, attackDir: AttackDirs = FIRST_HALF): RefereeCall {
  const out = createRefereeCall();
  judgeBall(b, attackDir, PITCH, out);
  return out;
}

// Ruling R1 (compile-time-only check): every RestartKind the referee can call
// must be assignable to SetPieceKind, since Task 5 narrows a RefereeCall['kind']
// to RestartKind and passes it straight into beginSetPiece (whose kind param is
// SetPieceKind). This test only needs to type-check; the runtime assertion is
// incidental.
describe('RestartKind (ruling R1)', () => {
  it('is assignable to SetPieceKind', () => {
    const restart: RestartKind = 'penalty';
    const asSetPiece: SetPieceKind = restart;
    expect(asSetPiece).toBe('penalty');
  });
});

describe('sides', () => {
  it('teamAttackingSide / teamDefendingSide follow attackDir, and flip in the second half', () => {
    expect(teamAttackingSide(FIRST_HALF, 1)).toBe(0);
    expect(teamAttackingSide(FIRST_HALF, 0)).toBe(1);
    expect(teamDefendingSide(FIRST_HALF, 0)).toBe(0);
    expect(teamDefendingSide(SECOND_HALF, 0)).toBe(1);
  });
});

describe('goal', () => {
  it('a ball past the goal line, between the posts and under the bar is a goal for the attacking team', () => {
    const c = judge(ball({ x: -3, y: CY + 40, z: 20, lastTouchTeam: 1 }));
    expect(c).toMatchObject({ kind: 'goal', team: 1, x: 0 });
    const d = judge(ball({ x: PITCH.width + 7, y: CY - 33, z: 0, lastTouchTeam: 0 }));
    expect(d).toMatchObject({ kind: 'goal', team: 0, x: PITCH.width });
  });
  it('in the second half the same line scores for the other team', () => {
    expect(judge(ball({ x: -3, y: CY + 40, z: 20 }), SECOND_HALF).team).toBe(0);
  });
  it('over the crossbar is not a goal (it is a goal kick if the attacker touched it last)', () => {
    const c = judge(ball({ x: -3, y: CY, z: PITCH.crossbarHeight + 10, lastTouchTeam: 1 }));
    expect(c.kind).toBe('goal-kick');
  });
  it('wide of the posts is not a goal', () => {
    const c = judge(ball({ x: -3, y: CY + PITCH.goalWidth / 2 + 5, lastTouchTeam: 1 }));
    expect(c.kind).toBe('goal-kick');
  });
  it('a player carrying the ball across the line scores too', () => {
    const c = judge(ball({ x: PITCH.width + 4, y: CY - 10, z: 0, owner: 5, lastTouchTeam: 0 }));
    expect(c).toMatchObject({ kind: 'goal', team: 0 });
  });
  it('a ball still on the pitch is nothing', () => {
    expect(judge(ball({ x: 12, y: CY })).kind).toBe('none');
    expect(judge(ball({ x: PITCH.width - 1, y: 7 })).kind).toBe('none');
  });
});

describe('out of play', () => {
  it('over the end line, last touched by the defender: corner for the attacker at the near corner', () => {
    // side 0 is defended by team 0 in the first half
    const low = judge(ball({ x: -2, y: CY + 300, lastTouchTeam: 0 }));
    expect(low).toMatchObject({ kind: 'corner', team: 1, x: 0, y: PITCH.height });
    const high = judge(ball({ x: -2, y: CY - 300, lastTouchTeam: 0 }));
    expect(high).toMatchObject({ kind: 'corner', team: 1, x: 0, y: 0 });
  });
  it('over the end line, last touched by the attacker: goal kick for the defender at the small area edge', () => {
    const c = judge(ball({ x: PITCH.width + 2, y: 200, lastTouchTeam: 0 }));
    expect(c).toMatchObject({ kind: 'goal-kick', team: 1, x: PITCH.width - PITCH.smallAreaDepth, y: CY });
    const d = judge(ball({ x: -2, y: 200, lastTouchTeam: 1 }));
    expect(d).toMatchObject({ kind: 'goal-kick', team: 0, x: PITCH.smallAreaDepth, y: CY });
  });
  it('over a touch line: throw-in for the team that did not touch it last, at the crossing point', () => {
    const c = judge(ball({ x: 700, y: -2, lastTouchTeam: 0 }));
    expect(c).toMatchObject({ kind: 'throw-in', team: 1, x: 700, y: 0 });
    const d = judge(ball({ x: 1450, y: PITCH.height + 9, lastTouchTeam: 1 }));
    expect(d).toMatchObject({ kind: 'throw-in', team: 0, x: 1450, y: PITCH.height });
  });
  it('a carried ball beyond a touch line is not out (only free balls go out)', () => {
    expect(judge(ball({ x: 700, y: -5, owner: 3, lastTouchTeam: 0 })).kind).toBe('none');
  });

  // Ruling R8: the brief's original test used x = 2000 for the "clamps x" case,
  // which is already the maximum -- clamp(2000, 0, 2000) never actually moves
  // anything, so the assertion was decorative. It also accepted 'corner' OR
  // 'goal-kick' for a ball hit past a corner, which never named which rule
  // decides between them. Both are replaced below.
  it('a ball out past both the goal line and a touchline is judged by the goal line first (x priority)', () => {
    // x > width always wins over y being out of range too: the referee never
    // even reaches the touch-line check for this ball. lastTouchTeam alone
    // decides corner vs goal-kick here, so each case gets its own exact
    // assertion instead of one ambiguous OR.
    const defenderTouchedLast = judge(ball({ x: 2300, y: -2, lastTouchTeam: 1 })); // team 1 defends side 1
    expect(defenderTouchedLast).toMatchObject({ kind: 'corner', team: 0 });
    const attackerTouchedLast = judge(ball({ x: 2300, y: -2, lastTouchTeam: 0 }));
    expect(attackerTouchedLast).toMatchObject({ kind: 'goal-kick', team: 1 });
  });
  it('a throw-in only fires when the ball crosses a touchline, not a goal line, and keeps x untouched', () => {
    // x = 1999 is deliberately NOT a round number and NOT at 0/width, so this
    // case cannot be confused with the goal-line branch above or with the
    // clamp's own boundary value -- it is a genuine touch-line-only exit.
    const c = judge(ball({ x: 1999, y: PITCH.height + 1, lastTouchTeam: 1 }));
    expect(c).toMatchObject({ kind: 'throw-in', team: 0, x: 1999, y: PITCH.height });
  });
});

describe('fouls', () => {
  function foul(x: number, y: number, victim: 0 | 1, attackDir: AttackDirs = FIRST_HALF): RefereeCall {
    const out = createRefereeCall();
    judgeFoul(x, y, victim, attackDir, PITCH, out);
    return out;
  }
  it('inside the offender own big area: penalty for the victim at the spot', () => {
    // team 1 defends side 1 in the first half; its box starts at width - 320 = 1680
    const c = foul(1900, CY + 60, 0);
    expect(c).toMatchObject({ kind: 'penalty', team: 0, x: penaltySpotX(PITCH, 1), y: CY });
    const d = foul(140, CY - 200, 1);
    expect(d).toMatchObject({ kind: 'penalty', team: 1, x: penaltySpotX(PITCH, 0), y: CY });
  });
  it('outside the box: free kick for the victim where it happened', () => {
    expect(foul(1500, CY, 0)).toMatchObject({ kind: 'free-kick', team: 0, x: 1500, y: CY });
    expect(foul(1900, 100, 0)).toMatchObject({ kind: 'free-kick', team: 0, x: 1900, y: 100 }); // deep but too wide
  });
  it('the box moves with attackDir in the second half', () => {
    expect(foul(1900, CY + 60, 0, SECOND_HALF).kind).toBe('free-kick');
    expect(foul(140, CY, 0, SECOND_HALF).kind).toBe('penalty');
  });
  // Carried over from Task 3's review: stepTackle can produce foul = true with
  // victimId = <gk id> when a slide reaches a rival goalkeeper holding the ball
  // (the ball can never be stolen from a GK, only fouled next to it). The
  // tackler is always on the OTHER team from the goalkeeper (stepTackle skips
  // same-team victims), so the foul point sits inside the GOALKEEPER's team's
  // own box -- not the offender's. judgeFoul's rule is "inside the offender's
  // OWN big area", validated above by four cases including the attackDir-moves
  // one, so a foul the offender commits deep in the OPPOSING box (where every
  // GK naturally stands) is outside the offender's own area: a free kick for
  // the goalkeeper's team, not a penalty.
  it('a foul on a goalkeeper holding the ball in its own box is a free kick for the goalkeeper, not a penalty', () => {
    // team 1's goalkeeper defends side 1 (near x = width) in the first half;
    // the tackler (team 0) is never standing in ITS OWN box (near x = 0) here.
    const gkTeam: 0 | 1 = 1;
    const c = foul(PITCH.width - 10, CY, gkTeam);
    expect(c).toMatchObject({ kind: 'free-kick', team: gkTeam, x: PITCH.width - 10, y: CY });
  });
});
