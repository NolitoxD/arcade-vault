import { describe, expect, it } from 'vitest';
import { NORMAL_RULES, TRAINING_RULES, callSetPiece, isOpenPlay } from '../football-logic/match';
import { PITCH, centerY } from '../football-logic/pitch';
import { TEAMS } from '../football-logic/teams';
import { profileFor } from '../football-logic/ai';
import { CPU_SEED_SALT, MATCH_RUN_STEP_CAP, createMatchRun, finishMatchRun, stepMatchRun } from './match-run';

const ESP = TEAMS[0];
const ITA = TEAMS[1];
const BRA = TEAMS[2];
const FRA = TEAMS[5];

describe('createMatchRun', () => {
  it('gives a human side the human profile (zero kick error) and a CPU side the CPU profile', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, false], NORMAL_RULES, [0, 0]);
    expect(run.match.profiles[0].shotErrorDeg).toBe(0);
    expect(run.match.profiles[0].passErrorDeg).toBe(0);
    expect(run.match.profiles[1].shotErrorDeg).toBeGreaterThan(0);
    // The keeper and the penalty read use the SAME difficulty on both sides (D3): the
    // human's catch is the CPU formula for its own selection. Since V15-4 (G15-10) the
    // two selections' defence bends catchChance, so ESP is compared with ESP, not ITA.
    expect(run.match.profiles[0].catchChance).toBe(profileFor(ESP, 5).catchChance);
    expect(run.match.profiles[0].penaltyReadChance).toBe(run.match.profiles[1].penaltyReadChance);
    expect(run.human).toEqual([true, false]);
  });

  it('applies the formations to the match and to the inputs, and passes the rules through', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, false], TRAINING_RULES, [2, 1]);
    expect(run.match.formationIndex).toEqual([2, 1]);
    expect(run.inputs[0].formation).toBe(2);
    expect(run.inputs[1].formation).toBe(1);
    expect(run.match.rules.timed).toBe(false);
    expect(run.match.rules.frozenTeam).toBe(1);
    expect(run.match.teams[0].id).toBe('espana');
    expect(run.match.teams[1].id).toBe('italia');
  });

  it('derives the CPU stream from the seed with the step-8 salt', () => {
    expect(CPU_SEED_SALT).toBe(0x2545f491);
  });
});

describe('a CPU-vs-CPU run (the World Cup pairs the human does not play)', () => {
  it('finishes with a winner within the cap, deterministically: same seed, same winner, score and step count', () => {
    const a = createMatchRun(BRA, FRA, 11, 6, [false, false], NORMAL_RULES, [0, 0]);
    const b = createMatchRun(BRA, FRA, 11, 6, [false, false], NORMAL_RULES, [0, 0]);
    const wa = finishMatchRun(a);
    const wb = finishMatchRun(b);
    expect(wa).not.toBe(-1);
    expect(wa).toBe(wb);
    expect(a.match.phase).toBe('over');
    expect(a.match.score).toEqual(b.match.score);
    expect(a.match.stepCount).toBe(b.match.stepCount);
    expect(a.match.stepCount).toBeLessThan(MATCH_RUN_STEP_CAP);
  });

  // G9-3, the property the whole VER / SALTAR design rests on: watching part of the
  // match on screen and then skipping to the result gives EXACTLY the result of never
  // having watched it. Same function, same streams, same trajectory.
  it('a run watched for 3 000 steps and then finished ends exactly like the one finished headless from the start', () => {
    const watched = createMatchRun(BRA, FRA, 23, 4, [false, false], NORMAL_RULES, [0, 0]);
    for (let i = 0; i < 3000; i++) stepMatchRun(watched);
    expect(watched.match.phase).not.toBe('over');
    const w1 = finishMatchRun(watched);
    const headless = createMatchRun(BRA, FRA, 23, 4, [false, false], NORMAL_RULES, [0, 0]);
    const w2 = finishMatchRun(headless);
    expect(w1).toBe(w2);
    expect(watched.match.score).toEqual(headless.match.score);
    expect(watched.match.stepCount).toBe(headless.match.stepCount);
    expect(watched.match.ball.x).toBe(headless.match.ball.x);
  });

  it('a different seed gives a different match', () => {
    const a = createMatchRun(BRA, FRA, 23, 4, [false, false], NORMAL_RULES, [0, 0]);
    const b = createMatchRun(BRA, FRA, 24, 4, [false, false], NORMAL_RULES, [0, 0]);
    finishMatchRun(a);
    finishMatchRun(b);
    const same = a.match.stepCount === b.match.stepCount && a.match.score[0] === b.match.score[0] && a.match.score[1] === b.match.score[1] && a.match.ball.x === b.match.ball.x;
    expect(same).toBe(false);
  });

  it('at each round difficulty, seven seeds never hit the cap and always produce a winner (criterion 23)', () => {
    for (const difficulty of [4, 6, 8]) {
      for (let seed = 100; seed < 107; seed++) {
        const run = createMatchRun(ESP, ITA, seed, difficulty, [false, false], NORMAL_RULES, [0, 0]);
        expect(finishMatchRun(run)).not.toBe(-1);
        expect(run.match.stepCount).toBeLessThan(MATCH_RUN_STEP_CAP);
      }
    }
  });
});

