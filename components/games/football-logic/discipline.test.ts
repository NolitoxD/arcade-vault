import { describe, expect, it } from 'vitest';
import {
  CARD_RED_AT, CARD_YELLOW_AT, INJURY_CHANCE, INJURY_MAX_PER_TEAM, INJURY_WINDOW_STEPS, SENT_OFF_MAX, canInjure, cardForFouls,
  firstFreeReserveOfRole, hasSubstituteFor, isActive, registerFoul, sentOffCount,
} from './discipline';
import {
  callSetPiece, createMatch, endExtraTime, keeperOf, resumePlay, stepMatch, substitute, type MatchPhase, type MatchState,
} from './match';
import { createActionEvent, freestMateDir, pickPassTarget, steal, stepTackle, updateTeamControl } from './actions';
import { stepBall } from './ball';
import { createTeamInput, type TeamInput } from './input';
import { createRng, type Rng } from './rng';
import { FORMATIONS, TEAMS, TEAM_SIZE } from './teams';
import { PITCH, centerY } from './pitch';
import { createAiState, decideTeamInput, keeperStep, positionTeam, profileFor, type AiProfile, type AiState } from './ai';
import { SQUAD_SIZE, keeperAttrsFor, outfieldAttrsFor, squadRole } from './squads';
import { ATTR_SHOT_SPAN, ATTR_SPEED_SPAN, GK_LINE_DIST, TACKLE_STEPS, createPlayers, multForLevel } from './players';
import { shootoutTakerId } from './set-pieces';
import { checkTeamCount } from './invariants';

// G15-18 (v1.5, V15-4). Every match here is createMatch's, which builds its players with
// the ONE fixed signature of Task V15-4-2: createPlayers([FORMATIONS[0], FORMATIONS[0]],
// PITCH, ['espana', 'italia']) -- the first test pins that, so a change of createMatch's
// lineup cannot silently move the squad indices these tests name.
const PROFILES: readonly [AiProfile, AiProfile] = [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)];

function game(): MatchState {
  return createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, PROFILES);
}

function idleInputs(): [TeamInput, TeamInput] {
  return [createTeamInput(), createTeamInput()];
}

// A scripted Rng: returns `values` in a loop and counts its calls.
function fixedRng(values: readonly number[]): { rng: Rng; calls: () => number } {
  let i = 0;
  return { rng: () => values[i++ % values.length], calls: () => i };
}

// The match's own mulberry32, with its calls counted.
function countingRng(seed: number): { rng: Rng; calls: () => number } {
  const inner = createRng(seed);
  let n = 0;
  return { rng: () => { n++; return inner(); }, calls: () => n };
}

// Player 5 is team 0's first midfielder in 4-4-2 (slot 4), squad index 8; its two free
// midfield reserves are 12 and 13 (squads.ts: 2 GK, 6 DEF, 6 MID, 4 FWD).
const MID_VICTIM = 5;

// Stages a foul given AGAINST `victimId` on the next stepMatch: a rival of his slides
// into him from the SIDE (along y), which is a foul whatever way along x he faces
// (G15-24: only head-on is a clash). The ball is parked far from everybody, so the
// contact is the only event of that step and nobody draws from the Rng before the
// injury roll. Returns the offender's id.
function stageFoulOn(m: MatchState, victimId: number, x: number, y: number): number {
  if (m.phase === 'kickoff' || m.phase === 'set-piece') resumePlay(m);
  m.ball.owner = null;
  m.ball.x = 300; m.ball.y = 1300; m.ball.z = 0;
  m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0;
  m.ball.kickerId = -1; m.ball.kickLockUntilStep = 0;
  const victim = m.players[victimId];
  victim.x = x; victim.y = y; victim.downUntilStep = 0;
  victim.facingX = victim.team === 0 ? 1 : -1; victim.facingY = 0;
  const offender = m.players[victim.team === 0 ? TEAM_SIZE + 1 : 1];
  offender.x = x; offender.y = y - 15; offender.downUntilStep = 0;
  offender.tackleStepsLeft = 10;
  offender.tackleDirX = 0; offender.tackleDirY = 1;
  return offender.id;
}

const MID_X = 1500;
const MID_Y = 1100;

// One step that produces the foul, with the given Rng; asserts that it WAS a foul on
// the victim, so no test below can rot into a clash or a clean slide.
function foulStep(m: MatchState, victimId: number, rng: Rng, x = MID_X, y = MID_Y): void {
  const offenderId = stageFoulOn(m, victimId, x, y);
  stepMatch(m, idleInputs(), rng);
  expect(m.scratch.events[offenderId].foul, 'the staged slide was not given as a foul').toBe(true);
  expect(m.scratch.events[offenderId].victimId).toBe(victimId);
}

// Opens the injury window on MID_VICTIM (team 0) with a roll that injures.
function injureMidfielder(m: MatchState): void {
  foulStep(m, MID_VICTIM, fixedRng([0]).rng);
  expect(m.phase).toBe('injury');
  expect(m.pendingInjury[0]).toBe(MID_VICTIM);
}

function inputsWithSub(team: 0 | 1, sub: number): [TeamInput, TeamInput] {
  const inputs = idleInputs();
  inputs[team].sub = sub;
  return inputs;
}

