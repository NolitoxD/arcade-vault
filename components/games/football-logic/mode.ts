import { NORMAL_RULES, TRAINING_RULES, winnerOf, type MatchRules, type MatchState } from './match';
import { createRng, type Rng } from './rng';
import * as worldCup from './world-cup';
import type { WorldCupState } from './world-cup';

// The seam between VaultWorldCupGame.tsx and the four modes (spec, data model: "igual
// que la de Vault Fighter"). The component holds ONE GameMode, built once when a run
// starts, and every question it asks -- who is human, who plays, at what difficulty,
// under which rules, what happens when the match ends, what the victory screen says --
// goes through a function here. The branch by mode lives here ONCE; the component
// never asks "which mode am I in" (Global Constraints: no `kind ===` in the .tsx).
export type GameModeKind = 'friendly-cpu' | 'friendly-2p' | 'training' | 'world-cup';
type FriendlyKind = Exclude<GameModeKind, 'world-cup'>;

// 'champion' is a human win that gets a victory screen (GANADOR for a friendly,
// CAMPEONES DEL MUNDO for the final); 'eliminated' is the ELIMINADO caption over the
// pitch (spec 60-61); 'draw' only ever comes from abandon() at a level score.
type ModeStatus = 'playing' | 'champion' | 'eliminated' | 'draw';

// Who the keyboard drives in the current match. 'both' is the two-player friendly;
// 'none' is a CPU pair of the World Cup watched on screen (the component's spectate).
export type HumanSide = 0 | 1 | 'both' | 'none';

// The victory effect. Defined here and not in football-screen/particles.ts because
// this folder never imports from the screen; particles.ts imports it from here.
// exported for Task 9-6: particles/sfx victory effects
export type FxKind = 'confetti' | 'fireworks';

type FriendlyState = { homeId: string; awayId: string; status: ModeStatus };

export type GameMode =
  | { kind: FriendlyKind; state: FriendlyState }
  | { kind: 'world-cup'; state: WorldCupState };

// G9-6: 5 in every friendly, no selector.
export const FRIENDLY_DIFFICULTY = 5;

// G9-7: the draw stream (the World Cup's eight, or a friendly's rival) comes off the
// run seed by integer arithmetic, like every other stream of this game.
const DRAW_SEED_SALT = 0x6a09e667;

export function drawSeedFor(seed: number): number {
  return (seed ^ DRAW_SEED_SALT) >>> 0;
}

// G9-4: the rival of a friendly (CPU or training) is drawn, never chosen. Uniform over
// the other fifteen, one draw, no allocation.
export function drawRival(bankIds: readonly string[], homeId: string, rng: Rng): string {
  if (!bankIds.includes(homeId)) throw new Error(`home team not in bank: ${homeId}`);
  let k = Math.floor(rng() * (bankIds.length - 1));
  for (let i = 0; i < bankIds.length; i++) {
    if (bankIds[i] === homeId) continue;
    if (k === 0) return bankIds[i];
    k--;
  }
  throw new Error('unreachable: rival index out of range');
}

export function createFriendlyMode(kind: FriendlyKind, homeId: string, awayId: string): GameMode {
  if (homeId === awayId) throw new Error(`a friendly needs two different teams: ${homeId}`);
  return { kind, state: { homeId, awayId, status: 'playing' } };
}

export function createWorldCupMode(bankIds: readonly string[], humanId: string, seed: number): GameMode {
  return { kind: 'world-cup', state: worldCup.createWorldCup(bankIds, humanId, seed, createRng(drawSeedFor(seed))) };
}

export function sideIsHuman(side: HumanSide, team: 0 | 1): boolean {
  return side === 'both' || side === team;
}

const HUMAN_SIDE_BY_KIND: Readonly<Record<FriendlyKind, HumanSide>> = {
  'friendly-cpu': 0,
  'friendly-2p': 'both',
  training: 0,
};

// S-PK3 in the World Cup: the human is team 0 or 1 according to his slot in the pair.
export function modeHumanSide(m: GameMode): HumanSide {
  return m.kind === 'world-cup' ? worldCup.humanSideInPair(m.state) : HUMAN_SIDE_BY_KIND[m.kind];
}

export function modeHomeId(m: GameMode): string {
  if (m.kind !== 'world-cup') return m.state.homeId;
  return worldCup.pairHomeId(m.state, worldCup.humanPairIndex(m.state));
}

export function modeAwayId(m: GameMode): string {
  if (m.kind !== 'world-cup') return m.state.awayId;
  return worldCup.pairAwayId(m.state, worldCup.humanPairIndex(m.state));
}

