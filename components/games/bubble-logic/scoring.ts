export const SCORE_POP = 10;
export const SCORE_DROP_STEP = 20;
export const SCORE_MAGIC = 200;
export const SCORE_MAP = 1000;
export const SCORE_VICTORY = 5000;

export function popScore(n: number): number {
  return n * SCORE_POP;
}

// sum_{i=1..n} SCORE_DROP_STEP*i = SCORE_DROP_STEP * n*(n+1)/2 = 10*n*(n+1)
export function cascadeScore(n: number): number {
  return 10 * n * (n + 1);
}
