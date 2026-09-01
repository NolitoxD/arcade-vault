import type { MagicId, MagicKind } from './fighters';
import { applyDamage, MAX_HEALTH, type BoutState, type CombatantState, type Side } from './combat';

export type ProjectileSpec = { kind: 'projectile'; damage: number; speed: number; knockback: number; lifeMs: number };
export type AreaSpec = { kind: 'area'; damage: number; radius: number; blockable: boolean; extraHits: number };
export type SelfSpec = { kind: 'self-state'; shield: number; heal: number; durationMs: number };
export type FoeSpec = {
  kind: 'foe-state';
  stunMs: number;
  dotDamage: number;
  dotTicks: number;
  tickMs: number;
  teleportBehind: boolean;
};
export type MagicSpec = (ProjectileSpec | AreaSpec | SelfSpec | FoeSpec) & { id: MagicId; label: string };

export const MAGIC_SPECS: Readonly<Record<MagicId, MagicSpec>> = {
  destello: {
    id: 'destello', label: 'DESTELLO', kind: 'foe-state',
    stunMs: 900, dotDamage: 0, dotTicks: 0, tickMs: 0, teleportBehind: false,
  },
  muro: {
    id: 'muro', label: 'MURO', kind: 'self-state',
    shield: 25, heal: 0, durationMs: 6000,
  },
  'salto-de-fase': {
    id: 'salto-de-fase', label: 'SALTO DE FASE', kind: 'foe-state',
    stunMs: 200, dotDamage: 0, dotTicks: 0, tickMs: 0, teleportBehind: true,
  },
  descarga: {
    id: 'descarga', label: 'DESCARGA', kind: 'projectile',
    damage: 8, speed: 620, knockback: 0, lifeMs: 1600,
  },
  corrosion: {
    id: 'corrosion', label: 'CORROSIÓN', kind: 'foe-state',
    stunMs: 0, dotDamage: 3, dotTicks: 6, tickMs: 600, teleportBehind: false,
  },
  onda: {
    id: 'onda', label: 'ONDA', kind: 'projectile',
    damage: 5, speed: 340, knockback: 90, lifeMs: 2000,
  },
  duplicado: {
    id: 'duplicado', label: 'DUPLICADO', kind: 'area',
    damage: 7, radius: 110, blockable: true, extraHits: 1,
  },
  sismico: {
    id: 'sismico', label: 'SÍSMICO', kind: 'area',
    damage: 14, radius: 170, blockable: false, extraHits: 0,
  },
  reinicio: {
    id: 'reinicio', label: 'REINICIO', kind: 'self-state',
    shield: 0, heal: 30, durationMs: 0,
  },
};

export function magicKinds(specs: Readonly<Record<string, MagicSpec>>): Readonly<Record<string, MagicKind>> {
  const out: Record<string, MagicKind> = {};
  for (const id in specs) {
    if (Object.prototype.hasOwnProperty.call(specs, id)) {
      out[id] = specs[id].kind;
    }
  }
  return out;
}

export type MagicRuntime = {
  projectileActive: boolean;
  projectileX: number;
  projectileY: number;
  projectileVx: number;
  projectileDamage: number;
  projectileKnockback: number;
  projectileMsLeft: number;
  buffMsLeft: number;
  dotTicksLeft: number;
  dotMsToTick: number;
  dotDamage: number;
  dotTickMs: number; // the fixed period ticks are rescheduled at; NOT the same as dotMsToTick's countdown
  areaFlashMs: number;
};

export function createMagicRuntime(): MagicRuntime {
  return {
    projectileActive: false,
    projectileX: 0,
    projectileY: 0,
    projectileVx: 0,
    projectileDamage: 0,
    projectileKnockback: 0,
    projectileMsLeft: 0,
    buffMsLeft: 0,
    dotTicksLeft: 0,
    dotMsToTick: 0,
    dotDamage: 0,
    dotTickMs: 0,
    areaFlashMs: 0,
  };
}

export function resetMagicRuntime(rt: MagicRuntime): void {
  rt.projectileActive = false;
  rt.projectileX = 0;
  rt.projectileY = 0;
  rt.projectileVx = 0;
  rt.projectileDamage = 0;
  rt.projectileKnockback = 0;
  rt.projectileMsLeft = 0;
  rt.buffMsLeft = 0;
  rt.dotTicksLeft = 0;
  rt.dotMsToTick = 0;
  rt.dotDamage = 0;
  rt.dotTickMs = 0;
  rt.areaFlashMs = 0;
}

export type MagicSide = { side: Side; c: CombatantState; rt: MagicRuntime };

