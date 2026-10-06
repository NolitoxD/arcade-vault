import { describe, expect, it } from 'vitest';
import { humanProfile, profileFor } from '../football-logic/ai';
import { STEPS_PER_SECOND } from '../football-logic/clock';
import { GOAL_PAUSE_STEPS, NORMAL_RULES, createMatch, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { PLAYER_SPEED } from '../football-logic/players';
import { shootoutTakerId } from '../football-logic/set-pieces';
import { FORMATIONS, TEAMS, TEAM_SIZE } from '../football-logic/teams';
import {
  CAPTION_STEPS, collectCaptions, createCaptionState, createMatchWatch, goalScoredThisStep, updateWatch, type MatchWatch,
} from './captions';
import {
  CELEBRATION_STEPS, HUG_RING_SLOTS, HUG_RUN_SPEED, SHOOTOUT_HOLD_STEPS, beginCelebrationForGoal, capturePreStep,
  celebrationHoldsCamera, celebrationView, createCelebration, createCelebrationView, createPreStep, goalHubId,
  resetCelebration, stepCelebration,
} from './celebration';
import { createMatchRun, stepMatchRun } from './match-run';
import { RUN_FAST_SPEED_SQ, facingOctant } from './sprite-frame';
import { POSE_DEJECTED, POSE_HUG } from './sprite-maps';

function newMatch(): MatchState {
  return createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
}

// A watch that has seen the match once, in open play: what runStep holds on a goal step.
function watching(m: MatchState): MatchWatch {
  const w = createMatchWatch();
  collectCaptions(m, w, 0, createCaptionState());
  updateWatch(m, w);
  w.phase = 'play';
  return w;
}

// Team 1 scores through its forward TEAM_SIZE + 9, from the kickoff positions.
function goalByTeam1(m: MatchState): number {
  const scorer = m.players[TEAM_SIZE + 9];
  m.ball.lastTouchId = scorer.id;
  m.score[1] = 1;
  m.phase = 'goal';
  return scorer.id;
}

describe('the hub of the hug', () => {
  it('goalHubId: the scorer; for an own goal the scoring team\'s active outfielder nearest the ball', () => {
    const m = newMatch();
    const scorer = goalByTeam1(m);
    expect(goalHubId(m, 1)).toBe(scorer);
    m.ball.lastTouchId = 3;            // a team-0 defender: own goal
    m.ball.x = 2100;
    m.ball.y = 700;
    const near = m.players[TEAM_SIZE + 4];
    near.x = 2090;
    near.y = 705;
    expect(goalHubId(m, 1)).toBe(near.id);
    near.sentOff = true;               // nobody who left the pitch hosts it
    expect(goalHubId(m, 1)).not.toBe(near.id);
    expect(m.players[goalHubId(m, 1)].team).toBe(1);
  });
});

describe('beginCelebrationForGoal / celebrationView (G15-4)', () => {
  it('gives the ring slots nearest first to the scoring team\'s active outfielders, and to nobody else', () => {
    const m = newMatch();
    const w = watching(m);
    const hub = m.players[goalByTeam1(m)];
    m.players[TEAM_SIZE + 2].sentOff = true;
    const c = createCelebration();
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    expect([c.kind, c.hubId]).toEqual(['goal', hub.id]);
    let last = -1;
    let slots = 0;
    for (let k = 0; k < HUG_RING_SLOTS; k++) {
      const id = c.slot.indexOf(k);
      if (id < 0) break;
      const p = m.players[id];
      expect([p.team, p.role === 'gk', id === hub.id]).toEqual([1, false, false]);
      const d = Math.hypot(p.x - hub.x, p.y - hub.y);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
      slots++;
    }
    expect(slots).toBe(TEAM_SIZE - 3);   // eleven minus the keeper, the hub and the one sent off
    for (let i = 0; i < TEAM_SIZE; i++) expect(c.slot[i]).toBe(-1);
    expect([c.slot[TEAM_SIZE], c.slot[TEAM_SIZE + 2]]).toEqual([-1, -1]);
  });

  it('a team-mate runs at HUG_RUN_SPEED (the normal run, not the sprint) straight to his slot, then hugs facing the hub; the engine is never written', () => {
    const m = newMatch();
    const w = watching(m);
    const hub = m.players[goalByTeam1(m)];
    const c = createCelebration();
    const view = createCelebrationView();
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    const mate = m.players[c.slot.indexOf(0)];
    const sx = mate.x;
    const sy = mate.y;
    expect(Math.hypot(sx - hub.x, sy - hub.y)).toBeGreaterThan(4 * HUG_RUN_SPEED);
    // D5 (Paco, "trotando"): the team-mates run at the NORMAL run speed, never the sprint.
    expect(HUG_RUN_SPEED * STEPS_PER_SECOND).toBe(PLAYER_SPEED);
    expect((HUG_RUN_SPEED * STEPS_PER_SECOND) ** 2).toBeLessThan(RUN_FAST_SPEED_SQ);   // run frames, not sprint frames
    stepCelebration(c, 'goal');
    stepCelebration(c, 'goal');
    expect(celebrationView(c, mate, view)).toBe(true);
    expect(Math.hypot(view.x - sx, view.y - sy)).toBeCloseTo(2 * HUG_RUN_SPEED, 3);
    expect(view.pose).not.toBe(POSE_HUG);
    expect([mate.x, mate.y]).toEqual([sx, sy]);
    while (c.kind !== 'none' && view.pose !== POSE_HUG) {
      stepCelebration(c, 'goal');
      celebrationView(c, mate, view);
    }
    expect(view.pose).toBe(POSE_HUG);
    expect(Math.hypot(view.x - hub.x, view.y - hub.y)).toBeLessThan(40);
    expect(view.octant).toBe(facingOctant(hub.x - view.x, hub.y - view.y));
  });

  it('rivals hang their heads where they stand; the hub and the scoring keeper celebrate in place; nothing after a reset', () => {
    const m = newMatch();
    const w = watching(m);
    const hub = m.players[goalByTeam1(m)];
    const c = createCelebration();
    const view = createCelebrationView();
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    const rival = m.players[4];
    expect(celebrationView(c, rival, view)).toBe(true);
    expect([view.x, view.y, view.pose, view.octant])
      .toEqual([rival.x, rival.y, POSE_DEJECTED, facingOctant(rival.facingX, rival.facingY)]);
    const keeper = m.players[TEAM_SIZE];
    celebrationView(c, keeper, view);
    expect([view.x, view.y, view.pose]).toEqual([keeper.x, keeper.y, POSE_HUG]);
    celebrationView(c, hub, view);
    expect([view.x, view.y, view.pose]).toEqual([hub.x, hub.y, POSE_HUG]);
    resetCelebration(c);
    expect(celebrationView(c, rival, view)).toBe(false);
  });

  it('stepCelebration: a goal lasts its pause and the kickoff ends it; a golden goal runs CELEBRATION_STEPS in over; the shootout SHOOTOUT_HOLD_STEPS (1 s)', () => {
    expect(CELEBRATION_STEPS).toBe(GOAL_PAUSE_STEPS);
    // D1 (Paco, 06-oct): the camera holds ONE second, and the GOL caption of the shootout lasts the same.
    expect(SHOOTOUT_HOLD_STEPS).toBe(STEPS_PER_SECOND);
    expect(SHOOTOUT_HOLD_STEPS).toBe(CAPTION_STEPS['shootout-goal']);
    const m = newMatch();
    const w = watching(m);
    goalByTeam1(m);
    const c = createCelebration();
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    let live = 0;
    for (let i = 0; i < GOAL_PAUSE_STEPS * 2 && c.kind !== 'none'; i++) {
      stepCelebration(c, 'goal');
      live++;
    }
    expect(live).toBe(CELEBRATION_STEPS);
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    stepCelebration(c, 'goal');
    stepCelebration(c, 'kickoff');
    expect(c.kind).toBe('none');
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    for (let i = 0; i < CELEBRATION_STEPS - 1; i++) stepCelebration(c, 'over');
    expect(c.kind).toBe('goal');
    stepCelebration(c, 'over');
    expect(c.kind).toBe('none');
    w.phase = 'shootout';
    const pre = createPreStep();
    pre.takerId = 4;
    beginCelebrationForGoal(c, m, w, 0, pre);
    for (let i = 0; i < SHOOTOUT_HOLD_STEPS - 1; i++) stepCelebration(c, 'shootout');
    expect(c.kind).toBe('shootout');
    stepCelebration(c, 'shootout');
    expect(c.kind).toBe('none');
  });

  it('the shootout: only the man who took the kick celebrates, where he took it, and the camera holds on that spot', () => {
    const m = newMatch();
    const w = watching(m);
    w.phase = 'shootout';
    const pre = createPreStep();
    pre.takerId = 4;
    pre.takerX = 249;
    pre.takerY = 715;
    pre.spotX = 231;
    pre.spotY = 715;
    m.players[4].x = 980;              // the engine already parked him in the centre circle
    const c = createCelebration();
    const view = createCelebrationView();
    beginCelebrationForGoal(c, m, w, 0, pre);
    expect([c.kind, celebrationHoldsCamera(c), c.camX, c.camY]).toEqual(['shootout', true, 231, 715]);
    expect(celebrationView(c, m.players[4], view)).toBe(true);
    expect([view.x, view.y, view.pose, view.octant]).toEqual([249, 715, POSE_HUG, facingOctant(-1, 0)]);
    expect(celebrationView(c, m.players[5], view)).toBe(false);
    expect(celebrationView(c, m.players[TEAM_SIZE + 4], view)).toBe(false);
    pre.takerId = -1;
    beginCelebrationForGoal(c, m, w, 0, pre);
    expect([c.kind, celebrationHoldsCamera(c)]).toEqual(['none', false]);
  });
});

describe('the celebration against real matches, read step by step', () => {
  // MEASURED 06-oct: CPU v CPU, seed 14, difficulty 8, ESPAÑA v ITALIA: first goal on step
  // 9765, team 1, nearest team-mate 34 u from the scorer.
  it('a real goal (seed 14, difficulty 8): begun on the goal step, the nearest team-mate is hugging before the kickoff, and the kickoff ends it', () => {
    const run = createMatchRun(TEAMS[0], TEAMS[1], 14, 8, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const w = createMatchWatch();
    const c = createCelebration();
    const pre = createPreStep();
    const view = createCelebrationView();
    collectCaptions(m, w, 'none', createCaptionState());
    updateWatch(m, w);
    let begun = -1;
    let live = 0;
    let hugged = false;
    let endedAtKickoff = false;
    for (let i = 0; i < 20_000 && m.phase !== 'over'; i++) {
      capturePreStep(m, pre);
      stepMatchRun(run);
      const was = c.kind;
      stepCelebration(c, m.phase);
      if (was === 'goal' && c.kind === 'none') {
        endedAtKickoff = m.phase === 'kickoff';
        break;
      }
      const team = goalScoredThisStep(m, w);
      if (team !== -1 && begun < 0) {
        beginCelebrationForGoal(c, m, w, team, pre);
        begun = m.stepCount;
      }
      updateWatch(m, w);
      if (c.kind !== 'goal') continue;
      live++;
      const mate = m.players[c.slot.indexOf(0)];
      if (celebrationView(c, mate, view) && view.pose === POSE_HUG) hugged = true;
    }
    expect(begun).toBeGreaterThan(0);
    expect(live).toBe(GOAL_PAUSE_STEPS);
    expect(hugged).toBe(true);
    expect(endedAtKickoff).toBe(true);
  });

  // MEASURED 06-oct: seed 16, difficulty 5 goes to penalties; team 0 scores three, all from
  // the spot at x 231 (the taker stands at x 249), and on each goal step the engine has
  // moved the taker to the centre circle and the set piece to x 1969.
  it('a real shootout (seed 16): each goal celebrates the man who took that kick, at his kick, with the camera held there', () => {
    const run = createMatchRun(TEAMS[0], TEAMS[1], 16, 5, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const w = createMatchWatch();
    const c = createCelebration();
    const pre = createPreStep();
    collectCaptions(m, w, 'none', createCaptionState());
    updateWatch(m, w);
    let goals = 0;
    for (let i = 0; i < 20_000 && m.phase !== 'over'; i++) {
      capturePreStep(m, pre);
      stepMatchRun(run);
      stepCelebration(c, m.phase);
      const team = goalScoredThisStep(m, w);
      if (team !== -1) {
        beginCelebrationForGoal(c, m, w, team, pre);
        const sh = m.shootout;
        expect(sh).not.toBeNull();
        if (sh === null) return;
        expect([c.kind, c.hubId]).toEqual(['shootout', shootoutTakerId(team, sh.taken[team] - 1)]);
        expect([c.hubX, c.hubY, c.camX, c.camY]).toEqual([pre.takerX, pre.takerY, pre.spotX, pre.spotY]);
        expect(m.players[c.hubId].x).not.toBe(c.hubX);
        expect(m.setPiece === null ? c.camX : m.setPiece.x).not.toBe(c.camX);
        if (goals === 0) {
          // MEASURED 06-oct, independent of capturePreStep: taker 1 kicked from (249, 715) at the spot (231, 715),
          // while the ball sat at x 10 -- so neither takerY nor ball.x can pass for takerX / spotX.
          expect([pre.takerId, pre.takerX, pre.takerY, pre.spotX, pre.spotY]).toEqual([1, 249, 715, 231, 715]);
          expect([c.hubX, c.hubY, c.camX, c.camY]).toEqual([249, 715, 231, 715]);
        }
        goals++;
      }
      updateWatch(m, w);
    }
    expect(goals).toBe(3);
  });
});
