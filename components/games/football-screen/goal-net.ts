import { centerY, type PitchDef } from '../football-logic/pitch';

// G11-4 (grill del paso 11, QA jugado del 11-sep: "un gesto de que el balón entra en
// la red"). Until now the goal was a flat translucent rectangle behind the line, with
// no posts and no net at all, so a goal read as the ball leaving the pitch.
//
// The measurement that makes this cheap: during the goal celebration the engine runs
// NO physics -- stepMatch's 'goal' branch (match.ts) only counts pauseStepsLeft down
// and then calls endGoalPause -- so the ball stays frozen exactly where judgeBall
// gave the goal, which is inside this mouth, for the whole 120-step pause. Nothing
// has to be remembered and no ghost ball has to be drawn: the net is painted inside
// drawPitch, BEFORE the players and the ball, and the real ball sits on top of it.
//
// The net that RIPPLES is v1.5 (G11-4). This one is a static grid.

// Moved here from VaultWorldCupGame.tsx so the rectangle that is drawn and the
// rectangle that is tested can never drift apart.
export const GOAL_MOUTH_DEPTH = 30;
// World units per cell. 150 / 10 and 30 / 10 give a mesh that reads as a net at the
// 1:1 scale the camera uses (world unit == pixel).
export const NET_CELL = 10;

// How many lines fall strictly INSIDE a span of `span` units every `cell` units. The
// two edges are the frame, drawn separately, so they are not counted here.
export function netLineCount(span: number, cell: number): number {
  if (span <= 0 || cell <= 0) return 0;
  const lines = Math.ceil(span / cell) - 1;
  return lines > 0 ? lines : 0;
}

// Is the ball in the box the net is drawn around? Used by the tests (and by the step-11
// probe) to state, as an assertion rather than as a comment, that a goal leaves the
// ball where the net is.
export function ballInsideGoalMouth(
  ballX: number, ballY: number, ballZ: number, pitch: PitchDef, depth = GOAL_MOUTH_DEPTH,
): boolean {
  if (ballZ >= pitch.crossbarHeight) return false;
  const halfGoal = pitch.goalWidth / 2;
  const midY = centerY(pitch);
  if (ballY < midY - halfGoal || ballY > midY + halfGoal) return false;
  if (ballX < 0) return ballX >= -depth;
  if (ballX > pitch.width) return ballX <= pitch.width + depth;
  return false;
}
