import { brokenLadderSet, girderYAt, TROPHY_REACH_ABOVE, TROPHY_REACH_BELOW, TROPHY_REACH_X, type Layout } from './level';
import { FALL_DEATH_PX } from './player';

function isTrophyReachable(layout: Layout): boolean {
  const topGirder = layout.girders[layout.girders.length - 1];
  for (let x = topGirder.x0; x <= topGirder.x1; x++) {
    if (Math.abs(x - layout.trophy.x) >= TROPHY_REACH_X) continue;
    const dy = girderYAt(topGirder, x) - layout.trophy.y;
    if (dy > TROPHY_REACH_ABOVE && dy < TROPHY_REACH_BELOW) return true;
  }
  return false;
}

// Exact check: runs the real brokenLadderSet for this layout/level and looks at which
// ladders it actually broke, instead of a worst-case guess. brokenLadderSet already
// refuses to break a floor's last unbroken ladder, so this mainly catches what that
// guard cannot: a floor that starts with zero ladders in the first place (a layout
// authoring bug Task 8's 4 new maps could introduce), and it stays accurate even if a
// future rewrite of brokenLadderSet changes its selection order.
function floorsWithoutExit(layout: Layout, level: number): string[] {
  const problems: string[] = [];
  const broken = brokenLadderSet(layout, level);
  const topFloor = layout.girders.length - 1;
  for (let floor = 0; floor < topFloor; floor++) {
    const upLadders = layout.ladders.filter((l, i) => l.from === floor && !broken.has(i)).length;
    if (upLadders === 0) problems.push(`floor ${floor} has no exit`);
  }
  return problems;
}

// Walks the x-range shared by every pair of adjacent girders (not just its
// endpoints — both girders are sloped, so the worst point can land anywhere
// in between) and flags a pair whose vertical separation ever exceeds
// FALL_DEATH_PX. Imported straight from player.ts rather than a hardcoded
// 90 so this check can never drift out of sync with the actual physics: if
// someone retunes FALL_DEATH_PX, this invariant re-evaluates against the
// new value automatically.
function checkGirderGaps(layout: Layout): string[] {
  const problems: string[] = [];
  const girders = layout.girders;
  for (let i = 0; i < girders.length - 1; i++) {
    const lower = girders[i];
    const upper = girders[i + 1];
    const x0 = Math.max(lower.x0, upper.x0);
    const x1 = Math.min(lower.x1, upper.x1);
    for (let x = x0; x <= x1; x++) {
      const gap = girderYAt(lower, x) - girderYAt(upper, x);
      if (gap > FALL_DEATH_PX) {
        problems.push(`girders ${i}-${i + 1} too far apart`);
        break;
      }
    }
  }
  return problems;
}

function isOnGirder(layout: Layout, girderIndex: number, x: number): boolean {
  const girder = layout.girders[girderIndex];
  return girder !== undefined && x >= girder.x0 && x <= girder.x1;
}

function checkKong(layout: Layout): string | null {
  return isOnGirder(layout, layout.kong.girder, layout.kong.x) ? null : 'kong has no girder';
}

function checkHammers(layout: Layout): string[] {
  const problems: string[] = [];
  layout.hammers.forEach((hammer, i) => {
    if (!isOnGirder(layout, hammer.girder, hammer.x)) problems.push(`hammer ${i} off girder`);
  });
  return problems;
}

function isWithinTrophyReach(layout: Layout, x: number, y: number): boolean {
  if (Math.abs(x - layout.trophy.x) >= TROPHY_REACH_X) return false;
  const dy = y - layout.trophy.y;
  return dy > TROPHY_REACH_ABOVE && dy < TROPHY_REACH_BELOW;
}

function checkSpawn(layout: Layout): string | null {
  const { girder, x } = layout.playerSpawn;
  if (!isOnGirder(layout, girder, x)) return 'spawn invalid';
  const spawnY = girderYAt(layout.girders[girder], x);
  if (isWithinTrophyReach(layout, x, spawnY)) return 'spawn invalid';
  return null;
}

export function checkLayout(layout: Layout, level: number): string[] {
  const problems: string[] = [];
  if (!isTrophyReachable(layout)) problems.push('trophy unreachable');
  problems.push(...floorsWithoutExit(layout, level));
  const kongProblem = checkKong(layout);
  if (kongProblem) problems.push(kongProblem);
  problems.push(...checkHammers(layout));
  const spawnProblem = checkSpawn(layout);
  if (spawnProblem) problems.push(spawnProblem);
  problems.push(...checkGirderGaps(layout));
  return problems;
}
