import { winnerOf, type MatchState } from './match';
import type { Rng } from './rng';

// The World Cup as pure functions over a state mutated in place: the same pattern as
// fighter-logic/tournament.ts, not the same code (spec, data model). Eight drawn from
// the bank, straight knockout, three matches, eliminated with no CONTINUE. The engine
// never sees this module: it produces matches, and this module reads winnerOf().
export const WORLD_CUP_SIZE = 8;

export type WorldCupRound = 'quarters' | 'semis' | 'final';
export type WorldCupStatus = 'playing' | 'champion' | 'eliminated';

export type WorldCupResult = {
  round: WorldCupRound;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  winner: 0 | 1;
};

export type WorldCupState = {
  humanId: string;
  // G9-7: the tournament seed. The draw came off it (through the rng createWorldCup
  // received) and every match seed comes off it by integer arithmetic (matchSeedFor).
  seed: number;
  round: WorldCupRound;
  status: WorldCupStatus;
  score: number;
  // The eight in draw order, fixed for the whole run: `entrants` forgets who fell,
  // and the bracket screen exists to say it (tournament.ts has the same field for
  // the same reason).
  bracket: string[];
  // This round's participants, 8 -> 4 -> 2, paired as consecutive slots 0-1, 2-3…
  // Shrunk in place on advanceRound (length assignment), never reallocated.
  entrants: string[];
  // Per pair of the CURRENT round: the winner's id ('' while unresolved) and the flag.
  // Four slots created once; reset on advanceRound.
  pairWinner: string[];
  resolved: boolean[];
  // Every result of the run, in resolution order: 4 + 2 + 1 slots created once.
  results: WorldCupResult[];
  resultCount: number;
};

export const ROUND_LABELS: Readonly<Record<WorldCupRound, string>> = {
  quarters: 'CUARTOS DE FINAL',
  semis: 'SEMIFINAL',
  final: 'FINAL',
};

// G9-6 / spec: 4 in the quarters, 6 in the semis, 8 in the final. Numbers, not branches.
export const ROUND_DIFFICULTY: Readonly<Record<WorldCupRound, number>> = {
  quarters: 4,
  semis: 6,
  final: 8,
};

const NEXT_ROUND: Readonly<Record<WorldCupRound, WorldCupRound>> = {
  quarters: 'semis',
  semis: 'final',
  final: 'final',   // unreachable: winHumanMatch returns before consulting it in the final
};

const ROUND_INDEX: Readonly<Record<WorldCupRound, number>> = { quarters: 0, semis: 1, final: 2 };
const ROUND_ENTRANTS: Readonly<Record<WorldCupRound, number>> = { quarters: 8, semis: 4, final: 2 };

// The scoring table of the spec (§Decisiones estructurales). Only the World Cup
// scores: the friendlies never call anything here.
export const SCORE_GOAL = 1_000;
export const SCORE_WIN = 5_000;
export const SCORE_CLEAN_SHEET = 2_000;
const SCORE_PASS_QUARTERS = 5_000;
const SCORE_PASS_SEMIS = 10_000;
const SCORE_CHAMPION = 25_000;
export const ROUND_BONUS: Readonly<Record<WorldCupRound, number>> = {
  quarters: SCORE_PASS_QUARTERS,
  semis: SCORE_PASS_SEMIS,
  final: SCORE_CHAMPION,
};
// 3 × 5 000 + 3 × 2 000 + 5 000 + 10 000 + 25 000 = 61 000 (spec: "~70 000 con goles").
export const PERFECT_BASE_SCORE = 3 * SCORE_WIN + 3 * SCORE_CLEAN_SHEET + SCORE_PASS_QUARTERS + SCORE_PASS_SEMIS + SCORE_CHAMPION;