describe('G15-18: injuries', () => {
  it('createMatch fields the squads of the fixed createPlayers signature (the indices below depend on it)', () => {
    const m = game();
    const direct = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH, ['espana', 'italia']);
    expect(m.players.map((p) => p.squadIndex)).toEqual(direct.map((p) => p.squadIndex));
    expect(m.players[MID_VICTIM].squadIndex).toBe(8);
    expect(m.players[MID_VICTIM].role).toBe('mid');
    expect(m.players.every((p) => !p.injured && isActive(p))).toBe(true);
    expect(m.injuriesUsed).toEqual([0, 0]);
    expect(m.pendingInjury).toEqual([-1, -1]);
  });

  it('a foul injures the victim with probability INJURY_CHANCE, and the roll only happens when a foul is actually given', () => {
    // Under the chance: injured, window open, one draw.
    const a = game();
    const under = fixedRng([0.05]);
    foulStep(a, MID_VICTIM, under.rng);
    expect(a.players[MID_VICTIM].injured).toBe(true);
    expect(a.phase).toBe('injury');
    expect(a.injuriesUsed[0]).toBe(1);
    expect(under.calls()).toBe(1);
    // Over the chance: a plain free kick, nobody hurt, still exactly one draw.
    const b = game();
    const over = fixedRng([0.5]);
    foulStep(b, MID_VICTIM, over.rng);
    expect(b.players[MID_VICTIM].injured).toBe(false);
    expect(b.phase).toBe('set-piece');
    expect(b.injuriesUsed[0]).toBe(0);
    expect(over.calls()).toBe(1);
    // No foul, no draw: an open-play step with the ball parked away from everybody.
    const c = game();
    resumePlay(c);
    c.ball.owner = null;
    c.ball.x = 300; c.ball.y = 1300; c.ball.vx = 0; c.ball.vy = 0;
    const quiet = countingRng(3);
    stepMatch(c, idleInputs(), quiet.rng);
    expect(c.phase).toBe('play');
    expect(quiet.calls()).toBe(0);
    // A foul that CANNOT injure (the team's cap is used) does not draw either: the
    // number of draws is part of the deterministic state.
    const d = game();
    d.injuriesUsed[0] = INJURY_MAX_PER_TEAM;
    const capped = countingRng(3);
    foulStep(d, MID_VICTIM, capped.rng);
    expect(d.phase).toBe('set-piece');
    expect(capped.calls()).toBe(0);
    // G15-18's "~8 %", pinned last so a changed chance fails on the behaviour above first.
    expect(INJURY_CHANCE).toBe(0.08);
  });

  it('a second injury in the same team never happens, EVEN AFTER the substitution (INJURY_MAX_PER_TEAM)', () => {
    expect(INJURY_MAX_PER_TEAM).toBe(1);
    const m = game();
    injureMidfielder(m);
    // The substitution: the slot is a different, healthy player now.
    stepMatch(m, inputsWithSub(0, 12), createRng(1));
    expect(m.phase).toBe('set-piece');
    expect(m.players[MID_VICTIM].injured).toBe(false);
    expect(m.players.some((p) => p.team === 0 && p.injured)).toBe(false);
    // Second foul on the same team, with a roll that WOULD injure.
    const second = countingRng(5);
    foulStep(m, 6, () => { second.rng(); return 0; });
    expect(m.phase, 'a second injury opened the window again').toBe('set-piece');
    expect(m.players[6].injured).toBe(false);
    expect(m.injuriesUsed[0]).toBe(1);
    expect(second.calls(), 'the capped foul still rolled the dice').toBe(0);
    // The OTHER team is still free to be injured: the cap is per team.
    foulStep(m, TEAM_SIZE + 5, fixedRng([0]).rng);
    expect(m.phase).toBe('injury');
    expect(m.pendingInjury[1]).toBe(TEAM_SIZE + 5);
  });

  it('the CPU substitutes automatically, with a reserve of the SAME role, and never waits a step', () => {
    const m = game();
    injureMidfielder(m);
    const states = [createAiState(), createAiState()];
    const inputs = idleInputs();
    const aiRng = countingRng(9);
    decideTeamInput(m, 0, PROFILES[0], states[0], aiRng.rng, inputs[0]);
    decideTeamInput(m, 1, PROFILES[1], states[1], aiRng.rng, inputs[1]);
    expect(inputs[0].sub).toBe(12);
    expect(inputs[1].sub).toBe(-1);
    expect(aiRng.calls(), 'the CPU drew from the Rng to choose its substitute').toBe(0);
    stepMatch(m, inputs, createRng(1));
    expect(m.phase).toBe('set-piece');
    const slot = m.players[MID_VICTIM];
    expect(slot.squadIndex).toBe(12);
    expect(squadRole(slot.squadIndex)).toBe(slot.role);
    expect(slot.injured).toBe(false);
    expect(m.pendingInjury).toEqual([-1, -1]);
  });

  it('a human team stops in phase injury until its TeamInput carries a sub, and the CLOCK does not advance', () => {
    const m = game();
    injureMidfielder(m);
    const halfStep = m.halfStep;
    const clockMs = m.clockMs;
    const rng = countingRng(4);
    for (let i = 0; i < 300; i++) stepMatch(m, idleInputs(), rng.rng);
    expect(300).toBeLessThan(INJURY_WINDOW_STEPS);
    expect(m.phase).toBe('injury');
    expect(m.halfStep).toBe(halfStep);
    expect(m.clockMs).toBe(clockMs);
    expect(m.injuryStepsLeft[0]).toBe(INJURY_WINDOW_STEPS - 300);
    expect(rng.calls(), 'the injury window drew from the Rng').toBe(0);
    // "cualquier posicion": a FORWARD for the injured midfielder is legal.
    stepMatch(m, inputsWithSub(0, 16), rng.rng);
    expect(m.phase).toBe('set-piece');
    expect(m.players[MID_VICTIM].squadIndex).toBe(16);
    expect(m.halfStep).toBe(halfStep);
  });

  it('the injury window times out: with nobody choosing, the reserve of that position comes on by itself', () => {
    expect(INJURY_WINDOW_STEPS).toBe(480);   // stepsFor(8) at 60 steps per second
    const m = game();
    injureMidfielder(m);
    const rng = createRng(2);
    for (let i = 0; i < INJURY_WINDOW_STEPS - 1; i++) stepMatch(m, idleInputs(), rng);
    expect(m.phase).toBe('injury');
    expect(m.players[MID_VICTIM].squadIndex).toBe(8);
    stepMatch(m, idleInputs(), rng);
    expect(m.phase).toBe('set-piece');
    expect(m.players[MID_VICTIM].squadIndex).toBe(firstFreeReserveOfRole(game(), 0, 'mid'));
    expect(m.players[MID_VICTIM].squadIndex).toBe(12);
    expect(m.players[MID_VICTIM].injured).toBe(false);
  });

  it('the set-piece countdown is frozen during the window and resumes where it was', () => {
    const m = game();
    injureMidfielder(m);
    const sp = m.setPiece;
    expect(sp).not.toBeNull();
    if (sp === null) return;
    const before = sp.stepsLeft;
    expect(before).toBeGreaterThan(1);
    for (let i = 0; i < 100; i++) stepMatch(m, idleInputs(), createRng(1));
    expect(m.setPiece?.stepsLeft).toBe(before);
    stepMatch(m, inputsWithSub(0, 13), createRng(1));
    expect(m.phase).toBe('set-piece');
    expect(m.setPiece?.stepsLeft).toBe(before);
    stepMatch(m, idleInputs(), createRng(1));
    expect(m.setPiece?.stepsLeft).toBe(before - 1);
  });

  it('with no reserve of his position left the team plays with one less when the window runs out, and the match does NOT stall', () => {
    // Unreachable through a legal lineup in V15-4 (checkLineup fixes the role of every
    // position and checkSquadCoversFormations leaves a reserve in every line), so the
    // state is staged: team 0's two forwards are re-labelled as the two free midfield
    // reserves, which leaves no midfielder on the bench.
    const m = game();
    m.players[9].squadIndex = 12;
    m.players[10].squadIndex = 13;
    expect(firstFreeReserveOfRole(m, 0, 'mid')).toBe(-1);
    injureMidfielder(m);
    const rng = createRng(6);
    for (let i = 0; i < INJURY_WINDOW_STEPS; i++) stepMatch(m, idleInputs(), rng);
    expect(m.phase).toBe('set-piece');
    expect(m.pendingInjury[0]).toBe(-1);
    const victim = m.players[MID_VICTIM];
    expect(victim.injured).toBe(true);
    expect(victim.squadIndex).toBe(8);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE - 1);
    expect(m.players.filter((p) => p.team === 1 && isActive(p))).toHaveLength(TEAM_SIZE);
    // Not stalled: the free kick is taken and play goes on, with the clock running.
    const halfStep = m.halfStep;
    for (let i = 0; i < 400; i++) stepMatch(m, idleInputs(), rng);
    expect(m.phase === 'play' || m.phase === 'set-piece' || m.phase === 'goal' || m.phase === 'kickoff').toBe(true);
    expect(m.halfStep).toBeGreaterThan(halfStep);
  });

  it('an injured GOALKEEPER is replaced by the SECOND keeper', () => {
    const m = game();
    const gk = keeperOf(m, 0);
    expect(gk.squadIndex).toBe(0);
    foulStep(m, gk.id, fixedRng([0]).rng, GK_LINE_DIST + 40, centerY(PITCH) + 60);
    expect(m.phase).toBe('injury');
    expect(m.pendingInjury[0]).toBe(gk.id);
    expect(hasSubstituteFor(m, 0, gk)).toBe(true);
    // The CPU picks the second keeper (it is the only legal choice).
    const inputs = idleInputs();
    decideTeamInput(m, 0, PROFILES[0], createAiState(), createRng(1), inputs[0]);
    expect(inputs[0].sub).toBe(1);
    stepMatch(m, inputs, createRng(1));
    expect(m.phase).toBe('set-piece');
    expect(keeperOf(m, 0)).toBe(gk);
    expect(gk.role).toBe('gk');
    expect(gk.squadIndex).toBe(1);
    expect(gk.injured).toBe(false);
    expect(m.players.filter((p) => p.team === 0 && p.role === 'gk' && isActive(p))).toHaveLength(1);
  });

  it('a goalkeeper with no keeper left is FLAGGED but keeps playing: the team is never without a goalkeeper', () => {
    // Staged (in V15-4 only a red card of Task V15-4-6 can use the second keeper up):
    // an outfield slot carries the second keeper's squad index, so no keeper is free.
    const m = game();
    m.players[1].squadIndex = 1;
    expect(firstFreeReserveOfRole(m, 0, 'gk')).toBe(-1);
    const gk = keeperOf(m, 0);
    expect(hasSubstituteFor(m, 0, gk)).toBe(false);
    const roll = fixedRng([0]);
    foulStep(m, gk.id, roll.rng, GK_LINE_DIST + 40, centerY(PITCH) + 60);
    expect(roll.calls(), 'the keeper injury is still rolled: the number of draws does not depend on the bench').toBe(1);
    expect(m.lastInjury).toBe(gk.id);
    expect(m.phase).toBe('set-piece');
    expect(m.pendingInjury[0]).toBe(-1);
    expect(gk.injured).toBe(false);
    expect(isActive(gk)).toBe(true);
    expect(gk.squadIndex).toBe(0);
    expect(m.injuriesUsed[0]).toBe(1);
    // The flag is a one-step edge, like the action events.
    stepMatch(m, idleInputs(), createRng(1));
    expect(m.lastInjury).toBe(-1);
  });

  it('NEGATIVE CONTROL: an illegal sub (an index already on the pitch, of another team, an outfield player for the keeper or the keeper for an outfield player) is ignored and the phase stays in injury', () => {
    const m = game();
    injureMidfielder(m);
    const rng = createRng(1);
    // Already on the pitch (team 0's own midfielder 9), and the injured one himself.
    for (const onPitch of [9, 8]) {
      stepMatch(m, inputsWithSub(0, onPitch), rng);
      expect(m.phase, `sub ${onPitch} is already on the pitch`).toBe('injury');
    }
    // Out of the squad, or not an index at all.
    for (const bad of [SQUAD_SIZE, -2, 12.5]) {
      stepMatch(m, inputsWithSub(0, bad), rng);
      expect(m.phase, `sub ${bad} is not a squad index`).toBe('injury');
    }
    // The keeper for an outfield player.
    stepMatch(m, inputsWithSub(0, 1), rng);
    expect(m.phase).toBe('injury');
    // A sub sent by the OTHER team, which has nobody injured.
    stepMatch(m, inputsWithSub(1, 12), rng);
    expect(m.phase).toBe('injury');
    expect(m.players[TEAM_SIZE + 5].squadIndex).toBe(8);
    expect(m.players[MID_VICTIM].squadIndex).toBe(8);
    // substitute() itself refuses with nobody pending.
    expect(substitute(m, 1, 12)).toBe(false);
    // An outfield player for the keeper.
    const k = game();
    const gk = keeperOf(k, 0);
    foulStep(k, gk.id, fixedRng([0]).rng, GK_LINE_DIST + 40, centerY(PITCH) + 60);
    expect(k.phase).toBe('injury');
    stepMatch(k, inputsWithSub(0, 12), rng);
    expect(k.phase).toBe('injury');
    expect(gk.squadIndex).toBe(0);
    // And the legal one is taken: this control is not vacuous.
    stepMatch(k, inputsWithSub(0, 1), rng);
    expect(k.phase).toBe('set-piece');
  });

  it('the substitute is a DIFFERENT player: his attributes come from his own squad index', () => {
    const m = game();
    injureMidfielder(m);
    const teamId = m.teams[0].id;
    const before = m.players[MID_VICTIM];
    const oldSpeed = before.speedMult;
    const oldShot = before.shotMult;
    // A free reserve whose levels differ from the injured one's, so the check can fail.
    let incoming = -1;
    for (let i = 0; i < SQUAD_SIZE && incoming < 0; i++) {
      if (squadRole(i) === 'gk' || m.players.some((p) => p.team === 0 && p.squadIndex === i)) continue;
      const a = outfieldAttrsFor(teamId, i);
      if (multForLevel(a.speed, ATTR_SPEED_SPAN) !== oldSpeed || multForLevel(a.shot, ATTR_SHOT_SPAN) !== oldShot) incoming = i;
    }
    expect(incoming).toBeGreaterThanOrEqual(0);
    stepMatch(m, inputsWithSub(0, incoming), createRng(1));
    const a = outfieldAttrsFor(teamId, incoming);
    expect(before.squadIndex).toBe(incoming);
    expect(before.speedMult).toBe(multForLevel(a.speed, ATTR_SPEED_SPAN));
    expect(before.shotMult).toBe(multForLevel(a.shot, ATTR_SHOT_SPAN));
    expect([before.speedMult, before.shotMult]).not.toEqual([oldSpeed, oldShot]);
    // The keeper's levels too.
    const k = game();
    const gk = keeperOf(k, 0);
    foulStep(k, gk.id, fixedRng([0]).rng, GK_LINE_DIST + 40, centerY(PITCH) + 60);
    stepMatch(k, inputsWithSub(0, 1), createRng(1));
    const second = keeperAttrsFor(k.teams[0].id, 1);
    expect([gk.keeperReflexes, gk.keeperRushing, gk.keeperKicking]).toEqual([second.reflexes, second.rushing, second.kicking]);
  });

  it('canInjure: nobody already injured, nobody while the team has a window open, nobody over the cap', () => {
    const m = game();
    const p = m.players[3];
    expect(canInjure(m, p)).toBe(true);
    m.pendingInjury[0] = MID_VICTIM;
    expect(canInjure(m, p)).toBe(false);
    m.pendingInjury[0] = -1;
    p.injured = true;
    expect(canInjure(m, p)).toBe(false);
    p.injured = false;
    m.injuriesUsed[0] = INJURY_MAX_PER_TEAM;
    expect(canInjure(m, p)).toBe(false);
    expect(canInjure(m, m.players[TEAM_SIZE + 3])).toBe(true);
  });
});

