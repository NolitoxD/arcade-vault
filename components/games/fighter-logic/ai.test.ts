import { describe, expect, it } from 'vitest';
import type { FighterDef } from './fighters';
import { resolveTechnique } from './techniques';
import {
  createAiAction,
  decide,
  profileFor,
  techniqueWeight,
  type AiAction,
  type AiContext,
  type AiProfile,
} from './ai';

const PALETTE = { body: '#111111', trim: '#222222', accent: '#333333' };

function makeFighter(overrides: Partial<FighterDef> & Pick<FighterDef, 'id'>): FighterDef {
  return {
    name: overrides.id.toUpperCase(),
    strength: 5,
    speed: 5,
    reach: 5,
    magic: 'destello',
    boss: false,
    palette: PALETTE,
    build: 1,
    ...overrides,
  };
}

// Fixtures tailored to the exact contrasts the brief names (id union values, not ROSTER entries).
const GLITCH = makeFighter({ id: 'glitch', speed: 9 });
const TORRE = makeFighter({ id: 'torre', speed: 2 });
const BRECHA = makeFighter({ id: 'brecha', strength: 8 });
const ECO = makeFighter({ id: 'eco', strength: 3, reach: 9 });
const VOLTIO = makeFighter({ id: 'voltio', reach: 3 });
const NOVA = makeFighter({ id: 'nova' }); // 5/5/5 baseline

const EXTREME_HIGH = makeFighter({ id: 'nova', strength: 999, speed: 999, reach: 999 });
const EXTREME_LOW = makeFighter({ id: 'nova', strength: -999, speed: -999, reach: -999 });

function baseCtx(overrides: Partial<AiContext> = {}): AiContext {
  return {
    distance: 40,
    playerAttacking: false,
    playerAttackHeight: null,
    cpuBusy: false,
    cpuMagicReady: false,
    ...overrides,
  };
}

function makeLcg(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
}

describe('profileFor: monotony by stats', () => {
  it('more speed reacts faster (lower reactionMs)', () => {
    expect(profileFor(GLITCH, 1).reactionMs).toBeLessThan(profileFor(TORRE, 1).reactionMs);
  });
  it('more strength means more aggression', () => {
    expect(profileFor(BRECHA, 1).aggression).toBeGreaterThan(profileFor(ECO, 1).aggression);
  });
  it('more reach means a longer preferred range', () => {
    expect(profileFor(ECO, 1).preferredRange).toBeGreaterThan(profileFor(VOLTIO, 1).preferredRange);
  });
});

describe('profileFor: monotony by difficulty', () => {
  it('a harder difficulty reacts faster and pushes every chance up, same fighter', () => {
    const easy = profileFor(NOVA, 1);
    const hard = profileFor(NOVA, 8);
    expect(hard.reactionMs).toBeLessThan(easy.reactionMs);
    expect(hard.aggression).toBeGreaterThan(easy.aggression);
    expect(hard.blockChance).toBeGreaterThan(easy.blockChance);
    expect(hard.magicChance).toBeGreaterThan(easy.magicChance);
  });
});

describe('profileFor: bounds', () => {
  it('extreme stats and difficulty saturate every probability at its ceiling and reactionMs at its floor', () => {
    const p = profileFor(EXTREME_HIGH, 99);
    expect(p.reactionMs).toBe(180);
    expect(p.aggression).toBe(0.9);
    expect(p.blockChance).toBe(0.75);
    expect(p.crouchChance).toBe(0.4);
    expect(p.magicChance).toBe(0.8);
  });
  it('extreme negative stats and difficulty saturate every probability at 0 and reactionMs at its ceiling', () => {
    const p = profileFor(EXTREME_LOW, -99);
    expect(p.reactionMs).toBe(620);
    expect(p.aggression).toBe(0);
    expect(p.blockChance).toBe(0);
    expect(p.crouchChance).toBe(0);
    expect(p.magicChance).toBe(0);
  });
});

describe('decide: determinism', () => {
  it('the same seeded rng and context produce the same action twice', () => {
    const profile = profileFor(NOVA, 4);
    const ctx = baseCtx({ playerAttacking: true, playerAttackHeight: 'mid', cpuMagicReady: true });
    const outA = createAiAction();
    const outB = createAiAction();
    decide(profile, ctx, makeLcg(12345), outA);
    decide(profile, ctx, makeLcg(12345), outB);
    expect(outA).toEqual(outB);
  });
});