// G9-7: one match seed per (round, pair), derived from the tournament seed with 32-bit
// integer arithmetic only (same discipline as CPU_SEED_SALT and ambienceSeedFor), so
// a replay of the whole tournament needs the one seed and nothing else. The three
// salts are the usual odd 32-bit mixing constants; the test asserts the twelve slots
// of one seed are distinct for several seeds.
const MATCH_SEED_SALT = 0x9e3779b1;
const ROUND_SEED_SALT = 0x85ebca6b;
const PAIR_SEED_SALT = 0xc2b2ae35;

export function matchSeedFor(seed: number, round: WorldCupRound, pair: number): number {
  const mixedRound = (seed ^ Math.imul(ROUND_SEED_SALT, ROUND_INDEX[round] + 1)) >>> 0;
  return (Math.imul(mixedRound, MATCH_SEED_SALT) + Math.imul(PAIR_SEED_SALT, pair + 1)) >>> 0;
}

function shuffled(items: readonly string[], rng: Rng): string[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// G9-4: the human chose; seven of the remaining fifteen are drawn, and the eight are
// shuffled AGAIN so the human's slot -- and with it who is team 0 of his pair, who
// kicks first in a shootout (S-PK3) -- is drawn too. Called once per run, never per
// frame: the two copies it makes are the price of a Fisher-Yates over a readonly bank.
function drawEight(bankIds: readonly string[], humanId: string, rng: Rng): string[] {
  const others: string[] = [];
  for (const id of bankIds) if (id !== humanId) others.push(id);
  if (others.length !== bankIds.length - 1) throw new Error(`human team not in bank: ${humanId}`);
  const drawn = shuffled(others, rng).slice(0, WORLD_CUP_SIZE - 1);
  drawn.push(humanId);
  return shuffled(drawn, rng);
}

export function createWorldCup(bankIds: readonly string[], humanId: string, seed: number, rng: Rng): WorldCupState {
  const bracket = drawEight(bankIds, humanId, rng);
  const entrants = [...bracket];
  const pairWinner: string[] = [];
  const resolved: boolean[] = [];
  for (let i = 0; i < WORLD_CUP_SIZE / 2; i++) {
    pairWinner.push('');
    resolved.push(false);
  }
  const results: WorldCupResult[] = [];
  for (let i = 0; i < WORLD_CUP_SIZE - 1; i++) {
    results.push({ round: 'quarters', homeId: '', awayId: '', homeGoals: 0, awayGoals: 0, winner: 0 });
  }
  return { humanId, seed, round: 'quarters', status: 'playing', score: 0, bracket, entrants, pairWinner, resolved, results, resultCount: 0 };
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export function pairCount(wc: WorldCupState): number {
  return wc.entrants.length >> 1;
}

export function pairHomeId(wc: WorldCupState, pair: number): string {
  return wc.entrants[pair * 2];
}

export function pairAwayId(wc: WorldCupState, pair: number): string {
  return wc.entrants[pair * 2 + 1];
}

export function humanPairIndex(wc: WorldCupState): number {
  const index = wc.entrants.indexOf(wc.humanId);
  if (index === -1) throw new Error(`human not among the entrants: ${wc.humanId}`);
  return index >> 1;
}

// S-PK3 in the World Cup: "el que figure primero en el cruce" is team 0 and kicks first
// in a shootout. The human is team 0 only when the draw put him first.
export function humanSideInPair(wc: WorldCupState): 0 | 1 {
  const index = wc.entrants.indexOf(wc.humanId);
  if (index === -1) throw new Error(`human not among the entrants: ${wc.humanId}`);
  return (index & 1) === 0 ? 0 : 1;
}

export function humanOpponentId(wc: WorldCupState): string {
  const pair = humanPairIndex(wc);
  return humanSideInPair(wc) === 0 ? pairAwayId(wc, pair) : pairHomeId(wc, pair);
}

export function isStillIn(wc: WorldCupState, id: string): boolean {
  return wc.entrants.includes(id);
}

export function isFinal(wc: WorldCupState): boolean {
  return wc.round === 'final';
}

export function currentDifficulty(wc: WorldCupState): number {
  return ROUND_DIFFICULTY[wc.round];
}

export function roundLabel(wc: WorldCupState): string {
  return ROUND_LABELS[wc.round];
}

export function humanMatchSeed(wc: WorldCupState): number {
  return matchSeedFor(wc.seed, wc.round, humanPairIndex(wc));
}

// Cheap minor (final fix wave): the two composed bracket rules the screen used to
// build inline (matchSeedFor + wc.round + wc.seed, and a hand-rolled scan of
// wc.results), so the .tsx stops reasoning about bracket internals.
export function cpuMatchSeed(wc: WorldCupState, pair: number): number {
  return matchSeedFor(wc.seed, wc.round, pair);
}

// The recorded result of `pair` in the CURRENT round, or null if unresolved. Scans
// backwards because results are appended in resolution order and the current round's
// entries are the most recent ones.
export function pairResult(wc: WorldCupState, pair: number): WorldCupResult | null {
  const home = pairHomeId(wc, pair);
  for (let r = wc.resultCount - 1; r >= 0; r--) {
    const res = wc.results[r];
    if (res.round === wc.round && res.homeId === home) return res;
  }
  return null;
}

// G9-3: the pairs the human does not play, resolved one by one before his match --
// the bracket screen asks VER or SALTAR for each. -1 once they are all resolved (or
// the tournament is over), which is the screen's cue to offer the human's match.
export function nextCpuPair(wc: WorldCupState): number {
  if (wc.status !== 'playing') return -1;
  const human = humanPairIndex(wc);
  for (let pair = 0; pair < pairCount(wc); pair++) {
    if (pair !== human && !wc.resolved[pair]) return pair;
  }
  return -1;
}

// ── Transitions: every one guards its status and returns silently otherwise ────

function recordResult(wc: WorldCupState, pair: number, homeGoals: number, awayGoals: number, winner: 0 | 1): void {
  const r = wc.results[wc.resultCount];
  r.round = wc.round;
  r.homeId = pairHomeId(wc, pair);
  r.awayId = pairAwayId(wc, pair);
  r.homeGoals = homeGoals;
  r.awayGoals = awayGoals;
  r.winner = winner;
  wc.resultCount++;
  wc.pairWinner[pair] = winner === 0 ? r.homeId : r.awayId;
  wc.resolved[pair] = true;
}

// The result is PRODUCED outside (match-run.ts: the headless simulation of SALTAR, or
// the match watched on screen with the same seed -- same trajectory, same winner) and
// only RECORDED here. Refuses the human's pair, a pair already resolved, and anything
// once the tournament is over.
export function resolveCpuMatch(wc: WorldCupState, pair: number, winner: 0 | 1, homeGoals: number, awayGoals: number): void {
  if (wc.status !== 'playing') return;
  if (pair < 0 || pair >= pairCount(wc) || pair === humanPairIndex(wc) || wc.resolved[pair]) return;
  recordResult(wc, pair, homeGoals, awayGoals, winner);
}

export function matchPoints(goalsFor: number, goalsAgainst: number, won: boolean): number {
  return goalsFor * SCORE_GOAL + (won ? SCORE_WIN : 0) + (goalsAgainst === 0 ? SCORE_CLEAN_SHEET : 0);
}

// The two invariants a human result must satisfy, thrown rather than swallowed: both
// are programming errors of the screen, not states of the game. (1) S-PK3: the match
// carries the human on the side his pair says. (2) The CPU pairs of the round are all
// resolved -- advanceRound needs their winners.
function requireHumanMatch(wc: WorldCupState, match: MatchState): 0 | 1 {
  const side = humanSideInPair(wc);
  if (match.teams[side].id !== wc.humanId) throw new Error(`human must be team ${side} of this pair (S-PK3)`);
  if (nextCpuPair(wc) !== -1) throw new Error('every CPU pair must be resolved before the human match');
  return side;
}

function advanceRound(wc: WorldCupState): void {
  const n = pairCount(wc);
  for (let pair = 0; pair < n; pair++) {
    wc.entrants[pair] = wc.pairWinner[pair];
    wc.pairWinner[pair] = '';
    wc.resolved[pair] = false;
  }
  wc.entrants.length = n;
  wc.round = NEXT_ROUND[wc.round];
}

// The clean sheet is read from match.score: the shootout never touches it (S-PK12), so
// a 0-0 decided on penalties is a clean sheet for BOTH sides by construction.
export function winHumanMatch(wc: WorldCupState, match: MatchState): void {
  if (wc.status !== 'playing') return;
  const side = requireHumanMatch(wc, match);
  if (winnerOf(match) !== side) throw new Error('winHumanMatch called on a match the human did not win');
  const other: 0 | 1 = side === 0 ? 1 : 0;
  wc.score += matchPoints(match.score[side], match.score[other], true) + ROUND_BONUS[wc.round];
  recordResult(wc, humanPairIndex(wc), match.score[0], match.score[1], side);
  if (wc.round === 'final') {
    wc.status = 'champion';
    return;
  }
  advanceRound(wc);
}

export function loseHumanMatch(wc: WorldCupState, match: MatchState): void {
  if (wc.status !== 'playing') return;
  const side = requireHumanMatch(wc, match);
  const other: 0 | 1 = side === 0 ? 1 : 0;
  wc.score += matchPoints(match.score[side], match.score[other], false);
  recordResult(wc, humanPairIndex(wc), match.score[0], match.score[1], other);
  wc.status = 'eliminated';
}

// G9-8: the viewport guard abandoned the human's match (winnerOf === -1). ELIMINADO;
// the points of the rounds already played are what the table is offered. The
// abandoned match itself contributes nothing and is not recorded: it never finished.
export function abandonHumanMatch(wc: WorldCupState): void {
  if (wc.status !== 'playing') return;
  wc.status = 'eliminated';
}

// The invariant net of the bracket: eight distinct seeds of the bank with the human
// inside; entrants sized by the round, all seeded, no repeats, the human among them
// unless eliminated; every resolved pair won by one of its two. [] when it all holds.
export function checkWorldCupBracket(wc: WorldCupState, bankIds: readonly string[]): string[] {
  const problems: string[] = [];
  if (wc.bracket.length !== WORLD_CUP_SIZE) problems.push(`bracket size ${wc.bracket.length}`);
  const seeds = new Set<string>();
  for (const id of wc.bracket) {
    if (seeds.has(id)) problems.push(`duplicate seed ${id}`);
    if (!bankIds.includes(id)) problems.push(`seed outside the bank: ${id}`);
    seeds.add(id);
  }
  if (!seeds.has(wc.humanId)) problems.push('human missing from the bracket');

  if (wc.entrants.length !== ROUND_ENTRANTS[wc.round]) problems.push(`entrants size ${wc.entrants.length} for round ${wc.round}`);
  const seen = new Set<string>();
  for (const id of wc.entrants) {
    if (seen.has(id)) problems.push(`duplicate entrant ${id}`);
    if (!seeds.has(id)) problems.push(`entrant outside the seeded bracket: ${id}`);
    seen.add(id);
  }
  if (wc.status !== 'eliminated' && !seen.has(wc.humanId)) problems.push('human missing from entrants');

  for (let pair = 0; pair < pairCount(wc); pair++) {
    if (!wc.resolved[pair]) continue;
    const w = wc.pairWinner[pair];
    if (w !== pairHomeId(wc, pair) && w !== pairAwayId(wc, pair)) problems.push(`pair ${pair} won by ${w}, who is not in it`);
  }
  if (wc.resultCount > wc.results.length) problems.push(`resultCount ${wc.resultCount} over ${wc.results.length}`);
  return problems;
}
