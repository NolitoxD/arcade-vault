import { describe, expect, it } from 'vitest';
import type { FighterDef } from './fighters';
import { createCombatant, MAX_HEALTH, type BoutState } from './combat';
import {
  castMagic,
  createMagicRuntime,
  MAGIC_SPECS,
  magicKinds,
  resetMagicRuntime,
  stepMagic,
  type AreaSpec,
  type FoeSpec,
  type MagicRuntime,
  type MagicSide,
  type MagicSpec,
  type ProjectileSpec,
  type SelfSpec,
} from './magic';

const PALETTE = { body: '#111111', trim: '#222222', accent: '#333333' };

const FIGHTER_A: FighterDef = {
  id: 'nova', name: 'NOVA', strength: 5, speed: 5, reach: 5,
  magic: 'destello', boss: false, palette: PALETTE, build: 1,
};
const FIGHTER_B: FighterDef = {
  id: 'torre', name: 'TORRE', strength: 5, speed: 5, reach: 5,
  magic: 'muro', boss: false, palette: PALETTE, build: 1,
};

function makeArena(playerX: number, playerFacing: 1 | -1, cpuX: number, cpuFacing: 1 | -1) {
  const player = createCombatant(FIGHTER_A, playerX, playerFacing);
  const cpu = createCombatant(FIGHTER_B, cpuX, cpuFacing);
  const bout: BoutState = {
    round: 1, playerRounds: 0, cpuRounds: 0, roundMs: 0, roundResolved: false,
    player, cpu,
  };
  const playerSide: MagicSide = { side: 'player', c: player, rt: createMagicRuntime() };
  const cpuSide: MagicSide = { side: 'cpu', c: cpu, rt: createMagicRuntime() };
  return { bout, playerSide, cpuSide };
}

describe('projectile magic', () => {
  const spec: ProjectileSpec & { id: 'descarga'; label: string } = {
    id: 'descarga', label: 'Test bolt', kind: 'projectile',
    damage: 20, speed: 500, knockback: 30, lifeMs: 500,
  };
  // Review round 1, finding 3: a distinct knockback value so a push-distance
  // assertion can't be confused with any other spec's number.
  const pushSpec: ProjectileSpec & { id: 'descarga'; label: string } = {
    id: 'descarga', label: 'Test bolt (push)', kind: 'projectile',
    damage: 20, speed: 500, knockback: 45, lifeMs: 500,
  };

  it('arms an active projectile in front of the caster, with vx signed by facing', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 900, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    expect(playerSide.rt.projectileActive).toBe(true);
    expect(playerSide.rt.projectileX).toBeGreaterThan(playerSide.c.x);
    expect(playerSide.rt.projectileVx).toBeGreaterThan(0);
  });

  it('arms a leftward projectile whose vx is negative when the caster faces left', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, -1, 900, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    expect(playerSide.rt.projectileX).toBeLessThan(playerSide.c.x);
    expect(playerSide.rt.projectileVx).toBeLessThan(0);
  });

  it('advances the projectile toward the foe on stepMagic without resolving the hit yet', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);
    const spawnX = playerSide.rt.projectileX;

    stepMagic(playerSide, cpuSide, bout, 10, 10);

    expect(playerSide.rt.projectileActive).toBe(true);
    expect(playerSide.rt.projectileX).toBeGreaterThan(spawnX);
    expect(cpuSide.c.health).toBe(MAX_HEALTH);
  });

  it('deals exactly spec.damage and deactivates on impact', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    // spawn at 340, foe at 400, speed 500px/s -> 120ms to close the 60px gap
    stepMagic(playerSide, cpuSide, bout, 120, 120);

    expect(cpuSide.c.health).toBe(MAX_HEALTH - 20);
    expect(playerSide.rt.projectileActive).toBe(false);
  });

  it('deals zero damage and is consumed when the foe is blocking', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    cpuSide.c.stance = 'block';
    castMagic(spec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 120, 120);

    expect(cpuSide.c.health).toBe(MAX_HEALTH);
    expect(playerSide.rt.projectileActive).toBe(false);
  });

  it('hits when the projectile is inside the radius but not exactly on the foe (dx != 0)', () => {
    // Review round 1, finding 2: the earlier "deals exactly spec.damage" test always
    // landed the projectile at dx = 0, which any radius >= 0 would satisfy. This
    // proves a genuinely nonzero gap, still inside the hit radius, also connects.
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    // spawn at 340, speed 500px/s, 100ms -> projectile at 390, dx = 400 - 390 = 10
    stepMagic(playerSide, cpuSide, bout, 100, 100);

    expect(cpuSide.c.health).toBe(MAX_HEALTH - 20);
    expect(playerSide.rt.projectileActive).toBe(false);
  });

  it('does not hit when just outside the radius, and keeps flying', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    // spawn at 340, speed 500px/s, 60ms -> projectile at 370, dx = 400 - 370 = 30
    stepMagic(playerSide, cpuSide, bout, 60, 60);

    expect(cpuSide.c.health).toBe(MAX_HEALTH);
    expect(playerSide.rt.projectileActive).toBe(true);
    expect(playerSide.rt.projectileX).toBe(370);
  });

  it('pushes the foe knockback px in the direction of travel on impact', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    castMagic(pushSpec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 120, 120);

    expect(cpuSide.c.x).toBe(400 + 45);
  });

  it('does not move the foe when knockback is 0', () => {
    const stillSpec: ProjectileSpec & { id: 'descarga'; label: string } = { ...pushSpec, knockback: 0 };
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    castMagic(stillSpec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 120, 120);

    expect(cpuSide.c.x).toBe(400);
  });

  it('expires at lifeMs without dealing damage when nobody is in its path', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 100000, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 500, 500);

    expect(playerSide.rt.projectileActive).toBe(false);
    expect(cpuSide.c.health).toBe(MAX_HEALTH);
  });

  it('never hits a foe standing to the right when fired leftward', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, -1, 340, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 500, 500);

    expect(playerSide.rt.projectileActive).toBe(false);
    expect(cpuSide.c.health).toBe(MAX_HEALTH);
  });
});

