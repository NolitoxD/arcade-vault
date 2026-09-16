import { describe, expect, it } from 'vitest';
import { GOAL_PAUSE_STEPS, NORMAL_RULES, resumePlay } from '../football-logic/match';
import { PITCH, centerX, centerY } from '../football-logic/pitch';
import { TEAMS } from '../football-logic/teams';
import { createMatchRun, stepMatchRun } from './match-run';
import { GOAL_MOUTH_DEPTH, NET_CELL, ballInsideGoalMouth, netLineCount } from './goal-net';

const ESP = TEAMS[0];
const ITA = TEAMS[1];

describe('netLineCount', () => {
  it('counts the INTERIOR lines only: the two edges are the frame, not the net', () => {
    expect(netLineCount(150, 10)).toBe(14);
    expect(netLineCount(30, 10)).toBe(2);
    expect(netLineCount(10, 10)).toBe(0);
  });

  it('never returns a negative count, whatever it is handed', () => {
    expect(netLineCount(0, 10)).toBe(0);
    expect(netLineCount(-40, 10)).toBe(0);
    expect(netLineCount(150, 0)).toBe(0);
    expect(netLineCount(150, -5)).toBe(0);
  });

  it('draws a mesh fine enough to read as a net in both directions of the mouth', () => {
    expect(netLineCount(PITCH.goalWidth, NET_CELL)).toBeGreaterThanOrEqual(10);
    expect(netLineCount(GOAL_MOUTH_DEPTH, NET_CELL)).toBeGreaterThanOrEqual(2);
  });
});

describe('ballInsideGoalMouth', () => {
  const midY = centerY(PITCH);

  it('is true just behind either goal line, between the posts and under the bar', () => {
    expect(ballInsideGoalMouth(-8, midY, 0, PITCH)).toBe(true);
    expect(ballInsideGoalMouth(PITCH.width + 8, midY, 0, PITCH)).toBe(true);
  });

  it('is false on the pitch, however close to the line', () => {
    expect(ballInsideGoalMouth(1, midY, 0, PITCH)).toBe(false);
    expect(ballInsideGoalMouth(PITCH.width - 1, midY, 0, PITCH)).toBe(false);
  });

  it('is false past the back of the net, wide of the posts, or over the bar', () => {
    expect(ballInsideGoalMouth(-GOAL_MOUTH_DEPTH - 1, midY, 0, PITCH)).toBe(false);
    expect(ballInsideGoalMouth(-8, midY - PITCH.goalWidth, 0, PITCH)).toBe(false);
    expect(ballInsideGoalMouth(-8, midY, PITCH.crossbarHeight + 1, PITCH)).toBe(false);
  });
});

// The measurement this whole task rests on, turned into an assertion: if a future
// change to the engine ever snapped the ball back to the centre spot the moment a
// goal is given, the net would be drawn around an empty mouth and NOTHING else would
// notice. This test notices.
describe('the ball during the goal celebration (G11-4)', () => {
  it('stays frozen inside the goal mouth for the whole pause, and only then goes back to the spot', () => {
    const run = createMatchRun(ESP, ITA, 23, 5, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    resumePlay(m);
    // Rolled at the goal line, well wide of the keeper (which stands ~25 units off
    // its line in the middle): 60 units of offset put it outside GK_CATCH_RADIUS.
    m.ball.owner = null;
    m.ball.x = 2;
    m.ball.y = centerY(PITCH) - 60;
    m.ball.z = 0;
    m.ball.vx = -900;
    m.ball.vy = 0;
    m.ball.vz = 0;
    m.ball.lastTouchTeam = 1;

    stepMatchRun(run);
    expect(m.phase).toBe('goal');
    const goalX = m.ball.x;
    const goalY = m.ball.y;
    expect(ballInsideGoalMouth(goalX, goalY, m.ball.z, PITCH)).toBe(true);

    for (let i = 1; i < GOAL_PAUSE_STEPS; i++) {
      stepMatchRun(run);
      expect(m.phase).toBe('goal');
      expect(m.ball.x).toBe(goalX);
      expect(m.ball.y).toBe(goalY);
    }

    stepMatchRun(run);
    expect(m.phase).toBe('kickoff');
    expect(m.ball.x).toBeCloseTo(centerX(PITCH), 6);
    expect(ballInsideGoalMouth(m.ball.x, m.ball.y, m.ball.z, PITCH)).toBe(false);
  });
});
