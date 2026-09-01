import { describe, expect, it } from 'vitest';
import { STAT_MAX, type FighterDef } from './fighters';
import { scaledReach, TECHNIQUES } from './techniques';
import {
  addMagic,
  applyDamage,
  boutWinner,
  commitRound,
  createBout,
  createCombatant,
  CPU_START_X,
  isMagicReady,
  MAGIC_CHARGE_DEAL,
  MAGIC_CHARGE_TAKE,
  MAGIC_MAX,
  MAX_HEALTH,
  PLAYER_START_X,
  ROUND_TIME_MS,
  ROUNDS_TO_WIN,
  roundWinner,
  spendMagic,
  startBout,
  startRound,
  type BoutState,
} from './combat';

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

const PLAYER_DEF = makeFighter({ id: 'nova' });
const CPU_DEF = makeFighter({
  id: 'arquitecto',
  strength: 8,
  speed: 7,
  reach: 7,
  magic: 'reinicio',
  boss: true,
});

function freshBout(): BoutState {
  const bout = createBout(PLAYER_DEF, CPU_DEF);
  startBout(bout, PLAYER_DEF, CPU_DEF);
  return bout;
}

describe('startRound', () => {
  it('gives both combatants full health, zero magic, and a zeroed round clock', () => {
    const bout = freshBout();
    expect(bout.player.health).toBe(MAX_HEALTH);
    expect(bout.cpu.health).toBe(MAX_HEALTH);
    expect(bout.player.magic).toBe(0);
    expect(bout.cpu.magic).toBe(0);
    expect(bout.roundMs).toBe(0);
  });

  // The 4th part of the spec's magic-meter criterion: the meter must NOT carry over between rounds.
  it('resets health and magic to their starting values after magic was charged and a round was committed', () => {
    const bout = freshBout();
    addMagic(bout.player, MAGIC_MAX);
    addMagic(bout.cpu, MAGIC_MAX);
    bout.player.health = 40;
    bout.roundMs = 30_000;
    commitRound(bout, 'player');
    startRound(bout);
    expect(bout.player.health).toBe(MAX_HEALTH);
    expect(bout.cpu.health).toBe(MAX_HEALTH);
    expect(bout.player.magic).toBe(0);
    expect(bout.cpu.magic).toBe(0);
  });
});

describe('roundWinner', () => {
  it('declares the other side the winner on a KO and floors health at zero', () => {
    const bout = freshBout();
    applyDamage(bout, 'cpu', 100);
    expect(bout.cpu.health).toBe(0);
    expect(roundWinner(bout)).toBe('player');
  });

  it('never lets health go negative even when damage exceeds remaining health', () => {
    const bout = freshBout();
    applyDamage(bout, 'cpu', 250);
    expect(bout.cpu.health).toBe(0);
  });

  it('awards the round to whoever has more health once time runs out', () => {
    const bout = freshBout();
    bout.roundMs = ROUND_TIME_MS;
    bout.player.health = 60;
    bout.cpu.health = 30;
    expect(roundWinner(bout)).toBe('player');
  });

  it('calls a draw when time runs out with equal health', () => {
    const bout = freshBout();
    bout.roundMs = ROUND_TIME_MS;
    bout.player.health = 45;
    bout.cpu.health = 45;
    expect(roundWinner(bout)).toBe('draw');
  });

  it('returns null one millisecond before the round timer expires', () => {
    const bout = freshBout();
    bout.roundMs = ROUND_TIME_MS - 1;
    bout.player.health = 60;
    bout.cpu.health = 30;
    expect(roundWinner(bout)).toBeNull();
  });

  // A simultaneous double KO must not silently favor the player: it is a draw,
  // same as a time-out tie.
  it('calls a draw on a simultaneous double KO instead of favoring the player', () => {
    const bout = freshBout();
    bout.player.health = 0;
    bout.cpu.health = 0;
    expect(roundWinner(bout)).toBe('draw');
  });
});