describe('area magic', () => {
  const baseSpec = {
    id: 'sismico' as const, label: 'Test area', kind: 'area' as const,
    damage: 10, radius: 50, blockable: true, extraHits: 0,
  };

  it('deals damage to a foe within radius', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 340, -1);
    castMagic(baseSpec, playerSide, cpuSide, bout, 0);

    expect(cpuSide.c.health).toBe(MAX_HEALTH - 10);
  });

  it('deals zero damage to a foe outside radius', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    castMagic(baseSpec, playerSide, cpuSide, bout, 0);

    expect(cpuSide.c.health).toBe(MAX_HEALTH);
  });

  it('is blocked (zero damage) when blockable and the foe is blocking', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 340, -1);
    cpuSide.c.stance = 'block';
    castMagic(baseSpec, playerSide, cpuSide, bout, 0);

    expect(cpuSide.c.health).toBe(MAX_HEALTH);
  });

  it('deals full damage through a block when blockable is false', () => {
    const spec: AreaSpec & { id: 'sismico'; label: string } = { ...baseSpec, blockable: false };
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 340, -1);
    cpuSide.c.stance = 'block';
    castMagic(spec, playerSide, cpuSide, bout, 0);

    expect(cpuSide.c.health).toBe(MAX_HEALTH - 10);
  });

  it('doubles the damage with extraHits: 1', () => {
    const spec: AreaSpec & { id: 'sismico'; label: string } = { ...baseSpec, extraHits: 1 };
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 340, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    expect(cpuSide.c.health).toBe(MAX_HEALTH - 20);
  });

  it('lights the area flash for the component to paint', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 340, -1);
    castMagic(baseSpec, playerSide, cpuSide, bout, 0);

    expect(playerSide.rt.areaFlashMs).toBeGreaterThan(0);
  });
});

describe('self-state magic', () => {
  const spec: SelfSpec & { id: 'muro'; label: string } = {
    id: 'muro', label: 'Test ward', kind: 'self-state',
    shield: 25, heal: 30, durationMs: 300,
  };

  it('adds to the shield and sets the buff duration', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    expect(playerSide.c.shield).toBe(25);
    expect(playerSide.rt.buffMsLeft).toBe(300);
  });

  it('heals but never past MAX_HEALTH', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    playerSide.c.health = 80;
    castMagic(spec, playerSide, cpuSide, bout, 0);

    expect(playerSide.c.health).toBe(100);
  });

  it('loses the shield once the buff expires', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    castMagic(spec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 300, 300);

    expect(playerSide.rt.buffMsLeft).toBe(0);
    expect(playerSide.c.shield).toBe(0);
  });
});