// ── G15-13 (v1.5, V15-4): cards and the real sending off ─────────────────────────

describe('G15-13: the card is a function of how many fouls the PLAYER has made', () => {
  it('yellow on the second, red on the fourth, nothing in between', () => {
    expect(CARD_YELLOW_AT).toBe(2);
    expect(CARD_RED_AT).toBe(4);
    expect([0, 1, 2, 3, 4, 5, 6].map(cardForFouls)).toEqual(['none', 'none', 'yellow', 'none', 'red', 'none', 'none']);
  });
  it('four fouls by the same player send him off, and the team really plays with one less', () => {
    const m = game();
    const offender = m.players[3];
    for (let i = 0; i < 3; i++) registerFoul(m, offender.id);
    expect([offender.card, offender.sentOff, isActive(offender)]).toEqual(['yellow', false, true]);
    registerFoul(m, offender.id);
    expect(offender.card).toBe('red');
    expect(offender.sentOff).toBe(true);
    expect(isActive(offender)).toBe(false);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE - 1);
  });
  it('four fouls spread over four DIFFERENT players send nobody off', () => {
    const m = game();
    for (const id of [2, 3, 4, 5]) registerFoul(m, id);
    expect(sentOffCount(m.players, 0)).toBe(0);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE);
  });
  it('the third red of a team is a caption only: SENT_OFF_MAX players leave, no more', () => {
    const m = game();
    expect(SENT_OFF_MAX).toBe(2);
    for (const id of [2, 3, 4]) {
      for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, id);
    }
    expect(sentOffCount(m.players, 0)).toBe(SENT_OFF_MAX);
    expect(m.players[4].card).toBe('red');         // the caption is shown
    expect(m.lastCard.card).toBe('red');
    expect(m.players[4].sentOff).toBe(false);      // but he stays on
  });
  it('NEGATIVE CONTROL: a foul by the OTHER team does not card anybody of this one', () => {
    const m = game();
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, TEAM_SIZE + 3);
    expect(sentOffCount(m.players, 0)).toBe(0);
    expect(sentOffCount(m.players, 1)).toBe(1);
  });
});