describe('round resolution guard', () => {
  it('returns null right after commitRound consumes the outcome, before startRound runs', () => {
    const bout = freshBout();
    applyDamage(bout, 'cpu', 100);
    const winner = roundWinner(bout);
    expect(winner).toBe('player');
    commitRound(bout, winner ?? 'draw');
    expect(roundWinner(bout)).toBeNull();
  });

  // The exact bug this guard prevents: a 60fps loop doing
  // `const w = roundWinner(bout); if (w) commitRound(bout, w);` every frame,
  // with no startRound in between, must still only score the round once.
  it('leaves a naive per-frame roundWinner+commitRound loop at one scored round, not five', () => {
    const bout = freshBout();
    applyDamage(bout, 'cpu', 100);
    for (let frame = 0; frame < 5; frame += 1) {
      const winner = roundWinner(bout);
      if (winner) commitRound(bout, winner);
    }
    expect(bout.playerRounds).toBe(1);
    expect(bout.cpuRounds).toBe(0);
    expect(bout.round).toBe(2);
  });

  it('resumes normal resolution once startRound clears the guard for the next round', () => {
    const bout = freshBout();
    applyDamage(bout, 'cpu', 100);
    const firstWinner = roundWinner(bout);
    commitRound(bout, firstWinner ?? 'draw');
    startRound(bout);
    applyDamage(bout, 'player', 100);
    expect(roundWinner(bout)).toBe('cpu');
  });
});

describe('spawn positions', () => {
  it('are symmetric around the 800px canvas center and further apart than the max scaled reach', () => {
    const CANVAS_WIDTH = 800;
    expect(PLAYER_START_X + CPU_START_X).toBe(CANVAS_WIDTH);

    const maxReachFighter = makeFighter({ id: 'nova', reach: STAT_MAX });
    const maxScaledReach = Math.max(...TECHNIQUES.map((t) => scaledReach(t, maxReachFighter)));
    expect(CPU_START_X - PLAYER_START_X).toBeGreaterThan(maxScaledReach);
  });
});

describe('best of five', () => {
  it('crowns a bout winner after three round wins', () => {
    const bout = freshBout();
    commitRound(bout, 'player');
    commitRound(bout, 'player');
    expect(boutWinner(bout)).toBeNull();
    commitRound(bout, 'player');
    expect(boutWinner(bout)).toBe('player');
    expect(bout.playerRounds).toBe(ROUNDS_TO_WIN);
  });

  it('has no winner at two rounds each', () => {
    const bout = freshBout();
    commitRound(bout, 'player');
    commitRound(bout, 'cpu');
    commitRound(bout, 'player');
    commitRound(bout, 'cpu');
    expect(boutWinner(bout)).toBeNull();
    expect(bout.round).toBe(5);
  });

  // The rare case: draws don't decide anything by themselves, so ties can push
  // the bout past NOMINAL_ROUNDS (5) — the only closing condition is 3 wins.
  it('keeps going past round 5 on repeated draws and still closes at three wins', () => {
    const bout = freshBout();
    commitRound(bout, 'draw'); // round 1 -> 2
    commitRound(bout, 'draw'); // round 2 -> 3
    commitRound(bout, 'cpu'); // round 3 -> 4, cpuRounds 1
    commitRound(bout, 'player'); // round 4 -> 5, playerRounds 1
    commitRound(bout, 'cpu'); // round 5 -> 6, cpuRounds 2
    commitRound(bout, 'player'); // round 6 -> 7, playerRounds 2
    expect(bout.round).toBe(7);
    expect(boutWinner(bout)).toBeNull();
    commitRound(bout, 'player'); // round 7 -> 8, playerRounds 3
    expect(boutWinner(bout)).toBe('player');
    expect(bout.playerRounds).toBe(ROUNDS_TO_WIN);
    expect(bout.cpuRounds).toBe(2);
  });

  it('does not credit either side for a draw but still advances the round counter', () => {
    const bout = freshBout();
    commitRound(bout, 'draw');
    expect(bout.playerRounds).toBe(0);
    expect(bout.cpuRounds).toBe(0);
    expect(bout.round).toBe(2);
  });
});