describe('foe-state magic', () => {
  const dotSpec: FoeSpec & { id: 'corrosion'; label: string } = {
    id: 'corrosion', label: 'Test dot', kind: 'foe-state',
    stunMs: 900, dotDamage: 5, dotTicks: 3, tickMs: 300, teleportBehind: false,
  };

  it('sets stunUntilMs to nowMs + stunMs', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    castMagic(dotSpec, playerSide, cpuSide, bout, 1000);

    expect(cpuSide.c.stunUntilMs).toBe(1900);
  });

  it('ticks dotDamage exactly dotTicks times, one per tickMs, and no more', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    castMagic(dotSpec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 300, 300);
    stepMagic(playerSide, cpuSide, bout, 300, 600);
    stepMagic(playerSide, cpuSide, bout, 300, 900);

    expect(cpuSide.c.health).toBe(MAX_HEALTH - 15);
    expect(cpuSide.rt.dotTicksLeft).toBe(0);

    // a fourth tick-worth of time must not deal a fourth tick of damage
    stepMagic(playerSide, cpuSide, bout, 300, 1200);
    expect(cpuSide.c.health).toBe(MAX_HEALTH - 15);
  });

  it('does not fire two ticks when advancing double the tick interval in one jump', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    castMagic(dotSpec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 600, 600);

    expect(cpuSide.c.health).toBe(MAX_HEALTH - 5);
    expect(cpuSide.rt.dotTicksLeft).toBe(2);
  });

  it('paces DOT ticks by the real tick interval, not by whatever dtMs the caller happens to use', () => {
    // Review round 1, finding 1: the previous implementation rescheduled the next
    // tick with `dotMsToTick += dtMs` (the delta of the CURRENT call). That only
    // looks correct when the caller's dtMs happens to equal tickMs (as in the two
    // tests above, both driven in 300ms/600ms steps). Drive it in ~16ms frame-sized
    // steps instead (nothing here divides tickMs evenly) and it should still take
    // ~300ms of real elapsed time for the first tick — not one tick per frame.
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    const frameSpec: FoeSpec & { id: 'corrosion'; label: string } = {
      id: 'corrosion', label: 'Test dot (frame cadence)', kind: 'foe-state',
      stunMs: 0, dotDamage: 5, dotTicks: 6, tickMs: 300, teleportBehind: false,
    };
    castMagic(frameSpec, playerSide, cpuSide, bout, 0);

    let elapsed = 0;
    for (let i = 0; i < 25; i += 1) {
      stepMagic(playerSide, cpuSide, bout, 16, elapsed);
      elapsed += 16;
    }
    // 25 * 16ms = 400ms elapsed: only the 300ms boundary has been crossed once,
    // so exactly one tick should have fired by now, not six.
    expect(cpuSide.c.health).toBe(MAX_HEALTH - 5);
    expect(cpuSide.rt.dotTicksLeft).toBe(5);
  });

  it('cannot drop health below zero', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    cpuSide.c.health = 3;
    const lethalSpec: FoeSpec & { id: 'corrosion'; label: string } = {
      ...dotSpec, dotTicks: 1, dotDamage: 5, tickMs: 100,
    };
    castMagic(lethalSpec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 100, 100);

    expect(cpuSide.c.health).toBe(0);
  });

  it('teleports the caster to the other side of the foe and flips both facings', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    const teleportSpec: FoeSpec & { id: 'corrosion'; label: string } = {
      id: 'corrosion', label: 'Test phase', kind: 'foe-state',
      stunMs: 0, dotDamage: 0, dotTicks: 0, tickMs: 100, teleportBehind: true,
    };

    castMagic(teleportSpec, playerSide, cpuSide, bout, 0);

    expect(playerSide.c.x).toBeGreaterThan(cpuSide.c.x);
    expect(playerSide.c.facing).toBe(-1);
    expect(cpuSide.c.facing).toBe(1);
  });
});