describe('G15-13 + Paco 24-sep (resolution 6): the sent-off GOALKEEPER', () => {
  it('the second keeper comes on and the team loses an OUTFIELD player, never its goalkeeper', () => {
    const m = game();
    const gk = m.players[0];
    const before = gk.squadIndex;
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, gk.id);
    expect(m.lastCard.card).toBe('red');
    // keeperOf is untouched: players[team * TEAM_SIZE] is still a keeper, now the second one.
    expect(m.players[0].role).toBe('gk');
    expect(m.players[0].squadIndex).not.toBe(before);
    expect(m.players[0].sentOff).toBe(false);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE - 1);
    expect(sentOffCount(m.players, 0)).toBe(1);
    const gone = m.players.find((p) => p.team === 0 && p.sentOff);
    expect(gone?.role).not.toBe('gk');
    expect(checkTeamCount(m.players, m.controlled, m.pendingInjury)).toEqual([]);
    // The caption names the keeper who was SENT OFF, not the one who came on.
    expect(m.lastCard.squadIndex).toBe(before);
  });
  it('with no keeper left, the red is a CAPTION and nobody leaves', () => {
    const m = game();
    // Burn the second keeper first, through the Task 5 machinery: the number 1 is
    // injured and the number 2 comes on in his window.
    const gk = m.players[0];
    foulStep(m, gk.id, fixedRng([0]).rng, GK_LINE_DIST + 40, centerY(PITCH) + 60);
    expect(m.phase).toBe('injury');
    stepMatch(m, inputsWithSub(0, 1), createRng(1));
    expect(gk.squadIndex).toBe(1);
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, gk.id);
    expect(m.lastCard.card).toBe('red');
    expect(sentOffCount(m.players, 0)).toBe(0);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE);
    // The injured number 1 did NOT come back to take the red's place.
    expect(gk.squadIndex).toBe(1);
    expect(gk.card).toBe('red');
    expect(isActive(gk)).toBe(true);
  });
});

