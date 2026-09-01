import type { FighterDef } from './fighters';
import type { Stance } from './techniques';

export const MAX_HEALTH = 100;
export const ROUNDS_TO_WIN = 3;
export const NOMINAL_ROUNDS = 5; // "best of five" label for the HUD; draws can stretch a bout past it — see boutWinner.
export const ROUND_TIME_MS = 60_000;
export const MAGIC_MAX = 100;
export const MAGIC_CHARGE_DEAL = 1.4; // per point of damage DEALT
export const MAGIC_CHARGE_TAKE = 0.6; // per point of damage TAKEN (taking a hit charges less)

// Minimum separation the two fighters are ever clamped to. It is a RULE, not a
// canvas detail, so it lives here next to the start positions: every technique
// of every fighter must still be able to connect at this distance.
// Tightest case in the real tables: `barrido` (baseReach 35) thrown by a
// reach-3 fighter (GLITCH / VOLTIO) → 35 * (0.7 + 0.3 * 0.6) = 30.8px.
// 26 leaves 4.8px (~16%) of margin. Guarded by checkReachClearsGap().
export const MIN_GAP = 26;

// How long a fighter stays stunned after being hit. Also a rule: it must be
// strictly SHORTER than the fastest attack cycle any fighter can produce, or
// the attacker recovers before the defender does and a single button loops
// forever. Fastest cycle in the real tables: `punetazo` (120 + 160 = 280ms)
// thrown by a speed-9 fighter (GLITCH) → 280 * (1.3 - 0.9 * 0.6) = 212.8ms.
// 180 leaves 32.8ms (~15%) of margin. Guarded by checkStunClearsFastestCycle().
export const HIT_STUN_MS = 180;

export type Side = 'player' | 'cpu';

export type CombatantState = {
  def: FighterDef;
  x: number;
  facing: 1 | -1;
  stance: Stance;
  health: number;
  magic: number;
  shield: number; // absorbed by applyDamage before any damage lands (MURO)
  busyUntilMs: number;
  stunUntilMs: number;
  techId: string | null;
  techStartMs: number;
  hitEvaluated: boolean;
  walking: boolean;
  walkMs: number;
};

export type BoutState = {
  round: number; // 1-based
  playerRounds: number;
  cpuRounds: number;
  roundMs: number; // elapsed in the current round
  roundResolved: boolean; // true once commitRound has consumed the current round's outcome
  player: CombatantState;
  cpu: CombatantState;
};

// Canvas is 800x500: these are symmetric around the 400 center, 200px apart —
// wider than the game's max scaled reach (~111px), so a round always opens out of range.
export const PLAYER_START_X = 300;
export const CPU_START_X = 500;
export const PLAYER_START_FACING: 1 | -1 = 1;
export const CPU_START_FACING: 1 | -1 = -1;

export function createCombatant(def: FighterDef, x: number, facing: 1 | -1): CombatantState {
  return {
    def,
    x,
    facing,
    stance: 'stand',
    health: MAX_HEALTH,
    magic: 0,
    shield: 0,
    busyUntilMs: 0,
    stunUntilMs: 0,
    techId: null,
    techStartMs: 0,
    hitEvaluated: false,
    walking: false,
    walkMs: 0,
  };
}

export function createBout(playerDef: FighterDef, cpuDef: FighterDef): BoutState {
  return {
    round: 1,
    playerRounds: 0,
    cpuRounds: 0,
    roundMs: 0,
    roundResolved: false,
    player: createCombatant(playerDef, PLAYER_START_X, PLAYER_START_FACING),
    cpu: createCombatant(cpuDef, CPU_START_X, CPU_START_FACING),
  };
}

export function startBout(bout: BoutState, playerDef: FighterDef, cpuDef: FighterDef): void {
  bout.round = 1;
  bout.playerRounds = 0;
  bout.cpuRounds = 0;
  bout.player.def = playerDef;
  bout.cpu.def = cpuDef;
  startRound(bout);
}

function resetForRound(c: CombatantState, x: number, facing: 1 | -1): void {
  c.x = x;
  c.facing = facing;
  c.stance = 'stand';
  c.health = MAX_HEALTH;
  c.magic = 0;
  c.shield = 0;
  c.busyUntilMs = 0;
  c.stunUntilMs = 0;
  c.techId = null;
  c.techStartMs = 0;
  c.hitEvaluated = false;
  c.walking = false;
  c.walkMs = 0;
}

export function startRound(bout: BoutState): void {
  bout.roundMs = 0;
  bout.roundResolved = false;
  resetForRound(bout.player, PLAYER_START_X, PLAYER_START_FACING);
  resetForRound(bout.cpu, CPU_START_X, CPU_START_FACING);
}

// The single funnel for every point of damage in the game: melee, projectile,
// area and sustained damage all come through here. The shield (MURO) is
// absorbed INSIDE it on purpose — it used to be applied by each caller, and a
// caller that forgot made MURO silently do nothing. Returns the damage that
// actually got past the shield, for the callers that score it.
export function applyDamage(bout: BoutState, to: Side, amount: number): number {
  const target = bout[to];
  const attacker = to === 'player' ? bout.cpu : bout.player;

  let dealt = amount;
  if (target.shield > 0 && dealt > 0) {
    const absorbed = Math.min(target.shield, dealt);
    target.shield -= absorbed;
    dealt -= absorbed;
  }

  target.health = Math.max(0, target.health - dealt);
  if (dealt > 0) {
    addMagic(target, dealt * MAGIC_CHARGE_TAKE);
    addMagic(attacker, dealt * MAGIC_CHARGE_DEAL);
  }
  return dealt;
}

export function roundWinner(bout: BoutState): Side | 'draw' | null {
  if (bout.roundResolved) return null;
  if (bout.player.health === 0 && bout.cpu.health === 0) return 'draw';
  if (bout.player.health === 0) return 'cpu';
  if (bout.cpu.health === 0) return 'player';
  if (bout.roundMs >= ROUND_TIME_MS) {
    if (bout.player.health > bout.cpu.health) return 'player';
    if (bout.cpu.health > bout.player.health) return 'cpu';
    return 'draw';
  }
  return null;
}

export function commitRound(bout: BoutState, winner: Side | 'draw'): void {
  if (winner === 'player') bout.playerRounds += 1;
  else if (winner === 'cpu') bout.cpuRounds += 1;
  bout.round += 1;
  bout.roundResolved = true;
}

export function boutWinner(bout: BoutState): Side | null {
  if (bout.playerRounds >= ROUNDS_TO_WIN) return 'player';
  if (bout.cpuRounds >= ROUNDS_TO_WIN) return 'cpu';
  return null;
}

export function isMagicReady(c: CombatantState): boolean {
  return c.magic >= MAGIC_MAX;
}

export function spendMagic(c: CombatantState): void {
  c.magic = 0;
}

export function addMagic(c: CombatantState, amount: number): void {
  c.magic = Math.min(MAGIC_MAX, c.magic + amount);
}
