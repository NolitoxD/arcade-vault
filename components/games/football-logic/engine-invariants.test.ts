import { describe, expect, it } from 'vitest';
import { FORMATIONS, TEAMS } from './teams';
import { PITCH, goalLineX, isInsideBigArea, isInsideSmallArea } from './pitch';
import { dist } from './geometry';
import { createRng } from './rng';
import { createTeamInput, checkTeamInput, copyTeamInput, type TeamInput } from './input';
import { createMatch, stepMatch, type MatchPhase, type MatchState } from './match';
import { GK_LINE_DIST, isPlayerDown, type PlayerState } from './players';
import { HALF_STEPS } from './step';
import { createAiState, decideTeamInput, profileFor, type AiProfile, type AiState } from './ai';
import { checkGoalkeepersInBox } from './invariants';

// The STRUCTURAL half of the two recorded files (ai.test.ts, match.test.ts): every
// property here is number-free, so it survives every engine change of V15-4 and stays
// green while those two files carry their PENDING_REBASELINE marks. If one of these
// goes red, it is a REGRESSION, never a re-baseline.
const CAP = 20000;

function fresh(): MatchState {
  return createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
}

// V15-4 (pre-flight finding H3): the keeper is found BY ROLE, never by index. The
// whole point of this file is that it cannot be fooled by a team-size change, and
// `players[t * 9]` is exactly the kind of literal that fooled ai.test.ts.
function keeperOf(m: MatchState, t: 0 | 1): PlayerState {
  for (let i = 0; i < m.players.length; i++) {
    const p = m.players[i];
    if (p.team === t && p.role === 'gk') return p;
  }
  throw new Error(`team ${t} has no goalkeeper`);   // structural: this alone is a failure
}

function keeperLineDist(m: MatchState, t: 0 | 1): number {
  const gk = keeperOf(m, t);
  const side = m.attackDir[t] === 1 ? 0 : 1;
  return Math.abs(gk.x - (goalLineX(m.pitch, side) + m.attackDir[t] * GK_LINE_DIST));
}

// The G12-3 "come out" condition, RE-DERIVED from the geometry and never by calling
// keeperStep: a keeper may leave its line outside the small area only to press a ball
// that is its to press. Copied, on purpose, from ai.test.ts's keeperWouldPressG12_3.
function keeperWouldPressG12_3(m: MatchState, t: 0 | 1): boolean {
  const gk = keeperOf(m, t);
  const side = m.attackDir[t] === 1 ? 0 : 1;
  const { ball, players, stepCount } = m;
  const ownerTeam = ball.owner === null ? null : players[ball.owner].team;
  if (ownerTeam === gk.team) return false;
  const inSmall = isInsideSmallArea(m.pitch, side, ball.x, ball.y);
  const inBig = isInsideBigArea(m.pitch, side, ball.x, ball.y);
  if (!inSmall && !(inBig && ownerTeam !== null)) return false;
  const mine = dist(gk.x, gk.y, ball.x, ball.y);
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team !== gk.team || q.id === gk.id || isPlayerDown(q, stepCount)) continue;
    if (dist(q.x, q.y, ball.x, ball.y) < mine) return false;
  }
  return true;
}

type Run = {
  match: MatchState; recorded: [TeamInput, TeamInput][]; invalid: number; outsideBox: number;
  phases: Set<MatchPhase>; leftLineWithoutPressReason: number; keepers: number;
};