describe('decide: every branch is reached', () => {
  const always = () => 0; // passes every threshold check
  const never = () => 0.99; // fails every threshold check

  it('casts magic when ready and rng passes magicChance', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({ cpuMagicReady: true });
    const out = createAiAction();
    decide(profile, ctx, always, out);
    expect(out.magic).toBe(true);
    expect(out.stance).toBe('stand');
    expect(out.attackDir).toBeNull();
    expect(out.attackButton).toBeNull();
  });

  it('crouches against a high attack when rng passes crouchChance', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({ playerAttacking: true, playerAttackHeight: 'high', cpuMagicReady: false });
    const out = createAiAction();
    decide(profile, ctx, always, out);
    expect(out.stance).toBe('crouch');
    expect(out.attackDir).toBeNull();
    expect(out.attackButton).toBeNull();
    expect(out.magic).toBe(false);
  });

  it('blocks a non-high attack when rng passes blockChance', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({ playerAttacking: true, playerAttackHeight: 'mid', cpuMagicReady: false });
    const out = createAiAction();
    decide(profile, ctx, always, out);
    expect(out.stance).toBe('block');
    expect(out.attackDir).toBeNull();
    expect(out.attackButton).toBeNull();
    expect(out.magic).toBe(false);
  });

  it('attacks inside preferredRange, not busy, when rng passes aggression', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({ distance: 10, cpuBusy: false, cpuMagicReady: false, playerAttacking: false });
    const out = createAiAction();
    decide(profile, ctx, always, out);
    expect(out.stance).toBe('stand');
    expect(out.attackDir).not.toBeNull();
    expect(out.attackButton).not.toBeNull();
    expect(out.magic).toBe(false);
  });

  it('never attacks while busy, even when rng passes aggression', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({ distance: 10, cpuBusy: true, cpuMagicReady: false, playerAttacking: false });
    const out = createAiAction();
    decide(profile, ctx, always, out);
    expect(out.attackDir).toBeNull();
    expect(out.attackButton).toBeNull();
  });

  it('does not crouch or block when the player attacks high and every roll fails: it moves instead', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({
      distance: 999,
      playerAttacking: true,
      playerAttackHeight: 'high',
      cpuMagicReady: false,
    });
    const out = createAiAction();
    decide(profile, ctx, never, out);
    expect(out.stance).toBe('stand');
    expect(out.attackDir).toBeNull();
    expect(out.attackButton).toBeNull();
    expect(out.move).toBe('approach');
  });

  it('approaches when out of preferredRange', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({ distance: 999, cpuMagicReady: false, playerAttacking: false });
    const out = createAiAction();
    decide(profile, ctx, never, out);
    expect(out.move).toBe('approach');
  });

  it('retreats in range, not attacking, when rng passes the fixed retreat chance', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({ distance: 10, cpuBusy: true, cpuMagicReady: false, playerAttacking: false });
    const out = createAiAction();
    const rng = () => 0.1; // below the fixed retreat chance (0.3), never touched by the skipped branches above
    decide(profile, ctx, rng, out);
    expect(out.move).toBe('retreat');
  });

  it('idles in range, not attacking, when rng fails the fixed retreat chance', () => {
    const profile = profileFor(NOVA, 3);
    const ctx = baseCtx({ distance: 10, cpuBusy: true, cpuMagicReady: false, playerAttacking: false });
    const out = createAiAction();
    const rng = () => 0.9; // above the fixed retreat chance
    decide(profile, ctx, rng, out);
    expect(out.move).toBe('idle');
  });
});

describe('decide: blocking or crouching prevents attacking in the same decision', () => {
  it('a block decision never carries an attack', () => {
    const profile = profileFor(NOVA, 8); // high blockChance
    const ctx = baseCtx({ distance: 10, playerAttacking: true, playerAttackHeight: 'mid', cpuMagicReady: false });
    const out = createAiAction();
    decide(profile, ctx, () => 0, out);
    expect(out.stance).toBe('block');
    expect(out.attackDir).toBeNull();
    expect(out.attackButton).toBeNull();
  });
  it('a crouch decision never carries an attack', () => {
    const profile = profileFor(NOVA, 8); // high crouchChance
    const ctx = baseCtx({ distance: 10, playerAttacking: true, playerAttackHeight: 'high', cpuMagicReady: false });
    const out = createAiAction();
    decide(profile, ctx, () => 0, out);
    expect(out.stance).toBe('crouch');
    expect(out.attackDir).toBeNull();
    expect(out.attackButton).toBeNull();
  });
});

