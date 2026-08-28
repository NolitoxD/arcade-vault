import { CANVAS_W, girderYAt, ladderAt, type Ladder, type Layout } from './level';

export const RUN_SPEED = 130;
export const GRAVITY = 1400;
export const JUMP_VY = -430;
export const CLIMB_SPEED = 90;
export const FALL_DEATH_PX = 90;

export type PlayerState = 'run' | 'jump' | 'climb' | 'hammer' | 'dead';

export type Player = {
  x: number;
  y: number;
  vy: number;
  girder: number;
  state: PlayerState;
  facing: 1 | -1;
  hammerMs: number;
  climbing: Ladder | null;
  fellFrom: number;
};

export type Input = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
};

const LADDER_TOLERANCE = 8;

function moveOnGirder(layout: Layout, p: Player, input: Input, dt: number): void {
  const g = layout.girders[p.girder];
  if (input.left) {
    p.x -= RUN_SPEED * dt;
    p.facing = -1;
  } else if (input.right) {
    p.x += RUN_SPEED * dt;
    p.facing = 1;
  }
  p.x = Math.min(Math.max(p.x, g.x0), g.x1);
  p.y = girderYAt(g, p.x);
}

function stepAirborne(layout: Layout, p: Player, input: Input, dt: number): void {
  if (input.left) {
    p.x -= RUN_SPEED * dt;
    p.facing = -1;
  } else if (input.right) {
    p.x += RUN_SPEED * dt;
    p.facing = 1;
  }
  p.x = Math.min(Math.max(p.x, 0), CANVAS_W);
  const prevY = p.y;
  p.vy += GRAVITY * dt;
  p.y += p.vy * dt;
  if (p.vy <= 0) return;
  let landing: number | null = null;
  let landY = Infinity;
  for (const g of layout.girders) {
    if (p.x < g.x0 || p.x > g.x1) continue;
    const gy = girderYAt(g, p.x);
    if (gy >= prevY && gy <= p.y && gy < landY) {
      landY = gy;
      landing = g.index;
    }
  }
  if (landing === null) return;
  p.girder = landing;
  p.y = landY;
  p.vy = 0;
  p.state = landY - p.fellFrom > FALL_DEATH_PX ? 'dead' : 'run';
}

function arriveAtGirder(layout: Layout, p: Player, girderIndex: number): void {
  p.girder = girderIndex;
  p.y = girderYAt(layout.girders[girderIndex], p.x);
  p.state = 'run';
  p.climbing = null;
}

function stepClimb(layout: Layout, p: Player, input: Input, dt: number): void {
  const ladder = p.climbing;
  if (!ladder) {
    p.state = 'run';
    return;
  }
  if (input.up) {
    p.y -= CLIMB_SPEED * dt;
    if (p.y <= girderYAt(layout.girders[ladder.to], ladder.x)) arriveAtGirder(layout, p, ladder.to);
  } else if (input.down) {
    p.y += CLIMB_SPEED * dt;
    if (p.y >= girderYAt(layout.girders[ladder.from], ladder.x)) arriveAtGirder(layout, p, ladder.from);
  }
}

function enterLadder(p: Player, ladder: Ladder): void {
  p.state = 'climb';
  p.climbing = ladder;
  p.x = ladder.x;
  p.vy = 0;
}

function tryClimbUp(layout: Layout, p: Player): boolean {
  const ladder = ladderAt(layout, p.x, p.girder, LADDER_TOLERANCE);
  if (!ladder) return false;
  enterLadder(p, ladder);
  return true;
}

function tryClimbDown(layout: Layout, p: Player, brokenSet: Set<number>): boolean {
  for (let i = 0; i < layout.ladders.length; i++) {
    const l = layout.ladders[i];
    if (l.to !== p.girder || Math.abs(l.x - p.x) > LADDER_TOLERANCE) continue;
    if (brokenSet.has(i)) return false;
    enterLadder(p, l);
    return true;
  }
  return false;
}

export function stepPlayer(layout: Layout, p: Player, input: Input, dtMs: number, brokenSet: Set<number>): void {
  const dt = dtMs / 1000;
  switch (p.state) {
    case 'dead':
      return;
    case 'hammer':
      p.hammerMs -= dtMs;
      if (p.hammerMs <= 0) {
        p.hammerMs = 0;
        p.state = 'run';
      }
      moveOnGirder(layout, p, input, dt);
      return;
    case 'climb':
      stepClimb(layout, p, input, dt);
      return;
    case 'jump':
      stepAirborne(layout, p, input, dt);
      return;
    case 'run':
      if (input.jump) {
        p.vy = JUMP_VY;
        p.state = 'jump';
        p.fellFrom = p.y;
        stepAirborne(layout, p, input, dt);
        return;
      }
      if (input.up && tryClimbUp(layout, p)) return;
      if (input.down && tryClimbDown(layout, p, brokenSet)) return;
      moveOnGirder(layout, p, input, dt);
  }
}
