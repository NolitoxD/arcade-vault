import { createAiState, decideTeamInput, humanProfile, profileFor, type AiProfile, type AiState } from '../football-logic/ai';
import { createTeamInput, type TeamInput } from '../football-logic/input';
import { createMatch, stepMatch, winnerOf, type MatchRules, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { createRng, type Rng } from '../football-logic/rng';
import { FORMATIONS, type TeamDef } from '../football-logic/teams';

// ONE match and everything that drives it: the two rng streams, the two AI states and
// the two TeamInputs, plus the mask of who is human. The component fills the human
// inputs from the pads and calls stepMatchRun; a CPU-vs-CPU pair of the World Cup is
// the same run with nobody human, whether it is stepped on screen at x4 (VER) or
// finished headless in one call (SALTAR, or the A key mid-match). Same function, same
// streams: the result cannot depend on whether anybody watched (G9-3).
//
// Two streams from one seed, exactly as the step-8 component and ai.test.ts's
// playCpuMatch: the CPU decides with its own, before stepMatch, and never draws from
// the match's. CPU_SEED_SALT moves here from VaultWorldCupGame.tsx unchanged.
export const CPU_SEED_SALT = 0x2545f491;

// A match is ~11-16 k steps with a shootout; criterion 23 says the shootout always
// ends. The cap is a safety net for a broken engine, not a rule: the test asserts it is
// never reached, and finishMatchRun reports -1 (undecided) if it ever were.
export const MATCH_RUN_STEP_CAP = 100_000;

export type MatchRun = {
  match: MatchState;
  matchRng: Rng;
  cpuRng: Rng;
  states: [AiState, AiState];
  inputs: [TeamInput, TeamInput];
  human: [boolean, boolean];
};

// Allocates: a match, two rngs, two AI states, two inputs. Called on an EVENT (A on
// the bracket, A on the team selector), never per frame.
export function createMatchRun(
  home: TeamDef, away: TeamDef, seed: number, difficulty: number,
  human: readonly [boolean, boolean], rules: Readonly<MatchRules>, formations: readonly [number, number],
): MatchRun {
  // D3: the human profile is the CPU profile with zero kick error -- same keeper,
  // same penalty read, same difficulty.
  const profiles: [AiProfile, AiProfile] = [
    human[0] ? humanProfile(home, difficulty) : profileFor(home, difficulty),
    human[1] ? humanProfile(away, difficulty) : profileFor(away, difficulty),
  ];
  const match = createMatch([home, away], FORMATIONS, PITCH, profiles, rules);
  match.formationIndex[0] = formations[0];
  match.formationIndex[1] = formations[1];
  const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
  inputs[0].formation = formations[0];
  inputs[1].formation = formations[1];
  return {
    match,
    matchRng: createRng(seed),
    cpuRng: createRng((seed ^ CPU_SEED_SALT) >>> 0),
    states: [createAiState(), createAiState()],
    inputs,
    human: [human[0], human[1]],
  };
}

// ONE simulation step. The caller has already written the human inputs for this step
// (padToTeamInput); the CPU sides decide here, team 0 first, from the CPU stream.
// G9-1 (design brief, option B): the FROZEN team of a training match is asked nothing --
// the engine only skips positionTeam for it, and its controlled player is still moved by
// its TeamInput (stepPlayer), so a CPU decision here would send one statue chasing and
// tackling. Its input stays the neutral one createTeamInput wrote (formation aside).
function cpuDecides(run: MatchRun, team: 0 | 1): boolean {
  return !run.human[team] && run.match.rules.frozenTeam !== team;
}

export function stepMatchRun(run: MatchRun): void {
  const { match, inputs } = run;
  if (cpuDecides(run, 0)) decideTeamInput(match, 0, match.profiles[0], run.states[0], run.cpuRng, inputs[0]);
  if (cpuDecides(run, 1)) decideTeamInput(match, 1, match.profiles[1], run.states[1], run.cpuRng, inputs[1]);
  stepMatch(match, inputs, run.matchRng);
}

// Runs the match to 'over' and reports the winner. -1 only if the cap was hit, which
// the tests say never happens.
export function finishMatchRun(run: MatchRun, cap = MATCH_RUN_STEP_CAP): 0 | 1 | -1 {
  let steps = 0;
  while (run.match.phase !== 'over' && steps < cap) {
    stepMatchRun(run);
    steps++;
  }
  return winnerOf(run.match);
}
