import { INV_SQRT2, type Vec2 } from './geometry';
import { centerX, centerY, clampToBigArea, goalLineX, type PitchDef, type Side } from './pitch';
import { OUTFIELD, STRATEGIES, TEAM_SIZE, type Formation, type FormationSlot, type Role, type Strategy } from './teams';
import type { Axis } from './input';
import { perStep, stepsFor } from './clock';
// V15-4 (G15-10/G15-26, H12): the ONE engine edge into squads.ts, opened on purpose.
// It is data only and one-way (squads.ts never imports this file): defaultSquadIndexFor
// needs the role table, applySquadAttrs the per-player and per-keeper levels.
import { SQUAD_SIZE, keeperAttrsFor, outfieldAttrsFor, squadRole } from './squads';

export type PlayerState = {
  id: number; // own id, not "defender #2": what will make substitutions possible in v1.5
  team: 0 | 1;
  role: Role;
  slot: number; // index into the formation, -1 for the goalkeeper
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  sprintStepsLeft: number;
  sprintCooldownSteps: number;
  downUntilStep: number;
  chargeSteps: number;
  chargeButton: 'none' | 'a' | 'b';
  tackleStepsLeft: number;
  tackleDirX: number;
  tackleDirY: number;
  // AI movement channel (stage B, Task 6a): |want| <= 1, the magnitude scales the
  // speed so a positioning target is reached exactly instead of overshot. The
  // controlled player ignores it (moved by its TeamInput through stepPlayer).
  wantX: number;
  wantY: number;
  wantSprint: boolean;
  // G15-10 / G15-26 (V15-4): which player of the squad this is. The multipliers and the
  // keeper levels are DERIVED from it once, at creation (applySquadAttrs; again on a
  // substitution), and never recomputed inside the step: the step only multiplies.
  squadIndex: number;
  speedMult: number;        // 1 +- ATTR_SPEED_SPAN from the per-player speed level; 1 for a keeper
  shotMult: number;         // 1 +- ATTR_SHOT_SPAN from the per-player shot level; 1 for a keeper
  keeperReflexes: number;   // 1-5 for a keeper, 0 for an outfield player
  keeperRushing: number;    // 1-5 for a keeper, 0 for an outfield player
  keeperKicking: number;    // 1-5 for a keeper, 0 for an outfield player
};

export const PLAYER_SPEED = 180;
export const PLAYER_SPEED_WITH_BALL = 160;
export const SPRINT_MULT = 1.4;
const SPRINT_SECONDS = 2;
const SPRINT_COOLDOWN_SECONDS = 3;
export const SPRINT_STEPS = stepsFor(SPRINT_SECONDS);
export const SPRINT_COOLDOWN_STEPS = stepsFor(SPRINT_COOLDOWN_SECONDS);
export const PLAYER_RADIUS = 12;
export const PLAYER_HEIGHT = 35; // a ball above this height cannot be picked up
export const GK_LINE_DIST = 25; // the goalkeeper's line, off its goal line
export const GK_SPEED = 220; // consumed by ai.ts (stage B, Task 6)
export const GK_CATCH_RADIUS = 40; // consumed by ai.ts (stage B, Task 6)
export const TACKLE_DIST = 90;
const TACKLE_SECONDS = 0.4;
export const TACKLE_STEPS = stepsFor(TACKLE_SECONDS);
// Not exported (ruling R5): nothing outside this file needs the raw speed, only
// the distance/duration constants above and the slide stepPlayer performs with it.
const TACKLE_SPEED = TACKLE_DIST / TACKLE_SECONDS;

// G15-10, "ajuste fisico pequeno (+-5 %)". Level 3 is 1.0; each level away from it is
// half of the span, so level 1 is 0.95 and level 5 is 1.05.
export const ATTR_SPEED_SPAN = 0.05;
export const ATTR_SHOT_SPAN = 0.05;
// G15-26: the keeper's rushing scales his speed (level 1: 0.92, level 5: 1.08).
export const KEEPER_RUSHING_SPAN = 0.08;

export function multForLevel(level: number, span: number): number {
  return 1 + ((level - 3) / 2) * span;
}

// The keeper's own top speed: GK_SPEED bent by his rushing level. movePlayer moves him
// at it and keeperStep steers with it, so the exact-arrival of steerTo still holds.
export function keeperSpeed(gk: PlayerState): number {
  return GK_SPEED * multForLevel(gk.keeperRushing, KEEPER_RUSHING_SPAN);
}

// Scratch for direction math inside the step; never holds state between calls.
const scratchDir: Vec2 = { x: 0, y: 0 };

