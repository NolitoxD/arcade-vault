import { bossFighter, difficultyRank, fighterById, selectableFighters, type FighterDef, type FighterId } from './fighters';
import type { StageDef } from './stages';

export const BRACKET_SIZE = 8;
export const TOURNAMENT_BOUTS = 4;

// How much the normalized difficultyRank (0..1 within the roster received)
// stretches the draw weight. See boutWeight — with SPREAD = 3 the strongest
// of the eight beats the weakest ~80% of the time instead of the ~53% a raw
// rank ratio would give, because the eight ranks only span an 11% range.
export const SPREAD = 3;

// Tournament scoring, double the story.ts figures per bout/round/damage
// point, except the finishing bonus which matches the boss bonus exactly —
// see the ceiling test at the bottom of tournament.test.ts for the proof
// that both modes cap at the same 84,000.
export const SCORE_PER_DAMAGE = 20;
export const SCORE_ROUND = 4_000;
export const SCORE_PERFECT_ROUND = 2_000;
export const SCORE_BOUT = 16_000;
export const SCORE_BLACK_BELT = 20_000;

export type TournamentRound = 'quarters' | 'semis' | 'final' | 'black-belt';
export type TournamentStatus = 'fighting' | 'champion' | 'eliminated';

export type TournamentState = {
  playerId: FighterId;
  round: TournamentRound;
  // The eight, in the order the draw seeded them, fixed for the whole run.
  // `entrants` shrinks 8 -> 4 -> 2 -> 1 and forgets who was knocked out, so
  // without this there is no way to say who fell — and the bracket screen
  // exists precisely to say it. Derived state does not work here: the seeded
  // order is random, so it cannot be recomputed from the roster, and once a
  // round is over the losers are gone. It lives in the state, not in the
  // component, because "who is in this bracket and where" is a rule.
  bracket: FighterId[];
  entrants: FighterId[]; // this round's participants: 8 -> 4 -> 2 -> 1
  opponentId: FighterId; // the player's rival now; 'arquitecto' in the super final
  stageIds: string[]; // 3 drawn stages (quarters, semis, final) + 'nucleo' for black-belt
  status: TournamentStatus;
  score: number;
};

const ROUND_LABELS: Record<TournamentRound, string> = {
  quarters: 'CUARTOS',
  semis: 'SEMIFINAL',
  final: 'FINAL',
  'black-belt': 'SUPER FINAL',
};

// 3, 5, 7, 8 — NOT 1..4. The story mode runs bout+1 from 1 to 8 (see
// story.ts currentDifficulty); the tournament starts above where the story
// starts, climbs faster, and lands on the same 8 for the black-belt bout
// as the story's boss bout, so the super final is never softer than it.
const ROUND_DIFFICULTY: Record<TournamentRound, number> = {
  quarters: 3,
  semis: 5,
  final: 7,
  'black-belt': 8,
};

// Index into stageIds for each round: the 3 drawn stages cover quarters,
// semis and final in that order, and slot 3 is always 'nucleo'.
const ROUND_STAGE_INDEX: Record<TournamentRound, number> = {
  quarters: 0,
  semis: 1,
  final: 2,
  'black-belt': 3,
};

const NUCLEO_STAGE_ID = 'nucleo';

// The round each round advances to on a win. 'black-belt' maps to itself:
// winBout returns before this table is consulted for that round, so the
// entry is unreachable, but a total map keeps the lookup free of casts.
const NEXT_ROUND: Record<TournamentRound, TournamentRound> = {
  quarters: 'semis',
  semis: 'final',
  final: 'black-belt',
  'black-belt': 'black-belt',
};

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// The 3 quarters/semis/final stages, drawn without repeats from the seven
// non-nucleo stages the given `stages` array carries (never a hard-coded
// count of 7 or a positional index — 'nucleo' is filtered out by id, so the
// draw stays correct even if the stages array is ever reordered). The
// nucleo slot is appended last, reserved for the black-belt bout.
function drawStageIds(stages: readonly StageDef[], rng: () => number): string[] {
  const candidates = stages.filter((s) => s.id !== NUCLEO_STAGE_ID).map((s) => s.id);
  const drawnCount = TOURNAMENT_BOUTS - 1; // quarters, semis, final — black-belt is fixed
  const drawn = shuffled(candidates, rng).slice(0, drawnCount);
  return [...drawn, NUCLEO_STAGE_ID];
}