describe('magicKinds', () => {
  it('maps each spec id to its mechanic kind', () => {
    const specs: Record<string, MagicSpec> = {
      descarga: { id: 'descarga', label: 'Bolt', kind: 'projectile', damage: 1, speed: 1, knockback: 1, lifeMs: 1 },
      sismico: { id: 'sismico', label: 'Quake', kind: 'area', damage: 1, radius: 1, blockable: false, extraHits: 0 },
      muro: { id: 'muro', label: 'Ward', kind: 'self-state', shield: 1, heal: 0, durationMs: 1 },
      corrosion: {
        id: 'corrosion', label: 'Rot', kind: 'foe-state',
        stunMs: 1, dotDamage: 1, dotTicks: 1, tickMs: 1, teleportBehind: false,
      },
    };

    expect(magicKinds(specs)).toEqual({
      descarga: 'projectile', sismico: 'area', muro: 'self-state', corrosion: 'foe-state',
    });
  });
});

describe('MAGIC_SPECS', () => {
  const IMPLEMENTED_KINDS = ['projectile', 'area', 'self-state', 'foe-state'] as const;

  it('gives all nine magics an implemented kind and a non-empty label', () => {
    for (const [id, spec] of Object.entries(MAGIC_SPECS)) {
      expect(IMPLEMENTED_KINDS).toContain(spec.kind);
      expect(spec.label.length, `${id} has an empty label`).toBeGreaterThan(0);
    }
    expect(Object.keys(MAGIC_SPECS)).toHaveLength(9);
  });

  it('uses every one of the four mechanics at least once', () => {
    const kinds = new Set(Object.values(MAGIC_SPECS).map((spec) => spec.kind));
    for (const kind of IMPLEMENTED_KINDS) {
      expect(kinds.has(kind), `no magic uses mechanic ${kind}`).toBe(true);
    }
  });
});

describe('MagicRuntime lifecycle', () => {
  it('creates a runtime with all 13 fields at their initial value', () => {
    const rt = createMagicRuntime();

    expect(rt).toEqual({
      projectileActive: false, projectileX: 0, projectileY: 0,
      projectileVx: 0, projectileDamage: 0, projectileKnockback: 0, projectileMsLeft: 0,
      buffMsLeft: 0,
      dotTicksLeft: 0, dotMsToTick: 0, dotDamage: 0, dotTickMs: 0,
      areaFlashMs: 0,
    });
  });

  it('resets a dirtied runtime back to the initial 13 fields (no DOT survives into a new round)', () => {
    const rt: MagicRuntime = {
      projectileActive: true, projectileX: 42, projectileY: 250,
      projectileVx: 500, projectileDamage: 20, projectileKnockback: 30, projectileMsLeft: 100,
      buffMsLeft: 300,
      dotTicksLeft: 2, dotMsToTick: 150, dotDamage: 5, dotTickMs: 300,
      areaFlashMs: 100,
    };

    resetMagicRuntime(rt);

    expect(rt).toEqual(createMagicRuntime());
  });

  it('leaves state untouched when stepMagic is called with dtMs 0', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 900, -1);
    const dotSpec: FoeSpec & { id: 'corrosion'; label: string } = {
      id: 'corrosion', label: 'Test dot', kind: 'foe-state',
      stunMs: 900, dotDamage: 5, dotTicks: 3, tickMs: 300, teleportBehind: false,
    };
    castMagic(dotSpec, playerSide, cpuSide, bout, 0);
    const projSpec: ProjectileSpec & { id: 'descarga'; label: string } = {
      id: 'descarga', label: 'Test bolt', kind: 'projectile',
      damage: 20, speed: 500, knockback: 30, lifeMs: 500,
    };
    castMagic(projSpec, playerSide, cpuSide, bout, 0);

    const before = {
      player: { ...playerSide.rt }, cpu: { ...cpuSide.rt },
      playerHealth: playerSide.c.health, cpuHealth: cpuSide.c.health,
    };

    stepMagic(playerSide, cpuSide, bout, 0, 0);

    expect(playerSide.rt).toEqual(before.player);
    expect(cpuSide.rt).toEqual(before.cpu);
    expect(playerSide.c.health).toBe(before.playerHealth);
    expect(cpuSide.c.health).toBe(before.cpuHealth);
  });

  it('does not let two MagicRuntime instances cross-contaminate', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    const dotSpec: FoeSpec & { id: 'corrosion'; label: string } = {
      id: 'corrosion', label: 'Test dot', kind: 'foe-state',
      stunMs: 900, dotDamage: 5, dotTicks: 3, tickMs: 300, teleportBehind: false,
    };

    castMagic(dotSpec, playerSide, cpuSide, bout, 0);

    expect(playerSide.rt).toEqual(createMagicRuntime());
    expect(cpuSide.rt.dotTicksLeft).toBe(3);
  });
});

