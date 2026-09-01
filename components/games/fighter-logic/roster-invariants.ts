import { ROSTER_SIZE, STAT_BUDGET, STAT_MAX, STAT_MIN, difficultyRank, selectableFighters, statTotal, type FighterDef, type MagicKind } from './fighters';
import type { StageDef } from './stages';
import { scaledReach, scaledRecovery, scaledStartup, type Technique } from './techniques';

export type MagicKindTable = Readonly<Record<string, MagicKind>>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Deliberate duplicate of stages.ts's STAGE_COUNT: this module imports only
// types from stages.ts, so it can't reach that value without breaking that boundary.
const EXPECTED_STAGE_COUNT = 8;

export function checkFighter(def: FighterDef, kinds: MagicKindTable): string[] {
  const problems: string[] = [];

  const stats: [string, number][] = [
    ['strength', def.strength],
    ['speed', def.speed],
    ['reach', def.reach],
  ];
  for (const [label, value] of stats) {
    if (!Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX) {
      problems.push(`stat out of range: ${label}`);
    }
  }

  const total = statTotal(def);
  if (def.boss) {
    if (total <= STAT_BUDGET) problems.push('boss not superior');
  } else if (total !== STAT_BUDGET) {
    problems.push(`budget ${total}`);
  }

  if (!(def.magic in kinds)) problems.push('magic without mechanic');

  if (def.build < 0.9 || def.build > 1.1) problems.push('bad build');

  if (!def.name || def.name !== def.name.toUpperCase()) problems.push('bad name');

  const colors = [def.palette.body, def.palette.trim, def.palette.accent];
  if (!colors.every((c) => HEX_COLOR.test(c))) problems.push('bad palette');

  return problems;
}

export function checkRoster(roster: readonly FighterDef[], kinds: MagicKindTable): string[] {
  const problems: string[] = [];

  const selectable = selectableFighters(roster);
  if (selectable.length !== ROSTER_SIZE) problems.push(`roster size ${selectable.length}`);

  const bosses = roster.filter((f) => f.boss);
  if (bosses.length !== 1) problems.push(`boss count ${bosses.length}`);

  const seenIds = new Set<string>();
  for (const f of roster) {
    if (seenIds.has(f.id)) problems.push(`duplicate id ${f.id}`);
    seenIds.add(f.id);
  }

  const seenMagics = new Set<string>();
  for (const f of roster) {
    if (seenMagics.has(f.magic)) problems.push(`duplicate magic ${f.magic}`);
    seenMagics.add(f.magic);
  }

  const seenRanks = new Set<number>();
  for (const f of selectable) {
    const rank = difficultyRank(f);
    if (seenRanks.has(rank)) problems.push('duplicate difficulty rank');
    seenRanks.add(rank);
  }

  for (const f of roster) {
    for (const problem of checkFighter(f, kinds)) {
      problems.push(`${f.id}: ${problem}`);
    }
  }

  return problems;
}

export function checkStages(stages: readonly StageDef[]): string[] {
  const problems: string[] = [];

  if (stages.length !== EXPECTED_STAGE_COUNT) problems.push(`stage count ${stages.length}`);

  for (const s of stages) {
    const colors = [s.sky[0], s.sky[1], s.ground, s.accent];
    if (!colors.every((c) => HEX_COLOR.test(c))) problems.push(`bad color ${s.id}`);
  }

  const seenIds = new Set<string>();
  for (const s of stages) {
    if (seenIds.has(s.id)) problems.push(`duplicate id ${s.id}`);
    seenIds.add(s.id);
  }

  const seenSilhouettes = new Set<string>();
  for (const s of stages) {
    if (seenSilhouettes.has(s.silhouette)) problems.push(`duplicate silhouette ${s.silhouette}`);
    seenSilhouettes.add(s.silhouette);
  }

  const seenSkies = new Set<string>();
  for (const s of stages) {
    const key = `${s.sky[0]}|${s.sky[1]}`;
    if (seenSkies.has(key)) problems.push('duplicate sky');
    seenSkies.add(key);
  }

  return problems;
}


// ── Layer invariants: the engine's tuning numbers vs. the real tables ─────────
//
// MIN_GAP and HIT_STUN_MS used to live in the canvas component, where nothing
// could compare them against TECHNIQUES/ROSTER. Three of the eight techniques
// could never connect, and every technique looped forever on stun. Both numbers
// now live in combat.ts and the two checks below derive their bounds from the
// tables themselves — never from hand-written literals — so retuning any
// baseReach, startupMs, recoveryMs, reach or speed re-runs the proof.

// Shortest reach any technique of any fighter can produce.
export function minScaledReach(
  techniques: readonly Technique[],
  roster: readonly FighterDef[],
): number {
  let min = Infinity;
  for (const t of techniques) {
    for (const f of roster) {
      const reach = scaledReach(t, f);
      if (reach < min) min = reach;
    }
  }
  return min;
}

// Shortest startup+recovery any technique of any fighter can produce.
export function minTechniqueCycleMs(
  techniques: readonly Technique[],
  roster: readonly FighterDef[],
): number {
  let min = Infinity;
  for (const t of techniques) {
    for (const f of roster) {
      const cycle = scaledStartup(t, f) + scaledRecovery(t, f);
      if (cycle < min) min = cycle;
    }
  }
  return min;
}

// Every technique of every fighter must still reach across the minimum
// separation the clamps impose, or that technique is dead for that fighter.
export function checkReachClearsGap(
  techniques: readonly Technique[],
  roster: readonly FighterDef[],
  minGap: number,
): string[] {
  const problems: string[] = [];
  for (const t of techniques) {
    for (const f of roster) {
      const reach = scaledReach(t, f);
      if (reach <= minGap) {
        problems.push(`${f.id}: ${t.id} cannot reach (${reach.toFixed(2)} <= gap ${minGap})`);
      }
    }
  }
  return problems;
}

// Hit stun must be strictly shorter than the fastest cycle any fighter can
// produce; otherwise the attacker acts again before the defender wakes up and
// a single button loops forever.
export function checkStunClearsFastestCycle(
  techniques: readonly Technique[],
  roster: readonly FighterDef[],
  stunMs: number,
): string[] {
  const problems: string[] = [];
  for (const t of techniques) {
    for (const f of roster) {
      const cycle = scaledStartup(t, f) + scaledRecovery(t, f);
      if (cycle <= stunMs) {
        problems.push(`${f.id}: ${t.id} loops (cycle ${cycle.toFixed(2)} <= stun ${stunMs})`);
      }
    }
  }
  return problems;
}