function playCpu(seed: number, cap = CAP): Run {
  const match = fresh();
  const profiles: [AiProfile, AiProfile] = [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)];
  const states: [AiState, AiState] = [createAiState(), createAiState()];
  const cpuRngs = [createRng(seed ^ 0x1234), createRng(seed ^ 0x5678)];
  const rng = createRng(seed);
  const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
  const recorded: [TeamInput, TeamInput][] = [];
  const phases = new Set<MatchPhase>();
  const prevLine: [number, number] = [0, 0];
  let prevOpen = false;
  let invalid = 0;
  let outsideBox = 0;
  let leftLineWithoutPressReason = 0;
  let keepers = 0;
  let steps = 0;
  while (match.phase !== 'over' && steps < cap) {
    decideTeamInput(match, 0, profiles[0], states[0], cpuRngs[0], live[0]);
    decideTeamInput(match, 1, profiles[1], states[1], cpuRngs[1], live[1]);
    if (checkTeamInput(live[0], FORMATIONS.length).length > 0) invalid++;
    if (checkTeamInput(live[1], FORMATIONS.length).length > 0) invalid++;
    const frame: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    copyTeamInput(live[0], frame[0]);
    copyTeamInput(live[1], frame[1]);
    recorded.push(frame);
    const open = match.phase === 'play' || match.phase === 'golden-goal';
    // Captured BEFORE stepMatch, on the exact state keeperStep sees this step.
    const pressed: [boolean, boolean] = open
      ? [keeperWouldPressG12_3(match, 0), keeperWouldPressG12_3(match, 1)]
      : [false, false];
    stepMatch(match, live, rng);
    phases.add(match.phase);
    outsideBox += checkGoalkeepersInBox(match.players, match.attackDir, match.pitch).length;
    for (const t of [0, 1] as const) {
      const off = keeperLineDist(match, t);
      if (open && prevOpen && off > prevLine[t] + 1e-9) {
        const gk = keeperOf(match, t);
        const side = match.attackDir[t] === 1 ? 0 : 1;
        if (!isInsideSmallArea(match.pitch, side, gk.x, gk.y) && !pressed[t]) leftLineWithoutPressReason++;
      }
      prevLine[t] = off;
    }
    // Exactly one goalkeeper per team, every step: the sending off (T6) and the
    // substitution (T5) must never leave a team without one, nor with two.
    let gk0 = 0;
    let gk1 = 0;
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i];
      if (p.role !== 'gk') continue;
      if (p.team === 0) gk0++;
      else gk1++;
    }
    if (gk0 !== 1 || gk1 !== 1) keepers++;
    prevOpen = open;
    steps++;
  }
  return { match, recorded, invalid, outsideBox, phases, leftLineWithoutPressReason, keepers };
}

function replay(seed: number, recorded: readonly [TeamInput, TeamInput][]): MatchState {
  const match = fresh();
  const rng = createRng(seed);
  for (const frame of recorded) stepMatch(match, frame, rng);
  return match;
}

function sameFinal(a: MatchState, b: MatchState): boolean {
  if (a.phase !== b.phase || a.stepCount !== b.stepCount || a.half !== b.half) return false;
  if (a.score[0] !== b.score[0] || a.score[1] !== b.score[1]) return false;
  if (a.ball.x !== b.ball.x || a.ball.y !== b.ball.y || a.ball.owner !== b.ball.owner) return false;
  for (let i = 0; i < a.players.length; i++) {
    if (a.players[i].x !== b.players[i].x || a.players[i].y !== b.players[i].y) return false;
  }
  return true;
}

describe('engine invariants (number-free: they survive every V15-4 change)', () => {
  const SEED = 14;
  const run = playCpu(SEED);

  it('a full CPU-vs-CPU match ends, never produces an invalid TeamInput and never lets a keeper out of its box', () => {
    expect(run.match.phase).toBe('over');
    expect(run.match.stepCount).toBeGreaterThan(HALF_STEPS);
    expect(run.invalid).toBe(0);
    expect(run.outsideBox).toBe(0);
  });

  // H3: the one structural property of ai.test.ts that this file did NOT copy, and
  // the reason it passed green while ai.test.ts lost it. It is 0 today, it must be 0
  // for ever, and a non-zero value is NEVER re-baselined: it is investigated.
  it('every off-line move outside the small area has a G12-3 press reason, and each team keeps exactly one goalkeeper', () => {
    expect(run.leftLineWithoutPressReason).toBe(0);
    expect(run.keepers, 'some step had a team with zero or two goalkeepers').toBe(0);
  });

  it('the same seed replays to the same final state, and the recorded inputs replay through the engine alone', () => {
    expect(sameFinal(run.match, playCpu(SEED).match)).toBe(true);
    expect(sameFinal(run.match, replay(SEED, run.recorded))).toBe(true);
  });

  it('a different seed does NOT produce the same final state (the negative control of the two above)', () => {
    expect(sameFinal(run.match, playCpu(SEED + 1).match)).toBe(false);
  });

  it('the match drives the phase machine, not only `play`', () => {
    for (const phase of ['kickoff', 'play', 'set-piece', 'over'] as const) {
      expect(run.phases, `phase ${phase} was never visited`).toContain(phase);
    }
  });

  it('twelve more seeds, 900 steps each: no invalid input, no keeper out of its box, no off-line move without a reason', () => {
    for (let seed = 100; seed < 112; seed++) {
      const g = playCpu(seed, 900);
      expect(g.invalid, `seed ${seed}`).toBe(0);
      expect(g.outsideBox, `seed ${seed}`).toBe(0);
      expect(g.leftLineWithoutPressReason, `seed ${seed}`).toBe(0);
      expect(g.keepers, `seed ${seed}`).toBe(0);
    }
  });
});