// Through a function, so the compiler does not narrow m.phase to the staged value.
function setPhase(m: MatchState, phase: MatchPhase): void {
  m.phase = phase;
}

// A foul by `offenderId` on the next stepMatch: the same side slide as stageFoulOn, with
// the roles chosen by the caller, and a roll that never injures (0.5 > INJURY_CHANCE).
function foulBy(m: MatchState, offenderId: number, victimId: number, x = MID_X, y = MID_Y): void {
  if (m.phase === 'kickoff' || m.phase === 'set-piece') resumePlay(m);
  m.ball.owner = null;
  m.ball.x = 300; m.ball.y = 1300; m.ball.z = 0;
  m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0;
  m.ball.kickerId = -1; m.ball.kickLockUntilStep = 0;
  const victim = m.players[victimId];
  victim.x = x; victim.y = y; victim.downUntilStep = 0;
  victim.facingX = victim.team === 0 ? 1 : -1; victim.facingY = 0;
  const offender = m.players[offenderId];
  offender.x = x; offender.y = y - 15; offender.downUntilStep = 0;
  offender.tackleStepsLeft = 10;
  offender.tackleDirX = 0; offender.tackleDirY = 1;
  stepMatch(m, idleInputs(), fixedRng([0.5]).rng);
  expect(m.scratch.events[offenderId].foul, 'the staged slide was not given as a foul').toBe(true);
  expect(m.scratch.events[offenderId].victimId).toBe(victimId);
}