export function ownGoalSide(attackDir: 1 | -1): Side {
  return attackDir === 1 ? 0 : 1;
}

// Formation fraction -> world units, shifted by the strategy towards the rival
// goal and mirrored in x for the team attacking -x.
export function anchorFor(slot: FormationSlot, strategy: Strategy, attackDir: 1 | -1, pitch: PitchDef, out: Vec2): void {
  const fx = slot.x + STRATEGIES[strategy];
  out.x = (attackDir === 1 ? fx : 1 - fx) * pitch.width;
  out.y = slot.y * pitch.height;
}

function createPlayer(id: number, team: 0 | 1, role: Role, slot: number, attackDir: 1 | -1, squadIndex: number): PlayerState {
  return {
    id, team, role, slot,
    x: 0, y: 0, vx: 0, vy: 0,
    facingX: attackDir, facingY: 0,
    sprintStepsLeft: 0, sprintCooldownSteps: 0, downUntilStep: 0,
    chargeSteps: 0, chargeButton: 'none',
    tackleStepsLeft: 0, tackleDirX: 0, tackleDirY: 0,
    wantX: 0, wantY: 0, wantSprint: false,
    squadIndex, speedMult: 1, shotMult: 1, keeperReflexes: 0, keeperRushing: 0, keeperKicking: 0,
  };
}

// The default squad index of a formation slot (-1 = the keeper): the lowest index of
// that slot's role not already used by an earlier slot, keeper first -- so the number
// 1 starts in goal. The SAME rule as football-screen/lineup.ts's defaultLineup, written
// again here because the engine may not import the screen (H17); attributes.test.ts
// checks that the two agree for every formation.
export function defaultSquadIndexFor(formation: Formation, slot: number): number {
  const role: Role = slot < 0 ? 'gk' : formation.slots[slot].role;
  let skip = 0;
  for (let s = 0; s < slot; s++) if (formation.slots[s].role === role) skip++;
  for (let i = 0; i < SQUAD_SIZE; i++) {
    if (squadRole(i) !== role) continue;
    if (skip === 0) return i;
    skip--;
  }
  return -1;   // unreachable while checkSquadCoversFormations(FORMATIONS) is [] (squads.test.ts)
}

// G15-10 / G15-26: the five derived values of a player, from p.squadIndex and p.role.
// Runs at creation and on a substitution, never inside the step.
export function applySquadAttrs(p: PlayerState, teamId: string): void {
  if (p.role === 'gk') {
    const k = keeperAttrsFor(teamId, p.squadIndex);
    p.speedMult = 1;
    p.shotMult = 1;
    p.keeperReflexes = k.reflexes;
    p.keeperRushing = k.rushing;
    p.keeperKicking = k.kicking;
    return;
  }
  const a = outfieldAttrsFor(teamId, p.squadIndex);
  p.speedMult = multForLevel(a.speed, ATTR_SPEED_SPAN);
  p.shotMult = multForLevel(a.shot, ATTR_SHOT_SPAN);
  p.keeperReflexes = 0;
  p.keeperRushing = 0;
  p.keeperKicking = 0;
}

// 22 players created once: ids 0..10 are team 0 (0 = goalkeeper), 11..21 team 1.
// players[i].id === i always, so players[ball.owner] is O(1). `starters`, when given,
// is the squad index per lineup POSITION (0 = the keeper, p = formation slot p - 1),
// exactly football-screen/lineup.ts's Lineup.starters; without it every team fields
// defaultSquadIndexFor's eleven. This signature is fixed for the whole of V15-4 (H9).
export function createPlayers(
  formations: readonly [Formation, Formation],
  pitch: PitchDef,
  teamIds: readonly [string, string],
  starters?: readonly [readonly number[], readonly number[]],
): PlayerState[] {
  const players: PlayerState[] = [];
  for (const team of [0, 1] as const) {
    const attackDir: 1 | -1 = team === 0 ? 1 : -1;
    const base = team * TEAM_SIZE;
    const f = formations[team];
    const gk = createPlayer(base, team, 'gk', -1, attackDir, starters === undefined ? defaultSquadIndexFor(f, -1) : starters[team][0]);
    applySquadAttrs(gk, teamIds[team]);
    players.push(gk);
    for (let s = 0; s < OUTFIELD; s++) {
      const p = createPlayer(base + 1 + s, team, f.slots[s].role, s, attackDir, starters === undefined ? defaultSquadIndexFor(f, s) : starters[team][s + 1]);
      applySquadAttrs(p, teamIds[team]);
      players.push(p);
    }
    placeByFormation(players, team, f, 'neutral', attackDir, pitch);
  }
  return players;
}