describe('shield absorption is wired into every damage path (fix round 2)', () => {
  // Review round 2: absorbWithShield existed and was tested standalone, but nothing
  // in castMagic/stepSide ever called it before applyDamage. MURO's shield only
  // protected melee (which routes through the component, outside this file) and
  // let every magic damage source through untouched.
  // Final review: the shield moved onto CombatantState and applyDamage absorbs
  // it itself, so no caller can forget again. Same assertions, same numbers —
  // these still guard every magic damage path end to end.

  it('area damage is absorbed by the FOE shield before applyDamage', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 340, -1);
    cpuSide.c.shield = 25;
    const spec: AreaSpec & { id: 'sismico'; label: string } = {
      id: 'sismico', label: 'Test area (shield)', kind: 'area',
      damage: 14, radius: 50, blockable: false, extraHits: 0,
    };

    castMagic(spec, playerSide, cpuSide, bout, 0);

    expect(cpuSide.c.health).toBe(MAX_HEALTH);
    expect(cpuSide.c.shield).toBe(11);
  });

  it('projectile damage is absorbed by the FOE shield before applyDamage, and the projectile is still consumed', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 400, -1);
    cpuSide.c.shield = 25;
    const spec: ProjectileSpec & { id: 'descarga'; label: string } = {
      id: 'descarga', label: 'Test bolt (shield)', kind: 'projectile',
      damage: 8, speed: 500, knockback: 0, lifeMs: 500,
    };
    castMagic(spec, playerSide, cpuSide, bout, 0);

    // spawn at 340, foe at 400, speed 500px/s -> 120ms to close the 60px gap
    stepMagic(playerSide, cpuSide, bout, 120, 120);

    expect(cpuSide.c.health).toBe(MAX_HEALTH);
    expect(cpuSide.c.shield).toBe(17);
    expect(playerSide.rt.projectileActive).toBe(false);
  });

  it('sustained (DOT) damage is absorbed by the SELF shield before applyDamage, and the tick still counts down', () => {
    // The defender here is `self` (the poisoned combatant), not `foe` — the one
    // exception to the foe.rt pattern of the other two sites.
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 500, -1);
    cpuSide.c.shield = 25;
    const spec: FoeSpec & { id: 'corrosion'; label: string } = {
      id: 'corrosion', label: 'Test dot (shield)', kind: 'foe-state',
      stunMs: 0, dotDamage: 3, dotTicks: 1, tickMs: 100, teleportBehind: false,
    };
    castMagic(spec, playerSide, cpuSide, bout, 0);

    stepMagic(playerSide, cpuSide, bout, 100, 100);

    expect(cpuSide.c.health).toBe(MAX_HEALTH);
    expect(cpuSide.c.shield).toBe(22);
    expect(cpuSide.rt.dotTicksLeft).toBe(0);
  });

  it('overflow: damage beyond the shield still reduces health by the remainder, and drains the shield to 0', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 340, -1);
    cpuSide.c.shield = 5;
    const spec: AreaSpec & { id: 'sismico'; label: string } = {
      id: 'sismico', label: 'Test area (overflow)', kind: 'area',
      damage: 14, radius: 50, blockable: false, extraHits: 0,
    };

    castMagic(spec, playerSide, cpuSide, bout, 0);

    expect(cpuSide.c.health).toBe(MAX_HEALTH - 9);
    expect(cpuSide.c.shield).toBe(0);
  });

  it('extraHits drains the shield hit by hit, not the whole shield at once', () => {
    const { playerSide, cpuSide, bout } = makeArena(300, 1, 340, -1);
    cpuSide.c.shield = 20;
    const spec: AreaSpec & { id: 'duplicado'; label: string } = {
      id: 'duplicado', label: 'Test area (extraHits + shield)', kind: 'area',
      damage: 8, radius: 50, blockable: false, extraHits: 1,
    };

    castMagic(spec, playerSide, cpuSide, bout, 0);

    // hit 1: shield 20 -> absorbs 8, shield 12, damage 0
    // hit 2: shield 12 -> absorbs 8, shield 4, damage 0
    expect(cpuSide.c.health).toBe(MAX_HEALTH);
    expect(cpuSide.c.shield).toBe(4);
  });
});
