export const SCORE_JUMP = 100;
export const SCORE_SMASH = 300;
export const SCORE_LEVEL = 1500;
export const HAMMER_MS = 8000;
export const LEVEL_TIME_MS = 90_000;

export function timeBonus(remainingMs: number): number {
  return Math.max(0, Math.floor(remainingMs / 1000)) * 100;
}

export function jumpedOver(
  barrelX: number,
  prevPlayerX: number,
  playerX: number,
  airborne: boolean,
): boolean {
  if (!airborne) return false;
  const lo = Math.min(prevPlayerX, playerX);
  const hi = Math.max(prevPlayerX, playerX);
  return barrelX >= lo && barrelX <= hi;
}
