import type { FighterDef } from './fighters';

export type Dir = 'neutral' | 'up' | 'down' | 'forward';
export type TechButton = 'a' | 'b';
export type Height = 'high' | 'mid' | 'low';
export type Stance = 'stand' | 'block' | 'crouch';

export type Technique = {
  id: string;
  input: { dir: Dir; button: TechButton };
  name: string;
  height: Height;
  baseDamage: number;
  baseReach: number;
  startupMs: number;
  recoveryMs: number;
  advance: number;
};

export const TECHNIQUES: readonly Technique[] = [
  {
    id: 'punetazo',
    input: { dir: 'neutral', button: 'b' },
    name: 'Puñetazo',
    height: 'mid',
    baseDamage: 6,
    baseReach: 40,
    startupMs: 120,
    recoveryMs: 160,
    advance: 0,
  },
  {
    id: 'punetazo-bajo',
    input: { dir: 'down', button: 'b' },
    name: 'Puñetazo bajo',
    height: 'low',
    baseDamage: 7,
    baseReach: 45,
    startupMs: 140,
    recoveryMs: 190,
    advance: 0,
  },
  {
    id: 'patada-frontal',
    input: { dir: 'neutral', button: 'a' },
    name: 'Patada frontal',
    height: 'mid',
    baseDamage: 8,
    baseReach: 55,
    startupMs: 150,
    recoveryMs: 200,
    advance: 0,
  },
  {
    id: 'barrido',
    input: { dir: 'down', button: 'a' },
    name: 'Barrido',
    height: 'low',
    baseDamage: 9,
    baseReach: 35,
    startupMs: 200,
    recoveryMs: 260,
    advance: 0,
  },
  {
    id: 'golpe-con-salto',
    input: { dir: 'forward', button: 'b' },
    name: 'Golpe con salto',
    height: 'mid',
    baseDamage: 12,
    baseReach: 65,
    startupMs: 300,
    recoveryMs: 400,
    advance: 34,
  },
  {
    id: 'golpe-alto',
    input: { dir: 'up', button: 'b' },
    name: 'Golpe alto',
    height: 'high',
    baseDamage: 13,
    baseReach: 55,
    startupMs: 320,
    recoveryMs: 420,
    advance: 0,
  },
  {
    id: 'patada-alta',
    input: { dir: 'up', button: 'a' },
    name: 'Patada alta',
    height: 'high',
    baseDamage: 14,
    baseReach: 85,
    startupMs: 340,
    recoveryMs: 450,
    advance: 0,
  },
  {
    id: 'patada-voladora',
    input: { dir: 'forward', button: 'a' },
    name: 'Patada voladora',
    height: 'high',
    baseDamage: 16,
    baseReach: 90,
    startupMs: 420,
    recoveryMs: 520,
    advance: 52,
  },
];

export function resolveTechnique(dir: Dir, button: TechButton): Technique {
  const t = TECHNIQUES.find((tech) => tech.input.dir === dir && tech.input.button === button);
  if (!t) throw new Error(`No technique for ${dir}+${button}`);
  return t;
}

export const BLOCK_LEAK = 0.35;
export const CROUCH_LOW_BONUS = 1.25;

export function scaledDamage(t: Technique, attacker: FighterDef): number {
  return t.baseDamage * (0.6 + (attacker.strength / 10) * 0.8);
}

export function scaledReach(t: Technique, attacker: FighterDef): number {
  return t.baseReach * (0.7 + (attacker.reach / 10) * 0.6);
}

export function scaledStartup(t: Technique, attacker: FighterDef): number {
  return t.startupMs * (1.3 - (attacker.speed / 10) * 0.6);
}

export function scaledRecovery(t: Technique, attacker: FighterDef): number {
  return t.recoveryMs * (1.3 - (attacker.speed / 10) * 0.6);
}

export type CombatantView = {
  x: number;
  facing: 1 | -1;
  stance: Stance;
  busyUntilMs: number;
};

export type HitOutcome = {
  result: 'idle' | 'miss' | 'evaded' | 'blocked' | 'grazed' | 'hit';
  damage: number;
};

export function createHitOutcome(): HitOutcome {
  return { result: 'idle', damage: 0 };
}

export function resolveHit(
  attacker: CombatantView,
  attackerDef: FighterDef,
  defender: CombatantView,
  t: Technique,
  nowMs: number,
  out: HitOutcome,
): void {
  if (attacker.busyUntilMs > nowMs || attacker.stance === 'block') {
    out.result = 'idle';
    out.damage = 0;
    return;
  }
  if (Math.abs(defender.x - attacker.x) > scaledReach(t, attackerDef)) {
    out.result = 'miss';
    out.damage = 0;
    return;
  }
  if (defender.stance === 'crouch' && t.height === 'high') {
    out.result = 'evaded';
    out.damage = 0;
    return;
  }
  if (defender.stance === 'block') {
    if (t.height === 'low') {
      out.result = 'grazed';
      out.damage = Math.round(scaledDamage(t, attackerDef) * BLOCK_LEAK);
    } else {
      out.result = 'blocked';
      out.damage = 0;
    }
    return;
  }
  if (defender.stance === 'crouch' && t.height === 'low') {
    out.result = 'hit';
    out.damage = Math.round(scaledDamage(t, attackerDef) * CROUCH_LOW_BONUS);
    return;
  }
  out.result = 'hit';
  out.damage = Math.round(scaledDamage(t, attackerDef));
}