describe('magic meter', () => {
  it('uses the documented charge rates and charges the attacker more than the target', () => {
    const bout = freshBout();
    applyDamage(bout, 'cpu', 50);
    expect(bout.player.magic).toBeCloseTo(50 * MAGIC_CHARGE_DEAL);
    expect(bout.cpu.magic).toBeCloseTo(50 * MAGIC_CHARGE_TAKE);
    expect(bout.player.magic).toBeGreaterThan(bout.cpu.magic);
  });

  it('caps both meters at MAGIC_MAX after a huge hit', () => {
    const bout = freshBout();
    applyDamage(bout, 'cpu', 1000);
    expect(bout.player.magic).toBe(MAGIC_MAX);
    expect(bout.cpu.magic).toBe(MAGIC_MAX);
  });

  it('does not charge either meter on a zero-damage clean block', () => {
    const bout = freshBout();
    applyDamage(bout, 'cpu', 0);
    expect(bout.player.magic).toBe(0);
    expect(bout.cpu.magic).toBe(0);
  });

  it('reports ready only once the meter is completely full', () => {
    const c = createCombatant(PLAYER_DEF, 0, 1);
    expect(isMagicReady(c)).toBe(false);
    addMagic(c, MAGIC_MAX - 1);
    expect(isMagicReady(c)).toBe(false);
    addMagic(c, 1);
    expect(isMagicReady(c)).toBe(true);
  });

  it('empties the meter on spend', () => {
    const c = createCombatant(PLAYER_DEF, 0, 1);
    addMagic(c, MAGIC_MAX);
    spendMagic(c);
    expect(c.magic).toBe(0);
  });
});

describe('module isolation', () => {
  it('does not share combatant state between two independently created bouts', () => {
    const boutA = freshBout();
    const boutB = freshBout();
    applyDamage(boutA, 'player', 40);
    expect(boutA.player.health).toBe(60);
    expect(boutB.player.health).toBe(MAX_HEALTH);
    expect(boutA.player).not.toBe(boutB.player);
    expect(boutA.cpu).not.toBe(boutB.cpu);
  });
});

// Moved here from magic.test.ts's `absorbWithShield` block in the final review:
// the shield used to be absorbed by each damage caller (magic.ts for the three
// magic paths, the canvas component for melee) and applyDamage — the single
// funnel — knew nothing about it. Same numbers, new home.
describe('applyDamage absorbs the shield', () => {
  it('absorbs part of the damage and drains the shield when damage exceeds it', () => {
    const bout = freshBout();
    bout.cpu.shield = 25;

    expect(applyDamage(bout, 'cpu', 30)).toBe(5);
    expect(bout.cpu.shield).toBe(0);
    expect(bout.cpu.health).toBe(MAX_HEALTH - 5);
  });

  it('absorbs all of a smaller hit and leaves the remainder in the shield', () => {
    const bout = freshBout();
    bout.cpu.shield = 25;

    expect(applyDamage(bout, 'cpu', 10)).toBe(0);
    expect(bout.cpu.shield).toBe(15);
    expect(bout.cpu.health).toBe(MAX_HEALTH);
  });

  it('passes damage through untouched when there is no shield', () => {
    const bout = freshBout();

    expect(applyDamage(bout, 'cpu', 12)).toBe(12);
    expect(bout.cpu.shield).toBe(0);
    expect(bout.cpu.health).toBe(MAX_HEALTH - 12);
  });

  it('charges neither meter for damage the shield swallowed whole', () => {
    const bout = freshBout();
    bout.cpu.shield = 25;

    applyDamage(bout, 'cpu', 10);

    expect(bout.cpu.magic).toBe(0);
    expect(bout.player.magic).toBe(0);
  });

  it('charges both meters only on the part that got through', () => {
    const bout = freshBout();
    bout.cpu.shield = 5;

    applyDamage(bout, 'cpu', 15);

    expect(bout.cpu.magic).toBeCloseTo(10 * MAGIC_CHARGE_TAKE);
    expect(bout.player.magic).toBeCloseTo(10 * MAGIC_CHARGE_DEAL);
  });

  it('clears the shield on a new round', () => {
    const bout = freshBout();
    bout.cpu.shield = 25;
    startRound(bout);
    expect(bout.cpu.shield).toBe(0);
  });
});
