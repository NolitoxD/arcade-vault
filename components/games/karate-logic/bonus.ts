export const BOARD_SCORES = [1000, 2000, 4000];

const BOARD_PERIODS_MS = [1200, 900, 650];

export function barPhase(elapsedMs: number, boardIndex: number): number {
  const period = BOARD_PERIODS_MS[Math.min(Math.max(boardIndex, 0), BOARD_PERIODS_MS.length - 1)];
  const p = (elapsedMs % period) / period;
  return p < 0.5 ? p * 2 : (1 - p) * 2;
}

export const GREEN_ZONE: [number, number] = [0.4, 0.6];

export function hitQuality(phase: number): 'hit' | 'miss' {
  return phase >= GREEN_ZONE[0] && phase <= GREEN_ZONE[1] ? 'hit' : 'miss';
}
