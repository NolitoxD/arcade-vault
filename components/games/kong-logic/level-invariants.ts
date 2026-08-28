import { girderYAt, TROPHY_REACH_ABOVE, TROPHY_REACH_BELOW, TROPHY_REACH_X, type Layout } from './level';

function isTrophyReachable(layout: Layout): boolean {
  const topGirder = layout.girders[layout.girders.length - 1];
  for (let x = topGirder.x0; x <= topGirder.x1; x++) {
    if (Math.abs(x - layout.trophy.x) >= TROPHY_REACH_X) continue;
    const dy = girderYAt(topGirder, x) - layout.trophy.y;
    if (dy > TROPHY_REACH_ABOVE && dy < TROPHY_REACH_BELOW) return true;
  }
  return false;
}

// Worst-case check, not a replay of brokenLadderSet: that function's per-floor guard
// ("skip if this is the floor's last unbroken ladder") is only proven safe for the
// canonical layout's hand-picked BROKEN_LADDER_ORDER. Task 8 draws 4 new maps with their
// own ladder geometry, and nothing guarantees their breaking order (or a future rewrite
// of brokenLadderSet) preserves that same guard. So instead of trusting any particular
// selection order, we assume the adversarial case: if a floor's own ladder count is <=
// the number of ladders the map can break, that floor can be left with zero exits.
function floorsWithoutExit(layout: Layout, brokenLadders: number): string[] {
  const problems: string[] = [];
  const topFloor = layout.girders.length - 1;
  for (let floor = 0; floor < topFloor; floor++) {
    const upLadders = layout.ladders.filter((l) => l.from === floor && !l.broken).length;
    if (upLadders <= brokenLadders) problems.push(`floor ${floor} has no exit`);
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

export function checkLayout(layout: Layout, brokenLadders: number): string[] {
  const problems: string[] = [];
  if (!isTrophyReachable(layout)) problems.push('trophy unreachable');
  problems.push(...floorsWithoutExit(layout, brokenLadders));
  const kongProblem = checkKong(layout);
  if (kongProblem) problems.push(kongProblem);
  problems.push(...checkHammers(layout));
  const spawnProblem = checkSpawn(layout);
  if (spawnProblem) problems.push(spawnProblem);
  return problems;
}