describe('a run with humans', () => {
  it('never calls the CPU for a human team: its input is whatever the caller wrote; the CPU side is rewritten', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, false], NORMAL_RULES, [0, 0]);
    run.inputs[0].dx = 1;
    run.inputs[1].dx = 1;
    stepMatchRun(run);   // kickoff phase: decideTeamInput writes a neutral d-pad for the CPU
    expect(run.inputs[0].dx).toBe(1);
    expect(run.inputs[1].dx).toBe(0);
  });

  it('a two-human run consumes nothing from the CPU stream', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, true], NORMAL_RULES, [0, 0]);
    run.cpuRng = () => {
      throw new Error('the two-player friendly must not consult the CPU rng');
    };
    for (let i = 0; i < 400; i++) stepMatchRun(run);
    expect(run.match.stepCount).toBe(400);
  });

  // G9-1: the frozen team of a training match is never asked to decide. Without this
  // the CPU would drive the frozen side's CONTROLLED player (stepPlayer reads its
  // TeamInput regardless of the rules) and the "statues" would chase and tackle.
  it('in a training run the frozen team gets no CPU decision: neutral input, CPU stream untouched, its controlled player still', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, false], TRAINING_RULES, [0, 0]);
    run.cpuRng = () => {
      throw new Error('the frozen team must not consult the CPU rng');
    };
    for (let i = 0; i < 400; i++) stepMatchRun(run);   // through the kickoff into open play
    const controlled = run.match.players[run.match.controlled[1]];
    const x = controlled.x;
    const y = controlled.y;
    for (let i = 0; i < 200; i++) stepMatchRun(run);
    expect(run.inputs[1].dx).toBe(0);
    expect(run.inputs[1].dy).toBe(0);
    expect(run.inputs[1].a).toBe('up');
    expect(run.inputs[1].b).toBe('up');
    expect(run.match.players[controlled.id].x).toBe(x);
    expect(run.match.players[controlled.id].y).toBe(y);
    expect(run.match.stepCount).toBe(600);
    // V15-4 rebuild of the control (the attributes of G15-10/G15-26 left this seed with NO
    // tackle roll in a whole passive match, so no step window could hold it): the two runs
    // are put in the SAME forced situation instead of waiting for one -- a penalty for team
    // 1, on the spot it attacks, from open play. The CPU always draws the side of a penalty
    // it takes (ai.ts, decideTeamInput), so the control no longer depends on the match.
    const spotX = PITCH.penaltySpotDist;
    const spotY = centerY(PITCH);
    // The frozen run first: its throwing cpuRng is still in place, so a decision here throws.
    expect(isOpenPlay(run.match.phase)).toBe(true);
    expect(callSetPiece(run.match, 'penalty', 1, spotX, spotY)).toBe(true);
    for (let i = 0; i < 10; i++) stepMatchRun(run);
    // The control case: with normal rules the same seat, in the same situation, DOES draw
    // from the CPU stream.
    const normal = createMatchRun(ESP, ITA, 1, 5, [true, false], NORMAL_RULES, [0, 0]);
    let draws = 0;
    const inner = normal.cpuRng;
    normal.cpuRng = () => {
      draws++;
      return inner();
    };
    for (let i = 0; i < 2000 && !isOpenPlay(normal.match.phase); i++) stepMatchRun(normal);
    expect(isOpenPlay(normal.match.phase)).toBe(true);
    const before = draws;
    expect(callSetPiece(normal.match, 'penalty', 1, spotX, spotY)).toBe(true);
    for (let i = 0; i < 10; i++) stepMatchRun(normal);
    expect(draws).toBeGreaterThan(before);
  });
});
