import type { Dir, Height, TechButton } from './techniques';
import { TECHNIQUES } from './techniques';

// spec 25 "Escalado de rivales": [reactionMs, aggression, blockChance, fullPointBias]
export const OPPONENT_CONFIG: readonly (readonly [number, number, number, number])[] = [
  [600, 0.3, 0.2, 0.2],
  [540, 0.35, 0.25, 0.22],
  [480, 0.4, 0.3, 0.25],
  [430, 0.45, 0.35, 0.28],
  [380, 0.5, 0.4, 0.32],
  [330, 0.55, 0.45, 0.36],
  [290, 0.62, 0.5, 0.4],
  [250, 0.68, 0.55, 0.44],
  [210, 0.74, 0.6, 0.47],
  [180, 0.8, 0.65, 0.5],
];

export function opponentFor(level: number): readonly [number, number, number, number] {
  const idx = Math.min(Math.max(Math.floor(level), 1), OPPONENT_CONFIG.length) - 1;
  return OPPONENT_CONFIG[idx];
}

const ATTACK_RANGE = 100;
const RETREAT_CHANCE = 0.3;

export type AiAction = {
  move: 'approach' | 'retreat' | 'idle';
  block: Height | null;
  attack: { dir: Dir; button: TechButton } | null;
};

type DecideContext = {
  distance: number;
  playerAttacking: boolean;
  playerAttackHeight: Height | null;
  cpuBusy: boolean;
};

function pickTechnique(fullPointBias: number, rng: () => number): { dir: Dir; button: TechButton } {
  const wantsFullPoint = rng() < fullPointBias;
  const pool = TECHNIQUES.filter((t) => (wantsFullPoint ? t.points === 1 : t.points === 0.5));
  const idx = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
  const t = pool[idx];
  return { dir: t.input.dir, button: t.input.button };
}

export function decide(level: number, ctx: DecideContext, rng: () => number): AiAction {
  const [, aggression, blockChance, fullPointBias] = opponentFor(level);

  if (ctx.playerAttacking && ctx.playerAttackHeight !== null && rng() < blockChance) {
    return { move: 'idle', block: ctx.playerAttackHeight, attack: null };
  }

  const inRange = ctx.distance <= ATTACK_RANGE;
  if (inRange && !ctx.cpuBusy && rng() < aggression) {
    return { move: 'idle', block: null, attack: pickTechnique(fullPointBias, rng) };
  }

  if (!inRange) {
    return { move: 'approach', block: null, attack: null };
  }

  const move = rng() < RETREAT_CHANCE ? 'retreat' : 'idle';
  return { move, block: null, attack: null };
}
