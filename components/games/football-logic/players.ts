import { INV_SQRT2, type Vec2 } from './geometry';
import { centerX, centerY, clampToBigArea, goalLineX, type PitchDef, type Side } from './pitch';
import { OUTFIELD, STRATEGIES, TEAM_SIZE, type Formation, type FormationSlot, type Role, type Strategy } from './teams';
import type { Axis } from './input';
import { perStep, stepsFor } from './clock';

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

function createPlayer(id: number, team: 0 | 1, role: Role, slot: number, attackDir: 1 | -1): PlayerState {
  return {
    id, team, role, slot,
    x: 0, y: 0, vx: 0, vy: 0,
    facingX: attackDir, facingY: 0,
    sprintStepsLeft: 0, sprintCooldownSteps: 0, downUntilStep: 0,
    chargeSteps: 0, chargeButton: 'none',
    tackleStepsLeft: 0, tackleDirX: 0, tackleDirY: 0,
    wantX: 0, wantY: 0, wantSprint: false,
  };
}

// 18 players created once: ids 0..8 are team 0 (0 = goalkeeper), 9..17 team 1.
// players[i].id === i always, so players[ball.owner] is O(1).
export function createPlayers(formations: readonly [Formation, Formation], pitch: PitchDef): PlayerState[] {
  const players: PlayerState[] = [];
  for (const team of [0, 1] as const) {
    const attackDir: 1 | -1 = team === 0 ? 1 : -1;
    const base = team * TEAM_SIZE;
    players.push(createPlayer(base, team, 'gk', -1, attackDir));
    for (let s = 0; s < OUTFIELD; s++) {
      players.push(createPlayer(base + 1 + s, team, formations[team].slots[s].role, s, attackDir));
    }
    placeByFormation(players, team, formations[team], 'neutral', attackDir, pitch);
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

// Stage B2, S-PK4: the fifteen outfield players who are not taking the kick stand
// still around the centre spot and the live positioning AI does not run for them.
// The grid is 4 x 4 = 2 * OUTFIELD slots, laid out by ascending id with integer
// arithmetic -- spreading them on a circle would need trigonometry, which the engine
// bans (risk 3). Its far corner sits at sqrt(105^2 + 120^2) = 159.45 u from the centre
// spot, inside the 175 u circle.
// Stage B2 finding H4: this used to be a 5 x 3 grid (2 * OUTFIELD - 1 slots, exactly
// the fifteen needed), but its middle column and row are both exact integers
// ((5-1)/2 = 2, (3-1)/2 = 1), so slot k = 7 landed at offset (0, 0) -- one player
// parked exactly on the centre spot itself, which is where the ball of the shootout's
// NEXT kick sits. A 4 x 4 grid has no middle column or row (both (4-1)/2 = 1.5), so no
// slot's offset is ever (0, 0) regardless of which one is used -- that is what actually
// fixes the coincidence, not the choice of which slot to drop. One slot has to be
// dropped anyway, since 16 slots is one more than the fifteen players parked here;
// slot 7 is it, kept only because it is the smallest possible diff from the old
// layout's dropped centre and carries no geometric meaning of its own now.
// Stage B2 assumption S-PK7, not in the spec -- review in QA: the goalkeepers are NOT
// parked. The spec's "the sixteen remaining" would put the attacking keeper on the
// centre circle, and criterion 9b (checkGoalkeepersInBox) forbids a keeper outside its
// own big area -- so both keepers stay where placeByFormation left them, on their lines.
// Stage B2 assumption S-PK10, not in the spec -- review in QA: an extra time that ended
// mid-slide would otherwise leave a parked player frozen in the air for the whole
// shootout, so the slide, the floor and the charge are cleared here as well.
export const SHOOTOUT_GRID_COLUMNS = 4;
export const SHOOTOUT_GRID_ROWS = 4;
export const SHOOTOUT_GRID_SPACING_X = 70;
export const SHOOTOUT_GRID_SPACING_Y = 80;

export function placeAroundCentreSpot(players: PlayerState[], takerId: number, pitch: PitchDef): void {
  const cx = centerX(pitch);
  const cy = centerY(pitch);
  let k = 0;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.role === 'gk' || p.id === takerId) continue;
    if (k === 7) k++;   // Stage B2 (H4): the sixteenth slot is dropped so fifteen fit
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
  let speed = p.role === 'gk' ? GK_SPEED : hasBall ? PLAYER_SPEED_WITH_BALL : PLAYER_SPEED;
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
