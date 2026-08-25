export const SCORE_PER_POINT = { half: 500, full: 1000 };
export const OPPONENT_BONUS = 2000;

export function timeBonus(remainingMs: number): number {
  return Math.floor(remainingMs / 1000) * 100;
}

export type MatchState = {
  playerPoints: number;
  cpuPoints: number;
  roundMs: number;
  goldenPoint: boolean;
  lastPointBy?: 'player' | 'cpu';
};

const MATCH_POINTS = 2;
const ROUND_LIMIT_MS = 30_000;

export function applyPoint(
  state: MatchState,
  who: 'player' | 'cpu',
  points: 0.5 | 1,
): MatchState {
  return {
    ...state,
    playerPoints: who === 'player' ? state.playerPoints + points : state.playerPoints,
    cpuPoints: who === 'cpu' ? state.cpuPoints + points : state.cpuPoints,
    lastPointBy: who,
  };
}

export function matchWinner(state: MatchState): 'player' | 'cpu' | null {
  if (state.playerPoints >= MATCH_POINTS) return 'player';
  if (state.cpuPoints >= MATCH_POINTS) return 'cpu';
  if (state.goldenPoint && state.lastPointBy) return state.lastPointBy;
  if (state.roundMs >= ROUND_LIMIT_MS) {
    if (state.playerPoints > state.cpuPoints) return 'player';
    if (state.cpuPoints > state.playerPoints) return 'cpu';
  }
  return null;
}