export function placeByFormation(players: PlayerState[], team: 0 | 1, formation: Formation, strategy: Strategy, attackDir: 1 | -1, pitch: PitchDef): void {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.team !== team) continue;
    if (p.role === 'gk') {
      p.x = goalLineX(pitch, ownGoalSide(attackDir)) + attackDir * GK_LINE_DIST;
      p.y = centerY(pitch);
    } else {
      anchorFor(formation.slots[p.slot], strategy, attackDir, pitch, scratchDir);
      p.x = scratchDir.x;
      p.y = scratchDir.y;
    }
    p.vx = 0;
    p.vy = 0;
    p.wantX = 0;
    p.wantY = 0;
    p.wantSprint = false;
    p.facingX = attackDir;
    p.facingY = 0;
  }
}

// Stage B2, S-PK4: the outfield players who are not taking the kick stand still around
// the centre spot and the live positioning AI does not run for them. The grid is laid
// out by ascending id with integer arithmetic -- spreading them on a circle would need
// trigonometry, which the engine bans (risk 3).
// Stage B2 finding H4: this used to be a 5 x 3 grid (2 * OUTFIELD - 1 slots, exactly
// the fifteen then needed), but its middle column and row are both exact integers
// ((5-1)/2 = 2, (3-1)/2 = 1), so slot k = 7 landed at offset (0, 0) -- one player
// parked exactly on the centre spot itself, which is where the ball of the shootout's
// NEXT kick sits. What fixes the coincidence is an EVEN number of rows and columns, not
// the choice of which slot to drop.
//
// G15-16 (V15-4): with ten outfield players a side there are 2 * OUTFIELD - 1 = 19 to
// park, so the 4 x 4 grid of stage B2 is one row short. 5 x 4 = 20 = 2 * OUTFIELD keeps
// the old shape of the property (one slot more than the players) and, with an EVEN
// number of ROWS, no slot's offset from the centre is ever (0, 0) -- which is the whole
// point of finding H4: nobody parks on the centre spot where the NEXT kick's ball sits.
// (The old layout needed the `k === 7` skip to drop its extra slot; with 19 players and
// 20 slots the last one is simply never used, so the skip is gone.)
// Spacing 60 x 80 puts the far corner at sqrt(120^2 + 120^2) = 169.7 u from the centre
// spot, inside the centre circle, which is now 192.5 u (Paco 24-sep: the circle scales
// with the pitch). 169.7 < 192.5 with 23 u to spare -- the old 175 u circle already fit
// it, so the spacing is not what the scaling changed.
// Stage B2 assumption S-PK7, not in the spec -- review in QA: the goalkeepers are NOT
// parked. The spec's "the sixteen remaining" would put the attacking keeper on the
// centre circle, and criterion 9b (checkGoalkeepersInBox) forbids a keeper outside its
// own big area -- so both keepers stay where placeByFormation left them, on their lines.
// Stage B2 assumption S-PK10, not in the spec -- review in QA: an extra time that ended
// mid-slide would otherwise leave a parked player frozen in the air for the whole
// shootout, so the slide, the floor and the charge are cleared here as well.
export const SHOOTOUT_GRID_COLUMNS = 5;
export const SHOOTOUT_GRID_ROWS = 4;
export const SHOOTOUT_GRID_SPACING_X = 60;
export const SHOOTOUT_GRID_SPACING_Y = 80;

export function placeAroundCentreSpot(players: PlayerState[], takerId: number, pitch: PitchDef): void {
  const cx = centerX(pitch);
  const cy = centerY(pitch);
  let k = 0;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.role === 'gk' || p.id === takerId) continue;
    const col = k % SHOOTOUT_GRID_COLUMNS;
    const row = (k - col) / SHOOTOUT_GRID_COLUMNS;
    p.x = cx + (col - (SHOOTOUT_GRID_COLUMNS - 1) / 2) * SHOOTOUT_GRID_SPACING_X;
    p.y = cy + (row - (SHOOTOUT_GRID_ROWS - 1) / 2) * SHOOTOUT_GRID_SPACING_Y;
    p.vx = 0;
    p.vy = 0;
    p.wantX = 0;
    p.wantY = 0;
    p.wantSprint = false;
    p.tackleStepsLeft = 0;
    p.downUntilStep = 0;
    p.chargeSteps = 0;
    p.chargeButton = 'none';
    k++;
  }
}

export function isPlayerDown(p: PlayerState, stepCount: number): boolean {
  return stepCount < p.downUntilStep;
}

