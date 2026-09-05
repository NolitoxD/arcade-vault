import { isInsideBigArea, type PitchDef } from './pitch';
import { BANK_SIZE, FORMATION_COUNT, OUTFIELD, STRATEGY_SHIFT, slotCounts, type Formation, type TeamDef } from './teams';
import type { PlayerState } from './players';
import type { AttackDirs } from './step';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const KEBAB_ID = /^[a-z][a-z0-9-]*$/;

export function checkPitch(pitch: PitchDef): string[] {
  const problems: string[] = [];
  if (!(pitch.width > pitch.height && pitch.height > 0)) problems.push('bad size');
  if (pitch.goalWidth >= pitch.smallAreaWidth) problems.push('goal wider than small area');
  if (pitch.smallAreaWidth >= pitch.bigAreaWidth) problems.push('small area wider than big area');
  if (pitch.bigAreaWidth > pitch.height) problems.push('big area wider than pitch');
  if (!(pitch.smallAreaDepth > 0 && pitch.smallAreaDepth < pitch.bigAreaDepth)) problems.push('small area deeper than big area');
  if (pitch.bigAreaDepth >= pitch.width / 2) problems.push('big area past halfway');
  if (pitch.penaltySpotDist >= pitch.bigAreaDepth) problems.push('penalty spot outside big area');
  if (pitch.penaltySpotDist <= pitch.smallAreaDepth) problems.push('penalty spot inside small area');
  if (!(pitch.crossbarHeight > 0)) problems.push('bad crossbar');
  if (!(pitch.centerCircleRadius > 0 && pitch.centerCircleRadius < pitch.height / 2)) problems.push('bad center circle');
  return problems;
}

function insideUnit(v: number): boolean {
  return v > 0 && v < 1;
}

export function checkFormation(f: Formation): string[] {
  const problems: string[] = [];
  if (f.slots.length !== OUTFIELD) problems.push(`slot count ${f.slots.length}`);
  f.slots.forEach((s, i) => {
    if ((s.role as string) === 'gk') problems.push('goalkeeper in formation');
    if (!insideUnit(s.x) || !insideUnit(s.y)) problems.push(`slot ${i} out of pitch`);
    else if (!insideUnit(s.x + STRATEGY_SHIFT) || !insideUnit(s.x - STRATEGY_SHIFT)) {
      problems.push(`slot ${i} leaves pitch under strategy`);
    }
  });
  for (let i = 0; i < f.slots.length; i++) {
    for (let j = i + 1; j < f.slots.length; j++) {
      if (f.slots[i].x === f.slots[j].x && f.slots[i].y === f.slots[j].y) problems.push('duplicate slot position');
    }
  }
  const [def, mid, fwd] = slotCounts(f);
  if (f.id !== `${def}-${mid}-${fwd}`) problems.push('id does not match slots');
  return problems;
}

export function checkFormations(formations: readonly Formation[]): string[] {
  const problems: string[] = [];
  if (formations.length !== FORMATION_COUNT) problems.push(`formation count ${formations.length}`);
  const seen = new Set<string>();
  for (const f of formations) {
    if (seen.has(f.id)) problems.push(`duplicate formation id ${f.id}`);
    seen.add(f.id);
  }
  for (const f of formations) {
    for (const p of checkFormation(f)) problems.push(`${f.id}: ${p}`);
  }
  return problems;
}

export function checkTeam(def: TeamDef): string[] {
  const problems: string[] = [];
  if (!KEBAB_ID.test(def.id)) problems.push('bad id');
  if (!def.name || def.name !== def.name.toUpperCase()) problems.push('bad name');
  if (!HEX_COLOR.test(def.kit.primary) || !HEX_COLOR.test(def.kit.secondary)) problems.push('bad kit color');
  if (def.kit.primary === def.kit.secondary) problems.push('kit colors equal');
  return problems;
}

export function checkTeams(teams: readonly TeamDef[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (const t of teams) {
    if (seenIds.has(t.id)) problems.push(`duplicate id ${t.id}`);
    seenIds.add(t.id);
  }
  const seenKits = new Set<string>();
  for (const t of teams) {
    const key = `${t.kit.primary}|${t.kit.secondary}`;
    if (seenKits.has(key)) problems.push(`duplicate kit ${t.id}`);
    seenKits.add(key);
  }
  for (const t of teams) {
    for (const p of checkTeam(t)) problems.push(`${t.id}: ${p}`);
  }
  return problems;
}

export function checkBank(teams: readonly TeamDef[]): string[] {
  const problems = checkTeams(teams);
  if (teams.length !== BANK_SIZE) problems.push(`bank size ${teams.length}`);
  return problems;
}

// Criterion 9b: a goalkeeper is never outside its own big area, not even by physics.
// Recomputes the own side instead of importing `ownGoalSide` from players.ts: this
// module imports only types from players.ts, as roster-invariants.ts does with stages.ts.
export function checkGoalkeepersInBox(players: readonly PlayerState[], attackDir: AttackDirs, pitch: PitchDef): string[] {
  const problems: string[] = [];
  for (const p of players) {
    if (p.role !== 'gk') continue;
    const side = attackDir[p.team] === 1 ? 0 : 1;
    if (!isInsideBigArea(pitch, side, p.x, p.y)) problems.push(`goalkeeper ${p.id} outside big area`);
  }
  return problems;
}