describe('decide: out-param', () => {
  it('reusing the same AiAction across two calls leaves the five fields coherent (no magic left dangling)', () => {
    const out = createAiAction();
    const magicProfile = profileFor(NOVA, 3);
    decide(magicProfile, baseCtx({ cpuMagicReady: true }), () => 0, out);
    expect(out.magic).toBe(true);

    const moveProfile = profileFor(NOVA, 3);
    decide(moveProfile, baseCtx({ distance: 999, cpuMagicReady: false }), () => 0.99, out);
    expect(out.magic).toBe(false);
    expect(out.move).toBe('approach');
    expect(out.stance).toBe('stand');
    expect(out.attackDir).toBeNull();
    expect(out.attackButton).toBeNull();
  });
});

describe('decide: no module state', () => {
  it('two profiles used interleaved give the same actions as when used in separate blocks, same seeds', () => {
    const profileA = profileFor(GLITCH, 3);
    const profileB = profileFor(TORRE, 6);
    const ctxA = baseCtx({ distance: 10, playerAttacking: true, playerAttackHeight: 'mid', cpuMagicReady: true });
    const ctxB = baseCtx({ distance: 999, playerAttacking: false, cpuMagicReady: false });

    const interleavedA1 = createAiAction();
    const interleavedB1 = createAiAction();
    const interleavedA2 = createAiAction();
    const interleavedB2 = createAiAction();
    const rngA = makeLcg(777);
    const rngB = makeLcg(999);
    decide(profileA, ctxA, rngA, interleavedA1);
    decide(profileB, ctxB, rngB, interleavedB1);
    decide(profileA, ctxA, rngA, interleavedA2);
    decide(profileB, ctxB, rngB, interleavedB2);

    const blockedA1 = createAiAction();
    const blockedA2 = createAiAction();
    const rngA2 = makeLcg(777);
    decide(profileA, ctxA, rngA2, blockedA1);
    decide(profileA, ctxA, rngA2, blockedA2);

    const blockedB1 = createAiAction();
    const blockedB2 = createAiAction();
    const rngB2 = makeLcg(999);
    decide(profileB, ctxB, rngB2, blockedB1);
    decide(profileB, ctxB, rngB2, blockedB2);

    expect(interleavedA1).toEqual(blockedA1);
    expect(interleavedA2).toEqual(blockedA2);
    expect(interleavedB1).toEqual(blockedB1);
    expect(interleavedB2).toEqual(blockedB2);
  });
});

describe('techniqueWeight: anchors the difficulty-driven bias toward slow, strong techniques', () => {
  const punetazo = resolveTechnique('neutral', 'b'); // startup 120, damage 6 — fast and weak
  const patadaVoladora = resolveTechnique('forward', 'a'); // startup 420, damage 16 — slow and strong

  it('weighs every technique equally when aggression is 0', () => {
    expect(techniqueWeight(punetazo, 0)).toBe(1);
    expect(techniqueWeight(patadaVoladora, 0)).toBe(1);
    expect(techniqueWeight(punetazo, 0)).toBe(techniqueWeight(patadaVoladora, 0));
  });

  it('weighs the slow, strong technique above the fast, weak one once aggression is high (difficulty 8)', () => {
    const highAggression = profileFor(NOVA, 8).aggression;
    expect(techniqueWeight(patadaVoladora, highAggression)).toBeGreaterThan(
      techniqueWeight(punetazo, highAggression),
    );
  });

  it('skews harder at difficulty 8 than at difficulty 1, same fighter', () => {
    const lowAggression = profileFor(NOVA, 1).aggression;
    const highAggression = profileFor(NOVA, 8).aggression;
    const skewAt = (aggression: number) =>
      techniqueWeight(patadaVoladora, aggression) / techniqueWeight(punetazo, aggression);
    expect(skewAt(highAggression)).toBeGreaterThan(skewAt(lowAggression));
  });
});

// Type-level sanity: these should compile as declared in the brief.
const _profile: AiProfile = profileFor(NOVA, 1);
const _action: AiAction = createAiAction();
void _profile;
void _action;