describe('G15-13 in the match: where the card is decided, and what it does to the game', () => {
  it('the foul judged in open play is carded on that step (no extra pause), and lastCard is an edge', () => {
    const m = game();
    const offender = m.players[TEAM_SIZE + 1];
    foulBy(m, offender.id, MID_VICTIM);
    expect(offender.fouls).toBe(1);
    expect(m.lastCard).toEqual({ playerId: offender.id, squadIndex: offender.squadIndex, card: 'none' });
    foulBy(m, offender.id, MID_VICTIM);
    expect(m.lastCard).toEqual({ playerId: offender.id, squadIndex: offender.squadIndex, card: 'yellow' });
    expect(offender.card).toBe('yellow');
    // G15-13 "sin pausa extra": a carded foul is a plain free kick, like any other.
    expect(m.phase).toBe('set-piece');
    stepMatch(m, idleInputs(), createRng(1));
    expect(m.lastCard.card).toBe('none');
    expect(m.lastCard.playerId).toBe(-1);
    foulBy(m, offender.id, MID_VICTIM);
    foulBy(m, offender.id, MID_VICTIM);
    expect(m.lastCard.card).toBe('red');
    expect(offender.sentOff).toBe(true);
    expect(m.players.filter((p) => p.team === 1 && isActive(p))).toHaveLength(TEAM_SIZE - 1);
    expect(checkTeamCount(m.players, m.controlled, m.pendingInjury)).toEqual([]);
  });

  it('a red to the CONTROLLED player hands control to the next nearest on that same step', () => {
    const m = game();
    const offender = m.players[1];
    for (let i = 0; i < CARD_RED_AT - 1; i++) registerFoul(m, offender.id);
    expect([offender.card, offender.sentOff]).toEqual(['yellow', false]);
    // He is team 0's controlled when the fourth foul is given.
    m.controlled[0] = offender.id;
    foulBy(m, offender.id, TEAM_SIZE + 5);
    expect(offender.sentOff).toBe(true);
    const now = m.controlled[0];
    expect(now).not.toBe(offender.id);
    expect(now).toBeGreaterThanOrEqual(0);
    expect(m.players[now].team).toBe(0);
    expect(m.players[now].role).not.toBe('gk');
    expect(isActive(m.players[now])).toBe(true);
    // And it stays that way on the following steps, wherever the ball is.
    for (let i = 0; i < 400; i++) {
      stepMatch(m, idleInputs(), createRng(2));
      expect(m.controlled[0]).not.toBe(offender.id);
    }
  });

  it('a sent-off player is invisible to the engine: no control, no ball, no pass, no set piece, no foul against him, no movement', () => {
    const m = game();
    resumePlay(m);
    const off = m.players[6];
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, off.id);
    expect(off.sentOff).toBe(true);
    // Control: he is the nearest to the ball, and still not chosen.
    m.ball.owner = null;
    m.ball.x = off.x + 5; m.ball.y = off.y; m.ball.vx = 0; m.ball.vy = 0; m.ball.z = 0; m.ball.vz = 0;
    m.controlled[0] = -1;
    updateTeamControl(m.players, m.ball, m.controlled, 0);
    expect(m.controlled[0]).not.toBe(off.id);
    // The ball at his feet, at rest: he never picks it up.
    m.ball.kickerId = -1;
    stepBall(m.ball, m.players, m.stepCount, m.pitch);
    expect(m.ball.owner).not.toBe(off.id);
    // A mate passing straight at him does not lock onto him.
    const mate = m.players[7];
    mate.x = off.x - 200; mate.y = off.y;
    const target = pickPassTarget(mate, m.players, 1, 0, false, m.stepCount);
    expect(target).not.toBe(off.id);
    // A free kick for his team taken exactly where he stands: somebody else takes it.
    m.ball.owner = null;
    expect(callSetPiece(m, 'free-kick', 0, off.x, off.y)).toBe(true);
    expect(m.setPiece?.takerId).not.toBe(off.id);
    // A rival sliding into his back is not a foul on somebody who no longer plays.
    const rival = m.players[TEAM_SIZE + 2];
    rival.x = off.x - 10; rival.y = off.y; rival.downUntilStep = 0;
    off.facingX = 1; off.facingY = 0;
    rival.tackleStepsLeft = TACKLE_STEPS; rival.tackleDirX = 1; rival.tackleDirY = 0;
    m.ball.owner = null; m.ball.x = 50; m.ball.y = 50;
    const ev = createActionEvent();
    stepTackle(rival, m.ball, m.players, m.stepCount, ev);
    expect(ev.foul).toBe(false);
    expect(ev.victimId).not.toBe(off.id);
    // The positioning AI leaves him standing, far from his anchor or not.
    off.x = 400; off.y = 400; off.wantX = 0; off.wantY = 0;
    positionTeam(m.players, m.ball, 0, FORMATIONS[0], 'neutral', 1, -1, m.pitch, m.stepCount, { x: 0, y: 0 });
    expect([off.wantX, off.wantY]).toEqual([0, 0]);
  });

  it('...and to the AI around him: he does not steal, is not thrown to, does not keep his keeper home, does not take a chase rank', () => {
    const m = game();
    resumePlay(m);
    const off = m.players[6];
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, off.id);
    // Steal: a rival on the ball right next to him, and not even a draw.
    const owner = m.players[TEAM_SIZE + 6];
    owner.x = off.x + 5; owner.y = off.y;
    m.ball.owner = owner.id;
    const draws = countingRng(1);
    const ev = createActionEvent();
    steal(off, m.ball, m.players, draws.rng, m.stepCount, ev);
    expect([ev.ok, draws.calls()]).toEqual([false, 0]);
    // The keeper's throw: he is the only outfield mate left in the own half.
    for (let i = 1; i < TEAM_SIZE; i++) {
      const p = m.players[i];
      if (p !== off) { p.x = PITCH.width * 0.75; p.y = 300 + 40 * i; }
    }
    off.x = PITCH.width * 0.25; off.y = 500;
    expect(freestMateDir(m.players[0], m.players, 1, m.pitch, { x: 0, y: 0 })).toBe(false);
    // The keeper's G12-3 press: a loose ball in his small area, and "a mate nearer the
    // ball" that is only the sent-off player -- the keeper comes out all the same.
    const gk = m.players[0];
    const cy = centerY(PITCH);
    gk.x = GK_LINE_DIST; gk.y = cy;
    m.ball.owner = null; m.ball.x = 60; m.ball.y = cy + 40; m.ball.z = 0;
    m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0;
    off.x = 62; off.y = cy + 40;
    keeperStep(gk, m.players, m.ball, 1, m.pitch, m.stepCount);
    expect(gk.wantX).toBeGreaterThan(0);
    // Chase ranks: he is the nearest to the ball, so the two nearest ACTIVE players are
    // the two chasers of a neutral team -- the second one is not demoted to cover.
    m.ball.x = 1100; m.ball.y = 700;
    off.x = 1100; off.y = 690;
    const a = m.players[7];
    const b = m.players[8];
    a.x = 1100; a.y = 800;
    b.x = 1100; b.y = 880;
    for (let i = 1; i < TEAM_SIZE; i++) {
      const p = m.players[i];
      if (p !== off && p !== a && p !== b) { p.x = 200; p.y = 100 + 110 * i; }
    }
    positionTeam(m.players, m.ball, 0, FORMATIONS[0], 'neutral', 1, -1, m.pitch, m.stepCount, { x: 0, y: 0 });
    expect(a.wantY).toBeLessThan(0);
    expect(Math.abs(b.wantX)).toBeLessThan(1e-9);
    expect(b.wantY).toBeLessThan(0);
  });

  it('cards are reset per match: a new match starts with nobody booked', () => {
    const m = game();
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, 3);
    registerFoul(m, 4);
    registerFoul(m, 4);
    expect([m.players[3].sentOff, m.players[4].card]).toEqual([true, 'yellow']);
    const next = game();
    expect(next.players.every((p) => p.fouls === 0 && p.card === 'none' && !p.sentOff)).toBe(true);
    expect(next.lastCard).toEqual({ playerId: -1, squadIndex: -1, card: 'none' });
  });

  it('cards do not touch the shootout: nothing is wiped, nothing is booked, and the eleven take their kicks', () => {
    const m = game();
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, 3);
    registerFoul(m, 4);
    registerFoul(m, 4);
    // Staged: the extra time runs out level.
    resumePlay(m);
    m.half = 3;
    setPhase(m, 'golden-goal');
    expect(endExtraTime(m)).toBe(true);
    expect(m.phase).toBe('shootout');
    expect([m.players[3].fouls, m.players[3].card, m.players[3].sentOff]).toEqual([CARD_RED_AT, 'red', true]);
    expect([m.players[4].fouls, m.players[4].card]).toEqual([2, 'yellow']);
    // "en la tanda tiran los once, expulsados incluidos": team 0's third taker is the
    // sent-off player 3, and the shootout always reaches team 0's third kick.
    expect(shootoutTakerId(0, 2)).toBe(3);
    const rng = createRng(7);
    let sentOffKicked = false;
    for (let i = 0; i < 20000 && m.phase === 'shootout'; i++) {
      const sh = m.shootout;
      if (sh !== null && sh.team === 0 && sh.taken[0] === 2 && sh.takerId === 3) sentOffKicked = true;
      stepMatch(m, idleInputs(), rng);
      expect(m.lastCard.card).toBe('none');
    }
    expect(m.phase).toBe('over');
    expect(sentOffKicked).toBe(true);
    expect([m.players[3].fouls, m.players[3].card, m.players[3].sentOff]).toEqual([CARD_RED_AT, 'red', true]);
  });
});