const PROJECTILE_SPAWN_OFFSET = 40; // px in front of the caster's face
const PROJECTILE_SPAWN_Y = 250; // fixed visual height, canvas is 500 tall
const PROJECTILE_HIT_RADIUS = 24; // px, projectile vs. defender hitbox
const AREA_FLASH_MS = 220; // how long the component paints the area effect
const TELEPORT_OFFSET = 60; // px placed beyond the foe when teleporting behind it

export function castMagic(spec: MagicSpec, caster: MagicSide, foe: MagicSide, bout: BoutState, nowMs: number): void {
  switch (spec.kind) {
    case 'projectile': {
      caster.rt.projectileActive = true;
      caster.rt.projectileX = caster.c.x + caster.c.facing * PROJECTILE_SPAWN_OFFSET;
      caster.rt.projectileY = PROJECTILE_SPAWN_Y;
      caster.rt.projectileVx = spec.speed * caster.c.facing;
      caster.rt.projectileDamage = spec.damage;
      caster.rt.projectileKnockback = spec.knockback;
      caster.rt.projectileMsLeft = spec.lifeMs;
      break;
    }
    case 'area': {
      const dx = foe.c.x - caster.c.x;
      if (Math.abs(dx) <= spec.radius) {
        const blocked = spec.blockable && foe.c.stance === 'block';
        if (!blocked) {
          const hits = spec.extraHits + 1;
          for (let i = 0; i < hits; i += 1) {
            // No shield handling here: applyDamage is the single funnel and
            // absorbs the shield itself, hit by hit.
            applyDamage(bout, foe.side, spec.damage);
          }
        }
      }
      caster.rt.areaFlashMs = AREA_FLASH_MS;
      break;
    }
    case 'self-state': {
      caster.c.shield += spec.shield;
      caster.c.health = Math.min(MAX_HEALTH, caster.c.health + spec.heal);
      caster.rt.buffMsLeft = spec.durationMs;
      break;
    }
    case 'foe-state': {
      foe.c.stunUntilMs = nowMs + spec.stunMs;
      foe.rt.dotTicksLeft = spec.dotTicks;
      foe.rt.dotMsToTick = spec.tickMs;
      foe.rt.dotDamage = spec.dotDamage;
      foe.rt.dotTickMs = spec.tickMs;
      if (spec.teleportBehind) {
        const wasLeft = caster.c.x < foe.c.x;
        caster.c.x = wasLeft ? foe.c.x + TELEPORT_OFFSET : foe.c.x - TELEPORT_OFFSET;
        caster.c.facing = caster.c.facing === 1 ? -1 : 1;
        foe.c.facing = foe.c.facing === 1 ? -1 : 1;
      }
      break;
    }
    default: {
      const exhaustive: never = spec;
      throw new Error(`Unhandled magic kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function stepSide(self: MagicSide, foe: MagicSide, bout: BoutState, dtMs: number): void {
  const rt = self.rt;

  if (rt.projectileActive) {
    rt.projectileX += rt.projectileVx * (dtMs / 1000);
    rt.projectileMsLeft -= dtMs;

    const dx = foe.c.x - rt.projectileX;
    if (Math.abs(dx) <= PROJECTILE_HIT_RADIUS) {
      if (foe.c.stance !== 'block') {
        applyDamage(bout, foe.side, rt.projectileDamage);
        foe.c.x += Math.sign(rt.projectileVx) * rt.projectileKnockback;
      }
      rt.projectileActive = false;
      rt.projectileMsLeft = 0;
    } else if (rt.projectileMsLeft <= 0) {
      rt.projectileActive = false;
      rt.projectileMsLeft = 0;
    }
  }

  if (rt.buffMsLeft > 0) {
    rt.buffMsLeft -= dtMs;
    if (rt.buffMsLeft <= 0) {
      rt.buffMsLeft = 0;
      self.c.shield = 0;
    }
  }

  if (rt.dotTicksLeft > 0) {
    rt.dotMsToTick -= dtMs;
    if (rt.dotMsToTick <= 0) {
      applyDamage(bout, self.side, rt.dotDamage);
      rt.dotTicksLeft -= 1;
      rt.dotMsToTick += rt.dotTickMs;
    }
  }

  if (rt.areaFlashMs > 0) {
    rt.areaFlashMs = Math.max(0, rt.areaFlashMs - dtMs);
  }
}

export function stepMagic(player: MagicSide, cpu: MagicSide, bout: BoutState, dtMs: number, nowMs: number): void {
  void nowMs; // reserved for future gating; the current four mechanics are purely dtMs-driven
  stepSide(player, cpu, bout, dtMs);
  stepSide(cpu, player, bout, dtMs);
}