export function modeDifficulty(m: GameMode): number {
  return m.kind === 'world-cup' ? worldCup.currentDifficulty(m.state) : FRIENDLY_DIFFICULTY;
}

// G9-1: the only mode with a switch on. Returns the frozen module constants, so the
// component can hand them to createMatch without copying.
export function modeRules(m: GameMode): Readonly<MatchRules> {
  return m.kind === 'training' ? TRAINING_RULES : NORMAL_RULES;
}

export function modeScore(m: GameMode): number {
  return m.kind === 'world-cup' ? m.state.score : 0;
}

// Criterion 19: only the World Cup writes to the table. The component fires
// onGameOver / onVictory only when this is true.
export function modeScores(m: GameMode): boolean {
  return m.kind === 'world-cup';
}

// null when the mode has no bracket: that is how the component decides the draw and
// bracket phases exist at all, without asking which mode it holds.
export function modeBracket(m: GameMode): WorldCupState | null {
  return m.kind === 'world-cup' ? m.state : null;
}

// A friendly plays on the run seed itself; a World Cup match on its derived seed.
export function modeMatchSeed(m: GameMode, runSeed: number): number {
  return m.kind === 'world-cup' ? worldCup.humanMatchSeed(m.state) : runSeed;
}

// Whether a human WIN of the current match ends on a victory screen (and so the
// GANADOR caption is not queued, final review §8.5). Friendlies: always. Training:
// never -- it has no end. World Cup: only the final.
export function modeVictoryScreen(m: GameMode): boolean {
  switch (m.kind) {
    case 'friendly-cpu':
    case 'friendly-2p':
      return true;
    case 'training':
      return false;
    case 'world-cup':
      return worldCup.isFinal(m.state);
  }
}

export function modeStatus(m: GameMode): ModeStatus {
  return m.state.status;
}

// The natural end of a match. winnerOf is the ONE reader of the winner (stage B2 §8);
// -1 only comes from abandon(), which modeAbandonMatch handles -- but a component that
// routed an abandon here by mistake still gets a sane answer (draw / eliminated).
export function modeEndMatch(m: GameMode, match: MatchState): void {
  const winner = winnerOf(match);
  if (m.kind === 'world-cup') {
    if (winner === -1) worldCup.abandonHumanMatch(m.state);
    else if (winner === worldCup.humanSideInPair(m.state)) worldCup.winHumanMatch(m.state, match);
    else worldCup.loseHumanMatch(m.state, match);
    return;
  }
  const s = m.state;
  if (s.status !== 'playing') return;
  if (winner === -1) s.status = 'draw';
  else s.status = sideIsHuman(HUMAN_SIDE_BY_KIND[m.kind], winner) ? 'champion' : 'eliminated';
}

// The viewport guard's end. G9-8: a World Cup match abandoned is ELIMINADO whatever
// the score stood at, with the points of the rounds already played kept. A friendly
// reads the standing score like the natural end (S-SC12: GANADOR / ELIMINADO / EMPATE
// on the canvas), because abandon() does not touch the score.
export function modeAbandonMatch(m: GameMode, match: MatchState): void {
  if (m.kind === 'world-cup') {
    worldCup.abandonHumanMatch(m.state);
    return;
  }
  modeEndMatch(m, match);
}

// The team the victory screen names: whoever won the match that ended the run. In
// the two-player friendly that is either side; in the World Cup it is the human.
export function modeVictoryTeamId(m: GameMode, match: MatchState): string {
  const winner = winnerOf(match);
  return winner === -1 ? modeHomeId(m) : match.teams[winner].id;
}

// Pre-built at module load, never per frame.
const MATCH_LABEL_BY_KIND: Readonly<Record<FriendlyKind, string>> = {
  'friendly-cpu': 'AMISTOSO',
  'friendly-2p': 'AMISTOSO A DOS',
  training: 'ENTRENAMIENTO',
};
const FRIENDLY_VICTORY_TITLE = 'GANADOR';
const WORLD_CUP_VICTORY_TITLE = 'CAMPEONES DEL MUNDO';

export function modeMatchLabel(m: GameMode): string {
  return m.kind === 'world-cup' ? worldCup.roundLabel(m.state) : MATCH_LABEL_BY_KIND[m.kind];
}

export function modeVictoryTitle(m: GameMode): string {
  return m.kind === 'world-cup' ? WORLD_CUP_VICTORY_TITLE : FRIENDLY_VICTORY_TITLE;
}

// Spec: confetti for a friendly, fireworks for the World Cup.
export function modeFxKind(m: GameMode): FxKind {
  return m.kind === 'world-cup' ? 'fireworks' : 'confetti';
}
