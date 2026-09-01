import type { FighterDef } from './fighters';
import { TECHNIQUES, type Dir, type Height, type Stance, type TechButton, type Technique } from './techniques';

const REACTION_MIN = 180;
const REACTION_MAX = 620;
const AGGRESSION_MIN = 0;
const AGGRESSION_MAX = 0.9;
const BLOCK_CHANCE_MIN = 0;
const BLOCK_CHANCE_MAX = 0.75;
const CROUCH_CHANCE_MIN = 0;
const CROUCH_CHANCE_MAX = 0.4;
const MAGIC_CHANCE_MIN = 0;
const MAGIC_CHANCE_MAX = 0.8;
const RETREAT_CHANCE = 0.3;

export type AiProfile = {
  reactionMs: number; // 180..620
  aggression: number; // 0..1
  blockChance: number; // 0..1
  crouchChance: number; // 0..1
  magicChance: number; // 0..1 — probabilidad de gastar la magia estando llena
  preferredRange: number; // px a los que intenta pelear
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// Derives the profile from the fighter itself and its position in the story mode —
// no parallel tables by level: these are pure formulas over FighterDef + difficulty.
export function profileFor(def: FighterDef, difficulty: number): AiProfile {
  return {
    reactionMs: clamp(620 - def.speed * 30 - difficulty * 18, REACTION_MIN, REACTION_MAX),
    aggression: clamp(0.22 + def.strength * 0.03 + difficulty * 0.025, AGGRESSION_MIN, AGGRESSION_MAX),
    blockChance: clamp(0.18 + difficulty * 0.045, BLOCK_CHANCE_MIN, BLOCK_CHANCE_MAX),
    crouchChance: clamp(0.1 + def.speed * 0.015, CROUCH_CHANCE_MIN, CROUCH_CHANCE_MAX),
    magicChance: clamp(0.3 + difficulty * 0.05, MAGIC_CHANCE_MIN, MAGIC_CHANCE_MAX),
    preferredRange: 46 + def.reach * 7,
  };
}

export type AiContext = {
  distance: number;
  playerAttacking: boolean;
  playerAttackHeight: Height | null;
  cpuBusy: boolean;
  cpuMagicReady: boolean;
};

// Deliberately absent: cpuHealth / playerHealth. They were written on every
// decision and `decide` never read them. Making the AI desperate at low health
// is a balance change, not a seam fix, so the fields go rather than growing an
// unplayed behaviour at final review; AiContext now carries only what decide reads.

export type AiAction = {
  move: 'approach' | 'retreat' | 'idle';
  stance: Stance;
  attackDir: Dir | null;
  attackButton: TechButton | null;
  magic: boolean;
};

export function createAiAction(): AiAction {
  return { move: 'idle', stance: 'stand', attackDir: null, attackButton: null, magic: false };
}

// `decide` does not know `difficulty` (it only receives the already-derived profile),
// so it uses `aggression` as a proxy: the more aggressive the profile, the more slow
// and strong techniques are weighted over fast and weak ones.
// Exported so the bias can be anchored directly with a test: `decide` only ever calls
// this once the aggression roll already passed, so aggression = 0 (the uniform case)
// can never be observed through `decide` itself — the gate `rng() < 0` is never true.
export function techniqueWeight(t: Technique, aggression: number): number {
  return 1 + aggression * ((t.startupMs * t.baseDamage) / 1000);
}

function pickTechnique(aggression: number, rng: () => number): Technique {
  let total = 0;
  for (let i = 0; i < TECHNIQUES.length; i++) {
    total += techniqueWeight(TECHNIQUES[i], aggression);
  }
  let roll = rng() * total;
  for (let i = 0; i < TECHNIQUES.length; i++) {
    const w = techniqueWeight(TECHNIQUES[i], aggression);
    if (roll < w) return TECHNIQUES[i];
    roll -= w;
  }
  return TECHNIQUES[TECHNIQUES.length - 1];
}

// Called every frame: writes into `out`, allocates nothing (no object literals,
// spread, filter/map, new, or closures) and never touches Math.random — the rng
// always comes in as a parameter.
export function decide(profile: AiProfile, ctx: AiContext, rng: () => number, out: AiAction): void {
  if (ctx.cpuMagicReady && rng() < profile.magicChance) {
    out.move = 'idle';
    out.stance = 'stand';
    out.attackDir = null;
    out.attackButton = null;
    out.magic = true;
    return;
  }

  if (ctx.playerAttacking && ctx.playerAttackHeight === 'high' && rng() < profile.crouchChance) {
    out.move = 'idle';
    out.stance = 'crouch';
    out.attackDir = null;
    out.attackButton = null;
    out.magic = false;
    return;
  }

  if (ctx.playerAttacking && rng() < profile.blockChance) {
    out.move = 'idle';
    out.stance = 'block';
    out.attackDir = null;
    out.attackButton = null;
    out.magic = false;
    return;
  }

  const inRange = ctx.distance <= profile.preferredRange;
  if (inRange && !ctx.cpuBusy && rng() < profile.aggression) {
    const t = pickTechnique(profile.aggression, rng);
    out.move = 'idle';
    out.stance = 'stand';
    out.attackDir = t.input.dir;
    out.attackButton = t.input.button;
    out.magic = false;
    return;
  }

  out.stance = 'stand';
  out.attackDir = null;
  out.attackButton = null;
  out.magic = false;
  out.move = inRange ? (rng() < RETREAT_CHANCE ? 'retreat' : 'idle') : 'approach';
}
