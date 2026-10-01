import { FORMATIONS, type TeamDef } from './teams';
import { PITCH } from './pitch';
import { createRng } from './rng';
import { createTeamInput, type TeamInput } from './input';
import { createMatch, stepMatch, type MatchState } from './match';
import { createAiState, decideTeamInput, profileFor, type AiState } from './ai';
import { INJURY_MAX_PER_TEAM, SENT_OFF_MAX, isActive } from './discipline';

// TEST SUPPORT ONLY (V15-4-10): the harness shared by the three probe files
// (probes.test.ts, probes-close-matches.test.ts, probes-difficulty.test.ts), split so
// vitest runs them in parallel. No production module imports this file.
//
// A probe MEASURES the engine and asserts BANDS and STRUCTURE, never a measured number --
// that is what separates it from a recording. A band that breaks is a playability signal
// for Paco (G15-12, G15-24, G15-28), not something to re-baseline, and it is never fixed
// by helping the side that is losing.
//
// Every match is a full CPU-vs-CPU match (both halves, golden goal and shootout when they
// come), driven exactly as engine-invariants.test.ts drives its own: two AI streams from
// the seed (seed ^ 0x1234, seed ^ 0x5678) and the match stream from the seed itself.
// The measured values live in specs/31-vault-world-cup.md (G15-28 final band table), not in the tests.
export const MATCHES = 40;
const CAP = 40000;

export type Probe = {
  over: boolean;
  score: [number, number];
  posts: number;
  crossbars: number;
  slidesStarted: number;
  tackleEvents: number;
  tacklesWon: number;
  fouls: number;
  steals: number;
  yellows: number;
  reds: number;
  sentOff: [number, number];
  injuries: [number, number];
  substitutions: [number, number];
  stepsWithoutOneKeeper: number;
};

export function playProbe(seed: number, home: TeamDef, away: TeamDef, difficulties: readonly [number, number]): Probe {
  const match: MatchState = createMatch(
    [home, away], FORMATIONS, PITCH, [profileFor(home, difficulties[0]), profileFor(away, difficulties[1])],
  );
  const states: [AiState, AiState] = [createAiState(), createAiState()];
  const cpuRngs = [createRng(seed ^ 0x1234), createRng(seed ^ 0x5678)];
  const rng = createRng(seed);
  const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
  const g: Probe = {
    over: false, score: [0, 0], posts: 0, crossbars: 0, slidesStarted: 0, tackleEvents: 0, tacklesWon: 0,
    fouls: 0, steals: 0, yellows: 0, reds: 0, sentOff: [0, 0], injuries: [0, 0], substitutions: [0, 0],
    stepsWithoutOneKeeper: 0,
  };
  // Every counter below works on TRANSITIONS of the state, never on per-step flags that
  // stay up for several steps. Created ONCE per match, outside the step loop.
  const n = match.players.length;
  const wasSliding = new Array<boolean>(n).fill(false);
  const wasInjured = new Array<boolean>(n).fill(false);
  const wasSentOff = new Array<boolean>(n).fill(false);
  const squadIndexWas = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) squadIndexWas[i] = match.players[i].squadIndex;
  let steps = 0;
  while (match.phase !== 'over' && steps < CAP) {
    decideTeamInput(match, 0, match.profiles[0], states[0], cpuRngs[0], live[0]);
    decideTeamInput(match, 1, match.profiles[1], states[1], cpuRngs[1], live[1]);
    stepMatch(match, live, rng);
    steps++;
    // ball.frameHit and lastCard are edges: reset at the top of every stepMatch, so each
    // one read here is a hit / a card of THIS step.
    if (match.ball.frameHit === 'post') g.posts++;
    if (match.ball.frameHit === 'crossbar') g.crossbars++;
    if (match.lastCard.playerId >= 0) g.fouls++;   // registerFoul runs once per foul the referee gives
    if (match.lastCard.card === 'yellow') g.yellows++;
    if (match.lastCard.card === 'red') g.reds++;   // shown, with or without a sending off
    if (match.lastInjury >= 0) g.injuries[match.players[match.lastInjury].team]++;   // flagged keeper, plays on
    for (let i = 0; i < match.scratch.events.length; i++) {
      const ev = match.scratch.events[i];
      if (ev.kind === 'tackle') {
        g.tackleEvents++;
        if (ev.ok) g.tacklesWon++;
      }
      if (ev.kind === 'steal' && ev.ok) g.steals++;
    }
    for (let i = 0; i < n; i++) {
      const p = match.players[i];
      // H8: a slide STARTED is the step tackleStepsLeft goes from 0 to > 0, not every
      // step of the slide (stepTackle writes a 'tackle' event on each of them).
      const sliding = p.tackleStepsLeft > 0;
      if (sliding && !wasSliding[i]) g.slidesStarted++;
      wasSliding[i] = sliding;
      if (p.injured && !wasInjured[i]) g.injuries[p.team]++;
      wasInjured[i] = p.injured;
      if (p.sentOff && !wasSentOff[i]) g.sentOff[p.team]++;
      wasSentOff[i] = p.sentOff;
      if (p.squadIndex !== squadIndexWas[i]) {
        g.substitutions[p.team]++;
        squadIndexWas[i] = p.squadIndex;
      }
    }
    // Exactly one active keeper per team, every step. The one legitimate inactive keeper
    // is the injured one whose LESIONADO window is open (pendingInjury), play stopped.
    for (const t of [0, 1] as const) {
      let keepers = 0;
      for (let i = 0; i < n; i++) {
        const p = match.players[i];
        if (p.team !== t || p.role !== 'gk') continue;
        if (isActive(p) || (!p.sentOff && p.id === match.pendingInjury[t])) keepers++;
      }
      if (keepers !== 1) g.stepsWithoutOneKeeper++;
    }
  }
  g.over = match.phase === 'over';
  g.score = [match.score[0], match.score[1]];
  return g;
}

