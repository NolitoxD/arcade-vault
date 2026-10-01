import { isKitColor, kitsClash } from './kits';
import { isInsideBigArea, type PitchDef } from './pitch';
import { BANK_SIZE, FORMATION_COUNT, OUTFIELD, STRATEGY_SHIFT, TEAM_SIZE, slotCounts, type Formation, type Role, type TeamDef } from './teams';
import type { PlayerState } from './players';
import type { AttackDirs } from './step';
import { INJURY_MAX_PER_TEAM, SENT_OFF_MAX, isActive } from './discipline';

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
  // CARRY #1: the table is data, so a 'gk' can be smuggled into a slot at runtime
  // despite OutfieldRole and the invariant has to say so. Reading the slots through
  // the widened element type (a plain assignment, arrays being covariant here) is
  // what makes the comparison legal -- no `as string` cast, and no narrowing of a
  // `const role: Role = s.role` back to OutfieldRole by the compiler either.
  const slots: readonly { role: Role; x: number; y: number }[] = f.slots;
  slots.forEach((s, i) => {
    if (s.role === 'gk') problems.push('goalkeeper in formation');
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
  const validColors = isKitColor(def.kit.primary) && isKitColor(def.kit.secondary);
  if (!validColors) problems.push('bad kit color');
  // kitsClash parses '#rrggbb' and throws otherwise, so only reachable once both
  // colors are already known-valid hex (the 'bad kit color' case above).
  else if (kitsClash(def.kit.primary, def.kit.secondary)) problems.push('kit colors too close');
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

// G15-13 + G15-18: a team never has fewer than TEAM_SIZE - SENT_OFF_MAX -
// INJURY_MAX_PER_TEAM players on the pitch, always has EXACTLY ONE active goalkeeper
// (Paco 24-sep, resolutions 6 and 7), never has more than SENT_OFF_MAX sent off, and
// the controlled player is never one who has left. Returns the offenders by name, like
// every other net in this file. It walks EVERY player of the team on purpose (one of the
// documented exceptions in discipline.ts): it counts the ones who left.
// Fix round 1 (review-6 I1): `pendingInjury` is MatchState.pendingInjury. While a
// keeper's own LESIONADO window is open (G15-18, resolution 7) he is injured, hence not
// isActive, and his replacement has not come on yet -- a legitimate state with play
// stopped, so he still counts as the team's keeper. An injured keeper with NO window
// open is not legitimate (that is what addition 3 closes) and is still flagged.
export function checkTeamCount(
  players: readonly PlayerState[], controlled: readonly [number, number], pendingInjury: readonly [number, number],
): string[] {
  const problems: string[] = [];
  for (const team of [0, 1] as const) {
    let active = 0;
    let keepers = 0;
    let off = 0;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.team !== team) continue;
      if (p.sentOff) off++;
      if (!isActive(p)) {
        if (p.role === 'gk' && !p.sentOff && p.id === pendingInjury[team]) keepers++;
        continue;
      }
      active++;
      if (p.role === 'gk') keepers++;
    }
    if (keepers !== 1) problems.push(`team ${team}: ${keepers} active goalkeepers, expected exactly 1`);
    if (off > SENT_OFF_MAX) problems.push(`team ${team}: ${off} sent off, over SENT_OFF_MAX ${SENT_OFF_MAX}`);
    const floor = TEAM_SIZE - SENT_OFF_MAX - INJURY_MAX_PER_TEAM;
    if (active < floor) problems.push(`team ${team}: ${active} on the pitch, under the floor of ${floor}`);
    const c = controlled[team];
    if (c >= 0) {
      const p = players[c];
      if (p.team !== team || p.role === 'gk' || !isActive(p)) {
        problems.push(`team ${team}: controlled ${c} is not an active outfield player of this team`);
      }
    }
  }
  return problems;
}
