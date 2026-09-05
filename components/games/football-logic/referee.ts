import { centerY, goalLineX, isBetweenPosts, isInsideBigArea, penaltySpotX, type PitchDef, type Side } from './pitch';
import type { BallState } from './ball';
import type { AttackDirs } from './step';

export type SetPieceKind = 'kickoff' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'penalty';
export type CallKind = 'none' | 'goal' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'penalty';

// Ruling R1: the subset of calls that restart play with a set piece (everything
// but 'none' and 'goal'). Task 5 narrows a RefereeCall['kind'] down to this type
// before handing it to beginSetPiece, so it must stay assignable to SetPieceKind
// (see the compile-time check in referee.test.ts) -- it always is here, since
// every restart kind the referee can call is also a set-piece kind; only
// 'kickoff' is a SetPieceKind the referee itself never calls.
export type RestartKind = Exclude<CallKind, 'none' | 'goal'>;

export type RefereeCall = { kind: CallKind; team: 0 | 1; x: number; y: number };

export function createRefereeCall(): RefereeCall {
  return { kind: 'none', team: 0, x: 0, y: 0 };
}

// Ruling R5: kept exported for Task 5, which calls this to reset the call
// in place before judging the ball each step (stepOpenPlay clears it before
// judgeFoul/judgeBall run so a stale call from a previous step never leaks).
export function clearRefereeCall(out: RefereeCall): void {
  out.kind = 'none';
  out.team = 0;
  out.x = 0;
  out.y = 0;
}

// The team shooting towards `side`: attackDir +1 aims at side 1.
export function teamAttackingSide(attackDir: AttackDirs, side: Side): 0 | 1 {
  const wanted = side === 1 ? 1 : -1;
  return attackDir[0] === wanted ? 0 : 1;
}

export function teamDefendingSide(attackDir: AttackDirs, side: Side): 0 | 1 {
  return teamAttackingSide(attackDir, side) === 0 ? 1 : 0;
}

function call(out: RefereeCall, kind: CallKind, team: 0 | 1, x: number, y: number): void {
  out.kind = kind;
  out.team = team;
  out.x = x;
  out.y = y;
}

// Goal is judged for any ball (walking it in counts); out of play only for a free ball.
export function judgeBall(ball: BallState, attackDir: AttackDirs, pitch: PitchDef, out: RefereeCall): void {
  clearRefereeCall(out);
  const side: Side | -1 = ball.x < 0 ? 0 : ball.x > pitch.width ? 1 : -1;
  if (side !== -1 && isBetweenPosts(pitch, ball.y) && ball.z < pitch.crossbarHeight) {
    call(out, 'goal', teamAttackingSide(attackDir, side), goalLineX(pitch, side), ball.y);
    return;
  }
  if (ball.owner !== null) return;
  if (side !== -1) {
    const defending = teamDefendingSide(attackDir, side);
    if (ball.lastTouchTeam === defending) {
      const attacking = defending === 0 ? 1 : 0;
      call(out, 'corner', attacking, goalLineX(pitch, side), ball.y < centerY(pitch) ? 0 : pitch.height);
    } else {
      const x = side === 0 ? pitch.smallAreaDepth : pitch.width - pitch.smallAreaDepth;
      call(out, 'goal-kick', defending, x, centerY(pitch));
    }
    return;
  }
  if (ball.y < 0 || ball.y > pitch.height) {
    // Ruling R15: `side === -1` here already guarantees `0 <= ball.x <= pitch.width`
    // (the goal-line branch above returns early otherwise), so clamping ball.x
    // was a no-op dead call -- assign it directly.
    const team: 0 | 1 = ball.lastTouchTeam === 0 ? 1 : 0;
    call(out, 'throw-in', team, ball.x, ball.y < 0 ? 0 : pitch.height);
  }
}

// Inside the offender's own big area: penalty; anywhere else: free kick where it happened.
export function judgeFoul(x: number, y: number, victimTeam: 0 | 1, attackDir: AttackDirs, pitch: PitchDef, out: RefereeCall): void {
  const offender: 0 | 1 = victimTeam === 0 ? 1 : 0;
  const ownSide: Side = attackDir[offender] === 1 ? 0 : 1;
  if (isInsideBigArea(pitch, ownSide, x, y)) {
    call(out, 'penalty', victimTeam, penaltySpotX(pitch, ownSide), centerY(pitch));
  } else {
    call(out, 'free-kick', victimTeam, x, y);
  }
}