export function seeds(first: number): number[] {
  const out: number[] = [];
  for (let s = first; s < first + MATCHES; s++) out.push(s);
  return out;
}

export function sum(games: readonly Probe[], read: (g: Probe) => number): number {
  let total = 0;
  for (const g of games) total += read(g);
  return total;
}

// G15-28 band 1: drawn or decided by ONE goal. A match that went to the shootout ended
// level (the shootout never touches score) and one won in the golden goal by exactly
// one is a one-goal match, so |difference| <= 1 is the whole rule.
export function closeShare(games: readonly Probe[]): number {
  return games.filter((g) => Math.abs(g.score[0] - g.score[1]) <= 1).length / games.length;
}

// G15-28 band 2: a blowout is a difference of four goals or more.
export function blowoutShare(games: readonly Probe[]): number {
  return games.filter((g) => Math.abs(g.score[0] - g.score[1]) >= 4).length / games.length;
}

// G15-28 band 3: of the matches DECIDED on the scoreboard (not level, so the shootout is
// out), how many the side `team` won and how many it lost.
export function decidedRecord(games: readonly Probe[], team: 0 | 1): { won: number; lost: number } {
  let won = 0;
  let lost = 0;
  for (const g of games) {
    if (g.score[0] === g.score[1]) continue;
    if ((g.score[0] > g.score[1] ? 0 : 1) === team) won++;
    else lost++;
  }
  return { won, lost };
}

// The number-free structure every probe file asserts over its own matches: each one
// ended, no team ever had more than SENT_OFF_MAX players sent off or INJURY_MAX_PER_TEAM
// injuries, and each kept exactly one active keeper on every step.
export function structuralProblems(games: readonly Probe[]): string[] {
  const problems: string[] = [];
  games.forEach((g, i) => {
    if (!g.over) problems.push(`match ${i}: did not end`);
    if (Math.max(g.sentOff[0], g.sentOff[1]) > SENT_OFF_MAX) problems.push(`match ${i}: over SENT_OFF_MAX sent off`);
    if (Math.max(g.injuries[0], g.injuries[1]) > INJURY_MAX_PER_TEAM) problems.push(`match ${i}: over INJURY_MAX_PER_TEAM injuries`);
    if (g.stepsWithoutOneKeeper > 0) problems.push(`match ${i}: ${g.stepsWithoutOneKeeper} steps without exactly one active keeper`);
  });
  return problems;
}