// Pairings within a round are the consecutive pairs 0-1, 2-3, 4-5, 6-7.
function opponentInPair(entrants: readonly FighterId[], fighterId: FighterId): FighterId {
  const index = entrants.indexOf(fighterId);
  if (index === -1) throw new Error(`fighter not in bracket: ${fighterId}`);
  const partnerIndex = index % 2 === 0 ? index + 1 : index - 1;
  const partner = entrants[partnerIndex];
  if (partner === undefined) throw new Error(`no opponent paired with ${fighterId}`);
  return partner;
}

// weight(f) = 1 + SPREAD * norm(f), norm(f) = (rank(f) - min) / (max - min),
// min and max taken from the selectable fighters in the roster received —
// never hard-coded — so the draw reflows itself if the roster ever changes.
export function boutWeight(fighter: FighterDef, roster: readonly FighterDef[]): number {
  const ranks = selectableFighters(roster).map(difficultyRank);
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  const span = max - min;
  const norm = span === 0 ? 0 : (difficultyRank(fighter) - min) / span;
  return 1 + SPREAD * norm;
}

// Resolves one bout the player does not fight, weighted by boutWeight.
// P(a wins) = weight(a) / (weight(a) + weight(b)).
export function drawWinner(
  aId: FighterId, bId: FighterId, roster: readonly FighterDef[], rng: () => number,
): FighterId {
  const a = fighterById(roster, aId);
  const b = fighterById(roster, bId);
  if (!a) throw new Error(`fighter not found in roster: ${aId}`);
  if (!b) throw new Error(`fighter not found in roster: ${bId}`);

  const weightA = boutWeight(a, roster);
  const weightB = boutWeight(b, roster);
  return rng() < weightA / (weightA + weightB) ? aId : bId;
}

export function createTournament(
  roster: readonly FighterDef[], playerId: FighterId,
  stages: readonly StageDef[], rng: () => number,
): TournamentState {
  const bracket = shuffled(selectableFighters(roster).map((f) => f.id), rng);
  // Two arrays, not one shared reference: winBout reassigns `entrants`, but
  // anything that wrote through `entrants[i]` would otherwise rewrite the
  // seeded bracket too.
  const entrants = [...bracket];

  return {
    playerId,
    round: 'quarters',
    bracket,
    entrants,
    opponentId: opponentInPair(entrants, playerId),
    stageIds: drawStageIds(stages, rng),
    status: 'fighting',
    score: 0,
  };
}

export function currentOpponent(roster: readonly FighterDef[], t: TournamentState): FighterDef {
  const fighter = fighterById(roster, t.opponentId);
  if (!fighter) throw new Error(`fighter not found in roster: ${t.opponentId}`);
  return fighter;
}

export function currentStage(stages: readonly StageDef[], t: TournamentState): StageDef {
  const stageId = t.stageIds[ROUND_STAGE_INDEX[t.round]];
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`stage not found in bracket: ${stageId}`);
  return stage;
}

export function currentDifficulty(t: TournamentState): number {
  return ROUND_DIFFICULTY[t.round];
}

export function boutLabel(t: TournamentState): string {
  return ROUND_LABELS[t.round];
}

// Reads for the bracket screen. They are rules, not presentation: "still in"
// is membership of the current round and "finale" is the round that closes
// the bracket, so both belong here and neither is re-derived in the .tsx.
export function isStillIn(t: TournamentState, id: FighterId): boolean {
  return t.entrants.includes(id);
}

export function isFinale(t: TournamentState): boolean {
  return t.round === 'black-belt';
}

