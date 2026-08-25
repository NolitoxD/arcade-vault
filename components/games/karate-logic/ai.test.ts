import { describe, expect, it } from 'vitest';
import { OPPONENT_CONFIG, opponentFor, decide } from './ai';

const always = () => 0; // rng below every threshold
const never = () => 0.999;

describe('opponent config', () => {
  it('has 10 rows with spec endpoints and clamps', () => {
    expect(OPPONENT_CONFIG).toHaveLength(10);
    expect(OPPONENT_CONFIG[0]).toEqual([600, 0.3, 0.2, 0.2]);
    expect(OPPONENT_CONFIG[9]).toEqual([180, 0.8, 0.65, 0.5]);
    expect(opponentFor(37)).toEqual(OPPONENT_CONFIG[9]);
  });
});

describe('decide', () => {
  it('blocks the incoming height when rng passes blockChance', () => {
    const a = decide(10, { distance: 40, playerAttacking: true, playerAttackHeight: 'high', cpuBusy: false }, always);
    expect(a.block).toBe('high');
    const b = decide(1, { distance: 40, playerAttacking: true, playerAttackHeight: 'high', cpuBusy: false }, never);
    expect(b.block).toBeNull();
  });
  it('attacks in range when rng passes aggression, never while busy', () => {
    const atk = decide(10, { distance: 40, playerAttacking: false, playerAttackHeight: null, cpuBusy: false }, always);
    expect(atk.attack).not.toBeNull();
    const busy = decide(10, { distance: 40, playerAttacking: false, playerAttackHeight: null, cpuBusy: true }, always);
    expect(busy.attack).toBeNull();
  });
  it('approaches when far', () => {
    const a = decide(1, { distance: 400, playerAttacking: false, playerAttackHeight: null, cpuBusy: false }, never);
    expect(a.move).toBe('approach');
  });
});