// Deferred minor #12 (stage A): this reads false on the LAST sprinting step
// (tickSprint decrements to 0 while still applying sprint speed). The steal
// threshold in actions.ts reads it at the START of the next step, i.e. it sees the
// sprint state that was applied in the previous step: a one-step, deterministic
// lag that is the same for both teams. Left as is on purpose (stage B decision);
// the HUD of stage C may show one frame of "not sprinting" at the end of a burst.
export function isSprinting(p: PlayerState): boolean {
  return p.sprintStepsLeft > 0;
}

// Burst with recovery, counted in steps. Returns whether this step is sprinting.
function tickSprint(p: PlayerState, wantSprint: boolean): boolean {
  if (p.sprintStepsLeft > 0) {
    if (!wantSprint) {
      p.sprintStepsLeft = 0;
      p.sprintCooldownSteps = SPRINT_COOLDOWN_STEPS;
      return false;
    }
    p.sprintStepsLeft--;
    if (p.sprintStepsLeft === 0) p.sprintCooldownSteps = SPRINT_COOLDOWN_STEPS;
    return true;
  }
  if (p.sprintCooldownSteps > 0) {
    p.sprintCooldownSteps--;
    return false;
  }
  if (wantSprint) {
    p.sprintStepsLeft = SPRINT_STEPS - 1;
    return true;
  }
  return false;
}

function clampToPitch(p: PlayerState, attackDir: 1 | -1, pitch: PitchDef): void {
  if (p.x < 0) p.x = 0;
  if (p.x > pitch.width) p.x = pitch.width;
  if (p.y < 0) p.y = 0;
  if (p.y > pitch.height) p.y = pitch.height;
  if (p.role === 'gk') clampToBigArea(pitch, ownGoalSide(attackDir), p);
}

// (fx, fy) is the facing to apply (unit or zero); `factor` in (0, 1] scales the
// speed. stepPlayer passes exactly the stage-A values (dx*diag, dy*diag, 1) so
// the controlled path is bit-identical; stepPlayerFree passes the want channel.
function movePlayer(p: PlayerState, fx: number, fy: number, factor: number, wantSprint: boolean, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
  // Slides while the tackle is active; Task 3's stepTackle owns the countdown and the outcome.
  if (p.tackleStepsLeft > 0) {
    p.vx = p.tackleDirX * TACKLE_SPEED;
    p.vy = p.tackleDirY * TACKLE_SPEED;
    p.x += perStep(p.vx);
    p.y += perStep(p.vy);
    tickSprint(p, false);
    clampToPitch(p, attackDir, pitch);
    return;
  }
  if (isPlayerDown(p, stepCount)) {
    p.vx = 0;
    p.vy = 0;
    tickSprint(p, false);
    clampToPitch(p, attackDir, pitch);
    return;
  }
  const sprinting = tickSprint(p, p.role === 'gk' ? false : wantSprint);
  let speed = p.role === 'gk' ? keeperSpeed(p) : hasBall ? PLAYER_SPEED_WITH_BALL : PLAYER_SPEED;
  speed *= p.speedMult;   // G15-10: 1 for a keeper, whose rushing is already in keeperSpeed
  if (sprinting) speed *= SPRINT_MULT;
  if (fx === 0 && fy === 0) {
    p.vx = 0;
    p.vy = 0;
  } else {
    p.facingX = fx;
    p.facingY = fy;
    p.vx = p.facingX * speed * factor;
    p.vy = p.facingY * speed * factor;
    p.x += perStep(p.vx);
    p.y += perStep(p.vy);
  }
  clampToPitch(p, attackDir, pitch);
}

export function stepPlayer(p: PlayerState, dx: Axis, dy: Axis, wantSprint: boolean, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
  const diag = dx !== 0 && dy !== 0 ? INV_SQRT2 : 1;
  movePlayer(p, dx * diag, dy * diag, 1, wantSprint, hasBall, attackDir, pitch, stepCount);
}

// Moves a NON-controlled player by its want channel (written by ai.ts every step
// of open play). Zero want = stand still and keep the facing.
export function stepPlayerFree(p: PlayerState, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
  const len = Math.sqrt(p.wantX * p.wantX + p.wantY * p.wantY);
  if (len === 0) {
    movePlayer(p, 0, 0, 1, p.wantSprint, hasBall, attackDir, pitch, stepCount);
    return;
  }
  movePlayer(p, p.wantX / len, p.wantY / len, len > 1 ? 1 : len, p.wantSprint, hasBall, attackDir, pitch, stepCount);
}