describe('V15-4-6 controller additions (01-oct)', () => {
  it('a player who left the pitch never comes back: red to keeper 1, keeper 2 on, keeper 2 injured -> keeper 1 does NOT return', () => {
    const m = game();
    const gk = m.players[0];
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, gk.id);
    expect(gk.squadIndex).toBe(1);
    expect(firstFreeReserveOfRole(m, 0, 'gk')).toBe(-1);
    const roll = fixedRng([0]);
    foulStep(m, gk.id, roll.rng, GK_LINE_DIST + 40, centerY(PITCH) + 60);
    expect(roll.calls()).toBe(1);
    // The injury is flagged and the number 2 keeps playing (resolution 7).
    expect(m.lastInjury).toBe(gk.id);
    expect(m.phase).toBe('set-piece');
    expect(gk.squadIndex).toBe(1);
    expect(isActive(gk)).toBe(true);
    expect(checkTeamCount(m.players, m.controlled, m.pendingInjury)).toEqual([]);
  });

  it('an outfield player substituted out is not a free reserve any more', () => {
    const m = game();
    injureMidfielder(m);
    stepMatch(m, inputsWithSub(0, 12), createRng(1));
    expect(m.players[MID_VICTIM].squadIndex).toBe(12);
    // 8 is off the pitch now, and it is the LOWEST midfield index: without the record of
    // who has left, it would be the first "free" one.
    expect(firstFreeReserveOfRole(m, 0, 'mid')).toBe(13);
    // And substitute itself refuses one who has left, whoever asks for him (staged: in
    // V15-4 the cap of one injury per team leaves no second window to ask in).
    const h = game();
    injureMidfielder(h);
    h.leftPitch[0] |= 1 << 12;
    stepMatch(h, inputsWithSub(0, 12), createRng(1));
    expect(h.phase).toBe('injury');
    stepMatch(h, inputsWithSub(0, 13), createRng(1));
    expect(h.phase).toBe('set-piece');
    expect(h.players[MID_VICTIM].squadIndex).toBe(13);
  });

  it('substitute clears the discipline of the player who comes on: he does not inherit the fouls of the one he replaces', () => {
    const m = game();
    const slot = m.players[1];
    foulBy(m, slot.id, TEAM_SIZE + 5);
    foulBy(m, slot.id, TEAM_SIZE + 5);
    expect([slot.fouls, slot.card]).toEqual([2, 'yellow']);
    // Now he is the one injured, and a reserve defender takes the slot.
    foulStep(m, slot.id, fixedRng([0]).rng);
    expect(m.phase).toBe('injury');
    stepMatch(m, inputsWithSub(0, 6), createRng(1));
    expect(slot.squadIndex).toBe(6);
    expect([slot.fouls, slot.card, slot.sentOff]).toEqual([0, 'none', false]);
    // His own first foul is a first foul.
    foulBy(m, slot.id, TEAM_SIZE + 5);
    expect([slot.fouls, slot.card]).toEqual([1, 'none']);
  });

  it('a keeper whose window runs out with no keeper to come on keeps playing, NOT injured: always one active goalkeeper', () => {
    const m = game();
    const gk = m.players[0];
    foulStep(m, gk.id, fixedRng([0]).rng, GK_LINE_DIST + 40, centerY(PITCH) + 60);
    expect(m.phase).toBe('injury');
    expect(gk.injured).toBe(true);
    // Staged: the second keeper becomes unavailable while the window is open.
    m.players[1].squadIndex = 1;
    const rng = createRng(3);
    for (let i = 0; i < INJURY_WINDOW_STEPS && m.phase === 'injury'; i++) stepMatch(m, idleInputs(), rng);
    expect(m.phase).toBe('set-piece');
    expect(gk.squadIndex).toBe(0);
    expect(gk.injured).toBe(false);
    expect(isActive(gk)).toBe(true);
    expect(checkTeamCount(m.players, m.controlled, m.pendingInjury)).toEqual([]);
  });
});

