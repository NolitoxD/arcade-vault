import { describe, expect, it } from 'vitest';
import type { FighterDef } from './fighters';
import {
  BLOCK_LEAK,
  CROUCH_LOW_BONUS,
  createHitOutcome,
  resolveHit,
  resolveTechnique,
  scaledDamage,
  scaledReach,
  scaledStartup,
  TECHNIQUES,
  type CombatantView,
  type Dir,
  type TechButton,
} from './techniques';

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

// 5/5/5 is the calibration anchor: every scaling factor collapses to 1.0.
const BASELINE = makeFighter({ id: 'nova' });
const BRECHA = makeFighter({ id: 'brecha', strength: 8 });
const GLITCH = makeFighter({ id: 'glitch', strength: 3, speed: 9 });
const ECO = makeFighter({ id: 'eco', reach: 9 });
const VOLTIO = makeFighter({ id: 'voltio', speed: 8, reach: 3 });
const TORRE = makeFighter({ id: 'torre', speed: 2 });

function stand(x: number): CombatantView {
  return { x, facing: 1, stance: 'stand', busyUntilMs: 0 };
}

describe('TECHNIQUES table', () => {
  it('resolves all 8 dir x button combos to distinct techniques covering TECHNIQUES exactly', () => {
    const dirs: Dir[] = ['neutral', 'up', 'down', 'forward'];
    const buttons: TechButton[] = ['a', 'b'];
    const resolvedIds = new Set<string>();
    for (const dir of dirs) {
      for (const button of buttons) {
        resolvedIds.add(resolveTechnique(dir, button).id);
      }
    }
    expect(resolvedIds.size).toBe(8);
    expect(resolvedIds).toEqual(new Set(TECHNIQUES.map((t) => t.id)));
  });

  it('anchors neutral+a to patada-frontal and down+b to punetazo-bajo', () => {
    expect(resolveTechnique('neutral', 'a').id).toBe('patada-frontal');
    expect(resolveTechnique('down', 'b').id).toBe('punetazo-bajo');
  });

  it('throws for an invalid button', () => {
    expect(() => resolveTechnique('up', 'c' as never)).toThrow();
  });
});

describe('scaling', () => {
  const punetazo = resolveTechnique('neutral', 'b');
  const golpeAlto = resolveTechnique('up', 'b');
  const patadaAlta = resolveTechnique('up', 'a');

  it('scales damage up with strength', () => {
    expect(scaledDamage(punetazo, BRECHA)).toBeGreaterThan(scaledDamage(punetazo, GLITCH));
  });

  it('scales reach up with the reach stat', () => {
    expect(scaledReach(patadaAlta, ECO)).toBeGreaterThan(scaledReach(patadaAlta, VOLTIO));
  });

  it('scales startup down (faster) with speed', () => {
    expect(scaledStartup(golpeAlto, GLITCH)).toBeLessThan(scaledStartup(golpeAlto, TORRE));
  });

  it('anchors every factor to exactly 1.0 for a 5/5/5 fighter', () => {
    expect(scaledDamage(punetazo, BASELINE)).toBe(punetazo.baseDamage);
    expect(scaledReach(punetazo, BASELINE)).toBe(punetazo.baseReach);
    expect(scaledStartup(punetazo, BASELINE)).toBe(punetazo.startupMs);
  });
});

describe('resolveHit blocking', () => {
  const patadaAlta = resolveTechnique('up', 'a'); // high
  const barrido = resolveTechnique('down', 'a'); // low

  it('fully blocks a high technique with a matching guard', () => {
    const attacker = stand(0);
    const defender: CombatantView = { x: 10, facing: -1, stance: 'block', busyUntilMs: 0 };
    const out = createHitOutcome();
    resolveHit(attacker, BASELINE, defender, patadaAlta, 0, out);
    expect(out.result).toBe('blocked');
    expect(out.damage).toBe(0);
  });

  it('leaks BLOCK_LEAK damage through the guard against a low technique', () => {
    const attacker = stand(0);
    const defender: CombatantView = { x: 10, facing: -1, stance: 'block', busyUntilMs: 0 };
    const out = createHitOutcome();
    resolveHit(attacker, BASELINE, defender, barrido, 0, out);
    expect(out.result).toBe('grazed');
    expect(out.damage).toBe(Math.round(scaledDamage(barrido, BASELINE) * BLOCK_LEAK));
  });
});

describe('resolveHit crouching', () => {
  const golpeAlto = resolveTechnique('up', 'b'); // high
  const punetazoBajo = resolveTechnique('down', 'b'); // low

  it('evades a high technique while crouching', () => {
    const attacker = stand(0);
    const defender: CombatantView = { x: 10, facing: -1, stance: 'crouch', busyUntilMs: 0 };
    const out = createHitOutcome();
    resolveHit(attacker, BASELINE, defender, golpeAlto, 0, out);
    expect(out.result).toBe('evaded');
    expect(out.damage).toBe(0);
  });

  it('takes bonus CROUCH_LOW_BONUS damage from a low technique while crouching', () => {
    const attacker = stand(0);
    const defender: CombatantView = { x: 10, facing: -1, stance: 'crouch', busyUntilMs: 0 };
    const out = createHitOutcome();
    resolveHit(attacker, BASELINE, defender, punetazoBajo, 0, out);
    expect(out.result).toBe('hit');
    expect(out.damage).toBe(Math.round(scaledDamage(punetazoBajo, BASELINE) * CROUCH_LOW_BONUS));
  });
});

describe('resolveHit attacker constraints', () => {
  it('cannot attack while blocking, even in range and out of recovery', () => {
    const attacker: CombatantView = { x: 0, facing: 1, stance: 'block', busyUntilMs: 0 };
    const defender = stand(10);
    const punetazo = resolveTechnique('neutral', 'b');
    const out = createHitOutcome();
    resolveHit(attacker, BASELINE, defender, punetazo, 0, out);
    expect(out.result).toBe('idle');
    expect(out.damage).toBe(0);
  });

  it('misses out of range, and reach scaling does not teleport the hit', () => {
    const punetazo = resolveTechnique('neutral', 'b'); // baseReach 40
    const attacker = stand(0);
    const farDefender = stand(300);

    const out = createHitOutcome();
    resolveHit(attacker, BASELINE, farDefender, punetazo, 0, out);
    expect(out.result).toBe('miss');
    expect(out.damage).toBe(0);

    // ECO's reach factor: 0.7 + 0.9 * 0.6 = 1.24 -> 40 * 1.24 = 49.6, still far short of 300.
    const outEco = createHitOutcome();
    resolveHit(attacker, ECO, farDefender, punetazo, 0, outEco);
    expect(scaledReach(punetazo, ECO)).toBeCloseTo(49.6);
    expect(outEco.result).toBe('miss');
    expect(outEco.damage).toBe(0);
  });
});

describe('resolveHit out-param reuse', () => {
  it('overwrites a stale HitOutcome on the next call instead of merging with it', () => {
    const punetazo = resolveTechnique('neutral', 'b');
    const attacker = stand(0);
    const closeDefender = stand(10);
    const farDefender = stand(300);

    const out = createHitOutcome();
    resolveHit(attacker, BASELINE, closeDefender, punetazo, 0, out);
    expect(out.result).toBe('hit');
    expect(out.damage).toBeGreaterThan(0);

    resolveHit(attacker, BASELINE, farDefender, punetazo, 0, out);
    expect(out.result).toBe('miss');
    expect(out.damage).toBe(0);
  });
});