// Takes `roster` because resolving the three bouts the player doesn't
// fight needs each entrant's difficultyRank, which only exists on a
// FighterDef — the spec's own signature (`winBout(roster, t, rng)`), with
// the collection first like every other function here (currentOpponent,
// currentStage, drawWinner, boutWeight). Nothing in this module reads a
// module-level ROSTER; the roster always arrives by parameter.
export function winBout(roster: readonly FighterDef[], t: TournamentState, rng: () => number): void {
  if (t.status !== 'fighting') return;

  if (t.round === 'black-belt') {
    t.status = 'champion';
    t.score += SCORE_BOUT + SCORE_BLACK_BELT;
    return;
  }

  t.score += SCORE_BOUT;

  const nextEntrants: FighterId[] = [];
  for (let i = 0; i < t.entrants.length; i += 2) {
    const a = t.entrants[i];
    const b = t.entrants[i + 1];
    nextEntrants.push(a === t.playerId || b === t.playerId ? t.playerId : drawWinner(a, b, roster, rng));
  }

  t.entrants = nextEntrants;
  t.round = NEXT_ROUND[t.round];
  t.opponentId = t.round === 'black-belt' ? bossFighter(roster).id : opponentInPair(nextEntrants, t.playerId);
}

export function loseBout(t: TournamentState): void {
  if (t.status !== 'fighting') return;

  t.status = 'eliminated';
}

export function awardDamage(t: TournamentState, damage: number): void {
  if (t.status !== 'fighting') return;

  t.score += damage * SCORE_PER_DAMAGE;
}

export function awardRound(t: TournamentState, perfect: boolean): void {
  if (t.status !== 'fighting') return;

  t.score += SCORE_ROUND + (perfect ? SCORE_PERFECT_ROUND : 0);
}

// The invariant net for the bracket. Combines: exactly the eight selectable
// fighters at quarters (no more, no less), the player always inside, nobody
// twice, arquitecto never in the bracket and always (only) the black-belt
// rival, and each round sized 8/4/2/1. Returns [] when everything holds.
export function checkTournamentBracket(t: TournamentState, roster: readonly FighterDef[]): string[] {
  const problems: string[] = [];

  const boss = bossFighter(roster);
  const selectableIds = selectableFighters(roster).map((f) => f.id);

  const expectedSize: Record<TournamentRound, number> = {
    quarters: BRACKET_SIZE,
    semis: BRACKET_SIZE / 2,
    final: BRACKET_SIZE / 4,
    'black-belt': 1,
  };
  if (t.entrants.length !== expectedSize[t.round]) {
    problems.push(`entrants size ${t.entrants.length} for round ${t.round}`);
  }

  const seen = new Set<FighterId>();
  for (const id of t.entrants) {
    if (seen.has(id)) problems.push(`duplicate entrant ${id}`);
    seen.add(id);
  }

  // The seeded bracket: always the eight, never the boss, never a repeat, and
  // never losing anyone — every round's entrants must be a subset of it, which
  // is what lets the screen paint the fallen as "the bracket minus entrants".
  if (t.bracket.length !== BRACKET_SIZE) {
    problems.push(`bracket size ${t.bracket.length}`);
  }
  const seenSeeds = new Set<FighterId>();
  for (const id of t.bracket) {
    if (seenSeeds.has(id)) problems.push(`duplicate seed ${id}`);
    seenSeeds.add(id);
  }
  if (t.bracket.includes(boss.id)) problems.push('arquitecto seeded in the bracket');
  for (const id of selectableIds) {
    if (!seenSeeds.has(id)) problems.push(`selectable fighter missing from bracket: ${id}`);
  }
  for (const id of t.entrants) {
    if (!seenSeeds.has(id)) problems.push(`entrant outside the seeded bracket: ${id}`);
  }

  if (!t.entrants.includes(t.playerId)) problems.push('player missing from entrants');

  if (t.entrants.includes(boss.id)) problems.push('arquitecto in the bracket');

  if (t.round === 'quarters') {
    const isExactlyTheEight = selectableIds.length === t.entrants.length
      && selectableIds.every((id) => t.entrants.includes(id));
    if (!isExactlyTheEight) problems.push('quarters entrants are not exactly the 8 selectable fighters');
  }

  if (t.round === 'black-belt') {
    if (t.opponentId !== boss.id) problems.push('black-belt opponent is not arquitecto');
  } else if (t.opponentId === boss.id) {
    problems.push(`arquitecto faced outside black-belt (round ${t.round})`);
  }

  return problems;
}