describe('checkTeamCount (G15-13 + G15-18): the net for a team in an impossible state', () => {
  it('a full CPU-vs-CPU match never leaves a team under the floor, without exactly one keeper, or controlling a player who left', () => {
    const m = game();
    const states: [AiState, AiState] = [createAiState(), createAiState()];
    const cpuRngs = [createRng(14 ^ 0x1234), createRng(14 ^ 0x5678)];
    const rng = createRng(14);
    const live = idleInputs();
    let problems = 0;
    let steps = 0;
    while (m.phase !== 'over' && steps < 20000) {
      decideTeamInput(m, 0, PROFILES[0], states[0], cpuRngs[0], live[0]);
      decideTeamInput(m, 1, PROFILES[1], states[1], cpuRngs[1], live[1]);
      stepMatch(m, live, rng);
      problems += checkTeamCount(m.players, m.controlled, m.pendingInjury).length;
      steps++;
    }
    expect(m.phase).toBe('over');
    expect(problems).toBe(0);
    // What makes this run worth having: seed 14 injures a player (review-6 M1), so the
    // net walks through a real LESIONADO window. If a tuning moves that, this says so.
    expect(m.injuriesUsed[0] + m.injuriesUsed[1]).toBeGreaterThan(0);
  });

  it('an INJURED controlled player loses the control on the step of the injury (Task 5 window, review-6 M1)', () => {
    const m = game();
    // The victim is about to be the free-kick taker (nearest to the spot) and holds the
    // ball, so every rule but isActive would keep the cursor on him.
    const offenderId = stageFoulOn(m, MID_VICTIM, MID_X, MID_Y);
    m.ball.x = MID_X + 60; m.ball.y = MID_Y;
    m.controlled[0] = MID_VICTIM;
    stepMatch(m, idleInputs(), fixedRng([0]).rng);
    expect(m.scratch.events[offenderId].foul).toBe(true);
    expect(m.phase).toBe('injury');
    expect(m.players[MID_VICTIM].injured).toBe(true);
    const now = m.controlled[0];
    expect(now).not.toBe(MID_VICTIM);
    expect(isActive(m.players[now])).toBe(true);
    expect(checkTeamCount(m.players, m.controlled, m.pendingInjury)).toEqual([]);
  });

  it('a keeper waiting in his own injury window is still the team keeper; an injured keeper with NO window is flagged (review-6 I1)', () => {
    const m = game();
    const gk = keeperOf(m, 0);
    foulStep(m, gk.id, fixedRng([0]).rng, GK_LINE_DIST + 40, centerY(PITCH) + 60);
    expect(m.phase).toBe('injury');
    expect([gk.injured, m.pendingInjury[0]]).toEqual([true, gk.id]);
    expect(checkTeamCount(m.players, m.controlled, m.pendingInjury)).toEqual([]);
    // A human team keeps the window open: still legitimate on every step of it.
    for (let i = 0; i < 100; i++) {
      stepMatch(m, idleInputs(), createRng(1));
      expect(checkTeamCount(m.players, m.controlled, m.pendingInjury)).toEqual([]);
    }
    // NEGATIVE CONTROL: the same injured keeper with no window open is a team without one.
    const n = game();
    keeperOf(n, 0).injured = true;
    expect(checkTeamCount(n.players, n.controlled, n.pendingInjury)).toEqual(['team 0: 0 active goalkeepers, expected exactly 1']);
    // ...and a window open for somebody ELSE does not excuse him either.
    n.pendingInjury[0] = MID_VICTIM;
    expect(checkTeamCount(n.players, n.controlled, n.pendingInjury)).toContain('team 0: 0 active goalkeepers, expected exactly 1');
  });

  it('NEGATIVE CONTROL: three sent off, a sent-off controlled, two keepers and a team under the floor are all named', () => {
    const m = game();
    expect(checkTeamCount(m.players, m.controlled, m.pendingInjury)).toEqual([]);
    for (const id of [2, 3, 4]) m.players[id].sentOff = true;
    const three = checkTeamCount(m.players, m.controlled, m.pendingInjury);
    expect(three.some((s) => s.includes('team 0') && s.includes('3 sent off'))).toBe(true);
    const c = game();
    c.players[5].sentOff = true;
    c.controlled[0] = 5;
    expect(checkTeamCount(c.players, c.controlled, c.pendingInjury).some((s) => s.includes('controlled 5'))).toBe(true);
    const k = game();
    k.players[TEAM_SIZE + 4].role = 'gk';
    expect(checkTeamCount(k.players, k.controlled, k.pendingInjury).some((s) => s.includes('team 1: 2 active goalkeepers'))).toBe(true);
    const f = game();
    for (const id of [1, 2, 3, 4]) f.players[id].injured = true;
    expect(checkTeamCount(f.players, f.controlled, f.pendingInjury).some((s) => s.includes('team 0: 7 on the pitch'))).toBe(true);
  });
});
